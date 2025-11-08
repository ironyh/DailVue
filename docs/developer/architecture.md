# VueSip Architecture Documentation

**Version:** 1.0.0
**Last Updated:** 2025-11-08
**Target Audience:** Developers, Technical Architects, Contributors

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Headless Pattern Explained](#headless-pattern-explained)
3. [Layer Architecture](#layer-architecture)
4. [Component Relationships](#component-relationships)
5. [Data Flow Architecture](#data-flow-architecture)
6. [State Management](#state-management)
7. [Plugin Architecture](#plugin-architecture)
8. [WebRTC Integration](#webrtc-integration)
9. [Event System](#event-system)
10. [Storage Architecture](#storage-architecture)
11. [Key Design Decisions](#key-design-decisions)
12. [Performance Considerations](#performance-considerations)
13. [Security Architecture](#security-architecture)

---

## System Overview

### Purpose and Vision

VueSip is a headless Vue.js component library that provides comprehensive SIP (Session Initiation Protocol) and WebRTC functionality for building modern VoIP applications. The library follows a headless UI pattern, completely separating business logic from presentation, allowing developers maximum flexibility in implementing custom user interfaces while leveraging robust communication features.

### Core Principles

1. **Headless Architecture**: Zero UI rendering from library components - all functionality exposed via composables
2. **Type Safety First**: Built with TypeScript from the ground up with comprehensive type definitions
3. **Composable-Driven**: Leverages Vue 3 Composition API for maximum flexibility and reusability
4. **Event-Driven**: Comprehensive event system for reactive state management and extensibility
5. **Production Ready**: Includes security, performance optimization, and comprehensive error handling
6. **Developer Experience**: Clear APIs, comprehensive documentation, and extensive testing

### Technology Stack

- **Vue.js 3.4+**: Core framework using Composition API
- **TypeScript 5.0+**: Type safety and developer experience
- **JsSIP 3.10+**: SIP protocol implementation
- **WebRTC**: Native browser APIs for media handling
- **Vite 5.0+**: Build tool and development server

---

## Headless Pattern Explained

### What is a Headless Component?

A headless component provides business logic, state management, and behavior without prescribing any specific UI implementation. In VueSip, this means:

- **No DOM Rendering**: Components don't render any HTML elements
- **Logic Only**: All functionality is exposed through JavaScript/TypeScript APIs
- **UI Agnostic**: Works with any UI framework or custom implementation
- **State Exposure**: Reactive state is exposed via Vue's reactivity system
- **Method Exposure**: All operations are available as methods

### Benefits of Headless Architecture

1. **Maximum Flexibility**: Developers have complete control over UI/UX
2. **Framework Agnostic Core**: Core logic can potentially be adapted to other frameworks
3. **Separation of Concerns**: Clean separation between business logic and presentation
4. **Easier Testing**: Logic can be tested independently of UI
5. **Smaller Bundle Size**: No CSS or UI component overhead
6. **Accessibility Control**: Developers can implement ARIA and accessibility as needed

### Implementation in VueSip

```typescript
// Headless composable - no UI rendering
export function useCallSession() {
  // Internal state (reactive)
  const callState = ref<CallState>('idle')
  const remoteUri = ref<string | null>(null)

  // Exposed methods (business logic)
  const makeCall = async (target: string) => {
    // Implementation
  }

  const hangup = async () => {
    // Implementation
  }

  // Return state and methods (no template/rendering)
  return {
    // Reactive state
    callState,
    remoteUri,
    // Methods
    makeCall,
    hangup
  }
}
```

Developers consume this in their own components:

```vue
<template>
  <!-- Developer has complete control over UI -->
  <div class="my-custom-ui">
    <p>Call Status: {{ callState }}</p>
    <button @click="makeCall('sip:user@domain')">Call</button>
    <button @click="hangup">Hang Up</button>
  </div>
</template>

<script setup>
import { useCallSession } from 'vuesip'

// Get state and methods
const { callState, makeCall, hangup } = useCallSession()
</script>
```

---

## Layer Architecture

VueSip follows a four-layer architecture that cleanly separates concerns and establishes clear boundaries between different aspects of the system.

```mermaid
graph TB
    subgraph "Integration Layer"
        A[Plugins] --> B[Analytics]
        A --> C[Recording]
        D[Middleware] --> E[Event Interceptors]
        F[Hooks] --> G[Lifecycle Hooks]
    end

    subgraph "Composable Layer"
        H[useSipClient] --> I[useSipConnection]
        H --> J[useSipRegistration]
        K[useCallSession] --> L[useCallControls]
        K --> M[useDTMF]
        N[useMediaDevices] --> O[useAudioDevices]
        P[useCallHistory]
        Q[usePresence]
        R[useMessaging]
        S[useConference]
    end

    subgraph "Business Logic Layer"
        T[SipClient] --> U[Registration]
        T --> V[Authentication]
        W[CallSession] --> X[Call State Machine]
        W --> Y[Media Handling]
        Z[MediaManager] --> AA[Device Management]
        Z --> AB[Stream Management]
        AC[EventBus] --> AD[Event Routing]
        AE[Storage] --> AF[Persistence]
    end

    subgraph "Protocol Layer"
        AG[JsSIP] --> AH[SIP Protocol]
        AI[WebRTC] --> AJ[RTCPeerConnection]
        AI --> AK[MediaStream API]
        AL[WebSocket] --> AM[Transport]
        AN[STUN/TURN] --> AO[ICE]
    end

    H -.-> T
    K -.-> W
    N -.-> Z
    T -.-> AG
    W -.-> AG
    W -.-> AI
    Z -.-> AI
    T -.-> AL
    Z -.-> AN

    style A fill:#e1f5ff
    style H fill:#fff4e1
    style T fill:#ffe1f5
    style AG fill:#e1ffe1
```

### Layer 1: Protocol Layer

The **Protocol Layer** handles low-level communication protocols and browser APIs.

**Responsibilities:**
- SIP protocol implementation via JsSIP
- WebRTC peer connection management
- WebSocket transport for SIP signaling
- ICE candidate gathering via STUN/TURN servers
- Media stream acquisition and management

**Key Components:**
- `JsSIP UA`: User Agent for SIP communication
- `RTCPeerConnection`: WebRTC connection object
- `MediaStream API`: Browser media access
- `WebSocket`: Signaling transport
- `STUN/TURN`: NAT traversal

**Isolation:**
This layer is completely isolated from Vue and application logic. It could theoretically be extracted and used in other contexts.

### Layer 2: Business Logic Layer

The **Business Logic Layer** wraps protocol implementations in application-specific logic.

**Responsibilities:**
- Call lifecycle management
- Registration and authentication
- Media device management
- Event propagation
- State persistence
- Call history tracking

**Key Components:**

1. **SipClient** (`src/core/SipClient.ts`)
   - Wraps JsSIP User Agent
   - Manages SIP registration
   - Handles authentication (Digest MD5, HA1)
   - Emits SIP-related events

2. **CallSession** (`src/core/CallSession.ts`)
   - Manages individual call sessions
   - Tracks call state transitions
   - Handles call timing and metadata
   - Manages media streams for calls

3. **MediaManager** (`src/core/MediaManager.ts`)
   - Manages RTCPeerConnection lifecycle
   - Handles ICE negotiation
   - Manages local and remote media streams
   - Enumerates and manages media devices

4. **EventBus** (`src/core/EventBus.ts`)
   - Centralized event system
   - Type-safe event emission
   - Wildcard event support
   - Async handler support

5. **TransportManager** (`src/core/TransportManager.ts`)
   - WebSocket connection management
   - Automatic reconnection with exponential backoff
   - Keep-alive mechanism
   - Connection state tracking

**Design Pattern:**
Uses the Facade pattern to provide a clean interface to complex protocol implementations while adding application-specific behavior.

### Layer 3: Composable Layer

The **Composable Layer** exposes functionality to Vue applications via composables.

**Responsibilities:**
- Expose reactive state to components
- Provide methods for SIP operations
- Manage component-level lifecycle
- Integrate with Vue's reactivity system
- Handle dependency injection via provide/inject

**Key Composables:**

1. **useSipClient** - Main SIP client connection and registration
2. **useSipConnection** - SIP connection state management
3. **useSipRegistration** - Independent registration management
4. **useCallSession** - Individual call session management
5. **useCallControls** - Call control features (hold, mute, transfer)
6. **useMediaDevices** - Media device enumeration and selection
7. **useDTMF** - DTMF tone generation
8. **useCallHistory** - Call history management with persistence
9. **usePresence** - SIP SIMPLE presence
10. **useMessaging** - SIP MESSAGE method
11. **useConference** - Multi-party conferencing

**Design Pattern:**
Follows Vue 3 Composition API patterns with `use*` naming convention, returning objects with reactive state and methods.

### Layer 4: Integration Layer

The **Integration Layer** provides extensibility and customization points.

**Responsibilities:**
- Plugin system for extending functionality
- Middleware for event interception
- Lifecycle hooks for custom behavior
- Analytics integration
- Recording and transcription plugins

**Key Components:**

1. **PluginManager** - Manages plugin lifecycle
2. **HookManager** - Manages lifecycle hooks
3. **AnalyticsPlugin** - Analytics integration
4. **RecordingPlugin** - Call recording

**Design Pattern:**
Uses the Observer pattern for hooks and the Strategy pattern for plugins.

---

## Component Relationships

### Dependency Graph

```mermaid
graph TD
    subgraph "Application Layer"
        APP[Vue Application]
    end

    subgraph "Provider Components"
        SCP[SipClientProvider] --> SC[SipClient Instance]
        CFP[ConfigProvider] --> CFG[Configuration]
        MDP[MediaProvider] --> MM[MediaManager Instance]
    end

    subgraph "Composables"
        USC[useSipClient]
        UCE[useCallSession]
        UMD[useMediaDevices]
        UCH[useCallHistory]
    end

    subgraph "Core Classes"
        SIP[SipClient]
        CS[CallSession]
        MED[MediaManager]
        EVB[EventBus]
        TRM[TransportManager]
    end

    subgraph "Stores (Pinia)"
        CST[callStore]
        RST[registrationStore]
        DST[deviceStore]
        CFST[configStore]
    end

    subgraph "Storage Adapters"
        LSA[LocalStorageAdapter]
        SSA[SessionStorageAdapter]
        IDB[IndexedDBAdapter]
    end

    APP --> USC
    APP --> UCE
    APP --> UMD

    USC --> SCP
    UCE --> SCP
    UCE --> MDP
    UMD --> MDP

    SCP --> SIP
    MDP --> MED

    USC --> CST
    USC --> RST
    UCE --> CST
    UMD --> DST
    UCH --> LSA
    UCH --> IDB

    SIP --> EVB
    SIP --> TRM
    CS --> EVB
    CS --> MED
    MED --> EVB

    CST --> LSA
    RST --> LSA
    DST --> LSA
    CFST --> LSA

    style APP fill:#e1f5ff
    style USC fill:#fff4e1
    style SIP fill:#ffe1f5
    style EVB fill:#e1ffe1
```

### Component Communication Patterns

#### 1. Provider Pattern

Providers inject global instances into the Vue component tree:

```typescript
// SipClientProvider creates a singleton SipClient
<SipClientProvider :config="sipConfig">
  <App />
</SipClientProvider>
```

Inside components:

```typescript
// Composable accesses injected instance
const sipClient = inject<SipClient>(SIP_CLIENT_KEY)
```

#### 2. Event-Driven Communication

Components communicate via the EventBus:

```typescript
// Component A emits event
eventBus.emit('call:incoming', { callId, remoteUri })

// Component B listens
eventBus.on('call:incoming', (payload) => {
  // Handle incoming call
})
```

#### 3. Reactive State Sharing

Pinia stores provide reactive global state:

```typescript
// Store definition
export const useCallStore = defineStore('call', () => {
  const activeCalls = ref<Map<string, CallSession>>(new Map())

  return { activeCalls }
})

// Usage in composable
const callStore = useCallStore()
callStore.activeCalls.set(callId, session)
```

### Dependency Injection Strategy

VueSip uses Vue's provide/inject for dependency injection:

```mermaid
graph TB
    ROOT[App Root] --> |provide| SIP[SipClient]
    ROOT --> |provide| MED[MediaManager]
    ROOT --> |provide| CFG[Config]
    ROOT --> |provide| EVT[EventBus]

    COMP1[Component 1] --> |inject| SIP
    COMP2[Component 2] --> |inject| MED
    COMP3[Component 3] --> |inject| CFG

    style ROOT fill:#e1f5ff
    style COMP1 fill:#fff4e1
```

**Benefits:**
- Singleton instances shared across application
- No prop drilling
- Easy to mock for testing
- Optional instances (graceful degradation)

---

## Data Flow Architecture

### Complete Call Flow

```mermaid
sequenceDiagram
    participant User
    participant Composable
    participant CallSession
    participant SipClient
    participant JsSIP
    participant WebRTC
    participant SIPServer
    participant RemotePeer

    User->>Composable: makeCall('sip:bob@example.com')
    Composable->>CallSession: initiate()
    CallSession->>WebRTC: getUserMedia()
    WebRTC-->>CallSession: localStream
    CallSession->>WebRTC: createOffer()
    WebRTC-->>CallSession: SDP offer
    CallSession->>SipClient: sendInvite(sdp)
    SipClient->>JsSIP: call(uri, options)
    JsSIP->>SIPServer: INVITE (with SDP)
    SIPServer->>RemotePeer: INVITE
    RemotePeer-->>SIPServer: 180 Ringing
    SIPServer-->>JsSIP: 180 Ringing
    JsSIP-->>CallSession: progress event
    CallSession-->>Composable: emit('call:ringing')
    Composable-->>User: UI shows "Ringing..."

    RemotePeer->>RemotePeer: answer()
    RemotePeer-->>SIPServer: 200 OK (with SDP)
    SIPServer-->>JsSIP: 200 OK
    JsSIP-->>CallSession: accepted event
    CallSession->>WebRTC: setRemoteDescription(sdp)
    CallSession->>JsSIP: sendACK()
    JsSIP->>SIPServer: ACK
    SIPServer->>RemotePeer: ACK

    WebRTC->>WebRTC: ICE negotiation
    WebRTC-->>CallSession: connected
    CallSession-->>Composable: emit('call:accepted')
    Composable-->>User: UI shows "Connected"

    Note over WebRTC,RemotePeer: Media flows via WebRTC
```

### Registration Flow

```mermaid
sequenceDiagram
    participant App
    participant useSipClient
    participant SipClient
    participant JsSIP
    participant SIPServer

    App->>useSipClient: connect(config)
    useSipClient->>SipClient: start()
    SipClient->>JsSIP: new UA(config)
    SipClient->>JsSIP: start()
    JsSIP->>SIPServer: WebSocket connect
    SIPServer-->>JsSIP: Connected
    JsSIP-->>SipClient: connected event
    SipClient-->>useSipClient: emit('connection:connected')

    useSipClient->>SipClient: register()
    SipClient->>JsSIP: register()
    JsSIP->>SIPServer: REGISTER
    SIPServer-->>JsSIP: 401 Unauthorized (challenge)
    JsSIP->>JsSIP: calculate digest auth
    JsSIP->>SIPServer: REGISTER (with auth)
    SIPServer-->>JsSIP: 200 OK
    JsSIP-->>SipClient: registered event
    SipClient-->>useSipClient: emit('registration:registered')
    useSipClient-->>App: isRegistered = true
```

### State Update Flow

```mermaid
graph LR
    A[User Action] --> B[Composable Method]
    B --> C[Core Class Method]
    C --> D[Protocol Layer]
    D --> E[State Change]
    E --> F[EventBus.emit]
    F --> G[Store Update]
    G --> H[Vue Reactivity]
    H --> I[UI Update]

    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#ffe1f5
    style D fill:#e1ffe1
    style I fill:#e1f5ff
```

### Media Stream Flow

```mermaid
graph TB
    subgraph "Local Media"
        A[getUserMedia] --> B[Local MediaStream]
        B --> C[Audio Track]
        B --> D[Video Track]
    end

    subgraph "Peer Connection"
        E[RTCPeerConnection] --> F[addTrack]
        F --> G[Sender]
    end

    subgraph "Network"
        H[RTP Packets] --> I[SRTP Encryption]
        I --> J[Network Transport]
    end

    subgraph "Remote Media"
        K[ontrack event] --> L[Remote MediaStream]
        L --> M[Audio Track]
        L --> N[Video Track]
    end

    C --> F
    D --> F
    G --> H
    J --> K

    style B fill:#e1f5ff
    style E fill:#fff4e1
    style J fill:#ffe1f5
    style L fill:#e1ffe1
```

---

## State Management

### Multi-Layer State Architecture

VueSip uses a multi-layer state management approach:

1. **Component-Level State**: Individual composable state (refs, reactive objects)
2. **Global Application State**: Pinia stores for shared state
3. **Persistent State**: Storage adapters for persistence

```mermaid
graph TB
    subgraph "Component State"
        A[useCallSession state] --> B[callState: ref]
        A --> C[remoteUri: ref]
        A --> D[localStream: ref]
    end

    subgraph "Global State (Pinia)"
        E[callStore] --> F[activeCalls: Map]
        E --> G[incomingCalls: Array]
        H[registrationStore] --> I[isRegistered]
        H --> J[registeredUri]
        K[deviceStore] --> L[selectedDevices]
        K --> M[availableDevices]
    end

    subgraph "Persistent State"
        N[LocalStorage] --> O[User Preferences]
        N --> P[Device Selection]
        Q[IndexedDB] --> R[Call History]
        Q --> S[Recordings]
    end

    A -.sync.-> E
    E -.persist.-> N
    E -.persist.-> Q
    H -.persist.-> N
    K -.persist.-> N

    style A fill:#e1f5ff
    style E fill:#fff4e1
    style N fill:#ffe1f5
```

### State Synchronization

**Component to Store:**
```typescript
// In composable
const callStore = useCallStore()

watch(callState, (newState) => {
  // Update store when component state changes
  callStore.updateCallState(callId, newState)
})
```

**Store to Persistence:**
```typescript
// In store
const { persist } = usePersistence({
  key: 'vuesip:calls',
  storage: localStorage,
  paths: ['activeCalls', 'callHistory']
})
```

**Event-Driven Updates:**
```typescript
// State updates trigger events
eventBus.on('call:stateChanged', ({ callId, state }) => {
  callStore.updateCallState(callId, state)
})
```

### State Persistence Strategy

**LocalStorage** (5-10MB limit):
- User preferences (audio/video settings)
- Device selections
- SIP configuration (encrypted)
- Registration state

**SessionStorage** (5-10MB limit):
- Temporary session data
- Active call metadata
- Connection state

**IndexedDB** (50MB-500MB+):
- Call history (large datasets)
- Call recordings (binary data)
- Message history
- Presence cache

```mermaid
graph LR
    A[Application State] --> B{State Type}
    B -->|Preferences| C[LocalStorage]
    B -->|Session Data| D[SessionStorage]
    B -->|Large Data| E[IndexedDB]

    C --> F[Encrypted for Sensitive]
    D --> G[Cleared on Close]
    E --> H[Indexed Queries]

    style A fill:#e1f5ff
    style C fill:#fff4e1
    style D fill:#ffe1f5
    style E fill:#e1ffe1
```

---

## Plugin Architecture

### Plugin System Design

VueSip includes a flexible plugin system for extending functionality without modifying core code.

```mermaid
graph TB
    subgraph "Plugin Manager"
        PM[PluginManager] --> PR[Plugin Registry]
        PM --> PL[Plugin Lifecycle]
    end

    subgraph "Hook System"
        HM[HookManager] --> HR[Hook Registry]
        HM --> HE[Hook Execution]
    end

    subgraph "Built-in Plugins"
        AP[AnalyticsPlugin] --> AT[Track Events]
        RP[RecordingPlugin] --> RC[Record Calls]
    end

    subgraph "Custom Plugins"
        CP[Custom Plugin] --> CH[Custom Hooks]
        CP --> CE[Custom Events]
    end

    PM --> AP
    PM --> RP
    PM --> CP
    HM --> AP
    HM --> RP
    HM --> CP

    style PM fill:#e1f5ff
    style HM fill:#fff4e1
    style AP fill:#ffe1f5
    style CP fill:#e1ffe1
```

### Plugin Interface

```typescript
interface Plugin {
  name: string
  version: string
  install(context: PluginContext): void | Promise<void>
  uninstall?(): void | Promise<void>
}

interface PluginContext {
  eventBus: EventBus
  hooks: HookRegistry
  config: Configuration
}
```

### Hook System

Available lifecycle hooks:

- `beforeConnect` - Before SIP connection
- `afterConnect` - After successful connection
- `beforeRegister` - Before SIP registration
- `afterRegister` - After successful registration
- `beforeCall` - Before initiating a call
- `afterCall` - After call connected
- `beforeAnswer` - Before answering incoming call
- `afterAnswer` - After call answered
- `beforeHangup` - Before call termination
- `afterHangup` - After call terminated
- `onError` - On any error

**Hook Execution:**
```typescript
// Register hook
hooks.register('beforeCall', async (context) => {
  // Pre-call validation
  if (!context.permissions.granted) {
    throw new Error('Permissions not granted')
  }
})

// Execute hooks
await hooks.execute('beforeCall', context)
```

### Analytics Plugin Example

```typescript
export class AnalyticsPlugin implements Plugin {
  name = 'analytics'
  version = '1.0.0'

  install(context: PluginContext) {
    const { eventBus, hooks } = context

    // Track call events
    eventBus.on('call:*', (event) => {
      this.trackEvent('call', event.type, event.data)
    })

    // Track registration
    hooks.register('afterRegister', () => {
      this.trackEvent('registration', 'success')
    })
  }

  private trackEvent(category: string, action: string, data?: any) {
    // Send to analytics service
    console.log(`[Analytics] ${category}:${action}`, data)
  }
}
```

### Recording Plugin Example

```typescript
export class RecordingPlugin implements Plugin {
  name = 'recording'
  version = '1.0.0'
  private recorder: MediaRecorder | null = null

  install(context: PluginContext) {
    const { eventBus } = context

    eventBus.on('call:accepted', ({ session }) => {
      if (session.remoteStream) {
        this.startRecording(session.remoteStream)
      }
    })

    eventBus.on('call:terminated', () => {
      this.stopRecording()
    })
  }

  private startRecording(stream: MediaStream) {
    this.recorder = new MediaRecorder(stream)
    this.recorder.start()
  }

  private stopRecording() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }
  }
}
```

---

## WebRTC Integration

### WebRTC Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        A[useCallSession]
    end

    subgraph "MediaManager"
        B[MediaManager] --> C[Device Management]
        B --> D[Stream Management]
        B --> E[Connection Management]
    end

    subgraph "WebRTC APIs"
        F[getUserMedia] --> G[Local Streams]
        H[RTCPeerConnection] --> I[ICE Handling]
        H --> J[SDP Negotiation]
        H --> K[DTMF Sender]
        L[getStats] --> M[Quality Metrics]
    end

    subgraph "Network"
        N[STUN Servers] --> O[NAT Traversal]
        P[TURN Servers] --> Q[Relay]
        R[ICE Candidates] --> S[Connectivity]
    end

    A --> B
    B --> F
    B --> H
    B --> L
    H --> N
    H --> P

    style A fill:#e1f5ff
    style B fill:#fff4e1
    style H fill:#ffe1f5
    style N fill:#e1ffe1
```

### ICE Negotiation Flow

```mermaid
sequenceDiagram
    participant PC as RTCPeerConnection
    participant STUN as STUN Server
    participant TURN as TURN Server
    participant MM as MediaManager
    participant Remote as Remote Peer

    PC->>PC: Gather host candidates
    PC->>STUN: STUN request
    STUN-->>PC: Server reflexive candidate
    PC->>TURN: Allocate request
    TURN-->>PC: Relay candidate

    PC->>MM: onicecandidate
    MM->>Remote: Send candidate (via SIP)

    Remote->>MM: Receive remote candidate
    MM->>PC: addIceCandidate()

    PC->>PC: ICE connectivity checks
    PC->>Remote: STUN checks
    Remote-->>PC: STUN responses

    PC->>MM: oniceconnectionstatechange('connected')
    MM->>MM: Media flowing
```

### Media Constraints and Quality

**Default Audio Constraints:**
```typescript
{
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1
  }
}
```

**Default Video Constraints:**
```typescript
{
  video: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user'
  }
}
```

### Codec Preference

**Audio Codecs** (priority order):
1. Opus (48 kHz, variable bitrate) - Preferred
2. G.722 (16 kHz wideband)
3. PCMU (G.711 µ-law, 8 kHz)
4. PCMA (G.711 A-law, 8 kHz)

**Video Codecs** (priority order):
1. H.264 (if available) - Preferred
2. VP9
3. VP8 (fallback)

### Statistics Collection

```mermaid
graph LR
    A[RTCPeerConnection] --> B[getStats API]
    B --> C[Parse Stats]
    C --> D[Audio Stats]
    C --> E[Video Stats]
    C --> F[Network Stats]

    D --> G[Bitrate, Packets Lost, Jitter]
    E --> H[Frame Rate, Resolution]
    F --> I[RTT, Bandwidth]

    G --> J[Quality Monitoring]
    H --> J
    I --> J

    J --> K[Adaptive Quality]

    style A fill:#e1f5ff
    style B fill:#fff4e1
    style J fill:#ffe1f5
```

**Quality Adaptation:**
- Monitor packet loss > 5%: Reduce bitrate
- Monitor RTT > 300ms: Reduce resolution/framerate
- Monitor available bandwidth: Adjust codec parameters

---

## Event System

### EventBus Architecture

```mermaid
graph TB
    subgraph "Event Emitters"
        A[SipClient] --> E[EventBus]
        B[CallSession] --> E
        C[MediaManager] --> E
        D[Stores] --> E
    end

    subgraph "EventBus"
        E --> F[Event Registry]
        E --> G[Handler Registry]
        E --> H[Wildcard Support]
        E --> I[Priority Queue]
    end

    subgraph "Event Listeners"
        J[Composables] --> E
        K[Plugins] --> E
        L[Application] --> E
    end

    style E fill:#e1f5ff
    style F fill:#fff4e1
```

### Event Categories

**Connection Events:**
- `connection:connecting`
- `connection:connected`
- `connection:disconnected`
- `connection:failed`
- `connection:reconnecting`

**Registration Events:**
- `registration:registering`
- `registration:registered`
- `registration:unregistered`
- `registration:failed`
- `registration:expiring`

**Call Events:**
- `call:incoming`
- `call:outgoing`
- `call:ringing`
- `call:progress`
- `call:accepted`
- `call:answered`
- `call:held`
- `call:unheld`
- `call:muted`
- `call:unmuted`
- `call:terminated`
- `call:failed`

**Media Events:**
- `media:deviceChanged`
- `media:deviceAdded`
- `media:deviceRemoved`
- `media:streamAdded`
- `media:streamRemoved`
- `media:trackAdded`
- `media:trackRemoved`

### Event Payload Structure

```typescript
interface EventPayload<T> {
  type: string              // Event type (e.g., 'call:incoming')
  timestamp: Date          // When event occurred
  data: T                  // Event-specific data
  metadata?: Record<string, unknown>  // Optional metadata
}
```

### Wildcard Event Listening

```typescript
// Listen to all call events
eventBus.on('call:*', (event) => {
  console.log('Call event:', event.type)
})

// Listen to all events
eventBus.on('*', (event) => {
  console.log('Any event:', event.type)
})
```

### Async Event Handlers

```typescript
eventBus.on('call:incoming', async (event) => {
  // Async operations supported
  await checkUserAvailability()
  await logIncomingCall(event.data)
})
```

### Event Priority

```typescript
// High priority handler (executes first)
eventBus.on('call:incoming', handler1, { priority: 10 })

// Normal priority (executes later)
eventBus.on('call:incoming', handler2, { priority: 0 })
```

---

## Storage Architecture

### Storage Layer Design

```mermaid
graph TB
    subgraph "Application"
        A[Composables] --> B[Stores]
    end

    subgraph "Persistence Layer"
        C[Persistence Manager] --> D[Storage Strategy]
    end

    subgraph "Storage Adapters"
        E[LocalStorageAdapter]
        F[SessionStorageAdapter]
        G[IndexedDBAdapter]
        H[Custom Adapter]
    end

    B --> C
    D --> E
    D --> F
    D --> G
    D --> H

    style A fill:#e1f5ff
    style C fill:#fff4e1
    style E fill:#ffe1f5
```

### Storage Adapter Interface

```typescript
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  has(key: string): Promise<boolean>
}
```

### LocalStorage Adapter

**Use Cases:**
- User preferences
- Device selections
- SIP configuration (encrypted)
- UI state

**Implementation:**
```typescript
export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value))
  }
}
```

### IndexedDB Adapter

**Use Cases:**
- Call history (large datasets)
- Call recordings (binary data)
- Message history
- Offline data cache

**Schema:**
```typescript
// Database: vuesip
// Version: 1

// Object Store: callHistory
{
  keyPath: 'id',
  indexes: [
    { name: 'remoteUri', keyPath: 'remoteUri' },
    { name: 'startTime', keyPath: 'startTime' },
    { name: 'direction', keyPath: 'direction' }
  ]
}

// Object Store: recordings
{
  keyPath: 'id',
  indexes: [
    { name: 'callId', keyPath: 'callId' },
    { name: 'timestamp', keyPath: 'timestamp' }
  ]
}
```

### Encryption for Sensitive Data

```typescript
// Encrypt SIP credentials before storage
const encrypted = await encrypt(credentials, userKey)
await storage.set('vuesip:credentials', encrypted)

// Decrypt on retrieval
const encrypted = await storage.get('vuesip:credentials')
const credentials = await decrypt(encrypted, userKey)
```

**Encryption Method:**
- Web Crypto API (SubtleCrypto)
- AES-GCM algorithm
- PBKDF2 key derivation
- Random IV per encryption

---

## Key Design Decisions

### 1. Headless Architecture Choice

**Decision:** Build as headless library with zero UI components

**Rationale:**
- Maximum flexibility for developers
- Smaller bundle size (no CSS/UI overhead)
- Easier to maintain (no UI testing)
- Framework agnostic core logic
- Better separation of concerns

**Trade-offs:**
- Higher barrier to entry for beginners
- No ready-to-use UI components
- More work for developers initially

### 2. Vue 3 Composition API

**Decision:** Use Composition API exclusively (no Options API)

**Rationale:**
- Better TypeScript support
- More flexible code organization
- Easier code reuse
- Better tree-shaking
- Aligns with Vue 3 best practices

**Trade-offs:**
- Requires Vue 3.4+
- Learning curve for Vue 2 developers
- No Options API compatibility

### 3. JsSIP as SIP Library

**Decision:** Use JsSIP as primary SIP implementation

**Rationale:**
- Mature and battle-tested
- Active maintenance
- Good WebRTC integration
- Comprehensive SIP support
- Browser-native implementation

**Alternatives Considered:**
- SIP.js (more complex, larger bundle)
- Custom implementation (too much effort)

### 4. Event-Driven Architecture

**Decision:** Centralized EventBus for all events

**Rationale:**
- Loose coupling between components
- Easy to extend with plugins
- Clear event flow
- Support for middleware
- Better debugging

**Trade-offs:**
- More memory usage (event listeners)
- Potential for memory leaks if not cleaned up
- Less explicit than direct method calls

### 5. Multi-Layer State Management

**Decision:** Component state + Pinia stores + Persistence

**Rationale:**
- Component state for local concerns
- Global state for shared data
- Persistence for durability
- Vue reactivity throughout

**Alternatives Considered:**
- Vue's provide/inject only (not reactive enough)
- Vuex (deprecated in favor of Pinia)
- External state management (breaks Vue integration)

### 6. TypeScript First

**Decision:** Built entirely in TypeScript with strict mode

**Rationale:**
- Better developer experience
- Catch errors at compile time
- Self-documenting code
- Better IDE support
- Industry standard

**Trade-offs:**
- Larger development overhead
- Compilation required
- Generic complexity

### 7. Plugin System

**Decision:** Extensible plugin architecture with hooks

**Rationale:**
- Core stays focused and small
- Easy to add features without modifying core
- Community can contribute plugins
- Better testability

**Alternatives Considered:**
- Monolithic design (harder to maintain)
- Inheritance-based (less flexible)

---

## Performance Considerations

### Bundle Size Optimization

**Targets:**
- Minified: < 150 KB
- Gzipped: < 50 KB

**Techniques:**
1. Tree-shaking (ESM exports)
2. Code splitting (dynamic imports)
3. Lazy loading optional features
4. Minimal dependencies
5. Terser minification

### Runtime Performance

**Targets:**
- Call setup: < 2 seconds
- State update: < 50ms
- Event propagation: < 10ms
- Memory per call: < 50 MB

**Optimizations:**
1. Object pooling for frequent allocations
2. Debounce/throttle for high-frequency events
3. Virtual scrolling for call history
4. Lazy initialization of heavy objects
5. WeakMap for metadata storage

### Memory Management

**Strategies:**
1. Automatic cleanup on call termination
2. Event listener removal on unmount
3. Stream track disposal
4. PeerConnection closure
5. Store cleanup for terminated calls

**Memory Leak Prevention:**
```typescript
// Always clean up in onUnmounted
onUnmounted(() => {
  // Remove event listeners
  eventBus.off('call:*', handler)

  // Stop media tracks
  localStream?.getTracks().forEach(track => track.stop())

  // Close peer connection
  peerConnection?.close()
})
```

### Network Optimization

**Techniques:**
1. Connection pooling (single WebSocket)
2. Keep-alive to prevent reconnections
3. Compression support
4. Adaptive bitrate for media
5. ICE candidate optimization

---

## Security Architecture

### Transport Security

**Requirements:**
- WSS (WebSocket Secure) mandatory for production
- TLS 1.2 minimum, TLS 1.3 preferred
- Certificate validation
- DTLS-SRTP for media encryption

### Authentication

**SIP Digest Authentication:**
```mermaid
graph LR
    A[Client] --> B[REGISTER]
    B --> C[Server]
    C --> D[401 + Challenge]
    D --> A
    A --> E[Calculate MD5 Hash]
    E --> F[REGISTER + Auth]
    F --> C
    C --> G[200 OK]
```

**Supported Methods:**
- Digest Authentication (MD5)
- HA1 hash support
- Authorization username override
- Realm handling

### Credential Storage

**Best Practices:**
1. Never store passwords in plain text
2. Use Web Crypto API for encryption
3. PBKDF2 for key derivation
4. Random IV per encryption
5. Clear credentials on logout

```typescript
// Encrypt credentials before storage
const key = await deriveKey(userPassword)
const encrypted = await encrypt(credentials, key)
localStorage.setItem('vuesip:creds', encrypted)
```

### Input Validation

**Validation Points:**
1. SIP URI format validation
2. Phone number validation
3. Header injection prevention
4. XSS prevention in display names
5. Path traversal prevention

### Content Security Policy

**Recommended CSP:**
```
default-src 'self';
connect-src 'self' wss://sip.example.com;
media-src 'self' blob:;
script-src 'self';
```

---

## Conclusion

VueSip's architecture is designed for:

1. **Flexibility**: Headless pattern gives developers complete UI control
2. **Maintainability**: Clean layer separation and clear responsibilities
3. **Extensibility**: Plugin system allows customization without core modifications
4. **Performance**: Optimized for production use with careful resource management
5. **Security**: Built-in security best practices and encryption
6. **Developer Experience**: TypeScript-first with comprehensive types and documentation

The four-layer architecture (Protocol → Business Logic → Composable → Integration) provides clear separation of concerns while the event-driven design enables loose coupling and extensibility. This foundation supports building robust, production-ready VoIP applications with Vue.js.

---

## Additional Resources

- **Technical Specifications**: `/TECHNICAL_SPECIFICATIONS.md`
- **API Documentation**: `/docs/api/`
- **User Guides**: `/docs/guide/`
- **Testing Guide**: `/docs/testing-guide.md`
- **Examples**: `/playground/`

---

**Document Revision:** 1.0.0
**Authors:** VueSip Development Team
**Last Review:** 2025-11-08
