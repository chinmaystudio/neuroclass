-- 1. Extend attendance_sessions to support network session info
ALTER TABLE public.attendance_sessions 
ADD COLUMN IF NOT EXISTS network_session_id text,
ADD COLUMN IF NOT EXISTS session_code text;

-- 2. Create the attendance_verifications table for tracking the multi-level progress
CREATE TABLE IF NOT EXISTS public.attendance_verifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    attendance_session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    
    network_connected boolean DEFAULT false,
    authentication_verified boolean DEFAULT false,
    classroom_verified boolean DEFAULT false,
    session_verified boolean DEFAULT false,
    
    face_detected boolean DEFAULT false,
    liveness_score numeric,
    face_match_score numeric,
    
    final_confidence numeric,
    verification_status text DEFAULT 'NOT_CONNECTED',
    
    verified_at timestamp with time zone,
    attempt_count integer DEFAULT 0,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Ensure a student only has one verification record per session
CREATE UNIQUE INDEX IF NOT EXISTS attendance_verifications_session_student_idx 
ON public.attendance_verifications (attendance_session_id, student_id);

-- Enable RLS
ALTER TABLE public.attendance_verifications ENABLE ROW LEVEL SECURITY;

-- Student policy: can read and update their own verifications
CREATE POLICY "Students can view their own verifications"
ON public.attendance_verifications FOR SELECT
TO authenticated
USING (student_user_id = auth.uid());

CREATE POLICY "Students can update their own verifications"
ON public.attendance_verifications FOR UPDATE
TO authenticated
USING (student_user_id = auth.uid());

CREATE POLICY "Students can insert their own verifications"
ON public.attendance_verifications FOR INSERT
TO authenticated
WITH CHECK (student_user_id = auth.uid());

-- Teacher policy: can read verifications for their classrooms
CREATE POLICY "Teachers can view verifications for their classrooms"
ON public.attendance_verifications FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.classrooms c
        WHERE c.id = attendance_verifications.classroom_id
        AND c.user_id = auth.uid()
    )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_attendance_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_attendance_verifications_updated_at ON public.attendance_verifications;
CREATE TRIGGER set_attendance_verifications_updated_at
BEFORE UPDATE ON public.attendance_verifications
FOR EACH ROW
EXECUTE FUNCTION update_attendance_verifications_updated_at();
