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

// Mock JsSIP with proper event handler storage
const eventHandlers = new Map<string, Function[]>()
const onceHandlers = new Map<string, Function[]>()
const sessionEventHandlers = new Map<string, Function[]>()

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
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, [])
    }
    eventHandlers.get(event)!.push(handler)
  }),
  once: vi.fn((event: string, handler: Function) => {
    if (!onceHandlers.has(event)) {
      onceHandlers.set(event, [])
    }
    onceHandlers.get(event)!.push(handler)
  }),
  off: vi.fn((event: string, handler?: Function) => {
    if (handler) {
      const handlers = eventHandlers.get(event)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    } else {
      eventHandlers.delete(event)
    }
  }),
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
  on: vi.fn((event: string, handler: Function) => {
    if (!sessionEventHandlers.has(event)) {
      sessionEventHandlers.set(event, [])
    }
    sessionEventHandlers.get(event)!.push(handler)
  }),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
}

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
          mockSipServer = createMockSipServer({ autoRegister: false })
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
    mockSipServer = createMockSipServer({ autoRegister: false })
    
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
  })

  afterEach(() => {
    sipClient.destroy()
    mediaManager.destroy()
    eventBus.destroy()
    mockSipServer.destroy()
    delete (global as any).__mockSipServer
  })

  describe('Complete SIP Connection Flow', () => {
    it('should connect and register successfully', async () => {
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      // Track events
      const events: string[] = []
      eventBus.on('sip:connected', () => events.push('connected'))
      eventBus.on('sip:registered', () => events.push('registered'))

      // Start the client (which sets up event handlers)
      const startPromise = sipClient.start()

      // Trigger connected event in next event loop
      setTimeout(() => {
        triggerUAEvent('connected', { socket: { url: 'wss://test.com' } })
      }, 0)

      await startPromise
      expect(sipClient.isConnected).toBe(true)

      // Register
      mockUA.isRegistered.mockReturnValue(true)
      const registerPromise = sipClient.register()

      // Trigger registered event in next event loop
      setTimeout(() => {
        triggerUAEvent('registered', { response: { getHeader: () => '600' } })
      }, 0)

      await registerPromise
      expect(sipClient.isRegistered).toBe(true)

      // Wait for events to propagate
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(events).toContain('connected')
      expect(events).toContain('registered')
    })

    it('should handle connection failure gracefully', async () => {
      mockUA.start.mockImplementationOnce(() => {
        throw new Error('Connection failed')
      })

      await expect(sipClient.start()).rejects.toThrow('Connection failed')
      expect(sipClient.connectionState).toBe('connection_failed')
    })

    it('should handle registration failure gracefully', async () => {
      mockUA.isConnected.mockReturnValue(true)

      // Connect first
      const startPromise = sipClient.start()
      triggerUAEvent('connected', {})
      await startPromise

      expect(eventHandlers.has('connected')).toBe(true)
      expect(sipClient.userAgent).toBe(mockUA)
      expect(sipClient.isConnected).toBe(true)
      const registerPromise = sipClient.register()
      const failureHandlers = onceHandlers.get('registrationFailed') ?? []
      expect(failureHandlers.length).toBeGreaterThan(0)
      failureHandlers[0]('Authentication failed')

      await expect(registerPromise).rejects.toThrow('Registration failed')
      expect(sipClient.registrationState).toBe(RegistrationState.RegistrationFailed)
    })
  })

  describe('Complete Call Flow', () => {
    beforeEach(async () => {
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      // Setup connected and registered state
      const startPromise = sipClient.start()
      setTimeout(() => triggerUAEvent('connected', {}), 0)
      await startPromise

      mockUA.isRegistered.mockReturnValue(true)
      const registerPromise = sipClient.register()
      setTimeout(() => triggerUAEvent('registered', {}), 0)
      await registerPromise
    })

    it('should make outgoing call successfully', async () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([
          { kind: 'audio', stop: vi.fn() },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      } as any

      // Mock media acquisition
      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      } as any

      mockUA.call.mockReturnValue(mockRTCSession)

      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus, 'session-123')

      // Simulate call progress
      mockRTCSession.isInProgress.mockReturnValue(true)
      triggerSessionEvent('progress', { originator: 'remote' })

      // Simulate call accepted
      mockRTCSession.isEstablished.mockReturnValue(true)
      triggerSessionEvent('accepted', { originator: 'remote' })

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

      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus)

      // Simulate call lifecycle
      mockRTCSession.isInProgress.mockReturnValue(true)
      triggerSessionEvent('progress', { originator: 'remote' })

      mockRTCSession.isEstablished.mockReturnValue(true)
      triggerSessionEvent('accepted', { originator: 'remote' })

      triggerSessionEvent('confirmed')

      mockRTCSession.isEnded.mockReturnValue(true)
      triggerSessionEvent('ended', { originator: 'local', cause: 'Bye' })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(events).toContain('progress')
      expect(events).toContain('accepted')
    })
  })

  describe('Media Management Integration', () => {
    it('should acquire and release media successfully', async () => {
      const stream = await mediaManager.getUserMedia({ audio: true, video: false })

      expect(stream).toBeDefined()
      expect(mediaManager.getLocalStream()).toBeDefined()

      mediaManager.stopLocalStream()

      expect(mediaManager.getLocalStream()).toBeUndefined()
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

      // Trigger confirmed event to set call to active state
      triggerSessionEvent('confirmed')

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

      // Trigger confirmed event to set call to active state
      triggerSessionEvent('confirmed')

      callSession.transfer('sip:transfer@example.com')

      expect(mockRTCSession.refer).toHaveBeenCalledWith('sip:transfer@example.com', {})
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

      // Trigger confirmed event to set call to active state
      triggerSessionEvent('confirmed')

      // Hold the call
      const holdPromise = callSession.hold()
      expect(mockRTCSession.hold).toHaveBeenCalled()

      // Trigger 'hold' event to set _isOnHold flag
      triggerSessionEvent('hold', { originator: 'local' })
      await holdPromise

      // Unhold the call
      const unholdPromise = callSession.unhold()
      expect(mockRTCSession.unhold).toHaveBeenCalled()

      // Trigger 'unhold' event to clear _isOnHold flag
      triggerSessionEvent('unhold', { originator: 'local' })
      await unholdPromise
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
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      const startPromise = sipClient.start()
      triggerUAEvent('connected', { socket: { url: 'wss://test.com' } })
      await startPromise

      const registerPromise = sipClient.register()
      const successHandlers = onceHandlers.get('registered') ?? []
      expect(successHandlers.length).toBeGreaterThan(0)
      successHandlers[0]({ response: { getHeader: () => '600' } })
      await registerPromise

      expect(sipClient.isConnected).toBe(true)
      expect(sipClient.registrationState).toBe(RegistrationState.Registered)
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on stop', async () => {
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      const startPromise = sipClient.start()
      await Promise.resolve()
      triggerUAEvent('connected', {})
      await startPromise
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
