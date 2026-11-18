import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema(
  {
    linePositionRatio: {
      type: Number,
      default: 0.55,
      min: 0.1,
      max: 0.9,
    },
    lowThreshold: {
      type: Number,
      default: 5,
    },
    moderateThreshold: {
      type: Number,
      default: 15,
    },
    weights: {
      car: { type: Number, default: 1.0 },
      motorcycle: { type: Number, default: 0.5 },
      bus: { type: Number, default: 2.5 },
      truck: { type: Number, default: 2.0 },
      bicycle: { type: Number, default: 0.4 },
    },
    confidenceThreshold: {
      type: Number,
      default: 0.25,
      min: 0.1,
      max: 0.9,
    },
    nmsIouThreshold: {
      type: Number,
      default: 0.58,
      min: 0.2,
      max: 0.9,
    },
    classConfidenceThresholds: {
      car: { type: Number, default: 0.25 },
      motorcycle: { type: Number, default: 0.20 },
      bus: { type: Number, default: 0.25 },
      truck: { type: Number, default: 0.25 },
      bicycle: { type: Number, default: 0.20 },
      person: { type: Number, default: 0.35 },
    },
    trackingSensitivity: {
      maxTimeLost: { type: Number, default: 45 },
      highThresh: { type: Number, default: 0.30 },
      matchThresh: { type: Number, default: 0.25 },
    },
    sampleIntervalSeconds: {
      type: Number,
      default: 10,
    },
    predictionHorizonMinutes: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
