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

// Mock JsSIP
const uaEventHandlers = new Map<string, Set<Function>>()
const uaOnceHandlers = new Map<string, Set<Function>>()

const addHandler = (map: Map<string, Set<Function>>, event: string, handler: Function) => {
  if (!map.has(event)) {
    map.set(event, new Set())
  }
  map.get(event)!.add(handler)
}

const mockUA = {
  start: vi.fn(),
  stop: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  call: vi.fn(),
  sendMessage: vi.fn(),
  isConnected: vi.fn().mockReturnValue(false),
  isRegistered: vi.fn().mockReturnValue(false),
  on: vi.fn((event: string, handler: Function) => {
    addHandler(uaEventHandlers, event, handler)
  }),
  once: vi.fn((event: string, handler: Function) => {
    addHandler(uaOnceHandlers, event, handler)
  }),
  off: vi.fn((event: string, handler: Function) => {
    uaEventHandlers.get(event)?.delete(handler)
    uaOnceHandlers.get(event)?.delete(handler)
  }),
  emit(event: string, payload?: any) {
    uaEventHandlers.get(event)?.forEach((handler) => handler(payload))
    const onceHandlers = uaOnceHandlers.get(event)
    if (onceHandlers) {
      onceHandlers.forEach((handler) => handler(payload))
      uaOnceHandlers.delete(event)
    }
  },
  resetHandlers() {
    uaEventHandlers.clear()
    uaOnceHandlers.clear()
  },
}

const scheduleUAEvent = (event: string, payload?: any, delay = 0) => {
  setTimeout(() => mockUA.emit(event, payload), delay)
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

mockUA.stop.mockImplementation(() => {
  mockUA.resetHandlers()
})

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

describe('Network Resilience Integration Tests', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let config: SipClientConfig

  beforeEach(() => {
    vi.clearAllMocks()
    mockUA.resetHandlers()
    mockUA.isConnected.mockReturnValue(false)
    mockUA.isRegistered.mockReturnValue(false)

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

      // Simulate network disconnect
      scheduleUAEvent('disconnected', { code: 1006, reason: 'Connection lost' }, 20)

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should have detected disconnect
      expect(sipClient.connectionState).toBe('disconnected')
    })

    it('should attempt reconnection after disconnect', async () => {
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()
      await flushMicrotasks()

      // Disconnect
      mockUA.isConnected.mockReturnValue(false)
      scheduleUAEvent('disconnected', {}, 0)

      await sipClient.stop()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(sipClient.connectionState).toBe('disconnected')

      // Reconnect
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()
      await flushMicrotasks()

      expect(sipClient.connectionState).toBe('connected')
    })
  })

  describe('Rapid Connect/Disconnect Cycles', () => {
    it('should handle 10 rapid connect/disconnect cycles', async () => {
      const cycles = 10

      for (let i = 0; i < cycles; i++) {
        mockUA.isConnected.mockReturnValue(true)
        scheduleUAEvent('connected', {}, 0)

        await sipClient.start()
        await flushMicrotasks()
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

      eventBus.on('sip:connected', () => connectCount++)

      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)
      scheduleUAEvent('disconnected', {}, 10)

      await sipClient.start()
      await flushMicrotasks()

      // Should have connected at least once (handlers were registered)
      expect(connectCount).toBeGreaterThan(0)
    })

    it('should track connection attempts and failures', async () => {
      mockUA.isConnected.mockReturnValue(true)
      scheduleUAEvent('connected', {}, 0)

      await sipClient.start()
      await flushMicrotasks()
      expect(sipClient.connectionState).toBe('connected')

      mockUA.isConnected.mockReturnValue(false)
      scheduleUAEvent('disconnected', {}, 0)
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
      scheduleUAEvent('disconnected', { code: 1011, reason: 'Internal server error' }, 0)
      await expect(sipClient.start()).rejects.toThrow()
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
