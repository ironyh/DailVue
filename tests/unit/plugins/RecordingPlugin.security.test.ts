/**
 * RecordingPlugin Security Tests
 *
 * Tests for security-related features:
 * - Recording ID generation with crypto APIs
 * - Collision resistance
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { RecordingPlugin } from '../../../src/plugins/RecordingPlugin'
import * as loggerModule from '../../../src/utils/logger'

describe('RecordingPlugin - Security', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Recording ID Generation', () => {
    it('should use crypto.randomUUID when available', () => {
      const mockRandomUUID = vi.fn(() => '123e4567-e89b-12d3-a456-426614174000')

      vi.stubGlobal('crypto', {
        randomUUID: mockRandomUUID,
        getRandomValues: global.crypto.getRandomValues,
      })

      const plugin = new RecordingPlugin()

      // Call the private generateRecordingId method via reflection
      const recordingId = (plugin as any).generateRecordingId()

      expect(recordingId).toContain('recording-')
      expect(recordingId).toContain('123e4567')
      expect(mockRandomUUID).toHaveBeenCalled()
    })

    it('should use crypto.getRandomValues when randomUUID not available', () => {
      const mockGetRandomValues = vi.fn((array: Uint32Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = 0x12345678
        }
        return array
      })

      vi.stubGlobal('crypto', {
        getRandomValues: mockGetRandomValues,
      })

      const plugin = new RecordingPlugin()
      const recordingId = (plugin as any).generateRecordingId()

      expect(recordingId).toContain('recording-')
      expect(recordingId).toContain('12345678')
      expect(mockGetRandomValues).toHaveBeenCalled()
    })

    it('should fallback to Math.random when crypto not available', () => {
      vi.stubGlobal('crypto', undefined)

      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const plugin = new RecordingPlugin()
      const recordingId = (plugin as any).generateRecordingId()

      expect(recordingId).toContain('recording-')
      // Should have logged warning about non-cryptographic generation
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should generate unique recording IDs', () => {
      const plugin = new RecordingPlugin()

      const id1 = (plugin as any).generateRecordingId()
      const id2 = (plugin as any).generateRecordingId()
      const id3 = (plugin as any).generateRecordingId()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })
  })
})
