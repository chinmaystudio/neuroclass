# NeuroClass Production Feature Inventory

## Scope

This release hardens the active teacher and student portals, moves attendance authority to the teacher, adds durable x402/Algorand settlement records, and introduces two student AI products. The repository is a Vite React frontend with a separate Next/Hono backend and Supabase persistence.

## Corrected portal responsibility map

| Capability | Teacher portal | Student portal | Server enforcement |
|---|---|---|---|
| Attendance session | Open/close a classroom session; select one-by-one or group camera scan; register faces | Read attendance history; submit an appeal | `attendance_sessions` ownership, teacher identity, open-window check, session/student uniqueness, RLS |
| Attendance marking | Teacher-authorized face match only | No direct check-in or attendance insert | Student attendance modal/check-in controls removed; student appeal is the only write path |
| Classroom materials | Upload/manage classroom source files through teacher workflow | Read only enrolled classroom context through the learning assistant | Classroom membership query plus classroom-scoped retrieval |
| AI test generation | Paid test designer inside instructor flows | Not available | x402 route, facilitator settlement, idempotent payment ledger |
| Project advisor | Not applicable | Paid guided project ideation | Authenticated student request, x402 settlement, durable project record |
| Classroom AI | Teacher supplies classroom context/materials | Ask questions against the selected enrolled classroom | Bearer authentication, enrollment check, source-only prompt, persisted thread |
| Payment history | View wallet-specific settled payment ledger | Receipt shown immediately after paid project request | Server-managed x402 tables; explorer URL generated from settlement hash |

## Implemented feature set

### Identity and authorization

The public role selector is no longer authoritative. The active role is resolved from the authenticated Supabase-backed profile, route access remains blocked while role resolution is pending, and invalid role states are redirected safely. Client-side role changes cannot be used to rewrite the server-backed identity.

### Teacher attendance

Attendance now starts with a teacher-issued session containing a nonce, classroom owner, open/closed state, and expiry. The teacher must open a session before scanning. Single and group face scans write `session_id`, `marked_by`, verification method, confidence, mode, and capture metadata. Duplicate `(session_id, student_id)` rows are rejected by a partial unique index, and the UI only confirms or emails attendance after a successful insert. Teacher attendance is mounted inside the selected classroom rather than a hardcoded demo class.

The student portal no longer provides an attendance check-in action. Students can inspect their status and raise an attendance appeal for teacher review. This prevents a student from simulating presence from home through a student-controlled insert path. The camera workflow is teacher-operated; a production deployment should still add a dedicated liveness/anti-spoof model before using attendance for high-stakes decisions.

### x402 and Algorand payments

The paid AI routes use the AVM exact scheme with Algorand Testnet USDC, configured treasury address, environment-driven micro-USDC prices, a facilitator, and explicit timeout. Current defaults are 100,000 micro-USDC for test generation, 50,000 micro-USDC for assignment generation, and 150,000 micro-USDC for project advising.

The settlement flow is:

1. The frontend sends the request.
2. The backend returns an HTTP 402 payment challenge.
3. The x402 client creates the exact Algorand payment and Pera signs locally.
4. The facilitator verifies and settles the payment.
5. The backend decodes `PAYMENT-RESPONSE`, upserts the payment by transaction hash, grants an entitlement, records a `settlement_verified` event, and adds `X-402-Transaction-Id`.
6. JSON responses include protocol version, network, asset, payer, amount, receipt header, service name, and a verifiable Pera Testnet explorer URL.
7. The frontend shows wallet, challenge, signing, settlement, and receipt stages; users can copy the hash or open the explorer link.

The teacher x402 dashboard also exposes a wallet-specific persisted payment log through `/api/x402/ledger`. The API requires an authenticated Supabase session and only returns the requested wallet’s ledger rows.

### Paid student project advisor

`ProjectAdvisor` asks the student to select a category and answer four structured questions: target user/problem, available skills/resources, constraints, and measurable impact. An optional preferred stack is supported. The paid result is a structured blueprint containing a title, pitch, problem, solution, novelty, target users, MVP scope, stretch scope, architecture, milestones, risks, competition readiness, and next actions. The result and settlement hash are stored in `project_ideas`.

### Classroom adaptive learning assistant

`ClassroomLearningBot` lets a student choose an enrolled classroom and continue a private thread. The backend verifies the Supabase bearer token, confirms membership in the selected classroom, reads only ready `classroom_materials` rows for that classroom, limits material/history context, asks Gemini to answer only from the supplied context, persists the user and assistant messages, and returns citations and source names. The assistant explicitly reports when the available material is insufficient instead of inventing an answer.

### Data model and migrations

The canonical schema and idempotent migration add attendance sessions, attendance appeals, classroom materials, learning threads, learning messages, project ideas, x402 entitlements, x402 payment events, and payment transaction metadata. Payment tables remain server-managed through the service role. Student project records and learning threads are scoped to the authenticated student.

## Active API surface

| Method | Endpoint | Purpose | Payment |
|---|---|---|---|
| `POST` | `/api/ai/generate-test` | Generate a paid AI test | x402 |
| `POST` | `/api/ai/generate-assignment` | Generate a paid assignment | x402 |
| `POST` | `/api/ai/project-idea` | Generate and return a paid project blueprint | x402 + authenticated student |
| `POST` | `/api/ai/classroom-answer` | Answer from one enrolled classroom’s materials | Authenticated student |
| `GET` | `/api/x402/ledger?payer=...` | Return persisted wallet payment history | Authenticated session |

## Validation completed

The following checks pass after the changes:

- Vite production build: pass.
- Frontend TypeScript lint (`tsc --noEmit -p tsconfig.frontend.json`): pass.
- Backend TypeScript check (`tsc --noEmit -p backend/tsconfig.json`): pass.
- `git diff --check`: pass.

The Vite build reports a non-blocking bundle-size warning for the existing large AI/face-analysis chunk. Code splitting should be added before a high-traffic production launch.

## Required deployment configuration

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `X402_FACILITATOR_URL`, `NEUROCLASS_TREASURY_ADDRESS`, `VITE_NEUROCLASS_TREASURY_ADDRESS`, `VITE_X402_NETWORK`, `VITE_ALGOD_SERVER_URL`, and `ALLOWED_ORIGINS`. Set the three `X402_*_PRICE_USDC_MICRO` variables explicitly in production instead of relying on defaults. Apply `supabase/migrations/20260813090000_production_learning_attendance_x402.sql` to an existing database, or use the canonical schema for a new database.

## Prioritized next features

| Priority | Feature | Why it matters | Suggested implementation |
|---|---|---|---|
| P0 | Liveness and anti-spoof attendance | A camera match alone can still accept a screen/photo proxy | Challenge-response head movement, blink/texture liveness, device/session audit, manual override with reason |
| P0 | Server-side teacher role policy | UI role hardening is not a substitute for database role claims | Move role to Supabase app metadata or a protected profile table and enforce teacher ownership policies for every classroom mutation |
| P0 | Material ingestion worker | Adaptive answers depend on `extracted_text` being populated | Background PDF/DOCX extraction, OCR fallback, chunking, embeddings, status/error/retry state |
| P1 | Retrieval-augmented classroom AI | Full-text context limits do not scale to large classrooms | pgvector or hosted vector index with classroom and material ACL filters, top-k citations, citation offsets |
| P1 | Teacher material manager | Teachers need visibility into AI readiness | Upload queue, extraction progress, preview, replace/archive, failed-file retry, source permissions |
| P1 | Attendance analytics | Teachers need operational insight | Daily/weekly trends, absence risk, late arrivals, appeal queue, exportable audit reports |
| P1 | x402 webhook/reconciliation | Facilitator and chain settlement can be delayed | Settlement polling/webhook, retry queue, reconciliation job, payment state machine, refund workflow |
| P1 | Payment receipt page | Users need a shareable proof of payment | `/payments/:txId` page with raw receipt, network, ASA, amount, payer, receiver, timestamps, and explorer deep link |
| P2 | Student learning goals | Adaptive tutoring should personalize beyond one chat | Goals, diagnostic quiz, mastery map, spaced repetition, intervention recommendations |
| P2 | Assignment-aware tutoring | Students need help without receiving direct cheating answers | Assignment deadline context, hint levels, rubric-aligned feedback, teacher-configured answer policy |
| P2 | Teacher AI insights | Classrooms can use learning signals productively | Anonymous misconception clusters, question heatmaps, source gaps, suggested mini-lessons |
| P2 | Project collaboration | Project blueprints should become working teams | Team formation, roles, milestones, GitHub integration, demo checklist, peer review |
| P2 | Competition templates | Hackathon users need faster execution | Judging rubric mapper, pitch deck outline, problem validation script, budget and deployment checklist |
| P3 | Multi-network payment abstraction | Production may need more than Algorand Testnet | Network registry, asset metadata, chain-specific explorer resolver, per-route pricing and treasury configuration |
| P3 | Observability and abuse controls | AI/payment endpoints need operational safety | Structured logs, request IDs, rate limits, spend caps, moderation, alerting, Sentry/OpenTelemetry integration |

## Go-live blockers

Before production launch, apply the migration in a staging database, verify the configured treasury and Testnet USDC ASA, perform a real small-value x402 payment, confirm the transaction on-chain, verify the persisted ledger/entitlement/event rows, upload representative classroom files and run extraction, test teacher/student accounts with RLS enabled, and add liveness plus material-ingestion infrastructure if attendance or adaptive AI is a judged core feature.
