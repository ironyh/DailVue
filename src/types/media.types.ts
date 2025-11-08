/**
 * Media-related type definitions
 * @packageDocumentation
 */

/**
 * Media device kind
 */
export enum MediaDeviceKind {
  AudioInput = 'audioinput',
  AudioOutput = 'audiooutput',
  VideoInput = 'videoinput',
}

/**
 * Media device information
 */
export interface MediaDevice {
  /** Device ID */
  deviceId: string
  /** Device kind */
  kind: MediaDeviceKind
  /** Device label */
  label: string
  /** Group ID */
  groupId: string
  /** Is default device */
  isDefault?: boolean
}

/**
 * Audio device (alias for MediaDevice for backward compatibility)
 */
export type AudioDevice = MediaDevice

/**
 * Permission status for media devices
 */
export enum PermissionStatus {
  /** Permission granted */
  Granted = 'granted',
  /** Permission denied */
  Denied = 'denied',
  /** Permission prompt */
  Prompt = 'prompt',
  /** Permission not requested */
  NotRequested = 'not_requested',
}

/**
 * Media permissions
 */
export interface MediaPermissions {
  /** Audio permission status */
  audio: PermissionStatus
  /** Video permission status */
  video: PermissionStatus
}

/**
 * Audio statistics
 */
export interface AudioStatistics {
  /** Audio input level (0-1) */
  inputLevel?: number
  /** Audio output level (0-1) */
  outputLevel?: number
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
  /** Packet loss percentage */
  packetLossPercentage?: number
  /** Jitter (seconds) */
  jitter?: number
  /** Round trip time (seconds) */
  roundTripTime?: number
  /** Audio codec */
  codec?: string
  /** Bitrate (bits per second) */
  bitrate?: number
  /** Sample rate */
  sampleRate?: number
  /** Channels */
  channels?: number
}

/**
 * Video statistics
 */
export interface VideoStatistics {
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
  /** Packet loss percentage */
  packetLossPercentage?: number
  /** Frame rate */
  frameRate?: number
  /** Frame width */
  frameWidth?: number
  /** Frame height */
  frameHeight?: number
  /** Frames sent */
  framesSent?: number
  /** Frames received */
  framesReceived?: number
  /** Frames dropped */
  framesDropped?: number
  /** Video codec */
  codec?: string
  /** Bitrate (bits per second) */
  bitrate?: number
}

/**
 * Network statistics
 */
export interface NetworkStatistics {
  /** Current round trip time */
  currentRoundTripTime?: number
  /** Available outgoing bitrate */
  availableOutgoingBitrate?: number
  /** Available incoming bitrate */
  availableIncomingBitrate?: number
  /** Total bytes sent */
  totalBytesSent?: number
  /** Total bytes received */
  totalBytesReceived?: number
  /** Transport type */
  transportType?: string
  /** Local candidate type */
  localCandidateType?: string
  /** Remote candidate type */
  remoteCandidateType?: string
}

/**
 * Combined media statistics
 */
export interface MediaStatistics {
  /** Audio statistics */
  audio?: AudioStatistics
  /** Video statistics */
  video?: VideoStatistics
  /** Network statistics */
  network?: NetworkStatistics
  /** Timestamp */
  timestamp: Date
}

/**
 * Recording state
 */
export enum RecordingState {
  /** Not recording */
  Inactive = 'inactive',
  /** Recording in progress */
  Recording = 'recording',
  /** Recording paused */
  Paused = 'paused',
  /** Recording stopped */
  Stopped = 'stopped',
  /** Recording error */
  Error = 'error',
}

/**
 * Recording options
 */
export interface RecordingOptions {
  /** MIME type (e.g., 'audio/webm', 'video/webm') */
  mimeType?: string
  /** Audio bits per second */
  audioBitsPerSecond?: number
  /** Video bits per second */
  videoBitsPerSecond?: number
  /** Time slice in milliseconds */
  timeslice?: number
  /** Include audio */
  audio?: boolean
  /** Include video */
  video?: boolean
}

/**
 * Recording data
 */
export interface RecordingData {
  /** Recording ID */
  id: string
  /** Call ID associated with this recording */
  callId?: string
  /** Current recording state */
  state?: RecordingState
  /** Blob data */
  blob?: Blob
  /** MIME type */
  mimeType: string
  /** Duration in milliseconds */
  duration?: number
  /** Size in bytes */
  size?: number
  /** Start time */
  startTime: Date
  /** End time */
  endTime?: Date
}

/**
 * Media stream event
 */
export interface MediaStreamEvent {
  /** Event type */
  type: 'addtrack' | 'removetrack' | 'active' | 'inactive'
  /** Media stream */
  stream: MediaStream
  /** Track (if applicable) */
  track?: MediaStreamTrack
  /** Timestamp */
  timestamp: Date
}

/**
 * Media track event
 */
export interface MediaTrackEvent {
  /** Event type */
  type: 'mute' | 'unmute' | 'ended'
  /** Track */
  track: MediaStreamTrack
  /** Timestamp */
  timestamp: Date
}

/**
 * Media device change event
 */
export interface MediaDeviceChangeEvent {
  /** Event type */
  type: 'devicechange'
  /** Added devices */
  addedDevices: MediaDevice[]
  /** Removed devices */
  removedDevices: MediaDevice[]
  /** Current devices */
  currentDevices: MediaDevice[]
  /** Timestamp */
  timestamp: Date
}

/**
 * Media error
 */
export interface MediaError {
  /** Error name */
  name: string
  /** Error message */
  message: string
  /** Constraint that failed (if applicable) */
  constraint?: string
}

/**
 * Extended media stream constraints
 */
export interface ExtendedMediaStreamConstraints extends MediaStreamConstraints {
  /** Audio device ID */
  audioDeviceId?: string
  /** Video device ID */
  videoDeviceId?: string
  /** Echo cancellation */
  echoCancellation?: boolean
  /** Noise suppression */
  noiseSuppression?: boolean
  /** Auto gain control */
  autoGainControl?: boolean
}

/**
 * DTMF Sender interface
 *
 * Represents the DTMF sender for sending dual-tone multi-frequency signaling.
 * Used for sending telephone keypad tones (0-9, *, #, A-D) during active calls.
 *
 * This is a browser API provided by WebRTC's RTCRtpSender.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCDTMFSender
 *
 * @example
 * ```typescript
 * const audioSender = peerConnection.getSenders()
 *   .find(sender => sender.track?.kind === 'audio') as RTCRtpSenderWithDTMF
 *
 * if (audioSender?.dtmf) {
 *   audioSender.dtmf.insertDTMF('123', 100, 70)
 * }
 * ```
 */
export interface DTMFSender {
  /**
   * Insert DTMF tones into the audio stream
   * @param tones - String of DTMF tones to send (0-9, A-D, *, #)
   * @param duration - Duration of each tone in milliseconds (default: 100)
   * @param interToneGap - Gap between tones in milliseconds (default: 70)
   */
  insertDTMF(tones: string, duration?: number, interToneGap?: number): void

  /** Tone buffer containing queued DTMF tones */
  readonly toneBuffer: string

  /** Event handler called when a tone starts playing */
  ontonechange?: ((event: RTCDTMFToneChangeEvent) => void) | null
}

/**
 * RTCRtpSender with DTMF support
 *
 * Extends the standard RTCRtpSender with the dtmf property for DTMF signaling.
 * Not all senders support DTMF (only audio senders typically do).
 *
 * @example
 * ```typescript
 * const audioSender = senders.find(s => s.track?.kind === 'audio') as RTCRtpSenderWithDTMF
 * if (audioSender && 'dtmf' in audioSender && audioSender.dtmf) {
 *   // DTMF is supported
 * }
 * ```
 */
export interface RTCRtpSenderWithDTMF extends RTCRtpSender {
  /** DTMF sender for this RTP sender (null if not supported) */
  readonly dtmf: DTMFSender | null
}

/**
 * Session Description Handler interface
 *
 * Represents the internal session description handler from JsSIP.
 * This is a minimal interface for accessing the underlying RTCPeerConnection.
 *
 * Note: This interface is intentionally minimal as JsSIP's SessionDescriptionHandler
 * is an internal implementation detail. We only expose the peerConnection property
 * which is needed for accessing RTP senders/receivers.
 */
export interface SessionDescriptionHandler {
  /** The peer connection used by this session */
  peerConnection?: RTCPeerConnection
}
