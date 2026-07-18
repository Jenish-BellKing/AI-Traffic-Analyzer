import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity, ShieldAlert, Monitor, Sparkles, AlertOctagon, Eye, Clock,
  Cpu, Heart, Wifi, ThermometerSun, BarChart3, Gauge, Users
} from 'lucide-react'

import JunctionMap from '../components/JunctionMap'

export default function MonitoringLayer({ data, connected }) {
  const navigate = useNavigate()
  const [highlightedCam, setHighlightedCam] = useState(null)

  const camerasList = ['north', 'south', 'east', 'west']
  const camerasData = data?.cameras || {}

  // Aggregate stats
  let totalVehicles = 0, totalCongestion = 0, totalPressure = 0, emergencyCount = 0
  camerasList.forEach(camKey => {
    const cam = camerasData[camKey] || {}
    totalVehicles += cam.metrics?.vehicle_count?.total || 0
    totalCongestion += cam.metrics?.congestion?.congestion_index || 0
    totalPressure += cam.signal_state?.traffic_score || 0
    if (cam.signal_state?.emergency_override) emergencyCount++
  })
  const avgCongestion = ((totalCongestion / 4) * 100).toFixed(0)
  const avgPressure = (totalPressure / 4).toFixed(2)
  const avgVehicles = (totalVehicles / 4).toFixed(1)

  let junctionStatus = 'OPTIMAL'
  let statusColor = 'text-neon-green'
  if (emergencyCount > 0) { junctionStatus = 'EMERGENCY'; statusColor = 'text-neon-red animate-pulse' }
  else if (parseFloat(avgCongestion) > 60) { junctionStatus = 'CONGESTED'; statusColor = 'text-orange-400' }
  else if (parseFloat(avgCongestion) > 30) { junctionStatus = 'MODERATE'; statusColor = 'text-neon-yellow' }

  const handleSelectCam = (camKey) => setHighlightedCam(camKey)
  const handleDoubleClickCam = (camKey) => navigate(`/analysis/${camKey}`)

  const recentEvents = data?.decision_logs || [
    { time: '--:--:--', message: 'Waiting for AI Decision Engine...' }
  ]

  return (
    <div className="flex-1 max-w-[1920px] w-full mx-auto px-4 py-4 flex flex-col gap-4">
      {/* ── Three-Panel Layout ─────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">

        {/* ═══ LEFT PANEL (25%): System Overview ═══ */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-3">
          <div className="glass-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Sparkles size={14} className="text-neon-blue" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">System Overview</span>
            </div>

            {/* Overall status */}
            <div className="flex justify-between items-center p-2.5 rounded bg-white/3 border border-white/5">
              <span className="text-[10px] text-text-secondary uppercase">Junction Status</span>
              <span className={`text-[11px] font-mono font-bold uppercase ${statusColor}`}>{junctionStatus}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded bg-white/2 border border-white/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase text-text-secondary flex items-center gap-1"><Wifi size={8}/>Cameras</span>
                <span className="text-lg font-bold font-mono text-neon-green">4/4</span>
              </div>
              <div className="p-2.5 rounded bg-white/2 border border-white/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase text-text-secondary flex items-center gap-1"><Cpu size={8}/>AI Model</span>
                <span className="text-[11px] font-bold font-mono text-neon-blue mt-1">YOLO v26</span>
              </div>
              <div className="p-2.5 rounded bg-white/2 border border-white/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase text-text-secondary flex items-center gap-1"><Gauge size={8}/>Avg Congestion</span>
                <span className="text-lg font-bold font-mono text-neon-yellow">{avgCongestion}%</span>
              </div>
              <div className="p-2.5 rounded bg-white/2 border border-white/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase text-text-secondary flex items-center gap-1"><BarChart3 size={8}/>Avg Pressure</span>
                <span className="text-lg font-bold font-mono text-neon-blue">{avgPressure}</span>
              </div>
              <div className="p-2.5 rounded bg-white/2 border border-white/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase text-text-secondary flex items-center gap-1"><Users size={8}/>Avg Vehicles</span>
                <span className="text-lg font-bold font-mono text-neon-green">{avgVehicles}</span>
              </div>
              <div className="p-2.5 rounded bg-white/2 border border-white/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase text-text-secondary flex items-center gap-1"><ThermometerSun size={8}/>Weather</span>
                <span className="text-[11px] font-bold font-mono text-white mt-1">SUNNY</span>
              </div>
            </div>

            {/* AI Status */}
            <div className="flex justify-between items-center p-2.5 rounded bg-white/3 border border-white/5">
              <span className="text-[10px] text-text-secondary uppercase">AI Status</span>
              <span className="text-[10px] font-mono font-bold text-neon-green flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                ACTIVE
              </span>
            </div>

            {/* System Health */}
            <div className="flex justify-between items-center p-2.5 rounded bg-white/3 border border-white/5">
              <span className="text-[10px] text-text-secondary uppercase">Backend</span>
              <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${connected ? 'text-neon-green' : 'text-neon-red'}`}>
                <Heart size={9} />
                {connected ? 'WS_CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            {/* Emergency Alerts */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-mono uppercase text-text-secondary">Emergency Alerts</span>
              {emergencyCount > 0 ? (
                <div className="p-2.5 rounded bg-red-950/20 border border-red-500/40 text-[10px] text-red-400 font-mono flex items-center gap-2 animate-pulse">
                  <ShieldAlert size={12} className="shrink-0" />
                  <span>{emergencyCount} ACTIVE OVERRIDE{emergencyCount > 1 ? 'S' : ''}</span>
                </div>
              ) : (
                <div className="p-2 rounded bg-white/3 border border-white/5 text-[9px] text-text-secondary font-mono italic text-center">
                  No active alerts.
                </div>
              )}
            </div>
          </div>

          {/* Recent Events */}
          <div className="glass-card p-4 flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Clock size={12} className="text-neon-blue" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">Recent Events</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[250px] font-mono text-[9px] flex flex-col gap-1.5 pr-1 custom-scrollbar">
              {recentEvents.map((log, idx) => (
                <div key={idx} className="flex gap-2 hover:bg-white/3 py-0.5 px-1 rounded transition-colors">
                  <span className="text-neon-blue shrink-0">[{log.time}]</span>
                  <span className="text-text-primary">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ CENTER PANEL (50%): Interactive Digital Twin Map ═══ */}
        <div className="col-span-12 xl:col-span-6 flex flex-col h-full min-h-[500px]">
          <JunctionMap
            data={data}
            selectedCam={highlightedCam || 'north'}
            onSelectCam={handleSelectCam}
            onDoubleClickCam={handleDoubleClickCam}
          />
        </div>

        {/* ═══ RIGHT PANEL (25%): 2×2 Live CCTV Monitoring Wall ═══ */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 px-1">
            <div className="flex items-center gap-1.5">
              <Monitor size={12} className="text-neon-blue" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">CCTV Wall</span>
            </div>
            <span className="text-[9px] font-mono text-neon-green px-1.5 py-0.5 rounded bg-neon-green/10">4/4 LIVE</span>
          </div>

          {/* 2x2 Camera Grid */}
          <div className="grid grid-cols-2 gap-2.5 flex-1">
            {camerasList.map((camKey) => {
              const cam = camerasData[camKey] || {}
              const isHighlighted = highlightedCam === camKey
              const signalPhase = cam.signal_state?.phase || 'red'
              const isEmergency = cam.signal_state?.emergency_override || false

              return (
                <motion.div
                  key={camKey}
                  onClick={() => handleSelectCam(camKey)}
                  onDoubleClick={() => handleDoubleClickCam(camKey)}
                  onMouseEnter={() => setHighlightedCam(camKey)}
                  className={`glass-card p-2 flex flex-col gap-1.5 cursor-pointer transition-all duration-300 relative overflow-hidden group
                    ${isHighlighted ? 'border-neon-blue/60 shadow-[0_0_12px_rgba(0,212,255,0.12)] bg-blue-950/10' : 'border-white/5 hover:border-white/20'}`}
                  whileHover={{ scale: 1.01 }}
                >
                  {/* Camera Header */}
                  <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary">
                    <span className="font-bold tracking-wider text-white">{camKey.toUpperCase()}</span>
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-neon-green animate-pulse' : 'bg-neon-red'}`} />
                    </div>
                  </div>

                  {/* Video Container */}
                  <div className="relative aspect-video bg-dark-900 rounded overflow-hidden flex items-center justify-center">
                    <div className="scan-overlay pointer-events-none" />
                    {cam.frame_base64 ? (
                      <img
                        src={`data:image/jpeg;base64,${cam.frame_base64}`}
                        alt={`${camKey} CCTV`}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[9px] text-text-secondary font-mono">
                        <span className="w-1.5 h-1.5 rounded bg-neon-blue animate-ping" />
                        AWAITING FEED
                      </div>
                    )}

                    {/* Signal + Countdown overlay */}
                    <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/75 border border-white/10 px-1.5 py-0.5 rounded font-mono">
                      <span className={`w-2 h-2 rounded-full shadow-[0_0_5px_currentcolor] ${
                        signalPhase === 'green' ? 'bg-neon-green text-neon-green' : signalPhase === 'yellow' ? 'bg-yellow-400 text-yellow-400' : 'bg-neon-red text-neon-red'
                      }`} />
                      <span className="text-white text-[9px] font-bold">{cam.signal_state?.countdown?.toFixed(0) || '0'}s</span>
                    </div>

                    {/* Vehicle count overlay */}
                    <div className="absolute bottom-1 left-1 bg-black/65 px-1.5 py-0.5 rounded text-[8px] font-mono text-text-secondary">
                      {cam.metrics?.vehicle_count?.total || 0} vehicles
                    </div>

                    {/* Emergency flash */}
                    {isEmergency && (
                      <div className="absolute inset-0 border border-red-500 bg-red-950/20 pointer-events-none flex items-center justify-center animate-pulse">
                        <div className="bg-black/80 px-2 py-0.5 rounded text-[8px] font-bold text-red-500 uppercase flex items-center gap-1">
                          <AlertOctagon size={9} /> EMERGENCY
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick stats row */}
                  <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
                    <div className="flex flex-col">
                      <span className="text-text-secondary">Pressure</span>
                      <span className="font-bold text-neon-blue">{cam.signal_state?.traffic_score?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-text-secondary">Congestion</span>
                      <span className="font-bold text-white">{((cam.metrics?.congestion?.congestion_index || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[#030611]/75 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 pointer-events-none">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Eye size={14} className="text-neon-blue" />
                      <span className="text-[9px] font-mono tracking-wider font-bold text-white uppercase">Double Click to Analyze</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
