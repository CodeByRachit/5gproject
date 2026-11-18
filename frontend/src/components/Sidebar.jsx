import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  BarChart3, 
  Gauge, 
  Sparkles, 
  AlertTriangle, 
  Camera, 
  Settings,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';

export const Sidebar = () => {
  const { alerts } = useTraffic();
  const unreadAlerts = alerts.filter(a => a.congestion_level === 'HIGH' || a.congestion_level === 'MODERATE').length;

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/live-camera', label: 'Live Camera', icon: Video, badge: 'Live' },
    { to: '/analytics', label: 'Traffic Analytics', icon: BarChart3 },
    { to: '/congestion', label: 'Congestion Monitor', icon: Gauge },
    { to: '/prediction', label: 'Traffic Prediction', icon: Sparkles, badge: 'ML' },
    { to: '/alerts', label: 'Traffic Alerts', icon: AlertTriangle, count: unreadAlerts },
    { to: '/cameras', label: 'Camera Manager', icon: Camera },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
      <div className="py-6 px-4">
        {/* Navigation Category Label */}
        <div className="px-3 mb-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Intelligent Transport
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {item.badge}
                  </span>
                )}

                {item.count > 0 && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
                    {item.count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Footer info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-300">YOLOv8 + ByteTrack</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Real-time deep learning edge vision with virtual line collision counting.
          </p>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Model: yolov8n.onnx (640px)
          </div>
        </div>
      </div>
    </aside>
  );
};
