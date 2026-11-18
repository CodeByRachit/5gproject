import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTraffic, VEHICLE_CLASSES } from '../context/TrafficContext';
import { apiService } from '../api/apiService';
import { 
  Camera, 
  Video, 
  Upload, 
  Play, 
  Square, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Eye, 
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Server,
  Lock,
  Download,
  Sliders,
  Radio
} from 'lucide-react';
import { CongestionBadge } from '../components/CongestionBadge';

export const LiveCameraMonitoring = () => {
  const { 
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
    congestionLevel, 
    trafficScore, 
    resetCrossings,
    modelStatus,
    settings,
    socket,
    isConnected
  } = useTraffic();

  // Mode Selection: 'laptop', 'usb', 'rtsp', 'upload'
  const [cameraMode, setCameraMode] = useState('laptop');
  
  // Hardware camera configs
  const [usbIndex, setUsbIndex] = useState(1);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [streamFrameUrl, setStreamFrameUrl] = useState(null);

  // Live video frame & detection state (Socket.IO + MJPEG)
  const [liveVideoFrame, setLiveVideoFrame] = useState(null);
  const [externalDetections, setExternalDetections] = useState([]);
  const externalCanvasRef = useRef(null);
  const isStreamingRef = useRef(false);

  // Sparsh IP CCTV Two-Step Connection State
  const [cctvStep, setCctvStep] = useState(1); // 1: Network Configuration, 2: Camera Authentication
  const [cctvIp, setCctvIp] = useState('192.168.128.10');
  const [cctvPort, setCctvPort] = useState('554');
  const [cctvUsername, setCctvUsername] = useState('admin');
  const [cctvPassword, setCctvPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cctvError, setCctvError] = useState('');

  // Keep streaming ref updated to prevent stale closures
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Laptop Camera refs & state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamPermission, setWebcamPermission] = useState(null);
  const frameIntervalRef = useRef(null);

  // Video Upload State
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProcessingResult, setVideoProcessingResult] = useState(null);

  // Stop all camera streams cleanly
  const stopAllStreams = useCallback(() => {
    // Stop laptop camera
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setWebcamActive(false);

    // Stop backend camera if active
    if (isStreamingRef.current) {
      apiService.stopCamera('external_camera').catch(() => {});
      setIsStreaming(false);
    }
    setStreamFrameUrl(null);
    setLiveVideoFrame(null);
    setExternalDetections([]);
  }, []);

  // Handle Mode Change
  const handleModeChange = (newMode) => {
    stopAllStreams();
    setCameraMode(newMode);
    setStreamError('');
    setCctvError('');
    setLiveVideoFrame(null);
    setExternalDetections([]);
  };

  // Start Laptop Webcam via browser MediaDevices
  const startWebcam = async () => {
    setStreamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setWebcamActive(true);
      setWebcamPermission(true);

      // Start periodic frame capture and detection dispatch
      frameIntervalRef.current = setInterval(() => {
        captureAndDetectFrame();
      }, 350); // ~3 FPS inference to preserve CPU and network latency
    } catch (err) {
      console.error('Camera access error:', err);
      setWebcamPermission(false);
      setStreamError(`Camera access denied or device not found: ${err.message}`);
    }
  };

  // Capture frame from webcam and send to backend
  const captureAndDetectFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw counting line overlay on client canvas
    const lineY = canvas.height * (settings.linePositionRatio || 0.55);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(canvas.width, lineY);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('COUNTING LINE (55%)', 16, Math.max(24, lineY - 10));

    // Convert frame to base64 JPEG and send to API
    const base64Data = canvas.toDataURL('image/jpeg', 0.65);
    apiService.detectFrame(base64Data, 'laptop_webcam').then((res) => {
      if (res?.detections) {
        // Draw server-detected bounding boxes over client canvas
        res.detections.forEach((det) => {
          const [x1, y1, x2, y2] = det.bbox;
          const isTracked = det.trackId >= 0;
          ctx.strokeStyle = isTracked ? '#22c55e' : '#f97316';
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          // Draw label
          const label = `${det.label} ${isTracked ? `ID:${det.trackId}` : ''} ${(det.confidence * 100).toFixed(0)}%`;
          ctx.fillStyle = isTracked ? '#22c55e' : '#f97316';
          ctx.fillRect(x1, Math.max(0, y1 - 22), 160, 22);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(label, x1 + 4, Math.max(16, y1 - 6));

          // Draw centroid
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
        });
      }
    }).catch(() => {
      // Ignore background detection dropouts
    });
  };

  // Step 1 Validation & Proceed to Step 2
  const handleCctvContinue = (e) => {
    if (e) e.preventDefault();
    setCctvError('');

    const cleanIp = cctvIp.trim();
    if (!cleanIp) {
      setCctvError('Please enter the Camera IP Address (e.g. 192.168.128.10)');
      return;
    }

    // IP or Hostname format check
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([a-zA-Z0-9.-]+)$/;
    if (!ipPattern.test(cleanIp)) {
      setCctvError('Please enter a valid IPv4 address or hostname.');
      return;
    }

    const portNum = parseInt(cctvPort, 10);
    if (!cctvPort || isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setCctvError('Please enter a valid RTSP Port (1 - 65535, default 554).');
      return;
    }

    setCctvStep(2);
  };

  // Back to Step 1
  const handleCctvBack = () => {
    setCctvError('');
    setCctvStep(1);
  };

  // Start External USB Camera or RTSP Stream on Backend
  const startExternalCamera = async () => {
    setStreamError('');
    setCctvError('');
    try {
      let config;
      if (cameraMode === 'usb') {
        config = { 
          type: 'usb', 
          deviceIndex: Number(usbIndex), 
          name: `External USB (Index ${usbIndex})` 
        };
      } else {
        const cleanIp = cctvIp.trim();
        const cleanPort = cctvPort.trim() || '554';
        const cleanUser = cctvUsername.trim() || 'admin';

        if (!cleanIp) {
          setCctvError('Camera IP Address is required.');
          setCctvStep(1);
          return;
        }

        config = {
          type: 'rtsp',
          ip: cleanIp,
          port: cleanPort,
          username: cleanUser,
          password: cctvPassword,
          streamPath: '/avstream/channel=1/stream=0.sdp',
          name: 'Sparsh IP CCTV'
        };
      }

      await apiService.startCamera('external_camera', config);
      setIsStreaming(true);
      // Backend MJPEG stream endpoint (dynamically resolved for 5G edge remote clients)
      const apiEndpoint = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:5000/api');
      setStreamFrameUrl(`${apiEndpoint}/cameras/external_camera/stream?t=${Date.now()}`);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to start camera';
      setStreamError(`Failed to connect: ${errMsg}`);
      setCctvError(errMsg);
      setIsStreaming(false);
    }
  };

  const stopExternalCamera = async () => {
    try {
      await apiService.stopCamera('external_camera');
    } catch (err) {
      console.warn('Stop external camera error:', err);
    } finally {
      setIsStreaming(false);
      setStreamFrameUrl(null);
      setLiveVideoFrame(null);
      setExternalDetections([]);
    }
  };

  // Listen for real-time video frames and tracking bounding boxes over Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleCameraFrame = (data) => {
      if (data?.cameraId === 'external_camera' || !data?.cameraId || data?.cameraId?.includes('external')) {
        if (data.frame) {
          setLiveVideoFrame(data.frame);
          setStreamError('');
        }
      }
    };

    const handleDetections = (data) => {
      if (data?.cameraId === 'external_camera' || !data?.cameraId || data?.cameraId?.includes('external')) {
        setExternalDetections(data.detections || []);
      }
    };

    socket.on('camera_frame', handleCameraFrame);
    socket.on('detection_boxes', handleDetections);

    return () => {
      socket.off('camera_frame', handleCameraFrame);
      socket.off('detection_boxes', handleDetections);
    };
  }, [socket]);

  // Render YOLOv8 tracking bounding boxes and ByteTrack IDs on external canvas overlay
  useEffect(() => {
    if (cameraMode !== 'usb' && cameraMode !== 'rtsp') return;
    if (!externalCanvasRef.current) return;

    const canvas = externalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 1280;
    canvas.height = 720;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isStreaming) return;

    // 1. ALWAYS Draw Virtual Vehicle Counting Line at configured position
    const lineRatio = settings?.linePositionRatio || 0.55;
    const lineY = Math.round(canvas.height * lineRatio);

    ctx.save();
    // Glowing red virtual line
    ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(canvas.width, lineY);
    ctx.stroke();
    ctx.restore();

    // Direction indicators on line
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(24, lineY - 6);
    ctx.lineTo(32, lineY);
    ctx.lineTo(24, lineY + 6);
    ctx.fill();

    // Label badge for vehicle counting line
    const linePercent = Math.round(lineRatio * 100);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(38, lineY - 14, 255, 26);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(38, lineY - 14, 255, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`VIRTUAL VEHICLE COUNTING LINE (${linePercent}%)`, 46, lineY + 3);

    // 2. Render YOLOv8 tracking bounding boxes and ByteTrack IDs
    if (externalDetections && externalDetections.length > 0) {
      externalDetections.forEach((det) => {
        const [x1, y1, x2, y2] = det.bbox;
        const isTracked = det.trackId !== undefined && det.trackId >= 0;
        const isPedestrian = det.classKey === 'person' || det.label?.toLowerCase().includes('pedestrian');

        if (isPedestrian) {
          // Distinct purple styling for pedestrians (clearly marked as excluded from vehicle counting)
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2.0;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          const label = `Pedestrian ${isTracked ? `[ID:${det.trackId}]` : ''} ${(det.confidence * 100).toFixed(0)}% (Excluded)`;
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(x1, Math.max(0, y1 - 22), 245, 22);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(label, x1 + 4, Math.max(16, y1 - 6));

          // Centroid dot (purple)
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#a855f7';
          ctx.fill();
        } else {
          // Supported vehicle classes (car, motorcycle, bus, truck, bicycle)
          ctx.strokeStyle = isTracked ? '#22c55e' : '#f97316';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          const label = `${det.label || det.classKey || 'Vehicle'} ${isTracked ? `[ID:${det.trackId}]` : ''} ${(det.confidence * 100).toFixed(0)}%`;
          ctx.fillStyle = isTracked ? '#22c55e' : '#f97316';
          ctx.fillRect(x1, Math.max(0, y1 - 22), 180, 22);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(label, x1 + 4, Math.max(16, y1 - 6));

          // Centroid dot (blue)
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
        }
      });
    }
  }, [externalDetections, isStreaming, cameraMode, settings?.linePositionRatio]);

  // Upload Video File Processing
  const handleVideoUpload = async () => {
    if (!selectedVideoFile) return;

    setIsProcessingVideo(true);
    setUploadProgress(0);
    setStreamError('');
    setVideoProcessingResult(null);

    const formData = new FormData();
    formData.append('video', selectedVideoFile);

    try {
      const response = await apiService.uploadVideo(formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });

      if (response?.data) {
        setVideoProcessingResult(response.data);
      }
    } catch (err) {
      setStreamError(`Video processing failed: ${err.message}`);
    } finally {
      setIsProcessingVideo(false);
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, [stopAllStreams]);

  return (
    <div className="space-y-6">
      {/* Header and Source Mode Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Live Camera Monitoring</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time YOLOv8 object detection, ByteTrack tracking IDs & virtual line crossing
          </p>
        </div>

        {/* Source Radio Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => handleModeChange('laptop')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              cameraMode === 'laptop'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Laptop Webcam
          </button>

          <button
            onClick={() => handleModeChange('usb')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              cameraMode === 'usb'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            USB Camera
          </button>

          <button
            onClick={() => handleModeChange('rtsp')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              cameraMode === 'rtsp'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Sparsh IP CCTV
          </button>

          <button
            onClick={() => handleModeChange('upload')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              cameraMode === 'upload'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Video
          </button>
        </div>
      </div>

      {/* Stream Error Alert */}
      {streamError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{streamError}</span>
        </div>
      )}

      {/* Main Monitoring Workspace: Video Stream (Left) + Real-time Telemetry (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Viewport & Controls */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            {/* Viewport Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${webcamActive || isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {cameraMode === 'laptop' && 'Laptop Webcam Stream'}
                  {cameraMode === 'usb' && `External USB Camera (Device #${usbIndex})`}
                  {cameraMode === 'rtsp' && 'Sparsh IP CCTV RTSP Stream'}
                  {cameraMode === 'upload' && 'Uploaded Video Inference'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Line: 55%
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  YOLOv8 Nano
                </span>
              </div>
            </div>

            {/* Viewport Display Box */}
            <div className="relative aspect-video w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
              {/* 1. LAPTOP WEBCAM MODE */}
              {cameraMode === 'laptop' && (
                <>
                  <video 
                    ref={videoRef} 
                    className="hidden" 
                    playsInline 
                    muted 
                  />
                  <canvas 
                    ref={canvasRef} 
                    className={`w-full h-full object-contain ${webcamActive ? 'block' : 'hidden'}`} 
                  />
                  {!webcamActive && (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Laptop Camera Idle</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                          Click "Start Webcam" below to grant browser permission and begin real-time vehicle and pedestrian detection.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 2. EXTERNAL USB & 3. RTSP CCTV STREAM */}
              {(cameraMode === 'usb' || cameraMode === 'rtsp') && (
                <>
                  {isStreaming ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                      {liveVideoFrame ? (
                        <img 
                          src={liveVideoFrame} 
                          alt="Live CCTV Feed"
                          className="w-full h-full object-contain"
                        />
                      ) : streamFrameUrl ? (
                        <img 
                          src={streamFrameUrl} 
                          alt="External Camera Stream"
                          className="w-full h-full object-contain"
                          onError={() => {
                            if (!liveVideoFrame) {
                              setStreamError('Waiting for CCTV video frames...');
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                          <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs">Buffering CCTV stream...</span>
                        </div>
                      )}

                      {/* Transparent Canvas Overlay for YOLOv8 Bounding Boxes & ByteTrack IDs */}
                      <canvas 
                        ref={externalCanvasRef}
                        width={1280}
                        height={720}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      />

                      {/* Live Telemetry HUD Bar */}
                      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/10 text-[11px] font-mono font-medium text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/10 text-[11px] font-mono text-slate-300">
                          {cameraMode === 'rtsp' ? 'Sparsh IP CCTV (Ch 1 · 720p HD)' : 'USB Camera'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none z-10">
                        <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/10 text-[11px] font-mono text-emerald-400 font-semibold" title="Camera stream frame rate">
                          {streamFps || 15} FPS
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/10 text-[11px] font-mono text-blue-400 font-semibold" title="Capture to display stream delay">
                          Stream: {streamLatency || 20}ms
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/10 text-[11px] font-mono text-amber-400 font-semibold" title="YOLOv8 ONNX model inference execution time">
                          AI Infer: {inferenceLatency || 180}ms
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/10 text-[11px] font-mono text-slate-200">
                          IN: <strong className="text-emerald-400">{incomingCount}</strong> · OUT: <strong className="text-cyan-400">{outgoingCount}</strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        {cameraMode === 'usb' ? <Video className="w-7 h-7" /> : <Radio className="w-7 h-7" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {cameraMode === 'usb' ? 'USB Camera Disconnected' : 'CCTV Stream Standby'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                          {cameraMode === 'usb' 
                            ? 'Select external device index below and click "Start USB Camera".'
                            : 'Configure network & authentication parameters below to connect to Sparsh IP CCTV.'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 4. VIDEO UPLOAD MODE */}
              {cameraMode === 'upload' && (
                <div className="w-full h-full flex flex-col items-center justify-center p-6">
                  {videoProcessingResult?.annotatedVideoUrl ? (
                    <video 
                      src={videoProcessingResult.annotatedVideoUrl} 
                      controls 
                      autoPlay 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Upload Traffic Video</h4>
                        <p className="text-xs text-slate-400 mt-1">Supports MP4, AVI, MOV, MKV clips (10–60s recommended)</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls Bar for Active Mode */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Mode-specific configurations */}
              {cameraMode === 'laptop' && (
                <div className="flex items-center gap-3">
                  {!webcamActive ? (
                    <button
                      onClick={startWebcam}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Webcam
                    </button>
                  ) : (
                    <button
                      onClick={stopAllStreams}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" /> Stop Webcam
                    </button>
                  )}
                </div>
              )}

              {cameraMode === 'usb' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>Device Index:</span>
                    <select
                      value={usbIndex}
                      onChange={(e) => setUsbIndex(e.target.value)}
                      disabled={isStreaming}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <option key={idx} value={idx}>Device {idx}</option>
                      ))}
                    </select>
                  </div>

                  {!isStreaming ? (
                    <button
                      onClick={startExternalCamera}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" /> Start USB Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopExternalCamera}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" /> Stop Camera
                    </button>
                  )}
                </div>
              )}

              {cameraMode === 'rtsp' && isStreaming && (
                <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold">Sparsh IP CCTV Live</span>
                    <span className="text-emerald-500/80 font-mono">({cctvIp || '192.168.128.10'}:{cctvPort || '554'})</span>
                  </div>
                  <button
                    onClick={stopExternalCamera}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 shadow-lg shadow-rose-600/20 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" /> Disconnect Camera
                  </button>
                </div>
              )}

              {cameraMode === 'rtsp' && !isStreaming && (
                <div className="w-full space-y-3">
                  {/* Step Indicators */}
                  <div className="flex items-center gap-2 text-[11px] font-medium">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      cctvStep === 1 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold' 
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                    }`}>
                      <Server className="w-3 h-3" />
                      Step 1: Camera Network Details
                    </span>
                    <span className="text-slate-600">&rarr;</span>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      cctvStep === 2 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold' 
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                    }`}>
                      <Lock className="w-3 h-3" />
                      Step 2: Camera Authentication
                    </span>
                  </div>

                  {/* Inline Error Message */}
                  {cctvError && (
                    <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{cctvError}</span>
                    </div>
                  )}

                  {/* STEP 1: Camera Network Details */}
                  {cctvStep === 1 && (
                    <form onSubmit={handleCctvContinue} className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium whitespace-nowrap">
                          Camera IP Address:
                        </label>
                        <input
                          type="text"
                          value={cctvIp}
                          onChange={(e) => {
                            setCctvIp(e.target.value);
                            if (cctvError) setCctvError('');
                          }}
                          placeholder="192.168.128.10"
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-44 focus:ring-1 focus:ring-blue-500 font-mono focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium whitespace-nowrap">
                          RTSP Port:
                        </label>
                        <input
                          type="text"
                          value={cctvPort}
                          onChange={(e) => {
                            setCctvPort(e.target.value);
                            if (cctvError) setCctvError('');
                          }}
                          placeholder="554"
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-24 focus:ring-1 focus:ring-blue-500 font-mono focus:border-blue-500 outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all shrink-0 cursor-pointer"
                      >
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}

                  {/* STEP 2: Camera Authentication */}
                  {cctvStep === 2 && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        startExternalCamera();
                      }} 
                      className="flex flex-wrap items-center gap-3"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium whitespace-nowrap">
                          Username:
                        </label>
                        <input
                          type="text"
                          value={cctvUsername}
                          onChange={(e) => {
                            setCctvUsername(e.target.value);
                            if (cctvError) setCctvError('');
                          }}
                          placeholder="admin"
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-36 focus:ring-1 focus:ring-blue-500 font-mono focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium whitespace-nowrap">
                          Password:
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={cctvPassword}
                            onChange={(e) => {
                              setCctvPassword(e.target.value);
                              if (cctvError) setCctvError('');
                            }}
                            placeholder="••••••••"
                            className="px-3 py-1.5 pr-8 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-36 focus:ring-1 focus:ring-blue-500 font-mono focus:border-blue-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 focus:outline-none"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCctvBack}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back
                        </button>

                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all shrink-0 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Connect Camera
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {cameraMode === 'upload' && (
                <div className="flex flex-wrap items-center gap-3 w-full">
                  <input
                    type="file"
                    accept=".mp4,.avi,.mov,.mkv"
                    onChange={(e) => setSelectedVideoFile(e.target.files[0] || null)}
                    className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />

                  <button
                    onClick={handleVideoUpload}
                    disabled={!selectedVideoFile || isProcessingVideo}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition-all ${
                      selectedVideoFile && !isProcessingVideo
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isProcessingVideo ? `Processing (${uploadProgress}%)` : 'Process Video'}
                  </button>

                  {videoProcessingResult?.annotatedVideoUrl && (
                    <a
                      href={videoProcessingResult.annotatedVideoUrl}
                      download="campus_traffic_annotated.mp4"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600/30"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Video
                    </a>
                  )}
                </div>
              )}

              {/* Reset Counters Action */}
              <button
                onClick={resetCrossings}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Crossings
              </button>
            </div>

            {/* Video Processing Progress Bar */}
            {isProcessingVideo && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Inference processing in progress...</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Metrics & Category Breakdown */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Count Summary</h3>
              <CongestionBadge level={congestionLevel} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Vehicle Crossings</span>
                <span className="text-2xl font-mono font-extrabold text-white mt-1 block">{totalCrossings}</span>
                <span className="text-[10px] text-emerald-400">Supported vehicles</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Vehicle Flow</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base font-mono font-extrabold text-emerald-400">IN {incomingCount}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-base font-mono font-extrabold text-cyan-400">OUT {outgoingCount}</span>
                </div>
                <span className="text-[10px] text-slate-400">Vehicles only</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Vehicles In View</span>
                <span className="text-xl font-mono font-bold text-blue-400 mt-1 block">
                  {(liveCounts.car || 0) + (liveCounts.motorcycle || 0) + (liveCounts.bus || 0) + (liveCounts.truck || 0) + (liveCounts.bicycle || 0)}
                </span>
                <span className="text-[10px] text-slate-400">Cars, bikes, buses, trucks</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Pedestrians (Excluded)</span>
                <span className="text-xl font-mono font-bold text-purple-400 mt-1 block">
                  {liveCounts.person || 0}
                </span>
                <span className="text-[10px] text-purple-400/80">Not counted as vehicles</span>
              </div>
            </div>
          </div>

          {/* Category-wise Breakdown Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Category-wise Crossing Counts
            </h3>
            <div className="divide-y divide-slate-800">
              {VEHICLE_CLASSES.map((category) => (
                <div key={category.key} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="font-medium text-slate-200">{category.label}</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-slate-400 text-[11px]">
                      Live: <strong className="text-blue-400">{liveCounts[category.key] || 0}</strong>
                    </span>
                    <span className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Crossed: {counts[category.key] || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How Counting Works Explainer */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              Vehicle-Only Counting Protocol
            </p>
            <p>
              ByteTrack maintains strict class-consistent Kalman tracking IDs. Crossing events and directional flow counts (IN/OUT) are triggered exclusively by supported vehicle classes (cars, motorcycles, buses, trucks, bicycles). Pedestrians (persons) are separately tracked and strictly excluded from vehicle crossing counts, directional flow vectors, and congestion calculations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
