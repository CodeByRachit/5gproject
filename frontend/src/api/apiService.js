import axios from 'axios';

// Resolve API base URL dynamically for remote 5G clients or reverse-proxy deployments
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // When served via Nginx reverse proxy, proxy directly to /api
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for consistent error extraction
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'Network communication failed',
      status: error.response?.status,
      data: error.response?.data,
    };
    return Promise.reject(customError);
  }
);

export const apiService = {
  // System Health
  getHealth: () => api.get('/health'),

  // Camera Management
  getCameras: () => api.get('/cameras'),
  registerCamera: (cameraData) => api.post('/cameras', cameraData),
  startCamera: (cameraId, config = {}) => api.post(`/cameras/${cameraId}/start`, config),
  stopCamera: (cameraId) => api.post(`/cameras/${cameraId}/stop`),

  // Frame Detection (for Laptop Webcam frames)
  detectFrame: (imageData, cameraId = 'laptop_webcam') => 
    api.post('/detection/detect-frame', { image: imageData, cameraId }),

  // Video Upload Processing
  uploadVideo: (formData, onUploadProgress) => 
    api.post('/detection/upload-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
      timeout: 300000, // 5 minutes for video inference
    }),

  // Line Crossing
  getCrossings: () => api.get('/crossings'),
  resetCrossings: () => api.post('/crossings/reset'),

  // Congestion
  getCongestion: () => api.get('/congestion/current'),

  // Traffic History
  getTrafficHistory: (limit = 100) => api.get(`/traffic-history?limit=${limit}`),

  // Predictions
  getPredictions: () => api.get('/predictions/current'),
  trainPredictionModel: () => api.post('/predictions/train'),

  // Alerts
  getAlerts: (limit = 100) => api.get(`/alerts?limit=${limit}`),

  // Analytics Overview
  getAnalyticsOverview: () => api.get('/analytics/overview'),

  // System Settings
  getSettings: () => api.get('/settings'),
  updateSettings: (settings) => api.put('/settings', settings),
};

export default api;
