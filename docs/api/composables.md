# Composables API Reference

Complete reference for all VueSip composables providing reactive SIP functionality.

## Table of Contents

- [Core Composables](#core-composables)
  - [useSipClient](#usesipclient)
  - [useSipRegistration](#usesipregistration)
  - [useCallSession](#usecallsession)
  - [useMediaDevices](#usemediadevices)
  - [useDTMF](#usedtmf)
- [Advanced Composables](#advanced-composables)
  - [useCallHistory](#usecallhistory)
  - [useCallControls](#usecallcontrols)
  - [usePresence](#usepresence)
  - [useMessaging](#usemessaging)
  - [useConference](#useconference)
- [Constants](#constants)

---

## Core Composables

### useSipClient

Provides a Vue composable interface for managing SIP client connections, registration, and configuration with reactive state management.

**Source:** [`src/composables/useSipClient.ts`](../../src/composables/useSipClient.ts)

#### Signature

```typescript
function useSipClient(
  initialConfig?: SipClientConfig,
  options?: {
    eventBus?: EventBus
    autoConnect?: boolean
    autoCleanup?: boolean
    reconnectDelay?: number
    connectionTimeout?: number
  }
): UseSipClientReturn
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialConfig` | `SipClientConfig` | `undefined` | Optional initial SIP client configuration |
| `options.eventBus` | `EventBus` | new instance | Shared event bus instance |
| `options.autoConnect` | `boolean` | `false` | Auto-connect on mount |
| `options.autoCleanup` | `boolean` | `true` | Auto-cleanup on unmount |
| `options.reconnectDelay` | `number` | `1000` | Reconnect delay in milliseconds |
| `options.connectionTimeout` | `number` | `30000` | Connection timeout in milliseconds |

#### Returns: `UseSipClientReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `ComputedRef<boolean>` | Whether client is connected to SIP server |
| `isRegistered` | `ComputedRef<boolean>` | Whether client is registered with SIP server |
| `connectionState` | `ComputedRef<ConnectionState>` | Current connection state |
| `registrationState` | `ComputedRef<RegistrationState>` | Current registration state |
| `registeredUri` | `ComputedRef<string \| null>` | Registered SIP URI |
| `error` | `Ref<Error \| null>` | Current error message |
| `isConnecting` | `ComputedRef<boolean>` | Whether client is connecting |
| `isDisconnecting` | `Ref<boolean>` | Whether client is disconnecting |
| `isStarted` | `ComputedRef<boolean>` | Whether client is started |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect` | `() => Promise<void>` | Start the SIP client and connect to server |
| `disconnect` | `() => Promise<void>` | Disconnect from SIP server and stop the client |
| `register` | `() => Promise<void>` | Register with SIP server |
| `unregister` | `() => Promise<void>` | Unregister from SIP server |
| `updateConfig` | `(config: Partial<SipClientConfig>) => ValidationResult` | Update SIP client configuration |
| `reconnect` | `() => Promise<void>` | Reconnect to SIP server |
| `getClient` | `() => SipClient \| null` | Get the underlying SIP client instance |
| `getEventBus` | `() => EventBus` | Get the event bus instance |

#### Usage Example

```typescript
import { useSipClient } from '@/composables/useSipClient'

const {
  isConnected,
  isRegistered,
  connect,
  disconnect,
  register
} = useSipClient({
  uri: 'sip:alice@domain.com',
  password: 'secret',
  wsServers: ['wss://sip.domain.com:7443']
}, {
  autoConnect: true,
  autoCleanup: true
})

// Connect and register
await connect()
await register()

// Check status
if (isConnected.value && isRegistered.value) {
  console.log('Ready to make calls')
}
```

---

### useSipRegistration

Provides reactive SIP registration state management with automatic refresh, retry logic, and expiry tracking.

**Source:** [`src/composables/useSipRegistration.ts`](../../src/composables/useSipRegistration.ts)

#### Signature

```typescript
function useSipRegistration(
  sipClient: Ref<SipClient | null>,
  options?: RegistrationOptions
): UseSipRegistrationReturn
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sipClient` | `Ref<SipClient \| null>` | - | SIP client instance |
| `options.expires` | `number` | `600` | Registration expiry time in seconds |
| `options.maxRetries` | `number` | `3` | Maximum retry attempts before giving up |
| `options.autoRefresh` | `boolean` | `true` | Enable automatic re-registration before expiry |
| `options.userAgent` | `string` | `undefined` | Custom User-Agent header |

#### Returns: `UseSipRegistrationReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `state` | `Ref<RegistrationState>` | Current registration state |
| `registeredUri` | `Ref<string \| null>` | Registered SIP URI |
| `isRegistered` | `ComputedRef<boolean>` | Whether currently registered |
| `isRegistering` | `ComputedRef<boolean>` | Whether registration is in progress |
| `isUnregistering` | `ComputedRef<boolean>` | Whether unregistration is in progress |
| `hasRegistrationFailed` | `ComputedRef<boolean>` | Whether registration has failed |
| `expires` | `Ref<number>` | Registration expiry time in seconds |
| `lastRegistrationTime` | `Ref<Date \| null>` | Timestamp when registration was last successful |
| `expiryTime` | `Ref<Date \| null>` | Timestamp when registration will expire |
| `secondsUntilExpiry` | `ComputedRef<number>` | Seconds remaining until registration expires |
| `isExpiringSoon` | `ComputedRef<boolean>` | Whether registration is about to expire (less than 30 seconds) |
| `hasExpired` | `ComputedRef<boolean>` | Whether registration has expired |
| `retryCount` | `Ref<number>` | Number of registration retry attempts |
| `lastError` | `Ref<string \| null>` | Last registration error message |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `() => Promise<void>` | Register with SIP server |
| `unregister` | `() => Promise<void>` | Unregister from SIP server |
| `refresh` | `() => Promise<void>` | Manually refresh registration |
| `resetRetries` | `() => void` | Reset retry count |
| `getStatistics` | `() => RegistrationStatistics` | Get registration statistics |

#### Usage Example

```typescript
import { useSipRegistration } from '@/composables/useSipRegistration'

const {
  isRegistered,
  register,
  unregister,
  secondsUntilExpiry
} = useSipRegistration(sipClient, {
  expires: 600,
  maxRetries: 3,
  autoRefresh: true
})

// Register
await register()

// Check status
if (isRegistered.value) {
  console.log(`Registered, expires in ${secondsUntilExpiry.value}s`)
}

// Unregister
await unregister()
```

---

### useCallSession

Provides reactive call session management with support for outgoing/incoming calls, call controls (hold, mute, DTMF), media streams, and call statistics.

**Source:** [`src/composables/useCallSession.ts`](../../src/composables/useCallSession.ts)

#### Signature

```typescript
function useCallSession(
  sipClient: Ref<SipClient | null>,
  mediaManager?: Ref<MediaManager | null>
): UseCallSessionReturn
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sipClient` | `Ref<SipClient \| null>` | SIP client instance |
| `mediaManager` | `Ref<MediaManager \| null>` | Optional media manager instance |

#### Returns: `UseCallSessionReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `session` | `Ref<CallSession \| null>` | Active call session |
| `state` | `ComputedRef<CallState>` | Call state |
| `callId` | `ComputedRef<string \| null>` | Call ID |
| `direction` | `ComputedRef<CallDirection \| null>` | Call direction (incoming/outgoing) |
| `localUri` | `ComputedRef<string \| null>` | Local SIP URI |
| `remoteUri` | `ComputedRef<string \| null>` | Remote SIP URI |
| `remoteDisplayName` | `ComputedRef<string \| null>` | Remote display name |
| `isActive` | `ComputedRef<boolean>` | Is call active |
| `isOnHold` | `ComputedRef<boolean>` | Is on hold |
| `isMuted` | `ComputedRef<boolean>` | Is muted |
| `hasRemoteVideo` | `ComputedRef<boolean>` | Has remote video |
| `hasLocalVideo` | `ComputedRef<boolean>` | Has local video |
| `localStream` | `ComputedRef<MediaStream \| null>` | Local media stream |
| `remoteStream` | `ComputedRef<MediaStream \| null>` | Remote media stream |
| `timing` | `ComputedRef<CallTimingInfo>` | Call timing information |
| `duration` | `ComputedRef<number>` | Call duration in seconds (if active) |
| `terminationCause` | `ComputedRef<TerminationCause \| undefined>` | Termination cause (if ended) |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `makeCall` | `(target: string, options?: CallSessionOptions) => Promise<void>` | Make an outgoing call |
| `answer` | `(options?: AnswerOptions) => Promise<void>` | Answer an incoming call |
| `reject` | `(statusCode?: number) => Promise<void>` | Reject an incoming call |
| `hangup` | `() => Promise<void>` | Hangup the call |
| `hold` | `() => Promise<void>` | Put call on hold |
| `unhold` | `() => Promise<void>` | Resume call from hold |
| `toggleHold` | `() => Promise<void>` | Toggle hold state |
| `mute` | `() => void` | Mute audio |
| `unmute` | `() => void` | Unmute audio |
| `toggleMute` | `() => void` | Toggle mute state |
| `sendDTMF` | `(tone: string, options?: DTMFOptions) => Promise<void>` | Send DTMF tone |
| `getStats` | `() => Promise<CallStatistics \| null>` | Get call statistics |
| `clearSession` | `() => void` | Clear current session |

#### Usage Example

```typescript
import { useCallSession } from '@/composables/useCallSession'

const {
  state,
  makeCall,
  answer,
  hangup,
  hold,
  mute,
  sendDTMF
} = useCallSession(sipClient, mediaManager)

// Make a call
await makeCall('sip:bob@domain.com', { audio: true, video: false })

// Answer incoming call
await answer()

// Put on hold
await hold()

// Mute
mute()

// Send DTMF
await sendDTMF('1')

// Hangup
await hangup()
```

---

### useMediaDevices

Provides reactive media device management with device enumeration, selection, permission handling, and device testing capabilities.

**Source:** [`src/composables/useMediaDevices.ts`](../../src/composables/useMediaDevices.ts)

#### Signature

```typescript
function useMediaDevices(
  mediaManager?: Ref<MediaManager | null>,
  options?: {
    autoEnumerate?: boolean
    autoMonitor?: boolean
  }
): UseMediaDevicesReturn
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mediaManager` | `Ref<MediaManager \| null>` | `undefined` | Optional media manager instance |
| `options.autoEnumerate` | `boolean` | `true` | Auto-enumerate devices on mount |
| `options.autoMonitor` | `boolean` | `true` | Auto-monitor device changes |

#### Returns: `UseMediaDevicesReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `audioInputDevices` | `ComputedRef<readonly MediaDevice[]>` | Audio input devices |
| `audioOutputDevices` | `ComputedRef<readonly MediaDevice[]>` | Audio output devices |
| `videoInputDevices` | `ComputedRef<readonly MediaDevice[]>` | Video input devices |
| `allDevices` | `ComputedRef<readonly MediaDevice[]>` | All devices |
| `selectedAudioInputId` | `Ref<string \| null>` | Selected audio input device ID |
| `selectedAudioOutputId` | `Ref<string \| null>` | Selected audio output device ID |
| `selectedVideoInputId` | `Ref<string \| null>` | Selected video input device ID |
| `selectedAudioInputDevice` | `ComputedRef<MediaDevice \| undefined>` | Selected audio input device |
| `selectedAudioOutputDevice` | `ComputedRef<MediaDevice \| undefined>` | Selected audio output device |
| `selectedVideoInputDevice` | `ComputedRef<MediaDevice \| undefined>` | Selected video input device |
| `audioPermission` | `ComputedRef<PermissionStatus>` | Audio permission status |
| `videoPermission` | `ComputedRef<PermissionStatus>` | Video permission status |
| `hasAudioPermission` | `ComputedRef<boolean>` | Has audio permission |
| `hasVideoPermission` | `ComputedRef<boolean>` | Has video permission |
| `hasAudioInputDevices` | `ComputedRef<boolean>` | Has audio input devices |
| `hasAudioOutputDevices` | `ComputedRef<boolean>` | Has audio output devices |
| `hasVideoInputDevices` | `ComputedRef<boolean>` | Has video input devices |
| `totalDevices` | `ComputedRef<number>` | Total device count |
| `isEnumerating` | `Ref<boolean>` | Is enumerating devices |
| `lastError` | `Ref<Error \| null>` | Last error |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `enumerateDevices` | `() => Promise<MediaDevice[]>` | Enumerate all media devices |
| `requestAudioPermission` | `() => Promise<boolean>` | Request audio permission |
| `requestVideoPermission` | `() => Promise<boolean>` | Request video permission |
| `requestPermissions` | `(audio?: boolean, video?: boolean) => Promise<void>` | Request permissions |
| `selectAudioInput` | `(deviceId: string) => void` | Select audio input device |
| `selectAudioOutput` | `(deviceId: string) => void` | Select audio output device |
| `selectVideoInput` | `(deviceId: string) => void` | Select video input device |
| `testAudioInput` | `(deviceId?: string, options?: DeviceTestOptions) => Promise<boolean>` | Test audio input device |
| `testAudioOutput` | `(deviceId?: string) => Promise<boolean>` | Test audio output device |
| `getDeviceById` | `(deviceId: string) => MediaDevice \| undefined` | Get device by ID |
| `getDevicesByKind` | `(kind: MediaDeviceKind) => readonly MediaDevice[]` | Get devices by kind |
| `startDeviceChangeMonitoring` | `() => void` | Start device change monitoring |
| `stopDeviceChangeMonitoring` | `() => void` | Stop device change monitoring |

#### Usage Example

```typescript
import { useMediaDevices } from '@/composables/useMediaDevices'

const {
  audioInputDevices,
  selectedAudioInputId,
  enumerateDevices,
  requestPermissions,
  selectAudioInput,
  testAudioInput
} = useMediaDevices(mediaManager)

// Request permissions
await requestPermissions(true, false)

// Enumerate devices
await enumerateDevices()

// Select device
if (audioInputDevices.value.length > 0) {
  selectAudioInput(audioInputDevices.value[0].deviceId)
}

// Test device
const success = await testAudioInput()
```

---

### useDTMF

Provides DTMF (Dual-Tone Multi-Frequency) tone sending functionality for active call sessions with support for tone sequences and queue management.

**Source:** [`src/composables/useDTMF.ts`](../../src/composables/useDTMF.ts)

#### Signature

```typescript
function useDTMF(
  session: Ref<CallSession | null>
): UseDTMFReturn
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `session` | `Ref<CallSession \| null>` | Call session instance |

#### Returns: `UseDTMFReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `isSending` | `Ref<boolean>` | Is currently sending DTMF |
| `queuedTones` | `Ref<string[]>` | Queued tones |
| `lastSentTone` | `Ref<string \| null>` | Last sent tone |
| `lastResult` | `Ref<DTMFSendResult \| null>` | Last send result |
| `tonesSentCount` | `Ref<number>` | Total tones sent |
| `queueSize` | `ComputedRef<number>` | Queue size |
| `isQueueEmpty` | `ComputedRef<boolean>` | Is queue empty |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendTone` | `(tone: string, options?: DTMFOptions) => Promise<void>` | Send a single DTMF tone |
| `sendToneSequence` | `(tones: string, options?: DTMFSequenceOptions) => Promise<void>` | Send a sequence of DTMF tones |
| `queueTone` | `(tone: string) => void` | Queue a tone for sending |
| `queueToneSequence` | `(tones: string) => void` | Queue multiple tones for sending |
| `processQueue` | `(options?: DTMFSequenceOptions) => Promise<void>` | Process the tone queue |
| `clearQueue` | `() => void` | Clear the tone queue |
| `stopSending` | `() => void` | Stop sending (clear queue and cancel current) |
| `resetStats` | `() => void` | Reset statistics |

#### Usage Example

```typescript
import { useDTMF } from '@/composables/useDTMF'

const {
  sendTone,
  sendToneSequence,
  isSending,
  queuedTones
} = useDTMF(session)

// Send single tone
await sendTone('1')

// Send sequence
await sendToneSequence('1234#', {
  duration: 100,
  interToneGap: 70,
  onToneSent: (tone) => console.log(`Sent: ${tone}`)
})

// Queue tones
queueToneSequence('5678')
await processQueue()
```

---

## Advanced Composables

### useCallHistory

Provides reactive call history management with filtering, searching, export functionality, and persistence to IndexedDB.

**Source:** [`src/composables/useCallHistory.ts`](../../src/composables/useCallHistory.ts)

#### Signature

```typescript
function useCallHistory(): UseCallHistoryReturn
```

#### Returns: `UseCallHistoryReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `history` | `ComputedRef<readonly CallHistoryEntry[]>` | All call history entries |
| `filteredHistory` | `ComputedRef<readonly CallHistoryEntry[]>` | Filtered history entries |
| `totalCalls` | `ComputedRef<number>` | Total number of calls in history |
| `missedCallsCount` | `ComputedRef<number>` | Total number of missed calls |
| `currentFilter` | `Ref<HistoryFilter \| null>` | Current filter |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getHistory` | `(filter?: HistoryFilter) => HistorySearchResult` | Get history with optional filter |
| `searchHistory` | `(query: string, filter?: HistoryFilter) => HistorySearchResult` | Search history by query |
| `clearHistory` | `() => Promise<void>` | Clear all history |
| `deleteEntry` | `(entryId: string) => Promise<void>` | Delete a specific entry |
| `exportHistory` | `(options: HistoryExportOptions) => Promise<void>` | Export history to file |
| `getStatistics` | `(filter?: HistoryFilter) => HistoryStatistics` | Get history statistics |
| `setFilter` | `(filter: HistoryFilter \| null) => void` | Set current filter |
| `getMissedCalls` | `() => readonly CallHistoryEntry[]` | Get missed calls only |
| `getRecentCalls` | `(limit?: number) => readonly CallHistoryEntry[]` | Get recent calls (last N) |

#### Usage Example

```typescript
import { useCallHistory } from '@/composables/useCallHistory'

const {
  history,
  filteredHistory,
  searchHistory,
  exportHistory,
  getStatistics
} = useCallHistory()

// Search history
const results = searchHistory('john')

// Get statistics
const stats = getStatistics()
console.log(`Total calls: ${stats.totalCalls}`)

// Export to CSV
await exportHistory({ format: 'csv', filename: 'my-calls' })
```

---

### useCallControls

Provides advanced call control features including blind/attended transfers, call forwarding, and basic conference management.

**Source:** [`src/composables/useCallControls.ts`](../../src/composables/useCallControls.ts)

#### Signature

```typescript
function useCallControls(
  sipClient: Ref<SipClient | null>
): UseCallControlsReturn
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sipClient` | `Ref<SipClient \| null>` | SIP client instance |

#### Returns: `UseCallControlsReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `activeTransfer` | `Ref<ActiveTransfer \| null>` | Active transfer (if any) |
| `transferState` | `ComputedRef<TransferState>` | Transfer state |
| `isTransferring` | `ComputedRef<boolean>` | Whether a transfer is in progress |
| `consultationCall` | `Ref<CallSession \| null>` | Consultation call for attended transfer |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `blindTransfer` | `(callId: string, targetUri: string, extraHeaders?: string[]) => Promise<void>` | Perform blind transfer |
| `initiateAttendedTransfer` | `(callId: string, targetUri: string) => Promise<string>` | Initiate attended transfer (creates consultation call) |
| `completeAttendedTransfer` | `() => Promise<void>` | Complete attended transfer (connect call to consultation call) |
| `cancelTransfer` | `() => Promise<void>` | Cancel active transfer |
| `forwardCall` | `(callId: string, targetUri: string) => Promise<void>` | Forward call to target URI |
| `getTransferProgress` | `() => TransferProgress \| null` | Get transfer progress |
| `onTransferEvent` | `(callback: (event: TransferEvent) => void) => () => void` | Listen for transfer events |

#### Usage Example

```typescript
import { useCallControls } from '@/composables/useCallControls'

const {
  blindTransfer,
  initiateAttendedTransfer,
  completeAttendedTransfer,
  isTransferring
} = useCallControls(sipClient)

// Blind transfer
await blindTransfer('call-123', 'sip:transfer-target@domain.com')

// Attended transfer
const consultationCallId = await initiateAttendedTransfer(
  'call-123',
  'sip:consult@domain.com'
)
// ... talk to consultation target ...
await completeAttendedTransfer()
```

---

### usePresence

Provides SIP presence (SUBSCRIBE/NOTIFY) functionality for tracking user status (available, away, busy, offline) and watching other users' presence.

**Source:** [`src/composables/usePresence.ts`](../../src/composables/usePresence.ts)

#### Signature

```typescript
function usePresence(
  sipClient: Ref<SipClient | null>
): UsePresenceReturn
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sipClient` | `Ref<SipClient \| null>` | SIP client instance |

#### Returns: `UsePresenceReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `currentStatus` | `Ref<PresenceStatus \| null>` | Current user's presence status |
| `watchedUsers` | `Ref<Map<string, PresenceStatus>>` | Map of watched users and their presence status |
| `subscriptions` | `Ref<Map<string, PresenceSubscription>>` | Active subscriptions |
| `currentState` | `ComputedRef<PresenceState>` | Current presence state |
| `subscriptionCount` | `ComputedRef<number>` | Number of active subscriptions |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setStatus` | `(state: PresenceState, options?: PresencePublishOptions) => Promise<void>` | Set own presence status |
| `subscribe` | `(uri: string, options?: PresenceSubscriptionOptions) => Promise<string>` | Subscribe to user's presence |
| `unsubscribe` | `(uri: string) => Promise<void>` | Unsubscribe from user's presence |
| `getStatus` | `(uri: string) => PresenceStatus \| null` | Get presence status for a specific user |
| `unsubscribeAll` | `() => Promise<void>` | Unsubscribe from all watched users |
| `onPresenceEvent` | `(callback: (event: PresenceEvent) => void) => () => void` | Listen for presence events |

#### Usage Example

```typescript
import { usePresence } from '@/composables/usePresence'
import { PresenceState } from '@/types/presence.types'

const { setStatus, subscribe, watchedUsers } = usePresence(sipClient)

// Set own status
await setStatus(PresenceState.Available, {
  statusMessage: 'Working on project'
})

// Watch another user
await subscribe('sip:alice@domain.com')

// Check their status
watchedUsers.value.forEach((status, uri) => {
  console.log(`${uri}: ${status.state}`)
})
```

---

### useMessaging

Provides SIP MESSAGE functionality for sending and receiving instant messages via SIP protocol, with support for delivery notifications and composing indicators.

**Source:** [`src/composables/useMessaging.ts`](../../src/composables/useMessaging.ts)

#### Signature

```typescript
function useMessaging(
  sipClient: Ref<SipClient | null>
): UseMessagingReturn
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sipClient` | `Ref<SipClient \| null>` | SIP client instance |

#### Returns: `UseMessagingReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `Ref<Message[]>` | All messages |
| `conversations` | `ComputedRef<Map<string, Conversation>>` | Conversations grouped by URI |
| `unreadCount` | `ComputedRef<number>` | Total unread message count |
| `composingIndicators` | `Ref<Map<string, ComposingIndicator>>` | Composing indicators |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendMessage` | `(to: string, content: string, options?: MessageSendOptions) => Promise<string>` | Send a message |
| `markAsRead` | `(messageId: string) => void` | Mark message as read |
| `markAllAsRead` | `(uri?: string) => void` | Mark all messages from a URI as read |
| `deleteMessage` | `(messageId: string) => void` | Delete a message |
| `clearMessages` | `(uri?: string) => void` | Clear all messages |
| `getMessagesForUri` | `(uri: string) => Message[]` | Get messages for a specific URI |
| `getFilteredMessages` | `(filter: MessageFilter) => Message[]` | Get filtered messages |
| `sendComposingIndicator` | `(to: string, isComposing: boolean) => Promise<void>` | Send composing indicator |
| `onMessagingEvent` | `(callback: (event: MessagingEvent) => void) => () => void` | Listen for messaging events |

#### Usage Example

```typescript
import { useMessaging } from '@/composables/useMessaging'

const { sendMessage, messages, unreadCount } = useMessaging(sipClient)

// Send a message
const messageId = await sendMessage('sip:alice@domain.com', 'Hello!')

// Check unread count
console.log(`Unread messages: ${unreadCount.value}`)

// Mark as read
markAllAsRead('sip:alice@domain.com')
```

---

### useConference

Provides conference call functionality for managing multi-party calls with participant management, audio level monitoring, and conference controls.

**Source:** [`src/composables/useConference.ts`](../../src/composables/useConference.ts)

#### Signature

```typescript
function useConference(
  sipClient: Ref<SipClient | null>
): UseConferenceReturn
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sipClient` | `Ref<SipClient \| null>` | SIP client instance |

#### Returns: `UseConferenceReturn`

##### Reactive State

| Property | Type | Description |
|----------|------|-------------|
| `conference` | `Ref<ConferenceStateInterface \| null>` | Current conference state |
| `state` | `ComputedRef<ConferenceState>` | Current state of the conference |
| `participants` | `ComputedRef<Participant[]>` | Array of all participants |
| `localParticipant` | `ComputedRef<Participant \| null>` | The local participant (self) |
| `participantCount` | `ComputedRef<number>` | Total number of participants |
| `isActive` | `ComputedRef<boolean>` | Whether the conference is active |
| `isLocked` | `ComputedRef<boolean>` | Whether the conference is locked |
| `isRecording` | `ComputedRef<boolean>` | Whether the conference is being recorded |

##### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createConference` | `(options?: ConferenceOptions) => Promise<string>` | Create a new conference |
| `joinConference` | `(conferenceUri: string, options?: ConferenceOptions) => Promise<void>` | Join an existing conference |
| `addParticipant` | `(uri: string, displayName?: string) => Promise<string>` | Add a participant to the conference |
| `removeParticipant` | `(participantId: string, reason?: string) => Promise<void>` | Remove a participant from the conference |
| `muteParticipant` | `(participantId: string) => Promise<void>` | Mute a participant's audio |
| `unmuteParticipant` | `(participantId: string) => Promise<void>` | Unmute a participant's audio |
| `endConference` | `() => Promise<void>` | End the conference for all participants |
| `lockConference` | `() => Promise<void>` | Lock the conference |
| `unlockConference` | `() => Promise<void>` | Unlock the conference |
| `startRecording` | `() => Promise<void>` | Start recording the conference |
| `stopRecording` | `() => Promise<void>` | Stop recording the conference |
| `getParticipant` | `(participantId: string) => Participant \| null` | Get a specific participant by ID |
| `onConferenceEvent` | `(callback: (event: ConferenceEvent) => void) => () => void` | Listen for conference events |

#### Usage Example

```typescript
import { useConference } from '@/composables/useConference'

const {
  createConference,
  addParticipant,
  participants,
  participantCount,
  endConference
} = useConference(sipClient)

// Create a new conference
const confId = await createConference({
  maxParticipants: 10,
  locked: false
})

// Add participants
await addParticipant('sip:alice@domain.com', 'Alice')
await addParticipant('sip:bob@domain.com', 'Bob')

// Monitor participants
console.log(`Active participants: ${participantCount.value}`)

// End conference when done
await endConference()
```

---

## Constants

All composables use centralized constants for configuration and magic numbers. These are exported from `src/composables/constants.ts`.

**Source:** [`src/composables/constants.ts`](../../src/composables/constants.ts)

### Available Constants

#### REGISTRATION_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_EXPIRES` | `600` | Default registration expiry time in seconds |
| `DEFAULT_MAX_RETRIES` | `3` | Default maximum retry attempts |
| `REFRESH_PERCENTAGE` | `0.9` | Registration refresh percentage (90% of expiry) |
| `EXPIRING_SOON_THRESHOLD` | `30` | Seconds threshold for "expiring soon" warning |
| `BASE_RETRY_DELAY` | `1000` | Base retry delay in milliseconds |
| `MAX_RETRY_DELAY` | `30000` | Maximum retry delay in milliseconds |

#### PRESENCE_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_EXPIRES` | `3600` | Default presence publish expiry in seconds |
| `SUBSCRIPTION_REFRESH_PERCENTAGE` | `0.9` | Subscription refresh percentage (90% of expiry) |
| `DEFAULT_SUBSCRIPTION_EXPIRES` | `3600` | Default subscription expiry in seconds |

#### MESSAGING_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `COMPOSING_IDLE_TIMEOUT` | `10000` | Composing indicator idle timeout in milliseconds |
| `COMPOSING_TIMEOUT_SECONDS` | `10` | Composing indicator timeout in seconds |

#### CONFERENCE_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_MAX_PARTICIPANTS` | `10` | Default maximum participants in a conference |
| `AUDIO_LEVEL_INTERVAL` | `100` | Audio level monitoring interval in milliseconds |
| `STATE_TRANSITION_DELAY` | `2000` | Conference state transition delay in milliseconds |

#### TRANSFER_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `COMPLETION_DELAY` | `2000` | Transfer completion delay in milliseconds |
| `CANCELLATION_DELAY` | `1000` | Transfer cancellation delay in milliseconds |

#### HISTORY_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_LIMIT` | `10` | Default call history limit |
| `DEFAULT_OFFSET` | `0` | Default offset for pagination |
| `DEFAULT_SORT_ORDER` | `'desc'` | Default sort order |
| `DEFAULT_SORT_BY` | `'startTime'` | Default sort field |
| `TOP_FREQUENT_CONTACTS` | `10` | Top N frequent contacts to return |

#### CALL_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_CONCURRENT_CALLS` | `5` | Maximum concurrent calls |
| `CALL_TIMEOUT` | `30000` | Call timeout in milliseconds |
| `RING_TIMEOUT` | `60000` | Ring timeout in milliseconds |

#### MEDIA_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `ENUMERATION_RETRY_DELAY` | `1000` | Device enumeration retry delay in milliseconds |
| `DEFAULT_TEST_DURATION` | `2000` | Device test duration in milliseconds |
| `AUDIO_LEVEL_THRESHOLD` | `0.01` | Audio level threshold for device test (0-1) |

#### DTMF_CONSTANTS

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_DURATION` | `100` | Default DTMF tone duration in milliseconds |
| `DEFAULT_INTER_TONE_GAP` | `70` | Default inter-tone gap in milliseconds |
| `MIN_DURATION` | `40` | Minimum allowed duration in milliseconds |
| `MAX_DURATION` | `6000` | Maximum allowed duration in milliseconds |
| `MAX_QUEUE_SIZE` | `100` | Maximum DTMF queue size |

### Usage Example

```typescript
import {
  REGISTRATION_CONSTANTS,
  DTMF_CONSTANTS,
  CONFERENCE_CONSTANTS
} from '@/composables/constants'

// Use in your code
const expiryTime = REGISTRATION_CONSTANTS.DEFAULT_EXPIRES
const toneDuration = DTMF_CONSTANTS.DEFAULT_DURATION
const maxParticipants = CONFERENCE_CONSTANTS.DEFAULT_MAX_PARTICIPANTS
```

---

## Type Definitions

All composables use TypeScript for type safety. Main type definitions can be found in:

- **Call Types:** `src/types/call.types.ts`
- **Media Types:** `src/types/media.types.ts`
- **History Types:** `src/types/history.types.ts`
- **Presence Types:** `src/types/presence.types.ts`
- **Messaging Types:** `src/types/messaging.types.ts`
- **Conference Types:** `src/types/conference.types.ts`
- **Transfer Types:** `src/types/transfer.types.ts`
- **SIP Types:** `src/types/sip.types.ts`
- **Config Types:** `src/types/config.types.ts`

---

## Best Practices

### 1. Lifecycle Management

Always ensure proper cleanup by using the `autoCleanup` option or manually cleaning up in `onUnmounted`:

```typescript
import { onUnmounted } from 'vue'

const { disconnect } = useSipClient(config, { autoCleanup: false })

onUnmounted(async () => {
  await disconnect()
})
```

### 2. Error Handling

All async methods can throw errors. Always wrap them in try-catch blocks:

```typescript
try {
  await connect()
  await register()
} catch (error) {
  console.error('Connection failed:', error)
}
```

### 3. Reactive State

Use computed properties and watch for reactive updates:

```typescript
import { watch } from 'vue'

const { isRegistered, registrationState } = useSipRegistration(sipClient)

watch(registrationState, (newState) => {
  console.log('Registration state changed:', newState)
})
```

### 4. Event Listeners

Always clean up event listeners to prevent memory leaks:

```typescript
const unsubscribe = onPresenceEvent((event) => {
  console.log('Presence event:', event)
})

// Later...
unsubscribe()
```

### 5. Shared Instances

When using multiple composables, share the SipClient instance:

```typescript
const sipClientRef = ref(null)

const sipClient = useSipClient(config)
sipClientRef.value = sipClient.getClient()

const registration = useSipRegistration(sipClientRef)
const callSession = useCallSession(sipClientRef)
const presence = usePresence(sipClientRef)
```

---

## Related Documentation

- [Core API Reference](./core.md)
- [Plugin System](./plugins.md)
- [Testing Guide](../testing-guide.md)
- [Getting Started](../index.md)
