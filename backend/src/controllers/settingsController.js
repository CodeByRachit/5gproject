import { SystemSettings } from '../models/SystemSettings.js';
import { getCameraPipeline } from '../cv/cameraManager.js';

export const getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne().lean();
    if (!settings) {
      settings = await SystemSettings.create({
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
    }
    return res.json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const update = req.body;
    const settings = await SystemSettings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    );

    // Synchronize detection and tracking settings with active camera pipelines
    const webcamPipeline = getCameraPipeline('laptop_webcam');
    webcamPipeline.updateSettings(settings);

    const extPipeline = getCameraPipeline('external_camera');
    extPipeline.updateSettings(settings);

    return res.json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
