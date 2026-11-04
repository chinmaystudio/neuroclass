/**
 * End-to-end API tests for the consolidated LMS against a real PostgreSQL
 * database (see prepare-db.sh). Run with:
 *   TEST_DATABASE_URL=postgres://... npx vitest run tests/integration
 * The suite is skipped when TEST_DATABASE_URL is not set.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PgSupabase } from './pgSupabase';
import { __setDbForTests } from '../../modules/core/http';
import { __setProviderForTests, type ExecutionProvider } from '../../modules/coding/executor';
import { dispatch } from '../../modules/router';

const URL_ = process.env.TEST_DATABASE_URL;
const suite = URL_ ? describe : describe.skip;

const CLASS_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const CLASS_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const T_A = { id: '0a000000-0000-4000-8000-00000000000a', email: 'teacher.a@school.test', token: 'token-teacher-a-0123456789' };
const T_B = { id: '0b000000-0000-4000-8000-00000000000b', email: 'teacher.b@school.test', token: 'token-teacher-b-0123456789' };
const S_A = { id: '5a000000-0000-4000-8000-00000000005a', email: 'student.a@school.test', token: 'token-student-a-0123456789', record: '5a5a5a5a-0000-4000-8000-000000000001' };
const S_B = { id: '5b000000-0000-4000-8000-00000000005b', email: 'student.b@school.test', token: 'token-student-b-0123456789', record: '5b5b5b5b-0000-4000-8000-000000000002' };
const S_A2 = { id: '5c000000-0000-4000-8000-00000000005c', email: 'student.a2@school.test', token: 'token-student-a2-012345678', record: '5c5c5c5c-0000-4000-8000-000000000003' };

let pg: PgSupabase;

async function call(method: string, path: string, token: string | null, body?: unknown, form?: FormData) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (form) {
    const req = new Request('http://local/x', { method: 'POST', body: form });
    const buf = await req.arrayBuffer();
    headers['content-type'] = req.headers.get('content-type')!;
    headers['content-length'] = String(buf.byteLength);
    payload = buf;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  const res = await dispatch(new Request(`http://local/api/v1/${path}`, { method, headers, body: payload }), path.split('/'));
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json as any };
}

const mcq = (prompt: string, correct: number, marks = 2) => ({ type: 'mcq', prompt, marks, options: ['A', 'B', 'C'].map((t, i) => ({ text: t, isCorrect: i === correct })) });

suite('consolidated LMS (integration)', () => {
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    pg = new PgSupabase(URL_!);
    __setDbForTests(pg as any);
    for (const u of [T_A, T_B, S_A, S_B, S_A2]) pg.users.set(u.token, { id: u.id, email: u.email });
    await pg.pool.query(`
      INSERT INTO public.classrooms (id, name, code, user_id) VALUES ($1, 'Physics A', 'PHYA01', $3), ($2, 'Chemistry B', 'CHMB01', $4);
      `.replace(/\$1/g, `'${CLASS_A}'`).replace(/\$2/g, `'${CLASS_B}'`).replace(/\$3/g, `'${T_A.id}'`).replace(/\$4/g, `'${T_B.id}'`));
    await pg.pool.query(`INSERT INTO public.students (id, classroom_id, user_id, name, email, face_registration_status) VALUES
      ('${S_A.record}', '${CLASS_A}', '${S_A.id}', 'Asha', '${S_A.email}', 'REGISTERED'),
      ('${S_B.record}', '${CLASS_B}', '${S_B.id}', 'Bilal', '${S_B.email}', 'REGISTERED'),
      ('${S_A2.record}', '${CLASS_A}', NULL, 'Chen', '${S_A2.email}', NULL)`);
    process.env.AI_SERVICE_URL = 'https://face.test';
    process.env.AI_SERVICE_SECRET = 'face-secret';
    // Stub only the face service; everything else must not leave the process.
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.startsWith('https://face.test')) {
        const form = init.body as FormData;
        const target = String(form.get('target_student_id'));
        const mode = (globalThis as any).__faceMode ?? 'match';
        const results = mode === 'none' ? [] : mode === 'two' ? [{ student_id: target, similarity: 0.9, bbox: [1, 1, 50, 50] }, { student_id: null, similarity: 0, bbox: [60, 1, 100, 50] }] : [{ student_id: mode === 'match' ? target : 'someone-else', similarity: 0.88, bbox: [10, 20, 110, 140] }];
        return new Response(JSON.stringify({ results }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected network call in test: ${url}`);
    }) as any;
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    __setDbForTests(null);
    __setProviderForTests(null);
    await pg.pool.end();
  });

  let testId = '';
  let questionIds: string[] = [];

  describe('Scenario A — normal classroom test', () => {
    it('rejects unauthenticated requests', async () => {
      expect((await call('GET', `classrooms/${CLASS_A}/tests`, null)).status).toBe(401);
      expect((await call('GET', `classrooms/${CLASS_A}/tests`, 'not-a-real-token-123456789')).status).toBe(401);
    });

    it('teacher creates, fills and publishes a test in Classroom A', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, {
        title: 'Kinematics quiz', durationMinutes: 30, passingMarks: 4, instructions: 'No notes.',
        config: { attemptLimit: 1, negativeMarking: true }, security: { requireFullscreen: true, requireIdentityVerification: true, requireCamera: true, liveProctoring: true },
      });
      expect(created.status).toBe(200);
      expect(created.body.status).toBe('draft');
      testId = created.body.id;

      const early = await call('POST', `tests/${testId}/publish`, T_A.token, {});
      expect(early.status).toBe(400); // no questions yet

      const saved = await call('PUT', `tests/${testId}/questions`, T_A.token, [
        mcq('Unit of acceleration?', 1, 2),
        { type: 'numerical', prompt: 'g in m/s^2 (1 dp)?', marks: 2, numericAnswer: 9.8, numericTolerance: 0.05 },
        { type: 'short_answer', prompt: 'Who wrote Principia?', marks: 1, acceptedAnswers: ['Isaac Newton', 'Newton'] },
        { type: 'long_answer', prompt: 'Explain inertia.', marks: 3, modelAnswer: 'Resistance to change in motion' },
      ]);
      expect(saved.status).toBe(200);
      expect(saved.body.totalMarks).toBe(8);
      questionIds = saved.body.questions.map((q: any) => q.id);

      const published = await call('POST', `tests/${testId}/publish`, T_A.token, {});
      expect(published.status).toBe(200);
      expect(published.body.availability).toBe('active');
    });

    it('student A sees the test with no answer keys', async () => {
      const list = await call('GET', `classrooms/${CLASS_A}/tests`, S_A.token);
      expect(list.status).toBe(200);
      expect(list.body.role).toBe('student');
      expect(list.body.tests).toHaveLength(1);
      expect(list.body.tests[0]).toMatchObject({ title: 'Kinematics quiz', canStart: true, myStatus: 'not_started' });
      expect(JSON.stringify(list.body)).not.toMatch(/correctOptionIds|acceptedAnswers|numericAnswer/);
    });

    let attemptId = '';
    it('student starts: questions stay hidden until verification and begin', async () => {
      const start = await call('POST', `tests/${testId}/attempts`, S_A.token);
      expect(start.status).toBe(200);
      attemptId = start.body.attempt.id;
      expect(start.body.attempt.status).toBe('calibrating');
      expect(start.body.questions).toHaveLength(0);
      expect((await call('POST', `attempts/${attemptId}/begin`, S_A.token)).status).toBe(409); // consent first
      expect((await call('POST', `attempts/${attemptId}/consent`, S_A.token)).status).toBe(200);
      expect((await call('POST', `attempts/${attemptId}/begin`, S_A.token)).status).toBe(409); // identity first
    });

    it('face verification rejects a mismatch, then accepts the enrolled student', async () => {
      const jpeg = () => { const f = new FormData(); f.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'f.jpg', { type: 'image/jpeg' })); return f; };
      (globalThis as any).__faceMode = 'other';
      const bad = await call('POST', `attempts/${attemptId}/identity`, S_A.token, undefined, jpeg());
      expect(bad.body).toMatchObject({ verified: false, reason: 'mismatch', identityStatus: 'pending' });
      (globalThis as any).__faceMode = 'two';
      expect((await call('POST', `attempts/${attemptId}/identity`, S_A.token, undefined, jpeg())).body.reason).toBe('multiple_faces');
      (globalThis as any).__faceMode = 'match';
      const ok = await call('POST', `attempts/${attemptId}/identity`, S_A.token, undefined, jpeg());
      expect(ok.body).toMatchObject({ verified: true, identityStatus: 'verified' });
      expect(JSON.stringify(ok.body)).not.toMatch(/embedding|descriptor/);
    });

    it('rejects a non-image upload pretending to be a camera frame', async () => {
      const f = new FormData(); f.append('file', new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'x.jpg', { type: 'image/jpeg' }));
      expect((await call('POST', `attempts/${attemptId}/identity`, S_A.token, undefined, f)).status).toBe(415);
    });

    it('begins with a server deadline; autosave and resume work', async () => {
      const begun = await call('POST', `attempts/${attemptId}/begin`, S_A.token);
      expect(begun.status).toBe(200);
      expect(begun.body.attempt.status).toBe('in_progress');
      const remaining = new Date(begun.body.attempt.expiresAt).getTime() - Date.now();
      expect(remaining).toBeGreaterThan(29 * 60_000);
      expect(begun.body.questions).toHaveLength(4);
      const [q1, q2, q3, q4] = questionIds;
      const optionB = begun.body.questions.find((q: any) => q.id === q1).options.find((o: any) => o.text === 'B').id;
      expect((await call('PUT', `attempts/${attemptId}/answers/${q1}`, S_A.token, { response: { optionIds: [optionB] } })).body.saved).toBe(true);
      expect((await call('PUT', `attempts/${attemptId}/answers/${q2}`, S_A.token, { response: { value: '9.81' }, markedForReview: true })).body.saved).toBe(true);
      // Offline queue replay: a stale revision must not overwrite a newer answer.
      await call('PUT', `attempts/${attemptId}/answers/${q3}`, S_A.token, { response: { text: 'newton' }, revision: 5 });
      expect((await call('PUT', `attempts/${attemptId}/answers/${q3}`, S_A.token, { response: { text: 'Galileo' }, revision: 2 })).body.stale).toBe(true);
      await call('POST', `attempts/${attemptId}/answers`, S_A.token, { answers: [{ questionId: q4, response: { text: 'An object stays at rest unless acted on.' } }] });
      // Wrong response shape is rejected.
      expect((await call('PUT', `attempts/${attemptId}/answers/${q1}`, S_A.token, { response: { optionIds: ['o1', 'o2'] } })).status).toBe(400);
      // Refresh: the state comes back from the server.
      const resumed = await call('GET', `attempts/${attemptId}`, S_A.token);
      expect(resumed.body.answers[q3].response).toEqual({ text: 'newton' });
      expect(resumed.body.answers[q2].markedForReview).toBe(true);
      // Starting again returns the same open attempt instead of creating a duplicate.
      expect((await call('POST', `tests/${testId}/attempts`, S_A.token)).body.attempt.id).toBe(attemptId);
    });

    it('submits once, grades on the server, and refuses duplicates', async () => {
      const [first, second] = await Promise.all([call('POST', `attempts/${attemptId}/submit`, S_A.token), call('POST', `attempts/${attemptId}/submit`, S_A.token)]);
      expect([first.status, second.status]).toEqual([200, 200]);
      expect([first.body.alreadySubmitted, second.body.alreadySubmitted].filter(Boolean)).toHaveLength(1);
      const { rows } = await pg.pool.query('select status, score from attempts where id = $1', [attemptId]);
      expect(rows[0].status).toBe('submitted'); // long answer awaits teacher
      expect(rows[0].score).toBe(5); // 2 (mcq) + 2 (numerical within tolerance) + 1 (short)
      expect((await call('PUT', `attempts/${attemptId}/answers/${questionIds[0]}`, S_A.token, { response: { optionIds: [] } })).status).toBe(409);
      expect((await call('POST', `tests/${testId}/attempts`, S_A.token)).status).toBe(409); // attempt limit
    });

    it('results stay hidden until the teacher grades and releases them', async () => {
      expect((await call('GET', `attempts/${attemptId}/result`, S_A.token)).body.resultsReleased).toBe(false);
      const review = await call('GET', `attempts/${attemptId}/review`, T_A.token);
      expect(review.status).toBe(200);
      const essay = review.body.questions.find((q: any) => q.type === 'long_answer');
      expect(essay.answer.needsManualReview).toBe(true);
      expect((await call('POST', `attempts/${attemptId}/grade`, T_A.token, { grades: [{ questionId: essay.id, manualScore: 9 }] })).status).toBe(400); // above max
      const graded = await call('POST', `attempts/${attemptId}/grade`, T_A.token, { grades: [{ questionId: essay.id, manualScore: 2.5, feedback: 'Good' }] });
      expect(graded.body).toMatchObject({ score: 7.5, status: 'evaluated' });
      expect((await call('POST', `tests/${testId}/release-results`, T_A.token, { released: true })).status).toBe(200);
      const result = await call('GET', `attempts/${attemptId}/result`, S_A.token);
      expect(result.body).toMatchObject({ resultsReleased: true, score: 7.5, maxScore: 8 });
      expect(result.body.breakdown[0].correctOptionIds).toBeNull(); // showCorrectAnswers is off
      const results = await call('GET', `tests/${testId}/results`, T_A.token);
      expect(results.body.metrics).toMatchObject({ submitted: 1, average: 93.8 });
    });

    it('locks question edits once students have attempted', async () => {
      expect((await call('PUT', `tests/${testId}/questions`, T_A.token, [mcq('x', 0)])).status).toBe(409);
      expect((await call('POST', `tests/${testId}/unpublish`, T_A.token)).status).toBe(409);
    });
  });

  describe('Scenario B — cross-classroom isolation (IDOR)', () => {
    it('student B cannot list, open or start Classroom A tests', async () => {
      expect((await call('GET', `classrooms/${CLASS_A}/tests`, S_B.token)).status).toBe(404);
      expect((await call('POST', `tests/${testId}/attempts`, S_B.token)).status).toBe(404);
      expect((await call('GET', `tests/${testId}`, S_B.token)).status).toBe(404);
      expect((await call('GET', `tests/${testId}/results`, S_B.token)).status).toBe(404);
    });
    it('student B cannot read or write student A’s attempt by guessing its id', async () => {
      const { rows } = await pg.pool.query('select id from attempts where test_id = $1', [testId]);
      const victim = rows[0].id;
      for (const [m, p] of [['GET', `attempts/${victim}`], ['GET', `attempts/${victim}/result`], ['POST', `attempts/${victim}/submit`], ['POST', `attempts/${victim}/events`]] as const) {
        expect((await call(m, p, S_B.token, m === 'POST' ? { events: [{ type: 'tab_hidden' }] } : undefined)).status).toBe(404);
      }
      expect((await call('PUT', `attempts/${victim}/answers/${questionIds[0]}`, S_B.token, { response: { optionIds: [] } })).status).toBe(404);
    });
    it('a classmate in the same classroom cannot read another student’s attempt', async () => {
      const { rows } = await pg.pool.query('select id from attempts where test_id = $1', [testId]);
      expect((await call('GET', `attempts/${rows[0].id}`, S_A2.token)).status).toBe(404);
    });
    it('teacher B cannot manage or review Classroom A', async () => {
      const { rows } = await pg.pool.query('select id from attempts where test_id = $1', [testId]);
      expect((await call('PATCH', `tests/${testId}`, T_B.token, { title: 'hacked' })).status).toBe(404);
      expect((await call('GET', `attempts/${rows[0].id}/review`, T_B.token)).status).toBe(404);
      expect((await call('POST', `attempts/${rows[0].id}/grade`, T_B.token, { grades: [] })).status).toBe(404);
      expect((await call('POST', `tests/${testId}/duplicate`, T_B.token, { classroomId: CLASS_B })).status).toBe(404);
      expect((await call('POST', `classrooms/${CLASS_A}/tests`, T_B.token, { title: 'x x x', durationMinutes: 5 })).status).toBe(404);
    });
    it('a student cannot use teacher endpoints in their own classroom', async () => {
      expect((await call('POST', `classrooms/${CLASS_A}/tests`, S_A.token, { title: 'mine', durationMinutes: 5 })).status).toBe(403);
      expect((await call('GET', `tests/${testId}`, S_A.token)).status).toBe(403);
    });
    it('teacher A cannot move a test into a classroom they do not own', async () => {
      expect((await call('POST', `tests/${testId}/duplicate`, T_A.token, { classroomId: CLASS_B })).status).toBe(404);
    });
    it('legacy email-only enrolment is honoured for the matching account only', async () => {
      // Chen's enrolment has no user_id yet; the verified login email links it.
      const list = await call('GET', `classrooms/${CLASS_A}/tests`, S_A2.token);
      expect(list.status).toBe(200);
      expect(list.body.role).toBe('student');
    });
  });

  describe('Scenario C — proctoring events', () => {
    let attemptId = '';
    it('records browser and vision signals with server-assigned severity and escalates', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, { title: 'Proctored', durationMinutes: 10, security: { requireFullscreen: false, liveProctoring: false, warningEscalationThreshold: 3 } });
      const id = created.body.id;
      await call('PUT', `tests/${id}/questions`, T_A.token, [mcq('q', 0)]);
      await call('POST', `tests/${id}/publish`, T_A.token, {});
      const start = await call('POST', `tests/${id}/attempts`, S_A2.token);
      attemptId = start.body.attempt.id;
      expect(start.body.attempt.status).toBe('in_progress'); // no setup required
      const res = await call('POST', `attempts/${attemptId}/events`, S_A2.token, { events: [
        { type: 'looking_away', confidence: 0.7, boxes: [{ x: 0.2, y: 0.1, width: 0.3, height: 0.4, label: 'face' }] },
        { type: 'tab_hidden' },
        { type: 'fullscreen_exit' },
      ] });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ recorded: 3, warningCount: 3, escalated: true });
      const { rows } = await pg.pool.query('select event_type, severity, bbox from proctoring_events where attempt_id = $1 order by occurred_at', [attemptId]);
      expect(rows.find((r) => r.event_type === 'tab_hidden').severity).toBe('medium');
      expect(rows.find((r) => r.event_type === 'looking_away').bbox[0].label).toBe('face');
      expect(rows.some((r) => r.event_type === 'teacher_alert')).toBe(true);
      // Unknown event types and severities are rejected.
      expect((await call('POST', `attempts/${attemptId}/events`, S_A2.token, { events: [{ type: 'cheating_confirmed' }] })).status).toBe(400);
    });
    it('teacher sees the attempt on the live monitor and can dismiss events', async () => {
      const { rows } = await pg.pool.query('select test_id from attempts where id = $1', [attemptId]);
      const monitor = await call('GET', `tests/${rows[0].test_id}/monitor`, T_A.token);
      expect(monitor.body.attempts[0]).toMatchObject({ escalated: true, warningCount: 3 });
      const review = await call('GET', `attempts/${attemptId}/review`, T_A.token);
      const ev = review.body.proctoring.events.find((e: any) => e.event_type === 'tab_hidden');
      const dismissed = await call('PATCH', `proctoring-events/${ev.id}`, T_A.token, { reviewStatus: 'dismissed', note: 'Approved bathroom break' });
      expect(dismissed.body.integrityScore).toBeGreaterThan(review.body.proctoring.integrityScore ?? 0);
      expect((await call('PATCH', `proctoring-events/${ev.id}`, T_B.token, { reviewStatus: 'concern' })).status).toBe(404);
      expect((await call('GET', `tests/${rows[0].test_id}/monitor`, S_A2.token)).status).toBe(403);
    });
  });

  describe('Scenario D — coding exam with hidden test cases', () => {
    const sandbox: ExecutionProvider = { name: 'fake-sandbox', execute: async ({ source, stdin }) => {
      // Simulates a correct "double the number" program and a broken one.
      if (source.includes('syntax error')) return { status: 'compile_error', stdout: '', stderr: '', compileOutput: 'line 1: syntax error', exitCode: 1, timeMs: null, memoryKb: null, truncated: false };
      const n = Number(stdin.trim());
      const out = source.includes('wrong') ? String(n) : String(n * 2);
      return { status: 'ok', stdout: `${out}\n`, stderr: '', compileOutput: '', exitCode: 0, timeMs: 3, memoryKb: 900, truncated: false };
    } };
    let codingTest = ''; let codingQ = ''; let attemptId = '';
    it('teacher creates a coding test; publishing requires test cases', async () => {
      __setProviderForTests(sandbox);
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, { title: 'Doubling', durationMinutes: 20, examMode: 'coding', security: { requireFullscreen: false } });
      codingTest = created.body.id;
      expect((await call('PUT', `tests/${codingTest}/questions`, T_A.token, [mcq('only mcq', 0)])).status).toBe(400);
      const saved = await call('PUT', `tests/${codingTest}/questions`, T_A.token, [{ type: 'coding', prompt: 'Print 2n', marks: 10, coding: { languages: ['python', 'cpp'] }, testCases: [
        { input: '2', expectedOutput: '4', isHidden: false, weight: 1 },
        { input: '4568', expectedOutput: '9136', isHidden: true, weight: 3 },
      ] }]);
      codingQ = saved.body.questions[0].id;
      const teacherRun = await call('POST', 'code/run', T_A.token, { contextType: 'teacher_question', contextId: codingTest, questionId: codingQ, language: 'python', source: 'print(int(input())*2)', mode: 'all' });
      expect(teacherRun.body).toMatchObject({ passed: 2, total: 2 });
      expect((await call('POST', `tests/${codingTest}/publish`, T_A.token, {})).status).toBe(200);
    });
    it('student runs samples only; hidden inputs and outputs never reach the browser', async () => {
      attemptId = (await call('POST', `tests/${codingTest}/attempts`, S_A.token)).body.attempt.id;
      const state = await call('GET', `attempts/${attemptId}`, S_A.token);
      expect(JSON.stringify(state.body)).not.toMatch(/"4568"|"9136"/);
      expect(state.body.questions[0].coding.sampleTestCases).toEqual([{ input: '2', expectedOutput: '4' }]);
      const run = await call('POST', 'code/run', S_A.token, { contextType: 'test_attempt', contextId: attemptId, questionId: codingQ, language: 'python', source: 'print(int(input())*2)', mode: 'all' });
      expect(run.body.total).toBe(1); // "all" is downgraded to samples for students
      expect(JSON.stringify(run.body)).not.toMatch(/"4568"|"9136"/);
      expect((await call('POST', 'code/run', S_A.token, { contextType: 'test_attempt', contextId: attemptId, questionId: codingQ, language: 'rust', source: 'fn main(){}' })).status).toBe(400);
      expect((await call('POST', 'code/run', S_B.token, { contextType: 'test_attempt', contextId: attemptId, questionId: codingQ, language: 'python', source: 'x' })).status).toBe(404);
      const custom = await call('POST', 'code/run', S_A.token, { contextType: 'test_attempt', contextId: attemptId, questionId: codingQ, language: 'python', source: 'x', mode: 'custom', stdin: '7' });
      expect(custom.body.run.stdout.trim()).toBe('14');
    });
    it('submission is evaluated against hidden cases with partial credit', async () => {
      await call('PUT', `attempts/${attemptId}/answers/${codingQ}`, S_A.token, { response: { language: 'python', source: 'print(int(input())*2)' } });
      await call('POST', `attempts/${attemptId}/submit`, S_A.token);
      const { rows } = await pg.pool.query('select a.status, a.score, aa.evaluation from attempts a join attempt_answers aa on aa.attempt_id = a.id where a.id = $1', [attemptId]);
      expect(rows[0]).toMatchObject({ status: 'evaluated', score: 10 });
      expect(rows[0].evaluation).toMatchObject({ passed: 2, total: 2 });
    });
    it('marks coding answers for review when the sandbox is down', async () => {
      __setProviderForTests(null);
      delete process.env.CODE_RUNNER_PROVIDER;
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, { title: 'Runner down', durationMinutes: 5, security: { requireFullscreen: false } });
      await call('PUT', `tests/${created.body.id}/questions`, T_A.token, [{ type: 'coding', prompt: 'x', marks: 5, coding: { languages: ['python'] }, testCases: [{ input: '1', expectedOutput: '2' }] }]);
      await call('POST', `tests/${created.body.id}/publish`, T_A.token, {});
      const a = (await call('POST', `tests/${created.body.id}/attempts`, S_A.token)).body;
      await call('PUT', `attempts/${a.attempt.id}/answers/${a.questions[0].id}`, S_A.token, { response: { language: 'python', source: 'print(2)' } });
      const run = await call('POST', 'code/run', S_A.token, { contextType: 'test_attempt', contextId: a.attempt.id, questionId: a.questions[0].id, language: 'python', source: 'print(2)' });
      expect(run.status).toBe(503);
      await call('POST', `attempts/${a.attempt.id}/submit`, S_A.token);
      const { rows } = await pg.pool.query('select a.status, aa.needs_manual_review from attempts a join attempt_answers aa on aa.attempt_id = a.id where a.id = $1', [a.attempt.id]);
      expect(rows[0]).toMatchObject({ status: 'submitted', needs_manual_review: true });
      __setProviderForTests(sandbox);
    });
  });

  describe('Scenario E — assignments', () => {
    let assignmentId = '';
    it('teacher creates and publishes an assignment for Classroom A', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/assignments`, T_A.token, { title: 'Lab report 1', assignmentType: 'mixed', dueAt: new Date(Date.now() + 86_400_000).toISOString(), totalMarks: 20, acceptedFileTypes: ['pdf', 'txt'], maxFiles: 2, coding: { languages: ['python'] }, testCases: [{ input: '3', expectedOutput: '6', isHidden: true }, { input: '1', expectedOutput: '2', isHidden: false }] });
      expect(created.status).toBe(200);
      assignmentId = created.body.id;
      expect((await call('GET', `classrooms/${CLASS_A}/assignments`, S_A.token)).body.assignments).toHaveLength(0); // still a draft
      expect((await call('POST', `assignments/${assignmentId}/publish`, T_A.token)).status).toBe(200);
    });
    it('student A sees it without hidden cases; student B cannot', async () => {
      const list = await call('GET', `classrooms/${CLASS_A}/assignments`, S_A.token);
      expect(list.body.assignments[0]).toMatchObject({ title: 'Lab report 1', myStatus: 'not_started' });
      const detail = await call('GET', `assignments/${assignmentId}`, S_A.token);
      expect(detail.body.testCases).toHaveLength(1);
      expect(JSON.stringify(detail.body)).not.toContain('"6"');
      expect((await call('GET', `assignments/${assignmentId}`, S_B.token)).status).toBe(404);
      expect((await call('GET', `classrooms/${CLASS_A}/assignments`, S_B.token)).status).toBe(404);
      expect((await call('PUT', `assignments/${assignmentId}/my-submission`, S_B.token, { textResponse: 'x' })).status).toBe(404);
    });
    it('student saves a draft, uploads a validated file and submits once', async () => {
      expect((await call('PUT', `assignments/${assignmentId}/my-submission`, S_A.token, { textResponse: 'My findings', code: { language: 'python', source: 'print(int(input())*2)' } })).status).toBe(200);
      const bad = new FormData(); bad.append('file', new File([new Uint8Array([0x4d, 0x5a])], 'virus.pdf', { type: 'application/pdf' }));
      expect((await call('POST', `assignments/${assignmentId}/my-submission/files`, S_A.token, undefined, bad)).status).toBe(415);
      const good = new FormData(); good.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'report.pdf', { type: 'application/pdf' }));
      const up = await call('POST', `assignments/${assignmentId}/my-submission/files`, S_A.token, undefined, good);
      expect(up.status).toBe(200);
      expect(JSON.stringify(up.body)).not.toContain('classrooms/'); // storage path never exposed
      const [a, b] = await Promise.all([call('POST', `assignments/${assignmentId}/my-submission/submit`, S_A.token), call('POST', `assignments/${assignmentId}/my-submission/submit`, S_A.token)]);
      expect([a.body.alreadySubmitted, b.body.alreadySubmitted].filter(Boolean)).toHaveLength(1);
      expect(a.body.submission.status).toBe('submitted');
      expect(a.body.submission.finalScore).toBeUndefined(); // no marks before return
    });
    it('teacher reviews code against hidden cases, grades and returns', async () => {
      const subs = await call('GET', `assignments/${assignmentId}/submissions`, T_A.token);
      const row = subs.body.students.find((s: any) => s.student.name === 'Asha');
      expect(row.submission.files).toHaveLength(1);
      const evalRes = await call('POST', `submissions/${row.submission.id}/evaluate-code`, T_A.token);
      expect(evalRes.body).toMatchObject({ passed: 2, total: 2, suggestedScore: 20 });
      expect((await call('POST', `submissions/${row.submission.id}/grade`, T_B.token, { score: 1 })).status).toBe(404);
      expect((await call('POST', `submissions/${row.submission.id}/grade`, T_A.token, { score: 25 })).status).toBe(400);
      expect((await call('POST', `submissions/${row.submission.id}/grade`, T_A.token, { score: 18, feedback: 'Well done' })).status).toBe(200);
      const mine = await call('GET', `assignments/${assignmentId}/my-submission`, S_A.token);
      expect(mine.body.submission).toMatchObject({ status: 'returned', finalScore: 18, feedback: 'Well done' });
      expect((await call('GET', `submissions/${row.submission.id}`, S_A.token)).status).toBe(403);
    });
    it('late submissions follow the late policy', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/assignments`, T_A.token, { title: 'Overdue essay', assignmentType: 'text', dueAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), latePolicy: { allowLate: false } });
      await call('POST', `assignments/${created.body.id}/publish`, T_A.token);
      expect((await call('PUT', `assignments/${created.body.id}/my-submission`, S_A.token, { textResponse: 'late' })).status).toBe(409);
      await call('PATCH', `assignments/${created.body.id}`, T_A.token, { latePolicy: { allowLate: true, penaltyPercentPerDay: 10, maxLateDays: 3 } });
      await call('PUT', `assignments/${created.body.id}/my-submission`, S_A.token, { textResponse: 'late but allowed' });
      const sub = await call('POST', `assignments/${created.body.id}/my-submission/submit`, S_A.token);
      expect(sub.body.submission).toMatchObject({ status: 'late', isLate: true, lateDays: 1 });
    });
  });

  describe('Scenario F — recovery and reliability', () => {
    it('auto-submits an expired attempt on the next request, keeping saved answers', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, { title: 'Timed', durationMinutes: 1, config: { submissionGraceSeconds: 0 }, security: { requireFullscreen: false } });
      await call('PUT', `tests/${created.body.id}/questions`, T_A.token, [mcq('q', 0, 3)]);
      await call('POST', `tests/${created.body.id}/publish`, T_A.token, {});
      const a = (await call('POST', `tests/${created.body.id}/attempts`, S_A.token)).body;
      const opt = a.questions[0].options.find((o: any) => o.text === 'A').id;
      await call('PUT', `attempts/${a.attempt.id}/answers/${a.questions[0].id}`, S_A.token, { response: { optionIds: [opt] } });
      // Simulate the clock running out while the browser was offline.
      await pg.pool.query("update attempts set expires_at = now() - interval '5 seconds' where id = $1", [a.attempt.id]);
      const late = await call('PUT', `attempts/${a.attempt.id}/answers/${a.questions[0].id}`, S_A.token, { response: { optionIds: [] } });
      expect(late.status).toBe(409);
      const hb = await call('POST', `attempts/${a.attempt.id}/heartbeat`, S_A.token, { cameraStatus: 'not_required' });
      expect(['auto_submitted', 'evaluated']).toContain(hb.body.status);
      const { rows } = await pg.pool.query('select status, score, submission_source from attempts where id = $1', [a.attempt.id]);
      expect(rows[0]).toMatchObject({ status: 'evaluated', score: 3, submission_source: 'timeout' });
    });
    it('refuses attempts before a scheduled start and after a window closes', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, { title: 'Later', durationMinutes: 5 });
      await call('PUT', `tests/${created.body.id}/questions`, T_A.token, [mcq('q', 0)]);
      await call('POST', `tests/${created.body.id}/publish`, T_A.token, { scheduledStart: new Date(Date.now() + 3_600_000).toISOString(), scheduledEnd: new Date(Date.now() + 7_200_000).toISOString() });
      const res = await call('POST', `tests/${created.body.id}/attempts`, S_A.token);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/not opened/);
      await call('POST', `tests/${created.body.id}/close`, T_A.token);
      expect((await call('POST', `tests/${created.body.id}/attempts`, S_A.token)).status).toBe(409);
    });
    it('falls back to manual review when the face service is down (warn policy)', async () => {
      const created = await call('POST', `classrooms/${CLASS_A}/tests`, T_A.token, { title: 'Face down', durationMinutes: 5, security: { requireIdentityVerification: true, proctoringFailurePolicy: 'warn' } });
      await call('PUT', `tests/${created.body.id}/questions`, T_A.token, [mcq('q', 0)]);
      await call('POST', `tests/${created.body.id}/publish`, T_A.token, {});
      const a = (await call('POST', `tests/${created.body.id}/attempts`, S_A.token)).body;
      await call('POST', `attempts/${a.attempt.id}/consent`, S_A.token);
      const saved = process.env.AI_SERVICE_URL; delete process.env.AI_SERVICE_URL;
      const f = new FormData(); f.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'f.jpg', { type: 'image/jpeg' }));
      const res = await call('POST', `attempts/${a.attempt.id}/identity`, S_A.token, undefined, f);
      process.env.AI_SERVICE_URL = saved;
      expect(res.body).toMatchObject({ verified: false, reason: 'service_unavailable', identityStatus: 'manual_review', canProceed: true });
      expect((await call('POST', `attempts/${a.attempt.id}/begin`, S_A.token)).body.attempt.status).toBe('in_progress');
    });
    it('rejects malformed ids and oversized bodies safely', async () => {
      expect((await call('GET', 'tests/not-a-uuid', T_A.token)).status).toBe(400);
      expect((await call('GET', 'tests/00000000-0000-4000-8000-000000000000', T_A.token)).status).toBe(404);
      expect((await call('PUT', `tests/${testId}/questions`, T_A.token, Array.from({ length: 400 }, () => mcq('x'.repeat(5000), 0)))).status).toBe(413);
      expect((await call('DELETE', 'code/languages', T_A.token)).status).toBe(405);
    });
    it('records audit logs for teacher and student actions', async () => {
      const { rows } = await pg.pool.query("select action from assessment_audit_logs where entity_id = $1 order by created_at", [testId]);
      expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['create', 'questions.replace', 'publish', 'results.release']));
    });
  });
});
