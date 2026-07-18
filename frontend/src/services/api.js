import axios from 'axios'

const BASE = 'http://localhost:8000'

export const api = {
  // Stream control
  startSimulation: (config = {}) =>
    axios.post(`${BASE}/api/video/start-simulation`, config),
  uploadVideo: (file, onProgress) => {
    const fd = new FormData()
    fd.append('file', file)
    return axios.post(`${BASE}/api/video/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => onProgress?.(Math.round(e.loaded / e.total * 100)),
    })
  },
  pause:  () => axios.post(`${BASE}/api/video/pause`),
  resume: () => axios.post(`${BASE}/api/video/resume`),
  stop:   () => axios.post(`${BASE}/api/video/stop`),
  reset:  () => axios.post(`${BASE}/api/video/reset`),
  status: () => axios.get(`${BASE}/api/video/status`),

  // Data
  currentSignal:  () => axios.get(`${BASE}/api/signal/current`),
  currentMetrics: () => axios.get(`${BASE}/api/signal/metrics`),
  history:        (sessionId, limit = 100) =>
    axios.get(`${BASE}/api/signal/history`, { params: { session_id: sessionId, limit } }),

  health: () => axios.get(`${BASE}/health`),
}
