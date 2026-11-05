// Screenshots every signed-in page by URL (teacher + student), in light and dark,
// on desktop and mobile, and reports console errors and horizontal overflow.
// Usage: node scripts/ui-audit/pages.mjs [filter]   (dev server on BASE, see README)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { BASE, context } from './harness.mjs';
import { CLASSROOMS } from './mocks.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.env.OUT || new URL('./shots/pages', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
const themes = (process.env.THEMES || 'light,dark').split(',');
const vps = (process.env.VPS || 'desktop,mobile').split(',');
const cid = CLASSROOMS[0].id;

const PAGES = [
  ['teacher', 't-classrooms', '/teacher/classrooms'],
  ['teacher', 't-class-students', `/teacher/classrooms/${cid}`],
  ['teacher', 't-class-tests', `/teacher/classrooms/${cid}/tests`],
  ['teacher', 't-class-assignments', `/teacher/classrooms/${cid}`, 'Assignments'],
  ['teacher', 't-class-materials', `/teacher/classrooms/${cid}`, 'Materials'],
  ['teacher', 't-class-attendance', `/teacher/classrooms/${cid}`, 'Attendance'],
  ['teacher', 't-class-settings', `/teacher/classrooms/${cid}`, 'Settings'],
  ['teacher', 't-tests', '/teacher/tests'],
  ['teacher', 't-attendance', '/teacher/attendance'],
  ['teacher', 't-proctoring', '/teacher/proctoring'],
  ['teacher', 't-reports', '/teacher/reports'],
  ['teacher', 't-settings', '/teacher/settings'],
  ['student', 's-home', '/student'],
  ['student', 's-classes', '/student/classes'],
  ['student', 's-tests', '/student/tests'],
  ['student', 's-performance', '/student/performance'],
  ['student', 's-history', '/student/history'],
  ['student', 's-advisor', '/student/project-advisor'],
  ['student', 's-assistant', '/student/learning-bot'],
  ['student', 's-settings', '/student/settings'],
  [null, 'landing', '/'],
];

const browser = await chromium.launch();
const report = [];
for (const vp of vps) for (const theme of themes) {
  for (const role of ['teacher', 'student', null]) {
    const list = PAGES.filter((p) => p[0] === role && (!filter || filter.test(p[1])));
    if (!list.length) continue;
    const ctx = await context(browser, role, vp);
    await ctx.addInitScript((t) => { localStorage.setItem('theme-default-version', 'light-default-v1'); localStorage.setItem('theme', t); }, theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 160)));
    for (const [, name, path, tab] of list) {
      errors.length = 0;
      await page.goto(BASE + path);
      await page.waitForTimeout(900);
      if (tab) { await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).first().click().catch(() => errors.push('NO TAB ' + tab)); await page.waitForTimeout(600); }
      const overflow = await page.evaluate(() => {
        const sc = document.querySelector('[data-ui="app-shell"]') || document.documentElement;
        return Math.max(document.documentElement.scrollWidth, sc.scrollWidth) - window.innerWidth;
      });
      const file = `${OUT}/${vp}-${theme}-${name}.png`;
      await page.screenshot({ path: file, fullPage: false });
      report.push(`${vp}-${theme}-${name}: overflow=${overflow} errors=${errors.length}${errors.length ? ' ' + [...new Set(errors)].slice(0, 2).join(' | ') : ''}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(report.join('\n'));
