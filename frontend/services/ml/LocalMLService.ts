import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

let ssdModel: cocoSsd.ObjectDetection | null = null;
let modelLoadPromise: Promise<void> | null = null;

export interface MalpracticeResult {
  isMalpractice: boolean;
  reason: string;
  type: 'GAZE' | 'OBJECT' | 'TALKING' | 'IDENTITY' | 'MULTI_FACE' | 'ABSENCE' | 'NONE';
  confidence: number;
  boundingBoxes?: { x: number; y: number; width: number; height: number; label: string }[];
}

interface ScanZone {
  id: string;
  label: string;
  xFrac: number;
  yFrac: number;
  wFrac: number;
  hFrac: number;
  scale: number;
}

const SCAN_ZONES: ScanZone[] = [
  { id: 'ear_l', label: 'EARPHONE / WIRELESS BUD', xFrac: 0.0, yFrac: 0.05, wFrac: 0.18, hFrac: 0.35, scale: 4 },
  { id: 'ear_r', label: 'EARPHONE / WIRELESS BUD', xFrac: 0.82, yFrac: 0.05, wFrac: 0.18, hFrac: 0.35, scale: 4 },
  { id: 'neck', label: 'NECKBAND / BT DEVICE', xFrac: 0.25, yFrac: 0.55, wFrac: 0.50, hFrac: 0.30, scale: 3.5 },
  { id: 'wrist_l', label: 'SMARTWATCH / WRISTBAND', xFrac: 0.0, yFrac: 0.70, wFrac: 0.22, hFrac: 0.30, scale: 3.5 },
  { id: 'wrist_r', label: 'SMARTWATCH / WRISTBAND', xFrac: 0.78, yFrac: 0.70, wFrac: 0.22, hFrac: 0.30, scale: 3.5 },
  { id: 'desk', label: 'PHONE / NOTES ON DESK', xFrac: 0.15, yFrac: 0.80, wFrac: 0.70, hFrac: 0.20, scale: 2.5 },
];

const FORBIDDEN_CLASSES = new Set([
  'cell phone', 'laptop', 'mouse', 'remote', 'keyboard', 'book', 'tablet',
  'tv', 'electronics', 'hardware', 'tie', 'handbag', 'backpack', 'scissors',
  'hair drier', 'clock', 'bottle', 'cup', 'earphone', 'headphones',
]);

const THRESHOLD_GLOBAL = 0.28;
const THRESHOLD_ZOOMED = 0.20;
const THRESHOLD_PHONE = 0.18;
const THRESHOLD_TIE = 0.16;

export const LocalMLService = {
  /** Loads only the optional COCO-SSD object model used for non-biometric proctoring. */
  async loadModels(): Promise<void> {
    if (ssdModel) return;
    if (modelLoadPromise) return modelLoadPromise;

    modelLoadPromise = (async () => {
      console.log('[LocalML] Loading non-biometric object-monitoring model…');
      ssdModel = await cocoSsd.load();
      console.log('[LocalML] Object-monitoring model ready; face recognition is server-side only.');
    })().catch((error) => {
      modelLoadPromise = null;
      console.error('[LocalML] Object model load error:', error);
      throw error;
    });

    return modelLoadPromise;
  },

  async getNormalizedCanvas(input: HTMLVideoElement | HTMLCanvasElement): Promise<HTMLCanvasElement> {
    const width = input instanceof HTMLVideoElement ? input.videoWidth : input.width;
    const height = input instanceof HTMLVideoElement ? input.videoHeight : input.height;
    const canvas = document.createElement('canvas');
    if (!width || !height) return canvas;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.drawImage(input, 0, 0);
    return canvas;
  },

  extractZoneCrop(source: HTMLVideoElement, zone: ScanZone): HTMLCanvasElement | null {
    const vw = source.videoWidth;
    const vh = source.videoHeight;
    if (!vw || !vh) return null;
    const sx = Math.floor(zone.xFrac * vw);
    const sy = Math.floor(zone.yFrac * vh);
    const sw = Math.floor(zone.wFrac * vw);
    const sh = Math.floor(zone.hFrac * vh);
    if (sw < 4 || sh < 4) return null;
    const crop = document.createElement('canvas');
    crop.width = Math.floor(sw * zone.scale);
    crop.height = Math.floor(sh * zone.scale);
    const ctx = crop.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    return crop;
  },

  async runZoneScans(video: HTMLVideoElement): Promise<{ x: number; y: number; width: number; height: number; label: string }[]> {
    if (!ssdModel) await this.loadModels();
    if (!ssdModel) return [];
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const hits: { x: number; y: number; width: number; height: number; label: string }[] = [];

    for (const zone of SCAN_ZONES) {
      const crop = this.extractZoneCrop(video, zone);
      if (!crop) continue;
      let predictions: cocoSsd.DetectedObject[] = [];
      try {
        predictions = await ssdModel.detect(crop);
      } catch {
        continue;
      }
      for (const prediction of predictions) {
        if (!FORBIDDEN_CLASSES.has(prediction.class)) continue;
        let threshold = THRESHOLD_ZOOMED;
        if (prediction.class === 'cell phone') threshold = THRESHOLD_PHONE;
        if (prediction.class === 'tie') threshold = THRESHOLD_TIE;
        if (prediction.score < threshold) continue;
        const scaleInv = 1 / zone.scale;
        hits.push({
          x: zone.xFrac * vw + prediction.bbox[0] * scaleInv,
          y: zone.yFrac * vh + prediction.bbox[1] * scaleInv,
          width: prediction.bbox[2] * scaleInv,
          height: prediction.bbox[3] * scaleInv,
          label: prediction.class === 'cell phone' ? 'PHONE DETECTED' : prediction.class.toUpperCase(),
        });
      }
    }
    return hits;
  },

  /**
   * Non-biometric exam monitoring. It detects objects and person-count anomalies
   * only; it does not identify students, create descriptors, or compare faces.
   */
  async detectMalpractice(videoElement: HTMLVideoElement): Promise<MalpracticeResult> {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      return { isMalpractice: false, reason: 'Video not ready', type: 'NONE', confidence: 0 };
    }
    if (!ssdModel) await this.loadModels();
    if (!ssdModel) return { isMalpractice: false, reason: 'Object model unavailable', type: 'NONE', confidence: 0 };

    try {
      const predictions = await ssdModel.detect(videoElement);
      const boxes: { x: number; y: number; width: number; height: number; label: string }[] = [];
      const forbidden = predictions.filter((prediction) => {
        if (!FORBIDDEN_CLASSES.has(prediction.class)) return false;
        const threshold = prediction.class === 'cell phone' ? THRESHOLD_PHONE : THRESHOLD_GLOBAL;
        return prediction.score > threshold;
      });
      forbidden.forEach((prediction) => boxes.push({
        x: prediction.bbox[0], y: prediction.bbox[1], width: prediction.bbox[2], height: prediction.bbox[3],
        label: prediction.class.toUpperCase(),
      }));

      const zoneHits = await this.runZoneScans(videoElement);
      boxes.push(...zoneHits);
      const persons = predictions.filter((prediction) => prediction.class === 'person' && prediction.score > 0.25);

      if (boxes.length > 0) {
        return {
          isMalpractice: true,
          reason: boxes.map((box) => box.label).join(' | ') + ' detected',
          type: 'OBJECT',
          confidence: 92,
          boundingBoxes: boxes,
        };
      }
      if (persons.length > 1) {
        return {
          isMalpractice: true,
          reason: 'Multiple people in frame',
          type: 'MULTI_FACE',
          confidence: 90,
          boundingBoxes: persons.slice(1).map((person, index) => ({
            x: person.bbox[0], y: person.bbox[1], width: person.bbox[2], height: person.bbox[3],
            label: `SECONDARY PERSON ${index + 1}`,
          })),
        };
      }
      if (persons.length === 0) {
        return { isMalpractice: true, reason: 'Candidate absence detected', type: 'ABSENCE', confidence: 100, boundingBoxes: [] };
      }
      return { isMalpractice: false, reason: 'None', type: 'NONE', confidence: 0, boundingBoxes: [] };
    } catch (error) {
      console.error('[LocalML] Non-biometric analysis error:', error);
      return { isMalpractice: false, reason: 'Runtime error', type: 'NONE', confidence: 0, boundingBoxes: [] };
    }
  },
};
