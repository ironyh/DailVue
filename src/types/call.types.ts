/**
 * Call-related type definitions
 * @packageDocumentation
 */

import type { SipUri } from './sip.types'

/**
 * Call state enumeration
 */
export enum CallState {
  /** No active call */
  Idle = 'idle',
  /** Outgoing call initiated */
  Calling = 'calling',
  /** Incoming call ringing */
  Ringing = 'ringing',
  /** Call is being answered */
  Answering = 'answering',
  /** Call is in early media state */
  EarlyMedia = 'early_media',
  /** Call is active */
  Active = 'active',
  /** Call is on hold (local) */
  Held = 'held',
  /** Call is on hold (remote) */
  RemoteHeld = 'remote_held',
  /** Call is terminating */
  Terminating = 'terminating',
  /** Call has ended */
  Terminated = 'terminated',
  /** Call failed */
  Failed = 'failed',
}

/**
 * Call direction
 */
export enum CallDirection {
  /** Outgoing call */
  Outgoing = 'outgoing',
  /** Incoming call */
  Incoming = 'incoming',
}

/**
 * Call termination cause
 */
export enum TerminationCause {
  /** Call was canceled */
  Canceled = 'canceled',
  /** Call was rejected */
  Rejected = 'rejected',
  /** Call was not answered */
  NoAnswer = 'no_answer',
  /** Call was unavailable */
  Unavailable = 'unavailable',
  /** Call was busy */
  Busy = 'busy',
  /** Normal call clearing */
  Bye = 'bye',
  /** Request timeout */
  RequestTimeout = 'request_timeout',
  /** WebRTC error */
  WebRtcError = 'webrtc_error',
  /** Internal error */
  InternalError = 'internal_error',
  /** Network error */
  NetworkError = 'network_error',
  /** Other reason */
  Other = 'other',
}

/**
 * Call options for making a call
 */
export interface CallOptions {
  /** Media constraints */
  mediaConstraints?: {
    audio?: boolean | MediaTrackConstraints
    video?: boolean | MediaTrackConstraints
  }
  /** RTC configuration override */
  rtcConfiguration?: RTCConfiguration
  /** Custom SIP headers */
  extraHeaders?: string[]
  /** Anonymous call */
  anonymous?: boolean
  /** Enable session timers */
  sessionTimers?: boolean
  /** Session timers expiry (seconds) */
  sessionTimersExpires?: number
  /** PCMA codec only */
  pcmaCodecOnly?: boolean
}

/**
 * Answer options for incoming calls
 */
export interface AnswerOptions {
  /** Media constraints */
  mediaConstraints?: {
    audio?: boolean | MediaTrackConstraints
    video?: boolean | MediaTrackConstraints
  }
  /** RTC configuration override */
  rtcConfiguration?: RTCConfiguration
  /** Custom SIP headers */
  extraHeaders?: string[]
}

/**
 * DTMF options
 */
export interface DTMFOptions {
  /** Duration of the tone in milliseconds (default: 100) */
  duration?: number
  /** Inter-tone gap in milliseconds (default: 70) */
  interToneGap?: number
  /** Transport type */
  transportType?: 'RFC2833' | 'INFO'
}

/**
 * Call timing information
 */
export interface CallTimingInfo {
  /** Time when call was initiated */
  startTime?: Date
  /** Time when call was answered */
  answerTime?: Date
  /** Time when call ended */
  endTime?: Date
  /** Call duration in seconds */
  duration?: number
  /** Ring duration in seconds */
  ringDuration?: number
}

/**
 * Call statistics
 */
export interface CallStatistics {
  /** Audio statistics */
  audio?: {
    /** Bytes sent */
    bytesSent?: number
    /** Bytes received */
    bytesReceived?: number
    /** Packets sent */
    packetsSent?: number
    /** Packets received */
    packetsReceived?: number
    /** Packets lost */
    packetsLost?: number
    /** Jitter in seconds */
    jitter?: number
    /** Round trip time in seconds */
    roundTripTime?: number
    /** Audio level (0-1) */
    audioLevel?: number
    /** Codec name */
    codecName?: string
  }
  /** Video statistics */
  video?: {
    /** Bytes sent */
    bytesSent?: number
    /** Bytes received */
    bytesReceived?: number
    /** Packets sent */
    packetsSent?: number
    /** Packets received */
    packetsReceived?: number
    /** Packets lost */
    packetsLost?: number
    /** Frame rate */
    frameRate?: number
    /** Frame width */
    frameWidth?: number
    /** Frame height */
    frameHeight?: number
    /** Codec name */
    codecName?: string
  }
  /** Network statistics */
  network?: {
    /** Current round trip time */
    currentRoundTripTime?: number
    /** Available outgoing bitrate */
    availableOutgoingBitrate?: number
    /** Available incoming bitrate */
    availableIncomingBitrate?: number
  }
}

/**
 * Call session interface
 */
export interface CallSession {
  /** Unique call ID */
  id: string
  /** Call state */
  state: CallState
  /** Call direction */
  direction: CallDirection
  /** Local SIP URI */
  localUri: string | SipUri
  /** Remote SIP URI */
  remoteUri: string | SipUri
  /** Remote display name */
  remoteDisplayName?: string
  /** Local media stream */
  localStream?: MediaStream
  /** Remote media stream */
  remoteStream?: MediaStream
  /** Is call on hold */
  isOnHold: boolean
  /** Is call muted */
  isMuted: boolean
  /** Is remote video enabled */
  hasRemoteVideo: boolean
  /** Is local video enabled */
  hasLocalVideo: boolean
  /** Call timing information */
  timing: CallTimingInfo
  /** Termination cause (if terminated) */
  terminationCause?: TerminationCause
  /** Custom data */
  data?: Record<string, any>
}

/**
 * Call event
 */
export interface CallEvent {
  /** Event type */
  type: string
  /** Call session */
  session: CallSession
  /** Original event data */
  originalEvent?: any
  /** Timestamp */
  timestamp: Date
}

/**
 * Call progress event (provisional responses)
 */
export interface CallProgressEvent extends CallEvent {
  type: 'progress'
  /** Response code (e.g., 180, 183) */
  responseCode: number
  /** Reason phrase */
  reasonPhrase: string
}

/**
 * Call failed event
 */
export interface CallFailedEvent extends CallEvent {
  type: 'failed'
  /** Termination cause */
  cause: TerminationCause
  /** Response code */
  responseCode?: number
  /** Reason phrase */
  reasonPhrase?: string
  /** Error message */
  message?: string
}

/**
 * Call ended event
 */
export interface CallEndedEvent extends CallEvent {
  type: 'ended'
  /** Termination cause */
  cause: TerminationCause
  /** Originator of the BYE */
  originator: 'local' | 'remote' | 'system'
}

/**
 * Call accepted event
 */
export interface CallAcceptedEvent extends CallEvent {
  type: 'accepted'
  /** Response code */
  responseCode: number
}

/**
 * Call confirmed event
 */
export interface CallConfirmedEvent extends CallEvent {
  type: 'confirmed'
}

/**
 * Call hold event
 */
export interface CallHoldEvent extends CallEvent {
  type: 'hold' | 'unhold'
  /** Originator of the hold/unhold */
  originator: 'local' | 'remote'
}

/**
 * Call mute event
 */
export interface CallMuteEvent extends CallEvent {
  type: 'muted' | 'unmuted'
}
