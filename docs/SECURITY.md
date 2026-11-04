# Security

## Trust boundaries

1. **Browser ↔ API.** Everything from the browser is untrusted: ids, timers, marks, event severities, file types. The API re-derives all of them.
2. **API ↔ Supabase.** Service role, server-only. RLS is defence in depth for direct client queries.
3. **API ↔ face service, ML service, sandbox.** Shared secrets in server environment variables. None of these is reachable from, or returns secrets to, the browser.

## Controls

| Area | Control |
|---|---|
| Authentication | Supabase access token on every `/api/v1` call (validated with Supabase; cached for 30 seconds). Token length bounds. Expired sessions get 401 and a re-login message. |
| Authorization | Ownership is resolved from the database for every request: classroom owner → teacher; enrolment → student; anything else → 404. Attempt ownership (`student_id`) and resource-to-classroom links are checked on every read and write. Drafts and unpublished items are 404 for students. A test can only be duplicated into a classroom you also own. |
| IDOR | 31 integration tests drive real requests with other users' ids (other classroom, other student in the same class, other teacher) and expect 404 or 403. |
| Answer secrecy | Answer keys live in `test_questions.answer_key` (no client policy). The student projection is built from an allow-list of fields. Hidden test-case inputs and outputs are stripped before responses. Teachers choose whether correct answers are shown after release. |
| Exam integrity | Server timer and expiry checks on every write, exactly-once submission, one open attempt per student (DB index), revisioned autosave, server-assigned event severity, results hidden until released. |
| Input validation | zod schemas on every body. Body size caps (JSON 16 KB–2 MB per route, uploads 3–26 MB). UUID checks on path params. Postgres CHECK constraints on sizes and enums. |
| Files | Extension allow-list per assignment, **magic-byte verification** (PDF, PNG, JPEG, ZIP/Office), binary content rejected for text extensions, size limits, sanitised file names (no path traversal), random object keys, private bucket, 120-second signed URLs, storage paths never returned. |
| Camera images | JPEG/PNG/WebP magic bytes, max 2.5 MB, forwarded only to the face service, never stored. |
| ML service | Requires `X-Proctoring-Service-Key` (constant-time compare). 64 KB request cap rejects images. Feature schema forbids extra fields. Per-attempt rate limit. The model card states its limits. |
| Code execution | Never in the API process. External sandbox with CPU, wall-clock, memory, process, file-size and output limits, and `enable_network: false` (Judge0). Allow-listed languages, source and stdin size caps, 15 runs per minute per instance plus a durable hourly cap per user (`code_execution_jobs`), context checks (own running attempt / enrolled published assignment / owning teacher). |
| Rate limiting | Per-route limits on identity checks, frame checks, events, features, heartbeats, uploads, drafts, AI generation (30 per hour for tests and assignments, 10 per hour for project ideas). |
| Errors | Safe messages only. Database errors are logged server-side and returned as a generic 500. |
| Audit | `assessment_audit_logs` records create, update, publish, grade, release, appeal decisions, identity overrides and submissions. |
| Privacy | Explicit camera consent with a plain-language notice. No video is recorded or uploaded. On-device inference sends only numeric features. Embeddings stay in the face service. A teacher-configurable retention setting is recorded per test. Students can appeal. Manual identity approval is available when Face ID is unavailable. |

## Vulnerabilities found and fixed in this change

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **Critical** | `tests` had `Allow anonymous select … USING (true)`, and every question with its `correctAnswer` lived in `tests.questions`. Anyone with the public anon key could read every answer key. | Policy dropped; column privileges hide `questions`/`test_data`; keys moved to `test_questions`; RLS restricts tests to owners and enrolled students. |
| 2 | **Critical** | Students' exam screens loaded tests (with answers) directly from Supabase, and the legacy `ExamTaker`/`ExamPortal` graded in the browser. | Replaced by server-side attempts and grading; legacy components and `/api/exams/attempt/*` removed. |
| 3 | High | `users` had anonymous select and insert. Every email and mobile number was readable, and profiles could be forged. | Migration 0300: own-row policies, profiles created by trigger, anonymous access revoked. |
| 4 | High | `/api/ai/generate-test` and `/generate-assignment` were callable by anyone (payment gating had been simulated), so anyone could spend the Gemini quota. | Authentication plus per-user rate limits. |
| 5 | High | The student overview showed scores before the teacher released them. | It now uses the API, which returns scores only after release. |
| 6 | Medium | `vite.config.ts` injected `process.env.GEMINI_API_KEY` into the browser bundle when the variable was set at build time. | `define` removed. |
| 7 | Medium | Stripe checkout took the price and redirect URLs from the request body. | The route is disabled (payments off). Must be fixed before re-enabling (see below). |
| 8 | Medium | Project Advisor showed fabricated "demo" plans and fake blockchain receipts whenever the API failed (which was always, because of a response-shape bug). | Real response handling; errors shown honestly; saved server-side. |
| 9 | Medium | The separate portal relied on a long-lived (5-minute) JWT in an iframe URL. | The portal is merged; the handoff route is removed. |
| 10 | Low | Scratch scripts using the service-role key were committed (`backend/test_insert.mjs`, `test_upsert.mjs`). | Removed (they read the key from the environment; no key was committed). |
| 11 | Low | Duplicate open attempts could be created by parallel requests. | Partial unique index plus a conflict-safe start. |
| 12 | Low | ZodError surfaced as 500. | Mapped to 400 with field details. |

No live secrets were found in tracked files. `frontend/database/supabase.ts` contains a Supabase **publishable** key (public by design). `firebase-applet-config.json` contains a Firebase web API key from an unused scaffold. Firebase keys are not secrets, but restrict or delete that Firebase project if it isn't used.

## Known limitations and open items

- **Browser proctoring is a deterrent, not a guarantee.** It cannot see second devices, other people out of frame, screen sharing to another machine, or virtual cameras. Copy/paste blocking is bypassable. All signals are review aids, and nothing fails a student automatically.
- **Liveness and anti-spoofing** (photo or screen replay) for Face ID is not implemented beyond what the existing face service does. This P0 was already listed in the earlier audit.
- **`classrooms` is readable by any signed-in user** (needed for join-by-code). Better: a `join_classroom(code)` RPC, then restrict reads to owners and members.
- **The `users.role` column is user-editable.** It only drives UI routing. Classroom authority comes from ownership. Moving the role to `app_metadata` is recommended.
- **CORS** reflects any origin when `ALLOWED_ORIGINS` is unset. Set it in production. (Auth is a bearer token, not cookies, so CSRF does not apply.)
- **Rate limits** are per serverless instance, except the code-run cap (durable). Add an edge limiter (Vercel WAF or Upstash) for stronger guarantees.
- **Evidence snapshots** are not stored (privacy-first). If enabled in future, add a retention job honouring `security.evidenceRetentionDays`.
- **Before re-enabling payments**: compute prices server-side, allow-list redirect URLs, verify webhook signatures, and make the x402 routes enforce settlement again.

## Production database audit and changes (applied 2026-11-05)

An audit of the live Supabase project (not just the repository) found problems that were exploitable with the public key. All are fixed by `20261105000400_production_rls_hardening.sql`, which has been **applied to production**:

| Severity | Finding in production | Status |
|---|---|---|
| Critical | 15 tables had RLS disabled, including every `tc_*` portal table (questions, correct options, users, attempts) and `attendance_verification_attempts`, so they were readable and writable by anyone with the public key | RLS on every table; client access revoked |
| Critical | `students`: anonymous SELECT/INSERT/UPDATE `USING (true)`, exposing names, emails, phones and a legacy face descriptor | Own rows (student) or own classroom (teacher) only; face columns never client-readable |
| Critical | `face_embeddings` / `face_profiles` policies compared `s.classroom_id = s.classroom_id`, so any enrolled student could read **all biometric embeddings** | Embeddings server-only; profiles own or owner only |
| High | The same bug on `classroom_materials` and chunks (all classrooms' materials, including teacher-private) | Fixed; private materials stay with the teacher |
| High | `evaluations`: anonymous select/insert | Owner-only |
| High | Students could insert their own `attendance` rows (bypassing Face ID) and update their `attempts` (score) | Writes are server-only |
| Medium | `users` empty: the app's profile upsert wrote non-existent columns | 61 profiles backfilled; trigger creates new ones; role and email locked |
| Medium | Joining needed table-wide classroom read access | `nc_join_classroom` RPC (rate-limited 30/h); classrooms visible to owners and members only |

Verified after applying: 0 tables without RLS, 0 open policies, and student and teacher sessions simulated as the `authenticated` role see only their own classrooms. A pre-change copy of every touched table and of all policies and grants is in the private schema `nc_backup_20261105`. Drop it once you're satisfied: `DROP SCHEMA nc_backup_20261105 CASCADE;`.

Still to do in the Supabase dashboard (not possible through SQL): enable **leaked password protection** (Auth → Passwords).
