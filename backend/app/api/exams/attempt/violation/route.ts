import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../database/supabase';
import { requireAuth, boundedJsonSize, boundedString } from '../../../../../lib/requireAuth';
import { withCors } from '../../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return withCors(NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }));
  }

  const attemptId = boundedString(body?.attemptId, 80);
  const type = boundedString(body?.type, 160);
  const screenshot = typeof body?.screenshot === 'string' ? body.screenshot.slice(0, 250_000) : null;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId) || !type || !boundedJsonSize({ type, screenshot }, 300_000)) {
    return withCors(NextResponse.json({ error: 'Invalid proctoring event.' }, { status: 400 }));
  }

  const { data: attempt, error: readError } = await (supabase.from('attempts') as any)
    .select('id,violations,status')
    .eq('id', attemptId)
    .eq('student_id', auth.userId)
    .maybeSingle();
  if (readError || !attempt) return withCors(NextResponse.json({ error: 'Exam attempt not found.' }, { status: 404 }));
  if (!['in_progress', 'flagged'].includes(attempt.status)) return withCors(NextResponse.json({ error: 'This exam is no longer accepting proctoring events.' }, { status: 409 }));

  const event = { type, timestamp: new Date().toISOString(), screenshot };
  const violations = Array.isArray(attempt.violations) ? [...attempt.violations, event].slice(-200) : [event];
  const { error: updateError } = await (supabase.from('attempts') as any)
    .update({ violations, status: 'flagged' })
    .eq('id', attempt.id)
    .eq('student_id', auth.userId)
    .in('status', ['in_progress', 'flagged']);
  if (updateError) return withCors(NextResponse.json({ error: 'Unable to record the proctoring event.' }, { status: 500 }));
  return withCors(NextResponse.json({ recorded: true, violationCount: violations.length }));
}
