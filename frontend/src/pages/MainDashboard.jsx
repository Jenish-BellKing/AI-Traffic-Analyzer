import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Radio, AlertTriangle, Monitor, Maximize2, Minimize2, CloudSun, Cpu, RefreshCw, ChevronRight, Activity, Clock } from 'lucide-react'

import JunctionMap   from '../components/JunctionMap'
import TrafficSignal from '../components/TrafficSignal'
import DecisionPanel from '../components/DecisionPanel'
import Charts        from '../components/Charts'
import { useTrafficData } from '../hooks/useTrafficData'
import { api }           from '../services/api'

export default function MainDashboard() {
  const { data, connected, history } = useTrafficData()
  const [selectedCam, setSelectedCam] = useState('north')
  const [viewMode, setViewMode] = useState('grid') // 'grid' (Map-centric overview) or 'detail' (CCTV-centric zoom)
  const [sysStatus, setSysStatus] = useState('running')
  const [sysInfo, setSysInfo] = useState(null)
  const [now, setNow] = useState(new Date())

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch status
  const refreshStatus = useCallback(async () => {
    try {
      const res = await api.status()
      setSysStatus(res.data.status)
    } catch {}
  }, [])

  useEffect(() => {
    refreshStatus()
    const t = setInterval(refreshStatus, 5000)
    return () => clearInterval(t)
  }, [refreshStatus])

  // Fetch system info
  useEffect(() => {
    api.health().then(r => setSysInfo(r.data)).catch(() => {})
  }, [])

  // Emergency override status (if ANY camera has an active override)
  const activeOverride = Object.values(data?.cameras || {}).some(
    cam => cam.signal_state?.emergency_override
  )

  const activeCamData = data?.cameras?.[selectedCam] || {
    frame_base64: data?.frame_base64,
    detections: data?.detections || [],
    metrics: data?.metrics || {},
    signal_state: data?.signal_state || {}
  }

  // Handle camera selection
  const handleSelectCam = (camName) => {
    setSelectedCam(camName)
  }

  // Handle zoom transition
  const handleZoomCam = (camName) => {
    setSelectedCam(camName)
    setViewMode('detail')
  }

  // Decision timeline logs
  const timelineLogs = data?.decision_logs || [
    { time: '12:59:12', message: 'Traffic command center initialized.' },
    { time: '12:59:15', message: 'Smart simulation online. 4 cameras reporting telemetry.' }
  ]

  return (
    <div className={`min-h-screen flex flex-col text-text-primary ${activeOverride ? 'emergency-active' : ''}`}
         style={{ background: 'radial-gradient(ellipse at 50% 0%, #080f24 0%, #030611 80%)' }}>
      
      {/* ── Top HUD Navigation Bar ─────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#060a17]/80 backdrop-blur-md sticky top-0 z-50 py-3 px-6">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                 style={{ background: 'linear-gradient(135deg, #00d4ff, #00ff88)' }}>
              <Zap size={18} className="text-dark-900 font-bold" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-white leading-none">
                SmartCity Traffic Control
              </h1>
              <p className="text-[10px] text-neon-blue font-mono uppercase tracking-widest mt-1">
                Junction-791 AI Command Center
              </p>
            </div>
          </div>

          {/* Central System HUD Pills */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-neon-green animate-pulse' : 'bg-neon-red'}`} />
              <span className="text-text-secondary">SYS STATE:</span>
              <span className={connected ? 'text-neon-green' : 'text-neon-red font-bold'}>
                {connected ? 'LIVE_STREAM' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
              <Cpu size={12} className="text-neon-blue" />
              <span className="text-text-secondary">ACCELERATION:</span>
              <span className="text-neon-green">
                {sysInfo?.gpu || 'CPU (MOCK)'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
              <CloudSun size={13} className="text-neon-blue" />
              <span className="text-text-secondary">VISIBILITY:</span>
              <span className="text-neon-green">1.0 (SUNNY)</span>
            </div>
            {activeOverride && (
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [1, 0.6, 1] }}
                transition={{ repeat: Infinity, duration: 1.0 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded border border-red-500/40 bg-red-950/40 text-[11px] font-mono text-red-400 font-bold"
              >
                <AlertTriangle size={12} className="animate-bounce" />
                OVERRIDE DETECTED
              </motion.div>
            )}
          </div>

          {/* Clock HUD */}
          <div className="flex items-center gap-3 font-mono text-right">
            <Radio size={14} className="text-neon-blue animate-pulse" />
            <div>
              <p className="text-sm font-black text-white leading-none">
                {now.toLocaleTimeString('en-GB', { hour12: false })}
              </p>
              <p className="text-[10px] text-text-secondary mt-1">
                {now.toLocaleDateString('en-US', { day:'2-digit', month:'short', year:'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Layout Workspace ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-5 flex flex-col gap-5">
        
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            /* ── OVERVIEW MODE: 70% Map / 30% CCTV Grid ────────────────────────── */
            <motion.div
              key="grid-layout"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-12 gap-5 flex-1"
            >
              {/* Left 70%: Interactive Digital Twin Map */}
              <div className="col-span-12 xl:col-span-8 flex flex-col h-full">
                <JunctionMap
                  data={data}
                  selectedCam={selectedCam}
                  onSelectCam={handleSelectCam}
                  onDoubleClickCam={handleZoomCam}
                />
              </div>

              {/* Right 30%: Live Cameras Grid & Basic Controls */}
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Monitor size={14} className="text-neon-blue" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Camera Monitor Panel</span>
                  </div>
                  <span className="text-[10px] font-mono text-neon-green px-1.5 py-0.5 rounded bg-neon-green/10">4/4 LIVE</span>
                </div>

                {/* 2x2 Grid of CCTV Feeds */}
                <div className="grid grid-cols-2 gap-4">
                  {['north', 'east', 'south', 'west'].map(camKey => {
                    const cam = data?.cameras?.[camKey]
                    const isSelected = selectedCam === camKey
                    const hasEmergency = cam?.signal_state?.emergency_override
                    
                    return (
                      <div
                        key={camKey}
                        onClick={() => handleSelectCam(camKey)}
                        onDoubleClick={() => handleZoomCam(camKey)}
                        className={`glass-card p-2.5 flex flex-col gap-2 cursor-pointer transition-all duration-300 relative overflow-hidden group
                          ${isSelected ? 'border-neon-blue/60 bg-blue-950/10' : 'border-white/5 hover:border-white/20'}`}
                      >
                        {/* Status bar */}
                        <div className="flex justify-between items-center text-[10px] font-mono text-text-secondary">
                          <span className="uppercase font-bold">{camKey} ROAD</span>
                          <span className={`px-1 rounded uppercase ${cam?.signal_state?.phase === 'green' ? 'text-neon-green' : cam?.signal_state?.phase === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>
                            {cam?.signal_state?.phase || 'RED'}
                          </span>
                        </div>

                        {/* Video crop box */}
                        <div className="relative aspect-video bg-dark-900 rounded overflow-hidden">
                          {cam?.frame_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${cam.frame_base64}`}
                              alt={`${camKey} feed`}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-text-secondary font-mono">
                              WAITING STREAM
                            </div>
                          )}
                          
                          {/* HUD elements */}
                          <div className="absolute bottom-1 left-1.5 bg-black/55 text-[8px] font-mono text-text-secondary px-1 py-0.5 rounded">
                            QTY: {cam?.metrics?.vehicle_count?.total || 0}
                          </div>
                          
                          <div className="absolute top-1 right-1">
                            <Maximize2 size={10} className="text-white/40 group-hover:text-white/90" />
                          </div>
                        </div>

                        {/* Indicators indicators */}
                        {hasEmergency && (
                          <div className="absolute inset-0 border border-red-500 bg-red-950/20 pointer-events-none flex items-center justify-center">
                            <span className="text-[10px] font-bold text-red-400 bg-black/80 px-2 py-0.5 rounded">EMERGENCY</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Selected Camera Overview Card */}
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Telemetry snapshots</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="glass-card p-3 flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono uppercase text-text-secondary">Vehicle Flow</span>
                      <span className="text-sm font-bold text-white font-mono">{activeCamData.metrics?.traffic_flow?.vehicles_per_minute || 0} vpm</span>
                    </div>
                    <div className="glass-card p-3 flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono uppercase text-text-secondary">Avg Delay</span>
                      <span className="text-sm font-bold text-neon-blue font-mono">{activeCamData.metrics?.congestion?.average_delay_sec?.toFixed(0) || 0}s</span>
                    </div>
                    <div className="glass-card p-3 flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono uppercase text-text-secondary">Clearance Time</span>
                      <span className="text-sm font-bold text-neon-green font-mono">{activeCamData.metrics?.signal?.estimated_clearance_time?.toFixed(0) || 0}s</span>
                    </div>
                  </div>

                  {/* Mini-decision summary */}
                  <div className="glass-card p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-text-secondary uppercase">Junction {selectedCam.toUpperCase()} metrics</span>
                      <button
                        onClick={() => setViewMode('detail')}
                        className="text-neon-blue flex items-center gap-0.5 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-wider"
                      >
                        Detailed Feed <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-text-secondary">Active Phase</span>
                      <span className={`font-bold uppercase ${activeCamData.signal_state?.phase === 'green' ? 'text-neon-green' : 'text-red-400'}`}>
                        {activeCamData.signal_state?.phase || 'RED'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-text-secondary">Pressure Index</span>
                      <span className="text-white font-bold">{activeCamData.signal_state?.traffic_score?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── DETAIL MODE: 70% CCTV Feed / 30% Stats & Details ───────────────── */
            <motion.div
              key="detail-layout"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-12 gap-5 flex-1"
            >
              {/* Left 70%: CCTV Main Stream */}
              <div className="col-span-12 xl:col-span-8 flex flex-col h-full glass-card overflow-hidden min-h-[500px]">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#060a17]/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1"
                    >
                      <Minimize2 size={11} /> Exit Fullscreen
                    </button>
                    <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary ml-3">
                      CAMERA FEED: {selectedCam.toUpperCase()} APPROACH
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
                    <span className="flex items-center gap-1 font-bold text-neon-green">
                      <Activity size={11} /> 15 FPS
                    </span>
                    <span>RESOLUTION: 640×360</span>
                  </div>
                </div>

                {/* CCTV video feed container */}
                <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
                  <div className="scan-overlay pointer-events-none" />
                  
                  {activeCamData?.frame_base64 ? (
                    <img
                      src={`data:image/jpeg;base64,${activeCamData.frame_base64}`}
                      alt="CCTV stream"
                      className="w-full h-full object-contain max-h-[580px]"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 font-mono text-text-secondary">
                      <RefreshCw className="animate-spin text-neon-blue" size={24} />
                      Loading Stream...
                    </div>
                  )}

                  {/* Overlay indicators */}
                  <div className="absolute top-4 left-4 bg-black/75 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono flex flex-col gap-0.5 shadow-2xl">
                    <span className="text-neon-blue font-bold">CAM_{selectedCam.toUpperCase()}_01</span>
                    <span className="text-[10px] text-text-secondary">FLOW: {activeCamData.metrics?.traffic_flow?.vehicles_per_minute || 0} v/min</span>
                  </div>
                  
                  {activeCamData.signal_state?.emergency_override && (
                    <div className="absolute inset-0 border-2 border-red-500 pointer-events-none emergency-active">
                      <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold font-mono px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-2xl">
                        <span className="animate-ping w-2 h-2 rounded-full bg-white" />
                        EMERGENCY PRIORITY GREEN
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 30%: Stats & Decision breakdown panels */}
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Traffic Light */}
                  <div className="col-span-1">
                    <TrafficSignal signalState={activeCamData.signal_state} />
                  </div>
                  {/* AI Decision Math */}
                  <div className="col-span-1">
                    <DecisionPanel signalState={activeCamData.signal_state} metrics={activeCamData.metrics} />
                  </div>
                </div>

                {/* History Analytics chart summary */}
                <div className="flex-1 flex flex-col justify-end">
                  <Charts history={history} data={activeCamData} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom Panel: AI Command Decision Log Stream ──────────────────── */}
        <div className="glass-card p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
            <Clock size={12} className="text-neon-blue" />
            <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">AI Decision Log stream</span>
            <span className="ml-auto text-[10px] font-mono text-neon-blue animate-pulse">Telemetry Connected</span>
          </div>

          <div className="h-28 overflow-y-auto font-mono text-[11px] flex flex-col gap-1.5 pr-2 custom-scrollbar">
            {timelineLogs.map((log, idx) => (
              <div key={idx} className="flex gap-3 hover:bg-white/3 py-0.5 px-1.5 rounded transition-colors">
                <span className="text-neon-blue shrink-0">[{log.time}]</span>
                <span className="text-text-secondary shrink-0">&bull;</span>
                <span className="text-text-primary">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ── High Tech HUD Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#030611]/90 py-3 text-center text-[10px] text-text-secondary font-mono uppercase tracking-wider">
        Smart City Traffic Command &bull; NVIDIA Omniverse &amp; YOLOv8 Driven &bull; WebSocket Live Sync v2.5.0
      </footer>
    </div>
  )
}
