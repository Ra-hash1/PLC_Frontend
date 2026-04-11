import api from './api'

export const getLatestTelemetry = (machineId) =>
  api.get(`/telemetry/${machineId}/latest`)

export const getTelemetryHistory = (machineId, { from, to, limit = 100 } = {}) => {
  const params = new URLSearchParams({ limit })
  if (from) params.append('from', from)
  if (to)   params.append('to', to)
  return api.get(`/telemetry/${machineId}/history?${params}`)
}
