ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Class attendance',
  ADD COLUMN IF NOT EXISTS nonce TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS challenge_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS challenge_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS challenge_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_policy JSONB NOT NULL DEFAULT '{"pin":true,"teacher_face":true,"liveness":false}'::jsonb;

UPDATE public.attendance_sessions
SET nonce = md5(id::text || clock_timestamp()::text)
WHERE nonce IS NULL;

ALTER TABLE public.attendance_sessions
  ALTER COLUMN nonce SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_nonce_key
  ON public.attendance_sessions (nonce);

CREATE INDEX IF NOT EXISTS attendance_sessions_classroom_idx
  ON public.attendance_sessions (classroom_id, created_at DESC);
