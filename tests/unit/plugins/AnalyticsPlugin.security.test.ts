/**
 * AnalyticsPlugin Security Tests
 *
 * Tests for security-related features:
 * - Session ID generation with crypto APIs
 * - Collision resistance
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { AnalyticsPlugin } from '../../../src/plugins/AnalyticsPlugin'
import * as loggerModule from '../../../src/utils/logger'

describe('AnalyticsPlugin - Security', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Session ID Generation', () => {
    it('should use crypto.randomUUID when available', () => {
      const mockRandomUUID = vi.fn(() => '123e4567-e89b-12d3-a456-426614174000')

      vi.stubGlobal('crypto', {
        randomUUID: mockRandomUUID,
        getRandomValues: global.crypto.getRandomValues,
      })

      const plugin = new AnalyticsPlugin()
      const sessionId = (plugin as any).sessionId

      expect(sessionId).toContain('session-')
      expect(sessionId).toContain('123e4567')
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

      const plugin = new AnalyticsPlugin()
      const sessionId = (plugin as any).sessionId

      expect(sessionId).toContain('session-')
      expect(sessionId).toContain('12345678')
      expect(mockGetRandomValues).toHaveBeenCalled()
    })

    it('should fallback to Math.random when crypto not available', () => {
      vi.stubGlobal('crypto', undefined)

      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const plugin = new AnalyticsPlugin()
      const sessionId = (plugin as any).sessionId

      expect(sessionId).toContain('session-')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should generate unique session IDs', () => {
      const plugin1 = new AnalyticsPlugin()
      const plugin2 = new AnalyticsPlugin()
      const plugin3 = new AnalyticsPlugin()

      const id1 = (plugin1 as any).sessionId
      const id2 = (plugin2 as any).sessionId
      const id3 = (plugin3 as any).sessionId

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })
  })
})
