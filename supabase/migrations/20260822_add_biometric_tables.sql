-- Migration: Add missing face_profiles and face_embeddings tables for AI Proctoring and Attendance

-- 1. Create face_profiles table
CREATE TABLE IF NOT EXISTS public.face_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'PENDING', 'REJECTED')),
    profile_version INTEGER DEFAULT 1 NOT NULL,
    enrollment_count INTEGER DEFAULT 0 NOT NULL,
    verified_count INTEGER DEFAULT 0 NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, classroom_id)
);

CREATE INDEX IF NOT EXISTS face_profiles_student_idx ON public.face_profiles (student_id, classroom_id);

-- 2. Create face_embeddings table
-- Note: This requires the pgvector extension. We ensure it's enabled first.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.face_profiles(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT NOT NULL,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
    embedding vector(512) NOT NULL,
    source TEXT DEFAULT 'centroid_enrollment' NOT NULL,
    quality_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, classroom_id)
);

CREATE INDEX IF NOT EXISTS face_embeddings_profile_idx ON public.face_embeddings (profile_id);

-- 3. Update students table to track registration status if not already present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'face_registration_status') THEN
        ALTER TABLE public.students ADD COLUMN face_registration_status TEXT DEFAULT 'PENDING' CHECK (face_registration_status IN ('PENDING', 'REGISTERED', 'FAILED'));
    END IF;
END $$;

-- 4. Apply Row Level Security (RLS)
ALTER TABLE public.face_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow the AI service (using service_role key) to bypass RLS entirely.
-- For authenticated users (teachers/students), allow read access if they belong to the classroom.
CREATE POLICY "Users can read face profiles in their classroom"
    ON public.face_profiles FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
        OR EXISTS (SELECT 1 FROM public.students s WHERE s.classroom_id = classroom_id AND s.user_id = auth.uid()::text)
    );

CREATE POLICY "Users can read face embeddings in their classroom"
    ON public.face_embeddings FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.user_id = auth.uid()::text)
        OR EXISTS (SELECT 1 FROM public.students s WHERE s.classroom_id = classroom_id AND s.user_id = auth.uid()::text)
    );
