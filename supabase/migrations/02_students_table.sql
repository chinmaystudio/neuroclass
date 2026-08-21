-- Drop the old table if it exists (for those migrating from older schema versions)
DROP TABLE IF EXISTS public.classroom_students CASCADE;

-- Create the new students table with biometric and full profile support
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id TEXT, -- Links to the global user's UID for cross-referencing
  name TEXT NOT NULL,
  roll_number TEXT,
  phone TEXT,
  email TEXT,
  face_samples JSONB DEFAULT '[]'::jsonb,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(classroom_id, email) -- A student can only join a specific class once
);

-- Re-apply RLS policies for the new table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update students" ON public.students FOR UPDATE USING (true);
