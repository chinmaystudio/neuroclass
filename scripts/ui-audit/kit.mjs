// Verifies the UI kit showcase: screenshots (light/dark × desktop/mobile),
// console errors, horizontal overflow and keyboard behaviour.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { context, BASE } from './harness.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = new URL('./shots/kit', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const report = { errors: [], checks: {} };
for (const vp of ['desktop', 'mobile']) for (const theme of ['light', 'dark']) {
  const ctx = await context(b, null, vp); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${vp}-${theme}: ${m.text().slice(0, 160)}`); });
  p.on('pageerror', (e) => report.errors.push(`${vp}-${theme} PAGEERROR ${e.message}`));
  await p.addInitScript((t) => { localStorage.setItem('theme-default-version', 'light-default-v1'); localStorage.setItem('theme', t); }, theme);
  await p.goto(BASE + '/ui-kit'); await p.waitForTimeout(1800);
  const scroller = p.locator('div.fixed.inset-0.overflow-y-auto').first();
  const overflow = await p.evaluate(() => { const s = document.querySelector('div.fixed.inset-0.overflow-y-auto'); return s ? s.scrollWidth - s.clientWidth : -1; });
  report.checks[`${vp}-${theme}-hOverflowPx`] = overflow;
  const h = await scroller.evaluate((el) => el.scrollHeight);
  const step = vp === 'desktop' ? 900 : 760;
  for (let y = 0, i = 0; y < h && i < 14; y += step, i += 1) {
    await scroller.evaluate((el, yy) => el.scrollTo(0, yy), y); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/${vp}-${theme}-${String(i).padStart(2, '0')}.png` });
  }
  await ctx.close();
}
// Keyboard behaviour (desktop light)
{
  const ctx = await context(b, null, 'desktop'); const p = await ctx.newPage();
  await p.goto(BASE + '/ui-kit'); await p.waitForTimeout(1500);
  // Tabs: arrow keys move selection
  const firstTab = p.getByRole('tab', { name: 'Stream' }); await firstTab.focus(); await p.keyboard.press('ArrowRight');
  report.checks.tabsArrowRight = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.keyboard.press('End'); report.checks.tabsEndSkipsDisabled = await p.evaluate(() => document.activeElement?.textContent?.trim());
  // Modal: focus moves in, Tab is trapped, Esc closes and restores focus
  const opener = p.getByRole('button', { name: 'Open dialog' }); await opener.scrollIntoViewIfNeeded(); await opener.click(); await p.waitForTimeout(200);
  report.checks.modalOpen = await p.getByRole('dialog', { name: 'Release results?' }).isVisible();
  const inside = []; for (let i = 0; i < 6; i += 1) { await p.keyboard.press('Tab'); inside.push(await p.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))); }
  report.checks.modalFocusTrapped = inside.every(Boolean);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  report.checks.modalClosedByEsc = !(await p.getByRole('dialog').count());
  report.checks.focusRestoredToOpener = await p.evaluate(() => document.activeElement?.textContent?.trim());
  // Destructive confirm requires typed text
  await p.getByRole('button', { name: 'Destructive confirm' }).click(); await p.waitForTimeout(150);
  const del = p.getByRole('alertdialog').getByRole('button', { name: 'Delete classroom' });
  report.checks.destructiveDisabledUntilTyped = await del.isDisabled();
  report.checks.destructiveInitialFocusIsCancel = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.getByRole('alertdialog').getByRole('textbox').fill('A4'); report.checks.destructiveEnabledAfterTyping = await del.isEnabled();
  await p.keyboard.press('Escape');
  // Account dropdown: arrow navigation and Esc
  await p.getByRole('button', { name: /Account menu/ }).click(); await p.waitForTimeout(150);
  report.checks.menuFirstFocused = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.keyboard.press('ArrowDown'); report.checks.menuArrowDown = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.keyboard.press('Escape'); report.checks.menuEscRestores = await p.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  // Validation message wiring
  const titleInput = p.getByLabel('Test title'); await titleInput.focus(); await p.keyboard.press('Tab');
  report.checks.validationAriaInvalid = await titleInput.getAttribute('aria-invalid');
  report.checks.validationDescribedBy = await titleInput.evaluate((el) => document.getElementById((el.getAttribute('aria-describedby') || '').split(' ')[0])?.textContent);
  // Toggle is a switch
  const sw = p.getByRole('switch', { name: 'Require Face ID before starting' }); await sw.click();
  report.checks.switchChecked = await sw.getAttribute('aria-checked');
  // Unnamed controls on the page
  report.checks.unnamedControls = await p.evaluate(() => [...document.querySelectorAll('button,a[href],[role=tab],[role=switch],input,select,textarea')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width) return false; const n = (e.getAttribute('aria-label') || e.textContent || '').trim(); const lbl = (e).labels?.length; return !n && !lbl && !e.getAttribute('aria-labelledby') && !e.getAttribute('placeholder'); }).map((e) => e.outerHTML.slice(0, 80)));
  // Mobile drawer
  await ctx.close();
  const m = await context(b, null, 'mobile'); const mp = await m.newPage(); await mp.goto(BASE + '/ui-kit'); await mp.waitForTimeout(1500);
  await mp.getByRole('button', { name: 'Open navigation' }).click(); await mp.waitForTimeout(200);
  report.checks.drawerOpen = await mp.getByRole('dialog', { name: 'Navigation' }).isVisible();
  await mp.screenshot({ path: `${OUT}/mobile-drawer.png` });
  await mp.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Assignments' }).click(); await mp.waitForTimeout(200);
  report.checks.drawerClosesOnNavigate = !(await mp.getByRole('dialog', { name: 'Navigation' }).count());
  // Stacked table on mobile (no table element visible)
  report.checks.mobileTableStacked = await mp.evaluate(() => { const t = document.querySelector('[data-ui="table"]'); return t ? getComputedStyle(t.parentElement).display === 'none' : 'no table'; });
  await m.close();
}
await b.close();
console.log(JSON.stringify(report, null, 1));
