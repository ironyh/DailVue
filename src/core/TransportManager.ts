/**
 * TransportManager - Manages WebSocket connection for SIP transport
 * Handles connection lifecycle, reconnection logic, and keep-alive mechanisms
 * @packageDocumentation
 */

import type { ConnectionState } from '../types/sip.types'

/**
 * Transport event types
 */
export enum TransportEvent {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
  Message = 'message',
  Connecting = 'connecting',
  Reconnecting = 'reconnecting',
}

/**
 * Transport configuration options
 */
export interface TransportConfig {
  /** WebSocket server URL */
  url: string
  /** WebSocket protocols */
  protocols?: string | string[]
  /** Connection timeout in milliseconds (default: 10000) */
  connectionTimeout?: number
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectionAttempts?: number
  /** Initial reconnection delay in milliseconds (default: 2000) */
  initialReconnectionDelay?: number
  /** Keep-alive interval in milliseconds (default: 30000) */
  keepAliveInterval?: number
  /** Keep-alive type: 'crlf' or 'options' (default: 'crlf') */
  keepAliveType?: 'crlf' | 'options'
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean
}

/**
 * Transport event handler type
 */
type TransportEventHandler = (event: any) => void

/**
 * TransportManager manages WebSocket connections for SIP communication
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection keep-alive (CRLF ping or OPTIONS)
 * - Connection timeout handling
 * - State transition management
 * - Event-driven architecture
 */
export class TransportManager {
  private ws: WebSocket | null = null
  private config: Required<TransportConfig>
  private currentState: ConnectionState
  private reconnectionAttempts = 0
  private reconnectionTimer: ReturnType<typeof setTimeout> | null = null
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private eventListeners: Map<TransportEvent, Set<TransportEventHandler>> = new Map()
  private isManualDisconnect = false

  /**
   * Reconnection delays in milliseconds: 2s, 4s, 8s, 16s, 32s
   */
  private readonly RECONNECTION_DELAYS = [2000, 4000, 8000, 16000, 32000]

  constructor(config: TransportConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols,
      connectionTimeout: config.connectionTimeout ?? 10000,
      maxReconnectionAttempts: config.maxReconnectionAttempts ?? 5,
      initialReconnectionDelay: config.initialReconnectionDelay ?? 2000,
      keepAliveInterval: config.keepAliveInterval ?? 30000,
      keepAliveType: config.keepAliveType ?? 'crlf',
      autoReconnect: config.autoReconnect ?? true,
    }
    this.currentState = 'disconnected' as ConnectionState
  }

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this.currentState
  }

  /**
   * Check if currently connected
   */
  get isConnected(): boolean {
    return (
      this.currentState === ('connected' as ConnectionState) &&
      this.ws?.readyState === WebSocket.OPEN
    )
  }

  /**
   * Add event listener
   */
  on(event: TransportEvent, handler: TransportEventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
  }

  /**
   * Remove event listener
   */
  off(event: TransportEvent, handler: TransportEventHandler): void {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Remove all event listeners for a specific event type
   */
  removeAllListeners(event?: TransportEvent): void {
    if (event) {
      this.eventListeners.delete(event)
    } else {
      this.eventListeners.clear()
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(event: TransportEvent, data?: any): void {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in ${event} handler:`, error)
        }
      })
    }
  }

  /**
   * Update connection state and emit events
   */
  private setState(newState: ConnectionState): void {
    if (this.currentState !== newState) {
      this.currentState = newState

      // Emit appropriate event based on state
      switch (newState) {
        case 'connected' as ConnectionState:
          this.emit(TransportEvent.Connected, { state: newState })
          break
        case 'disconnected' as ConnectionState:
          this.emit(TransportEvent.Disconnected, { state: newState })
          break
        case 'connecting' as ConnectionState:
          this.emit(TransportEvent.Connecting, { state: newState })
          break
        case 'reconnecting' as ConnectionState:
          this.emit(TransportEvent.Reconnecting, {
            state: newState,
            attempt: this.reconnectionAttempts,
          })
          break
        case 'error' as ConnectionState:
        case 'connection_failed' as ConnectionState:
          this.emit(TransportEvent.Error, { state: newState })
          break
      }
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    this.isManualDisconnect = false
    this.setState('connecting' as ConnectionState)
    this.clearTimers()

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection
        this.ws = new WebSocket(this.config.url, this.config.protocols)

        // Set up connection timeout
        this.connectionTimeoutTimer = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close()
            this.setState('connection_failed' as ConnectionState)
            reject(new Error('Connection timeout'))
            this.handleReconnection()
          }
        }, this.config.connectionTimeout)

        // WebSocket event handlers
        this.ws.onopen = () => {
          this.clearConnectionTimeout()
          this.setState('connected' as ConnectionState)
          this.reconnectionAttempts = 0
          this.startKeepAlive()
          resolve()
        }

        this.ws.onclose = (_event) => {
          this.clearConnectionTimeout()
          this.clearKeepAlive()
          this.setState('disconnected' as ConnectionState)

          if (!this.isManualDisconnect) {
            this.handleReconnection()
          }
        }

        this.ws.onerror = (error) => {
          this.clearConnectionTimeout()
          this.setState('error' as ConnectionState)
          console.error('WebSocket error:', error)
        }

        this.ws.onmessage = (event) => {
          this.emit(TransportEvent.Message, event.data)
        }
      } catch (error) {
        this.setState('error' as ConnectionState)
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualDisconnect = true
    this.clearTimers()

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }

    this.setState('disconnected' as ConnectionState)
    this.reconnectionAttempts = 0
  }

  /**
   * Send data through WebSocket
   */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected')
    }

    try {
      this.ws.send(data)
    } catch (error) {
      console.error('Failed to send data:', error)
      throw error
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnection(): void {
    if (!this.config.autoReconnect) {
      return
    }

    if (this.reconnectionAttempts >= this.config.maxReconnectionAttempts) {
      console.error('Max reconnection attempts reached')
      this.setState('connection_failed' as ConnectionState)
      return
    }

    this.setState('reconnecting' as ConnectionState)

    // Calculate delay with exponential backoff
    const delay =
      this.RECONNECTION_DELAYS[
        Math.min(this.reconnectionAttempts, this.RECONNECTION_DELAYS.length - 1)
      ]

    this.reconnectionAttempts++

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectionAttempts}/${this.config.maxReconnectionAttempts})`
    )

    this.reconnectionTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * Start keep-alive mechanism
   */
  private startKeepAlive(): void {
    this.clearKeepAlive()

    this.keepAliveTimer = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          if (this.config.keepAliveType === 'crlf') {
            // Send CRLF ping
            this.ws.send('\r\n')
          } else {
            // Send OPTIONS keep-alive (SIP-specific)
            // This would typically be handled by the SIP client layer
            // but we provide the mechanism here
            this.emit(TransportEvent.Message, '__keep_alive_options__')
          }
        } catch (error) {
          console.error('Keep-alive failed:', error)
          this.clearKeepAlive()
        }
      }
    }, this.config.keepAliveInterval)
  }

  /**
   * Clear keep-alive timer
   */
  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  /**
   * Clear connection timeout timer
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer)
      this.connectionTimeoutTimer = null
    }
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectionTimer(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer)
      this.reconnectionTimer = null
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    this.clearKeepAlive()
    this.clearConnectionTimeout()
    this.clearReconnectionTimer()
  }

  /**
   * Manually trigger reconnection
   */
  reconnect(): Promise<void> {
    this.disconnect()
    this.reconnectionAttempts = 0
    return this.connect()
  }

  /**
   * Reset reconnection counter
   */
  resetReconnectionAttempts(): void {
    this.reconnectionAttempts = 0
  }

  /**
   * Get current reconnection attempt count
   */
  getReconnectionAttempts(): number {
    return this.reconnectionAttempts
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnect()
    this.removeAllListeners()
  }
}
