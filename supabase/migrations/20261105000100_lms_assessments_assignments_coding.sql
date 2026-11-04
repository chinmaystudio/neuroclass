-- =====================================================================
-- NeuroClass consolidated LMS: classroom tests, proctoring, coding, assignments
-- =====================================================================
-- Safe to run more than once. Existing rows in public.tests / public.attempts
-- are preserved and extended; nothing is dropped. Answer keys move to a
-- server-only table and the anonymous read policy that leaked them is removed.
-- Rollback: see supabase/rollback/20261105000100_down.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so RLS policies can call them
-- without recursive policy evaluation). They only return booleans.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nc_is_classroom_owner(p_classroom uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom AND c.user_id = auth.uid()::text
  );
$$;

CREATE OR REPLACE FUNCTION public.nc_is_classroom_member(p_classroom uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.classroom_id = p_classroom
      AND (s.user_id = auth.uid()::text
           OR (s.email IS NOT NULL AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  );
$$;

REVOKE ALL ON FUNCTION public.nc_is_classroom_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nc_is_classroom_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nc_is_classroom_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nc_is_classroom_member(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 1. TESTS (extend legacy table)
-- ---------------------------------------------------------------------
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS passing_marks NUMERIC;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS security JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS results_released BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS exam_mode TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS legacy_source TEXT;

-- Marks can be fractional (negative marking, partial coding credit).
ALTER TABLE public.tests ALTER COLUMN total_marks TYPE NUMERIC USING total_marks::numeric;

-- Legacy rows had no lifecycle: they were visible as soon as they were inserted.
-- Preserve that behaviour by treating them as published.
UPDATE public.tests SET status = 'published' WHERE status IS NULL OR status IN ('live', 'scheduled', 'active');

UPDATE public.tests SET status = 'closed' WHERE status = 'completed';
UPDATE public.tests SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL;
UPDATE public.tests t SET created_by = c.user_id FROM public.classrooms c WHERE t.created_by IS NULL AND c.id = t.classroom_id;
ALTER TABLE public.tests ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.tests ALTER COLUMN status SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_status_check;
  ALTER TABLE public.tests ADD CONSTRAINT tests_status_check CHECK (status IN ('draft', 'published', 'closed', 'archived'));
  ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_exam_mode_check;
  ALTER TABLE public.tests ADD CONSTRAINT tests_exam_mode_check CHECK (exam_mode IN ('standard', 'coding'));
  ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_schedule_check;
  ALTER TABLE public.tests ADD CONSTRAINT tests_schedule_check CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end > scheduled_start);
END $$;

CREATE INDEX IF NOT EXISTS nc_tests_classroom_status_idx ON public.tests (classroom_id, status, created_at DESC);

-- ---------------------------------------------------------------------
-- 2. TEST QUESTIONS (server-only answer keys)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'multiple_select', 'true_false', 'short_answer', 'long_answer', 'numerical', 'fill_blank', 'coding', 'file_upload')),
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 20000),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{id, text}] — never contains correctness
  answer_key JSONB NOT NULL DEFAULT '{}'::jsonb,       -- server-only
  marks NUMERIC NOT NULL DEFAULT 1 CHECK (marks >= 0 AND marks <= 1000),
  negative_marks NUMERIC NOT NULL DEFAULT 0 CHECK (negative_marks >= 0 AND negative_marks <= 1000),
  explanation TEXT,
  coding JSONB,                                         -- {languages, starterCode, timeLimitMs, memoryLimitMb}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS nc_test_questions_test_idx ON public.test_questions (test_id, position);

-- The earlier 'ADD COLUMN status DEFAULT draft' silently marked every pre-existing
-- legacy test as draft, although students could still see them. Restore their
-- visibility once (guarded by a marker so teacher changes are never overwritten).
UPDATE public.tests
   SET status = 'published', config = coalesce(config, '{}'::jsonb) || '{"ncLegacyVisibilityRestored": true}'::jsonb
 WHERE status = 'draft'
   AND published_at IS NULL
   AND legacy_source IS NULL
   AND jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) > 0
   AND NOT (coalesce(config, '{}'::jsonb) ? 'ncLegacyVisibilityRestored')
   AND NOT EXISTS (SELECT 1 FROM public.test_questions q WHERE q.test_id = tests.id);

-- ---------------------------------------------------------------------
-- 3. ASSIGNMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 250),
  description TEXT,
  instructions TEXT,
  assignment_type TEXT NOT NULL DEFAULT 'text' CHECK (assignment_type IN ('text', 'file', 'document', 'coding', 'mixed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  available_from TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  total_marks NUMERIC NOT NULL DEFAULT 100 CHECK (total_marks >= 0 AND total_marks <= 10000),
  late_policy JSONB NOT NULL DEFAULT '{"allowLate": false, "penaltyPercentPerDay": 0, "maxLateDays": 0}'::jsonb,
  accepted_file_types TEXT[] NOT NULL DEFAULT ARRAY['pdf','docx','txt','png','jpg','zip']::text[],
  max_file_size_mb INTEGER NOT NULL DEFAULT 10 CHECK (max_file_size_mb BETWEEN 1 AND 50),
  max_files INTEGER NOT NULL DEFAULT 5 CHECK (max_files BETWEEN 0 AND 20),
  allow_resubmission BOOLEAN NOT NULL DEFAULT true,
  coding JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS nc_assignments_classroom_idx ON public.assignments (classroom_id, status, due_at);

CREATE TABLE IF NOT EXISTS public.assignment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_assignment_attachments_assignment_idx ON public.assignment_attachments (assignment_id);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL,
  student_record_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'late', 'evaluated', 'returned')),
  text_response TEXT,
  code JSONB,
  submitted_at TIMESTAMPTZ,
  is_late BOOLEAN NOT NULL DEFAULT false,
  late_days INTEGER NOT NULL DEFAULT 0,
  score NUMERIC,
  penalty_percent NUMERIC NOT NULL DEFAULT 0,
  final_score NUMERIC,
  feedback TEXT,
  evaluated_by TEXT,
  evaluated_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_user_id)
);
CREATE INDEX IF NOT EXISTS nc_assignment_submissions_assignment_idx ON public.assignment_submissions (assignment_id, status);
CREATE INDEX IF NOT EXISTS nc_assignment_submissions_student_idx ON public.assignment_submissions (student_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.assignment_submission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_assignment_submission_files_submission_idx ON public.assignment_submission_files (submission_id);

CREATE TABLE IF NOT EXISTS public.assignment_submission_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_assignment_submission_history_idx ON public.assignment_submission_history (submission_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. CODING TEST CASES, WORKSPACES, EXECUTION JOBS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coding_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.test_questions(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  input TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  is_hidden BOOLEAN NOT NULL DEFAULT true,
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((question_id IS NULL) <> (assignment_id IS NULL)),
  CHECK (char_length(input) <= 65536 AND char_length(expected_output) <= 65536)
);
CREATE INDEX IF NOT EXISTS nc_coding_test_cases_question_idx ON public.coding_test_cases (question_id, position);
CREATE INDEX IF NOT EXISTS nc_coding_test_cases_assignment_idx ON public.coding_test_cases (assignment_id, position);

CREATE TABLE IF NOT EXISTS public.coding_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('test_attempt', 'assignment')),
  context_id UUID NOT NULL,
  question_id UUID,
  language TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '' CHECK (char_length(source) <= 200000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS nc_coding_workspaces_unique_idx
  ON public.coding_workspaces (owner_user_id, context_type, context_id, coalesce(question_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.code_execution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  context_id UUID NOT NULL,
  question_id UUID,
  language TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('run', 'evaluate')),
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  exit_code INTEGER,
  time_ms INTEGER,
  memory_kb INTEGER,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_code_execution_jobs_user_idx ON public.code_execution_jobs (user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. ATTEMPTS (extend legacy table) + ANSWERS
-- ---------------------------------------------------------------------
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS student_record_id UUID REFERENCES public.students(id) ON DELETE SET NULL;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS question_order JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS option_order JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS max_score NUMERIC;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS percentage NUMERIC;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS evaluated_by TEXT;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS submission_source TEXT;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS identity_checks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS integrity_score NUMERIC;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS proctoring_baseline JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS proctoring_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS camera_status TEXT;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

UPDATE public.attempts a SET classroom_id = t.classroom_id FROM public.tests t WHERE a.classroom_id IS NULL AND t.id = a.test_id;

DO $$ BEGIN
  ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_status_check;
  ALTER TABLE public.attempts ADD CONSTRAINT attempts_status_check
    CHECK (status IN ('calibrating', 'in_progress', 'submitted', 'auto_submitted', 'evaluated', 'abandoned', 'flagged', 'expired'));
  ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_identity_status_check;
  ALTER TABLE public.attempts ADD CONSTRAINT attempts_identity_status_check
    CHECK (identity_status IN ('not_required', 'pending', 'verified', 'failed', 'manual_review'));
END $$;

-- Close duplicate open attempts left by earlier race conditions (keep the newest)
-- so the uniqueness guarantee below can be created safely.
UPDATE public.attempts a SET status = 'abandoned', finished_at = coalesce(a.finished_at, now())
 WHERE a.status IN ('calibrating', 'in_progress')
   AND EXISTS (SELECT 1 FROM public.attempts b
                WHERE b.test_id = a.test_id AND b.student_id = a.student_id
                  AND b.status IN ('calibrating', 'in_progress')
                  AND (b.started_at, b.id) > (a.started_at, a.id));

-- One open attempt per student per test, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS nc_attempts_one_open_per_student_idx
  ON public.attempts (test_id, student_id) WHERE status IN ('calibrating', 'in_progress');
CREATE INDEX IF NOT EXISTS nc_attempts_test_status_idx ON public.attempts (test_id, status);
CREATE INDEX IF NOT EXISTS nc_attempts_student_idx ON public.attempts (student_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  response JSONB,
  marked_for_review BOOLEAN NOT NULL DEFAULT false,
  auto_score NUMERIC,
  manual_score NUMERIC,
  awarded_marks NUMERIC,
  needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  feedback TEXT,
  evaluation JSONB,
  revision INTEGER NOT NULL DEFAULT 0,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS nc_attempt_answers_attempt_idx ON public.attempt_answers (attempt_id);

-- ---------------------------------------------------------------------
-- 6. PROCTORING EVENTS + APPEALS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proctoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('browser', 'vision', 'identity', 'service', 'environment')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source TEXT NOT NULL CHECK (source IN ('browser', 'ml_service', 'face_service', 'server')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  bbox JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'dismissed', 'concern')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT
);
CREATE INDEX IF NOT EXISTS nc_proctoring_events_attempt_idx ON public.proctoring_events (attempt_id, occurred_at);
CREATE INDEX IF NOT EXISTS nc_proctoring_events_test_idx ON public.proctoring_events (test_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.assessment_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 4000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_assessment_appeals_attempt_idx ON public.assessment_appeals (attempt_id);

-- ---------------------------------------------------------------------
-- 7. AUDIT LOG
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  classroom_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_assessment_audit_logs_entity_idx ON public.assessment_audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nc_assessment_audit_logs_classroom_idx ON public.assessment_audit_logs (classroom_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- The Vercel API uses the service role and enforces authorization in code.
-- These policies are defence in depth for any direct client access.
-- ---------------------------------------------------------------------
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_execution_jobs ENABLE ROW LEVEL SECURITY;

-- Answer keys, hidden test cases, answers and audit logs: no client policy at all
-- (deny-by-default). Only the server (service role) can read them.

DO $$ BEGIN
  -- Remove the legacy policies that exposed every test (including answer keys) to anyone.
  DROP POLICY IF EXISTS "Allow anonymous select tests" ON public.tests;
  DROP POLICY IF EXISTS "Allow anonymous insert tests" ON public.tests;
  DROP POLICY IF EXISTS "nc tests owner manage" ON public.tests;
  DROP POLICY IF EXISTS "nc tests member read published" ON public.tests;
  CREATE POLICY "nc tests owner manage" ON public.tests FOR ALL TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id))
    WITH CHECK (public.nc_is_classroom_owner(classroom_id));
  CREATE POLICY "nc tests member read published" ON public.tests FOR SELECT TO authenticated
    USING (status = 'published' AND public.nc_is_classroom_member(classroom_id));

  DROP POLICY IF EXISTS "nc attempts student read own" ON public.attempts;
  DROP POLICY IF EXISTS "nc attempts owner read" ON public.attempts;
  CREATE POLICY "nc attempts student read own" ON public.attempts FOR SELECT TO authenticated
    USING (student_id = auth.uid()::text);
  CREATE POLICY "nc attempts owner read" ON public.attempts FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));

  DROP POLICY IF EXISTS "nc proctoring owner read" ON public.proctoring_events;
  CREATE POLICY "nc proctoring owner read" ON public.proctoring_events FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));

  DROP POLICY IF EXISTS "nc assignments owner manage" ON public.assignments;
  DROP POLICY IF EXISTS "nc assignments member read" ON public.assignments;
  CREATE POLICY "nc assignments owner manage" ON public.assignments FOR ALL TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id))
    WITH CHECK (public.nc_is_classroom_owner(classroom_id));
  CREATE POLICY "nc assignments member read" ON public.assignments FOR SELECT TO authenticated
    USING (status IN ('published', 'closed') AND public.nc_is_classroom_member(classroom_id));

  DROP POLICY IF EXISTS "nc submissions student read own" ON public.assignment_submissions;
  DROP POLICY IF EXISTS "nc submissions owner read" ON public.assignment_submissions;
  CREATE POLICY "nc submissions student read own" ON public.assignment_submissions FOR SELECT TO authenticated
    USING (student_user_id = auth.uid()::text);
  CREATE POLICY "nc submissions owner read" ON public.assignment_submissions FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));

  DROP POLICY IF EXISTS "nc workspaces owner read" ON public.coding_workspaces;
  CREATE POLICY "nc workspaces owner read" ON public.coding_workspaces FOR SELECT TO authenticated
    USING (owner_user_id = auth.uid()::text);
END $$;

-- The legacy questions JSONB column embedded correct answers. Hide it from
-- client roles entirely; the API serves sanitized questions instead.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tests'
     AND column_name NOT IN ('questions', 'test_data');
  EXECUTE 'REVOKE SELECT ON public.tests FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.tests TO authenticated', cols);
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.tests FROM anon;

-- ---------------------------------------------------------------------
-- 9. PRIVATE STORAGE BUCKET for assignment files (server-mediated access only)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('assignment-files', 'assignment-files', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false;
