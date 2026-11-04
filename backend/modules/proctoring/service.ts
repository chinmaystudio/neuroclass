import { z } from 'zod';
import { conflict, db, dbFail, rateLimit, readForm, unavailable, type AuthedUser, ApiError } from '../core/http';
import { integrityScore, isExpired, readConfig, readSecurity, riskLevelFrom, type Severity } from '../assessments/domain';
import { finalizeAttempt, getAttemptState, loadOwnAttempt, type AttemptRow } from '../assessments/student';
import type { TestRow } from '../assessments/repo';
import { checkFace, isFaceServiceConfigured } from './faceService';
import { featureSchema, isMlConfigured, mlAnalyze, mlBaselineFinalize, mlBaselineUpdate } from './mlClient';

/**
 * Browser-reported signals. The client may only choose the event TYPE; the
 * server assigns category and severity so a modified client cannot downgrade
 * them. Vision events are review signals, never proof of misconduct.
 */
export const BROWSER_EVENTS = {
  tab_hidden: { category: 'browser', severity: 'medium', warn: true },
  window_blur: { category: 'browser', severity: 'low', warn: false },
  fullscreen_exit: { category: 'browser', severity: 'medium', warn: true },
  clipboard_blocked: { category: 'browser', severity: 'low', warn: false },
  context_menu_blocked: { category: 'browser', severity: 'info', warn: false },
  drop_blocked: { category: 'browser', severity: 'low', warn: false },
  navigation_blocked: { category: 'browser', severity: 'low', warn: false },
  network_offline: { category: 'environment', severity: 'info', warn: false },
  network_online: { category: 'environment', severity: 'info', warn: false },
  camera_disconnected: { category: 'environment', severity: 'high', warn: true },
  camera_reconnected: { category: 'environment', severity: 'info', warn: false },
  camera_obstructed: { category: 'vision', severity: 'medium', warn: true },
  face_absent: { category: 'vision', severity: 'medium', warn: true },
  multiple_faces: { category: 'vision', severity: 'high', warn: true },
  looking_away: { category: 'vision', severity: 'low', warn: true },
  head_turned: { category: 'vision', severity: 'low', warn: true },
  suspicious_object: { category: 'vision', severity: 'medium', warn: true },
  vision_unavailable: { category: 'service', severity: 'info', warn: false },
} as const satisfies Record<string, { category: string; severity: Severity; warn: boolean }>;
type BrowserEventType = keyof typeof BROWSER_EVENTS;

const bboxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0).max(1), height: z.number().min(0).max(1), label: z.string().max(60).optional() });
const eventSchema = z.object({
  type: z.enum(Object.keys(BROWSER_EVENTS) as [BrowserEventType, ...BrowserEventType[]]),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  confidence: z.number().min(0).max(1).optional(),
  durationSeconds: z.number().min(0).max(36000).optional(),
  details: z.record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
  boxes: z.array(bboxSchema).max(6).optional(),
});

async function activeAttempt(attemptId: string, user: AuthedUser, allowCalibrating = false) {
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  const ok = attempt.status === 'in_progress' || (allowCalibrating && attempt.status === 'calibrating');
  if (!ok) throw conflict('This attempt is not active.', { status: attempt.status });
  return { attempt, test };
}

async function insertEvents(attempt: AttemptRow, test: TestRow, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const { error } = await db().from('proctoring_events').insert(rows.map((r) => ({ attempt_id: attempt.id, test_id: test.id, classroom_id: test.classroom_id, student_user_id: attempt.student_id, ...r })));
  if (error) dbFail('insert proctoring events', error);
}

/** Recomputes the integrity indicator and escalates to the teacher after repeated warnings. */
async function refreshIntegrity(attempt: AttemptRow, test: TestRow, warningsAdded: number) {
  const { data: all } = await db().from('proctoring_events').select('severity,confidence,review_status').eq('attempt_id', attempt.id).limit(5000);
  const score = integrityScore((all ?? []) as any);
  const security = readSecurity(test.security);
  const warningCount = (attempt.warning_count ?? 0) + warningsAdded;
  const state = { ...(attempt.proctoring_state ?? {}) };
  let escalatedNow = false;
  if (!state.escalated && warningCount >= security.warningEscalationThreshold) {
    state.escalated = true;
    state.escalatedAt = new Date().toISOString();
    escalatedNow = true;
  }
  await db().from('attempts').update({ integrity_score: score, risk_level: riskLevelFrom(score), warning_count: warningCount, proctoring_state: state }).eq('id', attempt.id);
  if (escalatedNow) {
    await insertEvents(attempt, test, [{ event_type: 'teacher_alert', category: 'service', severity: 'info', source: 'server', confidence: 1, details: { reason: `Reached ${warningCount} warnings`, threshold: security.warningEscalationThreshold } }]);
  }
  return { integrityScore: score, warningCount, escalated: Boolean(state.escalated) };
}

export async function recordEvents(attemptId: string, user: AuthedUser, raw: unknown) {
  rateLimit(`events:${attemptId}`, 120, 60_000);
  const { attempt, test } = await activeAttempt(attemptId, user, true);
  const { events } = z.object({ events: z.array(eventSchema).min(1).max(25) }).parse(raw);
  const now = Date.now();
  let warnings = 0;
  const rows = events.map((e) => {
    const spec = BROWSER_EVENTS[e.type];
    if (spec.warn) warnings += 1;
    // Client timestamps are accepted only within a sane window.
    const at = e.occurredAt && Math.abs(new Date(e.occurredAt).getTime() - now) < 10 * 60_000 ? e.occurredAt : new Date(now).toISOString();
    return { event_type: e.type, category: spec.category, severity: spec.severity, source: 'browser', confidence: e.confidence ?? (spec.category === 'vision' ? 0.6 : 1), details: { ...(e.details ?? {}), durationSeconds: e.durationSeconds ?? null }, bbox: e.boxes?.length ? e.boxes : null, occurred_at: at };
  });
  await insertEvents(attempt, test, rows);
  const integrity = await refreshIntegrity(attempt, test, attempt.status === 'in_progress' ? warnings : 0);
  const security = readSecurity(test.security);
  const pauseRequired = events.some((e) => (e.type === 'camera_disconnected' && security.cameraDisconnectPolicy === 'pause') || (e.type === 'fullscreen_exit' && security.fullscreenExitPolicy === 'pause'));
  return { recorded: rows.length, ...integrity, pauseRequired };
}

const heartbeatSchema = z.object({
  cameraStatus: z.enum(['active', 'off', 'blocked', 'not_required']).default('not_required'),
  fullscreen: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export async function heartbeat(attemptId: string, user: AuthedUser, raw: unknown) {
  rateLimit(`hb:${attemptId}`, 30, 60_000);
  const { attempt, test } = await loadOwnAttempt(attemptId, user);
  const input = heartbeatSchema.parse(raw ?? {});
  const config = readConfig(test.config);
  if (attempt.status === 'in_progress' && isExpired(attempt.expires_at, new Date(), config.submissionGraceSeconds)) {
    await finalizeAttempt(attempt, test, 'timeout');
    return { status: 'auto_submitted', serverTime: new Date().toISOString(), expiresAt: attempt.expires_at };
  }
  if (['calibrating', 'in_progress'].includes(attempt.status)) {
    await db().from('attempts').update({ heartbeat_at: new Date().toISOString(), camera_status: input.cameraStatus }).eq('id', attemptId);
  }
  return { status: attempt.status, serverTime: new Date().toISOString(), expiresAt: attempt.expires_at, warningCount: attempt.warning_count, identityStatus: attempt.identity_status };
}

/* ------------------------------ Identity ------------------------------ */
const MAX_IDENTITY_FAILURES = 3;

export async function verifyIdentity(attemptId: string, user: AuthedUser, request: Request) {
  rateLimit(`identity:${attemptId}`, 10, 60_000);
  const { attempt, test } = await activeAttempt(attemptId, user, true);
  if (!attempt.student_record_id) throw conflict('Your enrolment record is incomplete. Ask your teacher to re-add you.');
  const security = readSecurity(test.security);
  const { data: enrollment } = await db().from('students').select('id,face_registration_status').eq('id', attempt.student_record_id).maybeSingle();
  const form = await readForm(request, 3_000_000);
  const file = form.get('file');

  if (String(enrollment?.face_registration_status || '').toUpperCase() !== 'REGISTERED') {
    await insertEvents(attempt, test, [{ event_type: 'identity_not_enrolled', category: 'identity', severity: 'medium', source: 'server', confidence: 1, details: {} }]);
    const status = security.proctoringFailurePolicy === 'block' ? 'failed' : 'manual_review';
    await db().from('attempts').update({ identity_status: status }).eq('id', attemptId);
    return { verified: false, reason: 'not_enrolled', identityStatus: status, message: 'Your Face ID is not registered for this classroom. Register it from Settings, or ask your teacher to approve you manually.', canProceed: status === 'manual_review' };
  }

  let result;
  try {
    result = await checkFace({ classroomId: test.classroom_id, attemptId, enrollmentId: attempt.student_record_id, userId: user.id, file: file as File });
  } catch (error) {
    if (error instanceof ApiError && error.status !== 503) throw error;
    // Temporary ML outage: follow the teacher's failure policy, never silently pass.
    const status = security.proctoringFailurePolicy === 'block' ? 'pending' : 'manual_review';
    await db().from('attempts').update({ identity_status: status }).eq('id', attemptId);
    await insertEvents(attempt, test, [{ event_type: 'identity_service_unavailable', category: 'service', severity: 'low', source: 'server', confidence: 1, details: { policy: security.proctoringFailurePolicy } }]);
    return { verified: false, reason: 'service_unavailable', identityStatus: status, message: status === 'manual_review' ? 'Face verification is temporarily unavailable. You may continue; your teacher will review your identity.' : 'Face verification is temporarily unavailable. Please try again in a minute.', canProceed: status === 'manual_review' };
  }

  const checks = (attempt.identity_checks ?? 0) + 1;
  if (result.verified) {
    await db().from('attempts').update({ identity_status: 'verified', identity_verified_at: new Date().toISOString(), identity_checks: checks }).eq('id', attemptId);
    await insertEvents(attempt, test, [{ event_type: 'identity_verified', category: 'identity', severity: 'info', source: 'face_service', confidence: Math.min(1, result.similarity / 100), details: { similarity: Math.round(result.similarity) } }]);
    return { verified: true, reason: 'verified', identityStatus: 'verified', similarity: Math.round(result.similarity), canProceed: true, faces: result.faces.map((f) => f.box) };
  }
  const status = checks >= MAX_IDENTITY_FAILURES ? (security.proctoringFailurePolicy === 'block' ? 'failed' : 'manual_review') : 'pending';
  await db().from('attempts').update({ identity_status: status, identity_checks: checks }).eq('id', attemptId);
  await insertEvents(attempt, test, [{ event_type: `identity_${result.reason}`, category: 'identity', severity: result.reason === 'mismatch' ? 'high' : 'low', source: 'face_service', confidence: 0.9, details: { similarity: Math.round(result.similarity), faceCount: result.faceCount, attempt: checks } }]);
  const messages: Record<string, string> = {
    no_face: 'No face was detected. Sit facing the camera in good light.',
    multiple_faces: 'More than one face is visible. Make sure only you are in front of the camera.',
    mismatch: 'Your face did not match your registered Face ID.',
    low_quality: 'The image was too dark or blurry. Improve the lighting and try again.',
  };
  return { verified: false, reason: result.reason, identityStatus: status, message: `${messages[result.reason] ?? 'Verification failed.'}${status === 'pending' ? ` (${MAX_IDENTITY_FAILURES - checks} tries left)` : status === 'manual_review' ? ' Your teacher will review your identity; you may continue.' : ' Ask your teacher for help.'}`, canProceed: status === 'manual_review', faces: result.faces.map((f) => f.box), attemptsLeft: Math.max(0, MAX_IDENTITY_FAILURES - checks) };
}

/** Periodic in-exam identity re-check. Returns only boxes and a match flag. */
export async function frameCheck(attemptId: string, user: AuthedUser, request: Request) {
  const { attempt, test } = await activeAttempt(attemptId, user);
  const security = readSecurity(test.security);
  rateLimit(`frame:${attemptId}`, Math.max(2, Math.ceil(120 / security.identityRecheckSeconds) + 2), 120_000);
  if (!security.liveProctoring && !security.requireIdentityVerification) return { checked: false, reason: 'not_required' };
  if (!attempt.student_record_id || !isFaceServiceConfigured()) return { checked: false, reason: 'service_unavailable' };
  const form = await readForm(request, 3_000_000);
  let result;
  try {
    result = await checkFace({ classroomId: test.classroom_id, attemptId, enrollmentId: attempt.student_record_id, userId: user.id, file: form.get('file') as File });
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) return { checked: false, reason: 'service_unavailable' };
    throw error;
  }
  const events: Array<Record<string, unknown>> = [];
  let warnings = 0;
  if (result.reason === 'mismatch') { events.push({ event_type: 'identity_mismatch', category: 'identity', severity: 'high', source: 'face_service', confidence: 0.85, details: { similarity: Math.round(result.similarity) }, bbox: null }); warnings += 1; }
  if (result.reason === 'multiple_faces') { events.push({ event_type: 'multiple_faces', category: 'vision', severity: 'high', source: 'face_service', confidence: 0.9, details: { faceCount: result.faceCount } }); warnings += 1; }
  if (result.reason === 'no_face') { events.push({ event_type: 'face_absent', category: 'vision', severity: 'medium', source: 'face_service', confidence: 0.8, details: {} }); warnings += 1; }
  if (events.length) await insertEvents(attempt, test, events);
  // A mismatch moves the attempt back to "pending" so the client forces re-verification.
  if (result.reason === 'mismatch') await db().from('attempts').update({ identity_status: 'pending' }).eq('id', attemptId);
  const integrity = warnings ? await refreshIntegrity(attempt, test, warnings) : null;
  return { checked: true, verified: result.verified, reason: result.reason, faceCount: result.faceCount, faces: result.faces.map((f) => ({ box: f.box, matched: f.matched })), reverify: result.reason === 'mismatch', integrity };
}

/* ------------------------------ ML features ------------------------------ */
export async function analyzeFeatures(attemptId: string, user: AuthedUser, raw: unknown) {
  rateLimit(`features:${attemptId}`, 40, 60_000);
  const { attempt, test } = await activeAttempt(attemptId, user, true);
  const security = readSecurity(test.security);
  if (!security.liveProctoring) return { accepted: false, reason: 'not_enabled' };
  if (!isMlConfigured()) return { accepted: false, reason: 'service_unavailable' };
  const { features, phase } = z.object({ features: featureSchema, phase: z.enum(['calibrate', 'finalize', 'analyze']).default('analyze') }).parse(raw);
  const baseline = attempt.proctoring_baseline ?? {};
  try {
    if (phase === 'calibrate' || (phase === 'analyze' && !baseline.finalized && attempt.status === 'calibrating')) {
      const updated = await mlBaselineUpdate(attemptId, baseline, features);
      await db().from('attempts').update({ proctoring_baseline: updated }).eq('id', attemptId);
      return { accepted: true, phase: 'calibrate', samples: (updated as any).sample_count ?? 0 };
    }
    if (phase === 'finalize') {
      if (baseline.finalized) return { accepted: true, phase: 'finalize', baselineReady: true };
      const finalized = await mlBaselineFinalize(attemptId, baseline, features);
      await db().from('attempts').update({ proctoring_baseline: finalized }).eq('id', attemptId);
      return { accepted: true, phase: 'finalize', baselineReady: Boolean((finalized as any).finalized) };
    }
    if (attempt.status !== 'in_progress') return { accepted: false, reason: 'not_started' };
    const t = security.thresholds;
    const result = await mlAnalyze({
      attemptId, studentId: attempt.student_id, baseline, temporalState: attempt.proctoring_state?.ml ?? {}, features,
      faceVerified: attempt.identity_status === 'verified' ? true : undefined,
      policy: { baselineSeconds: 20, minimumEventSeconds: Math.round(t.lookAwaySeconds), eventCooldownSeconds: Math.round(t.cooldownSeconds), faceAbsenceSeconds: Math.round(t.faceAbsentSeconds), headTurnDegrees: t.headYawDegrees, headPitchDegrees: t.headPitchDegrees },
    });
    const mapType: Record<string, string> = { face_missing: 'face_absent', head_away: 'head_turned', gaze_deviation: 'looking_away' };
    const rows = result.events.map((e) => ({ event_type: mapType[e.event_type] ?? e.event_type, category: e.event_type === 'unknown_face' ? 'identity' : 'vision', severity: e.severity, source: 'ml_service', confidence: e.confidence, details: { ...e.evidence, model: result.model_version, durationSeconds: e.duration_seconds } }));
    await insertEvents(attempt, test, rows);
    await db().from('attempts').update({ proctoring_state: { ...(attempt.proctoring_state ?? {}), ml: result.temporal_state, mlRisk: result.risk_score } }).eq('id', attemptId);
    const integrity = rows.length ? await refreshIntegrity(attempt, test, rows.length) : null;
    return { accepted: true, riskLevel: result.risk_level, riskScore: result.risk_score, events: rows.map((r) => ({ type: r.event_type, severity: r.severity })), integrity };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[ml] analyze failed', (error as Error).message);
    return { accepted: false, reason: 'service_unavailable' };
  }
}

export async function serviceStatus() {
  const { mlHealth } = await import('./mlClient');
  return { faceService: isFaceServiceConfigured(), mlService: await mlHealth() };
}

export { getAttemptState, unavailable };
