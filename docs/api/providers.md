# Providers API Reference

Provider components in VueSip use Vue's provide/inject pattern to share functionality and state with child components. This document provides comprehensive API reference for all provider components.

## Table of Contents

- [Overview](#overview)
- [ConfigProvider](#configprovider)
  - [Props](#configprovider-props)
  - [Provided Context](#configprovider-context)
  - [Usage Examples](#configprovider-usage)
- [MediaProvider](#mediaprovider)
  - [Props](#mediaprovider-props)
  - [Events](#mediaprovider-events)
  - [Provided Context](#mediaprovider-context)
  - [Usage Examples](#mediaprovider-usage)
- [SipClientProvider](#sipclientprovider)
  - [Props](#sipclientprovider-props)
  - [Events](#sipclientprovider-events)
  - [Provided Context](#sipclientprovider-context)
  - [Usage Examples](#sipclientprovider-usage)
- [Combining Providers](#combining-providers)
- [Type Definitions](#type-definitions)

## Overview

VueSip provides three main provider components:

1. **ConfigProvider** - Manages SIP client configuration, media settings, and user preferences
2. **MediaProvider** - Handles media device enumeration, selection, and permissions
3. **SipClientProvider** - Provides SIP client instance and manages connection lifecycle

All providers follow a consistent pattern:
- Use Vue's `provide/inject` for dependency injection
- Include a composable function (`useXProvider()`) for type-safe consumption
- Support reactive updates to props
- Handle cleanup automatically on unmount

---

## ConfigProvider

The ConfigProvider component manages all configuration aspects of VueSip including SIP client settings, media configuration, and user preferences. It provides a centralized configuration store accessible to all child components.

**Source:** [src/providers/ConfigProvider.ts](../../src/providers/ConfigProvider.ts)

### ConfigProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sipConfig` | `SipClientConfig \| undefined` | `undefined` | Initial SIP client configuration (WebSocket URI, credentials, etc.) |
| `mediaConfig` | `MediaConfiguration \| undefined` | `undefined` | Initial media configuration (audio/video constraints, codecs, etc.) |
| `userPreferences` | `UserPreferences \| undefined` | `undefined` | Initial user preferences (device IDs, auto-answer, etc.) |
| `validateOnMount` | `boolean` | `true` | Whether to validate configuration when component mounts |
| `autoMerge` | `boolean` | `false` | If true, merges provided configs with existing values; if false, replaces them |

### ConfigProvider Context

The provider exposes the following context via `useConfigProvider()`:

#### Readonly State

| Property | Type | Description |
|----------|------|-------------|
| `sipConfig` | `SipClientConfig \| null` | Current SIP configuration |
| `mediaConfig` | `MediaConfiguration` | Current media configuration |
| `userPreferences` | `UserPreferences` | Current user preferences |
| `hasSipConfig` | `boolean` | Whether SIP configuration has been set |
| `isConfigValid` | `boolean` | Whether current configuration is valid |
| `lastValidation` | `ValidationResult \| null` | Result of last validation check |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setSipConfig` | `(config: SipClientConfig, validate?: boolean) => ValidationResult` | Set complete SIP configuration |
| `updateSipConfig` | `(updates: Partial<SipClientConfig>, validate?: boolean) => ValidationResult` | Partially update SIP configuration |
| `setMediaConfig` | `(config: MediaConfiguration, validate?: boolean) => ValidationResult` | Set complete media configuration |
| `updateMediaConfig` | `(updates: Partial<MediaConfiguration>, validate?: boolean) => ValidationResult` | Partially update media configuration |
| `setUserPreferences` | `(preferences: UserPreferences) => void` | Set complete user preferences |
| `updateUserPreferences` | `(updates: Partial<UserPreferences>) => void` | Partially update user preferences |
| `validateAll` | `() => ValidationResult` | Validate all configurations |
| `reset` | `() => void` | Reset all configuration to initial state |

### ConfigProvider Usage

#### Basic Usage

```vue
<template>
  <ConfigProvider :sip-config="sipConfig" :validate-on-mount="true">
    <MyApp />
  </ConfigProvider>
</template>

<script setup lang="ts">
import { ConfigProvider } from 'vuesip'
import type { SipClientConfig } from 'vuesip'

const sipConfig: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:alice@example.com',
  password: 'secret123',
  displayName: 'Alice'
}
</script>
```

#### Consuming Configuration in Child Components

```vue
<script setup lang="ts">
import { useConfigProvider } from 'vuesip'
import { watchEffect } from 'vue'

const config = useConfigProvider()

// Access readonly state
watchEffect(() => {
  console.log('SIP Config:', config.sipConfig)
  console.log('Is valid:', config.isConfigValid)
})

// Update configuration
const updateSipServer = (newUri: string) => {
  config.updateSipConfig({ uri: newUri })
}

// Validate configuration
const checkConfig = () => {
  const result = config.validateAll()
  if (!result.valid) {
    console.error('Validation errors:', result.errors)
  }
}
</script>
```

#### Advanced Usage with Auto-Merge

```vue
<template>
  <ConfigProvider
    :sip-config="initialConfig"
    :media-config="mediaSettings"
    :user-preferences="userPrefs"
    :auto-merge="true"
    :validate-on-mount="true"
  >
    <slot />
  </ConfigProvider>
</template>

<script setup lang="ts">
import { ConfigProvider } from 'vuesip'
import type {
  SipClientConfig,
  MediaConfiguration,
  UserPreferences
} from 'vuesip'

const initialConfig: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:user@example.com',
  password: 'secret',
  wsOptions: {
    connectionTimeout: 10000,
    maxReconnectionAttempts: 5
  }
}

const mediaSettings: MediaConfiguration = {
  audio: true,
  video: false,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  audioCodec: 'opus'
}

const userPrefs: UserPreferences = {
  enableAudio: true,
  enableVideo: false,
  autoAnswer: false
}
</script>
```

---

## MediaProvider

The MediaProvider component handles all media device-related functionality including device enumeration, selection, permissions, and monitoring. It automatically manages device changes and provides easy access to available devices.

**Source:** [src/providers/MediaProvider.ts](../../src/providers/MediaProvider.ts)

### MediaProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mediaConfig` | `MediaConfiguration \| undefined` | `undefined` | Initial media configuration |
| `autoEnumerate` | `boolean` | `true` | Automatically enumerate devices on mount |
| `autoRequestPermissions` | `boolean` | `false` | Automatically request permissions on mount |
| `requestAudio` | `boolean` | `true` | Request audio permission (only if `autoRequestPermissions` is true) |
| `requestVideo` | `boolean` | `false` | Request video permission (only if `autoRequestPermissions` is true) |
| `watchDeviceChanges` | `boolean` | `true` | Monitor device changes (plug/unplug) |
| `autoSelectDefaults` | `boolean` | `true` | Automatically select default devices after enumeration |

### MediaProvider Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `()` | Emitted when devices are enumerated and ready |
| `devicesChanged` | `(devices: MediaDevice[])` | Emitted when device list changes |
| `permissionsGranted` | `(audio: boolean, video: boolean)` | Emitted when permissions are granted |
| `permissionsDenied` | `(audio: boolean, video: boolean)` | Emitted when permissions are denied |
| `error` | `(error: Error)` | Emitted when an error occurs |

### MediaProvider Context

The provider exposes the following context via `useMediaProvider()`:

#### Readonly State - Devices

| Property | Type | Description |
|----------|------|-------------|
| `audioInputDevices` | `readonly MediaDevice[]` | Available audio input devices (microphones) |
| `audioOutputDevices` | `readonly MediaDevice[]` | Available audio output devices (speakers) |
| `videoInputDevices` | `readonly MediaDevice[]` | Available video input devices (cameras) |
| `allDevices` | `readonly MediaDevice[]` | All available media devices |

#### Readonly State - Selected Devices

| Property | Type | Description |
|----------|------|-------------|
| `selectedAudioInputId` | `string \| null` | ID of selected audio input device |
| `selectedAudioOutputId` | `string \| null` | ID of selected audio output device |
| `selectedVideoInputId` | `string \| null` | ID of selected video input device |
| `selectedAudioInputDevice` | `MediaDevice \| undefined` | Selected audio input device object |
| `selectedAudioOutputDevice` | `MediaDevice \| undefined` | Selected audio output device object |
| `selectedVideoInputDevice` | `MediaDevice \| undefined` | Selected video input device object |

#### Readonly State - Permissions

| Property | Type | Description |
|----------|------|-------------|
| `audioPermission` | `PermissionStatus` | Audio permission status |
| `videoPermission` | `PermissionStatus` | Video permission status |
| `hasAudioPermission` | `boolean` | Whether audio permission is granted |
| `hasVideoPermission` | `boolean` | Whether video permission is granted |

#### Readonly State - Counts & Status

| Property | Type | Description |
|----------|------|-------------|
| `hasAudioInputDevices` | `boolean` | Whether audio input devices are available |
| `hasAudioOutputDevices` | `boolean` | Whether audio output devices are available |
| `hasVideoInputDevices` | `boolean` | Whether video input devices are available |
| `totalDevices` | `number` | Total number of available devices |
| `isEnumerating` | `boolean` | Whether device enumeration is in progress |
| `lastError` | `Error \| null` | Last error that occurred |

#### Methods - Device Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `enumerateDevices` | `() => Promise<MediaDevice[]>` | Enumerate available media devices |
| `getDeviceById` | `(deviceId: string) => MediaDevice \| undefined` | Get device by ID |

#### Methods - Device Selection

| Method | Signature | Description |
|--------|-----------|-------------|
| `selectAudioInput` | `(deviceId: string) => void` | Select audio input device |
| `selectAudioOutput` | `(deviceId: string) => void` | Select audio output device |
| `selectVideoInput` | `(deviceId: string) => void` | Select video input device |

#### Methods - Permissions

| Method | Signature | Description |
|--------|-----------|-------------|
| `requestAudioPermission` | `() => Promise<boolean>` | Request audio permission |
| `requestVideoPermission` | `() => Promise<boolean>` | Request video permission |
| `requestPermissions` | `(audio?: boolean, video?: boolean) => Promise<void>` | Request multiple permissions |

#### Methods - Device Testing

| Method | Signature | Description |
|--------|-----------|-------------|
| `testAudioInput` | `(deviceId?: string, options?: DeviceTestOptions) => Promise<boolean>` | Test audio input device |
| `testAudioOutput` | `(deviceId?: string) => Promise<boolean>` | Test audio output device |

### MediaProvider Usage

#### Basic Usage

```vue
<template>
  <MediaProvider
    :auto-enumerate="true"
    :auto-select-defaults="true"
    @ready="onDevicesReady"
  >
    <MyApp />
  </MediaProvider>
</template>

<script setup lang="ts">
import { MediaProvider } from 'vuesip'

const onDevicesReady = () => {
  console.log('Media devices enumerated and ready!')
}
</script>
```

#### Consuming Media Devices in Child Components

```vue
<template>
  <div>
    <h3>Audio Inputs</h3>
    <select @change="handleAudioInputChange">
      <option
        v-for="device in media.audioInputDevices"
        :key="device.deviceId"
        :value="device.deviceId"
        :selected="device.deviceId === media.selectedAudioInputId"
      >
        {{ device.label || 'Unknown Device' }}
      </option>
    </select>

    <h3>Audio Outputs</h3>
    <select @change="handleAudioOutputChange">
      <option
        v-for="device in media.audioOutputDevices"
        :key="device.deviceId"
        :value="device.deviceId"
        :selected="device.deviceId === media.selectedAudioOutputId"
      >
        {{ device.label || 'Unknown Device' }}
      </option>
    </select>

    <button
      @click="testMicrophone"
      :disabled="!media.hasAudioInputDevices"
    >
      Test Microphone
    </button>
  </div>
</template>

<script setup lang="ts">
import { useMediaProvider } from 'vuesip'

const media = useMediaProvider()

const handleAudioInputChange = (event: Event) => {
  const deviceId = (event.target as HTMLSelectElement).value
  media.selectAudioInput(deviceId)
}

const handleAudioOutputChange = (event: Event) => {
  const deviceId = (event.target as HTMLSelectElement).value
  media.selectAudioOutput(deviceId)
}

const testMicrophone = async () => {
  try {
    const success = await media.testAudioInput()
    console.log('Microphone test:', success ? 'Passed' : 'Failed')
  } catch (error) {
    console.error('Test failed:', error)
  }
}
</script>
```

#### Advanced Usage with Permission Handling

```vue
<template>
  <MediaProvider
    :auto-enumerate="false"
    :auto-request-permissions="false"
    :watch-device-changes="true"
    @ready="handleReady"
    @permissionsGranted="handlePermissionsGranted"
    @permissionsDenied="handlePermissionsDenied"
    @devicesChanged="handleDevicesChanged"
    @error="handleError"
  >
    <slot />
  </MediaProvider>
</template>

<script setup lang="ts">
import { MediaProvider } from 'vuesip'
import type { MediaDevice } from 'vuesip'

const handleReady = () => {
  console.log('Media provider ready')
}

const handlePermissionsGranted = (audio: boolean, video: boolean) => {
  console.log('Permissions granted:', { audio, video })
}

const handlePermissionsDenied = (audio: boolean, video: boolean) => {
  console.warn('Permissions denied:', { audio, video })
}

const handleDevicesChanged = (devices: MediaDevice[]) => {
  console.log('Devices changed:', devices.length, 'devices available')
}

const handleError = (error: Error) => {
  console.error('Media provider error:', error)
}
</script>
```

#### Manual Permission Request Example

```vue
<script setup lang="ts">
import { useMediaProvider } from 'vuesip'
import { ref } from 'vue'

const media = useMediaProvider()
const permissionStatus = ref<string>('Not requested')

const requestPermissions = async () => {
  try {
    await media.requestPermissions(true, true) // audio and video
    permissionStatus.value = 'Granted'

    // Enumerate devices after permissions granted
    await media.enumerateDevices()
  } catch (error) {
    permissionStatus.value = 'Denied'
    console.error('Permission request failed:', error)
  }
}
</script>
```

---

## SipClientProvider

The SipClientProvider component creates and manages a SIP client instance, handling the complete lifecycle including connection, registration, and cleanup. It provides the SIP client and event bus to all child components.

**Source:** [src/providers/SipClientProvider.ts](../../src/providers/SipClientProvider.ts)

### SipClientProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `SipClientConfig` | **required** | SIP client configuration (WebSocket URI, credentials, etc.) |
| `autoConnect` | `boolean` | `true` | Automatically connect to SIP server on mount |
| `autoRegister` | `boolean` | `true` | Automatically register after connecting |
| `autoCleanup` | `boolean` | `true` | Automatically cleanup resources on unmount |
| `watchConfig` | `boolean` | `false` | Watch for config changes and reinitialize client (WARNING: causes disconnect/reconnect) |

### SipClientProvider Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `()` | Emitted when client is ready (connected and optionally registered) |
| `connected` | `()` | Emitted when client connects to SIP server |
| `disconnected` | `(error?: Error)` | Emitted when client disconnects from SIP server |
| `registered` | `(uri: string)` | Emitted when client successfully registers |
| `unregistered` | `()` | Emitted when client unregisters |
| `error` | `(error: Error)` | Emitted when an error occurs |

### SipClientProvider Context

The provider exposes the following context via `useSipClientProvider()`:

#### Readonly State

| Property | Type | Description |
|----------|------|-------------|
| `client` | `Ref<SipClient \| null>` | SIP client instance (null if not initialized) |
| `eventBus` | `Ref<EventBus>` | Event bus for subscribing to SIP events |
| `connectionState` | `Ref<ConnectionState>` | Current connection state |
| `registrationState` | `Ref<RegistrationState>` | Current registration state |
| `isReady` | `Ref<boolean>` | Whether client is ready to use |
| `error` | `Ref<Error \| null>` | Current error (null if no error) |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect` | `() => Promise<void>` | Programmatically connect to SIP server |
| `disconnect` | `() => Promise<void>` | Programmatically disconnect from SIP server |

### SipClientProvider Usage

#### Basic Usage

```vue
<template>
  <SipClientProvider
    :config="sipConfig"
    :auto-connect="true"
    :auto-register="true"
    @ready="onReady"
  >
    <MyCallInterface />
  </SipClientProvider>
</template>

<script setup lang="ts">
import { SipClientProvider } from 'vuesip'
import type { SipClientConfig } from 'vuesip'

const sipConfig: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:alice@example.com',
  password: 'secret123',
  displayName: 'Alice'
}

const onReady = () => {
  console.log('SIP client is ready!')
}
</script>
```

#### Consuming SIP Client in Child Components

```vue
<template>
  <div>
    <div>Connection: {{ connectionState }}</div>
    <div>Registration: {{ registrationState }}</div>
    <div>Ready: {{ isReady }}</div>

    <button @click="handleConnect" :disabled="isReady">
      Connect
    </button>
    <button @click="handleDisconnect" :disabled="!isReady">
      Disconnect
    </button>
  </div>
</template>

<script setup lang="ts">
import { useSipClientProvider } from 'vuesip'
import { computed } from 'vue'

const {
  client,
  eventBus,
  connectionState,
  registrationState,
  isReady,
  error,
  connect,
  disconnect
} = useSipClientProvider()

const handleConnect = async () => {
  try {
    await connect()
  } catch (err) {
    console.error('Connection failed:', err)
  }
}

const handleDisconnect = async () => {
  try {
    await disconnect()
  } catch (err) {
    console.error('Disconnection failed:', err)
  }
}
</script>
```

#### Advanced Usage with Event Handling

```vue
<template>
  <SipClientProvider
    :config="sipConfig"
    :auto-connect="false"
    :auto-register="false"
    :auto-cleanup="true"
    @ready="handleReady"
    @connected="handleConnected"
    @disconnected="handleDisconnected"
    @registered="handleRegistered"
    @unregistered="handleUnregistered"
    @error="handleError"
  >
    <slot />
  </SipClientProvider>
</template>

<script setup lang="ts">
import { SipClientProvider } from 'vuesip'
import type { SipClientConfig } from 'vuesip'

const sipConfig: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:user@example.com',
  password: 'secret',
  wsOptions: {
    connectionTimeout: 10000,
    maxReconnectionAttempts: 5,
    reconnectionDelay: 2000
  },
  registrationOptions: {
    expires: 600,
    autoRegister: false
  }
}

const handleReady = () => {
  console.log('SIP client ready')
}

const handleConnected = () => {
  console.log('Connected to SIP server')
}

const handleDisconnected = (error?: Error) => {
  if (error) {
    console.error('Disconnected with error:', error)
  } else {
    console.log('Disconnected cleanly')
  }
}

const handleRegistered = (uri: string) => {
  console.log('Registered as:', uri)
}

const handleUnregistered = () => {
  console.log('Unregistered from SIP server')
}

const handleError = (error: Error) => {
  console.error('SIP client error:', error)
}
</script>
```

#### Using Event Bus for SIP Events

```vue
<script setup lang="ts">
import { useSipClientProvider } from 'vuesip'
import { onMounted, onUnmounted } from 'vue'

const { eventBus, isReady } = useSipClientProvider()

// Store listener IDs for cleanup
const listenerIds: string[] = []

onMounted(() => {
  // Subscribe to incoming call events
  const incomingCallId = eventBus.value.on('call:incoming', (data) => {
    console.log('Incoming call from:', data.remoteIdentity)
  })
  listenerIds.push(incomingCallId)

  // Subscribe to call ended events
  const callEndedId = eventBus.value.on('call:ended', (data) => {
    console.log('Call ended:', data.cause)
  })
  listenerIds.push(callEndedId)

  // Subscribe to call accepted events
  const callAcceptedId = eventBus.value.on('call:accepted', () => {
    console.log('Call accepted')
  })
  listenerIds.push(callAcceptedId)
})

onUnmounted(() => {
  // Clean up event listeners
  listenerIds.forEach(id => {
    eventBus.value.removeById(id)
  })
})
</script>
```

---

## Combining Providers

Providers can be nested to combine their functionality. Here's the recommended nesting order:

```vue
<template>
  <ConfigProvider :sip-config="sipConfig" :media-config="mediaConfig">
    <MediaProvider :auto-enumerate="true" :auto-select-defaults="true">
      <SipClientProvider :config="sipConfig" :auto-connect="true">
        <YourApp />
      </SipClientProvider>
    </MediaProvider>
  </ConfigProvider>
</template>

<script setup lang="ts">
import {
  ConfigProvider,
  MediaProvider,
  SipClientProvider
} from 'vuesip'
import type { SipClientConfig, MediaConfiguration } from 'vuesip'

const sipConfig: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:alice@example.com',
  password: 'secret123'
}

const mediaConfig: MediaConfiguration = {
  audio: true,
  video: false,
  echoCancellation: true,
  noiseSuppression: true,
  audioCodec: 'opus'
}
</script>
```

### Using All Providers in Child Components

```vue
<script setup lang="ts">
import {
  useConfigProvider,
  useMediaProvider,
  useSipClientProvider
} from 'vuesip'
import { watchEffect } from 'vue'

// Access all providers
const config = useConfigProvider()
const media = useMediaProvider()
const sip = useSipClientProvider()

// Use configuration
watchEffect(() => {
  if (config.isConfigValid) {
    console.log('Configuration is valid')
  }
})

// Use media devices
watchEffect(() => {
  console.log('Audio inputs:', media.audioInputDevices.length)
  console.log('Selected microphone:', media.selectedAudioInputDevice?.label)
})

// Use SIP client
watchEffect(() => {
  console.log('Connection state:', sip.connectionState.value)
  console.log('Is ready:', sip.isReady.value)
})

// Make a call when everything is ready
const makeCall = async (targetUri: string) => {
  if (!sip.isReady.value) {
    console.error('SIP client not ready')
    return
  }

  if (!media.hasAudioInputDevices) {
    console.error('No microphone available')
    return
  }

  // Use the SIP client to make a call
  // (assuming the client has a makeCall method)
  try {
    await sip.client.value?.makeCall(targetUri)
  } catch (error) {
    console.error('Failed to make call:', error)
  }
}
</script>
```

---

## Type Definitions

### Core Types

All provider-related types are available from the main VueSip export:

```typescript
import type {
  // Provider contexts
  ConfigProviderContext,
  MediaProviderContext,
  SipClientProviderContext,

  // Provider props
  ConfigProviderProps,
  MediaProviderProps,

  // Configuration types
  SipClientConfig,
  MediaConfiguration,
  UserPreferences,
  ValidationResult,

  // Media types
  MediaDevice,
  MediaDeviceKind,
  PermissionStatus,

  // SIP types
  ConnectionState,
  RegistrationState,
} from 'vuesip'
```

### SipClientConfig

```typescript
interface SipClientConfig {
  uri: string                           // WebSocket SIP server URI
  sipUri: string                        // SIP user URI
  password: string                      // SIP password
  displayName?: string                  // Display name
  authorizationUsername?: string        // Auth username (if different)
  realm?: string                        // SIP realm
  ha1?: string                          // HA1 hash (alternative to password)
  wsOptions?: {
    protocols?: readonly string[]
    connectionTimeout?: number          // Default: 10000
    maxReconnectionAttempts?: number    // Default: 5
    reconnectionDelay?: number          // Default: 2000
  }
  registrationOptions?: {
    expires?: number                    // Default: 600
    autoRegister?: boolean              // Default: true
    registrationRetryInterval?: number  // Default: 30000
  }
  sessionOptions?: {
    sessionTimers?: boolean             // Default: true
    sessionTimersRefreshMethod?: 'UPDATE' | 'INVITE'
    maxConcurrentCalls?: number         // Default: 1
    callTimeout?: number                // Default: 60000
  }
  mediaConfiguration?: MediaConfiguration
  rtcConfiguration?: ExtendedRTCConfiguration
  userPreferences?: UserPreferences
  userAgent?: string
  debug?: boolean
}
```

### MediaConfiguration

```typescript
interface MediaConfiguration {
  audio?: boolean | MediaTrackConstraints
  video?: boolean | MediaTrackConstraints
  echoCancellation?: boolean            // Default: true
  noiseSuppression?: boolean            // Default: true
  autoGainControl?: boolean             // Default: true
  audioCodec?: 'opus' | 'pcmu' | 'pcma' | 'g722'
  videoCodec?: 'vp8' | 'vp9' | 'h264'
  dataChannel?: boolean
}
```

### UserPreferences

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

### MediaDevice

```typescript
interface MediaDevice {
  deviceId: string
  kind: MediaDeviceKind               // 'audioinput' | 'audiooutput' | 'videoinput'
  label: string
  groupId: string
  isDefault?: boolean
}
```

### ConnectionState

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

### RegistrationState

```typescript
enum RegistrationState {
  Unregistered = 'unregistered',
  Registering = 'registering',
  Registered = 'registered',
  RegistrationFailed = 'registration_failed',
  Unregistering = 'unregistering'
}
```

### PermissionStatus

```typescript
enum PermissionStatus {
  Granted = 'granted',
  Denied = 'denied',
  Prompt = 'prompt',
  NotRequested = 'not_requested'
}
```

---

## Additional Resources

- [Source Code - ConfigProvider](../../src/providers/ConfigProvider.ts)
- [Source Code - MediaProvider](../../src/providers/MediaProvider.ts)
- [Source Code - SipClientProvider](../../src/providers/SipClientProvider.ts)
- [Type Definitions - provider.types.ts](../../src/types/provider.types.ts)
- [Type Definitions - config.types.ts](../../src/types/config.types.ts)
- [Type Definitions - media.types.ts](../../src/types/media.types.ts)
- [Type Definitions - sip.types.ts](../../src/types/sip.types.ts)

---

**Last Updated:** 2025-11-08
