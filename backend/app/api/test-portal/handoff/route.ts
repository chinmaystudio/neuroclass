import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../database/supabase';
import { requireAuth } from '../../../../lib/requireAuth';

const allowedOrigins = new Set([
  'https://neuroclass.pages.dev',
  'https://neuroclass.com',
  'https://www.neuroclass.com',
  'http://localhost:5173',
]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://neuroclass.pages.dev',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const json = (request: NextRequest, body: unknown, status = 200) => NextResponse.json(body, { status, headers: corsHeaders(request) });

function withCors(response: Response, request: NextRequest) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers });
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function signHandoff(payload: Record<string, unknown>, secret: string) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${signature}`;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return withCors(auth.response, request);
  const secretText = process.env.PORTAL_HANDOFF_SECRET;
  if (!secretText || secretText.length < 32) return json(request, { error: 'Portal handoff is not configured.' }, 503);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(request, { error: 'Authentication is required.' }, 401);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(request, { error: 'Authentication is invalid or expired.' }, 401);
  const body = await request.json().catch(() => ({}));
  const classroomId = typeof body.classroomId === 'string' ? body.classroomId : '';
  if (!/^[0-9a-f-]{36}$/i.test(classroomId)) return json(request, { error: 'A valid classroomId is required.' }, 400);
  const email = authData.user.email ?? '';
  const { data: profile } = await supabase.from('users').select('email,displayName,role').or(`id.eq.${auth.userId},uid.eq.${auth.userId},email.eq.${email}`).limit(1).maybeSingle();
  const role = profile?.role === 'admin' ? 'admin' : profile?.role === 'student' ? 'student' : 'teacher';
  const { data: owned } = await supabase.from('classrooms').select('id').eq('id', classroomId).eq('user_id', auth.userId).limit(1);
  const { data: enrolled } = await supabase.from('students').select('id').eq('classroom_id', classroomId).or(`user_id.eq.${auth.userId},email.eq.${email}`).limit(1);
  if (!owned?.length && !enrolled?.length) return json(request, { error: 'You are not authorized for this classroom.' }, 403);
  const now = Math.floor(Date.now() / 1000);
  const handoffToken = signHandoff({ userId: auth.userId, email, name: profile?.displayName || authData.user.user_metadata?.full_name || email, role, classroomId, kind: 'neuroclass-handoff', iss: 'neuroclass', aud: 'test_creation', iat: now, exp: now + 60, jti: crypto.randomUUID() }, secretText);
  return json(request, { handoffToken, expiresInSeconds: 60 });
}
