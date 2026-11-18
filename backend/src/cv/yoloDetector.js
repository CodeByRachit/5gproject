import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ort from 'onnxruntime-node';
import jpeg from 'jpeg-js';
import { CLASS_KEYS, DISPLAY_NAMES } from './lineCrossing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_CLASSES = [0, 1, 2, 3, 5, 7]; // COCO IDs: person, bicycle, car, motorcycle, bus, truck

let session = null;

/**
 * Default class-specific detection confidence thresholds.
 * Tuned to maximize recall on small/distant vehicles and two-wheelers
 * while preventing false positives on pedestrians and background noise.
 */
export const DEFAULT_CLASS_THRESHOLDS = {
  car: 0.25,        // Distant, small, and partially occluded cars
  motorcycle: 0.20, // Thin profile and small pixel footprint
  bus: 0.25,        // Commercial buses
  truck: 0.25,      // Freight and delivery trucks
  bicycle: 0.20,    // Low-pixel bicycles
  person: 0.35,     // Pedestrians (isolated and excluded from vehicle stats)
};

/**
 * Initialize ONNX runtime inference session with yolov8n.onnx
 */
export const initYoloSession = async (modelPath = null) => {
  if (session) return session;

  const candidates = [
    modelPath,
    process.env.MODEL_PATH,
    path.resolve(process.cwd(), 'models/yolov8n.onnx'),
    path.resolve(process.cwd(), 'backend/models/yolov8n.onnx'),
    path.resolve(__dirname, '../../models/yolov8n.onnx'),
    path.resolve(__dirname, '../../../5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx'),
    path.resolve(process.cwd(), '5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx'),
    path.resolve(process.cwd(), '../5G_Smart_Campus_Traffic_Dual_Input/yolov8n.onnx'),
  ].filter(Boolean);

  const targetPath = candidates.find((p) => fs.existsSync(p));

  if (!targetPath) {
    throw new Error(`YOLOv8 ONNX model not found in candidate paths: ${candidates.join(', ')}`);
  }

  session = await ort.InferenceSession.create(targetPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  });

  console.log(`[YOLOv8] Loaded ONNX model from: ${targetPath}`);
  return session;
};

/**
 * Letterbox and normalize RGBA pixel buffer to [1, 3, 640, 640] CHW Float32Array.
 * Preserves the original aspect ratio with constant gray padding (114/255)
 * so small, distant vehicles and motorcycles maintain their natural geometry.
 */
export const preprocessLetterbox = (rgbaPixels, srcW, srcH, targetW = 640, targetH = 640) => {
  const float32Data = new Float32Array(3 * targetW * targetH);
  // Fill background with standard YOLO gray padding: 114 / 255.0 (~0.447)
  float32Data.fill(114.0 / 255.0);

  const scale = Math.min(targetW / srcW, targetH / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const padX = Math.floor((targetW - newW) / 2);
  const padY = Math.floor((targetH - newH) / 2);

  const channelSize = targetW * targetH;

  for (let dy = 0; dy < newH; dy++) {
    const sy = Math.min(srcH - 1, Math.floor(dy / scale));
    const destY = padY + dy;
    const destRowOffset = destY * targetW;
    const srcRowOffset = sy * srcW;

    for (let dx = 0; dx < newW; dx++) {
      const sx = Math.min(srcW - 1, Math.floor(dx / scale));
      const srcIdx = (srcRowOffset + sx) * 4;
      const destIdx = destRowOffset + (padX + dx);

      float32Data[destIdx] = rgbaPixels[srcIdx] / 255.0;
      float32Data[channelSize + destIdx] = rgbaPixels[srcIdx + 1] / 255.0;
      float32Data[2 * channelSize + destIdx] = rgbaPixels[srcIdx + 2] / 255.0;
    }
  }

  return { float32Data, scale, padX, padY, newW, newH };
};

/**
 * Compute Intersection-over-Union (IoU) for Non-Maximum Suppression.
 */
export const computeIoU = (boxA, boxB) => {
  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  const xL = Math.max(ax1, bx1);
  const yT = Math.max(ay1, by1);
  const xR = Math.min(ax2, bx2);
  const yB = Math.min(ay2, by2);

  if (xR < xL || yB < yT) return 0.0;

  const inter = (xR - xL) * (yB - yT);
  const areaA = (ax2 - ax1) * (ay2 - ay1);
  const areaB = (bx2 - bx1) * (by2 - by1);
  return inter / (areaA + areaB - inter);
};

/**
 * Apply class-aware Non-Maximum Suppression (NMS) on detected candidate boxes.
 * Default IoU threshold is 0.58: allows vehicles travelling close together
 * in traffic queues without suppressing valid detections.
 */
export const nonMaxSuppression = (boxes, iouThreshold = 0.58) => {
  boxes.sort((a, b) => b.confidence - a.confidence);

  const selected = [];
  const active = new Array(boxes.length).fill(true);

  for (let i = 0; i < boxes.length; i++) {
    if (!active[i]) continue;
    selected.push(boxes[i]);

    for (let j = i + 1; j < boxes.length; j++) {
      if (!active[j]) continue;
      // Class-aware: only suppress candidates belonging to the same object class
      if (boxes[i].classId === boxes[j].classId) {
        const iou = computeIoU(boxes[i].bbox, boxes[j].bbox);
        if (iou >= iouThreshold) {
          active[j] = false;
        }
      }
    }
  }
  return selected;
};

/**
 * Run YOLOv8 object detection on a JPEG buffer or base64 image string.
 * @param {Buffer|string} input - JPEG buffer or data URL
 * @param {number|Object} options - Minimum confidence score or config object
 * @param {number} iouThreshold - NMS IoU threshold (default: 0.58)
 * @returns {Object} { detections: Array, candidates: Array, imageWidth, imageHeight }
 */
export const detectObjects = async (input, options = 0.25, iouThreshold = 0.58) => {
  await initYoloSession();

  let confThreshold = 0.25;
  let customClassThresholds = { ...DEFAULT_CLASS_THRESHOLDS };
  let nmsIou = typeof iouThreshold === 'number' ? iouThreshold : 0.58;

  if (typeof options === 'object' && options !== null) {
    if (options.confThreshold !== undefined) confThreshold = Number(options.confThreshold);
    if (options.nmsIou !== undefined) nmsIou = Number(options.nmsIou);
    if (options.classThresholds) {
      customClassThresholds = { ...customClassThresholds, ...options.classThresholds };
    }
  } else if (typeof options === 'number') {
    confThreshold = options;
  }

  let jpegBuffer = input;
  if (typeof input === 'string') {
    const base64Data = input.replace(/^data:image\/\w+;base64,/, '');
    jpegBuffer = Buffer.from(base64Data, 'base64');
  }

  // Decode JPEG pixels using jpeg-js
  const rawImage = jpeg.decode(jpegBuffer, { useTArray: true });
  const srcW = rawImage.width;
  const srcH = rawImage.height;

  // Prepare [1, 3, 640, 640] letterboxed input tensor preserving exact aspect ratio
  const { float32Data, scale, padX, padY } = preprocessLetterbox(rawImage.data, srcW, srcH, 640, 640);
  const tensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);

  // Execute inference
  const outputMap = await session.run({ images: tensor });
  const outputTensor = outputMap.output0 || Object.values(outputMap)[0];
  const outputData = outputTensor.data; // Float32Array shape [1, 84, 8400]

  const numChannels = 84;
  const numAnchors = 8400;

  const candidateBoxes = [];

  // Minimum floor to capture low-confidence candidates for ByteTrack 2nd association stage
  const absoluteMinScore = 0.15;

  for (let anchor = 0; anchor < numAnchors; anchor++) {
    let maxScore = 0;
    let maxClassId = -1;

    for (let c = 0; c < 80; c++) {
      const score = outputData[(4 + c) * numAnchors + anchor];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = c;
      }
    }

    if (maxScore >= absoluteMinScore && TARGET_CLASSES.includes(maxClassId)) {
      const classKey = CLASS_KEYS[maxClassId] || 'object';
      const classThresh = customClassThresholds[classKey] ?? confThreshold;

      // Coordinates in 640x640 space
      const cx = outputData[0 * numAnchors + anchor];
      const cy = outputData[1 * numAnchors + anchor];
      const w = outputData[2 * numAnchors + anchor];
      const h = outputData[3 * numAnchors + anchor];

      // Inverse letterbox mapping: accurate real-world pixel coordinates without distortion
      const origCx = (cx - padX) / scale;
      const origCy = (cy - padY) / scale;
      const origW = w / scale;
      const origH = h / scale;

      const x1 = Math.max(0, Math.floor(origCx - origW / 2));
      const y1 = Math.max(0, Math.floor(origCy - origH / 2));
      const x2 = Math.min(srcW - 1, Math.floor(origCx + origW / 2));
      const y2 = Math.min(srcH - 1, Math.floor(origCy + origH / 2));

      const label = DISPLAY_NAMES[classKey] || classKey;

      candidateBoxes.push({
        bbox: [x1, y1, x2, y2],
        confidence: Number(maxScore.toFixed(3)),
        classId: maxClassId,
        classKey,
        label,
        isPrimary: maxScore >= classThresh,
        classThresh,
      });
    }
  }

  // Non-Maximum Suppression with tuned iouThreshold (0.58)
  const nmsCandidates = nonMaxSuppression(candidateBoxes, nmsIou);

  // Filter primary detections that meet the class sensitivity threshold
  const primaryDetections = nmsCandidates.filter((b) => b.isPrimary);

  return {
    detections: primaryDetections,
    candidates: nmsCandidates,
    imageWidth: srcW,
    imageHeight: srcH,
  };
};
