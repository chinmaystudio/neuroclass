# Architecture

## Components

```text
Browser (Cloudflare Pages)
  React SPA ── Supabase Auth (session) ──► Supabase
     │ Bearer <Supabase access token>
     ▼
Vercel API (Next.js)  /api/v1/*  + existing /api/attendance, /api/ai, /api/materials …
     │ service-role client (server only)        │ Bearer AI_SERVICE_SECRET       │ X-Proctoring-Service-Key     │ sandbox auth
     ▼                                          ▼                                ▼                              ▼
Supabase Postgres + Storage           Face recognition service          ml-service (Render)          Judge0 / Piston sandbox
(RLS, private buckets)                 (ArcFace, Render)                 temporal risk scoring        (isolated code execution)
```

The browser talks **only** to Supabase Auth (to sign in) and to the Vercel API. It never calls the face service, the ML service or the code sandbox, and it never receives embeddings, answer keys, hidden test cases or service credentials.

## Code layout

```text
frontend/
  features/
    lms/            api client, shared types, UI primitives
    tests/          teacher test panel, editor, question editor, AI suggestions, results, review, student list
    exam/           SecureExam (full-screen flow), answer queue, proctoring hook, on-device vision
    coding/         CodingWorkspace (Monaco, bundled locally) shared by exams, assignments and teachers
    assignments/    teacher and student assignment modules
  components/       existing NeuroClass screens (dashboards, attendance, materials …)
  config/features.ts  feature flags (payments)
backend/
  app/api/v1/[...path]/route.ts   single entry for the LMS API
  modules/
    core/           http helpers (auth, validation, errors, rate limits), classroom access, storage
    assessments/    domain (pure logic), repo, teacher and student services
    proctoring/     events, identity verification, ML client, face-service client
    coding/         language adapters, sandbox providers, run/evaluate service
    assignments/    assignment service
    router.ts       route table → handlers
  tests/            unit tests + real-Postgres integration tests
ml-service/         FastAPI proctoring service (imported with its git history)
supabase/           schema.sql, migrations/, rollback/
```

## Key flows

### Authorization (every `/api/v1` request)
1. `authenticate()` validates the Supabase access token (cached for 30 seconds).
2. The handler loads the resource (test, attempt, assignment, submission) **by id** and resolves its classroom.
3. `resolveClassroomAccess()` decides the role: **teacher** if the user owns `classrooms.user_id`, **student** if they have an enrolment in `students` (by `user_id`, or by verified email for legacy rows not linked to another account), otherwise **404**. Responses don't reveal whether a resource exists in someone else's classroom.
4. Students' attempts must also have `attempts.student_id = auth user`. Drafts and unpublished assignments return 404 to students.

RLS policies (see DATABASE.md) give the same isolation if anything queries Supabase directly from the browser.

### Exam attempt lifecycle

```text
start ─► calibrating ──consent──► identity verify ──► begin ─► in_progress ──submit/timeout──► submitted ──grade──► evaluated ──release──► results visible
          (no questions,                         (server sets         (autosave, heartbeat,       (objective +
           no timer)                              expires_at)          proctoring signals)         coding auto-graded)
```

- **Server-authoritative timing**: `expires_at = min(begin + duration, scheduled_end)`. Every write checks it; a short grace window (default 20 seconds) accepts answers already in flight. Expired attempts are finalised on the next request (answer save, heartbeat, state fetch), so a student who closes the tab is still auto-submitted.
- **No duplicate attempts**: a partial unique index allows one open attempt per student per test. `start` returns the existing attempt.
- **Exactly-once submission**: a conditional `UPDATE … WHERE status='in_progress'` locks the attempt, so double clicks or a race with the timeout produce one grading run.
- **Autosave**: each answer carries a revision number. The offline queue (localStorage) replays answers, and stale revisions are ignored.
- **Shuffling**: the question and option order is seeded by the attempt id and stored on the attempt, so it is stable across refreshes.
- **Grading**: objective questions are graded on the server. Short answers that don't match are flagged for teacher review instead of being marked wrong. Long answers are graded manually. Coding answers run against **all** test cases (hidden ones included) in the sandbox, with partial credit by test-case weight.

### Proctoring signal pipeline

| Layer | Runs where | What it does |
|---|---|---|
| Browser signals | student browser | tab hidden, window blur, full-screen exit, blocked copy/paste/drop/context-menu, online/offline, camera track ended |
| On-device vision | student browser (MediaPipe Face Landmarker, plus optional COCO-SSD phone check) | face count and box, head yaw/pitch/roll, iris gaze, frame brightness/contrast, motion. Rules fire only after a condition persists for the configured number of seconds, with a cooldown per warning type |
| Temporal ML | `ml-service` (Render) | per-attempt robust baseline (median/MAD) plus temporal rules on compact numeric features, producing a risk score |
| Identity | face service (Render), via the API | verification before the exam starts, plus periodic re-checks (default every 180 s). A mismatch forces re-verification |
| Server | Vercel API | assigns every event's **category and severity** (the client chooses only the type), updates the integrity indicator, escalates to the teacher after N warnings |

A red box is drawn only when a detector supplied coordinates for an event. Events are **review signals**: teachers can dismiss them (dismissed events stop counting against the student) or mark them as a concern. Nothing fails a student automatically.

### Code execution

```text
CodingWorkspace ──POST /api/v1/code/run──► API: auth, context check (own running attempt / enrolled assignment / teacher),
                                             language allow-list, per-user rate limits, size limits
                                           ──► Judge0 or Piston (isolated sandbox, CPU/memory/time/output limits, no network)
```

Students can run custom input or the **visible** sample tests. Hidden tests run only on submission (exams) or when the teacher evaluates (assignments). Results shown to students contain pass/fail only for hidden cases.

## Design decisions

1. **Port, not copy, test_creation.** test_creation used Express + tRPC + Drizzle with its own `tc_*` user tables and a JWT handoff into an iframe. Its domain logic (assessment config, lifecycle validation, integrity score, proctoring policy, ML client, AI candidate review) was ported into `backend/modules`, and its data model was mapped onto NeuroClass's tables. Keeping two auth systems, two ORMs and an iframe would have broken the "one app, one auth" requirement.
2. **One catch-all API route** (`/api/v1/[...path]`) with an explicit route table. This keeps Vercel function count and cold starts low, and the route table doubles as API documentation.
3. **Extend legacy tables instead of replacing them.** `tests` and `attempts` keep their ids and are extended. Answer keys move to `test_questions.answer_key` (server-only), and the legacy `tests.questions` JSONB is normalised lazily and then cleared.
4. **On-device vision with a validated pre-trained model** (MediaPipe) rather than training new models. No video leaves the device; the ML service sees only numbers.
5. **External sandbox for code.** Untrusted code never runs in the API process. Judge0 and Piston are both supported behind one interface, because neither can run on Vercel or on Render's unprivileged containers.
6. **Feature flags for payments** so they can be restored without reverting commits.
