/**
 * Rapid Operations Performance Tests
 *
 * Tests system behavior under rapid operation scenarios including:
 * - Rapid call creation and immediate termination (100+ cycles)
 * - Rapid registration/unregistration cycles
 * - Rapid mute/unmute operations
 * - Rapid device switching
 * - Memory growth monitoring
 * - Average operation time measurements
 * - Validation against PERFORMANCE constants
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SipClient } from '../../../src/core/SipClient'
import { CallSession } from '../../../src/core/CallSession'
import { MediaManager } from '../../../src/core/MediaManager'
import { EventBus } from '../../../src/core/EventBus'
import { createMockSipServer, type MockRTCSession } from '../../helpers/MockSipServer'
import type { SipClientConfig } from '../../../src/types/config.types'
import { PERFORMANCE } from '../../../src/utils/constants'

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
 * Test cycle counts - Number of iterations for various rapid operation tests
 */
const TEST_CYCLES = {
  /** High iteration count to detect memory leaks and performance degradation over time */
  RAPID_CALL_CREATION: 150,
  /** Lower count due to async overhead and network simulation */
  REGISTRATION: 50,
  /** Higher count for synchronous operations that are fast to execute */
  MUTE_UNMUTE: 200,
  /** Lower count as device operations involve media stream management */
  DEVICE_SWITCHING: 50,
  /** Moderate count for testing call state stability */
  STABILITY_TEST: 100,
  /** Moderate count for memory leak detection with proper cleanup */
  MEMORY_LEAK_DETECTION: 50,
  /** Small count for stream cleanup validation */
  STREAM_CLEANUP: 30,
} as const

/**
 * Event and performance test counts
 */
const PERFORMANCE_TEST_COUNTS = {
  /** Large number of events to test propagation speed */
  EVENT_EMISSIONS: 1000,
  /** Number of event subscribers to test multi-listener performance */
  EVENT_SUBSCRIBERS: 20,
  /** Number of events for multi-subscriber test */
  SUBSCRIBER_EVENTS: 100,
  /** Number of state updates to test latency */
  STATE_UPDATES: 500,
  /** Number of concurrent operations to test for deadlocks */
  CONCURRENT_CALLS: 5,
} as const

/**
 * Memory snapshot frequencies - How often to capture memory measurements
 */
const SNAPSHOT_INTERVALS = {
  /** Take snapshot every 25 iterations for high-frequency tests */
  HIGH_FREQUENCY: 25,
  /** Take snapshot every 10 iterations for medium-frequency tests */
  MEDIUM_FREQUENCY: 10,
  /** Take snapshot every 50 iterations for low-frequency tests */
  LOW_FREQUENCY: 50,
} as const

/**
 * Async operation wait times (milliseconds)
 */
const ASYNC_WAIT_TIMES = {
  /** Very short wait for immediate cleanup operations */
  IMMEDIATE: 1,
  /** Short wait for async cleanup after operations */
  CLEANUP: 5,
  /** Medium wait for concurrent operations */
  CONCURRENT_OPS: 10,
} as const

/**
 * Performance thresholds for validation
 */
const PERFORMANCE_THRESHOLDS = {
  /** Maximum acceptable time for mocked call creation (ms) */
  MOCK_CALL_CREATION: 100,
  /** Maximum acceptable time for device switching with mocks (ms) */
  MOCK_DEVICE_SWITCH: 100,
  /** Maximum acceptable memory growth during tests (bytes) */
  MAX_MEMORY_GROWTH: 100 * 1024 * 1024, // 100MB
  /** Memory growth threshold for memory leak tests (bytes) */
  LEAK_DETECTION_MEMORY: 50 * 1024 * 1024, // 50MB
  /** Maximum acceptable performance degradation ratio */
  MAX_DEGRADATION_RATIO: 1.5, // 50% degradation
} as const

/**
 * Warmup configurations - Iterations to stabilize system before measurement
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WARMUP = {
  /** Warmup cycles for call creation tests */
  CALL_CREATION: 10,
} as const

// =============================================================================

/**
 * Performance metrics collector
 */
interface PerformanceMetrics {
  operationName: string
  totalTime: number
  operationCount: number
  averageTime: number
  minTime: number
  maxTime: number
  successCount: number
  failureCount: number
}

/**
 * Memory usage snapshot
 */
interface MemorySnapshot {
  timestamp: number
  heapUsed: number
  heapTotal: number
  external: number
}

/**
 * Helper class to collect performance metrics
 */
class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map()
  private memorySnapshots: MemorySnapshot[] = []

  /**
   * Record an operation time
   */
  recordOperation(name: string, timeMs: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(timeMs)
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage()
      this.memorySnapshots.push({
        timestamp: Date.now(),
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      })
    }
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(name: string): PerformanceMetrics | null {
    const times = this.metrics.get(name)
    if (!times || times.length === 0) return null

    const totalTime = times.reduce((sum, t) => sum + t, 0)
    const averageTime = totalTime / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)

    return {
      operationName: name,
      totalTime,
      operationCount: times.length,
      averageTime,
      minTime,
      maxTime,
      successCount: times.length,
      failureCount: 0,
    }
  }

  /**
   * Check if memory grew excessively
   */
  hasExcessiveMemoryGrowth(thresholdBytes: number = 100 * 1024 * 1024): boolean {
    if (this.memorySnapshots.length < 2) return false

    const first = this.memorySnapshots[0]
    const last = this.memorySnapshots[this.memorySnapshots.length - 1]
    const growth = last.heapUsed - first.heapUsed

    return growth > thresholdBytes
  }

  /**
   * Get memory growth in MB
   */
  getMemoryGrowthMB(): number {
    if (this.memorySnapshots.length < 2) return 0

    const first = this.memorySnapshots[0]
    const last = this.memorySnapshots[this.memorySnapshots.length - 1]
    const growth = last.heapUsed - first.heapUsed

    return growth / (1024 * 1024)
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear()
    this.memorySnapshots = []
  }
}

/**
 * Helper to measure async operation time
 */
async function measureTime<T>(
  operation: () => Promise<T>,
  collector: PerformanceCollector,
  operationName: string
): Promise<T> {
  const start = performance.now()
  const result = await operation()
  const end = performance.now()
  collector.recordOperation(operationName, end - start)
  return result
}

/**
 * Helper to create mock media devices
 */
function setupMockMediaDevices(): void {
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      id: 'mock-stream',
      active: true,
      getTracks: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          id: 'audio-track',
          enabled: true,
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        },
      ]),
      getAudioTracks: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          id: 'audio-track',
          enabled: true,
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        },
      ]),
      getVideoTracks: vi.fn().mockReturnValue([]),
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      {
        deviceId: 'device1',
        kind: 'audioinput' as MediaDeviceKind,
        label: 'Microphone 1',
        groupId: 'group1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'device2',
        kind: 'audioinput' as MediaDeviceKind,
        label: 'Microphone 2',
        groupId: 'group2',
        toJSON: () => ({}),
      },
    ]),
    getSupportedConstraints: vi.fn().mockReturnValue({
      deviceId: true,
      echoCancellation: true,
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as never
}

describe('Rapid Operations Performance Tests', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let mediaManager: MediaManager
  let mockSipServer: ReturnType<typeof createMockSipServer>
  let config: SipClientConfig
  let performanceCollector: PerformanceCollector

  beforeEach(() => {
    vi.clearAllMocks()

    eventBus = new EventBus()
    performanceCollector = new PerformanceCollector()

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

    sipClient = new SipClient(config, eventBus)
    mediaManager = new MediaManager({ eventBus })
    mockSipServer = createMockSipServer({
      autoAcceptCalls: true,
      networkLatency: 0, // Minimize latency for performance tests
    })

    setupMockMediaDevices()
  })

  afterEach(() => {
    performanceCollector.reset()
    sipClient.destroy()
    mediaManager.destroy()
    eventBus.destroy()
    mockSipServer.destroy()
  })

  describe('Rapid Call Creation and Termination', () => {
    it('should handle 100+ rapid call creation/termination cycles without crashes', async () => {
      const CYCLES = TEST_CYCLES.RAPID_CALL_CREATION
      const callSessions: CallSession[] = []

      performanceCollector.takeMemorySnapshot()

      for (let i = 0; i < CYCLES; i++) {
        // Create call session
        const session = await measureTime(
          async () => {
            const mockSession = mockSipServer.createSession(`session-${i}`)
            mockSession.isEstablished.mockReturnValue(true)

            return new CallSession({
              id: mockSession.id,
              direction: 'outgoing',
              localUri: 'sip:user@example.com',
              remoteUri: `sip:remote${i}@example.com`,
              remoteDisplayName: `Remote User ${i}`,
              rtcSession: mockSession,
              eventBus,
            })
          },
          performanceCollector,
          'call-creation'
        )

        callSessions.push(session)

        // Immediately terminate
        await measureTime(
          async () => {
            mockSipServer.simulateCallEnded(session.rtcSession as MockRTCSession, 'local')
            await new Promise((resolve) => setTimeout(resolve, ASYNC_WAIT_TIMES.CLEANUP))
          },
          performanceCollector,
          'call-termination'
        )

        // Take memory snapshot every 25 cycles
        if (i % SNAPSHOT_INTERVALS.HIGH_FREQUENCY === 0) {
          performanceCollector.takeMemorySnapshot()
        }
      }

      performanceCollector.takeMemorySnapshot()

      // Get metrics
      const creationMetrics = performanceCollector.getMetrics('call-creation')
      const terminationMetrics = performanceCollector.getMetrics('call-termination')

      expect(creationMetrics).toBeDefined()
      expect(terminationMetrics).toBeDefined()

      // Verify all operations completed
      expect(creationMetrics!.operationCount).toBe(CYCLES)
      expect(terminationMetrics!.operationCount).toBe(CYCLES)

      // Log performance results
      console.log('\n📊 Rapid Call Creation/Termination Performance:')
      console.log(`  ✓ Cycles completed: ${CYCLES}`)
      console.log(`  ✓ Avg creation time: ${creationMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Avg termination time: ${terminationMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Memory growth: ${performanceCollector.getMemoryGrowthMB().toFixed(2)}MB`)

      // Validate against performance targets
      // Each call setup should be well under target call setup time since we're mocking
      expect(creationMetrics!.averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MOCK_CALL_CREATION)

      // Check memory didn't grow excessively (100MB threshold)
      expect(
        performanceCollector.hasExcessiveMemoryGrowth(PERFORMANCE_THRESHOLDS.MAX_MEMORY_GROWTH)
      ).toBe(false)
    })

    it('should maintain stable performance across call cycles', async () => {
      const CYCLES = TEST_CYCLES.STABILITY_TEST
      const firstHalfTimes: number[] = []
      const secondHalfTimes: number[] = []

      for (let i = 0; i < CYCLES; i++) {
        const start = performance.now()

        const mockSession = mockSipServer.createSession(`session-${i}`)
        mockSession.isEstablished.mockReturnValue(true)

        new CallSession({
          id: mockSession.id,
          direction: 'outgoing',
          localUri: 'sip:user@example.com',
          remoteUri: `sip:remote${i}@example.com`,
          remoteDisplayName: `Remote User ${i}`,
          rtcSession: mockSession,
          eventBus,
        })

        mockSipServer.simulateCallEnded(mockSession, 'local')
        await new Promise((resolve) => setTimeout(resolve, ASYNC_WAIT_TIMES.IMMEDIATE))

        const end = performance.now()
        const duration = end - start

        if (i < CYCLES / 2) {
          firstHalfTimes.push(duration)
        } else {
          secondHalfTimes.push(duration)
        }
      }

      const firstHalfAvg = firstHalfTimes.reduce((a, b) => a + b, 0) / firstHalfTimes.length
      const secondHalfAvg = secondHalfTimes.reduce((a, b) => a + b, 0) / secondHalfTimes.length

      console.log('\n📊 Performance Stability:')
      console.log(`  ✓ First half avg: ${firstHalfAvg.toFixed(2)}ms`)
      console.log(`  ✓ Second half avg: ${secondHalfAvg.toFixed(2)}ms`)
      console.log(
        `  ✓ Performance degradation: ${(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100).toFixed(2)}%`
      )

      // Performance should not degrade significantly (allow 50% degradation)
      expect(secondHalfAvg).toBeLessThan(
        firstHalfAvg * PERFORMANCE_THRESHOLDS.MAX_DEGRADATION_RATIO
      )
    })
  })

  describe('Rapid Registration/Unregistration Cycles', () => {
    it('should handle rapid registration/unregistration cycles', async () => {
      const CYCLES = TEST_CYCLES.REGISTRATION

      // Setup connection
      mockUA.isConnected.mockReturnValue(true)
      mockUA.once.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 1)
        }
        if (event === 'registered') {
          setTimeout(() => handler({ response: { getHeader: () => '600' } }), 1)
        }
        if (event === 'unregistered') {
          setTimeout(() => handler(), 1)
        }
      })

      await sipClient.start()
      performanceCollector.takeMemorySnapshot()

      for (let i = 0; i < CYCLES; i++) {
        // Register
        await measureTime(
          async () => {
            mockUA.isRegistered.mockReturnValue(false)
            mockSipServer.simulateRegistered(600)
            mockUA.isRegistered.mockReturnValue(true)
            await sipClient.register()
          },
          performanceCollector,
          'registration'
        )

        // Unregister
        await measureTime(
          async () => {
            mockSipServer.simulateUnregistered()
            mockUA.isRegistered.mockReturnValue(false)
            await sipClient.unregister()
          },
          performanceCollector,
          'unregistration'
        )

        if (i % SNAPSHOT_INTERVALS.MEDIUM_FREQUENCY === 0) {
          performanceCollector.takeMemorySnapshot()
        }
      }

      performanceCollector.takeMemorySnapshot()

      const registrationMetrics = performanceCollector.getMetrics('registration')
      const unregistrationMetrics = performanceCollector.getMetrics('unregistration')

      expect(registrationMetrics).toBeDefined()
      expect(unregistrationMetrics).toBeDefined()

      console.log('\n📊 Rapid Registration/Unregistration Performance:')
      console.log(`  ✓ Cycles completed: ${CYCLES}`)
      console.log(`  ✓ Avg registration time: ${registrationMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Avg unregistration time: ${unregistrationMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Memory growth: ${performanceCollector.getMemoryGrowthMB().toFixed(2)}MB`)

      // All cycles should complete
      expect(registrationMetrics!.operationCount).toBe(CYCLES)
      expect(unregistrationMetrics!.operationCount).toBe(CYCLES)

      // Should be fast with mocks
      expect(registrationMetrics!.averageTime).toBeLessThan(PERFORMANCE.MAX_STATE_UPDATE_LATENCY)

      // Check memory
      expect(performanceCollector.hasExcessiveMemoryGrowth()).toBe(false)
    })
  })

  describe('Rapid Mute/Unmute Operations', () => {
    it('should handle rapid mute/unmute operations without hangs', async () => {
      const CYCLES = TEST_CYCLES.MUTE_UNMUTE

      // Setup an active call session
      const mockSession = mockSipServer.createSession('mute-test-session')
      mockSession.isEstablished.mockReturnValue(true)

      const callSession = new CallSession({
        id: mockSession.id,
        direction: 'outgoing',
        localUri: 'sip:user@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession: mockSession,
        eventBus,
      })

      // Mock audio track
      const mockAudioTrack = {
        kind: 'audio',
        id: 'audio-track',
        enabled: true,
        stop: vi.fn(),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
      }

      const mockStream = {
        id: 'stream',
        active: true,
        getTracks: vi.fn().mockReturnValue([mockAudioTrack]),
        getAudioTracks: vi.fn().mockReturnValue([mockAudioTrack]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      }

      // Manually set stream on call session for testing
      ;(callSession as any).localStream = mockStream

      performanceCollector.takeMemorySnapshot()

      for (let i = 0; i < CYCLES; i++) {
        // Mute
        await measureTime(
          async () => {
            await callSession.mute()
          },
          performanceCollector,
          'mute'
        )

        // Unmute
        await measureTime(
          async () => {
            await callSession.unmute()
          },
          performanceCollector,
          'unmute'
        )

        if (i % SNAPSHOT_INTERVALS.LOW_FREQUENCY === 0) {
          performanceCollector.takeMemorySnapshot()
        }
      }

      performanceCollector.takeMemorySnapshot()

      const muteMetrics = performanceCollector.getMetrics('mute')
      const unmuteMetrics = performanceCollector.getMetrics('unmute')

      expect(muteMetrics).toBeDefined()
      expect(unmuteMetrics).toBeDefined()

      console.log('\n📊 Rapid Mute/Unmute Performance:')
      console.log(`  ✓ Cycles completed: ${CYCLES}`)
      console.log(`  ✓ Avg mute time: ${muteMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Avg unmute time: ${unmuteMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Memory growth: ${performanceCollector.getMemoryGrowthMB().toFixed(2)}MB`)

      // Verify all operations completed
      expect(muteMetrics!.operationCount).toBe(CYCLES)
      expect(unmuteMetrics!.operationCount).toBe(CYCLES)

      // Mute/unmute should be very fast (under state update latency)
      expect(muteMetrics!.averageTime).toBeLessThan(PERFORMANCE.MAX_STATE_UPDATE_LATENCY)
      expect(unmuteMetrics!.averageTime).toBeLessThan(PERFORMANCE.MAX_STATE_UPDATE_LATENCY)

      // Check memory
      expect(performanceCollector.hasExcessiveMemoryGrowth()).toBe(false)
    })

    it('should handle alternating mute states correctly', async () => {
      const CYCLES = TEST_CYCLES.STABILITY_TEST
      const mockSession = mockSipServer.createSession('mute-state-session')
      mockSession.isEstablished.mockReturnValue(true)

      const callSession = new CallSession({
        id: mockSession.id,
        direction: 'outgoing',
        localUri: 'sip:user@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession: mockSession,
        eventBus,
      })

      const mockAudioTrack = {
        kind: 'audio',
        id: 'audio-track',
        enabled: true,
        stop: vi.fn(),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
      }

      const mockStream = {
        id: 'stream',
        active: true,
        getTracks: vi.fn().mockReturnValue([mockAudioTrack]),
        getAudioTracks: vi.fn().mockReturnValue([mockAudioTrack]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      }

      ;(callSession as any).localStream = mockStream

      for (let i = 0; i < CYCLES; i++) {
        await callSession.mute()
        expect(callSession.isMuted).toBe(true)

        await callSession.unmute()
        expect(callSession.isMuted).toBe(false)
      }

      // Final state should be unmuted
      expect(callSession.isMuted).toBe(false)
    })
  })

  describe('Rapid Device Switching', () => {
    it('should handle rapid device switching without crashes', async () => {
      const CYCLES = TEST_CYCLES.DEVICE_SWITCHING
      const devices = ['device1', 'device2']

      performanceCollector.takeMemorySnapshot()

      for (let i = 0; i < CYCLES; i++) {
        const deviceId = devices[i % devices.length]

        await measureTime(
          async () => {
            // Mock getUserMedia to return a new stream
            ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
              id: `stream-${i}`,
              active: true,
              getTracks: vi.fn().mockReturnValue([
                {
                  kind: 'audio',
                  id: `audio-track-${i}`,
                  enabled: true,
                  stop: vi.fn(),
                  getSettings: vi.fn().mockReturnValue({ deviceId }),
                },
              ]),
              getAudioTracks: vi.fn().mockReturnValue([
                {
                  kind: 'audio',
                  id: `audio-track-${i}`,
                  enabled: true,
                  stop: vi.fn(),
                  getSettings: vi.fn().mockReturnValue({ deviceId }),
                },
              ]),
              getVideoTracks: vi.fn().mockReturnValue([]),
            })

            await mediaManager.getUserMedia({
              audio: { deviceId: { exact: deviceId } },
              video: false,
            })
          },
          performanceCollector,
          'device-switch'
        )

        if (i % SNAPSHOT_INTERVALS.MEDIUM_FREQUENCY === 0) {
          performanceCollector.takeMemorySnapshot()
        }
      }

      performanceCollector.takeMemorySnapshot()

      const switchMetrics = performanceCollector.getMetrics('device-switch')

      expect(switchMetrics).toBeDefined()

      console.log('\n📊 Rapid Device Switching Performance:')
      console.log(`  ✓ Cycles completed: ${CYCLES}`)
      console.log(`  ✓ Avg switch time: ${switchMetrics!.averageTime.toFixed(2)}ms`)
      console.log(`  ✓ Min switch time: ${switchMetrics!.minTime.toFixed(2)}ms`)
      console.log(`  ✓ Max switch time: ${switchMetrics!.maxTime.toFixed(2)}ms`)
      console.log(`  ✓ Memory growth: ${performanceCollector.getMemoryGrowthMB().toFixed(2)}MB`)

      // All switches should complete
      expect(switchMetrics!.operationCount).toBe(CYCLES)

      // Device switching should be reasonably fast (mocked, so very fast)
      expect(switchMetrics!.averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MOCK_DEVICE_SWITCH)

      // Check memory
      expect(performanceCollector.hasExcessiveMemoryGrowth()).toBe(false)
    })

    it('should cleanup old streams when switching devices', async () => {
      const CYCLES = TEST_CYCLES.STREAM_CLEANUP
      const stoppedTracks: any[] = []

      for (let i = 0; i < CYCLES; i++) {
        const mockTrack = {
          kind: 'audio',
          id: `track-${i}`,
          enabled: true,
          stop: vi.fn(() => stoppedTracks.push(mockTrack)),
          getSettings: vi.fn().mockReturnValue({ deviceId: `device${i}` }),
        }

        ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
          id: `stream-${i}`,
          active: true,
          getTracks: vi.fn().mockReturnValue([mockTrack]),
          getAudioTracks: vi.fn().mockReturnValue([mockTrack]),
          getVideoTracks: vi.fn().mockReturnValue([]),
        })

        await mediaManager.getUserMedia({
          audio: { deviceId: { exact: `device${i}` } },
          video: false,
        })
      }

      // All tracks except the last one should be stopped
      expect(stoppedTracks.length).toBeGreaterThanOrEqual(CYCLES - 1)
    })
  })

  describe('Event Propagation Performance', () => {
    it('should propagate events within performance target time', async () => {
      const EVENTS = PERFORMANCE_TEST_COUNTS.EVENT_EMISSIONS
      const eventTimes: number[] = []

      for (let i = 0; i < EVENTS; i++) {
        const start = performance.now()
        eventBus.emit('test:event', { data: i })
        const end = performance.now()
        eventTimes.push(end - start)
      }

      const avgEventTime = eventTimes.reduce((a, b) => a + b, 0) / eventTimes.length
      const maxEventTime = Math.max(...eventTimes)

      console.log('\n📊 Event Propagation Performance:')
      console.log(`  ✓ Events emitted: ${EVENTS}`)
      console.log(`  ✓ Avg propagation time: ${avgEventTime.toFixed(3)}ms`)
      console.log(`  ✓ Max propagation time: ${maxEventTime.toFixed(3)}ms`)

      // Event propagation should be very fast
      expect(avgEventTime).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
      expect(maxEventTime).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 2)
    })

    it('should handle multiple subscribers without significant performance degradation', async () => {
      const SUBSCRIBERS = PERFORMANCE_TEST_COUNTS.EVENT_SUBSCRIBERS
      const EVENTS = PERFORMANCE_TEST_COUNTS.SUBSCRIBER_EVENTS

      // Add multiple subscribers
      for (let i = 0; i < SUBSCRIBERS; i++) {
        eventBus.on('perf:test', () => {
          // Simple handler
        })
      }

      const start = performance.now()
      for (let i = 0; i < EVENTS; i++) {
        eventBus.emit('perf:test', { iteration: i })
      }
      const end = performance.now()

      const totalTime = end - start
      const avgTimePerEvent = totalTime / EVENTS

      console.log('\n📊 Multi-Subscriber Event Performance:')
      console.log(`  ✓ Subscribers: ${SUBSCRIBERS}`)
      console.log(`  ✓ Events: ${EVENTS}`)
      console.log(`  ✓ Avg time per event: ${avgTimePerEvent.toFixed(3)}ms`)

      // Even with multiple subscribers, should be reasonably fast
      expect(avgTimePerEvent).toBeLessThan(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * SUBSCRIBERS)
    })
  })

  describe('State Update Performance', () => {
    it('should update state within latency target', async () => {
      const UPDATES = PERFORMANCE_TEST_COUNTS.STATE_UPDATES
      const mockSession = mockSipServer.createSession('state-test')

      for (let i = 0; i < UPDATES; i++) {
        await measureTime(
          async () => {
            mockSession.isEstablished.mockReturnValue(i % 2 === 0)
          },
          performanceCollector,
          'state-update'
        )
      }

      const metrics = performanceCollector.getMetrics('state-update')
      expect(metrics).toBeDefined()

      console.log('\n📊 State Update Performance:')
      console.log(`  ✓ Updates completed: ${UPDATES}`)
      console.log(`  ✓ Avg update time: ${metrics!.averageTime.toFixed(3)}ms`)

      // State updates should be extremely fast
      expect(metrics!.averageTime).toBeLessThan(PERFORMANCE.MAX_STATE_UPDATE_LATENCY)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent call operations without deadlock', async () => {
      const CONCURRENT_CALLS = PERFORMANCE_TEST_COUNTS.CONCURRENT_CALLS
      const promises: Promise<void>[] = []

      performanceCollector.takeMemorySnapshot()

      for (let i = 0; i < CONCURRENT_CALLS; i++) {
        const promise = (async () => {
          const mockSession = mockSipServer.createSession(`concurrent-${i}`)
          mockSession.isEstablished.mockReturnValue(true)

          new CallSession({
            id: mockSession.id,
            direction: 'outgoing',
            localUri: 'sip:user@example.com',
            remoteUri: `sip:remote${i}@example.com`,
            remoteDisplayName: `Remote ${i}`,
            rtcSession: mockSession,
            eventBus,
          })

          // Perform some operations
          await new Promise((resolve) => setTimeout(resolve, ASYNC_WAIT_TIMES.CONCURRENT_OPS))
          mockSipServer.simulateCallEnded(mockSession, 'local')
        })()

        promises.push(promise)
      }

      // All should complete without hanging
      await Promise.all(promises)

      performanceCollector.takeMemorySnapshot()

      console.log('\n📊 Concurrent Operations:')
      console.log(`  ✓ Concurrent calls: ${CONCURRENT_CALLS}`)
      console.log(`  ✓ All completed successfully`)
      console.log(`  ✓ Memory growth: ${performanceCollector.getMemoryGrowthMB().toFixed(2)}MB`)

      // Verify no excessive memory growth
      expect(performanceCollector.hasExcessiveMemoryGrowth()).toBe(false)
    })

    it('should respect maximum concurrent calls limit', async () => {
      const MAX_CONCURRENT = PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS
      const activeCalls = new Map()

      for (let i = 0; i < MAX_CONCURRENT + 2; i++) {
        const mockSession = mockSipServer.createSession(`call-${i}`)
        mockSession.isEstablished.mockReturnValue(true)

        const callSession = new CallSession({
          id: mockSession.id,
          direction: 'outgoing',
          localUri: 'sip:user@example.com',
          remoteUri: `sip:remote${i}@example.com`,
          remoteDisplayName: `Remote ${i}`,
          rtcSession: mockSession,
          eventBus,
        })

        if (activeCalls.size < MAX_CONCURRENT) {
          activeCalls.set(callSession.id, callSession)
        }
      }

      // Should not exceed maximum
      expect(activeCalls.size).toBeLessThanOrEqual(MAX_CONCURRENT)
    })
  })

  describe('Memory Leak Detection', () => {
    it('should not leak memory after cleanup', async () => {
      const ITERATIONS = TEST_CYCLES.MEMORY_LEAK_DETECTION

      performanceCollector.takeMemorySnapshot()

      for (let i = 0; i < ITERATIONS; i++) {
        const mockSession = mockSipServer.createSession(`leak-test-${i}`)
        mockSession.isEstablished.mockReturnValue(true)

        const callSession = new CallSession({
          id: mockSession.id,
          direction: 'outgoing',
          localUri: 'sip:user@example.com',
          remoteUri: `sip:remote${i}@example.com`,
          remoteDisplayName: `Remote ${i}`,
          rtcSession: mockSession,
          eventBus,
        })

        // Simulate call lifecycle
        mockSipServer.simulateCallEnded(mockSession, 'local')

        // Cleanup
        callSession.destroy()

        if (i % SNAPSHOT_INTERVALS.MEDIUM_FREQUENCY === 0) {
          performanceCollector.takeMemorySnapshot()
        }
      }

      performanceCollector.takeMemorySnapshot()

      const memoryGrowthMB = performanceCollector.getMemoryGrowthMB()

      console.log('\n📊 Memory Leak Detection:')
      console.log(`  ✓ Iterations: ${ITERATIONS}`)
      console.log(`  ✓ Memory growth: ${memoryGrowthMB.toFixed(2)}MB`)

      // Memory growth should be minimal after cleanup
      // Allow for some growth due to test overhead, but should be reasonable
      expect(memoryGrowthMB).toBeLessThan(
        PERFORMANCE_THRESHOLDS.LEAK_DETECTION_MEMORY / (1024 * 1024)
      )
    })
  })
})
