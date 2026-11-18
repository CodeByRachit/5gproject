import { Router } from 'express';
import { uploadVideoMiddleware } from '../middleware/upload.js';

import {
  getCameras,
  registerCamera,
  startCamera,
  stopCamera,
  getCameraStream,
} from '../controllers/cameraController.js';

import {
  detectFrame,
  processUploadedVideo,
} from '../controllers/detectionController.js';

import {
  getOverview,
  getCrossings,
  resetCrossings,
  getCongestion,
  getTrafficHistory,
} from '../controllers/analyticsController.js';

import {
  getCurrentPrediction,
  triggerTraining,
} from '../controllers/predictionController.js';

import {
  getAlerts,
  createAlert,
} from '../controllers/alertController.js';

import {
  getSettings,
  updateSettings,
} from '../controllers/settingsController.js';

const router = Router();

// Health
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: '5G Smart Campus Traffic Monitoring System',
    timestamp: new Date().toISOString(),
  });
});

// Camera Management
router.get('/cameras', getCameras);
router.post('/cameras', registerCamera);
router.post('/cameras/:id/start', startCamera);
router.post('/cameras/:id/stop', stopCamera);
router.get('/cameras/:id/stream', getCameraStream);

// Detection & Video Processing
router.post('/detection/detect-frame', detectFrame);
router.post('/detection/upload-video', uploadVideoMiddleware.single('video'), processUploadedVideo);

// Line Crossing & Live Counters
router.get('/crossings', getCrossings);
router.post('/crossings/reset', resetCrossings);

// Congestion
router.get('/congestion/current', getCongestion);

// Traffic History
router.get('/traffic-history', getTrafficHistory);

// Predictions
router.get('/predictions/current', getCurrentPrediction);
router.post('/predictions/train', triggerTraining);

// Alerts
router.get('/alerts', getAlerts);
router.post('/alerts', createAlert);

// Overview Analytics
router.get('/analytics/overview', getOverview);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;
