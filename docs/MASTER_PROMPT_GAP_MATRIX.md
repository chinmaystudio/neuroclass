# NeuroClass Master-Prompt Gap Matrix

## Purpose

This document reconciles the supplied CTO transformation prompt with the current NeuroClass repository at commit `f239fa8`. It prevents the next implementation pass from treating a demo-safe baseline as a fully production-ready platform.

## Current baseline already implemented

| Area | Current state | Evidence |
|---|---|---|
| Portal role resolution | Supabase-backed role resolution and pending-state route protection are present. | `frontend/services/authService.ts`, `frontend/components/auth/SessionGuardian.tsx` |
| Attendance authority | Student check-in write path was removed from the active student classroom view; teacher-issued sessions, expiry, teacher attribution, and duplicate-safe session binding exist. | `frontend/components/ai/AttendanceSystem.tsx`, `supabase/schema.sql` |
| Classroom selection | Teacher attendance is mounted against the selected classroom rather than a hardcoded demo classroom. | `frontend/components/instructor/InstructorDashboard.tsx`, `ClassroomDetail.tsx` |
| x402 payment | Paid AI routes use x402 AVM exact payment flow with USDC micro-unit pricing, facilitator settlement, idempotent payment persistence, entitlements, events, and explorer metadata. | `backend/services/x402Routes.ts`, `frontend/services/algoClient.ts` |
| Payment visibility | Shared payment timeline and receipt metadata are shown in the active teacher and student paid AI flows, including the classroom AI test modal. | `frontend/components/payments/PaymentTimeline.tsx` |
| Project advisor | Paid student project-advisor form, structured blueprint generation, persistent project record, and receipt display exist. | `frontend/components/student/ProjectAdvisor.tsx`, `backend/services/aiGenerationService.ts` |
| Classroom AI boundary | Classroom-answer API authenticates the request, verifies enrollment, scopes source materials to the selected classroom, persists the thread, and returns citations. | `backend/services/x402AiApp.ts`, `frontend/components/student/ClassroomLearningBot.tsx` |
| Schema migration | An idempotent migration exists for sessions, appeals, materials, learning threads/messages, project ideas, entitlements, and x402 event records. | `supabase/migrations/20260813090000_production_learning_attendance_x402.sql` |
| Build validation | Vite build, frontend TypeScript check, backend TypeScript check, and diff hygiene pass. | Validation run recorded in `docs/PRODUCTION_FEATURE_INVENTORY.md` |

## Remaining high-risk gaps

| Master-prompt requirement | Gap in current code | Priority | Planned treatment |
|---|---|---:|---|
| Full authoritative attendance flow | No server-issued QR/PIN challenge endpoint, student session-verification endpoint, nonce consumption, replay protection, real-time roster subscription, controlled immutable correction table, or teacher manual override UI. Face matching remains client-side and can be spoofed. | P0 | Add server-authoritative challenge/response tables and RPC/API endpoints; record append-only corrections and audit events; implement temporary QR/PIN verification and teacher review. |
| Anti-proxy attendance | No liveness challenge, proximity signal, device/session binding, or anomaly review workflow. | P0 | Add configurable liveness/proximity signals and anomaly flags without automatic punishment. Treat biometric matching as advisory until server verification is complete. |
| File ingestion | `classroom_materials` stores `extracted_text`, but there is no production upload manager, private-storage download path, PDF/DOCX extraction worker, OCR fallback, chunk table, embedding table, retry state, or page-level citations. | P0 | Add teacher material manager, signed private-file access, deterministic extraction pipeline, chunk metadata, and ingestion status/error UI. Use an event/background worker rather than synchronous request work. |
| Adaptive learning | Current tutor answers from bounded material text and thread history but does not analyze assignments, test results, mistakes, weak topics, repeated questions, or progression history. | P1 | Add student learning profile, mastery signals, recommendation records, privacy-safe aggregates, and an adaptive tutor context builder. |
| Classroom AI isolation | Backend route is scoped, but private teacher notes, student submissions, and material visibility are not modeled separately; source rows lack page/chunk/visibility metadata. | P0 | Add visibility/classification fields and enforce classroom/student/teacher policies in backend and RLS. Never rely on frontend filters. |
| Teacher AI analytics | No durable classroom misconception, difficult-topic, attendance-correlation, or at-risk student analytics pipeline. | P1 | Add derived analytics tables/views with explainable signals and teacher-only access; expose “potential anomaly” rather than irreversible decisions. |
| x402 state machine | Current UI collapses some stages and does not persist every lifecycle transition with request ID, user/product fields, submitted/confirmed timestamps, failure reason, expiry, or reconciliation status. | P0 | Add explicit payment-state enum and transition events; persist request/idempotency IDs; distinguish submitted, verified, settled, confirmed, failed, expired, and timeout. |
| Transaction verification page | Explorer links exist in receipts, but there is no `/payment/transaction/:transactionId` route that re-queries backend/indexer state and renders a standalone receipt. | P1 | Add authenticated/public verification endpoint with hash lookup, chain-state verification, receipt page, and safe redaction. |
| Payment reconciliation | No webhook/reconciliation worker, retry queue, settlement polling, timeout recovery, or refund state machine. | P0 | Add scheduled or event-driven reconciliation appropriate to the deployment host; preserve idempotency and never grant access from client claims. |
| Project advisor depth | Current result is a single blueprint rather than multiple ranked ideas with innovation/feasibility/competition/learning scores, compare/regenerate/improve/save/share/export, or project workspace creation. | P1 | Expand response schema and UI; add project workspace, milestones, tasks, team, resources, GitHub link, demo checklist, and hackathon mode. |
| Assignment system | Existing evaluator APIs and UI use legacy evaluation storage; there is no durable assignment lifecycle with rubric, publish state, deadlines, attachments, late policy, resubmission, or teacher override audit. | P0 | Normalize assignment, submission, rubric, feedback, and grade-override tables; implement authoritative teacher/student policies and explicit AI-assist status. |
| Evaluation integrity | `frontend/services/evaluationStore.ts` mirrors evaluations into localStorage, creates client IDs, optimistically writes records, and the schema allows anonymous evaluation access. | P0 | Make Supabase/server records authoritative, remove client-generated identity, tighten RLS, add teacher ownership/student visibility policies, and record AI score versus teacher override. |
| Exam experience | Attempts/submissions exist in schema, but autosave, network recovery, timer authority, answer concealment, server-side submission locking, and robust result gating are not verified. | P1 | Audit active exam components and add server-time attempt state, idempotent answer saves, immutable submission, and post-submit result policy. |
| AI proctoring | Schema has violations, but event evidence/confidence/severity/review workflow and false-positive safeguards are not complete or verified. | P1 | Add append-only proctoring events, evidence metadata, teacher review queue, student explanation/appeal, and no automatic disciplinary action. |
| Teacher command center | Dashboard remains largely navigation/summary shell; no complete today’s classes, grading queue, risk signals, announcements, engagement, AI recommendations, and payment activity aggregation. | P1 | Build derived dashboard queries/cards with loading, empty, error, and permission states. |
| Configuration and secrets | `analyze-question-paper` falls back to `DEMO_KEY`; several logging paths use console output; package metadata remains `react-example`; no explicit test/lint/security/deploy scripts exist. | P0 | Fail closed when AI credentials are missing, add structured redacted logging, rename metadata, add tests and CI checks, and document deployment config. |
| Observability and abuse controls | No visible request IDs, rate limits, model spend caps, prompt-injection controls, upload limits, or abuse audit for AI/payment endpoints. | P0 | Add bounded schemas, content-size limits, per-user/service rate limiting, request correlation, redacted logs, moderation/prompt-injection policy, and spend/timeout controls. |
| Performance | Build warns about a multi-megabyte face/AI chunk; classroom retrieval is bounded text rather than indexed search. | P1 | Code-split routes and heavy ML assets; add chunked retrieval/vector search with classroom ACL filters. |
| Accessibility/responsiveness | Existing UI is visually rich but no systematic keyboard, focus, semantic form, contrast, reduced-motion, screen-reader, or narrow viewport audit has been completed. | P1 | Run an accessibility pass across active portals and payment/attendance flows. |
| Test coverage | No unit, integration, RLS, API contract, payment mock/facilitator, or end-to-end test suite is defined in package scripts. | P0 | Add deterministic tests for auth boundaries, attendance replay/duplicates, x402 transitions/idempotency, classroom isolation, and critical UI states. |

## Architectural conclusion

The baseline is not ready to claim full production grade. The most important next sequence is: **authoritative data and API boundaries first**, then **material ingestion and retrieval**, then **payment reconciliation and verification**, then **product expansion**. UI-only additions before these boundaries would create attractive but untrusted workflows.

The active implementation should preserve the existing Vite/React plus Next/Hono/Supabase structure unless a concrete scaling constraint requires a migration. Background extraction, reconciliation, and analytics should be event-driven or scheduled in the deployed backend rather than performed in the browser. All new writes should be server-authoritative and idempotent.

## Suggested delivery slices

| Slice | Deliverable | Exit criterion |
|---|---|---|
| A | Attendance challenge and audit foundation | A student cannot create attendance without an active server-issued teacher session; replay and duplicate attempts are rejected and logged. |
| B | Material ingestion | A teacher uploads a private PDF, ingestion reaches ready/failed state, and a student receives page/source citations only from an enrolled classroom. |
| C | Adaptive context | Tutor recommendations incorporate per-student performance signals without exposing other students’ private data. |
| D | Payment lifecycle | Every paid request has durable request/transition/settlement records; a confirmed hash can be independently verified from a standalone receipt page. |
| E | Project workspace and teacher operations | Students can save/rank ideas into workspaces; teachers have useful classroom analytics and review queues. |
| F | Quality gate | Builds, migrations, API contracts, RLS tests, critical browser flows, security scan, accessibility smoke tests, and deployment checklist pass. |
