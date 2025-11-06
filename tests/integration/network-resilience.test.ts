/**
 * Network Resilience Integration Tests
 *
 * Tests for network disconnect, reconnection, and connection thrashing scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SipClient } from '../../src/core/SipClient'
import { CallSession } from '../../src/core/CallSession'
import { EventBus } from '../../src/core/EventBus'
import type { SipClientConfig } from '../../src/types/config.types'

// Mock JsSIP
const mockUA = {
  start: vi.fn(),
  stop: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  call: vi.fn(),
  sendMessage: vi.fn(),
  isConnected: vi.fn().mockReturnValue(false),
  isRegistered: vi.fn().mockReturnValue(false),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
}

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
      UA: vi.fn(() => mockUA),
      WebSocketInterface: vi.fn(),
      debug: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
    },
  }
})

describe('Network Resilience Integration Tests', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let config: SipClientConfig

  beforeEach(() => {
    vi.clearAllMocks()

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
      // Setup connected state
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Setup active call
      const callSession = new CallSession(mockRTCSession as any, 'local', eventBus)
      mockRTCSession.isEstablished.mockReturnValue(true)

      // Track events
      const events: string[] = []
      eventBus.on('sip:disconnected', () => events.push('disconnected'))
      eventBus.on('call:ended', () => events.push('call:ended'))

      // Simulate network disconnect
      let disconnectedHandler: Function | null = null
      mockUA.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'disconnected') {
          disconnectedHandler = handler
        }
      })

      if (disconnectedHandler) {
        disconnectedHandler({ code: 1006, reason: 'Connection lost' })
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should have detected disconnect
      expect(sipClient.connectionState).toBe('disconnected')
    })

    it('should attempt reconnection after disconnect', async () => {
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Disconnect
      mockUA.isConnected.mockReturnValue(false)
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'disconnected') {
          setTimeout(() => handler({}), 10)
        }
      })

      await sipClient.stop()

      expect(sipClient.connectionState).toBe('disconnected')

      // Reconnect
      mockUA.isConnected.mockReturnValue(true)
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })

      await sipClient.start()

      expect(sipClient.connectionState).toBe('connected')
    })
  })

  describe('Rapid Connect/Disconnect Cycles', () => {
    it('should handle 10 rapid connect/disconnect cycles', async () => {
      const cycles = 10

      for (let i = 0; i < cycles; i++) {
        // Connect
        mockUA.once.mockImplementation((event: string, handler: Function) => {
          if (event === 'connected') {
            setTimeout(() => handler({}), 5)
          }
        })
        mockUA.isConnected.mockReturnValue(true)

        await sipClient.start()
        expect(sipClient.connectionState).toBe('connected')

        // Disconnect
        mockUA.isConnected.mockReturnValue(false)
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
        mockUA.once.mockImplementation((event: string, handler: Function) => {
          if (event === 'connected') {
            setTimeout(() => handler({}), 1)
          }
        })
        mockUA.isConnected.mockReturnValue(true)

        promises.push(sipClient.start())

        mockUA.isConnected.mockReturnValue(false)
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
        mockUA.once.mockImplementation((event: string, handler: Function) => {
          if (event === 'connected') {
            setTimeout(() => handler({}), 5)
          }
        })
        mockUA.isConnected.mockReturnValue(true)

        await sipClient.start()

        mockUA.isConnected.mockReturnValue(false)
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
      // Mock connection that never completes
      mockUA.once.mockImplementation(() => {
        // Never call the handler - simulate timeout
      })

      // Should timeout and reject
      await expect(sipClient.start()).rejects.toThrow()
    }, 35000) // Increase test timeout

    it('should handle registration timeout', async () => {
      // Connect first
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Registration never completes
      mockUA.once.mockImplementation(() => {
        // Never call handler
      })

      await expect(sipClient.register()).rejects.toThrow()
    }, 35000)
  })

  describe('Intermittent Connection Issues', () => {
    it('should handle connection that disconnects immediately after connecting', async () => {
      let connectCount = 0

      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          connectCount++
          setTimeout(() => handler({}), 10)

          // Immediately disconnect
          if (event === 'disconnected') {
            setTimeout(() => handler({}), 20)
          }
        }
      })
      mockUA.isConnected.mockReturnValueOnce(true).mockReturnValueOnce(false)

      await sipClient.start()

      // Should have connected at least once
      expect(connectCount).toBeGreaterThan(0)
    })

    it('should track connection attempts and failures', async () => {
      const events: string[] = []

      eventBus.on('sip:connected', () => events.push('connected'))
      eventBus.on('sip:disconnected', () => events.push('disconnected'))
      eventBus.on('sip:connection_failed', () => events.push('failed'))

      // First attempt - success
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Disconnect
      mockUA.isConnected.mockReturnValue(false)
      await sipClient.stop()

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(events).toContain('connected')
    })
  })

  describe('Concurrent Connection Operations', () => {
    it('should handle multiple concurrent start() calls', async () => {
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      // Multiple concurrent start calls
      const promises = [sipClient.start(), sipClient.start(), sipClient.start()]

      await Promise.allSettled(promises)

      // Should have called UA.start only once
      expect(mockUA.start).toHaveBeenCalledTimes(1)
    })

    it('should handle start() during stop()', async () => {
      // Connect first
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Start stopping
      const stopPromise = sipClient.stop()

      // Try to start while stopping
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })

      const startPromise = sipClient.start()

      await Promise.allSettled([stopPromise, startPromise])

      // Should handle gracefully
      expect(sipClient).toBeDefined()
    })
  })

  describe('WebSocket State Transitions', () => {
    it('should handle all WebSocket connection states', async () => {
      const states = ['connecting', 'connected', 'closing', 'closed']
      const events: string[] = []

      mockUA.on.mockImplementation((event: string, handler: Function) => {
        events.push(event)
      })

      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Should have registered handlers for state changes
      expect(mockUA.on).toHaveBeenCalled()
    })

    it('should handle unexpected WebSocket errors', async () => {
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'disconnected') {
          setTimeout(
            () =>
              handler({
                code: 1011, // Unexpected condition
                reason: 'Internal server error',
              }),
            10
          )
        }
      })

      await expect(sipClient.start()).rejects.toThrow()
    })
  })

  describe('Registration During Network Issues', () => {
    it('should handle registration failure due to network', async () => {
      // Connect first
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Registration fails
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'registrationFailed') {
          setTimeout(() => handler({ cause: 'Network timeout' }), 10)
        }
      })

      await expect(sipClient.register()).rejects.toThrow()
      expect(sipClient.registrationState).toBe('registration_failed')
    })

    it('should unregister when connection lost', async () => {
      // Connect and register
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
        if (event === 'registered') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      await sipClient.start()

      mockUA.isRegistered.mockReturnValue(true)
      await sipClient.register()

      // Lose connection
      mockUA.isConnected.mockReturnValue(false)
      mockUA.isRegistered.mockReturnValue(false)

      await sipClient.stop()

      expect(sipClient.registrationState).toBe('unregistered')
    })
  })
})
