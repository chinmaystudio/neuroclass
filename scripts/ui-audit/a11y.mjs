import { createRequire } from 'node:module';
import { context, BASE } from './harness.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const probe = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || (e.querySelector('img[alt]')?.getAttribute('alt') || '');
  const btns = [...document.querySelectorAll('button,a[href],[role=button],[role=tab]')].filter(vis);
  const unnamed = btns.filter((b) => !name(b)).length;
  const inputs = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis);
  const unlabeled = inputs.filter((i) => !(i.labels?.length || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby'))).length;
  const imgs = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
  const small = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 32 || r.width < 32; }).length;
  const tiny = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).length;
  return { controls: btns.length, unnamed, inputs: inputs.length, unlabeled, imgsNoAlt: imgs, under32px: small, textUnder11px: tiny, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length };
};
const out = {};
for (const [role, path, vp] of [['teacher', '/teacher', 'desktop'], ['student', '/student', 'desktop'], ['student', '/student', 'mobile'], [null, '/', 'desktop']]) {
  const ctx = await context(browser, role, vp); const page = await ctx.newPage();
  await page.goto(BASE + path); await page.waitForTimeout(2500);
  out[`${role ?? 'public'}-${vp}`] = await page.evaluate(probe);
  // Keyboard: does Tab produce a visible focus indicator?
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  out[`${role ?? 'public'}-${vp}`].focusVisible = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'none'; const s = getComputedStyle(a); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' ? 'yes' : 'no'; });
  // Refresh keeps place?
  if (role) { await page.getByText(role === 'teacher' ? 'Computer Engineering' : 'Performance').first().click().catch(() => {}); await page.waitForTimeout(800); const before = page.url(); await page.reload(); await page.waitForTimeout(2000); out[`${role}-${vp}`].urlChangesOnNav = before !== BASE + path; }
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
