-- Synthetic data shaped like the live project BEFORE the 20261105* migrations:
-- accounts without public.users profiles, a teacher owning several classrooms,
-- an enrolled student with a legacy face descriptor, and three portal (tc_*)
-- tests with the same structure as production (one draft with start = end,
-- one scheduled+proctored, one "live" test without a classroom).
-- No real personal data.

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'legacy.teacher@example.test', '{"role":"teacher","full_name":"Legacy Teacher","phone":"+910000000001"}'),
  ('a0000000-0000-4000-8000-000000000002', 'legacy.student@example.test', '{"role":"student","full_name":"Legacy Student"}'),
  ('a0000000-0000-4000-8000-000000000003', 'no.meta@example.test', '{}'),
  ('a0000000-0000-4000-8000-000000000004', 'other.student@example.test', '{"role":"student"}');

INSERT INTO public.classrooms (id, name, code, user_id, created_at) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Legacy Physics', 'LEG001', 'a0000000-0000-4000-8000-000000000001', now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000002', 'Legacy Chemistry', 'LEG002', 'a0000000-0000-4000-8000-000000000001', now() - interval '1 day');

INSERT INTO public.students (id, classroom_id, user_id, name, email, face_registration_status, face_descriptor) VALUES
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Legacy Student', 'legacy.student@example.test', 'REGISTERED', '[0.1, 0.2, 0.3]'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'Other Student', 'other.student@example.test', 'REGISTERED', NULL);

INSERT INTO public.face_profiles (id, student_id, classroom_id) VALUES
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002');
INSERT INTO public.face_embeddings (profile_id, student_id, classroom_id, embedding, source) VALUES
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '{0.1,0.2}', 'enrollment'),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', '{0.3,0.4}', 'enrollment');

INSERT INTO public.attendance_sessions (id, classroom_id, nonce) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'seed-nonce-1');
INSERT INTO public.attendance (id, classroom_id, student_id_legacy, student_name, session_id, student_id) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'Legacy Student', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002');

INSERT INTO public.tc_users (id, "openId", name, email, role) VALUES
  (1, 'a0000000-0000-4000-8000-000000000001', 'Legacy Teacher', 'legacy.teacher@example.test', 'teacher');
INSERT INTO public.tc_classrooms (id, "ownerId", name) VALUES
  ('c0000000-0000-4000-8000-000000000001', 1, 'Legacy Physics');

INSERT INTO public.tc_tests (id, "creatorId", "classroomId", name, subject, status, "totalMarks", "securityConfig", "scheduledStart", "scheduledEnd") VALUES
  ('tcDraft000000000000001', 1, 'c0000000-0000-4000-8000-000000000001', 'Portal draft quiz', 'Physics', 'draft', 50,
   '{"fullscreenMode":false,"cameraMonitoring":false,"faceVerification":false,"tabSwitchDetection":true,"aiProctoringEnabled":false,"copyPasteRestriction":false,"eventCooldownSeconds":20,"proctoringFailurePolicy":"warn"}',
   '2026-09-02 03:58:00', '2026-09-02 03:58:00'),
  ('tcSched000000000000002', 1, 'c0000000-0000-4000-8000-000000000001', 'Portal proctored test', 'Physics', 'scheduled', 50,
   '{"fullscreenMode":true,"cameraMonitoring":true,"faceVerification":true,"tabSwitchDetection":true,"aiProctoringEnabled":true,"copyPasteRestriction":true,"eventCooldownSeconds":20,"proctoringFailurePolicy":"warn"}',
   '2026-08-30 11:26:00', '2026-08-30 12:29:00'),
  ('tcLive0000000000000003', 1, NULL, 'Portal live test', 'Physics', 'live', 50,
   '{"fullscreenMode":false,"cameraMonitoring":false,"faceVerification":false,"tabSwitchDetection":true,"aiProctoringEnabled":false,"copyPasteRestriction":false,"eventCooldownSeconds":20,"proctoringFailurePolicy":"flag"}',
   NULL, NULL);

INSERT INTO public.tc_test_settings ("testId", config)
SELECT id, '{"autoSubmit":true,"attemptLimit":1,"navigationMode":"free","shuffleOptions":true,"durationMinutes":60,"negativeMarking":true,"resultsReleased":' ||
           CASE WHEN id = 'tcLive0000000000000003' THEN 'true' ELSE 'false' END ||
           ',"shuffleQuestions":true,"allowAnswerReview":true,"passingPercentage":40,"showCorrectAnswers":true,"allowBackNavigation":true,"showResultsImmediately":true}'
  FROM public.tc_tests;

INSERT INTO public.tc_questions (id, "ownerId", subject, type, "questionText", "correctAnswer", marks, "negativeMarks", difficulty, topic) VALUES
  (101, 1, 'Physics', 'mcq', 'Unit of force?', 'Newton', 1, 0, 'easy', 'Mechanics'),
  (102, 1, 'Physics', 'mcq', 'Speed of light is about?', '3e8 m/s', 1, 0.25, 'easy', 'Optics'),
  (103, 1, 'Physics', 'mcq', 'Acceleration due to gravity?', '9.8 m/s2', 2, 0, 'easy', 'Mechanics');
INSERT INTO public.tc_question_options (id, "questionId", position, text, "isCorrect") VALUES
  (1001, 101, 0, 'Joule', false), (1002, 101, 1, 'Newton', true), (1003, 101, 2, 'Watt', false), (1004, 101, 3, 'Pascal', false),
  (1011, 102, 0, '3e8 m/s', true), (1012, 102, 1, '3e5 m/s', false), (1013, 102, 2, '340 m/s', false), (1014, 102, 3, '1 m/s', false),
  (1021, 103, 0, '1.6 m/s2', false), (1022, 103, 1, '9.8 m/s2', true), (1023, 103, 2, '24 m/s2', false), (1024, 103, 3, '0 m/s2', false);
INSERT INTO public.tc_test_questions ("testId", "questionId", position) VALUES
  ('tcDraft000000000000001', 101, 0),
  ('tcSched000000000000002', 101, 0), ('tcSched000000000000002', 102, 1), ('tcSched000000000000002', 103, 2),
  ('tcLive0000000000000003', 102, 0), ('tcLive0000000000000003', 103, 1);
