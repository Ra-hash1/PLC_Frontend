// websocket.js

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000'

class WebSocketService {
  constructor() {
    this.ws              = null
    this.handlers        = new Set()
    this.reconnectTimer  = null
    this.shouldReconnect = true
    this.reconnectDelay  = 3000
    this.machineId       = null
    this.pingInterval    = null
  }

  connect(machineId, onMessage) {
    if (onMessage) this.handlers.add(onMessage)

    // Don't connect if machineId is not real yet
    if (!machineId || machineId === '__none__') return

    // Prevent duplicate connection (Strict Mode safe)
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    // Already connected to same machine
    if (
      this.machineId === machineId &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      if (onMessage) onMessage({ type: 'connected' })
      return
    }

    this.machineId       = machineId
    this.shouldReconnect = true
    this._createConnection()
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
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close()
        }

        this.ws.onopen    = null
        this.ws.onmessage = null
        this.ws.onerror   = null
        this.ws.onclose   = null
        this.ws = null
      }
    }
  }

  _createConnection() {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
      }
      this.ws = null
    }

    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      this.reconnectDelay = 3000

      this.ws.send(
        JSON.stringify({
          type:      'subscribe',
          machineId: this.machineId,
        })
      )

      this._startHeartbeat()
      this.handlers.forEach(h => h({ type: 'connected' }))
    }

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
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

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const wsService = new WebSocketService()