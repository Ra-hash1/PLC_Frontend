import { useState, useEffect } from 'react'
import { getTelemetryHistory } from '../services/telemetryService'

export const useTelemetryHistory = (machineId, limit = 50) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!machineId) return
    const fetch = async () => {
      try {
        const res = await getTelemetryHistory(machineId, { limit })
        setHistory(res.data.data || [])
      } catch (e) {
        console.error('Failed to fetch telemetry history', e)
      } finally {
        setLoading(false)
      }
    }
    fetch()
    const interval = setInterval(fetch, 10000) // refresh every 10s
    return () => clearInterval(interval)
  }, [machineId, limit])

  return { history, loading }
}
