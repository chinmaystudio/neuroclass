// Screenshots: sign-in/sign-up dialogs with Google, first-time role chooser, OAuth callback error.
import { createRequire } from 'node:module';
import { BASE, context } from './harness.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = new URL('./shots/pages', import.meta.url).pathname;
const b = await chromium.launch();
const errs = [];
// Signed out: sign in and sign up dialogs.
let ctx = await context(b, null, 'desktop'); let p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(BASE + '/'); await p.waitForTimeout(800);
await p.getByRole('button', { name: /^sign in$/i }).first().click(); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/auth-signin-google.png` });
await p.getByRole('dialog').getByRole('button', { name: /create an account/i }).click(); await p.waitForTimeout(300);
await p.getByText('I’m a teacher').click(); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/auth-signup-google.png` });
await p.goto(BASE + '/auth/callback?error_description=Access%20denied'); await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/auth-callback-error.png` });
await ctx.close();
// Signed in with Google, no role yet: role chooser.
ctx = await context(b, 'student', 'desktop');
await ctx.route('https://mock.supabase.co/rest/v1/users*', (r) => r.fulfill({ json: { role: 'student', role_chosen_at: null }, headers: { 'content-type': 'application/json' } }));
p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(BASE + '/auth/callback'); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/auth-role-chooser.png` });
console.log('chooser visible:', await p.getByText('How will you use NeuroClass?').isVisible());
await ctx.close(); await b.close();
console.log('errors:', errs);
