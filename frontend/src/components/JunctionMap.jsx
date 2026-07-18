import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigation, Info, Radio } from 'lucide-react'

export default function JunctionMap({ data, selectedCam, onSelectCam, onDoubleClickCam }) {
  const canvasRef = useRef(null)
  const [hoveredCam, setHoveredCam] = useState(null)

  // Map coordinates configuration
  const width = 600
  const height = 600
  const cx = width / 2
  const cy = height / 2
  const roadWidth = 100 // width of North-South and East-West roads

  // Camera interactive click areas (2D polygons/boxes on the map)
  const approaches = [
    { name: 'north', label: 'North Approach (Cam 1)', tx: cx, ty: cy - 180, x: cx - roadWidth/2, y: 0, w: roadWidth, h: cy - roadWidth/2 },
    { name: 'east', label: 'East Approach (Cam 3)', tx: cx + 180, ty: cy, x: cx + roadWidth/2, y: cy - roadWidth/2, w: cx - roadWidth/2, h: roadWidth },
    { name: 'south', label: 'South Approach (Cam 2)', tx: cx, ty: cy + 180, x: cx - roadWidth/2, y: cy + roadWidth/2, w: roadWidth, h: cy - roadWidth/2 },
    { name: 'west', label: 'West Approach (Cam 4)', tx: cx - 180, ty: cy, x: 0, y: cy - roadWidth/2, w: cx - roadWidth/2, h: roadWidth }
  ]

  // Track double click
  const lastClickRef = useRef({ time: 0, cam: null })

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const clickX = (e.clientX - rect.left) * scaleX
    const clickY = (e.clientY - rect.top) * scaleY

    // Determine if clicked within any approach
    const clicked = approaches.find(app => {
      return clickX >= app.x && clickX <= app.x + app.w &&
             clickY >= app.y && clickY <= app.y + app.h
    })

    if (clicked) {
      const now = Date.now()
      const diff = now - lastClickRef.current.time
      if (diff < 300 && lastClickRef.current.cam === clicked.name) {
        // Double click detected
        onDoubleClickCam(clicked.name)
      } else {
        // Single click
        onSelectCam(clicked.name)
      }
      lastClickRef.current = { time: now, cam: clicked.name }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const moveX = (e.clientX - rect.left) * scaleX
    const moveY = (e.clientY - rect.top) * scaleY

    const active = approaches.find(app => {
      return moveX >= app.x && moveX <= app.x + app.w &&
             moveY >= app.y && moveY <= app.y + app.h
    })

    setHoveredCam(active ? active.name : null)
  };

  // Draw the simulation twin map on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear background with dark tech blue grid
    ctx.fillStyle = '#060a17'
    ctx.fillRect(0, 0, width, height)

    // Draw tech background grids
    ctx.strokeStyle = 'rgba(0, 168, 255, 0.04)'
    ctx.lineWidth = 1
    const gridSize = 30
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Highlight selected/hovered zones
    approaches.forEach(app => {
      const isSelected = selectedCam === app.name
      const isHovered = hoveredCam === app.name
      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? 'rgba(0, 212, 255, 0.05)' : 'rgba(0, 212, 255, 0.02)'
        ctx.fillRect(app.x, app.y, app.w, app.h)
        ctx.strokeStyle = isSelected ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 212, 255, 0.15)'
        ctx.lineWidth = 2
        ctx.strokeRect(app.x, app.y, app.w, app.h)
      }
    })

    // Draw Asphalt Crossroads
    ctx.fillStyle = '#11141e'
    // NS Road
    ctx.fillRect(cx - roadWidth / 2, 0, roadWidth, height)
    // EW Road
    ctx.fillRect(0, cy - roadWidth / 2, width, roadWidth)

    // Center Junction box
    ctx.fillStyle = '#151926'
    ctx.fillRect(cx - roadWidth / 2, cy - roadWidth / 2, roadWidth, roadWidth)

    // Draw Lane Dividers & road limits (Neon Blue/Cyan)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)'
    ctx.lineWidth = 2
    
    // NS limits
    ctx.beginPath()
    ctx.moveTo(cx - roadWidth / 2, 0)
    ctx.lineTo(cx - roadWidth / 2, cy - roadWidth / 2)
    ctx.moveTo(cx - roadWidth / 2, cy + roadWidth / 2)
    ctx.lineTo(cx - roadWidth / 2, height)
    ctx.moveTo(cx + roadWidth / 2, 0)
    ctx.lineTo(cx + roadWidth / 2, cy - roadWidth / 2)
    ctx.moveTo(cx + roadWidth / 2, cy + roadWidth / 2)
    ctx.lineTo(cx + roadWidth / 2, height)
    
    // EW limits
    ctx.moveTo(0, cy - roadWidth / 2)
    ctx.lineTo(cx - roadWidth / 2, cy - roadWidth / 2)
    ctx.moveTo(cx + roadWidth / 2, cy - roadWidth / 2)
    ctx.lineTo(width, cy - roadWidth / 2)
    ctx.moveTo(0, cy + roadWidth / 2)
    ctx.lineTo(cx - roadWidth / 2, cy + roadWidth / 2)
    ctx.moveTo(cx + roadWidth / 2, cy + roadWidth / 2)
    ctx.lineTo(width, cy + roadWidth / 2)
    ctx.stroke()

    // Draw dashed lane markings (faint)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([8, 12])
    const lanesCount = 3
    const laneW = roadWidth / lanesCount

    // North & South Lanes
    for (let l = 1; l < lanesCount; l++) {
      ctx.beginPath()
      ctx.moveTo(cx - roadWidth / 2 + l * laneW, 0)
      ctx.lineTo(cx - roadWidth / 2 + l * laneW, cy - roadWidth / 2)
      ctx.moveTo(cx - roadWidth / 2 + l * laneW, cy + roadWidth / 2)
      ctx.lineTo(cx - roadWidth / 2 + l * laneW, height)
      ctx.stroke()
    }
    // East & West Lanes
    for (let l = 1; l < lanesCount; l++) {
      ctx.beginPath()
      ctx.moveTo(0, cy - roadWidth / 2 + l * laneW)
      ctx.lineTo(cx - roadWidth / 2, cy - roadWidth / 2 + l * laneW)
      ctx.moveTo(cx + roadWidth / 2, cy - roadWidth / 2 + l * laneW)
      ctx.lineTo(width, cy - roadWidth / 2 + l * laneW)
      ctx.stroke()
    }
    ctx.setLineDash([]) // reset

    // Draw Stop lines (White)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    // North stop
    ctx.beginPath()
    ctx.moveTo(cx - roadWidth / 2, cy - roadWidth / 2)
    ctx.lineTo(cx + roadWidth / 2, cy - roadWidth / 2)
    // South stop
    ctx.moveTo(cx - roadWidth / 2, cy + roadWidth / 2)
    ctx.lineTo(cx + roadWidth / 2, cy + roadWidth / 2)
    // West stop
    ctx.moveTo(cx - roadWidth / 2, cy - roadWidth / 2)
    ctx.lineTo(cx - roadWidth / 2, cy + roadWidth / 2)
    // East stop
    ctx.moveTo(cx + roadWidth / 2, cy - roadWidth / 2)
    ctx.lineTo(cx + roadWidth / 2, cy + roadWidth / 2)
    ctx.stroke()

    // Draw moving vehicles from WebSocket data
    if (data?.cameras) {
      Object.entries(data.cameras).forEach(([direction, camData]) => {
        const vehicles = camData.detections || []
        const signal = camData.signal_state || {}
        
        vehicles.forEach(veh => {
          const pos = veh.bbox // [x,y,w,h] normalized
          const class_name = veh.class_name
          const trackerId = veh.track_id
          const currentPos = veh.speed_kmh > 0 ? (veh.bbox[1] + veh.bbox[3]/2) : 0.45 // proxy pos

          // Map 1D logical lane position to 2D coordinates
          let x2d = cx
          let y2d = cy
          const laneIdx = veh.lane_id || 0
          
          // Compute positions based on direction approach
          if (direction === 'north') {
            const laneOffset = (laneIdx - 1) * (roadWidth / 3)
            x2d = cx + laneOffset
            y2d = veh.bbox[1] * height
            if (y2d > cy - roadWidth/2) y2d = cy - roadWidth/2 - 5 // clamp before stop
          } else if (direction === 'south') {
            const laneOffset = (1 - laneIdx) * (roadWidth / 3)
            x2d = cx + laneOffset
            y2d = height - (veh.bbox[1] * height)
            if (y2d < cy + roadWidth/2) y2d = cy + roadWidth/2 + 5
          } else if (direction === 'east') {
            const laneOffset = (laneIdx - 1) * (roadWidth / 3)
            y2d = cy + laneOffset
            x2d = width - (veh.bbox[1] * width)
            if (x2d < cx + roadWidth/2) x2d = cx + roadWidth/2 + 5
          } else if (direction === 'west') {
            const laneOffset = (1 - laneIdx) * (roadWidth / 3)
            y2d = cy + laneOffset
            x2d = veh.bbox[1] * width
            if (x2d > cx - roadWidth/2) x2d = cx - roadWidth/2 - 5
          }

          // Vehicle representation
          const size = class_name === 'emergency' ? 8 : class_name === 'bus' || class_name === 'truck' ? 10 : 6
          
          // Color based on class
          let vehicleColor = '#00ff88' // Green
          if (class_name === 'emergency') {
            vehicleColor = '#ff3366' // Red glow
          } else if (class_name === 'bus' || class_name === 'truck') {
            vehicleColor = '#ff9f00' // Yellow orange
          } else if (class_name === 'motorcycle' || class_name === 'bicycle') {
            vehicleColor = '#00d4ff' // Cyan
          }

          // Draw vehicle dot with glowing aura
          ctx.shadowBlur = 10
          ctx.shadowColor = vehicleColor
          ctx.fillStyle = vehicleColor
          ctx.beginPath()
          ctx.arc(x2d, y2d, size, 0, 2 * Math.PI)
          ctx.fill()
          ctx.shadowBlur = 0 // reset shadow

          // Headlight rays
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'
          ctx.lineWidth = 1
          ctx.beginPath()
          if (direction === 'north') {
            ctx.moveTo(x2d - 2, y2d + size)
            ctx.lineTo(x2d - 6, y2d + size + 10)
            ctx.moveTo(x2d + 2, y2d + size)
            ctx.lineTo(x2d + 6, y2d + size + 10)
          } else if (direction === 'south') {
            ctx.moveTo(x2d - 2, y2d - size)
            ctx.lineTo(x2d - 6, y2d - size - 10)
            ctx.moveTo(x2d + 2, y2d - size)
            ctx.lineTo(x2d + 6, y2d - size - 10)
          } else if (direction === 'west') {
            ctx.moveTo(x2d + size, y2d - 2)
            ctx.lineTo(x2d + size + 10, y2d - 6)
            ctx.moveTo(x2d + size, y2d + 2)
            ctx.lineTo(x2d + size + 10, y2d + 6)
          } else if (direction === 'east') {
            ctx.moveTo(x2d - size, y2d - 2)
            ctx.lineTo(x2d - size - 10, y2d - 6)
            ctx.moveTo(x2d - size, y2d + 2)
            ctx.lineTo(x2d - size - 10, y2d + 6)
          }
          ctx.stroke()
        })
      })
    }

    // Draw glowing traffic light status indicators next to stop lines
    approaches.forEach(app => {
      const camState = data?.cameras?.[app.name]
      const phase = camState?.signal_state?.phase || 'red'
      const countdown = Math.ceil(camState?.signal_state?.countdown || 0)
      
      let color = '#ff3366' // Red
      if (phase === 'green') color = '#00ff88'
      else if (phase === 'yellow') color = '#ffcc00'

      // Light coordinates
      let lx = cx
      let ly = cy
      if (app.name === 'north') { lx = cx + roadWidth / 2 + 15; ly = cy - roadWidth / 2 - 10 }
      else if (app.name === 'south') { lx = cx - roadWidth / 2 - 15; ly = cy + roadWidth / 2 + 10 }
      else if (app.name === 'east') { lx = cx + roadWidth / 2 + 10; ly = cy + roadWidth / 2 + 15 }
      else if (app.name === 'west') { lx = cx - roadWidth / 2 - 10; ly = cy - roadWidth / 2 - 15 }

      // Draw light
      ctx.shadowBlur = 12
      ctx.shadowColor = color
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(lx, ly, 7, 0, 2 * Math.PI)
      ctx.fill()
      ctx.shadowBlur = 0 // reset

      // Draw countdown label
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(countdown.toString(), lx, ly + (app.name === 'south' || app.name === 'east' ? 16 : -16))
    })

    // Draw intersection metadata text overlays
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    approaches.forEach(app => {
      const isSelected = selectedCam === app.name
      ctx.fillStyle = isSelected ? '#00d4ff' : 'rgba(255, 255, 255, 0.4)'
      ctx.fillText(app.name.toUpperCase(), app.tx, app.ty)
      
      // Draw sub counts
      const count = data?.cameras?.[app.name]?.metrics?.vehicle_count?.total || 0
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.fillText(`QTY: ${count}`, app.tx, app.ty + 14)
    })

    // Center Junction Radar scanning sweep animation
    const angle = (Date.now() / 1500) % (2 * Math.PI)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, 60, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + 60 * Math.cos(angle), cy + 60 * Math.sin(angle))
    ctx.stroke()

  }, [data, selectedCam, hoveredCam])

  return (
    <div className="glass-card flex flex-col items-center p-4 relative overflow-hidden h-full">
      {/* Corner indicators */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <Navigation size={12} className="text-neon-blue rotate-45" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Junction Twin Map</span>
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-900/20 text-neon-blue border border-blue-500/20 text-[10px] font-mono font-bold uppercase tracking-wider">
        <Radio size={9} className="animate-pulse" />
        Simulated Active Map
      </div>

      <div className="flex-1 flex items-center justify-center w-full mt-6" style={{ minHeight: 400 }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          className="rounded-xl border border-white/5 cursor-pointer max-w-full max-h-[500px] shadow-2xl"
          style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
        />
      </div>

      {/* Footer hint */}
      <div className="mt-4 flex items-center gap-1 text-[11px] text-text-secondary font-mono text-center">
        <Info size={11} className="text-neon-blue" />
        <span>Single-click highlights camera. Double-click zooms to live stream details.</span>
      </div>
    </div>
  )
}
