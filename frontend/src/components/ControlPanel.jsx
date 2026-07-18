import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play, Pause, Square, RotateCcw, Upload,
  Monitor, Cpu, AlertOctagon, Camera
} from 'lucide-react'
import { api } from '../services/api'

export default function ControlPanel({ status, onStatusChange }) {
  const fileRef    = useRef(null)
  const [uploading, setUploading]       = useState(false)
  const [uploadPct, setUploadPct]       = useState(0)
  const [activeBtn, setActiveBtn]       = useState(null)

  const running = status === 'running'
  const paused  = status === 'paused'

  const call = async (fn, btnId) => {
    setActiveBtn(btnId)
    try {
      await fn()
      onStatusChange?.()
    } catch (e) {
      console.error(e)
    }
    setActiveBtn(null)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadPct(0)
    try {
      await api.uploadVideo(file, pct => setUploadPct(pct))
      onStatusChange?.()
    } catch (err) {
      console.error(err)
    }
    setUploading(false)
    e.target.value = ''
  }

  const buttons = [
    {
      id: 'start',
      label: 'Simulation',
      icon: Monitor,
      cls: 'btn-primary',
      onClick: () => call(api.startSimulation, 'start'),
      disabled: running,
    },
    {
      id: 'pause',
      label: paused ? 'Resume' : 'Pause',
      icon: paused ? Play : Pause,
      cls: 'btn-ghost',
      onClick: () => call(paused ? api.resume : api.pause, 'pause'),
      disabled: !running && !paused,
    },
    {
      id: 'stop',
      label: 'Stop',
      icon: Square,
      cls: 'btn-danger',
      onClick: () => call(api.stop, 'stop'),
      disabled: status === 'idle' || status === 'stopped',
    },
    {
      id: 'reset',
      label: 'Reset',
      icon: RotateCcw,
      cls: 'btn-ghost',
      onClick: () => call(api.reset, 'reset'),
    },
  ]

  return (
    <div className="glass-card p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Cpu size={14} className="text-neon-blue" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Control Panel</span>
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-2 gap-2">
        {buttons.map(({ id, label, icon: Icon, cls, onClick, disabled }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.95 }}
            className={`btn ${cls} justify-center`}
            onClick={onClick}
            disabled={disabled || activeBtn === id}
          >
            {activeBtn === id
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Icon size={14} />
            }
            {label}
          </motion.button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Upload video */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".mp4,.avi,.mkv,.mov"
          className="hidden"
          onChange={handleUpload}
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn btn-ghost w-full justify-center"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={14} />
          {uploading ? `Uploading ${uploadPct}%` : 'Upload Video'}
        </motion.button>

        {uploading && (
          <div className="meter-track">
            <motion.div
              className="meter-fill"
              style={{ background: 'linear-gradient(90deg, #00d4ff99, #00d4ff)', width: `${uploadPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Emergency mode trigger */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ boxShadow: '0 0 20px rgba(255,51,102,0.5)' }}
        className="btn btn-danger w-full justify-center"
        onClick={() => call(() => api.startSimulation({ emergency_frequency: 0.5 }), 'emergency')}
      >
        <AlertOctagon size={14} />
        Emergency
      </motion.button>

      {/* Status indicator */}
      <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
        <span className="text-text-secondary">System Status</span>
        <div className="flex items-center gap-1.5">
          <div className={`status-dot ${
            status === 'running' ? 'bg-neon-green' :
            status === 'paused'  ? 'bg-neon-yellow' :
            'bg-text-secondary'
          }`} />
          <span className="font-mono font-semibold uppercase text-xs" style={{
            color: status === 'running' ? '#00ff88' :
                   status === 'paused'  ? '#ffcc00' : '#7a9ab5'
          }}>
            {status ?? 'idle'}
          </span>
        </div>
      </div>
    </div>
  )
}
