import mongoose from 'mongoose';

const trafficHistorySchema = new mongoose.Schema(
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
    vehicle_count: {
      type: Number,
      required: true,
      min: 0,
    },
    cars: {
      type: Number,
      default: 0,
      min: 0,
    },
    motorcycles: {
      type: Number,
      default: 0,
      min: 0,
    },
    buses: {
      type: Number,
      default: 0,
      min: 0,
    },
    trucks: {
      type: Number,
      default: 0,
      min: 0,
    },
    bicycles: {
      type: Number,
      default: 0,
      min: 0,
    },
    pedestrians: {
      type: Number,
      default: 0,
      min: 0,
    },
    congestion_score: {
      type: Number,
      required: true,
      min: 0,
    },
    congestion_level: {
      type: String,
      enum: ['NO DATA', 'LOW', 'MODERATE', 'HIGH'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

trafficHistorySchema.index({ timestamp: -1 });
trafficHistorySchema.index({ cameraId: 1, timestamp: -1 });

export const TrafficHistory = mongoose.model('TrafficHistory', trafficHistorySchema);
