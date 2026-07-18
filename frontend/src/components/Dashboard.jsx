import React from 'react'
import { motion } from 'framer-motion'
import {
  Car, Bus, Truck, Bike, AlertTriangle, Users,
  Gauge, Activity, Layers, Timer, Zap, ThermometerSun
} from 'lucide-react'

// ── Generic stat card ──────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color = '#00ff88', sub, trend }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: color + '1a' }}>
            <Icon size={15} style={{ color }} />
          </div>
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wide">{label}</span>
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-mono ${trend >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold font-mono leading-none" style={{ color }}>
          {value ?? '--'}
        </span>
        {unit && <span className="text-sm text-text-secondary mb-0.5">{unit}</span>}
      </div>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </motion.div>
  )
}

// ── Meter bar ──────────────────────────────────────────────────────────────
function MeterCard({ label, value, max = 100, color = '#00ff88', icon: Icon, children }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="p-1.5 rounded-lg" style={{ background: color + '1a' }}>
            <Icon size={15} style={{ color }} />
          </div>
        )}
        <span className="text-xs text-text-secondary font-medium uppercase tracking-wide flex-1">{label}</span>
        <span className="text-sm font-mono font-bold" style={{ color }}>{value?.toFixed(1) ?? '--'}</span>
      </div>
      <div className="meter-track">
        <motion.div
          className="meter-fill"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, color, width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {children}
    </motion.div>
  )
}

// ── Vehicle count breakdown ─────────────────────────────────────────────────
function VehicleBreakdown({ vc }) {
  if (!vc) return null
  const items = [
    { label: 'Cars',       val: vc.cars,               color: '#00ff88' },
    { label: 'Bikes',      val: vc.bikes,              color: '#00d4ff' },
    { label: 'Buses',      val: vc.buses,              color: '#ffaa00' },
    { label: 'Trucks',     val: vc.trucks,             color: '#ff6600' },
    { label: 'Autos',      val: vc.autos,              color: '#aa44ff' },
    { label: 'Emergency',  val: vc.emergency_vehicles, color: '#ff3366' },
    { label: 'Pedestrian', val: vc.pedestrians,        color: '#ffff00' },
  ]
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Car size={14} className="text-neon-green" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Vehicle Breakdown</span>
        <span className="ml-auto font-mono font-bold text-neon-green text-sm">{vc.total} total</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map(({ label, val, color }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{label}</span>
            <span className="font-mono font-semibold" style={{ color }}>{val ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Lane occupancy bars ─────────────────────────────────────────────────────
function LaneOccupancy({ ld }) {
  if (!ld) return null
  const lanes = ld.lane_occupancy_pct ?? [0, 0, 0, 0]
  const perLane = ld.vehicles_per_lane ?? [0, 0, 0, 0]
  const colors = ['#00ff88', '#00d4ff', '#ffaa00', '#aa44ff']

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-neon-blue" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Lane Occupancy</span>
      </div>
      <div className="flex items-end gap-2 h-24">
        {lanes.map((pct, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-mono" style={{ color: colors[i] }}>{pct?.toFixed(0)}%</span>
            <div className="w-full flex-1 bg-white/5 rounded-t-sm flex items-end">
              <motion.div
                className="w-full rounded-t-sm"
                style={{ background: colors[i], opacity: 0.8 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.5 }}
                initial={{ height: 0 }}
              />
            </div>
            <span className="text-xs text-text-secondary">L{i + 1}</span>
            <span className="text-xs font-mono text-text-secondary">{perLane[i]?.toFixed(0)}v</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard export ───────────────────────────────────────────────────
export default function Dashboard({ data }) {
  const metrics = data?.metrics
  const signal  = data?.signal_state
  const vc      = metrics?.vehicle_count
  const vs      = metrics?.vehicle_speed
  const cg      = metrics?.congestion
  const ld      = metrics?.lane_density
  const tf      = metrics?.traffic_flow
  const pr      = metrics?.priority

  const congPct   = +(( cg?.congestion_index     ?? 0) * 100).toFixed(1)
  const roadUtil  = +(  cg?.road_utilization_pct  ?? 0).toFixed(1)

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1 — key numbers */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          icon={Car}
          label="Total Vehicles"
          value={vc?.total ?? 0}
          color="#00ff88"
          sub={`${vs?.moving_count ?? 0} moving · ${vs?.stopped_count ?? 0} stopped`}
        />
        <StatCard
          icon={Gauge}
          label="Avg Speed"
          value={vs?.average_kmh?.toFixed(1) ?? '0.0'}
          unit="km/h"
          color="#00d4ff"
          sub={`Max: ${vs?.max_kmh?.toFixed(0) ?? 0} km/h`}
        />
        <StatCard
          icon={Activity}
          label="Traffic Flow"
          value={tf?.vehicles_per_minute?.toFixed(1) ?? '0.0'}
          unit="v/min"
          color="#aa44ff"
          sub={`Headway: ${tf?.headway_sec?.toFixed(1) ?? '--'}s`}
        />
        <StatCard
          icon={Timer}
          label="Avg Delay"
          value={cg?.average_delay_sec?.toFixed(0) ?? 0}
          unit="sec"
          color="#ffaa00"
          sub={`Wait: ${cg?.waiting_time_sec?.toFixed(0) ?? 0}s`}
        />
      </div>

      {/* Row 2 — meters */}
      <div className="grid grid-cols-2 gap-3">
        <MeterCard
          label="Congestion Index"
          value={congPct}
          max={100}
          color={congPct > 70 ? '#ff3366' : congPct > 40 ? '#ffaa00' : '#00ff88'}
          icon={Zap}
        />
        <MeterCard
          label="Road Utilization"
          value={roadUtil}
          max={100}
          color="#00d4ff"
          icon={Layers}
        />
      </div>

      {/* Row 3 — vehicle breakdown + lane occupancy */}
      <div className="grid grid-cols-2 gap-3">
        <VehicleBreakdown vc={vc} />
        <LaneOccupancy ld={ld} />
      </div>

      {/* Row 4 — queue & emergency */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard
          icon={Truck}
          label="Queue Length"
          value={ld?.max_queue_length?.toFixed(0) ?? 0}
          unit="veh"
          color="#ffaa00"
          sub={`Avg: ${ld?.avg_queue_length?.toFixed(1) ?? 0}`}
        />
        <StatCard
          icon={Users}
          label="Pedestrians"
          value={vc?.pedestrians ?? 0}
          color="#ffff44"
          sub={`Crossing demand: ${pr?.pedestrian_crossing_demand ?? 0}`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Emergency"
          value={pr?.emergency_vehicle_present ? 'ACTIVE' : 'NONE'}
          color={pr?.emergency_vehicle_present ? '#ff3366' : '#334155'}
          sub={pr?.public_bus_present ? '🚌 Bus present' : 'No priority'}
        />
      </div>
    </div>
  )
}
