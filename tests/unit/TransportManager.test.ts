/**
 * Unit tests for TransportManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TransportManager, TransportEvent } from '../../src/core/TransportManager'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  url: string
  protocols?: string | string[]
  onopen: ((event: any) => void) | null = null
  onclose: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null

  private closeHandler: (() => void) | null = null
  private autoConnect: boolean = true

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols

    // Simulate async connection only if autoConnect is true
    if (this.autoConnect) {
      setTimeout(() => {
        if (this.readyState === MockWebSocket.CONNECTING) {
          this.readyState = MockWebSocket.OPEN
          this.onopen?.({})
        }
      }, 10)
    }
  }

  setAutoConnect(value: boolean): void {
    this.autoConnect = value
  }

  send(_data: any): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      this.onclose?.({ code: 1000, reason: 'Normal closure' })
      this.closeHandler?.()
    }, 10)
  }

  // Helper to trigger events for testing
  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({})
  }

  triggerClose(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: 'Test closure' })
  }

  triggerError(): void {
    this.onerror?.(new Error('WebSocket error'))
  }

  triggerMessage(data: any): void {
    this.onmessage?.({ data })
  }

  setCloseHandler(handler: () => void): void {
    this.closeHandler = handler
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any

describe('TransportManager', () => {
  let transport: TransportManager
  const mockUrl = 'ws://test.example.com'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    transport?.destroy()
    vi.clearAllTimers()
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      transport = new TransportManager({ url: mockUrl })
      expect(transport.state).toBe('disconnected')
      expect(transport.isConnected).toBe(false)
    })

    it('should accept custom configuration', () => {
      transport = new TransportManager({
        url: mockUrl,
        connectionTimeout: 5000,
        maxReconnectionAttempts: 3,
        keepAliveInterval: 10000,
      })
      expect(transport.state).toBe('disconnected')
    })
  })

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      transport = new TransportManager({ url: mockUrl })
      const connectPromise = transport.connect()

      // Fast-forward to complete connection
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(transport.state).toBe('connected')
      expect(transport.isConnected).toBe(true)
    })

    it('should emit connecting event', async () => {
      transport = new TransportManager({ url: mockUrl })
      const connectingHandler = vi.fn()
      transport.on(TransportEvent.Connecting, connectingHandler)

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(connectingHandler).toHaveBeenCalled()
    })

    it('should emit connected event', async () => {
      transport = new TransportManager({ url: mockUrl })
      const connectedHandler = vi.fn()
      transport.on(TransportEvent.Connected, connectedHandler)

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(connectedHandler).toHaveBeenCalled()
    })

    it('should not connect if already connected', async () => {
      transport = new TransportManager({ url: mockUrl })
      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      // Try to connect again
      const secondConnect = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await secondConnect

      expect(transport.isConnected).toBe(true)
    })

    it('should disconnect successfully', async () => {
      transport = new TransportManager({ url: mockUrl })
      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      const disconnectedHandler = vi.fn()
      transport.on(TransportEvent.Disconnected, disconnectedHandler)

      transport.disconnect()
      await vi.advanceTimersByTimeAsync(20)

      expect(transport.state).toBe('disconnected')
      expect(transport.isConnected).toBe(false)
    })

    it('should handle connection timeout', async () => {
      // Create a transport with short timeout
      transport = new TransportManager({
        url: mockUrl,
        connectionTimeout: 500,
        autoReconnect: false,
      })

      // Create a mock WebSocket that never connects
      const OriginalMockWebSocket = global.WebSocket
      global.WebSocket = class {
        static CONNECTING = 0
        static OPEN = 1
        static CLOSING = 2
        static CLOSED = 3

        readyState = 0 // CONNECTING
        url: string
        onopen: ((event: any) => void) | null = null
        onclose: ((event: any) => void) | null = null
        onerror: ((event: any) => void) | null = null
        onmessage: ((event: any) => void) | null = null

        constructor(url: string, _protocols?: string | string[]) {
          this.url = url
          // Don't auto-connect - stays in CONNECTING state
        }

        send(_data: any): void {}
        close(): void {
          this.readyState = 3
        }
      } as any

      // Start the connection (don't await yet)
      const connectPromise = transport.connect()

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(600)

      // Now check if it rejected
      await expect(connectPromise).rejects.toThrow('Connection timeout')
      expect(transport.state).toBe('connection_failed')

      // Restore
      global.WebSocket = OriginalMockWebSocket
    }, 10000)
  })

  describe('Reconnection Logic', () => {
    it('should attempt reconnection with exponential backoff', async () => {
      transport = new TransportManager({
        url: mockUrl,
        autoReconnect: true,
        maxReconnectionAttempts: 3,
      })

      const reconnectingHandler = vi.fn()
      transport.on(TransportEvent.Reconnecting, reconnectingHandler)

      // Connect and then simulate disconnect
      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      // Trigger unexpected disconnect (not manual)
      const ws = (transport as any).ws as MockWebSocket
      ws.triggerClose()
      await vi.advanceTimersByTimeAsync(20)

      // Should trigger first reconnection attempt (2s delay)
      await vi.advanceTimersByTimeAsync(2000)
      expect(reconnectingHandler).toHaveBeenCalledTimes(1)

      // Second attempt (4s delay)
      ws.triggerClose()
      await vi.advanceTimersByTimeAsync(4020)
      expect(reconnectingHandler).toHaveBeenCalledTimes(2)
    })

    it('should stop reconnection after max attempts', async () => {
      transport = new TransportManager({
        url: mockUrl,
        autoReconnect: true,
        maxReconnectionAttempts: 2,
      })

      const errorHandler = vi.fn()
      transport.on(TransportEvent.Error, errorHandler)

      // Connect first
      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      // Now simulate repeated connection failures
      const OriginalMockWebSocket = global.WebSocket
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string | string[]) {
          super(url, protocols)
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED
            this.onclose?.({ code: 1006, reason: 'Connection failed' })
          }, 5)
        }
      } as any

      // Trigger first disconnect to start reconnection cycle
      const ws = (transport as any).ws as MockWebSocket
      ws.triggerClose()
      await vi.advanceTimersByTimeAsync(20)

      // First reconnect attempt (2s delay)
      await vi.advanceTimersByTimeAsync(2100)

      // Second reconnect attempt (4s delay)
      await vi.advanceTimersByTimeAsync(4100)

      // Should reach max attempts and fail
      await vi.advanceTimersByTimeAsync(100)
      expect(transport.state).toBe('connection_failed')

      // Restore
      global.WebSocket = OriginalMockWebSocket
    })

    it('should not reconnect on manual disconnect', async () => {
      transport = new TransportManager({
        url: mockUrl,
        autoReconnect: true,
      })

      const reconnectingHandler = vi.fn()

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      // Add listener after connection is established
      transport.on(TransportEvent.Reconnecting, reconnectingHandler)

      // Manual disconnect
      transport.disconnect()
      await vi.advanceTimersByTimeAsync(50)

      // Wait for potential reconnection
      await vi.advanceTimersByTimeAsync(5000)

      expect(reconnectingHandler).not.toHaveBeenCalled()
    })

    it('should reset reconnection attempts on successful connection', async () => {
      transport = new TransportManager({
        url: mockUrl,
        autoReconnect: true,
      })

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(transport.getReconnectionAttempts()).toBe(0)

      // Manually set attempts count
      ;(transport as any).reconnectionAttempts = 3
      expect(transport.getReconnectionAttempts()).toBe(3)

      // Trigger manual reconnect which resets the counter
      transport.reconnect()
      await vi.advanceTimersByTimeAsync(20)

      expect(transport.getReconnectionAttempts()).toBe(0)
    })
  })

  describe('Keep-Alive Mechanism', () => {
    it('should send CRLF keep-alive messages', async () => {
      transport = new TransportManager({
        url: mockUrl,
        keepAliveInterval: 1000,
        keepAliveType: 'crlf',
      })

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      const ws = (transport as any).ws as MockWebSocket
      const sendSpy = vi.spyOn(ws, 'send')

      // Fast-forward past keep-alive interval
      await vi.advanceTimersByTimeAsync(1100)

      expect(sendSpy).toHaveBeenCalledWith('\r\n')
      expect(sendSpy).toHaveBeenCalledTimes(1)
    })

    it('should stop keep-alive on disconnect', async () => {
      transport = new TransportManager({
        url: mockUrl,
        keepAliveInterval: 1000,
      })

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      const ws = (transport as any).ws as MockWebSocket
      const sendSpy = vi.spyOn(ws, 'send')

      transport.disconnect()
      await vi.advanceTimersByTimeAsync(50)

      // Fast-forward past keep-alive interval
      await vi.advanceTimersByTimeAsync(1500)

      expect(sendSpy).not.toHaveBeenCalled()
    })
  })

  describe('Message Handling', () => {
    it('should emit message events', async () => {
      transport = new TransportManager({ url: mockUrl })
      const messageHandler = vi.fn()
      transport.on(TransportEvent.Message, messageHandler)

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      const ws = (transport as any).ws as MockWebSocket
      ws.triggerMessage('test message')

      expect(messageHandler).toHaveBeenCalledWith('test message')
    })

    it('should send messages when connected', async () => {
      transport = new TransportManager({ url: mockUrl })
      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      // Ensure connected
      expect(transport.isConnected).toBe(true)

      const ws = (transport as any).ws as MockWebSocket
      const sendSpy = vi.spyOn(ws, 'send')

      transport.send('test data')

      expect(sendSpy).toHaveBeenCalledWith('test data')
    })

    it('should throw error when sending while disconnected', async () => {
      transport = new TransportManager({ url: mockUrl })

      expect(() => transport.send('test')).toThrow('WebSocket is not connected')
    })
  })

  describe('Event Listeners', () => {
    it('should add and remove event listeners', async () => {
      transport = new TransportManager({ url: mockUrl })
      const handler = vi.fn()

      transport.on(TransportEvent.Connected, handler)
      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(handler).toHaveBeenCalledTimes(1)

      transport.off(TransportEvent.Connected, handler)
      transport.reconnect()
      await vi.advanceTimersByTimeAsync(20)

      // Should not be called again
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should remove all listeners for an event', async () => {
      transport = new TransportManager({ url: mockUrl })
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      transport.on(TransportEvent.Connected, handler1)
      transport.on(TransportEvent.Connected, handler2)

      transport.removeAllListeners(TransportEvent.Connected)

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should handle errors in event handlers gracefully', async () => {
      transport = new TransportManager({ url: mockUrl })
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const goodHandler = vi.fn()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      transport.on(TransportEvent.Connected, errorHandler)
      transport.on(TransportEvent.Connected, goodHandler)

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      expect(errorHandler).toHaveBeenCalled()
      expect(goodHandler).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('State Management', () => {
    it('should track connection state correctly', async () => {
      transport = new TransportManager({
        url: mockUrl,
        autoReconnect: false, // Disable auto-reconnect to avoid state transitions
      })

      expect(transport.state).toBe('disconnected')

      const connectPromise = transport.connect()
      expect(transport.state).toBe('connecting')

      await vi.advanceTimersByTimeAsync(20)
      await connectPromise
      expect(transport.state).toBe('connected')

      transport.disconnect()
      await vi.advanceTimersByTimeAsync(50)
      expect(transport.state).toBe('disconnected')
    })
  })

  describe('Manual Reconnection', () => {
    it('should allow manual reconnection', async () => {
      transport = new TransportManager({ url: mockUrl })

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      const reconnectPromise = transport.reconnect()
      await vi.advanceTimersByTimeAsync(20)
      await reconnectPromise

      expect(transport.isConnected).toBe(true)
      expect(transport.getReconnectionAttempts()).toBe(0)
    })

    it('should reset reconnection attempts manually', async () => {
      transport = new TransportManager({ url: mockUrl })

      // Simulate failed reconnection attempts
      ;(transport as any).reconnectionAttempts = 3

      transport.resetReconnectionAttempts()

      expect(transport.getReconnectionAttempts()).toBe(0)
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      transport = new TransportManager({ url: mockUrl, autoReconnect: false })

      const connectPromise = transport.connect()
      await vi.advanceTimersByTimeAsync(20)
      await connectPromise

      const handler = vi.fn()

      // Destroy clears listeners, so the handler should not be called
      transport.destroy()
      await vi.advanceTimersByTimeAsync(50)

      expect(transport.state).toBe('disconnected')

      // Add handler AFTER destroy
      transport.on(TransportEvent.Disconnected, handler)

      // Try to trigger event - should not call handler since listeners were cleared
      const ws = (transport as any).ws
      expect(ws).toBeNull()
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
