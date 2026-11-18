import React, { useState, useEffect } from 'react';
import { useTraffic, VEHICLE_CLASSES } from '../context/TrafficContext';
import { apiService } from '../api/apiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  LineChart, 
  Line, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  Calendar, 
  Filter, 
  Download,
  Users,
  Car
} from 'lucide-react';

export const TrafficAnalytics = () => {
  const { counts, liveCounts, totalCrossings, incomingCount, outgoingCount } = useTraffic();

  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');

  // Load Historical Observations from MongoDB / Backend with auto-refresh
  useEffect(() => {
    const fetchHistory = (initial = false) => {
      if (initial) setLoadingHistory(true);
      apiService.getTrafficHistory(150)
        .then((res) => {
          if (res?.data) {
            setHistoryData(res.data);
          }
        })
        .catch((err) => {
          console.warn('Failed to load traffic history:', err.message);
        })
        .finally(() => {
          if (initial) setLoadingHistory(false);
        });
    };

    fetchHistory(true);
    const interval = setInterval(() => fetchHistory(false), 8000); // Poll every 8s for live database updates
    return () => clearInterval(interval);
  }, []);

  // Category Distribution Data for Pie Chart (Vehicles only)
  const vehicleClasses = VEHICLE_CLASSES.filter(c => c.key !== 'person');
  const pieData = vehicleClasses.map(v => ({
    name: v.label,
    value: counts[v.key] || 0,
    color: v.color,
  })).filter(item => item.value > 0);

  // Fallback pie data if no crossings yet so chart renders nicely
  const displayPieData = pieData.length > 0 ? pieData : vehicleClasses.map(v => ({
    name: v.label,
    value: 1,
    color: v.color,
  }));

  // Bar chart data for crossing vs live frame presence
  const comparisonData = VEHICLE_CLASSES.map(v => ({
    category: v.label,
    crossings: counts[v.key] || 0,
    inFrame: liveCounts[v.key] || 0,
  }));

  // Hourly / Timestamped Trend Data formatted from historical observations
  const timelineData = historyData.slice(-30).map((row) => ({
    time: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    vehicles: row.vehicle_count || 0,
    score: row.congestion_score || 0,
    cars: row.cars || 0,
    motorcycles: row.motorcycles || 0,
    buses: row.buses || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Traffic Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">
            Category distribution, pedestrian statistics, cumulative flow and historical trend analysis
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="all">All Available Records</option>
            <option value="1h">Last 1 Hour</option>
            <option value="24h">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Top Analytics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase font-semibold">Vehicle Line Crossings</p>
          <h3 className="text-2xl font-extrabold font-mono text-white mt-1">{totalCrossings}</h3>
          <p className="text-[11px] text-emerald-400 mt-1">Vehicle Flow: IN {incomingCount} · OUT {outgoingCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase font-semibold">Total Vehicle Crossings</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            {(counts.car || 0) + (counts.motorcycle || 0) + (counts.bus || 0) + (counts.truck || 0) + (counts.bicycle || 0)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Excludes pedestrian counts</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase font-semibold">Pedestrian Crossings</p>
          <h3 className="text-2xl font-extrabold font-mono text-purple-400 mt-1">{counts.person || 0}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Separately tracked mobility metric</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase font-semibold">Database Samples</p>
          <h3 className="text-2xl font-extrabold font-mono text-amber-400 mt-1">{historyData.length}</h3>
          <p className="text-[11px] text-slate-400 mt-1">10-second interval observations</p>
        </div>
      </div>

      {/* Charts Grid: Vehicle Category Distribution & Cumulative Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pie Chart: Vehicle Category Share */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PieIcon className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Vehicle Class Distribution</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Proportion of vehicle types detected crossing campus checkpoints</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {displayPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend row */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
            {vehicleClasses.map((v) => (
              <div key={v.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                  <span className="text-slate-300">{v.label}</span>
                </div>
                <span className="font-mono font-bold text-white">{counts[v.key] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart: Crossings vs In Frame Presence */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cumulative Crossings vs Current Frame</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Comparison of cumulative crossings with objects detected right now</p>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="category" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="crossings" name="Total Crossings" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="inFrame" name="Currently in Frame" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Historical Observations Line Chart */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Historical Traffic Congestion Timeline</h3>
            </div>
            <p className="text-xs text-slate-400">Time-series vehicle counts & weighted congestion score progression</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">10s Intervals</span>
        </div>

        <div className="h-64 w-full">
          {timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              {loadingHistory ? 'Loading traffic observations...' : 'No historical data recorded yet.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="vehicles" name="Vehicle Count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="score" name="Congestion Score" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="cars" name="Cars" stroke="#10b981" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Traffic History Log (MongoDB Persistence)</h3>
          <span className="text-xs text-slate-400 font-mono">Showing last {historyData.slice(0, 15).length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Total Vehicles</th>
                <th className="py-2.5 px-3">Cars</th>
                <th className="py-2.5 px-3">Motorcycles</th>
                <th className="py-2.5 px-3">Buses</th>
                <th className="py-2.5 px-3">Trucks</th>
                <th className="py-2.5 px-3">Bicycles</th>
                <th className="py-2.5 px-3">Congestion Score</th>
                <th className="py-2.5 px-3">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {historyData.slice(0, 15).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 text-slate-300">{row.timestamp}</td>
                  <td className="py-2 px-3 font-bold text-white">{row.vehicle_count}</td>
                  <td className="py-2 px-3 text-blue-400">{row.cars || 0}</td>
                  <td className="py-2 px-3 text-cyan-400">{row.motorcycles || 0}</td>
                  <td className="py-2 px-3 text-amber-400">{row.buses || 0}</td>
                  <td className="py-2 px-3 text-rose-400">{row.trucks || 0}</td>
                  <td className="py-2 px-3 text-emerald-400">{row.bicycles || 0}</td>
                  <td className="py-2 px-3 font-semibold text-slate-200">
                    {Number(row.congestion_score || 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.congestion_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400' :
                      row.congestion_level === 'MODERATE' ? 'bg-amber-500/20 text-amber-400' :
                      row.congestion_level === 'LOW' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-slate-700/20 text-slate-400'
                    }`}>
                      {row.congestion_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
