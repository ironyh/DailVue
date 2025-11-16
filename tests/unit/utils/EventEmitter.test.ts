import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from '@/utils/EventEmitter'

describe('EventEmitter', () => {
  let emitter: EventEmitter<{ test: string; number: number; object: { value: string } }>

  beforeEach(() => {
    emitter = new EventEmitter()
  })

  describe('on()', () => {
    it('should register an event listener', () => {
      const handler = vi.fn()
      emitter.on('test', handler)

      expect(emitter.listenerCount('test')).toBe(1)
    })

    it('should call handler when event is emitted', () => {
      const handler = vi.fn()
      emitter.on('test', handler)

      emitter.emit('test', 'hello')

      expect(handler).toHaveBeenCalledWith('hello')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = emitter.on('test', handler)

      expect(emitter.listenerCount('test')).toBe(1)

      unsubscribe()

      expect(emitter.listenerCount('test')).toBe(0)
    })

    it('should support multiple listeners for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)

      emitter.emit('test', 'hello')

      expect(handler1).toHaveBeenCalledWith('hello')
      expect(handler2).toHaveBeenCalledWith('hello')
    })

    it('should handle different event types', () => {
      const stringHandler = vi.fn()
      const numberHandler = vi.fn()
      const objectHandler = vi.fn()

      emitter.on('test', stringHandler)
      emitter.on('number', numberHandler)
      emitter.on('object', objectHandler)

      emitter.emit('test', 'hello')
      emitter.emit('number', 42)
      emitter.emit('object', { value: 'test' })

      expect(stringHandler).toHaveBeenCalledWith('hello')
      expect(numberHandler).toHaveBeenCalledWith(42)
      expect(objectHandler).toHaveBeenCalledWith({ value: 'test' })
    })
  })

  describe('once()', () => {
    it('should register a one-time event listener', () => {
      const handler = vi.fn()
      emitter.once('test', handler)

      expect(emitter.listenerCount('test')).toBe(1)
    })

    it('should call handler only once', () => {
      const handler = vi.fn()
      emitter.once('test', handler)

      emitter.emit('test', 'first')
      emitter.emit('test', 'second')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('first')
    })

    it('should auto-unsubscribe after first emission', () => {
      const handler = vi.fn()
      emitter.once('test', handler)

      expect(emitter.listenerCount('test')).toBe(1)

      emitter.emit('test', 'hello')

      expect(emitter.listenerCount('test')).toBe(0)
    })

    it('should return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = emitter.once('test', handler)

      expect(emitter.listenerCount('test')).toBe(1)

      unsubscribe()

      expect(emitter.listenerCount('test')).toBe(0)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should work with multiple once listeners', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.once('test', handler1)
      emitter.once('test', handler2)

      emitter.emit('test', 'hello')

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(emitter.listenerCount('test')).toBe(0)
    })
  })

  describe('off()', () => {
    it('should remove specific handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)

      emitter.off('test', handler1)

      emitter.emit('test', 'hello')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith('hello')
    })

    it('should remove all handlers when no handler specified', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)

      emitter.off('test')

      emitter.emit('test', 'hello')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(emitter.listenerCount('test')).toBe(0)
    })

    it('should handle removing non-existent handler gracefully', () => {
      const handler = vi.fn()

      expect(() => {
        emitter.off('test', handler)
      }).not.toThrow()
    })

    it('should handle removing from non-existent event gracefully', () => {
      expect(() => {
        emitter.off('test')
      }).not.toThrow()
    })

    it('should clean up event key when last handler removed', () => {
      const handler = vi.fn()

      emitter.on('test', handler)
      emitter.off('test', handler)

      expect(emitter.eventNames()).not.toContain('test')
    })
  })

  describe('emit()', () => {
    it('should do nothing when no listeners registered', () => {
      expect(() => {
        emitter.emit('test', 'hello')
      }).not.toThrow()
    })

    it('should handle errors in handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const goodHandler = vi.fn()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      emitter.on('test', errorHandler)
      emitter.on('test', goodHandler)

      emitter.emit('test', 'hello')

      expect(errorHandler).toHaveBeenCalled()
      expect(goodHandler).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should pass correct data to handlers', () => {
      const handler = vi.fn()
      emitter.on('object', handler)

      const data = { value: 'test' }
      emitter.emit('object', data)

      expect(handler).toHaveBeenCalledWith(data)
    })

    it('should not affect other event listeners during iteration', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn(() => {
        emitter.on('test', vi.fn())
      })
      const handler3 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.on('test', handler3)

      emitter.emit('test', 'hello')

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
      expect(handler3).toHaveBeenCalled()
    })
  })

  describe('removeAllListeners()', () => {
    it('should remove all listeners for all events', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('number', handler2)

      emitter.removeAllListeners()

      emitter.emit('test', 'hello')
      emitter.emit('number', 42)

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(emitter.eventNames()).toEqual([])
    })

    it('should work when no listeners registered', () => {
      expect(() => {
        emitter.removeAllListeners()
      }).not.toThrow()
    })
  })

  describe('listenerCount()', () => {
    it('should return correct count for event', () => {
      emitter.on('test', vi.fn())
      emitter.on('test', vi.fn())
      emitter.on('test', vi.fn())

      expect(emitter.listenerCount('test')).toBe(3)
    })

    it('should return 0 for event with no listeners', () => {
      expect(emitter.listenerCount('test')).toBe(0)
    })

    it('should update count when listeners added/removed', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      expect(emitter.listenerCount('test')).toBe(1)

      emitter.on('test', handler2)
      expect(emitter.listenerCount('test')).toBe(2)

      emitter.off('test', handler1)
      expect(emitter.listenerCount('test')).toBe(1)

      emitter.off('test', handler2)
      expect(emitter.listenerCount('test')).toBe(0)
    })
  })

  describe('eventNames()', () => {
    it('should return array of event names with listeners', () => {
      emitter.on('test', vi.fn())
      emitter.on('number', vi.fn())

      const names = emitter.eventNames()

      expect(names).toContain('test')
      expect(names).toContain('number')
      expect(names).toHaveLength(2)
    })

    it('should return empty array when no listeners', () => {
      expect(emitter.eventNames()).toEqual([])
    })

    it('should update when listeners added/removed', () => {
      const handler = vi.fn()

      emitter.on('test', handler)
      expect(emitter.eventNames()).toContain('test')

      emitter.off('test')
      expect(emitter.eventNames()).not.toContain('test')
    })
  })

  describe('Edge Cases', () => {
    it('should handle same handler added multiple times', () => {
      const handler = vi.fn()

      emitter.on('test', handler)
      emitter.on('test', handler)

      emitter.emit('test', 'hello')

      // Set ensures uniqueness, so handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const handler = vi.fn()

      for (let i = 0; i < 100; i++) {
        const unsub = emitter.on('test', handler)
        unsub()
      }

      expect(emitter.listenerCount('test')).toBe(0)
    })

    it('should handle many concurrent listeners', () => {
      const handlers = Array.from({ length: 1000 }, () => vi.fn())

      handlers.forEach((h) => emitter.on('test', h))

      emitter.emit('test', 'hello')

      handlers.forEach((h) => {
        expect(h).toHaveBeenCalledWith('hello')
      })
    })

    it('should preserve handler execution order', () => {
      const executionOrder: number[] = []

      emitter.on('test', () => executionOrder.push(1))
      emitter.on('test', () => executionOrder.push(2))
      emitter.on('test', () => executionOrder.push(3))

      emitter.emit('test', 'hello')

      expect(executionOrder).toEqual([1, 2, 3])
    })
  })
})
