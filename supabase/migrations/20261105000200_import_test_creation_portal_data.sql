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

  -- Tests attached to a NeuroClass classroom keep it. Tests created without a
  -- classroom go to the creator's newest NeuroClass classroom as a DRAFT (never
  -- auto-published to a class it was not meant for); the teacher can duplicate
  -- it elsewhere. Creator is matched by auth uid (openId) or email.
  -- Settings are mapped key-by-key: the new API discards configs it cannot parse.
  -- tc timestamps are UTC "timestamp without time zone".
  INSERT INTO public.tests (id, classroom_id, title, subject, description, instructions, duration_mins,
                            total_marks, passing_marks, status, scheduled_start, scheduled_end, created_by, config, security,
                            results_released, created_at, updated_at, legacy_source, proctoring_enabled)
  SELECT gen_random_uuid(),
         coalesce(direct.id, fallback.id),
         left(t."name", 250),
         t.subject,
         t.description,
         t.instructions,
         greatest(1, least(600, coalesce(nullif(cfg ->> 'durationMinutes', '')::int, 60))),
         0,
         NULL,
         CASE WHEN direct.id IS NULL THEN 'draft'
              ELSE CASE t.status::text WHEN 'draft' THEN 'draft' WHEN 'archived' THEN 'archived' WHEN 'completed' THEN 'closed' ELSE 'published' END END,
         t."scheduledStart" AT TIME ZONE 'UTC',
         CASE WHEN t."scheduledEnd" IS NOT NULL AND (t."scheduledStart" IS NULL OR t."scheduledEnd" > t."scheduledStart")
              THEN t."scheduledEnd" AT TIME ZONE 'UTC' END,
         coalesce(au.id::text, u."openId"),
         jsonb_strip_nulls(jsonb_build_object(
           'attemptLimit', greatest(1, least(10, coalesce((cfg ->> 'attemptLimit')::int, 1))),
           'shuffleQuestions', coalesce((cfg ->> 'shuffleQuestions')::boolean, false),
           'shuffleOptions', coalesce((cfg ->> 'shuffleOptions')::boolean, false),
           'negativeMarking', coalesce((cfg ->> 'negativeMarking')::boolean, false),
           'allowBackNavigation', coalesce((cfg ->> 'allowBackNavigation')::boolean, true),
           'releaseResultsImmediately', coalesce((cfg ->> 'showResultsImmediately')::boolean, false),
           'showCorrectAnswers', coalesce((cfg ->> 'showCorrectAnswers')::boolean, false),
           'ncLegacyPassingPercentage', (cfg ->> 'passingPercentage')::numeric)),
         jsonb_build_object(
           'requireCamera', coalesce((sec ->> 'cameraMonitoring')::boolean, false),
           'requireIdentityVerification', coalesce((sec ->> 'faceVerification')::boolean, false),
           'requireFullscreen', coalesce((sec ->> 'fullscreenMode')::boolean, false),
           'tabSwitchDetection', coalesce((sec ->> 'tabSwitchDetection')::boolean, true),
           'blockClipboard', coalesce((sec ->> 'copyPasteRestriction')::boolean, false),
           'liveProctoring', coalesce((sec ->> 'aiProctoringEnabled')::boolean, false),
           'proctoringFailurePolicy', CASE WHEN sec ->> 'proctoringFailurePolicy' IN ('block', 'warn', 'manual_review') THEN sec ->> 'proctoringFailurePolicy' ELSE 'warn' END,
           'thresholds', jsonb_build_object('cooldownSeconds', greatest(3, least(300, coalesce((sec ->> 'eventCooldownSeconds')::numeric, 20))))),
         coalesce((cfg ->> 'resultsReleased')::boolean, false) AND direct.id IS NOT NULL,
         t."createdAt" AT TIME ZONE 'UTC',
         t."updatedAt" AT TIME ZONE 'UTC',
         'tc:' || t.id,
         coalesce((sec ->> 'aiProctoringEnabled')::boolean, false)
    FROM public.tc_tests t
    JOIN public.tc_users u ON u.id = t."creatorId"
    LEFT JOIN public.tc_test_settings s ON s."testId" = t.id
    LEFT JOIN LATERAL (SELECT a.id FROM auth.users a
                        WHERE a.id::text = u."openId" OR (u.email IS NOT NULL AND lower(a.email) = lower(u.email))
                        ORDER BY (a.id::text = u."openId") DESC LIMIT 1) au ON true
    LEFT JOIN public.classrooms direct ON direct.id::text = t."classroomId" AND direct.user_id = au.id::text
    LEFT JOIN LATERAL (SELECT c.id FROM public.classrooms c WHERE c.user_id = au.id::text ORDER BY c.created_at DESC LIMIT 1) fallback ON true
    CROSS JOIN LATERAL (SELECT coalesce(nullif(s.config, '')::jsonb, '{}'::jsonb) AS cfg,
                               coalesce(nullif(t."securityConfig", '')::jsonb, '{}'::jsonb) AS sec) j
   WHERE coalesce(direct.id, fallback.id) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tests x WHERE x.legacy_source = 'tc:' || t.id);

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

  -- Totals and pass marks always come from the imported questions (the portal
  -- stored a fixed 50 regardless of the questions actually attached).
  UPDATE public.tests t
     SET total_marks = sub.total,
         passing_marks = CASE WHEN t.config ? 'ncLegacyPassingPercentage'
                              THEN round(sub.total * (t.config ->> 'ncLegacyPassingPercentage')::numeric / 100, 2)
                              ELSE t.passing_marks END,
         config = t.config - 'ncLegacyPassingPercentage'
    FROM (SELECT test_id, SUM(marks) AS total FROM public.test_questions GROUP BY test_id) sub
   WHERE sub.test_id = t.id AND t.legacy_source LIKE 'tc:%'
     AND (t.total_marks IS DISTINCT FROM sub.total OR t.config ? 'ncLegacyPassingPercentage');

  RAISE NOTICE 'test_creation import complete: % tests imported in total.', (SELECT count(*) FROM public.tests WHERE legacy_source LIKE 'tc:%');
END $$;
