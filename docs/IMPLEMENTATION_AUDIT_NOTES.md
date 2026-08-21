# NeuroClass Implementation Audit Notes

## Baseline
- Root TypeScript check and Vite production build pass.
- Backend TypeScript check and Next production build pass with missing Supabase credentials warning.
- Frontend is a Vite React app with a separate Next/Hono backend.

## Findings and resolution status

| Finding | Status |
|---|---|
| `SessionGuardian` allowed access while role was unresolved and role state was client-controlled | Resolved: server-backed role resolution and pending-state denial are implemented. |
| `authService.getUserRole` trusted localStorage before the database | Resolved: localStorage is no longer a source of authority. |
| Students could write attendance directly after local face matching | Resolved: student check-in controls were removed; teacher-issued sessions, teacher identity, expiry, session binding, and duplicate-safe inserts are implemented. |
| Teacher attendance used a hardcoded demo classroom | Resolved: attendance is mounted in the selected teacher-owned classroom. |
| Teacher classroom detail lacked an attendance control surface | Resolved: session controls and the teacher face-scan console are exposed in classroom detail. |
| x402 UI used inconsistent ALGO/USDC messaging and had no visible receipt workflow | Resolved: USDC labels, payment-stage timeline, persisted ledger, receipt hash, and explorer verification links are implemented. |
| x402 response enrichment lacked a canonical explorer URL | Resolved: settlement responses include `explorerUrl`, service metadata, and `X-402-Transaction-Id`. |
| The live classroom AI modal used coarse status and ignored settlement receipts | Resolved: it now uses the shared payment timeline and receipt parser. |
| Schema lacked classroom materials, learning threads, project ideas, attendance sessions, and payment events | Resolved: canonical schema and idempotent migration include the new model. |
| AI had no classroom-scoped retrieval path | Resolved: authenticated enrollment-scoped material retrieval and source-grounded answer route are implemented. |

## Remaining production caveats

- Face matching is teacher-operated, but a dedicated liveness/anti-spoof model is still required for high-stakes attendance.
- Classroom material extraction/embedding ingestion is represented by the schema and retrieval boundary; a background extraction worker must populate `extracted_text` for uploaded PDFs and files.
- The Vite production build still reports a large existing AI/face-analysis chunk and should be code-split before high-traffic deployment.
- A real staging payment must be run with the configured facilitator, treasury, ASA, and Supabase service role before launch.
