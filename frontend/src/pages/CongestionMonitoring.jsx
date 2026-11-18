import React from 'react';
import { useTraffic, VEHICLE_CLASSES } from '../context/TrafficContext';
import { CongestionBadge } from '../components/CongestionBadge';
import { 
  Gauge, 
  Info, 
  Car, 
  AlertTriangle, 
  CheckCircle, 
  Sliders, 
  ShieldAlert,
  HelpCircle,
  TrendingUp
} from 'lucide-react';

export const CongestionMonitoring = () => {
  const { 
    liveCounts, 
    congestionLevel, 
    trafficScore, 
    settings 
  } = useTraffic();

  const cars = liveCounts.car || 0;
  const motorcycles = liveCounts.motorcycle || 0;
  const buses = liveCounts.bus || 0;
  const trucks = liveCounts.truck || 0;
  const bicycles = liveCounts.bicycle || 0;
  const pedestrians = liveCounts.person || 0;

  const totalVehicles = cars + motorcycles + buses + trucks + bicycles;

  // Weights specified in requirements
  const weights = settings?.weights || {
    car: 1.0,
    motorcycle: 0.5,
    bus: 2.5,
    truck: 2.0,
    bicycle: 0.4,
  };

  const getStatusDetails = (level) => {
    switch (level) {
      case 'HIGH':
        return {
          title: 'Heavy Traffic Congestion Detected',
          message: 'Campus perimeter traffic exceeds the threshold (> 15 vehicles). Recommended action: Activate secondary checkpoint gates and dispatch traffic marshals.',
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/30',
        };
      case 'MODERATE':
        return {
          title: 'Moderate Traffic Congestion',
          message: 'Vehicle density is steady and approaching warning limits (6–15 vehicles). Transit flow remains functional but localized delays may occur.',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/30',
        };
      case 'LOW':
        return {
          title: 'Traffic Flowing Smoothly',
          message: 'Optimal traffic flow detected (0–5 vehicles). Campus internal roads and transit lanes operate without congestion.',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30',
        };
      default:
        return {
          title: 'No Data / Camera Standby',
          message: 'Camera stream disconnected or awaiting connection. Start camera monitoring to analyze live congestion.',
          color: 'text-slate-400',
          bg: 'bg-slate-800/40 border-slate-700/60',
        };
    }
  };

  const details = getStatusDetails(congestionLevel);

  // Compute progress bar percent toward High threshold (max 25 for scale)
  const maxVehicleScale = 25;
  const progressPercent = Math.min(100, Math.round((totalVehicles / maxVehicleScale) * 100));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Congestion Monitoring</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time weighted vehicle congestion scoring & multi-tier operational classification
          </p>
        </div>

        <CongestionBadge level={congestionLevel} size="lg" />
      </div>

      {/* Main Congestion Status Hero Card */}
      <div className={`p-6 rounded-2xl border ${details.bg} transition-all`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Gauge className={`w-5 h-5 ${details.color}`} />
              <h3 className={`text-lg font-bold ${details.color}`}>{details.title}</h3>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">{details.message}</p>
          </div>

          <div className="flex items-center gap-6 divide-x divide-slate-800/80 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 shrink-0">
            <div className="pr-4 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Vehicles</span>
              <span className="text-3xl font-mono font-extrabold text-white mt-1 block">{totalVehicles}</span>
              <span className="text-[10px] text-slate-500">Excl. Pedestrians</span>
            </div>

            <div className="pl-6 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Traffic Score</span>
              <span className="text-3xl font-mono font-extrabold text-amber-400 mt-1 block">
                {Number(trafficScore).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500">Weighted Sum</span>
            </div>
          </div>
        </div>

        {/* Visual Threshold Gauge Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/60 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>0 Vehicles (No Data)</span>
            <span>1–5 (Low)</span>
            <span>6–15 (Moderate)</span>
            <span>&gt; 15 Vehicles (High Congestion)</span>
          </div>

          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
            {/* Zone indicators */}
            <div className="absolute top-0 bottom-0 left-[4%] w-[16%] bg-emerald-500/20" />
            <div className="absolute top-0 bottom-0 left-[24%] w-[40%] bg-amber-500/20" />
            <div className="absolute top-0 bottom-0 left-[64%] right-0 bg-rose-500/20" />

            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                congestionLevel === 'HIGH' ? 'bg-rose-500' :
                congestionLevel === 'MODERATE' ? 'bg-amber-500' :
                congestionLevel === 'LOW' ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
              style={{ width: `${Math.max(3, progressPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vehicle Weight Calculation Breakdown */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Weighted Congestion Formula & Component Breakdown
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Congestion Score = (1.0 × Car) + (0.5 × Motorcycle) + (2.5 × Bus) + (2.0 × Truck) + (0.4 × Bicycle)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Car */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Car</span>
              <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Weight: 1.0</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-white">{cars}</span>
              <span className="text-xs font-mono text-blue-400 font-semibold">={(cars * 1.0).toFixed(1)} pts</span>
            </div>
          </div>

          {/* Motorcycle */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Motorcycle</span>
              <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Weight: 0.5</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-white">{motorcycles}</span>
              <span className="text-xs font-mono text-cyan-400 font-semibold">={(motorcycles * 0.5).toFixed(1)} pts</span>
            </div>
          </div>

          {/* Bus */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Bus</span>
              <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Weight: 2.5</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-white">{buses}</span>
              <span className="text-xs font-mono text-amber-400 font-semibold">={(buses * 2.5).toFixed(1)} pts</span>
            </div>
          </div>

          {/* Truck */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Truck</span>
              <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Weight: 2.0</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-white">{trucks}</span>
              <span className="text-xs font-mono text-rose-400 font-semibold">={(trucks * 2.0).toFixed(1)} pts</span>
            </div>
          </div>

          {/* Bicycle */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Bicycle</span>
              <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Weight: 0.4</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-white">{bicycles}</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">={(bicycles * 0.4).toFixed(1)} pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Note on Pedestrians */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-purple-300">Pedestrian Separation Policy</h4>
          <p className="text-slate-300 leading-relaxed">
            Pedestrians ({pedestrians} detected in current frame) are strictly separated from vehicular traffic congestion scoring. Their count is tracked independently for sidewalk safety and campus foot-traffic flow, ensuring vehicle congestion alerts remain undistorted by large walking crowds.
          </p>
        </div>
      </div>
    </div>
  );
};
