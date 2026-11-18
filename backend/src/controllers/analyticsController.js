import { getCameraPipeline, resetCameraPipeline } from '../cv/cameraManager.js';
import { TrafficHistory } from '../models/TrafficHistory.js';
import { TrafficAlert } from '../models/TrafficAlert.js';
import { analyzeCongestion } from '../analytics/congestionAnalyzer.js';

const getActivePipeline = (req) => {
  const queryId = req?.query?.cameraId;
  if (queryId) return getCameraPipeline(queryId);

  const ext = getCameraPipeline('external_camera');
  if (ext && ext.status === 'Running') {
    return ext;
  }
  return getCameraPipeline('laptop_webcam');
};

export const getOverview = async (req, res) => {
  try {
    const pipeline = getActivePipeline(req);
    const snapshot = pipeline.lineCrossing.getSnapshot();
    const congestion = analyzeCongestion(snapshot.liveCounts);

    const recentHistory = await TrafficHistory.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      data: {
        counts: snapshot.counts,
        liveCounts: snapshot.liveCounts,
        totalCrossings: snapshot.totalCrossings,
        totalVehiclesCrossed: snapshot.totalVehiclesCrossed,
        totalPedestriansCrossed: snapshot.totalPedestriansCrossed,
        incoming: snapshot.incoming,
        outgoing: snapshot.outgoing,
        incomingCount: snapshot.incoming,
        outgoingCount: snapshot.outgoing,
        currentObjects: snapshot.currentObjects,
        uniqueObjects: snapshot.uniqueObjects,
        recentCrossings: snapshot.recentCrossings,
        congestionLevel: congestion.congestion_level,
        trafficScore: congestion.congestion_score,
        color: congestion.color,
        recentHistory,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCrossings = async (req, res) => {
  try {
    const pipeline = getActivePipeline(req);
    const snapshot = pipeline.lineCrossing.getSnapshot();
    return res.json({ success: true, data: snapshot });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetCrossings = async (req, res) => {
  try {
    resetCameraPipeline('laptop_webcam');
    resetCameraPipeline('external_camera');
    return res.json({ success: true, message: 'Crossings counter reset successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCongestion = async (req, res) => {
  try {
    const pipeline = getActivePipeline(req);
    const snapshot = pipeline.lineCrossing.getSnapshot();
    const congestion = analyzeCongestion(snapshot.liveCounts);
    return res.json({ success: true, data: congestion });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTrafficHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const history = await TrafficHistory.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
