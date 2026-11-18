import { Server } from 'socket.io';
import { getCameraPipeline } from '../cv/cameraManager.js';

let io = null;

export const initSocket = (httpServer) => {
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e8, // 100 MB buffer for binary video frames
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Stream frames directly over WebSocket
    socket.on('client_frame', async (data) => {
      try {
        const { image, cameraId = 'laptop_webcam' } = data;
        if (!image) return;

        const pipeline = getCameraPipeline(cameraId);
        const result = await pipeline.processFrame(image);

        socket.emit('frame_processed', {
          cameraId,
          detections: result.detections,
          counts: result.counts,
          totalCrossings: result.totalCrossings,
        });
      } catch (err) {
        socket.emit('pipeline_error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => io;
