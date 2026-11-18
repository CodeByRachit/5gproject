import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { TrafficHistory } from '../models/TrafficHistory.js';
import { TrafficAlert } from '../models/TrafficAlert.js';
import { CameraConfig } from '../models/CameraConfig.js';
import { SystemSettings } from '../models/SystemSettings.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateDirs = [
  process.env.SEED_DATA_DIR,
  path.resolve(process.cwd(), 'data/seed'),
  path.resolve(process.cwd(), 'backend/data/seed'),
  path.resolve(__dirname, '../../data/seed'),
  path.resolve(process.cwd(), '../5G_Smart_Campus_Traffic_Dual_Input/data'),
  path.resolve(__dirname, '../../../5G_Smart_Campus_Traffic_Dual_Input/data'),
].filter(Boolean);

const BASE_DIR = candidateDirs.find((dir) => fs.existsSync(dir)) || path.resolve(process.cwd(), 'data/seed');
const HISTORY_CSV = process.env.HISTORY_CSV_PATH || path.join(BASE_DIR, 'traffic_history.csv');
const ALERTS_CSV = process.env.ALERTS_CSV_PATH || path.join(BASE_DIR, 'traffic_alerts.csv');

export const seedDatabase = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://mongodb:27017/smart_campus_traffic';
  await mongoose.connect(uri);
  console.log('[Seed] Connected to MongoDB.');

  // 1. Seed System Settings
  const settingsCount = await SystemSettings.countDocuments();
  if (settingsCount === 0) {
    await SystemSettings.create({
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
    });
    console.log('[Seed] Initialized System Settings.');
  }

  // 2. Seed Camera Configs
  const cameraCount = await CameraConfig.countDocuments();
  if (cameraCount === 0) {
    await CameraConfig.create([
      {
        cameraId: 'laptop_webcam',
        name: 'Campus Laptop Built-in Webcam',
        type: 'laptop',
        source: 'Browser MediaDevices API',
        location: 'Gate 1 Mobile Checkpoint',
        resolution: '960x540',
        fps: '30 FPS',
        status: 'Ready',
        isPrimary: true,
      },
      {
        cameraId: 'usb_cam_1',
        name: 'External USB Camera',
        type: 'usb',
        source: 'Device Index 1',
        location: 'Main East Entrance',
        resolution: '1280x720',
        fps: '30 FPS',
        status: 'Configured',
        isPrimary: false,
      },
      {
        cameraId: 'sparsh_rtsp_1',
        name: 'Sparsh IP CCTV',
        type: 'rtsp',
        source: 'rtsp://admin:pass@192.168.1.100:554/stream1',
        location: 'North Transit Bus Loop',
        resolution: '1920x1080',
        fps: '25 FPS',
        status: 'Standby',
        isPrimary: false,
      },
    ]);
    console.log('[Seed] Initialized Default Camera Configurations.');
  }

  // 3. Import Historical Observations from CSV
  const historyCount = await TrafficHistory.countDocuments();
  if (historyCount === 0 && fs.existsSync(HISTORY_CSV)) {
    const historyRows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(HISTORY_CSV)
        .pipe(csvParser())
        .on('data', (row) => {
          if (row.timestamp) {
            historyRows.push({
              timestamp: new Date(row.timestamp),
              cameraId: 'campus_main',
              vehicle_count: Number(row.vehicle_count) || 0,
              cars: Number(row.cars) || 0,
              motorcycles: Number(row.motorcycles) || 0,
              buses: Number(row.buses) || 0,
              trucks: Number(row.trucks) || 0,
              bicycles: Number(row.bicycles) || 0,
              pedestrians: 0,
              congestion_score: Number(row.congestion_score) || 0,
              congestion_level: row.congestion_level || 'LOW',
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (historyRows.length > 0) {
      await TrafficHistory.insertMany(historyRows);
      console.log(`[Seed] Imported ${historyRows.length} traffic history records from CSV to MongoDB.`);
    }
  }

  // 4. Import Historical Alerts from CSV
  const alertCount = await TrafficAlert.countDocuments();
  if (alertCount === 0 && fs.existsSync(ALERTS_CSV)) {
    const alertRows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(ALERTS_CSV)
        .pipe(csvParser())
        .on('data', (row) => {
          if (row.timestamp) {
            alertRows.push({
              timestamp: new Date(row.timestamp),
              cameraId: 'campus_main',
              congestion_level: row.congestion_level || 'LOW',
              object_count: Number(row.object_count) || 0,
              traffic_score: Number(row.traffic_score) || 0,
              alert_message: row.alert_message || 'Traffic condition nominal.',
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (alertRows.length > 0) {
      await TrafficAlert.insertMany(alertRows);
      console.log(`[Seed] Imported ${alertRows.length} traffic alerts from CSV to MongoDB.`);
    }
  }

  console.log('[Seed] Database initialization complete.');
};

// Direct script execution check
if (process.argv[1] && process.argv[1].endsWith('seedData.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
