-- Rollback for 20261105000100_lms_assessments_assignments_coding.sql
-- WARNING: this deletes all data created in the new tests/assignments/coding tables.
-- Take a backup (Supabase dashboard -> Database -> Backups) before running it.
-- Legacy columns added to public.tests / public.attempts are kept so that older
-- application code keeps working; they are harmless if unused.

BEGIN;
DROP TABLE IF EXISTS public.assessment_audit_logs;
DROP TABLE IF EXISTS public.assessment_appeals;
DROP TABLE IF EXISTS public.proctoring_events;
DROP TABLE IF EXISTS public.attempt_answers;
DROP TABLE IF EXISTS public.code_execution_jobs;
DROP TABLE IF EXISTS public.coding_workspaces;
DROP TABLE IF EXISTS public.coding_test_cases;
DROP TABLE IF EXISTS public.assignment_submission_history;
DROP TABLE IF EXISTS public.assignment_submission_files;
DROP TABLE IF EXISTS public.assignment_submissions;
DROP TABLE IF EXISTS public.assignment_attachments;
DROP TABLE IF EXISTS public.assignments;
DROP TABLE IF EXISTS public.test_questions;
DROP INDEX IF EXISTS public.nc_attempts_one_open_per_student_idx;
DROP POLICY IF EXISTS "nc tests owner manage" ON public.tests;
DROP POLICY IF EXISTS "nc tests member read published" ON public.tests;
DROP POLICY IF EXISTS "nc attempts student read own" ON public.attempts;
DROP POLICY IF EXISTS "nc attempts owner read" ON public.attempts;
GRANT SELECT ON public.tests TO authenticated;
-- The previous anonymous policies are intentionally NOT recreated: they exposed answer keys.
COMMIT;
