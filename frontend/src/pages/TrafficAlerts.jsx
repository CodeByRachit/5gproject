import React, { useState } from 'react';
import { useTraffic } from '../context/TrafficContext';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Bell, 
  Clock, 
  CheckCircle2, 
  Filter, 
  Download,
  AlertOctagon,
  BarChart2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

export const TrafficAlerts = () => {
  const { alerts, congestionLevel, trafficScore } = useTraffic();
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Filter alerts by severity
  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter === 'ALL') return true;
    return alert.congestion_level === severityFilter;
  });

  // Calculate severity distribution counts
  const highCount = alerts.filter(a => a.congestion_level === 'HIGH').length;
  const modCount = alerts.filter(a => a.congestion_level === 'MODERATE').length;
  const lowCount = alerts.filter(a => a.congestion_level === 'LOW').length;
  const noDataCount = alerts.filter(a => a.congestion_level === 'NO DATA').length;

  const distributionChartData = [
    { level: 'HIGH', count: highCount, color: '#ef4444' },
    { level: 'MODERATE', count: modCount, color: '#f59e0b' },
    { level: 'LOW', count: lowCount, color: '#10b981' },
    { level: 'NO DATA', count: noDataCount, color: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Traffic Alerts & Incident Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated rate-limited campus traffic alerts with real-time severity classification and historical incident logging
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {['ALL', 'HIGH', 'MODERATE', 'LOW'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSeverityFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                severityFilter === lvl
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Severity Distribution & Policy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Severity Count Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">High Severity</span>
            <span className="text-3xl font-mono font-extrabold text-white mt-1 block">{highCount}</span>
            <span className="text-[10px] text-rose-400/80 mt-1 block">&gt; 15 vehicles detected</span>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Moderate</span>
            <span className="text-3xl font-mono font-extrabold text-white mt-1 block">{modCount}</span>
            <span className="text-[10px] text-amber-400/80 mt-1 block">6–15 vehicles detected</span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Low Flow</span>
            <span className="text-3xl font-mono font-extrabold text-white mt-1 block">{lowCount}</span>
            <span className="text-[10px] text-emerald-400/80 mt-1 block">1–5 vehicles detected</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Alerts</span>
            <span className="text-3xl font-mono font-extrabold text-white mt-1 block">{alerts.length}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Persisted records</span>
          </div>
        </div>

        {/* Severity Chart */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Alert Severity Distribution</h4>
          </div>

          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="level" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distributionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alert Feed Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Alert History Log ({filteredAlerts.length} Events)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Rate-limiting: 60s cooldown or state change
          </span>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No alerts found for the selected severity filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Alert Message</th>
                  <th className="py-2.5 px-3">Objects Count</th>
                  <th className="py-2.5 px-3">Traffic Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredAlerts.map((alert, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        alert.congestion_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        alert.congestion_level === 'MODERATE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        alert.congestion_level === 'LOW' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'bg-slate-700/20 text-slate-400'
                      }`}>
                        {alert.congestion_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{alert.timestamp}</td>
                    <td className="py-2.5 px-3 font-sans text-white font-medium">{alert.alert_message}</td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">{alert.object_count}</td>
                    <td className="py-2.5 px-3 text-amber-400 font-semibold">
                      {Number(alert.traffic_score || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rate-Limiting Policy Information */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1">
        <h4 className="font-semibold text-slate-200">Alert Dispatch & Logging Mechanics</h4>
        <p className="leading-relaxed">
          Alerts are automatically triggered by the backend alert manager whenever congestion changes level (e.g. LOW &rarr; MODERATE) or when the previous alert is older than 60 seconds. This avoids spamming notifications while preserving high-resolution historical telemetry.
        </p>
      </div>
    </div>
  );
};
