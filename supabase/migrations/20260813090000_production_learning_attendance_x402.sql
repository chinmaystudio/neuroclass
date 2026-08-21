-- NeuroClass production hardening: attendance authority, learning context, and x402 observability

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS capture_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS marked_by TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.attendance
  ALTER COLUMN classroom_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_student_idx
  ON public.attendance (session_id, student_id)
  WHERE session_id IS NOT NULL;

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
  closed_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.classroom_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  uploader_id TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extracted_text TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'ready', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS classroom_materials_classroom_idx
  ON public.classroom_materials (classroom_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.learning_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
  student_user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Classroom learning thread',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.learning_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.learning_threads(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
ALTER TABLE public.project_ideas ADD COLUMN IF NOT EXISTS payment_tx_id TEXT;

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

CREATE TABLE IF NOT EXISTS public.x402_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.x402_payments(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS x402_payment_events_payment_idx
  ON public.x402_payment_events (payment_id, occurred_at ASC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated classroom owners manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Attendance owners can read" ON public.attendance;
DROP POLICY IF EXISTS "Classroom owners can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Classroom owners can update attendance" ON public.attendance;

CREATE POLICY "Attendance owners can read" ON public.attendance FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id::text = attendance.student_id AND s.user_id = auth.uid()::text)
);
CREATE POLICY "Classroom owners can insert attendance" ON public.attendance FOR INSERT TO authenticated
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
CREATE POLICY "Classroom owners can update attendance" ON public.attendance FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text))
WITH CHECK (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = attendance.classroom_id AND c.user_id = auth.uid()::text));

DROP POLICY IF EXISTS "Classroom owners manage attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Classroom owners manage attendance sessions" ON public.attendance_sessions FOR ALL TO authenticated
USING (teacher_id = auth.uid()::text AND EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text))
WITH CHECK (teacher_id = auth.uid()::text AND EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

DROP POLICY IF EXISTS "Students create their own attendance appeals" ON public.attendance_appeals;
CREATE POLICY "Students create their own attendance appeals" ON public.attendance_appeals FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid()::text);
CREATE POLICY "Attendance appeal participants can read" ON public.attendance_appeals FOR SELECT TO authenticated
USING (student_id = auth.uid()::text OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));
CREATE POLICY "Classroom owners resolve attendance appeals" ON public.attendance_appeals FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text))
WITH CHECK (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

CREATE POLICY "Attendance attempts participants can read" ON public.attendance_verification_attempts FOR SELECT TO authenticated
USING (student_user_id = auth.uid()::text OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));
CREATE POLICY "Attendance corrections participants can read" ON public.attendance_corrections FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.attendance a JOIN public.students s ON s.id::text = a.student_id WHERE a.id = attendance_id AND s.user_id = auth.uid()::text)
);
CREATE POLICY "Attendance audit classroom owners can read" ON public.attendance_audit_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

DROP POLICY IF EXISTS "Students manage own project ideas" ON public.project_ideas;
CREATE POLICY "Students manage own project ideas" ON public.project_ideas FOR ALL TO authenticated
USING (student_user_id = auth.uid()::text) WITH CHECK (student_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Students manage own learning threads" ON public.learning_threads;
CREATE POLICY "Students manage own learning threads" ON public.learning_threads FOR ALL TO authenticated
USING (student_user_id = auth.uid()::text) WITH CHECK (student_user_id = auth.uid()::text);
CREATE POLICY "Students read learning messages" ON public.learning_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.learning_threads t WHERE t.id = thread_id AND t.student_user_id = auth.uid()::text));

-- Material rows are readable by enrolled students and owned teachers; writes happen through the backend.
CREATE POLICY "Classroom participants read materials" ON public.classroom_materials FOR SELECT TO authenticated
USING (
  uploader_id = auth.uid()::text
  OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.classroom_id = classroom_id AND s.user_id = auth.uid()::text)
);

-- The x402 ledger and event stream remain server-managed through the service role.
DROP POLICY IF EXISTS "Allow anonymous select x402 events" ON public.x402_payment_events;


-- Attendance verification hardening: server-issued challenges, replay-safe attempts, and append-only corrections.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS correction_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS corrected_by TEXT,
  ADD COLUMN IF NOT EXISTS verification_attempt_id UUID;

ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS challenge_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS challenge_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS challenge_rotated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_policy JSONB NOT NULL DEFAULT '{"pin":true,"teacher_face":true}'::jsonb;

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


-- Classroom material ingestion and retrieval metadata.
ALTER TABLE public.classroom_materials
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'classroom',
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classroom_materials_extraction_status_check') THEN
    ALTER TABLE public.classroom_materials DROP CONSTRAINT classroom_materials_extraction_status_check;
  END IF;
  ALTER TABLE public.classroom_materials ADD CONSTRAINT classroom_materials_extraction_status_check CHECK (extraction_status IN ('pending', 'processing', 'ready', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
ALTER TABLE public.classroom_material_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classroom participants read material chunks" ON public.classroom_material_chunks FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.classroom_id = classroom_id AND s.user_id = auth.uid()::text)
);


-- Adaptive tutor personalization, confidence, and feedback.
ALTER TABLE public.learning_threads
  ADD COLUMN IF NOT EXISTS learner_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_confidence TEXT,
  ADD COLUMN IF NOT EXISTS last_source_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.learning_messages
  ADD COLUMN IF NOT EXISTS confidence TEXT,
  ADD COLUMN IF NOT EXISTS answer_state TEXT NOT NULL DEFAULT 'grounded',
  ADD COLUMN IF NOT EXISTS follow_up TEXT;

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
ALTER TABLE public.learning_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own learning feedback" ON public.learning_feedback FOR ALL TO authenticated
USING (student_user_id = auth.uid()::text)
WITH CHECK (student_user_id = auth.uid()::text);
CREATE POLICY "Classroom owners read learning feedback" ON public.learning_feedback FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text));

-- x402 payment ownership and Algorand chain-verification evidence.
ALTER TABLE public.x402_payments ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE public.x402_payments ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'facilitator_verified';
ALTER TABLE public.x402_payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.x402_payments ADD COLUMN IF NOT EXISTS confirmed_round BIGINT;
ALTER TABLE public.x402_payments ADD COLUMN IF NOT EXISTS verification_error TEXT;
ALTER TABLE public.x402_payments ADD COLUMN IF NOT EXISTS chain_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'x402_payments_verification_status_check') THEN
    ALTER TABLE public.x402_payments
      ADD CONSTRAINT x402_payments_verification_status_check
      CHECK (verification_status IN ('facilitator_verified', 'chain_verified', 'pending', 'not_found', 'mismatch', 'verification_unavailable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS x402_payments_owner_user_id_idx ON public.x402_payments (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS x402_payments_verification_status_idx ON public.x402_payments (verification_status, updated_at DESC);

-- Evaluation ownership hardening: authenticated users may only read and create their own grading history.
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
UPDATE public.evaluations SET owner_user_id = COALESCE(owner_user_id, 'legacy-unassigned');
ALTER TABLE public.evaluations ALTER COLUMN owner_user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS evaluations_owner_date_idx ON public.evaluations (owner_user_id, date DESC);
DROP POLICY IF EXISTS "Allow anonymous select evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow anonymous insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users read own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users insert own evaluations" ON public.evaluations;
CREATE POLICY "Users read own evaluations" ON public.evaluations FOR SELECT TO authenticated USING (owner_user_id = auth.uid()::text);
CREATE POLICY "Users insert own evaluations" ON public.evaluations FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid()::text);
