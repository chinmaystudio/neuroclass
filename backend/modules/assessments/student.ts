import { z } from 'zod';
import { badRequest, conflict, db, dbFail, forbidden, notFound, type AuthedUser } from '../core/http';
import { audit, requireStudent } from '../core/access';
import {
  availabilityOf, buildAttemptOrder, computeExpiry, gradeObjective, isExpired, OBJECTIVE_TYPES, readConfig, readSecurity,
  toStudentQuestion, validateResponse, type QuestionRow,
} from './domain';
import { durationOf, loadQuestions, loadTest, loadTestCases, loadTestWithAccess, testSummary, TEST_COLUMNS, type TestRow } from './repo';
import { recomputeAttempt } from './teacher';
import { evaluateAttemptCoding } from '../coding/service';

const OPEN = ['calibrating', 'in_progress'];
const FINISHED = ['submitted', 'auto_submitted', 'evaluated', 'flagged'];

export type AttemptRow = {
  id: string; test_id: string; classroom_id: string; student_id: string; student_record_id: string | null; status: string;
  started_at: string; expires_at: string | null; submitted_at: string | null; attempt_number: number;
  question_order: string[]; option_order: Record<string, string[]>; identity_status: string; identity_checks: number;
  score: number | null; max_score: number | null; percentage: number | null; warning_count: number; integrity_score: number | null;
  risk_level: string | null; proctoring_state: Record<string, any>; proctoring_baseline: Record<string, any>; consent_at: string | null;
  evaluated_at: string | null; camera_status: string | null;
};

/* ---------------------------- Student test list ---------------------------- */
export async function listStudentTests(classroomId: string, user: AuthedUser) {
  await requireStudent(classroomId, user);
  const { data, error } = await db().from('tests').select(TEST_COLUMNS).eq('classroom_id', classroomId).in('status', ['published', 'closed']).order('created_at', { ascending: false }).limit(200);
  if (error) dbFail('student tests', error);
  const tests = (data ?? []) as unknown as TestRow[];
  const ids = tests.map((t) => t.id);
  const { data: attempts } = ids.length
    ? await db().from('attempts').select('id,test_id,status,score,max_score,percentage,submitted_at,attempt_number,expires_at').in('test_id', ids).eq('student_id', user.id)
    : { data: [] as any[] };
  return tests.map((t) => {
    const mine = (attempts ?? []).filter((a: any) => a.test_id === t.id);
    const config = readConfig(t.config);
    const security = readSecurity(t.security);
    const open = mine.find((a: any) => OPEN.includes(a.status));
    const finished = mine.filter((a: any) => FINISHED.includes(a.status));
    const latest = finished.sort((a: any, b: any) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0))[0];
    const availability = availabilityOf(t);
    const attemptsUsed = mine.filter((a: any) => a.status !== 'abandoned').length;
    return {
      id: t.id, title: t.title, subject: t.subject, description: t.description, instructions: t.instructions,
      durationMinutes: durationOf(t), totalMarks: Number(t.total_marks ?? 0), passingMarks: t.passing_marks === null ? null : Number(t.passing_marks),
      scheduledStart: t.scheduled_start, scheduledEnd: t.scheduled_end, examMode: t.exam_mode ?? 'standard', availability,
      proctored: security.liveProctoring || security.requireIdentityVerification || security.requireCamera,
      requirements: { camera: security.requireCamera || security.liveProctoring || security.requireIdentityVerification, identity: security.requireIdentityVerification, fullscreen: security.requireFullscreen },
      attemptLimit: config.attemptLimit,
      attemptsUsed,
      openAttemptId: open?.id ?? null,
      canStart: availability === 'active' && (Boolean(open) || attemptsUsed < config.attemptLimit),
      myStatus: open ? 'in_progress' : latest ? (t.results_released && latest.status === 'evaluated' ? 'results_published' : latest.status === 'evaluated' ? 'evaluated' : 'submitted') : availability === 'ended' ? 'missed' : 'not_started',
      result: latest && t.results_released ? { attemptId: latest.id, score: latest.score === null ? null : Number(latest.score), maxScore: latest.max_score === null ? null : Number(latest.max_score), percentage: latest.percentage === null ? null : Number(latest.percentage) } : null,
      lastAttemptId: latest?.id ?? null,
    };
  });
}

/** All published tests across every classroom the student is enrolled in. */
export async function listAllStudentTests(user: AuthedUser) {
  const byUser = await db().from('students').select('classroom_id').eq('user_id', user.id).limit(200);
  const byEmail = user.email ? await db().from('students').select('classroom_id,user_id').ilike('email', user.email).limit(200) : { data: [] as any[] };
  const classroomIds = [...new Set([...(byUser.data ?? []).map((r: any) => r.classroom_id), ...(byEmail.data ?? []).filter((r: any) => !r.user_id || r.user_id === user.id).map((r: any) => r.classroom_id)].filter(Boolean))];
  const { data: classrooms } = classroomIds.length ? await db().from('classrooms').select('id,name').in('id', classroomIds) : { data: [] as any[] };
  const names = new Map((classrooms ?? []).map((c: any) => [c.id, c.name]));
  const lists = await Promise.all(classroomIds.map(async (id) => (await listStudentTests(id, user).catch(() => [])).map((t) => ({ ...t, classroomId: id, classroomName: names.get(id) ?? 'Classroom' }))));
  return lists.flat();
}

/* ---------------------------- Attempt lifecycle ---------------------------- */
async function loadOwnAttempt(attemptId: string, user: AuthedUser): Promise<{ attempt: AttemptRow; test: TestRow }> {
  const { data, error } = await db().from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (error) dbFail('load attempt', error);
  // Identical response whether the attempt is missing or belongs to someone else.
  if (!data || data.student_id !== user.id) throw notFound('Attempt not found.');
  const test = await loadTest(data.test_id);
  // Re-check enrolment on every request: removed students lose access immediately.
  await requireStudent(test.classroom_id, user).catch(() => { throw notFound('Attempt not found.'); });
  return { attempt: data as AttemptRow, test };
}

export async function startAttempt(testId: string, user: AuthedUser) {
  const { test, access } = await loadTestWithAccess(testId, user);
  if (access.role !== 'student') throw forbidden('Only enrolled students can take this test.');
  const availability = availabilityOf(test);
  if (availability === 'scheduled') throw conflict('This test has not opened yet.', { opensAt: test.scheduled_start });
  if (availability !== 'active') throw conflict('This test is no longer accepting attempts.');
  const config = readConfig(test.config);
  const security = readSecurity(test.security);

  const { data: mine, error } = await db().from('attempts').select('id,status,attempt_number,created_at').eq('test_id', testId).eq('student_id', user.id);
  if (error) dbFail('existing attempts', error);
  const open = (mine ?? []).find((a: any) => OPEN.includes(a.status));
  if (open) return getAttemptState(open.id, user);
  const used = (mine ?? []).filter((a: any) => a.status !== 'abandoned').length;
  if (used >= config.attemptLimit) throw conflict(`You have used all ${config.attemptLimit} attempt${config.attemptLimit === 1 ? '' : 's'} for this test.`);

  const questions = await loadQuestions(testId);
  if (!questions.length) throw conflict('This test has no questions yet.');
  const attemptId = crypto.randomUUID();
  const { questionOrder, optionOrder } = buildAttemptOrder(questions, config, attemptId);
  const needsIdentity = security.requireIdentityVerification;
  const needsSetup = needsIdentity || security.requireCamera || security.liveProctoring || security.requireFullscreen;
  const now = new Date();
  const insert = await db().from('attempts').insert({
    id: attemptId,
    test_id: testId,
    classroom_id: test.classroom_id,
    student_id: user.id,
    student_record_id: access.enrollment.id,
    attempt_number: used + 1,
    status: needsSetup ? 'calibrating' : 'in_progress',
    started_at: now.toISOString(),
    expires_at: needsSetup ? null : computeExpiry(now, durationOf(test), test.scheduled_end).toISOString(),
    question_order: questionOrder,
    option_order: optionOrder,
    identity_status: needsIdentity ? 'pending' : 'not_required',
    answers: {},
    violations: [],
    last_activity_at: now.toISOString(),
  });
  if (insert.error) {
    // Unique index on open attempts: a parallel request already created one.
    if (insert.error.code === '23505') {
      const { data: again } = await db().from('attempts').select('id').eq('test_id', testId).eq('student_id', user.id).in('status', OPEN).maybeSingle();
      if (again) return getAttemptState(again.id, user);
    }
    dbFail('create attempt', insert.error);
  }
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'attempt', entityId: attemptId, action: 'start', details: { attemptNumber: used + 1 } });
  return getAttemptState(attemptId, user);
}

/** Records explicit consent to camera monitoring before setup continues. */
export async function recordConsent(attemptId: string, user: AuthedUser) {
  const { attempt } = await loadOwnAttempt(attemptId, user);
  if (!OPEN.includes(attempt.status)) throw conflict('This attempt is no longer active.');
  await db().from('attempts').update({ consent_at: new Date().toISOString() }).eq('id', attemptId);
  return { consentAt: new Date().toISOString() };
}

/** Starts the server timer once the pre-exam checks are complete. */
export async function beginAttempt(attemptId: string, user: AuthedUser) {
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  if (attempt.status === 'in_progress') return getAttemptState(attemptId, user);
  if (attempt.status !== 'calibrating') throw conflict('This attempt has already finished.');
  const security = readSecurity(test.security);
  if ((security.requireCamera || security.liveProctoring || security.requireIdentityVerification) && !attempt.consent_at) throw conflict('Please review and accept the monitoring notice first.');
  if (security.requireIdentityVerification) {
    if (attempt.identity_status === 'failed') throw forbidden('Identity verification failed. Ask your teacher to review your attempt.');
    if (attempt.identity_status === 'pending') throw conflict('Verify your identity with the camera before starting.');
    if (attempt.identity_status === 'manual_review' && security.proctoringFailurePolicy === 'block') throw conflict('Face verification is unavailable and this test requires it. Ask your teacher to approve your identity.');
  }
  if (availabilityOf(test) !== 'active') throw conflict('This test is no longer accepting attempts.');
  const now = new Date();
  const expiresAt = computeExpiry(now, durationOf(test), test.scheduled_end);
  const { data, error } = await db().from('attempts').update({ status: 'in_progress', started_at: now.toISOString(), expires_at: expiresAt.toISOString(), last_activity_at: now.toISOString() }).eq('id', attemptId).eq('status', 'calibrating').select('id');
  if (error) dbFail('begin attempt', error);
  if (!data?.length) return getAttemptState(attemptId, user);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'attempt', entityId: attemptId, action: 'begin', details: { expiresAt: expiresAt.toISOString() } });
  return getAttemptState(attemptId, user);
}

/** Resume-safe state: questions in this attempt's order, saved answers, server deadline. */
export async function getAttemptState(attemptId: string, user: AuthedUser) {
  let { attempt, test } = await loadOwnAttempt(attemptId, user);
  const config = readConfig(test.config);
  if (attempt.status === 'in_progress' && isExpired(attempt.expires_at, new Date(), config.submissionGraceSeconds)) {
    await finalizeAttempt(attempt, test, 'timeout');
    ({ attempt, test } = await loadOwnAttempt(attemptId, user));
  }
  const security = readSecurity(test.security);
  const base = {
    attempt: {
      id: attempt.id, status: attempt.status, attemptNumber: attempt.attempt_number, startedAt: attempt.started_at, expiresAt: attempt.expires_at,
      identityStatus: attempt.identity_status, consentAt: attempt.consent_at, warningCount: attempt.warning_count,
    },
    serverTime: new Date().toISOString(),
    test: {
      id: test.id, title: test.title, instructions: test.instructions, description: test.description, durationMinutes: durationOf(test), totalMarks: Number(test.total_marks ?? 0),
      examMode: test.exam_mode ?? 'standard', allowBackNavigation: config.allowBackNavigation,
      security: { requireCamera: security.requireCamera || security.liveProctoring || security.requireIdentityVerification, requireIdentityVerification: security.requireIdentityVerification, requireFullscreen: security.requireFullscreen, tabSwitchDetection: security.tabSwitchDetection, blockClipboard: security.blockClipboard, liveProctoring: security.liveProctoring, identityRecheckSeconds: security.identityRecheckSeconds, proctoringFailurePolicy: security.proctoringFailurePolicy, cameraDisconnectPolicy: security.cameraDisconnectPolicy, fullscreenExitPolicy: security.fullscreenExitPolicy, thresholds: security.thresholds },
    },
  };
  // Questions are only revealed once the timer is running.
  if (attempt.status !== 'in_progress') return { ...base, questions: [], answers: {} };

  const questions = await loadQuestions(test.id);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const order = (attempt.question_order?.length ? attempt.question_order : questions.map((q) => q.id)).filter((id) => byId.has(id));
  const samples = await loadTestCases(questions.filter((q) => q.type === 'coding').map((q) => q.id), false);
  const { data: answers } = await db().from('attempt_answers').select('question_id,response,marked_for_review,revision,saved_at').eq('attempt_id', attemptId);
  return {
    ...base,
    questions: order.map((id) => toStudentQuestion(byId.get(id)!, attempt.option_order?.[id], samples.filter((s) => s.question_id === id))),
    answers: Object.fromEntries((answers ?? []).map((a: any) => [a.question_id, { response: a.response, markedForReview: a.marked_for_review, revision: a.revision, savedAt: a.saved_at }])),
  };
}

const answerSchema = z.object({
  response: z.unknown(),
  markedForReview: z.boolean().default(false),
  revision: z.number().int().min(0).max(1_000_000).optional(),
});

export async function saveAnswer(attemptId: string, questionId: string, user: AuthedUser, raw: unknown) {
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  const input = answerSchema.parse(raw);
  const config = readConfig(test.config);
  if (attempt.status !== 'in_progress') throw conflict('This attempt is not accepting answers.', { status: attempt.status });
  // Small grace so answers already in flight at the deadline are not lost.
  if (isExpired(attempt.expires_at, new Date(), config.submissionGraceSeconds)) {
    await finalizeAttempt(attempt, test, 'timeout');
    throw conflict('Time is up. Your saved answers have been submitted.', { status: 'auto_submitted' });
  }
  if (!attempt.question_order.includes(questionId)) throw notFound('Question not found in this attempt.');
  const { data: question } = await db().from('test_questions').select('id,type').eq('id', questionId).eq('test_id', test.id).maybeSingle();
  if (!question) throw notFound('Question not found in this attempt.');
  let response: unknown;
  try {
    response = validateResponse(question.type, input.response);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'Answer is not valid for this question type.');
  }
  if (question.type === 'coding' && response && !(readQuestionLanguages(await loadQuestions(test.id), questionId) ?? []).includes((response as any).language)) {
    throw badRequest('That language is not allowed for this question.');
  }
  const { data: existing } = await db().from('attempt_answers').select('id,revision').eq('attempt_id', attemptId).eq('question_id', questionId).maybeSingle();
  // Out-of-order offline replays must never overwrite a newer answer.
  if (existing && input.revision !== undefined && input.revision < existing.revision) return { saved: false, stale: true, revision: existing.revision };
  const revision = input.revision ?? (existing?.revision ?? 0) + 1;
  const row = { response, marked_for_review: input.markedForReview, revision, saved_at: new Date().toISOString() };
  const result = existing
    ? await db().from('attempt_answers').update(row).eq('id', existing.id)
    : await db().from('attempt_answers').insert({ attempt_id: attemptId, question_id: questionId, ...row });
  if (result.error) {
    if (result.error.code === '23505') return saveAnswer(attemptId, questionId, user, raw);
    dbFail('save answer', result.error);
  }
  await db().from('attempts').update({ last_activity_at: new Date().toISOString() }).eq('id', attemptId);
  return { saved: true, revision, savedAt: row.saved_at };
}

function readQuestionLanguages(questions: QuestionRow[], questionId: string) {
  return questions.find((q) => q.id === questionId)?.coding?.languages;
}

export async function saveAnswersBatch(attemptId: string, user: AuthedUser, raw: unknown) {
  const { answers } = z.object({ answers: z.array(answerSchema.extend({ questionId: z.string().uuid() })).max(300) }).parse(raw);
  const results = [];
  for (const a of answers) {
    try {
      results.push({ questionId: a.questionId, ...(await saveAnswer(attemptId, a.questionId, user, a)) });
    } catch (error) {
      results.push({ questionId: a.questionId, saved: false, error: error instanceof Error ? error.message : 'failed' });
      if ((error as any)?.status === 409) break;
    }
  }
  return { results };
}

export async function submitAttempt(attemptId: string, user: AuthedUser) {
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  if (FINISHED.includes(attempt.status)) return { alreadySubmitted: true, ...(await resultView(attempt, test)) };
  if (attempt.status !== 'in_progress') throw conflict('This attempt cannot be submitted.');
  await finalizeAttempt(attempt, test, 'student');
  const { attempt: fresh } = await loadOwnAttempt(attemptId, user);
  return { alreadySubmitted: false, ...(await resultView(fresh, test)) };
}

/**
 * Locks the attempt (exactly once, guarded by a conditional update), grades
 * objective and coding answers on the server, and computes the score.
 */
export async function finalizeAttempt(attempt: AttemptRow, test: TestRow, source: 'student' | 'timeout' | 'teacher') {
  const status = source === 'timeout' ? 'auto_submitted' : 'submitted';
  const { data: locked, error } = await db().from('attempts').update({ status, submitted_at: new Date().toISOString(), finished_at: new Date().toISOString(), submission_source: source }).eq('id', attempt.id).eq('status', 'in_progress').select('id');
  if (error) dbFail('lock attempt', error);
  if (!locked?.length) return; // someone else already finalised it

  const config = readConfig(test.config);
  const questions = await loadQuestions(test.id);
  const { data: answers } = await db().from('attempt_answers').select('id,question_id,response').eq('attempt_id', attempt.id);
  const byQ = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
  for (const q of questions) {
    if (q.type === 'coding') continue;
    const a = byQ.get(q.id);
    const grade = gradeObjective(q, a?.response ?? null, config.negativeMarking);
    const needsManual = grade.needsManual && Boolean(a?.response);
    const row = { auto_score: OBJECTIVE_TYPES.has(q.type) ? grade.score : null, awarded_marks: grade.score, needs_manual_review: needsManual };
    if (a) await db().from('attempt_answers').update(row).eq('id', a.id);
    else await db().from('attempt_answers').insert({ attempt_id: attempt.id, question_id: q.id, response: null, ...row });
  }
  if (questions.some((q) => q.type === 'coding')) {
    // Coding answers are evaluated against hidden test cases in the sandbox.
    // If the sandbox is unavailable they are flagged for manual review instead.
    await evaluateAttemptCoding(attempt.id, questions, config).catch((err) => console.error('[attempt] coding evaluation failed', err?.message));
  }
  await recomputeAttempt(attempt.id, test, null, true);
  await audit({ actor: attempt.student_id, classroomId: test.classroom_id, entityType: 'attempt', entityId: attempt.id, action: `submit.${source}` });
}

async function resultView(attempt: AttemptRow, test: TestRow) {
  const config = readConfig(test.config);
  const released = Boolean(test.results_released) || config.releaseResultsImmediately;
  const base = { attemptId: attempt.id, status: attempt.status, submittedAt: attempt.submitted_at, resultsReleased: released && attempt.status === 'evaluated' };
  if (!base.resultsReleased) return base;
  return { ...base, score: attempt.score === null ? null : Number(attempt.score), maxScore: attempt.max_score === null ? null : Number(attempt.max_score), percentage: attempt.percentage === null ? null : Number(attempt.percentage), passingMarks: test.passing_marks === null ? null : Number(test.passing_marks) };
}

export async function attemptResult(attemptId: string, user: AuthedUser) {
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  if (!FINISHED.includes(attempt.status)) throw conflict('This attempt has not been submitted yet.');
  const view = await resultView(attempt, test);
  if (!view.resultsReleased) return { ...view, test: testSummary(test) };
  const config = readConfig(test.config);
  const questions = await loadQuestions(test.id);
  const { data: answers } = await db().from('attempt_answers').select('question_id,response,awarded_marks,feedback,evaluation').eq('attempt_id', attemptId);
  const byQ = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
  return {
    ...view,
    test: { id: test.id, title: test.title, totalMarks: Number(test.total_marks ?? 0) },
    breakdown: questions.map((q) => {
      const a = byQ.get(q.id);
      return {
        questionId: q.id, prompt: q.prompt, type: q.type, marks: Number(q.marks), awardedMarks: a?.awarded_marks === null || a?.awarded_marks === undefined ? null : Number(a.awarded_marks), feedback: a?.feedback ?? null,
        response: a?.response ?? null,
        options: q.options,
        // Correct answers are revealed only if the teacher enabled it.
        correctOptionIds: config.showCorrectAnswers ? q.answer_key?.correctOptionIds ?? null : null,
        modelAnswer: config.showCorrectAnswers ? q.answer_key?.modelAnswer ?? q.answer_key?.acceptedAnswers?.[0] ?? (q.answer_key?.value ?? null) : null,
        explanation: config.showCorrectAnswers ? q.explanation : null,
        // Only pass/fail per hidden case is visible to students.
        coding: q.type === 'coding' && a?.evaluation ? { passed: a.evaluation.passed, total: a.evaluation.total, status: a.evaluation.status } : null,
      };
    }),
  };
}

export async function submitAppeal(attemptId: string, user: AuthedUser, raw: unknown) {
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  if (!FINISHED.includes(attempt.status)) throw conflict('You can appeal after submitting.');
  const { reason } = z.object({ reason: z.string().trim().min(5).max(4000) }).parse(raw);
  const { count } = await db().from('assessment_appeals').select('id', { count: 'exact', head: true }).eq('attempt_id', attemptId).eq('status', 'open');
  if ((count ?? 0) > 0) throw conflict('You already have an open appeal for this attempt.');
  const { data, error } = await db().from('assessment_appeals').insert({ attempt_id: attemptId, classroom_id: test.classroom_id, student_user_id: user.id, reason }).select('id,status,created_at').single();
  if (error) dbFail('create appeal', error);
  await audit({ actor: user.id, classroomId: test.classroom_id, entityType: 'appeal', entityId: data.id, action: 'create' });
  return data;
}

export { loadOwnAttempt };
