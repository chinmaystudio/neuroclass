# NeuroClass MCP

Any Model Context Protocol-capable AI client can connect to NeuroClass with a personal access token and do what the token's owner can do in the app: nothing more, nothing less.

- **Endpoint:** `https://neuroclass-swart.vercel.app/api/mcp` (Vercel, bom1 region)
- **Transport:** Streamable HTTP (JSON-RPC 2.0, protocol version `2025-06-18`)
- **Auth:** `Authorization: Bearer nc_live_…` (token generated in the app)
- **UI:** account menu → **Connect AI (MCP)**, or `/teacher/integrations` and `/student/integrations`

## Shape of a token

`nc_live_` + 32 characters from `A–Z` and `2–9` (160 bits of entropy). The server stores only the SHA-256 hash, so the plaintext is shown to the owner once, at creation. A prefix like `nc_live_ABCDEFGH…` is kept for display.

## What it can do

Role-filtered automatically. `tools/list` returns only the tools the caller's account can use.

**Shared:**
- `whoami`
- `list_my_classrooms`

**Teacher tools:**
- `create_classroom`, `get_classroom`
- `list_tests`, `create_test` (optionally fill with `questions` and `publish: true`), `replace_test_questions`, `publish_test`, `change_test_status`
- `get_test_results`, `grade_attempt`, `release_test_results`
- `list_assignments`, `create_assignment` (optional `publish: true`), `change_assignment_status`, `list_assignment_submissions`, `grade_submission`

**Student tools:**
- `join_classroom` (with a class code)
- `list_my_tests`, `get_my_result`
- `list_my_assignments`, `get_my_submission`

## Security

- Tokens inherit their owner's role. A teacher token calling student tools is refused; a student token calling teacher tools is refused.
- Every tool call runs through the same service-layer checks and RLS policies as the website: cross-classroom access, release gating, grade caps and rate limits all still apply.
- Tokens are not JWTs; they carry no claims. Validation happens against `public.api_tokens` on each call (with a 1-minute per-process cache so revocation takes effect within a minute).
- The MCP endpoint is CORS-open because the Bearer token is required — a browser cannot invoke it from an unrelated site without one.

## Database

Migration `supabase/migrations/20261105000700_api_tokens.sql` adds:
- `public.api_tokens` — stores the hash, a display prefix, the owner, a created-at and optional expiry/revoked timestamps.
- RLS: the owner can select their own rows (excluding the hash) and delete them; writes happen only through the server using the service role.

## Clients tested

- **Claude Desktop** — `claude_desktop_config.json` with an `mcpServers.neuroclass` entry.
- **ChatGPT** (Team / Enterprise / Plus with Developer Mode) — custom MCP connector.
- **Cursor** — MCP configuration under Settings → MCP.
- Any other client that speaks Streamable HTTP MCP with Bearer auth. The Integrations page includes a `curl` example for ad-hoc testing.

## Deployment checklist

1. Apply `20261105000700_api_tokens.sql` (Supabase SQL editor or CLI). Additive; no destructive statements.
2. The route `/api/mcp` is handled by `backend/app/api/mcp/route.ts` and deploys automatically with the rest of the backend.
3. No new environment variables are required.
