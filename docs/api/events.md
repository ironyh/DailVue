# Event System API Reference

## Table of Contents

- [Overview](#overview)
- [EventBus API](#eventbus-api)
  - [Creating an EventBus](#creating-an-eventbus)
  - [Listening to Events](#listening-to-events)
  - [Emitting Events](#emitting-events)
  - [Removing Listeners](#removing-listeners)
  - [Waiting for Events](#waiting-for-events)
  - [Utility Methods](#utility-methods)
- [Event Types](#event-types)
  - [Connection Events](#connection-events)
  - [Registration Events](#registration-events)
  - [Call Events](#call-events)
  - [Media Events](#media-events)
  - [Transfer Events](#transfer-events)
  - [Conference Events](#conference-events)
  - [Presence Events](#presence-events)
  - [Messaging Events](#messaging-events)
  - [DTMF Events](#dtmf-events)
  - [Audio Events](#audio-events)
  - [Error Events](#error-events)
- [Event Patterns](#event-patterns)
  - [Wildcard Patterns](#wildcard-patterns)
  - [Event Lifecycle](#event-lifecycle)
  - [Event Priorities](#event-priorities)
  - [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [TypeScript Support](#typescript-support)

## Overview

VueSip provides a type-safe event system built on the `EventBus` class. The event system enables reactive communication between different components of your SIP application, allowing you to listen for and respond to various call, media, connection, and other events.

**Key Features:**
- **Type-safe**: Full TypeScript support with strongly-typed event payloads
- **Wildcard listeners**: Listen to multiple events with pattern matching
- **Priority-based execution**: Control the order in which event handlers execute
- **Async/await support**: Event handlers can be synchronous or asynchronous
- **Error isolation**: Handler errors don't prevent other handlers from executing
- **Memory-safe**: Automatic cleanup of one-time listeners

**Source Files:**
- [EventBus Implementation](../../src/core/EventBus.ts)
- [Event Type Definitions](../../src/types/events.types.ts)
- [Call Event Types](../../src/types/call.types.ts)
- [SIP Event Types](../../src/types/sip.types.ts)
- [Media Event Types](../../src/types/media.types.ts)

## EventBus API

### Creating an EventBus

```typescript
import { createEventBus, EventBus } from '@/core/EventBus'

// Create a new EventBus instance
const eventBus = createEventBus()

// Or use the global event bus singleton
import { globalEventBus } from '@/core/EventBus'
```

### Listening to Events

#### `on(event, handler, options?)`

Register an event listener that will be called each time the event is emitted.

**Parameters:**
- `event` (string | WildcardPattern): The event name or wildcard pattern
- `handler` (EventHandler): The callback function to execute
- `options` (EventListenerOptions, optional):
  - `once` (boolean): Execute only once (default: `false`)
  - `priority` (number): Handler priority, higher executes first (default: `0`)
  - `id` (string): Custom listener ID for removal (auto-generated if not provided)

**Returns:** `string` - The listener ID

**Example:**

```typescript
import { EventNames } from '@/types/events.types'

// Basic usage
const listenerId = eventBus.on('connected', (event) => {
  console.log('Connected:', event.state)
})

// With options
eventBus.on('call:incoming', handleIncomingCall, {
  priority: 10,
  id: 'my-call-handler'
})

// Type-safe with EventNames
eventBus.on(EventNames.CALL_INCOMING, (event) => {
  console.log('Incoming call from:', event.session.remoteUri)
})
```

#### `once(event, handler)`

Register a one-time event listener that will be automatically removed after the first invocation.

**Parameters:**
- `event` (string | WildcardPattern): The event name or wildcard pattern
- `handler` (EventHandler): The callback function to execute

**Returns:** `string` - The listener ID

**Example:**

```typescript
// Listen for the next connection event only
eventBus.once('connected', (event) => {
  console.log('Connected for the first time')
})

// Useful for waiting for specific events
eventBus.once('call:accepted', async (event) => {
  console.log('Call accepted, starting recording...')
  await startRecording(event.session.id)
})
```

### Emitting Events

#### `emit(event, data)`

Emit an event asynchronously, waiting for all handlers to complete.

**Parameters:**
- `event` (string): The event name
- `data` (EventMap[K]): The event data matching the event type

**Returns:** `Promise<void>`

**Example:**

```typescript
// Emit a connection event
await eventBus.emit('connected', {
  type: 'connected',
  state: 'connected',
  timestamp: new Date()
})

// Emit a call event
await eventBus.emit('call:incoming', {
  type: 'call:incoming',
  session: callSession,
  timestamp: new Date()
})
```

#### `emitSync(event, data)`

Emit an event synchronously (fire and forget). Does not wait for handlers to complete.

**Parameters:**
- `event` (string): The event name
- `data` (EventMap[K]): The event data matching the event type

**Returns:** `void`

**Example:**

```typescript
// Fire and forget - useful for non-critical events
eventBus.emitSync('call:progress', {
  type: 'progress',
  session: callSession,
  responseCode: 180,
  reasonPhrase: 'Ringing',
  timestamp: new Date()
})
```

### Removing Listeners

#### `off(event, handlerOrId)`

Remove an event listener by handler function or listener ID.

**Parameters:**
- `event` (string | WildcardPattern): The event name or wildcard pattern
- `handlerOrId` (EventHandler | string): The handler function or listener ID

**Returns:** `boolean` - `true` if listener was removed, `false` otherwise

**Example:**

```typescript
// Remove by handler function
const handler = (event) => console.log(event)
eventBus.on('connected', handler)
eventBus.off('connected', handler)

// Remove by listener ID
const id = eventBus.on('disconnected', handler)
eventBus.off('disconnected', id)
```

#### `removeById(id)`

Remove a listener by ID across all events.

**Parameters:**
- `id` (string): The listener ID

**Returns:** `boolean` - `true` if listener was removed, `false` otherwise

**Example:**

```typescript
const id = eventBus.on('call:incoming', handleCall)
// Later, remove without knowing the event name
eventBus.removeById(id)
```

#### `removeAllListeners(event?)`

Remove all listeners for a specific event or all events.

**Parameters:**
- `event` (string | WildcardPattern, optional): The event name. If omitted, removes all listeners for all events.

**Returns:** `void`

**Example:**

```typescript
// Remove all listeners for a specific event
eventBus.removeAllListeners('connected')

// Remove all listeners for all events
eventBus.removeAllListeners()
```

### Waiting for Events

#### `waitFor(event, timeout?)`

Wait for an event to be emitted, returning a promise that resolves with the event data.

**Parameters:**
- `event` (string): The event name
- `timeout` (number, optional): Timeout in milliseconds

**Returns:** `Promise<EventMap[K]>` - Promise that resolves with event data or rejects on timeout

**Example:**

```typescript
// Wait for connection with timeout
try {
  const event = await eventBus.waitFor('connected', 5000)
  console.log('Connected:', event.state)
} catch (error) {
  console.error('Connection timeout')
}

// Wait indefinitely for call acceptance
const event = await eventBus.waitFor('call:accepted')
console.log('Call accepted:', event.session.id)
```

### Utility Methods

#### `listenerCount(event)`

Get the number of listeners for an event.

**Parameters:**
- `event` (string | WildcardPattern): The event name or wildcard pattern

**Returns:** `number` - The number of listeners

**Example:**

```typescript
const count = eventBus.listenerCount('connected')
console.log(`${count} listeners registered for 'connected' event`)
```

#### `eventNames()`

Get all event names that have registered listeners.

**Returns:** `string[]` - Array of event names

**Example:**

```typescript
const events = eventBus.eventNames()
console.log('Events with listeners:', events)
// Output: ['connected', 'call:incoming', 'call:ended']
```

#### `hasListeners(event)`

Check if an event has any registered listeners.

**Parameters:**
- `event` (string | WildcardPattern): The event name or wildcard pattern

**Returns:** `boolean` - `true` if event has listeners, `false` otherwise

**Example:**

```typescript
if (eventBus.hasListeners('call:incoming')) {
  console.log('Call handler is registered')
}
```

#### `destroy()`

Clean up the EventBus, removing all listeners and resetting state.

**Returns:** `void`

**Example:**

```typescript
// Cleanup when component unmounts
onUnmounted(() => {
  eventBus.destroy()
})
```

## Event Types

### Connection Events

Events related to WebSocket connection status.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `connected` | `EventNames.CONNECTED` | `ConnectionEvent` | Successfully connected to SIP server |
| `disconnected` | `EventNames.DISCONNECTED` | `ConnectionEvent` | Disconnected from SIP server |
| `connecting` | `EventNames.CONNECTING` | `ConnectionEvent` | Attempting to connect to SIP server |
| `connection_failed` | `EventNames.CONNECTION_FAILED` | `ConnectionEvent` | Connection attempt failed |
| `reconnecting` | `EventNames.RECONNECTING` | `ConnectionEvent` | Attempting to reconnect to SIP server |

**ConnectionEvent Payload:**

```typescript
interface ConnectionEvent extends SipEvent {
  type: 'connected' | 'disconnected' | 'connectionFailed'
  state: ConnectionState
  error?: string
  retryAttempt?: number
  timestamp: Date
}

enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  ConnectionFailed = 'connection_failed',
  Error = 'error',
  Reconnecting = 'reconnecting'
}
```

**Example:**

```typescript
eventBus.on('connected', (event) => {
  console.log('Connected to SIP server')
  console.log('State:', event.state)
})

eventBus.on('disconnected', (event) => {
  if (event.error) {
    console.error('Disconnected with error:', event.error)
  }
})
```

### Registration Events

Events related to SIP registration status.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `registered` | `EventNames.REGISTERED` | `RegistrationEvent` | Successfully registered with SIP server |
| `unregistered` | `EventNames.UNREGISTERED` | `RegistrationEvent` | Unregistered from SIP server |
| `registering` | `EventNames.REGISTERING` | `RegistrationEvent` | Registration in progress |
| `registration_failed` | `EventNames.REGISTRATION_FAILED` | `RegistrationEvent` | Registration attempt failed |

**RegistrationEvent Payload:**

```typescript
interface RegistrationEvent extends SipEvent {
  type: 'registration' | 'unregistration' | 'registrationFailed'
  state: RegistrationState
  responseCode?: SipResponseCode
  reasonPhrase?: string
  expires?: number
  timestamp: Date
}

enum RegistrationState {
  Unregistered = 'unregistered',
  Registering = 'registering',
  Registered = 'registered',
  RegistrationFailed = 'registration_failed',
  Unregistering = 'unregistering'
}
```

**Example:**

```typescript
eventBus.on('registered', (event) => {
  console.log('Registered successfully')
  console.log('Expires in:', event.expires, 'seconds')
})

eventBus.on('registration_failed', (event) => {
  console.error('Registration failed:', event.reasonPhrase)
  console.error('Response code:', event.responseCode)
})
```

### Call Events

Events related to call lifecycle and state changes.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `call:incoming` | `EventNames.CALL_INCOMING` | `CallEvent` | Incoming call received |
| `call:outgoing` | `EventNames.CALL_OUTGOING` | `CallEvent` | Outgoing call initiated |
| `call:progress` | `EventNames.CALL_PROGRESS` | `CallEvent` | Call progress (provisional response) |
| `call:ringing` | `EventNames.CALL_RINGING` | `CallEvent` | Remote party is ringing |
| `call:accepted` | `EventNames.CALL_ACCEPTED` | `CallAcceptedEvent` | Call was accepted |
| `call:confirmed` | `EventNames.CALL_CONFIRMED` | `CallConfirmedEvent` | Call confirmed and active |
| `call:failed` | `EventNames.CALL_FAILED` | `CallFailedEvent` | Call failed |
| `call:ended` | `EventNames.CALL_ENDED` | `CallEndedEvent` | Call ended |
| `call:hold` | `EventNames.CALL_HOLD` | `CallEvent` | Call placed on hold |
| `call:unhold` | `EventNames.CALL_UNHOLD` | `CallEvent` | Call resumed from hold |
| `call:muted` | `EventNames.CALL_MUTED` | `CallEvent` | Audio muted |
| `call:unmuted` | `EventNames.CALL_UNMUTED` | `CallEvent` | Audio unmuted |

**CallEvent Payload:**

```typescript
interface CallEvent {
  type: string
  session: CallSession
  originalEvent?: any
  timestamp: Date
}

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

enum CallDirection {
  Outgoing = 'outgoing',
  Incoming = 'incoming'
}
```

**CallFailedEvent Payload:**

```typescript
interface CallFailedEvent extends CallEvent {
  type: 'failed'
  cause: TerminationCause
  responseCode?: number
  reasonPhrase?: string
  message?: string
}

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

**CallEndedEvent Payload:**

```typescript
interface CallEndedEvent extends CallEvent {
  type: 'ended'
  cause: TerminationCause
  originator: 'local' | 'remote' | 'system'
}
```

**Example:**

```typescript
// Handle incoming calls
eventBus.on('call:incoming', (event) => {
  console.log('Incoming call from:', event.session.remoteUri)
  console.log('Display name:', event.session.remoteDisplayName)

  // Answer the call
  answerCall(event.session.id)
})

// Monitor call state changes
eventBus.on('call:confirmed', (event) => {
  console.log('Call is now active')
  console.log('Local stream:', event.session.localStream)
  console.log('Remote stream:', event.session.remoteStream)
})

// Handle call failures
eventBus.on('call:failed', (event) => {
  console.error('Call failed:', event.cause)
  console.error('Reason:', event.reasonPhrase)
  console.error('Response code:', event.responseCode)
})

// Handle call termination
eventBus.on('call:ended', (event) => {
  console.log('Call ended by:', event.originator)
  console.log('Cause:', event.cause)

  const duration = event.session.timing.duration
  console.log('Call duration:', duration, 'seconds')
})
```

### Media Events

Events related to media streams, tracks, and devices.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `media:stream:added` | `EventNames.MEDIA_STREAM_ADDED` | `MediaStreamEvent` | Media stream added |
| `media:stream:removed` | `EventNames.MEDIA_STREAM_REMOVED` | `MediaStreamEvent` | Media stream removed |
| `media:track:added` | `EventNames.MEDIA_TRACK_ADDED` | `MediaTrackEvent` | Media track added to stream |
| `media:track:removed` | `EventNames.MEDIA_TRACK_REMOVED` | `MediaTrackEvent` | Media track removed from stream |
| `media:track:muted` | `EventNames.MEDIA_TRACK_MUTED` | `MediaTrackEvent` | Media track muted |
| `media:track:unmuted` | `EventNames.MEDIA_TRACK_UNMUTED` | `MediaTrackEvent` | Media track unmuted |
| `media:device:changed` | `EventNames.MEDIA_DEVICE_CHANGED` | `MediaDeviceChangeEvent` | Media devices changed |

**MediaStreamEvent Payload:**

```typescript
interface MediaStreamEvent {
  type: 'addtrack' | 'removetrack' | 'active' | 'inactive'
  stream: MediaStream
  track?: MediaStreamTrack
  timestamp: Date
}
```

**MediaTrackEvent Payload:**

```typescript
interface MediaTrackEvent {
  type: 'mute' | 'unmute' | 'ended'
  track: MediaStreamTrack
  timestamp: Date
}
```

**MediaDeviceChangeEvent Payload:**

```typescript
interface MediaDeviceChangeEvent {
  type: 'devicechange'
  addedDevices: MediaDevice[]
  removedDevices: MediaDevice[]
  currentDevices: MediaDevice[]
  timestamp: Date
}

interface MediaDevice {
  deviceId: string
  kind: MediaDeviceKind
  label: string
  groupId: string
  isDefault?: boolean
}

enum MediaDeviceKind {
  AudioInput = 'audioinput',
  AudioOutput = 'audiooutput',
  VideoInput = 'videoinput'
}
```

**Example:**

```typescript
// Monitor stream changes
eventBus.on('media:stream:added', (event) => {
  console.log('Stream added:', event.stream.id)
  attachStreamToVideo(event.stream)
})

// Monitor track changes
eventBus.on('media:track:added', (event) => {
  console.log('Track added:', event.track.kind, event.track.id)
})

eventBus.on('media:track:muted', (event) => {
  console.log('Track muted:', event.track.kind)
})

// Handle device changes (e.g., headphones plugged in)
eventBus.on('media:device:changed', (event) => {
  console.log('Devices added:', event.addedDevices.length)
  console.log('Devices removed:', event.removedDevices.length)

  // Update device selector UI
  updateDeviceList(event.currentDevices)
})
```

### Transfer Events

Events related to call transfers (blind and attended).

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `transfer:initiated` | `EventNames.TRANSFER_INITIATED` | `CallTransferInitiatedEvent` | Transfer initiated |
| `transfer:accepted` | `EventNames.TRANSFER_ACCEPTED` | `CallTransferAcceptedEvent` | Transfer accepted by target |
| `transfer:failed` | `EventNames.TRANSFER_FAILED` | `CallTransferFailedEvent` | Transfer failed |
| `transfer:completed` | `EventNames.TRANSFER_COMPLETED` | `CallTransferCompletedEvent` | Transfer completed |

**CallTransferInitiatedEvent Payload:**

```typescript
interface CallTransferInitiatedEvent extends BaseEvent {
  type: 'call:transfer_initiated'
  target: string
  transferType: 'blind' | 'attended'
  replaceCallId?: string
  timestamp: Date
}
```

**CallTransferAcceptedEvent Payload:**

```typescript
interface CallTransferAcceptedEvent extends BaseEvent {
  type: 'call:transfer_accepted'
  target: string
  timestamp: Date
}
```

**CallTransferFailedEvent Payload:**

```typescript
interface CallTransferFailedEvent extends BaseEvent {
  type: 'call:transfer_failed'
  target: string
  error?: string
  timestamp: Date
}
```

**CallTransferCompletedEvent Payload:**

```typescript
interface CallTransferCompletedEvent extends BaseEvent {
  type: 'call:transfer_completed'
  target: string
  timestamp: Date
}
```

**Example:**

```typescript
// Monitor transfer progress
eventBus.on('transfer:initiated', (event) => {
  console.log('Transferring to:', event.target)
  console.log('Transfer type:', event.transferType)
})

eventBus.on('transfer:completed', (event) => {
  console.log('Transfer completed successfully')
})

eventBus.on('transfer:failed', (event) => {
  console.error('Transfer failed:', event.error)
})
```

### Conference Events

Events related to conference calls and participants.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `conference:created` | `EventNames.CONFERENCE_CREATED` | `ConferenceCreatedEvent` | Conference created |
| `conference:joined` | `EventNames.CONFERENCE_JOINED` | `ConferenceJoinedEvent` | Joined conference |
| `conference:left` | `EventNames.CONFERENCE_LEFT` | `ConferenceLeftEvent` | Left conference |
| `conference:ended` | `EventNames.CONFERENCE_ENDED` | `ConferenceEndedEvent` | Conference ended |
| `conference:participant:joined` | `EventNames.CONFERENCE_PARTICIPANT_JOINED` | `ConferenceParticipantJoinedEvent` | Participant joined |
| `conference:participant:left` | `EventNames.CONFERENCE_PARTICIPANT_LEFT` | `ConferenceParticipantLeftEvent` | Participant left |
| `sip:conference:participant:invited` | - | `ConferenceParticipantInvitedEvent` | Participant invited to conference |
| `sip:conference:participant:removed` | - | `ConferenceParticipantRemovedEvent` | Participant removed from conference |
| `sip:conference:participant:muted` | - | `ConferenceParticipantMutedEvent` | Participant muted |
| `sip:conference:participant:unmuted` | - | `ConferenceParticipantUnmutedEvent` | Participant unmuted |
| `sip:conference:recording:started` | - | `ConferenceRecordingStartedEvent` | Conference recording started |
| `sip:conference:recording:stopped` | - | `ConferenceRecordingStoppedEvent` | Conference recording stopped |

> **Note on EventNames Constants:** Events with the `sip:` prefix are defined in the EventMap for type safety but don't currently have corresponding constants in `EventNames`. When using these events, use the string literal (e.g., `'sip:conference:participant:invited'`) or reference the EventMap type for type safety.

**ConferenceCreatedEvent Payload:**

```typescript
interface ConferenceCreatedEvent extends BaseEvent {
  type: 'sip:conference:created'
  conferenceId: string
  conference: ConferenceStateInterface
  timestamp: Date
}
```

**ConferenceJoinedEvent Payload:**

```typescript
interface ConferenceJoinedEvent extends BaseEvent {
  type: 'sip:conference:joined'
  conferenceId: string
  conference: ConferenceStateInterface
  timestamp: Date
}
```

**ConferenceLeftEvent Payload:**

```typescript
interface ConferenceLeftEvent extends BaseEvent {
  type: 'sip:conference:left'
  conferenceId: string
  timestamp: Date
}
```

**ConferenceEndedEvent Payload:**

```typescript
interface ConferenceEndedEvent extends BaseEvent {
  type: 'sip:conference:ended'
  conferenceId: string
  conference: ConferenceStateInterface
  timestamp: Date
}
```

**ConferenceParticipantJoinedEvent Payload:**

```typescript
interface ConferenceParticipantJoinedEvent extends BaseEvent {
  type: 'sip:conference:participant:joined'
  conferenceId: string
  participant: Participant
  timestamp: Date
}

interface Participant {
  id: string
  uri: string
  displayName?: string
  state: ParticipantState
  isMuted: boolean
  isOnHold: boolean
  isModerator: boolean
  isSelf: boolean
  audioLevel?: number
  stream?: MediaStream
  joinedAt: Date
  metadata?: Record<string, any>
}

enum ParticipantState {
  Connecting = 'connecting',
  Connected = 'connected',
  OnHold = 'on_hold',
  Muted = 'muted',
  Disconnected = 'disconnected'
}
```

**ConferenceParticipantInvitedEvent Payload:**

```typescript
interface ConferenceParticipantInvitedEvent extends BaseEvent {
  type: 'sip:conference:participant:invited'
  conferenceId: string
  participant: Participant
  timestamp: Date
}
```

**ConferenceParticipantRemovedEvent Payload:**

```typescript
interface ConferenceParticipantRemovedEvent extends BaseEvent {
  type: 'sip:conference:participant:removed'
  conferenceId: string
  participant: Participant
  timestamp: Date
}
```

**ConferenceParticipantMutedEvent Payload:**

```typescript
interface ConferenceParticipantMutedEvent extends BaseEvent {
  type: 'sip:conference:participant:muted'
  conferenceId: string
  participant: Participant
  timestamp: Date
}
```

**ConferenceParticipantUnmutedEvent Payload:**

```typescript
interface ConferenceParticipantUnmutedEvent extends BaseEvent {
  type: 'sip:conference:participant:unmuted'
  conferenceId: string
  participant: Participant
  timestamp: Date
}
```

**ConferenceRecordingStartedEvent Payload:**

```typescript
interface ConferenceRecordingStartedEvent extends BaseEvent {
  type: 'sip:conference:recording:started'
  conferenceId: string
  timestamp: Date
}
```

**ConferenceRecordingStoppedEvent Payload:**

```typescript
interface ConferenceRecordingStoppedEvent extends BaseEvent {
  type: 'sip:conference:recording:stopped'
  conferenceId: string
  timestamp: Date
}
```

**Example:**

```typescript
// Monitor conference events
eventBus.on('conference:created', (event) => {
  console.log('Conference created:', event.conferenceId)
})

eventBus.on('conference:participant:joined', (event) => {
  console.log('Participant joined:', event.participant.displayName)
  console.log('Conference ID:', event.conferenceId)
  console.log('Participant URI:', event.participant.uri)
})

eventBus.on('conference:participant:left', (event) => {
  console.log('Participant left:', event.participant.displayName)
})

// Monitor participant state changes
eventBus.on('sip:conference:participant:invited', (event) => {
  console.log('Participant invited:', event.participant.uri)
})

eventBus.on('sip:conference:participant:removed', (event) => {
  console.log('Participant removed:', event.participant.displayName)
})

eventBus.on('sip:conference:participant:muted', (event) => {
  console.log('Participant muted:', event.participant.displayName)
  updateParticipantUI(event.participant.id, { muted: true })
})

eventBus.on('sip:conference:participant:unmuted', (event) => {
  console.log('Participant unmuted:', event.participant.displayName)
  updateParticipantUI(event.participant.id, { muted: false })
})

// Monitor recording events
eventBus.on('sip:conference:recording:started', (event) => {
  console.log('Recording started for conference:', event.conferenceId)
  showRecordingIndicator(true)
})

eventBus.on('sip:conference:recording:stopped', (event) => {
  console.log('Recording stopped for conference:', event.conferenceId)
  showRecordingIndicator(false)
})
```

### Presence Events

Events related to presence (availability status) publication and subscription.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `presence:updated` | `EventNames.PRESENCE_UPDATED` | - | Presence status updated |
| `presence:subscribed` | `EventNames.PRESENCE_SUBSCRIBED` | - | Subscribed to presence |
| `presence:unsubscribed` | `EventNames.PRESENCE_UNSUBSCRIBED` | - | Unsubscribed from presence |

**PresencePublishEvent Payload:**

```typescript
interface PresencePublishEvent extends BaseEvent {
  type: 'sip:presence:publish'
  presence: PresencePublishOptions
  body: string
  extraHeaders?: string[]
  timestamp: Date
}
```

**Example:**

```typescript
eventBus.on('presence:updated', (event) => {
  console.log('Presence updated:', event.presence.state)
})
```

### Messaging Events

Events related to SIP instant messaging.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `message:received` | `EventNames.MESSAGE_RECEIVED` | `SipNewMessageEvent` | Message received |
| `message:sent` | `EventNames.MESSAGE_SENT` | `MessageSentEvent` | Message sent successfully |
| `message:failed` | `EventNames.MESSAGE_FAILED` | `MessageFailedEvent` | Message failed to send |

**SipNewMessageEvent Payload:**

```typescript
interface SipNewMessageEvent extends BaseEvent {
  type: 'sip:new_message'
  message: any
  originator: 'local' | 'remote'
  request?: any
  from: string
  content: string
  contentType?: string
  timestamp: Date
}
```

**MessageSentEvent Payload:**

```typescript
interface MessageSentEvent extends BaseEvent {
  type: 'message:sent'
  to: string
  content: string
  contentType?: string
  timestamp: Date
}
```

**MessageFailedEvent Payload:**

```typescript
interface MessageFailedEvent extends BaseEvent {
  type: 'message:failed'
  to: string
  content: string
  error: string
  timestamp: Date
}
```

**Example:**

```typescript
eventBus.on('message:received', (event) => {
  console.log('Message from:', event.from)
  console.log('Content:', event.content)
  console.log('Type:', event.contentType)
})

eventBus.on('message:sent', (event) => {
  console.log('Message sent to:', event.to)
})

eventBus.on('message:failed', (event) => {
  console.error('Failed to send message to:', event.to)
  console.error('Error:', event.error)
})
```

### DTMF Events

Events related to DTMF (Dual-Tone Multi-Frequency) tones.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `dtmf:sent` | `EventNames.DTMF_SENT` | `DTMFSentEvent` | DTMF tone sent |
| `dtmf:received` | `EventNames.DTMF_RECEIVED` | `DTMFReceivedEvent` | DTMF tone received |

**DTMFSentEvent Payload:**

```typescript
interface DTMFSentEvent extends BaseEvent {
  type: 'dtmf:sent'
  tone: string
  duration?: number
  timestamp: Date
}
```

**DTMFReceivedEvent Payload:**

```typescript
interface DTMFReceivedEvent extends BaseEvent {
  type: 'dtmf:received'
  tone: string
  timestamp: Date
}
```

**Example:**

```typescript
eventBus.on('dtmf:sent', (event) => {
  console.log('DTMF tone sent:', event.tone)
  console.log('Duration:', event.duration, 'ms')
})

eventBus.on('dtmf:received', (event) => {
  console.log('DTMF tone received:', event.tone)
})
```

### Audio Events

Events related to audio mute/unmute state.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `sip:audio:muted` | - | `AudioMutedEvent` | Audio muted |
| `sip:audio:unmuted` | - | `AudioUnmutedEvent` | Audio unmuted |

**Example:**

```typescript
eventBus.on('sip:audio:muted', (event) => {
  console.log('Audio muted')
  updateMuteButton(true)
})

eventBus.on('sip:audio:unmuted', (event) => {
  console.log('Audio unmuted')
  updateMuteButton(false)
})
```

### Error Events

Generic error events for the event system.

| Event | Constant | Payload Type | Description |
|-------|----------|--------------|-------------|
| `error` | `EventNames.ERROR` | `ErrorEvent` | Error occurred |

**ErrorEvent Payload:**

```typescript
interface ErrorEvent extends BaseEvent {
  type: typeof EventNames.ERROR
  error: Error
  context?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
}
```

**Example:**

```typescript
eventBus.on('error', (event) => {
  console.error('Error in context:', event.context)
  console.error('Severity:', event.severity)
  console.error('Error:', event.error.message)

  if (event.severity === 'critical') {
    handleCriticalError(event.error)
  }
})
```

## Event Patterns

### Wildcard Patterns

The EventBus supports wildcard patterns for listening to multiple events.

#### Universal Wildcard (`*`)

Listen to all events:

```typescript
eventBus.on('*', (event) => {
  console.log('Event fired:', event.type)
})
```

#### Namespace Wildcard (`namespace:*`)

Listen to all events within a namespace:

```typescript
// Listen to all call events
eventBus.on('call:*', (event) => {
  console.log('Call event:', event.type)
})

// Listen to all media events
eventBus.on('media:*', (event) => {
  console.log('Media event:', event.type)
})

// Listen to all conference events
eventBus.on('conference:*', (event) => {
  console.log('Conference event:', event.type)
})
```

### Event Lifecycle

Events in VueSip follow a predictable lifecycle:

#### Connection Lifecycle

```
connecting → connected → disconnected
         ↓
    connection_failed → reconnecting → connected
```

#### Registration Lifecycle

```
registering → registered → unregistered
          ↓
   registration_failed
```

#### Call Lifecycle

**Outgoing Call:**
```
call:outgoing → call:progress → call:ringing → call:accepted →
call:confirmed → call:ended
             ↓
        call:failed
```

**Incoming Call:**
```
call:incoming → call:accepted → call:confirmed → call:ended
            ↓
       call:failed
```

**Call with Hold:**
```
call:confirmed → call:hold → call:unhold → call:confirmed
```

### Event Priorities

Control the order of handler execution using priorities:

```typescript
// High priority handler (executes first)
eventBus.on('call:incoming', handleCriticalLogic, { priority: 100 })

// Normal priority handler
eventBus.on('call:incoming', handleUIUpdate, { priority: 0 })

// Low priority handler (executes last)
eventBus.on('call:incoming', handleLogging, { priority: -10 })

// Handlers execute in order: 100 → 0 → -10
```

**Priority Execution Order:**
1. Handlers are sorted by priority (highest to lowest)
2. Handlers with the same priority execute in registration order
3. Both direct and wildcard listeners are included in the priority queue

### Error Handling

The EventBus provides robust error handling to prevent one failing handler from affecting others:

```typescript
eventBus.on('connected', () => {
  throw new Error('Handler 1 failed')
})

eventBus.on('connected', () => {
  console.log('Handler 2 still executes')
})

// Both handlers execute; errors are logged but don't stop event propagation
```

**Error Handling Features:**
- Errors in handlers are caught and logged
- Other handlers continue to execute
- Works with both sync and async handlers
- Error details are logged with context

**Best Practice:**

```typescript
eventBus.on('call:incoming', async (event) => {
  try {
    await processIncomingCall(event)
  } catch (error) {
    console.error('Failed to process call:', error)
    // Emit error event for centralized error handling
    eventBus.emitSync('error', {
      type: 'error',
      error,
      context: 'call:incoming handler',
      severity: 'high',
      timestamp: new Date()
    })
  }
})
```

## Best Practices

### 1. Use TypeScript Types

Take advantage of type-safe event handling:

```typescript
import { EventNames } from '@/types/events.types'
import type { CallEvent, ConnectionEvent } from '@/types/events.types'

// Type-safe event listening
eventBus.on(EventNames.CALL_INCOMING, (event: CallEvent) => {
  // TypeScript knows the exact shape of 'event'
  console.log(event.session.remoteUri)
})
```

### 2. Clean Up Listeners

Always remove listeners when components unmount to prevent memory leaks:

```typescript
// Vue 3 Composition API
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  const listenerId = eventBus.on('connected', handleConnection)

  onUnmounted(() => {
    eventBus.off('connected', listenerId)
  })
})

// Or remove all listeners on unmount
onUnmounted(() => {
  eventBus.removeAllListeners()
})
```

### 3. Use Descriptive Handler IDs

Provide meaningful IDs for easier debugging:

```typescript
eventBus.on('call:incoming', handleIncomingCall, {
  id: 'main-call-handler',
  priority: 10
})

// Later, easy to identify and remove
eventBus.removeById('main-call-handler')
```

### 4. Leverage Wildcard Patterns for Logging

Use wildcards for cross-cutting concerns like logging:

```typescript
// Log all call events
eventBus.on('call:*', (event) => {
  logger.debug('Call event:', event.type, event)
}, { priority: -100 }) // Low priority to log after other handlers

// Log all events
eventBus.on('*', (event) => {
  analytics.track(event.type, event)
}, { priority: -100 })
```

### 5. Use `once()` for One-Time Events

When you only need to handle an event once, use `once()`:

```typescript
// Wait for initial connection
eventBus.once('connected', () => {
  console.log('Initial connection established')
  initializeApp()
})

// Wait for call to be accepted
eventBus.once('call:accepted', (event) => {
  startCallTimer(event.session.id)
})
```

### 6. Prefer `waitFor()` for Async Flows

Use `waitFor()` when you need to wait for events in async code:

```typescript
async function makeCall(uri: string) {
  const callId = await sipClient.call(uri)

  try {
    // Wait for call to be accepted or fail
    const event = await Promise.race([
      eventBus.waitFor('call:accepted', 30000),
      eventBus.waitFor('call:failed', 30000)
    ])

    if (event.type === 'call:accepted') {
      console.log('Call accepted')
    } else {
      console.error('Call failed')
    }
  } catch (error) {
    console.error('Call timeout')
  }
}
```

### 7. Handle Errors Gracefully

Always handle potential errors in event handlers:

```typescript
eventBus.on('call:incoming', async (event) => {
  try {
    await processCall(event)
  } catch (error) {
    logger.error('Failed to process call:', error)
    // Don't let errors propagate
  }
})
```

### 8. Use Priority for Ordering

Use priorities when execution order matters:

```typescript
// Validate first
eventBus.on('call:incoming', validateCall, { priority: 100 })

// Then process
eventBus.on('call:incoming', processCall, { priority: 50 })

// Finally log
eventBus.on('call:incoming', logCall, { priority: 0 })
```

### 9. Emit Events Appropriately

Choose the right emit method for your use case:

```typescript
// Use emit() when you need to wait for handlers
await eventBus.emit('call:accepted', event)
console.log('All handlers completed')

// Use emitSync() for fire-and-forget
eventBus.emitSync('call:progress', event)
// Continue immediately without waiting
```

### 10. Centralize Event Constants

Use the `EventNames` constant for consistency:

```typescript
import { EventNames } from '@/types/events.types'

// Good: Type-safe and refactorable
eventBus.on(EventNames.CALL_INCOMING, handler)

// Avoid: String literals prone to typos
eventBus.on('call:incoming', handler)
```

## TypeScript Support

The EventBus provides full TypeScript support with type-safe event handling.

### Type-Safe Event Listening

```typescript
import type { EventMap } from '@/types/events.types'

// TypeScript knows the exact type of event
eventBus.on('connected', (event) => {
  // event is typed as ConnectionEvent
  console.log(event.state)
})

eventBus.on('call:incoming', (event) => {
  // event is typed as CallEvent
  console.log(event.session.remoteUri)
})
```

### Type-Safe Event Emission

```typescript
// TypeScript ensures you provide the correct event data
eventBus.emit('connected', {
  type: 'connected',
  state: 'connected',
  timestamp: new Date()
}) // ✓ Valid

eventBus.emit('connected', {
  // TypeScript error: missing required properties
  type: 'connected'
}) // ✗ TypeScript error
```

### Extending Event Types

You can extend the EventMap to add custom events:

```typescript
// types/custom-events.types.ts
import type { BaseEvent } from '@/types/events.types'

declare module '@/types/events.types' {
  interface EventMap {
    'custom:event': CustomEvent
  }
}

interface CustomEvent extends BaseEvent {
  type: 'custom:event'
  customData: string
}

// Now you can use the custom event with full type safety
eventBus.on('custom:event', (event) => {
  console.log(event.customData) // Fully typed
})
```

### Generic Event Handler Type

```typescript
import type { EventHandler } from '@/types/events.types'

// Define a handler with specific event type
const handleConnection: EventHandler<ConnectionEvent> = (event) => {
  console.log(event.state)
}

eventBus.on('connected', handleConnection)
```

---

**Need Help?**

- [EventBus Source Code](../../src/core/EventBus.ts)
- [Event Type Definitions](../../src/types/events.types.ts)
- [EventBus Tests](../../tests/unit/EventBus.test.ts)
- [SIP Client Documentation](./sip-client.md)

**Related Documentation:**
- [Plugin System](./plugins.md)
- [Call Management](./calls.md)
- [Media Management](./media.md)
