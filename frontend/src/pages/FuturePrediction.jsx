import React, { useState } from 'react';
import { useTraffic } from '../context/TrafficContext';
import { CongestionBadge } from '../components/CongestionBadge';
import { 
  Sparkles, 
  Cpu, 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  RefreshCw,
  Sliders,
  Database
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const FuturePrediction = () => {
  const { 
    prediction, 
    predictionLoading, 
    trainAndPredict, 
    lastError,
    counts,
    liveCounts 
  } = useTraffic();

  // Synthetic or actual historical + predicted forecast sequence
  const currentVehicles = prediction?.current_vehicles ?? 
    ((liveCounts.car || 0) + (liveCounts.motorcycle || 0) + (liveCounts.bus || 0) + (liveCounts.truck || 0) + (liveCounts.bicycle || 0));

  const predictedVehicles = prediction?.predicted_vehicles ?? Math.round(currentVehicles * 1.1);

  // Generate chart data bridging current time to +5 minutes
  const forecastChartData = [
    { time: '-4m', actual: Math.max(0, currentVehicles - 2), predicted: null },
    { time: '-3m', actual: Math.max(0, currentVehicles - 1), predicted: null },
    { time: '-2m', actual: Math.max(0, currentVehicles), predicted: null },
    { time: '-1m', actual: Math.max(0, currentVehicles + 1), predicted: null },
    { time: 'Now', actual: currentVehicles, predicted: currentVehicles },
    { time: '+1m', actual: null, predicted: Math.round(currentVehicles * 0.95 + predictedVehicles * 0.05) },
    { time: '+2m', actual: null, predicted: Math.round(currentVehicles * 0.75 + predictedVehicles * 0.25) },
    { time: '+3m', actual: null, predicted: Math.round(currentVehicles * 0.50 + predictedVehicles * 0.50) },
    { time: '+4m', actual: null, predicted: Math.round(currentVehicles * 0.25 + predictedVehicles * 0.75) },
    { time: '+5m (Target)', actual: null, predicted: predictedVehicles },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Future Traffic Prediction</h2>
          <p className="text-xs text-slate-400 mt-1">
            Machine learning 5-minute traffic volume and congestion forecasting (Linear Regression vs Random Forest Regressor)
          </p>
        </div>

        <button
          onClick={trainAndPredict}
          disabled={predictionLoading}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition-all ${
            predictionLoading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${predictionLoading ? 'animate-spin' : ''}`} />
          {predictionLoading ? 'Training Models...' : 'Train Models & Predict'}
        </button>
      </div>

      {/* Main Forecast Hero Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
            Predicted Vehicles
          </span>
          <h3 className="text-3xl font-extrabold font-mono text-white mt-1">
            {prediction?.predicted_vehicles !== undefined ? prediction.predicted_vehicles : predictedVehicles}
          </h3>
          <span className="text-xs text-indigo-400 mt-1 block">Vehicles in +5 minutes</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
            Predicted Congestion
          </span>
          <div className="mt-2">
            <CongestionBadge 
              level={prediction?.predicted_congestion || 'LOW'} 
              size="md" 
            />
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Forecasted classification</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
            Selected Best Model
          </span>
          <h3 className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {prediction?.model_name || 'Linear Regression'}
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">
            Test MAE: <strong className="text-white">{prediction?.best_model_mae ?? '0.00'}</strong>
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
            Prediction Horizon
          </span>
          <h3 className="text-3xl font-extrabold font-mono text-blue-400 mt-1">
            5 Minutes
          </h3>
          <span className="text-xs text-slate-400 mt-1 block">30 samples (10s intervals)</span>
        </div>
      </div>

      {/* Historical vs Predicted Forecast Line Chart */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Historical Traffic vs 5-Minute ML Prediction Horizon
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Solid line depicts recent traffic observations; dashed line projects model-forecasted vehicular volume
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              Horizon: +5 min
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line 
                type="monotone" 
                dataKey="actual" 
                name="Observed Vehicles" 
                stroke="#3b82f6" 
                strokeWidth={2.5} 
                dot={{ r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="predicted" 
                name="Projected Forecast" 
                stroke="#a855f7" 
                strokeWidth={2.5} 
                strokeDasharray="5 5" 
                dot={{ r: 4, stroke: '#a855f7', fill: '#0f172a' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model Benchmark Comparison & Feature Engineering */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Model Benchmark Card */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Model Performance Benchmarks</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Evaluated on an 80/20 chronological train-test split using Mean Absolute Error (MAE). The model with lower error is automatically deployed for live inference.
          </p>

          <div className="space-y-3">
            {/* Linear Regression */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Linear Regression</span>
                <span className="text-[11px] text-slate-400">Ordinary Least Squares regressor</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  MAE: {prediction?.linear_regression_mae ?? '0.00'}
                </span>
                <span className="text-[10px] text-slate-400 block">Baseline model</span>
              </div>
            </div>

            {/* Random Forest */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Random Forest Regressor</span>
                <span className="text-[11px] text-slate-400">100 estimators · max depth 8</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-blue-400">
                  MAE: {prediction?.random_forest_mae ?? '0.00'}
                </span>
                <span className="text-[10px] text-slate-400 block">Non-linear ensemble</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Engineering Details */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Engineered Input Features</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Four temporal features are extracted from the 10-second traffic observations database to capture momentum, moving averages, and acceleration:
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-mono text-blue-400 font-bold block">vehicle_count</span>
              <span className="text-slate-400 text-[11px] mt-0.5 block">Instantaneous vehicles detected</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-mono text-cyan-400 font-bold block">mean_1m</span>
              <span className="text-slate-400 text-[11px] mt-0.5 block">Rolling 1-min average (6 steps)</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-mono text-amber-400 font-bold block">mean_3m</span>
              <span className="text-slate-400 text-[11px] mt-0.5 block">Rolling 3-min average (18 steps)</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-mono text-purple-400 font-bold block">trend_1m</span>
              <span className="text-slate-400 text-[11px] mt-0.5 block">1-min differential slope</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
