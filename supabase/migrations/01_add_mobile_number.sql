-- Add mobile_number to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile_number TEXT;
