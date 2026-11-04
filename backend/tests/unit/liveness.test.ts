import { describe, expect, it } from 'vitest';
import { createLivenessTracker } from '../../../frontend/features/exam/liveness';

const f = (yaw: number | null, eyesClosed: number | null = 0.05, faceCount = 1) => ({ faceCount, yaw, eyesClosed });

function run(samples: ReturnType<typeof f>[]) {
  const t = createLivenessTracker();
  let last: any;
  for (const s of samples) { last = t.push(s); if (last.abort || last.step === 'done') break; }
  return last;
}

describe('liveness check (head turn + blink)', () => {
  it('passes after both turns, a blink and facing the camera again', () => {
    const r = run([f(0), f(-10), f(-22), f(-5), f(12), f(21), f(5), f(0, 0.8), f(0, 0.1), f(2), f(1), f(0)]);
    expect(r.step).toBe('done');
  });
  it('a still photo (no movement, no blink) never passes', () => {
    const r = run(Array.from({ length: 200 }, () => f(2, 0.03)));
    expect(r.step).toBe('turn');
  });
  it('a tilted photo can turn but cannot blink', () => {
    const r = run([f(-25, 0.02), f(25, 0.02), ...Array.from({ length: 50 }, () => f(0, 0.02))]);
    expect(r.step).toBe('blink');
  });
  it('turning to only one side is not enough', () => {
    const r = run([f(-30), f(-25), f(0, 0.9), f(0, 0.1), f(0), f(0), f(0)]);
    expect(r.step).toBe('turn');
  });
  it('a second face in view aborts the check', () => {
    const r = run([f(-25), f(0, 0.05, 2), f(0, 0.05, 2)]);
    expect(r.abort).toBe('multiple_faces');
  });
  it('frames without a face do not count as centred', () => {
    const r = run([f(-25), f(25), f(0, 0.9), f(0, 0.1), f(null, null, 0), f(null, null, 0), f(null, null, 0)]);
    expect(r.step).toBe('center');
  });
});
