// UI audit harness: renders the real NeuroClass frontend against mocked
// Supabase + API, signed in as a teacher or a student, and screenshots screens.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import { TEACHER, STUDENT, apiResponse, legacyApi, restRows } from './mocks.mjs';

export const BASE = process.env.BASE || 'http://localhost:5199';
export const OUT = process.env.OUT || new URL('./shots', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const log = [];

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 820, height: 1180 }, hasTouch: true },
  mobile: { ...devices['iPhone 13'] },
};

export async function context(browser, role, vp) {
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

export async function shot(page, name) {
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

