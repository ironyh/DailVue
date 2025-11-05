/**
 * Call transfer type definitions
 * @packageDocumentation
 */

/**
 * Transfer state enumeration
 */
export enum TransferState {
  /** No active transfer */
  Idle = 'idle',
  /** Transfer initiated */
  Initiated = 'initiated',
  /** Transfer in progress */
  InProgress = 'in_progress',
  /** Transfer accepted */
  Accepted = 'accepted',
  /** Transfer completed */
  Completed = 'completed',
  /** Transfer failed */
  Failed = 'failed',
  /** Transfer canceled */
  Canceled = 'canceled',
}

/**
 * Transfer type
 */
export enum TransferType {
  /** Blind transfer (direct transfer without consultation) */
  Blind = 'blind',
  /** Attended transfer (consultation before transfer) */
  Attended = 'attended',
}

/**
 * Transfer options
 */
export interface TransferOptions {
  /** Transfer type */
  type: TransferType
  /** Target URI for transfer */
  target: string
  /** Custom SIP headers */
  extraHeaders?: string[]
}

/**
 * Transfer event
 */
export interface TransferEvent {
  /** Event type */
  type: string
  /** Transfer ID */
  transferId: string
  /** Transfer state */
  state: TransferState
  /** Transfer type */
  transferType: TransferType
  /** Target URI */
  target: string
  /** Call ID being transferred */
  callId: string
  /** Consultation call ID (for attended transfer) */
  consultationCallId?: string
  /** Timestamp */
  timestamp: Date
  /** Error message (if failed) */
  error?: string
}

/**
 * Transfer progress information
 */
export interface TransferProgress {
  /** Transfer ID */
  id: string
  /** Current state */
  state: TransferState
  /** Transfer type */
  type: TransferType
  /** Target URI */
  target: string
  /** Progress percentage (0-100) */
  progress?: number
}
