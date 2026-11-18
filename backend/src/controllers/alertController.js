import { getAlertHistory, saveAlert } from '../analytics/alertManager.js';

export const getAlerts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const alerts = await getAlertHistory(limit);
    return res.json({ success: true, data: alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAlert = async (req, res) => {
  try {
    const alertData = req.body;
    const result = await saveAlert(alertData, alertData.cameraId || 'campus_main');
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
