/**
 * VueSip Constants
 *
 * Centralized constants and default values for the VueSip library.
 * These constants are used throughout the library for SIP configuration,
 * media settings, timeouts, and protocol defaults.
 *
 * @module utils/constants
 */

/**
 * Library version (should match package.json)
 */
export const VERSION = '1.0.0'

/**
 * Default User-Agent string format
 * Used in SIP headers to identify the client
 */
export const USER_AGENT = `VueSip/${VERSION}`

// ============================================================================
// SIP Configuration Defaults
// ============================================================================

/**
 * Default SIP registration expiration time in seconds
 * Standard value is 3600 (1 hour), but 600 (10 minutes) is more common for WebRTC
 */
export const DEFAULT_REGISTER_EXPIRES = 600

/**
 * Default session timer expiration in seconds
 * Used for session refresh via UPDATE or re-INVITE
 */
export const DEFAULT_SESSION_TIMERS = 90

/**
 * Default timeout for no answer in seconds
 * After this time, an unanswered call will be terminated
 */
export const DEFAULT_NO_ANSWER_TIMEOUT = 60

/**
 * Default WebSocket keep-alive ping interval in milliseconds
 * Send OPTIONS or CRLF pings to keep connection alive
 */
export const DEFAULT_PING_INTERVAL = 30000 // 30 seconds

/**
 * Default maximum forwards header value
 * Prevents infinite loops in SIP routing
 */
export const DEFAULT_MAX_FORWARDS = 70

// ============================================================================
// Media Configuration Defaults
// ============================================================================

/**
 * Default audio constraints for getUserMedia
 */
export const DEFAULT_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1, // Mono for VoIP
} as const

/**
 * Default video constraints for getUserMedia
 */
export const DEFAULT_VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30 },
  facingMode: 'user',
} as const

/**
 * Default media stream constraints
 */
export const DEFAULT_MEDIA_CONSTRAINTS = {
  audio: DEFAULT_AUDIO_CONSTRAINTS,
  video: false, // Audio-only by default
} as const

// ============================================================================
// Timeout Values (in milliseconds)
// ============================================================================

/**
 * Reconnection delays for exponential backoff (in milliseconds)
 * Used when connection fails: 2s, 4s, 8s, 16s, 32s
 */
export const RECONNECTION_DELAYS = [2000, 4000, 8000, 16000, 32000] as const

/**
 * Maximum number of reconnection attempts
 */
export const MAX_RETRY_ATTEMPTS = 5

/**
 * ICE gathering timeout in milliseconds
 * If ICE candidates aren't gathered within this time, proceed anyway
 */
export const ICE_GATHERING_TIMEOUT = 5000

/**
 * Default DTMF tone duration in milliseconds
 */
export const DEFAULT_DTMF_DURATION = 100

/**
 * Default inter-tone gap for DTMF sequences in milliseconds
 */
export const DEFAULT_DTMF_INTER_TONE_GAP = 70

/**
 * Statistics collection interval in milliseconds
 * How often to collect RTCPeerConnection statistics
 */
export const STATS_COLLECTION_INTERVAL = 1000

/**
 * Audio level detection update interval in milliseconds
 */
export const AUDIO_LEVEL_INTERVAL = 100

// ============================================================================
// Supported Codecs
// ============================================================================

/**
 * Supported audio codecs in order of preference
 */
export const AUDIO_CODECS = [
  'opus', // Preferred: 48 kHz, variable bitrate
  'G722', // Wideband: 16 kHz
  'PCMU', // G.711 µ-law: 8 kHz
  'PCMA', // G.711 A-law: 8 kHz
] as const

/**
 * Supported video codecs in order of preference
 */
export const VIDEO_CODECS = [
  'VP8', // Required by WebRTC spec
  'VP9', // Better quality than VP8
  'H264', // Most widely supported, preferred if available
] as const

// ============================================================================
// SIP Status Codes
// ============================================================================

/**
 * Common SIP response codes
 */
export const SIP_STATUS_CODES = {
  // Provisional 1xx
  TRYING: 100,
  RINGING: 180,
  SESSION_PROGRESS: 183,

  // Success 2xx
  OK: 200,
  ACCEPTED: 202,

  // Redirection 3xx
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  MOVED_TEMPORARILY: 302,

  // Client Error 4xx
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  GONE: 410,
  REQUEST_ENTITY_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNSUPPORTED_URI_SCHEME: 416,
  BAD_EXTENSION: 420,
  EXTENSION_REQUIRED: 421,
  INTERVAL_TOO_BRIEF: 423,
  TEMPORARILY_UNAVAILABLE: 480,
  CALL_TRANSACTION_DOES_NOT_EXIST: 481,
  LOOP_DETECTED: 482,
  TOO_MANY_HOPS: 483,
  ADDRESS_INCOMPLETE: 484,
  AMBIGUOUS: 485,
  BUSY_HERE: 486,
  REQUEST_TERMINATED: 487,
  NOT_ACCEPTABLE_HERE: 488,
  BAD_EVENT: 489,
  REQUEST_PENDING: 491,
  UNDECIPHERABLE: 493,

  // Server Error 5xx
  SERVER_INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  SERVER_TIMEOUT: 504,
  VERSION_NOT_SUPPORTED: 505,
  MESSAGE_TOO_LARGE: 513,

  // Global Failure 6xx
  BUSY_EVERYWHERE: 600,
  DECLINE: 603,
  DOES_NOT_EXIST_ANYWHERE: 604,
  NOT_ACCEPTABLE: 606,
} as const

// ============================================================================
// Event Names
// ============================================================================

/**
 * Standard event names used throughout the library
 */
export const EVENTS = {
  // Connection events
  CONNECTION_CONNECTING: 'connection:connecting',
  CONNECTION_CONNECTED: 'connection:connected',
  CONNECTION_DISCONNECTED: 'connection:disconnected',
  CONNECTION_FAILED: 'connection:failed',
  CONNECTION_RECONNECTING: 'connection:reconnecting',

  // Registration events
  REGISTRATION_REGISTERING: 'registration:registering',
  REGISTRATION_REGISTERED: 'registration:registered',
  REGISTRATION_UNREGISTERED: 'registration:unregistered',
  REGISTRATION_FAILED: 'registration:failed',
  REGISTRATION_EXPIRING: 'registration:expiring',

  // Call events
  CALL_INCOMING: 'call:incoming',
  CALL_OUTGOING: 'call:outgoing',
  CALL_RINGING: 'call:ringing',
  CALL_PROGRESS: 'call:progress',
  CALL_ACCEPTED: 'call:accepted',
  CALL_ANSWERED: 'call:answered',
  CALL_HELD: 'call:held',
  CALL_UNHELD: 'call:unheld',
  CALL_MUTED: 'call:muted',
  CALL_UNMUTED: 'call:unmuted',
  CALL_TERMINATED: 'call:terminated',
  CALL_FAILED: 'call:failed',

  // Media events
  MEDIA_DEVICE_CHANGED: 'media:deviceChanged',
  MEDIA_DEVICE_ADDED: 'media:deviceAdded',
  MEDIA_DEVICE_REMOVED: 'media:deviceRemoved',
  MEDIA_STREAM_ADDED: 'media:streamAdded',
  MEDIA_STREAM_REMOVED: 'media:streamRemoved',
  MEDIA_TRACK_ADDED: 'media:trackAdded',
  MEDIA_TRACK_REMOVED: 'media:trackRemoved',

  // Transfer events
  TRANSFER_INITIATED: 'transfer:initiated',
  TRANSFER_ACCEPTED: 'transfer:accepted',
  TRANSFER_REJECTED: 'transfer:rejected',
  TRANSFER_COMPLETED: 'transfer:completed',
  TRANSFER_FAILED: 'transfer:failed',

  // DTMF events
  DTMF_TONE_SENT: 'dtmf:toneSent',
  DTMF_SEQUENCE_STARTED: 'dtmf:sequenceStarted',
  DTMF_SEQUENCE_COMPLETED: 'dtmf:sequenceCompleted',
  DTMF_FAILED: 'dtmf:failed',

  // Error events
  ERROR: 'error',
} as const

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * LocalStorage key prefix for VueSip
 * All keys are namespaced to avoid conflicts
 */
export const STORAGE_PREFIX = 'vuesip:'

/**
 * Storage version for migration support
 */
export const STORAGE_VERSION = 'v1'

/**
 * Storage keys for persisted data
 */
export const STORAGE_KEYS = {
  CONFIG: `${STORAGE_PREFIX}${STORAGE_VERSION}:config`,
  CREDENTIALS: `${STORAGE_PREFIX}${STORAGE_VERSION}:credentials`,
  DEVICE_PREFERENCES: `${STORAGE_PREFIX}${STORAGE_VERSION}:devices`,
  USER_PREFERENCES: `${STORAGE_PREFIX}${STORAGE_VERSION}:preferences`,
  CALL_HISTORY: `${STORAGE_PREFIX}${STORAGE_VERSION}:history`,
} as const

// ============================================================================
// Performance Targets
// ============================================================================

/**
 * Performance targets and limits
 */
export const PERFORMANCE = {
  /** Maximum bundle size in bytes (minified) */
  MAX_BUNDLE_SIZE: 150 * 1024, // 150 KB

  /** Maximum bundle size in bytes (gzipped) */
  MAX_BUNDLE_SIZE_GZIPPED: 50 * 1024, // 50 KB

  /** Target call setup time in milliseconds */
  TARGET_CALL_SETUP_TIME: 2000, // 2 seconds

  /** Maximum state update latency in milliseconds */
  MAX_STATE_UPDATE_LATENCY: 50, // 50ms

  /** Maximum event propagation time in milliseconds */
  MAX_EVENT_PROPAGATION_TIME: 10, // 10ms

  /** Maximum memory per call in bytes */
  MAX_MEMORY_PER_CALL: 50 * 1024 * 1024, // 50 MB

  /** Target CPU usage during call (percentage) */
  TARGET_CPU_USAGE: 15, // 15%

  /** Default maximum concurrent calls */
  DEFAULT_MAX_CONCURRENT_CALLS: 5,

  /** Default maximum call history entries */
  DEFAULT_MAX_HISTORY_ENTRIES: 1000,
} as const

// ============================================================================
// Regular Expressions
// ============================================================================

/**
 * Regular expression for SIP URI validation
 * Matches: sip:user@domain or sips:user@domain
 */
export const SIP_URI_REGEX = /^sips?:([a-zA-Z0-9._+-]+)@([a-zA-Z0-9.-]+)(?::(\d+))?/

/**
 * Regular expression for E.164 phone number format
 * Matches: +[country code][number]
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/

/**
 * Regular expression for WebSocket URL validation
 * Matches: ws:// or wss://
 */
export const WEBSOCKET_URL_REGEX = /^wss?:\/\/.+/

// ============================================================================
// Type Guards and Helpers
// ============================================================================

/**
 * Valid DTMF tones
 */
export const DTMF_TONES = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '*',
  '#',
  'A',
  'B',
  'C',
  'D',
] as const

/**
 * Valid log levels
 */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

/**
 * Valid call states
 */
export const CALL_STATES = [
  'idle',
  'calling',
  'ringing',
  'answering',
  'active',
  'holding',
  'held',
  'terminating',
  'terminated',
] as const

/**
 * Valid connection states
 */
export const CONNECTION_STATES = ['disconnected', 'connecting', 'connected', 'error'] as const

/**
 * Valid registration states
 */
export const REGISTRATION_STATES = [
  'unregistered',
  'registering',
  'registered',
  'unregistering',
  'failed',
] as const
