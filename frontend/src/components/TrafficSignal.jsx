import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TrafficSignal({ signalState }) {
  const phase = signalState?.phase ?? 'red'
  const countdown = Math.ceil(signalState?.countdown ?? 0)
  
  // Timing variables
  const isGreen = phase === 'green'
  const isYellow = phase === 'yellow'
  const isRed = phase === 'red'

  // Animate count flips
  const [prevCount, setPrevCount] = useState(countdown)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (countdown !== prevCount) {
      setPulse(true)
      const t = setTimeout(() => { setPulse(false); setPrevCount(countdown) }, 150)
      return () => clearTimeout(t)
    }
  }, [countdown])

  // Custom colors and drop shadow glow
  const colors = {
    green: {
      glow: 'rgba(0, 255, 136, 0.45)',
      active: 'linear-gradient(180deg, #10b981 0%, #00ff88 100%)',
      hex: '#00ff88',
      text: 'text-neon-green'
    },
    yellow: {
      glow: 'rgba(255, 204, 0, 0.45)',
      active: 'linear-gradient(180deg, #f59e0b 0%, #ffcc00 100%)',
      hex: '#ffcc00',
      text: 'text-yellow-400'
    },
    red: {
      glow: 'rgba(255, 51, 102, 0.45)',
      active: 'linear-gradient(180deg, #ef4444 0%, #ff3366 100%)',
      hex: '#ff3366',
      text: 'text-red-500'
    }
  }

  const activeColor = colors[phase] || colors.red

  return (
    <div className="glass-card flex flex-col items-center gap-4 p-5 h-full relative overflow-hidden justify-between">
      {/* Title */}
      <div className="flex items-center gap-2 self-stretch border-b border-white/5 pb-2">
        <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ background: activeColor.hex, boxShadow: `0 0 10px ${activeColor.hex}` }} />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Signal Control</span>
      </div>

      {/* Big Digital Countdown */}
      <div className="flex flex-col items-center">
        <div className="relative font-mono font-black text-6xl select-none" style={{ color: activeColor.hex, textShadow: `0 0 20px ${activeColor.glow}` }}>
          <motion.span
            animate={pulse ? { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] } : {}}
            transition={{ duration: 0.15 }}
            className="inline-block"
          >
            {String(countdown).padStart(2, '0')}
          </motion.span>
        </div>
        <p className="text-[10px] text-text-secondary font-mono uppercase tracking-widest mt-1">secs remaining</p>
      </div>

      {/* Realistic 3D Glowing Traffic Signal Housing */}
      <div className="relative w-24 bg-gradient-to-b from-[#1c2030] to-[#0f111a] rounded-3xl p-3 border border-white/10 shadow-2xl flex flex-col items-center gap-4 py-5">
        {/* Signal Hoods / Visors */}
        {[
          { key: 'red', active: isRed, glowColor: colors.red.glow, activeBg: colors.red.active },
          { key: 'yellow', active: isYellow, glowColor: colors.yellow.glow, activeBg: colors.yellow.active },
          { key: 'green', active: isGreen, glowColor: colors.green.glow, activeBg: colors.green.active }
        ].map(light => (
          <div key={light.key} className="relative w-14 h-14 rounded-full bg-[#0a0c12] border border-[#2a2f42] flex items-center justify-center inner-shadow-lens">
            {/* The Bulb itself */}
            <motion.div
              className="w-11 h-11 rounded-full relative overflow-hidden"
              style={{
                background: light.active ? light.activeBg : '#171924',
                boxShadow: light.active ? `0 0 25px ${light.glowColor}, inset 0 2px 4px rgba(255,255,255,0.4)` : 'none'
              }}
              animate={light.active ? { scale: [1, 1.03, 1] } : {}}
              transition={light.active ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
            >
              {/* Internal lens reflection */}
              <div className="absolute top-1 left-2 w-7 h-3.5 bg-white/20 rounded-full blur-[1px]" />
            </motion.div>

            {/* Visual Light Visor Rim overlay */}
            <div className="absolute -top-1 w-14 h-4 bg-gradient-to-b from-[#374151] to-transparent opacity-40 pointer-events-none rounded-t-full" />
          </div>
        ))}
      </div>

      {/* Dynamic labels */}
      <div className="w-full border-t border-white/5 pt-3 flex flex-col gap-2">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-text-secondary">AI Recommendation</span>
          <span className="text-neon-green font-semibold">
            {signalState?.recommended_green_time?.toFixed(0) ?? '--'}s
          </span>
        </div>
        
        {signalState?.emergency_override && (
          <div className="text-[10px] text-center font-bold py-1.5 rounded-lg bg-red-900/50 text-red-400 border border-red-500/40 animate-pulse">
            🚨 EMERGENCY OVERRIDE
          </div>
        )}
        
        {signalState?.bus_priority && !signalState?.emergency_override && (
          <div className="text-[10px] text-center font-bold py-1.5 rounded-lg bg-purple-900/30 text-purple-300 border border-purple-500/30">
            🚌 BUS PRIORITY ACTIVE
          </div>
        )}
      </div>
    </div>
  )
}
