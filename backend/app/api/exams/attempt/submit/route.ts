import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../database/supabase';
import { requireAuth, boundedJsonSize, boundedString } from '../../../../../lib/requireAuth';
import { withCors } from '../../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

const scoreObjectiveQuestions = (questions: any[], answers: Record<string, unknown>) => {
  let earned = 0;
  let total = 0;
  for (const question of Array.isArray(questions) ? questions.slice(0, 500) : []) {
    const points = Math.max(0, Math.min(100, Number(question?.points ?? question?.marks ?? 0) || 0));
    total += points;
    const answer = answers[question?.id];
    if (answer === undefined || answer === null || answer === '') continue;
    const type = String(question?.type || '').toLowerCase();
    const correct = Array.isArray(question?.options)
      ? question.options.filter((option: any) => typeof option === 'object' ? option?.isCorrect : false).map((option: any) => String(option.id))
      : question?.correctAnswer !== undefined ? [String(question.correctAnswer)] : [];
    const stringOptions = Array.isArray(question?.options) ? question.options.filter((option: any) => typeof option === 'string') : [];
    const submitted = Array.isArray(answer) ? answer.map(String).sort() : [String(answer)];
    const isCorrect = (correct.length > 0 && JSON.stringify(submitted.sort()) === JSON.stringify(correct.sort())) ||
      (stringOptions.length > 0 && stringOptions.some((option: string) => option.trim().toLowerCase() === String(answer).trim().toLowerCase()));
    if (isCorrect) earned += points;
  }
  return { earned, total };
};

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
  const answers = body?.answers;
  const violations = Array.isArray(body?.violations) ? body.violations.slice(0, 200) : [];
  if (!/^[0-9a-f-]{36}$/i.test(attemptId) || !answers || typeof answers !== 'object' || Array.isArray(answers) || !boundedJsonSize(answers, 1_000_000) || !boundedJsonSize(violations, 500_000)) {
    return withCors(NextResponse.json({ error: 'Invalid or oversized submission payload.' }, { status: 400 }));
  }

  const { data: attempt, error: attemptError } = await (supabase.from('attempts') as any)
    .select('id,test_id,student_id,status')
    .eq('id', attemptId)
    .eq('student_id', auth.userId)
    .maybeSingle();
  if (attemptError || !attempt) return withCors(NextResponse.json({ error: 'Exam attempt not found.' }, { status: 404 }));
  if (attempt.status === 'submitted') return withCors(NextResponse.json({ submitted: true, duplicate: true }));
  if (!['in_progress', 'flagged'].includes(attempt.status)) return withCors(NextResponse.json({ error: 'This exam attempt is not open.' }, { status: 409 }));

  const { data: test, error: testError } = await (supabase.from('tests') as any)
    .select('questions,test_data')
    .eq('id', attempt.test_id)
    .maybeSingle();
  if (testError || !test) return withCors(NextResponse.json({ error: 'Test data is unavailable.' }, { status: 404 }));

  const rawQuestions = Array.isArray(test?.questions)
    ? test.questions
    : Array.isArray(test?.test_data?.sections)
      ? test.test_data.sections.flatMap((section: any) => Array.isArray(section?.questions) ? section.questions : [])
      : [];
  const score = scoreObjectiveQuestions(rawQuestions, answers);
  const now = new Date().toISOString();
  const { error: updateError } = await (supabase.from('attempts') as any)
    .update({
      score: score.earned,
      answers,
      violations,
      status: violations.length > 0 ? 'flagged' : 'submitted',
      finished_at: now,
      submitted_at: now
    })
    .eq('id', attempt.id)
    .eq('student_id', auth.userId)
    .in('status', ['in_progress', 'flagged']);
  if (updateError) return withCors(NextResponse.json({ error: 'Unable to save the exam submission.' }, { status: 500 }));

  return withCors(NextResponse.json({ submitted: true, score: score.earned, total: score.total, flagged: violations.length > 0 }));
}
