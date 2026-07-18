import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff, Activity, Clock } from 'lucide-react'

// ── Live Video Feed component ──────────────────────────────────────────────
export default function VideoFeed({ data, connected }) {
  const imgRef = useRef(null)
  const prevSrcRef = useRef(null)

  useEffect(() => {
    if (!data?.frame_base64 || !imgRef.current) return
    const newSrc = `data:image/jpeg;base64,${data.frame_base64}`
    if (newSrc !== prevSrcRef.current) {
      imgRef.current.src = newSrc
      prevSrcRef.current = newSrc
    }
  }, [data?.frame_base64])

  const fps        = data?.fps ?? 0
  const resolution = data?.resolution ?? [0, 0]
  const source     = data?.source ?? 'simulation'
  const ts         = data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--:--:--'

  return (
    <div className="glass-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={`status-dot ${connected ? 'bg-neon-green' : 'bg-neon-red'}`} />
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            {connected ? 'LIVE FEED' : 'CONNECTING...'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
          <span className="flex items-center gap-1">
            <Activity size={11} />
            {fps.toFixed(1)} fps
          </span>
          <span>{resolution[0]}×{resolution[1]}</span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {ts}
          </span>
        </div>
      </div>

      {/* Video canvas */}
      <div className="relative flex-1 bg-dark-800 overflow-hidden" style={{ minHeight: 220 }}>
        {/* Scan overlay */}
        <div className="scan-overlay" />

        {connected && data?.frame_base64 ? (
          <img
            ref={imgRef}
            alt="Live traffic feed"
            className="w-full h-full object-contain"
            style={{ display: 'block' }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <WifiOff size={40} className="text-text-secondary" />
            </motion.div>
            <p className="text-text-secondary text-sm">Waiting for stream...</p>
          </div>
        )}

        {/* Corner overlays — HUD style */}
        <HudCorner pos="tl" />
        <HudCorner pos="tr" />
        <HudCorner pos="bl" />
        <HudCorner pos="br" />

        {/* Source badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider
            ${source === 'simulation' ? 'bg-purple-900/70 text-purple-300 border border-purple-500/30' :
              source === 'video' ? 'bg-blue-900/70 text-blue-300 border border-blue-500/30' :
              'bg-emerald-900/70 text-emerald-300 border border-emerald-500/30'}`}>
            {source}
          </span>
        </div>

        {/* Emergency overlay */}
        <AnimatePresence>
          {data?.signal_state?.emergency_override && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 border-2 border-red-500 rounded pointer-events-none emergency-active"
            >
              <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="animate-ping w-2 h-2 rounded-full bg-white inline-block" />
                EMERGENCY OVERRIDE
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 text-xs font-mono text-text-secondary">
        <span>Detections: <span className="text-neon-green font-semibold">{data?.detections?.length ?? 0}</span></span>
        <span>Frames: <span className="text-neon-blue font-semibold">{data?.frames_processed ?? 0}</span></span>
        {connected ? <Wifi size={11} className="ml-auto text-neon-green" /> : <WifiOff size={11} className="ml-auto text-neon-red" />}
      </div>
    </div>
  )
}

function HudCorner({ pos }) {
  const posClass = {
    tl: 'top-2 left-2 border-t-2 border-l-2 rounded-tl-md',
    tr: 'top-2 right-2 border-t-2 border-r-2 rounded-tr-md',
    bl: 'bottom-2 left-2 border-b-2 border-l-2 rounded-bl-md',
    br: 'bottom-2 right-2 border-b-2 border-r-2 rounded-br-md',
  }[pos]
  return (
    <div className={`absolute w-4 h-4 border-neon-blue/50 pointer-events-none ${posClass}`} />
  )
}
