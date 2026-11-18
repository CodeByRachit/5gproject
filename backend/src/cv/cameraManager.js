import { detectObjects, DEFAULT_CLASS_THRESHOLDS } from './yoloDetector.js';
import { ByteTracker } from './byteTrack.js';
import { LineCrossingTracker } from './lineCrossing.js';
import { analyzeCongestion } from '../analytics/congestionAnalyzer.js';
import { getAlertStatus, saveAlert } from '../analytics/alertManager.js';
import { TrafficHistory } from '../models/TrafficHistory.js';
import { getIO } from '../sockets/socketManager.js';

class ActiveCameraPipeline {
  constructor(cameraId = 'laptop_webcam', linePositionRatio = 0.55, options = {}) {
    this.cameraId = cameraId;
    const trackingOpts = options.trackingSensitivity || {};
    this.tracker = new ByteTracker(
      trackingOpts.maxTimeLost || 45,
      trackingOpts.highThresh || 0.30,
      trackingOpts.matchThresh || 0.25
    );
    this.lineCrossing = new LineCrossingTracker(linePositionRatio);
    this.detectionOptions = {
      confThreshold: options.confidenceThreshold || 0.25,
      nmsIou: options.nmsIouThreshold || 0.58,
      classThresholds: {
        ...DEFAULT_CLASS_THRESHOLDS,
        ...(options.classConfidenceThresholds || {}),
      },
    };
    this.lastHistorySaveTime = 0;
    this.sampleInterval = 10; // seconds
    this.status = 'Ready';
    this.lastError = '';
  }

  setLineRatio(ratio) {
    if (this.lineCrossing) {
      this.lineCrossing.linePositionRatio = ratio;
    }
  }

  setLinePositionRatio(ratio) {
    if (this.lineCrossing) {
      this.lineCrossing.linePositionRatio = ratio;
    }
  }

  updateSettings(settings = {}) {
    if (settings.linePositionRatio !== undefined) {
      this.setLineRatio(settings.linePositionRatio);
    }
    if (settings.confidenceThreshold !== undefined) {
      this.detectionOptions.confThreshold = Number(settings.confidenceThreshold);
    }
    if (settings.nmsIouThreshold !== undefined) {
      this.detectionOptions.nmsIou = Number(settings.nmsIouThreshold);
    }
    if (settings.classConfidenceThresholds) {
      this.detectionOptions.classThresholds = {
        ...this.detectionOptions.classThresholds,
        ...settings.classConfidenceThresholds,
      };
    }
    if (settings.trackingSensitivity) {
      const ts = settings.trackingSensitivity;
      if (ts.maxTimeLost !== undefined) this.tracker.maxTimeLost = Number(ts.maxTimeLost);
      if (ts.highThresh !== undefined) this.tracker.highThresh = Number(ts.highThresh);
      if (ts.matchThresh !== undefined) this.tracker.matchThresh = Number(ts.matchThresh);
    }
    console.log(`[CameraPipeline] Updated detection settings for ${this.cameraId}:`, {
      confThreshold: this.detectionOptions.confThreshold,
      nmsIou: this.detectionOptions.nmsIou,
      trackerHigh: this.tracker.highThresh,
      trackerMaxLost: this.tracker.maxTimeLost,
    });
  }

  reset() {
    this.tracker.reset();
    this.lineCrossing.reset();
  }

  /**
   * Process a single video frame (JPEG buffer or base64)
   */
  async processFrame(frameInput, fps = 15, captureLatency = 0) {
    const startTime = Date.now();
    try {
      this.status = 'Running';
      // 1. YOLOv8 Detection with Letterboxing, Class-Specific Sensitivity & NMS 0.58
      const { detections, candidates, imageWidth, imageHeight } = await detectObjects(
        frameInput,
        this.detectionOptions
      );

      // 2. ByteTrack Tracking ID Association with 2-stage association and strict class consistency
      const trackedDetections = this.tracker.update(candidates || detections);

      // 3. Virtual Line-Crossing Update (vehicle-only counting & direction flow)
      const crossingResult = this.lineCrossing.processFrame(
        trackedDetections,
        imageHeight,
        imageWidth
      );

      // 4. Traffic Congestion Analysis (pedestrians strictly excluded)
      const congestion = analyzeCongestion(crossingResult.liveCounts);
      const inferenceLatencyMs = Date.now() - startTime;

      // 5. Periodic Traffic History Logging to MongoDB (every 10s)
      const now = Date.now();
      if ((now - this.lastHistorySaveTime) / 1000 >= this.sampleInterval) {
        this.lastHistorySaveTime = now;
        TrafficHistory.create({
          timestamp: new Date(),
          cameraId: this.cameraId,
          vehicle_count: congestion.vehicle_count, // Vehicles ONLY
          cars: congestion.cars,
          motorcycles: congestion.motorcycles,
          buses: congestion.buses,
          trucks: congestion.trucks,
          bicycles: congestion.bicycles,
          pedestrians: congestion.pedestrians,
          congestion_score: congestion.congestion_score,
          congestion_level: congestion.congestion_level,
        }).catch((err) => console.warn('[History Save Warning]', err.message));
      }

      // 6. Check & Save Alerts (rate-limited, vehicle congestion driven)
      const alertPayload = getAlertStatus(crossingResult.liveCounts);
      saveAlert(alertPayload, this.cameraId).then((res) => {
        if (res?.saved && res?.alert) {
          const io = getIO();
          if (io) {
            io.emit('new_alert', res.alert);
          }
        }
      });

      // 7. Emit real-time telemetry over Socket.IO
      const io = getIO();
      if (io) {
        io.emit('traffic_update', {
          cameraId: this.cameraId,
          counts: crossingResult.counts,
          liveCounts: crossingResult.liveCounts,
          totalCrossings: crossingResult.totalCrossings, // Vehicles ONLY
          totalVehiclesCrossed: crossingResult.totalVehiclesCrossed,
          totalPedestriansCrossed: crossingResult.totalPedestriansCrossed,
          incoming: crossingResult.incoming, // Vehicles ONLY
          outgoing: crossingResult.outgoing, // Vehicles ONLY
          incomingCount: crossingResult.incoming,
          outgoingCount: crossingResult.outgoing,
          currentObjects: crossingResult.currentObjects, // Vehicle tracks ONLY
          currentVehicles: crossingResult.currentObjects,
          currentPedestrians: crossingResult.currentPedestrians,
          uniqueObjects: crossingResult.uniqueObjects,
          recentCrossings: crossingResult.recentCrossings,
          newCrossingEvents: crossingResult.newCrossingEvents,
          linePositionRatio: crossingResult.linePositionRatio,
          congestionLevel: congestion.congestion_level,
          trafficScore: congestion.congestion_score,
          color: congestion.color,
          fps: fps || 15,
          captureLatencyMs: captureLatency || 0,
          inferenceLatencyMs,
          latencyMs: inferenceLatencyMs,
          totalLatencyMs: (captureLatency || 0) + inferenceLatencyMs,
          modelStatus: 'YOLOv8 Active',
          timestamp: new Date().toISOString(),
        });

        io.emit('detection_boxes', {
          cameraId: this.cameraId,
          detections: trackedDetections,
          linePositionRatio: crossingResult.linePositionRatio,
          fps: fps || 15,
          captureLatencyMs: captureLatency || 0,
          inferenceLatencyMs,
        });
      }

      return {
        detections: trackedDetections,
        ...crossingResult,
        congestion,
        fps,
        captureLatencyMs: captureLatency,
        inferenceLatencyMs,
      };
    } catch (err) {
      console.error('[Pipeline Error]', err);
      this.lastError = err.message;
      throw err;
    }
  }
}

// Global Camera Pipelines Registry
const pipelines = new Map();

export const getCameraPipeline = (cameraId = 'laptop_webcam', linePositionRatio = 0.55, options = {}) => {
  if (!pipelines.has(cameraId)) {
    pipelines.set(cameraId, new ActiveCameraPipeline(cameraId, linePositionRatio, options));
  }
  return pipelines.get(cameraId);
};

export const resetCameraPipeline = (cameraId = 'laptop_webcam') => {
  if (pipelines.has(cameraId)) {
    pipelines.set(cameraId).reset();
  }
};
