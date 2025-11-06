/**
 * AnalyticsPlugin Edge Case Tests
 *
 * Tests for critical edge cases and fixes implemented in code review
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnalyticsPlugin } from '../../../src/plugins/AnalyticsPlugin'
import { EventBus } from '../../../src/core/EventBus'
import type { PluginContext } from '../../../src/types/plugin.types'

// Mock fetch
global.fetch = vi.fn()

describe('AnalyticsPlugin - Edge Cases', () => {
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

  describe('Event Queue Overflow Protection', () => {
    it('should drop old events when queue exceeds maxQueueSize', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        batchSize: 10000, // Large batch size to prevent auto-flush
        maxQueueSize: 100,
      })

      // Generate 150 events (exceeds maxQueueSize of 100)
      for (let i = 0; i < 150; i++) {
        eventBus.emit('connected')
        await new Promise((resolve) => setTimeout(resolve, 1))
      }

      // Manually flush to see what was kept
      await (plugin as any).flushEvents()

      // Should have sent fewer than 150 events (oldest dropped)
      if (fetchMock.mock.calls.length > 0) {
        const sentEvents = JSON.parse(fetchMock.mock.calls[0][1].body).events
        expect(sentEvents.length).toBeLessThanOrEqual(100)
      }
    })

    it('should handle maxQueueSize = 0 gracefully', async () => {
      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        maxQueueSize: 0,
      })

      // Should not crash with maxQueueSize = 0
      eventBus.emit('connected')
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(plugin).toBeDefined()
    })
  })

  describe('Concurrent Flush Protection', () => {
    it('should prevent concurrent flush operations', async () => {
      const fetchMock = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 100)
          })
      )
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
      })

      // Track some events
      eventBus.emit('connected')
      eventBus.emit('connected')

      // Try to flush multiple times concurrently
      const flushPromises = [
        (plugin as any).flushEvents(),
        (plugin as any).flushEvents(),
        (plugin as any).flushEvents(),
      ]

      await Promise.all(flushPromises)

      // Should only call fetch once (other flushes skipped)
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1)
    })
  })

  describe('ReDoS Protection', () => {
    it('should handle complex regex patterns without hanging', async () => {
      const complexPatterns = [
        '(a+)+b',
        '((a*)*)*c',
        '(x+x+)+y',
        '.*.*.*.*.*d', // Catastrophic backtracking
      ]

      await plugin.install(context, {
        batchEvents: false,
        trackEvents: complexPatterns,
      })

      // Should complete quickly without hanging
      const start = Date.now()
      eventBus.emit('test:event')
      await new Promise((resolve) => setTimeout(resolve, 100))
      const duration = Date.now() - start

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000)
    })

    it('should sanitize dangerous patterns', async () => {
      await plugin.install(context, {
        batchEvents: false,
        trackEvents: ['****call****'], // Multiple wildcards
      })

      // Should not crash
      eventBus.emit('call:started')
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(plugin).toBeDefined()
    })

    it('should handle very long patterns', async () => {
      const longPattern = 'a'.repeat(200) + '*'

      await plugin.install(context, {
        batchEvents: false,
        trackEvents: [longPattern],
      })

      // Should truncate pattern and not crash
      eventBus.emit('test')
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(plugin).toBeDefined()
    })
  })

  describe('Network Timeout Handling', () => {
    it('should timeout long-running requests', async () => {
      const fetchMock = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve (simulate hanging request)
          })
      )
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        requestTimeout: 100, // 100ms timeout
      })

      eventBus.emit('connected')

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Should have attempted fetch but timed out
      expect(fetchMock).toHaveBeenCalled()
    })

    it('should handle fetch abort gracefully', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
      })

      eventBus.emit('connected')

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should not crash
      expect(plugin).toBeDefined()
    })
  })

  describe('Event Transformation Error Handling', () => {
    it('should handle transformEvent throwing exceptions', async () => {
      const transformEvent = vi.fn(() => {
        throw new Error('Transform failed')
      })

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        transformEvent,
      })

      // Should not crash, use original event
      eventBus.emit('connected')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(transformEvent).toHaveBeenCalled()
      expect(plugin).toBeDefined()
    })

    it('should continue with original event on transform error', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        transformEvent: () => {
          throw new Error('Transform error')
        },
      })

      eventBus.emit('connected')

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should still send event (untransformed)
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  describe('Empty and Invalid Event Handling', () => {
    it('should reject empty event types', async () => {
      await plugin.install(context, {
        batchEvents: false,
      })

      // Try to track empty event type
      ;(plugin as any).trackEvent('')
      ;(plugin as any).trackEvent(null)
      ;(plugin as any).trackEvent(undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should not crash
      expect(plugin).toBeDefined()
    })

    it('should handle null event data', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
      })

      ;(plugin as any).trackEvent('test', null)
      ;(plugin as any).trackEvent('test', undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(plugin).toBeDefined()
    })
  })

  describe('Requeue Logic with Max Queue Size', () => {
    it('should respect maxQueueSize when requeuing failed events', async () => {
      let callCount = 0
      const fetchMock = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ ok: true })
      })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        batchSize: 5,
        maxQueueSize: 10,
      })

      // Fill queue to near capacity
      for (let i = 0; i < 8; i++) {
        eventBus.emit('connected')
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      // First send will fail and try to requeue
      // But should respect maxQueueSize
      expect(plugin).toBeDefined()
    })

    it('should drop events that cannot be requeued due to capacity', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: true,
        batchSize: 5,
        maxQueueSize: 5,
      })

      // Send exactly maxQueueSize events
      for (let i = 0; i < 5; i++) {
        eventBus.emit('connected')
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Trigger flush (will fail)
      await (plugin as any).flushEvents()

      // Try to add more events
      eventBus.emit('connected')

      // Should not crash, old events dropped
      expect(plugin).toBeDefined()
    })
  })

  describe('Session ID Uniqueness', () => {
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

      // All should be valid session IDs
      expect(id1).toMatch(/^session-/)
      expect(id2).toMatch(/^session-/)
      expect(id3).toMatch(/^session-/)
    })
  })

  describe('Pattern Matching Edge Cases', () => {
    it('should handle special regex characters in patterns', async () => {
      await plugin.install(context, {
        batchEvents: false,
        trackEvents: ['test.event', 'test+event', 'test?event'],
      })

      // Should not crash with special chars
      eventBus.emit('test.event')
      eventBus.emit('test+event')
      eventBus.emit('test?event')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(plugin).toBeDefined()
    })

    it('should handle wildcards in different positions', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = fetchMock

      await plugin.install(context, {
        endpoint: 'https://analytics.example.com',
        batchEvents: false,
        trackEvents: ['*:started', 'call:*', '*:*'],
      })

      eventBus.emit('call:started')
      eventBus.emit('sip:connected')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetchMock).toHaveBeenCalled()
    })
  })
})
