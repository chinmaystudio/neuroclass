import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../database/supabase';
import { handleOptions, withCors } from '../../../../../lib/cors';
import { requireAuth } from '../../../../../lib/requireAuth';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const reply = (request: NextRequest, body: unknown, status = 200) =>
  withCors(NextResponse.json(body, { status }), request.headers.get('origin'));

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  const classroomId = request.nextUrl.searchParams.get('classroomId') || '';
  if (!UUID_PATTERN.test(classroomId)) {
    return reply(request, { error: 'A valid classroom is required.' }, 400);
  }

  const [{ data: owned }, { data: enrolled }] = await Promise.all([
    supabase.from('classrooms').select('id,name').eq('id', classroomId).eq('user_id', auth.userId).maybeSingle(),
    supabase.from('students').select('classroom_id').eq('classroom_id', classroomId).or(`user_id.eq.${auth.userId},email.eq.${auth.userEmail || ''}`).limit(1),
  ]);

  if (owned?.id) {
    return reply(request, { role: 'teacher', classroom: { id: owned.id, name: owned.name || 'your classroom' } });
  }
  if (!enrolled?.length) {
    return reply(request, { error: 'You are not authorized for this classroom.' }, 403);
  }

  const { data: classroom } = await supabase.from('classrooms').select('id,name').eq('id', classroomId).maybeSingle();
  return reply(request, { role: 'student', classroom: { id: classroomId, name: classroom?.name || 'your classroom' } });
}
