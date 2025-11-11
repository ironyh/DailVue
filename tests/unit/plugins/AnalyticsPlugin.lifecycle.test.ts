/**
 * AnalyticsPlugin Lifecycle Tests
 *
 * Tests for plugin lifecycle management:
 * - Installation and uninstallation
 * - Multiple install protection
 * - Resource cleanup (timers, listeners)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnalyticsPlugin } from '../../../src/plugins/AnalyticsPlugin'
import { EventBus } from '../../../src/core/EventBus'
import { checkEventBusListeners } from '../../utils/test-helpers'
import * as loggerModule from '../../../src/utils/logger'

describe('AnalyticsPlugin - Lifecycle', () => {
  describe('Multiple Install Protection', () => {
    let plugin: AnalyticsPlugin
    let eventBus: EventBus

    beforeEach(() => {
      plugin = new AnalyticsPlugin()
      eventBus = new EventBus()
    })

    afterEach(async () => {
      try {
        await plugin.uninstall({ eventBus })
      } catch {
        // Ignore if already uninstalled
      }
    })

    it('should prevent double installation', async () => {
      // Enable logging for this test and spy on console.warn
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await plugin.install({ eventBus }, { endpoint: 'https://test.com' })
      await plugin.install({ eventBus }, { endpoint: 'https://test.com' })

      expect(consoleSpy).toHaveBeenCalled()
      const calls = consoleSpy.mock.calls
      expect(
        calls.some((call) =>
          call.some((arg) => typeof arg === 'string' && arg.includes('already installed'))
        )
      ).toBe(true)

      consoleSpy.mockRestore()
      // Restore logging to disabled state
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })

    it('should allow reinstallation after uninstall', async () => {
      await plugin.install({ eventBus }, { endpoint: 'https://test.com' })
      await plugin.uninstall({ eventBus })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await plugin.install({ eventBus }, { endpoint: 'https://test.com' })

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('already installed'),
        expect.anything()
      )

      consoleSpy.mockRestore()
    })

    it('should not start duplicate timers on double install', async () => {
      await plugin.install(
        { eventBus },
        {
          endpoint: 'https://test.com',
          batchEvents: true,
          sendInterval: 1000,
        }
      )

      const batchTimerBefore = (plugin as any).batchTimer

      await plugin.install(
        { eventBus },
        {
          endpoint: 'https://test.com',
          batchEvents: true,
          sendInterval: 1000,
        }
      )

      const batchTimerAfter = (plugin as any).batchTimer

      expect(batchTimerAfter).toBe(batchTimerBefore)
    })

    it('should not register duplicate event listeners on double install', async () => {
      await plugin.install({ eventBus }, { endpoint: 'https://test.com' })

      const listenersBefore = checkEventBusListeners(eventBus)

      await plugin.install({ eventBus }, { endpoint: 'https://test.com' })

      const listenersAfter = checkEventBusListeners(eventBus)

      expect(listenersAfter).toBe(listenersBefore)
    })
  })

  describe('Batch Timer Memory Leak', () => {
    let plugin: AnalyticsPlugin
    let eventBus: EventBus

    beforeEach(() => {
      plugin = new AnalyticsPlugin()
      eventBus = new EventBus()
    })

    it('should cleanup timer when install fails', async () => {
      const originalMethod = (plugin as any).registerEventListeners
      ;(plugin as any).registerEventListeners = vi.fn(() => {
        throw new Error('Registration failed')
      })

      await expect(
        plugin.install(
          { eventBus },
          {
            endpoint: 'https://test.com',
            batchEvents: true,
            sendInterval: 1000,
          }
        )
      ).rejects.toThrow('Registration failed')

      const batchTimer = (plugin as any).batchTimer
      expect(batchTimer).toBeNull()

      const cleanupFunctions = (plugin as any).cleanupFunctions
      expect(cleanupFunctions).toHaveLength(0)
      ;(plugin as any).registerEventListeners = originalMethod
    })

    it('should not leak timer if trackEvent throws', async () => {
      const originalTrackEvent = plugin.trackEvent
      plugin.trackEvent = vi.fn(() => {
        throw new Error('Track failed')
      })

      await expect(
        plugin.install(
          { eventBus },
          {
            endpoint: 'https://test.com',
            batchEvents: true,
          }
        )
      ).rejects.toThrow('Track failed')

      const batchTimer = (plugin as any).batchTimer
      expect(batchTimer).toBeNull()

      plugin.trackEvent = originalTrackEvent
    })
  })
})
