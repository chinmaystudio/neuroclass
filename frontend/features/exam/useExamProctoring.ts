import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lms/api';
import type { AttemptState } from '../lms/types';
import { analyzeFrame, loadFaceLandmarker, type NormalizedBox, type VisionSample } from './vision';

/**
 * Exam proctoring signals with temporal confirmation: a condition must persist
 * for the teacher-configured number of seconds before it becomes a warning,
 * and each warning type has a cooldown. A warning is a review signal for the
 * teacher — never an automatic penalty.
 */
export type ProctorWarning = { id: number; type: string; message: string; severity: 'low' | 'medium' | 'high'; boxes: NormalizedBox[]; at: number };
export type CameraStatus = 'off' | 'starting' | 'active' | 'blocked' | 'disconnected';
export type BrowserEvent = { type: string; occurredAt?: string; confidence?: number; durationSeconds?: number; details?: Record<string, string | number | boolean | null>; boxes?: NormalizedBox[] };

const MESSAGES: Record<string, string> = {
  face_absent: 'We cannot see your face. Please stay in front of the camera.',
  multiple_faces: 'More than one person is visible. Only you should be in view.',
  looking_away: 'Please keep your eyes on the exam screen.',
  head_turned: 'Please face the screen.',
  camera_obstructed: 'Your camera looks covered or too dark.',
  suspicious_object: 'A phone or similar device may be visible.',
  camera_disconnected: 'Your camera was disconnected. Reconnect it to continue.',
  tab_hidden: 'You left the exam tab. This has been recorded.',
  fullscreen_exit: 'You left full-screen mode. Return to full screen to continue.',
  identity_mismatch: 'Your face did not match your registered Face ID. Please verify again.',
};

type Options = {
  attemptId: string;
  security: AttemptState['test']['security'];
  enabled: boolean;
  phase: 'calibrate' | 'exam';
  onReverify?: () => void;
};

export function useExamProctoring({ attemptId, security, enabled, phase, onReverify }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('off');
  const [visionStatus, setVisionStatus] = useState<'off' | 'loading' | 'ready' | 'unavailable'>('off');
  const [liveBoxes, setLiveBoxes] = useState<NormalizedBox[]>([]);
  const [activeWarning, setActiveWarning] = useState<ProctorWarning | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('low');
  const queue = useRef<BrowserEvent[]>([]);
  const since = useRef<Record<string, number>>({});
  const lastEmitted = useRef<Record<string, number>>({});
  const warningId = useRef(0);
  const phoneHits = useRef(0);
  const reverifyRef = useRef(onReverify);
  reverifyRef.current = onReverify;

  const t = security.thresholds;
  const vision = enabled && security.liveProctoring;

  const record = useCallback((event: BrowserEvent, warn = true) => {
    queue.current.push({ occurredAt: new Date().toISOString(), ...event });
    if (warn && MESSAGES[event.type]) {
      const severity = ['multiple_faces', 'camera_disconnected', 'identity_mismatch'].includes(event.type) ? 'high' : ['tab_hidden', 'fullscreen_exit', 'face_absent', 'camera_obstructed', 'suspicious_object'].includes(event.type) ? 'medium' : 'low';
      setActiveWarning({ id: ++warningId.current, type: event.type, message: MESSAGES[event.type], severity, boxes: event.boxes ?? [], at: Date.now() });
      setWarningCount((c) => c + 1);
    }
  }, []);

  const flush = useCallback(async (keepalive = false) => {
    if (!queue.current.length) return;
    const batch = queue.current.splice(0, 25);
    try {
      const res = await api.post<{ warningCount: number; integrityScore: number }>(`attempts/${attemptId}/events`, { events: batch }, { keepalive });
      if (typeof res.warningCount === 'number') setWarningCount(res.warningCount);
    } catch {
      queue.current.unshift(...batch); // retried on the next flush
    }
  }, [attemptId]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => void flush(), 3000);
    const beforeUnload = () => void flush(true);
    window.addEventListener('pagehide', beforeUnload);
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', beforeUnload); void flush(true); };
  }, [enabled, flush]);

  /* -------------------------- Camera -------------------------- */
  const startCamera = useCallback(async () => {
    if (streamRef.current) return true;
    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', () => {
        streamRef.current = null;
        setCameraStatus('disconnected');
        record({ type: 'camera_disconnected' });
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraStatus('active');
      return true;
    } catch (error) {
      setCameraStatus('blocked');
      return false;
    }
  }, [record]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStatus('off');
  }, []);

  // Re-attach the stream when the <video> element mounts or changes.
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play().catch(() => undefined);
    }
  }, []);

  const captureFrame = useCallback(async (quality = 0.82): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(640, video.videoWidth);
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /* ---------------------- Temporal rules ---------------------- */
  const evaluate = useCallback((s: VisionSample, now: number) => {
    const conditions: Array<{ type: string; active: boolean; seconds: number; boxes?: NormalizedBox[]; details?: BrowserEvent['details'] }> = [
      { type: 'face_absent', active: s.faceCount === 0 && s.frameQuality >= 0.15, seconds: t.faceAbsentSeconds },
      { type: 'multiple_faces', active: s.faceCount > 1, seconds: t.multiFaceSeconds, boxes: s.boxes.map((b, i) => ({ ...b, label: i === 0 ? 'Candidate' : 'Additional face' })) },
      { type: 'head_turned', active: s.faceCount === 1 && ((s.yaw !== null && Math.abs(s.yaw) >= t.headYawDegrees) || (s.pitch !== null && Math.abs(s.pitch) >= t.headPitchDegrees)), seconds: t.lookAwaySeconds, boxes: s.boxes.slice(0, 1).map((b) => ({ ...b, label: 'Head turned' })), details: { yaw: s.yaw, pitch: s.pitch } },
      { type: 'looking_away', active: s.faceCount === 1 && s.gazeHorizontal !== null && Math.abs(s.gazeHorizontal) >= 0.65, seconds: t.lookAwaySeconds + 1, boxes: s.boxes.slice(0, 1).map((b) => ({ ...b, label: 'Looking away' })), details: { gaze: s.gazeHorizontal } },
      { type: 'camera_obstructed', active: s.frameQuality < 0.12, seconds: 3, details: { frameQuality: s.frameQuality } },
    ];
    let anyActive = false;
    for (const c of conditions) {
      if (!c.active) { delete since.current[c.type]; continue; }
      anyActive = true;
      const start = since.current[c.type] ?? (since.current[c.type] = now);
      const duration = (now - start) / 1000;
      const cooled = now - (lastEmitted.current[c.type] ?? 0) >= t.cooldownSeconds * 1000;
      if (duration >= c.seconds && cooled) {
        lastEmitted.current[c.type] = now;
        record({ type: c.type, durationSeconds: Math.round(duration), confidence: 0.7, boxes: c.boxes, details: c.details });
      }
    }
    // Clear the warning banner once the student is back to normal.
    if (!anyActive) setActiveWarning((w) => (w && ['face_absent', 'multiple_faces', 'head_turned', 'looking_away', 'camera_obstructed'].includes(w.type) && Date.now() - w.at > 2500 ? null : w));
  }, [record, t.cooldownSeconds, t.faceAbsentSeconds, t.headPitchDegrees, t.headYawDegrees, t.lookAwaySeconds, t.multiFaceSeconds]);

  /* ---------------------- Vision loop ---------------------- */
  useEffect(() => {
    if (!vision || cameraStatus !== 'active') return;
    let cancelled = false;
    let timer: number | undefined;
    let lastFeatureSend = 0;
    setVisionStatus('loading');
    loadFaceLandmarker().then((landmarker) => {
      if (cancelled) return;
      setVisionStatus('ready');
      const tick = () => {
        if (cancelled) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && !document.hidden) {
          try {
            const now = performance.now();
            const sample = analyzeFrame(landmarker, video, now);
            setLiveBoxes(sample.boxes);
            if (phase === 'exam') evaluate(sample, Date.now());
            if (Date.now() - lastFeatureSend > 2000) {
              lastFeatureSend = Date.now();
              const primary = sample.boxes[0];
              void api.post<{ riskLevel?: 'low' | 'medium' | 'high' }>(`attempts/${attemptId}/features`, {
                phase: phase === 'calibrate' ? 'calibrate' : 'analyze',
                features: {
                  facePresent: sample.faceCount > 0, faceCount: sample.faceCount,
                  ...(primary ? { faceBboxArea: Math.min(1, primary.width * primary.height), faceCenterX: Math.min(1, primary.x + primary.width / 2), faceCenterY: Math.min(1, primary.y + primary.height / 2) } : {}),
                  ...(sample.yaw !== null ? { headPoseYaw: sample.yaw, headPosePitch: sample.pitch ?? 0, headPoseRoll: sample.roll ?? 0 } : {}),
                  ...(sample.gazeHorizontal !== null ? { gazeHorizontal: sample.gazeHorizontal, gazeVertical: sample.gazeVertical ?? 0 } : {}),
                  frameQuality: sample.frameQuality, movementScore: sample.movement, provider: 'browser_mediapipe',
                },
              }).then((r) => { if (r?.riskLevel) setRisk(r.riskLevel); }).catch(() => undefined);
            }
          } catch { /* a dropped frame is not an event */ }
        }
        timer = window.setTimeout(tick, 500);
      };
      tick();
    }).catch(() => {
      if (cancelled) return;
      setVisionStatus('unavailable');
      record({ type: 'vision_unavailable' }, false);
    });
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [attemptId, cameraStatus, evaluate, phase, record, vision]);

  /* ---------------- Optional phone detection (COCO-SSD) ---------------- */
  useEffect(() => {
    if (!vision || phase !== 'exam' || cameraStatus !== 'active') return;
    let cancelled = false;
    let timer: number | undefined;
    const loop = async () => {
      try {
        const [{ load }] = await Promise.all([import('@tensorflow-models/coco-ssd'), import('@tensorflow/tfjs')]);
        const model = await load({ base: 'lite_mobilenet_v2' });
        const step = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && !document.hidden) {
            const predictions = await model.detect(video, 6, 0.5);
            const phones = predictions.filter((p) => p.class === 'cell phone');
            phoneHits.current = phones.length ? phoneHits.current + 1 : 0;
            // Two consecutive detections ~4 s apart reduce single-frame false positives.
            if (phoneHits.current >= 2 && Date.now() - (lastEmitted.current.suspicious_object ?? 0) > t.cooldownSeconds * 1000) {
              lastEmitted.current.suspicious_object = Date.now();
              const w = video.videoWidth || 1, h = video.videoHeight || 1;
              record({ type: 'suspicious_object', confidence: Math.round(phones[0].score * 100) / 100, boxes: phones.map((p) => ({ x: p.bbox[0] / w, y: p.bbox[1] / h, width: p.bbox[2] / w, height: p.bbox[3] / h, label: 'Phone?' })), details: { object: 'cell phone' } });
            }
          }
          timer = window.setTimeout(step, 4000);
        };
        void step();
      } catch { /* object detection is optional */ }
    };
    void loop();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [cameraStatus, phase, record, t.cooldownSeconds, vision]);

  /* ---------------- Periodic identity re-check ---------------- */
  useEffect(() => {
    if (!enabled || phase !== 'exam' || cameraStatus !== 'active' || !(security.liveProctoring || security.requireIdentityVerification)) return;
    const interval = Math.max(30, security.identityRecheckSeconds) * 1000;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      const frame = await captureFrame(0.7);
      if (!frame) return;
      try {
        const res = await api.upload<{ checked: boolean; reverify?: boolean; reason?: string; faces?: Array<{ box: { x: number; y: number; width: number; height: number } | null }> }>(`attempts/${attemptId}/frame`, frame, 'frame.jpg');
        if (res.checked && res.reverify) {
          setActiveWarning({ id: ++warningId.current, type: 'identity_mismatch', message: MESSAGES.identity_mismatch, severity: 'high', boxes: [], at: Date.now() });
          reverifyRef.current?.();
        }
      } catch { /* the service may be temporarily unavailable */ }
    }, interval);
    return () => window.clearInterval(timer);
  }, [attemptId, cameraStatus, captureFrame, enabled, phase, security.identityRecheckSeconds, security.liveProctoring, security.requireIdentityVerification]);

  return { attachVideo, videoRef, startCamera, stopCamera, captureFrame, cameraStatus, visionStatus, liveBoxes, activeWarning, dismissWarning: () => setActiveWarning(null), warningCount, risk, record, flush };
}
