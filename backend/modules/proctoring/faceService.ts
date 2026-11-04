import { ApiError, unavailable } from '../core/http';

/**
 * Server-to-server client for the existing NeuroClass face-recognition service
 * on Render (the same ArcFace service used for attendance). The browser never
 * talks to it, and embeddings are never returned to the browser: only a
 * verified flag, a similarity percentage and face bounding boxes.
 */
export const FACE_MATCH_THRESHOLD = Number(process.env.EXAM_FACE_MATCH_THRESHOLD || 45);

export type FaceBox = { x: number; y: number; width: number; height: number };
export type FaceCheck = {
  verified: boolean;
  faceCount: number;
  similarity: number;
  reason: 'verified' | 'no_face' | 'multiple_faces' | 'mismatch' | 'low_quality';
  faces: Array<{ box: FaceBox | null; matched: boolean; similarity: number }>;
};

export const isFaceServiceConfigured = () => Boolean(process.env.AI_SERVICE_URL && process.env.AI_SERVICE_SECRET);

const pct = (raw: unknown) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
};

function boxFrom(raw: unknown): FaceBox | null {
  if (Array.isArray(raw) && raw.length === 4) {
    const [a, b, c, d] = raw.map(Number);
    if (![a, b, c, d].every(Number.isFinite)) return null;
    // Supports both [x1,y1,x2,y2] and [x,y,w,h] layouts from the service.
    const looksLikeCorners = c > a && d > b;
    return looksLikeCorners ? { x: a, y: b, width: c - a, height: d - b } : { x: a, y: b, width: c, height: d };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const x = Number(r.x ?? r.left), y = Number(r.y ?? r.top), w = Number(r.width ?? r.w), h = Number(r.height ?? r.h);
    if ([x, y, w, h].every(Number.isFinite)) return { x, y, width: w, height: h };
  }
  return null;
}

/** Pure interpretation of the face service response (unit-tested). */
export function interpretFaceResponse(payload: any, allowedIds: string[]): FaceCheck {
  const allowed = new Set(allowedIds.map((id) => id.trim().toLowerCase()));
  const results: any[] = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.faces) ? payload.faces : [];
  const studentIdOf = (r: any) => String(r.student_id ?? r.studentId ?? r.matched_student_id ?? r.match?.student_id ?? r.identity?.student_id ?? '').trim().toLowerCase();
  const scoreOf = (r: any) => pct(r.similarity ?? r.similarity_score ?? r.face_match_score ?? r.match_score ?? r.score ?? r.match?.similarity);

  // Response shape B: {verified, similarity, state} without per-face results.
  if (!results.length && typeof payload?.verified === 'boolean') {
    const similarity = pct(payload.similarity);
    const state = String(payload.state ?? '').toUpperCase();
    const faceCount = state.includes('NO_FACE') ? 0 : state.includes('MULTIPLE') ? 2 : 1;
    const verified = payload.verified && faceCount === 1 && similarity >= FACE_MATCH_THRESHOLD;
    return { verified, faceCount, similarity, reason: verified ? 'verified' : faceCount === 0 ? 'no_face' : faceCount > 1 ? 'multiple_faces' : 'mismatch', faces: [{ box: boxFrom(payload.bbox), matched: verified, similarity }] };
  }

  const faces = results.map((r) => {
    const similarity = scoreOf(r);
    const matched = allowed.has(studentIdOf(r)) && similarity >= FACE_MATCH_THRESHOLD;
    return { box: boxFrom(r.bbox ?? r.box), matched, similarity };
  });
  const detected = faces.filter((f) => f.box || f.similarity > 0);
  const faceCount = detected.length;
  const best = faces.filter((f) => f.matched).sort((a, b) => b.similarity - a.similarity)[0];
  if (faceCount === 0) return { verified: false, faceCount: 0, similarity: 0, reason: 'no_face', faces };
  if (faceCount > 1) return { verified: false, faceCount, similarity: best?.similarity ?? 0, reason: 'multiple_faces', faces };
  if (!best) return { verified: false, faceCount, similarity: Math.max(...faces.map((f) => f.similarity), 0), reason: 'mismatch', faces };
  return { verified: true, faceCount, similarity: best.similarity, reason: 'verified', faces };
}

const MAX_IMAGE_BYTES = 2_500_000;
const IMAGE_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

export async function validateCameraImage(file: File) {
  if (!(file instanceof File)) throw new ApiError(400, 'A camera image is required.', 'bad_request');
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'Camera image must be smaller than 2.5 MB.', 'payload_too_large');
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const match = IMAGE_SIGNATURES.find((sig) => sig.bytes.every((b, i) => head[i] === b));
  if (!match) throw new ApiError(415, 'Camera image must be JPEG, PNG or WebP.', 'unsupported_media');
  return match.mime;
}

export async function checkFace(input: { classroomId: string; attemptId: string; enrollmentId: string; userId: string; file: File }): Promise<FaceCheck> {
  if (!isFaceServiceConfigured()) throw unavailable('The face verification service is not configured.');
  const mime = await validateCameraImage(input.file);
  const base = process.env.AI_SERVICE_URL!.replace(/\/$/, '');
  const secret = process.env.AI_SERVICE_SECRET!;
  const paths = [process.env.AI_EXAM_FACE_PATH || '/ai/v1/proctoring/exam-frame', '/ai/v1/attendance/frame'];
  let lastStatus = 0;
  for (const path of [...new Set(paths)]) {
    const form = new FormData();
    form.append('classroom_id', input.classroomId);
    form.append('session_id', input.attemptId);
    // Restrict matching to the authenticated student's own enrolled profile so a
    // classmate's nearest-neighbour match can never verify this attempt.
    form.append('target_student_id', input.enrollmentId);
    form.append('capture_mode', 'exam');
    form.append('file', new Blob([await input.file.arrayBuffer()], { type: mime }), 'exam-frame.jpg');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'X-AI-Service-Secret': secret },
        body: form,
        signal: controller.signal,
      });
      lastStatus = response.status;
      if (response.status === 404) continue; // try the attendance matcher route
      if (!response.ok) break;
      const payload = await response.json().catch(() => ({}));
      return interpretFaceResponse(payload, [input.enrollmentId, input.userId]);
    } catch {
      lastStatus = 0;
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw unavailable(lastStatus ? `The face verification service returned ${lastStatus}.` : 'The face verification service is unreachable.');
}
