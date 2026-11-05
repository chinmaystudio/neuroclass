-- =====================================================================
-- Personal access tokens: the credential AI clients (Claude, ChatGPT and
-- others) present to the NeuroClass MCP endpoint. Only the SHA-256 hash is
-- stored; the plaintext is shown to the owner once, at creation. A short
-- prefix (nc_live_abc12345) is kept for display.
-- Tokens inherit the owner's role; nothing a token holder can do is more
-- than that owner can do through the website (RLS + server-side checks).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nc_api_tokens_user_idx
  ON public.api_tokens (user_id, created_at DESC);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_tokens FROM PUBLIC;
DO $$ BEGIN
  -- The server (service role) handles every write with a token hash; the
  -- authenticated role can list and revoke its own, but never see hashes.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.api_tokens FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.api_tokens FROM authenticated;
    GRANT SELECT (id, user_id, name, token_prefix, last_used_at, expires_at, revoked_at, created_at) ON public.api_tokens TO authenticated;
    GRANT DELETE ON public.api_tokens TO authenticated;
  END IF;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "nc api tokens read own" ON public.api_tokens;
  DROP POLICY IF EXISTS "nc api tokens delete own" ON public.api_tokens;
  CREATE POLICY "nc api tokens read own" ON public.api_tokens FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
  CREATE POLICY "nc api tokens delete own" ON public.api_tokens FOR DELETE TO authenticated USING (user_id = auth.uid()::text);
END $$;
