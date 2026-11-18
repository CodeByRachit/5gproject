import { trainAndPredict } from '../analytics/trafficPredictor.js';

let latestPredictionCache = null;

export const getCurrentPrediction = async (req, res) => {
  try {
    if (!latestPredictionCache) {
      latestPredictionCache = await trainAndPredict();
    }
    return res.json({ success: true, data: latestPredictionCache });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const triggerTraining = async (req, res) => {
  try {
    const result = await trainAndPredict();
    latestPredictionCache = result;
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
