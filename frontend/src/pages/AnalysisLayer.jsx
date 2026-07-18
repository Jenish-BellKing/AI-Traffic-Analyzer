import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Activity, ThermometerSun, AlertOctagon, Zap, ShieldAlert, Cpu } from 'lucide-react'

import TrafficSignal from '../components/TrafficSignal'
import DecisionPanel from '../components/DecisionPanel'
import Charts        from '../components/Charts'

export default function AnalysisLayer({ data, history }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentCam = id || 'north'

  const camerasList = ['north', 'south', 'east', 'west']
  const camerasData = data?.cameras || {}
  const activeCamData = camerasData[currentCam] || {
    frame_base64: data?.frame_base64,
    detections: data?.detections || [],
    metrics: data?.metrics || {},
    signal_state: data?.signal_state || {}
  }

  const handleSelectCam = (camKey) => {
    navigate(`/analysis/${camKey}`)
  }

  const metrics = activeCamData.metrics || {}
  const signal = activeCamData.signal_state || {}

  return (
    <div className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-5 flex flex-col gap-5">
      {/* Navigation & Selection bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1"
          >
            <ChevronLeft size={12} /> BACK TO MONITORING
          </button>
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            AI Investigation Console: {currentCam.toUpperCase()} APPROACH
          </span>
        </div>

        {/* Camera quick switcher */}
        <div className="flex gap-2">
          {camerasList.map(c => (
            <button
              key={c}
              onClick={() => handleSelectCam(c)}
              className={`px-3 py-1 rounded text-xs font-mono tracking-wider transition-colors ${
                currentCam === c
                  ? 'bg-neon-blue/20 text-neon-blue font-bold border border-neon-blue/30'
                  : 'text-text-secondary bg-white/3 border border-white/5 hover:text-white'
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Analysis grid */}
      <div className="grid grid-cols-12 gap-5 flex-1">
        {/* Left Side: Large Live Video Feed (70%) */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-4">
          <div className="glass-card overflow-hidden flex flex-col flex-1 min-h-[500px]">
            {/* HUD Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#060a17]/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                  Live YOLO v26 Detection Stream
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
                <span className="flex items-center gap-1 font-bold text-neon-green">
                  <Activity size={11} /> 15 FPS
                </span>
                <span>RESOLUTION: 640×360</span>
                <span>MODE: REAL-TIME INFERENCE</span>
              </div>
            </div>

            {/* Video container */}
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
              <div className="scan-overlay pointer-events-none" />
              {activeCamData?.frame_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${activeCamData.frame_base64}`}
                  alt="CCTV stream"
                  className="w-full h-full object-contain max-h-[550px]"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 font-mono text-text-secondary">
                  <span className="w-2 h-2 rounded bg-neon-blue animate-ping mb-2" />
                  CONNECTING LIVE CCTV FEED...
                </div>
              )}

              {signal.emergency_override && (
                <div className="absolute inset-0 border-2 border-red-500 pointer-events-none emergency-active">
                  <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold font-mono px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-2xl">
                    <ShieldAlert size={14} className="animate-pulse" />
                    EMERGENCY OVERRIDE DETECTED
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historical charts panel */}
          <div className="flex flex-col justify-end">
            <Charts history={history} data={activeCamData} />
          </div>
        </div>

        {/* Right Side: Investigation telemetry panel (30%) */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <TrafficSignal signalState={signal} />
            <DecisionPanel signalState={signal} metrics={metrics} />
          </div>

          {/* Metric list cards */}
          <div className="glass-card p-5 flex flex-col gap-4 flex-1">
            <div className="border-b border-white/5 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                Vehicle Classification
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex justify-between items-center p-2 rounded bg-white/2 border border-white/5">
                <span className="text-text-secondary">Cars</span>
                <span className="font-bold text-white">{metrics.vehicle_count?.cars || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-white/2 border border-white/5">
                <span className="text-text-secondary">Motorcycles</span>
                <span className="font-bold text-neon-blue">{metrics.vehicle_count?.bikes || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-white/2 border border-white/5">
                <span className="text-text-secondary">Buses</span>
                <span className="font-bold text-orange-400">{metrics.vehicle_count?.buses || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-white/2 border border-white/5">
                <span className="text-text-secondary">Trucks</span>
                <span className="font-bold text-neon-yellow">{metrics.vehicle_count?.trucks || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-white/2 border border-white/5">
                <span className="text-text-secondary">Bicycles</span>
                <span className="font-bold text-neon-green">{metrics.vehicle_count?.autos || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-white/2 border border-white/5">
                <span className="text-text-secondary">Emergency</span>
                <span className="font-bold text-neon-red">{metrics.vehicle_count?.emergency_vehicles || 0}</span>
              </div>
            </div>

            <div className="border-b border-white/5 pb-2 mt-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                Approach Telemetry
              </h3>
            </div>

            <div className="flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-secondary">Average / Max Speed</span>
                <span className="text-white font-bold">
                  {metrics.vehicle_speed?.average_kmh?.toFixed(1) || 0} / {metrics.vehicle_speed?.max_kmh?.toFixed(1) || 0} km/h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Queue Length / Occupancy</span>
                <span className="text-white font-bold">
                  {metrics.lane_density?.max_queue_length?.toFixed(0) || 0}m / {((metrics.lane_density?.lane_occupancy_pct?.[0] || 0)).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Stopped / Moving Count</span>
                <span className="text-white font-bold">
                  {metrics.vehicle_speed?.stopped_count || 0} / {metrics.vehicle_speed?.moving_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Congestion Index</span>
                <span className="text-neon-yellow font-bold">
                  {((metrics.congestion?.congestion_index || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Est. Clearance Time</span>
                <span className="text-neon-green font-bold">
                  {metrics.signal?.estimated_clearance_time?.toFixed(0) || 0}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Weather / Visibility</span>
                <span className="text-white font-bold">SUNNY / 1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
