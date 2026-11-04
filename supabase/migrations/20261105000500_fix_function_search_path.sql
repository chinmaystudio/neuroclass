-- Supabase advisor 0011: pin the search_path of the legacy trigger function.
ALTER FUNCTION public.update_attendance_verifications_updated_at() SET search_path = public;
