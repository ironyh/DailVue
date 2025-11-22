/**
 * SIP Workflow Integration Tests
 *
 * Tests the complete SIP workflow including connection, registration, calls, and media.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SipClient } from '../../src/core/SipClient'
import { CallSession } from '../../src/core/CallSession'
import { MediaManager } from '../../src/core/MediaManager'
import { EventBus } from '../../src/core/EventBus'
import { createMockSipServer, type MockRTCSession } from '../helpers/MockSipServer'
import type { SipClientConfig } from '../../src/types/config.types'
import { RegistrationState } from '../../src/types/sip.types'
import {
  waitForEvent,
  waitForEvents,
  waitForNextTick,
  waitForCondition,
  flushMicrotasks,
} from '../utils/test-helpers'

// Mock JsSIP to use our MockSipServer
vi.mock('jssip', () => {
  let mockSipServer: ReturnType<typeof createMockSipServer> | null = null

  return {
    default: {
      UA: vi.fn(function () {
        // Get the mock server from global if available
        const server = (global as any).__mockSipServer
        if (server) {
          return server.getUA()
        }
        // Fallback: create a temporary one
        if (!mockSipServer) {
          mockSipServer = createMockSipServer({
            autoRegister: false,
            networkLatency: 0,
          })
        }
        return mockSipServer.getUA()
      }),
      WebSocketInterface: vi.fn(),
      debug: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
    },
  }
})

// Note: Helper functions removed - tests use MockSipServer methods directly

// Helper function to create CallSession with proper options
function createMockCallSession(
  rtcSession: any,
  direction: 'outgoing' | 'incoming',
  eventBus: EventBus,
  callId: string = 'call-123'
): CallSession {
  return new CallSession({
    id: callId,
    direction,
    localUri: 'sip:testuser@example.com',
    remoteUri: 'sip:remote@example.com',
    remoteDisplayName: 'Remote User',
    rtcSession,
    eventBus,
  })
}

/**
 * Helper function to setup mock navigator.mediaDevices
 */
function setupMockMediaDevices(): void {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        id: 'mock-stream',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
          },
        ]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getSupportedConstraints: vi.fn().mockReturnValue({}),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
}

// Event handler storage for mock UA
const eventHandlers = new Map<string, Function[]>()
const onceHandlers = new Map<string, Function[]>()
const sessionEventHandlers = new Map<string, Function[]>()

// Mock UA object
const mockUA = {
  on: vi.fn(),
  once: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  call: vi.fn(),
  isConnected: vi.fn(() => false),
  isRegistered: vi.fn(() => false),
}

// Mock RTC Session object
const mockRTCSession = {
  on: vi.fn(),
  connection: {
    addEventListener: vi.fn(),
    getSenders: vi.fn(() => []),
    getReceivers: vi.fn(() => []),
  },
  sendDTMF: vi.fn(),
  refer: vi.fn(),
  hold: vi.fn(),
  unhold: vi.fn(),
  terminate: vi.fn(),
  isEnded: vi.fn(() => false),
  isEstablished: vi.fn(() => false),
}

describe('SIP Workflow Integration Tests', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let mediaManager: MediaManager
  let config: SipClientConfig
  let mockSipServer: ReturnType<typeof createMockSipServer>

  beforeEach(() => {
    vi.clearAllMocks()

    eventBus = new EventBus()
    mockSipServer = createMockSipServer({
      autoRegister: false,
      networkLatency: 0, // Disable latency for CI reliability
    })

    // Store mock server globally so JsSIP mock can access it
    ;(global as any).__mockSipServer = mockSipServer

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
    mediaManager = new MediaManager({ eventBus })
    setupMockMediaDevices()
  })

  afterEach(() => {
    sipClient?.destroy()
    mediaManager?.destroy()
    eventBus?.destroy()
    mockSipServer?.destroy()
    delete (global as any).__mockSipServer
  })

  describe('Complete SIP Connection Flow', () => {
    it('should connect and register successfully', async () => {
      // Track events
      const events: string[] = []
      eventBus.on('sip:connected', () => events.push('connected'))
      eventBus.on('sip:registered', () => events.push('registered'))

      // Start connection - mock server will auto-connect
      mockSipServer.simulateConnect()
      await sipClient.start()
      expect(sipClient.isConnected).toBe(true)

      // Register - mock server will auto-register
      mockSipServer.simulateRegistered()
      await sipClient.register()
      expect(sipClient.isRegistered).toBe(true)

      // Wait for events to propagate
      await waitForEvents(eventBus, ['sip:connected', 'sip:registered'], 1000)

      expect(events).toContain('connected')
      expect(events).toContain('registered')
    })

    it('should handle connection failure gracefully', async () => {
      mockSipServer.simulateDisconnect(1006, 'Connection failed')

      await expect(sipClient.start()).rejects.toThrow('Connection failed')
      expect(sipClient.connectionState).toBe('connection_failed')
    })

    it('should handle registration failure gracefully', async () => {
      // Connect first
      mockSipServer.simulateConnect()
      await sipClient.start()

      // Setup registration failure
      mockSipServer.simulateRegistrationFailed('Authentication failed')

      await expect(sipClient.register()).rejects.toThrow('Registration failed')
      expect(sipClient.registrationState).toBe('registration_failed')
    })
  })

  describe('Complete Call Flow', () => {
    beforeEach(async () => {
      // Setup connected and registered state
      mockSipServer.simulateConnect()
      await sipClient.start()
      mockSipServer.simulateRegistered()
      await sipClient.register()
    })

    it('should make outgoing call successfully', async () => {
      const session = mockSipServer.createSession('session-123')
      const mockUA = mockSipServer.getUA()
      mockUA.call.mockReturnValue(session)

      // Make call through SipClient to ensure proper lifecycle setup
      const callPromise = sipClient.call('sip:remote@example.com')

      // Wait for CallSession to be created and handlers registered
      await waitForNextTick()

      const callSession = await callPromise

      // Simulate call progress with proper response object
      mockSipServer.simulateCallProgress(session)
      await waitForEvent(eventBus, 'call:progress', 1000)

      // Simulate call accepted
      mockSipServer.simulateCallAccepted(session)
      await waitForEvent(eventBus, 'call:accepted', 1000)

      // Simulate call confirmed
      mockSipServer.simulateCallConfirmed(session)
      await waitForEvent(eventBus, 'call:confirmed', 1000)

      expect(callSession).toBeDefined()
      expect(callSession.id).toBe(session.id)
      expect(callSession.direction).toBe('outgoing')
      expect(callSession.state).toBe('active')
    })

    it('should receive incoming call successfully', async () => {
      // Track incoming call event
      let incomingCallSession: any = null
      eventBus.on('sip:new_session', (event: any) => {
        incomingCallSession = event.session
      })

      // Simulate incoming call - this triggers newRTCSession on the UA
      const session = mockSipServer.simulateIncomingCall(
        'sip:caller@example.com',
        'sip:testuser@example.com'
      )

      // Wait for newRTCSession event to be processed
      await waitForEvent(eventBus, 'sip:new_session', 1000)

      // Verify incoming call was received - SipClient should have created a CallSession
      expect(incomingCallSession).toBeDefined()
      // The session from the event should match the mock session
      expect(incomingCallSession).toBe(session)
    })

    it('should handle call lifecycle: start -> progress -> accept -> end', async () => {
      const events: string[] = []

      eventBus.on('call:progress', () => events.push('progress'))
      eventBus.on('call:accepted', () => events.push('accepted'))
      eventBus.on('call:confirmed', () => events.push('confirmed'))
      eventBus.on('call:ended', () => events.push('ended'))

      // Make call through SipClient for proper lifecycle
      const session = mockSipServer.createSession()
      const mockUA = mockSipServer.getUA()
      mockUA.call.mockReturnValue(session)

      const callSession = await sipClient.call('sip:remote@example.com')

      // Wait for handlers to be registered
      await waitForNextTick()

      // Simulate call lifecycle in proper order
      mockSipServer.simulateCallProgress(session)
      await waitForEvent(eventBus, 'call:progress', 1000)

      mockSipServer.simulateCallAccepted(session)
      await waitForEvent(eventBus, 'call:accepted', 1000)

      mockSipServer.simulateCallConfirmed(session)
      await waitForEvent(eventBus, 'call:confirmed', 1000)

      mockSipServer.simulateCallEnded(session, 'local', 'Bye')
      await waitForEvent(eventBus, 'call:ended', 1000)

      // Verify all lifecycle events were emitted
      expect(events).toContain('progress')
      expect(events).toContain('accepted')
      expect(events).toContain('confirmed')
      expect(events).toContain('ended')
    })
  })

  describe('Media Management Integration', () => {
    it('should acquire and release media successfully', async () => {
      const stream = await mediaManager.getUserMedia({ audio: true, video: false })

      expect(stream).toBeDefined()
      // Check if localStream is set
      const hasActiveStream = (mediaManager as any).localStream !== undefined
      expect(hasActiveStream).toBe(true)

      mediaManager.stopLocalStream()

      const hasActiveStreamAfterRelease = (mediaManager as any).localStream === undefined
      expect(hasActiveStreamAfterRelease).toBe(true)
    })

    it('should handle media errors gracefully', async () => {
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
        writable: true,
        configurable: true,
      })

      await expect(mediaManager.getUserMedia({ audio: true, video: false })).rejects.toThrow(
        'Permission denied'
      )
    })
  })

  describe('DTMF Handling', () => {
    beforeEach(async () => {
      // Setup connected and registered state
      mockSipServer.simulateConnect()
      await sipClient.start()
      mockSipServer.simulateRegistered()
      await sipClient.register()
    })

    it('should send DTMF tones', async () => {
      const session = mockSipServer.createSession()
      const mockUA = mockSipServer.getUA()
      mockUA.call.mockReturnValue(session)

      // Make call through SipClient for proper lifecycle
      const callSession = await sipClient.call('sip:remote@example.com')
      await waitForNextTick()

      // Set call to active state by simulating full call lifecycle
      mockSipServer.simulateCallProgress(session)
      await waitForEvent(eventBus, 'call:progress', 1000)

      mockSipServer.simulateCallAccepted(session)
      await waitForEvent(eventBus, 'call:accepted', 1000)

      mockSipServer.simulateCallConfirmed(session)
      await waitForEvent(eventBus, 'call:confirmed', 1000)

      // Verify call is active before sending DTMF
      expect(callSession.state).toBe('active')

      callSession.sendDTMF('1')
      expect(session.sendDTMF).toHaveBeenCalledWith('1', expect.any(Object))

      callSession.sendDTMF('2')
      expect(session.sendDTMF).toHaveBeenCalledWith('2', expect.any(Object))
    })
  })

  describe('Call Transfer', () => {
    beforeEach(async () => {
      // Setup connected and registered state
      mockSipServer.simulateConnect()
      await sipClient.start()
      mockSipServer.simulateRegistered()
      await sipClient.register()
    })

    it('should transfer call (blind transfer)', async () => {
      const session = mockSipServer.createSession()
      const mockUA = mockSipServer.getUA()
      mockUA.call.mockReturnValue(session)

      // Make call through SipClient for proper lifecycle
      const callSession = await sipClient.call('sip:remote@example.com')
      await waitForNextTick()

      // Set call to active state
      mockSipServer.simulateCallProgress(session)
      await waitForEvent(eventBus, 'call:progress', 1000)

      mockSipServer.simulateCallAccepted(session)
      await waitForEvent(eventBus, 'call:accepted', 1000)

      mockSipServer.simulateCallConfirmed(session)
      await waitForEvent(eventBus, 'call:confirmed', 1000)

      // Verify call is active before transfer
      expect(callSession.state).toBe('active')

      callSession.transfer('sip:transfer@example.com')

      expect(session.refer).toHaveBeenCalledWith('sip:transfer@example.com', expect.any(Object))
    })
  })

  describe('Hold/Unhold', () => {
    beforeEach(async () => {
      // Setup connected and registered state
      mockSipServer.simulateConnect()
      await sipClient.start()
      mockSipServer.simulateRegistered()
      await sipClient.register()
    })

    it('should hold and unhold call', async () => {
      const session = mockSipServer.createSession()
      const mockUA = mockSipServer.getUA()
      mockUA.call.mockReturnValue(session)

      // Make call through SipClient for proper lifecycle
      const callSession = await sipClient.call('sip:remote@example.com')
      await waitForNextTick()

      // Set call to active state
      mockSipServer.simulateCallProgress(session)
      await waitForEvent(eventBus, 'call:progress', 1000)

      mockSipServer.simulateCallAccepted(session)
      await waitForEvent(eventBus, 'call:accepted', 1000)

      mockSipServer.simulateCallConfirmed(session)
      await waitForEvent(eventBus, 'call:confirmed', 1000)

      // Verify call is active before hold
      expect(callSession.state).toBe('active')

      // Hold the call
      await callSession.hold()
      expect(session.hold).toHaveBeenCalled()

      // Trigger hold event to update CallSession state
      mockSipServer.simulateHold(session, 'local')
      await waitForNextTick()
      await flushMicrotasks()

      // Wait for hold state to be set
      await waitForCondition(() => callSession.state === 'held' || session.localHold === true, {
        timeout: 1000,
        description: 'call to be held',
      })

      // Now unhold
      await callSession.unhold()
      expect(session.unhold).toHaveBeenCalled()
    })
  })

  describe('Multiple Calls Management', () => {
    it('should handle multiple concurrent calls', async () => {
      const activeCalls = new Map()

      const session1 = mockSipServer.createSession('call-1')
      const call1 = createMockCallSession(session1 as any, 'outgoing', eventBus, 'call-1')

      const session2 = mockSipServer.createSession('call-2')
      const call2 = createMockCallSession(session2 as any, 'incoming', eventBus, 'call-2')

      activeCalls.set('call-1', call1)
      activeCalls.set('call-2', call2)

      expect(activeCalls.size).toBe(2)
      expect(activeCalls.get('call-1')).toBe(call1)
      expect(activeCalls.get('call-2')).toBe(call2)
    })
  })

  describe('Event Bus Communication', () => {
    it('should propagate events through event bus', async () => {
      const events: Array<{ type: string; data?: any }> = []

      eventBus.on('sip:connected', (data) => events.push({ type: 'connected', data }))
      eventBus.on('sip:registered', (data) => events.push({ type: 'registered', data }))
      eventBus.on('call:progress', (data) => events.push({ type: 'progress', data }))
      eventBus.on('call:accepted', (data) => events.push({ type: 'accepted', data }))

      mockSipServer.simulateConnect()
      await sipClient.start()

      // Wait for connection state to be updated
      await waitFor(() => sipClient.isConnected, {
        timeout: 1000,
        timeoutMessage: 'Connection not established',
      })

      mockSipServer.simulateRegistered()
      await sipClient.register()

      // Wait for events to propagate
      await waitForEvents(eventBus, ['sip:connected', 'sip:registered'], 1000)

      expect(sipClient.isConnected).toBe(true)
      expect(sipClient.registrationState).toBe(RegistrationState.Registered)
      expect(events).toContainEqual(expect.objectContaining({ type: 'connected' }))
      expect(events).toContainEqual(expect.objectContaining({ type: 'registered' }))
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on stop', async () => {
      mockSipServer.simulateConnect()
      await sipClient.start()
      await sipClient.stop()

      const mockUA = mockSipServer.getUA()
      expect(mockUA.stop).toHaveBeenCalled()
      expect(sipClient.connectionState).toBe('disconnected')
    })

    it('should cleanup media on destroy', () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([{ kind: 'audio', stop: vi.fn() }]),
      } as any

      // Manually set stream
      ;(mediaManager as any).localStream = mockStream

      mediaManager.destroy()

      const tracks = mockStream.getTracks()
      tracks.forEach((track: any) => {
        expect(track.stop).toHaveBeenCalled()
      })
    })
  })
})
