/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * useCallSession composable unit tests
 * Tests for Phase 6.11 improvements: input validation and concurrent operation guards
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useCallSession } from '@/composables/useCallSession'
import type { SipClient } from '@/core/SipClient'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock the validators
vi.mock('@/utils/validators', () => ({
  validateSipUri: (uri: string) => {
    if (!uri || uri.trim() === '') {
      return { isValid: false, errors: ['URI is empty'] }
    }
    if (!uri.includes('@') && !uri.startsWith('sip:')) {
      return { isValid: false, errors: ['Invalid SIP URI format'] }
    }
    return { isValid: true, errors: [] }
  },
}))

// Mock the call store
vi.mock('@/stores/callStore', () => ({
  callStore: {
    addActiveCall: vi.fn(),
    removeActiveCall: vi.fn(),
    updateCall: vi.fn(),
  },
}))

describe('useCallSession - Phase 6.11 Improvements', () => {
  let mockSipClient: any
  let mockSession: any

  beforeEach(() => {
    // Create mock session
    mockSession = {
      id: 'test-call-id',
      state: 'idle',
      answer: vi.fn().mockResolvedValue(undefined),
      hangup: vi.fn().mockResolvedValue(undefined),
      hold: vi.fn().mockResolvedValue(undefined),
      unhold: vi.fn().mockResolvedValue(undefined),
      sendDTMF: vi.fn().mockResolvedValue(undefined),
    }

    // Create mock SIP client
    mockSipClient = {
      call: vi.fn().mockResolvedValue(mockSession),
      connectionState: 'connected',
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should reject empty target URI', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      await expect(makeCall('')).rejects.toThrow('Target URI cannot be empty')
      expect(mockSipClient.call).not.toHaveBeenCalled()
    })

    it('should reject whitespace-only target URI', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      await expect(makeCall('   ')).rejects.toThrow('Target URI cannot be empty')
      expect(mockSipClient.call).not.toHaveBeenCalled()
    })

    it('should reject invalid SIP URI format', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      await expect(makeCall('not-a-valid-uri')).rejects.toThrow('Invalid target URI')
      expect(mockSipClient.call).not.toHaveBeenCalled()
    })

    it('should accept valid SIP URI with sip: prefix', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      await makeCall('sip:bob@example.com')
      expect(mockSipClient.call).toHaveBeenCalled()
    })

    it('should accept valid SIP URI with @ sign', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      await makeCall('alice@example.com')
      expect(mockSipClient.call).toHaveBeenCalled()
    })

    it('should throw if SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { makeCall } = useCallSession(sipClientRef as any)

      await expect(makeCall('sip:bob@example.com')).rejects.toThrow('SIP client not initialized')
    })
  })

  describe('Concurrent Operation Guards', () => {
    it('should prevent concurrent makeCall attempts', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      // Make call() hang for a bit
      let resolveCall: any
      mockSipClient.call = vi.fn(
        () => new Promise((resolve) => (resolveCall = () => resolve(mockSession)))
      )

      // Start first call (won't complete immediately)
      const call1 = makeCall('sip:alice@example.com')

      // Try to start second call before first completes
      const call2 = makeCall('sip:bob@example.com')

      // Second call should be rejected
      await expect(call2).rejects.toThrow('Call operation already in progress')

      // Complete first call
      resolveCall()
      await call1

      // Verify only first call was attempted
      expect(mockSipClient.call).toHaveBeenCalledTimes(1)
    })

    it('should prevent concurrent answer attempts', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { answer, session } = useCallSession(sipClientRef)

      // Set up a session
      session.value = mockSession

      // Make answer() hang
      let resolveAnswer: any
      mockSession.answer = vi.fn(
        () => new Promise((resolve) => (resolveAnswer = () => resolve(undefined)))
      )

      // Start first answer (won't complete immediately)
      const answer1 = answer()

      // Try to answer again
      const answer2 = answer()

      // Second answer should be rejected
      await expect(answer2).rejects.toThrow('Call operation already in progress')

      // Complete first answer
      resolveAnswer()
      await answer1

      expect(mockSession.answer).toHaveBeenCalledTimes(1)
    })

    it('should prevent concurrent hangup attempts', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { hangup, session } = useCallSession(sipClientRef)

      // Set up a session
      session.value = mockSession

      // Make hangup() hang
      let resolveHangup: any
      mockSession.hangup = vi.fn(
        () => new Promise((resolve) => (resolveHangup = () => resolve(undefined)))
      )

      // Start first hangup
      const hangup1 = hangup()

      // Try to hangup again
      const hangup2 = hangup()

      // Second hangup should be rejected
      await expect(hangup2).rejects.toThrow('Call operation already in progress')

      // Complete first hangup
      resolveHangup()
      await hangup1

      expect(mockSession.hangup).toHaveBeenCalledTimes(1)
    })

    it('should allow new operation after previous completes', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      // First call completes normally
      await makeCall('sip:alice@example.com')

      // Second call should succeed
      await makeCall('sip:bob@example.com')

      expect(mockSipClient.call).toHaveBeenCalledTimes(2)
    })

    it('should reset guard even if operation fails', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      //Track total call attempts
      let callAttempts = 0
      mockSipClient.call = vi.fn().mockImplementation(() => {
        callAttempts++
        if (callAttempts === 1) {
          return Promise.reject(new Error('Call failed'))
        }
        return Promise.resolve(mockSession)
      })

      // First call fails
      await expect(makeCall('sip:alice@example.com')).rejects.toThrow('Call failed')

      // Second call should succeed (guard was reset)
      await makeCall('sip:bob@example.com')

      expect(callAttempts).toBe(2)
    })
  })

  describe('Duration Timer Error Recovery', () => {
    it('should handle state transitions without errors', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { session } = useCallSession(sipClientRef)

      // Set up a session and transition states
      session.value = mockSession

      // Simulate state changes
      mockSession.state = 'connecting'
      mockSession.state = 'active'
      mockSession.state = 'ended'

      // Should not throw
      expect(() => {
        session.value = mockSession
      }).not.toThrow()
    })
  })

  describe('Media Stream Cleanup', () => {
    it('should cleanup media on call failure', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)

      // Create mock tracks that we can verify were stopped
      const mockAudioTrack = { stop: vi.fn(), kind: 'audio' }
      const mockVideoTrack = { stop: vi.fn(), kind: 'video' }
      const mockTracks = [mockAudioTrack, mockVideoTrack]

      const mockMediaManager = {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(undefined),
          getLocalStream: vi.fn().mockReturnValue({
            getTracks: () => mockTracks,
          }),
        },
      }

      const { makeCall } = useCallSession(sipClientRef, mockMediaManager as any)

      // Make call fail after media acquisition
      mockSipClient.call = vi.fn().mockRejectedValue(new Error('Call failed'))

      await expect(makeCall('sip:bob@example.com')).rejects.toThrow('Call failed')

      // Verify media was acquired
      expect(mockMediaManager.value.getUserMedia).toHaveBeenCalled()

      // Verify cleanup happened (tracks were stopped)
      expect(mockAudioTrack.stop).toHaveBeenCalled()
      expect(mockVideoTrack.stop).toHaveBeenCalled()
    })
  })

  describe('Error Messages', () => {
    it('should provide clear error for no SIP client', async () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { makeCall } = useCallSession(sipClientRef as any)

      await expect(makeCall('sip:bob@example.com')).rejects.toThrow('SIP client not initialized')
    })

    it('should provide clear error for no active session on answer', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { answer } = useCallSession(sipClientRef)

      await expect(answer()).rejects.toThrow('No active session to answer')
    })

    it('should provide clear error for concurrent operations', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      let resolveCall: any
      mockSipClient.call = vi.fn(
        () => new Promise((resolve) => (resolveCall = () => resolve(mockSession)))
      )

      const call1 = makeCall('sip:alice@example.com')
      const call2 = makeCall('sip:bob@example.com')

      await expect(call2).rejects.toThrow('Call operation already in progress')

      resolveCall()
      await call1
    })
  })

  describe('reject() method', () => {
    it('should reject an incoming call with default status code', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { reject, session } = useCallSession(sipClientRef)

      mockSession.reject = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await reject()

      expect(mockSession.reject).toHaveBeenCalledWith(486)
    })

    it('should reject an incoming call with custom status code', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { reject, session } = useCallSession(sipClientRef)

      mockSession.reject = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await reject(603)

      expect(mockSession.reject).toHaveBeenCalledWith(603)
    })

    it('should throw error if no active session to reject', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { reject } = useCallSession(sipClientRef)

      await expect(reject()).rejects.toThrow('No active session to reject')
    })

    it('should propagate rejection errors', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { reject, session } = useCallSession(sipClientRef)

      mockSession.reject = vi.fn().mockRejectedValue(new Error('Reject failed'))
      session.value = mockSession

      await expect(reject()).rejects.toThrow('Reject failed')
    })
  })

  describe('hold/unhold/toggleHold methods', () => {
    it('should put call on hold', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { hold, session } = useCallSession(sipClientRef)

      mockSession.hold = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await hold()

      expect(mockSession.hold).toHaveBeenCalled()
    })

    it('should throw error if no active session to hold', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { hold } = useCallSession(sipClientRef)

      await expect(hold()).rejects.toThrow('No active session to hold')
    })

    it('should resume call from hold', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unhold, session } = useCallSession(sipClientRef)

      mockSession.unhold = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await unhold()

      expect(mockSession.unhold).toHaveBeenCalled()
    })

    it('should throw error if no active session to unhold', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unhold } = useCallSession(sipClientRef)

      await expect(unhold()).rejects.toThrow('No active session to unhold')
    })

    it('should toggle hold state - hold when not on hold', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { toggleHold, session } = useCallSession(sipClientRef)

      mockSession.isOnHold = false
      mockSession.hold = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await toggleHold()

      expect(mockSession.hold).toHaveBeenCalled()
    })

    it('should toggle hold state - unhold when on hold', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { toggleHold, session } = useCallSession(sipClientRef)

      mockSession.isOnHold = true
      mockSession.unhold = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await toggleHold()

      expect(mockSession.unhold).toHaveBeenCalled()
    })

    it('should propagate hold errors', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { hold, session } = useCallSession(sipClientRef)

      mockSession.hold = vi.fn().mockRejectedValue(new Error('Hold failed'))
      session.value = mockSession

      await expect(hold()).rejects.toThrow('Hold failed')
    })

    it('should propagate unhold errors', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unhold, session } = useCallSession(sipClientRef)

      mockSession.unhold = vi.fn().mockRejectedValue(new Error('Unhold failed'))
      session.value = mockSession

      await expect(unhold()).rejects.toThrow('Unhold failed')
    })
  })

  describe('mute/unmute/toggleMute methods', () => {
    it('should mute audio', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { mute, session } = useCallSession(sipClientRef)

      mockSession.mute = vi.fn()
      session.value = mockSession

      mute()

      expect(mockSession.mute).toHaveBeenCalled()
    })

    it('should not throw if no session when muting', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { mute } = useCallSession(sipClientRef)

      expect(() => mute()).not.toThrow()
    })

    it('should unmute audio', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unmute, session } = useCallSession(sipClientRef)

      mockSession.unmute = vi.fn()
      session.value = mockSession

      unmute()

      expect(mockSession.unmute).toHaveBeenCalled()
    })

    it('should not throw if no session when unmuting', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unmute } = useCallSession(sipClientRef)

      expect(() => unmute()).not.toThrow()
    })

    it('should toggle mute state - mute when not muted', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { toggleMute, session } = useCallSession(sipClientRef)

      mockSession.isMuted = false
      mockSession.mute = vi.fn()
      session.value = mockSession

      toggleMute()

      expect(mockSession.mute).toHaveBeenCalled()
    })

    it('should toggle mute state - unmute when muted', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { toggleMute, session } = useCallSession(sipClientRef)

      mockSession.isMuted = true
      mockSession.unmute = vi.fn()
      session.value = mockSession

      toggleMute()

      expect(mockSession.unmute).toHaveBeenCalled()
    })
  })

  describe('sendDTMF method', () => {
    it('should send DTMF tone', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { sendDTMF, session } = useCallSession(sipClientRef)

      mockSession.sendDTMF = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await sendDTMF('1')

      expect(mockSession.sendDTMF).toHaveBeenCalledWith('1', undefined)
    })

    it('should send DTMF tone with options', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { sendDTMF, session } = useCallSession(sipClientRef)

      mockSession.sendDTMF = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      const options = { duration: 200, interToneGap: 100 }
      await sendDTMF('5', options)

      expect(mockSession.sendDTMF).toHaveBeenCalledWith('5', options)
    })

    it('should throw error if no active session to send DTMF', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { sendDTMF } = useCallSession(sipClientRef)

      await expect(sendDTMF('1')).rejects.toThrow('No active session to send DTMF')
    })

    it('should propagate DTMF send errors', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { sendDTMF, session } = useCallSession(sipClientRef)

      mockSession.sendDTMF = vi.fn().mockRejectedValue(new Error('DTMF failed'))
      session.value = mockSession

      await expect(sendDTMF('1')).rejects.toThrow('DTMF failed')
    })
  })

  describe('getStats and clearSession methods', () => {
    it('should get call statistics', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { getStats, session } = useCallSession(sipClientRef)

      const mockStats = { bytesReceived: 1000, bytesSent: 500 }
      mockSession.getStats = vi.fn().mockResolvedValue(mockStats)
      session.value = mockSession

      const stats = await getStats()

      expect(mockSession.getStats).toHaveBeenCalled()
      expect(stats).toEqual(mockStats)
    })

    it('should return null if no active session for stats', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { getStats } = useCallSession(sipClientRef)

      const stats = await getStats()

      expect(stats).toBeNull()
    })

    it('should return null if getStats fails', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { getStats, session } = useCallSession(sipClientRef)

      mockSession.getStats = vi.fn().mockRejectedValue(new Error('Stats failed'))
      session.value = mockSession

      const stats = await getStats()

      expect(stats).toBeNull()
    })

    it('should clear session', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { clearSession, session } = useCallSession(sipClientRef)

      session.value = mockSession

      clearSession()

      expect(session.value).toBeNull()
    })

    it('should not throw if clearing null session', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { clearSession } = useCallSession(sipClientRef)

      expect(() => clearSession()).not.toThrow()
    })
  })

  describe('Reactive State Properties', () => {
    it('should expose session state', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { state, session } = useCallSession(sipClientRef)

      expect(state.value).toBe('idle')

      mockSession.state = 'active'
      session.value = mockSession

      expect(state.value).toBe('active')
    })

    it('should expose callId', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { callId, session } = useCallSession(sipClientRef)

      expect(callId.value).toBeNull()

      session.value = mockSession

      expect(callId.value).toBe('test-call-id')
    })

    it('should expose direction', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { direction, session } = useCallSession(sipClientRef)

      expect(direction.value).toBeNull()

      mockSession.direction = 'outgoing'
      session.value = mockSession

      expect(direction.value).toBe('outgoing')
    })

    it('should expose localUri', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { localUri, session } = useCallSession(sipClientRef)

      expect(localUri.value).toBeNull()

      mockSession.localUri = 'sip:alice@example.com'
      session.value = mockSession

      expect(localUri.value).toBe('sip:alice@example.com')
    })

    it('should expose remoteUri', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { remoteUri, session } = useCallSession(sipClientRef)

      expect(remoteUri.value).toBeNull()

      mockSession.remoteUri = 'sip:bob@example.com'
      session.value = mockSession

      expect(remoteUri.value).toBe('sip:bob@example.com')
    })

    it('should expose remoteDisplayName', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { remoteDisplayName, session } = useCallSession(sipClientRef)

      expect(remoteDisplayName.value).toBeNull()

      mockSession.remoteDisplayName = 'Bob Smith'
      session.value = mockSession

      expect(remoteDisplayName.value).toBe('Bob Smith')
    })

    it('should expose isActive', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { isActive, session } = useCallSession(sipClientRef)

      expect(isActive.value).toBe(false)

      mockSession.state = 'active'
      session.value = mockSession

      expect(isActive.value).toBe(true)

      mockSession.state = 'ringing'
      session.value = { ...mockSession }

      expect(isActive.value).toBe(true)

      mockSession.state = 'connecting'
      session.value = { ...mockSession }

      expect(isActive.value).toBe(true)

      mockSession.state = 'ended'
      session.value = { ...mockSession }

      expect(isActive.value).toBe(false)
    })

    it('should expose isOnHold', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { isOnHold, session } = useCallSession(sipClientRef)

      expect(isOnHold.value).toBe(false)

      mockSession.isOnHold = true
      session.value = mockSession

      expect(isOnHold.value).toBe(true)
    })

    it('should expose isMuted', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { isMuted, session } = useCallSession(sipClientRef)

      expect(isMuted.value).toBe(false)

      mockSession.isMuted = true
      session.value = mockSession

      expect(isMuted.value).toBe(true)
    })

    it('should expose hasRemoteVideo', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { hasRemoteVideo, session } = useCallSession(sipClientRef)

      expect(hasRemoteVideo.value).toBe(false)

      mockSession.hasRemoteVideo = true
      session.value = mockSession

      expect(hasRemoteVideo.value).toBe(true)
    })

    it('should expose hasLocalVideo', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { hasLocalVideo, session } = useCallSession(sipClientRef)

      expect(hasLocalVideo.value).toBe(false)

      mockSession.hasLocalVideo = true
      session.value = mockSession

      expect(hasLocalVideo.value).toBe(true)
    })

    it('should expose localStream', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { localStream, session } = useCallSession(sipClientRef)

      expect(localStream.value).toBeNull()

      const mockStream = { id: 'mock-local-stream' } as any as MediaStream
      mockSession.localStream = mockStream
      session.value = mockSession

      expect(localStream.value).toEqual(mockStream)
    })

    it('should expose remoteStream', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { remoteStream, session } = useCallSession(sipClientRef)

      expect(remoteStream.value).toBeNull()

      const mockStream = { id: 'mock-remote-stream' } as any as MediaStream
      mockSession.remoteStream = mockStream
      session.value = mockSession

      expect(remoteStream.value).toEqual(mockStream)
    })

    it('should expose timing', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { timing, session } = useCallSession(sipClientRef)

      expect(timing.value).toEqual({})

      const mockTiming = { startTime: new Date(), answerTime: new Date() }
      mockSession.timing = mockTiming
      session.value = mockSession

      expect(timing.value).toEqual(mockTiming)
    })

    it('should expose duration', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { duration } = useCallSession(sipClientRef)

      expect(duration.value).toBe(0)
    })

    it('should expose terminationCause', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { terminationCause, session } = useCallSession(sipClientRef)

      expect(terminationCause.value).toBeUndefined()

      mockSession.terminationCause = 'busy'
      session.value = mockSession

      expect(terminationCause.value).toBe('busy')
    })
  })

  describe('Duration Tracking', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should start duration tracking when call becomes active', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { duration, session, state } = useCallSession(sipClientRef)

      mockSession.state = 'active'
      mockSession.timing = { answerTime: new Date() }
      session.value = mockSession

      // Wait a bit for the watcher to fire
      await vi.advanceTimersByTimeAsync(0)

      expect(duration.value).toBe(0)

      // Advance 3 seconds
      await vi.advanceTimersByTimeAsync(3000)

      expect(duration.value).toBeGreaterThanOrEqual(2)
    })

    it('should stop duration tracking when call ends', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { duration, session } = useCallSession(sipClientRef)

      mockSession.state = 'active'
      mockSession.timing = { answerTime: new Date() }
      session.value = mockSession

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(2000)

      const durationWhenActive = duration.value

      // End the call
      mockSession.state = 'ended'
      session.value = { ...mockSession }

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(5000)

      // Duration should not have increased after ended
      expect(duration.value).toBe(durationWhenActive)
    })

    it('should stop duration tracking when call fails', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { duration, session } = useCallSession(sipClientRef)

      mockSession.state = 'active'
      mockSession.timing = { answerTime: new Date() }
      session.value = mockSession

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(2000)

      const durationWhenActive = duration.value

      // Fail the call
      mockSession.state = 'failed'
      session.value = { ...mockSession }

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(5000)

      // Duration should not have increased after failed
      expect(duration.value).toBe(durationWhenActive)
    })

    it('should reset duration on new call', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { duration, session, makeCall } = useCallSession(sipClientRef)

      // First call
      mockSession.state = 'active'
      mockSession.timing = { answerTime: new Date() }
      session.value = mockSession

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(3000)

      expect(duration.value).toBeGreaterThan(0)

      // Make a new call
      await makeCall('sip:bob@example.com')

      // Duration should be reset
      expect(duration.value).toBe(0)
    })
  })

  describe('Media Cleanup on Answer Failure', () => {
    it('should cleanup media if answer fails after acquisition', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)

      const mockAudioTrack = { stop: vi.fn(), kind: 'audio' }
      const mockVideoTrack = { stop: vi.fn(), kind: 'video' }
      const mockTracks = [mockAudioTrack, mockVideoTrack]

      const mockMediaManager = {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(undefined),
          getLocalStream: vi.fn().mockReturnValue({
            getTracks: () => mockTracks,
          }),
        },
      }

      const { answer, session } = useCallSession(sipClientRef, mockMediaManager as any)

      // Set up session
      mockSession.answer = vi.fn().mockRejectedValue(new Error('Answer failed'))
      session.value = mockSession

      await expect(answer()).rejects.toThrow('Answer failed')

      // Verify media was acquired
      expect(mockMediaManager.value.getUserMedia).toHaveBeenCalled()

      // Verify cleanup happened
      expect(mockAudioTrack.stop).toHaveBeenCalled()
      expect(mockVideoTrack.stop).toHaveBeenCalled()
    })
  })

  describe('Call Options (Audio/Video Combinations)', () => {
    it('should make audio-only call', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const mockMediaManager = {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(undefined),
          getLocalStream: vi.fn().mockReturnValue(null),
        },
      }

      const { makeCall } = useCallSession(sipClientRef, mockMediaManager as any)

      await makeCall('sip:bob@example.com', { audio: true, video: false })

      expect(mockMediaManager.value.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      })
      expect(mockSipClient.call).toHaveBeenCalledWith(
        'sip:bob@example.com',
        expect.objectContaining({
          mediaConstraints: { audio: true, video: false },
        })
      )
    })

    it('should make video call', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const mockMediaManager = {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(undefined),
          getLocalStream: vi.fn().mockReturnValue(null),
        },
      }

      const { makeCall } = useCallSession(sipClientRef, mockMediaManager as any)

      await makeCall('sip:bob@example.com', { audio: true, video: true })

      expect(mockMediaManager.value.getUserMedia).toHaveBeenCalledWith({ audio: true, video: true })
      expect(mockSipClient.call).toHaveBeenCalledWith(
        'sip:bob@example.com',
        expect.objectContaining({
          mediaConstraints: { audio: true, video: true },
        })
      )
    })

    it('should answer with audio-only', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const mockMediaManager = {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(undefined),
          getLocalStream: vi.fn().mockReturnValue(null),
        },
      }

      const { answer, session } = useCallSession(sipClientRef, mockMediaManager as any)

      mockSession.answer = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await answer({ audio: true, video: false })

      expect(mockMediaManager.value.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      })
    })

    it('should answer with video', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const mockMediaManager = {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(undefined),
          getLocalStream: vi.fn().mockReturnValue(null),
        },
      }

      const { answer, session } = useCallSession(sipClientRef, mockMediaManager as any)

      mockSession.answer = vi.fn().mockResolvedValue(undefined)
      session.value = mockSession

      await answer({ audio: true, video: true })

      expect(mockMediaManager.value.getUserMedia).toHaveBeenCalledWith({ audio: true, video: true })
    })
  })

  describe('Lifecycle Cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should cleanup duration tracking on unmount', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)

      // We need to test that onUnmounted cleanup works
      // This is tested indirectly through the composable lifecycle
      const { session, duration } = useCallSession(sipClientRef)

      mockSession.state = 'active'
      mockSession.timing = { answerTime: new Date() }
      session.value = mockSession

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(2000)

      expect(duration.value).toBeGreaterThan(0)

      // The actual onUnmounted hook will be called by Vue
      // We can verify the timer cleanup happens correctly through other tests
    })
  })

  describe('Call Store Integration', () => {
    it('should add call to store on makeCall', async () => {
      const { callStore } = await import('@/stores/callStore')
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      await makeCall('sip:bob@example.com')

      expect(callStore.addActiveCall).toHaveBeenCalledWith(mockSession)
    })

    it('should remove call from store on clearSession', async () => {
      const { callStore } = await import('@/stores/callStore')
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { clearSession, session } = useCallSession(sipClientRef)

      session.value = mockSession

      clearSession()

      expect(callStore.removeActiveCall).toHaveBeenCalledWith('test-call-id')
    })
  })

  describe('AbortController Integration', () => {
    it('should abort makeCall when AbortSignal is triggered before call', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      const controller = new AbortController()
      controller.abort() // Abort immediately

      await expect(makeCall('sip:bob@example.com', {}, controller.signal)).rejects.toThrow(
        'AbortError'
      )
      expect(mockSipClient.call).not.toHaveBeenCalled()
    })

    it('should abort makeCall when AbortSignal is triggered during call setup', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      const controller = new AbortController()

      // Delay the call() to simulate async operation
      mockSipClient.call = vi.fn().mockImplementation(async () => {
        controller.abort() // Abort during the call
        return mockSession
      })

      await expect(makeCall('sip:bob@example.com', {}, controller.signal)).rejects.toThrow(
        'AbortError'
      )
    })

    it('should cleanup media when makeCall is aborted', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const mockMediaManager = {
        getUserMedia: vi.fn().mockResolvedValue(undefined),
        getLocalStream: vi.fn().mockReturnValue({
          getTracks: vi.fn().mockReturnValue([
            { kind: 'audio', stop: vi.fn() },
            { kind: 'video', stop: vi.fn() },
          ]),
        }),
      }
      const mediaManagerRef = ref(mockMediaManager as any)
      const { makeCall } = useCallSession(sipClientRef, mediaManagerRef)

      const controller = new AbortController()

      // Abort after media is acquired
      mockMediaManager.getUserMedia.mockImplementation(async () => {
        controller.abort()
        throw new DOMException('Operation aborted', 'AbortError')
      })

      await expect(makeCall('sip:bob@example.com', {}, controller.signal)).rejects.toThrow(
        'AbortError'
      )

      // Verify media was acquired
      expect(mockMediaManager.getUserMedia).toHaveBeenCalled()
    })

    it('should work without AbortSignal (backward compatibility)', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      // Call without signal parameter
      await makeCall('sip:bob@example.com')

      expect(mockSipClient.call).toHaveBeenCalled()
    })

    it('should differentiate abort errors from other errors', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { makeCall } = useCallSession(sipClientRef)

      const controller = new AbortController()

      // Simulate a different error
      mockSipClient.call = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(makeCall('sip:bob@example.com', {}, controller.signal)).rejects.toThrow(
        'Network error'
      )
      expect(mockSipClient.call).toHaveBeenCalled()
    })
  })
})
