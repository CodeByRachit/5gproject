import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getCameraPipeline } from './cameraManager.js';
import { getIO } from '../sockets/socketManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RtspCameraService {
  constructor() {
    this.activeProcesses = new Map(); // cameraId -> ChildProcess
    this.streamClients = new Map();   // cameraId -> Set<res>
    this.latestFrames = new Map();    // cameraId -> Buffer
    this.isProcessingInference = new Map(); // cameraId -> boolean
    this.fpsCounters = new Map();     // cameraId -> count
    this.lastFpsTimes = new Map();    // cameraId -> timestamp
    this.fpsMap = new Map();          // cameraId -> number
    this.workerScript = path.join(__dirname, 'rtsp_worker.py');
    
    // Resolve venv Python or system python
    const venvPython = path.resolve(__dirname, '../../../5G_Smart_Campus_Traffic_Dual_Input/venv/Scripts/python.exe');
    this.pythonExecutable = process.env.PYTHON_PATH || (fs.existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3'));
  }

  /**
   * Start RTSP or USB Camera streaming & inference worker
   */
  async startCamera(cameraId, config) {
    if (this.activeProcesses.has(cameraId)) {
      this.stopCamera(cameraId);
    }

    const { type, ip, port, username, password, streamPath, deviceIndex } = config;

    let source = '';
    let sanitizedLogUrl = '';

    if (type === 'usb') {
      source = String(deviceIndex || 1);
      sanitizedLogUrl = `USB Device Index ${source}`;
    } else {
      // Auto-construct full RTSP URL
      const cleanUser = encodeURIComponent(username || 'admin');
      const cleanPass = encodeURIComponent(password || '');
      const cleanPort = port || '554';
      const rawPath = streamPath || '/avstream/channel=1/stream=0.sdp';
      const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

      source = `rtsp://${cleanUser}:${cleanPass}@${ip}:${cleanPort}${cleanPath}`;
      // Sanitize password in logs
      sanitizedLogUrl = `rtsp://${cleanUser}:***@${ip}:${cleanPort}${cleanPath}`;
    }

    console.log(`[CameraService] Initializing stream for ${cameraId}: ${sanitizedLogUrl}`);

    const args = [
      this.workerScript,
      '--source', source,
      '--ip', ip || '',
      '--port', String(port || 554),
    ];

    if (ip && (ip === '127.0.0.1' || ip.toLowerCase() === 'simulate')) {
      args.push('--simulate');
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const worker = spawn(this.pythonExecutable, args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(cameraId, worker);

      // Handle worker stderr (status messages and errors in JSON)
      worker.stderr.on('data', (data) => {
        const text = data.toString().trim();
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.status === 'connected') {
              console.log(`[CameraService] ${cameraId} connected successfully. Dimensions: ${parsed.width}x${parsed.height}`);
              if (!resolved) {
                resolved = true;
                resolve({ success: true, message: parsed.message });
              }
            } else if (parsed.status === 'error') {
              console.error(`[CameraService Error] ${parsed.message}`);
              if (!resolved) {
                resolved = true;
                this.stopCamera(cameraId);
                reject(new Error(parsed.message));
              }
            } else if (parsed.status === 'warning') {
              console.warn(`[CameraService Warning] ${parsed.message}`);
            }
          } catch {
            console.log(`[Camera Worker Log] ${line}`);
          }
        }
      });

      // Stream binary frames from worker stdout
      let incomingBuffer = Buffer.alloc(0);
      let expectedLength = null;
      let frameCaptureTime = null;

      worker.stdout.on('data', async (chunk) => {
        incomingBuffer = Buffer.concat([incomingBuffer, chunk]);

        while (true) {
          if (expectedLength === null) {
            if (incomingBuffer.length < 12) {
              break; // Need 12 bytes: 8-byte capture timestamp (ms) + 4-byte length header
            }
            frameCaptureTime = Number(incomingBuffer.readBigInt64BE(0));
            expectedLength = incomingBuffer.readUInt32BE(8);
            incomingBuffer = incomingBuffer.subarray(12);
          }

          if (incomingBuffer.length < expectedLength) {
            break; // Frame bytes not yet complete
          }

          // Extract complete JPEG frame
          const frameBuffer = incomingBuffer.subarray(0, expectedLength);
          incomingBuffer = incomingBuffer.subarray(expectedLength);
          expectedLength = null;

          const now = Date.now();
          const captureLatency = Math.max(0, now - (frameCaptureTime || now));

          // Save latest frame
          this.latestFrames.set(cameraId, frameBuffer);

          // Calculate streaming FPS
          const lastTime = this.lastFpsTimes.get(cameraId) || now;
          const count = (this.fpsCounters.get(cameraId) || 0) + 1;
          this.fpsCounters.set(cameraId, count);

          if (now - lastTime >= 1000) {
            const calculatedFps = Math.round(((count * 1000) / (now - lastTime)) * 10) / 10;
            this.fpsMap.set(cameraId, calculatedFps);
            this.fpsCounters.set(cameraId, 0);
            this.lastFpsTimes.set(cameraId, now);
          }
          const currentFps = this.fpsMap.get(cameraId) || 15;

          // 1. Emit live frame over Socket.IO to React frontend
          const io = getIO();
          if (io) {
            const base64Image = `data:image/jpeg;base64,${frameBuffer.toString('base64')}`;
            io.emit('camera_frame', {
              cameraId,
              frame: base64Image,
              timestamp: now,
              captureTime: frameCaptureTime || now,
              captureLatency,
              fps: currentFps,
            });
          }

          // 2. Broadcast to active MJPEG HTTP stream clients
          this._broadcastFrame(cameraId, frameBuffer);

          // 3. Run YOLOv8 + ByteTrack pipeline in Node.js (async inference decoupled from video display)
          if (!this.isProcessingInference.get(cameraId)) {
            this.isProcessingInference.set(cameraId, true);
            const pipeline = getCameraPipeline(cameraId);
            pipeline.processFrame(frameBuffer, currentFps, captureLatency)
              .catch((inferErr) => {
                // Ignore minor inference frame skips
              })
              .finally(() => {
                this.isProcessingInference.set(cameraId, false);
              });
          }
        }
      });

      worker.on('error', (err) => {
        console.error(`[Camera Worker Process Error]`, err);
        if (!resolved) {
          resolved = true;
          this.stopCamera(cameraId);
          reject(new Error(`Failed to spawn camera process: ${err.message}`));
        }
      });

      worker.on('close', (code, signal) => {
        console.log(`[CameraService] Camera process for ${cameraId} exited: code=${code}, signal=${signal}`);
        this.activeProcesses.delete(cameraId);
        if (!resolved) {
          resolved = true;
          reject(new Error(`Camera process exited with code ${code} (${signal})`));
        }
      });

      // Connection timeout fallback (15 seconds for 4K handshake)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.stopCamera(cameraId);
          reject(new Error(`Connection to camera timed out after 15 seconds.`));
        }
      }, 15000);
    });
  }

  /**
   * Stop active camera stream
   */
  stopCamera(cameraId) {
    if (this.activeProcesses.has(cameraId)) {
      const proc = this.activeProcesses.get(cameraId);
      try {
        proc.kill('SIGTERM');
      } catch {}
      this.activeProcesses.delete(cameraId);
    }

    // Close any active stream clients
    const clients = this.streamClients.get(cameraId);
    if (clients) {
      for (const res of clients) {
        try {
          res.end();
        } catch {}
      }
      this.streamClients.delete(cameraId);
    }

    // Clear cached frame
    this.latestFrames.delete(cameraId);
  }

  /**
   * Broadcast frame to all connected MJPEG HTTP clients
   */
  _broadcastFrame(cameraId, frameBuffer) {
    const clients = this.streamClients.get(cameraId);
    if (!clients || clients.size === 0) return;

    const header = Buffer.from(
      `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBuffer.length}\r\n\r\n`
    );
    const footer = Buffer.from('\r\n');

    for (const res of Array.from(clients)) {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(header);
          res.write(frameBuffer);
          res.write(footer);
        } else {
          clients.delete(res);
        }
      } catch (err) {
        clients.delete(res);
      }
    }
  }

  /**
   * Register an Express response as an MJPEG client
   */
  addStreamClient(cameraId, res) {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close',
    });

    if (!this.streamClients.has(cameraId)) {
      this.streamClients.set(cameraId, new Set());
    }

    const clients = this.streamClients.get(cameraId);
    clients.add(res);

    // Guard against unhandled stream errors on abrupt client aborts
    res.on('error', () => {
      clients.delete(res);
    });

    // Send latest frame immediately if available
    const latest = this.latestFrames.get(cameraId);
    if (latest && !res.writableEnded && !res.destroyed) {
      try {
        res.write(Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latest.length}\r\n\r\n`));
        res.write(latest);
        res.write(Buffer.from('\r\n'));
      } catch {}
    }

    res.on('close', () => {
      clients.delete(res);
    });
  }
}

export const rtspCameraService = new RtspCameraService();
