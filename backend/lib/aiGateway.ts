import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { supabase } from '../database/supabase';

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

function adminDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GatewayError('Server Supabase configuration is missing', 500);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function jsonError(error: unknown): Response {
  const status = error instanceof GatewayError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return Response.json({ error: message }, { status });
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
  const { data, error } = await auth.db.from('students').select('id').eq('id', studentId).eq('classroom_id', classroomId).eq('user_id', auth.user.id).maybeSingle();
  if (error || !data) throw new GatewayError('You do not own this student enrollment', 403);
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
    confidence: typeof result.similarity === 'number' ? result.similarity : typeof result.confidence === 'number' ? result.confidence : null,
    verification_method: result.verification || 'render_arcface',
  }));
  const { data: inserted, error } = await auth.db.from('attendance_observations').insert(rows).select('id');
  if (error) throw new GatewayError('Unable to persist attendance observations', 500);
  return results.map((result, index) => ({ ...result, observation_id: inserted?.[index]?.id || null }));
}
