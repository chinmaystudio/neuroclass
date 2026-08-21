# NeuroClass Final Production Audit

**Audit date:** 13 August 2026

**Repository:** [aniketchougule1902/neuro-class](https://github.com/aniketchougule1902/neuro-class)

**Supabase project:** `hdjtgyvdlxwntfriqhff` (`ap-south-1`)

## Executive conclusion

NeuroClass now has the production database objects and application wiring required for the Facecam attendance, exam-proctoring, and Algorand Testnet x402 USDC use cases. The live database migration completed successfully, the obsolete custodial wallet table was removed with explicit approval, and the repository contains reproducible migrations for the final state. The x402 resource server returns a real HTTP `402 Payment Required` challenge with the configured USDC asset, amount, receiver, network, and facilitator-compatible requirements; paid responses are enriched with a settlement transaction ID and recorded in the server-only payment ledger.

The only remaining Supabase security-advisor warning is **Leaked Password Protection Disabled**, which must be enabled in the Supabase Auth dashboard. The x402 ledger has RLS enabled with no client policies by design: the backend service role is the only intended writer or reader. Supabase reports this as an informational `rls_enabled_no_policy` finding, but it does not expose the ledger to anonymous or authenticated client roles.[1] [2]

A complete paid settlement transaction was not executed during this audit because the sandbox does not have a Pera Wallet session or a funded Testnet USDC payer account. The unpaid challenge was exercised locally and returned HTTP 402 successfully. Before the live hackathon demo, the team should perform one real Pera Testnet payment and verify the returned transaction on the Algorand Testnet Explorer.

## Live Supabase table inventory

The final live inventory contains the following public tables. All listed tables have RLS enabled. Row counts are from the final Supabase table inspection and do not include secret values.

| Table | Rows | RLS | Production role |
|---|---:|---|---|
| `public.users` | 0 | Enabled | Application user profiles |
| `public.classrooms` | 1 | Enabled | Instructor classroom records |
| `public.tests` | 0 | Enabled | Test and exam definitions |
| `public.test_submissions` | 0 | Enabled | Student submissions and proctoring violations |
| `public.attendance` | 0 | Enabled | Face-verified attendance events |
| `public.evaluations` | 0 | Enabled | Evaluation records |
| `public.x402_payments` | 0 | Enabled | Server-only x402 settlement ledger |
| `public.students` | 0 | Enabled | Enrollment and biometric descriptors |
| `public.test_results` | 0 | Enabled | Legacy result table; no current repository references found |
| `public.attempts` | 0 | Enabled | Exam attempts and proctoring events |
| `public.user_wallets` | Removed | N/A | Legacy custodial table permanently dropped |

The live schema verification confirms `students.face_descriptor` is present as nullable `JSONB`; `attempts` contains the status, answers, violations, timestamps, and score fields used by exam proctoring; and `x402_payments` contains `network`, `asset_id`, `amount_usdc_micro`, `settlement_tx_id`, `request_path`, `payment_response`, and `updated_at`. The legacy `amount_algo` column remains only for historical compatibility and is now nullable so new USDC settlement rows do not require an obsolete ALGO value.

## Security status

The previously existing `public.user_wallets` table contained legacy custodial wallet fields, including stored mnemonic and secret-key columns. It was not referenced by the current application. Following explicit approval, the table was dropped from the live database and the repository now records the action in `20260813053600_remove_legacy_user_wallets.sql`. The previously supplied refund mnemonic must still be treated as compromised and replaced before any future refund signer is used.

The live policy audit confirms that `attendance`, `attempts`, and `test_submissions` each have one authenticated-role policy restricting access to the enrolled student or the instructor who owns the related classroom. `x402_payments` has no anon or authenticated policies, so it remains service-role-only. This is intentional and is consistent with Supabase’s RLS model for tables that should not be exposed through the browser client.[2]

The final Supabase security advisor reported two findings:

| Finding | Severity | Resolution |
|---|---|---|
| RLS enabled without client policies on `x402_payments` | Informational | Intentional. The payment ledger is server-managed through the service role and has no browser-facing policy. |
| Leaked Password Protection disabled | Warning | Remaining dashboard action. Enable Supabase Auth leaked-password protection before production use.[3] |

## Feature-to-database wiring

### Facecam biometric attendance

Student enrollment computes and stores a 128-dimensional face descriptor in `public.students.face_descriptor`. Classroom scanning performs local face matching and writes verified attendance records to `public.attendance`. The live database contains the descriptor column and an authenticated policy for attendance access. The application stores the matching descriptor rather than relying on a simulated attendance event.

### AI exam proctoring

The exam portal continuously detects the configured violation conditions and records the attempt state, answers, and violation data in `public.attempts`. Final submissions retain the detailed proctoring payload in `public.test_submissions.proctoring_violations`. The live database contains both tables, with an authenticated policy on each protected assessment table.

### x402 Algorand Testnet USDC payments

The paid routes are declared in `backend/services/x402Routes.ts` and served through the Hono resource server in `backend/services/x402AiApp.ts`. The implementation uses the exact AVM scheme, the full Algorand Testnet CAIP-2 network identifier, USDC ASA `10458941`, the configured receiver `HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A`, and pay-per-use prices of `100000` and `50000` micro-USDC for test and assignment generation respectively. The facilitator is `https://facilitator.goplausible.xyz`.[4]

The request contract is now:

1. An unpaid call receives HTTP 402 with `PAYMENT-REQUIRED`.
2. The browser client signs the exact AVM payment through Pera Wallet and retries with the standard x402 payment header.
3. The Hono resource server sends the signed payload to the facilitator for verification and settlement.
4. The AI handler runs only after successful settlement.
5. The response includes `PAYMENT-RESPONSE`, `X-402-Transaction-Id`, and a JSON `x402.transactionId` receipt.
6. The server records the decoded settlement in `public.x402_payments`, using the transaction ID as an idempotency key. Ledger failures are logged without converting a completed facilitator settlement into a failed business response.

The local smoke test confirmed the first step against a rebuilt production backend. It returned HTTP 402 and a challenge containing the expected exact scheme, Testnet network, USDC ASA, receiver, and `100000` micro-USDC price. The actual signed-and-settled step remains a required live-wallet demo check.

## Repository changes recorded

The final repository additions and updates are:

| Path | Purpose |
|---|---|
| `supabase/migrations/20260813053000_align_production_features.sql` | Adds biometric, attempt, x402 metadata, indexes, and protected-table policies. |
| `supabase/migrations/20260813053600_remove_legacy_user_wallets.sql` | Drops the obsolete custodial wallet table. |
| `supabase/migrations/20260813053700_make_legacy_algo_amount_nullable.sql` | Allows USDC ledger rows to omit the obsolete ALGO amount. |
| `supabase/schema.sql` | Synchronizes the repository schema with the live production design. |
| `backend/services/x402Routes.ts` | Persists verified settlement receipts and exposes transaction-proof response fields. |
| `backend/services/x402AiApp.ts` | Passes the original request into the settlement receipt adapter. |
| `docs/X402_SUBMISSION_ARCHITECTURE.md` | Documents the final receipt and settlement-ledger architecture. |

## Validation results

| Check | Result |
|---|---|
| Frontend TypeScript lint | Passed |
| Frontend Vite production build | Passed; Vite emitted only the existing large-chunk advisory |
| Backend TypeScript type-check | Passed |
| Backend Next.js production build | Passed with recorded exit code `0` |
| Local unpaid x402 endpoint smoke test | Passed; HTTP 402 challenge returned |
| Live Supabase alignment migration | Passed |
| Live legacy wallet-table removal | Passed |
| Final live schema inspection | Passed |
| Final security-advisor inspection | Passed with the two documented findings above |

## Final operational checklist

Before submission, enable Supabase Auth leaked-password protection, configure the backend’s real Supabase service-role variables in the deployment secret manager, replace the compromised refund mnemonic with a newly generated dedicated wallet if refunds are ever required, and perform one funded Pera Testnet payment against each paid endpoint. Capture each resulting Algorand transaction ID in the five-minute demo. Do not place any mnemonic in Git, browser-exposed variables, or database tables.

## References

[1]: https://supabase.com/docs/guides/database/database-linter "Supabase Database Linter"

[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"

[3]: https://supabase.com/docs/guides/auth/password-security "Supabase Auth Password Security and Leaked Password Protection"

[4]: https://facilitator.goplausible.xyz/ "GoPlausible x402 Facilitator"
