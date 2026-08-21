# NeuroClass Production Architecture Contract

## System boundary

The current Vite/React frontend remains a presentation and local-device layer. The Next/Hono backend is the authority for identity verification, classroom membership, attendance challenges, file access, AI context construction, payment transitions, and fulfillment. Supabase Postgres/RLS is the durable policy and audit layer. Algorand/Indexer verification is an external settlement evidence layer.

> The browser may propose an action, sign a wallet transaction, capture a camera signal, or display a result. It must never be the authority that grants attendance, payment entitlement, grade ownership, or classroom access.

## Identity and ownership

Every write endpoint first validates the Supabase bearer token with `auth.getUser`. Teacher actions additionally verify that `classrooms.user_id` equals the authenticated user ID. Student actions additionally verify a matching `students.user_id` enrollment row for the target classroom. Private teacher notes, student submissions, and classroom materials must have explicit visibility values and backend queries must scope them before AI context is assembled.

## Attendance contract

A teacher creates an attendance session for one owned classroom. The server generates a random nonce, a short expiry, and a rotating challenge token. The session is open only within its validity window. A student verification request must include the authenticated student identity, classroom/session IDs, challenge token or PIN, and optional device/proximity/liveness evidence. The backend verifies session status, expiry, classroom enrollment, token hash, one-time consumption, and `(session_id, student_id)` uniqueness in a transaction. It writes an attendance row and an append-only audit event. Replays and duplicates return a safe conflict and are logged.

Teacher manual correction never overwrites history invisibly. It inserts an attendance correction row containing old status, new status, reason, actor, timestamp, and metadata, then updates the current projection with a correction pointer/version. Any future analytics can distinguish observed attendance from corrected attendance.

## Materials and retrieval

Teachers upload files into a private Supabase Storage bucket with a classroom-scoped object path. A backend upload endpoint validates owner, size, MIME type, extension, and generated object name. A worker extracts text and page metadata, splits content into chunks, optionally generates embeddings, and marks the material `ready` or `failed` with retry metadata. Student retrieval filters by enrolled classroom and `visibility='classroom'`; teacher-private material and other-student submissions are excluded before ranking. Citations carry material ID, name, page, chunk ID, and a short quoted span.

## Adaptive learning

The tutor context builder receives only the selected student’s thread and learning profile, classroom-approved material chunks, and privacy-safe performance aggregates. It may produce grounded answers, confidence/grounding labels, weak/strong topics, recommended revision, and next practice. It must identify whether a statement is supported by classroom material or is optional general knowledge. The default policy is to decline unsupported classroom-specific claims.

## Payment state machine

Every paid request has a request ID and idempotency key. State transitions are durable and monotonic:

`CREATED → PAYMENT_REQUIRED → USER_APPROVAL → SUBMITTED → VERIFYING → SETTLING → CONFIRMED`

Failure states are `CANCELLED`, `REJECTED`, `EXPIRED`, `FAILED`, and `TIMEOUT`. `SUBMITTED` never grants fulfillment. The ledger stores product/service, authenticated user, payer, receiver, amount, currency/ASA, network, request ID, settlement transaction, timestamps, failure reason, and facilitator response. Repeated idempotency keys return the existing fulfillment or current payment state.

A reconciliation process re-checks ambiguous payments against the configured facilitator and Algorand Indexer/Algod endpoint. The public receipt lookup uses the backend’s verified record and chain state; it does not trust a hash supplied only through the URL.

## Implementation order

1. Add server-authoritative attendance session challenge/verification/correction tables and APIs.
2. Add teacher material upload/status APIs and ingestion-ready schema.
3. Add adaptive profile and analytics projections.
4. Add durable x402 transition records, verification endpoint, and reconciliation hooks.
5. Expand project advisor and workspace UX.
6. Audit assignment/test/proctoring workflows and tighten legacy evaluation storage.
7. Run RLS/API/browser/accessibility/performance validation.

## Security invariants

- No client-generated role, attendance, grade, payment, entitlement, or project ownership fields are trusted.
- No private storage object is public.
- No AI request can retrieve across classroom boundaries.
- No payment is fulfilled from `payment=true`, a client callback, or a submitted-but-unconfirmed transaction.
- No AI score silently replaces a teacher score.
- No anomaly or proctoring signal automatically punishes a student.
- All high-risk mutations have an audit record and a bounded, user-visible failure state.
