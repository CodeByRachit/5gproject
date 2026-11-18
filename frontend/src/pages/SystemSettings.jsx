import React, { useState } from 'react';
import { useTraffic } from '../context/TrafficContext';
import { apiService } from '../api/apiService';
import { 
  Settings, 
  Sliders, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  Layers,
  Scale,
  Crosshair,
  ShieldAlert
} from 'lucide-react';

export const SystemSettings = () => {
  const { settings, setSettings } = useTraffic();

  // Local settings state
  const [linePositionRatio, setLinePositionRatio] = useState(settings?.linePositionRatio || 0.55);
  const [lowThreshold, setLowThreshold] = useState(settings?.lowThreshold || 5);
  const [moderateThreshold, setModerateThreshold] = useState(settings?.moderateThreshold || 15);
  
  // Vehicle Scoring Weights
  const [carWeight, setCarWeight] = useState(settings?.weights?.car || 1.0);
  const [motorcycleWeight, setMotorcycleWeight] = useState(settings?.weights?.motorcycle || 0.5);
  const [busWeight, setBusWeight] = useState(settings?.weights?.bus || 2.5);
  const [truckWeight, setTruckWeight] = useState(settings?.weights?.truck || 2.0);
  const [bicycleWeight, setBicycleWeight] = useState(settings?.weights?.bicycle || 0.4);

  // AI Detection & Sensitivity Tuning
  const [confidenceThreshold, setConfidenceThreshold] = useState(settings?.confidenceThreshold || 0.25);
  const [nmsIouThreshold, setNmsIouThreshold] = useState(settings?.nmsIouThreshold || 0.58);
  const [maxTimeLost, setMaxTimeLost] = useState(settings?.trackingSensitivity?.maxTimeLost || 45);
  const [highThresh, setHighThresh] = useState(settings?.trackingSensitivity?.highThresh || 0.30);

  const [saveStatus, setSaveStatus] = useState('');

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const updated = {
      linePositionRatio: Number(linePositionRatio),
      lowThreshold: Number(lowThreshold),
      moderateThreshold: Number(moderateThreshold),
      weights: {
        car: Number(carWeight),
        motorcycle: Number(motorcycleWeight),
        bus: Number(busWeight),
        truck: Number(truckWeight),
        bicycle: Number(bicycleWeight),
      },
      confidenceThreshold: Number(confidenceThreshold),
      nmsIouThreshold: Number(nmsIouThreshold),
      classConfidenceThresholds: {
        car: Math.min(Number(confidenceThreshold), 0.25),
        motorcycle: Math.max(0.15, Number(confidenceThreshold) - 0.05),
        bus: Number(confidenceThreshold),
        truck: Number(confidenceThreshold),
        bicycle: Math.max(0.15, Number(confidenceThreshold) - 0.05),
        person: 0.35,
      },
      trackingSensitivity: {
        maxTimeLost: Number(maxTimeLost),
        highThresh: Number(highThresh),
        matchThresh: 0.25,
      },
    };

    try {
      setSettings(updated);
      await apiService.updateSettings(updated);
      setSaveStatus('System settings updated and synchronized with backend CV pipeline successfully.');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      setSaveStatus('Settings updated locally.');
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  const handleResetDefaults = () => {
    setLinePositionRatio(0.55);
    setLowThreshold(5);
    setModerateThreshold(15);
    setCarWeight(1.0);
    setMotorcycleWeight(0.5);
    setBusWeight(2.5);
    setTruckWeight(2.0);
    setBicycleWeight(0.4);
    setConfidenceThreshold(0.25);
    setNmsIouThreshold(0.58);
    setMaxTimeLost(45);
    setHighThresh(0.30);
    setSaveStatus('Reset to default values.');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">System Settings</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure virtual line coordinates, AI detection sensitivity, ByteTrack thresholds and congestion parameters
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
        </div>
      </div>

      {/* Success banner */}
      {saveStatus && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* AI Detection & Vehicle Sensitivity Settings */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              YOLOv8 & ByteTrack Detection Sensitivity
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Detection Confidence Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Vehicle Confidence Threshold
                </label>
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {(confidenceThreshold * 100).toFixed(0)}% ({confidenceThreshold})
                </span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.50"
                step="0.01"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0.15 (High Recall)</span>
                <span>Default: 0.25</span>
                <span>0.50 (Strict)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Tuned to 0.25 to detect distant, small, and partially occluded vehicles without background noise.
              </p>
            </div>

            {/* NMS IoU Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  NMS IoU Threshold (Overlap)
                </label>
                <span className="font-mono text-xs text-amber-400 font-bold">
                  {(nmsIouThreshold * 100).toFixed(0)}% ({nmsIouThreshold})
                </span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.75"
                step="0.01"
                value={nmsIouThreshold}
                onChange={(e) => setNmsIouThreshold(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0.40 (Suppress)</span>
                <span>Default: 0.58</span>
                <span>0.75 (Allow Close)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Allows queuing and adjacent vehicles to remain detected while suppressing duplicate anchors.
              </p>
            </div>

            {/* ByteTrack Lost Buffer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Track Persistence Buffer
                </label>
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  {maxTimeLost} frames ({(maxTimeLost / 15).toFixed(1)}s)
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="75"
                step="1"
                value={maxTimeLost}
                onChange={(e) => setMaxTimeLost(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>15 frames (1.0s)</span>
                <span>Default: 45</span>
                <span>75 frames (5.0s)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Prevents track fragmentation when vehicles are temporarily hidden behind trees, poles, or other vehicles.
              </p>
            </div>
          </div>

          {/* Class Specific Threshold Indicators */}
          <div className="pt-3 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Class-Specific Active Sensitivity Baselines:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Car</span>
                <span className="text-xs font-mono font-bold text-blue-400">{(Math.min(confidenceThreshold, 0.25) * 100).toFixed(0)}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Motorcycle</span>
                <span className="text-xs font-mono font-bold text-cyan-400">{(Math.max(0.15, confidenceThreshold - 0.05) * 100).toFixed(0)}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Bus</span>
                <span className="text-xs font-mono font-bold text-amber-400">{(confidenceThreshold * 100).toFixed(0)}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Truck</span>
                <span className="text-xs font-mono font-bold text-rose-400">{(confidenceThreshold * 100).toFixed(0)}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Bicycle</span>
                <span className="text-xs font-mono font-bold text-emerald-400">{(Math.max(0.15, confidenceThreshold - 0.05) * 100).toFixed(0)}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Pedestrian</span>
                <span className="text-xs font-mono font-bold text-purple-400">35% (Isolated)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Virtual Line Coordinates */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Virtual Line-Crossing Settings
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Horizontal Counting Line Height Ratio ({Math.round(linePositionRatio * 100)}% of frame)
              </label>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.01"
                value={linePositionRatio}
                onChange={(e) => setLinePositionRatio(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                <span>Top (20%)</span>
                <span>Default: 55%</span>
                <span>Bottom (80%)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
              <span className="font-semibold text-slate-200 block mb-1">Vehicle-Only Counting Logic</span>
              When a tracked vehicle center (cx, cy) crosses the virtual line at y = Height &times; {linePositionRatio}, the unique vehicle track ID is counted once. Pedestrians crossing are accounted separately and strictly excluded from vehicle crossing totals.
            </div>
          </div>
        </div>

        {/* Congestion Classification Thresholds */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Congestion Classification Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Low Congestion Max Vehicles
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Vehicles &le; {lowThreshold} classified as LOW</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Moderate Congestion Max Vehicles
              </label>
              <input
                type="number"
                min="6"
                max="50"
                value={moderateThreshold}
                onChange={(e) => setModerateThreshold(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Vehicles &gt; {moderateThreshold} classified as HIGH</span>
            </div>
          </div>
        </div>

        {/* Vehicle Weights Configuration */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Scale className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Vehicle Weight Scoring Multipliers
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Car Weight</label>
              <input
                type="number"
                step="0.1"
                value={carWeight}
                onChange={(e) => setCarWeight(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Default: 1.0</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Motorcycle Weight</label>
              <input
                type="number"
                step="0.1"
                value={motorcycleWeight}
                onChange={(e) => setMotorcycleWeight(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Default: 0.5</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Bus Weight</label>
              <input
                type="number"
                step="0.1"
                value={busWeight}
                onChange={(e) => setBusWeight(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Default: 2.5</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Truck Weight</label>
              <input
                type="number"
                step="0.1"
                value={truckWeight}
                onChange={(e) => setTruckWeight(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Default: 2.0</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Bicycle Weight</label>
              <input
                type="number"
                step="0.1"
                value={bicycleWeight}
                onChange={(e) => setBicycleWeight(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Default: 0.4</span>
            </div>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save System Settings
          </button>
        </div>
      </form>
    </div>
  );
};
