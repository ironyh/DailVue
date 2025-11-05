/**
 * Presence type definitions
 * @packageDocumentation
 */

/**
 * Presence state enumeration
 */
export enum PresenceState {
  /** User is online and available */
  Available = 'available',
  /** User is away */
  Away = 'away',
  /** User is busy / do not disturb */
  Busy = 'busy',
  /** User is offline */
  Offline = 'offline',
  /** Custom status */
  Custom = 'custom',
}

/**
 * Presence status
 */
export interface PresenceStatus {
  /** User URI */
  uri: string
  /** Presence state */
  state: PresenceState
  /** Custom status message */
  statusMessage?: string
  /** Last updated timestamp */
  lastUpdated: Date
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Presence subscription
 */
export interface PresenceSubscription {
  /** Subscription ID */
  id: string
  /** Target URI being watched */
  targetUri: string
  /** Subscription state */
  state: 'pending' | 'active' | 'terminated'
  /** Expiry time */
  expires?: number
  /** Last presence status received */
  lastStatus?: PresenceStatus
}

/**
 * Presence event
 */
export interface PresenceEvent {
  /** Event type */
  type: 'updated' | 'subscribed' | 'unsubscribed' | 'error'
  /** User URI */
  uri: string
  /** Presence status */
  status?: PresenceStatus
  /** Subscription information */
  subscription?: PresenceSubscription
  /** Timestamp */
  timestamp: Date
  /** Error message (if applicable) */
  error?: string
}

/**
 * Presence options for publishing status
 */
export interface PresencePublishOptions {
  /** Status message */
  statusMessage?: string
  /** Expiry time in seconds */
  expires?: number
  /** Custom headers */
  extraHeaders?: string[]
}

/**
 * Presence subscription options
 */
export interface PresenceSubscriptionOptions {
  /** Expiry time in seconds */
  expires?: number
  /** Custom headers */
  extraHeaders?: string[]
}
