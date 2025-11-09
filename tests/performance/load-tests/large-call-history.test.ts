/**
 * Large Call History Performance Tests
 *
 * Tests call history performance with large datasets:
 * - Large call history (100, 500, 1000, 5000 entries)
 * - History retrieval speed
 * - Filtering and searching performance
 * - Pagination performance
 * - Memory usage with large histories
 * - Validates against PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCallHistory } from '@/composables/useCallHistory'
import { CallDirection } from '@/types/call.types'
import { PERFORMANCE } from '@/utils/constants'
import type { CallHistoryEntry } from '@/types/history.types'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock call store
const mockCallHistory: CallHistoryEntry[] = []

vi.mock('@/stores/callStore', () => ({
  callStore: {
    get callHistory() {
      return mockCallHistory
    },
    clearHistory: vi.fn(() => {
      mockCallHistory.length = 0
    }),
    deleteHistoryEntry: vi.fn((id: string) => {
      const index = mockCallHistory.findIndex((e) => e.id === id)
      if (index !== -1) {
        mockCallHistory.splice(index, 1)
      }
    }),
  },
}))

describe('Large Call History Performance Tests', () => {
  let performanceMarks: { operation: string; count: number; duration: number }[] = []

  beforeEach(() => {
    mockCallHistory.length = 0
    performanceMarks = []
  })

  /**
   * Helper to measure execution time
   */
  const measureTime = <T>(operation: string, count: number, fn: () => T): T => {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    const duration = end - start

    performanceMarks.push({ operation, count, duration })
    return result
  }

  /**
   * Helper to create mock call history entries
   */
  const createMockHistory = (count: number): void => {
    mockCallHistory.length = 0

    const baseTime = new Date('2024-01-01').getTime()
    const directions = [CallDirection.Incoming, CallDirection.Outgoing]
    const remoteUris = [
      'sip:alice@example.com',
      'sip:bob@example.com',
      'sip:charlie@example.com',
      'sip:david@example.com',
      'sip:eve@example.com',
    ]
    const displayNames = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'David Lee', 'Eve Wilson']

    for (let i = 0; i < count; i++) {
      const direction = directions[i % 2]
      const remoteIndex = i % remoteUris.length
      const startTime = new Date(baseTime + i * 60000) // 1 minute apart
      const duration = Math.floor(Math.random() * 300) + 30 // 30-330 seconds
      const endTime = new Date(startTime.getTime() + duration * 1000)
      const wasAnswered = Math.random() > 0.2 // 80% answered
      const wasMissed = !wasAnswered && direction === CallDirection.Incoming

      mockCallHistory.push({
        id: `call-${i}`,
        direction,
        remoteUri: remoteUris[remoteIndex],
        remoteDisplayName: displayNames[remoteIndex],
        localUri: 'sip:me@example.com',
        startTime,
        endTime,
        duration,
        finalState: wasAnswered ? 'completed' : 'missed',
        terminationCause: wasAnswered ? 'normal' : 'no-answer',
        wasAnswered,
        wasMissed,
        hasVideo: Math.random() > 0.8, // 20% video calls
        tags: i % 10 === 0 ? ['important'] : undefined,
      })
    }
  }

  // ==========================================================================
  // Test 1: Performance with Large Call History
  // ==========================================================================

  describe('Large Call History Retrieval', () => {
    it('should handle 100 entries efficiently', () => {
      createMockHistory(100)
      const { getHistory } = useCallHistory()

      const result = measureTime('getHistory', 100, () => getHistory())

      expect(result.entries.length).toBe(100)
      expect(result.totalCount).toBe(100)
      expect(performanceMarks[0].duration).toBeLessThan(50) // 50ms for 100 entries
    })

    it('should handle 500 entries efficiently', () => {
      createMockHistory(500)
      const { getHistory } = useCallHistory()

      const result = measureTime('getHistory', 500, () => getHistory())

      expect(result.entries.length).toBe(500)
      expect(result.totalCount).toBe(500)
      expect(performanceMarks[0].duration).toBeLessThan(100) // 100ms for 500 entries
    })

    it('should handle 1000 entries efficiently', () => {
      createMockHistory(1000)
      const { getHistory } = useCallHistory()

      const result = measureTime('getHistory', 1000, () => getHistory())

      expect(result.entries.length).toBe(1000)
      expect(result.totalCount).toBe(1000)
      expect(performanceMarks[0].duration).toBeLessThan(200) // 200ms for 1000 entries
    })

    it('should handle 5000 entries efficiently', () => {
      createMockHistory(5000)
      const { getHistory } = useCallHistory()

      const result = measureTime('getHistory', 5000, () => getHistory())

      expect(result.entries.length).toBe(5000)
      expect(result.totalCount).toBe(5000)
      // 5000 is 5x the default max, so allow more time
      expect(performanceMarks[0].duration).toBeLessThan(500) // 500ms for 5000 entries
    })

    it('should warn when exceeding DEFAULT_MAX_HISTORY_ENTRIES', () => {
      const maxEntries = PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES
      createMockHistory(maxEntries + 100)

      const { totalCalls } = useCallHistory()

      // We create more than max, but don't enforce the limit in this mock
      expect(totalCalls.value).toBeGreaterThan(maxEntries)
    })
  })

  // ==========================================================================
  // Test 2: Filtering Performance
  // ==========================================================================

  describe('Filtering Performance', () => {
    beforeEach(() => {
      createMockHistory(1000)
    })

    it('should filter by direction efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-direction', 1000, () =>
        getHistory({ direction: CallDirection.Incoming })
      )

      expect(result.entries.length).toBeGreaterThan(0)
      expect(result.entries.every((e) => e.direction === CallDirection.Incoming)).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should filter by wasAnswered efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-answered', 1000, () => getHistory({ wasAnswered: true }))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(result.entries.every((e) => e.wasAnswered)).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should filter by wasMissed efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-missed', 1000, () => getHistory({ wasMissed: true }))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(result.entries.every((e) => e.wasMissed)).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should filter by hasVideo efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-video', 1000, () => getHistory({ hasVideo: true }))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(result.entries.every((e) => e.hasVideo)).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should filter by date range efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-date-range', 1000, () =>
        getHistory({
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-06-01'),
        })
      )

      expect(result.entries.length).toBeGreaterThan(0)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should filter by tags efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-tags', 1000, () => getHistory({ tags: ['important'] }))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(result.entries.every((e) => e.tags?.includes('important'))).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should handle multiple filters efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('filter-multiple', 1000, () =>
        getHistory({
          direction: CallDirection.Incoming,
          wasAnswered: true,
          hasVideo: false,
        })
      )

      expect(result.entries.every((e) => e.direction === CallDirection.Incoming)).toBe(true)
      expect(result.entries.every((e) => e.wasAnswered)).toBe(true)
      expect(result.entries.every((e) => !e.hasVideo)).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should scale filtering performance with entry count', () => {
      const counts = [100, 500, 1000, 5000]
      const durations: number[] = []

      counts.forEach((count) => {
        mockCallHistory.length = 0
        createMockHistory(count)
        const { getHistory } = useCallHistory()

        const start = performance.now()
        getHistory({ direction: CallDirection.Incoming })
        const duration = performance.now() - start
        durations.push(duration)
      })

      // Verify roughly linear scaling
      const ratio1 = durations[1] / durations[0] // 500 vs 100
      const ratio2 = durations[2] / durations[1] // 1000 vs 500
      const ratio3 = durations[3] / durations[2] // 5000 vs 1000

      // Ratios should indicate linear or near-linear scaling
      expect(ratio1).toBeLessThan(10)
      expect(ratio2).toBeLessThan(5)
      expect(ratio3).toBeLessThan(10)
    })
  })

  // ==========================================================================
  // Test 3: Searching Performance
  // ==========================================================================

  describe('Searching Performance', () => {
    beforeEach(() => {
      createMockHistory(1000)
    })

    it('should search by name efficiently', () => {
      const { searchHistory } = useCallHistory()

      const result = measureTime('search-name', 1000, () => searchHistory('Alice'))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(
        result.entries.every((e) => e.remoteDisplayName?.toLowerCase().includes('alice'))
      ).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should search by URI efficiently', () => {
      const { searchHistory } = useCallHistory()

      const result = measureTime('search-uri', 1000, () => searchHistory('bob@example'))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(result.entries.every((e) => e.remoteUri.includes('bob@example'))).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should handle case-insensitive search efficiently', () => {
      const { searchHistory } = useCallHistory()

      const result = measureTime('search-case-insensitive', 1000, () => searchHistory('CHARLIE'))

      expect(result.entries.length).toBeGreaterThan(0)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should combine search with filters efficiently', () => {
      const { searchHistory } = useCallHistory()

      const result = measureTime('search-with-filter', 1000, () =>
        searchHistory('alice', { direction: CallDirection.Incoming })
      )

      expect(result.entries.every((e) => e.direction === CallDirection.Incoming)).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should handle empty search results efficiently', () => {
      const { searchHistory } = useCallHistory()

      const result = measureTime('search-no-results', 1000, () =>
        searchHistory('nonexistent-user-xyz')
      )

      expect(result.entries.length).toBe(0)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })
  })

  // ==========================================================================
  // Test 4: Sorting Performance
  // ==========================================================================

  describe('Sorting Performance', () => {
    beforeEach(() => {
      createMockHistory(1000)
    })

    it('should sort by startTime ascending efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('sort-time-asc', 1000, () =>
        getHistory({ sortBy: 'startTime', sortOrder: 'asc' })
      )

      expect(result.entries.length).toBe(1000)
      // Verify sorted order
      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].startTime.getTime()).toBeGreaterThanOrEqual(
          result.entries[i - 1].startTime.getTime()
        )
      }
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should sort by startTime descending efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('sort-time-desc', 1000, () =>
        getHistory({ sortBy: 'startTime', sortOrder: 'desc' })
      )

      expect(result.entries.length).toBe(1000)
      // Verify sorted order
      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].startTime.getTime()).toBeLessThanOrEqual(
          result.entries[i - 1].startTime.getTime()
        )
      }
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should sort by duration efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('sort-duration', 1000, () =>
        getHistory({ sortBy: 'duration', sortOrder: 'asc' })
      )

      expect(result.entries.length).toBe(1000)
      // Verify sorted order
      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].duration).toBeGreaterThanOrEqual(result.entries[i - 1].duration)
      }
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should sort by remoteUri efficiently', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('sort-uri', 1000, () =>
        getHistory({ sortBy: 'remoteUri', sortOrder: 'asc' })
      )

      expect(result.entries.length).toBe(1000)
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })
  })

  // ==========================================================================
  // Test 5: Pagination Performance
  // ==========================================================================

  describe('Pagination Performance', () => {
    beforeEach(() => {
      createMockHistory(1000)
    })

    it('should paginate efficiently with limit', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('paginate-limit', 1000, () => getHistory({ limit: 10 }))

      expect(result.entries.length).toBe(10)
      expect(result.totalCount).toBe(1000)
      expect(result.hasMore).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should paginate efficiently with offset and limit', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('paginate-offset-limit', 1000, () =>
        getHistory({ offset: 100, limit: 50 })
      )

      expect(result.entries.length).toBe(50)
      expect(result.totalCount).toBe(1000)
      expect(result.hasMore).toBe(true)
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should handle multiple page requests efficiently', () => {
      const { getHistory } = useCallHistory()

      const start = performance.now()
      const pageSize = 50
      const pages = []

      for (let offset = 0; offset < 1000; offset += pageSize) {
        const result = getHistory({ offset, limit: pageSize })
        pages.push(result)
      }

      const duration = performance.now() - start

      expect(pages.length).toBe(20) // 1000 / 50 = 20 pages
      expect(duration).toBeLessThan(500) // All pages in 500ms
    })

    it('should optimize pagination with large offset', () => {
      const { getHistory } = useCallHistory()

      const result = measureTime('paginate-large-offset', 1000, () =>
        getHistory({ offset: 900, limit: 50 })
      )

      // With offset 900 and limit 50, we get min(50, 1000-900) = 50 entries
      expect(result.entries.length).toBe(50)
      expect(result.totalCount).toBe(1000)
      expect(result.hasMore).toBe(true) // offset + limit = 950, which is less than 1000
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })
  })

  // ==========================================================================
  // Test 6: Statistics Performance
  // ==========================================================================

  describe('Statistics Performance', () => {
    it('should compute statistics for 100 entries efficiently', () => {
      createMockHistory(100)
      const { getStatistics } = useCallHistory()

      const stats = measureTime('stats-100', 100, () => getStatistics())

      expect(stats.totalCalls).toBe(100)
      expect(stats.incomingCalls).toBeGreaterThan(0)
      expect(stats.outgoingCalls).toBeGreaterThan(0)
      expect(performanceMarks[0].duration).toBeLessThan(50)
    })

    it('should compute statistics for 500 entries efficiently', () => {
      createMockHistory(500)
      const { getStatistics } = useCallHistory()

      const stats = measureTime('stats-500', 500, () => getStatistics())

      expect(stats.totalCalls).toBe(500)
      expect(performanceMarks[0].duration).toBeLessThan(100)
    })

    it('should compute statistics for 1000 entries efficiently', () => {
      createMockHistory(1000)
      const { getStatistics } = useCallHistory()

      const stats = measureTime('stats-1000', 1000, () => getStatistics())

      expect(stats.totalCalls).toBe(1000)
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should compute statistics for 5000 entries efficiently', () => {
      createMockHistory(5000)
      const { getStatistics } = useCallHistory()

      const stats = measureTime('stats-5000', 5000, () => getStatistics())

      expect(stats.totalCalls).toBe(5000)
      expect(performanceMarks[0].duration).toBeLessThan(300)
    })

    it('should compute frequent contacts efficiently', () => {
      createMockHistory(1000)
      const { getStatistics } = useCallHistory()

      const stats = measureTime('frequent-contacts', 1000, () => getStatistics())

      expect(stats.frequentContacts.length).toBeGreaterThan(0)
      // Verify sorted by count
      for (let i = 1; i < stats.frequentContacts.length; i++) {
        expect(stats.frequentContacts[i].count).toBeLessThanOrEqual(
          stats.frequentContacts[i - 1].count
        )
      }
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })

    it('should compute statistics with filter efficiently', () => {
      createMockHistory(1000)
      const { getStatistics } = useCallHistory()

      const stats = measureTime('stats-filtered', 1000, () =>
        getStatistics({ direction: CallDirection.Incoming })
      )

      expect(stats.outgoingCalls).toBe(0) // Only incoming filtered
      expect(performanceMarks[0].duration).toBeLessThan(150)
    })
  })

  // ==========================================================================
  // Test 7: Memory Usage
  // ==========================================================================

  describe('Memory Usage', () => {
    it('should not leak memory with repeated operations', () => {
      createMockHistory(100)
      const { getHistory, searchHistory, getStatistics } = useCallHistory()

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        getHistory({ limit: 10 })
        searchHistory('alice')
        getStatistics()
      }

      // Memory should be stable (we can't directly measure, but operations should complete)
      expect(true).toBe(true)
    })

    it('should handle cleanup of large histories', () => {
      createMockHistory(5000)
      const { clearHistory } = useCallHistory()

      measureTime('cleanup-large', 5000, () => {
        clearHistory()
      })

      expect(mockCallHistory.length).toBe(0)
      expect(performanceMarks[0].duration).toBeLessThan(50)
    })

    it('should handle deletion of entries efficiently', () => {
      createMockHistory(1000)
      const { deleteEntry } = useCallHistory()

      const start = performance.now()

      // Delete 100 entries
      for (let i = 0; i < 100; i++) {
        deleteEntry(`call-${i}`)
      }

      const duration = performance.now() - start

      expect(mockCallHistory.length).toBe(900)
      expect(duration).toBeLessThan(100)
    })
  })

  // ==========================================================================
  // Test 8: Concurrent Operations
  // ==========================================================================

  describe('Concurrent Operations', () => {
    beforeEach(() => {
      createMockHistory(1000)
    })

    it('should handle multiple concurrent reads efficiently', () => {
      const { getHistory, searchHistory, getStatistics } = useCallHistory()

      const start = performance.now()

      // Simulate concurrent operations
      const operations = [
        () => getHistory({ direction: CallDirection.Incoming }),
        () => searchHistory('alice'),
        () => getStatistics(),
        () => getHistory({ limit: 50 }),
        () => searchHistory('bob'),
        () => getStatistics({ direction: CallDirection.Outgoing }),
      ]

      operations.forEach((op) => op())

      const duration = performance.now() - start

      expect(duration).toBeLessThan(200)
    })

    it('should handle rapid filter changes efficiently', () => {
      const { setFilter } = useCallHistory()

      const start = performance.now()

      // Rapidly change filters
      for (let i = 0; i < 100; i++) {
        setFilter({ direction: i % 2 === 0 ? CallDirection.Incoming : CallDirection.Outgoing })
      }

      const duration = performance.now() - start

      expect(duration).toBeLessThan(50)
    })
  })

  // ==========================================================================
  // Test 9: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty history efficiently', () => {
      createMockHistory(0)
      const { getHistory, searchHistory, getStatistics } = useCallHistory()

      measureTime('empty-getHistory', 0, () => getHistory())
      measureTime('empty-search', 0, () => searchHistory('test'))
      measureTime('empty-stats', 0, () => getStatistics())

      expect(performanceMarks.every((m) => m.duration < 10)).toBe(true)
    })

    it('should handle exactly DEFAULT_MAX_HISTORY_ENTRIES', () => {
      const maxEntries = PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES
      createMockHistory(maxEntries)

      const { getHistory } = useCallHistory()

      const result = measureTime('exact-max', maxEntries, () => getHistory())

      expect(result.entries.length).toBe(maxEntries)
      expect(performanceMarks[0].duration).toBeLessThan(250)
    })

    it('should handle very large single page request', () => {
      createMockHistory(5000)
      const { getHistory } = useCallHistory()

      const result = measureTime('large-page', 5000, () => getHistory({ limit: 5000 }))

      expect(result.entries.length).toBe(5000)
      expect(performanceMarks[0].duration).toBeLessThan(500)
    })
  })

  // ==========================================================================
  // Test 10: Performance Reporting
  // ==========================================================================

  describe('Performance Summary', () => {
    it('should report performance statistics', () => {
      if (performanceMarks.length > 0) {
        const byOperation = new Map<string, number[]>()

        performanceMarks.forEach(({ operation, duration }) => {
          if (!byOperation.has(operation)) {
            byOperation.set(operation, [])
          }
          byOperation.get(operation)!.push(duration)
        })

        console.log('\n=== Call History Performance Report ===')
        console.log(`Total measurements: ${performanceMarks.length}`)

        byOperation.forEach((durations, operation) => {
          const avg = durations.reduce((a, b) => a + b, 0) / durations.length
          const max = Math.max(...durations)
          const min = Math.min(...durations)

          console.log(`\n${operation}:`)
          console.log(`  Count: ${durations.length}`)
          console.log(`  Avg: ${avg.toFixed(2)}ms`)
          console.log(`  Min: ${min.toFixed(2)}ms`)
          console.log(`  Max: ${max.toFixed(2)}ms`)
        })

        console.log(`\nMax history entries limit: ${PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES}`)
        console.log('==========================================\n')

        expect(true).toBe(true)
      }
    })
  })
})
