/**
 * Concurrent Calls Load Test
 *
 * Tests the system's ability to handle multiple concurrent SIP calls.
 * Validates performance under realistic high-load scenarios.
 *
 * Run with: pnpm vitest tests/performance/load-tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runLoadTest, printLoadTestResult, assertNoMemoryLeak } from '../setup'
import { EventBus } from '../../../src/core/EventBus'
import { SessionManager } from '../../../src/core/SessionManager'
import { createMockRTCSession } from '../../utils/test-helpers'

describe('Concurrent Calls Load Test', () => {
  let eventBus: EventBus
  let sessionManager: SessionManager

  beforeEach(() => {
    eventBus = new EventBus()
    sessionManager = new SessionManager(eventBus)
  })

  afterEach(() => {
    sessionManager.cleanup()
  })

  it('should handle 10 concurrent calls', async () => {
    const result = await runLoadTest(
      'concurrent-calls-10',
      async () => {
        // Simulate creating and terminating a call
        const session = createMockRTCSession()
        sessionManager.addSession(session)
        await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate call duration
        sessionManager.removeSession(session.id)
      },
      {
        iterations: 100,
        concurrency: 10,
      }
    )

    printLoadTestResult(result)

    // Validate results
    expect(result.successfulOperations).toBeGreaterThanOrEqual(95)
    expect(result.operationsPerSecond).toBeGreaterThan(50) // Should handle at least 50 ops/sec
  })

  it('should handle 20 concurrent calls', async () => {
    const result = await runLoadTest(
      'concurrent-calls-20',
      async () => {
        const session = createMockRTCSession()
        sessionManager.addSession(session)
        await new Promise((resolve) => setTimeout(resolve, 10))
        sessionManager.removeSession(session.id)
      },
      {
        iterations: 200,
        concurrency: 20,
      }
    )

    printLoadTestResult(result)

    expect(result.successfulOperations).toBeGreaterThanOrEqual(190)
  })

  it('should handle sustained load for 5 seconds', async () => {
    const result = await runLoadTest(
      'sustained-load',
      async () => {
        const session = createMockRTCSession()
        sessionManager.addSession(session)
        await new Promise((resolve) => setTimeout(resolve, 5))
        sessionManager.removeSession(session.id)
      },
      {
        duration: 5000, // 5 seconds
        concurrency: 5,
      }
    )

    printLoadTestResult(result)

    expect(result.successfulOperations).toBeGreaterThan(0)
    expect(result.totalOperations).toBeGreaterThan(100) // Should complete many operations
  })

  it('should not leak memory under load', async () => {
    await assertNoMemoryLeak(
      async () => {
        const session = createMockRTCSession()
        sessionManager.addSession(session)

        // Emit some events
        eventBus.emit('call:incoming', { sessionId: session.id })
        eventBus.emit('call:accepted', { sessionId: session.id })

        await new Promise((resolve) => setTimeout(resolve, 5))

        eventBus.emit('call:terminated', { sessionId: session.id })
        sessionManager.removeSession(session.id)
      },
      {
        iterations: 200,
        maxLeakMB: 15, // Allow 15MB for temporary allocations
        gcBetweenIterations: true,
      }
    )
  })

  it('should handle rapid call creation and termination', async () => {
    const result = await runLoadTest(
      'rapid-call-churn',
      async () => {
        // Create multiple sessions rapidly
        const sessions = Array.from({ length: 5 }, () => createMockRTCSession())

        sessions.forEach((session) => sessionManager.addSession(session))

        // Immediately terminate them
        sessions.forEach((session) => sessionManager.removeSession(session.id))
      },
      {
        iterations: 100,
        concurrency: 5,
      }
    )

    printLoadTestResult(result)

    expect(result.successfulOperations).toBeGreaterThanOrEqual(95)
  })
})
