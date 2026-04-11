import api from './api'

export const getAlarms          = (machineId)  => api.get(`/alarms/${machineId}`)
export const acknowledgeAlarm   = (alarmId)    => api.put(`/alarms/${alarmId}/acknowledge`)
