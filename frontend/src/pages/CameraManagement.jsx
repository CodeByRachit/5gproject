import React, { useState } from 'react';
import { useTraffic } from '../context/TrafficContext';
import { 
  Camera, 
  Video, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  Radio, 
  Play, 
  Square,
  ShieldCheck,
  Settings2
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const CameraManagement = () => {
  const { isConnected, modelStatus } = useTraffic();

  // Preset cameras based on original system capabilities
  const [cameras, setCameras] = useState([
    {
      id: 'cam_laptop',
      name: 'Campus Laptop Built-in Webcam',
      type: 'laptop',
      source: 'Browser MediaDevices API',
      resolution: '960x540 (Dynamic)',
      fps: '30 FPS',
      status: 'Ready',
      location: 'Gate 1 Mobile Checkpoint',
      isPrimary: true,
    },
    {
      id: 'cam_usb',
      name: 'External USB Wide-Angle Camera',
      type: 'usb',
      source: 'Device Index 1 (DirectShow)',
      resolution: '1280x720',
      fps: '30 FPS',
      status: 'Configured',
      location: 'Main Campus East Entrance',
      isPrimary: false,
    },
    {
      id: 'cam_rtsp',
      name: 'Sparsh Enterprise IP CCTV',
      type: 'rtsp',
      source: 'rtsp://admin:pass@192.168.1.100:554/stream1',
      resolution: '1920x1080 (1080p)',
      fps: '25 FPS',
      status: 'Standby',
      location: 'North Transit Bus Loop',
      isPrimary: false,
    },
  ]);

  // Modal / form state for adding or editing cameras
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: '',
    type: 'usb',
    source: '',
    location: '',
  });

  const handleAddCamera = (e) => {
    e.preventDefault();
    if (!newCamera.name) return;

    const added = {
      id: `cam_${Date.now()}`,
      name: newCamera.name,
      type: newCamera.type,
      source: newCamera.source || (newCamera.type === 'usb' ? 'Device Index 2' : 'rtsp://admin:pass@ip:554'),
      resolution: '1280x720',
      fps: '25 FPS',
      status: 'Configured',
      location: newCamera.location || 'Campus Checkpoint',
      isPrimary: false,
    };

    setCameras(prev => [...prev, added]);
    setNewCamera({ name: '', type: 'usb', source: '', location: '' });
    setShowAddModal(false);
  };

  const handleDeleteCamera = (id) => {
    setCameras(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Camera Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure laptop webcams, USB optical devices, and Sparsh IP CCTV RTSP streaming endpoints
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all w-fit"
        >
          <Plus className="w-4 h-4" /> Register New Camera
        </button>
      </div>

      {/* Camera Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((cam) => (
          <div 
            key={cam.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    {cam.type === 'laptop' && <Camera className="w-5 h-5" />}
                    {cam.type === 'usb' && <Video className="w-5 h-5" />}
                    {cam.type === 'rtsp' && <Radio className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{cam.name}</h3>
                    <p className="text-xs text-slate-400">{cam.location}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  cam.status === 'Ready' || cam.status === 'Configured'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {cam.status}
                </span>
              </div>

              {/* Camera Details */}
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Protocol:</span>
                  <span className="text-slate-200 font-mono uppercase">{cam.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Source:</span>
                  <span className="text-slate-200 font-mono truncate max-w-[180px]">{cam.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Format:</span>
                  <span className="text-slate-200 font-mono">{cam.resolution} @ {cam.fps}</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <Link
                to="/live-camera"
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> Monitor Live
              </Link>

              {!cam.isPrimary && (
                <button
                  onClick={() => handleDeleteCamera(cam.id)}
                  title="Remove camera"
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Register Camera Source</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddCamera} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Perimeter Gate CCTV"
                  value={newCamera.name}
                  onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Source Type</label>
                <select
                  value={newCamera.type}
                  onChange={(e) => setNewCamera({ ...newCamera, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="usb">External USB Camera</option>
                  <option value="rtsp">Sparsh IP CCTV (RTSP Stream)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {newCamera.type === 'usb' ? 'Device Index' : 'RTSP Stream URL'}
                </label>
                <input
                  type="text"
                  placeholder={newCamera.type === 'usb' ? 'e.g. 1, 2, 3' : 'rtsp://username:password@ip:554/stream1'}
                  value={newCamera.source}
                  onChange={(e) => setNewCamera({ ...newCamera, source: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Checkpoint Location</label>
                <input
                  type="text"
                  placeholder="e.g. Science Complex Crossroad"
                  value={newCamera.location}
                  onChange={(e) => setNewCamera({ ...newCamera, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
