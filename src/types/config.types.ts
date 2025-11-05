/**
 * Configuration type definitions for DailVue
 * @packageDocumentation
 */

/**
 * TURN server configuration for NAT traversal
 */
export interface TurnServerConfig {
  /** TURN server URLs (e.g., 'turn:turn.example.com:3478') */
  urls: string | string[]
  /** Username for TURN server authentication */
  username?: string
  /** Credential for TURN server authentication */
  credential?: string
  /** Credential type (default: 'password') */
  credentialType?: 'password' | 'oauth'
}

/**
 * Media configuration for audio and video streams
 */
export interface MediaConfiguration {
  /** Audio constraints */
  audio?: boolean | MediaTrackConstraints
  /** Video constraints */
  video?: boolean | MediaTrackConstraints
  /** Enable echo cancellation (default: true) */
  echoCancellation?: boolean
  /** Enable noise suppression (default: true) */
  noiseSuppression?: boolean
  /** Enable auto gain control (default: true) */
  autoGainControl?: boolean
  /** Preferred audio codec */
  audioCodec?: 'opus' | 'pcmu' | 'pcma' | 'g722'
  /** Preferred video codec */
  videoCodec?: 'vp8' | 'vp9' | 'h264'
  /** Enable data channel */
  dataChannel?: boolean
}

/**
 * User preferences for the SIP client
 */
export interface UserPreferences {
  /** Default audio input device ID */
  audioInputDeviceId?: string
  /** Default audio output device ID */
  audioOutputDeviceId?: string
  /** Default video input device ID */
  videoInputDeviceId?: string
  /** Enable local audio by default */
  enableAudio?: boolean
  /** Enable local video by default */
  enableVideo?: boolean
  /** Auto-answer incoming calls */
  autoAnswer?: boolean
  /** Auto-answer delay in milliseconds */
  autoAnswerDelay?: number
  /** Ring tone URL */
  ringToneUrl?: string
  /** Ring back tone URL */
  ringBackToneUrl?: string
  /** Enable DTMF tones */
  enableDtmfTones?: boolean
}

/**
 * Extended RTCConfiguration with DailVue-specific options
 */
export interface ExtendedRTCConfiguration extends RTCConfiguration {
  /** STUN server URLs */
  stunServers?: string[]
  /** TURN server configurations */
  turnServers?: TurnServerConfig[]
  /** ICE transport policy */
  iceTransportPolicy?: RTCIceTransportPolicy
  /** Bundle policy */
  bundlePolicy?: RTCBundlePolicy
  /** RTC configuration */
  rtcpMuxPolicy?: RTCRtcpMuxPolicy
  /** ICE candidate pool size */
  iceCandidatePoolSize?: number
}

/**
 * Main SIP client configuration
 */
export interface SipClientConfig {
  /** WebSocket SIP server URI (e.g., 'wss://sip.example.com:7443') */
  uri: string
  /** SIP user URI (e.g., 'sip:user@domain.com') */
  sipUri: string
  /** SIP password for authentication */
  password: string
  /** Display name for the user */
  displayName?: string
  /** Authorization username (if different from SIP username) */
  authorizationUsername?: string
  /** SIP realm for authentication */
  realm?: string
  /** HA1 hash for enhanced security (alternative to password) */
  ha1?: string

  /** WebSocket connection options */
  wsOptions?: {
    /** WebSocket protocols */
    protocols?: string[]
    /** Connection timeout in milliseconds (default: 10000) */
    connectionTimeout?: number
    /** Maximum reconnection attempts (default: 5) */
    maxReconnectionAttempts?: number
    /** Reconnection delay in milliseconds (default: 2000) */
    reconnectionDelay?: number
  }

  /** Registration options */
  registrationOptions?: {
    /** Registration expiry time in seconds (default: 600) */
    expires?: number
    /** Enable automatic registration on connection (default: true) */
    autoRegister?: boolean
    /** Registration retry interval in milliseconds (default: 30000) */
    registrationRetryInterval?: number
  }

  /** Session options */
  sessionOptions?: {
    /** Session timers (default: true) */
    sessionTimers?: boolean
    /** Session timers refresh method */
    sessionTimersRefreshMethod?: 'UPDATE' | 'INVITE'
    /** Maximum concurrent calls (default: 1) */
    maxConcurrentCalls?: number
    /** Call timeout in milliseconds (default: 60000) */
    callTimeout?: number
  }

  /** Media configuration */
  mediaConfiguration?: MediaConfiguration

  /** RTC configuration */
  rtcConfiguration?: ExtendedRTCConfiguration

  /** User preferences */
  userPreferences?: UserPreferences

  /** User agent string */
  userAgent?: string

  /** Enable debug mode */
  debug?: boolean

  /** Logger instance (if custom logging is needed) */
  logger?: {
    debug: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
  }
}

/**
 * Validation result for configuration
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean
  /** Error messages if validation failed */
  errors?: string[]
  /** Warning messages */
  warnings?: string[]
}
