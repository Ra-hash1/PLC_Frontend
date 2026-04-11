import api from './api'

export const getMachines       = ()                => api.get('/machines')
export const getMachine        = (machineId)       => api.get(`/machines/${machineId}`)
export const updateMode        = (machineId, mode) => api.put(`/machines/${machineId}/mode`, { mode })
export const getCommandHistory = (machineId, limit = 50) =>
  api.get(`/commands/history/${machineId}?limit=${limit}`)

export const sendCommand = (machineId, command, params = {}, siteId, lineId) =>
  api.post('/commands', { siteId, lineId, machineId, command, params })