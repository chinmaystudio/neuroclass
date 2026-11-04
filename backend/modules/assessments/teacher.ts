import { z } from 'zod';
import { badRequest, conflict, db, dbFail, forbidden, notFound, type AuthedUser } from '../core/http';
import { audit, requireTeacher } from '../core/access';
import {
  availabilityOf, gradeCoding, integrityScore, questionInputSchema, readConfig, riskLevelFrom, summarizeAttempt, testMetaSchema,
  toEditableQuestion, toStoredQuestion, validatePublication,
} from './domain';
import { countAttempts, loadQuestions, loadTest, loadTestCases, loadTestWithAccess, testSummary, TEST_COLUMNS, type TestRow } from './repo';
import { evaluateAttemptCoding } from '../coding/service';

async function teacherTest(testId: string, user: AuthedUser) {
  const { test, access } = await loadTestWithAccess(testId, user);
  if (access.role !== 'teacher') throw forbidden('Only the classroom teacher can manage this test.');
  return { test, access };
}

const ACTIVE_ATTEMPT = ['calibrating', 'in_progress'];
const FINISHED_ATTEMPT = ['submitted', 'auto_submitted', 'evaluated', 'flagged'];

export async function listTeacherTests(classroomId: string, user: AuthedUser) {
  await requireTeacher(classroomId, user);
  const { data, error } = await db().from('tests').select(TEST_COLUMNS).eq('classroom_id', classroomId).neq('status', 'archived').order('created_at', { ascending: false }).limit(200);
  if (error) dbFail('list tests', error);
  const tests = (data ?? []) as unknown as TestRow[];
  const ids = tests.map((t) => t.id);
  const [questions, attempts] = await Promise.all([
    ids.length ? db().from('test_questions').select('test_id').in('test_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? db().from('attempts').select('test_id,status').in('test_id', ids) : Promise.resolve({ data: [], error: null }),
  ]);
  const qCount = new Map<string, number>();
  (questions.data ?? []).forEach((q: any) => qCount.set(q.test_id, (qCount.get(q.test_id) ?? 0) + 1));
  const stats = new Map<string, { active: number; submitted: number; pendingReview: number }>();
  (attempts.data ?? []).forEach((a: any) => {
    const s = stats.get(a.test_id) ?? { active: 0, submitted: 0, pendingReview: 0 };
    if (ACTIVE_ATTEMPT.includes(a.status)) s.active += 1;
    if (FINISHED_ATTEMPT.includes(a.status)) s.submitted += 1;
    if (a.status === 'submitted' || a.status === 'auto_submitted') s.pendingReview += 1;
    stats.set(a.test_id, s);
  });
  return tests.map((t) => ({ ...testSummary(t, qCount.get(t.id) ?? (Array.isArray(t.questions) ? (t.questions as unknown[]).length : 0)), availability: availabilityOf(t), stats: stats.get(t.id) ?? { active: 0, submitted: 0, pendingReview: 0 } }));
}

export async function createTest(classroomId: string, user: AuthedUser, raw: unknown) {
  await requireTeacher(classroomId, user);
  const meta = testMetaSchema.parse(raw);
  const { data, error } = await db().from('tests').insert({
    classroom_id: classroomId,
    title: meta.title,
    subject: meta.subject ?? null,
    description: meta.description ?? null,
    instructions: meta.instructions ?? null,
    duration_mins: meta.durationMinutes,
    passing_marks: meta.passingMarks ?? null,
    exam_mode: meta.examMode,
    scheduled_start: meta.scheduledStart ?? null,
    scheduled_end: meta.scheduledEnd ?? null,
    config: meta.config,
    security: meta.security,
    proctoring_enabled: meta.security.liveProctoring || meta.security.requireIdentityVerification,
    status: 'draft',
    total_marks: 0,
    questions: [],
    created_by: user.id,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }).select(TEST_COLUMNS).single();
  if (error) dbFail('create test', error);
  await audit({ actor: user.id, classroomId, entityType: 'test', entityId: (data as any).id, action: 'create' });
  return testSummary(data as unknown as TestRow, 0);
}

export async function getTeacherTest(testId: string, user: AuthedUser) {
  const { test } = await teacherTest(testId, user);
  const questions = await loadQuestions(testId);
  const cases = await loadTestCases(questions.map((q) => q.id), true);
  const byQuestion = new Map<string, typeof cases>();
  cases.forEach((c) => byQuestion.set(c.question_id, [...(byQuestion.get(c.question_id) ?? []), c]));
  const attemptCount = await countAttempts(testId);
  return {
    ...testSummary(test, questions.length),
    availability: availabilityOf(test),
    attemptCount,
    // Once students have started, question structure is locked so scores stay comparable.
    questionsLocked: attemptCount > 0,
    questions: questions.map((q) => toEditableQuestion(q, byQuestion.get(q.id) ?? [])),
  };
}

export async function updateTest(testId: string, user: AuthedUser, raw: unknown) {
  const { test } = await teacherTest(testId, user);
  if (test.status === 'archived') throw conflict('Archived tests cannot be edited. Duplicate it instead.');
  const meta = testMetaSchema.partial().parse(raw);
  const started = await countAttempts(testId);
  if (started > 0 && (meta.durationMinutes !== undefined || meta.config !== undefined || meta.examMode !== undefined)) {
    throw conflict('Students have already started this test. Duration, marking and mode can no longer change.');
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (meta.title !== undefined) patch.title = meta.title;
  if (meta.subject !== undefined) patch.subject = meta.subject;
  if (meta.description !== undefined) patch.description = meta.description;
  if (meta.instructions !== undefined) patch.instructions = meta.instructions;
  if (meta.durationMinutes !== undefined) patch.duration_mins = meta.durationMinutes;
  if (meta.passingMarks !== undefined) patch.passing_marks = meta.passingMarks;
  if (meta.examMode !== undefined) patch.exam_mode = meta.examMode;
  if (meta.scheduledStart !== undefined) patch.scheduled_start = meta.scheduledStart;
  if (meta.scheduledEnd !== undefined) patch.scheduled_end = meta.scheduledEnd;
  if (meta.config !== undefined) patch.config = meta.config;
  if (meta.security !== undefined) {
    patch.security = meta.security;
    patch.proctoring_enabled = meta.security.liveProctoring || meta.security.requireIdentityVerification;
  }
  const start = (patch.scheduled_start ?? test.scheduled_start) as string | null;
  const end = (patch.scheduled_end ?? test.scheduled_end) as string | null;
  if (start && end && new Date(start) >= new Date(end)) throw badRequest('The end time must be after the start time.');
  const { data, error } = await db().from('tests').update(patch).eq('id', testId).select(TEST_COLUMNS).single();
  if (error) dbFail('update test', error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'test', entityId: testId, action: 'update', details: { fields: Object.keys(patch) } });
  return testSummary(data as unknown as TestRow);
}

export async function replaceQuestions(testId: string, user: AuthedUser, raw: unknown) {
  const { test } = await teacherTest(testId, user);
  if (test.status === 'archived') throw conflict('Archived tests cannot be edited.');
  if (await countAttempts(testId) > 0) throw conflict('Students have already started this test, so its questions are locked. Duplicate the test to make changes.');
  const questions = z.array(questionInputSchema).max(300).parse(raw);
  if (test.exam_mode === 'coding' && !questions.some((q) => q.type === 'coding')) throw badRequest('A coding exam needs at least one coding question.');

  const { error: delError } = await db().from('test_questions').delete().eq('test_id', testId);
  if (delError) dbFail('clear questions', delError);
  if (questions.length) {
    const rows = questions.map((q, i) => ({ ...(q.id ? { id: q.id } : {}), ...toStoredQuestion(q, i), test_id: testId }));
    const { data: inserted, error } = await db().from('test_questions').insert(rows).select('id,position');
    if (error) dbFail('insert questions', error);
    const idByPosition = new Map((inserted ?? []).map((r: any) => [r.position, r.id]));
    const caseRows = questions.flatMap((q, i) => (q.type === 'coding' ? q.testCases.map((tc, j) => ({ question_id: idByPosition.get(i), position: j, input: tc.input, expected_output: tc.expectedOutput, is_hidden: tc.isHidden, weight: tc.weight })) : []));
    if (caseRows.length) {
      const { error: caseError } = await db().from('coding_test_cases').insert(caseRows);
      if (caseError) dbFail('insert test cases', caseError);
    }
  }
  const total = questions.reduce((sum, q) => sum + q.marks, 0);
  // The legacy JSONB column is cleared so answer keys no longer live there.
  const { error: totalError } = await db().from('tests').update({ total_marks: total, questions: [], updated_at: new Date().toISOString() }).eq('id', testId);
  if (totalError) dbFail('update totals', totalError);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'test', entityId: testId, action: 'questions.replace', details: { count: questions.length, total } });
  return getTeacherTest(testId, user);
}

export async function publishTest(testId: string, user: AuthedUser, raw: unknown) {
  const { test } = await teacherTest(testId, user);
  const input = z.object({ scheduledStart: z.string().datetime({ offset: true }).nullable().optional(), scheduledEnd: z.string().datetime({ offset: true }).nullable().optional() }).parse(raw ?? {});
  if (test.status === 'archived') throw conflict('Archived tests cannot be published.');
  const questions = await loadQuestions(testId);
  const start = input.scheduledStart !== undefined ? input.scheduledStart : test.scheduled_start;
  const end = input.scheduledEnd !== undefined ? input.scheduledEnd : test.scheduled_end;
  const problem = validatePublication(questions.length, start ? new Date(start) : null, end ? new Date(end) : null);
  if (problem) throw badRequest(problem);
  const codingWithoutCases = questions.filter((q) => q.type === 'coding');
  if (codingWithoutCases.length) {
    const cases = await loadTestCases(codingWithoutCases.map((q) => q.id), true);
    const missing = codingWithoutCases.filter((q) => !cases.some((c) => c.question_id === q.id));
    if (missing.length) throw badRequest('Every coding question needs at least one test case before publishing.');
  }
  const total = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const { data, error } = await db().from('tests').update({ status: 'published', scheduled_start: start ?? null, scheduled_end: end ?? null, published_at: new Date().toISOString(), total_marks: total, updated_at: new Date().toISOString() }).eq('id', testId).select(TEST_COLUMNS).single();
  if (error) dbFail('publish test', error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'test', entityId: testId, action: 'publish', details: { start, end } });
  return { ...testSummary(data as unknown as TestRow, questions.length), availability: availabilityOf(data as unknown as TestRow) };
}

export async function setTestStatus(testId: string, user: AuthedUser, action: 'unpublish' | 'close' | 'archive' | 'reopen') {
  const { test } = await teacherTest(testId, user);
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (action === 'unpublish') {
    if (await countAttempts(testId) > 0) throw conflict('Students have already attempted this test. Close it instead of unpublishing.');
    patch = { status: 'draft', published_at: null };
  } else if (action === 'close') {
    if (test.status !== 'published') throw conflict('Only a published test can be closed.');
    patch = { status: 'closed', closed_at: now };
  } else if (action === 'reopen') {
    if (test.status !== 'closed') throw conflict('Only a closed test can be reopened.');
    patch = { status: 'published', closed_at: null };
  } else {
    if (await countAttempts(testId, ACTIVE_ATTEMPT) > 0) throw conflict('Students are currently taking this test. Close it and wait for attempts to finish before archiving.');
    patch = { status: 'archived' };
  }
  const { data, error } = await db().from('tests').update({ ...patch, updated_at: now }).eq('id', testId).select(TEST_COLUMNS).single();
  if (error) dbFail(`test ${action}`, error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'test', entityId: testId, action });
  return { ...testSummary(data as unknown as TestRow), availability: availabilityOf(data as unknown as TestRow) };
}

export async function deleteTest(testId: string, user: AuthedUser) {
  const { test } = await teacherTest(testId, user);
  if (test.status !== 'draft') throw conflict('Only draft tests can be deleted. Archive published tests instead.');
  if (await countAttempts(testId) > 0) throw conflict('This test has attempts and cannot be deleted.');
  const { error } = await db().from('tests').delete().eq('id', testId);
  if (error) dbFail('delete test', error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'test', entityId: testId, action: 'delete' });
  return { deleted: true };
}

export async function duplicateTest(testId: string, user: AuthedUser, raw: unknown) {
  const { test } = await teacherTest(testId, user);
  const input = z.object({ classroomId: z.string().uuid().optional() }).parse(raw ?? {});
  const targetClassroom = input.classroomId ?? test.classroom_id;
  // Duplicating into another classroom requires owning that classroom too.
  await requireTeacher(targetClassroom, user);
  const source = await getTeacherTest(testId, user);
  const created = await createTest(targetClassroom, user, {
    title: `${source.title} (copy)`.slice(0, 250), subject: source.subject, description: source.description, instructions: source.instructions,
    durationMinutes: source.durationMinutes, passingMarks: source.passingMarks, examMode: source.examMode, config: source.config, security: source.security,
  });
  const copies = source.questions.map(({ id: _id, testCases, ...q }) => ({ ...q, testCases: testCases.map(({ id: _caseId, ...tc }) => tc) }));
  if (copies.length) await replaceQuestions(created.id, user, copies);
  return getTeacherTest(created.id, user);
}

/* ------------------------------ Results ------------------------------ */
export async function testResults(testId: string, user: AuthedUser) {
  const { test } = await teacherTest(testId, user);
  const questions = await loadQuestions(testId);
  const { data: attempts, error } = await db().from('attempts')
    .select('id,student_id,student_record_id,status,score,max_score,percentage,started_at,expires_at,submitted_at,evaluated_at,integrity_score,risk_level,warning_count,identity_status,attempt_number,submission_source')
    .eq('test_id', testId).order('started_at', { ascending: false }).limit(1000);
  if (error) dbFail('results attempts', error);
  const rows = attempts ?? [];
  const studentIds = [...new Set(rows.map((a: any) => a.student_record_id).filter(Boolean))];
  const roster = studentIds.length ? await db().from('students').select('id,name,email,roll_number').in('id', studentIds) : { data: [] as any[] };
  const byId = new Map((roster.data ?? []).map((s: any) => [s.id, s]));
  const { data: enrolled } = await db().from('students').select('id', { count: 'exact', head: false }).eq('classroom_id', test.classroom_id);

  const finished = rows.filter((a: any) => FINISHED_ATTEMPT.includes(a.status) && a.percentage !== null);
  const percentages = finished.map((a: any) => Number(a.percentage)).sort((a, b) => a - b);
  const median = percentages.length ? (percentages.length % 2 ? percentages[(percentages.length - 1) / 2] : (percentages[percentages.length / 2 - 1] + percentages[percentages.length / 2]) / 2) : 0;
  const passMark = test.passing_marks !== null && Number(test.total_marks) > 0 ? (Number(test.passing_marks) / Number(test.total_marks)) * 100 : null;

  const answerRows = finished.length ? await db().from('attempt_answers').select('question_id,awarded_marks,auto_score,manual_score,response').in('attempt_id', finished.map((a: any) => a.id)) : { data: [] as any[] };
  const perQuestion = questions.map((q) => {
    const answers = (answerRows.data ?? []).filter((a: any) => a.question_id === q.id);
    const answered = answers.filter((a: any) => a.response !== null);
    const avg = answers.length ? answers.reduce((s: number, a: any) => s + Number(a.awarded_marks ?? 0), 0) / answers.length : 0;
    return { questionId: q.id, position: q.position, prompt: q.prompt.slice(0, 160), type: q.type, marks: Number(q.marks), answeredCount: answered.length, averageMarks: Math.round(avg * 100) / 100, averagePercent: Number(q.marks) ? Math.round((avg / Number(q.marks)) * 1000) / 10 : 0 };
  });

  return {
    test: { ...testSummary(test, questions.length), availability: availabilityOf(test) },
    metrics: {
      enrolled: enrolled?.length ?? 0,
      started: rows.length,
      submitted: finished.length,
      inProgress: rows.filter((a: any) => ACTIVE_ATTEMPT.includes(a.status)).length,
      pendingManualReview: rows.filter((a: any) => a.status === 'submitted' || a.status === 'auto_submitted').length,
      average: percentages.length ? Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 10) / 10 : 0,
      median: Math.round(median * 10) / 10,
      highest: percentages.length ? percentages[percentages.length - 1] : 0,
      passRate: passMark === null || !percentages.length ? null : Math.round((percentages.filter((p) => p >= passMark).length / percentages.length) * 1000) / 10,
    },
    attempts: rows.map((a: any) => ({
      id: a.id, status: a.status, score: a.score === null ? null : Number(a.score), maxScore: a.max_score === null ? null : Number(a.max_score), percentage: a.percentage === null ? null : Number(a.percentage),
      startedAt: a.started_at, submittedAt: a.submitted_at, evaluatedAt: a.evaluated_at, integrityScore: a.integrity_score === null ? null : Number(a.integrity_score), riskLevel: a.risk_level, warningCount: a.warning_count, identityStatus: a.identity_status, attemptNumber: a.attempt_number, submissionSource: a.submission_source,
      student: byId.get(a.student_record_id) ? { id: a.student_record_id, name: byId.get(a.student_record_id).name, email: byId.get(a.student_record_id).email, rollNumber: byId.get(a.student_record_id).roll_number } : { id: a.student_record_id, name: 'Student', email: null, rollNumber: null },
    })),
    perQuestion,
  };
}

async function teacherAttempt(attemptId: string, user: AuthedUser) {
  const { data: attempt, error } = await db().from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (error) dbFail('load attempt', error);
  if (!attempt) throw notFound('Attempt not found.');
  const { test } = await teacherTest(attempt.test_id, user);
  return { attempt, test };
}

export async function attemptReview(attemptId: string, user: AuthedUser) {
  const { attempt, test } = await teacherAttempt(attemptId, user);
  const questions = await loadQuestions(test.id);
  const cases = await loadTestCases(questions.filter((q) => q.type === 'coding').map((q) => q.id), true);
  const [{ data: answers }, { data: events }, { data: student }, { data: appeals }] = await Promise.all([
    db().from('attempt_answers').select('*').eq('attempt_id', attemptId),
    db().from('proctoring_events').select('id,event_type,category,severity,confidence,source,details,bbox,occurred_at,review_status,review_note').eq('attempt_id', attemptId).order('occurred_at').limit(2000),
    attempt.student_record_id ? db().from('students').select('id,name,email,roll_number').eq('id', attempt.student_record_id).maybeSingle() : Promise.resolve({ data: null }),
    db().from('assessment_appeals').select('*').eq('attempt_id', attemptId).order('created_at', { ascending: false }),
  ]);
  const answerByQ = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
  return {
    attempt: {
      id: attempt.id, status: attempt.status, score: attempt.score, maxScore: attempt.max_score, percentage: attempt.percentage, startedAt: attempt.started_at, expiresAt: attempt.expires_at, submittedAt: attempt.submitted_at, evaluatedAt: attempt.evaluated_at,
      integrityScore: attempt.integrity_score, riskLevel: attempt.risk_level, warningCount: attempt.warning_count, identityStatus: attempt.identity_status, submissionSource: attempt.submission_source,
    },
    student,
    test: testSummary(test, questions.length),
    questions: questions.map((q) => {
      const a = answerByQ.get(q.id);
      return {
        ...toEditableQuestion(q, cases.filter((c) => c.question_id === q.id)),
        answer: a ? { response: a.response, autoScore: a.auto_score, manualScore: a.manual_score, awardedMarks: a.awarded_marks, needsManualReview: a.needs_manual_review, feedback: a.feedback, evaluation: a.evaluation, savedAt: a.saved_at } : null,
      };
    }),
    proctoring: { events: events ?? [], integrityScore: attempt.integrity_score, riskLevel: attempt.risk_level },
    appeals: appeals ?? [],
  };
}

const gradeSchema = z.object({
  grades: z.array(z.object({ questionId: z.string().uuid(), manualScore: z.number().min(-1000).max(1000).nullable(), feedback: z.string().max(5000).optional().nullable() })).max(300),
  finalize: z.boolean().default(true),
});

export async function gradeAttempt(attemptId: string, user: AuthedUser, raw: unknown) {
  const { attempt, test } = await teacherAttempt(attemptId, user);
  if (ACTIVE_ATTEMPT.includes(attempt.status)) throw conflict('This attempt is still in progress.');
  const input = gradeSchema.parse(raw);
  const questions = await loadQuestions(test.id);
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const g of input.grades) {
    const q = byId.get(g.questionId);
    if (!q) throw badRequest('A grade refers to a question that is not part of this test.');
    if (g.manualScore !== null && (g.manualScore > Number(q.marks) || g.manualScore < -Number(q.negative_marks ?? 0))) throw badRequest(`Marks for question ${q.position + 1} must be between ${-Number(q.negative_marks ?? 0)} and ${q.marks}.`);
    const { data: existing } = await db().from('attempt_answers').select('id,auto_score').eq('attempt_id', attemptId).eq('question_id', g.questionId).maybeSingle();
    const awarded = g.manualScore ?? Number(existing?.auto_score ?? 0);
    const row = { manual_score: g.manualScore, awarded_marks: awarded, needs_manual_review: false, feedback: g.feedback ?? null };
    const result = existing
      ? await db().from('attempt_answers').update(row).eq('id', existing.id)
      : await db().from('attempt_answers').insert({ attempt_id: attemptId, question_id: g.questionId, response: null, ...row });
    if (result.error) dbFail('save grade', result.error);
  }
  return recomputeAttempt(attemptId, test, user, input.finalize);
}

export async function recomputeAttempt(attemptId: string, test: TestRow, user: AuthedUser | null, finalize: boolean) {
  const questions = await loadQuestions(test.id);
  const { data: answers } = await db().from('attempt_answers').select('question_id,awarded_marks,needs_manual_review').eq('attempt_id', attemptId);
  const byQ = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
  const summary = summarizeAttempt(questions.map((q) => ({ awarded: Number(byQ.get(q.id)?.awarded_marks ?? 0), max: Number(q.marks), needsManual: Boolean(byQ.get(q.id)?.needs_manual_review) })), Number(test.total_marks) || questions.reduce((s, q) => s + Number(q.marks), 0));
  const patch: Record<string, unknown> = { score: summary.score, max_score: summary.max, percentage: summary.percentage };
  if (finalize && !summary.pendingManual) Object.assign(patch, { status: 'evaluated', evaluated_at: new Date().toISOString(), evaluated_by: user?.id ?? 'system' });
  const { error } = await db().from('attempts').update(patch).eq('id', attemptId);
  if (error) dbFail('recompute attempt', error);
  if (user) await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'attempt', entityId: attemptId, action: 'grade', details: { score: summary.score, pendingManual: summary.pendingManual } });
  return { ...summary, status: patch.status ?? 'submitted' };
}

export async function reevaluateCoding(attemptId: string, user: AuthedUser) {
  const { attempt, test } = await teacherAttempt(attemptId, user);
  if (ACTIVE_ATTEMPT.includes(attempt.status)) throw conflict('This attempt is still in progress.');
  const questions = await loadQuestions(test.id);
  await evaluateAttemptCoding(attemptId, questions, readConfig(test.config));
  return recomputeAttempt(attemptId, test, user, true);
}

export async function releaseResults(testId: string, user: AuthedUser, raw: unknown) {
  const { test } = await teacherTest(testId, user);
  const { released } = z.object({ released: z.boolean() }).parse(raw);
  const { error } = await db().from('tests').update({ results_released: released, updated_at: new Date().toISOString() }).eq('id', testId);
  if (error) dbFail('release results', error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'test', entityId: testId, action: released ? 'results.release' : 'results.withhold' });
  return { released };
}

/* ------------------------------ Live monitor ------------------------------ */
export async function liveMonitor(testId: string, user: AuthedUser) {
  const { test } = await teacherTest(testId, user);
  const { data: attempts, error } = await db().from('attempts')
    .select('id,student_record_id,status,started_at,expires_at,heartbeat_at,camera_status,identity_status,warning_count,integrity_score,risk_level,proctoring_state,submitted_at')
    .eq('test_id', testId).order('started_at', { ascending: false }).limit(500);
  if (error) dbFail('monitor attempts', error);
  const rows = attempts ?? [];
  const ids = [...new Set(rows.map((a: any) => a.student_record_id).filter(Boolean))];
  const roster = ids.length ? await db().from('students').select('id,name,roll_number').in('id', ids) : { data: [] as any[] };
  const names = new Map((roster.data ?? []).map((s: any) => [s.id, s]));
  const openIds = rows.filter((a: any) => ACTIVE_ATTEMPT.includes(a.status)).map((a: any) => a.id);
  const recent = openIds.length ? await db().from('proctoring_events').select('attempt_id,event_type,severity,occurred_at').in('attempt_id', openIds).order('occurred_at', { ascending: false }).limit(300) : { data: [] as any[] };
  const lastEvent = new Map<string, any>();
  (recent.data ?? []).forEach((e: any) => { if (!lastEvent.has(e.attempt_id)) lastEvent.set(e.attempt_id, e); });
  const now = Date.now();
  return {
    test: { id: test.id, title: test.title, availability: availabilityOf(test) },
    serverTime: new Date().toISOString(),
    attempts: rows.map((a: any) => ({
      id: a.id,
      student: { name: names.get(a.student_record_id)?.name ?? 'Student', rollNumber: names.get(a.student_record_id)?.roll_number ?? null },
      status: a.status,
      online: a.heartbeat_at ? now - new Date(a.heartbeat_at).getTime() < 45_000 : false,
      cameraStatus: a.camera_status ?? 'unknown',
      identityStatus: a.identity_status,
      warningCount: a.warning_count,
      integrityScore: a.integrity_score === null ? null : Number(a.integrity_score),
      riskLevel: a.risk_level ?? 'low',
      escalated: Boolean(a.proctoring_state?.escalated),
      remainingSeconds: a.expires_at && ACTIVE_ATTEMPT.includes(a.status) ? Math.max(0, Math.round((new Date(a.expires_at).getTime() - now) / 1000)) : null,
      lastEvent: lastEvent.get(a.id) ?? null,
      startedAt: a.started_at,
      submittedAt: a.submitted_at,
    })),
  };
}

export async function reviewProctoringEvent(eventId: string, user: AuthedUser, raw: unknown) {
  const input = z.object({ reviewStatus: z.enum(['pending', 'dismissed', 'concern']), note: z.string().max(2000).optional().nullable() }).parse(raw);
  const { data: event, error } = await db().from('proctoring_events').select('id,attempt_id,test_id').eq('id', eventId).maybeSingle();
  if (error) dbFail('load event', error);
  if (!event) throw notFound('Event not found.');
  const { test } = await teacherTest(event.test_id, user);
  const { error: updateError } = await db().from('proctoring_events').update({ review_status: input.reviewStatus, review_note: input.note ?? null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', eventId);
  if (updateError) dbFail('review event', updateError);
  // Dismissed events no longer reduce the integrity indicator.
  const { data: all } = await db().from('proctoring_events').select('severity,confidence,review_status').eq('attempt_id', event.attempt_id);
  const score = integrityScore((all ?? []) as any);
  await db().from('attempts').update({ integrity_score: score, risk_level: riskLevelFrom(score) }).eq('id', event.attempt_id);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'proctoring_event', entityId: eventId, action: `review.${input.reviewStatus}` });
  return { id: eventId, reviewStatus: input.reviewStatus, integrityScore: score };
}

export async function overrideIdentity(attemptId: string, user: AuthedUser, raw: unknown) {
  const { attempt, test } = await teacherAttempt(attemptId, user);
  const { decision, note } = z.object({ decision: z.enum(['verified', 'failed']), note: z.string().max(1000).optional() }).parse(raw);
  if (!ACTIVE_ATTEMPT.includes(attempt.status)) throw conflict('This attempt is no longer active.');
  await db().from('attempts').update({ identity_status: decision, identity_verified_at: decision === 'verified' ? new Date().toISOString() : null }).eq('id', attemptId);
  await db().from('proctoring_events').insert({ attempt_id: attemptId, test_id: test.id, classroom_id: test.classroom_id, student_user_id: attempt.student_id, event_type: `identity_teacher_${decision}`, category: 'identity', severity: 'info', source: 'server', details: { note: note ?? null, by: 'teacher' } });
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'attempt', entityId: attemptId, action: `identity.override.${decision}` });
  return { identityStatus: decision };
}

export async function resolveAppeal(appealId: string, user: AuthedUser, raw: unknown) {
  const input = z.object({ status: z.enum(['accepted', 'rejected']), resolution: z.string().max(4000).optional().nullable() }).parse(raw);
  const { data: appeal } = await db().from('assessment_appeals').select('id,attempt_id').eq('id', appealId).maybeSingle();
  if (!appeal) throw notFound('Appeal not found.');
  const { test } = await teacherAttempt(appeal.attempt_id, user);
  const { error } = await db().from('assessment_appeals').update({ status: input.status, resolution: input.resolution ?? null, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('id', appealId);
  if (error) dbFail('resolve appeal', error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'appeal', entityId: appealId, action: `appeal.${input.status}` });
  return { id: appealId, status: input.status };
}

/** Teachers can preview their own test exactly as students see it. */
export async function previewTest(testId: string, user: AuthedUser) {
  const detail = await getTeacherTest(testId, user);
  return detail;
}

export { gradeCoding, loadTest };
