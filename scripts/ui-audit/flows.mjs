// Screenshots dialogs and flows that need a click: sign-in, join class, exam intro.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { BASE, context } from './harness.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.env.OUT || new URL('./shots/pages', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const theme = process.env.THEME || 'light';
const vp = process.env.VP || 'desktop';
const b = await chromium.launch();
const run = async (role, name, path, steps) => {
  const ctx = await context(b, role, vp);
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(BASE + path); await p.waitForTimeout(900);
  try { await steps(p); } catch (e) { errs.push('STEP ' + e.message.slice(0, 120)); }
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${vp}-${theme}-${name}.png` });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(`${name}: overflow=${overflow} ${errs.join(' | ')}`);
  await ctx.close();
};
await run(null, 'f-auth', '/', (p) => p.getByRole('button', { name: /sign in|log in|get started/i }).first().click());
await run('student', 'f-join', '/student', (p) => p.getByRole('button', { name: /join a class/i }).first().click());
await run('student', 'f-exam', '/student/tests', async (p) => { await p.route('https://api.mock/api/v1/tests/*/attempts', (r) => r.fulfill({ json: { attempt: { id: 'att1', status: 'calibrating', attemptNumber: 1, startedAt: new Date().toISOString(), expiresAt: null, identityStatus: 'pending', consentAt: null, warningCount: 0 }, test: { id: 't', title: 'Mid-term: Trees and Graphs', instructions: 'Answer all questions. No notes.', description: null, durationMinutes: 60, totalMarks: 50, examMode: 'standard', allowBackNavigation: true, security: { requireCamera: true, requireIdentityVerification: true, livenessCheck: true, requireFullscreen: true, tabSwitchDetection: true, blockClipboard: true, liveProctoring: true, identityRecheckSeconds: 180, proctoringFailurePolicy: 'warn', cameraDisconnectPolicy: 'flag', fullscreenExitPolicy: 'flag', thresholds: { lookAwaySeconds: 4, headYawDegrees: 35, headPitchDegrees: 25, faceAbsentSeconds: 5, multiFaceSeconds: 2, cooldownSeconds: 20 } } }, questions: [], answers: {}, serverTime: new Date().toISOString() } })); await p.getByRole('button', { name: /start test/i }).first().click(); });
await run('teacher', 'f-create', '/teacher/classrooms', (p) => p.getByRole('button', { name: /create classroom/i }).first().click());
await run('teacher', 'f-editor', '/teacher/classrooms/c1000000-0000-4000-8000-000000000001/tests', (p) => p.getByRole('button', { name: /new test/i }).first().click());
await b.close();
