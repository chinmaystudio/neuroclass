# API reference: `/api/v1`

All endpoints require `Authorization: Bearer <Supabase access token>` and return JSON. Errors look like `{ "error": "Readable message", "code": "bad_request|unauthorized|forbidden|not_found|conflict|rate_limited|unavailable|internal", "details"?: [...] }`.

Status codes: `400` validation · `401` no or expired session · `403` wrong role within your own classroom · `404` not found **or not yours** (cross-classroom ids are never confirmed) · `409` state conflict (attempt finished, questions locked, deadline passed…) · `413` body too large · `415` bad file type · `429` rate limited · `503` dependency not configured or down.

Identifiers are UUIDs; anything else returns 400.

## Tests

| Method & path | Who | Notes |
|---|---|---|
| `GET classrooms/:classroomId/tests` | teacher or student | Teacher: every non-archived test with stats. Student: published/closed tests with `availability`, `myStatus`, `canStart`, and results only once released. |
| `POST classrooms/:classroomId/tests` | teacher | Body: `title, durationMinutes, description?, instructions?, subject?, passingMarks?, examMode ('standard'\|'coding'), scheduledStart?, scheduledEnd?, config, security`. Creates a draft. |
| `GET me/tests` | student | Tests from all of the student's classrooms. |
| `GET tests/:testId` | teacher | Full editable test, including answer keys and hidden test cases; `questionsLocked` once attempts exist. |
| `PATCH tests/:testId` | teacher | Partial update. Duration, config and mode are locked after the first attempt. |
| `PUT tests/:testId/questions` | teacher | Replaces all questions (max 300). Refused once attempts exist. |
| `POST tests/:testId/publish` | teacher | `{ scheduledStart?, scheduledEnd? }`. Needs at least 1 question, and test cases for every coding question. |
| `POST tests/:testId/unpublish` · `close` · `reopen` · `archive` · `duplicate` | teacher | `duplicate` accepts `{ classroomId? }` (the target classroom must also be yours). |
| `DELETE tests/:testId` | teacher | Drafts without attempts only. |
| `GET tests/:testId/results` | teacher | Metrics, attempts and per-question performance. |
| `GET tests/:testId/monitor` | teacher | Live attempts: online, camera, identity, warnings, risk, time left. |
| `POST tests/:testId/release-results` | teacher | `{ released: boolean }` |

### Question object (teacher)
`type` ∈ `mcq, multiple_select, true_false, short_answer, fill_blank, long_answer, numerical, coding`; `prompt`; `marks`; `negativeMarks`; `options[{text,isCorrect}]`; `acceptedAnswers[]`, `caseSensitive`; `numericAnswer`, `numericTolerance`; `partialCredit`; `modelAnswer`; `explanation`; `coding { languages[], starterCode{}, timeLimitMs, memoryLimitMb }`; `testCases[{input, expectedOutput, isHidden, weight}]`.

## Attempts (student)

| Method & path | Notes |
|---|---|
| `POST tests/:testId/attempts` | Starts or resumes. Returns the attempt state. Questions stay empty until `begin`. |
| `GET attempts/:attemptId` | Resume state: questions in this attempt's order (no answer keys), saved answers, `expiresAt`, `serverTime`. |
| `POST attempts/:attemptId/consent` | Records camera-monitoring consent. |
| `POST attempts/:attemptId/identity` | multipart `file` (JPEG/PNG/WebP, ≤ 2.5 MB). Returns `{verified, reason, identityStatus, canProceed, message, faces[box]}`. |
| `POST attempts/:attemptId/begin` | Starts the server timer once the checks pass. |
| `PUT attempts/:attemptId/answers/:questionId` | `{ response, markedForReview, revision? }`. Response shapes: `{optionIds[]}`, `{text}`, `{value}`, `{language, source}`. |
| `POST attempts/:attemptId/answers` | Batch (offline queue replay). |
| `POST attempts/:attemptId/submit` | Idempotent. |
| `POST attempts/:attemptId/heartbeat` | `{ cameraStatus, fullscreen, visible }`. Auto-submits if expired. |
| `POST attempts/:attemptId/events` | `{ events: [{ type, occurredAt?, confidence?, durationSeconds?, details?, boxes?[] }] }`. The server sets severity. |
| `POST attempts/:attemptId/frame` | multipart `file`. Periodic identity re-check; returns face boxes and `reverify`. |
| `POST attempts/:attemptId/features` | `{ phase: 'calibrate'\|'finalize'\|'analyze', features }`. Numeric features only. |
| `GET attempts/:attemptId/result` | Score and breakdown once released. Correct answers only if the teacher enabled them. |
| `POST attempts/:attemptId/appeal` | `{ reason }` |

Browser event types: `tab_hidden, window_blur, fullscreen_exit, clipboard_blocked, context_menu_blocked, drop_blocked, navigation_blocked, network_offline, network_online, camera_disconnected, camera_reconnected, camera_obstructed, face_absent, multiple_faces, looking_away, head_turned, suspicious_object, vision_unavailable`.

## Attempt review (teacher)

| Method & path | Notes |
|---|---|
| `GET attempts/:attemptId/review` | Answers with keys, coding evaluation details, proctoring timeline, appeals. |
| `POST attempts/:attemptId/grade` | `{ grades: [{ questionId, manualScore, feedback? }], finalize? }` |
| `POST attempts/:attemptId/reevaluate-coding` | Re-runs coding answers in the sandbox. |
| `POST attempts/:attemptId/identity-override` | `{ decision: 'verified'\|'failed', note? }` |
| `PATCH proctoring-events/:eventId` | `{ reviewStatus: 'pending'\|'dismissed'\|'concern', note? }` |
| `PATCH appeals/:appealId` | `{ status: 'accepted'\|'rejected', resolution? }` |
| `GET proctoring/status` | Whether the face and ML services are configured and reachable. |

## Code execution

| Method & path | Notes |
|---|---|
| `GET code/languages` | Enabled languages with Monaco ids and starter code. |
| `POST code/run` | `{ contextType: 'test_attempt'\|'assignment'\|'teacher_question'\|'teacher_assignment', contextId, questionId?, language, source, stdin?, mode: 'custom'\|'samples'\|'all' }`. Students can use `custom` or sample tests only (`all` is downgraded). Limits: 15 runs per minute and 240 per hour per user (configurable); source ≤ 100 KB; stdin ≤ 64 KB. |
| `PUT code/workspace` · `GET code/workspace/:assignmentId` | Multi-session working copy for coding assignments. |

## Assignments

| Method & path | Who |
|---|---|
| `GET/POST classrooms/:classroomId/assignments` | teacher (all, with stats) or student (published, with `myStatus`) / teacher create |
| `GET/PATCH/DELETE assignments/:assignmentId` | read: both (students never see hidden test cases); write: teacher |
| `POST assignments/:assignmentId/{publish,unpublish,close,reopen,archive}` | teacher |
| `POST assignments/:assignmentId/attachments` (multipart) · `DELETE …/attachments/:attachmentId` · `GET …/attachments/:attachmentId/download` | teacher; download for both |
| `GET assignments/:assignmentId/submissions` | teacher: roster with each student's submission |
| `GET/PUT assignments/:assignmentId/my-submission` | student: view / save draft `{ textResponse?, code? }` |
| `POST …/my-submission/files` (multipart) · `DELETE …/files/:fileId` · `GET …/files/:fileId/download` | student |
| `POST …/my-submission/submit` · `POST …/my-submission/reopen` | student (submit is idempotent; reopen only before grading and if resubmission is allowed) |
| `GET submissions/:submissionId` · `POST …/grade` `{ score, feedback?, returnToStudent, waiveLatePenalty }` · `POST …/evaluate-code` · `GET …/files/:fileId/download` | teacher |

Downloads return `{ url, expiresInSeconds: 120 }` (a signed URL). Storage paths are never returned.

## Other existing routes (unchanged unless noted)

`/api/attendance/*`, `/api/students/face-registration`, `/api/materials*`, `/api/google-drive/*`, `/api/ai/classroom-answer`, `/api/ai/classroom-analytics`, `/api/ai/feedback`, `/api/evaluate/*`, `/api/analyze-question-paper`, `/api/workers/material-ingestion`, `/api/health`.

Changed: `/api/ai/generate-test`, `/api/ai/generate-assignment` and `/api/ai/project-idea` now **require authentication** and are rate limited (they were previously open to anyone). `/api/stripe/create-checkout-session` returns 503 while payments are disabled. **Removed**: `/api/test-portal/handoff` and `/api/exams/attempt/*`, replaced by `/api/v1`.
