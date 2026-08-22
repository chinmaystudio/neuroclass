-- Restore the server-side verification ledger and the attendance metadata fields used by Face ID.
-- All statements are idempotent because the production database may already contain part of this repair.

CREATE TABLE IF NOT EXISTS public.attendance_verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  student_user_id TEXT NOT NULL,
  student_id TEXT,
  idempotency_key TEXT NOT NULL,
  challenge_digest TEXT,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected', 'replayed', 'expired', 'duplicate')),
  failure_reason TEXT,
  device_fingerprint TEXT,
  proximity_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  liveness_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(session_id, student_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS attendance_verification_attempts_session_idx
  ON public.attendance_verification_attempts (session_id, created_at DESC);

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS marked_by TEXT,
  ADD COLUMN IF NOT EXISTS capture_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS correction_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS corrected_by TEXT,
  ADD COLUMN IF NOT EXISTS verification_attempt_id UUID;

CREATE INDEX IF NOT EXISTS attendance_verification_attempt_idx
  ON public.attendance (verification_attempt_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_verification_attempt_id_fkey') THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_verification_attempt_id_fkey
      FOREIGN KEY (verification_attempt_id)
      REFERENCES public.attendance_verification_attempts(id)
      ON DELETE SET NULL;
  END IF;
END $$;
