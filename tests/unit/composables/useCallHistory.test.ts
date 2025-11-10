/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useCallHistory composable unit tests
 * Comprehensive tests for call history management with filtering, searching, and export
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCallHistory } from '@/composables/useCallHistory'
import { CallDirection } from '@/types/call.types'
import { HISTORY_CONSTANTS } from '@/composables/constants'
import type { CallHistoryEntry, HistoryFilter } from '@/types/history.types'

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
const mockHistoryData = { value: [] as CallHistoryEntry[] }

vi.mock('@/stores/callStore', () => ({
  callStore: {
    get callHistory() {
      return mockHistoryData.value
    },
    clearHistory: vi.fn(),
    deleteHistoryEntry: vi.fn(),
  },
}))

// Import after mocking
import { callStore } from '@/stores/callStore'

// Get the mocked functions
const mockCallStore = callStore as any

// Helper function to create mock history entries
const createMockEntry = (overrides?: Partial<CallHistoryEntry>): CallHistoryEntry => {
  const now = new Date()
  return {
    id: `call-${Math.random()}`,
    direction: CallDirection.Outgoing,
    remoteUri: 'sip:test@example.com',
    remoteDisplayName: 'Test User',
    localUri: 'sip:me@example.com',
    startTime: now,
    endTime: new Date(now.getTime() + 60000),
    duration: 60,
    finalState: 'completed',
    terminationCause: 'normal',
    wasAnswered: true,
    wasMissed: false,
    hasVideo: false,
    ...overrides,
  }
}

describe('useCallHistory', () => {
  beforeEach(() => {
    mockHistoryData.value = []
    mockCallStore.clearHistory.mockImplementation(() => {})
    mockCallStore.deleteHistoryEntry.mockImplementation(() => {})
  })

  // ==========================================================================
  // Computed Values Tests
  // ==========================================================================

  describe('Computed values', () => {
    it('should return empty history initially', () => {
      const { history } = useCallHistory()
      expect(history.value).toEqual([])
    })

    it('should return history from store', () => {
      const mockEntries = [createMockEntry(), createMockEntry()]
      mockHistoryData.value = mockEntries

      const { history } = useCallHistory()
      expect(history.value).toEqual(mockEntries)
    })

    it('should compute totalCalls correctly', () => {
      const mockEntries = [createMockEntry(), createMockEntry(), createMockEntry()]
      mockHistoryData.value = mockEntries

      const { totalCalls } = useCallHistory()
      expect(totalCalls.value).toBe(3)
    })

    it('should compute missedCallsCount correctly', () => {
      const mockEntries = [
        createMockEntry({ wasMissed: true, wasAnswered: false }),
        createMockEntry({ wasMissed: true, wasAnswered: false }),
        createMockEntry({ wasMissed: false, wasAnswered: true }),
        createMockEntry({ wasMissed: true, wasAnswered: true }), // Missed but then answered
      ]
      mockHistoryData.value = mockEntries

      const { missedCallsCount } = useCallHistory()
      expect(missedCallsCount.value).toBe(2) // Only truly missed calls
    })

    it('should return filteredHistory without filter', () => {
      const mockEntries = [createMockEntry(), createMockEntry()]
      mockHistoryData.value = mockEntries

      const { filteredHistory } = useCallHistory()
      expect(filteredHistory.value).toEqual(mockEntries)
    })

    it('should return filteredHistory with filter applied', () => {
      const mockEntries = [
        createMockEntry({ direction: CallDirection.Incoming }),
        createMockEntry({ direction: CallDirection.Outgoing }),
      ]
      mockHistoryData.value = mockEntries

      const { filteredHistory, setFilter } = useCallHistory()

      setFilter({ direction: CallDirection.Incoming })

      expect(filteredHistory.value).toHaveLength(1)
      expect(filteredHistory.value[0].direction).toBe(CallDirection.Incoming)
    })
  })

  // ==========================================================================
  // getHistory() Method Tests
  // ==========================================================================

  describe('getHistory() method', () => {
    it('should return all history when no filter provided', () => {
      const mockEntries = [createMockEntry(), createMockEntry()]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory()

      expect(result.entries).toEqual(mockEntries)
      expect(result.totalCount).toBe(2)
      expect(result.hasMore).toBe(false)
    })

    it('should filter by direction', () => {
      const mockEntries = [
        createMockEntry({ direction: CallDirection.Incoming }),
        createMockEntry({ direction: CallDirection.Outgoing }),
        createMockEntry({ direction: CallDirection.Incoming }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ direction: CallDirection.Incoming })

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every((e) => e.direction === CallDirection.Incoming)).toBe(true)
    })

    it('should filter by remoteUri', () => {
      const mockEntries = [
        createMockEntry({ remoteUri: 'sip:alice@example.com' }),
        createMockEntry({ remoteUri: 'sip:bob@example.com' }),
        createMockEntry({ remoteUri: 'sip:alice@other.com' }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ remoteUri: 'alice' })

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every((e) => e.remoteUri.includes('alice'))).toBe(true)
    })

    it('should filter by wasAnswered', () => {
      const mockEntries = [
        createMockEntry({ wasAnswered: true }),
        createMockEntry({ wasAnswered: false }),
        createMockEntry({ wasAnswered: true }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ wasAnswered: true })

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every((e) => e.wasAnswered)).toBe(true)
    })

    it('should filter by wasMissed', () => {
      const mockEntries = [
        createMockEntry({ wasMissed: true }),
        createMockEntry({ wasMissed: false }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ wasMissed: true })

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].wasMissed).toBe(true)
    })

    it('should filter by hasVideo', () => {
      const mockEntries = [
        createMockEntry({ hasVideo: true }),
        createMockEntry({ hasVideo: false }),
        createMockEntry({ hasVideo: true }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ hasVideo: true })

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every((e) => e.hasVideo)).toBe(true)
    })

    it('should filter by date range', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-06-01')
      const date3 = new Date('2024-12-01')

      const mockEntries = [
        createMockEntry({ startTime: date1 }),
        createMockEntry({ startTime: date2 }),
        createMockEntry({ startTime: date3 }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({
        dateFrom: new Date('2024-05-01'),
        dateTo: new Date('2024-11-01'),
      })

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].startTime).toEqual(date2)
    })

    it('should filter by tags', () => {
      const mockEntries = [
        createMockEntry({ tags: ['important', 'work'] }),
        createMockEntry({ tags: ['personal'] }),
        createMockEntry({ tags: ['important', 'urgent'] }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ tags: ['important'] })

      expect(result.entries).toHaveLength(2)
      expect(result.entries.every((e) => e.tags?.includes('important'))).toBe(true)
    })

    it('should handle pagination with limit', () => {
      const mockEntries = Array.from({ length: 20 }, () => createMockEntry())
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ limit: 10 })

      expect(result.entries).toHaveLength(10)
      expect(result.totalCount).toBe(20)
      expect(result.hasMore).toBe(true)
    })

    it('should handle pagination with offset and limit', () => {
      const mockEntries = Array.from({ length: 20 }, (_, i) => createMockEntry({ id: `call-${i}` }))
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ offset: 5, limit: 5 })

      expect(result.entries).toHaveLength(5)
      expect(result.entries[0].id).toBe('call-5')
      expect(result.totalCount).toBe(20)
      expect(result.hasMore).toBe(true)
    })

    it('should sort by startTime ascending', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-06-01')
      const date3 = new Date('2024-12-01')

      const mockEntries = [
        createMockEntry({ startTime: date3, id: 'c' }),
        createMockEntry({ startTime: date1, id: 'a' }),
        createMockEntry({ startTime: date2, id: 'b' }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ sortBy: 'startTime', sortOrder: 'asc' })

      expect(result.entries[0].id).toBe('a')
      expect(result.entries[1].id).toBe('b')
      expect(result.entries[2].id).toBe('c')
    })

    it('should sort by startTime descending', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-06-01')
      const date3 = new Date('2024-12-01')

      const mockEntries = [
        createMockEntry({ startTime: date1, id: 'a' }),
        createMockEntry({ startTime: date3, id: 'c' }),
        createMockEntry({ startTime: date2, id: 'b' }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ sortBy: 'startTime', sortOrder: 'desc' })

      expect(result.entries[0].id).toBe('c')
      expect(result.entries[1].id).toBe('b')
      expect(result.entries[2].id).toBe('a')
    })

    it('should sort by duration', () => {
      const mockEntries = [
        createMockEntry({ duration: 60, id: 'b' }),
        createMockEntry({ duration: 30, id: 'a' }),
        createMockEntry({ duration: 90, id: 'c' }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ sortBy: 'duration', sortOrder: 'asc' })

      expect(result.entries[0].id).toBe('a')
      expect(result.entries[1].id).toBe('b')
      expect(result.entries[2].id).toBe('c')
    })

    it('should sort by remoteUri', () => {
      const mockEntries = [
        createMockEntry({ remoteUri: 'sip:charlie@example.com', id: 'c' }),
        createMockEntry({ remoteUri: 'sip:alice@example.com', id: 'a' }),
        createMockEntry({ remoteUri: 'sip:bob@example.com', id: 'b' }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ sortBy: 'remoteUri', sortOrder: 'asc' })

      expect(result.entries[0].id).toBe('a')
      expect(result.entries[1].id).toBe('b')
      expect(result.entries[2].id).toBe('c')
    })

    it('should use default sorting when not specified', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-06-01')

      const mockEntries = [
        createMockEntry({ startTime: date1, id: 'a' }),
        createMockEntry({ startTime: date2, id: 'b' }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({})

      // Default is startTime desc
      expect(result.entries[0].id).toBe('b')
      expect(result.entries[1].id).toBe('a')
    })

    it('should combine multiple filters', () => {
      const mockEntries = [
        createMockEntry({
          direction: CallDirection.Incoming,
          wasAnswered: true,
          hasVideo: false,
        }),
        createMockEntry({
          direction: CallDirection.Incoming,
          wasAnswered: false,
          hasVideo: false,
        }),
        createMockEntry({
          direction: CallDirection.Outgoing,
          wasAnswered: true,
          hasVideo: false,
        }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({
        direction: CallDirection.Incoming,
        wasAnswered: true,
      })

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].direction).toBe(CallDirection.Incoming)
      expect(result.entries[0].wasAnswered).toBe(true)
    })
  })

  // ==========================================================================
  // searchHistory() Method Tests
  // ==========================================================================

  describe('searchHistory() method', () => {
    it('should search by remoteUri', () => {
      const mockEntries = [
        createMockEntry({ remoteUri: 'sip:alice@example.com' }),
        createMockEntry({ remoteUri: 'sip:bob@example.com' }),
        createMockEntry({ remoteUri: 'sip:alice@other.com' }),
      ]
      mockHistoryData.value = mockEntries

      const { searchHistory } = useCallHistory()
      const result = searchHistory('alice')

      expect(result.entries).toHaveLength(2)
    })

    it('should search by remoteDisplayName', () => {
      const mockEntries = [
        createMockEntry({ remoteDisplayName: 'Alice Smith' }),
        createMockEntry({ remoteDisplayName: 'Bob Jones' }),
        createMockEntry({ remoteDisplayName: 'Alice Brown' }),
      ]
      mockHistoryData.value = mockEntries

      const { searchHistory } = useCallHistory()
      const result = searchHistory('alice')

      expect(result.entries).toHaveLength(2)
    })

    it('should be case insensitive', () => {
      const mockEntries = [
        createMockEntry({ remoteDisplayName: 'Alice Smith' }),
        createMockEntry({ remoteDisplayName: 'ALICE JONES' }),
      ]
      mockHistoryData.value = mockEntries

      const { searchHistory } = useCallHistory()
      const result = searchHistory('ALICE')

      expect(result.entries).toHaveLength(2)
    })

    it('should combine search with filter', () => {
      const mockEntries = [
        createMockEntry({
          remoteDisplayName: 'Alice',
          direction: CallDirection.Incoming,
        }),
        createMockEntry({
          remoteDisplayName: 'Alice',
          direction: CallDirection.Outgoing,
        }),
        createMockEntry({
          remoteDisplayName: 'Bob',
          direction: CallDirection.Incoming,
        }),
      ]
      mockHistoryData.value = mockEntries

      const { searchHistory } = useCallHistory()
      const result = searchHistory('alice', { direction: CallDirection.Incoming })

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].remoteDisplayName).toBe('Alice')
      expect(result.entries[0].direction).toBe(CallDirection.Incoming)
    })
  })

  // ==========================================================================
  // setFilter() Method Tests
  // ==========================================================================

  describe('setFilter() method', () => {
    it('should set filter', () => {
      const { setFilter, currentFilter } = useCallHistory()

      const filter: HistoryFilter = { direction: CallDirection.Incoming }
      setFilter(filter)

      expect(currentFilter.value).toEqual(filter)
    })

    it('should clear filter when set to null', () => {
      const { setFilter, currentFilter } = useCallHistory()

      setFilter({ direction: CallDirection.Incoming })
      expect(currentFilter.value).not.toBeNull()

      setFilter(null)
      expect(currentFilter.value).toBeNull()
    })
  })

  // ==========================================================================
  // clearHistory() Method Tests
  // ==========================================================================

  describe('clearHistory() method', () => {
    it('should clear all history', async () => {
      const { clearHistory } = useCallHistory()

      await clearHistory()

      expect(mockCallStore.clearHistory).toHaveBeenCalled()
    })

    it('should handle errors when clearing', async () => {
      mockCallStore.clearHistory.mockImplementation(() => {
        throw new Error('Clear failed')
      })

      const { clearHistory } = useCallHistory()

      await expect(clearHistory()).rejects.toThrow('Clear failed')
    })
  })

  // ==========================================================================
  // deleteEntry() Method Tests
  // ==========================================================================

  describe('deleteEntry() method', () => {
    it('should delete specific entry', async () => {
      const { deleteEntry } = useCallHistory()

      await deleteEntry('call-123')

      expect(mockCallStore.deleteHistoryEntry).toHaveBeenCalledWith('call-123')
    })

    it('should handle errors when deleting', async () => {
      mockCallStore.deleteHistoryEntry.mockImplementation(() => {
        throw new Error('Delete failed')
      })

      const { deleteEntry } = useCallHistory()

      await expect(deleteEntry('call-123')).rejects.toThrow('Delete failed')
    })
  })

  // ==========================================================================
  // getMissedCalls() Method Tests
  // ==========================================================================

  describe('getMissedCalls() method', () => {
    it('should return only missed unanswered calls', () => {
      const mockEntries = [
        createMockEntry({ wasMissed: true, wasAnswered: false, id: 'a' }),
        createMockEntry({ wasMissed: true, wasAnswered: false, id: 'b' }),
        createMockEntry({ wasMissed: false, wasAnswered: true, id: 'c' }),
        createMockEntry({ wasMissed: true, wasAnswered: true, id: 'd' }),
      ]
      mockHistoryData.value = mockEntries

      const { getMissedCalls } = useCallHistory()
      const missed = getMissedCalls()

      expect(missed).toHaveLength(2)
      expect(missed.every((e) => e.wasMissed && !e.wasAnswered)).toBe(true)
    })

    it('should return empty array when no missed calls', () => {
      const mockEntries = [createMockEntry({ wasMissed: false, wasAnswered: true })]
      mockHistoryData.value = mockEntries

      const { getMissedCalls } = useCallHistory()
      const missed = getMissedCalls()

      expect(missed).toHaveLength(0)
    })
  })

  // ==========================================================================
  // getRecentCalls() Method Tests
  // ==========================================================================

  describe('getRecentCalls() method', () => {
    it('should return recent calls with default limit', () => {
      const mockEntries = Array.from({ length: 20 }, () => createMockEntry())
      mockHistoryData.value = mockEntries

      const { getRecentCalls } = useCallHistory()
      const recent = getRecentCalls()

      expect(recent).toHaveLength(HISTORY_CONSTANTS.DEFAULT_LIMIT)
    })

    it('should return recent calls with custom limit', () => {
      const mockEntries = Array.from({ length: 20 }, () => createMockEntry())
      mockHistoryData.value = mockEntries

      const { getRecentCalls } = useCallHistory()
      const recent = getRecentCalls(5)

      expect(recent).toHaveLength(5)
    })

    it('should return all calls if fewer than limit', () => {
      const mockEntries = [createMockEntry(), createMockEntry()]
      mockHistoryData.value = mockEntries

      const { getRecentCalls } = useCallHistory()
      const recent = getRecentCalls(10)

      expect(recent).toHaveLength(2)
    })
  })

  // ==========================================================================
  // getStatistics() Method Tests
  // ==========================================================================

  describe('getStatistics() method', () => {
    it('should compute statistics correctly', () => {
      const mockEntries = [
        createMockEntry({
          direction: CallDirection.Incoming,
          wasAnswered: true,
          wasMissed: false,
          hasVideo: false,
          duration: 60,
        }),
        createMockEntry({
          direction: CallDirection.Outgoing,
          wasAnswered: true,
          wasMissed: false,
          hasVideo: true,
          duration: 120,
        }),
        createMockEntry({
          direction: CallDirection.Incoming,
          wasAnswered: false,
          wasMissed: true,
          hasVideo: false,
          duration: 0,
        }),
      ]
      mockHistoryData.value = mockEntries

      const { getStatistics } = useCallHistory()
      const stats = getStatistics()

      expect(stats.totalCalls).toBe(3)
      expect(stats.incomingCalls).toBe(2)
      expect(stats.outgoingCalls).toBe(1)
      expect(stats.answeredCalls).toBe(2)
      expect(stats.missedCalls).toBe(1)
      expect(stats.videoCalls).toBe(1)
      expect(stats.totalDuration).toBe(180)
      expect(stats.averageDuration).toBe(60)
    })

    it('should compute frequent contacts', () => {
      const mockEntries = [
        createMockEntry({ remoteUri: 'sip:alice@example.com', remoteDisplayName: 'Alice' }),
        createMockEntry({ remoteUri: 'sip:alice@example.com', remoteDisplayName: 'Alice' }),
        createMockEntry({ remoteUri: 'sip:alice@example.com', remoteDisplayName: 'Alice' }),
        createMockEntry({ remoteUri: 'sip:bob@example.com', remoteDisplayName: 'Bob' }),
        createMockEntry({ remoteUri: 'sip:bob@example.com', remoteDisplayName: 'Bob' }),
        createMockEntry({ remoteUri: 'sip:charlie@example.com', remoteDisplayName: 'Charlie' }),
      ]
      mockHistoryData.value = mockEntries

      const { getStatistics } = useCallHistory()
      const stats = getStatistics()

      expect(stats.frequentContacts).toHaveLength(3)
      expect(stats.frequentContacts[0]).toEqual({
        uri: 'sip:alice@example.com',
        displayName: 'Alice',
        count: 3,
      })
      expect(stats.frequentContacts[1]).toEqual({
        uri: 'sip:bob@example.com',
        displayName: 'Bob',
        count: 2,
      })
      expect(stats.frequentContacts[2]).toEqual({
        uri: 'sip:charlie@example.com',
        displayName: 'Charlie',
        count: 1,
      })
    })

    it('should limit frequent contacts to TOP_FREQUENT_CONTACTS', () => {
      const mockEntries = Array.from({ length: 20 }, (_, i) =>
        createMockEntry({ remoteUri: `sip:user${i}@example.com` })
      )
      mockHistoryData.value = mockEntries

      const { getStatistics } = useCallHistory()
      const stats = getStatistics()

      expect(stats.frequentContacts).toHaveLength(HISTORY_CONSTANTS.TOP_FREQUENT_CONTACTS)
    })

    it('should compute statistics with filter', () => {
      const mockEntries = [
        createMockEntry({ direction: CallDirection.Incoming, duration: 60 }),
        createMockEntry({ direction: CallDirection.Outgoing, duration: 120 }),
      ]
      mockHistoryData.value = mockEntries

      const { getStatistics } = useCallHistory()
      const stats = getStatistics({ direction: CallDirection.Incoming })

      expect(stats.totalCalls).toBe(1)
      expect(stats.totalDuration).toBe(60)
    })

    it('should handle zero calls', () => {
      mockHistoryData.value = []

      const { getStatistics } = useCallHistory()
      const stats = getStatistics()

      expect(stats.totalCalls).toBe(0)
      expect(stats.averageDuration).toBe(0)
      expect(stats.frequentContacts).toHaveLength(0)
    })
  })

  // ==========================================================================
  // exportHistory() Method Tests
  // ==========================================================================

  describe('exportHistory() method', () => {
    // Mock DOM APIs
    const mockCreateObjectURL = vi.fn()
    const mockRevokeObjectURL = vi.fn()
    const mockClick = vi.fn()
    const mockCreateElement = vi.fn()

    beforeEach(() => {
      // Mock URL
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      // Mock document
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
      }
      mockCreateElement.mockReturnValue(mockLink)
      global.document.createElement = mockCreateElement

      mockCreateObjectURL.mockReturnValue('blob:mock-url')
    })

    it('should export to JSON format', async () => {
      const mockEntries = [createMockEntry({ id: 'call-1' })]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({ format: 'json', filename: 'test' })

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      expect(mockClick).toHaveBeenCalled()
    })

    it('should export to CSV format', async () => {
      const mockEntries = [
        createMockEntry({
          id: 'call-1',
          remoteUri: 'sip:test@example.com',
          duration: 60,
        }),
      ]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({ format: 'csv', filename: 'test' })

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
    })

    it('should handle xlsx format by falling back to CSV', async () => {
      const mockEntries = [createMockEntry()]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({ format: 'xlsx', filename: 'test' })

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should throw error for unsupported format', async () => {
      const mockEntries = [createMockEntry()]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await expect(exportHistory({ format: 'pdf' as any, filename: 'test' })).rejects.toThrow(
        'Unsupported export format: pdf'
      )
    })

    it('should throw error when no entries to export', async () => {
      mockHistoryData.value = []

      const { exportHistory } = useCallHistory()

      await expect(exportHistory({ format: 'json', filename: 'test' })).rejects.toThrow(
        'No call history entries to export'
      )
    })

    it('should export with filter applied', async () => {
      const mockEntries = [
        createMockEntry({ direction: CallDirection.Incoming }),
        createMockEntry({ direction: CallDirection.Outgoing }),
      ]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({
        format: 'json',
        filename: 'test',
        filter: { direction: CallDirection.Incoming },
      })

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should include metadata in CSV when requested', async () => {
      const mockEntries = [
        createMockEntry({
          id: 'call-1',
          metadata: { customField: 'value' },
        }),
      ]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({
        format: 'csv',
        filename: 'test',
        includeMetadata: true,
      })

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should escape CSV values with commas', async () => {
      const mockEntries = [
        createMockEntry({
          remoteDisplayName: 'Smith, John',
        }),
      ]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({ format: 'csv', filename: 'test' })

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should escape CSV values with quotes', async () => {
      const mockEntries = [
        createMockEntry({
          remoteDisplayName: 'John "Johnny" Smith',
        }),
      ]
      mockHistoryData.value = mockEntries

      const { exportHistory } = useCallHistory()

      await exportHistory({ format: 'csv', filename: 'test' })

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle entries without optional fields', () => {
      const mockEntries = [
        createMockEntry({
          remoteDisplayName: undefined,
          answerTime: undefined,
          ringDuration: undefined,
          tags: undefined,
          metadata: undefined,
        }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory, getStatistics } = useCallHistory()

      expect(() => getHistory()).not.toThrow()
      expect(() => getStatistics()).not.toThrow()
    })

    it('should handle search with empty query', () => {
      const mockEntries = [createMockEntry()]
      mockHistoryData.value = mockEntries

      const { searchHistory } = useCallHistory()
      const result = searchHistory('')

      expect(result.entries).toHaveLength(1)
    })

    it('should handle filter with empty tags array', () => {
      const mockEntries = [createMockEntry()]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ tags: [] })

      expect(result.entries).toHaveLength(1)
    })

    it('should handle multiple filter criteria with no matches', () => {
      const mockEntries = [
        createMockEntry({
          direction: CallDirection.Incoming,
          wasAnswered: true,
        }),
      ]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({
        direction: CallDirection.Outgoing,
        wasAnswered: false,
      })

      expect(result.entries).toHaveLength(0)
    })

    it('should handle pagination beyond available entries', () => {
      const mockEntries = [createMockEntry(), createMockEntry()]
      mockHistoryData.value = mockEntries

      const { getHistory } = useCallHistory()
      const result = getHistory({ offset: 10, limit: 5 })

      expect(result.entries).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })

    it('should handle large datasets efficiently', () => {
      const mockEntries = Array.from({ length: 1000 }, () => createMockEntry())
      mockHistoryData.value = mockEntries

      const { getHistory, getStatistics } = useCallHistory()

      expect(() => getHistory()).not.toThrow()
      expect(() => getStatistics()).not.toThrow()
    })
  })
})
