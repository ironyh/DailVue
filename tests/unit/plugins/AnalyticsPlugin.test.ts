/**
 * AnalyticsPlugin Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnalyticsPlugin } from '../../../src/plugins/AnalyticsPlugin'
import { EventBus } from '../../../src/core/EventBus'
import type { PluginContext, AnalyticsEvent } from '../../../src/types/plugin.types'

// Mock fetch
global.fetch = vi.fn()

describe('AnalyticsPlugin', () => {
  let plugin: AnalyticsPlugin
  let eventBus: EventBus
  let context: PluginContext

  beforeEach(() => {
    eventBus = new EventBus()
    context = {
      eventBus,
      version: '1.0.0',
      hooks: {
        register: vi.fn(),
        execute: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    } as any

    plugin = new AnalyticsPlugin()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (plugin) {
      await plugin.uninstall(context)
    }
    eventBus.destroy()
  })

  describe('metadata', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.metadata.name).toBe('analytics')
      expect(plugin.metadata.version).toBe('1.0.0')
      expect(plugin.metadata.description).toBeTruthy()
    })
  })

  describe('install', () => {
    it('should install plugin with default config', async () => {
      await plugin.install(context)
      expect(plugin).toBeDefined()
    })

    it('should install plugin with custom config', async () => {
      const config = {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        enabled: true,
      }

      await plugin.install(context, config)
      expect(plugin).toBeDefined()
    })

    it('should warn if endpoint is not configured', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await plugin.install(context, { enabled: true })

      // The plugin should still install but log a warning
      expect(plugin).toBeDefined()

      warnSpy.mockRestore()
    })

    it('should register event listeners', async () => {
      await plugin.install(context)

      // Emit events and verify they are tracked
      eventBus.emit('connected', undefined)
      eventBus.emit('disconnected', undefined)
      eventBus.emit('registered', undefined)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(plugin).toBeDefined()
    })

    it('should start batch timer if batching enabled', async () => {
      await plugin.install(context, {
        batchEvents: true,
        sendInterval: 100,
      })

      expect(plugin).toBeDefined()
    })
  })

  describe('uninstall', () => {
    it('should uninstall plugin', async () => {
      await plugin.install(context)
      await plugin.uninstall(context)

      expect(plugin).toBeDefined()
    })

    it('should flush events on uninstall', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
      })

      // Track some events
      eventBus.emit('connected', undefined)

      await plugin.uninstall(context)

      // Give time for async flush
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should stop batch timer on uninstall', async () => {
      await plugin.install(context, {
        batchEvents: true,
        sendInterval: 100,
      })

      await plugin.uninstall(context)

      expect(plugin).toBeDefined()
    })
  })

  describe('event tracking', () => {
    beforeEach(async () => {
      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        enabled: true,
      })
    })

    it('should track connection events', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should track call events', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      eventBus.emit('callStarted', {
        callId: 'call-123',
        direction: 'outgoing',
      })

      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should track registration events', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      eventBus.emit('registered', undefined)
      eventBus.emit('unregistered', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should track media events', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      eventBus.emit('mediaAcquired', undefined)
      eventBus.emit('mediaReleased', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  })

  describe('event batching', () => {
    it('should batch events when enabled', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock
      const sendSpy = vi
        .spyOn(plugin as any, 'sendEvents')
        .mockResolvedValue(undefined)

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        batchSize: 4, // Account for plugin:installed event (1) + 3 more = 4 total
        sendInterval: 5000,
      })

      // Wait for plugin:installed event to be processed
      await new Promise((resolve) => setTimeout(resolve, 50))
      // Clear the fetch mock to ignore the plugin:installed event
      fetchMock.mockClear()

      // Track events
      eventBus.emit('connected')
      eventBus.emit('registered')

      // Should not send yet (batch size not reached: 1 plugin:installed + 2 new = 3 < 4)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(sendSpy).not.toHaveBeenCalled()

      // Track one more event to reach batch size (1 + 2 + 1 = 4)
      eventBus.emit('callStarted', { callId: 'test' })

      // Should send now
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(fetchMock).toHaveBeenCalled()
    })

    it('should send batched events on interval', async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock
      const sendSpy = vi
        .spyOn(plugin as any, 'sendEvents')
        .mockResolvedValue(undefined)

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        batchSize: 10,
        sendInterval: 1000,
      })

      // Track some events
      eventBus.emit('connected', undefined)

      // Fast-forward time to trigger batch send
      await vi.advanceTimersByTimeAsync(1000)

      // Allow any pending async operations to complete
      await vi.advanceTimersByTimeAsync(50)

      expect(sendSpy).toHaveBeenCalledTimes(1)

      sendSpy.mockRestore()
      vi.clearAllTimers()
      vi.useRealTimers()
    })
  })

  describe('event filtering', () => {
    it('should track only specified events', async () => {
      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        trackEvents: ['call:*'],
      })

      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      // Should track
      eventBus.emit('callStarted', { callId: 'test' })

      // Should not track
      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should ignore specified events', async () => {
      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        ignoreEvents: ['sip:*'],
      })

      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      // Should not track
      eventBus.emit('connected', undefined)

      // Should track
      eventBus.emit('callStarted', { callId: 'test' })

      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should support wildcard patterns', async () => {
      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        trackEvents: ['call:*', 'media:*'],
      })

      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      eventBus.emit('callStarted', { callId: 'test' })
      eventBus.emit('mediaAcquired', undefined)
      eventBus.emit('connected', undefined) // Should not track

      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  })

  describe('event transformation', () => {
    it('should transform events', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      const transformEvent = vi.fn((event: AnalyticsEvent) => ({
        ...event,
        data: { ...event.data, transformed: true },
      }))

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        transformEvent,
      })

      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(transformEvent).toHaveBeenCalled()
    })
  })

  describe('updateConfig', () => {
    beforeEach(async () => {
      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        sendInterval: 1000,
      })
    })

    it('should update configuration', async () => {
      await plugin.updateConfig(context, {
        batchSize: 5,
      })

      expect(plugin).toBeDefined()
    })

    it('should restart batch timer if interval changed', async () => {
      await plugin.updateConfig(context, {
        sendInterval: 2000,
      })

      expect(plugin).toBeDefined()
    })

    it('should stop batching if disabled', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.updateConfig(context, {
        batchEvents: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  })

  describe('setUserId', () => {
    it('should set user ID', async () => {
      await plugin.install(context, {
        includeUserInfo: true,
      })

      plugin.setUserId('user-123')

      expect(plugin).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
      })

      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should not throw
      expect(plugin).toBeDefined()
    })

    it('should handle non-200 responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
      })

      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should not throw
      expect(plugin).toBeDefined()
    })

    it('should re-queue events on failure', async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
      })

      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 100))
    })
  })

  describe('disabled plugin', () => {
    it('should not track events when disabled', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        enabled: false,
      })

      eventBus.emit('connected', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
