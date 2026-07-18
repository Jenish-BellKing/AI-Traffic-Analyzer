import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Info, Cpu, Zap, Settings, ShieldAlert, Sparkles, Scale } from 'lucide-react'

export default function ControlLayer({ data }) {
  const navigate = useNavigate()
  const camerasList = ['north', 'south', 'east', 'west']
  const camerasData = data?.cameras || {}

  // Find active green approach
  const activeGreenApproach = camerasList.find(
    cam => camerasData[cam]?.signal_state?.phase === 'green'
  ) || 'north'

  const activeCamData = camerasData[activeGreenApproach] || {}
  const signal = activeCamData.signal_state || {}
  const metrics = activeCamData.metrics || {}

  // Reasoning breakdown values for active
  const activeScore = signal.traffic_score || 0.0

  return (
    <div className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-5 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1"
          >
            <ChevronLeft size={12} /> BACK TO MONITORING
          </button>
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            AI CONTROL PANEL & DECISION MATH
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6 flex-1">
        {/* Left 7 cols: AI Reasoning & Math formula explanation */}
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-5">
          {/* Formula Card */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Scale size={16} className="text-neon-blue" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                Traffic Pressure Score Formula
              </h2>
            </div>
            
            <p className="text-xs text-text-secondary leading-relaxed">
              The AI Decision Engine computes a real-time Traffic Pressure Score for each intersection approach. The approach with the highest score is prioritized, and the recommended green duration is calculated dynamically.
            </p>

            <div className="p-4 rounded bg-white/3 border border-white/5 font-mono text-[11px] leading-relaxed text-neon-blue">
              <span className="font-bold text-white uppercase">Traffic Pressure = </span>
              <br />
              &nbsp;&nbsp;<span className="text-neon-green">0.30</span> * Queue Length (normalized to 20m) +
              <br />
              &nbsp;&nbsp;<span className="text-neon-green">0.25</span> * Lane Occupancy % +
              <br />
              &nbsp;&nbsp;<span className="text-neon-green">0.20</span> * Vehicle Count (normalized to 50) +
              <br />
              &nbsp;&nbsp;<span className="text-neon-green">0.15</span> * Waiting Delay (normalized to 120s) +
              <br />
              &nbsp;&nbsp;<span className="text-neon-green">0.10</span> * Emergency Priority (binary)
            </div>
          </div>

            {/* Current inputs grid across all four cameras */}
            <div className="glass-card p-6 flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Settings size={14} className="text-neon-blue" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                  Real-time approach scores comparison
                </h2>
              </div>

              <div className="grid grid-cols-4 gap-4 flex-1">
                {camerasList.map(camKey => {
                  const cam = camerasData[camKey] || {}
                  const score = cam.signal_state?.traffic_score || 0
                  const isActive = cam.signal_state?.phase === 'green'

                  return (
                    <div key={camKey} className={`p-4 rounded border flex flex-col gap-3 transition-colors ${
                      isActive ? 'bg-neon-blue/10 border-neon-blue/40' : 'bg-white/2 border-white/5'
                    }`}>
                      <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                        <span className="uppercase text-white">{camKey}</span>
                        <span className={isActive ? 'text-neon-green' : 'text-text-secondary'}>
                          {isActive ? 'ACTIVE GREEN' : 'RED'}
                        </span>
                      </div>

                      {/* Score display */}
                      <div className="flex flex-col gap-1 my-2">
                        <span className="text-[9px] uppercase text-text-secondary font-mono">Pressure Score</span>
                        <span className="text-2xl font-bold font-mono text-white">{score.toFixed(3)}</span>
                      </div>

                      {/* Factor bars */}
                      <div className="flex flex-col gap-2.5 text-[9px] font-mono text-text-secondary">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span>Queue</span>
                            <span className="text-white">{cam.metrics?.lane_density?.max_queue_length?.toFixed(0) || 0}m</span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded overflow-hidden">
                            <div className="bg-neon-blue h-full" style={{ width: `${Math.min(100, (cam.metrics?.lane_density?.max_queue_length || 0) / 20 * 100)}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span>Wait Delay</span>
                            <span className="text-white">{(cam.metrics?.congestion?.waiting_time_sec || 0).toFixed(0)}s</span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded overflow-hidden">
                            <div className="bg-neon-yellow h-full" style={{ width: `${Math.min(100, (cam.metrics?.congestion?.waiting_time_sec || 0) / 120 * 100)}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span>Vehicles</span>
                            <span className="text-white">{cam.metrics?.vehicle_count?.total || 0}</span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded overflow-hidden">
                            <div className="bg-neon-green h-full" style={{ width: `${Math.min(100, (cam.metrics?.vehicle_count?.total || 0) / 50 * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
        </div>

        {/* Right 5 cols: Decision Engine Details & Predictions */}
        <div className="col-span-12 xl:col-span-5 flex flex-col gap-5">
          {/* Engine Status */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Cpu size={16} className="text-neon-blue" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                AI Signal Decision Recommendations
              </h2>
            </div>

            <div className="flex flex-col gap-4 text-xs font-mono">
              <div className="flex justify-between p-2.5 rounded bg-white/3">
                <span className="text-text-secondary">Active Priority Road</span>
                <span className="text-white font-bold uppercase">{activeGreenApproach} ROAD</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-white/3">
                <span className="text-text-secondary">Recommended Green Time</span>
                <span className="text-neon-green font-bold">{signal.recommended_green_time?.toFixed(0) || '30'} seconds</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-white/3">
                <span className="text-text-secondary">AI Recommendation Confidence</span>
                <span className="text-neon-blue font-bold">{((signal.confidence || 0.9) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-white/3">
                <span className="text-text-secondary">Emergency Override Status</span>
                <span className={`font-bold ${signal.emergency_override ? 'text-neon-red animate-pulse' : 'text-text-secondary'}`}>
                  {signal.emergency_override ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-white/3">
                <span className="text-text-secondary">Transit Bus Priority</span>
                <span className={`font-bold ${signal.bus_priority ? 'text-neon-blue animate-pulse' : 'text-text-secondary'}`}>
                  {signal.bus_priority ? 'ACTIVE (+15% Green)' : 'INACTIVE'}
                </span>
              </div>
            </div>

            <div className="mt-2 p-3 rounded bg-blue-950/20 border border-neon-blue/30 text-[11px] font-mono leading-relaxed">
              <span className="text-neon-blue font-bold uppercase">Human-readable Reasoning:</span>
              <p className="text-white mt-1 text-xs">
                {signal.reasoning || "Traffic flow stable. Decision engine in automation cycle."}
              </p>
            </div>
          </div>

          {/* Future Predictions / Queue clearing estimations */}
          <div className="glass-card p-6 flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Sparkles size={14} className="text-neon-blue" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                Future Trend Predictions
              </h2>
            </div>

            <div className="flex flex-col gap-4 text-xs font-mono">
              <p className="text-text-secondary text-[11px] leading-relaxed">
                YOLO v26 models flow arrival rates and predicts approach clearances up to 120 seconds in advance based on queue growth velocity.
              </p>
              
              <div className="flex justify-between border-b border-white/5 py-1.5">
                <span className="text-text-secondary">Predicted Clearance Time</span>
                <span className="text-neon-green font-bold">{(metrics.signal?.estimated_clearance_time || 0).toFixed(0)}s</span>
              </div>
              <div className="flex justify-between border-b border-white/5 py-1.5">
                <span className="text-text-secondary">Arrival Rate Velocity</span>
                <span className="text-white">{(metrics.traffic_flow?.arrival_rate || 0.0).toFixed(2)} vehicles/sec</span>
              </div>
              <div className="flex justify-between border-b border-white/5 py-1.5">
                <span className="text-text-secondary">Departure Rate Velocity</span>
                <span className="text-white">{(metrics.traffic_flow?.departure_rate || 0.0).toFixed(2)} vehicles/sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
