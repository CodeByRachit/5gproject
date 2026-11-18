import { CameraConfig } from '../models/CameraConfig.js';
import { getCameraPipeline } from '../cv/cameraManager.js';
import { rtspCameraService } from '../cv/rtspCameraService.js';
import { getIO } from '../sockets/socketManager.js';

export const getCameras = async (req, res) => {
  try {
    const cameras = await CameraConfig.find().sort({ isPrimary: -1, createdAt: 1 });
    return res.json({ success: true, data: cameras });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const registerCamera = async (req, res) => {
  try {
    const { name, type, source, location } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }

    const cameraId = `cam_${Date.now()}`;
    const newCamera = await CameraConfig.create({
      cameraId,
      name,
      type,
      source: source || (type === 'usb' ? 'Device Index 1' : 'Sparsh IP CCTV'),
      location: location || 'Campus Checkpoint',
    });

    return res.status(201).json({ success: true, data: newCamera });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const startCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, deviceIndex, ip, port, username, password, streamPath } = req.body;

    const pipeline = getCameraPipeline(id);
    pipeline.status = 'Running';

    if (type === 'rtsp') {
      if (!ip) {
        return res.status(400).json({ success: false, message: 'Camera IP address is required' });
      }

      await rtspCameraService.startCamera(id, {
        type: 'rtsp',
        ip: ip.trim(),
        port: port ? String(port).trim() : '554',
        username: username ? String(username).trim() : 'admin',
        password: password || '',
        streamPath: streamPath || '/avstream/channel=1/stream=0.sdp',
      });
    } else if (type === 'usb') {
      await rtspCameraService.startCamera(id, {
        type: 'usb',
        deviceIndex: Number(deviceIndex || 1),
      });
    }

    await CameraConfig.findOneAndUpdate(
      { cameraId: id },
      { 
        status: 'Running',
        source: type === 'rtsp' ? `rtsp://${username || 'admin'}:***@${ip}:${port || '554'}` : `USB Index ${deviceIndex || 1}`
      },
      { upsert: true }
    );

    return res.json({
      success: true,
      message: `Camera ${id} started successfully`,
      status: 'Running',
    });
  } catch (error) {
    console.error(`[Start Camera Controller Error]`, error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const stopCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const pipeline = getCameraPipeline(id);
    pipeline.status = 'Stopped';

    rtspCameraService.stopCamera(id);

    await CameraConfig.findOneAndUpdate(
      { cameraId: id },
      { status: 'Stopped' }
    );

    const io = getIO();
    if (io) {
      io.emit('traffic_update', {
        cameraId: id,
        counts: pipeline.lineCrossing.counts,
        liveCounts: { car: 0, motorcycle: 0, bus: 0, truck: 0, bicycle: 0, person: 0 },
        totalCrossings: pipeline.lineCrossing.getSnapshot().totalCrossings,
        currentObjects: 0,
        uniqueObjects: pipeline.lineCrossing.uniqueObjects.size,
        congestionLevel: 'NO DATA',
        trafficScore: 0,
        modelStatus: 'Stopped',
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      message: `Camera ${id} stopped successfully`,
      status: 'Stopped',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCameraStream = (req, res) => {
  const { id } = req.params;
  rtspCameraService.addStreamClient(id, res);
};
