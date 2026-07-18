import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav'
import MonitoringLayer from './pages/MonitoringLayer'
import AnalysisLayer from './pages/AnalysisLayer'
import ControlLayer from './pages/ControlLayer'
import { useTrafficData } from './hooks/useTrafficData'
import { api } from './services/api'

export default function App() {
  const { data, connected, history } = useTrafficData()
  const [sysInfo, setSysInfo] = useState(null)

  // Fetch system info
  useEffect(() => {
    api.health().then(r => setSysInfo(r.data)).catch(() => {})
  }, [])

  // Emergency override status (if ANY camera has an active override)
  const activeOverride = Object.values(data?.cameras || {}).some(
    cam => cam.signal_state?.emergency_override
  )

  return (
    <Router>
      <div className={`min-h-screen flex flex-col text-text-primary ${activeOverride ? 'emergency-active' : ''}`}
           style={{ background: 'radial-gradient(ellipse at 50% 0%, #080f24 0%, #030611 80%)' }}>
        
        <TopNav connected={connected} sysInfo={sysInfo} activeOverride={activeOverride} />
        
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<MonitoringLayer data={data} connected={connected} />} />
            <Route path="/analysis/:id" element={<AnalysisLayer data={data} history={history} />} />
            <Route path="/control" element={<ControlLayer data={data} />} />
          </Routes>
        </main>

        {/* High Tech HUD Footer */}
        <footer className="border-t border-white/5 bg-[#030611]/90 py-3 text-center text-[10px] text-text-secondary font-mono uppercase tracking-wider">
          Smart City Traffic Command &bull; NVIDIA Omniverse &amp; YOLO v26 Driven &bull; WebSocket Live Sync v3.0.0
        </footer>
      </div>
    </Router>
  )
}
