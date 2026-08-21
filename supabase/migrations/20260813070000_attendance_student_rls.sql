-- Fix Attendance Table Row Level Security Policy to allow enrolled students to submit attendance check-ins

DROP POLICY IF EXISTS "Authenticated classroom owners manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow attendance inserts for classroom owners and enrolled students" ON public.attendance;

CREATE POLICY "Allow attendance inserts for classroom owners and enrolled students"
  ON public.attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = attendance.classroom_id
        AND c.user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id::text = attendance.student_id
        AND s.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = attendance.classroom_id
        AND c.user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id::text = attendance.student_id
        AND s.user_id = auth.uid()::text
    )
  );
