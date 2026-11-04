/**
 * On-device face analysis for exam proctoring using Google's MediaPipe Face
 * Landmarker (a validated, pre-trained model). Inference runs locally in the
 * student's browser; only compact numbers leave the device.
 *
 * Model/wasm locations can be self-hosted with VITE_MEDIAPIPE_WASM_URL and
 * VITE_FACE_LANDMARKER_MODEL_URL.
 */
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const WASM_URL = env.VITE_MEDIAPIPE_WASM_URL || 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';
const MODEL_URL = env.VITE_FACE_LANDMARKER_MODEL_URL || 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export function loadFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 4,
        outputFacialTransformationMatrixes: true,
        // Eye-blink scores power the liveness check before Face ID.
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
      });
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export type NormalizedBox = { x: number; y: number; width: number; height: number; label?: string };
export type VisionSample = {
  faceCount: number;
  boxes: NormalizedBox[];
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  gazeHorizontal: number | null;
  gazeVertical: number | null;
  frameQuality: number;
  movement: number;
  /** Mean eye-closure score of the primary face, 0 (open) to 1 (closed). */
  eyesClosed: number | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Euler angles (degrees) from MediaPipe's column-major 4x4 facial transformation matrix. */
export function headPose(matrix: number[]) {
  const r00 = matrix[0], r10 = matrix[1], r20 = matrix[2], r21 = matrix[6], r22 = matrix[10];
  const pitch = toDeg(Math.atan2(r21, r22));
  const yaw = toDeg(Math.atan2(-r20, Math.sqrt(r21 * r21 + r22 * r22)));
  const roll = toDeg(Math.atan2(r10, r00));
  return { yaw, pitch, roll };
}

/** Iris position between the eye corners: −1 (looking left) … +1 (looking right). */
function gaze(landmarks: Array<{ x: number; y: number }>) {
  if (landmarks.length < 478) return { h: null, v: null };
  const ratio = (iris: number, outer: number, inner: number, top: number, bottom: number) => {
    const w = landmarks[inner].x - landmarks[outer].x;
    const h = landmarks[bottom].y - landmarks[top].y;
    return { h: w ? (landmarks[iris].x - landmarks[outer].x) / w : 0.5, v: h ? (landmarks[iris].y - landmarks[top].y) / h : 0.5 };
  };
  const right = ratio(468, 33, 133, 159, 145);
  const left = ratio(473, 362, 263, 386, 374);
  return { h: clamp(((right.h + left.h) / 2 - 0.5) * 2.4, -1, 1), v: clamp(((right.v + left.v) / 2 - 0.5) * 2.4, -1, 1) };
}

function boxOf(landmarks: Array<{ x: number; y: number }>): NormalizedBox {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const pad = 0.03;
  return { x: clamp(minX - pad, 0, 1), y: clamp(minY - pad, 0, 1), width: clamp(maxX - minX + pad * 2, 0, 1), height: clamp(maxY - minY + pad * 2, 0, 1) };
}

const probe = typeof document !== 'undefined' ? document.createElement('canvas') : null;
let previous: Uint8ClampedArray | null = null;

/** Brightness/contrast (0..1) and frame-to-frame motion from a tiny 32x24 copy of the frame. */
function frameStats(video: HTMLVideoElement) {
  if (!probe) return { quality: 1, movement: 0 };
  probe.width = 32; probe.height = 24;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { quality: 1, movement: 0 };
  ctx.drawImage(video, 0, 0, 32, 24);
  const { data } = ctx.getImageData(0, 0, 32, 24);
  let sum = 0, sumSq = 0, diff = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum; sumSq += lum * lum;
    if (previous) diff += Math.abs(lum - (0.299 * previous[i] + 0.587 * previous[i + 1] + 0.114 * previous[i + 2]));
  }
  const n = data.length / 4;
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  previous = new Uint8ClampedArray(data);
  // A covered or pitch-black camera has very low brightness and almost no contrast.
  const quality = clamp((mean / 255) * 1.4, 0, 1) * clamp(std / 40, 0, 1);
  return { quality: Math.round(quality * 100) / 100, movement: Math.round(clamp(diff / n / 40, 0, 1) * 100) / 100 };
}

export function analyzeFrame(landmarker: FaceLandmarker, video: HTMLVideoElement, timestamp: number): VisionSample {
  const result: FaceLandmarkerResult = landmarker.detectForVideo(video, timestamp);
  const faces = result.faceLandmarks ?? [];
  const stats = frameStats(video);
  const primary = faces[0];
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const pose = matrix ? headPose(Array.from(matrix)) : null;
  const g = primary ? gaze(primary) : { h: null, v: null };
  const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
  const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score;
  const left = score('eyeBlinkLeft');
  const right = score('eyeBlinkRight');
  return {
    faceCount: faces.length,
    boxes: faces.map(boxOf),
    yaw: pose ? Math.round(pose.yaw) : null,
    pitch: pose ? Math.round(pose.pitch) : null,
    roll: pose ? Math.round(pose.roll) : null,
    gazeHorizontal: g.h === null ? null : Math.round(g.h * 100) / 100,
    gazeVertical: g.v === null ? null : Math.round(g.v * 100) / 100,
    frameQuality: stats.quality,
    movement: stats.movement,
    eyesClosed: left === undefined || right === undefined ? null : Math.round(((left + right) / 2) * 100) / 100,
  };
}
