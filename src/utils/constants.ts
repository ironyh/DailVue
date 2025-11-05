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
 * User-Agent string format
 * Format: DailVue/<version> (<platform>)
 */
export const USER_AGENT = `DailVue/${VERSION} (${typeof navigator !== 'undefined' ? navigator.userAgent : 'Node'})`

/**
 * Default SIP configuration values
 */
export const DEFAULT_SIP_CONFIG = {
  /** Default registration expiry time in seconds */
  REGISTRATION_EXPIRES: 600,

  /** Enable automatic registration on connection */
  AUTO_REGISTER: true,

  /** Registration retry interval in milliseconds */
  REGISTRATION_RETRY_INTERVAL: 30000,

  /** Enable session timers */
  SESSION_TIMERS: true,

  /** Session timers refresh method */
  SESSION_TIMERS_REFRESH_METHOD: 'UPDATE' as const,

  /** Maximum concurrent calls */
  MAX_CONCURRENT_CALLS: 1,

  /** Call timeout in milliseconds */
  CALL_TIMEOUT: 60000,

  /** Display name fallback */
  DEFAULT_DISPLAY_NAME: 'DailVue User',
} as const

/**
 * Default WebSocket configuration
 */
export const DEFAULT_WS_CONFIG = {
  /** WebSocket protocols */
  PROTOCOLS: ['sip'],

  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 10000,

  /** Maximum reconnection attempts */
  MAX_RECONNECTION_ATTEMPTS: 5,

  /** Reconnection delay in milliseconds */
  RECONNECTION_DELAY: 2000,

  /** Keep-alive interval in milliseconds */
  KEEP_ALIVE_INTERVAL: 25000,
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
 * Recommended audio constraints for high quality
 */
export const HIGH_QUALITY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
}

/**
 * Recommended audio constraints for low bandwidth
 */
export const LOW_BANDWIDTH_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 16000,
  channelCount: 1,
}

/**
 * Recommended video constraints for HD quality
 */
export const HD_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
}

/**
 * Recommended video constraints for standard quality
 */
export const SD_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30 },
}

/**
 * Recommended video constraints for low bandwidth
 */
export const LOW_BANDWIDTH_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 15 },
}

/**
 * Default RTC configuration
 */
export const DEFAULT_RTC_CONFIGURATION: ExtendedRTCConfiguration = {
  iceServers: [
    // Public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 0,
}

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Connection timeout */
  CONNECTION: 10000,

  /** Registration timeout */
  REGISTRATION: 30000,

  /** Call setup timeout */
  CALL_SETUP: 60000,

  /** DTMF tone duration */
  DTMF_DURATION: 100,

  /** DTMF inter-tone gap */
  DTMF_GAP: 70,

  /** Statistics collection interval */
  STATS_INTERVAL: 1000,

  /** ICE gathering timeout */
  ICE_GATHERING: 5000,

  /** Network reconnection timeout */
  RECONNECTION: 30000,
} as const

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  /** Maximum retry attempts */
  MAX_ATTEMPTS: 5,

  /** Retry delays in milliseconds (exponential backoff) */
  DELAYS: [2000, 4000, 8000, 16000, 32000] as const,

  /** Jitter factor for randomizing delays */
  JITTER_FACTOR: 0.1,
} as const

/**
 * Supported audio codecs in order of preference
 */
export const AUDIO_CODECS = [
  {
    name: 'opus',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    priority: 1,
  },
  {
    name: 'pcmu',
    mimeType: 'audio/PCMU',
    clockRate: 8000,
    channels: 1,
    priority: 2,
  },
  {
    name: 'pcma',
    mimeType: 'audio/PCMA',
    clockRate: 8000,
    channels: 1,
    priority: 3,
  },
  {
    name: 'g722',
    mimeType: 'audio/G722',
    clockRate: 8000,
    channels: 1,
    priority: 4,
  },
] as const

/**
 * Supported video codecs in order of preference
 */
export const VIDEO_CODECS = [
  {
    name: 'vp8',
    mimeType: 'video/VP8',
    clockRate: 90000,
    priority: 1,
  },
  {
    name: 'vp9',
    mimeType: 'video/VP9',
    clockRate: 90000,
    priority: 2,
  },
  {
    name: 'h264',
    mimeType: 'video/H264',
    clockRate: 90000,
    priority: 3,
  },
] as const

/**
 * SIP response code ranges
 */
export const SIP_RESPONSE_CLASSES = {
  PROVISIONAL: { min: 100, max: 199 },
  SUCCESS: { min: 200, max: 299 },
  REDIRECTION: { min: 300, max: 399 },
  CLIENT_ERROR: { min: 400, max: 499 },
  SERVER_ERROR: { min: 500, max: 599 },
  GLOBAL_FAILURE: { min: 600, max: 699 },
} as const

/**
 * Event names
 */
export const EVENTS = {
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTION_FAILED: 'connection_failed',
  RECONNECTING: 'reconnecting',

  // Registration events
  REGISTERED: 'registered',
  UNREGISTERED: 'unregistered',
  REGISTERING: 'registering',
  REGISTRATION_FAILED: 'registration_failed',

  // Call events
  CALL_INCOMING: 'call:incoming',
  CALL_OUTGOING: 'call:outgoing',
  CALL_PROGRESS: 'call:progress',
  CALL_RINGING: 'call:ringing',
  CALL_ACCEPTED: 'call:accepted',
  CALL_CONFIRMED: 'call:confirmed',
  CALL_FAILED: 'call:failed',
  CALL_ENDED: 'call:ended',
  CALL_HOLD: 'call:hold',
  CALL_UNHOLD: 'call:unhold',
  CALL_MUTED: 'call:muted',
  CALL_UNMUTED: 'call:unmuted',

  // Media events
  MEDIA_STREAM_ADDED: 'media:stream:added',
  MEDIA_STREAM_REMOVED: 'media:stream:removed',
  MEDIA_TRACK_ADDED: 'media:track:added',
  MEDIA_TRACK_REMOVED: 'media:track:removed',
  MEDIA_DEVICE_CHANGED: 'media:device:changed',

  // Transfer events
  TRANSFER_INITIATED: 'transfer:initiated',
  TRANSFER_ACCEPTED: 'transfer:accepted',
  TRANSFER_FAILED: 'transfer:failed',
  TRANSFER_COMPLETED: 'transfer:completed',

  // Error events
  ERROR: 'error',
} as const

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  /** Prefix for all storage keys */
  PREFIX: 'dailvue:',

  /** Version key */
  VERSION: 'dailvue:version',

  /** SIP credentials */
  CREDENTIALS: 'dailvue:credentials',

  /** Device preferences */
  DEVICE_PREFS: 'dailvue:device-prefs',

  /** Call history */
  CALL_HISTORY: 'dailvue:call-history',

  /** User preferences */
  USER_PREFS: 'dailvue:user-prefs',
} as const

/**
 * Call history limits
 */
export const CALL_HISTORY = {
  /** Maximum number of call history entries to store */
  MAX_ENTRIES: 1000,

  /** Maximum age of call history entries in days */
  MAX_AGE_DAYS: 90,

  /** Default page size for pagination */
  DEFAULT_PAGE_SIZE: 50,
} as const

/**
 * Statistics thresholds
 */
export const STATS_THRESHOLDS = {
  /** High packet loss percentage */
  HIGH_PACKET_LOSS: 5,

  /** Very high packet loss percentage */
  VERY_HIGH_PACKET_LOSS: 10,

  /** High jitter in milliseconds */
  HIGH_JITTER: 30,

  /** High round trip time in milliseconds */
  HIGH_RTT: 300,

  /** Low audio level (0-1) */
  LOW_AUDIO_LEVEL: 0.1,

  /** Minimum bitrate for good quality (kbps) */
  MIN_GOOD_BITRATE: 32,
} as const

/**
 * Browser feature detection flags
 */
export const BROWSER_SUPPORT = {
  /** WebRTC supported */
  HAS_WEBRTC: typeof RTCPeerConnection !== 'undefined',

  /** getUserMedia supported */
  HAS_GET_USER_MEDIA: typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function',

  /** WebSocket supported */
  HAS_WEBSOCKET: typeof WebSocket !== 'undefined',

  /** IndexedDB supported */
  HAS_INDEXEDDB: typeof indexedDB !== 'undefined',

  /** LocalStorage supported */
  HAS_LOCALSTORAGE: typeof localStorage !== 'undefined',

  /** AudioContext supported */
  HAS_AUDIO_CONTEXT: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
} as const

/**
 * Performance targets
 */
export const PERFORMANCE_TARGETS = {
  /** Target bundle size in KB (minified, gzipped) */
  BUNDLE_SIZE_KB: 50,

  /** Maximum call setup time in milliseconds */
  MAX_CALL_SETUP_TIME: 2000,

  /** Maximum state update latency in milliseconds */
  MAX_STATE_UPDATE_LATENCY: 50,

  /** Maximum event propagation time in milliseconds */
  MAX_EVENT_PROPAGATION_TIME: 10,

  /** Maximum memory per call in MB */
  MAX_MEMORY_PER_CALL: 50,

  /** Maximum CPU usage during call percentage */
  MAX_CPU_USAGE: 15,
} as const
