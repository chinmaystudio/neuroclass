-- =====================================================================
-- Production data-access hardening, from an audit of the live project on
-- 2026-11-05. Findings fixed here (all were exploitable with the public key):
--   * 15 tables had RLS disabled (all tc_* portal tables incl. answer keys and
--     users; attendance_verification_attempts).
--   * students: anonymous SELECT/INSERT/UPDATE USING (true).
--   * face_embeddings / face_profiles / classroom_materials / chunks: policies
--     compared s.classroom_id = s.classroom_id, so any enrolled student could
--     read every classroom's biometric embeddings and materials.
--   * evaluations: anonymous select/insert; attendance: students could insert
--     their own attendance rows directly, bypassing face verification.
--   * attempts: students could UPDATE their own attempt (score) and read
--     scores before release; legacy FOR ALL policies on tests/test_submissions.
-- Also: profiles backfilled for existing accounts, join-by-code moved to an
-- RPC, durable rate limits, attendance appeals table, evaluation columns the
-- app writes but that never existed.
-- Idempotent. Nothing is dropped except policies; no rows are deleted.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Durable rate limits (callable only by the server / SECURITY DEFINER code)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nc_rate_limits (
  bucket text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_start)
);
ALTER TABLE public.nc_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.nc_rate_limit_hit(p_bucket text, p_subject text, p_window_seconds integer, p_max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w timestamptz;
  n integer;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_max IS NULL OR p_max < 1 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;
  w := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.nc_rate_limits AS r (bucket, subject, window_start, hits)
  VALUES (left(p_bucket, 64), left(coalesce(p_subject, ''), 128), w, 1)
  ON CONFLICT (bucket, subject, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO n;
  IF random() < 0.01 THEN
    DELETE FROM public.nc_rate_limits WHERE window_start < now() - interval '2 days';
  END IF;
  RETURN n <= p_max;
END;
$$;

-- Membership: an email-only roster row counts only while it is not linked to
-- a different account (mirrors backend/modules/core/access.ts).
CREATE OR REPLACE FUNCTION public.nc_is_classroom_member(p_classroom uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.classroom_id = p_classroom
      AND (s.user_id = auth.uid()::text
           OR (s.user_id IS NULL AND s.email IS NOT NULL
               AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  );
$$;

-- ---------------------------------------------------------------------
-- 1. Every public table has RLS; the retired portal's tables and server-only
--    tables are not reachable with client keys at all.
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    -- Nothing in the app reads the database without signing in.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
    IF r.relname LIKE 'tc\_%' OR r.relname IN ('attendance_verification_attempts', 'nc_rate_limits', 'face_embeddings',
                                                'google_drive_connections', 'x402_payments', 'x402_payment_attempts',
                                                'x402_entitlements', 'x402_refund_cases') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', r.relname);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ---------------------------------------------------------------------
-- 2. User profiles. The app's profile upsert never worked (it wrote
--    displayName/photoURL; the columns are displayname/photourl), so
--    public.users is empty. Backfill from auth.users, then only the trigger
--    (0300) creates profiles. Users may edit name/photo/phone, never role/email.
-- ---------------------------------------------------------------------
INSERT INTO public.users (uid, email, displayname, role, mobile_number)
SELECT a.id::text,
       coalesce(a.email, ''),
       nullif(left(coalesce(a.raw_user_meta_data ->> 'full_name', a.raw_user_meta_data ->> 'name', ''), 200), ''),
       CASE
         WHEN lower(a.raw_user_meta_data ->> 'role') IN ('teacher', 'student') THEN lower(a.raw_user_meta_data ->> 'role')
         WHEN EXISTS (SELECT 1 FROM public.classrooms c WHERE c.user_id = a.id::text) THEN 'teacher'
         ELSE 'student'
       END,
       nullif(left(coalesce(a.raw_user_meta_data ->> 'phone', ''), 32), '')
  FROM auth.users a
ON CONFLICT (uid) DO NOTHING;

DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'student', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

REVOKE INSERT, UPDATE, DELETE ON public.users FROM authenticated;
GRANT UPDATE (displayname, photourl, mobile_number) ON public.users TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Classrooms: owners manage their own; members read theirs; joining by
--    code goes through nc_join_classroom (no table-wide read any more).
-- ---------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous select classrooms" ON public.classrooms;
  DROP POLICY IF EXISTS "Allow anonymous insert classrooms" ON public.classrooms;
  DROP POLICY IF EXISTS "nc classrooms authenticated read" ON public.classrooms;
  DROP POLICY IF EXISTS "nc classrooms owner insert" ON public.classrooms;
  DROP POLICY IF EXISTS "nc classrooms owner all" ON public.classrooms;
  DROP POLICY IF EXISTS "nc classrooms member read" ON public.classrooms;
  CREATE POLICY "nc classrooms owner all" ON public.classrooms FOR ALL TO authenticated
    USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
  CREATE POLICY "nc classrooms member read" ON public.classrooms FOR SELECT TO authenticated
    USING (public.nc_is_classroom_member(id));
END $$;

CREATE OR REPLACE FUNCTION public.nc_join_classroom(p_code text, p_name text, p_roll_number text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS TABLE (classroom_id uuid, classroom_name text, student_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text := btrim(coalesce(p_name, ''));
  v_class record;
  v_student uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a classroom.' USING ERRCODE = '28000';
  END IF;
  IF NOT public.nc_rate_limit_hit('join_classroom', v_uid, 3600, 30) THEN
    RAISE EXCEPTION 'Too many join attempts. Please try again in an hour.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Enter your full name (2-120 characters).' USING ERRCODE = '22023';
  END IF;

  SELECT c.id, c.name, c.user_id INTO v_class
    FROM public.classrooms c
   WHERE c.code = upper(btrim(coalesce(p_code, '')));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Classroom not found. Please verify the 6-character code.' USING ERRCODE = 'P0002';
  END IF;
  IF v_class.user_id = v_uid THEN
    RAISE EXCEPTION 'You teach this classroom, so you cannot join it as a student.' USING ERRCODE = '22023';
  END IF;

  SELECT s.id INTO v_student
    FROM public.students s
   WHERE s.classroom_id = v_class.id
     AND (s.user_id = v_uid OR (v_email <> '' AND lower(s.email) = v_email))
   ORDER BY (s.user_id = v_uid) DESC NULLS LAST
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'You are already enrolled in this classroom.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.students (classroom_id, user_id, name, roll_number, phone, email)
  VALUES (v_class.id, v_uid, v_name,
          nullif(left(btrim(coalesce(p_roll_number, '')), 40), ''),
          nullif(left(btrim(coalesce(p_phone, '')), 32), ''),
          nullif(v_email, ''))
  RETURNING id INTO v_student;

  UPDATE public.classrooms c SET students = (SELECT count(*) FROM public.students s WHERE s.classroom_id = v_class.id)
   WHERE c.id = v_class.id;

  classroom_id := v_class.id;
  classroom_name := v_class.name;
  student_id := v_student;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Students (roster). Students read their own rows; teachers read and edit
--    their classroom's roster. Legacy face columns are never client-readable.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous select students" ON public.students;
  DROP POLICY IF EXISTS "Allow anonymous insert students" ON public.students;
  DROP POLICY IF EXISTS "Allow anonymous update students" ON public.students;
  DROP POLICY IF EXISTS "nc students read own" ON public.students;
  DROP POLICY IF EXISTS "nc students owner read" ON public.students;
  DROP POLICY IF EXISTS "nc students owner update" ON public.students;
  DROP POLICY IF EXISTS "nc students owner delete" ON public.students;
  CREATE POLICY "nc students read own" ON public.students FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);
  CREATE POLICY "nc students owner read" ON public.students FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));
  CREATE POLICY "nc students owner update" ON public.students FOR UPDATE TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id)) WITH CHECK (public.nc_is_classroom_owner(classroom_id));
  CREATE POLICY "nc students owner delete" ON public.students FOR DELETE TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));
END $$;
REVOKE SELECT, INSERT, UPDATE ON public.students FROM authenticated;
GRANT SELECT (id, classroom_id, user_id, name, roll_number, phone, email, joined_at, face_registration_status) ON public.students TO authenticated;
GRANT UPDATE (name, roll_number, phone) ON public.students TO authenticated;

-- Student-initiated deletion of their own Face-ID data across classrooms.
CREATE OR REPLACE FUNCTION public.nc_clear_my_face_data()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '28000'; END IF;
  DELETE FROM public.face_embeddings e USING public.students s WHERE e.student_id = s.id AND s.user_id = v_uid;
  DELETE FROM public.face_profiles p USING public.students s WHERE p.student_id = s.id AND s.user_id = v_uid;
  UPDATE public.students s
     SET face_registration_status = 'NOT_REGISTERED', face_descriptor = NULL, face_samples = '[]'::jsonb
   WHERE s.user_id = v_uid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Biometrics: embeddings are server-only (revoked above); profile reads
--    limited to the student and the classroom owner.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read face embeddings in their classroom" ON public.face_embeddings;
  DROP POLICY IF EXISTS "Users can read face profiles in their classroom" ON public.face_profiles;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.face_profiles, public.face_profile_versions, public.learning_observations FROM authenticated;

-- ---------------------------------------------------------------------
-- 6. Classroom materials: members of THAT classroom only; private files
--    stay with the teacher.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Classroom participants read materials" ON public.classroom_materials;
  DROP POLICY IF EXISTS "Classroom participants read material chunks" ON public.classroom_material_chunks;
  DROP POLICY IF EXISTS "nc materials read" ON public.classroom_materials;
  DROP POLICY IF EXISTS "nc material chunks read" ON public.classroom_material_chunks;
  CREATE POLICY "nc materials read" ON public.classroom_materials FOR SELECT TO authenticated
    USING (uploader_id = auth.uid()::text
           OR public.nc_is_classroom_owner(classroom_id)
           OR (visibility = 'classroom' AND public.nc_is_classroom_member(classroom_id)));
  CREATE POLICY "nc material chunks read" ON public.classroom_material_chunks FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id)
           OR (public.nc_is_classroom_member(classroom_id)
               AND EXISTS (SELECT 1 FROM public.classroom_materials m
                            WHERE m.id = classroom_material_chunks.material_id AND m.visibility = 'classroom')));
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.classroom_materials, public.classroom_material_chunks FROM authenticated;

-- ---------------------------------------------------------------------
-- 7. Evaluations: private to the teacher who saved them. Adds the columns the
--    app has always written.
-- ---------------------------------------------------------------------
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS criteria_scores jsonb;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS question_evaluations jsonb;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS plagiarism_score numeric;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS plagiarism_details text;
CREATE INDEX IF NOT EXISTS nc_evaluations_owner_idx ON public.evaluations (owner_user_id, date DESC);
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous select evaluations" ON public.evaluations;
  DROP POLICY IF EXISTS "Allow anonymous insert evaluations" ON public.evaluations;
  DROP POLICY IF EXISTS "nc evaluations owner all" ON public.evaluations;
  CREATE POLICY "nc evaluations owner all" ON public.evaluations FOR ALL TO authenticated
    USING (owner_user_id = auth.uid()::text) WITH CHECK (owner_user_id = auth.uid()::text);
END $$;

-- ---------------------------------------------------------------------
-- 8. Attendance: written only by the verified server flow.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow attendance inserts for classroom owners and enrolled stud" ON public.attendance;
  DROP POLICY IF EXISTS "nc attendance student read own" ON public.attendance;
  CREATE POLICY "nc attendance student read own" ON public.attendance FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid()::text));
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.attendance, public.attendance_observations FROM authenticated;

-- Attendance appeals (the student UI has written to this table; it never existed).
CREATE TABLE IF NOT EXISTS public.attendance_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  resolution text CHECK (resolution IS NULL OR char_length(resolution) <= 2000),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS nc_attendance_appeals_open_idx ON public.attendance_appeals (attendance_id, student_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS nc_attendance_appeals_classroom_idx ON public.attendance_appeals (classroom_id, created_at DESC);
ALTER TABLE public.attendance_appeals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "nc attendance appeals student insert" ON public.attendance_appeals;
  DROP POLICY IF EXISTS "nc attendance appeals student read" ON public.attendance_appeals;
  DROP POLICY IF EXISTS "nc attendance appeals owner read" ON public.attendance_appeals;
  DROP POLICY IF EXISTS "nc attendance appeals owner resolve" ON public.attendance_appeals;
  CREATE POLICY "nc attendance appeals student insert" ON public.attendance_appeals FOR INSERT TO authenticated
    WITH CHECK (student_id = auth.uid()::text AND status = 'open'
                AND EXISTS (SELECT 1 FROM public.attendance a JOIN public.students s ON s.id = a.student_id
                             WHERE a.id = attendance_appeals.attendance_id
                               AND a.classroom_id = attendance_appeals.classroom_id
                               AND s.user_id = auth.uid()::text));
  CREATE POLICY "nc attendance appeals student read" ON public.attendance_appeals FOR SELECT TO authenticated
    USING (student_id = auth.uid()::text);
  CREATE POLICY "nc attendance appeals owner read" ON public.attendance_appeals FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));
  CREATE POLICY "nc attendance appeals owner resolve" ON public.attendance_appeals FOR UPDATE TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id)) WITH CHECK (public.nc_is_classroom_owner(classroom_id));
END $$;
REVOKE ALL ON public.attendance_appeals FROM anon, authenticated;
GRANT SELECT ON public.attendance_appeals TO authenticated;
GRANT INSERT (attendance_id, classroom_id, student_id, reason) ON public.attendance_appeals TO authenticated;
GRANT UPDATE (status, resolution, resolved_by, resolved_at) ON public.attendance_appeals TO authenticated;

-- ---------------------------------------------------------------------
-- 9. Assessments: every write goes through the API (server-side validation,
--    grading, timers). Clients get read access only, and students never read
--    attempt rows directly (scores are served only after release).
-- ---------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Instructors manage tests for their classrooms" ON public.tests;
  DROP POLICY IF EXISTS "Students can view enrolled tests" ON public.tests;
  DROP POLICY IF EXISTS "nc tests owner manage" ON public.tests;
  DROP POLICY IF EXISTS "nc tests owner read" ON public.tests;
  CREATE POLICY "nc tests owner read" ON public.tests FOR SELECT TO authenticated
    USING (public.nc_is_classroom_owner(classroom_id));

  DROP POLICY IF EXISTS "Authenticated users manage own or classroom attempts" ON public.attempts;
  DROP POLICY IF EXISTS "nc attempts student read own" ON public.attempts;

  DROP POLICY IF EXISTS "Authenticated users manage permitted submissions" ON public.test_submissions;
  DROP POLICY IF EXISTS "nc legacy submissions owner read" ON public.test_submissions;
  CREATE POLICY "nc legacy submissions owner read" ON public.test_submissions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_submissions.test_id AND public.nc_is_classroom_owner(t.classroom_id)));

  DROP POLICY IF EXISTS "Students manage own results" ON public.test_results;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.tests, public.attempts, public.test_submissions, public.test_results FROM authenticated;

-- ---------------------------------------------------------------------
-- 10. Function privileges. Supabase grants EXECUTE on new functions to anon
--     and authenticated by default; narrow that explicitly.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.nc_rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nc_join_classroom(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nc_clear_my_face_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nc_is_classroom_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nc_is_classroom_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nc_handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nc_join_classroom(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nc_clear_my_face_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nc_is_classroom_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nc_is_classroom_member(uuid) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.nc_rate_limit_hit(text, text, integer, integer) TO service_role;
    GRANT ALL ON public.nc_rate_limits, public.attendance_appeals TO service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 11. Project Advisor history (the API has been saving here; the table was
--     never created in production). Written by the server only.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id text NOT NULL,
  category text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_id uuid,
  payment_tx_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nc_project_ideas_student_idx ON public.project_ideas (student_user_id, created_at DESC);
ALTER TABLE public.project_ideas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Students manage own project ideas" ON public.project_ideas;
  DROP POLICY IF EXISTS "nc project ideas read own" ON public.project_ideas;
  CREATE POLICY "nc project ideas read own" ON public.project_ideas FOR SELECT TO authenticated
    USING (student_user_id = auth.uid()::text);
END $$;
REVOKE ALL ON public.project_ideas FROM anon, authenticated;
GRANT SELECT ON public.project_ideas TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.project_ideas TO service_role;
  END IF;
END $$;
