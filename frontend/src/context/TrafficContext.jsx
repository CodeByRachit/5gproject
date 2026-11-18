import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { apiService } from '../api/apiService';

// Resolve Socket.IO URL dynamically for 5G edge remote clients
const getSocketServerUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // When served via Nginx reverse proxy, connect through origin host on /socket.io
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

const SOCKET_SERVER_URL = getSocketServerUrl();

const TrafficContext = createContext(null);

export const VEHICLE_CLASSES = [
  { key: 'car', label: 'Cars', color: '#3b82f6' },
  { key: 'motorcycle', label: 'Motorcycles', color: '#06b6d4' },
  { key: 'bus', label: 'Buses', color: '#f59e0b' },
  { key: 'truck', label: 'Trucks', color: '#ef4444' },
  { key: 'bicycle', label: 'Bicycles', color: '#10b981' },
  { key: 'person', label: 'Pedestrians', color: '#8b5cf6' },
];

export const TrafficProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeCamera, setActiveCamera] = useState('laptop_webcam');
  
  // Real-time Traffic Counters
  const [counts, setCounts] = useState({
    car: 0,
    motorcycle: 0,
    bus: 0,
    truck: 0,
    bicycle: 0,
    person: 0,
  });
  
  const [liveCounts, setLiveCounts] = useState({
    car: 0,
    motorcycle: 0,
    bus: 0,
    truck: 0,
    bicycle: 0,
    person: 0,
  });

  const [currentObjects, setCurrentObjects] = useState(0);
  const [totalCrossings, setTotalCrossings] = useState(0);
  const [totalVehiclesCrossed, setTotalVehiclesCrossed] = useState(0);
  const [totalPedestriansCrossed, setTotalPedestriansCrossed] = useState(0);
  const [incomingCount, setIncomingCount] = useState(0);
  const [outgoingCount, setOutgoingCount] = useState(0);
  const [recentCrossings, setRecentCrossings] = useState([]);
  const [streamFps, setStreamFps] = useState(15);
  const [streamLatency, setStreamLatency] = useState(0);
  const [captureLatency, setCaptureLatency] = useState(0);
  const [inferenceLatency, setInferenceLatency] = useState(0);
  const [liveTrendHistory, setLiveTrendHistory] = useState([]);
  const [congestionLevel, setCongestionLevel] = useState('NO DATA');
  const [trafficScore, setTrafficScore] = useState(0);
  const [modelStatus, setModelStatus] = useState('Standby');
  const [lastError, setLastError] = useState('');
  
  // Alerts and Predictions
  const [alerts, setAlerts] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  
  // Settings & System Config
  const [settings, setSettings] = useState({
    linePositionRatio: 0.55,
    lowThreshold: 5,
    moderateThreshold: 15,
    weights: {
      car: 1.0,
      motorcycle: 0.5,
      bus: 2.5,
      truck: 2.0,
      bicycle: 0.4,
    },
    confidenceThreshold: 0.25,
    nmsIouThreshold: 0.58,
    classConfidenceThresholds: {
      car: 0.25,
      motorcycle: 0.20,
      bus: 0.25,
      truck: 0.25,
      bicycle: 0.20,
      person: 0.35,
    },
    trackingSensitivity: {
      maxTimeLost: 45,
      highThresh: 0.30,
      matchThresh: 0.25,
    },
  });

  // Load initial backend telemetry
  const refreshTelemetry = useCallback(async () => {
    try {
      const [overviewData, alertsData, predictionData, settingsData] = await Promise.allSettled([
        apiService.getAnalyticsOverview(),
        apiService.getAlerts(50),
        apiService.getPredictions(),
        apiService.getSettings(),
      ]);

      if (settingsData.status === 'fulfilled' && settingsData.value?.data) {
        setSettings(settingsData.value.data);
      }

      if (overviewData.status === 'fulfilled' && overviewData.value?.data) {
        const ov = overviewData.value.data;
        if (ov.counts) setCounts(ov.counts);
        if (ov.liveCounts) setLiveCounts(ov.liveCounts);
        if (typeof ov.totalCrossings === 'number') setTotalCrossings(ov.totalCrossings);
        if (typeof ov.totalVehiclesCrossed === 'number') setTotalVehiclesCrossed(ov.totalVehiclesCrossed);
        if (typeof ov.totalPedestriansCrossed === 'number') setTotalPedestriansCrossed(ov.totalPedestriansCrossed);
        if (typeof ov.incoming === 'number') setIncomingCount(ov.incoming);
        if (typeof ov.outgoing === 'number') setOutgoingCount(ov.outgoing);
        if (ov.recentCrossings) setRecentCrossings(ov.recentCrossings);
        if (typeof ov.currentObjects === 'number') setCurrentObjects(ov.currentObjects);
        if (ov.congestionLevel) setCongestionLevel(ov.congestionLevel);
        if (typeof ov.trafficScore === 'number') setTrafficScore(ov.trafficScore);
      }

      if (alertsData.status === 'fulfilled' && alertsData.value?.data) {
        setAlerts(alertsData.value.data);
      }

      if (predictionData.status === 'fulfilled' && predictionData.value?.data) {
        setPrediction(predictionData.value.data);
      }
    } catch (err) {
      console.warn('Initial telemetry fetch warning:', err.message);
    }
  }, []);

  // Connect Socket.IO
  useEffect(() => {
    const s = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      setIsConnected(true);
      setModelStatus('Connected');
      setLastError('');
    });

    s.on('disconnect', () => {
      setIsConnected(false);
      setModelStatus('Disconnected');
    });

    s.on('connect_error', (err) => {
      setIsConnected(false);
      setModelStatus('Connecting...');
    });

    // Real-time camera frame metadata
    s.on('camera_frame', (frameData) => {
      if (typeof frameData.fps === 'number') {
        setStreamFps(frameData.fps);
      }
      if (typeof frameData.captureLatency === 'number') {
        setCaptureLatency(frameData.captureLatency);
      }
      if (typeof frameData.timestamp === 'number') {
        const networkRenderLat = Math.max(0, Date.now() - frameData.timestamp);
        // streamLatency is actual live stream transit time
        setStreamLatency((frameData.captureLatency || 0) + networkRenderLat);
      }
    });

    // Real-time frame telemetry stream
    s.on('traffic_update', (data) => {
      if (data.counts) setCounts(data.counts);
      if (data.liveCounts) setLiveCounts(data.liveCounts);
      if (typeof data.totalCrossings === 'number') setTotalCrossings(data.totalCrossings);
      if (typeof data.totalVehiclesCrossed === 'number') setTotalVehiclesCrossed(data.totalVehiclesCrossed);
      if (typeof data.totalPedestriansCrossed === 'number') setTotalPedestriansCrossed(data.totalPedestriansCrossed);
      if (typeof data.incoming === 'number' || typeof data.incomingCount === 'number') {
        setIncomingCount(data.incoming ?? data.incomingCount);
      }
      if (typeof data.outgoing === 'number' || typeof data.outgoingCount === 'number') {
        setOutgoingCount(data.outgoing ?? data.outgoingCount);
      }
      if (data.recentCrossings) setRecentCrossings(data.recentCrossings);
      if (typeof data.fps === 'number') setStreamFps(data.fps);
      if (typeof data.captureLatencyMs === 'number') setCaptureLatency(data.captureLatencyMs);
      if (typeof data.inferenceLatencyMs === 'number') setInferenceLatency(data.inferenceLatencyMs);
      if (typeof data.currentObjects === 'number') setCurrentObjects(data.currentObjects);
      if (data.congestionLevel) setCongestionLevel(data.congestionLevel);
      if (typeof data.trafficScore === 'number') setTrafficScore(data.trafficScore);
      if (data.modelStatus) setModelStatus(data.modelStatus);
      if (data.lastError !== undefined) setLastError(data.lastError);

      // Append to live rolling trend history
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const vehiclesInFrame = (data.liveCounts?.car || 0) + 
                              (data.liveCounts?.motorcycle || 0) + 
                              (data.liveCounts?.bus || 0) + 
                              (data.liveCounts?.truck || 0) + 
                              (data.liveCounts?.bicycle || 0);
      setLiveTrendHistory((prev) => {
        const next = [
          ...prev,
          {
            time: timeStr,
            vehicles: vehiclesInFrame,
            score: typeof data.trafficScore === 'number' ? data.trafficScore : 0,
            pedestrians: data.liveCounts?.person || 0,
            incoming: data.incoming ?? data.incomingCount ?? 0,
            outgoing: data.outgoing ?? data.outgoingCount ?? 0,
          }
        ];
        return next.slice(-20); // Keep last 20 real-time points
      });
    });

    // High/Moderate congestion alert broadcast
    s.on('new_alert', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev.slice(0, 99)]);
    });

    // Prediction update broadcast
    s.on('prediction_update', (predData) => {
      setPrediction(predData);
    });

    setSocket(s);
    refreshTelemetry();

    return () => {
      s.disconnect();
    };
  }, [refreshTelemetry]);

  // Reset cumulative line crossing counts
  const handleResetCrossings = async () => {
    try {
      await apiService.resetCrossings();
      setCounts({
        car: 0,
        motorcycle: 0,
        bus: 0,
        truck: 0,
        bicycle: 0,
        person: 0,
      });
      setTotalCrossings(0);
      setTotalVehiclesCrossed(0);
      setTotalPedestriansCrossed(0);
      setIncomingCount(0);
      setOutgoingCount(0);
      setRecentCrossings([]);
      setLastError('');
    } catch (err) {
      setLastError(`Reset failed: ${err.message}`);
    }
  };

  // Train ML models and get updated 5-minute prediction
  const handleTrainAndPredict = async () => {
    setPredictionLoading(true);
    try {
      const response = await apiService.trainPredictionModel();
      if (response?.data) {
        setPrediction(response.data);
      }
    } catch (err) {
      setLastError(`Prediction training error: ${err.message}`);
    } finally {
      setPredictionLoading(false);
    }
  };

  return (
    <TrafficContext.Provider
      value={{
        socket,
        isConnected,
        activeCamera,
        setActiveCamera,
        counts,
        liveCounts,
        currentObjects,
        totalCrossings,
        totalVehiclesCrossed,
        totalPedestriansCrossed,
        incomingCount,
        outgoingCount,
        recentCrossings,
        streamFps,
        streamLatency,
        captureLatency,
        inferenceLatency,
        liveTrendHistory,
        congestionLevel,
        trafficScore,
        modelStatus,
        lastError,
        alerts,
        prediction,
        predictionLoading,
        settings,
        setSettings,
        resetCrossings: handleResetCrossings,
        trainAndPredict: handleTrainAndPredict,
        refreshTelemetry,
      }}
    >
      {children}
    </TrafficContext.Provider>
  );
};

export const useTraffic = () => {
  const context = useContext(TrafficContext);
  if (!context) {
    throw new Error('useTraffic must be used within a TrafficProvider');
  }
  return context;
};
