import React, { useState, useEffect } from 'react';
import { useTraffic } from '../context/TrafficContext';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  Bell, 
  ShieldCheck, 
  Activity,
  Layers
} from 'lucide-react';

export const Navbar = () => {
  const { 
    isConnected, 
    modelStatus, 
    totalCrossings, 
    congestionLevel, 
    resetCrossings,
    alerts 
  } = useTraffic();
  
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getCongestionColor = (level) => {
    switch (level) {
      case 'HIGH': return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'MODERATE': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'LOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      default: return 'bg-slate-700/20 text-slate-400 border-slate-700/40';
    }
  };

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Brand & 5G Tag */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">5G Smart Campus</h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                5G MEC
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Intelligent Transportation & Mobility Analytics</p>
          </div>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center gap-4">
        {/* Congestion Quick Pill */}
        <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getCongestionColor(congestionLevel)}`}>
          <span className={`w-2 h-2 rounded-full ${
            congestionLevel === 'HIGH' ? 'bg-rose-500 animate-ping' :
            congestionLevel === 'MODERATE' ? 'bg-amber-500' :
            congestionLevel === 'LOW' ? 'bg-emerald-500' : 'bg-slate-500'
          }`} />
          Congestion: {congestionLevel}
        </div>

        {/* Model Pipeline Status */}
        <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>Pipeline: <strong className="text-white font-mono">{modelStatus}</strong></span>
        </div>

        {/* Total Crossings Counter */}
        <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Crossings: <strong className="text-indigo-400 font-mono">{totalCrossings}</strong></span>
        </div>
      </div>

      {/* Right Controls & Clock */}
      <div className="flex items-center gap-3">
        {/* Reset Crossings Button */}
        <button
          onClick={resetCrossings}
          title="Reset cumulative line crossing counter"
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Reset Counts</span>
        </button>

        {/* Network / Socket Connection Indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
          isConnected 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isConnected ? 'Online' : 'Offline'}</span>
        </div>

        {/* Digital Clock */}
        <div className="hidden xl:block font-mono text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          {currentTime}
        </div>
      </div>
    </header>
  );
};
