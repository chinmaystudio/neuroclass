import { createHash, randomBytes, randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabase, isSupabaseServiceRoleConfigured } from '../database/supabase';
import { withCors } from '../lib/cors';
import { evaluateGeofence, isValidGeoPoint, type LocationStatus } from '../lib/geofence';
import { normalizeBackendRole } from '../lib/roles';

const ATTENDANCE_STATUSES = ['Present', 'Late', 'Excused', 'Absent', 'Pending Review'] as const;
type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

const json = (body: unknown, status = 200, req?: Request) => withCors(NextResponse.json(body, { status }), req?.headers.get('origin'));

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

const getToken = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';

async function requireUser(request: Request, roles: string[] = []) {
  if (!isSupabaseServiceRoleConfigured()) throw new Error('Server database credentials are not configured.');
  const token = getToken(request);
  if (!token) throw Object.assign(new Error('Authentication is required.'), { status: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Authentication is invalid or expired.'), { status: 401 });
  const { data: profile } = await supabase.from('users').select('role').eq('uid', data.user.id).maybeSingle();
  const role = normalizeBackendRole(profile?.role || data.user.user_metadata?.role);
  const allowedRoles = roles.map((allowedRole) => normalizeBackendRole(allowedRole));
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw Object.assign(new Error('This attendance action is not available for your account.'), { status: 403 });
  }
  return { user: data.user, role };
}

async function ownedClassroom(classroomId: string, teacherId: string) {
  const { data, error } = await supabase.from('classrooms').select('id,name,user_id').eq('id', classroomId).eq('user_id', teacherId).maybeSingle();
  if (error) throw new Error('Unable to verify classroom ownership.');
  if (!data) throw Object.assign(new Error('You do not own this classroom.'), { status: 403 });
  return data;
}

async function audit(payload: Record<string, unknown>) {
  const { error } = await supabase.from('attendance_audit_events').insert(payload);
  if (error) console.error('[attendance.audit]', error.message);
}

async function enrolledStudent(classroomId: string, user: { id: string; email?: string | null }) {
  const { data: byUser } = await supabase.from('students').select('id,name').eq('classroom_id', classroomId).eq('user_id', user.id).maybeSingle();
  if (byUser) return byUser;
  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail) {
    const { data: byEmail } = await supabase.from('students').select('id,name').eq('classroom_id', classroomId).ilike('email', normalizedEmail).maybeSingle();
    if (byEmail) return byEmail;
  }
  return null;
}

export async function createAttendanceSession(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const classroomId = clean(body.classroomId, 80);
    const title = clean(body.title, 120) || 'Class attendance';
    const durationMinutes = Math.max(5, Math.min(Number(body.durationMinutes) || 15, 180));
    const attendanceMode = clean(body.attendanceMode, 30) || 'multi_level';
    const usesGeofence = attendanceMode === 'multi_level';
    const teacherLatitude = Number(body.teacherLatitude);
    const teacherLongitude = Number(body.teacherLongitude);
    const teacherLocationAccuracy = Number(body.teacherLocationAccuracy);
    const radiusMeters = Math.round(Number(body.radiusMeters) || 100);
    if (!classroomId) return json({ error: 'classroomId is required.' }, 400);
    if (usesGeofence && (!isValidGeoPoint({ latitude: teacherLatitude, longitude: teacherLongitude }) || !Number.isFinite(teacherLocationAccuracy) || teacherLocationAccuracy < 0 || radiusMeters < 25 || radiusMeters > 1000)) {
      return json({ error: 'A valid teacher location, accuracy, and radius between 25 and 1000 meters are required.' }, 400);
    }
    const classroom = await ownedClassroom(classroomId, user.id);

    const challengeToken = randomBytes(24).toString('base64url');
    const pin = String(randomInt(100000, 1000000));
    const sessionCode = `NC-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const now = new Date().toISOString();
    const { data: session, error } = await supabase.from('attendance_sessions').insert({
      classroom_id: classroom.id,
      teacher_id: user.id,
      title,
      nonce: randomBytes(18).toString('hex'),
      status: 'open',
      starts_at: now,
      ends_at: expiresAt,
      challenge_token_hash: hash(challengeToken),
      pin_hash: hash(pin),
      session_code: sessionCode,
      challenge_expires_at: expiresAt,
      challenge_rotated_at: now,
      teacher_latitude: usesGeofence ? teacherLatitude : null,
      teacher_longitude: usesGeofence ? teacherLongitude : null,
      teacher_location_accuracy: usesGeofence ? teacherLocationAccuracy : null,
      radius_meters: usesGeofence ? radiusMeters : null,
      started_at: now,
      expires_at: expiresAt,
      verification_policy: usesGeofence
        ? { pin: true, teacher_face: false, student_face: true, face_match: true, liveness: false, geofence: true, multi_level: true }
        : { pin: true, teacher_face: true, student_face: false, liveness: true, geofence: false, multi_level: false },
    }).select('id,classroom_id,title,status,starts_at,ends_at,challenge_expires_at,verification_policy,session_code').single();
    if (error || !session) return json({ error: 'Unable to open the attendance session.' }, 500);

    if (usesGeofence) {
      const { error: announcementError } = await supabase.from('attendance_session_announcements').insert({
        attendance_session_id: session.id,
        classroom_id: classroom.id,
        event_type: 'attendance_started',
        session_code: sessionCode,
        radius_meters: usesGeofence ? radiusMeters : null,
        expires_at: expiresAt,
      });
      if (announcementError) console.error('[attendance.announcement]', announcementError.message);
    }

    await audit({
      classroom_id: classroom.id,
      session_id: session.id,
      actor_user_id: user.id,
      actor_role: 'teacher',
      event_type: 'session_opened',
      payload: { durationMinutes, attendanceMode, radiusMeters: usesGeofence ? radiusMeters : null, verificationPolicy: session.verification_policy },
    });

    return json({ session, challengeToken, pin, sessionCode, attendanceMode, radiusMeters: usesGeofence ? radiusMeters : null, warning: usesGeofence ? 'Students will be notified in the portal and must pass the geofence and Face ID checks.' : 'Display the PIN or QR challenge only to students physically present in this classroom.' });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to open the attendance session.' }, error.status || 500);
  }
}

export async function closeAttendanceSession(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body.sessionId, 80);
    if (!sessionId) return json({ error: 'sessionId is required.' }, 400);
    const { data: current, error: readError } = await supabase.from('attendance_sessions').select('id,classroom_id,status').eq('id', sessionId).eq('teacher_id', user.id).maybeSingle();
    if (readError || !current) return json({ error: 'Attendance session not found.' }, 404);
    const now = new Date().toISOString();
    const { data: session, error } = await supabase.from('attendance_sessions').update({ status: 'closed', closed_at: now, ended_at: now, ends_at: now, expires_at: now }).eq('id', sessionId).eq('teacher_id', user.id).select('id,classroom_id,status,closed_at,ended_at').single();
    if (error) return json({ error: 'Unable to close the attendance session.' }, 500);

    const [{ count: rosterCount, error: rosterError }, { data: rosterRows, error: rosterRowsError }, { data: attendanceRows, error: attendanceError }, { count: observationCount, error: observationError }] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('classroom_id', current.classroom_id),
      supabase.from('students').select('id,name,roll_number,email').eq('classroom_id', current.classroom_id).order('name', { ascending: true }),
      supabase.from('attendance').select('id,student_id,student_name,status,verified_method,verified_at,confidence').eq('session_id', sessionId).order('verified_at', { ascending: true }),
      supabase.from('attendance_observations').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
    ]);
    if (rosterError || rosterRowsError || attendanceError || observationError) console.error('[attendance.report] summary query failed', { rosterError, rosterRowsError, attendanceError, observationError });
    const attendanceByStudent = new Map((attendanceRows || []).map((entry) => [String(entry.student_id), entry]));
    const rosterEntries = (rosterRows || []).map((student) => {
      const attendance = attendanceByStudent.get(String(student.id));
      return {
        studentId: student.id,
        studentName: attendance?.student_name || student.name,
        rollNumber: student.roll_number || '',
        email: student.email || '',
        status: attendance?.status || 'Absent',
        verifiedMethod: attendance?.verified_method || '',
        verifiedAt: attendance?.verified_at || '',
        confidence: attendance?.confidence ?? '',
      };
    });
    const rosterIds = new Set(rosterEntries.map((entry) => String(entry.studentId)));
    const unlistedEntries = (attendanceRows || [])
      .filter((entry) => !rosterIds.has(String(entry.student_id)))
      .map((entry) => ({
        studentId: entry.student_id,
        studentName: entry.student_name,
        rollNumber: '',
        email: '',
        status: entry.status,
        verifiedMethod: entry.verified_method || '',
        verifiedAt: entry.verified_at || '',
        confidence: entry.confidence ?? '',
      }));
    const entries = [...rosterEntries, ...unlistedEntries];
    const presentCount = entries.filter((entry) => entry.status === 'Present' || entry.status === 'Late').length;
    const report = {
      sessionId,
      classroomId: current.classroom_id,
      closedAt: now,
      rosterCount: rosterCount || 0,
      presentCount,
      absentCount: Math.max(0, (rosterCount || 0) - presentCount),
      attendanceRate: rosterCount ? Math.round((presentCount / rosterCount) * 100) : 0,
      observationCount: observationCount || 0,
      entries,
    };
    await audit({ classroom_id: current.classroom_id, session_id: sessionId, actor_user_id: user.id, actor_role: 'teacher', event_type: 'session_closed', payload: { report: { rosterCount: report.rosterCount, presentCount: report.presentCount, observationCount: report.observationCount } } });
    return json({ session, report });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to close the attendance session.' }, error.status || 500);
  }
}

export async function getActiveAttendanceSession(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const classroomId = clean(new URL(request.url).searchParams.get('classroomId'), 80);
    if (!classroomId) return json({ error: 'classroomId is required.' }, 400);
    const enrollment = await enrolledStudent(classroomId, user);
    if (!enrollment) return json({ error: 'You are not enrolled in this classroom.' }, 403);
    const { data, error } = await supabase.from('attendance_sessions').select('id,classroom_id,title,status,starts_at,started_at,ends_at,expires_at,challenge_expires_at,verification_policy,session_code,radius_meters').eq('classroom_id', classroomId).eq('status', 'open').contains('verification_policy', { geofence: true }).gt('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) return json({ error: 'Unable to read the active attendance session.' }, 500);
    return json({ session: data || null });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to read the active attendance session.' }, error.status || 500);
  }
}

export async function verifyAttendanceLocation(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body.sessionId, 80);
    const studentLatitude = Number(body.studentLatitude);
    const studentLongitude = Number(body.studentLongitude);
    const locationAccuracy = Number(body.locationAccuracy);
    if (!sessionId) return json({ error: 'sessionId is required.' }, 400);

    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id,classroom_id,status,ends_at,teacher_latitude,teacher_longitude,radius_meters')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError || !session) return json({ error: 'Attendance session not found.' }, 404);
    const enrollment = await enrolledStudent(session.classroom_id, user);
    if (!enrollment) return json({ error: 'You are not enrolled in this classroom.' }, 403);

    const expired = session.status !== 'open' || !session.ends_at || new Date(session.ends_at).getTime() <= Date.now();
    if (expired) return json({ error: 'This attendance session is closed or expired.', locationStatus: 'LOCATION_UNAVAILABLE' }, 403);

    const hasStudentLocation = isValidGeoPoint({ latitude: studentLatitude, longitude: studentLongitude }) && Number.isFinite(locationAccuracy) && locationAccuracy >= 0;
    const hasTeacherLocation = isValidGeoPoint({ latitude: Number(session.teacher_latitude), longitude: Number(session.teacher_longitude) });
    const radiusMeters = Math.max(25, Number(session.radius_meters) || 100);
    const locationResult = hasStudentLocation && hasTeacherLocation
      ? evaluateGeofence(
          { latitude: Number(session.teacher_latitude), longitude: Number(session.teacher_longitude) },
          { latitude: studentLatitude, longitude: studentLongitude },
          locationAccuracy,
          radiusMeters,
        )
      : { status: 'LOCATION_UNAVAILABLE' as LocationStatus, distanceMeters: null, accuracyMeters: Number.isFinite(locationAccuracy) ? Math.max(0, locationAccuracy) : null };

    const { data: verification, error: verificationError } = await supabase.from('attendance_verifications').upsert({
      attendance_session_id: session.id,
      student_id: enrollment.id,
      student_user_id: user.id,
      classroom_id: session.classroom_id,
      authentication_verified: true,
      classroom_verified: true,
      session_verified: true,
      location_status: locationResult.status,
      location_verified: locationResult.status === 'LOCATION_VERIFIED',
      student_latitude: hasStudentLocation ? studentLatitude : null,
      student_longitude: hasStudentLocation ? studentLongitude : null,
      location_accuracy: locationResult.accuracyMeters,
      distance_from_teacher: locationResult.distanceMeters,
      verification_status: locationResult.status,
    }, { onConflict: 'attendance_session_id,student_id' }).select('id,attendance_session_id,location_status,location_verified,location_accuracy,distance_from_teacher,verification_status').single();
    if (verificationError) return json({ error: 'Unable to record the location verification state.' }, 500);

    await audit({
      classroom_id: session.classroom_id,
      session_id: session.id,
      actor_user_id: user.id,
      actor_role: 'student',
      event_type: 'attendance_location_checked',
      payload: { verificationId: verification?.id, locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters },
    });

    const ok = locationResult.status === 'LOCATION_VERIFIED';
    return json({ ok, locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters, verification }, ok ? 200 : 403);
  } catch (error: any) {
    return json({ error: error.message || 'Unable to verify your location.' }, error.status || 500);
  }
}

export async function verifyAttendance(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body.sessionId, 80);
    const pin = clean(body.pin, 12);
    const challengeToken = clean(body.challengeToken, 160);
    const faceMatchScore = Number(body.faceMatchScore) || 0;
    const livenessScore = Number(body.livenessScore) || 0;
    const faceDetected = Boolean(body.faceDetected);
    const studentLatitude = Number(body.studentLatitude);
    const studentLongitude = Number(body.studentLongitude);
    const locationAccuracy = Number(body.locationAccuracy);
    const idempotencyKey = clean(request.headers.get('idempotency-key') || body.idempotencyKey, 120);
    if (!sessionId || !idempotencyKey) return json({ error: 'sessionId and idempotency key are required.' }, 400);

    const { data: existing } = await supabase.from('attendance_verification_attempts').select('id,status,failure_reason').eq('session_id', sessionId).eq('student_user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      if (existing.status === 'accepted') return json({ ok: true, replay: true, attempt: existing });
      return json({ error: existing.failure_reason || 'This verification request has already been processed.', attempt: existing }, 409);
    }

    const { data: session, error: sessionError } = await supabase.from('attendance_sessions').select('id,classroom_id,teacher_id,status,ends_at,expires_at,challenge_expires_at,challenge_token_hash,pin_hash,teacher_latitude,teacher_longitude,teacher_location_accuracy,radius_meters,verification_policy').eq('id', sessionId).maybeSingle();
    if (sessionError || !session) return json({ error: 'Attendance session not found.' }, 404);
    const enrollment = await enrolledStudent(session.classroom_id, user);
    if (!enrollment) return json({ error: 'You are not enrolled in this classroom.' }, 403);

    const now = Date.now();
    const expired = session.status !== 'open' || !session.ends_at || new Date(session.ends_at).getTime() <= now;
    
    // The Multi-Level flow must use verifyStudentFaceAttendance, which performs the AI match server-side.
    const useMultiLevel = !pin && !challengeToken;
    if (useMultiLevel) return json({ error: 'Multi-Level attendance must use the secure Face ID camera endpoint.' }, 400);
    const validPin = Boolean(pin && session.pin_hash && hash(pin) === session.pin_hash);
    const validToken = Boolean(challengeToken && session.challenge_token_hash && hash(challengeToken) === session.challenge_token_hash);
    const hasStudentLocation = isValidGeoPoint({ latitude: studentLatitude, longitude: studentLongitude }) && Number.isFinite(locationAccuracy) && locationAccuracy >= 0;
    const hasTeacherLocation = isValidGeoPoint({ latitude: Number(session.teacher_latitude), longitude: Number(session.teacher_longitude) });
    const radiusMeters = Math.max(25, Number(session.radius_meters) || 100);
    const locationResult = hasStudentLocation && hasTeacherLocation
      ? evaluateGeofence(
          { latitude: Number(session.teacher_latitude), longitude: Number(session.teacher_longitude) },
          { latitude: studentLatitude, longitude: studentLongitude },
          locationAccuracy,
          radiusMeters,
        )
      : { status: 'LOCATION_UNAVAILABLE' as LocationStatus, distanceMeters: null, accuracyMeters: Number.isFinite(locationAccuracy) ? Math.max(0, locationAccuracy) : null };
    const locationAllowed = !useMultiLevel || locationResult.status === 'LOCATION_VERIFIED';
    const validFace = useMultiLevel && locationAllowed && faceDetected && faceMatchScore >= 60 && livenessScore >= 50;
    const finalConfidence = useMultiLevel ? Math.min(faceMatchScore, livenessScore) : 100;

    if (expired || (!validPin && !validToken && !validFace)) {
      const failureReason = expired
        ? 'This attendance session is closed or expired.'
        : (useMultiLevel && locationResult.status !== 'LOCATION_VERIFIED'
          ? `Attendance blocked: ${locationResult.status === 'OUTSIDE_RADIUS' ? 'you are outside the attendance zone.' : locationResult.status === 'LOCATION_UNCERTAIN' ? 'your location is too uncertain to verify automatically.' : 'your location could not be verified.'}`
          : (useMultiLevel ? 'Face verification failed.' : 'The attendance PIN or challenge token is invalid.'));
      const { data: attempt } = await supabase.from('attendance_verification_attempts').insert({ session_id: session.id, classroom_id: session.classroom_id, student_user_id: user.id, student_id: enrollment.id, idempotency_key: idempotencyKey, challenge_digest: hash(pin || challengeToken || 'face'), status: expired ? 'expired' : 'rejected', failure_reason: failureReason, device_fingerprint: clean(body.deviceFingerprint, 160), proximity_metadata: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters }, liveness_metadata: { ...body.livenessMetadata, faceMatchScore, livenessScore } }).select('id,status,failure_reason').single();
      await audit({ classroom_id: session.classroom_id, session_id: session.id, actor_user_id: user.id, actor_role: 'student', event_type: expired ? 'verification_expired' : 'verification_rejected', payload: { attemptId: attempt?.id, reason: failureReason } });
      
      if (useMultiLevel) {
        await supabase.from('attendance_verifications').update({
          location_status: locationResult.status,
          location_verified: locationResult.status === 'LOCATION_VERIFIED',
          student_latitude: hasStudentLocation ? studentLatitude : null,
          student_longitude: hasStudentLocation ? studentLongitude : null,
          location_accuracy: locationResult.accuracyMeters,
          distance_from_teacher: locationResult.distanceMeters,
          face_detected: faceDetected,
          liveness_score: livenessScore,
          face_match_score: faceMatchScore,
          final_confidence: finalConfidence,
          verification_status: 'FACE_FAILED'
        }).eq('attendance_session_id', session.id).eq('student_id', enrollment.id);
      }
      
      return json({ error: failureReason, attempt }, 403);
    }

    const { data: attempt, error: attemptError } = await supabase.from('attendance_verification_attempts').insert({ session_id: session.id, classroom_id: session.classroom_id, student_user_id: user.id, student_id: enrollment.id, idempotency_key: idempotencyKey, challenge_digest: hash(pin || challengeToken || 'face'), status: 'accepted', device_fingerprint: clean(body.deviceFingerprint, 160), proximity_metadata: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters }, liveness_metadata: { ...body.livenessMetadata, faceMatchScore, livenessScore } }).select('id,status,created_at').single();
    if (attemptError || !attempt) return json({ error: 'Unable to record the verification attempt.' }, 500);

    const verifiedMethod = useMultiLevel ? 'Multi-Level Face Verification' : (validPin ? 'Student PIN + Teacher Session' : 'Session Challenge + Teacher Session');
    
    const { data: attendance, error: attendanceError } = await supabase.from('attendance').insert({ classroom_id: session.classroom_id, session_id: session.id, student_id: enrollment.id, student_id_legacy: enrollment.id, student_name: enrollment.name, status: 'Present', verified_method: verifiedMethod, marked_by: session.teacher_id, verification_attempt_id: attempt.id, confidence: finalConfidence, capture_metadata: { source: 'server-attendance-verification', geofence: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters }, liveness: { faceMatchScore, livenessScore } } }).select('id,classroom_id,session_id,student_id,status,verified_method,verified_at').single();
    
    if (attendanceError) {
      if (attendanceError.code === '23505') {
        await supabase.from('attendance_verification_attempts').update({ status: 'duplicate', failure_reason: 'Attendance is already recorded for this session.' }).eq('id', attempt.id);
        return json({ error: 'Attendance is already recorded for this session.' }, 409);
      }
      await supabase.from('attendance_verification_attempts').update({ status: 'rejected', failure_reason: 'Attendance record could not be created.' }).eq('id', attempt.id);
      return json({ error: 'Attendance record could not be created.' }, 500);
    }

    if (useMultiLevel) {
      await supabase.from('attendance_verifications').update({
        face_detected: faceDetected,
        liveness_score: livenessScore,
        face_match_score: faceMatchScore,
        final_confidence: finalConfidence,
        overall_confidence: finalConfidence,
        location_status: locationResult.status,
        location_verified: true,
        student_latitude: hasStudentLocation ? studentLatitude : null,
        student_longitude: hasStudentLocation ? studentLongitude : null,
        location_accuracy: locationResult.accuracyMeters,
        distance_from_teacher: locationResult.distanceMeters,
        verification_status: 'VERIFIED',
        verified_at: new Date().toISOString()
      }).eq('attendance_session_id', session.id).eq('student_id', enrollment.id);
    }

    await audit({ classroom_id: session.classroom_id, session_id: session.id, attendance_id: attendance.id, actor_user_id: user.id, actor_role: 'student', event_type: 'attendance_verified', payload: { attemptId: attempt.id, verifiedMethod: attendance.verified_method } });
    return json({ ok: true, attendance, attempt, stats: { score: faceMatchScore, liveness: livenessScore, confidence: finalConfidence, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters } });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to verify attendance.' }, error.status || 500);
  }
}

export async function markTeacherAttendance(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const classroomId = clean(body.classroomId, 80);
    const sessionId = clean(body.sessionId, 80);
    const studentId = clean(body.studentId, 80);
    const studentName = clean(body.studentName, 180);
    const mode = clean(body.mode, 20) || 'single';
    const confidence = Number(body.confidence);
    if (!classroomId || !sessionId || !studentId || !studentName) return json({ error: 'classroomId, sessionId, studentId, and studentName are required.' }, 400);
    await ownedClassroom(classroomId, user.id);
    const { data: session, error: sessionError } = await supabase.from('attendance_sessions').select('id,classroom_id,teacher_id,status,ends_at').eq('id', sessionId).eq('classroom_id', classroomId).eq('teacher_id', user.id).maybeSingle();
    if (sessionError || !session) return json({ error: 'Attendance session not found.' }, 404);
    if (session.status !== 'open' || (session.ends_at && new Date(session.ends_at).getTime() <= Date.now())) return json({ error: 'Attendance session is closed or expired.' }, 409);
    const { data: enrolled } = await supabase.from('students').select('id,name,email').eq('id', studentId).eq('classroom_id', classroomId).maybeSingle();
    if (!enrolled) return json({ error: 'Student is not enrolled in this classroom.' }, 403);
    const { data: attendance, error } = await supabase.from('attendance').insert({ classroom_id: classroomId, session_id: sessionId, student_id: enrolled.id, student_name: enrolled.name, status: 'Present', verified_method: 'Teacher Face-ID Biometric', marked_by: user.id, capture_metadata: { source: 'teacher-console', mode, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 100)) : null } }).select('id,classroom_id,session_id,student_id,student_name,status,verified_method,verified_at').single();
    if (error) {
      if (error.code === '23505') return json({ error: 'This student is already marked for the active session.' }, 409);
      return json({ error: 'Unable to record attendance.' }, 500);
    }
    await audit({ classroom_id: classroomId, session_id: sessionId, attendance_id: attendance.id, actor_user_id: user.id, actor_role: 'teacher', event_type: 'attendance_teacher_marked', payload: { mode, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 100)) : null } });
    return json({ attendance });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to record attendance.' }, error.status || 500);
  }
}

export async function verifyStudentFaceAttendance(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['student']);
    const form = await request.formData();
    const sessionId = clean(form.get('sessionId'), 80);
    const files = form.getAll('file').filter((value): value is File => value instanceof File).slice(0, 3);
    const file = files[0];
    const idempotencyKey = clean(request.headers.get('idempotency-key') || form.get('idempotencyKey'), 120);
    const studentLatitude = Number(form.get('studentLatitude'));
    const studentLongitude = Number(form.get('studentLongitude'));
    const locationAccuracy = Number(form.get('locationAccuracy'));
    if (!sessionId || !idempotencyKey) return json({ error: 'sessionId, camera frame, and idempotency key are required.' }, 400);
    if (!(file instanceof File)) return json({ error: 'A camera frame is required for Face ID verification.' }, 400);

    const { data: existing } = await supabase.from('attendance_verification_attempts').select('id,status,failure_reason').eq('session_id', sessionId).eq('student_user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      if (existing.status === 'accepted') return json({ ok: true, replay: true, attempt: existing });
      return json({ error: existing.failure_reason || 'This verification request has already been processed.', attempt: existing }, 409);
    }

    const { data: session, error: sessionError } = await supabase.from('attendance_sessions').select('id,classroom_id,teacher_id,status,ends_at,teacher_latitude,teacher_longitude,radius_meters').eq('id', sessionId).maybeSingle();
    if (sessionError || !session) return json({ error: 'Attendance session not found.' }, 404);
    const { data: enrollment } = await supabase.from('students').select('id,name,face_registration_status').eq('classroom_id', session.classroom_id).eq('user_id', user.id).maybeSingle();
    if (!enrollment) return json({ error: 'You are not enrolled in this classroom.' }, 403);

    const expired = session.status !== 'open' || !session.ends_at || new Date(session.ends_at).getTime() <= Date.now();
    const hasStudentLocation = isValidGeoPoint({ latitude: studentLatitude, longitude: studentLongitude }) && Number.isFinite(locationAccuracy) && locationAccuracy >= 0;
    const hasTeacherLocation = isValidGeoPoint({ latitude: Number(session.teacher_latitude), longitude: Number(session.teacher_longitude) });
    const radiusMeters = Math.max(25, Number(session.radius_meters) || 100);
    const locationResult = hasStudentLocation && hasTeacherLocation
      ? evaluateGeofence(
          { latitude: Number(session.teacher_latitude), longitude: Number(session.teacher_longitude) },
          { latitude: studentLatitude, longitude: studentLongitude },
          locationAccuracy,
          radiusMeters,
        )
      : { status: 'LOCATION_UNAVAILABLE' as LocationStatus, distanceMeters: null, accuracyMeters: Number.isFinite(locationAccuracy) ? Math.max(0, locationAccuracy) : null };
    const locationConfidence = locationResult.distanceMeters === null ? 0 : Math.max(0, Math.min(100, (1 - locationResult.distanceMeters / radiusMeters) * 100));

    const updateVerification = async (fields: Record<string, unknown>) => {
      await supabase.from('attendance_verifications').upsert({
        attendance_session_id: session.id,
        student_id: enrollment.id,
        student_user_id: user.id,
        classroom_id: session.classroom_id,
        authentication_verified: true,
        classroom_verified: true,
        session_verified: !expired,
        location_status: locationResult.status,
        location_verified: locationResult.status === 'LOCATION_VERIFIED',
        student_latitude: hasStudentLocation ? studentLatitude : null,
        student_longitude: hasStudentLocation ? studentLongitude : null,
        location_accuracy: locationResult.accuracyMeters,
        distance_from_teacher: locationResult.distanceMeters,
        ...fields,
      }, { onConflict: 'attendance_session_id,student_id' });
    };

    if (expired || locationResult.status !== 'LOCATION_VERIFIED') {
      const failureReason = expired
        ? 'This attendance session is closed or expired.'
        : locationResult.status === 'OUTSIDE_RADIUS'
          ? 'You are outside the attendance zone.'
          : locationResult.status === 'LOCATION_UNCERTAIN'
            ? 'Your location is too uncertain to verify automatically.'
            : 'Your location could not be verified.';
      await updateVerification({ verification_status: locationResult.status });
      const { data: attempt } = await supabase.from('attendance_verification_attempts').insert({
        session_id: session.id,
        classroom_id: session.classroom_id,
        student_user_id: user.id,
        student_id: enrollment.id,
        idempotency_key: idempotencyKey,
        challenge_digest: hash('student-face'),
        status: expired ? 'expired' : 'rejected',
        failure_reason: failureReason,
        proximity_metadata: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters },
      }).select('id,status,failure_reason').single();
      return json({ error: failureReason, locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters, attempt }, 403);
    }

    if (String(enrollment.face_registration_status || '').toUpperCase() !== 'REGISTERED') {
      await updateVerification({ verification_status: 'FACE_FAILED' });
      return json({ error: 'Face ID is not enrolled for this student.' }, 403);
    }

    const aiBaseUrl = process.env.AI_SERVICE_URL?.replace(/\/$/, '');
    const aiSecret = process.env.AI_SERVICE_SECRET;
    if (!aiBaseUrl || !aiSecret) return json({ error: 'AI service configuration is missing.' }, 500);

    const frameDigests = new Set<string>();
    const aiPayloads: any[] = [];
    for (const candidateFile of files) {
      const bytes = Buffer.from(await candidateFile.arrayBuffer());
      frameDigests.add(hash(bytes.toString('base64')));
      const outgoing = new FormData();
      outgoing.append('classroom_id', session.classroom_id);
      outgoing.append('session_id', session.id);
      // Restrict the private AI matcher to the authenticated student’s enrolled profile.
      // This prevents a classroom-wide nearest neighbor from being mistaken for the logged-in student.
      outgoing.append('target_student_id', enrollment.id);
      outgoing.append('capture_mode', 'manual');
      outgoing.append('file', candidateFile, candidateFile.name || 'student-face.jpg');
      const aiResponse = await fetch(`${aiBaseUrl}/ai/v1/attendance/frame`, { method: 'POST', headers: { Authorization: `Bearer ${aiSecret}` }, body: outgoing });
      const aiPayload = await aiResponse.json().catch(() => ({}));
      if (!aiResponse.ok) return json({ error: 'Face ID service could not process the camera sequence.' }, 502);
      aiPayloads.push(aiPayload);
    }

    const resultSets = aiPayloads.map((payload) => Array.isArray(payload.results) ? payload.results : []);
    const results = resultSets.flat();
    const numericScore = (value: unknown, fallback = 0) => {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed <= 1 ? parsed * 100 : parsed;
      return fallback;
    };
    const scoreForResult = (result: any) => numericScore(
      result.similarity ?? result.similarity_score ?? result.face_match_score ?? result.match_score ?? result.faceMatchScore ?? result.match_percent ?? result.matchPercent ?? result.score ?? result.confidence ?? result.match?.similarity ?? result.match?.score,
      String(result.confidence || '').toUpperCase() === 'HIGH' ? 95 : 0,
    );
    const studentIdForResult = (result: any) => result.student_id ?? result.studentId ?? result.student_id_legacy ?? result.matched_student_id ?? result.matchedStudentId ?? result.match?.student_id ?? result.match?.studentId ?? result.identity?.student_id ?? result.identity?.studentId;
    // Match the authenticated enrollee by ID and score, not by the AI display status.
    // The upstream service may label a valid enrolled match REVIEW, or may return the auth user ID instead of students.id.
    const allowedAIStudentIds = new Set([String(enrollment.id), String(user.id)].map((value) => value.trim().toLowerCase()).filter(Boolean));
    const identityCandidates = results.filter((result: any) => allowedAIStudentIds.has(String(studentIdForResult(result) || '').trim().toLowerCase()));
    const identityMatches = identityCandidates.filter((result: any) => scoreForResult(result) > 0);
    const identityMatch = [...identityMatches].sort((left: any, right: any) => scoreForResult(right) - scoreForResult(left))[0];
    const bestObservedResult = [...results].filter((result: any) => scoreForResult(result) > 0).sort((left: any, right: any) => scoreForResult(right) - scoreForResult(left))[0];
    const identityMatchScore = identityMatch ? scoreForResult(identityMatch) : 0;
    const bestObservedScore = bestObservedResult ? scoreForResult(bestObservedResult) : 0;
    // Preserve the useful detected percentage in the response even when the AI did not attach the expected ID.
    const faceMatchScore = identityMatchScore || bestObservedScore;
    const faceDetected = resultSets.some((frameResults) => frameResults.some((result: any) => Array.isArray(result.bbox) && result.bbox.length === 4)) || Boolean(bestObservedResult);
    const detectedFace = results.find((result: any) => Array.isArray(result.bbox) && result.bbox.length === 4);
    const faceBox = (identityMatch?.bbox || bestObservedResult?.bbox || detectedFace?.bbox || null) as number[] | null;
    const identityVerified = Boolean(identityMatch) && identityMatchScore >= 60;
    console.info('[attendance.student-face] matcher summary', { frameCount: files.length, resultCounts: resultSets.map((frameResults) => frameResults.length), resultCount: results.length, identityCandidateCount: identityCandidates.length, positiveIdentityCount: identityMatches.length, identityMatchScore, bestObservedScore, faceDetected });
    const overallConfidence = Math.min(locationConfidence, identityVerified ? identityMatchScore : 0);
    const accepted = faceDetected && identityVerified;

    if (!accepted) {
      const failureReason = !faceDetected
        ? 'No face was detected.'
        : !identityMatch
          ? `A face was detected at ${Math.round(faceMatchScore)}% similarity, but it could not be matched to the logged-in student.`
          : `Face match was ${Math.round(identityMatchScore)}%; at least 60% is required.`;
      await updateVerification({ face_detected: faceDetected, face_match_score: faceMatchScore, overall_confidence: overallConfidence, final_confidence: overallConfidence, verification_status: 'FACE_FAILED' });
      const { data: attempt } = await supabase.from('attendance_verification_attempts').insert({
        session_id: session.id,
        classroom_id: session.classroom_id,
        student_user_id: user.id,
        student_id: enrollment.id,
        idempotency_key: idempotencyKey,
        challenge_digest: hash('student-face'),
        status: 'rejected',
        failure_reason: failureReason,
        proximity_metadata: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters },
      }).select('id,status,failure_reason').single();
      return json({ error: failureReason, faceDetected, faceBox, faceMatchScore, matchPercent: faceMatchScore, framesSubmitted: files.length, matchedFrames: identityMatches.length, attempt }, 403);
    }

    const { data: attempt, error: attemptError } = await supabase.from('attendance_verification_attempts').insert({
      session_id: session.id,
      classroom_id: session.classroom_id,
      student_user_id: user.id,
      student_id: enrollment.id,
      idempotency_key: idempotencyKey,
      challenge_digest: hash('student-face'),
      status: 'accepted',
      proximity_metadata: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters },
    }).select('id,status,created_at').single();
    if (attemptError || !attempt) return json({ error: 'Unable to record the verification attempt.' }, 500);

    const { data: attendance, error: attendanceError } = await supabase.from('attendance').insert({
      classroom_id: session.classroom_id,
      session_id: session.id,
      student_id: enrollment.id,
      student_id_legacy: enrollment.id,
      student_name: enrollment.name,
      status: 'Present',
      verified_method: 'Multi-Level Geofence + Face ID',
      marked_by: session.teacher_id,
      verification_attempt_id: attempt.id,
      confidence: overallConfidence,
      capture_metadata: { source: 'server-student-face-verification', geofence: { locationStatus: locationResult.status, distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters }, face: { faceMatchScore, verificationMode: 'face_match_only' } },
    }).select('id,classroom_id,session_id,student_id,status,verified_method,verified_at').single();
    if (attendanceError) {
      if (attendanceError.code === '23505') return json({ error: 'Attendance is already recorded for this session.', faceBox, faceMatchScore, matchPercent: faceMatchScore }, 409);
      await supabase.from('attendance_verification_attempts').update({ status: 'rejected', failure_reason: 'Attendance record could not be created.' }).eq('id', attempt.id);
      console.error('[attendance.student-face] attendance insert failed', { code: attendanceError.code, message: attendanceError.message, details: attendanceError.details, hint: attendanceError.hint, faceMatchScore });
      return json({ error: 'Attendance record could not be created.', faceBox, faceMatchScore, matchPercent: faceMatchScore }, 500);
    }

    await updateVerification({ face_detected: faceDetected, face_match_score: faceMatchScore, final_confidence: overallConfidence, overall_confidence: overallConfidence, verification_status: 'VERIFIED', verified_at: new Date().toISOString() });
    await audit({ classroom_id: session.classroom_id, session_id: session.id, attendance_id: attendance.id, actor_user_id: user.id, actor_role: 'student', event_type: 'attendance_verified', payload: { attemptId: attempt.id, verifiedMethod: 'Multi-Level Geofence + Face ID', distanceMeters: locationResult.distanceMeters, faceMatchScore } });
    return json({ ok: true, attendance, attempt, faceBox, stats: { distanceMeters: locationResult.distanceMeters, accuracyMeters: locationResult.accuracyMeters, radiusMeters, faceMatchScore, matchPercent: faceMatchScore, framesSubmitted: files.length, matchedFrames: identityMatches.length, confidence: overallConfidence, verificationMode: 'face_match_only' } });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to complete student Face ID verification.' }, error.status || 500);
  }
}

export async function correctAttendance(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['teacher', 'instructor', 'admin']);
    const body = await request.json().catch(() => ({}));
    const attendanceId = clean(body.attendanceId, 80);
    const reason = clean(body.reason, 500);
    const newStatus = clean(body.newStatus, 30) as AttendanceStatus;
    if (!attendanceId || !reason || !ATTENDANCE_STATUSES.includes(newStatus)) return json({ error: 'attendanceId, reason, and a valid newStatus are required.' }, 400);
    const { data: current, error: readError } = await supabase.from('attendance').select('id,classroom_id,session_id,status,correction_version').eq('id', attendanceId).maybeSingle();
    if (readError || !current) return json({ error: 'Attendance record not found.' }, 404);
    await ownedClassroom(current.classroom_id, user.id);
    if (current.status === newStatus) return json({ error: 'The attendance record already has this status.' }, 409);
    const { data: correction, error: correctionError } = await supabase.from('attendance_corrections').insert({ attendance_id: current.id, classroom_id: current.classroom_id, old_status: current.status, new_status: newStatus, reason, corrected_by: user.id, metadata: { source: 'teacher-console' } }).select('id,created_at').single();
    if (correctionError || !correction) return json({ error: 'Unable to create the correction audit record.' }, 500);
    const { data: attendance, error: updateError } = await supabase.from('attendance').update({ status: newStatus, correction_version: Number(current.correction_version || 0) + 1, corrected_at: new Date().toISOString(), corrected_by: user.id }).eq('id', current.id).eq('classroom_id', current.classroom_id).select('id,status,correction_version,corrected_at,corrected_by').single();
    if (updateError || !attendance) return json({ error: 'Unable to apply the attendance correction.' }, 500);
    await audit({ classroom_id: current.classroom_id, session_id: current.session_id, attendance_id: current.id, actor_user_id: user.id, actor_role: 'teacher', event_type: 'attendance_corrected', payload: { correctionId: correction.id, oldStatus: current.status, newStatus, reason } });
    return json({ attendance, correction });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to correct attendance.' }, error.status || 500);
  }
}
