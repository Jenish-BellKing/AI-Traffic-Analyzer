import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Zap, Cpu, CloudSun, AlertTriangle, Radio, Play, Activity } from 'lucide-react'

export default function TopNav({ connected, sysInfo, activeOverride }) {
  const [now, setNow] = useState(new Date())
  const location = useLocation()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="border-b border-white/5 bg-[#060a17]/80 backdrop-blur-md sticky top-0 z-50 py-3 px-6">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
        {/* Logo & Brand */}
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
              YOLO v26 AI Decision Hub
            </p>
          </div>
        </div>

        {/* Layer Links / Nav */}
        <nav className="flex items-center gap-4 bg-white/5 p-1 rounded-lg border border-white/5">
          <Link
            to="/"
            className={`px-3 py-1 rounded text-xs font-mono tracking-wider transition-colors ${
              location.pathname === '/' 
                ? 'bg-neon-blue/20 text-neon-blue font-bold border border-neon-blue/30' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            MONITORING
          </Link>
          <Link
            to="/analysis/north"
            className={`px-3 py-1 rounded text-xs font-mono tracking-wider transition-colors ${
              location.pathname.startsWith('/analysis') 
                ? 'bg-neon-blue/20 text-neon-blue font-bold border border-neon-blue/30' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            ANALYSIS
          </Link>
          <Link
            to="/control"
            className={`px-3 py-1 rounded text-xs font-mono tracking-wider transition-colors ${
              location.pathname === '/control' 
                ? 'bg-neon-blue/20 text-neon-blue font-bold border border-neon-blue/30' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            CONTROL
          </Link>
        </nav>

        {/* Central HUD pills */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-neon-green animate-pulse' : 'bg-neon-red'}`} />
            <span className="text-text-secondary">BACKEND:</span>
            <span className={connected ? 'text-neon-green' : 'text-neon-red font-bold'}>
              {connected ? 'WS_CONNECTED' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
            <Cpu size={12} className="text-neon-blue animate-pulse" />
            <span className="text-text-secondary">GPU:</span>
            <span className="text-neon-green">
              {sysInfo?.gpu || 'NVIDIA RTX 4090'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
            <Activity size={12} className="text-neon-green" />
            <span className="text-text-secondary">AI STATE:</span>
            <span className="text-neon-blue font-bold">YOLO_v26_ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/3 border border-white/5 text-[11px] font-mono">
            <CloudSun size={13} className="text-neon-blue" />
            <span className="text-text-secondary">WEATHER:</span>
            <span className="text-neon-green">SUNNY / 1.0</span>
          </div>

          {activeOverride && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded border border-red-500 bg-red-950/40 text-[11px] font-mono text-red-400 font-bold animate-pulse">
              <AlertTriangle size={12} />
              EMERGENCY DETECTED
            </div>
          )}
        </div>

        {/* Clock */}
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
  )
}
