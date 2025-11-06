/**
 * Composable Constants
 *
 * Centralized configuration values and magic numbers used across composables.
 * This ensures consistency and makes values easy to adjust.
 *
 * @module composables/constants
 */

/**
 * Registration configuration
 */
export const REGISTRATION_CONSTANTS = {
  /** Default registration expiry time in seconds */
  DEFAULT_EXPIRES: 600,

  /** Default maximum retry attempts */
  DEFAULT_MAX_RETRIES: 3,

  /** Registration refresh percentage (refresh at 90% of expiry time) */
  REFRESH_PERCENTAGE: 0.9,

  /** Seconds threshold for "expiring soon" warning */
  EXPIRING_SOON_THRESHOLD: 30,

  /** Base retry delay in milliseconds */
  BASE_RETRY_DELAY: 1000,

  /** Maximum retry delay in milliseconds (30 seconds) */
  MAX_RETRY_DELAY: 30000,
} as const

/**
 * Presence configuration
 */
export const PRESENCE_CONSTANTS = {
  /** Default presence publish expiry in seconds */
  DEFAULT_EXPIRES: 3600,

  /** Subscription refresh percentage (refresh at 90% of expiry time) */
  SUBSCRIPTION_REFRESH_PERCENTAGE: 0.9,

  /** Default subscription expiry in seconds */
  DEFAULT_SUBSCRIPTION_EXPIRES: 3600,
} as const

/**
 * Messaging configuration
 */
export const MESSAGING_CONSTANTS = {
  /** Composing indicator idle timeout in milliseconds */
  COMPOSING_IDLE_TIMEOUT: 10000,

  /** Composing indicator timeout in seconds */
  COMPOSING_TIMEOUT_SECONDS: 10,
} as const

/**
 * Conference configuration
 */
export const CONFERENCE_CONSTANTS = {
  /** Default maximum participants in a conference */
  DEFAULT_MAX_PARTICIPANTS: 10,

  /** Audio level monitoring interval in milliseconds */
  AUDIO_LEVEL_INTERVAL: 100,

  /** Conference state transition delay in milliseconds */
  STATE_TRANSITION_DELAY: 2000,
} as const

/**
 * Transfer configuration
 */
export const TRANSFER_CONSTANTS = {
  /** Transfer completion delay in milliseconds */
  COMPLETION_DELAY: 2000,

  /** Transfer cancellation delay in milliseconds */
  CANCELLATION_DELAY: 1000,
} as const

/**
 * Call history configuration
 */
export const HISTORY_CONSTANTS = {
  /** Default call history limit */
  DEFAULT_LIMIT: 10,

  /** Default offset for pagination */
  DEFAULT_OFFSET: 0,

  /** Default sort order */
  DEFAULT_SORT_ORDER: 'desc' as const,

  /** Default sort field */
  DEFAULT_SORT_BY: 'startTime' as const,

  /** Top N frequent contacts to return */
  TOP_FREQUENT_CONTACTS: 10,
} as const

/**
 * Common timeout values (in milliseconds)
 */
export const TIMEOUTS = {
  /** Short delay for UI updates */
  SHORT_DELAY: 1000,

  /** Medium delay for operations */
  MEDIUM_DELAY: 2000,

  /** Long delay for cleanup */
  LONG_DELAY: 5000,
} as const

/**
 * Call configuration
 */
export const CALL_CONSTANTS = {
  /** Maximum concurrent calls */
  MAX_CONCURRENT_CALLS: 5,

  /** Call timeout in milliseconds */
  CALL_TIMEOUT: 30000,

  /** Ring timeout in milliseconds */
  RING_TIMEOUT: 60000,
} as const

/**
 * Media configuration
 */
export const MEDIA_CONSTANTS = {
  /** Device enumeration retry delay in milliseconds */
  ENUMERATION_RETRY_DELAY: 1000,

  /** Device test duration in milliseconds */
  DEFAULT_TEST_DURATION: 2000,

  /** Audio level threshold for device test (0-1) */
  AUDIO_LEVEL_THRESHOLD: 0.01,
} as const

/**
 * DTMF configuration
 */
export const DTMF_CONSTANTS = {
  /** Default DTMF tone duration in milliseconds */
  DEFAULT_DURATION: 100,

  /** Default inter-tone gap in milliseconds */
  DEFAULT_INTER_TONE_GAP: 70,

  /** Minimum allowed duration in milliseconds */
  MIN_DURATION: 40,

  /** Maximum allowed duration in milliseconds */
  MAX_DURATION: 6000,

  /** Maximum DTMF queue size (prevents unbounded memory growth) */
  MAX_QUEUE_SIZE: 100,
} as const

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  /** Calculate exponential backoff delay */
  calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    return delay
  },

  /** Default exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2,
} as const
