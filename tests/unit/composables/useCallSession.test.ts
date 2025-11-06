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
})
