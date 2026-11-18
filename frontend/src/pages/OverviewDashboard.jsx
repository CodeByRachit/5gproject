import React, { useState, useEffect } from 'react';
import { useTraffic, VEHICLE_CLASSES } from '../context/TrafficContext';
import { MetricCard } from '../components/MetricCard';
import { CongestionBadge } from '../components/CongestionBadge';
import { 
  Car, 
  UserCheck, 
  Layers, 
  Eye, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Video,
  Clock,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Link } from 'react-router-dom';

export const OverviewDashboard = () => {
  const { 
    counts, 
    liveCounts, 
    currentObjects, 
    totalCrossings, 
    totalVehiclesCrossed,
    incomingCount,
    outgoingCount,
    liveTrendHistory,
    congestionLevel, 
    trafficScore, 
    modelStatus, 
    alerts,
    isConnected 
  } = useTraffic();

  // Aggregate total vehicles detected in the current frame (excluding pedestrians)
  const totalLiveVehicles = 
    (liveCounts.car || 0) + 
    (liveCounts.motorcycle || 0) + 
    (liveCounts.bus || 0) + 
    (liveCounts.truck || 0) + 
    (liveCounts.bicycle || 0);

  const totalCrossingVehicles =
    (counts.car || 0) + 
    (counts.motorcycle || 0) + 
    (counts.bus || 0) + 
    (counts.truck || 0) + 
    (counts.bicycle || 0);

  const pedestrianCount = counts.person || 0;
  const livePedestrians = liveCounts.person || 0;

  // Prepare chart data for cumulative crossings
  const crossingChartData = VEHICLE_CLASSES.map(v => ({
    name: v.label,
    crossings: counts[v.key] || 0,
    live: liveCounts[v.key] || 0,
    color: v.color,
  }));

  // Maintain short rolling chart history for live traffic flow
  const [trafficTrendData, setTrafficTrendData] = useState([]);

  useEffect(() => {
    if (liveTrendHistory && liveTrendHistory.length > 0) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTrafficTrendData((prev) => {
      const next = [
        ...prev,
        {
          time: timestamp,
          vehicles: totalLiveVehicles,
          score: trafficScore,
          pedestrians: livePedestrians,
        }
      ];
      return next.slice(-15);
    });
  }, [totalLiveVehicles, trafficScore, livePedestrians, liveTrendHistory]);

  const displayTrendData = liveTrendHistory && liveTrendHistory.length > 0 ? liveTrendHistory : trafficTrendData;

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if High Congestion */}
      {congestionLevel === 'HIGH' && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">Severe Campus Traffic Congestion Alert</p>
              <p className="text-xs text-rose-400/80">Vehicle count exceeds high threshold (&gt; 15). Automated campus notifications active.</p>
            </div>
          </div>
          <Link to="/alerts" className="text-xs font-semibold underline hover:text-rose-200">
            View Alerts
          </Link>
        </div>
      )}

      {/* Page Title & System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Overview Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time deep learning multi-modal traffic analytics & crossing metrics</p>
        </div>

        <div className="flex items-center gap-3">
          <CongestionBadge level={congestionLevel} size="md" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span>Camera Feed: <strong className="text-white">{modelStatus}</strong></span>
          </div>
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Vehicle Line Crossings"
          value={totalCrossings}
          subtitle={`Flow: IN ${incomingCount} | OUT ${outgoingCount}`}
          icon={Layers}
          color="blue"
          trend={{ label: 'Vehicle Direction', value: `IN ${incomingCount} · OUT ${outgoingCount}`, positive: true }}
        />

        <MetricCard
          title="Objects in View"
          value={Object.values(liveCounts).reduce((a, b) => a + b, 0)}
          subtitle={`${totalLiveVehicles} vehicles · ${livePedestrians} pedestrians`}
          icon={Eye}
          color="cyan"
          trend={{ label: 'Active Tracks', value: currentObjects, positive: true }}
        />

        <MetricCard
          title="Traffic Score"
          value={Number(trafficScore).toFixed(2)}
          subtitle="Weighted vehicle congestion score"
          icon={TrendingUp}
          color="amber"
          trend={{ label: 'Status', value: congestionLevel }}
        />

        <MetricCard
          title="Pedestrians Count"
          value={pedestrianCount}
          subtitle={`${livePedestrians} pedestrians in current frame`}
          icon={UserCheck}
          color="purple"
          trend={{ label: 'Line Crossings', value: pedestrianCount, positive: true }}
        />
      </div>

      {/* Main Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category-wise Line Crossings Chart */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Category-wise Cumulative Crossings</h3>
              <p className="text-xs text-slate-400">Total counted objects that have crossed the horizontal virtual line</p>
            </div>
            <Link to="/analytics" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold">
              Deep Analytics <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crossingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                />
                <Bar dataKey="crossings" name="Total Crossings" radius={[6, 6, 0, 0]}>
                  {crossingChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Traffic Flow Timeline */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Traffic Flow Trend</h3>
              <p className="text-xs text-slate-400">Real-time vehicle & weighted score pulse</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="vehicles" name="Vehicles" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="score" name="Score" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 4" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
          Category-wise Real-Time Telemetry
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {VEHICLE_CLASSES.map((category) => {
            const liveVal = liveCounts[category.key] || 0;
            const crossedVal = counts[category.key] || 0;
            return (
              <div 
                key={category.key}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">{category.label}</span>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-mono font-bold text-white">{crossedVal}</span>
                    <span className="text-[10px] text-slate-400 block">Crossed</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-semibold text-blue-400">{liveVal}</span>
                    <span className="text-[10px] text-slate-400 block">In Frame</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Alerts & Quick Camera Access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Traffic Alerts */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Traffic Alerts</h3>
            </div>
            <Link to="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
              All Alerts ({alerts.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No traffic alerts recorded yet. Traffic conditions are nominal.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto">
              {alerts.slice(0, 5).map((alert, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      alert.congestion_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      alert.congestion_level === 'MODERATE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      alert.congestion_level === 'LOW' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      'bg-slate-700/20 text-slate-400'
                    }`}>
                      {alert.congestion_level}
                    </span>
                    <span className="text-slate-200">{alert.alert_message}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                    <span>Score: {alert.traffic_score}</span>
                    <span>{alert.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Monitoring Actions */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Live Camera Monitoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Monitor active video feeds with YOLOv8 bounding boxes, tracking IDs, and horizontal counting line collision detection.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
            <Link 
              to="/live-camera"
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Video className="w-4 h-4" />
              Open Live Camera Feeds
            </Link>

            <Link 
              to="/prediction"
              className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              View 5-Min ML Traffic Forecast
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
