// websocket.js — aligned with mobile app protocol (action-based subscribe)

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000'

class WebSocketService {
  constructor() {
    this.ws              = null
    this.handlers        = new Set()
    this.reconnectTimer  = null
    this.shouldReconnect = true
    this.reconnectDelay  = 3000
    this.subscription    = null   // { siteId, lineId, machineId }
    this.pingInterval    = null
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a message handler and open / reuse a connection.
   * subscription: { siteId, lineId, machineId }
   */
  connect(subscription, onMessage) {
    if (onMessage) this.handlers.add(onMessage)

    const { machineId, siteId = '', lineId = '' } = subscription || {}
    if (!machineId || machineId === '__none__') return

    // Prevent duplicate connection while already connecting
    if (this.ws?.readyState === WebSocket.CONNECTING) return

    // If same machine is already open, just confirm connected
    if (
      this.subscription?.machineId === machineId &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      if (onMessage) onMessage({ type: 'connected' })
      return
    }

    this.subscription    = { siteId, lineId, machineId }
    this.shouldReconnect = true
    this._createConnection()
  }

  /**
   * Send an updated subscription (e.g. after siteId/lineId load from API).
   * Re-sends subscribe over the open socket without reconnecting.
   */
  resubscribe(subscription) {
    const { siteId = '', lineId = '', machineId } = subscription || {}
    if (!machineId) return
    this.subscription = { siteId, lineId, machineId }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', siteId, lineId, machineId }))
    }
  }

  disconnect(onMessage) {
    if (onMessage) this.handlers.delete(onMessage)

    if (this.handlers.size === 0) {
      this.shouldReconnect = false

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }

      this._clearHeartbeat()

      if (this.ws) {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.close()
        this.ws.onopen    = null
        this.ws.onmessage = null
        this.ws.onerror   = null
        this.ws.onclose   = null
        this.ws = null
      }
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _createConnection() {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close()
      this.ws = null
    }

    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      this.reconnectDelay = 3000

      // Send subscribe in mobile-app format
      const { siteId = '', lineId = '', machineId } = this.subscription || {}
      if (machineId) {
        this.ws.send(JSON.stringify({ action: 'subscribe', siteId, lineId, machineId }))
      }

      this._startHeartbeat()
      this.handlers.forEach(h => h({ type: 'connected' }))
    }

    this.ws.onmessage = (event) => {
      try {
        const parsed = typeof event.data === 'string'
          ? JSON.parse(event.data)
          : event.data

        // Drop API-Gateway Forbidden responses
        if (parsed?.message === 'Forbidden') return

        // Map mobile-style message types to web handler events
        const rawType = parsed?.type

        if (rawType === 'subscribed') {
          // Backend confirmed subscription — treat as connected
          this.handlers.forEach(h => h({ type: 'connected' }))
          return
        }

        if (rawType === 'snapshot') {
          // Initial DB snapshot — forward as telemetry snapshot
          const payload = parsed?.data ?? parsed
          this.handlers.forEach(h => h({ type: 'snapshot', data: payload }))
          return
        }

        // All other messages are forwarded as-is (telemetry, machine_status, alarm, etc.)
        this.handlers.forEach(h => h(parsed))

      } catch (e) {
        console.error('❌ WS parse error:', e)
      }
    }

    this.ws.onerror = (err) => {
      console.error('❌ WebSocket error:', err)
    }

    this.ws.onclose = (event) => {
      this._clearHeartbeat()
      this.handlers.forEach(h => h({ type: 'disconnected' }))

      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000)
          this._createConnection()
        }, this.reconnectDelay)
      }
    }
  }

  _startHeartbeat() {
    this._clearHeartbeat()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  _clearHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}

export const wsService = new WebSocketService()
