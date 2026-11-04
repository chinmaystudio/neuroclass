-- Supabase advisor 0011: pin the search_path of the legacy trigger function.
DO $$ BEGIN
  IF to_regprocedure('public.update_attendance_verifications_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_attendance_verifications_updated_at() SET search_path = public;
  END IF;
END $$;
