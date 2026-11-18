import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TrafficProvider } from './context/TrafficContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';

import { OverviewDashboard } from './pages/OverviewDashboard';
import { LiveCameraMonitoring } from './pages/LiveCameraMonitoring';
import { TrafficAnalytics } from './pages/TrafficAnalytics';
import { CongestionMonitoring } from './pages/CongestionMonitoring';
import { FuturePrediction } from './pages/FuturePrediction';
import { TrafficAlerts } from './pages/TrafficAlerts';
import { CameraManagement } from './pages/CameraManagement';
import { SystemSettings } from './pages/SystemSettings';

export function App() {
  return (
    <TrafficProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Inter',sans-serif]">
          {/* Top Navbar */}
          <Navbar />

          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-950/60">
              <div className="max-w-7xl mx-auto">
                <Routes>
                  <Route path="/" element={<OverviewDashboard />} />
                  <Route path="/live-camera" element={<LiveCameraMonitoring />} />
                  <Route path="/analytics" element={<TrafficAnalytics />} />
                  <Route path="/congestion" element={<CongestionMonitoring />} />
                  <Route path="/prediction" element={<FuturePrediction />} />
                  <Route path="/alerts" element={<TrafficAlerts />} />
                  <Route path="/cameras" element={<CameraManagement />} />
                  <Route path="/settings" element={<SystemSettings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </TrafficProvider>
  );
}

export default App;
