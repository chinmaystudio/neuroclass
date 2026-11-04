# Implementation report: platform consolidation, LMS expansion, AI proctoring and security

Merged to `main`. Database migrations 0100 to 0500 were **applied to production on 2026-11-05**, after a backup (`nc_backup_20261105`) and testing against a snapshot of the production schema. Frontend and API deploy from `main` through the existing Cloudflare and Vercel integrations.

## 1. What was consolidated

| From `test_creation` | Now in `neuroclass` |
|---|---|
| Separate Express portal on Render, opened in an iframe through a JWT handoff | Native React screens inside the classroom (Tests tab) and the student dashboard. The handoff route is removed. |
| `tc_tests` / `tc_questions` tables | Imported into `tests` / `test_questions` by migration `20261105000200` (repeatable, keyed by `legacy_source`). `tc_*` tables are left in place for rollback. |
| Express exam APIs | `/api/v1/*` in the existing Vercel API (`backend/modules/*`) |
| `ml-proctoring` FastAPI service | `ml-service/` (imported **with git history**), deployed from the root `render.yaml` |
| Browser proctoring scripts | `frontend/features/exam/*` (TypeScript, MediaPipe Tasks) |

Legacy NeuroClass tests (questions in `tests.questions` JSON) are converted on first open, so no teacher has to re-enter anything.

## 2. Features delivered

**Classroom tests.** Teacher authoring with 8 question types (multiple choice, multiple select, true/false, short answer, fill in the blank, long answer, numerical, coding), AI question generation, scheduling, lifecycle (draft → published → closed → archived; duplicate; delete drafts), and per-test settings: attempts, shuffling of questions and options, negative marking, pass mark, result release and answer visibility. Server timer with a grace window, autosave with revisions and an offline queue, resume after refresh or crash, exactly-once submit, auto-submit on expiry, server grading with manual grading for essays, result release, per-question analytics, and audit log.

**AI proctoring.** Consent screen, then identity check against the student's enrolled face (existing ArcFace service), then a camera, lighting and full-screen check, then calibration. During the exam: face absent, multiple faces, head turned (yaw and pitch), looking away (iris gaze), camera blocked, optional phone detection, tab switch and window blur, full-screen exit, and copy/paste/right-click/drop blocked. Red bounding boxes on the student's preview; teacher-configurable thresholds, warning limits and failure policy; periodic identity re-checks; server-side temporal risk (ml-service). Teacher live monitor, timeline review, dismiss or flag events, identity override, student appeals. Nothing is decided automatically.

**Coding IDE.** Monaco (bundled locally, with workers) in exams and assignments. 13 languages: Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, Kotlin, PHP, Ruby, Swift. Run with custom input, run sample tests, hidden tests on submit, weighted scoring, compile-error reporting, per-language starter code, copy/paste deterrents in exams, and a workspace that persists across sessions for assignments. Execution goes through a **Judge0 or Piston adapter** and never runs in the API.

**Assignments.** Text, file upload, document, coding and mixed types; due date, late policy (block / allow / penalty per day with a cap) and resubmission; teacher attachments; validated private uploads; drafts; idempotent submit; grading with feedback, a late-penalty waiver, and code test runs; teacher roster dashboard.

**Isolation and security.** See SECURITY.md. Two critical answer-key leaks and anonymous access to user profiles are closed. 31 integration tests cover access across classrooms and across students.

**Payments are temporarily disabled.** `PAYMENTS_ENABLED=false` / `VITE_PAYMENTS_ENABLED=false` hide every payment screen, the Stripe route returns 503, and the AI features no longer require payment. The code is kept so payments can be re-enabled (fix the items in SECURITY.md first).

**Performance and UX.** Dashboards and the exam load lazily: the landing page's JavaScript dropped from about 3.3 MB to about 410 KB. Mobile layouts were checked for the exam and the panels. Errors are honest everywhere (the fabricated Project Advisor fallbacks are removed).

## 3. Files removed (each confirmed unused or superseded first)

Frontend: `StudentPortal`, `ClassroomView`, `AITestGeneratorModal`, `ClassroomDetailViewStudent`, `ExamPortal`, `ExamTaker`, `ActiveTests`, `AIGenerationModal`, `TestAnalysisSystem`, `QuestionCard`, `services/testService.ts` (direct, insecure Supabase test access). Backend: `app/api/exams/*`, `app/api/test-portal/*`, `test_insert.mjs`, `test_upsert.mjs`. 35 root-level status reports moved to `docs/history/`.

## 4. Verification

| Check | Result |
|---|---|
| Backend unit tests | 45 / 45 |
| Backend integration tests on real PostgreSQL 16 with all migrations | 33 / 33 (scenarios A–F, TESTING.md) |
| ML service tests | 12 / 12; synthetic evaluation passed |
| Migrations | Apply cleanly, idempotent (run twice), RLS negative checks pass |
| Frontend `tsc` (strict on new modules) and `vite build` | Pass |
| Backend `next build` | Pass |
| Built-server smoke test | `/api/v1` without a token returns 401; CORS preflight OK; AI generation without auth returns 401; Stripe returns 503; handoff returns 404 |
| Visual check with Playwright (fake camera) | Exam flow, IDE, editor, monitor and assignments on desktop and mobile; 2 bugs found and fixed |

## 5. Limitations and what's still needed

1. **Code sandbox not deployed.** A Judge0 or Piston host is required (DEPLOYMENT.md §5). Until then, runs return 503 and coding answers go to manual grading. The adapters are unit-tested but have not been exercised against a live sandbox.
2. **Face service source isn't in any of the three repos.** Integration relies on its documented endpoints. A browser liveness check (head turn plus blink, enforced by the API) now runs before every Face ID capture; it stops photos and still images but is not certified presentation-attack detection.
3. **Proctoring accuracy is not measured on real data.** Only rule behaviour on synthetic sequences is tested. No model was trained because no consented, labelled dataset exists. MODEL_CARD.md describes the evaluation needed.
4. **No step debugger** in the IDE (run, test and compiler output only).
5. Fixed: classrooms are visible only to owners and members (join by code goes through an RPC), and `users.role` can no longer be changed from the browser.
6. Rate limits for AI generation, face checks, uploads and joining are durable (Postgres). CORS defaults to the known production origins.
7. Integration tests use a Postgres shim instead of the real Supabase Auth and Storage. Run the post-deploy smoke test.
8. The unused Firebase scaffold has been removed.

## 6. Deployment checklist

Back up → apply migrations 0100/0200/0300 → deploy ml-service (Render Blueprint) → set the Vercel environment variables (ALLOWED_ORIGINS, ML_*, CODE_RUNNER_*, PAYMENTS_ENABLED=false) → deploy the API → deploy Cloudflare Pages → smoke test → retire the old test_creation service. Details are in DEPLOYMENT.md.
