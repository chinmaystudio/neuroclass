import { createHash, randomBytes, randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabase, isSupabaseServiceRoleConfigured } from '../database/supabase';
import { withCors } from '../lib/cors';

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
  const role = String(profile?.role || '');
  if (roles.length > 0 && !roles.includes(role)) {
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

export async function createAttendanceSession(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['teacher', 'instructor', 'admin']);
    const body = await request.json().catch(() => ({}));
    const classroomId = clean(body.classroomId, 80);
    const title = clean(body.title, 120) || 'Class attendance';
    const durationMinutes = Math.max(5, Math.min(Number(body.durationMinutes) || 90, 180));
    if (!classroomId) return json({ error: 'classroomId is required.' }, 400);
    const classroom = await ownedClassroom(classroomId, user.id);

    const challengeToken = randomBytes(24).toString('base64url');
    const pin = String(randomInt(100000, 1000000));
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
      challenge_expires_at: expiresAt,
      challenge_rotated_at: now,
      verification_policy: { pin: true, teacher_face: true, liveness: false },
    }).select('id,classroom_id,title,status,starts_at,ends_at,challenge_expires_at,verification_policy').single();
    if (error || !session) return json({ error: 'Unable to open the attendance session.' }, 500);

    await audit({
      classroom_id: classroom.id,
      session_id: session.id,
      actor_user_id: user.id,
      actor_role: 'teacher',
      event_type: 'session_opened',
      payload: { durationMinutes, verificationPolicy: session.verification_policy },
    });

    return json({ session, challengeToken, pin, warning: 'Display the PIN or QR challenge only to students physically present in this classroom.' });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to open the attendance session.' }, error.status || 500);
  }
}

export async function closeAttendanceSession(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['teacher', 'instructor', 'admin']);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body.sessionId, 80);
    if (!sessionId) return json({ error: 'sessionId is required.' }, 400);
    const { data: current, error: readError } = await supabase.from('attendance_sessions').select('id,classroom_id,status').eq('id', sessionId).eq('teacher_id', user.id).maybeSingle();
    if (readError || !current) return json({ error: 'Attendance session not found.' }, 404);
    const now = new Date().toISOString();
    const { data: session, error } = await supabase.from('attendance_sessions').update({ status: 'closed', closed_at: now, ends_at: now }).eq('id', sessionId).eq('teacher_id', user.id).select('id,classroom_id,status,closed_at').single();
    if (error) return json({ error: 'Unable to close the attendance session.' }, 500);
    await audit({ classroom_id: current.classroom_id, session_id: sessionId, actor_user_id: user.id, actor_role: 'teacher', event_type: 'session_closed', payload: {} });
    return json({ session });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to close the attendance session.' }, error.status || 500);
  }
}

export async function getActiveAttendanceSession(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['student']);
    const classroomId = clean(new URL(request.url).searchParams.get('classroomId'), 80);
    if (!classroomId) return json({ error: 'classroomId is required.' }, 400);
    const { data: enrollment } = await supabase.from('students').select('id').eq('classroom_id', classroomId).eq('user_id', user.id).maybeSingle();
    if (!enrollment) return json({ error: 'You are not enrolled in this classroom.' }, 403);
    const { data, error } = await supabase.from('attendance_sessions').select('id,classroom_id,title,status,starts_at,ends_at,challenge_expires_at,verification_policy').eq('classroom_id', classroomId).eq('status', 'open').gt('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) return json({ error: 'Unable to read the active attendance session.' }, 500);
    return json({ session: data || null });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to read the active attendance session.' }, error.status || 500);
  }
}

export async function verifyAttendance(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['student']);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body.sessionId, 80);
    const pin = clean(body.pin, 12);
    const challengeToken = clean(body.challengeToken, 160);
    const idempotencyKey = clean(request.headers.get('idempotency-key') || body.idempotencyKey, 120);
    if (!sessionId || !idempotencyKey || (!pin && !challengeToken)) return json({ error: 'sessionId, idempotency key, and a PIN or challenge token are required.' }, 400);

    const { data: existing } = await supabase.from('attendance_verification_attempts').select('id,status,failure_reason').eq('session_id', sessionId).eq('student_user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      if (existing.status === 'accepted') return json({ ok: true, replay: true, attempt: existing });
      return json({ error: existing.failure_reason || 'This verification request has already been processed.', attempt: existing }, 409);
    }

    const { data: session, error: sessionError } = await supabase.from('attendance_sessions').select('id,classroom_id,teacher_id,status,ends_at,challenge_expires_at,challenge_token_hash,pin_hash').eq('id', sessionId).maybeSingle();
    if (sessionError || !session) return json({ error: 'Attendance session not found.' }, 404);
    const { data: enrollment } = await supabase.from('students').select('id,name').eq('classroom_id', session.classroom_id).eq('user_id', user.id).maybeSingle();
    if (!enrollment) return json({ error: 'You are not enrolled in this classroom.' }, 403);

    const challengeDigest = hash(pin || challengeToken);
    const now = Date.now();
    const expired = session.status !== 'open' || !session.ends_at || new Date(session.ends_at).getTime() <= now || (session.challenge_expires_at && new Date(session.challenge_expires_at).getTime() <= now);
    const validPin = Boolean(pin && session.pin_hash && hash(pin) === session.pin_hash);
    const validToken = Boolean(challengeToken && session.challenge_token_hash && hash(challengeToken) === session.challenge_token_hash);
    if (expired || (!validPin && !validToken)) {
      const failureReason = expired ? 'This attendance session is closed or expired.' : 'The attendance PIN or challenge token is invalid.';
      const { data: attempt } = await supabase.from('attendance_verification_attempts').insert({ session_id: session.id, classroom_id: session.classroom_id, student_user_id: user.id, student_id: enrollment.id, idempotency_key: idempotencyKey, challenge_digest: challengeDigest, status: expired ? 'expired' : 'rejected', failure_reason: failureReason, device_fingerprint: clean(body.deviceFingerprint, 160), proximity_metadata: body.proximityMetadata || {}, liveness_metadata: body.livenessMetadata || {} }).select('id,status,failure_reason').single();
      await audit({ classroom_id: session.classroom_id, session_id: session.id, actor_user_id: user.id, actor_role: 'student', event_type: expired ? 'verification_expired' : 'verification_rejected', payload: { attemptId: attempt?.id, reason: failureReason } });
      return json({ error: failureReason, attempt }, 403);
    }

    const { data: attempt, error: attemptError } = await supabase.from('attendance_verification_attempts').insert({ session_id: session.id, classroom_id: session.classroom_id, student_user_id: user.id, student_id: enrollment.id, idempotency_key: idempotencyKey, challenge_digest: challengeDigest, status: 'accepted', device_fingerprint: clean(body.deviceFingerprint, 160), proximity_metadata: body.proximityMetadata || {}, liveness_metadata: body.livenessMetadata || {} }).select('id,status,created_at').single();
    if (attemptError || !attempt) return json({ error: 'Unable to record the verification attempt.' }, 500);

    const { data: attendance, error: attendanceError } = await supabase.from('attendance').insert({ classroom_id: session.classroom_id, session_id: session.id, student_id: enrollment.id, student_name: enrollment.name, status: 'Present', verified_method: validPin ? 'Student PIN + Teacher Session' : 'Session Challenge + Teacher Session', marked_by: session.teacher_id, verification_attempt_id: attempt.id, capture_metadata: { source: 'server-attendance-verification', proximity: body.proximityMetadata || {}, liveness: body.livenessMetadata || {} } }).select('id,classroom_id,session_id,student_id,status,verified_method,verified_at').single();
    if (attendanceError) {
      if (attendanceError.code === '23505') {
        await supabase.from('attendance_verification_attempts').update({ status: 'duplicate', failure_reason: 'Attendance is already recorded for this session.' }).eq('id', attempt.id);
        return json({ error: 'Attendance is already recorded for this session.' }, 409);
      }
      await supabase.from('attendance_verification_attempts').update({ status: 'rejected', failure_reason: 'Attendance record could not be created.' }).eq('id', attempt.id);
      return json({ error: 'Attendance record could not be created.' }, 500);
    }

    await audit({ classroom_id: session.classroom_id, session_id: session.id, attendance_id: attendance.id, actor_user_id: user.id, actor_role: 'student', event_type: 'attendance_verified', payload: { attemptId: attempt.id, verifiedMethod: attendance.verified_method } });
    return json({ ok: true, attendance, attempt });
  } catch (error: any) {
    return json({ error: error.message || 'Unable to verify attendance.' }, error.status || 500);
  }
}

export async function markTeacherAttendance(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['teacher', 'instructor', 'admin']);
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
