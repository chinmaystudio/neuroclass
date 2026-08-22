import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { supabase } from '../database/supabase';
import { withCors } from './cors';

export type GatewayAuth = {
  user: User;
  db: SupabaseClient;
};

export class GatewayError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const TEACHER_FACE_MATCH_THRESHOLD = 45;

function similarityPercent(result: any): number {
  const raw = result?.similarity ?? result?.similarity_score ?? result?.face_match_score ?? result?.match_score ?? result?.matchPercent ?? result?.score;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

function adminDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GatewayError('Server Supabase configuration is missing', 500);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function jsonError(error: unknown, request?: Request): Response {
  const status = error instanceof GatewayError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return withCors(Response.json({ error: message }, { status }), request?.headers.get('origin'));
}

export async function requireGatewayAuth(request: Request): Promise<GatewayAuth> {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new GatewayError('Missing Supabase access token', 401);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new GatewayError('Invalid or expired Supabase access token', 401);
  return { user: data.user, db: adminDb() };
}

export function requireUuid(value: FormDataEntryValue | string | null, field: string): string {
  const raw = typeof value === 'string' ? value : value instanceof File ? value.name : value;
  if (!raw || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new GatewayError(`${field} must be a UUID`, 400);
  }
  return raw;
}

export async function assertTeacherOwnsClassroom(auth: GatewayAuth, classroomId: string): Promise<void> {
  const { data, error } = await auth.db.from('classrooms').select('id').eq('id', classroomId).eq('user_id', auth.user.id).maybeSingle();
  if (error || !data) throw new GatewayError('You do not own this classroom', 403);
}

export async function assertStudentOwnsClassroom(auth: GatewayAuth, studentId: string, classroomId: string): Promise<void> {
  const { data, error } = await auth.db.from('students').select('id,user_id,email').eq('id', studentId).eq('classroom_id', classroomId).maybeSingle();
  if (error || !data) throw new GatewayError('You do not own this student enrollment', 403);
  const loginEmail = auth.user.email?.trim().toLowerCase();
  const enrollmentEmail = String(data.email || '').trim().toLowerCase();
  if (data.user_id !== auth.user.id && (!loginEmail || enrollmentEmail !== loginEmail)) throw new GatewayError('You do not own this student enrollment', 403);
}

export async function assertTeacherOrStudentCanRegister(auth: GatewayAuth, studentId: string, classroomId: string): Promise<void> {
  const { data: enrollment, error: enrollmentError } = await auth.db
    .from('students')
    .select('id,user_id,email')
    .eq('id', studentId)
    .eq('classroom_id', classroomId)
    .maybeSingle();
  if (enrollmentError || !enrollment) throw new GatewayError('Student enrollment was not found in this classroom', 404);
  const loginEmail = auth.user.email?.trim().toLowerCase();
  const enrollmentEmail = String(enrollment.email || '').trim().toLowerCase();
  if (String(enrollment.user_id || '') === auth.user.id || Boolean(loginEmail && enrollmentEmail === loginEmail)) return;

  const { data: classroom, error: classroomError } = await auth.db
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (classroomError || !classroom) throw new GatewayError('You are not authorized to register this student', 403);
}

export async function getAuthorizedSession(auth: GatewayAuth, sessionId: string) {
  const { data, error } = await auth.db.from('attendance_sessions').select('id,classroom_id,teacher_id,status,starts_at,ends_at,started_at,finished_at').eq('id', sessionId).maybeSingle();
  if (error || !data) throw new GatewayError('Attendance session not found', 404);
  const ownsClassroom = data.teacher_id === auth.user.id || await auth.db.from('classrooms').select('id').eq('id', data.classroom_id).eq('user_id', auth.user.id).maybeSingle().then((result) => !result.error && !!result.data);
  if (!ownsClassroom) throw new GatewayError('You do not own this attendance session', 403);
  return data;
}

export function sessionIsOpen(session: { status?: string; ends_at?: string | null }): boolean {
  const status = String(session.status || '').toLowerCase();
  return ['open', 'active', 'started'].includes(status) && (!session.ends_at || new Date(session.ends_at).getTime() > Date.now());
}

export async function assertStudentInAttendanceSession(auth: GatewayAuth, studentId: string, classroomId: string, sessionId: string): Promise<void> {
  const { data: session, error: sessionError } = await auth.db.from('attendance_sessions').select('id,classroom_id,status,ends_at').eq('id', sessionId).eq('classroom_id', classroomId).maybeSingle();
  if (sessionError || !session) throw new GatewayError('Attendance session not found', 404);
  if (!sessionIsOpen(session)) throw new GatewayError('Attendance session is not active', 409);
  const { data: enrollment, error: enrollmentError } = await auth.db.from('students').select('id,user_id,email').eq('id', studentId).eq('classroom_id', classroomId).maybeSingle();
  if (enrollmentError || !enrollment) throw new GatewayError('Student enrollment was not found in this classroom', 404);
  const loginEmail = auth.user.email?.trim().toLowerCase();
  const enrollmentEmail = String(enrollment.email || '').trim().toLowerCase();
  const isStudent = enrollment.user_id === auth.user.id || Boolean(loginEmail && enrollmentEmail === loginEmail);
  if (!isStudent) throw new GatewayError('You do not own this student enrollment', 403);
}

export async function forwardMultipartToRender(path: string, source: FormData, names: string[]): Promise<Response> {
  const baseUrl = process.env.AI_SERVICE_URL?.replace(/\/$/, '');
  const secret = process.env.AI_SERVICE_SECRET;
  if (!baseUrl || !secret) throw new GatewayError('AI service configuration is missing', 500);
  const outgoing = new FormData();
  for (const name of names) {
    const values = source.getAll(name);
    for (const value of values) {
      if (typeof value === 'string') outgoing.append(name, value);
      else if (value instanceof File) outgoing.append(name, value, value.name || 'upload.jpg');
    }
  }
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    body: outgoing,
  });
}

export async function persistObservations(auth: GatewayAuth, sessionId: string, results: any[]) {
  if (!results.length) return results;
  const rows = results.map((result) => ({
    session_id: sessionId,
    student_id: result.student_id || null,
    track_id: result.track_id ?? null,
    status: result.status || 'UNKNOWN',
    similarity: typeof result.similarity === 'number' ? result.similarity : null,
    confidence: typeof result.confidence === 'number' ? result.confidence : null,
    verification: result.verification || 'render_arcface',
  }));
  const { data: inserted, error } = await auth.db.from('attendance_observations').insert(rows).select('id');
  if (error) {
    console.error('[attendance.observations] persistence failed', { message: error.message, code: error.code, details: error.details, hint: error.hint });
    throw new GatewayError('Unable to persist attendance observations', 500);
  }
  return results.map((result, index) => ({ ...result, observation_id: inserted?.[index]?.id || null }));
}

export async function materializeManualPresentAttendance(auth: GatewayAuth, session: { id: string; classroom_id: string }, results: any[]) {
  // Render may label a valid manual capture REVIEW while the numeric similarity is
  // above the teacher’s configured threshold. Manual capture is the explicit
  // record action, so persist only an enrolled student meeting this server rule.
  const present = results
    .filter((result) => result.student_id && (result.status === 'PRESENT' || similarityPercent(result) >= TEACHER_FACE_MATCH_THRESHOLD))
    .map((result) => ({
      ...result,
      status: 'PRESENT',
      verification: 'MANUAL',
    }));
  if (!present.length) return results;
  const studentIds = [...new Set(present.map((result) => result.student_id as string))];
  const { data: students, error: studentsError } = await auth.db
    .from('students')
    .select('id,name')
    .eq('classroom_id', session.classroom_id)
    .in('id', studentIds);
  if (studentsError) throw new GatewayError('Unable to load enrolled students for attendance', 500);
  const studentById = new Map((students || []).map((student) => [student.id, student]));
  const validPresentRaw = present.filter((result) => studentById.has(result.student_id));
  if (!validPresentRaw.length) return results;

  // Deduplicate by student_id to prevent unique constraint violations
  // if the AI service maps multiple faces to the same student in a single frame.
  const uniquePresentMap = new Map();
  for (const result of validPresentRaw) {
    if (!uniquePresentMap.has(result.student_id)) {
      uniquePresentMap.set(result.student_id, result);
    }
  }
  const validPresent = Array.from(uniquePresentMap.values());

  const observationIds = validPresent.map((result) => result.observation_id).filter(Boolean);
  if (observationIds.length) {
    const { error: observationError } = await auth.db
      .from('attendance_observations')
      .update({ status: 'PRESENT', verification: 'MANUAL' })
      .eq('session_id', session.id)
      .in('id', observationIds);
    if (observationError) throw new GatewayError('Unable to persist reviewed attendance observations', 500);
  }

  const attendanceRows = validPresent.map((result) => ({
    session_id: session.id,
    classroom_id: session.classroom_id,
    student_id: result.student_id,
    student_id_legacy: result.student_id, // Satisfy live database NOT NULL constraint
    student_name: studentById.get(result.student_id)?.name || 'Student',
    status: 'Present',
    verified_method: 'Teacher Face-ID Biometric (Manual Capture)',
    marked_by: auth.user.id,
    confidence: similarityPercent(result),
    capture_metadata: { source: 'teacher-manual-capture', faceMatchScore: similarityPercent(result), threshold: TEACHER_FACE_MATCH_THRESHOLD },
  }));

  // Supabase/PostgreSQL ON CONFLICT cannot use a partial index (WHERE session_id IS NOT NULL).
  // So we manually check for existing records and update/insert accordingly.
  const { data: existingAttendance, error: fetchError } = await auth.db
    .from('attendance')
    .select('id, student_id')
    .eq('session_id', session.id)
    .in('student_id', studentIds);

  if (fetchError) {
    console.error('[attendance.manual] fetch existing failed', fetchError);
    throw new GatewayError(`Unable to persist reviewed attendance: ${fetchError.message || JSON.stringify(fetchError)}`, 500);
  }

  const existingIds = new Set((existingAttendance || []).map(a => a.student_id));
  const toInsert = attendanceRows.filter(row => !existingIds.has(row.student_id));
  const toUpdate = attendanceRows.filter(row => existingIds.has(row.student_id));

  if (toInsert.length > 0) {
    const { error: insertError } = await auth.db.from('attendance').insert(toInsert);
    if (insertError) {
      console.error('[attendance.manual] insert failed', insertError);
      throw new GatewayError(`Unable to persist reviewed attendance: ${insertError.message || JSON.stringify(insertError)}`, 500);
    }
  }

  if (toUpdate.length > 0) {
    // Supabase JS doesn't support bulk updates with different values per row easily,
    // but in this case, the status and verified_method are the same for all.
    // We can just update them all in one go.
    const { error: updateError } = await auth.db
      .from('attendance')
      .update({
        status: 'Present',
        verified_method: 'Teacher Face-ID Biometric (Manual Capture)',
        marked_by: auth.user.id,
      })
      .eq('session_id', session.id)
      .in('student_id', Array.from(existingIds));
      
    if (updateError) {
      console.error('[attendance.manual] update failed', updateError);
      throw new GatewayError(`Unable to persist reviewed attendance: ${updateError.message || JSON.stringify(updateError)}`, 500);
    }
  }
  const persistedIds = new Set(validPresent.map((result) => result.student_id));
  return results.map((result) => persistedIds.has(result.student_id)
    ? { ...result, status: 'PRESENT', verification: 'MANUAL', attendance_persisted: true }
    : result);
}
