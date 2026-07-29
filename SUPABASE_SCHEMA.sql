-- SQL Schema for NeuroClass AI Educational Platform

-- 1. Classrooms Table
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- 6 character alphanumeric
  students INTEGER DEFAULT 0,
  attendance TEXT DEFAULT '0%',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_id UUID REFERENCES auth.users(id)
);

-- 2. Students Table (Enrollments)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id), -- If using auth
  name TEXT NOT NULL,
  roll_number TEXT,
  email TEXT,
  phone TEXT,
  avatar TEXT, -- Face sample or profile pic
  face_samples JSONB, -- Array of base64 images for AI proctoring
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(classroom_id, student_id)
);

-- 3. Tests Table (Saperate database/table for storing tests)
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  test_data JSONB NOT NULL, -- The entire Test object (settings, sections, questions, layout)
  status TEXT DEFAULT 'published', -- draft, published, closed
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Test Attempts Table (Tracking student performance)
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  score NUMERIC,
  answers JSONB, -- Map of questionId -> answers
  violations JSONB, -- Proctoring logs (type, timestamp)
  status TEXT DEFAULT 'ongoing', -- ongoing, submitted, flagged
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- 5. Attendance Table (Daily logs)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Present',
  confidence NUMERIC, -- AI confidence score
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
