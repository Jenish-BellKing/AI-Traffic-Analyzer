import React, { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:8000/ws'
const RECONNECT_MS = 3000
const MAX_HISTORY = 60  // data points for charts

export function useTrafficData() {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState([])
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        clearTimeout(reconnectRef.current)
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'traffic_update') {
            setData(msg)
            // Append to chart history
            setHistory(prev => {
              const ts = new Date().toLocaleTimeString('en-GB', { hour12: false })
              const point = {
                time: ts,
                vehicles: msg.metrics?.vehicle_count?.total ?? 0,
                cars:     msg.metrics?.vehicle_count?.cars ?? 0,
                buses:    msg.metrics?.vehicle_count?.buses ?? 0,
                trucks:   msg.metrics?.vehicle_count?.trucks ?? 0,
                bikes:    msg.metrics?.vehicle_count?.bikes ?? 0,
                congestion: +(msg.metrics?.congestion?.congestion_index * 100).toFixed(1),
                speed:    +(msg.metrics?.vehicle_speed?.average_kmh).toFixed(1),
                flow:     +(msg.metrics?.traffic_flow?.vehicles_per_minute).toFixed(1),
                score:    +(msg.signal_state?.traffic_score * 100).toFixed(1),
                lane0:    msg.metrics?.lane_density?.lane_occupancy_pct?.[0] ?? 0,
                lane1:    msg.metrics?.lane_density?.lane_occupancy_pct?.[1] ?? 0,
                lane2:    msg.metrics?.lane_density?.lane_occupancy_pct?.[2] ?? 0,
                lane3:    msg.metrics?.lane_density?.lane_occupancy_pct?.[3] ?? 0,
              }
              const next = [...prev, point]
              return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
            })
          }
        } catch (_) {}
      }

      ws.onerror = () => {}

      ws.onclose = () => {
        setConnected(false)
        reconnectRef.current = setTimeout(connect, RECONNECT_MS)
      }
    } catch (_) {
      reconnectRef.current = setTimeout(connect, RECONNECT_MS)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { data, connected, history }
}
