# Testing

## Suites

| Suite | Command | What it covers | Result on this branch |
|---|---|---|---|
| Backend unit | `cd backend && npm test` | Grading for every question type, negative marking, partial credit, numeric tolerance, short-answer normalisation, the student projection never leaking keys, lifecycle and availability, expiry and grace, deterministic shuffling, integrity score, legacy question import, face-service response interpretation, sandbox output comparison and hidden-case redaction, compile-error short-circuit, assignment lateness, upload validation (magic bytes, renamed executables, path traversal) | **45 passed** |
| Backend integration (real PostgreSQL) | `prepare-db.sh`, then `npm run test:integration` | The real API router and services against Postgres 16 with all migrations applied. Scenarios A–F below. | **33 passed** |
| Migration checks | `prepare-db.sh` (runs every migration with `ON_ERROR_STOP`) plus the RLS checks in DATABASE.md | Idempotency (each new migration run twice), `tc_*` import, legacy visibility restore, duplicate-attempt cleanup, RLS negatives for anon, other students and other teachers | **passed** |
| ML service | `cd ml-service && ML_SERVICE_API_KEY=x python -m pytest -q` | Baseline, temporal persistence, brief glances ignored, pitch (looking down), gaze, multi-face precedence, cooldowns, service-key auth, raw-image rejection, payload cap, health endpoints | **12 passed** |
| ML behaviour evaluation | `PYTHONPATH=. python scripts/evaluate.py` | Synthetic sequences: normal session produces no events; multi-face and face-absence sequences produce the expected events | **passed** (relative behaviour only) |
| Frontend type checks | `npm run lint` plus a strict check of `frontend/features` | Whole app; new modules under `strict` and `noUnused*` | **passed** |
| Builds | `npm run build`, `cd backend && next build` | Production bundles; Monaco workers; the `/api/v1/[...path]` route | **passed** |
| Visual check | Playwright with a fake camera, mocked API | Exam setup, multiple-choice exam (desktop and mobile), coding exam with Monaco, teacher test list, editor, live monitor, student list, assignments; zero console errors | **passed** (bugs found and fixed: empty IDE starter, mobile header) |

The integration suite is skipped when `TEST_DATABASE_URL` is unset. CI (`.github/workflows/ci.yml`) starts a Postgres 16 service and runs it on every push.

## End-to-end scenarios (integration suite)

- **A. Normal classroom test.** Teacher creates, adds four question types, and publishing is refused until questions exist, then succeeds. Student A sees the test without answer keys. Start puts the attempt in *calibrating* (no questions, no timer). Consent and identity are required. Face mismatch and multiple faces are rejected, then a match is accepted. A non-image upload is rejected. Begin sets a server deadline. Autosave works; a stale offline revision is ignored; an invalid answer shape is rejected; resume after refresh returns the saved answers; starting again returns the same attempt. Two parallel submits produce exactly one submission. Server grading gives 5/8 with the essay pending. Results stay hidden until graded (an out-of-range grade is refused) and released. Question edits and unpublishing are locked after attempts.
- **B. Unauthorized access.** Student B (other classroom) gets 404 on the list, test, start and results. Student B and a classmate in the same class get 404 on another student's attempt (get, result, submit, events, answer). Teacher B cannot edit, review, grade, duplicate or create in Classroom A. A student cannot use teacher endpoints. A teacher cannot duplicate into a classroom they don't own. Legacy email-only enrolment works only for the matching account.
- **C. Proctoring.** Browser and vision events are stored with server-assigned severity and bounding boxes. Warnings escalate to a teacher alert at the threshold. Invented event types are rejected. The teacher monitor shows the escalation. Dismissing an event raises the integrity indicator. Another teacher cannot review it, and a student cannot open the monitor.
- **D. Coding exam.** A coding exam needs a coding question. Teacher reference run passes every test case. Students see only sample cases, `all` is downgraded to samples, and hidden inputs and outputs never appear in responses. Disallowed languages are rejected, and so are other students' runs. Custom input works. Submission is graded against hidden cases (10/10). When the sandbox is down, runs return 503 and submissions are flagged for manual review.
- **E. Assignments.** Drafts are invisible to students. Students see no hidden cases, and other classrooms get 404. Drafts save. A renamed executable is rejected and a real PDF accepted, and the storage path is never exposed. Double submit produces one submission, with no marks before return. The teacher runs hidden cases, other teachers are blocked, scores above maximum are refused, then the work is graded and returned. Students cannot access the teacher submission view. Late submissions are blocked or penalised according to the policy.
- **F. Recovery.** An expired attempt auto-submits on the next request with saved answers graded. Attempts before a scheduled start or after closing are refused. When the face service is down under the "warn" policy, the student goes to manual review and may begin. Malformed ids, oversized bodies and wrong methods are rejected. Audit logs are written.

## Not covered here (needs real infrastructure)

- A real Judge0 or Piston sandbox (the provider adapters are unit-tested against the documented response shapes; the integration suite uses a fake provider).
- The real ArcFace face service (its two response shapes are covered by unit tests).
- MediaPipe accuracy across users, lighting and cameras. See ml-service/MODEL_CARD.md for the evaluation still needed.
- Real Supabase Auth and Storage (integration tests use a PostgREST-compatible shim over the same Postgres schema).

Run the post-deploy smoke test in docs/DEPLOYMENT.md after the first deployment.
