-- Supabase Database Schema for NeuroClass AI
-- This schema represents the current persistent data structure of the platform.

-- 1. Create Classrooms table
CREATE TABLE IF NOT EXISTS classrooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text, -- Joining Code
  user_id text, -- Associated User ID
  students integer DEFAULT 0,
  attendance text DEFAULT '0%'::text,
  status text DEFAULT 'Active'::text CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT classrooms_pkey PRIMARY KEY (id)
);

-- Ensure 'code' and 'user_id' columns exist if the table was created previously without them
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classrooms' AND column_name='code') THEN
    ALTER TABLE classrooms ADD COLUMN code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classrooms' AND column_name='user_id') THEN
    ALTER TABLE classrooms ADD COLUMN user_id text;
  END IF;
END $$;

-- 2. Create Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  user_id text, -- Associated User ID
  classroom_id uuid,
  avatar text,
  enrollment_status text DEFAULT 'Enrolled'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id)
);

-- Ensure 'user_id' column exists if the table was created previously without it
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='user_id') THEN
    ALTER TABLE students ADD COLUMN user_id text;
  END IF;
END $$;

-- 3. Create Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  classroom_id uuid,
  user_id text, -- Associated User ID
  status text DEFAULT 'Present'::text CHECK (status = ANY (ARRAY['Present'::text, 'Absent'::text, 'Late'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT attendance_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id)
);

-- Ensure 'user_id' column exists if the table was created previously without it
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='user_id') THEN
    ALTER TABLE attendance ADD COLUMN user_id text;
  END IF;
END $$;

-- 4. Create Tests table (Enhanced for full configuration storage)
CREATE TABLE IF NOT EXISTS tests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  classroom_id uuid,
  user_id text, -- Associated User ID (Creator)
  title text NOT NULL,
  description text,
  test_data jsonb, -- Stores the full Test object (sections, questions, layout, appearance)
  status text DEFAULT 'Draft'::text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tests_pkey PRIMARY KEY (id),
  CONSTRAINT tests_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id)
);

-- Healing script for tests table to ensure test_data exists and rename legacy 'test' column
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tests' AND column_name='test_data') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tests' AND column_name='test') THEN
      ALTER TABLE tests RENAME COLUMN test TO test_data;
    ELSE
      ALTER TABLE tests ADD COLUMN test_data jsonb;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tests' AND column_name='user_id') THEN
    ALTER TABLE tests ADD COLUMN user_id text;
  END IF;
END $$;

-- 5. Create Attempts table (Renamed from test_submissions to match code usage)
CREATE TABLE IF NOT EXISTS attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  student_id uuid, -- Link to students table if applicable
  user_id text, -- Auth User ID of the student
  answers jsonb DEFAULT '{}'::jsonb, -- Stores the student's answers
  violations jsonb DEFAULT '[]'::jsonb, -- Proctoring flags
  score numeric DEFAULT 0,
  status text DEFAULT 'ongoing'::text,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attempts_pkey PRIMARY KEY (id),
  CONSTRAINT attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE
);

-- Healing script for attempts table to handle potential column name mismatches and legacy table names
DO $$ 
BEGIN 
  -- Handle legacy table rename if it didn't happen
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='test_submissions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='attempts') THEN
      ALTER TABLE test_submissions RENAME TO attempts;
    END IF;
  END IF;

  -- Ensure test_id exists (might have been 'test' in some versions)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attempts' AND column_name='test_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attempts' AND column_name='test') THEN
      ALTER TABLE attempts RENAME COLUMN test TO test_id;
    ELSE
      ALTER TABLE attempts ADD COLUMN test_id uuid;
    END IF;
  END IF;

  -- Ensure user_id column exists if created previously without it
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attempts' AND column_name='user_id') THEN
    ALTER TABLE attempts ADD COLUMN user_id text;
  END IF;
END $$;

-- 6. Create Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient TEXT NOT NULL,
  user_id text, -- Associated User ID
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure 'user_id' column exists if the table was created previously without it
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id') THEN
    ALTER TABLE notifications ADD COLUMN user_id text;
  END IF;
END $$;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- UNIVERSAL ACCESS POLICIES (Development)
DROP POLICY IF EXISTS "Universal classrooms" ON classrooms;
CREATE POLICY "Universal classrooms" ON classrooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Universal students" ON students;
CREATE POLICY "Universal students" ON students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Universal attendance" ON attendance;
CREATE POLICY "Universal attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Universal tests" ON tests;
CREATE POLICY "Universal tests" ON tests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Universal attempts" ON attempts;
CREATE POLICY "Universal attempts" ON attempts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Universal notifications" ON notifications;
CREATE POLICY "Universal notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
