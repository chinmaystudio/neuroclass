// Mock backend for the UI audit: a realistic teacher + student world.
const now = Date.now();
const iso = (offsetHours) => new Date(now + offsetHours * 3600_000).toISOString();

export const TEACHER = { id: '11111111-1111-4111-8111-111111111111', email: 'priya.sharma@school.edu', user_metadata: { full_name: 'Priya Sharma', role: 'teacher' } };
export const STUDENT = { id: '22222222-2222-4222-8222-222222222222', email: 'arjun.mehta@school.edu', user_metadata: { full_name: 'Arjun Mehta', role: 'student' } };

export const CLASSROOMS = [
  { id: 'c1000000-0000-4000-8000-000000000001', name: 'Computer Engineering — Data Structures', code: 'DSA24X', subject: 'Computer Science', user_id: TEACHER.id, students: 32, attendance: '91%', status: 'Active', created_at: iso(-900) },
  { id: 'c1000000-0000-4000-8000-000000000002', name: 'Physics 101', code: 'PHY101', subject: 'Physics', user_id: TEACHER.id, students: 28, attendance: '86%', status: 'Active', created_at: iso(-600) },
  { id: 'c1000000-0000-4000-8000-000000000003', name: 'Applied Mathematics II', code: 'MTH202', subject: 'Mathematics', user_id: TEACHER.id, students: 41, attendance: '78%', status: 'Active', created_at: iso(-300) },
];

const names = ['Arjun Mehta', 'Sara Khan', 'Rohan Iyer', 'Ananya Rao', 'Vikram Singh', 'Neha Gupta', 'Kabir Das', 'Isha Patel'];
export const ROSTER = names.map((n, i) => ({
  id: `d0000000-0000-4000-8000-00000000000${i}`, classroom_id: CLASSROOMS[0].id, user_id: i === 0 ? STUDENT.id : `u${i}`, name: n,
  roll_number: `CE-${101 + i}`, email: n.toLowerCase().replace(' ', '.') + '@school.edu', phone: null,
  face_registration_status: i % 3 === 2 ? 'NOT_REGISTERED' : 'REGISTERED', joined_at: iso(-800 + i),
}));

const sec = { requireCamera: true, requireIdentityVerification: true, livenessCheck: true, requireFullscreen: true, tabSwitchDetection: true, blockClipboard: true, liveProctoring: true, identityRecheckSeconds: 180, proctoringFailurePolicy: 'warn', cameraDisconnectPolicy: 'flag', fullscreenExitPolicy: 'flag', warningEscalationThreshold: 5, thresholds: { lookAwaySeconds: 4, headYawDegrees: 35, headPitchDegrees: 25, faceAbsentSeconds: 5, multiFaceSeconds: 2, cooldownSeconds: 20 }, evidenceRetentionDays: 30 };
const cfg = { attemptLimit: 1, shuffleQuestions: true, shuffleOptions: true, negativeMarking: false, allowBackNavigation: true, releaseResultsImmediately: false, showCorrectAnswers: false, submissionGraceSeconds: 20 };

export const TEACHER_TESTS = [
  { id: 'e1000000-0000-4000-8000-000000000001', classroomId: CLASSROOMS[0].id, title: 'Mid-term: Trees and Graphs', subject: 'Computer Science', description: 'Covers BST, AVL, BFS/DFS.', instructions: 'Answer all questions.', status: 'published', durationMinutes: 60, totalMarks: 50, passingMarks: 20, scheduledStart: iso(20), scheduledEnd: iso(23), examMode: 'standard', resultsReleased: false, config: cfg, security: sec, createdAt: iso(-48), updatedAt: iso(-2), publishedAt: iso(-2), questionCount: 18, availability: 'scheduled', stats: { active: 0, submitted: 0, pendingReview: 0 } },
  { id: 'e1000000-0000-4000-8000-000000000002', classroomId: CLASSROOMS[0].id, title: 'Quiz 3: Linked Lists', subject: 'Computer Science', description: null, instructions: null, status: 'published', durationMinutes: 20, totalMarks: 10, passingMarks: 4, scheduledStart: iso(-1), scheduledEnd: iso(5), examMode: 'standard', resultsReleased: false, config: cfg, security: { ...sec, liveProctoring: false, requireIdentityVerification: false, requireCamera: false }, createdAt: iso(-100), updatedAt: iso(-1), publishedAt: iso(-1), questionCount: 10, availability: 'active', stats: { active: 6, submitted: 19, pendingReview: 0 } },
  { id: 'e1000000-0000-4000-8000-000000000003', classroomId: CLASSROOMS[0].id, title: 'Coding lab: Sorting', subject: 'Computer Science', description: null, instructions: null, status: 'closed', durationMinutes: 90, totalMarks: 30, passingMarks: 12, scheduledStart: iso(-200), scheduledEnd: iso(-190), examMode: 'coding', resultsReleased: true, config: cfg, security: sec, createdAt: iso(-300), updatedAt: iso(-190), publishedAt: iso(-210), questionCount: 3, availability: 'ended', stats: { active: 0, submitted: 30, pendingReview: 4 } },
  { id: 'e1000000-0000-4000-8000-000000000004', classroomId: CLASSROOMS[0].id, title: 'Draft: Hashing practice', subject: 'Computer Science', description: null, instructions: null, status: 'draft', durationMinutes: 30, totalMarks: 0, passingMarks: null, scheduledStart: null, scheduledEnd: null, examMode: 'standard', resultsReleased: false, config: cfg, security: sec, createdAt: iso(-5), updatedAt: iso(-5), publishedAt: null, questionCount: 0, availability: 'draft', stats: { active: 0, submitted: 0, pendingReview: 0 } },
];

const lp = { allowLate: true, penaltyPercentPerDay: 10, maxLateDays: 3 };
export const ASSIGNMENTS = [
  { id: 'a1000000-0000-4000-8000-000000000001', classroomId: CLASSROOMS[0].id, title: 'Implement a min-heap', description: 'Write insert, extract-min and heapify.', instructions: 'Submit your code and a short README.', assignmentType: 'coding', status: 'published', availableFrom: null, dueAt: iso(30), totalMarks: 20, latePolicy: lp, acceptedFileTypes: ['pdf', 'zip'], maxFileSizeMb: 10, maxFiles: 3, allowResubmission: true, coding: { languages: ['python', 'cpp', 'java'], starterCode: {}, timeLimitMs: 2000, memoryLimitMb: 256 }, createdAt: iso(-72), updatedAt: iso(-72), publishedAt: iso(-72), stats: { enrolled: 32, submitted: 11, late: 1, evaluated: 4, pending: 7 }, myStatus: 'not_started', mySubmission: null },
  { id: 'a1000000-0000-4000-8000-000000000002', classroomId: CLASSROOMS[0].id, title: 'Essay: When to use a B-tree', description: '600–800 words.', instructions: null, assignmentType: 'document', status: 'published', availableFrom: null, dueAt: iso(-20), totalMarks: 10, latePolicy: lp, acceptedFileTypes: ['pdf', 'docx'], maxFileSizeMb: 10, maxFiles: 1, allowResubmission: false, coding: null, createdAt: iso(-200), updatedAt: iso(-200), publishedAt: iso(-200), stats: { enrolled: 32, submitted: 29, late: 3, evaluated: 29, pending: 0 }, myStatus: 'returned', mySubmission: { status: 'returned', submittedAt: iso(-30), isLate: false, finalScore: 8 } },
];

const studentTests = [
  { ...TEACHER_TESTS[1], proctored: false, requirements: { camera: false, identity: false, fullscreen: true }, attemptLimit: 1, attemptsUsed: 0, openAttemptId: null, canStart: true, myStatus: 'not_started', result: null, lastAttemptId: null, classroomId: CLASSROOMS[0].id, classroomName: CLASSROOMS[0].name },
  { ...TEACHER_TESTS[0], proctored: true, requirements: { camera: true, identity: true, fullscreen: true }, attemptLimit: 1, attemptsUsed: 0, openAttemptId: null, canStart: false, myStatus: 'not_started', result: null, lastAttemptId: null, classroomId: CLASSROOMS[0].id, classroomName: CLASSROOMS[0].name },
  { ...TEACHER_TESTS[2], proctored: true, requirements: { camera: true, identity: true, fullscreen: true }, attemptLimit: 1, attemptsUsed: 1, openAttemptId: null, canStart: false, myStatus: 'results_published', result: { attemptId: 'f1', score: 24, maxScore: 30, percentage: 80 }, lastAttemptId: 'f1', submittedAt: iso(-195), classroomId: CLASSROOMS[0].id, classroomName: CLASSROOMS[0].name },
];

export function apiResponse(path, method, role) {
  const p = path.replace(/^\/api\/v1\//, '').split('?')[0];
  if (p.match(/^classrooms\/[^/]+\/tests$/)) return role === 'teacher' ? { role, tests: TEACHER_TESTS } : { role, tests: studentTests };
  if (p === 'me/tests') return { tests: studentTests };
  if (p.match(/^classrooms\/[^/]+\/assignments$/)) return { assignments: ASSIGNMENTS.map((a) => ({ ...a, role })) };
  if (p.match(/^tests\/[^/]+$/)) return { ...TEACHER_TESTS[0], attemptCount: 0, questionsLocked: false, questions: [
    { id: 'q1', type: 'mcq', prompt: 'What is the height of a balanced BST with n nodes?', options: [{ id: 'o0', text: 'O(n)', isCorrect: false }, { id: 'o1', text: 'O(log n)', isCorrect: true }, { id: 'o2', text: 'O(1)', isCorrect: false }], marks: 2, negativeMarks: 0, acceptedAnswers: [], caseSensitive: false, numericTolerance: 0, partialCredit: false, testCases: [] },
    { id: 'q2', type: 'long_answer', prompt: 'Explain the difference between BFS and DFS.', options: [], marks: 8, negativeMarks: 0, acceptedAnswers: [], caseSensitive: false, numericTolerance: 0, partialCredit: false, modelAnswer: 'BFS explores level by level…', testCases: [] },
  ] };
  if (p.match(/^tests\/[^/]+\/results$/)) return { test: TEACHER_TESTS[2], metrics: { enrolled: 32, attempted: 30, submitted: 30, evaluated: 26, average: 21.4, highest: 30, lowest: 9, passRate: 83 }, attempts: ROSTER.slice(0, 6).map((s, i) => ({ id: `at${i}`, studentName: s.name, studentEmail: s.email, rollNumber: s.roll_number, status: i < 4 ? 'evaluated' : 'submitted', score: 18 + i, maxScore: 30, percentage: 60 + i * 5, startedAt: iso(-196), submittedAt: iso(-195), integrityScore: 95 - i * 8, riskLevel: i > 3 ? 'medium' : 'low', warningCount: i, identityStatus: 'verified', attemptNumber: 1 })), questions: [] };
  if (p.match(/^tests\/[^/]+\/monitor$/)) return { attempts: [] };
  if (p === 'code/languages') return { languages: [] };
  if (p === 'proctoring/status') return { face: { configured: true, reachable: true }, ml: { configured: true, reachable: true } };
  if (p.match(/^assignments\/[^/]+\/submissions$/)) return { assignment: ASSIGNMENTS[0], students: ROSTER.map((s, i) => ({ student: { id: s.id, name: s.name, email: s.email, rollNumber: s.roll_number }, submission: i % 2 ? { id: `s${i}`, status: i % 4 === 1 ? 'submitted' : 'evaluated', textResponse: null, code: null, submittedAt: iso(-10), isLate: i === 3, lateDays: i === 3 ? 1 : 0, revision: 1, updatedAt: iso(-10), files: [], finalScore: i % 4 === 1 ? null : 15 } : null })) };
  if (p.match(/^assignments\/[^/]+\/my-submission$/)) return { submission: null };
  if (p.match(/^assignments\/[^/]+$/)) return { ...ASSIGNMENTS[0], role, attachments: [], testCases: [] };
  return {};
}

export function legacyApi(path) {
  if (path.startsWith('/api/attendance/active')) return { session: null };
  if (path.startsWith('/api/materials')) return { materials: [] };
  if (path.startsWith('/api/google-drive/status')) return { connected: false };
  return {};
}

/** Minimal PostgREST: returns rows per table with simple eq/in filtering. */
export function restRows(table, url, role) {
  const q = new URL(url).searchParams;
  const eq = (col) => { const v = q.get(col); return v && v.startsWith('eq.') ? v.slice(3) : null; };
  const user = role === 'teacher' ? TEACHER : STUDENT;
  switch (table) {
    case 'users': return [{ uid: user.id, email: user.email, displayname: user.user_metadata.full_name, role, mobile_number: null }];
    case 'classrooms': {
      if (role === 'student') return CLASSROOMS.slice(0, 2).map((c) => ({ ...c }));
      let rows = CLASSROOMS.map((c) => ({ ...c, students: [{ count: c.students }] }));
      const id = eq('id'); if (id) rows = rows.filter((r) => r.id === id).map((r) => ({ ...r, students: CLASSROOMS.find((c) => c.id === r.id).students }));
      return rows;
    }
    case 'students': {
      if (role === 'student') return CLASSROOMS.slice(0, 2).map((c, i) => ({ ...ROSTER[0], id: `d9${i}`, classroom_id: c.id, classrooms: c }));
      return ROSTER;
    }
    case 'attendance': return [{ id: 'at1', classroom_id: CLASSROOMS[0].id, student_id: 'd90', status: 'Present', verified_at: iso(-24), verification_method: 'face' }, { id: 'at2', classroom_id: CLASSROOMS[0].id, student_id: 'd90', status: 'Present', verified_at: iso(-48), verification_method: 'face' }];
    case 'evaluations': return [];
    default: return [];
  }
}
