# Database

Supabase PostgreSQL. The API uses the service-role key **only on the server** and enforces authorization in code. Row Level Security is the second layer.

## Migrations added by the consolidation

Apply these in order after the existing migrations. All three are idempotent: they were run twice against a local Postgres 16 with the Supabase role/function stubs used in CI.

| File | Purpose |
|---|---|
| `20261105000100_lms_assessments_assignments_coding.sql` | Extends `tests` and `attempts`; adds `test_questions`, `attempt_answers`, `coding_test_cases`, `coding_workspaces`, `code_execution_jobs`, `proctoring_events`, `assessment_appeals`, `assessment_audit_logs`, `assignments`, `assignment_attachments`, `assignment_submissions`, `assignment_submission_files`, `assignment_submission_history`; helper functions; RLS; private `assignment-files` bucket. **Removes the anonymous policy that exposed every test's answer keys** and hides the legacy `tests.questions` column from client roles. |
| `20261105000200_import_test_creation_portal_data.sql` | One-way import of tests and questions from the old portal's `tc_*` tables (only if they exist). Only tests linked to a real NeuroClass classroom are imported. Repeatable via `tests.legacy_source`. `tc_*` tables are **not** dropped. |
| `20261105000300_tighten_identity_rls.sql` | Creates profiles from `auth.users` with a trigger. **Removes anonymous read/insert on `users`** (the old policy exposed emails and phone numbers) and anonymous inserts on `classrooms`. |

### How to apply

Supabase dashboard → SQL editor, or `supabase db push` with the CLI. **Take a backup first** (Database → Backups).

```bash
supabase db push   # or paste each file into the SQL editor, in order
```

Then verify:

```sql
select count(*) from public.test_questions;                                      -- legacy questions are imported lazily on first use
select policyname from pg_policies where tablename = 'tests';                    -- no "Allow anonymous select tests"
select has_column_privilege('authenticated', 'public.tests', 'questions', 'SELECT');  -- false
```

### Rollback

`supabase/rollback/20261105000100_down.sql` drops the new tables (data in them is lost) and keeps the added columns. It deliberately **does not** recreate the anonymous policies. To undo the identity RLS change, drop the `nc users *` / `nc classrooms *` policies and the `nc_on_auth_user_created` trigger.

## Data preservation

- Existing `tests` rows keep their ids. Rows whose `status` was silently defaulted to `draft` by an earlier migration, but which students could already see, are restored to `published` once (marker: `config.ncLegacyVisibilityRestored`).
- Legacy questions in `tests.questions` JSONB are normalised into `test_questions` the first time the test is opened (`backend/modules/assessments/repo.ts → loadQuestions`). Saving the questions clears the JSONB copy so answer keys no longer live there.
- Duplicate open attempts left over from earlier race conditions are marked `abandoned` (the newest is kept) before the uniqueness index is created.
- Existing attempts get `classroom_id` back-filled.

## Main entities

```text
classrooms 1─* students (enrolment; user_id or email)
classrooms 1─* tests 1─* test_questions 1─* coding_test_cases
tests 1─* attempts 1─* attempt_answers
attempts 1─* proctoring_events, 1─* assessment_appeals
classrooms 1─* assignments 1─* assignment_attachments
assignments 1─* assignment_submissions 1─* assignment_submission_files / _history
assignments 1─* coding_test_cases
coding_workspaces (per user × assignment)   code_execution_jobs (audit + hourly cap)
assessment_audit_logs (who did what)
```

### Status machines

- `tests.status`: `draft → published → closed → archived`. *Scheduled / active / ended* are derived from `scheduled_start` and `scheduled_end` (`availabilityOf`).
- `attempts.status`: `calibrating → in_progress → submitted | auto_submitted → evaluated`; `abandoned`; `flagged` (legacy).
- `assignments.status`: `draft → published → closed → archived`.
- `assignment_submissions.status`: `draft → submitted | late → evaluated → returned` (a submission can be reopened back to `draft` before grading, when resubmission is allowed).

### Integrity constraints worth knowing

- `nc_attempts_one_open_per_student_idx`: one open attempt per student per test.
- `UNIQUE (attempt_id, question_id)` on answers; `UNIQUE (assignment_id, student_user_id)` on submissions.
- `coding_test_cases` belongs to exactly one of a question or an assignment (CHECK).
- Size limits are enforced with CHECK constraints (source code ≤ 200 KB, test case input/output ≤ 64 KB) as well as in the API.

## Row Level Security summary

| Table | Teacher (owns classroom) | Enrolled student | Anonymous |
|---|---|---|---|
| tests | all | select **published** only, without the `questions` column | none |
| test_questions, coding_test_cases, attempt_answers, audit logs | none (API only) | none | none |
| attempts | select | select own | none |
| proctoring_events | select | none | none |
| assignments | all | select published/closed | none |
| assignment_submissions | select | select own | none |
| users | own row | own row | none |
| classrooms | insert own; read | read (needed for join by code) | none |

The helper functions `nc_is_classroom_owner(uuid)` and `nc_is_classroom_member(uuid)` are `SECURITY DEFINER` and return booleans only.
