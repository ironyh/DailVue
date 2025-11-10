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
      UA: vi.fn(function () {
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

describe('SIP Workflow Integration Tests', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let mediaManager: MediaManager
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
    mediaManager = new MediaManager(eventBus)
  })

  afterEach(() => {
    sipClient.destroy()
    mediaManager.destroy()
    eventBus.destroy()
  })

  describe('Complete SIP Connection Flow', () => {
    it('should connect and register successfully', async () => {
      // Mock successful connection
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 10)
        }
        if (event === 'registered') {
          setTimeout(() => handler({ response: { getHeader: () => '600' } }), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      // Track events
      const events: string[] = []
      eventBus.on('sip:connected', () => events.push('connected'))
      eventBus.on('sip:registered', () => events.push('registered'))

      // Connect
      await sipClient.start()
      expect(sipClient.isConnected).toBe(true)

      // Register
      mockUA.isRegistered.mockReturnValue(true)
      await sipClient.register()
      expect(sipClient.isRegistered).toBe(true)

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(events).toContain('connected')
      expect(events).toContain('registered')
    })

    it('should handle connection failure gracefully', async () => {
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'disconnected') {
          setTimeout(() => handler({ code: 1006, reason: 'Connection failed' }), 10)
        }
      })

      await expect(sipClient.start()).rejects.toThrow('Connection failed')
      expect(sipClient.connectionState).toBe('connection_failed')
    })

    it('should handle registration failure gracefully', async () => {
      // Connect first
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
        if (event === 'registrationFailed') {
          setTimeout(() => handler({ cause: 'Authentication failed' }), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      await expect(sipClient.register()).rejects.toThrow('Registration failed')
      expect(sipClient.registrationState).toBe('registration_failed')
    })
  })

  describe('Complete Call Flow', () => {
    beforeEach(async () => {
      // Setup connected and registered state
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

      // Setup session event handlers
      const sessionHandlers: Record<string, Function> = {}
      mockRTCSession.on.mockImplementation((event: string, handler: Function) => {
        sessionHandlers[event] = handler
      })

      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus)

      // Simulate call progress
      mockRTCSession.isInProgress.mockReturnValue(true)
      if (sessionHandlers['progress']) {
        sessionHandlers['progress']({ originator: 'remote' })
      }

      // Simulate call accepted
      mockRTCSession.isEstablished.mockReturnValue(true)
      if (sessionHandlers['accepted']) {
        sessionHandlers['accepted']({ originator: 'remote' })
      }

      expect(callSession).toBeDefined()
      expect(callSession.id).toBe('session-123')
      expect(callSession.direction).toBe('outgoing')
    })

    it('should receive incoming call successfully', async () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([
          { kind: 'audio', stop: vi.fn() },
        ]),
      } as any

      // Simulate incoming call
      let newRTCSessionHandler: Function | null = null
      mockUA.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'newRTCSession') {
          newRTCSessionHandler = handler
        }
      })

      // Trigger incoming call
      if (newRTCSessionHandler) {
        newRTCSessionHandler({
          session: mockRTCSession,
          originator: 'remote',
          request: {
            from: { uri: { user: 'caller', host: 'example.com' } },
            to: { uri: { user: 'callee', host: 'example.com' } },
          },
        })
      }

      const callSession = createMockCallSession(mockRTCSession as any, 'incoming', eventBus)

      expect(callSession).toBeDefined()
      expect(callSession.direction).toBe('incoming')
    })

    it('should handle call lifecycle: start -> progress -> accept -> end', async () => {
      const events: string[] = []

      eventBus.on('call:progress', () => events.push('progress'))
      eventBus.on('call:accepted', () => events.push('accepted'))
      eventBus.on('call:confirmed', () => events.push('confirmed'))
      eventBus.on('call:ended', () => events.push('ended'))

      // Setup session handlers
      const sessionHandlers: Record<string, Function> = {}
      mockRTCSession.on.mockImplementation((event: string, handler: Function) => {
        sessionHandlers[event] = handler
      })

      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus)

      // Simulate call lifecycle
      mockRTCSession.isInProgress.mockReturnValue(true)
      if (sessionHandlers['progress']) {
        sessionHandlers['progress']({ originator: 'remote' })
      }

      mockRTCSession.isEstablished.mockReturnValue(true)
      if (sessionHandlers['accepted']) {
        sessionHandlers['accepted']({ originator: 'remote' })
      }

      if (sessionHandlers['confirmed']) {
        sessionHandlers['confirmed']()
      }

      mockRTCSession.isEnded.mockReturnValue(true)
      if (sessionHandlers['ended']) {
        sessionHandlers['ended']({ originator: 'local', cause: 'Bye' })
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(events).toContain('progress')
      expect(events).toContain('accepted')
    })
  })

  describe('Media Management Integration', () => {
    it('should acquire and release media successfully', async () => {
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([
          { kind: 'audio', stop: vi.fn() },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([
          { kind: 'audio', stop: vi.fn() },
        ]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      } as any

      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      } as any

      const stream = await mediaManager.getUserMedia({ audio: true, video: false })

      expect(stream).toBeDefined()
      expect(mediaManager.hasActiveStream).toBe(true)

      mediaManager.releaseUserMedia()

      expect(mediaManager.hasActiveStream).toBe(false)
    })

    it('should handle media errors gracefully', async () => {
      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      } as any

      await expect(
        mediaManager.getUserMedia({ audio: true, video: false })
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('DTMF Handling', () => {
    it('should send DTMF tones', async () => {
      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus)

      callSession.sendDTMF('1')
      expect(mockRTCSession.sendDTMF).toHaveBeenCalledWith('1', expect.any(Object))

      callSession.sendDTMF('2')
      expect(mockRTCSession.sendDTMF).toHaveBeenCalledWith('2', expect.any(Object))
    })
  })

  describe('Call Transfer', () => {
    it('should transfer call (blind transfer)', async () => {
      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus)

      mockRTCSession.isEstablished.mockReturnValue(true)

      callSession.transfer('sip:transfer@example.com')

      expect(mockRTCSession.refer).toHaveBeenCalledWith('sip:transfer@example.com')
    })
  })

  describe('Hold/Unhold', () => {
    it('should hold and unhold call', async () => {
      const callSession = createMockCallSession(mockRTCSession as any, 'outgoing', eventBus)

      mockRTCSession.isEstablished.mockReturnValue(true)

      await callSession.hold()
      expect(mockRTCSession.hold).toHaveBeenCalled()

      await callSession.unhold()
      expect(mockRTCSession.unhold).toHaveBeenCalled()
    })
  })

  describe('Multiple Calls Management', () => {
    it('should handle multiple concurrent calls', async () => {
      const activeCalls = new Map()

      const call1 = createMockCallSession(
        { ...mockRTCSession, id: 'call-1' } as any,
        'outgoing',
        eventBus,
        'call-1'
      )
      const call2 = createMockCallSession(
        { ...mockRTCSession, id: 'call-2' } as any,
        'incoming',
        eventBus,
        'call-2'
      )

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

      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 10)
        }
        if (event === 'registered') {
          setTimeout(() => handler({ response: { getHeader: () => '600' } }), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      await sipClient.start()

      mockUA.isRegistered.mockReturnValue(true)
      await sipClient.register()

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(events.length).toBeGreaterThan(0)
      expect(events.some((e) => e.type === 'connected')).toBe(true)
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on stop', async () => {
      mockUA.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      await sipClient.start()
      await sipClient.stop()

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
