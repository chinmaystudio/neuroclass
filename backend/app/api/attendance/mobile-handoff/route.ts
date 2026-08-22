import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseServiceRoleConfigured } from '../../../../database/supabase';
import { handleOptions, withCors } from '../../../../lib/cors';
import { requireAuth } from '../../../../lib/requireAuth';

const WEB_PORTAL_ORIGIN = 'https://neuroclass.pages.dev';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const reply = (request: NextRequest, body: unknown, status = 200) =>
  withCors(NextResponse.json(body, { status }), request.headers.get('origin'));

function validReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'neuroclass:' || url.hostname !== 'attendance-return') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  if (!isSupabaseServiceRoleConfigured()) return reply(request, { error: 'Attendance handoff is not configured.' }, 503);

  const body = await request.json().catch(() => ({}));
  const classroomId = typeof body.classroomId === 'string' ? body.classroomId : '';
  const returnTo = validReturnUrl(body.returnTo);
  if (!UUID_PATTERN.test(classroomId) || !returnTo) return reply(request, { error: 'A valid classroom and mobile return URL are required.' }, 400);
  if (!auth.userEmail) return reply(request, { error: 'Your account needs an email address before it can open the web attendance portal.' }, 400);

  const email = auth.userEmail;
  const [{ data: owned }, { data: enrolled }, { data: profile }] = await Promise.all([
    supabase.from('classrooms').select('id').eq('id', classroomId).eq('user_id', auth.userId).limit(1),
    supabase.from('students').select('id').eq('classroom_id', classroomId).or(`user_id.eq.${auth.userId},email.eq.${email}`).limit(1),
    supabase.from('users').select('role').or(`uid.eq.${auth.userId},email.eq.${email}`).limit(1).maybeSingle(),
  ]);
  if (!owned?.length && !enrolled?.length) return reply(request, { error: 'You are not authorized for this classroom.' }, 403);

  const role = owned?.length ? 'teacher' : 'student';
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = (linkData as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
  if (linkError || !tokenHash) return reply(request, { error: 'Unable to create the secure attendance handoff.' }, 503);

  const query = new URLSearchParams({ role, classroomId, attendance: '1', return_to: returnTo });
  const fragment = new URLSearchParams({ token_hash: tokenHash, type: 'magiclink' });
  return reply(request, { handoffUrl: `${WEB_PORTAL_ORIGIN}/attendance/mobile-handoff?${query.toString()}#${fragment.toString()}`, expiresInSeconds: 60 });
}
