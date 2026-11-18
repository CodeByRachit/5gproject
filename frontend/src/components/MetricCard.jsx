import React from 'react';

export const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = 'blue', 
  trend = null,
  onClick
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      ring: 'group-hover:border-blue-500/40',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      ring: 'group-hover:border-emerald-500/40',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      ring: 'group-hover:border-amber-500/40',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      text: 'text-rose-400',
      ring: 'group-hover:border-rose-500/40',
    },
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      ring: 'group-hover:border-purple-500/40',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      text: 'text-cyan-400',
      ring: 'group-hover:border-cyan-500/40',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div 
      onClick={onClick}
      className={`group relative p-5 rounded-2xl bg-slate-900/90 border border-slate-800 transition-all duration-200 hover:shadow-xl hover:shadow-slate-950/50 ${scheme.ring} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">{title}</p>
          <h3 className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.bg} ${scheme.border} border ${scheme.text} shadow-inner`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400">{trend.label}</span>
          <span className={`font-semibold font-mono ${trend.positive ? 'text-emerald-400' : 'text-slate-400'}`}>
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
};
