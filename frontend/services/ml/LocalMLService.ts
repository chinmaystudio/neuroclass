import * as faceapi from '@vladmandic/face-api';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

let ssdModel: cocoSsd.ObjectDetection | null = null;
let modelsLoaded = false;
let modelLoadPromise: Promise<void> | null = null;

// Pin the model assets to the same face-api version used by the application.
// This avoids production builds silently pulling a moving `master` revision.
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';

export interface FaceMatchResult {
  studentId?: string;
  name?: string;
  confidence: number;
  box?: { x: number; y: number; width: number; height: number };
}

export interface MalpracticeResult {
  isMalpractice: boolean;
  reason: string;
  type: 'GAZE' | 'OBJECT' | 'TALKING' | 'IDENTITY' | 'MULTI_FACE' | 'ABSENCE' | 'NONE';
  confidence: number;
  boundingBoxes?: { x: number, y: number, width: number, height: number, label: string }[];
}

// ─────────────────────────────────────────────
// SMALL-OBJECT SCAN CONFIG
// Each zone is expressed as fractional offsets of (videoWidth, videoHeight)
// so it scales to any resolution automatically.
// ─────────────────────────────────────────────
interface ScanZone {
  id: string;
  label: string;
  xFrac: number;  // left edge as fraction of width
  yFrac: number;  // top edge as fraction of height
  wFrac: number;  // zone width as fraction of total width
  hFrac: number;  // zone height as fraction of total height
  scale: number;  // how much to magnify crop before running COCO-SSD
}

const SCAN_ZONES: ScanZone[] = [
  // Ear / Earphone zone — left
  { id: 'ear_l',   label: 'EARPHONE / WIRELESS BUD',    xFrac: 0.0,  yFrac: 0.05, wFrac: 0.18, hFrac: 0.35, scale: 4 },
  // Ear / Earphone zone — right
  { id: 'ear_r',   label: 'EARPHONE / WIRELESS BUD',    xFrac: 0.82, yFrac: 0.05, wFrac: 0.18, hFrac: 0.35, scale: 4 },
  // Neck / Collar zone — neckbands, BT dongles
  { id: 'neck',    label: 'NECKBAND / BT DEVICE',        xFrac: 0.25, yFrac: 0.55, wFrac: 0.50, hFrac: 0.30, scale: 3.5 },
  // Wrist zone — smartwatches
  { id: 'wrist_l', label: 'SMARTWATCH / WRISTBAND',      xFrac: 0.0,  yFrac: 0.70, wFrac: 0.22, hFrac: 0.30, scale: 3.5 },
  { id: 'wrist_r', label: 'SMARTWATCH / WRISTBAND',      xFrac: 0.78, yFrac: 0.70, wFrac: 0.22, hFrac: 0.30, scale: 3.5 },
  // Desk / lap zone — phone lying flat, cheat-sheet
  { id: 'desk',    label: 'PHONE / NOTES ON DESK',       xFrac: 0.15, yFrac: 0.80, wFrac: 0.70, hFrac: 0.20, scale: 2.5 },
];

// Classes that are forbidden even at small sizes
const FORBIDDEN_CLASSES = new Set([
  'cell phone', 'laptop', 'mouse', 'remote', 'keyboard', 'book', 'tablet',
  'tv', 'electronics', 'hardware', 'tie', 'handbag', 'backpack', 'scissors',
  'hair drier', 'clock', 'bottle', 'cup', 'earphone', 'headphones',
]);

// Confidence thresholds — lower for zoomed crops (small objects look bigger when magnified)
const THRESHOLD_GLOBAL = 0.28;
const THRESHOLD_ZOOMED = 0.20;   // more aggressive on crops
const THRESHOLD_PHONE  = 0.18;   // ultra-sensitive for phones
const THRESHOLD_TIE    = 0.16;   // tie ≈ neckband proxy

// ─────────────────────────────────────────────
// PITCH CONSTANTS (exam-writing awareness)
// ─────────────────────────────────────────────
// Students bow their heads while writing — pitchRatio goes LOW (< PITCH_WRITE_THRESHOLD).
// We ONLY flag when the head tilts unusually HIGH (looking at ceiling / away).
// This mirrors the original proctor_engine.py intent.
const PITCH_UP_THRESHOLD   = 1.25;   // looking upward — FLAGGED
const PITCH_DOWN_MIN       = 0.40;   // natural exam writing bow — IGNORED
// Extremely deep drop (head nearly on desk) is unusual but we give benefit of doubt
// unless combined with absence signal.

export const LocalMLService = {
  async loadModels(): Promise<void> {
    if (modelsLoaded) return;
    if (modelLoadPromise) return modelLoadPromise;

    modelLoadPromise = (async () => {
      console.log('[LocalML] Loading proctoring models…');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      ]);
      ssdModel = await cocoSsd.load();
      modelsLoaded = true;
      console.log('[LocalML] Engine ready — Small-Object + Exam-Aware Mode');
    })().catch(error => {
      modelLoadPromise = null;
      console.error('[LocalML] Model load error:', error);
      throw error;
    });

    return modelLoadPromise;
  },

  // ─────────────────────────────────────────────
  // UTILITY: Normalize canvas brightness
  // ─────────────────────────────────────────────
  async getNormalizedCanvas(
    input: HTMLVideoElement | HTMLCanvasElement,
  ): Promise<HTMLCanvasElement> {
    const width  = input instanceof HTMLVideoElement ? input.videoWidth  : input.width;
    const height = input instanceof HTMLVideoElement ? input.videoHeight : input.height;
    const canvas = document.createElement('canvas');
    if (!width || !height) return canvas;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(input, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;
    let brightness = 0;
    for (let i = 0; i < d.length; i += 400) {
      brightness += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    const avg = brightness / (d.length / 400);
    if (avg < 60) {
      ctx.filter = 'brightness(1.6) contrast(1.3) saturate(1.1)';
      ctx.drawImage(canvas, 0, 0);
    } else if (avg > 190) {
      ctx.filter = 'brightness(0.8) contrast(1.1)';
      ctx.drawImage(canvas, 0, 0);
    }
    return canvas;
  },

  // ─────────────────────────────────────────────
  // UTILITY: Extract and magnify a zone crop
  // Returns a canvas ready to pass to COCO-SSD
  // ─────────────────────────────────────────────
  extractZoneCrop(
    source: HTMLVideoElement,
    zone: ScanZone,
  ): HTMLCanvasElement | null {
    const vw = source.videoWidth;
    const vh = source.videoHeight;
    if (!vw || !vh) return null;

    const sx = Math.floor(zone.xFrac * vw);
    const sy = Math.floor(zone.yFrac * vh);
    const sw = Math.floor(zone.wFrac * vw);
    const sh = Math.floor(zone.hFrac * vh);
    if (sw < 4 || sh < 4) return null;

    const dw = Math.floor(sw * zone.scale);
    const dh = Math.floor(sh * zone.scale);

    const crop = document.createElement('canvas');
    crop.width  = dw;
    crop.height = dh;
    const ctx = crop.getContext('2d');
    if (!ctx) return null;

    // Apply sharpening filter before upscale for small textures
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);

    // Extra contrast pass to pop small objects
    ctx.filter = 'contrast(1.25) saturate(1.3)';
    ctx.drawImage(crop, 0, 0);

    return crop;
  },

  // ─────────────────────────────────────────────
  // CORE: Run small-object zone scans
  // Runs COCO-SSD on every magnified crop and maps
  // any hits back to original video coordinates.
  // ─────────────────────────────────────────────
  async runZoneScans(
    video: HTMLVideoElement,
  ): Promise<{ x: number; y: number; width: number; height: number; label: string }[]> {
    if (!ssdModel) return [];
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const hits: { x: number; y: number; width: number; height: number; label: string }[] = [];

    for (const zone of SCAN_ZONES) {
      const crop = this.extractZoneCrop(video, zone);
      if (!crop) continue;

      let preds: cocoSsd.DetectedObject[] = [];
      try {
        preds = await ssdModel.detect(crop);
      } catch (_) { continue; }

      for (const p of preds) {
        if (!FORBIDDEN_CLASSES.has(p.class)) continue;

        let threshold = THRESHOLD_ZOOMED;
        if (p.class === 'cell phone') threshold = THRESHOLD_PHONE;
        if (p.class === 'tie')        threshold = THRESHOLD_TIE;
        if (p.score < threshold)      continue;

        // Map crop coordinates back to original video space
        const originX = zone.xFrac * vw;
        const originY = zone.yFrac * vh;
        const scaleInv = 1 / zone.scale;
        const origX = originX + p.bbox[0] * scaleInv;
        const origY = originY + p.bbox[1] * scaleInv;
        const origW = p.bbox[2] * scaleInv;
        const origH = p.bbox[3] * scaleInv;

        const label =
          p.class === 'tie'        ? zone.label :
          p.class === 'cell phone' ? 'PHONE DETECTED'    :
          zone.label !== zone.label ? zone.label          :
          p.class.toUpperCase();

        hits.push({ x: origX, y: origY, width: origW, height: origH, label });
      }
    }
    return hits;
  },

  // ─────────────────────────────────────────────
  // Fast face detection (landmarks only)
  // ─────────────────────────────────────────────
  async detectFacesFast(input: HTMLVideoElement | HTMLCanvasElement) {
    if (!modelsLoaded) await this.loadModels();
    return faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.3 }))
      .withFaceLandmarks();
  },

  // ─────────────────────────────────────────────
  // Robust face detection (descriptors, with fallbacks)
  // ─────────────────────────────────────────────
  async detectFacesRobustly(input: HTMLVideoElement | HTMLCanvasElement) {
    if (!modelsLoaded) await this.loadModels();

    const run = (src: any) =>
      faceapi
        .detectAllFaces(src, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

    let detections = await run(input);
    if (!detections.length) {
      const norm = await this.getNormalizedCanvas(input);
      detections = await run(norm);
    }
    if (!detections.length) {
      detections = await faceapi
        .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    }
    return detections;
  },

  // ─────────────────────────────────────────────
  // MAIN: detectMalpractice
  // Priority order:
  //   1. Forbidden objects (global scan)
  //   2. Small-object zone scans (neckband, earphone, etc.)
  //   3. Multiple persons / faces
  //   4. Identity obscured
  //   5. Head pose (yaw only, pitch only UP — writing bow ignored)
  //   6. Talking
  //   7. Absence
  // ─────────────────────────────────────────────
  async detectMalpractice(videoElement: HTMLVideoElement): Promise<MalpracticeResult> {
    if (!modelsLoaded) await this.loadModels();
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      return { isMalpractice: false, reason: 'Video not ready', type: 'NONE', confidence: 0 };
    }

    try {
      // ── Run face + object detection in parallel ──
      const [detections, ssdPredictions] = await Promise.all([
        this.detectFacesFast(videoElement),
        ssdModel?.detect(videoElement) ?? Promise.resolve([]),
      ]);

      const boxes: { x: number; y: number; width: number; height: number; label: string }[] = [];

      // ── 1. Global COCO-SSD object scan ──
      const forbiddenGlobal = (ssdPredictions as cocoSsd.DetectedObject[]).filter(p => {
        if (!FORBIDDEN_CLASSES.has(p.class)) return false;
        let th = THRESHOLD_GLOBAL;
        if (p.class === 'cell phone') th = THRESHOLD_PHONE;
        if (p.class === 'tie' || p.class === 'remote') th = THRESHOLD_TIE;
        return p.score > th;
      });
      forbiddenGlobal.forEach(p => {
        boxes.push({
          x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3],
          label: p.class === 'tie' ? 'NECKBAND / WEARABLE' : p.class.toUpperCase(),
        });
      });

      // ── 2. Small-object zone scans (run even if global found nothing) ──
      const zoneHits = await this.runZoneScans(videoElement);
      // De-duplicate against boxes already found (IoU > 0.3 → skip)
      for (const hit of zoneHits) {
        const duplicate = boxes.some(b => {
          const ix = Math.max(0, Math.min(b.x + b.width, hit.x + hit.width) - Math.max(b.x, hit.x));
          const iy = Math.max(0, Math.min(b.y + b.height, hit.y + hit.height) - Math.max(b.y, hit.y));
          const iArea = ix * iy;
          const uArea = b.width * b.height + hit.width * hit.height - iArea;
          return uArea > 0 && iArea / uArea > 0.3;
        });
        if (!duplicate) boxes.push(hit);
      }

      // ── 3. Multiple persons ──
      const persons = (ssdPredictions as cocoSsd.DetectedObject[]).filter(
        p => p.class === 'person' && p.score > 0.25,
      );
      if (persons.length > 1) {
        persons.slice(1).forEach((p, idx) => {
          boxes.push({
            x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3],
            label: `UNAUTHORIZED PERSON ${idx + 1}`,
          });
        });
      }

      // Return immediately if any physical violation found
      if (boxes.length > 0) {
        return {
          isMalpractice: true,
          reason: boxes.map(b => b.label).join(' | ') + ' detected',
          type: persons.length > 1 ? 'MULTI_FACE' : 'OBJECT',
          confidence: 92,
          boundingBoxes: boxes,
        };
      }

      // ── 4. Multiple faces ──
      if (detections.length > 1) {
        detections.forEach((d, i) => {
          boxes.push({
            x: d.detection.box.x, y: d.detection.box.y,
            width: d.detection.box.width, height: d.detection.box.height,
            label: i === 0 ? 'PRIMARY CANDIDATE' : 'SECONDARY FACE',
          });
        });
        return { isMalpractice: true, reason: 'Multiple faces in frame', type: 'MULTI_FACE', confidence: 98, boundingBoxes: boxes };
      }

      // ── 6. Single-face behavioural checks ──
      if (detections.length === 1) {
        const landmarks = detections[0].landmarks;
        const nose      = landmarks.getNose()[0];
        const leftEye   = landmarks.getLeftEye();
        const rightEye  = landmarks.getRightEye();
        const mouth     = landmarks.getMouth();
        const jaw       = landmarks.getJawOutline();
        const faceBox   = detections[0].detection.box;

        // ── HEAD YAW (left/right) ──
        const leftDist  = Math.abs(nose.x - leftEye[0].x);
        const rightDist = Math.abs(nose.x - rightEye[3].x);
        const yawRatio  = Math.max(leftDist, rightDist) / (Math.min(leftDist, rightDist) || 1);
        if (yawRatio > 2.8) {
          return {
            isMalpractice: true,
            reason: 'Head Orientation Violation: Looking out of frame',
            type: 'GAZE',
            confidence: 80,
            boundingBoxes: [{ x: faceBox.x, y: faceBox.y, width: faceBox.width, height: faceBox.height, label: 'SUSPICIOUS GAZE' }],
          };
        }

        // ── HEAD PITCH (up/down) ──
        const eyeNoseHeight = nose.y - (leftEye[0].y + rightEye[3].y) / 2;
        const noseJawHeight = jaw[8].y - nose.y;
        const pitchRatio    = eyeNoseHeight / (noseJawHeight || 1);

        // ONLY flag upward tilt — downward tilt is normal exam-writing posture
        if (pitchRatio > PITCH_UP_THRESHOLD) {
          return {
            isMalpractice: true,
            reason: 'Visual Violation: Looking above screen',
            type: 'GAZE',
            confidence: 90,
            boundingBoxes: [{ x: faceBox.x, y: faceBox.y, width: faceBox.width, height: faceBox.height, label: 'LOOKING UP' }],
          };
        }
        // pitchRatio < PITCH_DOWN_MIN  →  writing/reading — NOT flagged ✓

        // ── TALKING ──
        const mouthInnerTop    = mouth[15].y;
        const mouthInnerBottom = mouth[17].y;
        const mouthOpenRatio   = (mouthInnerBottom - mouthInnerTop) / (faceBox.height || 1);
        if (mouthOpenRatio > 0.04) {
          return {
            isMalpractice: true,
            reason: 'Vocal Activity Indicator: Talking detected',
            type: 'TALKING',
            confidence: Math.min(100, Math.round(mouthOpenRatio * 1000)),
            boundingBoxes: [{
              x: mouth[12].x - 10, y: mouth[14].y - 10,
              width:  (mouth[16].x - mouth[12].x) + 20,
              height: (mouth[18].y - mouth[14].y) + 20,
              label: 'TALKING',
            }],
          };
        }
      }

      // ── 7. Absence ──
      if (persons.length === 0 && detections.length === 0) {
        return { isMalpractice: true, reason: 'Candidate absence detected', type: 'ABSENCE', confidence: 100, boundingBoxes: [] };
      }

      return { isMalpractice: false, reason: 'None', type: 'NONE', confidence: 0 };

    } catch (error) {
      console.error('[LocalML] Analysis error:', error);
      return { isMalpractice: false, reason: 'Runtime error', type: 'NONE', confidence: 0 };
    }
  },

  async getFaceDescriptor(input: HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> {
    const width  = input instanceof HTMLVideoElement ? input.videoWidth  : input.width;
    const height = input instanceof HTMLVideoElement ? input.videoHeight : input.height;
    if (!width || !height) return null;
    const detections = await this.detectFacesRobustly(input);
    return detections.length ? detections[0].descriptor : null;
  },

  async matchFace(
    videoElement: HTMLVideoElement,
    enrolledDescriptors: { id: string; name: string; descriptor: Float32Array }[],
  ): Promise<FaceMatchResult | null> {
    if (!videoElement.videoWidth || !videoElement.videoHeight || enrolledDescriptors.length === 0) return null;
    const detections = await this.detectFacesRobustly(videoElement);
    if (!detections.length) return null;
    const descriptor = detections[0].descriptor;
    const faceMatcher = new faceapi.FaceMatcher(
      enrolledDescriptors.map(d => new faceapi.LabeledFaceDescriptors(d.id, [d.descriptor])),
    );
    const bestMatch = faceMatcher.findBestMatch(descriptor);
    if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.65) {
      const student = enrolledDescriptors.find(s => s.id === bestMatch.label);
      const box = detections[0].detection.box;
      return {
        studentId: student?.id,
        name: student?.name,
        confidence: Math.round((1 - bestMatch.distance) * 100),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    }
    return null;
  },
};
