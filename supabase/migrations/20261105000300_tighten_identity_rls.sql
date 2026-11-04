-- =====================================================================
-- Close anonymous access to user profiles and classrooms.
-- Before: "Allow anonymous select users" exposed every user's email and
-- mobile number to anyone holding the public anon key, and anonymous
-- inserts allowed forged profiles/classrooms.
-- Profiles are now created server-side by a trigger on auth.users, so sign-up
-- keeps working even when email confirmation means there is no session yet.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.nc_handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  requested_role text := lower(coalesce(meta ->> 'role', ''));
BEGIN
  INSERT INTO public.users (uid, email, displayname, role, mobile_number)
  VALUES (
    NEW.id::text,
    coalesce(NEW.email, ''),
    nullif(left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 200), ''),
    CASE WHEN requested_role IN ('teacher', 'student') THEN requested_role ELSE 'student' END,
    nullif(left(coalesce(meta ->> 'phone', ''), 32), '')
  )
  ON CONFLICT (uid) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block sign-up because of the profile row; the app can recover it.
  RAISE WARNING 'nc_handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS nc_on_auth_user_created ON auth.users;
    CREATE TRIGGER nc_on_auth_user_created AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.nc_handle_new_auth_user();
  END IF;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous select users" ON public.users;
  DROP POLICY IF EXISTS "Allow anonymous insert users" ON public.users;
  DROP POLICY IF EXISTS "nc users read own" ON public.users;
  DROP POLICY IF EXISTS "nc users insert own" ON public.users;
  DROP POLICY IF EXISTS "nc users update own" ON public.users;
  CREATE POLICY "nc users read own" ON public.users FOR SELECT TO authenticated USING (uid = auth.uid()::text);
  CREATE POLICY "nc users insert own" ON public.users FOR INSERT TO authenticated WITH CHECK (uid = auth.uid()::text);
  -- Note: the role column is a UI preference only. Teacher authority over a
  -- classroom is classroom ownership, enforced server-side and by RLS.
  CREATE POLICY "nc users update own" ON public.users FOR UPDATE TO authenticated USING (uid = auth.uid()::text) WITH CHECK (uid = auth.uid()::text);

  DROP POLICY IF EXISTS "Allow anonymous select classrooms" ON public.classrooms;
  DROP POLICY IF EXISTS "Allow anonymous insert classrooms" ON public.classrooms;
  DROP POLICY IF EXISTS "nc classrooms authenticated read" ON public.classrooms;
  DROP POLICY IF EXISTS "nc classrooms owner insert" ON public.classrooms;
  -- Signed-in students still need to look a classroom up by its join code.
  CREATE POLICY "nc classrooms authenticated read" ON public.classrooms FOR SELECT TO authenticated USING (true);
  CREATE POLICY "nc classrooms owner insert" ON public.classrooms FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
END $$;

REVOKE ALL ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.classrooms FROM anon;
