import { describe, expect, it } from 'vitest';
import {
  availabilityOf, buildAttemptOrder, computeExpiry, gradeCoding, gradeObjective, integrityScore, isExpired, normalizeLegacyQuestion,
  questionInputSchema, readConfig, seededShuffle, summarizeAttempt, toEditableQuestion, toStoredQuestion, toStudentQuestion, validatePublication, validateResponse,
  type QuestionRow,
} from '../../modules/assessments/domain';

const q = (over: Partial<QuestionRow> = {}): QuestionRow => ({ id: 'q1', test_id: 't', position: 0, type: 'mcq', prompt: 'p', options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }], answer_key: { correctOptionIds: ['o2'] }, marks: 4, negative_marks: 1, explanation: 'because', coding: null, ...over });

describe('question input', () => {
  it('rejects an MCQ without a correct option', () => {
    const r = questionInputSchema.safeParse({ type: 'mcq', prompt: 'x', options: [{ text: 'a' }, { text: 'b' }] });
    expect(r.success).toBe(false);
  });
  it('rejects negative marks greater than marks', () => {
    const r = questionInputSchema.safeParse({ type: 'mcq', prompt: 'x', marks: 1, negativeMarks: 2, options: [{ text: 'a', isCorrect: true }, { text: 'b' }] });
    expect(r.success).toBe(false);
  });
  it('requires test cases for coding questions', () => {
    const r = questionInputSchema.safeParse({ type: 'coding', prompt: 'x', coding: { languages: ['python'] } });
    expect(r.success).toBe(false);
  });
  it('splits answer keys from public options and round-trips for editing', () => {
    const input = questionInputSchema.parse({ type: 'multiple_select', prompt: 'x', partialCredit: true, options: [{ text: 'a', isCorrect: true }, { text: 'b' }, { text: 'c', isCorrect: true }] });
    const stored = toStoredQuestion(input, 3);
    expect(stored.options).toEqual([{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }, { id: 'o3', text: 'c' }]);
    expect(JSON.stringify(stored.options)).not.toContain('isCorrect');
    expect(stored.answer_key.correctOptionIds).toEqual(['o1', 'o3']);
    const editable = toEditableQuestion({ ...stored, id: 'x', test_id: 't' } as QuestionRow, []);
    expect(editable.options.map((o) => o.isCorrect)).toEqual([true, false, true]);
  });
});

describe('student projection never leaks answers', () => {
  it('omits answer keys, explanations and hidden data', () => {
    const view = toStudentQuestion(q(), ['o2', 'o1'], []);
    const text = JSON.stringify(view);
    expect(text).not.toContain('correctOptionIds');
    expect(text).not.toContain('because');
    expect(view.options.map((o) => o.id)).toEqual(['o2', 'o1']);
  });
  it('includes only sample cases for coding questions', () => {
    const view = toStudentQuestion(q({ type: 'coding', options: [], coding: { languages: ['python'], starterCode: {}, timeLimitMs: 2000, memoryLimitMb: 128 } }), undefined, [{ input: '1', expected_output: '2' }]);
    expect(view.coding?.sampleTestCases).toEqual([{ input: '1', expectedOutput: '2' }]);
  });
});

describe('objective grading', () => {
  it('grades MCQ with negative marking', () => {
    expect(gradeObjective(q(), { optionIds: ['o2'] }, true).score).toBe(4);
    expect(gradeObjective(q(), { optionIds: ['o1'] }, true).score).toBe(-1);
    expect(gradeObjective(q(), { optionIds: ['o1'] }, false).score).toBe(0);
    expect(gradeObjective(q(), null, true).score).toBe(0);
  });
  it('rejects MCQ answers that select more than one option', () => {
    expect(gradeObjective(q(), { optionIds: ['o1', 'o2'] }, false).correct).toBe(false);
  });
  it('awards partial credit for multiple select when enabled', () => {
    const row = q({ type: 'multiple_select', options: [{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }, { id: 'o3', text: 'c' }], answer_key: { correctOptionIds: ['o1', 'o3'], partialCredit: true } });
    expect(gradeObjective(row, { optionIds: ['o1', 'o3'] }, false).score).toBe(4);
    expect(gradeObjective(row, { optionIds: ['o1'] }, false).score).toBe(2);
    expect(gradeObjective(row, { optionIds: ['o1', 'o2'] }, false).score).toBe(0);
  });
  it('grades numerical answers with tolerance', () => {
    const row = q({ type: 'numerical', options: [], answer_key: { value: 3.14, tolerance: 0.01 } });
    expect(gradeObjective(row, { value: '3.145' }, false).correct).toBe(true);
    expect(gradeObjective(row, { value: 3.2 }, false).correct).toBe(false);
    expect(gradeObjective(row, { value: 'abc' }, false).correct).toBe(null);
  });
  it('accepts normalized short answers and flags others for review', () => {
    const row = q({ type: 'short_answer', options: [], answer_key: { acceptedAnswers: ['Ada  Lovelace'] } });
    expect(gradeObjective(row, { text: ' ada lovelace ' }, false).correct).toBe(true);
    const other = gradeObjective(row, { text: 'Countess of Lovelace' }, false);
    expect(other.needsManual).toBe(true);
  });
  it('leaves long answers for the teacher', () => {
    expect(gradeObjective(q({ type: 'long_answer', options: [], answer_key: {} }), { text: 'essay' }, false).needsManual).toBe(true);
  });
  it('gives proportional coding credit', () => {
    expect(gradeCoding(10, [{ passed: true, weight: 1 }, { passed: false, weight: 3 }]).score).toBe(2.5);
    expect(gradeCoding(10, []).needsManual).toBe(true);
  });
  it('never lets a total score go below zero', () => {
    expect(summarizeAttempt([{ awarded: -3, max: 4, needsManual: false }], 4).score).toBe(0);
  });
});

describe('response validation', () => {
  it('rejects multiple options for single-choice questions', () => {
    expect(() => validateResponse('mcq', { optionIds: ['o1', 'o2'] })).toThrow();
  });
  it('rejects unknown languages for coding answers', () => {
    expect(() => validateResponse('coding', { language: 'brainfuck', source: 'x' })).toThrow();
  });
});

describe('lifecycle and timing', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  it('derives availability from status and schedule', () => {
    expect(availabilityOf({ status: 'draft' }, now)).toBe('draft');
    expect(availabilityOf({ status: 'published', scheduled_start: '2026-11-05T11:00:00Z' }, now)).toBe('scheduled');
    expect(availabilityOf({ status: 'published', scheduled_end: '2026-11-05T09:00:00Z' }, now)).toBe('ended');
    expect(availabilityOf({ status: 'published' }, now)).toBe('active');
    expect(availabilityOf({ status: 'closed' }, now)).toBe('ended');
  });
  it('caps the attempt deadline at the window end', () => {
    expect(computeExpiry(now, 60, '2026-11-05T10:30:00Z').toISOString()).toBe('2026-11-05T10:30:00.000Z');
    expect(computeExpiry(now, 30, null).toISOString()).toBe('2026-11-05T10:30:00.000Z');
  });
  it('applies the grace window when checking expiry', () => {
    expect(isExpired('2026-11-05T09:59:50Z', now, 20)).toBe(false);
    expect(isExpired('2026-11-05T09:59:30Z', now, 20)).toBe(true);
  });
  it('validates publication', () => {
    expect(validatePublication(0, null, null)).toMatch(/at least one/);
    expect(validatePublication(1, new Date('2026-11-06'), new Date('2026-11-05'), now)).toMatch(/after/);
    expect(validatePublication(1, null, null, now)).toBeNull();
  });
});

describe('shuffling', () => {
  it('is deterministic per attempt seed and keeps every item', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, 'a')).toEqual(seededShuffle(items, 'a'));
    expect(seededShuffle(items, 'a')).not.toEqual(items);
    expect([...seededShuffle(items, 'b')].sort((x, y) => x - y)).toEqual(items);
  });
  it('does not shuffle true/false options', () => {
    const order = buildAttemptOrder([q({ id: 'a', type: 'true_false', options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }] })], readConfig({ shuffleOptions: true }), 's');
    expect(order.optionOrder.a).toEqual(['true', 'false']);
  });
});

describe('integrity indicator', () => {
  it('ignores dismissed events and weights by confidence', () => {
    expect(integrityScore([])).toBe(100);
    expect(integrityScore([{ severity: 'high', confidence: 1 }])).toBe(85);
    expect(integrityScore([{ severity: 'high', confidence: 1, review_status: 'dismissed' }])).toBe(100);
    expect(integrityScore([{ severity: 'medium', confidence: 0.5 }])).toBe(97);
  });
});

describe('legacy question normalisation', () => {
  it('converts the old AI generator format', () => {
    const n = normalizeLegacyQuestion({ text: '2+2?', type: 'mcq', options: ['3', '4'], correctAnswer: '4', marks: 2 })!;
    expect(n.type).toBe('mcq');
    expect(n.options.find((o) => o.isCorrect)?.text).toBe('4');
  });
  it('converts the test_creation shared format', () => {
    const n = normalizeLegacyQuestion({ type: 'short_answer', questionText: 'Name?', options: [], correctAnswer: 'Ada', marks: 1 })!;
    expect(n.type).toBe('short_answer');
    expect(n.acceptedAnswers).toEqual(['Ada']);
  });
  it('keeps unknown-answer MCQs as manually graded instead of guessing', () => {
    const n = normalizeLegacyQuestion({ text: 'Pick', options: ['a', 'b'], correctAnswer: 'zzz' })!;
    expect(n.type).toBe('long_answer');
  });
  it('ignores empty entries', () => {
    expect(normalizeLegacyQuestion({})).toBeNull();
  });
});
