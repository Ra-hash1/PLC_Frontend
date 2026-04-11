import { useState, useEffect, useCallback, useRef } from 'react'
import { wsService } from '../services/websocket'
import { decodeTelemetry } from '../utils/telemetryDecoder'

const DEFAULT_MACHINE_ID = import.meta.env.VITE_MACHINE_ID || 'machine_01'

export const useWebSocket = (machineId = DEFAULT_MACHINE_ID) => {
  const [telemetry,  setTelemetry]  = useState(null)
  const [decoded,    setDecoded]    = useState(null)
  const [connected,  setConnected]  = useState(false)
  const [lastAlarm,  setLastAlarm]  = useState(null)
  const [dbStatus,   setDbStatus]   = useState(null)
  const [lastDataAt, setLastDataAt] = useState(null)

  // Tracks whether the first telemetry frame (snapshot) has been consumed.
  // The snapshot is a DB dump — it doesn't prove the machine is live right now.
  // Only frames arriving AFTER the snapshot should update lastDataAt.
  const snapshotConsumedRef = useRef(false)

  // Reset on machineId change so switching machines starts fresh
  useEffect(() => {
    snapshotConsumedRef.current = false
    setLastDataAt(null)
  }, [machineId])

  const handler = useCallback((msg) => {
    switch (msg.type) {
      case 'connected':
        setConnected(true)
        break

      case 'disconnected':
        setConnected(false)
        // Reset snapshot flag so the next reconnect skips snapshot again
        snapshotConsumedRef.current = false
        break

      case 'telemetry': {
        const raw = msg.data

        if (!snapshotConsumedRef.current) {
          // This is the initial snapshot — load it into state but do NOT
          // update lastDataAt. It doesn't mean the machine is live right now.
          snapshotConsumedRef.current = true
        } else {
          // All subsequent frames are real-time — machine is genuinely live
          setLastDataAt(Date.now())
        }

        setTelemetry(prev => {
          const merged = { ...prev, ...raw }
          setDecoded(decodeTelemetry(merged))
          return merged
        })
        break
      }

      case 'machine_status':
        setDbStatus(msg.status)
        break

      case 'alarm':
        setLastAlarm(msg.data)
        break

      case 'alarm_cleared':
        setLastAlarm(null)
        break

      default:
        break
    }
  }, [])

  useEffect(() => {
    wsService.connect(machineId, handler)
    return () => wsService.disconnect(handler)
  }, [machineId, handler])

  return { telemetry, decoded, connected, lastAlarm, dbStatus, lastDataAt }
}