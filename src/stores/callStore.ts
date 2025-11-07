/**
 * Call Store
 *
 * Reactive store for managing active calls, incoming call queue, and call history.
 * Uses Vue 3 reactivity system for reactive state management.
 *
 * @module stores/callStore
 */

import { reactive, computed, readonly } from 'vue'
import { CallState, CallDirection, TerminationCause, type CallSession } from '../types/call.types'
import type { CallHistoryEntry, HistoryFilter, HistorySearchResult } from '../types/history.types'
import { createLogger } from '../utils/logger'

const log = createLogger('CallStore')

/**
 * Maximum number of concurrent calls allowed
 */
const DEFAULT_MAX_CONCURRENT_CALLS = 4

/**
 * Maximum number of call history entries to keep in memory
 */
const DEFAULT_MAX_HISTORY_ENTRIES = 1000

/**
 * Call store state interface
 */
interface CallStoreState {
  /** Map of active call sessions by call ID */
  activeCalls: Map<string, CallSession>
  /** Queue of incoming calls (call IDs) */
  incomingCallQueue: string[]
  /** Call history entries (most recent first) */
  callHistory: CallHistoryEntry[]
  /** Maximum concurrent calls allowed */
  maxConcurrentCalls: number
  /** Maximum history entries to keep */
  maxHistoryEntries: number
}

/**
 * Internal reactive state
 */
const state = reactive<CallStoreState>({
  activeCalls: new Map(),
  incomingCallQueue: [],
  callHistory: [],
  maxConcurrentCalls: DEFAULT_MAX_CONCURRENT_CALLS,
  maxHistoryEntries: DEFAULT_MAX_HISTORY_ENTRIES,
})

/**
 * Computed values
 */
const computed_values = {
  /** All active calls as an array */
  activeCallsArray: computed(() => Array.from(state.activeCalls.values())),

  /** Number of active calls */
  activeCallCount: computed(() => state.activeCalls.size),

  /** Number of incoming calls in queue */
  incomingCallCount: computed(() => state.incomingCallQueue.length),

  /** Whether max concurrent calls limit is reached */
  isAtMaxCalls: computed(() => state.activeCalls.size >= state.maxConcurrentCalls),

  /** Get all incoming calls */
  incomingCalls: computed(() =>
    state.incomingCallQueue
      .map((id) => state.activeCalls.get(id))
      .filter((call): call is CallSession => call !== undefined)
  ),

  /** Get all active non-incoming calls */
  establishedCalls: computed(() =>
    Array.from(state.activeCalls.values()).filter(
      (call) => !(call.direction === CallDirection.Incoming && call.state === CallState.Ringing)
    )
  ),

  /** Total calls in history */
  totalHistoryCalls: computed(() => state.callHistory.length),

  /** Total missed calls */
  missedCallsCount: computed(
    () => state.callHistory.filter((entry) => entry.wasMissed && !entry.wasAnswered).length
  ),
}

/**
 * Call Store
 *
 * Manages active calls, incoming call queue, and call history with reactive state.
 */
export const callStore = {
  // ============================================================================
  // State Access (readonly to prevent direct mutation)
  // ============================================================================

  /**
   * Get readonly reference to active calls map
   */
  get activeCalls() {
    return readonly(state.activeCalls)
  },

  /**
   * Get readonly reference to incoming call queue
   */
  get incomingCallQueue() {
    return readonly(state.incomingCallQueue)
  },

  /**
   * Get readonly reference to call history
   */
  get callHistory() {
    return readonly(state.callHistory)
  },

  /**
   * Get all active calls as an array
   */
  get activeCallsArray() {
    return computed_values.activeCallsArray.value
  },

  /**
   * Get number of active calls
   */
  get activeCallCount() {
    return computed_values.activeCallCount.value
  },

  /**
   * Get number of incoming calls
   */
  get incomingCallCount() {
    return computed_values.incomingCallCount.value
  },

  /**
   * Check if at max concurrent calls
   */
  get isAtMaxCalls() {
    return computed_values.isAtMaxCalls.value
  },

  /**
   * Get all incoming calls
   */
  get incomingCalls() {
    return computed_values.incomingCalls.value
  },

  /**
   * Get all established (non-incoming) calls
   */
  get establishedCalls() {
    return computed_values.establishedCalls.value
  },

  /**
   * Get total history call count
   */
  get totalHistoryCalls() {
    return computed_values.totalHistoryCalls.value
  },

  /**
   * Get missed calls count
   */
  get missedCallsCount() {
    return computed_values.missedCallsCount.value
  },

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set maximum concurrent calls
   *
   * @param max - Maximum number of concurrent calls (must be > 0)
   */
  setMaxConcurrentCalls(max: number): void {
    if (max <= 0) {
      log.warn('Max concurrent calls must be greater than 0, ignoring')
      return
    }
    state.maxConcurrentCalls = max
    log.debug(`Max concurrent calls set to ${max}`)
  },

  /**
   * Set maximum history entries
   *
   * @param max - Maximum number of history entries to keep
   */
  setMaxHistoryEntries(max: number): void {
    if (max <= 0) {
      log.warn('Max history entries must be greater than 0, ignoring')
      return
    }
    state.maxHistoryEntries = max
    log.debug(`Max history entries set to ${max}`)

    // Trim history if needed
    if (state.callHistory.length > max) {
      state.callHistory = state.callHistory.slice(0, max)
      log.debug(`Trimmed history to ${max} entries`)
    }
  },

  // ============================================================================
  // Active Call Management
  // ============================================================================

  /**
   * Add a call to the active calls registry
   *
   * @param call - Call session to add
   * @returns True if added successfully, false if at max calls or call already exists
   */
  addCall(call: CallSession): boolean {
    // Check if call already exists
    if (state.activeCalls.has(call.id)) {
      log.warn(`Call ${call.id} already exists in active calls`)
      return false
    }

    // Check max concurrent calls limit (but allow incoming calls to queue)
    if (
      state.activeCalls.size >= state.maxConcurrentCalls &&
      call.direction === CallDirection.Outgoing
    ) {
      log.warn(`Cannot add call ${call.id}: at max concurrent calls (${state.maxConcurrentCalls})`)
      return false
    }

    // Add to active calls
    state.activeCalls.set(call.id, call)
    log.debug(`Added call ${call.id} to active calls (${call.direction})`)

    // Add to incoming queue if incoming
    if (call.direction === CallDirection.Incoming && call.state === CallState.Ringing) {
      state.incomingCallQueue.push(call.id)
      log.debug(`Added call ${call.id} to incoming queue`)
    }

    return true
  },

  /**
   * Update a call in the active calls registry
   *
   * @param call - Updated call session
   */
  updateCall(call: CallSession): void {
    if (!state.activeCalls.has(call.id)) {
      log.warn(`Cannot update call ${call.id}: not found in active calls`)
      return
    }

    state.activeCalls.set(call.id, call)
    log.debug(`Updated call ${call.id}`)
  },

  /**
   * Remove a call from the active calls registry
   *
   * @param callId - Call ID to remove
   * @returns The removed call session, or undefined if not found
   */
  removeCall(callId: string): CallSession | undefined {
    const call = state.activeCalls.get(callId)
    if (!call) {
      log.warn(`Cannot remove call ${callId}: not found`)
      return undefined
    }

    // Remove from active calls
    state.activeCalls.delete(callId)
    log.debug(`Removed call ${callId} from active calls`)

    // Remove from incoming queue if present
    const queueIndex = state.incomingCallQueue.indexOf(callId)
    if (queueIndex !== -1) {
      state.incomingCallQueue.splice(queueIndex, 1)
      log.debug(`Removed call ${callId} from incoming queue`)
    }

    return call
  },

  /**
   * Add a call to active calls (alias for addCall)
   * Provided for backward compatibility with composables
   *
   * @param call - Call session to add
   * @returns True if added successfully, false if max limit reached
   */
  addActiveCall(call: CallSession): boolean {
    return callStore.addCall(call)
  },

  /**
   * Remove a call from active calls (alias for removeCall)
   * Provided for backward compatibility with composables
   *
   * @param callId - Call ID to remove
   * @returns True if removed successfully, false if not found
   */
  removeActiveCall(callId: string): boolean {
    const removed = callStore.removeCall(callId)
    return removed !== undefined
  },

  /**
   * Get a call by ID
   *
   * @param callId - Call ID to lookup
   * @returns The call session, or undefined if not found
   */
  getCall(callId: string): CallSession | undefined {
    return state.activeCalls.get(callId)
  },

  /**
   * Find calls matching a predicate
   *
   * @param predicate - Function to test each call
   * @returns Array of matching call sessions
   */
  findCalls(predicate: (call: CallSession) => boolean): CallSession[] {
    return Array.from(state.activeCalls.values()).filter(predicate)
  },

  /**
   * Check if a call exists
   *
   * @param callId - Call ID to check
   * @returns True if call exists
   */
  hasCall(callId: string): boolean {
    return state.activeCalls.has(callId)
  },

  /**
   * Clear all active calls (use with caution)
   */
  clearActiveCalls(): void {
    const count = state.activeCalls.size
    state.activeCalls.clear()
    state.incomingCallQueue = []
    log.warn(`Cleared ${count} active calls`)
  },

  // ============================================================================
  // Incoming Call Queue Management
  // ============================================================================

  /**
   * Get the next incoming call from the queue
   *
   * @returns The next incoming call, or undefined if queue is empty
   */
  getNextIncomingCall(): CallSession | undefined {
    const callId = state.incomingCallQueue[0]
    return callId ? state.activeCalls.get(callId) : undefined
  },

  /**
   * Remove a call from the incoming queue (but keep in active calls)
   *
   * @param callId - Call ID to remove from queue
   */
  removeFromIncomingQueue(callId: string): void {
    const index = state.incomingCallQueue.indexOf(callId)
    if (index !== -1) {
      state.incomingCallQueue.splice(index, 1)
      log.debug(`Removed call ${callId} from incoming queue`)
    }
  },

  // ============================================================================
  // Call History Management
  // ============================================================================

  /**
   * Add a call to history
   *
   * @param entry - Call history entry to add
   */
  addToHistory(entry: CallHistoryEntry): void {
    // Add to beginning of array (most recent first)
    state.callHistory.unshift(entry)
    log.debug(`Added call ${entry.id} to history`)

    // Trim history if exceeds max
    if (state.callHistory.length > state.maxHistoryEntries) {
      const removed = state.callHistory.splice(state.maxHistoryEntries)
      log.debug(`Trimmed ${removed.length} old entries from history`)
    }
  },

  /**
   * Create a history entry from a call session
   *
   * @param call - Call session to convert
   * @returns Call history entry
   */
  createHistoryEntry(call: CallSession): CallHistoryEntry {
    const entry: CallHistoryEntry = {
      id: call.id,
      direction: call.direction,
      remoteUri: typeof call.remoteUri === 'string' ? call.remoteUri : call.remoteUri.toString(),
      remoteDisplayName: call.remoteDisplayName,
      localUri: typeof call.localUri === 'string' ? call.localUri : call.localUri.toString(),
      startTime: call.timing.startTime || new Date(),
      answerTime: call.timing.answerTime,
      endTime: call.timing.endTime || new Date(),
      duration: call.timing.duration || 0,
      ringDuration: call.timing.ringDuration,
      finalState: call.state,
      terminationCause: call.terminationCause || TerminationCause.Other,
      wasAnswered: call.state === CallState.Active || !!call.timing.answerTime,
      wasMissed:
        call.direction === CallDirection.Incoming &&
        !call.timing.answerTime &&
        call.state === CallState.Terminated,
      hasVideo: call.hasLocalVideo || call.hasRemoteVideo,
      metadata: call.data,
    }

    return entry
  },

  /**
   * Get call history with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Filtered call history entries
   */
  getHistory(filter?: HistoryFilter): CallHistoryEntry[] {
    let filtered = [...state.callHistory]

    if (!filter) {
      return filtered
    }

    // Apply filters
    if (filter.direction !== undefined) {
      filtered = filtered.filter((entry) => entry.direction === filter.direction)
    }

    if (filter.remoteUri !== undefined) {
      filtered = filtered.filter((entry) => entry.remoteUri === filter.remoteUri)
    }

    if (filter.wasAnswered !== undefined) {
      filtered = filtered.filter((entry) => entry.wasAnswered === filter.wasAnswered)
    }

    if (filter.wasMissed !== undefined) {
      filtered = filtered.filter((entry) => entry.wasMissed === filter.wasMissed)
    }

    if (filter.hasVideo !== undefined) {
      filtered = filtered.filter((entry) => entry.hasVideo === filter.hasVideo)
    }

    if (filter.dateFrom !== undefined) {
      filtered = filtered.filter((entry) => entry.startTime >= filter.dateFrom!)
    }

    if (filter.dateTo !== undefined) {
      filtered = filtered.filter((entry) => entry.startTime <= filter.dateTo!)
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((entry) => entry.tags?.some((tag) => filter.tags!.includes(tag)))
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      filtered = filtered.filter(
        (entry) =>
          entry.remoteUri.toLowerCase().includes(query) ||
          entry.remoteDisplayName?.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    if (filter.sortBy) {
      const sortOrder = filter.sortOrder === 'asc' ? 1 : -1
      filtered.sort((a, b) => {
        const aVal = a[filter.sortBy!]
        const bVal = b[filter.sortBy!]

        if (aVal instanceof Date && bVal instanceof Date) {
          return (aVal.getTime() - bVal.getTime()) * sortOrder
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * sortOrder
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * sortOrder
        }

        return 0
      })
    }

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit || filtered.length

    return filtered.slice(offset, offset + limit)
  },

  /**
   * Search call history
   *
   * @param filter - Filter criteria including search query
   * @returns Search result with entries, total count, and pagination info
   */
  searchHistory(filter?: HistoryFilter): HistorySearchResult {
    const allFiltered = this.getHistory({ ...filter, limit: undefined })
    const totalCount = allFiltered.length

    const offset = filter?.offset || 0
    const limit = filter?.limit || totalCount
    const entries = allFiltered.slice(offset, offset + limit)

    return {
      entries,
      totalCount,
      hasMore: offset + entries.length < totalCount,
    }
  },

  /**
   * Delete a specific history entry
   *
   * @param entryId - History entry ID to delete
   * @returns True if deleted, false if not found
   */
  deleteHistoryEntry(entryId: string): boolean {
    const index = state.callHistory.findIndex((entry) => entry.id === entryId)
    if (index === -1) {
      log.warn(`Cannot delete history entry ${entryId}: not found`)
      return false
    }

    state.callHistory.splice(index, 1)
    log.debug(`Deleted history entry ${entryId}`)
    return true
  },

  /**
   * Clear all call history
   */
  clearHistory(): void {
    const count = state.callHistory.length
    state.callHistory = []
    log.info(`Cleared ${count} history entries`)
  },

  /**
   * Clear history entries matching a filter
   *
   * @param filter - Filter criteria for entries to clear
   * @returns Number of entries cleared
   */
  clearHistoryByFilter(filter: HistoryFilter): number {
    const toDelete = this.getHistory(filter)
    const deleteIds = new Set(toDelete.map((entry) => entry.id))

    const before = state.callHistory.length
    state.callHistory = state.callHistory.filter((entry) => !deleteIds.has(entry.id))
    const deleted = before - state.callHistory.length

    log.info(`Cleared ${deleted} history entries matching filter`)
    return deleted
  },

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Reset the entire store to initial state
   */
  reset(): void {
    state.activeCalls.clear()
    state.incomingCallQueue = []
    state.callHistory = []
    state.maxConcurrentCalls = DEFAULT_MAX_CONCURRENT_CALLS
    state.maxHistoryEntries = DEFAULT_MAX_HISTORY_ENTRIES
    log.info('Call store reset to initial state')
  },

  /**
   * Get store statistics
   *
   * @returns Object with store statistics
   */
  getStatistics() {
    return {
      activeCalls: state.activeCalls.size,
      incomingCalls: state.incomingCallQueue.length,
      historyEntries: state.callHistory.length,
      missedCalls: computed_values.missedCallsCount.value,
      maxConcurrentCalls: state.maxConcurrentCalls,
      maxHistoryEntries: state.maxHistoryEntries,
    }
  },
}
