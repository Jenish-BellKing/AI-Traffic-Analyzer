import React from 'react'
import { motion } from 'framer-motion'
import { Brain, ChevronRight, Shield, Clock, TrendingUp, Cpu } from 'lucide-react'

function ConfidenceMeter({ value }) {
  const pct = (value ?? 0) * 100
  const color = pct > 75 ? '#00ff88' : pct > 50 ? '#ffaa00' : '#ff3366'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px] font-mono">
        <span className="text-text-secondary uppercase">Decision Confidence</span>
        <span className="font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="meter-track">
        <motion.div
          className="meter-fill"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, color, width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  )
}

function ScoreRing({ score }) {
  const pct   = (score ?? 0) * 100
  const r     = 36
  const circ  = 2 * Math.PI * r
  const dash  = (pct / 100) * circ
  const color = pct > 70 ? '#ff3366' : pct > 40 ? '#ffaa00' : '#00ff88'

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 90, height: 90 }}>
      <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <motion.circle
          cx="45" cy="45" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ - dash, stroke: color }}
          transition={{ duration: 0.6 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono font-black text-xl leading-none" style={{ color }}>
          {score.toFixed(2)}
        </span>
        <span className="text-text-secondary text-[8px] font-mono uppercase tracking-wider mt-1">PRESSURE</span>
      </div>
    </div>
  )
}

export default function DecisionPanel({ signalState, metrics }) {
  const score     = signalState?.traffic_score ?? 0
  const conf      = signalState?.confidence ?? 0
  const reasoning = signalState?.reasoning ?? 'Awaiting live camera parameters...'
  const recGreen  = signalState?.recommended_green_time ?? 30
  const phase     = signalState?.phase ?? 'red'
  const emergency = signalState?.emergency_override ?? false

  const phaseColor = { green: '#00ff88', yellow: '#ffcc00', red: '#ff3366' }[phase] ?? '#7a9ab5'

  // Metric variables
  const qLen = metrics?.lane_density?.max_queue_length ?? 0
  const occ = (metrics?.lane_density?.lane_occupancy_pct || []).reduce((acc, curr) => acc + curr, 0) / 4 || 0
  const vCount = metrics?.vehicle_count?.total ?? 0
  const waitTime = metrics?.congestion?.waiting_time_sec ?? 0
  const emergPresent = metrics?.priority?.emergency_vehicle_present ? 1 : 0

  return (
    <div className="glass-card flex flex-col gap-4 p-5 h-full justify-between">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Brain size={14} className="text-neon-blue animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Decision Engine</span>
        {emergency && (
          <span className="ml-auto px-2 py-0.5 rounded-md bg-red-900/40 text-red-400 text-[10px] font-bold border border-red-500/40 animate-pulse">
            OVERRIDE ACTIVE
          </span>
        )}
      </div>

      {/* Score ring + phase */}
      <div className="flex items-center gap-5 bg-white/3 rounded-xl p-3 border border-white/5">
        <ScoreRing score={score} />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary">Signal Phase</span>
            <span className="font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5" style={{ color: phaseColor }}>
              {phase}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary">Allocated Green</span>
            <span className="font-mono font-bold text-neon-green">
              {recGreen.toFixed(0)}s
            </span>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <ConfidenceMeter value={conf} />

      {/* Reasoning */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-text-secondary uppercase tracking-widest font-mono">Reasoning Matrix</span>
        <motion.div
          key={reasoning}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-700/60 rounded-xl p-2.5 border border-white/5 min-h-[50px] flex items-center"
        >
          <p className="text-[11px] leading-relaxed text-text-primary font-mono">
            <ChevronRight size={10} className="inline text-neon-blue mr-1 shrink-0" />
            {reasoning}
          </p>
        </motion.div>
      </div>

      {/* Traffic Pressure score math visualization */}
      <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-text-secondary uppercase tracking-widest font-mono">Traffic Pressure Breakdown</span>
          <Cpu size={10} className="text-neon-blue" />
        </div>

        <div className="flex flex-col gap-2">
          {[
            { label: 'Queue Length', w: 0.30, val: qLen, max: 20, unit: 'veh', col: '#00d4ff' },
            { label: 'Lane Occupancy', w: 0.25, val: occ, max: 100, unit: '%', col: '#00ff88' },
            { label: 'Vehicle Count', w: 0.20, val: vCount, max: 50, unit: 'qty', col: '#ffcc00' },
            { label: 'Waiting Time', w: 0.15, val: waitTime, max: 120, unit: 's', col: '#aa44ff' },
            { label: 'Emergency Priority', w: 0.10, val: emergPresent, max: 1, unit: 'act', col: '#ff3366' },
          ].map(({ label, w, val, max, unit, col }) => {
            const normalized = Math.min(val / max, 1)
            const componentScore = normalized * w
            const pct = normalized * 100

            return (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-text-secondary">{label} <span className="text-[8px] opacity-60">({(w*100).toFixed(0)}%)</span></span>
                  <span className="text-text-primary font-semibold">
                    {val.toFixed(0)}{unit} &rarr; +{componentScore.toFixed(2)}
                  </span>
                </div>
                <div className="meter-track h-1">
                  <motion.div
                    className="meter-fill h-1"
                    style={{ background: col, width: `${pct}%` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
