-- =====================================================================
-- One-way import of data created in the standalone test_creation portal
-- (tables prefixed tc_) into the consolidated NeuroClass tables.
-- * Runs only if the tc_ tables exist in this database.
-- * Idempotent: rows already imported are skipped (tests.legacy_source).
-- * tc_ tables are NOT dropped. Drop them manually once the import is verified.
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('public.tc_tests') IS NULL THEN
    RAISE NOTICE 'tc_tests not found; nothing to import.';
    RETURN;
  END IF;

  -- Tests: only those attached to a real NeuroClass classroom can be imported,
  -- because classroom isolation is mandatory in the consolidated model.
  INSERT INTO public.tests (id, classroom_id, title, subject, description, instructions, duration_mins,
                            total_marks, status, scheduled_start, scheduled_end, created_by, config, security,
                            results_released, created_at, updated_at, legacy_source, proctoring_enabled)
  SELECT gen_random_uuid(),
         c.id,
         t."name",
         t.subject,
         t.description,
         t.instructions,
         COALESCE(NULLIF((s.config::jsonb ->> 'durationMinutes'), '')::int, 60),
         t."totalMarks",
         CASE t.status::text WHEN 'draft' THEN 'draft' WHEN 'archived' THEN 'archived' WHEN 'completed' THEN 'closed' ELSE 'published' END,
         t."scheduledStart",
         t."scheduledEnd",
         u."openId",
         COALESCE(s.config::jsonb, '{}'::jsonb),
         COALESCE(t."securityConfig"::jsonb, '{}'::jsonb),
         COALESCE((s.config::jsonb ->> 'resultsReleased')::boolean, false),
         t."createdAt",
         t."updatedAt",
         'tc:' || t.id,
         COALESCE((t."securityConfig"::jsonb ->> 'aiProctoringEnabled')::boolean, false)
    FROM public.tc_tests t
    JOIN public.tc_users u ON u.id = t."creatorId"
    JOIN public.classrooms c ON c.id::text = t."classroomId"
    LEFT JOIN public.tc_test_settings s ON s."testId" = t.id
   WHERE NOT EXISTS (SELECT 1 FROM public.tests x WHERE x.legacy_source = 'tc:' || t.id);

  -- Questions with options; correctness moves into the server-only answer_key.
  INSERT INTO public.test_questions (test_id, position, type, prompt, options, answer_key, marks, negative_marks, explanation, coding)
  SELECT nt.id,
         tq.position,
         CASE q.type::text WHEN 'fill_blank' THEN 'fill_blank' ELSE q.type::text END,
         q."questionText",
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', 'o' || o.position, 'text', o.text) ORDER BY o.position)
                     FROM public.tc_question_options o WHERE o."questionId" = q.id), '[]'::jsonb),
         CASE
           WHEN q.type::text IN ('mcq', 'true_false') THEN
             jsonb_build_object('correctOptionIds',
               COALESCE((SELECT jsonb_agg('o' || o.position) FROM public.tc_question_options o WHERE o."questionId" = q.id AND o."isCorrect"), '[]'::jsonb),
               'text', q."correctAnswer")
           WHEN q.type::text = 'multiple_select' THEN
             jsonb_build_object('correctOptionIds',
               COALESCE((SELECT jsonb_agg('o' || o.position) FROM public.tc_question_options o WHERE o."questionId" = q.id AND o."isCorrect"), '[]'::jsonb))
           WHEN q.type::text = 'numerical' THEN jsonb_build_object('value', q."correctAnswer", 'tolerance', 0)
           ELSE jsonb_build_object('acceptedAnswers', jsonb_build_array(q."correctAnswer"), 'modelAnswer', q."correctAnswer")
         END,
         q.marks,
         q."negativeMarks",
         q.explanation,
         CASE WHEN q.type::text = 'coding' THEN jsonb_build_object('languages', jsonb_build_array('python', 'javascript', 'cpp', 'java'), 'starterCode', jsonb_build_object('python', COALESCE(q."codeSnippet", ''))) ELSE NULL END
    FROM public.tc_test_questions tq
    JOIN public.tc_questions q ON q.id = tq."questionId"
    JOIN public.tests nt ON nt.legacy_source = 'tc:' || tq."testId"
   WHERE NOT EXISTS (SELECT 1 FROM public.test_questions x WHERE x.test_id = nt.id);

  -- Recompute marks totals from imported questions when the source total was 0.
  UPDATE public.tests t
     SET total_marks = sub.total
    FROM (SELECT test_id, SUM(marks) AS total FROM public.test_questions GROUP BY test_id) sub
   WHERE sub.test_id = t.id AND t.legacy_source LIKE 'tc:%' AND COALESCE(t.total_marks, 0) = 0;

  RAISE NOTICE 'test_creation import complete.';
END $$;
