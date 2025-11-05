/**
 * Call history type definitions
 * @packageDocumentation
 */

import type { CallDirection, CallState, TerminationCause } from './call.types'

/**
 * Call history entry
 */
export interface CallHistoryEntry {
  /** Entry ID */
  id: string
  /** Call direction */
  direction: CallDirection
  /** Remote URI */
  remoteUri: string
  /** Remote display name */
  remoteDisplayName?: string
  /** Local URI */
  localUri: string
  /** Call start time */
  startTime: Date
  /** Call answer time (if answered) */
  answerTime?: Date
  /** Call end time */
  endTime: Date
  /** Call duration in seconds */
  duration: number
  /** Ring duration in seconds */
  ringDuration?: number
  /** Final call state */
  finalState: CallState
  /** Termination cause */
  terminationCause: TerminationCause
  /** Was answered */
  wasAnswered: boolean
  /** Was missed (for incoming calls) */
  wasMissed: boolean
  /** Was video call */
  hasVideo: boolean
  /** Custom tags */
  tags?: string[]
  /** Custom metadata */
  metadata?: Record<string, any>
}

/**
 * History filter options
 */
export interface HistoryFilter {
  /** Filter by direction */
  direction?: CallDirection
  /** Filter by remote URI */
  remoteUri?: string
  /** Filter by answered/unanswered */
  wasAnswered?: boolean
  /** Filter by missed calls */
  wasMissed?: boolean
  /** Filter by video calls */
  hasVideo?: boolean
  /** Filter by date range (from) */
  dateFrom?: Date
  /** Filter by date range (to) */
  dateTo?: Date
  /** Filter by tags */
  tags?: string[]
  /** Search query (searches in URI and display name) */
  searchQuery?: string
  /** Sort field */
  sortBy?: 'startTime' | 'duration' | 'remoteUri'
  /** Sort order */
  sortOrder?: 'asc' | 'desc'
  /** Limit results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * History export format
 */
export enum HistoryExportFormat {
  /** JSON format */
  JSON = 'json',
  /** CSV format */
  CSV = 'csv',
  /** Excel format (if supported) */
  Excel = 'xlsx',
}

/**
 * History export options
 */
export interface HistoryExportOptions {
  /** Export format */
  format: HistoryExportFormat
  /** Filter to apply before export */
  filter?: HistoryFilter
  /** Include metadata */
  includeMetadata?: boolean
  /** Filename (without extension) */
  filename?: string
}

/**
 * History statistics
 */
export interface HistoryStatistics {
  /** Total calls */
  totalCalls: number
  /** Total incoming calls */
  incomingCalls: number
  /** Total outgoing calls */
  outgoingCalls: number
  /** Total answered calls */
  answeredCalls: number
  /** Total missed calls */
  missedCalls: number
  /** Total call duration (seconds) */
  totalDuration: number
  /** Average call duration (seconds) */
  averageDuration: number
  /** Total video calls */
  videoCalls: number
  /** Most frequent contacts */
  frequentContacts: Array<{
    uri: string
    displayName?: string
    count: number
  }>
}

/**
 * History search result
 */
export interface HistorySearchResult {
  /** Matched entries */
  entries: CallHistoryEntry[]
  /** Total count (before pagination) */
  totalCount: number
  /** Has more results */
  hasMore: boolean
}
