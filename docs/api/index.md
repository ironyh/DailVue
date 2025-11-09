# API Reference

VueSip provides a comprehensive API for building SIP/VoIP applications with Vue 3. This section covers all composables, types, events, providers, plugins, and utilities available in the library.

## Quick Navigation

### Core APIs

- **[Composables](/api/composables)** - Vue 3 Composition API based functions for SIP functionality
- **[Types](/api/types)** - TypeScript type definitions and interfaces
- **[Events](/api/events)** - Event system for real-time notifications

### Extension APIs

- **[Providers](/api/providers)** - Vue provide/inject based providers for global state
- **[Plugins](/api/plugins)** - Plugin system for extending VueSip functionality
- **[Utilities](/api/utilities)** - Helper functions and utilities

## API Overview

### Composables

VueSip's primary API surface consists of composable functions that provide reactive state and methods for SIP/VoIP functionality:

| Composable | Purpose | Key Features |
|------------|---------|--------------|
| `useSipClient` | SIP client management | Registration, connection state, authentication |
| `useCallSession` | Call session management | Making/receiving calls, call state, media streams |
| `useMediaDevices` | Media device management | Device enumeration, selection, permissions |
| `useDTMF` | DTMF tone generation | Send tones, tone queue management |
| `useCallHistory` | Call history tracking | History storage, filtering, export |
| `useCallControls` | Call control operations | Hold, mute, transfer, merge |
| `usePresence` | Presence tracking | Status updates, buddy list management |
| `useMessaging` | Instant messaging | Send/receive messages, typing indicators |
| `useConference` | Conference calling | Multi-party calls, participant management |
| `useCallRecording` | Call recording | Record calls, manage recordings |

[View Composables Documentation →](/api/composables)

### Types

Complete TypeScript type definitions for all VueSip APIs:

- **SIP Types** - SIP URIs, headers, responses, authentication
- **Call Types** - Call states, options, events, statistics
- **Media Types** - Device info, constraints, stream configuration
- **Configuration Types** - Client config, transport, ICE/STUN/TURN
- **Event Types** - All event payloads and handlers
- **History Types** - Call records, filters, storage
- **Transfer Types** - Transfer options and states
- **Conference Types** - Conference configuration and participants
- **Presence Types** - Presence states and buddy information

[View Types Documentation →](/api/types)

### Events

VueSip uses an event-driven architecture for real-time notifications:

- **Connection Events** - `connected`, `disconnected`, `connecting`, `disconnecting`
- **Registration Events** - `registered`, `unregistered`, `registrationFailed`
- **Call Events** - `callStarted`, `callEnded`, `callAnswered`, `callFailed`, `incomingCall`
- **Media Events** - `localStreamAdded`, `remoteStreamAdded`, `mediaDeviceChanged`
- **Transfer Events** - `transferRequested`, `transferAccepted`, `transferCompleted`
- **Conference Events** - `participantJoined`, `participantLeft`, `conferenceStarted`
- **Presence Events** - `presenceUpdated`, `buddyStatusChanged`
- **Message Events** - `messageReceived`, `messageSent`, `typingIndicator`

[View Events Documentation →](/api/events)

### Providers

Provider components for global configuration and state management:

- **ConfigProvider** - Global SIP client configuration
- **MediaProvider** - Shared media device management
- **EventProvider** - Centralized event bus
- **StorageProvider** - Persistence configuration

[View Providers Documentation →](/api/providers)

### Plugins

Extend VueSip functionality with the plugin system:

- Plugin interface and lifecycle hooks
- Built-in plugins for common functionality
- Custom plugin development guide
- Plugin configuration options

[View Plugins Documentation →](/api/plugins)

### Utilities

Helper functions for common tasks:

- **Validation** - SIP URI validation, configuration validation
- **Formatting** - Phone number formatting, duration formatting
- **Encryption** - Credential encryption, secure storage
- **Logging** - Debug logging, log levels, log filtering
- **Storage** - localStorage/sessionStorage/IndexedDB helpers
- **Constants** - SIP status codes, error codes, event names

[View Utilities Documentation →](/api/utilities)

## Usage Patterns

### Basic Setup

```typescript
import { useSipClient, useCallSession } from 'vuesip'

const sipClient = useSipClient({
  uri: 'sip:user@example.com',
  password: 'password',
  server: 'wss://sip.example.com:7443'
})

const callSession = useCallSession()
```

### With Providers

```vue
<template>
  <ConfigProvider :config="sipConfig">
    <MediaProvider>
      <YourApp />
    </MediaProvider>
  </ConfigProvider>
</template>
```

### With TypeScript

```typescript
import type {
  SipClientConfig,
  CallOptions,
  CallState
} from 'vuesip'

const config: SipClientConfig = {
  uri: 'sip:user@example.com',
  password: 'password',
  server: 'wss://sip.example.com:7443'
}

const options: CallOptions = {
  mediaConstraints: {
    audio: true,
    video: false
  }
}
```

### Event Handling

```typescript
import { useEventBus } from 'vuesip'

const eventBus = useEventBus()

eventBus.on('callStarted', (event) => {
  console.log('Call started:', event.callId)
})

eventBus.on('incomingCall', (event) => {
  console.log('Incoming call from:', event.remoteUri)
})
```

## API Design Principles

### Composable-First

All functionality is exposed through Vue 3 composables, providing reactive state and methods that integrate seamlessly with your Vue components.

### Type Safety

Complete TypeScript definitions ensure type safety throughout your application with full IntelliSense support.

### Event-Driven

Real-time events keep your UI synchronized with SIP/VoIP state changes automatically.

### Flexible Configuration

Multiple configuration approaches (inline, providers, plugins) to fit different application architectures.

### Tree-Shakeable

Import only what you need - unused code is eliminated from your production bundle.

## Common Workflows

### Making a Call

1. Initialize SIP client with `useSipClient`
2. Register with SIP server
3. Use `useCallSession` to initiate call
4. Monitor call events for state changes
5. Handle media streams with `useMediaDevices`

[View Making Calls Guide →](/guide/making-calls)

### Receiving Calls

1. Set up event listener for `incomingCall`
2. Handle incoming call notification
3. Answer or reject using `useCallSession`
4. Manage call state and media

[View Receiving Calls Guide →](/guide/receiving-calls)

### Device Management

1. Use `useMediaDevices` to enumerate devices
2. Request permissions if needed
3. Select audio/video devices
4. Test devices with preview
5. Apply device selection to calls

[View Device Management Guide →](/guide/device-management)

## Version Compatibility

All APIs in this reference are for **VueSip v1.0.0** and later.

For migration guides and changelog, see the [GitHub Releases](https://github.com/ironyh/VueSip/releases).

## Need Help?

- **Getting Started** - New to VueSip? Start with the [Getting Started Guide](/guide/getting-started)
- **Examples** - See working code in the [Examples](/examples/)
- **FAQ** - Check the [FAQ](/faq) for common questions
- **Issues** - Report bugs or request features on [GitHub](https://github.com/ironyh/VueSip/issues)
