import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../database/supabase';
import { requireAuth, boundedString } from '../../../../../lib/requireAuth';
import { withCors } from '../../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }));
  }

  const testId = boundedString((body as { testId?: unknown })?.testId, 80);
  if (!/^[0-9a-f-]{36}$/i.test(testId)) {
    return withCors(NextResponse.json({ error: 'A valid test ID is required.' }, { status: 400 }));
  }

  const { data: test, error: testError } = await (supabase.from('tests') as any)
    .select('id,classroom_id,title,duration_mins,proctoring_enabled')
    .eq('id', testId)
    .maybeSingle();
  if (testError || !test) return withCors(NextResponse.json({ error: 'Test not found.' }, { status: 404 }));

  const { data: enrollment, error: enrollmentError } = await (supabase.from('students') as any)
    .select('id,classroom_id,name')
    .eq('classroom_id', test.classroom_id)
    .eq('user_id', auth.userId)
    .maybeSingle();
  if (enrollmentError || !enrollment) {
    return withCors(NextResponse.json({ error: 'You are not enrolled in this classroom.' }, { status: 403 }));
  }

  const { data: existing } = await (supabase.from('attempts') as any)
    .select('id,status,started_at')
    .eq('test_id', test.id)
    .eq('student_id', auth.userId)
    .in('status', ['in_progress', 'flagged'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return withCors(NextResponse.json({ attemptId: existing.id, reused: true }));

  const { data: attempt, error: insertError } = await (supabase.from('attempts') as any)
    .insert({
      test_id: test.id,
      student_id: auth.userId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      violations: []
    })
    .select('id')
    .single();
  if (insertError || !attempt) {
    return withCors(NextResponse.json({ error: 'Unable to start the exam attempt.' }, { status: 500 }));
  }

  return withCors(NextResponse.json({ attemptId: attempt.id, reused: false }));
}
