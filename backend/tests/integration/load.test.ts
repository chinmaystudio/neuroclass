/**
 * Full test flow under classroom load: one teacher, LOAD_STUDENTS students
 * (default 100) who all join with the class code, then take a standard test
 * and a coding (IDE) test at the same time through the real API router and a
 * production-shaped PostgreSQL. Every PostgREST/auth call pays LOAD_LATENCY_MS
 * (default 8 ms) to model the Vercel ↔ Supabase round trip.
 *
 *   TEST_DATABASE_URL=postgres://… npx vitest run tests/integration/load.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PgSupabase } from './pgSupabase';
import { __setDbForTests } from '../../modules/core/http';
import { __setProviderForTests, type ExecutionProvider } from '../../modules/coding/executor';
import { dispatch } from '../../modules/router';

const URL_ = process.env.TEST_DATABASE_URL;
const suite = URL_ ? describe : describe.skip;
const N = Number(process.env.LOAD_STUDENTS || 100);
const LATENCY = Number(process.env.LOAD_LATENCY_MS ?? 8);
const SANDBOX_MS = Number(process.env.LOAD_SANDBOX_MS ?? 250);
const SANDBOX_CAPACITY = Number(process.env.LOAD_SANDBOX_CAPACITY ?? 20);

const CLASS = 'cccccccc-0000-4000-8000-00000000c1a5';
const CODE = 'LOAD01';
const TEACHER = { id: '7e000000-0000-4000-8000-0000000000aa', email: 'load.teacher@school.test', token: 'load-teacher-token-000000000' };
const students = Array.from({ length: N }, (_, i) => {
  const n = String(i + 1).padStart(3, '0');
  return { i, id: `5e000000-0000-4000-8000-000000000${n}`, email: `load.student${n}@school.test`, name: `Student ${n}`, token: `load-student-token-${n}-000000` };
});

let pg: PgSupabase;
const timings = new Map<string, number[]>();
const failures: string[] = [];

async function call(method: string, path: string, token: string, body?: unknown, label?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let payload: string | undefined;
  if (body !== undefined) { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const key = label ?? `${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}`;
  const t0 = performance.now();
  const res = await dispatch(new Request(`http://local/api/v1/${path}`, { method, headers, body: payload }), path.split('/'));
  const ms = performance.now() - t0;
  (timings.get(key) ?? timings.set(key, []).get(key)!).push(ms);
  const json = await res.json().catch(() => null);
  if (res.status >= 500 || res.status === 429) failures.push(`${key} → ${res.status} ${JSON.stringify(json)?.slice(0, 160)}`);
  return { status: res.status, body: json as any };
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (max: number) => pause(Math.random() * max);

function report(title: string, wallMs: number) {
  const rows = [...timings.entries()].map(([k, v]) => `  ${k.padEnd(42)} n=${String(v.length).padStart(4)}  p50=${pct(v, 50).toFixed(0).padStart(4)}ms  p95=${pct(v, 95).toFixed(0).padStart(5)}ms  max=${Math.max(...v).toFixed(0).padStart(5)}ms`);
  console.log(`\n${title} — ${N} students, ${LATENCY} ms/round trip, wall ${(wallMs / 1000).toFixed(1)} s, ${pg.queries} DB/auth round trips\n${rows.join('\n')}\n`);
  timings.clear();
  pg.queries = 0;
}

suite(`classroom load: ${N} students`, () => {
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    pg = new PgSupabase(URL_!, { max: 20, latencyMs: LATENCY });
    __setDbForTests(pg as any);
    pg.users.set(TEACHER.token, { id: TEACHER.id, email: TEACHER.email });
    for (const s of students) pg.users.set(s.token, { id: s.id, email: s.email });
    await pg.pool.query('delete from public.classrooms where id = $1 or code = $2', [CLASS, CODE]);
    await pg.pool.query(`insert into public.classrooms (id, name, code, user_id) values ($1, 'Load test class', $2, $3)`, [CLASS, CODE, TEACHER.id]);
    globalThis.fetch = vi.fn(async (input: any) => { throw new Error(`Unexpected network call: ${String(input)}`); }) as any;
  }, 60_000);

  afterAll(async () => {
    globalThis.fetch = realFetch;
    __setProviderForTests(null);
    __setDbForTests(null);
    await pg.pool.end();
  });

  it(`all ${N} students join with the class code at the same time`, async () => {
    const t0 = performance.now();
    await Promise.all(students.map(async (s) => {
      const c = await pg.pool.connect();
      try {
        await c.query('begin');
        await c.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true), set_config('role', 'authenticated', true)", [s.id, JSON.stringify({ sub: s.id, email: s.email, role: 'authenticated' })]);
        const { rows } = await c.query('select * from public.nc_join_classroom($1, $2, $3)', [CODE.toLowerCase(), s.name, `R${s.i + 1}`]);
        await c.query('commit');
        expect(rows[0].classroom_id).toBe(CLASS);
      } catch (e) {
        await c.query('rollback');
        throw e;
      } finally {
        c.release();
      }
    }));
    const { rows } = await pg.pool.query('select count(*)::int n, count(distinct user_id)::int u from public.students where classroom_id = $1', [CLASS]);
    expect(rows[0]).toEqual({ n: N, u: N });
    console.log(`join: ${N} students in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  }, 120_000);

  /* ------------------------------------------------------------------ */
  /* Standard test                                                      */
  /* ------------------------------------------------------------------ */

  let testId = '';
  let qs: Array<{ id: string; type: string; marks: number }> = [];
  const QUESTIONS = [
    ...Array.from({ length: 10 }, (_, k) => ({ type: 'mcq', prompt: `MCQ ${k + 1}: pick option ${['A', 'B', 'C', 'D'][k % 4]}`, marks: 2, options: ['A', 'B', 'C', 'D'].map((t, i) => ({ text: t, isCorrect: i === k % 4 })) })),
    { type: 'multiple_select', prompt: 'Pick A and C', marks: 3, options: ['A', 'B', 'C', 'D'].map((t) => ({ text: t, isCorrect: t === 'A' || t === 'C' })) },
    { type: 'true_false', prompt: 'The earth orbits the sun.', marks: 1, options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }] },
    ...Array.from({ length: 4 }, (_, k) => ({ type: 'numerical', prompt: `What is ${k + 2} squared?`, marks: 2, numericAnswer: (k + 2) ** 2, numericTolerance: 0 })),
    ...Array.from({ length: 3 }, (_, k) => ({ type: 'short_answer', prompt: `Capital word ${k}`, marks: 1, acceptedAnswers: [`answer${k}`] })),
    { type: 'long_answer', prompt: 'Explain recursion.', marks: 5, modelAnswer: 'A function that calls itself.' },
  ];

  it('teacher creates and publishes a 20-question standard test', async () => {
    const created = await call('POST', `classrooms/${CLASS}/tests`, TEACHER.token, {
      title: 'Load: standard', durationMinutes: 45, passingMarks: 15,
      config: { attemptLimit: 1, negativeMarking: false },
      security: { requireFullscreen: true, tabSwitchDetection: true, requireCamera: false, requireIdentityVerification: false, liveProctoring: false, livenessCheck: false },
    });
    expect(created.status).toBe(200);
    testId = created.body.id;
    const saved = await call('PUT', `tests/${testId}/questions`, TEACHER.token, QUESTIONS);
    expect(saved.status).toBe(200);
    expect(saved.body.questions).toHaveLength(20);
    qs = saved.body.questions.map((q: any) => ({ id: q.id, type: q.type, marks: q.marks }));
    expect((await call('POST', `tests/${testId}/publish`, TEACHER.token, {})).status).toBe(200);
  });

  /** Even students answer everything correctly; odd students get MCQs 1-3 and numerical 1 wrong. */
  const expectedAuto = (i: number) => {
    const total = 10 * 2 + 3 + 1 + 4 * 2 + 3 * 1; // auto-marked = 35
    return i % 2 === 0 ? total : total - 3 * 2 - 2;
  };

  it(`${N} students take the standard test concurrently`, async () => {
    const t0 = performance.now();
    await Promise.all(students.map(async (s) => {
      await jitter(2000); // students click "Start" over ~2 seconds
      await call('GET', `classrooms/${CLASS}/tests`, s.token);
      const start = await call('POST', `tests/${testId}/attempts`, s.token);
      expect(start.status).toBe(200);
      let attemptId: string = start.body.attempt.id;
      let state = start.body;
      if (state.attempt.status === 'calibrating') {
        await call('POST', `attempts/${attemptId}/consent`, s.token);
        state = (await call('POST', `attempts/${attemptId}/begin`, s.token)).body;
      }
      expect(state.attempt.status).toBe('in_progress');
      const byId = new Map<string, any>(state.questions.map((q: any) => [q.id, q]));
      const wrong = s.i % 2 === 1;
      let heartbeatAt = 0;
      for (let k = 0; k < qs.length; k++) {
        const q = byId.get(qs[k].id);
        const opt = (text: string) => q.options.find((o: any) => o.text === text).id;
        let response: unknown;
        if (q.type === 'mcq') response = { optionIds: [opt(wrong && k < 3 ? 'D' === ['A', 'B', 'C', 'D'][k % 4] ? 'A' : 'D' : ['A', 'B', 'C', 'D'][k % 4])] };
        else if (q.type === 'multiple_select') response = { optionIds: [opt('A'), opt('C')] };
        else if (q.type === 'true_false') response = { optionIds: [opt('True')] };
        else if (q.type === 'numerical') { const n = k - 12 + 2; response = { value: String(wrong && k === 12 ? n * n + 1 : n * n) }; }
        else if (q.type === 'short_answer') response = { text: `Answer${k - 16}` };
        else response = { text: 'A function that calls itself until a base case.' };
        // Typing in a written answer saves more than once (debounced autosave).
        const saves = q.type === 'long_answer' ? 3 : 1;
        for (let r = 0; r < saves; r++) {
          const saved = await call('PUT', `attempts/${attemptId}/answers/${q.id}`, s.token, { response, markedForReview: false }, 'PUT answer');
          expect(saved.status).toBe(200);
        }
        if (k === 7) await call('POST', `attempts/${attemptId}/events`, s.token, { events: [{ type: 'tab_hidden' }, { type: 'window_blur' }] }, 'POST events');
        if (k - heartbeatAt >= 5) { heartbeatAt = k; await call('POST', `attempts/${attemptId}/heartbeat`, s.token, { online: true, fullscreen: true, visible: true }, 'POST heartbeat'); }
        if (k === 10 && s.i % 10 === 0) {
          // A tenth of the class refreshes mid-test and resumes.
          const resumed = await call('GET', `attempts/${attemptId}`, s.token, undefined, 'GET attempt (resume)');
          expect(Object.keys(resumed.body.answers)).toHaveLength(11);
          attemptId = resumed.body.attempt.id;
        }
        await jitter(150);
      }
      // Some students double-click Submit.
      const submits = await Promise.all(Array.from({ length: s.i % 7 === 0 ? 2 : 1 }, () => call('POST', `attempts/${attemptId}/submit`, s.token, undefined, 'POST submit')));
      expect(submits.every((r) => r.status === 200)).toBe(true);
      expect(submits.filter((r) => !r.body.alreadySubmitted)).toHaveLength(1);
    }));
    report('standard test', performance.now() - t0);
    expect(failures).toEqual([]);

    const { rows } = await pg.pool.query(`select s.user_id, a.status, a.score, count(*) over (partition by a.student_id) as attempts
      from public.attempts a join public.students s on s.user_id = a.student_id and s.classroom_id = $2 where a.test_id = $1`, [testId, CLASS]);
    expect(rows).toHaveLength(N);
    for (const r of rows) {
      const s = students.find((x) => x.id === r.user_id)!;
      expect(r.attempts, s.email).toBe(1);
      expect(r.status, s.email).toBe('submitted'); // long answer awaits the teacher
      expect(r.score, s.email).toBe(expectedAuto(s.i));
    }
  }, 600_000);

  it('teacher monitors, grades every essay and releases results; students see their score', async () => {
    const t0 = performance.now();
    const results = await call('GET', `tests/${testId}/results`, TEACHER.token);
    expect(results.body.metrics).toMatchObject({ submitted: N, pendingManualReview: N });
    const essay = qs[19].id;
    // Grade in batches of 10, as fast as a teacher clicking through attempts.
    for (let b = 0; b < N; b += 10) {
      await Promise.all(results.body.attempts.slice(b, b + 10).map((a: any) => call('POST', `attempts/${a.id}/grade`, TEACHER.token, { grades: [{ questionId: essay, manualScore: 4 }] }, 'POST grade')));
    }
    expect((await call('POST', `tests/${testId}/release-results`, TEACHER.token, { released: true })).status).toBe(200);
    const views = await Promise.all(students.map(async (s) => {
      const list = await call('GET', 'me/tests', s.token, undefined, 'GET me/tests');
      const mine = list.body.tests.find((t: any) => t.id === testId);
      const result = await call('GET', `attempts/${mine.lastAttemptId}/result`, s.token, undefined, 'GET result');
      return { s, result: result.body };
    }));
    for (const { s, result } of views) expect(result, s.email).toMatchObject({ resultsReleased: true, score: expectedAuto(s.i) + 4, maxScore: 40 });
    const after = await call('GET', `tests/${testId}/results`, TEACHER.token);
    expect(after.body.metrics.submitted).toBe(N);
    expect(after.body.metrics.pendingManualReview).toBe(0);
    report('grading and results', performance.now() - t0);
    expect(failures).toEqual([]);
  }, 300_000);

  /* ------------------------------------------------------------------ */
  /* Coding (IDE) test                                                  */
  /* ------------------------------------------------------------------ */

  it(`${N} students take a coding test concurrently (sandbox: ${SANDBOX_CAPACITY} parallel jobs, ${SANDBOX_MS} ms each)`, async () => {
    // A sandbox with limited capacity: extra jobs queue, like a real Judge0/Piston pool.
    let running = 0; let peak = 0; let jobs = 0;
    const waiters: Array<() => void> = [];
    const acquire = async () => { if (running >= SANDBOX_CAPACITY) await new Promise<void>((r) => waiters.push(r)); running++; peak = Math.max(peak, running); };
    const release = () => { running--; waiters.shift()?.(); };
    const sandbox: ExecutionProvider = { name: 'load-sandbox', execute: async ({ source, stdin }) => {
      await acquire(); jobs++;
      try {
        await pause(SANDBOX_MS);
        const nums = stdin.trim().split(/\s+/).map(Number);
        const sum = nums.reduce((a, b) => a + b, 0);
        const out = source.includes('off_by_one') ? sum + 1 : sum;
        return { status: 'ok', stdout: `${out}\n`, stderr: '', compileOutput: '', exitCode: 0, timeMs: SANDBOX_MS, memoryKb: 2048, truncated: false };
      } finally { release(); }
    } };
    __setProviderForTests(sandbox);

    const created = await call('POST', `classrooms/${CLASS}/tests`, TEACHER.token, { title: 'Load: coding', durationMinutes: 60, examMode: 'coding', security: { requireFullscreen: false, requireCamera: false, requireIdentityVerification: false, liveProctoring: false, livenessCheck: false } });
    const codingTest = created.body.id;
    const saved = await call('PUT', `tests/${codingTest}/questions`, TEACHER.token, [
      { type: 'coding', prompt: 'Read numbers, print their sum.', marks: 10, coding: { languages: ['python', 'cpp', 'java'] }, testCases: [
        { input: '1 2', expectedOutput: '3', isHidden: false, weight: 1 },
        { input: '10 20 30', expectedOutput: '60', isHidden: true, weight: 2 },
        { input: '-5 5 7', expectedOutput: '7', isHidden: true, weight: 2 },
      ] },
      { type: 'mcq', prompt: 'Big-O of binary search?', marks: 2, options: [{ text: 'O(log n)', isCorrect: true }, { text: 'O(n)', isCorrect: false }] },
    ]);
    expect(saved.status).toBe(200);
    const [codeQ, mcqQ] = saved.body.questions.map((q: any) => q.id);
    expect((await call('POST', `tests/${codingTest}/publish`, TEACHER.token, {})).status).toBe(200);
    timings.clear();

    const t0 = performance.now();
    await Promise.all(students.map(async (s) => {
      await jitter(2000);
      const start = await call('POST', `tests/${codingTest}/attempts`, s.token);
      expect(start.status).toBe(200);
      const attemptId = start.body.attempt.id;
      const lang = ['python', 'cpp', 'java'][s.i % 3];
      const good = s.i % 4 !== 3; // every 4th student has an off-by-one bug
      const source = good ? `# ${lang}\nprint(sum(map(int, input().split())))` : `# ${lang} off_by_one\nprint(sum(map(int, input().split())) + 1)`;
      // Typing in the editor: several autosaves, then run samples twice and a custom input once.
      for (let r = 0; r < 4; r++) {
        await call('PUT', `attempts/${attemptId}/answers/${codeQ}`, s.token, { response: { language: lang, source: source.slice(0, Math.ceil(source.length * (r + 1) / 4)) } }, 'PUT code answer');
        await jitter(300);
      }
      const runs = [
        call('POST', 'code/run', s.token, { contextType: 'test_attempt', contextId: attemptId, questionId: codeQ, language: lang, source, mode: 'samples' }, 'POST code/run samples'),
      ];
      const sampleRun = await runs[0];
      expect(sampleRun.status).toBe(200);
      expect(sampleRun.body.total).toBe(1); // hidden cases never run from the student's browser
      expect(JSON.stringify(sampleRun.body)).not.toMatch(/"10 20 30"|"60"/);
      const custom = await call('POST', 'code/run', s.token, { contextType: 'test_attempt', contextId: attemptId, questionId: codeQ, language: lang, source, mode: 'custom', stdin: '4 4' }, 'POST code/run custom');
      expect(custom.status).toBe(200);
      const mcq = start.body.questions.find((q: any) => q.id === mcqQ);
      await call('PUT', `attempts/${attemptId}/answers/${mcqQ}`, s.token, { response: { optionIds: [mcq.options.find((o: any) => o.text === 'O(log n)').id] } }, 'PUT answer');
      const sub = await call('POST', `attempts/${attemptId}/submit`, s.token, undefined, 'POST submit (coding)');
      expect(sub.status).toBe(200);
    }));
    report(`coding test (sandbox peak ${peak}/${SANDBOX_CAPACITY} parallel, ${jobs} jobs)`, performance.now() - t0);
    expect(failures).toEqual([]);

    const { rows } = await pg.pool.query(`select a.student_id, a.status, a.score from public.attempts a where a.test_id = $1`, [codingTest]);
    expect(rows).toHaveLength(N);
    for (const r of rows) {
      const s = students.find((x) => x.id === r.student_id)!;
      expect(r.status, s.email).toBe('evaluated');
      // Correct code: 10 + 2. Off-by-one passes no case: 0 + 2.
      expect(r.score, s.email).toBe(s.i % 4 !== 3 ? 12 : 2);
    }
  }, 900_000);
});
