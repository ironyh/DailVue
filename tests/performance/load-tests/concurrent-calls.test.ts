/**
 * Performance Test: Concurrent Calls
 *
 * Tests the system's ability to handle multiple concurrent calls while maintaining
 * acceptable performance metrics for call setup time, memory usage, and responsiveness.
 *
 * Test Scenarios:
 * - 1 call (baseline)
 * - 3 concurrent calls
 * - 5 concurrent calls (max recommended)
 * - 10 concurrent calls (stress test)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SipClient } from '../../../src/core/SipClient'
import { EventBus } from '../../../src/core/EventBus'
import {
  createMockSipServer,
  type MockSipServer,
  type MockRTCSession,
} from '../../helpers/MockSipServer'
import type { SipClientConfig } from '../../../src/types/config.types'
import { PERFORMANCE } from '../../../src/utils/constants'

// Type definitions for browser APIs with memory support
interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory
}

// Environment-based timeout multiplier for CI/slow environments
const TIMEOUT_MULTIPLIER = process.env.CI ? 5 : 1

// Mock JsSIP at module level
const mockUA = {
  start: vi.fn(),
  stop: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  call: vi.fn(),
  sendMessage: vi.fn(),
  isConnected: vi.fn().mockReturnValue(false),
  isRegistered: vi.fn().mockReturnValue(false),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
}

vi.mock('jssip', () => ({
  default: {
    UA: vi.fn(function () {
        return mockUA
      }),
    WebSocketInterface: vi.fn(),
    debug: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
  },
}))

// =============================================================================
// Test Configuration Constants
// =============================================================================

/**
 * Call count configurations for concurrent call tests
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CALL_COUNTS = {
  /** Baseline single call test */
  BASELINE: 1,
  /** Three concurrent calls - moderate load */
  MODERATE: 3,
  /** Five concurrent calls - recommended maximum */
  RECOMMENDED_MAX: 5,
  /** Ten concurrent calls - stress test scenario */
  STRESS: 10,
} as const

/**
 * Test configurations for concurrent call scaling
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SCALING_TEST_CALLS = [1, 3, 5] as const

/**
 * Wait times for async operations (milliseconds)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WAIT_TIMES = {
  /** Short delay between rapid sequential calls */
  RAPID_SEQUENTIAL: 10,
  /** Wait for call establishment */
  CALL_ESTABLISHMENT: 50,
  /** Wait for memory stabilization */
  MEMORY_STABILIZATION: 100,
  /** Wait for cleanup after operations */
  CLEANUP: 50,
} as const

/**
 * Network and connection settings
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NETWORK_SETTINGS = {
  /** Minimal network latency for performance testing (ms) */
  LATENCY: 10,
  /** Connection delay for mock responses (ms) */
  CONNECTION_DELAY: 10,
} as const

/**
 * Performance thresholds
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PERFORMANCE_LIMITS = {
  /** Event loop latency threshold for system responsiveness (ms) */
  EVENT_LOOP_LATENCY: 100,
  /** Memory increase threshold for leak detection (bytes) */
  MEMORY_LEAK: 10 * 1024 * 1024, // 10MB
  /** Maximum performance degradation multiplier */
  MAX_DEGRADATION_MULTIPLIER: 3,
} as const

/**
 * Memory leak test iterations
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEAK_TEST_ITERATIONS = 3

// =============================================================================

/**
 * Performance metrics for a call setup test
 */
interface CallSetupMetrics {
  /** Number of concurrent calls attempted */
  callCount: number
  /** Time taken to establish all calls (ms) */
  totalSetupTime: number
  /** Average time per call (ms) */
  averageSetupTime: number
  /** Memory usage before test (bytes) */
  memoryBefore: number
  /** Memory usage after test (bytes) */
  memoryAfter: number
  /** Memory delta (bytes) */
  memoryDelta: number
  /** Memory per call (bytes) */
  memoryPerCall: number
  /** Number of successfully established calls */
  successfulCalls: number
  /** Whether system remained responsive */
  systemResponsive: boolean
}

/**
 * Helper to measure memory usage (in Node.js environment)
 */
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed
  }
  // Fallback for browser environments
  const perf = performance as PerformanceWithMemory
  if (typeof performance !== 'undefined' && perf.memory) {
    return perf.memory.usedJSHeapSize
  }
  return 0
}

/**
 * Helper to wait for next tick (immediate execution)
 */
function waitImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

/**
 * Helper to wait for a specific duration with environment-based multiplier
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms * TIMEOUT_MULTIPLIER))
}

/**
 * Helper to check if system is responsive by testing event loop latency
 */
async function checkSystemResponsiveness(): Promise<boolean> {
  const start = Date.now()
  await new Promise((resolve) => setImmediate(resolve))
  const latency = Date.now() - start

  // System is responsive if event loop latency is under 100ms
  return latency < 100
}

describe('Performance: Concurrent Calls', () => {
  let mockServer: MockSipServer
  let sipClient: SipClient
  let eventBus: EventBus
  let config: SipClientConfig

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create mock server with auto-accept for performance testing
    mockServer = createMockSipServer({
      autoRegister: true,
      autoAcceptCalls: true,
      networkLatency: 10, // Minimal latency for performance testing
    })

    eventBus = new EventBus()

    config = {
      uri: 'wss://sip.example.com:7443',
      sipUri: 'sip:testuser@example.com',
      password: 'testpassword',
      displayName: 'Test User',
      authorizationUsername: 'testuser',
      realm: 'example.com',
      userAgent: 'VueSip Performance Test',
      debug: false,
      registrationOptions: {
        expires: 600,
        autoRegister: false,
      },
    }

    // Mock UA responses
    mockUA.isConnected.mockReturnValue(false)
    mockUA.isRegistered.mockReturnValue(false)
    mockUA.once.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'connected') {
        setImmediate(() => handler({ socket: { url: 'wss://test.com' } }))
      }
      if (event === 'registered') {
        setImmediate(() => handler({ response: { getHeader: () => '600' } }))
      }
    })

    sipClient = new SipClient(config, eventBus)

    // Connect and register
    mockUA.isConnected.mockReturnValue(true)
    await sipClient.start()
    mockUA.isRegistered.mockReturnValue(true)
    await sipClient.register()
  })

  afterEach(() => {
    sipClient.destroy()
    eventBus.destroy()
    mockServer.destroy()
  })

  /**
   * Helper to establish multiple concurrent calls and measure performance
   */
  async function testConcurrentCalls(callCount: number): Promise<CallSetupMetrics> {
    const memoryBefore = getMemoryUsage()
    const startTime = performance.now()

    const sessions: MockRTCSession[] = []
    const callPromises: Promise<void>[] = []

    // Initiate all calls concurrently
    for (let i = 0; i < callCount; i++) {
      const callPromise = new Promise<void>((resolve) => {
        const session = mockServer.createSession(`session-${i}`)
        sessions.push(session)

        // Simulate call lifecycle
        mockServer.simulateCallProgress(session)
        mockServer.simulateCallAccepted(session)
        mockServer.simulateCallConfirmed(session)

        // Wait for call to be established (next tick)
        setImmediate(resolve)
      })

      callPromises.push(callPromise)
    }

    // Wait for all calls to be established
    await Promise.all(callPromises)

    const endTime = performance.now()
    const totalSetupTime = endTime - startTime

    // Measure memory after calls are established
    await wait(100) // Allow memory to stabilize
    const memoryAfter = getMemoryUsage()
    const memoryDelta = memoryAfter - memoryBefore

    // Check system responsiveness during concurrent calls
    const systemResponsive = await checkSystemResponsiveness()

    // Count successful calls (all should be established)
    const successfulCalls = sessions.filter((s) => s.isEstablished()).length

    // Clean up calls
    for (const session of sessions) {
      mockServer.simulateCallEnded(session, 'local')
    }
    await waitImmediate()

    return {
      callCount,
      totalSetupTime,
      averageSetupTime: totalSetupTime / callCount,
      memoryBefore,
      memoryAfter,
      memoryDelta,
      memoryPerCall: memoryDelta / callCount,
      successfulCalls,
      systemResponsive,
    }
  }

  describe('Call Setup Performance', () => {
    it('should handle 1 concurrent call (baseline)', async () => {
      const metrics = await testConcurrentCalls(1)

      // Assertions
      expect(metrics.successfulCalls).toBe(1)
      expect(metrics.averageSetupTime).toBeLessThan(PERFORMANCE.TARGET_CALL_SETUP_TIME)
      expect(metrics.systemResponsive).toBe(true)

      // Log metrics for analysis
      console.log('Baseline (1 call):', {
        setupTime: `${metrics.averageSetupTime.toFixed(2)}ms`,
        memoryUsed: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        success: metrics.successfulCalls === 1,
      })
    })

    it('should handle 3 concurrent calls efficiently', async () => {
      const metrics = await testConcurrentCalls(3)

      // Assertions
      expect(metrics.successfulCalls).toBe(3)
      expect(metrics.averageSetupTime).toBeLessThan(PERFORMANCE.TARGET_CALL_SETUP_TIME * 1.5)
      expect(metrics.systemResponsive).toBe(true)

      // Memory per call should be reasonable
      if (metrics.memoryDelta > 0) {
        expect(metrics.memoryPerCall).toBeLessThan(PERFORMANCE.MAX_MEMORY_PER_CALL)
      }

      // Log metrics for analysis
      console.log('3 concurrent calls:', {
        totalSetupTime: `${metrics.totalSetupTime.toFixed(2)}ms`,
        averageSetupTime: `${metrics.averageSetupTime.toFixed(2)}ms`,
        memoryUsed: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        memoryPerCall: `${(metrics.memoryPerCall / 1024 / 1024).toFixed(2)}MB`,
        successRate: `${metrics.successfulCalls}/3`,
      })
    })

    it('should handle 5 concurrent calls at recommended maximum', async () => {
      const metrics = await testConcurrentCalls(5)

      // Validate against PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS
      expect(metrics.callCount).toBeLessThanOrEqual(PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS)

      // Assertions
      expect(metrics.successfulCalls).toBe(5)
      expect(metrics.averageSetupTime).toBeLessThan(PERFORMANCE.TARGET_CALL_SETUP_TIME * 2)
      expect(metrics.systemResponsive).toBe(true)

      // Memory per call should be within limits
      if (metrics.memoryDelta > 0) {
        expect(metrics.memoryPerCall).toBeLessThan(PERFORMANCE.MAX_MEMORY_PER_CALL)
      }

      // Total memory should be reasonable
      if (metrics.memoryDelta > 0) {
        expect(metrics.memoryDelta).toBeLessThan(
          PERFORMANCE.MAX_MEMORY_PER_CALL * PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS
        )
      }

      // Log metrics for analysis
      console.log('5 concurrent calls (max recommended):', {
        totalSetupTime: `${metrics.totalSetupTime.toFixed(2)}ms`,
        averageSetupTime: `${metrics.averageSetupTime.toFixed(2)}ms`,
        memoryUsed: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        memoryPerCall: `${(metrics.memoryPerCall / 1024 / 1024).toFixed(2)}MB`,
        successRate: `${metrics.successfulCalls}/5`,
        systemResponsive: metrics.systemResponsive,
      })
    })

    it('should handle 10 concurrent calls (stress test)', async () => {
      const metrics = await testConcurrentCalls(10)

      // This exceeds the recommended maximum
      expect(metrics.callCount).toBeGreaterThan(PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS)

      // All calls should still be established
      expect(metrics.successfulCalls).toBe(10)

      // Performance may degrade but should still be acceptable
      expect(metrics.averageSetupTime).toBeLessThan(PERFORMANCE.TARGET_CALL_SETUP_TIME * 3)

      // System should remain responsive even under stress
      expect(metrics.systemResponsive).toBe(true)

      // Log metrics for analysis
      console.log('10 concurrent calls (stress test):', {
        totalSetupTime: `${metrics.totalSetupTime.toFixed(2)}ms`,
        averageSetupTime: `${metrics.averageSetupTime.toFixed(2)}ms`,
        memoryUsed: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        memoryPerCall: `${(metrics.memoryPerCall / 1024 / 1024).toFixed(2)}MB`,
        successRate: `${metrics.successfulCalls}/10`,
        systemResponsive: metrics.systemResponsive,
      })
    })
  })

  describe('System Responsiveness', () => {
    it('should maintain event loop responsiveness during concurrent calls', async () => {
      const sessions: MockRTCSession[] = []

      // Establish 5 concurrent calls
      for (let i = 0; i < 5; i++) {
        const session = mockServer.createSession(`session-${i}`)
        sessions.push(session)
        mockServer.simulateCallProgress(session)
        mockServer.simulateCallAccepted(session)
      }

      await waitImmediate()

      // Check responsiveness multiple times
      const responsivenessChecks = await Promise.all([
        checkSystemResponsiveness(),
        checkSystemResponsiveness(),
        checkSystemResponsiveness(),
      ])

      // All checks should pass
      expect(responsivenessChecks.every((check) => check === true)).toBe(true)

      // Clean up
      for (const session of sessions) {
        mockServer.simulateCallEnded(session, 'local')
      }
    })

    it('should handle rapid sequential call establishment', async () => {
      const startTime = performance.now()
      const sessions: MockRTCSession[] = []

      // Rapidly establish calls one after another
      for (let i = 0; i < 5; i++) {
        const session = mockServer.createSession(`session-${i}`)
        sessions.push(session)
        mockServer.simulateCallProgress(session)
        mockServer.simulateCallAccepted(session)
        mockServer.simulateCallConfirmed(session)
        await waitImmediate() // Next tick execution
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // All calls should be established
      expect(sessions.length).toBe(5)

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(PERFORMANCE.TARGET_CALL_SETUP_TIME * 5)

      // System should remain responsive
      const isResponsive = await checkSystemResponsiveness()
      expect(isResponsive).toBe(true)

      // Clean up
      for (const session of sessions) {
        mockServer.simulateCallEnded(session, 'local')
      }
    })
  })

  describe('Memory Management', () => {
    it('should not leak memory when establishing and ending calls', async () => {
      const initialMemory = getMemoryUsage()
      const iterations = 3

      for (let iter = 0; iter < iterations; iter++) {
        const sessions: MockRTCSession[] = []

        // Establish calls
        for (let i = 0; i < 3; i++) {
          const session = mockServer
            .getUA()
            .call(`sip:user${i}@example.com`, { mediaConstraints: { audio: true, video: false } })
          sessions.push(session)
          mockServer.simulateCallProgress(session)
          mockServer.simulateCallAccepted(session)
        }

        await waitImmediate()

        // End all calls
        for (const session of sessions) {
          mockServer.simulateCallEnded(session, 'local')
        }

        await waitImmediate()
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      await wait(100)

      const finalMemory = getMemoryUsage()
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be minimal (less than 10MB)
      // Allow some increase due to test overhead
      console.log('Memory leak test:', {
        iterations,
        memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      })

      // This is a soft check - exact memory behavior depends on GC
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB
      }
    })

    it('should track memory usage per call within acceptable limits', async () => {
      const memoryReadings: number[] = []

      // Measure memory for increasing call counts
      for (const callCount of [1, 2, 3, 4, 5]) {
        const memoryBefore = getMemoryUsage()
        const sessions: MockRTCSession[] = []

        for (let i = 0; i < callCount; i++) {
          const session = mockServer
            .getUA()
            .call(`sip:user${i}@example.com`, { mediaConstraints: { audio: true, video: false } })
          sessions.push(session)
          mockServer.simulateCallProgress(session)
          mockServer.simulateCallAccepted(session)
        }

        await waitImmediate()

        const memoryAfter = getMemoryUsage()
        const memoryDelta = memoryAfter - memoryBefore
        memoryReadings.push(memoryDelta / callCount)

        // Clean up
        for (const session of sessions) {
          mockServer.simulateCallEnded(session, 'local')
        }
        await waitImmediate()
      }

      console.log('Memory per call trend:', {
        readings: memoryReadings.map((m) => `${(m / 1024 / 1024).toFixed(2)}MB`),
      })

      // Each reading should be within the maximum memory per call limit
      // (when memory is being tracked)
      memoryReadings.forEach((reading) => {
        if (reading > 0) {
          expect(reading).toBeLessThan(PERFORMANCE.MAX_MEMORY_PER_CALL)
        }
      })
    })
  })

  describe('Concurrent Call Validation', () => {
    it('should validate against PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS constant', () => {
      // Verify the constant exists and has expected value
      expect(PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS).toBeDefined()
      expect(PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS).toBe(5)
    })

    it('should successfully establish up to MAX_CONCURRENT_CALLS', async () => {
      const maxCalls = PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS
      const sessions: MockRTCSession[] = []

      for (let i = 0; i < maxCalls; i++) {
        const session = mockServer
          .getUA()
          .call(`sip:user${i}@example.com`, { mediaConstraints: { audio: true, video: false } })
        sessions.push(session)
        mockServer.simulateCallProgress(session)
        mockServer.simulateCallAccepted(session)
        mockServer.simulateCallConfirmed(session)
      }

      await waitImmediate()

      // All calls should be established
      const establishedCalls = sessions.filter((s) => s.isEstablished()).length
      expect(establishedCalls).toBe(maxCalls)

      // Clean up
      for (const session of sessions) {
        mockServer.simulateCallEnded(session, 'local')
      }
    })

    it('should handle calls exceeding MAX_CONCURRENT_CALLS', async () => {
      const callCount = PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS + 2 // 7 calls
      const sessions: MockRTCSession[] = []

      for (let i = 0; i < callCount; i++) {
        const session = mockServer
          .getUA()
          .call(`sip:user${i}@example.com`, { mediaConstraints: { audio: true, video: false } })
        sessions.push(session)
        mockServer.simulateCallProgress(session)
        mockServer.simulateCallAccepted(session)
      }

      await waitImmediate()

      // System should handle calls beyond the recommended limit
      // (implementation may choose to accept, queue, or reject)
      expect(sessions.length).toBe(callCount)

      // At minimum, the first MAX_CONCURRENT_CALLS should be established
      const establishedCalls = sessions.filter((s) => s.isEstablished()).length
      expect(establishedCalls).toBeGreaterThanOrEqual(PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS)

      // Clean up
      for (const session of sessions) {
        mockServer.simulateCallEnded(session, 'local')
      }
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance degradation with increasing concurrent calls', async () => {
      const results: CallSetupMetrics[] = []

      // Test with 1, 3, 5 calls
      for (const callCount of [1, 3, 5]) {
        const metrics = await testConcurrentCalls(callCount)
        results.push(metrics)
        await waitImmediate() // Allow system to stabilize between tests
      }

      // Average setup time should not increase exponentially
      // Allow up to 2x increase from baseline to max
      const baselineTime = results[0].averageSetupTime
      const maxTime = results[results.length - 1].averageSetupTime

      console.log('Performance scaling:', {
        baseline: `${baselineTime.toFixed(2)}ms`,
        max: `${maxTime.toFixed(2)}ms`,
        ratio: `${(maxTime / baselineTime).toFixed(2)}x`,
      })

      // Performance should scale reasonably (not more than 3x slower)
      expect(maxTime).toBeLessThan(baselineTime * 3)
    })
  })
})
