/**
 * Event Listener Performance Tests
 *
 * Tests event bus performance under various loads:
 * - Many event listeners (10, 50, 100, 500)
 * - Event propagation speed
 * - Event cleanup performance
 * - Validates against PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus, createEventBus } from '@/core/EventBus'
import { PERFORMANCE } from '@/utils/constants'
import type { EventMap } from '@/types/events.types'

describe('Event Listener Performance Tests', () => {
  let eventBus: EventBus
  let performanceMarks: { start: number; end: number; duration: number }[] = []

  beforeEach(() => {
    eventBus = createEventBus()
    performanceMarks = []
  })

  afterEach(() => {
    eventBus.destroy()
  })

  /**
   * Helper to measure execution time
   */
  const measureTime = async (fn: () => Promise<void> | void): Promise<number> => {
    const start = performance.now()
    await fn()
    const end = performance.now()
    const duration = end - start

    performanceMarks.push({ start, end, duration })
    return duration
  }

  /**
   * Helper to create a batch of event listeners
   */
  const createListeners = (
    count: number,
    event: keyof EventMap = 'connected'
  ): Array<() => void> => {
    const handlers: Array<() => void> = []
    for (let i = 0; i < count; i++) {
      const handler = vi.fn()
      eventBus.on(event, handler)
      handlers.push(handler)
    }
    return handlers
  }

  // ==========================================================================
  // Test 1: Performance with Many Event Listeners
  // ==========================================================================

  describe('Many Event Listeners', () => {
    it('should handle 10 listeners efficiently', async () => {
      const listenerCount = 10
      createListeners(listenerCount)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
      expect(eventBus.listenerCount('connected')).toBe(listenerCount)
    })

    it('should handle 50 listeners efficiently', async () => {
      const listenerCount = 50
      createListeners(listenerCount)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // With 50 listeners, we allow 5x the normal propagation time
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 5)
      expect(eventBus.listenerCount('connected')).toBe(listenerCount)
    })

    it('should handle 100 listeners efficiently', async () => {
      const listenerCount = 100
      createListeners(listenerCount)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // With 100 listeners, we allow 10x the normal propagation time
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 10)
      expect(eventBus.listenerCount('connected')).toBe(listenerCount)
    })

    it('should handle 500 listeners efficiently', async () => {
      const listenerCount = 500
      createListeners(listenerCount)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // With 500 listeners, we allow 50x the normal propagation time (500ms max)
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 50)
      expect(eventBus.listenerCount('connected')).toBe(listenerCount)
    })

    it('should maintain performance with listeners across multiple events', async () => {
      // Add 100 listeners across 5 different events (20 each)
      const eventsToTest: Array<keyof EventMap> = [
        'connected',
        'disconnected',
        'call:incoming',
        'call:outgoing',
        'call:terminated',
      ]

      eventsToTest.forEach((event) => {
        createListeners(20, event)
      })

      // Emit all events and measure total time
      const totalDuration = await measureTime(async () => {
        for (const event of eventsToTest) {
          const eventData = {
            type: event,
            timestamp: new Date(),
          } as any

          await eventBus.emit(event, eventData)
        }
      })

      // Total time for 5 events with 20 listeners each should be reasonable
      expect(totalDuration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 25)
    })
  })

  // ==========================================================================
  // Test 2: Event Propagation Speed
  // ==========================================================================

  describe('Event Propagation Speed', () => {
    it('should propagate events within performance budget', async () => {
      const handler = vi.fn()
      eventBus.on('connected', handler)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should propagate events quickly with priority ordering', async () => {
      const executionOrder: number[] = []

      // Add listeners with different priorities
      eventBus.on('connected', () => executionOrder.push(1), { priority: 1 })
      eventBus.on('connected', () => executionOrder.push(3), { priority: 3 })
      eventBus.on('connected', () => executionOrder.push(2), { priority: 2 })

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
      expect(executionOrder).toEqual([3, 2, 1]) // Higher priority first
    })

    it('should propagate events quickly with wildcard listeners', async () => {
      const wildcardHandler = vi.fn()
      const specificHandler = vi.fn()

      eventBus.on('*', wildcardHandler)
      eventBus.on('connected', specificHandler)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 2)
      expect(wildcardHandler).toHaveBeenCalledTimes(1)
      expect(specificHandler).toHaveBeenCalledTimes(1)
    })

    it('should propagate events quickly with namespace wildcards', async () => {
      const namespaceHandler = vi.fn()
      const specificHandler = vi.fn()

      eventBus.on('call:*', namespaceHandler)
      eventBus.on('call:incoming', specificHandler)

      const event = {
        type: 'call:incoming' as const,
        timestamp: new Date(),
      } as any

      const duration = await measureTime(() => eventBus.emit('call:incoming', event))

      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 2)
      expect(namespaceHandler).toHaveBeenCalledTimes(1)
      expect(specificHandler).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid successive event emissions', async () => {
      const handler = vi.fn()
      eventBus.on('connected', handler)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      // Emit 100 events rapidly
      const emitCount = 100
      const duration = await measureTime(async () => {
        const promises = []
        for (let i = 0; i < emitCount; i++) {
          promises.push(eventBus.emit('connected', event))
        }
        await Promise.all(promises)
      })

      // Average time per emission should be within budget
      const averageDuration = duration / emitCount
      expect(averageDuration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
      expect(handler).toHaveBeenCalledTimes(emitCount)
    })

    it('should maintain speed with async handlers', async () => {
      const asyncHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
      })

      eventBus.on('connected', asyncHandler)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // Async handlers should still complete quickly
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 5)
      expect(asyncHandler).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================================================
  // Test 3: Event Cleanup Performance
  // ==========================================================================

  describe('Event Cleanup Performance', () => {
    it('should cleanup listeners efficiently', async () => {
      const listenerCount = 100
      const handlers = createListeners(listenerCount)

      expect(eventBus.listenerCount('connected')).toBe(listenerCount)

      const duration = await measureTime(() => {
        handlers.forEach((handler) => {
          eventBus.off('connected', handler)
        })
      })

      // Cleanup should be fast
      expect(duration).toBeLessThan(50) // 50ms for 100 listeners
      expect(eventBus.listenerCount('connected')).toBe(0)
    })

    it('should cleanup one-time listeners automatically', async () => {
      const listenerCount = 100

      // Add one-time listeners
      for (let i = 0; i < listenerCount; i++) {
        eventBus.once('connected', vi.fn())
      }

      expect(eventBus.listenerCount('connected')).toBe(listenerCount)

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // Should cleanup all one-time listeners automatically
      expect(eventBus.listenerCount('connected')).toBe(0)
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 10)
    })

    it('should cleanup all listeners efficiently', async () => {
      // Add listeners to multiple events
      createListeners(50, 'connected')
      createListeners(50, 'disconnected')
      createListeners(50, 'call:incoming')

      expect(eventBus.eventNames().length).toBe(3)

      const duration = await measureTime(() => {
        eventBus.removeAllListeners()
      })

      expect(duration).toBeLessThan(10) // Should be very fast
      expect(eventBus.eventNames().length).toBe(0)
    })

    it('should cleanup listeners for specific event efficiently', async () => {
      createListeners(100, 'connected')
      createListeners(100, 'disconnected')

      const duration = await measureTime(() => {
        eventBus.removeAllListeners('connected')
      })

      expect(duration).toBeLessThan(10)
      expect(eventBus.listenerCount('connected')).toBe(0)
      expect(eventBus.listenerCount('disconnected')).toBe(100)
    })

    it('should cleanup on destroy efficiently', async () => {
      // Add many listeners across many events
      const events: Array<keyof EventMap> = [
        'connected',
        'disconnected',
        'call:incoming',
        'call:outgoing',
        'call:terminated',
        'call:accepted',
        'call:failed',
        'registered',
        'unregistered',
        'registration:failed',
      ]

      events.forEach((event) => {
        createListeners(50, event)
      })

      expect(eventBus.eventNames().length).toBe(events.length)

      const duration = await measureTime(() => {
        eventBus.destroy()
      })

      expect(duration).toBeLessThan(20) // Should be very fast
      expect(eventBus.eventNames().length).toBe(0)
    })
  })

  // ==========================================================================
  // Test 4: Memory and Scalability
  // ==========================================================================

  describe('Memory and Scalability', () => {
    it('should scale linearly with listener count', async () => {
      const listenerCounts = [10, 50, 100, 500]
      const durations: number[] = []

      for (const count of listenerCounts) {
        eventBus.removeAllListeners()
        createListeners(count)

        const event = {
          type: 'connected' as const,
          state: 'connected' as const,
          timestamp: new Date(),
        }

        const duration = await measureTime(() => eventBus.emit('connected', event))
        durations.push(duration)
      }

      // Verify roughly linear scaling (within 10x tolerance)
      const ratio1 = durations[1] / durations[0] // 50 vs 10
      const ratio2 = durations[2] / durations[1] // 100 vs 50
      const ratio3 = durations[3] / durations[2] // 500 vs 100

      // Ratios should be reasonable (not exponential)
      expect(ratio1).toBeLessThan(10)
      expect(ratio2).toBeLessThan(10)
      expect(ratio3).toBeLessThan(10)
    })

    it('should not leak memory with repeated listener additions/removals', async () => {
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const handler = vi.fn()
        const id = eventBus.on('connected', handler)
        eventBus.off('connected', id)
      }

      // Should not accumulate listeners
      expect(eventBus.listenerCount('connected')).toBe(0)
      expect(eventBus.eventNames().length).toBe(0)
    })

    it('should handle mixed listener operations efficiently', async () => {
      const duration = await measureTime(() => {
        // Add listeners
        for (let i = 0; i < 100; i++) {
          eventBus.on('connected', vi.fn())
        }

        // Add one-time listeners
        for (let i = 0; i < 100; i++) {
          eventBus.once('disconnected', vi.fn())
        }

        // Remove some listeners
        const handlers = []
        for (let i = 0; i < 50; i++) {
          const handler = vi.fn()
          eventBus.on('call:incoming', handler)
          handlers.push(handler)
        }

        handlers.forEach((h) => eventBus.off('call:incoming', h))
      })

      expect(duration).toBeLessThan(100) // Should complete in reasonable time
      expect(eventBus.listenerCount('connected')).toBe(100)
      expect(eventBus.listenerCount('disconnected')).toBe(100)
      expect(eventBus.listenerCount('call:incoming')).toBe(0)
    })
  })

  // ==========================================================================
  // Test 5: Error Handling Performance
  // ==========================================================================

  describe('Error Handling Performance', () => {
    it('should not slow down when handlers throw errors', async () => {
      // Mix of failing and successful handlers
      for (let i = 0; i < 50; i++) {
        eventBus.on('connected', () => {
          throw new Error('Handler error')
        })
      }
      for (let i = 0; i < 50; i++) {
        eventBus.on('connected', vi.fn())
      }

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // Should still complete within performance budget despite errors
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 20)
    })

    it('should handle async handler errors efficiently', async () => {
      // Mix of failing async and successful handlers
      for (let i = 0; i < 25; i++) {
        eventBus.on('connected', async () => {
          throw new Error('Async handler error')
        })
      }
      for (let i = 0; i < 25; i++) {
        eventBus.on('connected', vi.fn())
      }

      const event = {
        type: 'connected' as const,
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const duration = await measureTime(() => eventBus.emit('connected', event))

      // Should handle async errors without significant slowdown
      expect(duration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 20)
    })
  })

  // ==========================================================================
  // Test 6: Performance Reporting
  // ==========================================================================

  describe('Performance Summary', () => {
    it('should report performance statistics', () => {
      // This test just reports the collected performance data
      if (performanceMarks.length > 0) {
        const durations = performanceMarks.map((m) => m.duration)
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
        const maxDuration = Math.max(...durations)
        const minDuration = Math.min(...durations)

        console.log('\n=== Event Listener Performance Report ===')
        console.log(`Total measurements: ${performanceMarks.length}`)
        console.log(`Average duration: ${avgDuration.toFixed(2)}ms`)
        console.log(`Min duration: ${minDuration.toFixed(2)}ms`)
        console.log(`Max duration: ${maxDuration.toFixed(2)}ms`)
        console.log(`Performance budget: ${PERFORMANCE.MAX_EVENT_PROPAGATION_TIME}ms`)
        console.log('==========================================\n')

        // Basic sanity check
        expect(avgDuration).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 50)
      }
    })
  })
})
