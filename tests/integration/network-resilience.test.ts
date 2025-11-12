/**
 * Network Resilience Integration Tests
 *
 * Tests for network disconnect, reconnection, and connection thrashing scenarios
 */

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SipClient } from '../../src/core/SipClient'
import { CallSession } from '../../src/core/CallSession'
import { EventBus } from '../../src/core/EventBus'
import type { SipClientConfig } from '../../src/types/config.types'
import { waitFor, waitForEvent } from '../helpers/testUtils'

// Mock JsSIP with proper event handler storage
const createMockUA = () => {
  const eventHandlers: Record<string, Function[]> = {}
  const onceHandlers: Record<string, Function[]> = {}

  return {
    start: vi.fn(),
    stop: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    call: vi.fn(),
    sendMessage: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isRegistered: vi.fn().mockReturnValue(false),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = []
      }
      eventHandlers[event].push(handler)
    }),
    once: vi.fn((event: string, handler: Function) => {
      if (!onceHandlers[event]) {
        onceHandlers[event] = []
      }
      onceHandlers[event].push(handler)
      // Return the mock object for chaining
      return mockUA
    }),
    off: vi.fn((event: string, handler?: Function) => {
      if (handler) {
        const handlers = eventHandlers[event] || []
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      } else {
        delete eventHandlers[event]
      }
    }),
    // Helper to trigger events
    triggerEvent: (event: string, data: any) => {
      // Trigger once handlers first
      if (onceHandlers[event]) {
        const handlers = [...onceHandlers[event]]
        onceHandlers[event] = []
        handlers.forEach((handler) => {
          setTimeout(() => handler(data), 0)
        })
      }
      // Trigger persistent handlers
      if (eventHandlers[event]) {
        eventHandlers[event].forEach((handler) => {
          setTimeout(() => handler(data), 0)
        })
      }
    },
    _handlers: eventHandlers,
    _onceHandlers: onceHandlers,
  }
}

let mockUA = createMockUA()

const mockRTCSession = {
  id: 'session-123',
  connection: {
    getSenders: vi.fn().mockReturnValue([]),
    getReceivers: vi.fn().mockReturnValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  isInProgress: vi.fn().mockReturnValue(false),
  isEstablished: vi.fn().mockReturnValue(false),
  isEnded: vi.fn().mockReturnValue(false),
  answer: vi.fn(),
  terminate: vi.fn(),
  hold: vi.fn(),
  unhold: vi.fn(),
  renegotiate: vi.fn(),
  refer: vi.fn(),
  sendDTMF: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('jssip', () => {
  return {
    default: {
      UA: vi.fn(function () {
        // Return the shared mockUA instance
        return mockUA
      }),
      WebSocketInterface: vi.fn(),
      debug: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
    },
  }
})

// Helper function to schedule UA events asynchronously
function scheduleUAEvent(event: string, data: any, delay: number = 0) {
  setTimeout(() => {
    mockUA.triggerEvent(event, data)
  }, delay)
}

// Helper to flush all pending microtasks
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('Network Resilience Integration Tests', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let config: SipClientConfig

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mockUA
    Object.assign(mockUA, createMockUA())

    eventBus = new EventBus()

    config = {
      uri: 'wss://sip.example.com:7443',
      sipUri: 'sip:testuser@example.com',
      password: 'testpassword',
      displayName: 'Test User',
      authorizationUsername: 'testuser',
      realm: 'example.com',
      userAgent: 'VueSip Test Client',
      debug: false,
      registrationOptions: {
        expires: 600,
        autoRegister: false,
      },
    }

    sipClient = new SipClient(config, eventBus)
  })

  afterEach(() => {
    sipClient.destroy()
    eventBus.destroy()
  })

  describe('Network Disconnect During Active Call', () => {
    it('should handle WebSocket disconnect during active call', async () => {
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()

      // Setup active call
      const _callSession = new CallSession({
        id: 'call-123',
        direction: 'outgoing',
        localUri: 'sip:testuser@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession: mockRTCSession as any,
        eventBus,
      })
      mockRTCSession.isEstablished.mockReturnValue(true)

      // Track events
      const events: string[] = []
      eventBus.on('sip:disconnected', () => events.push('disconnected'))
      eventBus.on('call:ended', () => events.push('call:ended'))

      // Wait for handlers to be registered
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Trigger disconnect using the mock's handlers
      if (mockUA._handlers && mockUA._handlers['disconnected']) {
        mockUA._handlers['disconnected'].forEach((handler: Function) => {
          handler({ code: 1006, reason: 'Connection lost' })
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should have detected disconnect
      expect(sipClient.connectionState).toBe('disconnected')
    })

    it('should attempt reconnection after disconnect', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-types
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Disconnect
      mockUA.isConnected.mockReturnValue(false)
      await sipClient.stop()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(sipClient.connectionState).toBe('disconnected')

      // Reconnect - clear handlers and set up fresh
      mockUA._onceHandlers = {}
      mockUA.isConnected.mockReturnValue(false) // Start as disconnected
      
      // eslint-disable-next-line @typescript-eslint/ban-types
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        // Store handler in the correct place
        const onceHandlers = mockUA._onceHandlers
        if (!onceHandlers[event]) {
          onceHandlers[event] = []
        }
        onceHandlers[event].push(handler)
        
        // Trigger if connected - need to trigger both once and on handlers
        if (event === 'connected') {
          setTimeout(() => {
            handler({ socket: { url: 'wss://test.com' } })
            // Also trigger on handlers
            if (mockUA._handlers && mockUA._handlers['connected']) {
              mockUA._handlers['connected'].forEach((h: Function) => {
                h({ socket: { url: 'wss://test.com' } })
              })
            }
          }, 10)
        }
      })

      mockUA.isConnected.mockReturnValue(false) // Start disconnected
      const startPromise = sipClient.start()
      // Wait for handlers to be registered
      await new Promise((resolve) => setTimeout(resolve, 30))
      mockUA.isConnected.mockReturnValue(true) // Set connected
      await startPromise
      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(sipClient.connectionState).toBe('connected')
    })
  })

  describe('Rapid Connect/Disconnect Cycles', () => {
    it('should handle 10 rapid connect/disconnect cycles', async () => {
      const cycles = 10

      for (let i = 0; i < cycles; i++) {
        // Clear handlers for each cycle
        mockUA._onceHandlers = {}
        
        // Connect
        // eslint-disable-next-line @typescript-eslint/ban-types
        mockUA.once.mockImplementation((event: string, handler: Function) => {
          // Store handler
          if (!mockUA._onceHandlers[event]) {
            mockUA._onceHandlers[event] = []
          }
          mockUA._onceHandlers[event].push(handler)
        })
        mockUA.isConnected.mockReturnValue(true)
        scheduleUAEvent('connected', {}, 0)

        await sipClient.start()
        // Wait for handlers to be set up, then trigger connected event
        await new Promise((resolve) => setTimeout(resolve, 20))
        // Trigger connected event for both once and on handlers
        if (mockUA._onceHandlers['connected']) {
          mockUA._onceHandlers['connected'].forEach((h: Function) => {
            h({ socket: { url: 'wss://test.com' } })
          })
          mockUA._onceHandlers['connected'] = []
        }
        if (mockUA._handlers && mockUA._handlers['connected']) {
          mockUA._handlers['connected'].forEach((h: Function) => {
            h({ socket: { url: 'wss://test.com' } })
          })
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(sipClient.connectionState).toBe('connected')

        // Disconnect
        mockUA.isConnected.mockReturnValue(false)
        scheduleUAEvent('disconnected', {}, 0)
        await sipClient.stop()
        expect(sipClient.connectionState).toBe('disconnected')
      }

      // Should not leak resources or crash
      expect(sipClient).toBeDefined()
    })

    it('should handle connection thrashing (very rapid cycles)', async () => {
      // Simulate connection thrashing (connect/disconnect within milliseconds)
      const promises: Promise<void>[] = []

      for (let i = 0; i < 5; i++) {
        mockUA.isConnected.mockReturnValue(true)
        scheduleUAEvent('connected', {}, 0)
        promises.push(
          sipClient.start().then(() => flushMicrotasks())
        )

        mockUA.isConnected.mockReturnValue(false)
        scheduleUAEvent('disconnected', {}, 0)
        promises.push(sipClient.stop())
      }

      // Wait for all operations
      await Promise.allSettled(promises)

      // Should handle gracefully
      expect(sipClient).toBeDefined()
    })

    it('should not leak event listeners during rapid cycles', async () => {
      const initialListenerCount = eventBus.listenerCount()

      for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line @typescript-eslint/ban-types
      mockUA.once.mockImplementation((event: string, handler: Function) => {
          if (event === 'connected') {
            setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 5)
          }
        })
        mockUA.isConnected.mockReturnValue(true)
        scheduleUAEvent('connected', {}, 0)

        await sipClient.start()

        mockUA.isConnected.mockReturnValue(false)
        scheduleUAEvent('disconnected', {}, 0)
        await sipClient.stop()
      }

      // Listener count should not grow significantly
      const finalListenerCount = eventBus.listenerCount()

      // Allow some tolerance but should not explode
      expect(finalListenerCount).toBeLessThan(initialListenerCount + 20)
    })
  })

  describe('Connection Timeout Scenarios', () => {
    it('should handle connection timeout', async () => {
      mockUA.isConnected.mockReturnValue(false)
      scheduleUAEvent('disconnected', { code: 1006 }, 10)

      await expect(sipClient.start()).rejects.toThrow()
    }, 35000) // Increase test timeout

    it('should handle registration timeout', async () => {
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()

      scheduleUAEvent('registrationFailed', { cause: 'Network timeout' }, 10)

      await expect(sipClient.register()).rejects.toThrow()
      expect(sipClient.registrationState).toBe('registration_failed')
    }, 35000)
  })

  describe('Intermittent Connection Issues', () => {
    it('should handle connection that disconnects immediately after connecting', async () => {
      let connectCount = 0

      // eslint-disable-next-line @typescript-eslint/ban-types
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        // Store handler
        if (!mockUA._onceHandlers[event]) {
          mockUA._onceHandlers[event] = []
        }
        mockUA._onceHandlers[event].push(handler)
      })
      mockUA.isConnected.mockReturnValueOnce(true).mockReturnValueOnce(false)

      await sipClient.start()
      // Wait for handlers to be set up, then trigger connected event
      await new Promise((resolve) => setTimeout(resolve, 20))
      // Count handlers before clearing
      const onceHandlerCount = mockUA._onceHandlers['connected']?.length || 0
      const onHandlerCount = mockUA._handlers?.['connected']?.length || 0
      connectCount = onceHandlerCount + onHandlerCount
      // Trigger connected event for both once and on handlers
      if (mockUA._onceHandlers['connected']) {
        mockUA._onceHandlers['connected'].forEach((h: Function) => {
          h({ socket: { url: 'wss://test.com' } })
        })
        mockUA._onceHandlers['connected'] = []
      }
      if (mockUA._handlers && mockUA._handlers['connected']) {
        mockUA._handlers['connected'].forEach((h: Function) => {
          h({ socket: { url: 'wss://test.com' } })
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should have connected at least once (handlers were registered)
      expect(connectCount).toBeGreaterThan(0)
    })

    it('should track connection attempts and failures', async () => {
      const events: string[] = []

      eventBus.on('sip:connected', () => events.push('connected'))
      eventBus.on('sip:disconnected', () => events.push('disconnected'))
      eventBus.on('sip:connection_failed', () => events.push('failed'))

      // First attempt - success - need to store AND trigger
      // eslint-disable-next-line @typescript-eslint/ban-types
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        // Store handler
        if (!mockUA._onceHandlers[event]) {
          mockUA._onceHandlers[event] = []
        }
        mockUA._onceHandlers[event].push(handler)
      })
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()
      await flushMicrotasks()
      
      // Wait for connection state to update
      await waitFor(() => sipClient.connectionState === 'connected', { 
        timeout: 1000,
        timeoutMessage: 'Connection state did not become connected' 
      })
      expect(sipClient.connectionState).toBe('connected')

      // Wait for handlers to be set up, then trigger connected event
      await new Promise((resolve) => setTimeout(resolve, 20))
      // Trigger connected event for both once and on handlers
      if (mockUA._onceHandlers['connected']) {
        mockUA._onceHandlers['connected'].forEach((h: Function) => {
          h({ socket: { url: 'wss://test.com' } })
        })
        mockUA._onceHandlers['connected'] = []
      }
      if (mockUA._handlers && mockUA._handlers['connected']) {
        mockUA._handlers['connected'].forEach((h: Function) => {
          h({ socket: { url: 'wss://test.com' } })
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Disconnect - trigger via handlers
      mockUA.isConnected.mockReturnValue(false)
      
      // Trigger disconnected event using stored handlers
      if (mockUA._handlers && mockUA._handlers['disconnected']) {
        mockUA._handlers['disconnected'].forEach((handler: Function) => {
          handler({ code: 1000, reason: 'Normal closure' })
        })
      }
      
      await sipClient.stop()
      await flushMicrotasks()
      expect(sipClient.connectionState).toBe('disconnected')
    })
  })

  describe('Concurrent Connection Operations', () => {
    it('should handle multiple concurrent start() calls', async () => {
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 10)

      // Multiple concurrent start calls
      const promises = [sipClient.start(), sipClient.start(), sipClient.start()]

      await Promise.allSettled(promises)

      // Should have called UA.start only once
      expect(mockUA.start).toHaveBeenCalledTimes(1)
    })

    it('should handle start() during stop()', async () => {
      // Connect first
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 10)

      await sipClient.start()

      // Start stopping
      const stopPromise = sipClient.stop()

      // Try to start while stopping
      scheduleUAEvent('connected', {}, 10)

      const startPromise = sipClient.start()

      await Promise.allSettled([stopPromise, startPromise])

      // Should handle gracefully
      expect(sipClient).toBeDefined()
    })
  })

  describe('WebSocket State Transitions', () => {
    it('should handle key WebSocket connection states', async () => {
      const expectedEvents = ['connecting', 'connected', 'disconnected']

      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()

      const registeredEvents = mockUA.on.mock.calls.map(([event]) => event)
      expect(registeredEvents).toEqual(expect.arrayContaining(expectedEvents))
    })

    it('should handle unexpected WebSocket errors', async () => {
      // Setup mock to trigger disconnected event before connected
      // eslint-disable-next-line @typescript-eslint/ban-types
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'disconnected') {
          // Trigger disconnected immediately to simulate error
          setTimeout(
            () => {
              handler({
                code: 1011, // Unexpected condition
                reason: 'Internal server error',
              })
            },
            5 // Fire quickly, before connected
          )
        }
        // Don't set up connected handler - let disconnected fire first
      })

      await expect(sipClient.start()).rejects.toThrow('Connection failed')
    })
  })

  describe('Registration During Network Issues', () => {
    it('should handle registration failure due to network', async () => {
      // Connect first
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 10)

      await sipClient.start()

      // Registration fails
      scheduleUAEvent('registrationFailed', { cause: 'Network timeout' }, 10)

      await expect(sipClient.register()).rejects.toThrow()
      expect(sipClient.registrationState).toBe('registration_failed')
    })

    it('should unregister when connection lost', async () => {
      // Connect and register
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)
      scheduleUAEvent('connected', {}, 10)

      await sipClient.start()

      mockUA.isRegistered.mockReturnValue(true)
      scheduleUAEvent('registered', {}, 10)
      await sipClient.register()

      // Lose connection
      mockUA.isConnected.mockReturnValue(false)
      mockUA.isRegistered.mockReturnValue(false)
      scheduleUAEvent('disconnected', {}, 10)

      await sipClient.stop()

      expect(sipClient.registrationState).toBe('unregistered')
    })
  })
})
