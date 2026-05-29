import { useState, useEffect, useCallback, useRef } from 'react'
import { wsService } from '../services/websocket'
import { decodeTelemetry } from '../utils/telemetryDecoder'

const DEFAULT_MACHINE_ID = import.meta.env.VITE_MACHINE_ID || 'machine_01'

/**
 * useWebSocket
 *
 * Aligned with mobile app protocol:
 *  • subscribe message: { action, siteId, lineId, machineId }
 *  • inbound types:  connected | disconnected | snapshot | telemetry | machine_status | alarm | alarm_cleared
 *
 * @param {string} machineId
 * @param {string} siteId   – forwarded in subscribe message; pass once machine metadata loads
 * @param {string} lineId   – forwarded in subscribe message
 */
export const useWebSocket = (
  machineId = DEFAULT_MACHINE_ID,
  siteId    = '',
  lineId    = '',
) => {
  const [telemetry,  setTelemetry]  = useState(null)
  const [decoded,    setDecoded]    = useState(null)
  const [connected,  setConnected]  = useState(false)
  const [lastAlarm,  setLastAlarm]  = useState(null)
  const [dbStatus,   setDbStatus]   = useState(null)
  const [lastDataAt, setLastDataAt] = useState(null)
  const [plcState,   setPlcState]   = useState({
    feedbackFresh:      null,
    readyToRun:         null,
    actuallyRunning:    null,
    faulted:            null,
    stopping:           null,
    disabled:           null,
    remoteStartAllowed: null,
  })

  // The very first frame (snapshot) is a DB dump.  It does NOT mean the
  // machine is live right now, so we don't advance lastDataAt for it.
  const snapshotConsumedRef = useRef(false)

  // Reset on machineId change
  useEffect(() => {
    snapshotConsumedRef.current = false
    setLastDataAt(null)
    setPlcState({
      feedbackFresh:      null,
      readyToRun:         null,
      actuallyRunning:    null,
      faulted:            null,
      stopping:           null,
      disabled:           null,
      remoteStartAllowed: null,
    })
  }, [machineId])

  const handler = useCallback((msg) => {
    switch (msg.type) {
      // ── Connection lifecycle ───────────────────────────────────────────────
      case 'connected':
        setConnected(true)
        snapshotConsumedRef.current = false   // re-arm for next snapshot
        break

      case 'disconnected':
        setConnected(false)
        snapshotConsumedRef.current = false
        break

      // ── Initial DB snapshot ────────────────────────────────────────────────
      // Treat exactly like the first telemetry frame: load into state but
      // do NOT update lastDataAt (machine may not be live right now).
      case 'snapshot': {
        const raw = msg.data
        if (!raw || typeof raw !== 'object') break
        snapshotConsumedRef.current = true
        setTelemetry(prev => {
          const merged = { ...prev, ...raw }
          setDecoded(decodeTelemetry(merged))
          return merged
        })
        break
      }

      // ── Live telemetry frame ───────────────────────────────────────────────
      case 'telemetry': {
        const raw = msg.data

        // Validate: must have at least one recognised telemetry field.
        // Covers both current ESP32 payload (canState, deviceUptimeMs, telemetryTxCounter)
        // and future fields (servos, statusWord, cycleCount, etc.)
        const KNOWN_FIELDS = [
          'canState', 'canNodeId', 'statusWord', 'errorCode', 'statusFlags',
          'operationEnabled', 'faultActive', 'warningActive', 'remoteActive',
          'modeDisplay', 'deviceUptimeMs', 'rpdoRxCounter', 'telemetryTxCounter',
          'cycleCount', 'servos', 'canopenNodes',
        ]
        const hasKnownField = raw && typeof raw === 'object' &&
          KNOWN_FIELDS.some(k => raw[k] !== undefined)
        if (!hasKnownField) break

        if (!snapshotConsumedRef.current) {
          // First live frame — treat as snapshot, don't mark live yet
          snapshotConsumedRef.current = true
        } else {
          // Subsequent frames — machine is genuinely live
          setLastDataAt(Date.now())
        }

        setTelemetry(prev => {
          const merged = { ...prev, ...raw }
          setDecoded(decodeTelemetry(merged))
          return merged
        })
        break
      }

      // ── DB status update from server ───────────────────────────────────────
      case 'machine_status':
        setDbStatus(msg.status)
        // Extract PLC state flags if present in the WS message
        setPlcState({
          feedbackFresh:      msg.plcFeedbackFresh       ?? null,
          readyToRun:         msg.machineReadyToRun      ?? null,
          actuallyRunning:    msg.machineActuallyRunning  ?? null,
          faulted:            msg.machineFaulted         ?? null,
          stopping:           msg.machineStopping        ?? null,
          disabled:           msg.machineDisabled        ?? null,
          remoteStartAllowed: msg.remoteStartAllowed     ?? null,
        })
        break

      // ── Alarm events ───────────────────────────────────────────────────────
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

  // Connect / reconnect when machineId or siteId/lineId change
  useEffect(() => {
    wsService.connect({ machineId, siteId, lineId }, handler)
    return () => wsService.disconnect(handler)
  }, [machineId, siteId, lineId, handler])

  // If siteId or lineId arrive late (after machine metadata loads), push an
  // updated subscription without a full reconnect.
  const prevMetaRef = useRef({ siteId: '', lineId: '' })
  useEffect(() => {
    const prev = prevMetaRef.current
    if ((siteId && siteId !== prev.siteId) || (lineId && lineId !== prev.lineId)) {
      prevMetaRef.current = { siteId, lineId }
      wsService.resubscribe({ machineId, siteId, lineId })
    }
  }, [machineId, siteId, lineId])

  return {
    telemetry,
    decoded,
    connected,
    lastAlarm,
    dbStatus,
    lastDataAt,
    // expose decoded arrays directly for convenience
    servos:       decoded?.servos       ?? [],
    canopenNodes: decoded?.canopenNodes ?? [],
    plcState,
  }
}
