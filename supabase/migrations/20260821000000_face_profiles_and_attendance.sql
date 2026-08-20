-- Enable pgvector for Face Embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Face Profiles (Core Identity State)
CREATE TABLE IF NOT EXISTS face_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL, -- Assuming students table exists, adjust references if needed
    classroom_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'REGISTERED',
    profile_version INTEGER NOT NULL DEFAULT 1,
    enrollment_count INTEGER NOT NULL DEFAULT 0,
    verified_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, classroom_id)
);

-- Face Embeddings (Approved ArcFace vectors)
CREATE TABLE IF NOT EXISTS face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    classroom_id UUID NOT NULL,
    embedding VECTOR(512) NOT NULL,
    source TEXT NOT NULL,
    quality_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile Versions (Audit and Rollback)
CREATE TABLE IF NOT EXISTS face_profile_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    reason TEXT NOT NULL,
    embedding_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, version)
);

-- Learning Observations (Continual Learning Candidates)
CREATE TABLE IF NOT EXISTS learning_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
    session_id UUID,
    similarity NUMERIC,
    second_best_similarity NUMERIC,
    margin NUMERIC,
    quality_score NUMERIC,
    status TEXT NOT NULL,
    accepted_for_learning BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Sessions (Lifecycle)
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL,
    teacher_id UUID,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- Attendance Observations (Raw Frame Evidence)
CREATE TABLE IF NOT EXISTS attendance_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID,
    track_id INTEGER,
    status TEXT NOT NULL,
    similarity NUMERIC,
    confidence NUMERIC,
    verification TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final Attendance (Idempotent Results)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'Present',
    confidence NUMERIC,
    verification_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);
