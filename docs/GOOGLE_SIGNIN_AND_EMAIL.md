# Google sign-in and email notifications: setup

The code is deployed. Three things have to be switched on outside the code: the database migration, the Google provider in Supabase, and an email provider on Vercel.

## 1. Database migration

Apply `supabase/migrations/20261105000600_google_signin_and_email_notifications.sql`, either in the Supabase dashboard (SQL Editor: paste the file and choose **Run**) or with the Supabase CLI. It is additive:

- `users.role_chosen_at`, filled in for every existing account, so nobody is asked to choose again;
- `users.email_notifications` (default on);
- `nc_choose_role()`, a one-time role choice for Google sign-ups;
- an updated sign-up trigger that also saves the Google name and photo;
- the `notification_outbox` table, readable by the server only.

Until it is applied, the app keeps working: Google sign-ups become students automatically, emails are skipped, and the student email switch stays hidden.

## 2. Google sign-in

**Google Cloud Console** (console.cloud.google.com)
1. APIs & Services → OAuth consent screen: User type **External**; app name **NeuroClass**; support email; app logo optional. Add the links to `https://neuroclass.pages.dev/privacy` and `/terms`. While the app is in **Testing**, only the test users you list can sign in. Choose **Publish app** when ready. The `email`, `profile` and `openid` scopes don’t need Google verification.
2. APIs & Services → Credentials → **Create credentials → OAuth client ID** → *Web application*.
   - Authorized JavaScript origins: `https://neuroclass.pages.dev`
   - Authorized redirect URIs: `https://hdjtgyvdlxwntfriqhff.supabase.co/auth/v1/callback`
3. Copy the client ID and client secret.

**Supabase dashboard** (project hdjtgyvdlxwntfriqhff)
1. Authentication → Sign In / Providers → **Google**: enable it and paste the client ID and secret.
2. Authentication → URL Configuration:
   - Site URL: `https://neuroclass.pages.dev`
   - Redirect URLs: add `https://neuroclass.pages.dev/auth/callback`; for local development also `http://localhost:5173/auth/callback`.

**How it behaves**
- A first-time Google user chooses **teacher** or **student** once. If they chose a role on the sign-up screen before going to Google, it is applied automatically. The choice can’t be changed from the browser afterwards.
- If someone already has a password account with the same verified Gmail address, Supabase links Google to that account, and their existing role is kept.

## 3. Email notifications

Students get one email per event: a test is published (or scheduled), an assignment is published, or test results are released. Re-publishing never sends a second email. Students can turn emails off in **Settings → Email notifications**. Each student gets their own message, so classmates never see each other’s addresses.

Set these on the **Vercel backend project** (Settings → Environment Variables, Production), then redeploy:

| Variable | Value |
|---|---|
| `MAIL_PROVIDER` | `brevo`, `resend` or `smtp` |
| `MAIL_FROM` | `NeuroClass <your-verified-sender@example.com>` |
| `APP_URL` | `https://neuroclass.pages.dev` (your custom domain later) |
| `MAIL_TIMEZONE` | `Asia/Kolkata` (dates in emails) |
| `CRON_SECRET` | a long random string (protects the daily retry job) |
| **Brevo:** `BREVO_API_KEY` | Brevo → SMTP & API → API keys |
| **Resend:** `RESEND_API_KEY` | needs a verified domain to email students |
| **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | e.g. Gmail: `smtp.gmail.com`, `465`, your address, an App Password |

**Which provider**
- **Brevo** works without a domain: verify a single sender address. The free plan allows 300 emails a day, which covers about three class-wide announcements to 100 students.
- **Gmail SMTP** allows about 500 a day.
- With your own domain, Resend or Brevo with domain authentication (SPF and DKIM) gives the best inbox placement. Mail sent from a gmail.com address through another service is more likely to land in spam.

**Reliability:** emails are sent while the teacher publishes, which takes a second or two for a class. Anything that fails stays queued, and the daily job (`/api/workers/notifications`, 02:30 UTC) retries it up to 5 times.
