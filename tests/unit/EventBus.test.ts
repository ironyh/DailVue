/**
 * EventBus unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventBus, createEventBus } from '@/core/EventBus'
import type { EventMap } from '@/types/events.types'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = createEventBus()
  })

  afterEach(() => {
    eventBus.destroy()
  })

  describe('on() and emit()', () => {
    it('should register and trigger event listeners', async () => {
      const handler = vi.fn()
      eventBus.on('connected', handler)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should support multiple listeners for the same event', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on('connected', handler1)
      eventBus.on('connected', handler2)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should execute handlers in priority order', async () => {
      const executionOrder: number[] = []

      eventBus.on('connected', () => executionOrder.push(1), { priority: 1 })
      eventBus.on('connected', () => executionOrder.push(3), { priority: 3 })
      eventBus.on('connected', () => executionOrder.push(2), { priority: 2 })

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(executionOrder).toEqual([3, 2, 1])
    })

    it('should handle async event handlers', async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      eventBus.on('connected', handler)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should return listener ID when registering', () => {
      const handler = vi.fn()
      const id = eventBus.on('connected', handler)

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
    })

    it('should use custom listener ID if provided', () => {
      const handler = vi.fn()
      const customId = 'my-custom-id'
      const id = eventBus.on('connected', handler, { id: customId })

      expect(id).toBe(customId)
    })
  })

  describe('once()', () => {
    it('should trigger listener only once', async () => {
      const handler = vi.fn()
      eventBus.once('connected', handler)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)
      await eventBus.emit('connected', event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should remove listener after first emission', async () => {
      const handler = vi.fn()
      eventBus.once('connected', handler)

      expect(eventBus.listenerCount('connected')).toBe(1)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(eventBus.listenerCount('connected')).toBe(0)
    })
  })

  describe('off()', () => {
    it('should remove listener by handler function', async () => {
      const handler = vi.fn()
      eventBus.on('connected', handler)

      expect(eventBus.listenerCount('connected')).toBe(1)

      eventBus.off('connected', handler)

      expect(eventBus.listenerCount('connected')).toBe(0)
    })

    it('should remove listener by ID', async () => {
      const handler = vi.fn()
      const id = eventBus.on('connected', handler)

      expect(eventBus.listenerCount('connected')).toBe(1)

      eventBus.off('connected', id)

      expect(eventBus.listenerCount('connected')).toBe(0)
    })

    it('should return true when listener is removed', () => {
      const handler = vi.fn()
      eventBus.on('connected', handler)

      const result = eventBus.off('connected', handler)

      expect(result).toBe(true)
    })

    it('should return false when listener is not found', () => {
      const handler = vi.fn()
      const result = eventBus.off('connected', handler)

      expect(result).toBe(false)
    })
  })

  describe('removeAllListeners()', () => {
    it('should remove all listeners for a specific event', () => {
      eventBus.on('connected', vi.fn())
      eventBus.on('connected', vi.fn())
      eventBus.on('disconnected', vi.fn())

      expect(eventBus.listenerCount('connected')).toBe(2)
      expect(eventBus.listenerCount('disconnected')).toBe(1)

      eventBus.removeAllListeners('connected')

      expect(eventBus.listenerCount('connected')).toBe(0)
      expect(eventBus.listenerCount('disconnected')).toBe(1)
    })

    it('should remove all listeners for all events', () => {
      eventBus.on('connected', vi.fn())
      eventBus.on('disconnected', vi.fn())

      expect(eventBus.eventNames().length).toBe(2)

      eventBus.removeAllListeners()

      expect(eventBus.eventNames().length).toBe(0)
    })
  })

  describe('waitFor()', () => {
    it('should resolve when event is emitted', async () => {
      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      setTimeout(() => eventBus.emitSync('connected', event), 10)

      const result = await eventBus.waitFor('connected')

      expect(result).toEqual(event)
    })

    it('should reject on timeout', async () => {
      await expect(eventBus.waitFor('connected', 10)).rejects.toThrow(
        'Timeout waiting for event'
      )
    })

    it('should cleanup listener after event is received', async () => {
      expect(eventBus.listenerCount('connected')).toBe(0)

      const promise = eventBus.waitFor('connected')

      expect(eventBus.listenerCount('connected')).toBe(1)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      eventBus.emitSync('connected', event)

      await promise

      expect(eventBus.listenerCount('connected')).toBe(0)
    })
  })

  describe('Wildcard listeners', () => {
    it('should trigger wildcard listeners for all events', async () => {
      const handler = vi.fn()
      eventBus.on('*', handler)

      const event1 = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      const event2 = {
        type: 'disconnected',
        state: 'disconnected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event1)
      await eventBus.emit('disconnected', event2)

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should trigger namespace wildcard listeners', async () => {
      const handler = vi.fn()
      eventBus.on('call:*', handler)

      const callEvent1 = {
        type: 'call:incoming',
        timestamp: new Date(),
      } as any

      const callEvent2 = {
        type: 'call:outgoing',
        timestamp: new Date(),
      } as any

      const otherEvent = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('call:incoming', callEvent1)
      await eventBus.emit('call:outgoing', callEvent2)
      await eventBus.emit('connected', otherEvent)

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error handling', () => {
    it('should continue executing handlers even if one throws', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error')
      })
      const handler2 = vi.fn()

      eventBus.on('connected', handler1)
      eventBus.on('connected', handler2)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle async handler errors', async () => {
      const handler1 = vi.fn(async () => {
        throw new Error('Async handler error')
      })
      const handler2 = vi.fn()

      eventBus.on('connected', handler1)
      eventBus.on('connected', handler2)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('Utility methods', () => {
    it('should return listener count', () => {
      expect(eventBus.listenerCount('connected')).toBe(0)

      eventBus.on('connected', vi.fn())
      expect(eventBus.listenerCount('connected')).toBe(1)

      eventBus.on('connected', vi.fn())
      expect(eventBus.listenerCount('connected')).toBe(2)
    })

    it('should return event names', () => {
      eventBus.on('connected', vi.fn())
      eventBus.on('disconnected', vi.fn())

      const names = eventBus.eventNames()

      expect(names).toContain('connected')
      expect(names).toContain('disconnected')
      expect(names.length).toBe(2)
    })

    it('should check if event has listeners', () => {
      expect(eventBus.hasListeners('connected')).toBe(false)

      eventBus.on('connected', vi.fn())

      expect(eventBus.hasListeners('connected')).toBe(true)
    })
  })

  describe('Memory management', () => {
    it('should prevent memory leaks by removing one-time listeners', async () => {
      for (let i = 0; i < 100; i++) {
        eventBus.once('connected', vi.fn())
      }

      expect(eventBus.listenerCount('connected')).toBe(100)

      const event = {
        type: 'connected',
        state: 'connected' as const,
        timestamp: new Date(),
      }

      await eventBus.emit('connected', event)

      expect(eventBus.listenerCount('connected')).toBe(0)
    })

    it('should cleanup all listeners on destroy', () => {
      eventBus.on('connected', vi.fn())
      eventBus.on('disconnected', vi.fn())

      expect(eventBus.eventNames().length).toBe(2)

      eventBus.destroy()

      expect(eventBus.eventNames().length).toBe(0)
    })
  })
})
