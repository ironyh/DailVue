/**
 * AnalyticsPlugin Validation Tests
 *
 * Tests for event data validation features:
 * - Empty/null event data validation
 * - Event payload size limits
 * - Serialization error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnalyticsPlugin } from '../../../src/plugins/AnalyticsPlugin'
import { EventBus } from '../../../src/core/EventBus'
import * as loggerModule from '../../../src/utils/logger'

describe('AnalyticsPlugin - Validation', () => {
  describe('Empty Event Tracking Validation', () => {
    let plugin: AnalyticsPlugin
    let eventBus: EventBus

    beforeEach(async () => {
      plugin = new AnalyticsPlugin()
      eventBus = new EventBus()
      // Enable logging for tests
      loggerModule.configureLogger({ enabled: true, level: 'warn' })

      await plugin.install(
        { eventBus },
        {
          endpoint: 'https://test.com',
          validateEventData: true, // Enable validation
          batchEvents: false, // Disable batching for easier testing
        }
      )
    })

    afterEach(async () => {
      await plugin.uninstall({ eventBus })
      // Restore logging
      loggerModule.configureLogger({ enabled: false })
    })

    it('should reject null event data when validation enabled', () => {
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      ;(plugin as any).trackEvent('test:event', null as any)

      expect(consoleSpy).toHaveBeenCalled()
      // Logger uses formatted output, check that any argument contains the message
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Invalid event data'))
        )
      ).toBe(true)

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should accept undefined event data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      ;(plugin as any).trackEvent('test:event', undefined)

      // Should not warn about invalid data
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Invalid event data'))
        )
      ).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should accept empty object event data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      ;(plugin as any).trackEvent('test:event', {})

      // Should not warn about invalid data
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Invalid event data'))
        )
      ).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should reject array event data', () => {
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      ;(plugin as any).trackEvent('test:event', [] as any)

      expect(consoleSpy).toHaveBeenCalled()
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Invalid event data'))
        )
      ).toBe(true)

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should reject non-object event data', () => {
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      ;(plugin as any).trackEvent('test:event', 'string' as any)
      ;(plugin as any).trackEvent('test:event', 123 as any)
      ;(plugin as any).trackEvent('test:event', true as any)

      expect(consoleSpy).toHaveBeenCalledTimes(3)

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should allow disabling validation', async () => {
      await plugin.uninstall({ eventBus })

      plugin = new AnalyticsPlugin()
      await plugin.install(
        { eventBus },
        {
          endpoint: 'https://test.com',
          validateEventData: false, // Disable validation
          batchEvents: false,
        }
      )

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Null should be allowed when validation disabled
      ;(plugin as any).trackEvent('test:event', null as any)

      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Invalid event data'))
        )
      ).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('Large Event Payload Size Limits', () => {
    let plugin: AnalyticsPlugin
    let eventBus: EventBus

    beforeEach(async () => {
      plugin = new AnalyticsPlugin()
      eventBus = new EventBus()
      // Enable logging for tests
      loggerModule.configureLogger({ enabled: true, level: 'warn' })

      await plugin.install(
        { eventBus },
        {
          endpoint: 'https://test.com',
          maxPayloadSize: 1000, // 1KB limit for testing
          batchEvents: false,
        }
      )
    })

    afterEach(async () => {
      await plugin.uninstall({ eventBus })
      // Restore logging
      loggerModule.configureLogger({ enabled: false })
    })

    it('should reject events exceeding payload size limit', () => {
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Create large event data
      const largeData = {
        bigArray: new Array(1000).fill('x'.repeat(100)),
      }

      ;(plugin as any).trackEvent('test:event', largeData)

      expect(consoleSpy).toHaveBeenCalled()
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Event payload too large'))
        )
      ).toBe(true)

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should accept events within payload size limit', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Small event data
      const smallData = {
        message: 'test',
      }

      ;(plugin as any).trackEvent('test:event', smallData)

      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Event payload too large'))
        )
      ).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should use default 100KB limit', async () => {
      await plugin.uninstall({ eventBus })

      plugin = new AnalyticsPlugin()
      await plugin.install(
        { eventBus },
        {
          endpoint: 'https://test.com',
          // maxPayloadSize not specified, should default to 100KB
          batchEvents: false,
        }
      )

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Create data under 100KB
      const mediumData = {
        data: 'x'.repeat(50000), // 50KB
      }

      ;(plugin as any).trackEvent('test:event', mediumData)

      // Should not exceed 100KB default limit
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Event payload too large'))
        )
      ).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should handle serialization failures', () => {
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create circular reference that will fail JSON.stringify
      const circular: any = { prop: 'value' }
      circular.circular = circular

      ;(plugin as any).trackEvent('test:event', circular)

      expect(consoleSpy).toHaveBeenCalled()
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('Failed to serialize event'))
        )
      ).toBe(true)

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })
  })
})
