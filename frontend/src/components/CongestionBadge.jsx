import React from 'react';

export const CongestionBadge = ({ level, size = 'md', showDescription = false }) => {
  const configs = {
    HIGH: {
      label: 'HIGH CONGESTION',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      dot: 'bg-rose-500',
      pulse: true,
      description: 'Heavy traffic detected. Immediate attention recommended.',
    },
    MODERATE: {
      label: 'MODERATE CONGESTION',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-500',
      pulse: false,
      description: 'Traffic density is increasing. Flow is steady but heavy.',
    },
    LOW: {
      label: 'LOW CONGESTION',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
      pulse: false,
      description: 'Traffic is flowing smoothly across monitored campus checkpoints.',
    },
    'NO DATA': {
      label: 'NO DATA',
      bg: 'bg-slate-800/50',
      border: 'border-slate-700/60',
      text: 'text-slate-400',
      dot: 'bg-slate-500',
      pulse: false,
      description: 'No active vehicles detected in view. Waiting for camera input.',
    },
  };

  const config = configs[level] || configs['NO DATA'];

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  return (
    <div className="flex flex-col">
      <div className={`inline-flex items-center gap-2 rounded-full border font-semibold tracking-wide w-fit ${config.bg} ${config.border} ${config.text} ${sizeStyles[size]}`}>
        <span className={`w-2 h-2 rounded-full ${config.dot} ${config.pulse ? 'animate-ping' : ''}`} />
        <span>{config.label}</span>
      </div>

      {showDescription && (
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          {config.description}
        </p>
      )}
    </div>
  );
};
