import { analyzeCongestion } from './congestionAnalyzer.js';
import { TrafficAlert } from '../models/TrafficAlert.js';

/**
 * Generate formatted alert object from live counts.
 */
export const getAlertStatus = (liveCounts = {}) => {
  const result = analyzeCongestion(liveCounts);

  // Total vehicles strictly excludes pedestrians for traffic alerts
  const totalVehicles = result.vehicle_count;

  const level = result.congestion_level;
  const trafficScore = result.congestion_score;

  let message = 'Traffic status unavailable.';
  if (level === 'NO DATA') {
    message = 'Camera standby or waiting for traffic stream.';
  } else if (level === 'HIGH') {
    message = `Heavy traffic detected! (${totalVehicles} vehicles in checkpoint zone)`;
  } else if (level === 'MODERATE') {
    message = `Moderate traffic detected (${totalVehicles} vehicles).`;
  } else if (level === 'LOW') {
    message = 'Traffic is flowing smoothly.';
  }

  return {
    timestamp: new Date(),
    congestion_level: level,
    object_count: totalVehicles, // Vehicles ONLY
    vehicle_count: totalVehicles,
    pedestrians: Number(liveCounts.person) || 0,
    traffic_score: trafficScore,
    alert_message: message,
  };
};

/**
 * Rate-limited alert save to MongoDB:
 * Saves alert only when congestion level changes
 * OR the previous alert is older than 60 seconds.
 */
export const saveAlert = async (alertData, cameraId = 'campus_main') => {
  try {
    const lastAlert = await TrafficAlert.findOne({ cameraId }).sort({ timestamp: -1 });

    let shouldSave = true;

    if (lastAlert) {
      const lastLevel = lastAlert.congestion_level;
      const lastTime = new Date(lastAlert.timestamp).getTime();
      const currentTime = new Date(alertData.timestamp).getTime();
      const diffSeconds = (currentTime - lastTime) / 1000;

      // Rate limit check: same level and less than 60 seconds elapsed
      if (lastLevel === alertData.congestion_level && diffSeconds < 60) {
        shouldSave = false;
      }
    }

    if (shouldSave) {
      const doc = await TrafficAlert.create({
        ...alertData,
        cameraId,
      });
      return { saved: true, alert: doc };
    }

    return { saved: false, alert: lastAlert };
  } catch (error) {
    console.error('[AlertManager Error] Failed to save alert:', error.message);
    return { saved: false, error: error.message };
  }
};

/**
 * Retrieve recent alert history from MongoDB.
 */
export const getAlertHistory = async (limit = 100, cameraId = null) => {
  try {
    const filter = cameraId ? { cameraId } : {};
    return await TrafficAlert.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('[AlertManager Error] Failed to get alert history:', error.message);
    return [];
  }
};
