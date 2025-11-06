/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useDTMF composable unit tests
 * Tests for Phase 6.11 improvements: DTMF queue size limit enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useDTMF } from '@/composables/useDTMF'
import type { CallSession } from '@/core/CallSession'
import { DTMF_CONSTANTS } from '@/composables/constants'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('useDTMF - Phase 6.11 Queue Limit Enforcement', () => {
  let mockSession: any

  beforeEach(() => {
    mockSession = {
      id: 'test-session',
      state: 'active',
      sendDTMF: vi.fn().mockResolvedValue(undefined),
    }
  })

  describe('Queue Size Limit - Single Tone', () => {
    it('should enforce MAX_QUEUE_SIZE limit when queueing individual tones', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      // Queue MAX_QUEUE_SIZE tones
      for (let i = 0; i < DTMF_CONSTANTS.MAX_QUEUE_SIZE; i++) {
        queueTone('1')
      }

      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)

      // Queue one more - should still be at MAX_QUEUE_SIZE
      queueTone('2')
      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)
    })

    it('should drop oldest tone when queue is full', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      // Fill queue with numbered tones
      for (let i = 0; i < DTMF_CONSTANTS.MAX_QUEUE_SIZE; i++) {
        queueTone((i % 10).toString())
      }

      // First tone should be '0'
      expect(queuedTones.value[0]).toBe('0')

      // Queue 'X' - should drop '0' and add 'X' at end
      queueTone('#')
      expect(queuedTones.value[0]).not.toBe('0')
      expect(queuedTones.value[0]).toBe('1')
      expect(queuedTones.value[queuedTones.value.length - 1]).toBe('#')
    })

    it('should maintain LRU (Least Recently Used) eviction order', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      // Queue tones A, B, C when queue is full
      for (let i = 0; i < DTMF_CONSTANTS.MAX_QUEUE_SIZE; i++) {
        queueTone('1')
      }

      queueTone('*') // Drop first '1', add '*'
      queueTone('#') // Drop second '1', add '#'

      // Last two should be '*' and '#'
      expect(queuedTones.value[queuedTones.value.length - 2]).toBe('*')
      expect(queuedTones.value[queuedTones.value.length - 1]).toBe('#')
    })
  })

  describe('Queue Size Limit - Tone Sequence', () => {
    it('should enforce MAX_QUEUE_SIZE limit when queueing sequences', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueToneSequence, queuedTones } = useDTMF(sessionRef)

      // Create a sequence longer than MAX_QUEUE_SIZE
      const longSequence = '1'.repeat(DTMF_CONSTANTS.MAX_QUEUE_SIZE + 50)

      queueToneSequence(longSequence)

      // Should be capped at MAX_QUEUE_SIZE
      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)
    })

    it('should drop exact number of oldest tones needed for sequence', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queueToneSequence, queuedTones } = useDTMF(sessionRef)

      // Fill queue almost to limit (leave room for 5)
      for (let i = 0; i < DTMF_CONSTANTS.MAX_QUEUE_SIZE - 5; i++) {
        queueTone('1')
      }

      // Queue 10 more (should drop 5 oldest)
      queueToneSequence('2222222222') // 10 tones

      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)

      // First 5 '1's should be dropped, last ones should be '2's
      const lastTen = queuedTones.value.slice(-10)
      expect(lastTen.every((t) => t === '2')).toBe(true)
    })

    it('should handle sequence that exactly fills queue', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueToneSequence, queuedTones } = useDTMF(sessionRef)

      const sequence = '1'.repeat(DTMF_CONSTANTS.MAX_QUEUE_SIZE)
      queueToneSequence(sequence)

      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)
      expect(queuedTones.value.every((t) => t === '1')).toBe(true)
    })

    it('should handle multiple small sequences within limit', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueToneSequence, queuedTones } = useDTMF(sessionRef)

      // Queue multiple sequences that sum to less than limit
      queueToneSequence('123')
      queueToneSequence('456')
      queueToneSequence('789')

      expect(queuedTones.value.length).toBe(9)
      expect(queuedTones.value.join('')).toBe('123456789')
    })
  })

  describe('Queue Limit Edge Cases', () => {
    it('should handle empty queue correctly', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queuedTones } = useDTMF(sessionRef)

      expect(queuedTones.value.length).toBe(0)
    })

    it('should handle queueing exactly at limit boundary', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      // Queue exactly MAX_QUEUE_SIZE - 1
      for (let i = 0; i < DTMF_CONSTANTS.MAX_QUEUE_SIZE - 1; i++) {
        queueTone('1')
      }

      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE - 1)

      // One more should fit without dropping
      queueTone('2')
      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)

      // One more should trigger drop
      queueTone('3')
      expect(queuedTones.value.length).toBe(DTMF_CONSTANTS.MAX_QUEUE_SIZE)
      expect(queuedTones.value[0]).toBe('1') // First one was NOT dropped
      expect(queuedTones.value[1]).toBe('1') // Second '1' became first after drop
    })

    it('should work correctly after clearing queue', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, clearQueue, queuedTones } = useDTMF(sessionRef)

      // Fill queue
      for (let i = 0; i < 50; i++) {
        queueTone('1')
      }

      // Clear it
      clearQueue()
      expect(queuedTones.value.length).toBe(0)

      // Should be able to queue again
      queueTone('2')
      expect(queuedTones.value.length).toBe(1)
      expect(queuedTones.value[0]).toBe('2')
    })
  })

  describe('Valid DTMF Tones', () => {
    it('should accept valid DTMF tones 0-9', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      for (let i = 0; i <= 9; i++) {
        queueTone(i.toString())
      }

      expect(queuedTones.value.length).toBe(10)
    })

    it('should accept * and # tones', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      queueTone('*')
      queueTone('#')

      expect(queuedTones.value).toEqual(['*', '#'])
    })

    it('should accept A-D tones', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, queuedTones } = useDTMF(sessionRef)

      queueTone('A')
      queueTone('B')
      queueTone('C')
      queueTone('D')

      expect(queuedTones.value).toEqual(['A', 'B', 'C', 'D'])
    })

    it('should reject invalid tones', () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone } = useDTMF(sessionRef)

      expect(() => queueTone('X')).toThrow()
      expect(() => queueTone('invalid')).toThrow()
      expect(() => queueTone('')).toThrow()
    })
  })

  describe('Queue Processing', () => {
    it('should process queue without exceeding limit', async () => {
      const sessionRef = ref<CallSession>(mockSession)
      const { queueTone, processQueue, queuedTones } = useDTMF(sessionRef)

      // Queue some tones
      for (let i = 0; i < 10; i++) {
        queueTone('1')
      }

      await processQueue()

      // Queue should be empty after processing
      expect(queuedTones.value.length).toBe(0)
    })
  })
})
