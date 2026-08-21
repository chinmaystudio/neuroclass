-- NeuroClass production feature alignment
-- Safe additive migration for the existing Supabase project.
-- Legacy user_wallets secret cleanup is intentionally separate and requires explicit approval.

BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'flagged')),
  score NUMERIC,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  finished_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS attempts_test_id_idx ON public.attempts (test_id);
CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON public.attempts (student_id);
CREATE INDEX IF NOT EXISTS attempts_status_idx ON public.attempts (status);

ALTER TABLE public.x402_payments
  ADD COLUMN IF NOT EXISTS network TEXT,
  ADD COLUMN IF NOT EXISTS asset_id BIGINT,
  ADD COLUMN IF NOT EXISTS amount_usdc_micro BIGINT,
  ADD COLUMN IF NOT EXISTS settlement_tx_id TEXT,
  ADD COLUMN IF NOT EXISTS request_path TEXT,
  ADD COLUMN IF NOT EXISTS payment_response JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE UNIQUE INDEX IF NOT EXISTS x402_payments_settlement_tx_id_idx
  ON public.x402_payments (settlement_tx_id)
  WHERE settlement_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS x402_payments_network_asset_idx
  ON public.x402_payments (network, asset_id);
CREATE INDEX IF NOT EXISTS x402_payments_request_path_idx
  ON public.x402_payments (request_path);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_payments ENABLE ROW LEVEL SECURITY;

-- The payment ledger is server-managed. Remove the live project's legacy public policies.
DROP POLICY IF EXISTS "Allow anonymous insert x402" ON public.x402_payments;
DROP POLICY IF EXISTS "Allow anonymous select x402" ON public.x402_payments;
DROP POLICY IF EXISTS "Allow anonymous update x402" ON public.x402_payments;

-- Attendance is writable by an authenticated classroom owner and readable by the owner
-- or the enrolled student. The backend service role bypasses RLS for server operations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attendance'
      AND policyname = 'Authenticated classroom owners manage attendance'
  ) THEN
    CREATE POLICY "Authenticated classroom owners manage attendance"
      ON public.attendance FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.classrooms c
          WHERE c.id = attendance.classroom_id
            AND c.user_id = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id::text = attendance.student_id
            AND s.user_id = auth.uid()::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.classrooms c
          WHERE c.id = attendance.classroom_id
            AND c.user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- Students can submit attempts and view their own attempts; classroom owners can review them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts'
      AND policyname = 'Authenticated users manage own or classroom attempts'
  ) THEN
    CREATE POLICY "Authenticated users manage own or classroom attempts"
      ON public.attempts FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id::text = attempts.student_id
            AND s.user_id = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1
          FROM public.tests t
          JOIN public.classrooms c ON c.id = t.classroom_id
          WHERE t.id = attempts.test_id
            AND c.user_id = auth.uid()::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id::text = attempts.student_id
            AND s.user_id = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1
          FROM public.tests t
          JOIN public.classrooms c ON c.id = t.classroom_id
          WHERE t.id = attempts.test_id
            AND c.user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- Test submissions were missing policies in the live database. Limit them to the
-- enrolled student or the owning instructor.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_submissions'
      AND policyname = 'Authenticated users manage permitted submissions'
  ) THEN
    CREATE POLICY "Authenticated users manage permitted submissions"
      ON public.test_submissions FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id::text = test_submissions.student_id
            AND s.user_id = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1
          FROM public.tests t
          JOIN public.classrooms c ON c.id = t.classroom_id
          WHERE t.id = test_submissions.test_id
            AND c.user_id = auth.uid()::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id::text = test_submissions.student_id
            AND s.user_id = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1
          FROM public.tests t
          JOIN public.classrooms c ON c.id = t.classroom_id
          WHERE t.id = test_submissions.test_id
            AND c.user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

COMMIT;
