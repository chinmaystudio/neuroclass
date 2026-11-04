import { z } from 'zod';
import { badRequest, conflict, db, dbFail, forbidden, notFound, rateLimit, tooMany, type AuthedUser } from '../core/http';
import { requireStudent, requireTeacher, resolveClassroomAccess } from '../core/access';
import { LANGUAGE_IDS, LANGUAGES, publicLanguageList, type LanguageId } from './languages';
import { enabledLanguages, getProvider, MAX_SOURCE_BYTES, MAX_STDIN_BYTES, redactForStudent, runTestCases, type TestCaseRow } from './executor';
import { gradeCoding, isExpired, type QuestionRow, type TestConfig, readConfig } from '../assessments/domain';

export function languages() {
  return publicLanguageList(enabledLanguages());
}

const runSchema = z.object({
  contextType: z.enum(['test_attempt', 'assignment', 'teacher_question', 'teacher_assignment']),
  contextId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  language: z.enum(LANGUAGE_IDS),
  source: z.string().min(1).max(MAX_SOURCE_BYTES),
  stdin: z.string().max(MAX_STDIN_BYTES).optional(),
  mode: z.enum(['custom', 'samples', 'all']).default('samples'),
});

type RunContext = { classroomId: string; allowedLanguages: LanguageId[]; cases: TestCaseRow[]; limits: { timeLimitMs: number; memoryLimitMb: number }; canSeeHidden: boolean };

async function resolveRunContext(user: AuthedUser, input: z.infer<typeof runSchema>): Promise<RunContext> {
  if (input.contextType === 'test_attempt' || input.contextType === 'teacher_question') {
    if (!input.questionId) throw badRequest('questionId is required.');
    const { data: question } = await db().from('test_questions').select('id,test_id,type,coding').eq('id', input.questionId).maybeSingle();
    if (!question || question.type !== 'coding') throw notFound('Coding question not found.');
    const { data: test } = await db().from('tests').select('id,classroom_id,config').eq('id', question.test_id).maybeSingle();
    if (!test) throw notFound('Coding question not found.');
    if (input.contextType === 'teacher_question') {
      if (input.contextId !== test.id) throw notFound('Coding question not found.');
      await requireTeacher(test.classroom_id, user);
    } else {
      const { data: attempt } = await db().from('attempts').select('id,student_id,test_id,status,expires_at,question_order').eq('id', input.contextId).maybeSingle();
      // The attempt must be the caller's own, still running, and contain this question.
      if (!attempt || attempt.student_id !== user.id || attempt.test_id !== test.id || !(attempt.question_order ?? []).includes(question.id)) throw notFound('Coding question not found.');
      if (attempt.status !== 'in_progress' || isExpired(attempt.expires_at, new Date(), readConfig(test.config).submissionGraceSeconds)) throw conflict('This attempt is no longer running.');
      await requireStudent(test.classroom_id, user);
    }
    const coding = question.coding ?? { languages: ['python'], timeLimitMs: 3000, memoryLimitMb: 256 };
    const canSeeHidden = input.contextType === 'teacher_question';
    let query = db().from('coding_test_cases').select('id,input,expected_output,is_hidden,weight').eq('question_id', question.id).order('position');
    if (!canSeeHidden || input.mode !== 'all') query = query.eq('is_hidden', false);
    const { data: cases, error } = await query;
    if (error) dbFail('load cases', error);
    return { classroomId: test.classroom_id, allowedLanguages: coding.languages, cases: (cases ?? []) as TestCaseRow[], limits: { timeLimitMs: coding.timeLimitMs ?? 3000, memoryLimitMb: coding.memoryLimitMb ?? 256 }, canSeeHidden };
  }
  const { data: assignment } = await db().from('assignments').select('id,classroom_id,status,assignment_type,coding,due_at,late_policy').eq('id', input.contextId).maybeSingle();
  if (!assignment || !['coding', 'mixed'].includes(assignment.assignment_type)) throw notFound('Coding assignment not found.');
  const access = await resolveClassroomAccess(assignment.classroom_id, user).catch(() => { throw notFound('Coding assignment not found.'); });
  const canSeeHidden = input.contextType === 'teacher_assignment';
  if (canSeeHidden && access.role !== 'teacher') throw forbidden();
  if (!canSeeHidden && (access.role !== 'student' || assignment.status !== 'published')) throw notFound('Coding assignment not found.');
  const coding = assignment.coding ?? { languages: ['python'], timeLimitMs: 3000, memoryLimitMb: 256 };
  let query = db().from('coding_test_cases').select('id,input,expected_output,is_hidden,weight').eq('assignment_id', assignment.id).order('position');
  if (!canSeeHidden || input.mode !== 'all') query = query.eq('is_hidden', false);
  const { data: cases, error } = await query;
  if (error) dbFail('load cases', error);
  return { classroomId: assignment.classroom_id, allowedLanguages: coding.languages ?? ['python'], cases: (cases ?? []) as TestCaseRow[], limits: { timeLimitMs: coding.timeLimitMs ?? 3000, memoryLimitMb: coding.memoryLimitMb ?? 256 }, canSeeHidden };
}

export async function runCode(user: AuthedUser, raw: unknown) {
  const input = runSchema.parse(raw);
  rateLimit(`code:${user.id}`, 15, 60_000);
  if (!enabledLanguages().includes(input.language)) throw badRequest(`${LANGUAGES[input.language].label} is not enabled on this server.`);
  const ctx = await resolveRunContext(user, input);
  if (!ctx.allowedLanguages.includes(input.language)) throw badRequest(`${LANGUAGES[input.language].label} is not allowed for this question.`);
  // Durable per-user cap that holds across serverless instances.
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await db().from('code_execution_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= Number(process.env.CODE_RUNNER_HOURLY_LIMIT || 240)) throw tooMany('You have reached the hourly code-run limit. Please wait before running more code.');

  const provider = getProvider();
  let payload: Record<string, unknown>;
  if (input.mode === 'custom') {
    const run = await provider.execute({ language: input.language, source: input.source, stdin: input.stdin ?? '', limits: ctx.limits });
    payload = { mode: 'custom', run };
    await logJob(user, ctx, input, 'run', provider.name, run.status, { exitCode: run.exitCode, timeMs: run.timeMs, memoryKb: run.memoryKb });
  } else {
    if (!ctx.cases.length) throw badRequest('There are no visible sample test cases. Use custom input instead.');
    const { results, compileError } = await runTestCases(provider, input.language, input.source, ctx.cases, ctx.limits);
    const visible = ctx.canSeeHidden ? results : redactForStudent(results);
    payload = { mode: input.mode, compileError, results: visible, passed: results.filter((r) => r.passed).length, total: results.length };
    await logJob(user, ctx, input, 'run', provider.name, compileError ? 'compile_error' : 'ok', { passed: payload.passed, total: payload.total });
  }
  return payload;
}

async function logJob(user: AuthedUser, ctx: RunContext, input: z.infer<typeof runSchema>, kind: 'run' | 'evaluate', provider: string, status: string, summary: Record<string, unknown>) {
  const { error } = await db().from('code_execution_jobs').insert({ user_id: user.id, classroom_id: ctx.classroomId, context_type: input.contextType, context_id: input.contextId, question_id: input.questionId ?? null, language: input.language, kind, status, provider, summary });
  if (error) console.error('[code] job log failed', error.message);
}

/** Evaluates all coding answers of a submitted attempt against every test case, hidden included. */
export async function evaluateAttemptCoding(attemptId: string, questions: QuestionRow[], _config: TestConfig) {
  const coding = questions.filter((q) => q.type === 'coding');
  if (!coding.length) return;
  const { data: answers } = await db().from('attempt_answers').select('id,question_id,response').eq('attempt_id', attemptId).in('question_id', coding.map((q) => q.id));
  const byQ = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
  let provider: ReturnType<typeof getProvider> | null = null;
  try { provider = getProvider(); } catch { provider = null; }
  for (const q of coding) {
    const answer = byQ.get(q.id);
    const response = answer?.response as { language?: LanguageId; source?: string } | null;
    if (!response?.source?.trim()) {
      const row = { auto_score: 0, awarded_marks: 0, needs_manual_review: false, evaluation: { status: 'no_submission', passed: 0, total: 0 } };
      if (answer) await db().from('attempt_answers').update(row).eq('id', answer.id); else await db().from('attempt_answers').insert({ attempt_id: attemptId, question_id: q.id, response: null, ...row });
      continue;
    }
    if (!provider) {
      await db().from('attempt_answers').update({ needs_manual_review: true, evaluation: { status: 'runner_unavailable', passed: 0, total: 0 } }).eq('id', answer.id);
      continue;
    }
    const { data: cases } = await db().from('coding_test_cases').select('id,input,expected_output,is_hidden,weight').eq('question_id', q.id).order('position');
    try {
      const { results, compileError } = await runTestCases(provider, response.language as LanguageId, response.source, (cases ?? []) as TestCaseRow[], { timeLimitMs: q.coding?.timeLimitMs ?? 3000, memoryLimitMb: q.coding?.memoryLimitMb ?? 256 });
      const grade = gradeCoding(Number(q.marks), results);
      await db().from('attempt_answers').update({
        auto_score: grade.score, awarded_marks: grade.score, needs_manual_review: false,
        // Teacher-only detail (hidden inputs) is stored server-side; students get pass counts only.
        evaluation: { status: compileError ? 'compile_error' : 'evaluated', passed: results.filter((r) => r.passed).length, total: results.length, compileError, results, language: response.language, evaluatedAt: new Date().toISOString() },
      }).eq('id', answer.id);
    } catch (error) {
      await db().from('attempt_answers').update({ needs_manual_review: true, evaluation: { status: 'runner_error', message: error instanceof Error ? error.message : 'runner error', passed: 0, total: 0 } }).eq('id', answer.id);
    }
  }
}

/* --------------------------- Assignment workspaces --------------------------- */
const workspaceSchema = z.object({ assignmentId: z.string().uuid(), language: z.enum(LANGUAGE_IDS), source: z.string().max(200_000) });

export async function saveAssignmentWorkspace(user: AuthedUser, raw: unknown) {
  const input = workspaceSchema.parse(raw);
  rateLimit(`ws:${user.id}`, 60, 60_000);
  const { data: assignment } = await db().from('assignments').select('id,classroom_id,status,assignment_type').eq('id', input.assignmentId).maybeSingle();
  if (!assignment || assignment.status !== 'published' || !['coding', 'mixed'].includes(assignment.assignment_type)) throw notFound('Assignment not found.');
  await requireStudent(assignment.classroom_id, user).catch(() => { throw notFound('Assignment not found.'); });
  const { data: existing } = await db().from('coding_workspaces').select('id').eq('owner_user_id', user.id).eq('context_type', 'assignment').eq('context_id', assignment.id).is('question_id', null).maybeSingle();
  const row = { language: input.language, source: input.source, updated_at: new Date().toISOString() };
  const result = existing
    ? await db().from('coding_workspaces').update(row).eq('id', existing.id)
    : await db().from('coding_workspaces').insert({ owner_user_id: user.id, classroom_id: assignment.classroom_id, context_type: 'assignment', context_id: assignment.id, question_id: null, ...row });
  if (result.error) dbFail('save workspace', result.error);
  return { savedAt: row.updated_at };
}

export async function loadAssignmentWorkspace(user: AuthedUser, assignmentId: string) {
  const { data } = await db().from('coding_workspaces').select('language,source,updated_at').eq('owner_user_id', user.id).eq('context_type', 'assignment').eq('context_id', assignmentId).is('question_id', null).maybeSingle();
  return data ?? null;
}
