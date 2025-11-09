/**
 * Memory Leak Detection Tests
 *
 * Tests for detecting memory leaks in:
 * - Repeated call creation/termination cycles
 * - Event listener registration/cleanup
 * - Media stream handling
 * - Long-running sessions
 *
 * These tests measure memory usage before and after operations to detect gradual leaks.
 * Run with: node --expose-gc to enable manual garbage collection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../../src/core/EventBus'
import { CallSession } from '../../../src/core/CallSession'
import { MediaManager } from '../../../src/core/MediaManager'
import { createMockSipServer } from '../../helpers/MockSipServer'
import { PERFORMANCE } from '../../../src/utils/constants'

/**
 * Force garbage collection if available
 */
function forceGC(): void {
  if (global.gc) {
    global.gc()
  }
}

/**
 * Get current memory usage in bytes
 */
function getMemoryUsage(): number {
  forceGC()
  const usage = process.memoryUsage()
  return usage.heapUsed
}

/**
 * Calculate memory delta with tolerance
 */
function getMemoryDelta(before: number, after: number): number {
  return after - before
}

/**
 * Helper to setup mock media devices
 */
function setupMockMediaDevices(): void {
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      id: 'mock-stream',
      active: true,
      getTracks: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          id: 'audio-track-1',
          enabled: true,
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        },
      ]),
      getAudioTracks: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          id: 'audio-track-1',
          enabled: true,
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        },
      ]),
      getVideoTracks: vi.fn().mockReturnValue([]),
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getSupportedConstraints: vi.fn().mockReturnValue({}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as never
}

describe('Memory Leak Detection Tests', () => {
  let eventBus: EventBus
  let mediaManager: MediaManager
  let mockSipServer: ReturnType<typeof createMockSipServer>

  beforeEach(() => {
    vi.clearAllMocks()
    eventBus = new EventBus()
    mediaManager = new MediaManager({ eventBus })
    mockSipServer = createMockSipServer({ autoAcceptCalls: false, networkLatency: 0 })
    setupMockMediaDevices()
  })

  afterEach(() => {
    mediaManager.destroy()
    eventBus.destroy()
    mockSipServer.destroy()
    forceGC()
  })

  describe('Call Creation/Termination Cycles', () => {
    it('should not leak memory after 100 call creation/termination cycles', async () => {
      const iterations = 100
      const memorySnapshots: number[] = []

      // Warm-up phase to stabilize memory
      for (let i = 0; i < 10; i++) {
        const session = mockSipServer.createSession(`warmup-${i}`)
        new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:test@example.com',
          remoteUri: 'sip:remote@example.com',
          remoteDisplayName: 'Remote User',
          rtcSession: session,
          eventBus,
        })
        mockSipServer.simulateCallEnded(session)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Baseline memory measurement
      const baselineMemory = getMemoryUsage()
      memorySnapshots.push(baselineMemory)

      // Run iterations and measure memory periodically
      for (let i = 0; i < iterations; i++) {
        const session = mockSipServer.createSession(`call-${i}`)

        new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:test@example.com',
          remoteUri: 'sip:remote@example.com',
          remoteDisplayName: 'Remote User',
          rtcSession: session,
          eventBus,
        })

        // Simulate call lifecycle
        mockSipServer.simulateCallProgress(session)
        mockSipServer.simulateCallAccepted(session)
        mockSipServer.simulateCallEnded(session)

        // Allow async cleanup
        await new Promise((resolve) => setTimeout(resolve, 5))

        // Take memory snapshot every 20 iterations
        if ((i + 1) % 20 === 0) {
          forceGC()
          await new Promise((resolve) => setTimeout(resolve, 50))
          memorySnapshots.push(getMemoryUsage())
        }
      }

      // Final memory measurement
      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const finalMemory = getMemoryUsage()
      memorySnapshots.push(finalMemory)

      // Calculate memory growth
      const memoryGrowth = getMemoryDelta(baselineMemory, finalMemory)

      // Memory growth should be reasonable (less than max memory per call)
      // Allow some tolerance for test overhead
      const maxAllowedGrowth = PERFORMANCE.MAX_MEMORY_PER_CALL
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)

      // Check that memory is not continuously growing
      // Compare first half vs second half average
      const midPoint = Math.floor(memorySnapshots.length / 2)
      const firstHalfAvg = memorySnapshots.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint
      const secondHalfAvg =
        memorySnapshots.slice(midPoint).reduce((a, b) => a + b, 0) /
        (memorySnapshots.length - midPoint)

      const averageGrowthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg

      // Memory should not grow more than 50% between halves
      expect(averageGrowthRate).toBeLessThan(0.5)
    })

    it('should release memory after call sessions are terminated', async () => {
      const sessions: CallSession[] = []
      const iterations = 50

      // Create multiple call sessions
      const beforeMemory = getMemoryUsage()

      for (let i = 0; i < iterations; i++) {
        const session = mockSipServer.createSession(`call-${i}`)

        const callSession = new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:test@example.com',
          remoteUri: 'sip:remote@example.com',
          remoteDisplayName: 'Remote User',
          rtcSession: session,
          eventBus,
        })

        mockSipServer.simulateCallAccepted(session)
        sessions.push(callSession)
      }

      forceGC()
      const duringMemory = getMemoryUsage()

      // Terminate all sessions
      sessions.forEach((session, index) => {
        mockSipServer.simulateCallEnded(
          mockSipServer.getActiveSessions()[index],
          'local',
          'Cleanup'
        )
      })
      sessions.length = 0

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100))
      mockSipServer.clearSessions()

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const afterMemory = getMemoryUsage()

      // Memory after cleanup should be close to before
      // Allow 20% tolerance for test overhead
      const memoryRetained = afterMemory - beforeMemory
      const memoryUsedDuringTest = duringMemory - beforeMemory
      const retentionRatio = memoryRetained / memoryUsedDuringTest

      expect(retentionRatio).toBeLessThan(0.2)
    })
  })

  describe('Event Listener Registration/Cleanup', () => {
    it('should not leak memory with repeated event listener registration/removal', async () => {
      const iterations = 100
      const handlers: Array<() => void> = []

      const beforeMemory = getMemoryUsage()

      // Register and remove listeners many times
      for (let i = 0; i < iterations; i++) {
        const handler = vi.fn()
        handlers.push(handler)

        // Register multiple events
        const id1 = eventBus.on('call:progress', handler)
        const id2 = eventBus.on('call:accepted', handler)
        const id3 = eventBus.on('call:ended', handler)
        const id4 = eventBus.on('call:failed', handler)

        // Remove listeners
        eventBus.off('call:progress', id1)
        eventBus.off('call:accepted', id2)
        eventBus.off('call:ended', id3)
        eventBus.off('call:failed', id4)
      }

      handlers.length = 0
      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))

      const afterMemory = getMemoryUsage()
      const memoryGrowth = getMemoryDelta(beforeMemory, afterMemory)

      // Should not accumulate significant memory from event listeners
      const maxAllowedGrowth = 5 * 1024 * 1024 // 5 MB tolerance
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)
    })

    it('should properly clean up event listeners when EventBus is destroyed', async () => {
      const eventBuses: EventBus[] = []
      const iterations = 100

      const beforeMemory = getMemoryUsage()

      // Create many EventBus instances with listeners
      for (let i = 0; i < iterations; i++) {
        const bus = new EventBus()
        eventBuses.push(bus)

        // Add multiple listeners
        bus.on('call:progress', () => {})
        bus.on('call:accepted', () => {})
        bus.on('call:ended', () => {})
        bus.on('sip:connected', () => {})
        bus.on('sip:registered', () => {})
      }

      forceGC()
      const duringMemory = getMemoryUsage()

      // Destroy all EventBus instances
      eventBuses.forEach((bus) => bus.destroy())
      eventBuses.length = 0

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const afterMemory = getMemoryUsage()

      // Memory should be mostly released
      const memoryRetained = afterMemory - beforeMemory
      const memoryUsedDuringTest = duringMemory - beforeMemory
      const retentionRatio = memoryRetained / memoryUsedDuringTest

      expect(retentionRatio).toBeLessThan(0.3)
    })

    it('should handle 1000+ event emissions without memory buildup', async () => {
      const iterations = 1000
      const handler = vi.fn()

      eventBus.on('test:event', handler)

      const beforeMemory = getMemoryUsage()

      // Emit many events
      for (let i = 0; i < iterations; i++) {
        eventBus.emit('test:event', { data: `iteration-${i}` })
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
      forceGC()
      const afterMemory = getMemoryUsage()

      const memoryGrowth = getMemoryDelta(beforeMemory, afterMemory)

      // Event emissions should not accumulate memory
      const maxAllowedGrowth = 3 * 1024 * 1024 // 3 MB tolerance
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)
      expect(handler).toHaveBeenCalledTimes(iterations)

      eventBus.off('test:event', handler)
    })
  })

  describe('Media Stream Handling', () => {
    it('should not leak memory after acquiring and releasing media streams 100 times', async () => {
      const iterations = 100

      const beforeMemory = getMemoryUsage()

      for (let i = 0; i < iterations; i++) {
        // Acquire media stream
        const stream = await mediaManager.getUserMedia({ audio: true, video: false })
        expect(stream).toBeDefined()

        // Release media stream
        mediaManager.releaseUserMedia()

        // Allow cleanup
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const afterMemory = getMemoryUsage()

      const memoryGrowth = getMemoryDelta(beforeMemory, afterMemory)

      // Should not accumulate significant memory from media streams
      const maxAllowedGrowth = 10 * 1024 * 1024 // 10 MB tolerance
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)
    })

    it('should release media stream resources when MediaManager is destroyed', async () => {
      const managers: MediaManager[] = []
      const iterations = 50

      const beforeMemory = getMemoryUsage()

      // Create multiple MediaManager instances with active streams
      for (let i = 0; i < iterations; i++) {
        const manager = new MediaManager({ eventBus })
        managers.push(manager)

        // Acquire stream
        await manager.getUserMedia({ audio: true, video: false })
      }

      forceGC()
      const duringMemory = getMemoryUsage()

      // Destroy all managers
      managers.forEach((manager) => manager.destroy())
      managers.length = 0

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const afterMemory = getMemoryUsage()

      // Memory should be mostly released
      const memoryRetained = afterMemory - beforeMemory
      const memoryUsedDuringTest = duringMemory - beforeMemory
      const retentionRatio = memoryRetained / memoryUsedDuringTest

      expect(retentionRatio).toBeLessThan(0.3)
    })

    it('should properly stop all media tracks when releasing streams', async () => {
      const mockStopFns: Array<ReturnType<typeof vi.fn>> = []

      // Override getUserMedia to track stop calls
      const createMockTrack = () => {
        const stopFn = vi.fn()
        mockStopFns.push(stopFn)
        return {
          kind: 'audio',
          id: `track-${mockStopFns.length}`,
          enabled: true,
          stop: stopFn,
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        }
      }

      global.navigator.mediaDevices.getUserMedia = vi.fn().mockImplementation(async () => ({
        id: 'mock-stream',
        active: true,
        getTracks: vi.fn().mockReturnValue([createMockTrack()]),
        getAudioTracks: vi.fn().mockReturnValue([createMockTrack()]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      }))

      // Acquire and release multiple streams
      for (let i = 0; i < 10; i++) {
        await mediaManager.getUserMedia({ audio: true, video: false })
        mediaManager.releaseUserMedia()
      }

      // All tracks should have been stopped
      mockStopFns.forEach((stopFn) => {
        expect(stopFn).toHaveBeenCalled()
      })
    })
  })

  describe('Combined Scenario: Full Call Lifecycle with Media', () => {
    it('should not leak memory in 100 full call cycles with media', async () => {
      const iterations = 100
      const memorySnapshots: number[] = []

      // Warm-up
      for (let i = 0; i < 5; i++) {
        await mediaManager.getUserMedia({ audio: true, video: false })
        const session = mockSipServer.createSession(`warmup-${i}`)
        new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:test@example.com',
          remoteUri: 'sip:remote@example.com',
          remoteDisplayName: 'Remote User',
          rtcSession: session,
          eventBus,
        })
        mockSipServer.simulateCallEnded(session)
        mediaManager.releaseUserMedia()
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))

      const baselineMemory = getMemoryUsage()
      memorySnapshots.push(baselineMemory)

      // Run full call cycles
      for (let i = 0; i < iterations; i++) {
        // Acquire media
        await mediaManager.getUserMedia({ audio: true, video: false })

        // Create call
        const session = mockSipServer.createSession(`call-${i}`)
        const callSession = new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:test@example.com',
          remoteUri: 'sip:remote@example.com',
          remoteDisplayName: 'Remote User',
          rtcSession: session,
          eventBus,
        })

        // Simulate call lifecycle
        mockSipServer.simulateCallProgress(session)
        mockSipServer.simulateCallAccepted(session)

        // Hold/unhold
        await callSession.hold()
        await callSession.unhold()

        // Mute/unmute
        callSession.mute()
        callSession.unmute()

        // End call
        mockSipServer.simulateCallEnded(session)

        // Release media
        mediaManager.releaseUserMedia()

        await new Promise((resolve) => setTimeout(resolve, 5))

        // Take memory snapshot every 20 iterations
        if ((i + 1) % 20 === 0) {
          forceGC()
          await new Promise((resolve) => setTimeout(resolve, 50))
          memorySnapshots.push(getMemoryUsage())
        }
      }

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const finalMemory = getMemoryUsage()
      memorySnapshots.push(finalMemory)

      const memoryGrowth = getMemoryDelta(baselineMemory, finalMemory)

      // Verify memory growth is within acceptable limits
      const maxAllowedGrowth = PERFORMANCE.MAX_MEMORY_PER_CALL
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)

      // Check for continuous memory growth
      const midPoint = Math.floor(memorySnapshots.length / 2)
      const firstHalfAvg = memorySnapshots.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint
      const secondHalfAvg =
        memorySnapshots.slice(midPoint).reduce((a, b) => a + b, 0) /
        (memorySnapshots.length - midPoint)

      const averageGrowthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg

      // Memory should stabilize and not grow continuously
      expect(averageGrowthRate).toBeLessThan(0.5)
    })
  })

  describe('Long-running Session Memory Stability', () => {
    it('should maintain stable memory during a long-running call session', async () => {
      const session = mockSipServer.createSession('long-running')
      const callSession = new CallSession({
        id: session.id,
        direction: 'outgoing',
        localUri: 'sip:test@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession: session,
        eventBus,
      })

      mockSipServer.simulateCallAccepted(session)

      const memorySnapshots: number[] = []
      const beforeMemory = getMemoryUsage()
      memorySnapshots.push(beforeMemory)

      // Simulate long-running call with periodic operations
      for (let i = 0; i < 50; i++) {
        // Perform various operations
        callSession.mute()
        await new Promise((resolve) => setTimeout(resolve, 10))
        callSession.unmute()
        await new Promise((resolve) => setTimeout(resolve, 10))

        if (i % 10 === 0) {
          forceGC()
          memorySnapshots.push(getMemoryUsage())
        }
      }

      forceGC()
      const afterMemory = getMemoryUsage()
      memorySnapshots.push(afterMemory)

      // Clean up
      mockSipServer.simulateCallEnded(session)

      const memoryGrowth = getMemoryDelta(beforeMemory, afterMemory)

      // Long-running session should not accumulate memory
      const maxAllowedGrowth = 5 * 1024 * 1024 // 5 MB tolerance
      expect(memoryGrowth).toBeLessThan(maxAllowedGrowth)
    })

    it('should validate memory per call does not exceed PERFORMANCE.MAX_MEMORY_PER_CALL', async () => {
      const sessions: CallSession[] = []
      const maxConcurrentCalls = 5

      const beforeMemory = getMemoryUsage()

      // Create multiple concurrent calls
      for (let i = 0; i < maxConcurrentCalls; i++) {
        await mediaManager.getUserMedia({ audio: true, video: false })
        const session = mockSipServer.createSession(`concurrent-${i}`)

        const callSession = new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:test@example.com',
          remoteUri: `sip:remote${i}@example.com`,
          remoteDisplayName: `Remote User ${i}`,
          rtcSession: session,
          eventBus,
        })

        mockSipServer.simulateCallAccepted(session)
        sessions.push(callSession)
      }

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const duringMemory = getMemoryUsage()

      const totalMemoryUsed = getMemoryDelta(beforeMemory, duringMemory)
      const memoryPerCall = totalMemoryUsed / maxConcurrentCalls

      // Each call should use less than the maximum allowed memory
      expect(memoryPerCall).toBeLessThan(PERFORMANCE.MAX_MEMORY_PER_CALL)

      // Clean up
      sessions.forEach((_, index) => {
        mockSipServer.simulateCallEnded(
          mockSipServer.getActiveSessions()[index],
          'local',
          'Cleanup'
        )
      })
      mediaManager.releaseUserMedia()

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const afterMemory = getMemoryUsage()

      // Memory should be released after cleanup
      const memoryRetained = afterMemory - beforeMemory
      const retentionRatio = memoryRetained / totalMemoryUsed

      expect(retentionRatio).toBeLessThan(0.3)
    })
  })

  describe('Garbage Collection Verification', () => {
    it('should verify that global.gc is available for accurate testing', () => {
      if (!global.gc) {
        console.warn(
          '\n⚠️  WARNING: global.gc is not available. Run tests with --expose-gc flag for accurate memory leak detection.\n' +
            '   Example: vitest run --expose-gc tests/performance/load-tests/memory-leaks.test.ts\n'
        )
      }
      // Test passes either way, but we warn if gc is not available
      expect(true).toBe(true)
    })

    it('should demonstrate memory cleanup with forced GC', async () => {
      const largeObjects: any[] = []

      const beforeMemory = getMemoryUsage()

      // Allocate memory
      for (let i = 0; i < 100; i++) {
        largeObjects.push(new Array(1000).fill({ data: `item-${i}` }))
      }

      const duringMemory = getMemoryUsage()
      const allocated = duringMemory - beforeMemory

      // Clear references
      largeObjects.length = 0

      forceGC()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const afterMemory = getMemoryUsage()

      const retained = afterMemory - beforeMemory

      // Most memory should be released
      if (global.gc) {
        const retentionRatio = retained / allocated
        expect(retentionRatio).toBeLessThan(0.3)
      }
    })
  })
})
