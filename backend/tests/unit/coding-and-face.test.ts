import { describe, expect, it } from 'vitest';
import { normalizeOutput, outputsMatch, redactForStudent, runTestCases, truncate, type ExecutionProvider } from '../../modules/coding/executor';
import { LANGUAGES, LANGUAGE_IDS } from '../../modules/coding/languages';
import { interpretFaceResponse } from '../../modules/proctoring/faceService';
import { lateness } from '../../modules/assignments/service';
import { validateUpload } from '../../modules/core/storage';

describe('language adapters', () => {
  it('defines every advertised language for both sandboxes', () => {
    for (const id of LANGUAGE_IDS) {
      expect(LANGUAGES[id].judge0Id).toBeGreaterThan(0);
      expect(LANGUAGES[id].piston.language).toBeTruthy();
      expect(LANGUAGES[id].starter.length).toBeGreaterThan(0);
    }
  });
});

describe('output comparison', () => {
  it('ignores trailing whitespace and line-ending style only', () => {
    expect(outputsMatch('1 2 \r\n3\n\n', '1 2\n3')).toBe(true);
    expect(outputsMatch('1  2', '1 2')).toBe(false);
    expect(normalizeOutput('a\t\nb')).toBe('a\nb');
  });
  it('truncates oversized output', () => {
    const t = truncate('x'.repeat(20), 10);
    expect(t.truncated).toBe(true);
  });
});

describe('test-case runner', () => {
  const echo: ExecutionProvider = { name: 'fake', execute: async ({ stdin }) => ({ status: 'ok', stdout: String(Number(stdin) * 2), stderr: '', compileOutput: '', exitCode: 0, timeMs: 5, memoryKb: 100, truncated: false }) };
  const cases = [
    { id: 'a', input: '2', expected_output: '4', is_hidden: false, weight: 1 },
    { id: 'b', input: '5', expected_output: '11', is_hidden: true, weight: 2 },
  ];
  it('runs every case and records pass/fail', async () => {
    const { results } = await runTestCases(echo, 'python', 'src', cases, { timeLimitMs: 1000, memoryLimitMb: 64 });
    expect(results.map((r) => r.passed)).toEqual([true, false]);
  });
  it('never sends hidden inputs or outputs to students', async () => {
    const { results } = await runTestCases(echo, 'python', 'src', cases, { timeLimitMs: 1000, memoryLimitMb: 64 });
    const redacted = JSON.stringify(redactForStudent(results));
    expect(redacted).not.toContain('"11"');
    expect(redacted).not.toContain('"5"');
    expect(redacted).toContain('"2"'); // visible sample stays visible
  });
  it('stops executing after a compile error', async () => {
    let calls = 0;
    const broken: ExecutionProvider = { name: 'fake', execute: async () => { calls++; return { status: 'compile_error', stdout: '', stderr: '', compileOutput: 'syntax error', exitCode: 1, timeMs: null, memoryKb: null, truncated: false }; } };
    const { results, compileError } = await runTestCases(broken, 'c', 'src', [...cases, ...cases], { timeLimitMs: 1000, memoryLimitMb: 64 }, 1);
    expect(compileError).toBe('syntax error');
    expect(calls).toBe(1);
    expect(results.every((r) => !r.passed)).toBe(true);
  });
});

describe('face service interpretation', () => {
  it('verifies only a match for the enrolled student above the threshold', () => {
    const ok = interpretFaceResponse({ results: [{ student_id: 'S1', similarity: 0.82, bbox: [10, 10, 110, 130] }] }, ['s1', 'u1']);
    expect(ok.verified).toBe(true);
    expect(ok.faces[0].box).toEqual({ x: 10, y: 10, width: 100, height: 120 });
  });
  it('rejects a classmate match', () => {
    const r = interpretFaceResponse({ results: [{ student_id: 'other', similarity: 0.95, bbox: [0, 0, 10, 10] }] }, ['s1']);
    expect(r.verified).toBe(false);
    expect(r.reason).toBe('mismatch');
  });
  it('flags multiple faces even if one matches', () => {
    const r = interpretFaceResponse({ results: [{ student_id: 's1', similarity: 90, bbox: [0, 0, 10, 10] }, { student_id: null, similarity: 0, bbox: [20, 20, 30, 30] }] }, ['s1']);
    expect(r.reason).toBe('multiple_faces');
    expect(r.verified).toBe(false);
  });
  it('reports no face', () => {
    expect(interpretFaceResponse({ results: [] }, ['s1']).reason).toBe('no_face');
  });
  it('supports the boolean response shape', () => {
    expect(interpretFaceResponse({ verified: true, similarity: 0.9, state: 'VERIFIED' }, ['s1']).verified).toBe(true);
    expect(interpretFaceResponse({ verified: false, similarity: 0.2, state: 'NO_FACE' }, ['s1']).reason).toBe('no_face');
  });
});

describe('assignment lateness', () => {
  const due = '2026-11-05T10:00:00Z';
  it('is on time before the deadline', () => {
    expect(lateness(due, new Date('2026-11-05T09:00:00Z'), { allowLate: false, penaltyPercentPerDay: 10, maxLateDays: 2 }).isLate).toBe(false);
  });
  it('counts partial days and applies penalties', () => {
    const r = lateness(due, new Date('2026-11-06T11:00:00Z'), { allowLate: true, penaltyPercentPerDay: 10, maxLateDays: 3 });
    expect(r).toMatchObject({ isLate: true, lateDays: 2, penaltyPercent: 20, allowed: true });
  });
  it('blocks late work when not allowed or beyond the limit', () => {
    expect(lateness(due, new Date('2026-11-05T10:01:00Z'), { allowLate: false, penaltyPercentPerDay: 0, maxLateDays: 0 }).allowed).toBe(false);
    expect(lateness(due, new Date('2026-11-09T10:01:00Z'), { allowLate: true, penaltyPercentPerDay: 0, maxLateDays: 2 }).allowed).toBe(false);
  });
});

describe('upload validation', () => {
  const file = (bytes: number[], name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
  it('accepts a real PDF', async () => {
    await expect(validateUpload(file([0x25, 0x50, 0x44, 0x46, 0x2d], 'a.pdf', 'application/pdf'), ['pdf'], 1000)).resolves.toMatchObject({ ext: 'pdf' });
  });
  it('rejects a renamed executable', async () => {
    await expect(validateUpload(file([0x4d, 0x5a, 0x90, 0x00], 'notes.pdf', 'application/pdf'), ['pdf'], 1000)).rejects.toThrow(/does not look like/);
  });
  it('rejects disallowed extensions and oversize files', async () => {
    await expect(validateUpload(file([0x25, 0x50, 0x44, 0x46], 'a.exe', 'application/octet-stream'), ['pdf'], 1000)).rejects.toThrow(/Only these file types/);
    await expect(validateUpload(file(new Array(2000).fill(0x25), 'a.pdf', 'application/pdf'), ['pdf'], 1000)).rejects.toThrow(/smaller/);
  });
  it('sanitises path traversal in file names', async () => {
    const r = await validateUpload(file([0x68, 0x69], '../../etc/passwd.txt', 'text/plain'), ['txt'], 1000);
    expect(r.name).toBe('passwd.txt');
  });
});
