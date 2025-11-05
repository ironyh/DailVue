/**
 * Constants and default values for DailVue
 * @packageDocumentation
 */

import type { MediaConfiguration, ExtendedRTCConfiguration } from '@/types'

/**
 * Library version
 */
export const VERSION = '1.0.0'

/**
 * Default SIP configuration values
 */
export const DEFAULT_SIP_CONFIG = {
  /** Default WebSocket connection timeout (ms) */
  CONNECTION_TIMEOUT: 10000,

  /** Default maximum reconnection attempts */
  MAX_RECONNECTION_ATTEMPTS: 5,

  /** Default reconnection delay (ms) */
  RECONNECTION_DELAY: 2000,

  /** Default registration expiry (seconds) */
  REGISTRATION_EXPIRES: 600,

  /** Default registration retry interval (ms) */
  REGISTRATION_RETRY_INTERVAL: 30000,

  /** Default call timeout (ms) */
  CALL_TIMEOUT: 60000,

  /** Default maximum concurrent calls */
  MAX_CONCURRENT_CALLS: 1,

  /** Enable session timers by default */
  SESSION_TIMERS: true,

  /** Default session timers refresh method */
  SESSION_TIMERS_REFRESH_METHOD: 'UPDATE' as const,

  /** Auto-register on connection */
  AUTO_REGISTER: true,
} as const

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  /** Retry delays in milliseconds for exponential backoff */
  DELAYS: [2000, 4000, 8000, 16000, 32000],

  /** Maximum retry attempts */
  MAX_ATTEMPTS: 5,

  /** Jitter factor (0-1) for randomizing retry delays */
  JITTER_FACTOR: 0.1,
} as const

/**
 * Timeout values (milliseconds)
 */
export const TIMEOUTS = {
  /** WebSocket connection timeout */
  WS_CONNECTION: 10000,

  /** SIP transaction timeout */
  SIP_TRANSACTION: 32000,

  /** Call setup timeout */
  CALL_SETUP: 60000,

  /** DTMF tone duration */
  DTMF_DURATION: 100,

  /** DTMF inter-tone gap */
  DTMF_GAP: 70,

  /** ICE gathering timeout */
  ICE_GATHERING: 5000,

  /** Media permission request timeout */
  MEDIA_PERMISSION: 10000,

  /** Keep-alive interval (OPTIONS ping) */
  KEEP_ALIVE: 30000,
} as const

/**
 * Default media constraints
 */
export const DEFAULT_MEDIA_CONSTRAINTS: MediaConfiguration = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  audioCodec: 'opus',
  dataChannel: false,
}

/**
 * Supported audio codecs in order of preference
 */
export const AUDIO_CODECS = {
  OPUS: 'opus',
  PCMU: 'pcmu',
  PCMA: 'pcma',
  G722: 'g722',
} as const

/**
 * Supported video codecs in order of preference
 */
export const VIDEO_CODECS = {
  VP8: 'vp8',
  VP9: 'vp9',
  H264: 'h264',
} as const

/**
 * Codec MIME types
 */
export const CODEC_MIME_TYPES = {
  // Audio
  OPUS: 'audio/opus',
  PCMU: 'audio/PCMU',
  PCMA: 'audio/PCMA',
  G722: 'audio/G722',

  // Video
  VP8: 'video/VP8',
  VP9: 'video/VP9',
  H264: 'video/H264',
} as const

/**
 * Default STUN servers
 */
export const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
] as const

/**
 * Default RTC configuration
 */
export const DEFAULT_RTC_CONFIG: ExtendedRTCConfiguration = {
  iceServers: [
    {
      urls: DEFAULT_STUN_SERVERS as unknown as string[],
    },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 0,
}

/**
 * User-Agent string format
 */
export const USER_AGENT = `DailVue/${VERSION}` as const

/**
 * SIP response codes
 */
export const SIP_RESPONSE_CODES = {
  // Provisional 1xx
  TRYING: 100,
  RINGING: 180,
  SESSION_PROGRESS: 183,

  // Success 2xx
  OK: 200,

  // Redirection 3xx
  MOVED_PERMANENTLY: 301,
  MOVED_TEMPORARILY: 302,

  // Client Error 4xx
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PROXY_AUTH_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  TEMPORARILY_UNAVAILABLE: 480,
  BUSY_HERE: 486,
  REQUEST_TERMINATED: 487,

  // Server Error 5xx
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,

  // Global Failure 6xx
  BUSY_EVERYWHERE: 600,
  DECLINE: 603,
} as const

/**
 * SIP headers
 */
export const SIP_HEADERS = {
  USER_AGENT: 'User-Agent',
  CONTENT_TYPE: 'Content-Type',
  ALLOW: 'Allow',
  SUPPORTED: 'Supported',
  REQUIRE: 'Require',
  CONTACT: 'Contact',
  FROM: 'From',
  TO: 'To',
  VIA: 'Via',
  CALL_ID: 'Call-ID',
  CSEQ: 'CSeq',
} as const

/**
 * Event names used internally
 */
export const INTERNAL_EVENTS = {
  // Transport events
  TRANSPORT_CONNECTED: 'transport:connected',
  TRANSPORT_DISCONNECTED: 'transport:disconnected',
  TRANSPORT_ERROR: 'transport:error',

  // Registration events
  REGISTRATION_SENT: 'registration:sent',
  REGISTRATION_SUCCESS: 'registration:success',
  REGISTRATION_FAILED: 'registration:failed',

  // Call events
  CALL_CREATED: 'call:created',
  CALL_DESTROYED: 'call:destroyed',

  // Media events
  MEDIA_ACQUIRED: 'media:acquired',
  MEDIA_RELEASED: 'media:released',
} as const

/**
 * Storage keys for persistence
 */
export const STORAGE_KEYS = {
  PREFIX: 'dailvue',
  VERSION: 'v1',

  // Specific keys
  CONFIG: 'dailvue:v1:config',
  CREDENTIALS: 'dailvue:v1:credentials',
  PREFERENCES: 'dailvue:v1:preferences',
  DEVICES: 'dailvue:v1:devices',
  HISTORY: 'dailvue:v1:history',
} as const

/**
 * IndexedDB configuration for call history
 */
export const INDEXEDDB_CONFIG = {
  DATABASE_NAME: 'dailvue',
  VERSION: 1,
  STORES: {
    CALL_HISTORY: 'callHistory',
    MESSAGES: 'messages',
    RECORDINGS: 'recordings',
  },
} as const

/**
 * Maximum limits
 */
export const LIMITS = {
  /** Maximum call history entries to keep */
  MAX_HISTORY_ENTRIES: 1000,

  /** Maximum message history entries */
  MAX_MESSAGE_ENTRIES: 1000,

  /** Maximum concurrent calls */
  MAX_CONCURRENT_CALLS: 5,

  /** Maximum DTMF tone sequence length */
  MAX_DTMF_SEQUENCE_LENGTH: 32,

  /** Maximum file size for recordings (bytes) */
  MAX_RECORDING_SIZE: 100 * 1024 * 1024, // 100 MB
} as const

/**
 * Feature flags
 */
export const FEATURES = {
  /** Enable video calls */
  VIDEO: true,

  /** Enable call recording */
  RECORDING: true,

  /** Enable call transfer */
  TRANSFER: true,

  /** Enable presence */
  PRESENCE: true,

  /** Enable messaging */
  MESSAGING: true,

  /** Enable conference calls */
  CONFERENCE: true,

  /** Enable call history */
  HISTORY: true,
} as const

/**
 * Regular expressions
 */
export const REGEX = {
  /** SIP URI pattern */
  SIP_URI:
    /^(sip|sips):([a-zA-Z0-9\-_.!~*'()&=+$,;?/])+@([a-zA-Z0-9\-_.]+\.)*[a-zA-Z0-9\-_.]+(:[\d]+)?(;[^\s]*)?$/,

  /** WebSocket URI pattern */
  WS_URI: /^(ws|wss):\/\/([a-zA-Z0-9\-_.]+\.)*[a-zA-Z0-9\-_.]+(:[\d]+)?(\/[^\s]*)?$/,

  /** Phone number pattern (E.164) */
  PHONE_E164: /^\+?[1-9]\d{6,14}$/,

  /** Email pattern */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  /** DTMF digits */
  DTMF: /^[0-9A-D*#]+$/,
} as const

/**
 * DTMF tones mapping
 */
export const DTMF_TONES = {
  '0': { frequency: [941, 1336] },
  '1': { frequency: [697, 1209] },
  '2': { frequency: [697, 1336] },
  '3': { frequency: [697, 1477] },
  '4': { frequency: [770, 1209] },
  '5': { frequency: [770, 1336] },
  '6': { frequency: [770, 1477] },
  '7': { frequency: [852, 1209] },
  '8': { frequency: [852, 1336] },
  '9': { frequency: [852, 1477] },
  '*': { frequency: [941, 1209] },
  '#': { frequency: [941, 1477] },
  A: { frequency: [697, 1633] },
  B: { frequency: [770, 1633] },
  C: { frequency: [852, 1633] },
  D: { frequency: [941, 1633] },
} as const

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  // Connection errors
  CONNECTION_FAILED: 'Failed to connect to SIP server',
  CONNECTION_TIMEOUT: 'Connection timeout',
  CONNECTION_CLOSED: 'Connection closed',

  // Registration errors
  REGISTRATION_FAILED: 'SIP registration failed',
  AUTHENTICATION_FAILED: 'Authentication failed',

  // Call errors
  CALL_FAILED: 'Call failed',
  CALL_REJECTED: 'Call rejected',
  CALL_TIMEOUT: 'Call timeout',
  MEDIA_FAILED: 'Failed to acquire media',

  // Media errors
  MEDIA_PERMISSION_DENIED: 'Media permission denied',
  MEDIA_DEVICE_NOT_FOUND: 'Media device not found',

  // General errors
  INVALID_CONFIG: 'Invalid configuration',
  INVALID_STATE: 'Invalid state',
  NOT_IMPLEMENTED: 'Not implemented',
} as const
