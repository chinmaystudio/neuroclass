import { analyzeFrame, loadFaceLandmarker, type VisionSample } from './vision';

/**
 * Active liveness check run in the browser right before the Face ID capture:
 * the student turns their head to both sides and blinks, with exactly one face
 * in view. A printed photo or a still image on a screen cannot blink, and a
 * photo cannot turn convincingly to both sides. This raises the bar against
 * simple spoofing; it is not certified presentation-attack detection, and a
 * modified browser can skip it. The result is reported to the server and shown
 * to the teacher; the face match itself always happens on the server.
 */
export type LivenessStep = 'turn' | 'blink' | 'center' | 'done';
export type LivenessProgress = { step: LivenessStep; turnedA: boolean; turnedB: boolean; blinked: boolean; faces: number };
export type LivenessResult = {
  passed: boolean;
  reason?: 'timeout' | 'multiple_faces' | 'no_face' | 'unavailable' | 'cancelled';
  durationMs: number;
  maxYawNegative: number;
  maxYawPositive: number;
  blinks: number;
  frames: number;
};

export const LIVENESS_DEFAULTS = { yawDegrees: 18, centerDegrees: 10, closedScore: 0.5, openScore: 0.25, timeoutMs: 25_000 };

/** Pure state machine so the rules can be unit-tested without a camera. */
export function createLivenessTracker(options: Partial<typeof LIVENESS_DEFAULTS> = {}) {
  const o = { ...LIVENESS_DEFAULTS, ...options };
  let minYaw = 0;
  let maxYaw = 0;
  let blinks = 0;
  let eyesWereClosed = false;
  let centeredFrames = 0;
  let frames = 0;
  let multiFace = 0;
  let noFace = 0;

  const progress = (): LivenessProgress => {
    const turnedA = minYaw <= -o.yawDegrees;
    const turnedB = maxYaw >= o.yawDegrees;
    const blinked = blinks > 0;
    const step: LivenessStep = !(turnedA && turnedB) ? 'turn' : !blinked ? 'blink' : centeredFrames >= 3 ? 'done' : 'center';
    return { step, turnedA, turnedB, blinked, faces: 0 };
  };

  return {
    push(sample: Pick<VisionSample, 'faceCount' | 'yaw' | 'eyesClosed'>): LivenessProgress & { abort?: 'multiple_faces' } {
      frames += 1;
      if (sample.faceCount > 1) {
        multiFace += 1;
        // Two consecutive multi-face frames end the check: someone else is in view.
        if (multiFace >= 2) return { ...progress(), faces: sample.faceCount, abort: 'multiple_faces' };
        return { ...progress(), faces: sample.faceCount };
      }
      multiFace = 0;
      if (sample.faceCount === 0 || sample.yaw === null) {
        noFace += 1;
        centeredFrames = 0;
        return { ...progress(), faces: 0 };
      }
      minYaw = Math.min(minYaw, sample.yaw);
      maxYaw = Math.max(maxYaw, sample.yaw);
      if (sample.eyesClosed !== null) {
        if (sample.eyesClosed >= o.closedScore) eyesWereClosed = true;
        else if (eyesWereClosed && sample.eyesClosed <= o.openScore) { blinks += 1; eyesWereClosed = false; }
      }
      const p = progress();
      centeredFrames = p.turnedA && p.turnedB && p.blinked && Math.abs(sample.yaw) <= o.centerDegrees ? centeredFrames + 1 : 0;
      return { ...progress(), faces: 1 };
    },
    summary(durationMs: number, passed: boolean, reason?: LivenessResult['reason']): LivenessResult {
      return { passed, reason, durationMs: Math.round(durationMs), maxYawNegative: minYaw, maxYawPositive: maxYaw, blinks, frames };
    },
    get noFaceFrames() { return noFace; },
    options: o,
  };
}

export async function runLivenessCheck(video: HTMLVideoElement, onProgress: (p: LivenessProgress) => void, signal?: AbortSignal): Promise<LivenessResult> {
  const tracker = createLivenessTracker();
  const started = performance.now();
  let landmarker;
  try {
    landmarker = await loadFaceLandmarker();
  } catch {
    return tracker.summary(0, false, 'unavailable');
  }
  return new Promise<LivenessResult>((resolve) => {
    const finish = (passed: boolean, reason?: LivenessResult['reason']) => resolve(tracker.summary(performance.now() - started, passed, reason));
    const tick = () => {
      if (signal?.aborted) return finish(false, 'cancelled');
      if (performance.now() - started > tracker.options.timeoutMs) return finish(false, tracker.noFaceFrames > 10 ? 'no_face' : 'timeout');
      if (video.readyState >= 2) {
        try {
          const p = tracker.push(analyzeFrame(landmarker, video, performance.now()));
          onProgress(p);
          if (p.abort) return finish(false, p.abort);
          if (p.step === 'done') return finish(true);
        } catch { /* dropped frame */ }
      }
      window.setTimeout(tick, 90);
    };
    tick();
  });
}

export const LIVENESS_MESSAGES: Record<NonNullable<LivenessResult['reason']>, string> = {
  timeout: 'The check timed out. Turn your head slowly to each side, blink once, then look at the camera.',
  multiple_faces: 'More than one face is in view. Make sure only you are visible and try again.',
  no_face: 'We couldn’t see your face. Sit facing the camera in good light and try again.',
  unavailable: 'The liveness check couldn’t load on this device.',
  cancelled: 'The check was cancelled.',
};
