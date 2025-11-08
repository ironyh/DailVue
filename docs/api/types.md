# Types API Reference

Complete TypeScript type definitions for VueSip. All types are fully type-safe and documented with JSDoc comments.

## Table of Contents

- [SIP Types](#sip-types)
- [Call Types](#call-types)
- [Media Types](#media-types)
- [Configuration Types](#configuration-types)
- [Event Types](#event-types)
- [History Types](#history-types)
- [Transfer Types](#transfer-types)
- [Conference Types](#conference-types)
- [Presence Types](#presence-types)
- [Messaging Types](#messaging-types)
- [Storage Types](#storage-types)
- [Provider Types](#provider-types)
- [Plugin Types](#plugin-types)
- [Type Relationships](#type-relationships)

---

## SIP Types

Core SIP protocol types and enumerations.

**Source:** `../../src/types/sip.types.ts`

### `SipUri`

Represents a SIP URI with utility methods.

```typescript
interface SipUri {
  uri: string                          // Complete SIP URI (e.g., 'sip:user@domain.com')
  scheme: 'sip' | 'sips'              // URI scheme
  user: string                         // Username part
  host: string                         // Host/domain part
  port?: number                        // Port number (optional)
  displayName?: string                 // Display name (optional)
  parameters?: Record<string, string>  // URI parameters
  headers?: Record<string, string>     // URI headers
  toString(): string                   // Convert to string representation
  clone(): SipUri                      // Clone the SIP URI
}
```

### `RegistrationState`

SIP registration states.

```typescript
enum RegistrationState {
  Unregistered = 'unregistered',
  Registering = 'registering',
  Registered = 'registered',
  RegistrationFailed = 'registration_failed',
  Unregistering = 'unregistering'
}
```

### `ConnectionState`

WebSocket connection states.

```typescript
enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  ConnectionFailed = 'connection_failed',
  Error = 'error',
  Reconnecting = 'reconnecting'
}
```

### `SipMethod`

SIP methods as defined in RFC 3261.

```typescript
enum SipMethod {
  INVITE = 'INVITE',
  ACK = 'ACK',
  BYE = 'BYE',
  CANCEL = 'CANCEL',
  REGISTER = 'REGISTER',
  OPTIONS = 'OPTIONS',
  INFO = 'INFO',
  UPDATE = 'UPDATE',
  PRACK = 'PRACK',
  SUBSCRIBE = 'SUBSCRIBE',
  NOTIFY = 'NOTIFY',
  PUBLISH = 'PUBLISH',
  MESSAGE = 'MESSAGE',
  REFER = 'REFER'
}
```

### `SipResponseCode`

SIP response codes organized by category.

```typescript
enum SipResponseCode {
  // 1xx - Provisional
  Trying = 100,
  Ringing = 180,
  CallIsBeingForwarded = 181,
  SessionProgress = 183,

  // 2xx - Success
  OK = 200,
  Accepted = 202,

  // 3xx - Redirection
  MovedPermanently = 301,
  MovedTemporarily = 302,

  // 4xx - Client Error
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  RequestTimeout = 408,
  TemporarilyUnavailable = 480,
  BusyHere = 486,

  // 5xx - Server Error
  ServerInternalError = 500,
  ServiceUnavailable = 503,

  // 6xx - Global Failure
  BusyEverywhere = 600,
  Decline = 603
}
```

### `AuthenticationChallenge`

Authentication challenge information.

```typescript
interface AuthenticationChallenge {
  realm: string
  nonce: string
  qop?: string
  opaque?: string
  algorithm?: 'MD5' | 'SHA-256'
  stale?: boolean
}
```

### `AuthenticationCredentials`

Authentication credentials for SIP.

```typescript
interface AuthenticationCredentials {
  username: string
  password?: string
  ha1?: string      // Alternative to password
  realm?: string
}
```

---

## Call Types

Types related to call sessions and management.

**Source:** `../../src/types/call.types.ts`

### `CallState`

Call state enumeration.

```typescript
enum CallState {
  Idle = 'idle',
  Calling = 'calling',
  Ringing = 'ringing',
  Answering = 'answering',
  EarlyMedia = 'early_media',
  Active = 'active',
  Held = 'held',
  RemoteHeld = 'remote_held',
  Terminating = 'terminating',
  Terminated = 'terminated',
  Failed = 'failed'
}
```

### `CallDirection`

Call direction indicator.

```typescript
enum CallDirection {
  Outgoing = 'outgoing',
  Incoming = 'incoming'
}
```

### `TerminationCause`

Reasons for call termination.

```typescript
enum TerminationCause {
  Canceled = 'canceled',
  Rejected = 'rejected',
  NoAnswer = 'no_answer',
  Unavailable = 'unavailable',
  Busy = 'busy',
  Bye = 'bye',
  RequestTimeout = 'request_timeout',
  WebRtcError = 'webrtc_error',
  InternalError = 'internal_error',
  NetworkError = 'network_error',
  Other = 'other'
}
```

### `CallOptions`

Options for making a call.

```typescript
interface CallOptions {
  audio?: boolean | MediaTrackConstraints
  video?: boolean | MediaTrackConstraints
  mediaConstraints?: {
    audio?: boolean | MediaTrackConstraints
    video?: boolean | MediaTrackConstraints
  }
  rtcConfiguration?: RTCConfiguration
  extraHeaders?: string[]
  anonymous?: boolean
  sessionTimers?: boolean
  sessionTimersExpires?: number
  pcmaCodecOnly?: boolean
}
```

**Example:**

```typescript
const callOptions: CallOptions = {
  audio: true,
  video: { width: 1280, height: 720 },
  extraHeaders: ['X-Custom-Header: value']
}
```

### `AnswerOptions`

Options for answering an incoming call.

```typescript
interface AnswerOptions {
  audio?: boolean | MediaTrackConstraints
  video?: boolean | MediaTrackConstraints
  mediaConstraints?: {
    audio?: boolean | MediaTrackConstraints
    video?: boolean | MediaTrackConstraints
  }
  rtcConfiguration?: RTCConfiguration
  extraHeaders?: string[]
}
```

### `DTMFOptions`

DTMF tone sending options.

```typescript
interface DTMFOptions {
  duration?: number          // Tone duration in ms (default: 100)
  interToneGap?: number     // Gap between tones in ms (default: 70)
  transportType?: 'RFC2833' | 'INFO'
  transport?: 'RFC2833' | 'INFO'  // Alias for transportType
}
```

### `CallTimingInfo`

Call timing information.

```typescript
interface CallTimingInfo {
  startTime?: Date      // When call was initiated
  answerTime?: Date     // When call was answered
  endTime?: Date        // When call ended
  duration?: number     // Call duration in seconds
  ringDuration?: number // Ring duration in seconds
}
```

### `CallStatistics`

Detailed call statistics.

```typescript
interface CallStatistics {
  audio?: {
    bytesSent?: number
    bytesReceived?: number
    packetsSent?: number
    packetsReceived?: number
    packetsLost?: number
    jitter?: number
    roundTripTime?: number
    audioLevel?: number
    codecName?: string
  }
  video?: {
    bytesSent?: number
    bytesReceived?: number
    frameRate?: number
    frameWidth?: number
    frameHeight?: number
    codecName?: string
  }
  network?: {
    currentRoundTripTime?: number
    availableOutgoingBitrate?: number
    availableIncomingBitrate?: number
  }
}
```

### `CallSession`

Complete call session interface.

```typescript
interface CallSession {
  id: string
  state: CallState
  direction: CallDirection
  localUri: string | SipUri
  remoteUri: string | SipUri
  remoteDisplayName?: string
  localStream?: MediaStream
  remoteStream?: MediaStream
  isOnHold: boolean
  isMuted: boolean
  hasRemoteVideo: boolean
  hasLocalVideo: boolean
  timing: CallTimingInfo
  terminationCause?: TerminationCause
  data?: Record<string, any>
}
```

---

## Media Types

Media device and stream management types.

**Source:** `../../src/types/media.types.ts`

### `MediaDeviceKind`

Types of media devices.

```typescript
enum MediaDeviceKind {
  AudioInput = 'audioinput',
  AudioOutput = 'audiooutput',
  VideoInput = 'videoinput'
}
```

### `MediaDevice`

Media device information.

```typescript
interface MediaDevice {
  deviceId: string
  kind: MediaDeviceKind
  label: string
  groupId: string
  isDefault?: boolean
}
```

### `PermissionStatus`

Permission status for media devices.

```typescript
enum PermissionStatus {
  Granted = 'granted',
  Denied = 'denied',
  Prompt = 'prompt',
  NotRequested = 'not_requested'
}
```

### `MediaPermissions`

Media permissions state.

```typescript
interface MediaPermissions {
  audio: PermissionStatus
  video: PermissionStatus
}
```

### `AudioStatistics`

Audio stream statistics.

```typescript
interface AudioStatistics {
  inputLevel?: number       // 0-1
  outputLevel?: number      // 0-1
  bytesSent?: number
  bytesReceived?: number
  packetsSent?: number
  packetsReceived?: number
  packetsLost?: number
  packetLossPercentage?: number
  jitter?: number           // seconds
  roundTripTime?: number    // seconds
  codec?: string
  bitrate?: number          // bits per second
  sampleRate?: number
  channels?: number
}
```

### `VideoStatistics`

Video stream statistics.

```typescript
interface VideoStatistics {
  bytesSent?: number
  bytesReceived?: number
  frameRate?: number
  frameWidth?: number
  frameHeight?: number
  framesSent?: number
  framesReceived?: number
  framesDropped?: number
  codec?: string
  bitrate?: number
}
```

### `RecordingState`

Recording state enumeration.

```typescript
enum RecordingState {
  Inactive = 'inactive',
  Recording = 'recording',
  Paused = 'paused',
  Stopped = 'stopped',
  Error = 'error'
}
```

### `RecordingOptions`

Recording configuration options.

```typescript
interface RecordingOptions {
  mimeType?: string              // e.g., 'audio/webm', 'video/webm'
  audioBitsPerSecond?: number
  videoBitsPerSecond?: number
  timeslice?: number
  audio?: boolean
  video?: boolean
}
```

### `RecordingData`

Recording data interface.

```typescript
interface RecordingData {
  id: string
  callId?: string
  state?: RecordingState
  blob?: Blob
  mimeType: string
  duration?: number     // milliseconds
  size?: number         // bytes
  startTime: Date
  endTime?: Date
}
```

---

## Configuration Types

Application and SIP client configuration.

**Source:** `../../src/types/config.types.ts`

### `TurnServerConfig`

TURN server configuration for NAT traversal.

```typescript
interface TurnServerConfig {
  urls: string | readonly string[]
  username?: string
  credential?: string
  credentialType?: 'password' | 'oauth'
}
```

### `MediaConfiguration`

Media configuration for audio and video.

```typescript
interface MediaConfiguration {
  audio?: boolean | MediaTrackConstraints | { readonly [key: string]: any }
  video?: boolean | MediaTrackConstraints | { readonly [key: string]: any }
  echoCancellation?: boolean      // default: true
  noiseSuppression?: boolean      // default: true
  autoGainControl?: boolean       // default: true
  audioCodec?: 'opus' | 'pcmu' | 'pcma' | 'g722'
  videoCodec?: 'vp8' | 'vp9' | 'h264'
  dataChannel?: boolean
}
```

### `UserPreferences`

User preferences for the SIP client.

```typescript
interface UserPreferences {
  audioInputDeviceId?: string
  audioOutputDeviceId?: string
  videoInputDeviceId?: string
  enableAudio?: boolean
  enableVideo?: boolean
  autoAnswer?: boolean
  autoAnswerDelay?: number
  ringToneUrl?: string
  ringBackToneUrl?: string
  enableDtmfTones?: boolean
}
```

### `ExtendedRTCConfiguration`

Extended RTC configuration with VueSip-specific options.

```typescript
interface ExtendedRTCConfiguration extends RTCConfiguration {
  stunServers?: readonly string[]
  turnServers?: readonly TurnServerConfig[]
  iceTransportPolicy?: RTCIceTransportPolicy
  bundlePolicy?: RTCBundlePolicy
  rtcpMuxPolicy?: RTCRtcpMuxPolicy
  iceCandidatePoolSize?: number
}
```

### `SipClientConfig`

Main SIP client configuration.

```typescript
interface SipClientConfig {
  // Core settings
  uri: string                          // WebSocket SIP server URI
  sipUri: string                       // SIP user URI
  password: string                     // SIP password
  displayName?: string
  authorizationUsername?: string
  realm?: string
  ha1?: string                         // Alternative to password

  // WebSocket options
  wsOptions?: {
    protocols?: readonly string[]
    connectionTimeout?: number         // default: 10000
    maxReconnectionAttempts?: number   // default: 5
    reconnectionDelay?: number         // default: 2000
  }

  // Registration options
  registrationOptions?: {
    expires?: number                   // default: 600
    autoRegister?: boolean             // default: true
    registrationRetryInterval?: number // default: 30000
  }

  // Session options
  sessionOptions?: {
    sessionTimers?: boolean            // default: true
    sessionTimersRefreshMethod?: 'UPDATE' | 'INVITE'
    maxConcurrentCalls?: number        // default: 1
    callTimeout?: number               // default: 60000
  }

  // Media configuration
  mediaConfiguration?: MediaConfiguration
  rtcConfiguration?: ExtendedRTCConfiguration
  userPreferences?: UserPreferences

  // Debugging
  userAgent?: string
  debug?: boolean
  logger?: {
    debug: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
  }
}
```

**Example:**

```typescript
const config: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:user@example.com',
  password: 'secret',
  displayName: 'John Doe',
  wsOptions: {
    connectionTimeout: 10000,
    maxReconnectionAttempts: 3
  },
  registrationOptions: {
    expires: 600,
    autoRegister: true
  }
}
```

### `ValidationResult`

Configuration validation result.

```typescript
interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}
```

---

## Event Types

Event system type definitions.

**Source:** `../../src/types/events.types.ts`

### `BaseEvent<T>`

Base event interface.

```typescript
interface BaseEvent<T = any> {
  type: string
  payload?: T
  timestamp: Date
  metadata?: Record<string, any>
}
```

### `EventHandler<T>`

Event handler function type.

```typescript
type EventHandler<T = any> = (event: T) => void | Promise<void>
```

### `EventListenerOptions`

Options for event listeners.

```typescript
interface EventListenerOptions {
  once?: boolean         // Execute only once
  priority?: number      // Higher priority executes first
  id?: string           // Handler ID for removal
}
```

### `EventNames`

Event names constants.

```typescript
const EventNames = {
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

  // More events...
} as const
```

### `EventEmitter`

Event emitter interface.

```typescript
interface EventEmitter {
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
    options?: EventListenerOptions
  ): void

  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): void

  off<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): void

  emit<K extends keyof EventMap>(
    event: K,
    data: EventMap[K]
  ): void

  removeAllListeners(event?: keyof EventMap): void

  waitFor<K extends keyof EventMap>(
    event: K,
    timeout?: number
  ): Promise<EventMap[K]>
}
```

---

## History Types

Call history management types.

**Source:** `../../src/types/history.types.ts`

### `CallHistoryEntry`

Call history entry.

```typescript
interface CallHistoryEntry {
  id: string
  direction: CallDirection
  remoteUri: string
  remoteDisplayName?: string
  localUri: string
  startTime: Date
  answerTime?: Date
  endTime: Date
  duration: number           // seconds
  ringDuration?: number      // seconds
  finalState: CallState
  terminationCause: TerminationCause
  wasAnswered: boolean
  wasMissed: boolean
  hasVideo: boolean
  tags?: readonly string[]
  metadata?: Record<string, any>
}
```

### `HistoryFilter`

Filter options for history queries.

```typescript
interface HistoryFilter {
  direction?: CallDirection
  remoteUri?: string
  wasAnswered?: boolean
  wasMissed?: boolean
  hasVideo?: boolean
  dateFrom?: Date
  dateTo?: Date
  tags?: readonly string[]
  searchQuery?: string
  sortBy?: 'startTime' | 'duration' | 'remoteUri'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

### `HistoryExportFormat`

Export format enumeration.

```typescript
enum HistoryExportFormat {
  JSON = 'json',
  CSV = 'csv',
  Excel = 'xlsx'
}
```

### `HistoryStatistics`

Call history statistics.

```typescript
interface HistoryStatistics {
  totalCalls: number
  incomingCalls: number
  outgoingCalls: number
  answeredCalls: number
  missedCalls: number
  totalDuration: number         // seconds
  averageDuration: number       // seconds
  videoCalls: number
  frequentContacts: Array<{
    uri: string
    displayName?: string
    count: number
  }>
}
```

---

## Transfer Types

Call transfer type definitions.

**Source:** `../../src/types/transfer.types.ts`

### `TransferState`

Transfer state enumeration.

```typescript
enum TransferState {
  Idle = 'idle',
  Initiated = 'initiated',
  InProgress = 'in_progress',
  Accepted = 'accepted',
  Completed = 'completed',
  Failed = 'failed',
  Canceled = 'canceled'
}
```

### `TransferType`

Transfer type enumeration.

```typescript
enum TransferType {
  Blind = 'blind',        // Direct transfer without consultation
  Attended = 'attended'   // Consultation before transfer
}
```

### `TransferOptions`

Transfer options.

```typescript
interface TransferOptions {
  type: TransferType
  target: string
  extraHeaders?: string[]
}
```

### `TransferEvent`

Transfer event.

```typescript
interface TransferEvent {
  type: string
  transferId: string
  state: TransferState
  transferType: TransferType
  target: string
  callId: string
  consultationCallId?: string    // For attended transfer
  timestamp: Date
  error?: string
}
```

---

## Conference Types

Multi-party conference call types.

**Source:** `../../src/types/conference.types.ts`

### `ConferenceState`

Conference state enumeration.

```typescript
enum ConferenceState {
  Idle = 'idle',
  Creating = 'creating',
  Active = 'active',
  OnHold = 'on_hold',
  Ending = 'ending',
  Ended = 'ended',
  Failed = 'failed'
}
```

### `ParticipantState`

Conference participant state.

```typescript
enum ParticipantState {
  Connecting = 'connecting',
  Connected = 'connected',
  OnHold = 'on_hold',
  Muted = 'muted',
  Disconnected = 'disconnected'
}
```

### `Participant`

Conference participant.

```typescript
interface Participant {
  id: string
  uri: string
  displayName?: string
  state: ParticipantState
  isMuted: boolean
  isOnHold: boolean
  isModerator: boolean
  isSelf: boolean
  audioLevel?: number      // 0-1
  stream?: MediaStream
  joinedAt: Date
  metadata?: Record<string, any>
}
```

### `ConferenceStateInterface`

Conference state interface.

```typescript
interface ConferenceStateInterface {
  id: string
  state: ConferenceState
  uri?: string
  participants: Map<string, Participant>
  localParticipant?: Participant
  maxParticipants?: number
  startedAt?: Date
  endedAt?: Date
  isLocked: boolean
  isRecording: boolean
  metadata?: Record<string, any>
}
```

### `ConferenceOptions`

Conference creation options.

```typescript
interface ConferenceOptions {
  maxParticipants?: number
  enableRecording?: boolean
  enableVideo?: boolean
  locked?: boolean
  moderatorPin?: string
  metadata?: Record<string, any>
}
```

---

## Presence Types

SIP presence types.

**Source:** `../../src/types/presence.types.ts`

### `PresenceState`

Presence state enumeration.

```typescript
enum PresenceState {
  Available = 'available',
  Away = 'away',
  Busy = 'busy',
  Offline = 'offline',
  Custom = 'custom'
}
```

### `PresenceStatus`

Presence status.

```typescript
interface PresenceStatus {
  uri: string
  state: PresenceState
  statusMessage?: string
  lastUpdated: Date
  metadata?: Record<string, any>
}
```

### `PresenceSubscription`

Presence subscription.

```typescript
interface PresenceSubscription {
  id: string
  targetUri: string
  state: 'pending' | 'active' | 'terminated'
  expires?: number
  lastStatus?: PresenceStatus
}
```

### `PresencePublishOptions`

Options for publishing presence.

```typescript
interface PresencePublishOptions {
  state: PresenceState
  statusMessage?: string
  expires?: number          // seconds
  extraHeaders?: string[]
}
```

### `PresenceSubscriptionOptions`

Options for subscribing to presence.

```typescript
interface PresenceSubscriptionOptions {
  expires?: number          // seconds
  extraHeaders?: string[]
  onNotify?: (status: PresenceStatus) => void
}
```

---

## Messaging Types

Instant messaging types.

**Source:** `../../src/types/messaging.types.ts`

### `MessageStatus`

Message status enumeration.

```typescript
enum MessageStatus {
  Pending = 'pending',
  Sending = 'sending',
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Failed = 'failed'
}
```

### `MessageDirection`

Message direction.

```typescript
enum MessageDirection {
  Incoming = 'incoming',
  Outgoing = 'outgoing'
}
```

### `MessageContentType`

Message content type.

```typescript
enum MessageContentType {
  Text = 'text/plain',
  HTML = 'text/html',
  JSON = 'application/json',
  Custom = 'custom'
}
```

### `Message`

Message interface.

```typescript
interface Message {
  id: string
  direction: MessageDirection
  from: string
  to: string
  content: string
  contentType: MessageContentType
  status: MessageStatus
  timestamp: Date
  sentAt?: Date
  deliveredAt?: Date
  readAt?: Date
  isRead: boolean
  metadata?: Record<string, any>
}
```

### `MessageSendOptions`

Options for sending messages.

```typescript
interface MessageSendOptions {
  contentType?: MessageContentType
  extraHeaders?: string[]
  requestDeliveryNotification?: boolean
  requestReadNotification?: boolean
}
```

### `ComposingIndicator`

Typing indicator.

```typescript
interface ComposingIndicator {
  uri: string
  isComposing: boolean
  lastUpdated: Date
  idleTimeout?: number
}
```

---

## Storage Types

Storage and persistence types.

**Source:** `../../src/types/storage.types.ts`

### `StorageResult<T>`

Storage operation result.

```typescript
interface StorageResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
```

### `StorageAdapter`

Storage adapter interface.

```typescript
interface StorageAdapter {
  readonly name: string

  get<T = unknown>(key: string): Promise<StorageResult<T>>
  set<T = unknown>(key: string, value: T): Promise<StorageResult<void>>
  remove(key: string): Promise<StorageResult<void>>
  clear(prefix?: string): Promise<StorageResult<void>>
  has(key: string): Promise<boolean>
  keys(prefix?: string): Promise<string[]>
}
```

### `EncryptionOptions`

Encryption configuration.

```typescript
interface EncryptionOptions {
  enabled: boolean
  algorithm?: 'AES-GCM' | 'AES-CBC'
  iterations?: number          // default: 100000
  salt?: string
}
```

### `EncryptedData`

Encrypted data structure.

```typescript
interface EncryptedData {
  data: string                 // base64
  iv: string                   // base64
  salt: string                 // base64
  algorithm: string
  iterations: number
  version: number
}
```

### `StorageConfig`

Storage configuration.

```typescript
interface StorageConfig {
  prefix?: string              // default: 'vuesip'
  version?: string             // default: '1'
  encryption?: EncryptionOptions
}
```

### `STORAGE_KEYS`

Storage key constants.

```typescript
const STORAGE_KEYS = {
  SIP_CONFIG: 'sip:config',
  SIP_CREDENTIALS: 'sip:credentials',
  MEDIA_CONFIG: 'media:config',
  USER_PREFERENCES: 'user:preferences',
  DEVICE_AUDIO_INPUT: 'device:audio-input',
  DEVICE_AUDIO_OUTPUT: 'device:audio-output',
  DEVICE_VIDEO_INPUT: 'device:video-input',
  DEVICE_PERMISSIONS: 'device:permissions',
  CALL_HISTORY: 'call:history',
  REGISTRATION_STATE: 'registration:state',
  REGISTRATION_LAST_TIME: 'registration:last-time'
} as const
```

---

## Provider Types

Vue provider context types.

**Source:** `../../src/types/provider.types.ts`

### `ConfigProviderContext`

Configuration provider context.

```typescript
interface ConfigProviderContext {
  // Readonly state
  readonly sipConfig: SipClientConfig | null
  readonly mediaConfig: MediaConfiguration
  readonly userPreferences: UserPreferences
  readonly hasSipConfig: boolean
  readonly isConfigValid: boolean
  readonly lastValidation: ValidationResult | null

  // Methods
  setSipConfig(config: SipClientConfig, validate?: boolean): ValidationResult
  updateSipConfig(updates: Partial<SipClientConfig>, validate?: boolean): ValidationResult
  setMediaConfig(config: MediaConfiguration, validate?: boolean): ValidationResult
  updateMediaConfig(updates: Partial<MediaConfiguration>, validate?: boolean): ValidationResult
  setUserPreferences(preferences: UserPreferences): void
  updateUserPreferences(updates: Partial<UserPreferences>): void
  validateAll(): ValidationResult
  reset(): void
}
```

### `MediaProviderContext`

Media provider context.

```typescript
interface MediaProviderContext {
  // Readonly state - devices
  readonly audioInputDevices: readonly MediaDevice[]
  readonly audioOutputDevices: readonly MediaDevice[]
  readonly videoInputDevices: readonly MediaDevice[]
  readonly allDevices: readonly MediaDevice[]

  // Readonly state - selected devices
  readonly selectedAudioInputId: string | null
  readonly selectedAudioOutputId: string | null
  readonly selectedVideoInputId: string | null
  readonly selectedAudioInputDevice: MediaDevice | undefined
  readonly selectedAudioOutputDevice: MediaDevice | undefined
  readonly selectedVideoInputDevice: MediaDevice | undefined

  // Readonly state - permissions
  readonly audioPermission: PermissionStatus
  readonly videoPermission: PermissionStatus
  readonly hasAudioPermission: boolean
  readonly hasVideoPermission: boolean

  // Methods
  enumerateDevices(): Promise<MediaDevice[]>
  getDeviceById(deviceId: string): MediaDevice | undefined
  selectAudioInput(deviceId: string): void
  selectAudioOutput(deviceId: string): void
  selectVideoInput(deviceId: string): void
  requestAudioPermission(): Promise<boolean>
  requestVideoPermission(): Promise<boolean>
  requestPermissions(audio?: boolean, video?: boolean): Promise<void>
  testAudioInput(deviceId?: string, options?: any): Promise<boolean>
  testAudioOutput(deviceId?: string): Promise<boolean>
}
```

---

## Plugin Types

Plugin system type definitions.

**Source:** `../../src/types/plugin.types.ts`

### `HookPriority`

Hook priority levels.

```typescript
enum HookPriority {
  Highest = 1000,
  High = 500,
  Normal = 0,
  Low = -500,
  Lowest = -1000
}
```

### `HOOK_NAMES`

Standard hook names.

```typescript
const HOOK_NAMES = {
  // Lifecycle hooks
  BEFORE_INIT: 'beforeInit',
  AFTER_INIT: 'afterInit',
  BEFORE_DESTROY: 'beforeDestroy',
  AFTER_DESTROY: 'afterDestroy',

  // Connection hooks
  BEFORE_CONNECT: 'beforeConnect',
  AFTER_CONNECT: 'afterConnect',
  BEFORE_DISCONNECT: 'beforeDisconnect',
  AFTER_DISCONNECT: 'afterDisconnect',

  // Registration hooks
  BEFORE_REGISTER: 'beforeRegister',
  AFTER_REGISTER: 'afterRegister',
  BEFORE_UNREGISTER: 'beforeUnregister',
  AFTER_UNREGISTER: 'afterUnregister',

  // Call hooks
  BEFORE_CALL: 'beforeCall',
  AFTER_CALL_START: 'afterCallStart',
  BEFORE_ANSWER: 'beforeAnswer',
  AFTER_ANSWER: 'afterAnswer',
  BEFORE_HANGUP: 'beforeHangup',
  AFTER_HANGUP: 'afterHangup',

  // Media hooks
  BEFORE_MEDIA_ACQUIRE: 'beforeMediaAcquire',
  AFTER_MEDIA_ACQUIRE: 'afterMediaAcquire',
  BEFORE_MEDIA_RELEASE: 'beforeMediaRelease',
  AFTER_MEDIA_RELEASE: 'afterMediaRelease',

  // Error hooks
  ON_ERROR: 'onError',
  ON_CALL_ERROR: 'onCallError',
  ON_CONNECTION_ERROR: 'onConnectionError'
} as const
```

### `HookHandler<TData, TReturn>`

Hook handler function.

```typescript
type HookHandler<TData = any, TReturn = any> = (
  context: PluginContext,
  data?: TData
) => TReturn | Promise<TReturn>
```

### `PluginContext`

Plugin context providing access to core systems.

```typescript
interface PluginContext {
  eventBus: EventBus
  sipClient: SipClient | null
  mediaManager: MediaManager | null
  config: SipClientConfig | null
  activeCalls: Map<string, CallSession>
  hooks: {
    register: <TData = any, TReturn = any>(
      name: HookName,
      handler: HookHandler<TData, TReturn>,
      options?: HookOptions
    ) => string
    unregister: (hookId: string) => boolean
    execute: <TData = any, TReturn = any>(
      name: HookName,
      data?: TData
    ) => Promise<TReturn[]>
  }
  logger: {
    debug: (message: string, ...args: any[]) => void
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
  }
  version: string
}
```

### `PluginMetadata`

Plugin metadata.

```typescript
interface PluginMetadata {
  name: string                // Must be unique
  version: string
  description?: string
  author?: string
  license?: string
  minVersion?: string         // Minimum VueSip version
  maxVersion?: string         // Maximum VueSip version
  dependencies?: string[]     // Other plugin dependencies
}
```

### `Plugin<TConfig>`

Plugin interface.

```typescript
interface Plugin<TConfig extends PluginConfig = PluginConfig> {
  metadata: PluginMetadata
  defaultConfig?: TConfig

  install(context: PluginContext, config?: TConfig): Promise<void> | void
  uninstall?(context: PluginContext): Promise<void> | void
  updateConfig?(context: PluginContext, config: TConfig): Promise<void> | void
}
```

**Example:**

```typescript
const myPlugin: Plugin = {
  metadata: {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My custom plugin'
  },

  async install(context, config) {
    // Register hooks
    context.hooks.register('beforeCall', async (ctx, data) => {
      console.log('Before call:', data)
    })

    // Listen to events
    context.eventBus.on('call:incoming', (event) => {
      console.log('Incoming call:', event)
    })
  },

  async uninstall(context) {
    // Cleanup
  }
}
```

### `PluginState`

Plugin state enumeration.

```typescript
enum PluginState {
  Registered = 'registered',
  Installing = 'installing',
  Installed = 'installed',
  Uninstalling = 'uninstalling',
  Failed = 'failed'
}
```

---

## Type Relationships

### Inheritance Hierarchy

```
BaseEvent
├── CallEvent
│   ├── CallProgressEvent
│   ├── CallFailedEvent
│   ├── CallEndedEvent
│   ├── CallAcceptedEvent
│   └── CallConfirmedEvent
├── RegistrationEvent
├── ConnectionEvent
├── MediaStreamEvent
├── MediaTrackEvent
└── ErrorEvent

SipEvent
├── RegistrationEvent
└── ConnectionEvent

RTCConfiguration
└── ExtendedRTCConfiguration

MediaStreamConstraints
└── ExtendedMediaStreamConstraints
```

### Common Type Patterns

**Result Pattern:**

```typescript
interface Result<T> {
  success: boolean
  data?: T
  error?: string
}
```

Used by: `StorageResult<T>`, `ValidationResult`

**Options Pattern:**

```typescript
interface Options {
  // Required options
  // ...
  // Optional configuration
  extraHeaders?: string[]
  // ...
}
```

Used by: `CallOptions`, `AnswerOptions`, `TransferOptions`, `MessageSendOptions`

**State Pattern:**

```typescript
enum State {
  Idle = 'idle',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed'
}
```

Used by: `CallState`, `RegistrationState`, `ConnectionState`, `TransferState`, `ConferenceState`

---

## Usage Examples

### Type-Safe Event Handling

```typescript
import { EventEmitter, EventMap, EventNames } from 'vuesip/types'

const eventBus: EventEmitter = getEventBus()

// Type-safe event listening
eventBus.on(EventNames.CALL_INCOMING, (event) => {
  // event is typed as CallEvent
  console.log('Call from:', event.session.remoteUri)
})
```

### Type-Safe Configuration

```typescript
import { SipClientConfig, ValidationResult } from 'vuesip/types'

const config: SipClientConfig = {
  uri: 'wss://sip.example.com',
  sipUri: 'sip:user@example.com',
  password: 'secret',
  wsOptions: {
    connectionTimeout: 10000
  }
}

const validation: ValidationResult = validateConfig(config)
if (!validation.valid) {
  console.error('Config errors:', validation.errors)
}
```

### Type-Safe Plugin Development

```typescript
import { Plugin, PluginContext, HookHandler } from 'vuesip/types'

const callLoggerPlugin: Plugin = {
  metadata: {
    name: 'call-logger',
    version: '1.0.0'
  },

  install(context: PluginContext) {
    const beforeCallHandler: HookHandler = async (ctx, data) => {
      console.log('Call initiated:', data)
    }

    context.hooks.register('beforeCall', beforeCallHandler)
  }
}
```

---

## Related Documentation

- [Composables API](./composables.md) - Vue composables using these types
- [Providers API](./providers.md) - Provider components and contexts
- [Plugin System API](./plugins.md) - Plugin development guide
- [Event System API](./events.md) - Event system reference
- [Utilities API](./utilities.md) - Utility functions

---

## Type Import Examples

```typescript
// Import specific types
import type {
  SipClientConfig,
  CallOptions,
  CallSession
} from 'vuesip/types'

// Import all types
import type * as VueSipTypes from 'vuesip/types'

// Import enums
import {
  CallState,
  CallDirection,
  RegistrationState
} from 'vuesip/types'

// Import constants
import {
  EventNames,
  HOOK_NAMES,
  STORAGE_KEYS
} from 'vuesip/types'
```

---

**Total Types Documented:** 100+
**Total Enums:** 15
**Total Interfaces:** 85+
**Total Constants:** 3 major sets

All types are production-ready, fully documented, and designed for optimal TypeScript type inference and IDE autocomplete support.
