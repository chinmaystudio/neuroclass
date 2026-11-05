-- =====================================================================
-- Google sign-in and email notifications.
--
-- 1. Role choice for OAuth sign-ups. Email sign-ups send their role in the
--    sign-up metadata; Google sign-ups can't, so the profile is created
--    without a confirmed role and the person picks one once, through
--    nc_choose_role(). The role is a portal preference only: teacher
--    authority over a classroom is classroom ownership (RLS + server checks).
-- 2. users.email_notifications: students and teachers can turn emails off.
-- 3. notification_outbox: one row per (event, recipient). The unique key
--    makes sending idempotent (re-publishing never emails twice) and lets a
--    worker retry failed sends. Service role only.
-- =====================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_chosen_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

-- Every existing account chose its role when it signed up.
UPDATE public.users SET role_chosen_at = coalesce(createdat, now())
 WHERE role_chosen_at IS NULL AND role IN ('teacher', 'student', 'admin');

GRANT UPDATE (email_notifications) ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.nc_handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  requested_role text := lower(coalesce(meta ->> 'role', ''));
  has_role boolean := requested_role IN ('teacher', 'student');
BEGIN
  INSERT INTO public.users (uid, email, displayname, photourl, role, mobile_number, role_chosen_at)
  VALUES (
    NEW.id::text,
    coalesce(NEW.email, ''),
    nullif(left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 200), ''),
    nullif(left(coalesce(meta ->> 'avatar_url', meta ->> 'picture', ''), 500), ''),
    CASE WHEN has_role THEN requested_role ELSE 'student' END,
    nullif(left(coalesce(meta ->> 'phone', ''), 32), ''),
    -- OAuth sign-ups have no role yet: the app asks once (nc_choose_role).
    CASE WHEN has_role THEN now() ELSE NULL END
  )
  ON CONFLICT (uid) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'nc_handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nc_choose_role(p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_result text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '28000';
  END IF;
  IF v_role NOT IN ('teacher', 'student') THEN
    RAISE EXCEPTION 'Choose teacher or student.' USING ERRCODE = '22023';
  END IF;
  -- Recover a profile row the sign-up trigger could not create.
  INSERT INTO public.users (uid, email, role)
  VALUES (v_uid, coalesce(auth.jwt() ->> 'email', ''), v_role)
  ON CONFLICT (uid) DO NOTHING;
  -- Only the first choice counts; an already-chosen role is returned unchanged.
  UPDATE public.users SET role = v_role, role_chosen_at = now()
   WHERE uid = v_uid AND role_chosen_at IS NULL
  RETURNING role INTO v_result;
  IF v_result IS NULL THEN
    SELECT role INTO v_result FROM public.users WHERE uid = v_uid;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.nc_choose_role(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.nc_choose_role(text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.nc_choose_role(text) TO authenticated;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  kind text NOT NULL,
  classroom_id uuid,
  recipient_email text NOT NULL,
  recipient_user_id text,
  subject text NOT NULL,
  html text NOT NULL,
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (event_key, recipient_email)
);
CREATE INDEX IF NOT EXISTS nc_notification_outbox_pending_idx
  ON public.notification_outbox (created_at) WHERE status = 'pending';

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_outbox FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.notification_outbox FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.notification_outbox FROM authenticated;
  END IF;
END $$;
