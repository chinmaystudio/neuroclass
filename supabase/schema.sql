-- =========================================================
-- NEUROCLASS SUPABASE DATABASE SCHEMA
-- Features: Classrooms, Facecam biometric attendance, exam proctoring, x402 USDC payments
-- =========================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  displayName TEXT,
  photoURL TEXT,
  mobile_number TEXT,
  role TEXT DEFAULT 'teacher',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CLASSROOMS TABLE
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  subject TEXT DEFAULT 'Computer Science',
  user_id TEXT NOT NULL,
  students INTEGER DEFAULT 0,
  attendance TEXT DEFAULT '0%',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. STUDENTS ENROLLMENT (BIOMETRIC)
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id TEXT,
  name TEXT NOT NULL,
  roll_number TEXT,
  phone TEXT,
  email TEXT,
  face_samples JSONB DEFAULT '[]'::jsonb,
  -- 128-dimensional face-api descriptor used for local matching.
  -- Store the vector, never a raw camera frame, in the matching path.
  face_descriptor JSONB,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(classroom_id, email)
);

-- 4. TESTS & EXAMS TABLE
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT DEFAULT 'Computer Science',
  duration_mins INTEGER DEFAULT 45,
  total_marks INTEGER DEFAULT 50,
  questions JSONB DEFAULT '[]'::jsonb,
  proctoring_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TEST SUBMISSIONS & PROCTORING LOGS
CREATE TABLE IF NOT EXISTS public.test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  marks_obtained INTEGER DEFAULT 0,
  total_marks INTEGER DEFAULT 50,
  percentage INTEGER DEFAULT 0,
  grade TEXT DEFAULT 'A',
  feedback TEXT,
  answers JSONB DEFAULT '[]'::jsonb,
  proctoring_violations JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. EXAM ATTEMPTS & PROCTORING EVENTS
CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'flagged')),
  score NUMERIC,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  finished_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_test_id_idx ON public.attempts (test_id);
CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON public.attempts (student_id);
CREATE INDEX IF NOT EXISTS attempts_status_idx ON public.attempts (status);

-- 7. BIOMETRIC ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  session_id UUID,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT DEFAULT 'Present' CHECK (status IN ('Present', 'Late', 'Excused', 'Absent', 'Pending Review')),
  verified_method TEXT DEFAULT 'Teacher Face-ID Biometric',
  capture_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  marked_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  correction_version INTEGER NOT NULL DEFAULT 0,
  corrected_at TIMESTAMP WITH TIME ZONE,
  corrected_by TEXT,
  verification_attempt_id UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_student_idx
  ON public.attendance (session_id, student_id)
  WHERE session_id IS NOT NULL;

-- A session is opened by the classroom owner and is the only valid context for new attendance.
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  teacher_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Class attendance',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  nonce TEXT UNIQUE NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  challenge_token_hash TEXT,
  pin_hash TEXT,
  challenge_expires_at TIMESTAMP WITH TIME ZONE,
  challenge_rotated_at TIMESTAMP WITH TIME ZONE,
  verification_policy JSONB NOT NULL DEFAULT '{"pin":true,"teacher_face":true}'::jsonb
);
CREATE INDEX IF NOT EXISTS attendance_sessions_classroom_idx
  ON public.attendance_sessions (classroom_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_session_id_fkey') THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.attendance_sessions(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attendance_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  resolved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

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

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('Present', 'Late', 'Excused', 'Absent', 'Pending Review')),
  reason TEXT NOT NULL,
  corrected_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS attendance_corrections_attendance_idx
  ON public.attendance_corrections (attendance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.attendance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
  actor_user_id TEXT,
  actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS attendance_audit_events_classroom_idx
  ON public.attendance_audit_events (classroom_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_verification_attempt_id_fkey') THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_verification_attempt_id_fkey
      FOREIGN KEY (verification_attempt_id) REFERENCES public.attendance_verification_attempts(id);
  END IF;
END $$;

-- Classroom material index. Files live in a private storage bucket; extracted_text is server-written.
CREATE TABLE IF NOT EXISTS public.classroom_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  uploader_id TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extracted_text TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'ready', 'failed')),
  visibility TEXT NOT NULL DEFAULT 'classroom' CHECK (visibility IN ('classroom', 'teacher_private')),
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  page_count INTEGER,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  extraction_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS classroom_materials_classroom_idx
  ON public.classroom_materials (classroom_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.classroom_material_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES public.classroom_materials(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  token_count INTEGER,
  embedding JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(material_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS classroom_material_chunks_classroom_idx
  ON public.classroom_material_chunks (classroom_id, material_id, chunk_index);

CREATE TABLE IF NOT EXISTS public.learning_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  student_user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Classroom learning thread',
  learner_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_confidence TEXT CHECK (last_confidence IS NULL OR last_confidence IN ('high', 'medium', 'low')),
  last_source_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE IF NOT EXISTS public.learning_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.learning_threads(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
  answer_state TEXT NOT NULL DEFAULT 'grounded' CHECK (answer_state IN ('grounded', 'insufficient_context', 'error')),
  follow_up TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS learning_messages_thread_created_idx ON public.learning_messages (thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.learning_threads(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.learning_messages(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  student_user_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, student_user_id)
);
CREATE INDEX IF NOT EXISTS learning_feedback_classroom_idx ON public.learning_feedback (classroom_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_id UUID,
  payment_tx_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.x402_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  settlement_tx_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS x402_entitlement_subject_resource_idx
  ON public.x402_entitlements (resource_id, subject_id, settlement_tx_id);

-- 8. EVALUATIONS TABLE
CREATE TABLE IF NOT EXISTS public.evaluations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  studentName TEXT NOT NULL,
  rollNumber TEXT,
  subject TEXT,
  assessmentName TEXT,
  marksObtained NUMERIC,
  totalMarks NUMERIC,
  percentage NUMERIC,
  grade TEXT,
  feedback TEXT,
  strengths JSONB,
  weaknesses JSONB,
  improvementSuggestions JSONB,
  owner_user_id TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS evaluations_owner_date_idx ON public.evaluations (owner_user_id, date DESC);

-- 9. x402 PROTOCOL SETTLEMENT LEDGER
-- This table is intentionally server-managed. The backend uses SUPABASE_SERVICE_ROLE_KEY.
-- The legacy amount_algo column is retained for compatibility with any historical rows;
-- new payments use USDC ASA metadata and settlement_tx_id.
CREATE TABLE IF NOT EXISTS public.x402_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE NOT NULL,
  amount_algo NUMERIC CHECK (amount_algo IS NULL OR amount_algo > 0),
  service_name TEXT NOT NULL,
  payer_address TEXT,
  receiver_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'settled' CHECK (status IN ('settled', 'refund_pending', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  network TEXT,
  asset_id BIGINT,
  amount_usdc_micro BIGINT,
  settlement_tx_id TEXT,
  request_path TEXT,
  payment_response JSONB,
  owner_user_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'facilitator_verified' CHECK (verification_status IN ('facilitator_verified', 'chain_verified', 'pending', 'not_found', 'mismatch', 'verification_unavailable')),
  verified_at TIMESTAMP WITH TIME ZONE,
  confirmed_round BIGINT,
  verification_error TEXT,
  chain_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS x402_payments_created_at_idx ON public.x402_payments (created_at DESC);
CREATE INDEX IF NOT EXISTS x402_payments_payer_address_idx ON public.x402_payments (payer_address);
CREATE INDEX IF NOT EXISTS x402_payments_owner_user_id_idx ON public.x402_payments (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS x402_payments_verification_status_idx ON public.x402_payments (verification_status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS x402_payments_settlement_tx_id_idx
  ON public.x402_payments (settlement_tx_id)
  WHERE settlement_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS x402_payments_network_asset_idx
  ON public.x402_payments (network, asset_id);
CREATE INDEX IF NOT EXISTS x402_payments_request_path_idx
  ON public.x402_payments (request_path);

CREATE TABLE IF NOT EXISTS public.x402_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.x402_payments(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS x402_payment_events_payment_idx
  ON public.x402_payment_events (payment_id, occurred_at ASC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_ideas_payment_id_fkey'
  ) THEN
    ALTER TABLE public.project_ideas
      ADD CONSTRAINT project_ideas_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES public.x402_payments(id);
  END IF;
END $$;

-- RLS Row-Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_payment_events ENABLE ROW LEVEL SECURITY;

-- Existing public classroom discovery policies retained for the current app flow.
CREATE POLICY "Allow anonymous select users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select classrooms" ON public.classrooms FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert classrooms" ON public.classrooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert tests" ON public.tests FOR INSERT WITH CHECK (true);
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anonymous select evaluations" ON public.evaluations;
  DROP POLICY IF EXISTS "Allow anonymous insert evaluations" ON public.evaluations;
  DROP POLICY IF EXISTS "Users read own evaluations" ON public.evaluations;
  DROP POLICY IF EXISTS "Users insert own evaluations" ON public.evaluations;
  CREATE POLICY "Users read own evaluations" ON public.evaluations FOR SELECT TO authenticated USING (owner_user_id = auth.uid()::text);
  CREATE POLICY "Users insert own evaluations" ON public.evaluations FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid()::text);
END $$;

-- Attendance, attempts, and submissions are limited to the authenticated student or
-- the authenticated instructor who owns the relevant classroom. The service role bypasses RLS.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated classroom owners manage attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Attendance owners can read" ON public.attendance;
  DROP POLICY IF EXISTS "Classroom owners can insert attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Classroom owners can update attendance" ON public.attendance;

  CREATE POLICY "Attendance owners can read"
    ON public.attendance FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text)
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id::text = attendance.student_id AND s.user_id = auth.uid()::text)
    );

  CREATE POLICY "Classroom participants read material chunks"
    ON public.classroom_material_chunks FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.classroom_id = classroom_id AND s.user_id = auth.uid()::text)
    );

  CREATE POLICY "Classroom owners can insert attendance"
    ON public.attendance FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text)
      AND attendance.marked_by = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.attendance_sessions s
        WHERE s.id = attendance.session_id
          AND s.classroom_id = attendance.classroom_id
          AND s.teacher_id = auth.uid()::text
          AND s.status = 'open'
          AND (s.ends_at IS NULL OR s.ends_at > now())
      )
    );

  CREATE POLICY "Classroom owners can update attendance"
    ON public.attendance FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text))
    WITH CHECK (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text));

  DROP POLICY IF EXISTS "Classroom owners manage attendance sessions" ON public.attendance_sessions;
  CREATE POLICY "Classroom owners manage attendance sessions"
    ON public.attendance_sessions FOR ALL TO authenticated
    USING (teacher_id = auth.uid()::text AND EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text))
    WITH CHECK (teacher_id = auth.uid()::text AND EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

  DROP POLICY IF EXISTS "Students create their own attendance appeals" ON public.attendance_appeals;
  CREATE POLICY "Students create their own attendance appeals"
    ON public.attendance_appeals FOR INSERT TO authenticated
    WITH CHECK (student_id = auth.uid()::text);
  CREATE POLICY "Attendance appeal participants can read"
    ON public.attendance_appeals FOR SELECT TO authenticated
    USING (
      student_id = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
    );
  CREATE POLICY "Classroom owners resolve attendance appeals"
    ON public.attendance_appeals FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text))
    WITH CHECK (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

  CREATE POLICY "Attendance attempts participants can read"
    ON public.attendance_verification_attempts FOR SELECT TO authenticated
    USING (
      student_user_id = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
    );

  CREATE POLICY "Attendance corrections participants can read"
    ON public.attendance_corrections FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
      OR EXISTS (SELECT 1 FROM public.attendance a JOIN public.students s ON s.id::text = a.student_id WHERE a.id = attendance_id AND s.user_id = auth.uid()::text)
    );

  CREATE POLICY "Attendance audit classroom owners can read"
    ON public.attendance_audit_events FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

  CREATE POLICY "Students manage own learning feedback"
    ON public.learning_feedback FOR ALL TO authenticated
    USING (student_user_id = auth.uid()::text)
    WITH CHECK (student_user_id = auth.uid()::text);
  CREATE POLICY "Classroom owners read learning feedback"
    ON public.learning_feedback FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts'
      AND policyname = 'Authenticated users manage own or classroom attempts'
  ) THEN
    CREATE POLICY "Authenticated users manage own or classroom attempts"
      ON public.attempts FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.students s
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
          SELECT 1 FROM public.students s
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_submissions'
      AND policyname = 'Authenticated users manage permitted submissions'
  ) THEN
    CREATE POLICY "Authenticated users manage permitted submissions"
      ON public.test_submissions FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.students s
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
          SELECT 1 FROM public.students s
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

-- No anon/authenticated policies are created for the x402 ledger, entitlements, or
-- payment events. The server service role performs all payment operations and bypasses RLS.
DROP POLICY IF EXISTS "Allow anonymous select x402" ON public.x402_payments;
DROP POLICY IF EXISTS "Allow anonymous insert x402" ON public.x402_payments;
DROP POLICY IF EXISTS "Allow anonymous update x402" ON public.x402_payments;

-- The application is non-custodial. Legacy public.user_wallets is intentionally absent
-- and removed by supabase/migrations/20260813053600_remove_legacy_user_wallets.sql.
