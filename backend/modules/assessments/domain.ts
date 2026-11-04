import { z } from 'zod';
import { LANGUAGE_IDS } from '../coding/languages';

/* ------------------------------------------------------------------ */
/* Question model                                                      */
/* ------------------------------------------------------------------ */
export const QUESTION_TYPES = ['mcq', 'multiple_select', 'true_false', 'short_answer', 'long_answer', 'numerical', 'fill_blank', 'coding', 'file_upload'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const OBJECTIVE_TYPES: ReadonlySet<QuestionType> = new Set(['mcq', 'multiple_select', 'true_false', 'numerical', 'short_answer', 'fill_blank']);
export const MANUAL_TYPES: ReadonlySet<QuestionType> = new Set(['long_answer', 'file_upload']);

const optionInput = z.object({
  id: z.string().trim().min(1).max(20).optional(),
  text: z.string().trim().min(1).max(4000),
  isCorrect: z.boolean().default(false),
});

const testCaseInput = z.object({
  id: z.string().uuid().optional(),
  input: z.string().max(65536).default(''),
  expectedOutput: z.string().max(65536).default(''),
  isHidden: z.boolean().default(true),
  weight: z.number().positive().max(100).default(1),
});
export type TestCaseInput = z.infer<typeof testCaseInput>;

const codingConfig = z.object({
  languages: z.array(z.enum(LANGUAGE_IDS)).min(1).max(LANGUAGE_IDS.length),
  starterCode: z.record(z.string().max(20000)).default({}),
  timeLimitMs: z.number().int().min(500).max(10000).default(3000),
  memoryLimitMb: z.number().int().min(32).max(512).default(256),
});
export type CodingConfig = z.infer<typeof codingConfig>;

export const questionInputSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().min(1).max(20000),
  options: z.array(optionInput).max(12).default([]),
  marks: z.number().min(0).max(1000).default(1),
  negativeMarks: z.number().min(0).max(1000).default(0),
  explanation: z.string().max(10000).optional().nullable(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(2000)).max(20).default([]),
  caseSensitive: z.boolean().default(false),
  numericAnswer: z.number().finite().optional().nullable(),
  numericTolerance: z.number().min(0).max(1e9).default(0),
  partialCredit: z.boolean().default(false),
  modelAnswer: z.string().max(20000).optional().nullable(),
  coding: codingConfig.optional().nullable(),
  testCases: z.array(testCaseInput).max(50).default([]),
}).superRefine((q, ctx) => {
  const correct = q.options.filter((o) => o.isCorrect).length;
  if (q.type === 'mcq' || q.type === 'multiple_select') {
    if (q.options.length < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least two options.' });
    if (correct < 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mark at least one correct option.' });
    if (q.type === 'mcq' && correct > 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'A single-choice question can only have one correct option.' });
  }
  if (q.type === 'true_false' && correct !== 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Choose whether the statement is true or false.' });
  if (q.type === 'numerical' && (q.numericAnswer === undefined || q.numericAnswer === null)) ctx.addIssue({ code: 'custom', path: ['numericAnswer'], message: 'Enter the correct numerical answer.' });
  if ((q.type === 'short_answer' || q.type === 'fill_blank') && q.acceptedAnswers.length === 0) ctx.addIssue({ code: 'custom', path: ['acceptedAnswers'], message: 'Add at least one accepted answer.' });
  if (q.type === 'coding') {
    if (!q.coding) ctx.addIssue({ code: 'custom', path: ['coding'], message: 'Choose at least one programming language.' });
    if (q.testCases.length === 0) ctx.addIssue({ code: 'custom', path: ['testCases'], message: 'Add at least one test case.' });
  }
  if (q.negativeMarks > q.marks) ctx.addIssue({ code: 'custom', path: ['negativeMarks'], message: 'Negative marks cannot exceed the question marks.' });
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

export type StoredOption = { id: string; text: string };
export type AnswerKey = {
  correctOptionIds?: string[];
  partialCredit?: boolean;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  value?: number;
  tolerance?: number;
  modelAnswer?: string | null;
  text?: string | null;
};
export type QuestionRow = {
  id: string;
  test_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: StoredOption[];
  answer_key: AnswerKey;
  marks: number;
  negative_marks: number;
  explanation: string | null;
  coding: CodingConfig | null;
};

/** Splits teacher input into public options and the server-only answer key. */
export function toStoredQuestion(input: QuestionInput, position: number) {
  const type = input.type;
  let options: StoredOption[] = [];
  let answerKey: AnswerKey = {};
  if (type === 'true_false') {
    const trueCorrect = input.options.length ? Boolean(input.options.find((o) => /^true$/i.test(o.text))?.isCorrect ?? input.options[0]?.isCorrect) : true;
    options = [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
    answerKey = { correctOptionIds: [trueCorrect ? 'true' : 'false'] };
  } else if (type === 'mcq' || type === 'multiple_select') {
    options = input.options.map((o, i) => ({ id: `o${i + 1}`, text: o.text }));
    answerKey = { correctOptionIds: input.options.map((o, i) => (o.isCorrect ? `o${i + 1}` : null)).filter(Boolean) as string[], partialCredit: type === 'multiple_select' ? input.partialCredit : undefined };
  } else if (type === 'numerical') {
    answerKey = { value: Number(input.numericAnswer), tolerance: input.numericTolerance };
  } else if (type === 'short_answer' || type === 'fill_blank') {
    answerKey = { acceptedAnswers: input.acceptedAnswers, caseSensitive: input.caseSensitive, modelAnswer: input.modelAnswer ?? input.acceptedAnswers[0] };
  } else {
    answerKey = { modelAnswer: input.modelAnswer ?? null };
  }
  return {
    position,
    type,
    prompt: input.prompt,
    options,
    answer_key: answerKey,
    marks: input.marks,
    negative_marks: input.negativeMarks,
    explanation: input.explanation ?? null,
    coding: type === 'coding' ? input.coding ?? null : null,
  };
}

/** Rebuilds the editor form from stored data (teacher-only). */
export function toEditableQuestion(row: QuestionRow, testCases: Array<{ id: string; input: string; expected_output: string; is_hidden: boolean; weight: number }>) {
  const correct = new Set(row.answer_key?.correctOptionIds ?? []);
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    options: (row.options ?? []).map((o) => ({ id: o.id, text: o.text, isCorrect: correct.has(o.id) })),
    marks: Number(row.marks),
    negativeMarks: Number(row.negative_marks ?? 0),
    explanation: row.explanation,
    acceptedAnswers: row.answer_key?.acceptedAnswers ?? [],
    caseSensitive: Boolean(row.answer_key?.caseSensitive),
    numericAnswer: row.answer_key?.value ?? null,
    numericTolerance: Number(row.answer_key?.tolerance ?? 0),
    partialCredit: Boolean(row.answer_key?.partialCredit),
    modelAnswer: row.answer_key?.modelAnswer ?? null,
    coding: row.coding,
    testCases: testCases.map((t) => ({ id: t.id, input: t.input, expectedOutput: t.expected_output, isHidden: t.is_hidden, weight: Number(t.weight) })),
  };
}

/* ------------------------------------------------------------------ */
/* Test configuration                                                  */
/* ------------------------------------------------------------------ */
export const testConfigSchema = z.object({
  attemptLimit: z.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
  allowBackNavigation: z.boolean().default(true),
  releaseResultsImmediately: z.boolean().default(false),
  showCorrectAnswers: z.boolean().default(false),
  /** Network grace window for answers that were in flight when time expired. */
  submissionGraceSeconds: z.number().int().min(0).max(120).default(20),
}).default({});
export type TestConfig = z.infer<typeof testConfigSchema>;

export const securityConfigSchema = z.object({
  requireCamera: z.boolean().default(false),
  requireIdentityVerification: z.boolean().default(false),
  /** Head-turn + blink check in the browser before each Face ID capture. */
  livenessCheck: z.boolean().default(true),
  requireFullscreen: z.boolean().default(true),
  tabSwitchDetection: z.boolean().default(true),
  blockClipboard: z.boolean().default(true),
  liveProctoring: z.boolean().default(false),
  identityRecheckSeconds: z.number().int().min(30).max(1800).default(180),
  proctoringFailurePolicy: z.enum(['block', 'warn', 'manual_review']).default('warn'),
  cameraDisconnectPolicy: z.enum(['flag', 'pause']).default('flag'),
  fullscreenExitPolicy: z.enum(['flag', 'pause']).default('flag'),
  warningEscalationThreshold: z.number().int().min(1).max(50).default(5),
  thresholds: z.object({
    lookAwaySeconds: z.number().min(1).max(60).default(4),
    headYawDegrees: z.number().min(15).max(90).default(35),
    headPitchDegrees: z.number().min(10).max(90).default(25),
    faceAbsentSeconds: z.number().min(2).max(120).default(5),
    multiFaceSeconds: z.number().min(1).max(60).default(2),
    cooldownSeconds: z.number().min(3).max(300).default(20),
  }).default({}),
  evidenceRetentionDays: z.number().int().min(1).max(365).default(30),
}).default({});
export type SecurityConfig = z.infer<typeof securityConfigSchema>;

export const testMetaSchema = z.object({
  title: z.string().trim().min(3).max(250),
  description: z.string().max(5000).optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
  subject: z.string().trim().max(200).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(600),
  passingMarks: z.number().min(0).max(10000).optional().nullable(),
  examMode: z.enum(['standard', 'coding']).default('standard'),
  scheduledStart: z.string().datetime({ offset: true }).optional().nullable(),
  scheduledEnd: z.string().datetime({ offset: true }).optional().nullable(),
  config: testConfigSchema,
  security: securityConfigSchema,
});
export type TestMeta = z.infer<typeof testMetaSchema>;

export function readConfig(raw: unknown): TestConfig {
  const parsed = testConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : testConfigSchema.parse({});
}
export function readSecurity(raw: unknown): SecurityConfig {
  const parsed = securityConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : securityConfigSchema.parse({});
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */
export type TestStatus = 'draft' | 'published' | 'closed' | 'archived';
export type Availability = 'draft' | 'scheduled' | 'active' | 'ended' | 'archived';

export function availabilityOf(test: { status: TestStatus; scheduled_start?: string | null; scheduled_end?: string | null }, now = new Date()): Availability {
  if (test.status === 'draft') return 'draft';
  if (test.status === 'archived') return 'archived';
  if (test.status === 'closed') return 'ended';
  if (test.scheduled_start && new Date(test.scheduled_start).getTime() > now.getTime()) return 'scheduled';
  if (test.scheduled_end && new Date(test.scheduled_end).getTime() <= now.getTime()) return 'ended';
  return 'active';
}

export function validatePublication(questionCount: number, start: Date | null, end: Date | null, now = new Date()): string | null {
  if (questionCount < 1) return 'Add at least one question before publishing.';
  if (start && end && start.getTime() >= end.getTime()) return 'The end time must be after the start time.';
  if (end && end.getTime() <= now.getTime()) return 'The end time is already in the past.';
  return null;
}

/**
 * The attempt deadline is the earlier of (start + duration) and the test's
 * scheduled end. The server stores it; the browser only displays it.
 */
export function computeExpiry(startedAt: Date, durationMinutes: number, scheduledEnd: string | null | undefined): Date {
  const byDuration = startedAt.getTime() + durationMinutes * 60_000;
  const byWindow = scheduledEnd ? new Date(scheduledEnd).getTime() : Number.POSITIVE_INFINITY;
  return new Date(Math.min(byDuration, byWindow));
}

export function isExpired(expiresAt: string | Date | null | undefined, now = new Date(), graceSeconds = 0): boolean {
  if (!expiresAt) return false;
  return now.getTime() > new Date(expiresAt).getTime() + graceSeconds * 1000;
}

/* ------------------------------------------------------------------ */
/* Deterministic shuffling (stable across refreshes for one attempt)   */
/* ------------------------------------------------------------------ */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rand = seededRandom(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildAttemptOrder(questions: QuestionRow[], config: TestConfig, seed: string) {
  const ordered = [...questions].sort((a, b) => a.position - b.position);
  const questionOrder = (config.shuffleQuestions ? seededShuffle(ordered, `${seed}:q`) : ordered).map((q) => q.id);
  const optionOrder: Record<string, string[]> = {};
  for (const q of ordered) {
    if (!q.options?.length) continue;
    const ids = q.options.map((o) => o.id);
    optionOrder[q.id] = config.shuffleOptions && q.type !== 'true_false' ? seededShuffle(ids, `${seed}:${q.id}`) : ids;
  }
  return { questionOrder, optionOrder };
}

/* ------------------------------------------------------------------ */
/* Student-facing projection: never includes answer keys or hidden data */
/* ------------------------------------------------------------------ */
export function toStudentQuestion(row: QuestionRow, optionOrder: string[] | undefined, sampleCases: Array<{ input: string; expected_output: string }>) {
  const byId = new Map((row.options ?? []).map((o) => [o.id, o]));
  const options = (optionOrder?.length ? optionOrder.map((id) => byId.get(id)).filter(Boolean) as StoredOption[] : row.options ?? []);
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    marks: Number(row.marks),
    negativeMarks: Number(row.negative_marks ?? 0),
    options: options.map((o) => ({ id: o.id, text: o.text })),
    coding: row.type === 'coding' && row.coding
      ? { languages: row.coding.languages, starterCode: row.coding.starterCode ?? {}, timeLimitMs: row.coding.timeLimitMs, sampleTestCases: sampleCases.map((c) => ({ input: c.input, expectedOutput: c.expected_output })) }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Response validation                                                  */
/* ------------------------------------------------------------------ */
export const responseSchemas = {
  choice: z.object({ optionIds: z.array(z.string().max(20)).max(12) }),
  text: z.object({ text: z.string().max(50000) }),
  numeric: z.object({ value: z.union([z.number().finite(), z.string().max(64)]) }),
  code: z.object({ language: z.enum(LANGUAGE_IDS), source: z.string().max(200000) }),
  file: z.object({ files: z.array(z.object({ path: z.string().max(500), name: z.string().max(255), size: z.number().int().nonnegative(), mime: z.string().max(120) })).max(5) }),
};

export function validateResponse(type: QuestionType, response: unknown): unknown {
  if (response === null || response === undefined) return null;
  switch (type) {
    case 'mcq':
    case 'true_false':
    case 'multiple_select': {
      const parsed = responseSchemas.choice.parse(response);
      if (type !== 'multiple_select' && parsed.optionIds.length > 1) throw new Error('Choose a single option.');
      return { optionIds: [...new Set(parsed.optionIds)] };
    }
    case 'numerical': return responseSchemas.numeric.parse(response);
    case 'coding': return responseSchemas.code.parse(response);
    case 'file_upload': return responseSchemas.file.parse(response);
    default: return responseSchemas.text.parse(response);
  }
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */
export type GradeResult = { score: number; max: number; needsManual: boolean; correct: boolean | null };

const normalizeText = (value: string, caseSensitive: boolean) => {
  const collapsed = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return caseSensitive ? collapsed : collapsed.toLowerCase();
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function gradeObjective(row: Pick<QuestionRow, 'type' | 'marks' | 'negative_marks' | 'answer_key'>, response: unknown, negativeMarking: boolean): GradeResult {
  const max = Number(row.marks) || 0;
  const penalty = negativeMarking ? Number(row.negative_marks) || 0 : 0;
  const key = row.answer_key ?? {};
  const wrong = (): GradeResult => ({ score: penalty > 0 ? round2(-penalty) : 0, max, needsManual: false, correct: false });
  const right = (): GradeResult => ({ score: max, max, needsManual: false, correct: true });
  if (response === null || response === undefined) return { score: 0, max, needsManual: false, correct: null };

  switch (row.type) {
    case 'mcq':
    case 'true_false': {
      const chosen = (response as { optionIds?: string[] }).optionIds ?? [];
      if (!chosen.length) return { score: 0, max, needsManual: false, correct: null };
      return key.correctOptionIds?.includes(chosen[0]) && chosen.length === 1 ? right() : wrong();
    }
    case 'multiple_select': {
      const chosen = new Set((response as { optionIds?: string[] }).optionIds ?? []);
      if (!chosen.size) return { score: 0, max, needsManual: false, correct: null };
      const correct = new Set(key.correctOptionIds ?? []);
      const hits = [...chosen].filter((id) => correct.has(id)).length;
      const misses = [...chosen].filter((id) => !correct.has(id)).length;
      if (hits === correct.size && misses === 0) return right();
      if (key.partialCredit && correct.size > 0) {
        const fraction = Math.max(0, (hits - misses) / correct.size);
        if (fraction > 0) return { score: round2(max * fraction), max, needsManual: false, correct: false };
      }
      return wrong();
    }
    case 'numerical': {
      const raw = (response as { value?: unknown }).value;
      const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
      if (raw === '' || raw === undefined || !Number.isFinite(value)) return { score: 0, max, needsManual: false, correct: null };
      const target = Number(key.value);
      const tolerance = Math.abs(Number(key.tolerance) || 0);
      return Math.abs(value - target) <= tolerance + 1e-9 ? right() : wrong();
    }
    case 'short_answer':
    case 'fill_blank': {
      const text = String((response as { text?: unknown }).text ?? '');
      if (!text.trim()) return { score: 0, max, needsManual: false, correct: null };
      const caseSensitive = Boolean(key.caseSensitive);
      const accepted = (key.acceptedAnswers ?? []).map((a) => normalizeText(a, caseSensitive));
      // An unmatched short answer is flagged for teacher review instead of being
      // silently marked wrong: phrasing can differ from the accepted list.
      return accepted.includes(normalizeText(text, caseSensitive)) ? right() : { score: 0, max, needsManual: true, correct: false };
    }
    default:
      return { score: 0, max, needsManual: true, correct: null };
  }
}

/** Partial credit for coding questions proportional to passed test-case weight. */
export function gradeCoding(marks: number, results: Array<{ passed: boolean; weight: number }>): GradeResult {
  const max = Number(marks) || 0;
  const total = results.reduce((sum, r) => sum + r.weight, 0);
  if (!total) return { score: 0, max, needsManual: true, correct: null };
  const passed = results.filter((r) => r.passed).reduce((sum, r) => sum + r.weight, 0);
  return { score: round2((passed / total) * max), max, needsManual: false, correct: passed === total };
}

export function summarizeAttempt(answers: Array<{ awarded: number; max: number; needsManual: boolean }>, totalMarks: number) {
  const raw = answers.reduce((sum, a) => sum + a.awarded, 0);
  const score = round2(Math.max(0, raw));
  const max = Number(totalMarks) || answers.reduce((sum, a) => sum + a.max, 0);
  return { score, max, percentage: max > 0 ? round2((score / max) * 100) : 0, pendingManual: answers.some((a) => a.needsManual) };
}

/* ------------------------------------------------------------------ */
/* Integrity (review aid only — never a misconduct decision)            */
/* ------------------------------------------------------------------ */
const severityWeight = { info: 0, low: 2, medium: 6, high: 15, critical: 25 } as const;
export type Severity = keyof typeof severityWeight;

export function integrityScore(events: Array<{ severity: Severity; confidence: number | null; review_status?: string }>) {
  const deduction = events
    .filter((e) => e.review_status !== 'dismissed')
    .reduce((sum, e) => sum + severityWeight[e.severity] * Math.min(1, Math.max(0, e.confidence ?? 0.5)), 0);
  return Math.max(0, Math.round((100 - deduction) * 10) / 10);
}

export function riskLevelFrom(score: number): 'low' | 'medium' | 'high' {
  return score < 60 ? 'high' : score < 85 ? 'medium' : 'low';
}

/* ------------------------------------------------------------------ */
/* Legacy JSONB question import                                         */
/* ------------------------------------------------------------------ */
export function normalizeLegacyQuestion(raw: any): QuestionInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const prompt = String(raw.questionText ?? raw.question ?? raw.text ?? raw.prompt ?? '').trim();
  if (!prompt) return null;
  const marks = Number(raw.marks ?? raw.points ?? 1);
  const rawType = String(raw.type ?? '').toLowerCase().replace(/-/g, '_');
  const correctRaw = raw.correctAnswer ?? raw.answer ?? raw.correct_answer;
  const optionList: Array<{ text: string; isCorrect?: boolean }> = Array.isArray(raw.options)
    ? raw.options.map((o: any) => (typeof o === 'string' ? { text: o } : { text: String(o?.text ?? o?.label ?? ''), isCorrect: Boolean(o?.isCorrect ?? o?.correct) })).filter((o: { text: string }) => o.text.trim())
    : [];
  const base = { prompt: prompt.slice(0, 20000), marks: Number.isFinite(marks) && marks >= 0 ? Math.min(marks, 1000) : 1, negativeMarks: 0, explanation: raw.explanation ? String(raw.explanation).slice(0, 10000) : null, acceptedAnswers: [] as string[], caseSensitive: false, numericTolerance: 0, partialCredit: false, testCases: [], options: [] as Array<{ text: string; isCorrect: boolean }> };

  if (optionList.length >= 2 && rawType !== 'short_answer') {
    const correctText = typeof correctRaw === 'string' ? correctRaw.trim().toLowerCase() : null;
    const correctIndex = typeof correctRaw === 'number' ? correctRaw : -1;
    const options = optionList.slice(0, 12).map((o, i) => ({ text: o.text.trim().slice(0, 4000), isCorrect: Boolean(o.isCorrect) || (correctText !== null && o.text.trim().toLowerCase() === correctText) || i === correctIndex }));
    if (!options.some((o) => o.isCorrect)) return { ...base, type: 'long_answer', prompt: `${base.prompt}\n\nOptions: ${options.map((o) => o.text).join(' / ')}`, modelAnswer: correctRaw ? String(correctRaw) : null } as QuestionInput;
    const multi = rawType === 'multiple_select' || options.filter((o) => o.isCorrect).length > 1;
    return { ...base, type: multi ? 'multiple_select' : 'mcq', options } as QuestionInput;
  }
  if (rawType === 'true_false') {
    const truthy = String(correctRaw).toLowerCase() === 'true';
    return { ...base, type: 'true_false', options: [{ text: 'True', isCorrect: truthy }, { text: 'False', isCorrect: !truthy }] } as QuestionInput;
  }
  if (rawType === 'numerical' && Number.isFinite(Number(correctRaw))) return { ...base, type: 'numerical', numericAnswer: Number(correctRaw) } as QuestionInput;
  if (correctRaw && String(correctRaw).length <= 200 && rawType !== 'long_answer') return { ...base, type: 'short_answer', acceptedAnswers: [String(correctRaw).trim()], modelAnswer: String(correctRaw) } as QuestionInput;
  return { ...base, type: 'long_answer', modelAnswer: correctRaw ? String(correctRaw).slice(0, 20000) : null } as QuestionInput;
}
