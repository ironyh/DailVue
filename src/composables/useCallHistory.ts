/**
 * Call History Composable
 *
 * Provides reactive call history management with filtering, searching,
 * export functionality, and persistence to IndexedDB.
 *
 * @module composables/useCallHistory
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { callStore } from '../stores/callStore'
import type {
  CallHistoryEntry,
  HistoryFilter,
  HistorySearchResult,
  HistoryStatistics,
  HistoryExportFormat,
  HistoryExportOptions,
} from '../types/history.types'
import { CallDirection } from '../types/call.types'
import { HISTORY_CONSTANTS } from './constants'
import { createLogger } from '../utils/logger'

const log = createLogger('useCallHistory')

/**
 * Return type for useCallHistory composable
 */
export interface UseCallHistoryReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** All call history entries */
  history: ComputedRef<CallHistoryEntry[]>
  /** Filtered history entries */
  filteredHistory: ComputedRef<CallHistoryEntry[]>
  /** Total number of calls in history */
  totalCalls: ComputedRef<number>
  /** Total number of missed calls */
  missedCallsCount: ComputedRef<number>
  /** Current filter */
  currentFilter: Ref<HistoryFilter | null>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Get history with optional filter */
  getHistory: (filter?: HistoryFilter) => HistorySearchResult
  /** Search history by query */
  searchHistory: (query: string, filter?: HistoryFilter) => HistorySearchResult
  /** Clear all history */
  clearHistory: () => Promise<void>
  /** Delete a specific entry */
  deleteEntry: (entryId: string) => Promise<void>
  /** Export history to file */
  exportHistory: (options: HistoryExportOptions) => Promise<void>
  /** Get history statistics */
  getStatistics: (filter?: HistoryFilter) => HistoryStatistics
  /** Set current filter */
  setFilter: (filter: HistoryFilter | null) => void
  /** Get missed calls only */
  getMissedCalls: () => CallHistoryEntry[]
  /** Get recent calls (last N) */
  getRecentCalls: (limit?: number) => CallHistoryEntry[]
}

/**
 * Call History Composable
 *
 * Manages call history with reactive state, filtering, searching, and export.
 * Automatically persists history to IndexedDB for long-term storage.
 *
 * @returns Call history state and methods
 *
 * @example
 * ```typescript
 * const {
 *   history,
 *   filteredHistory,
 *   searchHistory,
 *   exportHistory,
 *   getStatistics
 * } = useCallHistory()
 *
 * // Search history
 * const results = searchHistory('john')
 *
 * // Get statistics
 * const stats = getStatistics()
 * console.log(`Total calls: ${stats.totalCalls}`)
 *
 * // Export to CSV
 * await exportHistory({ format: 'csv', filename: 'my-calls' })
 * ```
 */
export function useCallHistory(): UseCallHistoryReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  const currentFilter = ref<HistoryFilter | null>(null)

  // ============================================================================
  // Computed Values
  // ============================================================================

  const history = computed(() => callStore.getCallHistory())

  const filteredHistory = computed(() => {
    if (!currentFilter.value) {
      return history.value
    }
    return applyFilter(history.value, currentFilter.value).entries
  })

  const totalCalls = computed(() => history.value.length)

  const missedCallsCount = computed(() =>
    history.value.filter((entry) => entry.wasMissed && !entry.wasAnswered).length
  )

  // ============================================================================
  // Filter and Search Logic
  // ============================================================================

  /**
   * Apply filter to history entries
   */
  const applyFilter = (
    entries: CallHistoryEntry[],
    filter: HistoryFilter
  ): HistorySearchResult => {
    let filtered = [...entries]

    // Filter by direction
    if (filter.direction !== undefined) {
      filtered = filtered.filter((entry) => entry.direction === filter.direction)
    }

    // Filter by remote URI
    if (filter.remoteUri) {
      filtered = filtered.filter((entry) => entry.remoteUri.includes(filter.remoteUri!))
    }

    // Filter by answered
    if (filter.wasAnswered !== undefined) {
      filtered = filtered.filter((entry) => entry.wasAnswered === filter.wasAnswered)
    }

    // Filter by missed
    if (filter.wasMissed !== undefined) {
      filtered = filtered.filter((entry) => entry.wasMissed === filter.wasMissed)
    }

    // Filter by video
    if (filter.hasVideo !== undefined) {
      filtered = filtered.filter((entry) => entry.hasVideo === filter.hasVideo)
    }

    // Filter by date range
    if (filter.dateFrom) {
      filtered = filtered.filter((entry) => entry.startTime >= filter.dateFrom!)
    }
    if (filter.dateTo) {
      filtered = filtered.filter((entry) => entry.startTime <= filter.dateTo!)
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((entry) =>
        filter.tags!.some((tag) => entry.tags?.includes(tag))
      )
    }

    // Search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      filtered = filtered.filter(
        (entry) =>
          entry.remoteUri.toLowerCase().includes(query) ||
          entry.remoteDisplayName?.toLowerCase().includes(query)
      )
    }

    // Sort
    const sortBy = filter.sortBy || HISTORY_CONSTANTS.DEFAULT_SORT_BY
    const sortOrder = filter.sortOrder || HISTORY_CONSTANTS.DEFAULT_SORT_ORDER

    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'startTime':
          comparison = a.startTime.getTime() - b.startTime.getTime()
          break
        case 'duration':
          comparison = a.duration - b.duration
          break
        case 'remoteUri':
          comparison = a.remoteUri.localeCompare(b.remoteUri)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    // Total count before pagination
    const totalCount = filtered.length

    // Pagination
    const offset = filter.offset || 0
    const limit = filter.limit

    if (limit !== undefined) {
      filtered = filtered.slice(offset, offset + limit)
    }

    return {
      entries: filtered,
      totalCount,
      hasMore: limit !== undefined && offset + limit < totalCount,
    }
  }

  /**
   * Get history with optional filter
   */
  const getHistory = (filter?: HistoryFilter): HistorySearchResult => {
    const entries = history.value

    if (!filter) {
      return {
        entries,
        totalCount: entries.length,
        hasMore: false,
      }
    }

    return applyFilter(entries, filter)
  }

  /**
   * Search history by query
   */
  const searchHistory = (query: string, filter?: HistoryFilter): HistorySearchResult => {
    log.debug(`Searching history with query: "${query}"`)

    const searchFilter: HistoryFilter = {
      ...filter,
      searchQuery: query,
    }

    return applyFilter(history.value, searchFilter)
  }

  /**
   * Set current filter
   */
  const setFilter = (filter: HistoryFilter | null): void => {
    currentFilter.value = filter
    log.debug('Filter updated:', filter)
  }

  // ============================================================================
  // History Management
  // ============================================================================

  /**
   * Clear all history
   */
  const clearHistory = async (): Promise<void> => {
    try {
      log.info('Clearing all call history')
      callStore.clearCallHistory()
      log.info('Call history cleared successfully')
    } catch (error) {
      log.error('Failed to clear history:', error)
      throw error
    }
  }

  /**
   * Delete a specific entry
   */
  const deleteEntry = async (entryId: string): Promise<void> => {
    try {
      log.debug(`Deleting history entry: ${entryId}`)
      callStore.removeHistoryEntry(entryId)
      log.info(`History entry ${entryId} deleted successfully`)
    } catch (error) {
      log.error(`Failed to delete entry ${entryId}:`, error)
      throw error
    }
  }

  /**
   * Get missed calls only
   */
  const getMissedCalls = (): CallHistoryEntry[] => {
    return history.value.filter((entry) => entry.wasMissed && !entry.wasAnswered)
  }

  /**
   * Get recent calls
   */
  const getRecentCalls = (limit: number = HISTORY_CONSTANTS.DEFAULT_LIMIT): CallHistoryEntry[] => {
    return history.value.slice(0, limit)
  }

  // ============================================================================
  // Export Functionality
  // ============================================================================

  /**
   * Export history to file
   */
  const exportHistory = async (options: HistoryExportOptions): Promise<void> => {
    try {
      log.info(`Exporting history to ${options.format}`)

      // Get entries to export
      const entries = options.filter
        ? applyFilter(history.value, options.filter).entries
        : history.value

      if (entries.length === 0) {
        log.warn('No entries to export')
        throw new Error('No call history entries to export')
      }

      let content: string
      let mimeType: string
      let extension: string

      switch (options.format) {
        case 'json':
          content = JSON.stringify(entries, null, 2)
          mimeType = 'application/json'
          extension = 'json'
          break

        case 'csv':
          content = convertToCSV(entries, options.includeMetadata)
          mimeType = 'text/csv'
          extension = 'csv'
          break

        case 'xlsx':
          log.warn('Excel export not yet implemented, falling back to CSV')
          content = convertToCSV(entries, options.includeMetadata)
          mimeType = 'text/csv'
          extension = 'csv'
          break

        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const filename = `${options.filename || 'call-history'}.${extension}`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()

      // Cleanup
      URL.revokeObjectURL(url)

      log.info(`Exported ${entries.length} entries to ${filename}`)
    } catch (error) {
      log.error('Failed to export history:', error)
      throw error
    }
  }

  /**
   * Convert entries to CSV format
   */
  const convertToCSV = (entries: CallHistoryEntry[], includeMetadata?: boolean): string => {
    const headers = [
      'ID',
      'Direction',
      'Remote URI',
      'Remote Display Name',
      'Local URI',
      'Start Time',
      'Answer Time',
      'End Time',
      'Duration (seconds)',
      'Ring Duration (seconds)',
      'Final State',
      'Termination Cause',
      'Was Answered',
      'Was Missed',
      'Has Video',
      'Tags',
    ]

    if (includeMetadata) {
      headers.push('Metadata')
    }

    const rows = entries.map((entry) => {
      const row = [
        entry.id,
        entry.direction,
        entry.remoteUri,
        entry.remoteDisplayName || '',
        entry.localUri,
        entry.startTime.toISOString(),
        entry.answerTime?.toISOString() || '',
        entry.endTime.toISOString(),
        entry.duration.toString(),
        entry.ringDuration?.toString() || '',
        entry.finalState,
        entry.terminationCause,
        entry.wasAnswered.toString(),
        entry.wasMissed.toString(),
        entry.hasVideo.toString(),
        entry.tags?.join(';') || '',
      ]

      if (includeMetadata) {
        row.push(entry.metadata ? JSON.stringify(entry.metadata) : '')
      }

      return row
    })

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n')

    return csvContent
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get history statistics
   */
  const getStatistics = (filter?: HistoryFilter): HistoryStatistics => {
    const entries = filter ? applyFilter(history.value, filter).entries : history.value

    const totalCalls = entries.length
    const incomingCalls = entries.filter((e) => e.direction === CallDirection.Incoming).length
    const outgoingCalls = entries.filter((e) => e.direction === CallDirection.Outgoing).length
    const answeredCalls = entries.filter((e) => e.wasAnswered).length
    const missedCalls = entries.filter((e) => e.wasMissed && !e.wasAnswered).length
    const videoCalls = entries.filter((e) => e.hasVideo).length

    const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0)
    const averageDuration = totalCalls > 0 ? totalDuration / totalCalls : 0

    // Calculate frequent contacts
    const contactCounts = new Map<string, { displayName?: string; count: number }>()
    entries.forEach((entry) => {
      const existing = contactCounts.get(entry.remoteUri)
      if (existing) {
        existing.count++
      } else {
        contactCounts.set(entry.remoteUri, {
          displayName: entry.remoteDisplayName,
          count: 1,
        })
      }
    })

    const frequentContacts = Array.from(contactCounts.entries())
      .map(([uri, data]) => ({
        uri,
        displayName: data.displayName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, HISTORY_CONSTANTS.TOP_FREQUENT_CONTACTS)

    return {
      totalCalls,
      incomingCalls,
      outgoingCalls,
      answeredCalls,
      missedCalls,
      totalDuration,
      averageDuration,
      videoCalls,
      frequentContacts,
    }
  }

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    history,
    filteredHistory,
    totalCalls,
    missedCallsCount,
    currentFilter,

    // Methods
    getHistory,
    searchHistory,
    clearHistory,
    deleteEntry,
    exportHistory,
    getStatistics,
    setFilter,
    getMissedCalls,
    getRecentCalls,
  }
}
