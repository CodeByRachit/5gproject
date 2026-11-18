import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { connectDB } from './config/db.js';
import { initSocket } from './sockets/socketManager.js';
import { initYoloSession } from './cv/yoloDetector.js';
import apiRoutes from './routes/apiRoutes.js';

dotenv.config();

// Prevent process termination on transient socket or network drops
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
});

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder
const uploadsDir = path.resolve('uploads');
app.use('/uploads', express.static(uploadsDir));

// Mount REST API
app.use('/api', apiRoutes);

// Root Health Ping
app.get('/', (req, res) => {
  res.json({
    message: '5G Smart Campus Traffic Monitoring and Mobility Analytics System Backend',
    version: '2.0.0',
    status: 'Running',
    framework: 'Node.js + Express.js + Socket.IO + MongoDB',
  });
});

const PORT = process.env.PORT || 5000;

// Bootstrap Services and Start Server
const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Preload YOLOv8 ONNX Model
    try {
      await initYoloSession();
      console.log('[System] YOLOv8 ONNX inference engine ready.');
    } catch (err) {
      console.warn(`[System Warning] YOLOv8 ONNX initialization warning: ${err.message}`);
    }

    // 3. Listen on PORT
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`================================================================`);
      console.log(`🚦 5G Smart Campus Traffic Server Active`);
      console.log(`📡 HTTP Server: http://localhost:${PORT}`);
      console.log(`⚡ Socket.IO Server: http://localhost:${PORT}`);
      console.log(`📊 REST API: http://localhost:${PORT}/api`);
      console.log(`================================================================`);
    });
  } catch (err) {
    console.error('[Fatal Startup Error]', err);
    process.exit(1);
  }
};

startServer();
