import { createRequire } from 'node:module';
import { context, shot, BASE } from './harness.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const tab = (page, name) => page.getByRole('tab', { name: new RegExp(name, 'i') }).first().click();
for (const vp of ['desktop', 'mobile']) {
  const ctx = await context(browser, 'teacher', vp); const page = await ctx.newPage();
  await page.goto(BASE + '/teacher'); await page.waitForTimeout(1500);
  await page.getByText('Computer Engineering').first().click(); await page.waitForTimeout(800);
  await tab(page, '^\\s*tests'); await shot(page, `${vp}-21-classroom-tests`);
  if (vp === 'desktop') {
    await page.getByRole('button', { name: /new test|create/i }).first().click().catch(() => {}); await shot(page, `${vp}-21b-test-editor`);
    await page.goto(BASE + '/teacher'); await page.waitForTimeout(1500); await page.getByText('Computer Engineering').first().click(); await page.waitForTimeout(800); await tab(page, '^\\s*tests');
    await page.getByRole('button', { name: /results/i }).first().click().catch(() => {}); await shot(page, `${vp}-21c-test-results`);
    await page.goto(BASE + '/teacher'); await page.waitForTimeout(1500); await page.getByText('Computer Engineering').first().click(); await page.waitForTimeout(800); await tab(page, 'assignments');
    await page.getByRole('button', { name: /submissions/i }).first().click().catch(() => {}); await shot(page, `${vp}-22b-assignment-submissions`);
  }
  await tab(page, 'materials').catch(() => {}); await shot(page, `${vp}-23-classroom-materials`);
  await ctx.close();
}
const ctx = await context(browser, 'student', 'desktop'); const page = await ctx.newPage();
await page.route('https://api.mock/api/v1/tests/*/attempts', (r) => r.fulfill({ json: { attempt: { id: 'att1', status: 'calibrating', attemptNumber: 1, startedAt: new Date().toISOString(), expiresAt: null, identityStatus: 'pending', consentAt: null, warningCount: 0 }, test: { id: 't', title: 'Mid-term: Trees and Graphs', instructions: 'Answer all questions. No notes.', description: null, durationMinutes: 60, totalMarks: 50, examMode: 'standard', allowBackNavigation: true, security: { requireCamera: true, requireIdentityVerification: true, livenessCheck: true, requireFullscreen: true, tabSwitchDetection: true, blockClipboard: true, liveProctoring: true, identityRecheckSeconds: 180, proctoringFailurePolicy: 'warn', cameraDisconnectPolicy: 'flag', fullscreenExitPolicy: 'flag', thresholds: { lookAwaySeconds: 4, headYawDegrees: 35, headPitchDegrees: 25, faceAbsentSeconds: 5, multiFaceSeconds: 2, cooldownSeconds: 20 } } }, questions: [], answers: {}, serverTime: new Date().toISOString() } }));
await page.goto(BASE + '/student'); await page.waitForTimeout(1500);
await page.getByRole('button', { name: /start exam/i }).first().click().catch(() => {}); await shot(page, 'desktop-39-exam-intro');
await browser.close();
