// UI audit harness: renders the real NeuroClass frontend against mocked
// Supabase + API, signed in as a teacher or a student, and screenshots screens.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import { TEACHER, STUDENT, apiResponse, legacyApi, restRows } from './mocks.mjs';

const BASE = process.env.BASE || 'http://localhost:5199';
const OUT = process.env.OUT || new URL('./shots', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const log = [];

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 820, height: 1180 }, hasTouch: true },
  mobile: { ...devices['iPhone 13'] },
};

async function context(browser, role, vp) {
  const user = role === 'teacher' ? TEACHER : role === 'student' ? STUDENT : null;
  const ctx = await browser.newContext({ ...VIEWPORTS[vp], deviceScaleFactor: 1, permissions: [] });
  if (user) {
    const session = { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, token_type: 'bearer', user: { ...user, aud: 'authenticated', role: 'authenticated', app_metadata: {} } };
    await ctx.addInitScript((s) => { localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)); localStorage.setItem('theme-default-version', 'light-default-v1'); localStorage.setItem('theme', 'light'); }, session);
  }
  await ctx.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: { ...user, aud: 'authenticated', role: 'authenticated', app_metadata: {} } });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: {} });
    const m = url.match(/\/rest\/v1\/(rpc\/)?([a-z_]+)/);
    if (m) {
      if (m[1]) return route.fulfill({ json: [] });
      let rows = restRows(m[2], url, role);
      if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) return route.fulfill({ json: rows[0] ?? null, status: rows[0] ? 200 : 406 });
      return route.fulfill({ json: rows, headers: { 'content-range': `0-${rows.length}/${rows.length}` } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await ctx.route('https://api.mock/**', async (route) => {
    const u = new URL(route.request().url());
    const body = u.pathname.startsWith('/api/v1/') ? apiResponse(u.pathname, route.request().method(), role) : legacyApi(u.pathname);
    return route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
  });
  return ctx;
}

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  log.push(name);
}

async function clickText(page, text, opts = {}) {
  const el = page.getByRole(opts.role || 'button', { name: text, exact: opts.exact ?? false }).first();
  if (await el.count()) { await el.click({ timeout: 4000 }).catch(() => undefined); return true; }
  const t = page.getByText(text, { exact: opts.exact ?? false }).first();
  if (await t.count()) { await t.click({ timeout: 4000 }).catch(() => undefined); return true; }
  log.push(`MISSING:${text}`);
  return false;
}

async function run() {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|realtime|favicon|ERR_NAME|net::ERR|mediapipe/i.test(m.text())) errors.push(`${tag}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => errors.push(`${tag} PAGEERROR: ${e.message.slice(0, 200)}`));
  };

  for (const vp of ['desktop', 'tablet', 'mobile']) {
    // Public
    let ctx = await context(browser, null, vp); let page = await ctx.newPage(); watch(page, `public-${vp}`);
    await page.goto(BASE + '/'); await shot(page, `${vp}-01-landing`);
    if (vp === 'desktop') { await page.evaluate(() => window.scrollTo(0, 1800)); await shot(page, `${vp}-02-landing-scrolled`); await page.evaluate(() => window.scrollTo(0, 0)); }
    await clickText(page, /sign in|log in|get started|login/i); await shot(page, `${vp}-03-auth`);
    await ctx.close();

    // Teacher
    ctx = await context(browser, 'teacher', vp); page = await ctx.newPage(); watch(page, `teacher-${vp}`);
    await page.goto(BASE + '/teacher'); await shot(page, `${vp}-10-teacher-home`);
    if (vp !== 'mobile') {
      for (const [label, n] of [['Attendance', 11], ['Live Monitoring', 12], ['Tests & Assignments', 13], ['Analytics', 14], ['Settings', 15]]) {
        await page.goto(BASE + '/teacher'); await page.waitForTimeout(600);
        await page.locator('aside, nav').first().hover().catch(() => undefined);
        await clickText(page, label); await shot(page, `${vp}-${n}-teacher-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`);
      }
    }
    await page.goto(BASE + '/teacher'); await page.waitForTimeout(800);
    await clickText(page, 'Computer Engineering', { role: 'link' }); await shot(page, `${vp}-20-classroom-students`);
    for (const [tab, n] of [['Tests', 21], ['Assignments', 22], ['Materials', 23], ['Attendance', 24], ['Proctoring', 25], ['Settings', 26]]) {
      await clickText(page, new RegExp(`^${tab}$`, 'i'), { exact: false }); await shot(page, `${vp}-${n}-classroom-${tab.toLowerCase()}`);
      if (tab === 'Tests' && vp === 'desktop') {
        await clickText(page, /new test|create test/i); await shot(page, `${vp}-21b-test-editor`); await page.keyboard.press('Escape');
        await clickText(page, 'Tests', { exact: true });
      }
    }
    await ctx.close();

    // Student
    ctx = await context(browser, 'student', vp); page = await ctx.newPage(); watch(page, `student-${vp}`);
    await page.goto(BASE + '/student'); await shot(page, `${vp}-30-student-home`);
    for (const [label, n] of [['My Classes', 31], ['Active Tests', 32], ['Performance', 33], ['History', 34], ['Project Advisor', 35], ['Classroom AI', 36], ['Settings', 37]]) {
      await page.goto(BASE + '/student'); await page.waitForTimeout(600);
      await clickText(page, label); await shot(page, `${vp}-${n}-student-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`);
      if (label === 'My Classes') { await clickText(page, 'Computer Engineering'); await shot(page, `${vp}-31b-student-class-detail`); }
    }
    await page.goto(BASE + '/student'); await page.waitForTimeout(600);
    await clickText(page, /join (a )?class/i); await shot(page, `${vp}-38-join-wizard`);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/_log.json`, JSON.stringify({ shots: log, errors }, null, 2));
  console.log(`shots=${log.filter((l) => !l.startsWith('MISSING')).length} missing=${log.filter((l) => l.startsWith('MISSING')).join(', ')}`);
  console.log(`errors=${errors.length}`); errors.slice(0, 30).forEach((e) => console.log(' ', e));
}
run().catch((e) => { console.error(e); process.exit(1); });
