import mongoose from 'mongoose';

const trafficAlertSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    cameraId: {
      type: String,
      default: 'campus_main',
      index: true,
    },
    congestion_level: {
      type: String,
      enum: ['NO DATA', 'LOW', 'MODERATE', 'HIGH'],
      required: true,
    },
    object_count: {
      type: Number,
      required: true,
      min: 0,
    },
    traffic_score: {
      type: Number,
      required: true,
      min: 0,
    },
    alert_message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

trafficAlertSchema.index({ timestamp: -1 });
trafficAlertSchema.index({ congestion_level: 1, timestamp: -1 });

export const TrafficAlert = mongoose.model('TrafficAlert', trafficAlertSchema);
