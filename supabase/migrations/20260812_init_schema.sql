-- =========================================================
-- NEUROCLASS SUPABASE PRODUCTION INITIAL MIGRATION
-- Migration Date: 2026-08-12
-- Features: Auth Sync, Two-Sided Platform, Classrooms, Proctoring, x402 Protocol
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS PROFILE TABLE (Auth Sync)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  displayName TEXT,
  photoURL TEXT,
  role TEXT DEFAULT 'teacher',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CLASSROOMS TABLE
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  subject TEXT DEFAULT 'Computer Science',
  user_id TEXT NOT NULL,
  students INTEGER DEFAULT 0,
  attendance TEXT DEFAULT '0%',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CLASSROOM STUDENTS (ENROLLMENT)
CREATE TABLE IF NOT EXISTS public.classroom_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TESTS & EXAMS TABLE
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT DEFAULT 'Computer Science',
  duration_mins INTEGER DEFAULT 45,
  total_marks INTEGER DEFAULT 50,
  questions JSONB DEFAULT '[]'::jsonb,
  proctoring_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TEST SUBMISSIONS & PROCTORING VIOLATION LOGS
CREATE TABLE IF NOT EXISTS public.test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  marks_obtained INTEGER DEFAULT 0,
  total_marks INTEGER DEFAULT 50,
  percentage INTEGER DEFAULT 0,
  grade TEXT DEFAULT 'A',
  feedback TEXT,
  answers JSONB DEFAULT '[]'::jsonb,
  proctoring_violations JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. BIOMETRIC FACE-ID ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT DEFAULT 'Present',
  verified_method TEXT DEFAULT 'Face-ID Biometric',
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EVALUATIONS TABLE (OCR & Rubric Evaluation Records)
CREATE TABLE IF NOT EXISTS public.evaluations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  studentName TEXT NOT NULL,
  rollNumber TEXT,
  subject TEXT,
  assessmentName TEXT,
  marksObtained NUMERIC,
  totalMarks NUMERIC,
  percentage NUMERIC,
  grade TEXT,
  feedback TEXT,
  strengths JSONB,
  weaknesses JSONB,
  improvementSuggestions JSONB,
  owner_user_id TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS evaluations_owner_date_idx ON public.evaluations (owner_user_id, date DESC);

-- 8. x402 PROTOCOL ALGORAND SETTLEMENT AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.x402_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE NOT NULL,
  amount_algo NUMERIC NOT NULL,
  service_name TEXT NOT NULL,
  payer_address TEXT,
  receiver_address TEXT NOT NULL,
  status TEXT DEFAULT 'settled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_classrooms_user_id ON public.classrooms(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_students_classroom_id ON public.classroom_students(classroom_id);
CREATE INDEX IF NOT EXISTS idx_tests_classroom_id ON public.tests(classroom_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_test_id ON public.test_submissions(test_id);
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_id ON public.attendance(classroom_id);

-- RLS Row-Level Security Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert users" ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select classrooms" ON public.classrooms FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert classrooms" ON public.classrooms FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert tests" ON public.tests FOR INSERT WITH CHECK (true);

CREATE POLICY "Users read own evaluations" ON public.evaluations FOR SELECT TO authenticated USING (owner_user_id = auth.uid()::text);
CREATE POLICY "Users insert own evaluations" ON public.evaluations FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid()::text);

CREATE POLICY "Allow anonymous select x402" ON public.x402_payments FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert x402" ON public.x402_payments FOR INSERT WITH CHECK (true);
