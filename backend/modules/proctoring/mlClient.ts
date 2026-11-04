import { z } from 'zod';

/**
 * Authenticated client for the NeuroClass ML proctoring service (ml-service/,
 * deployed on Render). Only compact numeric feature vectors are sent; never
 * images, video or answers. Ported from test_creation/server/services/mlProctoringClient.ts.
 */
export const featureSchema = z.object({
  facePresent: z.boolean().optional(),
  faceCount: z.number().int().min(0).max(10).optional(),
  faceBboxArea: z.number().min(0).max(1).optional(),
  faceCenterX: z.number().min(0).max(1).optional(),
  faceCenterY: z.number().min(0).max(1).optional(),
  headPoseYaw: z.number().min(-180).max(180).optional(),
  headPosePitch: z.number().min(-180).max(180).optional(),
  headPoseRoll: z.number().min(-180).max(180).optional(),
  gazeHorizontal: z.number().min(-1).max(1).optional(),
  gazeVertical: z.number().min(-1).max(1).optional(),
  landmarkStability: z.number().min(0).max(1).optional(),
  faceQuality: z.number().min(0).max(1).optional(),
  frameQuality: z.number().min(0).max(1).optional(),
  movementScore: z.number().min(0).max(1).optional(),
  provider: z.string().max(80).default('browser_mediapipe'),
}).strict();
export type FeatureVector = z.infer<typeof featureSchema>;

const responseSchema = z.object({
  anomaly_score: z.number(),
  risk_score: z.number(),
  risk_level: z.enum(['low', 'medium', 'high']),
  confidence: z.number(),
  events: z.array(z.object({
    event_type: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    confidence: z.number(),
    duration_seconds: z.number(),
    evidence: z.record(z.unknown()),
  })),
  baseline: z.record(z.unknown()),
  temporal_state: z.record(z.unknown()),
  model_version: z.string(),
  baseline_ready: z.boolean(),
});

export const isMlConfigured = () => Boolean(process.env.ML_PROCTORING_URL && process.env.ML_PROCTORING_API_KEY);

const snake = (f: FeatureVector) => ({
  face_present: f.facePresent, face_count: f.faceCount, face_bbox_area: f.faceBboxArea, face_center_x: f.faceCenterX, face_center_y: f.faceCenterY,
  head_pose_yaw: f.headPoseYaw, head_pose_pitch: f.headPosePitch, head_pose_roll: f.headPoseRoll, gaze_horizontal: f.gazeHorizontal, gaze_vertical: f.gazeVertical,
  landmark_stability: f.landmarkStability, face_quality: f.faceQuality, frame_quality: f.frameQuality, movement_score: f.movementScore, provider: f.provider,
});

async function call(path: string, body?: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${process.env.ML_PROCTORING_URL!.replace(/\/$/, '')}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Proctoring-Service-Key': process.env.ML_PROCTORING_API_KEY!, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ml-service ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function mlHealth() {
  if (!isMlConfigured()) return { ready: false, reason: 'not_configured' };
  try {
    const r = await call('/ready') as { ready?: boolean; model_version?: string };
    return { ready: Boolean(r.ready), modelVersion: r.model_version };
  } catch {
    return { ready: false, reason: 'unreachable' };
  }
}

export type MlPolicy = { baselineSeconds: number; minimumEventSeconds: number; eventCooldownSeconds: number; faceAbsenceSeconds: number; headTurnDegrees: number; headPitchDegrees: number };

export async function mlBaselineUpdate(attemptId: string, baseline: Record<string, unknown>, features: FeatureVector) {
  return call('/v1/proctoring/baseline/update', { attempt_id: attemptId, baseline, features: snake(features) }) as Promise<Record<string, unknown>>;
}
export async function mlBaselineFinalize(attemptId: string, baseline: Record<string, unknown>, features: FeatureVector) {
  return call('/v1/proctoring/baseline/finalize', { attempt_id: attemptId, baseline, features: snake(features) }) as Promise<Record<string, unknown>>;
}
export async function mlAnalyze(input: { attemptId: string; studentId: string; baseline: Record<string, unknown>; temporalState: Record<string, unknown>; features: FeatureVector; faceVerified?: boolean; policy: MlPolicy }) {
  const raw = await call('/v1/proctoring/analyze', {
    attempt_id: input.attemptId,
    student_id: input.studentId,
    timestamp: new Date().toISOString(),
    features: snake(input.features),
    face_verified: input.faceVerified,
    baseline: input.baseline,
    temporal_state: input.temporalState,
    policy: {
      baseline_seconds: input.policy.baselineSeconds,
      minimum_event_seconds: input.policy.minimumEventSeconds,
      event_cooldown_seconds: input.policy.eventCooldownSeconds,
      face_absence_seconds: input.policy.faceAbsenceSeconds,
      head_turn_degrees: input.policy.headTurnDegrees,
      head_pitch_degrees: input.policy.headPitchDegrees,
    },
  });
  return responseSchema.parse(raw);
}
