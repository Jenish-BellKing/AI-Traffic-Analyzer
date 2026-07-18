import React from 'react'
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Activity, Layers, Radar as RadarIcon } from 'lucide-react'

// ── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-text-secondary text-xs mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-mono text-xs" style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed?.(1) ?? p.value}</strong>
        </p>
      ))}
    </div>
  )
}

const chartProps = {
  margin: { top: 4, right: 4, left: -20, bottom: 0 },
}

const axisStyle = {
  tick:  { fill: '#7a9ab5', fontSize: 10, fontFamily: 'JetBrains Mono' },
  line:  { stroke: 'rgba(255,255,255,0.06)' },
}

// ── Vehicle count over time ─────────────────────────────────────────────────
function VehicleCountChart({ history }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={13} className="text-neon-green" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Vehicle Count vs Time
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={history} {...chartProps}>
          <defs>
            <linearGradient id="gradCars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ff88" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gradBus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ffaa00" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ffaa00" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" {...axisStyle} interval="preserveStartEnd" />
          <YAxis {...axisStyle} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="vehicles" name="Total"  stroke="#00ff88" fill="url(#gradCars)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="buses"    name="Buses"  stroke="#ffaa00" fill="url(#gradBus)"  strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="trucks"   name="Trucks" stroke="#ff6600" fill="none"           strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Congestion + Speed chart ────────────────────────────────────────────────
function CongestionChart({ history }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Activity size={13} className="text-neon-red" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Congestion & Speed
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={history} {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" {...axisStyle} interval="preserveStartEnd" />
          <YAxis yAxisId="cong" {...axisStyle} domain={[0, 100]} />
          <YAxis yAxisId="spd"  {...axisStyle} orientation="right" domain={[0, 80]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#7a9ab5', paddingTop: 4 }}
          />
          <Line yAxisId="cong" type="monotone" dataKey="congestion" name="Congestion %" stroke="#ff3366"
                strokeWidth={2} dot={false} />
          <Line yAxisId="spd"  type="monotone" dataKey="speed"      name="Speed km/h" stroke="#00d4ff"
                strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Traffic Flow bar chart ──────────────────────────────────────────────────
function TrafficFlowChart({ history }) {
  // Show last 20 data points as bars
  const slice = history.slice(-20)
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-neon-blue" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Traffic Flow (v/min)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={slice} {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" {...axisStyle} interval="preserveStartEnd" />
          <YAxis {...axisStyle} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="flow" name="v/min" fill="#00d4ff" opacity={0.8} radius={[3,3,0,0]} />
          <Bar dataKey="score" name="Score" fill="#aa44ff" opacity={0.6} radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Lane occupancy radar ────────────────────────────────────────────────────
function LaneRadarChart({ data }) {
  const ld = data?.metrics?.lane_density
  const radarData = ld
    ? [
        { lane: 'Lane 1', occ: ld.lane_occupancy_pct?.[0] ?? 0, veh: ld.vehicles_per_lane?.[0] ?? 0 },
        { lane: 'Lane 2', occ: ld.lane_occupancy_pct?.[1] ?? 0, veh: ld.vehicles_per_lane?.[1] ?? 0 },
        { lane: 'Lane 3', occ: ld.lane_occupancy_pct?.[2] ?? 0, veh: ld.vehicles_per_lane?.[2] ?? 0 },
        { lane: 'Lane 4', occ: ld.lane_occupancy_pct?.[3] ?? 0, veh: ld.vehicles_per_lane?.[3] ?? 0 },
      ]
    : []

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RadarIcon size={13} className="text-neon-purple" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Lane Heatmap
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="lane" tick={{ fill: '#7a9ab5', fontSize: 10 }} />
          <Radar name="Occupancy %" dataKey="occ" stroke="#00ff88" fill="#00ff88" fillOpacity={0.15} strokeWidth={2} />
          <Radar name="Vehicles"    dataKey="veh" stroke="#aa44ff" fill="#aa44ff" fillOpacity={0.15} strokeWidth={2} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#7a9ab5' }} />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Charts export ──────────────────────────────────────────────────────
export default function Charts({ history, data }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <VehicleCountChart history={history} />
      <CongestionChart   history={history} />
      <TrafficFlowChart  history={history} />
      <LaneRadarChart    data={data} />
    </div>
  )
}
