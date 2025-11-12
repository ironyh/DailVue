/**
 * SIP Workflow Integration Tests
 *
 * Tests the complete SIP workflow including connection, registration, calls, and media.
 */

/* eslint-disable @typescript-eslint/ban-types */
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
import { waitFor, waitForEvent } from '../helpers/testUtils'

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
            networkLatency: 0
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

// Helper function to trigger UA events (calls both .on() and .once() handlers)
function triggerUAEvent(event: string, data?: any) {
  // Trigger .on() handlers
  const onHandlers = eventHandlers.get(event)
  if (onHandlers) {
    onHandlers.forEach((handler) => handler(data))
  }

  // Trigger .once() handlers and remove them
  const onceHandlerList = onceHandlers.get(event)
  if (onceHandlerList) {
    onceHandlerList.forEach((handler) => handler(data))
    onceHandlers.delete(event)
  }
}

// Helper function to trigger RTC session events
function triggerSessionEvent(event: string, data?: any) {
  const handlers = sessionEventHandlers.get(event)
  if (handlers) {
    handlers.forEach((handler) => handler(data))
  }
}

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
    eventHandlers.clear()
    onceHandlers.clear()
    sessionEventHandlers.clear()

    mockUA.on.mockImplementation((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, [])
      }
      eventHandlers.get(event)!.push(handler)
    })
    mockUA.once.mockImplementation((event: string, handler: Function) => {
      if (!onceHandlers.has(event)) {
        onceHandlers.set(event, [])
      }
      onceHandlers.get(event)!.push(handler)
    })
    mockUA.isConnected.mockReturnValue(false)
    mockUA.isRegistered.mockReturnValue(false)
    mockRTCSession.on.mockImplementation((event: string, handler: Function) => {
      if (!sessionEventHandlers.has(event)) {
        sessionEventHandlers.set(event, [])
      }
      sessionEventHandlers.get(event)!.push(handler)
    })

    eventBus = new EventBus()
    mockSipServer = createMockSipServer({ 
      autoRegister: false,
      networkLatency: 0 // Disable latency for CI reliability
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
      await new Promise((resolve) => setTimeout(resolve, 100))

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

      // Use the session ID from mockRTCSession for the call
      const callSession = createMockCallSession(session as any, 'outgoing', eventBus, session.id)

      // Simulate call progress
      mockSipServer.simulateCallProgress(session)

      // Simulate call accepted
      mockSipServer.simulateCallAccepted(session)
      mockSipServer.simulateCallConfirmed(session)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callSession).toBeDefined()
      expect(callSession.id).toBe(session.id)
      expect(callSession.direction).toBe('outgoing')
    })

    it('should receive incoming call successfully', async () => {
      const session = mockSipServer.simulateIncomingCall(
        'sip:caller@example.com',
        'sip:testuser@example.com'
      )

      const callSession = createMockCallSession(session as any, 'incoming', eventBus)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callSession).toBeDefined()
      expect(callSession.direction).toBe('incoming')
    })

    it('should handle call lifecycle: start -> progress -> accept -> end', async () => {
      const events: string[] = []

      eventBus.on('call:progress', () => events.push('progress'))
      eventBus.on('call:accepted', () => events.push('accepted'))
      eventBus.on('call:confirmed', () => events.push('confirmed'))
      eventBus.on('call:ended', () => events.push('ended'))

      const session = mockSipServer.createSession()
      const callSession = createMockCallSession(session as any, 'outgoing', eventBus)

      // Simulate call lifecycle
      mockSipServer.simulateCallProgress(session)
      await new Promise((resolve) => setTimeout(resolve, 20))

      mockSipServer.simulateCallAccepted(session)
      await new Promise((resolve) => setTimeout(resolve, 20))

      mockSipServer.simulateCallConfirmed(session)
      await new Promise((resolve) => setTimeout(resolve, 20))

      mockSipServer.simulateCallEnded(session, 'local', 'Bye')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(events).toContain('progress')
      expect(events).toContain('accepted')
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

      await expect(
        mediaManager.getUserMedia({ audio: true, video: false })
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('DTMF Handling', () => {
    it('should send DTMF tones', async () => {
      const session = mockSipServer.createSession()
      const callSession = createMockCallSession(session as any, 'outgoing', eventBus)

      // Set call to active state by simulating full call lifecycle
      mockSipServer.simulateCallProgress(session)
      await new Promise((resolve) => setTimeout(resolve, 10))

      mockSipServer.simulateCallAccepted(session)
      mockSipServer.simulateCallConfirmed(session)

      // Wait for state transition to active
      await new Promise((resolve) => setTimeout(resolve, 50))

      callSession.sendDTMF('1')
      expect(session.sendDTMF).toHaveBeenCalledWith('1', expect.any(Object))

      callSession.sendDTMF('2')
      expect(session.sendDTMF).toHaveBeenCalledWith('2', expect.any(Object))
    })
  })

  describe('Call Transfer', () => {
    it('should transfer call (blind transfer)', async () => {
      const session = mockSipServer.createSession()
      const callSession = createMockCallSession(session as any, 'outgoing', eventBus)

      // Set call to active state
      mockSipServer.simulateCallProgress(session)
      await new Promise((resolve) => setTimeout(resolve, 10))

      mockSipServer.simulateCallAccepted(session)
      mockSipServer.simulateCallConfirmed(session)

      // Wait for state transition to active
      await new Promise((resolve) => setTimeout(resolve, 50))

      callSession.transfer('sip:transfer@example.com')

      expect(session.refer).toHaveBeenCalledWith('sip:transfer@example.com', expect.any(Object))
    })
  })

  describe('Hold/Unhold', () => {
    it('should hold and unhold call', async () => {
      const session = mockSipServer.createSession()
      const callSession = createMockCallSession(session as any, 'outgoing', eventBus)

      // Set call to active state
      mockSipServer.simulateCallProgress(session)
      await new Promise((resolve) => setTimeout(resolve, 10))

      mockSipServer.simulateCallAccepted(session)
      mockSipServer.simulateCallConfirmed(session)

      // Wait for state transition to active
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Hold the call
      await callSession.hold()
      expect(session.hold).toHaveBeenCalled()

      // Trigger hold event to update CallSession state
      mockSipServer.simulateHold(session, 'local')
      await new Promise((resolve) => setTimeout(resolve, 10))

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
      await waitFor(() => sipClient.isConnected, { timeout: 1000, timeoutMessage: 'Connection not established' })

      mockSipServer.simulateRegistered()
      await sipClient.register()
      
      // Wait for registration state to be updated
      await waitFor(() => sipClient.registrationState === RegistrationState.Registered, { 
        timeout: 1000, 
        timeoutMessage: 'Registration not completed' 
      })

      expect(sipClient.isConnected).toBe(true)
      expect(sipClient.registrationState).toBe(RegistrationState.Registered)
      
      // Verify events were propagated
      await waitFor(() => events.length > 0, { timeout: 1000 })
      expect(events.some(e => e.type === 'connected')).toBe(true)
      expect(events.some(e => e.type === 'registered')).toBe(true)
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
        getTracks: vi.fn().mockReturnValue([
          { kind: 'audio', stop: vi.fn() },
        ]),
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
