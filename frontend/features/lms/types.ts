export type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'short_answer' | 'long_answer' | 'numerical' | 'fill_blank' | 'coding' | 'file_upload';
export type LanguageId = 'c' | 'cpp' | 'java' | 'python' | 'javascript' | 'typescript' | 'csharp' | 'go' | 'rust' | 'php' | 'ruby' | 'kotlin' | 'swift';
export type Availability = 'draft' | 'scheduled' | 'active' | 'ended' | 'archived';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  multiple_select: 'Multiple select',
  true_false: 'True / False',
  short_answer: 'Short answer',
  fill_blank: 'Fill in the blank',
  long_answer: 'Long answer',
  numerical: 'Numerical',
  coding: 'Coding',
  file_upload: 'File upload',
};

export type TestCase = { id?: string; input: string; expectedOutput: string; isHidden: boolean; weight: number };
export type CodingConfig = { languages: LanguageId[]; starterCode: Record<string, string>; timeLimitMs: number; memoryLimitMb: number };

export type EditableQuestion = {
  id?: string;
  type: QuestionType;
  prompt: string;
  options: Array<{ id?: string; text: string; isCorrect: boolean }>;
  marks: number;
  negativeMarks: number;
  explanation?: string | null;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  numericAnswer?: number | null;
  numericTolerance: number;
  partialCredit: boolean;
  modelAnswer?: string | null;
  coding?: CodingConfig | null;
  testCases: TestCase[];
};

export type TestConfig = {
  attemptLimit: number; shuffleQuestions: boolean; shuffleOptions: boolean; negativeMarking: boolean; allowBackNavigation: boolean;
  releaseResultsImmediately: boolean; showCorrectAnswers: boolean; submissionGraceSeconds: number;
};
export type SecurityConfig = {
  requireCamera: boolean; requireIdentityVerification: boolean; livenessCheck: boolean; requireFullscreen: boolean; tabSwitchDetection: boolean; blockClipboard: boolean;
  liveProctoring: boolean; identityRecheckSeconds: number; proctoringFailurePolicy: 'block' | 'warn' | 'manual_review';
  cameraDisconnectPolicy: 'flag' | 'pause'; fullscreenExitPolicy: 'flag' | 'pause'; warningEscalationThreshold: number;
  thresholds: { lookAwaySeconds: number; headYawDegrees: number; headPitchDegrees: number; faceAbsentSeconds: number; multiFaceSeconds: number; cooldownSeconds: number };
  evidenceRetentionDays: number;
};

export type TeacherTestSummary = {
  id: string; classroomId: string; title: string; subject: string | null; description: string | null; instructions: string | null;
  status: 'draft' | 'published' | 'closed' | 'archived'; availability: Availability; durationMinutes: number; totalMarks: number; passingMarks: number | null;
  scheduledStart: string | null; scheduledEnd: string | null; examMode: 'standard' | 'coding'; resultsReleased: boolean; config: TestConfig; security: SecurityConfig;
  createdAt: string; updatedAt: string | null; publishedAt: string | null; questionCount?: number;
  stats?: { active: number; submitted: number; pendingReview: number };
};
export type TeacherTestDetail = TeacherTestSummary & { attemptCount: number; questionsLocked: boolean; questions: EditableQuestion[] };

export type StudentTest = {
  id: string; title: string; subject: string | null; description: string | null; instructions: string | null; durationMinutes: number; totalMarks: number; passingMarks: number | null;
  scheduledStart: string | null; scheduledEnd: string | null; examMode: 'standard' | 'coding'; availability: Availability; proctored: boolean;
  requirements: { camera: boolean; identity: boolean; fullscreen: boolean }; attemptLimit: number; attemptsUsed: number; openAttemptId: string | null; canStart: boolean;
  myStatus: 'not_started' | 'in_progress' | 'submitted' | 'evaluated' | 'results_published' | 'missed';
  result: { attemptId: string; score: number | null; maxScore: number | null; percentage: number | null } | null; lastAttemptId: string | null; submittedAt?: string | null;
  classroomId?: string; classroomName?: string;
};

export type StudentQuestion = {
  id: string; type: QuestionType; prompt: string; marks: number; negativeMarks: number; options: Array<{ id: string; text: string }>;
  coding: { languages: LanguageId[]; starterCode: Record<string, string>; timeLimitMs: number; sampleTestCases: Array<{ input: string; expectedOutput: string }> } | null;
};

export type AttemptState = {
  attempt: { id: string; status: string; attemptNumber: number; startedAt: string; expiresAt: string | null; identityStatus: 'not_required' | 'pending' | 'verified' | 'failed' | 'manual_review'; consentAt: string | null; warningCount: number };
  serverTime: string;
  test: { id: string; title: string; instructions: string | null; description: string | null; durationMinutes: number; totalMarks: number; examMode: 'standard' | 'coding'; allowBackNavigation: boolean; security: Pick<SecurityConfig, 'requireCamera' | 'requireIdentityVerification' | 'livenessCheck' | 'requireFullscreen' | 'tabSwitchDetection' | 'blockClipboard' | 'liveProctoring' | 'identityRecheckSeconds' | 'proctoringFailurePolicy' | 'cameraDisconnectPolicy' | 'fullscreenExitPolicy' | 'thresholds'> };
  questions: StudentQuestion[];
  answers: Record<string, { response: unknown; markedForReview: boolean; revision: number; savedAt: string }>;
};

export type Language = { id: LanguageId; label: string; monaco: string; fileName: string; compiled: boolean; starter: string };

export type RunResult = {
  mode: 'custom' | 'samples' | 'all';
  run?: { status: string; stdout: string; stderr: string; compileOutput: string; exitCode: number | null; timeMs: number | null; memoryKb: number | null; truncated: boolean };
  compileError?: string | null;
  results?: Array<{ testCaseId: string; hidden: boolean; passed: boolean; weight: number; status: string; timeMs: number | null; stdout?: string; expectedOutput?: string; stderr?: string; input?: string }>;
  passed?: number; total?: number;
};

export type Assignment = {
  id: string; classroomId: string; title: string; description: string | null; instructions: string | null; assignmentType: 'text' | 'file' | 'document' | 'coding' | 'mixed';
  status: 'draft' | 'published' | 'closed' | 'archived'; availableFrom: string | null; dueAt: string | null; totalMarks: number;
  latePolicy: { allowLate: boolean; penaltyPercentPerDay: number; maxLateDays: number }; acceptedFileTypes: string[]; maxFileSizeMb: number; maxFiles: number; allowResubmission: boolean;
  coding: CodingConfig | null; createdAt: string; updatedAt: string; publishedAt: string | null;
  stats?: { enrolled: number; submitted: number; late: number; evaluated: number; pending: number };
  mySubmission?: { status: string; submittedAt: string | null; isLate: boolean; finalScore: number | null } | null;
  myStatus?: string;
  role?: 'teacher' | 'student';
  attachments?: Array<{ id: string; name: string; mime: string; size: number; createdAt: string }>;
  testCases?: TestCase[];
};

export type Submission = {
  id: string; status: 'draft' | 'submitted' | 'late' | 'evaluated' | 'returned'; textResponse: string | null; code: { language: LanguageId; source: string } | null;
  submittedAt: string | null; isLate: boolean; lateDays: number; revision: number; updatedAt: string;
  files: Array<{ id: string; name: string; mime: string; size: number; createdAt: string }>;
  score?: number | null; penaltyPercent?: number; finalScore?: number | null; feedback?: string | null; evaluatedAt?: string | null; returnedAt?: string | null;
};

export const DEFAULT_CONFIG: TestConfig = { attemptLimit: 1, shuffleQuestions: false, shuffleOptions: false, negativeMarking: false, allowBackNavigation: true, releaseResultsImmediately: false, showCorrectAnswers: false, submissionGraceSeconds: 20 };
export const DEFAULT_SECURITY: SecurityConfig = {
  requireCamera: false, requireIdentityVerification: false, livenessCheck: true, requireFullscreen: true, tabSwitchDetection: true, blockClipboard: true, liveProctoring: false,
  identityRecheckSeconds: 180, proctoringFailurePolicy: 'warn', cameraDisconnectPolicy: 'flag', fullscreenExitPolicy: 'flag', warningEscalationThreshold: 5,
  thresholds: { lookAwaySeconds: 4, headYawDegrees: 35, headPitchDegrees: 25, faceAbsentSeconds: 5, multiFaceSeconds: 2, cooldownSeconds: 20 }, evidenceRetentionDays: 30,
};
