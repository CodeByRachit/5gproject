import mongoose from 'mongoose';

const cameraConfigSchema = new mongoose.Schema(
  {
    cameraId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['laptop', 'usb', 'rtsp'],
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      default: 'Campus Checkpoint',
    },
    resolution: {
      type: String,
      default: '1280x720',
    },
    fps: {
      type: String,
      default: '30 FPS',
    },
    status: {
      type: String,
      enum: ['Ready', 'Configured', 'Running', 'Stopped', 'Error', 'Standby'],
      default: 'Configured',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const CameraConfig = mongoose.model('CameraConfig', cameraConfigSchema);
