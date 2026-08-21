-- ==========================================
-- 03_tests_and_results.sql
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Create tests table
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create test_results table
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_id, student_id) -- A student can only submit a test once
);

-- Enable RLS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for tests
-- Instructors can read/write their own classrooms' tests
CREATE POLICY "Instructors manage tests for their classrooms" ON public.tests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.classrooms c 
            WHERE c.id = tests.classroom_id 
            AND c.user_id = auth.uid()::text
        )
    );

-- Students can view tests assigned to their enrolled classrooms
CREATE POLICY "Students can view enrolled tests" ON public.tests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.classroom_id = tests.classroom_id
            AND s.user_id = auth.uid()::text
        )
    );

-- 4. RLS Policies for test_results
-- Students can insert and view their own results
CREATE POLICY "Students manage own results" ON public.test_results
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = test_results.student_id
            AND s.user_id = auth.uid()::text
        )
    );

-- Instructors can view results for tests in their classrooms
CREATE POLICY "Instructors view test results" ON public.test_results
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            JOIN public.classrooms c ON t.classroom_id = c.id
            WHERE t.id = test_results.test_id
            AND c.user_id = auth.uid()::text
        )
    );
