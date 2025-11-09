/**
 * Latency Tracking Performance Tests
 *
 * Measures and validates various latency metrics against performance budgets:
 * - Call setup latency (makeCall to ringing/connected)
 * - State update latency (reactive state propagation)
 * - Event propagation latency
 *
 * All measurements are validated against PERFORMANCE constants to ensure
 * the library meets performance targets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../../src/core/EventBus'
import { CallSession } from '../../../src/core/CallSession'
import { PERFORMANCE, EVENTS } from '../../../src/utils/constants'
import { wait } from '../../utils/test-helpers'

/**
 * Performance measurement result
 */
interface PerformanceMeasurement {
  operation: string
  actualMs: number
  budgetMs: number
  passed: boolean
  overhead: number
  percentOfBudget: number
}

/**
 * Performance report
 */
interface PerformanceReport {
  testName: string
  measurements: PerformanceMeasurement[]
  allPassed: boolean
  totalTests: number
  passedTests: number
  failedTests: number
}

/**
 * Create a performance measurement
 */
function createMeasurement(
  operation: string,
  actualMs: number,
  budgetMs: number
): PerformanceMeasurement {
  const passed = actualMs <= budgetMs
  const overhead = actualMs - budgetMs
  const percentOfBudget = (actualMs / budgetMs) * 100

  return {
    operation,
    actualMs,
    budgetMs,
    passed,
    overhead,
    percentOfBudget,
  }
}

/**
 * Create a performance report
 */
function createReport(testName: string, measurements: PerformanceMeasurement[]): PerformanceReport {
  const passedTests = measurements.filter((m) => m.passed).length
  const failedTests = measurements.filter((m) => !m.passed).length

  return {
    testName,
    measurements,
    allPassed: failedTests === 0,
    totalTests: measurements.length,
    passedTests,
    failedTests,
  }
}

/**
 * Format performance report for console output
 */
function formatReport(report: PerformanceReport): string {
  const lines: string[] = []

  lines.push(`\n${'='.repeat(80)}`)
  lines.push(`Performance Report: ${report.testName}`)
  lines.push(`${'='.repeat(80)}`)
  lines.push(
    `Status: ${report.allPassed ? '✓ PASSED' : '✗ FAILED'} (${report.passedTests}/${report.totalTests})`
  )
  lines.push(`${'='.repeat(80)}`)

  for (const measurement of report.measurements) {
    const status = measurement.passed ? '✓' : '✗'

    lines.push(`\n${status} ${measurement.operation}`)
    lines.push(`  Actual:  ${measurement.actualMs.toFixed(2)}ms`)
    lines.push(`  Budget:  ${measurement.budgetMs.toFixed(2)}ms`)
    lines.push(`  Usage:   ${measurement.percentOfBudget.toFixed(1)}% of budget`)

    if (!measurement.passed) {
      lines.push(`  ⚠️  Over budget by ${measurement.overhead.toFixed(2)}ms`)
    }
  }

  lines.push(`\n${'='.repeat(80)}\n`)

  return lines.join('\n')
}

/**
 * Mock JsSIP User Agent
 */
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

/**
 * Mock RTC Session
 */
function createMockRTCSession(sessionId: string) {
  return {
    id: sessionId,
    connection: {
      getSenders: vi.fn().mockReturnValue([]),
      getReceivers: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    localHold: false,
    remoteHold: false,
    direction: 'outgoing' as const,
    local_identity: { uri: { user: 'local', host: 'example.com' } },
    remote_identity: { uri: { user: 'remote', host: 'example.com' } },
    start_time: new Date(),
    end_time: null,
    isInProgress: vi.fn().mockReturnValue(false),
    isEstablished: vi.fn().mockReturnValue(false),
    isEnded: vi.fn().mockReturnValue(false),
    answer: vi.fn(),
    terminate: vi.fn(),
    hold: vi.fn(),
    unhold: vi.fn(),
    renegotiate: vi.fn(),
    refer: vi.fn(),
    sendDTMF: vi.fn(),
    sendInfo: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  }
}

// Mock JsSIP module
vi.mock('jssip', () => {
  return {
    default: {
      UA: vi.fn(() => mockUA),
      WebSocketInterface: vi.fn(),
      debug: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
    },
  }
})

describe('Latency Tracking Performance Tests', () => {
  let eventBus: EventBus

  beforeEach(() => {
    vi.clearAllMocks()
    eventBus = new EventBus()
  })

  afterEach(() => {
    eventBus.destroy()
  })

  describe('Event Propagation Latency', () => {
    it('should propagate events within MAX_EVENT_PROPAGATION_TIME budget', async () => {
      const measurements: PerformanceMeasurement[] = []
      const iterations = 10
      const eventName = 'test:event'

      for (let i = 0; i < iterations; i++) {
        let eventReceived = false
        let propagationTime = 0

        eventBus.on(eventName, () => {
          eventReceived = true
        })

        const startTime = performance.now()
        eventBus.emit(eventName, { test: 'data' })

        // Wait a tiny bit for event to propagate
        await new Promise((resolve) => setTimeout(resolve, 0))

        const endTime = performance.now()
        propagationTime = endTime - startTime

        expect(eventReceived).toBe(true)

        measurements.push(
          createMeasurement(
            `Event propagation #${i + 1}`,
            propagationTime,
            PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
          )
        )

        eventBus.off(eventName)
      }

      // Calculate average propagation time
      const avgPropagationTime =
        measurements.reduce((sum, m) => sum + m.actualMs, 0) / measurements.length

      const avgMeasurement = createMeasurement(
        'Average event propagation',
        avgPropagationTime,
        PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
      )

      measurements.push(avgMeasurement)

      const report = createReport('Event Propagation Latency', measurements)

      // Log the report
      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      // Validate that average is within budget
      expect(avgMeasurement.passed).toBe(true)
      expect(avgPropagationTime).toBeLessThanOrEqual(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
    })

    it('should handle multiple concurrent events efficiently', async () => {
      const measurements: PerformanceMeasurement[] = []
      const eventCount = 100
      const events: string[] = []

      for (let i = 0; i < eventCount; i++) {
        events.push(`test:event:${i}`)
      }

      let receivedCount = 0

      // Register handlers for all events
      events.forEach((eventName) => {
        eventBus.on(eventName, () => {
          receivedCount++
        })
      })

      // Emit all events and measure time
      const startTime = performance.now()

      events.forEach((eventName) => {
        eventBus.emit(eventName, {})
      })

      // Wait for all events to propagate
      await new Promise((resolve) => setTimeout(resolve, 50))

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTimePerEvent = totalTime / eventCount

      expect(receivedCount).toBe(eventCount)

      measurements.push(
        createMeasurement(
          `Average time per event (${eventCount} events)`,
          avgTimePerEvent,
          PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
        )
      )

      const report = createReport('Concurrent Event Propagation', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      expect(avgTimePerEvent).toBeLessThanOrEqual(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
    })
  })

  describe('State Update Latency', () => {
    it('should update call state within MAX_STATE_UPDATE_LATENCY budget', async () => {
      const measurements: PerformanceMeasurement[] = []
      const rtcSession = createMockRTCSession('call-123')

      const callSession = new CallSession({
        id: rtcSession.id,
        direction: 'outgoing',
        localUri: 'sip:local@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession,
        eventBus,
      })

      // Test mute state update
      const muteStartTime = performance.now()
      callSession.mute()
      const muteEndTime = performance.now()
      const muteLatency = muteEndTime - muteStartTime

      expect(callSession.isMuted).toBe(true)

      measurements.push(
        createMeasurement('Mute state update', muteLatency, PERFORMANCE.MAX_STATE_UPDATE_LATENCY)
      )

      // Test unmute state update
      const unmuteStartTime = performance.now()
      callSession.unmute()
      const unmuteEndTime = performance.now()
      const unmuteLatency = unmuteEndTime - unmuteStartTime

      expect(callSession.isMuted).toBe(false)

      measurements.push(
        createMeasurement(
          'Unmute state update',
          unmuteLatency,
          PERFORMANCE.MAX_STATE_UPDATE_LATENCY
        )
      )

      const report = createReport('State Update Latency', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      // Both should be within budget
      expect(measurements.every((m) => m.passed)).toBe(true)
    })

    it('should update multiple states rapidly', async () => {
      const measurements: PerformanceMeasurement[] = []
      const iterations = 50
      const rtcSession = createMockRTCSession('call-123')

      const callSession = new CallSession({
        id: rtcSession.id,
        direction: 'outgoing',
        localUri: 'sip:local@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession,
        eventBus,
      })

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        callSession.mute()
        callSession.unmute()
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTimePerUpdate = totalTime / (iterations * 2) // *2 because we do mute + unmute

      measurements.push(
        createMeasurement(
          `Average state update (${iterations * 2} updates)`,
          avgTimePerUpdate,
          PERFORMANCE.MAX_STATE_UPDATE_LATENCY
        )
      )

      const report = createReport('Rapid State Updates', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      expect(avgTimePerUpdate).toBeLessThanOrEqual(PERFORMANCE.MAX_STATE_UPDATE_LATENCY)
    })
  })

  describe('Call Setup Latency', () => {
    it('should simulate call setup timing within TARGET_CALL_SETUP_TIME', async () => {
      const measurements: PerformanceMeasurement[] = []

      // Simulate call setup sequence
      const startTime = performance.now()

      // 1. Create call session (simulated)
      await wait(10) // Simulate UA.call() processing

      // 2. Wait for trying state
      await wait(50) // Simulate network latency

      // 3. Wait for progress/ringing
      eventBus.emit(EVENTS.CALL_RINGING, {})
      await wait(100) // Simulate ringing

      // 4. Call accepted
      eventBus.emit(EVENTS.CALL_ACCEPTED, {})
      await wait(50) // Simulate media setup

      // 5. Call established
      eventBus.emit(EVENTS.CALL_ANSWERED, {})

      const endTime = performance.now()
      const setupLatency = endTime - startTime

      measurements.push(
        createMeasurement('Simulated call setup', setupLatency, PERFORMANCE.TARGET_CALL_SETUP_TIME)
      )

      const report = createReport('Call Setup Latency', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      expect(setupLatency).toBeLessThanOrEqual(PERFORMANCE.TARGET_CALL_SETUP_TIME)
    })

    it('should measure real CallSession initialization time', () => {
      const measurements: PerformanceMeasurement[] = []
      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const rtcSession = createMockRTCSession(`call-${i}`)

        const startTime = performance.now()

        new CallSession({
          id: rtcSession.id,
          direction: 'outgoing',
          localUri: 'sip:local@example.com',
          remoteUri: 'sip:remote@example.com',
          remoteDisplayName: 'Remote User',
          rtcSession,
          eventBus,
        })

        const endTime = performance.now()
        const initTime = endTime - startTime

        measurements.push(
          createMeasurement(
            `CallSession initialization #${i + 1}`,
            initTime,
            PERFORMANCE.MAX_STATE_UPDATE_LATENCY // Should be very fast
          )
        )
      }

      // Calculate average
      const avgInitTime = measurements.reduce((sum, m) => sum + m.actualMs, 0) / measurements.length

      measurements.push(
        createMeasurement(
          'Average CallSession initialization',
          avgInitTime,
          PERFORMANCE.MAX_STATE_UPDATE_LATENCY
        )
      )

      const report = createReport('CallSession Initialization Performance', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      expect(avgInitTime).toBeLessThanOrEqual(PERFORMANCE.MAX_STATE_UPDATE_LATENCY)
    })
  })

  describe('EventBus Performance', () => {
    it('should handle event listener registration efficiently', () => {
      const measurements: PerformanceMeasurement[] = []
      const listenerCount = 1000

      const startTime = performance.now()

      for (let i = 0; i < listenerCount; i++) {
        eventBus.on(`test:event:${i}`, () => {
          // Empty handler
        })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTimePerListener = totalTime / listenerCount

      measurements.push(
        createMeasurement(
          `Average listener registration (${listenerCount} listeners)`,
          avgTimePerListener,
          PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
        )
      )

      const report = createReport('Event Listener Registration', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      expect(avgTimePerListener).toBeLessThanOrEqual(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
    })

    it('should handle event listener removal efficiently', () => {
      const measurements: PerformanceMeasurement[] = []
      const listenerCount = 1000
      const handlers: Array<() => void> = []

      // Register listeners
      for (let i = 0; i < listenerCount; i++) {
        const handler = () => {
          // Empty handler
        }
        handlers.push(handler)
        eventBus.on(`test:event:${i}`, handler)
      }

      // Measure removal time
      const startTime = performance.now()

      for (let i = 0; i < listenerCount; i++) {
        eventBus.off(`test:event:${i}`, handlers[i])
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTimePerRemoval = totalTime / listenerCount

      measurements.push(
        createMeasurement(
          `Average listener removal (${listenerCount} listeners)`,
          avgTimePerRemoval,
          PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
        )
      )

      const report = createReport('Event Listener Removal', measurements)

      if (!report.allPassed) {
        console.log(formatReport(report))
      }

      expect(avgTimePerRemoval).toBeLessThanOrEqual(PERFORMANCE.MAX_EVENT_PROPAGATION_TIME)
    })
  })

  describe('Performance Summary', () => {
    it('should generate comprehensive performance report', async () => {
      const allMeasurements: PerformanceMeasurement[] = []

      // 1. Event propagation
      let receivedEvent = false
      eventBus.on('test:summary', () => {
        receivedEvent = true
      })

      const eventStart = performance.now()
      eventBus.emit('test:summary', {})
      await new Promise((resolve) => setTimeout(resolve, 0))
      const eventEnd = performance.now()

      expect(receivedEvent).toBe(true)

      allMeasurements.push(
        createMeasurement(
          'Event propagation',
          eventEnd - eventStart,
          PERFORMANCE.MAX_EVENT_PROPAGATION_TIME
        )
      )

      // 2. State update
      const rtcSession = createMockRTCSession('summary-call')
      const callSession = new CallSession({
        id: rtcSession.id,
        direction: 'outgoing',
        localUri: 'sip:local@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession,
        eventBus,
      })

      const stateStart = performance.now()
      callSession.mute()
      const stateEnd = performance.now()

      allMeasurements.push(
        createMeasurement(
          'State update',
          stateEnd - stateStart,
          PERFORMANCE.MAX_STATE_UPDATE_LATENCY
        )
      )

      // 3. CallSession initialization
      const initStart = performance.now()
      new CallSession({
        id: 'summary-call-2',
        direction: 'outgoing',
        localUri: 'sip:local@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession: createMockRTCSession('summary-call-2'),
        eventBus,
      })
      const initEnd = performance.now()

      allMeasurements.push(
        createMeasurement(
          'CallSession initialization',
          initEnd - initStart,
          PERFORMANCE.MAX_STATE_UPDATE_LATENCY
        )
      )

      const report = createReport('Comprehensive Performance Summary', allMeasurements)

      // Always show the comprehensive report
      console.log(formatReport(report))

      // All measurements should pass
      expect(report.allPassed).toBe(true)
    })
  })
})
