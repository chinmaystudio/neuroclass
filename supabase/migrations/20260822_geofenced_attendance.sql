-- NeuroClass Multi-Level Attendance: geofence-first verification.
-- Wi-Fi, hotspot, BLE, and local-network state are not required by this migration.

ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS teacher_latitude double precision,
  ADD COLUMN IF NOT EXISTS teacher_longitude double precision,
  ADD COLUMN IF NOT EXISTS teacher_location_accuracy double precision,
  ADD COLUMN IF NOT EXISTS radius_meters integer,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone;

UPDATE public.attendance_sessions
SET started_at = COALESCE(started_at, starts_at),
    expires_at = COALESCE(expires_at, ends_at),
    radius_meters = COALESCE(radius_meters, 100)
WHERE started_at IS NULL OR expires_at IS NULL OR radius_meters IS NULL;

ALTER TABLE public.attendance_sessions
  ALTER COLUMN radius_meters SET DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_sessions_radius_meters_check'
  ) THEN
    ALTER TABLE public.attendance_sessions
      ADD CONSTRAINT attendance_sessions_radius_meters_check CHECK (radius_meters BETWEEN 25 AND 1000);
  END IF;
END $$;

ALTER TABLE public.attendance_verifications
  ADD COLUMN IF NOT EXISTS location_status text DEFAULT 'LOCATION_UNAVAILABLE',
  ADD COLUMN IF NOT EXISTS location_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS student_latitude double precision,
  ADD COLUMN IF NOT EXISTS student_longitude double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy double precision,
  ADD COLUMN IF NOT EXISTS distance_from_teacher double precision,
  ADD COLUMN IF NOT EXISTS overall_confidence numeric,
  ADD COLUMN IF NOT EXISTS manual_reviewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_reviewed_by text,
  ADD COLUMN IF NOT EXISTS manual_review_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_verifications_location_status_check'
  ) THEN
    ALTER TABLE public.attendance_verifications
      ADD CONSTRAINT attendance_verifications_location_status_check CHECK (
        location_status IN (
          'LOCATION_VERIFIED',
          'LOCATION_UNCERTAIN',
          'OUTSIDE_RADIUS',
          'LOCATION_PERMISSION_DENIED',
          'LOCATION_UNAVAILABLE'
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attendance_session_announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'attendance_started',
  session_code text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.attendance_session_announcements
  ADD COLUMN IF NOT EXISTS session_code text;

CREATE INDEX IF NOT EXISTS attendance_session_announcements_classroom_idx
  ON public.attendance_session_announcements (classroom_id, created_at DESC);

ALTER TABLE public.attendance_session_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read announcements for enrolled classrooms" ON public.attendance_session_announcements;
CREATE POLICY "Students read announcements for enrolled classrooms"
  ON public.attendance_session_announcements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.classroom_id = attendance_session_announcements.classroom_id
        AND s.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Teachers manage announcements for owned classrooms" ON public.attendance_session_announcements;
CREATE POLICY "Teachers manage announcements for owned classrooms"
  ON public.attendance_session_announcements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = attendance_session_announcements.classroom_id
        AND c.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = attendance_session_announcements.classroom_id
        AND c.user_id = auth.uid()::text
    )
  );

-- Verification rows are written by the trusted server after it recalculates geofence
-- and biometric results. Students can read their own state but cannot forge it.
DROP POLICY IF EXISTS "Students can update their own verifications" ON public.attendance_verifications;
DROP POLICY IF EXISTS "Students can insert their own verifications" ON public.attendance_verifications;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_session_announcements'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_session_announcements';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_verifications'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_verifications';
    END IF;
  END IF;
END $$;
