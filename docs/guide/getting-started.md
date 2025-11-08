# Getting Started with VueSip

Welcome to VueSip! This comprehensive guide will walk you through everything you need to know to build professional SIP/VoIP applications using Vue 3. Whether you're creating a simple click-to-call button or a full-featured softphone, VueSip provides the tools you need.

## What is VueSip?

VueSip is a **headless Vue.js component library** for building SIP (Session Initiation Protocol) applications. It provides powerful, reactive composables that handle all the complex business logic of VoIP calling, while giving you complete control over the user interface.

### Why Headless?

💡 **Tip:** The "headless" approach means VueSip handles all the logic (connection management, call state, audio routing) but doesn't impose any UI. This gives you the freedom to design your interface exactly how you want, whether it's a minimal call button, a full softphone, or anything in between.

**Key Features:**

- **Headless Architecture** - Complete separation of logic and UI for maximum flexibility
- **Vue 3 Composition API** - Modern, reactive composables that integrate seamlessly with your components
- **TypeScript Support** - Full type safety and IntelliSense for a better development experience
- **WebRTC Integration** - Built on JsSIP for reliable, standards-compliant SIP calling
- **Device Management** - Easy audio/video device selection and testing
- **DTMF Support** - Send dialpad tones during calls for IVR navigation
- **Flexible Configuration** - Extensive options for customization to fit your needs

## Installation

**What you'll do:** Install VueSip in your Vue 3 project using your preferred package manager.

Install VueSip using your preferred package manager:

::: code-group

```bash [npm]
npm install vuesip
```

```bash [pnpm]
pnpm add vuesip
```

```bash [yarn]
yarn add vuesip
```

:::

### Peer Dependencies

📝 **Note:** VueSip requires Vue 3.4.0 or higher to take advantage of the latest Composition API features.

```json
{
  "peerDependencies": {
    "vue": "^3.4.0"
  }
}
```

If you don't have Vue 3 installed yet, add it to your project:

```bash
npm install vue@^3.4.0
```

### Browser Support

⚠️ **Important:** VueSip requires WebRTC support, which is available in modern browsers. Ensure your target audience uses compatible browsers.

VueSip works on:

- **Chrome/Edge** 90+ (Recommended for best compatibility)
- **Firefox** 88+
- **Safari** 14+

📝 **Note:** Mobile browsers are supported, but microphone permissions may require HTTPS in production environments.

## Basic Setup

**What you'll learn:** Two ways to integrate VueSip into your application and when to use each approach.

There are two ways to use VueSip in your application. Choose based on your needs:

### Option 1: Direct Composable Usage (Recommended for Most Projects)

✅ **Best Practice:** Use this approach for most applications. It's simple, flexible, and keeps your configuration close to where it's used.

**When to use:**
- Building a single-page application with one or two calling components
- You want explicit control over SIP client lifecycle
- Different parts of your app need different SIP configurations

Use VueSip composables directly in your components without any plugin installation:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useSipClient, useCallSession } from 'vuesip'

// Connect to your SIP server with credentials
const { connect, isConnected, isRegistered } = useSipClient({
  uri: 'wss://sip.example.com:7443',        // WebSocket URI of your SIP server
  sipUri: 'sip:1000@example.com',           // Your SIP username and domain
  password: 'your-password',                 // SIP password
  displayName: 'Your Name'                   // Name shown to other callers
})

// Your component logic here
</script>
```

### Option 2: Global Plugin Installation

💡 **Tip:** Use this approach when you need to share SIP configuration across many components or want centralized debugging settings.

**When to use:**
- Building a full softphone application with multiple calling components
- You need shared global state across the entire app
- You want centralized debug logging and configuration

Install VueSip as a Vue plugin for global configuration:

```typescript
// main.ts
import { createApp } from 'vue'
import { createVueSip } from 'vuesip'
import App from './App.vue'

const app = createApp(App)

// Configure VueSip globally
app.use(createVueSip({
  debug: import.meta.env.DEV,               // Enable debug logs in development
  logLevel: 'info',                         // Log level: 'debug' | 'info' | 'warn' | 'error'
  sipConfig: {
    uri: 'wss://sip.example.com:7443',      // Default WebSocket URI
    autoRegister: true                       // Automatically register on connection
  }
}))

app.mount('#app')
```

📝 **Note:** After global installation, you can still override settings in individual components by passing configuration to the composables.

## Your First Call

**What you'll build:** A complete, working SIP phone component that connects to a server, makes calls, and provides call controls like mute and hold.

Let's build a simple but complete component that demonstrates core VueSip functionality. This example shows:
- Connecting to a SIP server
- Making outgoing calls
- Controlling active calls (mute, hold, hangup)
- Displaying connection and call status

### Step 1: Create the Template

The template provides UI for connection status, call controls, and error display:

```vue
<template>
  <div class="sip-phone">
    <!-- Connection Status: Shows real-time connection and registration state -->
    <div class="status-bar">
      <span>Connection: {{ isConnected ? 'Connected' : 'Disconnected' }}</span>
      <span>Registration: {{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
    </div>

    <!-- Connection Form: Shown when not connected to SIP server -->
    <div v-if="!isConnected" class="connection-form">
      <input v-model="phoneNumber" placeholder="Phone number" />
      <button @click="handleConnect" :disabled="isConnecting">
        {{ isConnecting ? 'Connecting...' : 'Connect' }}
      </button>
    </div>

    <!-- Call Controls: Shown when connected to SIP server -->
    <div v-else class="call-controls">
      <input v-model="targetNumber" placeholder="Number to call" />
      <button @click="handleMakeCall" :disabled="isActive">
        Make Call
      </button>

      <!-- Active Call Display: Shown during an active call -->
      <div v-if="isActive" class="active-call">
        <p>Call State: {{ state }}</p>
        <p v-if="remoteUri">Calling: {{ remoteUri }}</p>
        <p v-if="duration > 0">Duration: {{ formatDuration(duration) }}</p>

        <div class="call-buttons">
          <button @click="toggleMute">
            {{ isMuted ? 'Unmute' : 'Mute' }}
          </button>
          <button @click="toggleHold">
            {{ isOnHold ? 'Resume' : 'Hold' }}
          </button>
          <button @click="handleHangup" class="danger">
            Hang Up
          </button>
        </div>
      </div>

      <button @click="handleDisconnect" class="disconnect">
        Disconnect
      </button>
    </div>

    <!-- Error Display: Shows any connection or call errors -->
    <div v-if="error" class="error">{{ error.message }}</div>
  </div>
</template>
```

### Step 2: Set Up the Component Logic

The script section initializes the SIP client and call session:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient, useCallSession } from 'vuesip'

// Configuration: User inputs and call targets
const phoneNumber = ref('1000')    // Your SIP extension number
const targetNumber = ref('')        // Number to call

// SIP Client Setup: Manages connection to SIP server
const sipClient = ref(null)
const {
  isConnected,      // true when WebSocket connection is active
  isRegistered,     // true when registered with SIP server
  isConnecting,     // true during connection attempt
  error,            // Contains any connection errors
  connect,          // Function to connect to SIP server
  disconnect,       // Function to disconnect from SIP server
  getClient         // Function to get the JsSIP UA instance
} = useSipClient({
  uri: 'wss://sip.example.com:7443',                    // WebSocket server address
  sipUri: `sip:${phoneNumber.value}@example.com`,       // Your SIP identity
  password: 'your-password',                             // SIP account password
  displayName: 'My Phone'                                // Display name for outgoing calls
})

// Call Session Setup: Manages individual call sessions
const {
  session,          // Current RTCSession instance
  state,            // Call state: 'idle' | 'calling' | 'ringing' | 'active' | 'terminated'
  remoteUri,        // SIP URI of the remote party
  isActive,         // true when call is in progress
  isOnHold,         // true when call is on hold
  isMuted,          // true when microphone is muted
  duration,         // Call duration in seconds
  makeCall,         // Function to initiate outgoing call
  hangup,           // Function to end the call
  toggleHold,       // Function to toggle hold state
  toggleMute        // Function to toggle mute state
} = useCallSession(sipClient)
```

### Step 3: Implement Event Handlers

Handle user interactions with proper error handling:

```vue
// Event Handlers: Handle user actions with error handling

// Connect to SIP server
const handleConnect = async () => {
  try {
    await connect()                    // Initiate WebSocket connection
    sipClient.value = getClient()      // Store client reference for call session
  } catch (err) {
    console.error('Connection failed:', err)
    // Error will be displayed in UI via the error reactive state
  }
}

// Disconnect from SIP server
const handleDisconnect = async () => {
  try {
    await disconnect()                 // Close WebSocket and unregister
  } catch (err) {
    console.error('Disconnect failed:', err)
  }
}

// Initiate outgoing call
const handleMakeCall = async () => {
  if (!targetNumber.value) return      // Validate input

  try {
    await makeCall(`sip:${targetNumber.value}@example.com`, {
      audio: true,                     // Enable audio
      video: false                     // Disable video for audio-only call
    })
  } catch (err) {
    console.error('Call failed:', err)
  }
}

// End active call
const handleHangup = async () => {
  try {
    await hangup()                     // Terminate the call session
  } catch (err) {
    console.error('Hangup failed:', err)
  }
}

// Helper function to format call duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>
```

### Step 4: Add Styling

Basic styles for a clean, functional interface:

```vue
<style scoped>
.sip-phone {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 1rem;
}

input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 0.75rem 1.5rem;
  margin: 0.5rem;
  border: none;
  border-radius: 4px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.danger {
  background: #ef4444;
}

.error {
  padding: 1rem;
  background: #fee;
  color: #c00;
  border-radius: 4px;
  margin-top: 1rem;
}
</style>
```

✅ **Success!** You now have a working SIP phone component. Test it by:
1. Updating the SIP server URI and credentials
2. Running your Vue app
3. Clicking "Connect" to establish a SIP connection
4. Entering a number and clicking "Make Call"

## Configuration Overview

**What you'll learn:** All available configuration options and when to use them to customize VueSip for your specific needs.

VueSip provides extensive configuration options to handle various SIP server setups, network conditions, and user preferences. This section details all available options.

### SipClientConfig

The main configuration object for connecting to a SIP server. Each option is explained with its purpose and default value:

```typescript
interface SipClientConfig {
  // ===== Required Connection Settings =====
  // These three fields are mandatory for any SIP connection

  uri: string                    // WebSocket URI: 'wss://sip.example.com:7443'
                                 // Use 'wss://' for secure connections (recommended)

  sipUri: string                 // Your SIP identity: 'sip:user@domain.com'
                                 // This identifies you on the SIP network

  password: string               // SIP account password for authentication

  // ===== Optional Identity Settings =====
  // Customize how you appear to other users

  displayName?: string           // Name shown to other callers (e.g., "John Doe")

  authorizationUsername?: string // Username for authentication if different from SIP URI
                                 // Useful when auth username differs from calling identity

  realm?: string                 // SIP realm for authentication
                                 // Usually your domain, sometimes required by server

  ha1?: string                   // HA1 hash (alternative to plain password)
                                 // More secure than sending plain password

  // ===== WebSocket Options =====
  // Control WebSocket connection behavior

  wsOptions?: {
    protocols?: string[]         // WebSocket sub-protocols (rarely needed)

    connectionTimeout?: number   // Max time to wait for connection in ms (default: 10000)
                                 // Increase for slow networks

    maxReconnectionAttempts?: number  // How many times to retry connection (default: 5)
                                      // Set to 0 to disable auto-reconnect

    reconnectionDelay?: number   // Wait time between reconnect attempts in ms (default: 2000)
                                 // Exponential backoff is applied automatically
  }

  // ===== Registration Options =====
  // Control SIP registration behavior

  registrationOptions?: {
    expires?: number             // Registration validity in seconds (default: 600)
                                 // Server may override this value

    autoRegister?: boolean       // Auto-register after connection (default: true)
                                 // Set false if you want manual registration control

    registrationRetryInterval?: number  // Retry interval after failed registration in ms (default: 30000)
  }

  // ===== Session Options =====
  // Control call session behavior

  sessionOptions?: {
    sessionTimers?: boolean      // Enable SIP session timers (default: true)
                                 // Helps detect dead sessions

    maxConcurrentCalls?: number  // Maximum simultaneous calls (default: 1)
                                 // Increase for call center applications

    callTimeout?: number         // Call setup timeout in ms (default: 60000)
                                 // How long to wait for call answer
  }

  // ===== Media Configuration =====
  // Control audio/video quality and processing

  mediaConfiguration?: {
    audio?: boolean | MediaTrackConstraints    // Enable audio or provide detailed constraints
    video?: boolean | MediaTrackConstraints    // Enable video or provide detailed constraints

    echoCancellation?: boolean   // Remove echo from audio (default: true)
                                 // Highly recommended for most use cases

    noiseSuppression?: boolean   // Filter background noise (default: true)
                                 // Improves call quality in noisy environments

    autoGainControl?: boolean    // Normalize volume automatically (default: true)
                                 // Prevents volume fluctuations

    audioCodec?: 'opus' | 'pcmu' | 'pcma' | 'g722'  // Preferred audio codec
                                                     // opus: best quality (recommended)
                                                     // pcmu/pcma: compatibility
                                                     // g722: HD audio

    videoCodec?: 'vp8' | 'vp9' | 'h264'  // Preferred video codec
  }

  // ===== RTC Configuration =====
  // STUN/TURN servers for NAT traversal
  // Critical for calls through firewalls and NAT

  rtcConfiguration?: {
    stunServers?: string[]       // STUN server URLs for NAT discovery
                                 // Example: ['stun:stun.l.google.com:19302']

    turnServers?: TurnServerConfig[]  // TURN server configs for NAT traversal
                                      // Required when direct connection fails

    iceTransportPolicy?: RTCIceTransportPolicy  // 'all' | 'relay'
                                                 // 'relay' forces all traffic through TURN

    bundlePolicy?: RTCBundlePolicy  // How to bundle media streams
  }

  // ===== User Preferences =====
  // Default settings for user experience

  userPreferences?: {
    audioInputDeviceId?: string  // Default microphone device ID
    audioOutputDeviceId?: string // Default speaker device ID
    videoInputDeviceId?: string  // Default camera device ID

    autoAnswer?: boolean         // Automatically answer incoming calls
                                 // Useful for intercom-style applications

    autoAnswerDelay?: number     // Delay before auto-answer in ms
                                 // Gives time to show incoming call UI

    ringToneUrl?: string         // Custom ringtone audio file URL

    enableDtmfTones?: boolean    // Play DTMF tones when sending digits
                                 // Provides audio feedback for dialpad
  }

  // ===== Debugging =====
  // Development and troubleshooting options

  debug?: boolean                // Enable detailed console logging
                                 // Very helpful during development

  userAgent?: string            // Custom User-Agent header
                                 // Identifies your application to the server
}
```

### Example Configurations

Real-world configuration examples for common scenarios:

#### Basic Configuration

Perfect for getting started or simple applications:

```typescript
// Minimal setup for testing and development
const basicConfig = {
  uri: 'wss://sip.example.com:7443',    // Your SIP server WebSocket endpoint
  sipUri: 'sip:1000@example.com',       // Your SIP extension
  password: 'secret123',                 // Your SIP password
  displayName: 'John Doe'                // Your display name
}
```

💡 **Tip:** Start with this basic configuration and add options as needed. This is sufficient for most development and testing scenarios.

#### Production Configuration with STUN/TURN

Recommended for production deployments:

```typescript
// Production-ready configuration with NAT traversal
const productionConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret123',
  displayName: 'John Doe',

  // Registration settings for reliability
  registrationOptions: {
    expires: 600,                        // Re-register every 10 minutes
    autoRegister: true,                  // Register immediately on connection
    registrationRetryInterval: 30000     // Retry failed registrations after 30s
  },

  // Media settings for optimal quality
  mediaConfiguration: {
    audio: true,
    video: false,
    echoCancellation: true,              // Essential for preventing feedback
    noiseSuppression: true,              // Improves quality in noisy environments
    autoGainControl: true,               // Normalizes volume levels
    audioCodec: 'opus'                   // Best quality codec
  },

  // STUN/TURN configuration for NAT traversal
  // This is CRITICAL for calls to work through firewalls and NAT
  rtcConfiguration: {
    stunServers: [
      'stun:stun.l.google.com:19302'     // Google's public STUN server
    ],
    turnServers: [
      {
        urls: 'turn:turn.example.com:3478',      // Your TURN server
        username: 'turnuser',                     // TURN credentials
        credential: 'turnpass'
      }
    ],
    iceTransportPolicy: 'all'            // Try direct connection first, fall back to TURN
  },

  // User preferences
  userPreferences: {
    autoAnswer: false,                   // Manually answer calls
    enableDtmfTones: true                // Play tones when dialing
  },

  // Debugging (disable in production)
  debug: false
}
```

⚠️ **Important:** STUN/TURN servers are essential for production use. Without them, calls may fail when users are behind NAT or firewalls (which is most corporate and home networks).

#### Advanced Configuration for Custom Devices

For applications with specific audio device requirements:

```typescript
// Configuration with custom device selection
const advancedConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret123',

  // Media with custom device constraints
  mediaConfiguration: {
    audio: {
      deviceId: 'specific-device-id',    // Use specific microphone
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,                 // High-quality audio sampling
      channelCount: 1                    // Mono audio
    },
    video: false
  },

  // User preferences with device IDs
  userPreferences: {
    audioInputDeviceId: 'specific-mic-id',
    audioOutputDeviceId: 'specific-speaker-id',
    enableDtmfTones: true
  }
}
```

## Common Use Cases

**What you'll learn:** Practical examples of common VoIP scenarios with detailed explanations of how and why each approach works.

This section covers the most common tasks you'll perform with VueSip, with real-world context and best practices.

### 1. Making Outgoing Calls

**Scenario:** User clicks a "Call" button to initiate a voice call to another party.

```typescript
const { makeCall, state, duration } = useCallSession(sipClient)

// Initiate an audio-only call
await makeCall('sip:2000@example.com', {
  audio: true,      // Enable audio stream
  video: false      // Disable video for audio-only call
})

// Monitor call state changes to update UI
watch(state, (newState) => {
  console.log('Call state changed:', newState)
  // States progression: 'idle' → 'calling' → 'ringing' → 'active' → 'terminated'

  // Update UI based on state
  if (newState === 'calling') {
    // Show "Calling..." indicator
  } else if (newState === 'ringing') {
    // Show "Ringing..." indicator
  } else if (newState === 'active') {
    // Show call controls and duration
  } else if (newState === 'terminated') {
    // Clear UI and show call summary
  }
})
```

💡 **Tip:** Always monitor the `state` reactive property to provide accurate feedback to users. Call setup can take several seconds, so visual feedback is important.

### 2. Handling Incoming Calls

**Scenario:** Another party calls your SIP number and you need to alert the user and provide answer/reject options.

```typescript
const { session, answer, reject } = useCallSession(sipClient)

// Watch for incoming calls
watch(session, (newSession) => {
  if (newSession && newSession.direction === 'incoming') {
    console.log('Incoming call from:', newSession.remoteUri)

    // Extract caller information for display
    const callerName = newSession.remoteDisplayName || 'Unknown'
    const callerNumber = newSession.remoteUri

    // Show incoming call UI with caller info
    // User can choose to answer or reject

    // Option 1: Answer the call
    await answer({
      audio: true,      // Enable microphone
      video: false      // Audio-only call
    })

    // Option 2: Reject the call
    // await reject(486)  // 486 = Busy Here
    // await reject(603)  // 603 = Decline
  }
})
```

📝 **Note:** The SIP response codes matter:
- `486` (Busy Here) - Indicates you're on another call
- `603` (Decline) - Indicates you're rejecting the call
- `480` (Temporarily Unavailable) - Indicates temporary unavailability

### 3. Sending DTMF Tones

**Scenario:** User needs to navigate an IVR (Interactive Voice Response) system or enter a PIN during a call.

```typescript
const { sendTone, sendToneSequence } = useDTMF(session)

// Send single DTMF tone (e.g., user presses '1' on dialpad)
await sendTone('1')

// Send a sequence of tones (e.g., extension number or PIN)
await sendToneSequence('1234#', {
  duration: 100,        // Each tone lasts 100ms (standard)
  interToneGap: 70,     // 70ms gap between tones (standard)
  onToneSent: (tone) => {
    console.log(`Sent: ${tone}`)
    // Provide visual feedback as each tone is sent
  }
})
```

💡 **Tip:** For PIN entry or extension dialing, use `sendToneSequence` to ensure proper timing between digits. IVR systems are sensitive to tone duration and gaps.

⚠️ **Important:** DTMF tones can only be sent during an active call. Check that `isActive` is true before attempting to send tones.

### 4. Managing Audio Devices

**Scenario:** User wants to select their preferred microphone or speaker, or test audio before making a call.

```typescript
const {
  audioInputDevices,        // Array of available microphones
  audioOutputDevices,       // Array of available speakers
  selectedAudioInputId,     // Currently selected microphone ID
  enumerateDevices,         // Function to refresh device list
  requestPermissions,       // Function to request browser permissions
  selectAudioInput,         // Function to change microphone
  testAudioInput            // Function to test microphone
} = useMediaDevices()

// Step 1: Request microphone permissions
// This must be done before enumerating devices to get device labels
await requestPermissions(true, false) // (audio, video)

// Step 2: Get list of available devices
await enumerateDevices()

// Step 3: Display devices to user for selection
console.log('Available microphones:', audioInputDevices.value)
console.log('Available speakers:', audioOutputDevices.value)

// Step 4: User selects a device
if (audioInputDevices.value.length > 0) {
  const selectedDevice = audioInputDevices.value[0]
  selectAudioInput(selectedDevice.deviceId)
}

// Step 5: Test the selected microphone
// This plays back recorded audio to verify the device works
const success = await testAudioInput()
if (success) {
  console.log('Microphone test passed')
} else {
  console.log('Microphone test failed - check device or permissions')
}
```

✅ **Best Practice:** Always request permissions and enumerate devices before showing a device selection UI. Without permissions, device labels will be empty strings.

📝 **Note:** Device enumeration should be refreshed when devices are plugged/unplugged. Listen to the `devicechange` event on `navigator.mediaDevices`.

### 5. Call Controls (Hold, Mute, Transfer)

**Scenario:** During an active call, user needs to control the call state (put on hold, mute microphone, etc.).

```typescript
const {
  isOnHold,         // true when call is on hold
  isMuted,          // true when microphone is muted
  hold,             // Put call on hold (sends SIP re-INVITE)
  unhold,           // Resume call from hold
  mute,             // Mute microphone (local only, no SIP signaling)
  unmute,           // Unmute microphone
  toggleHold,       // Toggle hold state
  toggleMute        // Toggle mute state
} = useCallSession(sipClient)

// Hold/Unhold: Sends SIP signaling to remote party
// Remote party typically hears music on hold
await hold()        // Put call on hold
await unhold()      // Resume call
await toggleHold()  // Toggle current hold state

// Mute/Unmute: Local only, no SIP signaling
// Remote party hears silence, but call remains active
mute()              // Stop sending microphone audio
unmute()            // Resume sending microphone audio
toggleMute()        // Toggle current mute state
```

💡 **Tip:** Use **mute** for temporary silencing (coughing, background noise) and **hold** when you need to step away from the call. Hold sends proper signaling so the other party knows they're on hold.

📝 **Note:** The key difference:
- **Mute**: Local only, instant, no network signaling, remote party hears silence
- **Hold**: Network signaling, remote party is informed and may hear music

### 6. Call Statistics and Duration

**Scenario:** Display call duration, quality metrics, or troubleshoot audio quality issues.

```typescript
const {
  duration,         // Current call duration in seconds (auto-updating)
  timing,           // Detailed timing information
  getStats          // Function to get WebRTC statistics
} = useCallSession(sipClient)

// Monitor call duration in real-time
// Duration updates every second while call is active
watch(duration, (seconds) => {
  console.log('Call duration:', seconds)
  // Format and display: "00:42"
  const formatted = formatDuration(seconds)
})

// Get detailed timing information
console.log('Call initiated:', timing.value.startTime)    // When call was initiated
console.log('Call answered:', timing.value.answerTime)    // When call was answered
console.log('Call ended:', timing.value.endTime)          // When call ended

// Get WebRTC statistics for quality monitoring
// Useful for troubleshooting audio quality issues
const stats = await getStats()
console.log('Audio bitrate:', stats.audio.bitrate)
console.log('Packet loss:', stats.audio.packetsLost)
console.log('Round trip time:', stats.audio.roundTripTime)
```

💡 **Tip:** Use `getStats()` to diagnose call quality issues. High packet loss or round-trip time indicates network problems.

### 7. Registration Management

**Scenario:** Manually control SIP registration for scenarios where auto-registration isn't appropriate.

```typescript
const {
  isRegistered,         // true when registered with SIP server
  isRegistering,        // true during registration attempt
  expires,              // Registration expiry timestamp
  secondsUntilExpiry,   // Countdown to registration expiry
  register,             // Manually register
  unregister,           // Manually unregister
  refresh               // Refresh registration early
} = useSipRegistration(sipClient, {
  expires: 600,         // Register for 10 minutes
  maxRetries: 3,        // Retry 3 times on failure
  autoRefresh: true     // Auto-refresh before expiry
})

// Manual registration (if autoRegister is false)
await register()

// Monitor registration status
watch(isRegistered, (registered) => {
  if (registered) {
    console.log('Successfully registered!')
    console.log('Registration expires in:', secondsUntilExpiry.value, 'seconds')
  } else {
    console.log('Not registered - calls cannot be made or received')
  }
})

// Unregister before disconnecting (good practice)
await unregister()

// Refresh registration early (e.g., before going into background)
await refresh()
```

✅ **Best Practice:** Always unregister before closing your application. This properly cleans up your presence on the SIP server.

## Best Practices

**What you'll learn:** Essential patterns and practices for building robust, production-ready VoIP applications.

### 1. Error Handling

✅ **Best Practice:** Always handle errors gracefully and provide user-friendly feedback.

**Why it matters:** Network operations, media devices, and SIP signaling can all fail for various reasons. Proper error handling prevents your app from breaking and helps users understand what went wrong.

```typescript
try {
  // Attempt to connect
  await connect()

  // Attempt to make call
  await makeCall('sip:2000@example.com')

} catch (error) {
  console.error('Operation failed:', error)

  // Categorize errors for better user feedback
  if (error.code === 'NETWORK_ERROR') {
    showNotification('Connection failed. Check your internet connection.')
  } else if (error.code === 'PERMISSION_DENIED') {
    showNotification('Microphone access denied. Please enable permissions.')
  } else if (error.code === 'REGISTRATION_FAILED') {
    showNotification('Could not connect to phone server. Check credentials.')
  } else {
    showNotification('An error occurred. Please try again.')
  }
}
```

💡 **Tip:** Log detailed error information to the console for debugging, but show simple, actionable messages to users.

### 2. Cleanup on Unmount

✅ **Best Practice:** Always clean up resources when components are destroyed to prevent memory leaks and ghost connections.

**Why it matters:** WebRTC connections and SIP registrations consume resources. Failing to clean up can cause memory leaks, ghost registrations, and orphaned media streams.

```typescript
import { onUnmounted } from 'vue'

const { disconnect, hangup } = useSipClient(config, {
  autoCleanup: true  // Automatically cleanup on component unmount
})

// Or manually handle cleanup
onUnmounted(async () => {
  // End any active calls
  if (isActive.value) {
    await hangup()
  }

  // Disconnect from SIP server
  await disconnect()

  // Stop any active media streams
  stopMediaStreams()
})
```

⚠️ **Important:** If you're using Vue Router, also consider cleaning up on route changes, not just component unmount.

### 3. Reactive State Management

✅ **Best Practice:** Leverage Vue's reactivity system to automatically update your UI when call state changes.

**Why it matters:** VoIP call state changes frequently (connecting, ringing, active, ended). Reactive properties ensure your UI always reflects the current state without manual updates.

```typescript
import { watch, computed } from 'vue'

// Watch for connection state changes
watch(isConnected, (connected) => {
  if (connected) {
    console.log('Connected to SIP server')
    showNotification('Ready to make calls')
    // Enable call controls in UI
  } else {
    console.log('Disconnected from SIP server')
    showNotification('Disconnected')
    // Disable call controls in UI
  }
})

// Use computed properties for derived state
const canMakeCall = computed(() => {
  return isConnected.value &&
         isRegistered.value &&
         !isActive.value &&
         targetNumber.value.length > 0
})

// Use in template
// <button :disabled="!canMakeCall" @click="makeCall">Call</button>
```

### 4. Type Safety

✅ **Best Practice:** Use TypeScript for better development experience, fewer bugs, and excellent IntelliSense.

**Why it matters:** Type safety catches configuration errors at compile time, provides better autocomplete, and makes refactoring safer.

```typescript
import type { SipClientConfig, CallSession, CallState } from 'vuesip'

// Type-safe configuration
const config: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret'
  // TypeScript will error if you misspell properties or use wrong types
}

// Type-safe call handling
const handleCallStateChange = (state: CallState) => {
  // TypeScript ensures state is one of the valid values
  switch (state) {
    case 'idle':
      break
    case 'calling':
      break
    case 'ringing':
      break
    case 'active':
      break
    case 'terminated':
      break
  }
}
```

### 5. Device Permissions

✅ **Best Practice:** Request media permissions early and handle denials gracefully with clear instructions.

**Why it matters:** Without microphone permissions, calls cannot work. Early permission requests prevent user frustration, and clear instructions help users fix permission issues.

```typescript
const { requestPermissions, hasAudioPermission } = useMediaDevices()

// Request permissions early (e.g., on app load or first user interaction)
try {
  await requestPermissions(true, false)  // Request audio, not video

  if (!hasAudioPermission.value) {
    // Show modal with instructions
    showPermissionInstructions({
      title: 'Microphone Access Required',
      message: 'Please enable microphone access in your browser settings to make calls.',
      instructions: getBrowserSpecificInstructions()  // Chrome, Firefox, Safari differ
    })
  }
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // User explicitly denied permission
    showError('Microphone access denied. Click the camera icon in your address bar to enable.')
  } else if (error.name === 'NotFoundError') {
    // No microphone found
    showError('No microphone detected. Please connect a microphone to make calls.')
  }
}
```

⚠️ **Important:** Browsers require HTTPS (or localhost) to access media devices. Permission requests will fail on insecure HTTP sites in production.

### 6. Connection Resilience

✅ **Best Practice:** Handle network disruptions gracefully with automatic reconnection and user feedback.

```typescript
const { connect, disconnect, isConnected, error } = useSipClient({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret',

  // Configure automatic reconnection
  wsOptions: {
    maxReconnectionAttempts: 5,   // Try 5 times before giving up
    reconnectionDelay: 2000        // Wait 2 seconds between attempts
  }
})

// Monitor connection state
watch(isConnected, (connected) => {
  if (connected) {
    hideReconnectingMessage()
  } else {
    showReconnectingMessage('Connection lost. Reconnecting...')
  }
})

// Monitor for connection errors
watch(error, (err) => {
  if (err) {
    console.error('Connection error:', err)

    // Show user-friendly message based on error type
    if (err.type === 'network') {
      showError('Network connection lost. Check your internet.')
    } else if (err.type === 'authentication') {
      showError('Authentication failed. Check your credentials.')
    }
  }
})
```

## Tips and Tricks

**What you'll learn:** Advanced patterns and techniques to enhance your VueSip application.

### Using Providers for Global State

💡 **Tip:** For larger applications with multiple components that need access to the SIP client, use providers to avoid prop drilling.

**Why it matters:** Providers allow you to share the SIP client state across your entire component tree without passing props through multiple levels.

```vue
<template>
  <!-- Wrap your app with providers for global state -->
  <SipClientProvider :config="sipConfig">
    <MediaProvider :auto-enumerate="true">
      <YourApp />
    </MediaProvider>
  </SipClientProvider>
</template>

<script setup lang="ts">
import { SipClientProvider, MediaProvider } from 'vuesip'

const sipConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret'
}
</script>
```

Then in any child component:

```vue
<script setup lang="ts">
import { useSipClient, useMediaDevices } from 'vuesip'

// These automatically connect to the providers
const { isConnected, makeCall } = useSipClient()
const { audioInputDevices } = useMediaDevices()
</script>
```

### Debugging and Troubleshooting

💡 **Tip:** Enable debug mode during development to see detailed logs of all SIP signaling and WebRTC events.

```typescript
// Method 1: In component configuration
const { connect } = useSipClient({
  ...config,
  debug: true  // Enables detailed console logging
})

// Method 2: Global plugin configuration
app.use(createVueSip({
  debug: import.meta.env.DEV,  // Auto-enable in development
  logLevel: 'debug'  // 'debug' | 'info' | 'warn' | 'error'
}))
```

**What you'll see in debug mode:**
- SIP messages (INVITE, ACK, BYE, etc.)
- WebRTC events (ICE candidates, SDP offers/answers)
- State transitions
- Error details

📝 **Note:** Disable debug mode in production to avoid exposing sensitive information and reduce log noise.

### Testing Without a SIP Server

💡 **Tip:** During UI development, you can mock the composables to test your interface without a real SIP server.

**Why it matters:** This lets you develop and test your UI quickly without needing SIP infrastructure or dealing with connectivity issues.

```typescript
// mock-sip.ts - Mock implementation for testing
export const useSipClient = () => ({
  isConnected: ref(true),
  isRegistered: ref(true),
  isConnecting: ref(false),
  error: ref(null),
  connect: async () => {
    console.log('Mock: Connected')
  },
  disconnect: async () => {
    console.log('Mock: Disconnected')
  }
})

export const useCallSession = () => ({
  state: ref('idle'),
  isActive: ref(false),
  duration: ref(0),
  makeCall: async (uri: string) => {
    console.log('Mock: Calling', uri)
    // Simulate call progression
    state.value = 'calling'
    setTimeout(() => state.value = 'ringing', 1000)
    setTimeout(() => state.value = 'active', 3000)
  },
  hangup: async () => {
    state.value = 'terminated'
  }
})
```

Use in your component:

```typescript
// Use real or mock based on environment
const useSip = import.meta.env.VITE_USE_MOCK_SIP
  ? () => import('./mock-sip')
  : () => import('vuesip')
```

### Performance Optimization

💡 **Tip:** For apps with many calling components, use provide/inject to share a single SIP client instance.

```typescript
// In parent component
import { provide } from 'vue'
import { useSipClient } from 'vuesip'

const sipClient = useSipClient(config)
provide('sipClient', sipClient)

// In child components
import { inject } from 'vue'

const sipClient = inject('sipClient')
const { makeCall } = useCallSession(sipClient)
```

## Next Steps

**Where to go from here:** Now that you understand the basics, dive deeper into specific topics.

You've learned the fundamentals of VueSip! Here are recommended next steps based on what you want to build:

**For Building a Basic Softphone:**
- **[Making Calls](./making-calls.md)** - Deep dive into outgoing call management, call options, and handling call failures
- **[Receiving Calls](./receiving-calls.md)** - Handle incoming calls, auto-answer, call screening, and ringtones

**For Advanced Features:**
- **[Media Devices](./media-devices.md)** - Device selection, testing, volume control, and device change handling
- **[Advanced Features](./advanced-features.md)** - Call conferencing, messaging, presence, and call recording

**For Production Deployment:**
- **[Configuration Guide](./configuration.md)** - Complete configuration reference and production best practices
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions

## Troubleshooting

**What you'll learn:** Solutions to common problems you might encounter when setting up VueSip.

### Connection Issues

**Problem:** Can't connect to SIP server - stuck on "Connecting..." or immediate failure

**Symptoms:**
- `isConnected` remains false
- Error message about WebSocket connection
- Console shows connection timeout or refused errors

**Solutions:**

1. **Verify WebSocket URI format**
   ```typescript
   // ✅ Correct - Use wss:// for secure connection
   uri: 'wss://sip.example.com:7443'

   // ❌ Wrong - Don't use http:// or https://
   uri: 'https://sip.example.com:7443'

   // ❌ Wrong - Don't forget the port
   uri: 'wss://sip.example.com'
   ```

2. **Check SIP server configuration**
   - Ensure your SIP server has WebSocket support enabled
   - Verify the port is correct (commonly 7443 for secure WebSocket)
   - Check that the server allows connections from your domain

3. **Verify credentials**
   ```typescript
   // Double-check username, domain, and password
   sipUri: 'sip:1000@example.com',  // Must match your SIP server
   password: 'your-actual-password'  // Case-sensitive
   ```

4. **Check CORS settings**
   - If your SIP server and web app are on different domains, ensure CORS is configured on the SIP server
   - Check browser console for CORS-related errors

5. **Enable debug mode to see detailed errors**
   ```typescript
   const { connect } = useSipClient({
     ...config,
     debug: true  // See exactly what's failing
   })
   ```

### No Audio in Calls

**Problem:** Call connects successfully but no audio is heard (one-way or both ways)

**Symptoms:**
- Call shows as "active" but silence
- Can see call duration counting but no audio
- One party can hear, the other cannot

**Solutions:**

1. **Request microphone permissions before calling**
   ```typescript
   // Request permissions BEFORE making call
   const { requestPermissions } = useMediaDevices()
   await requestPermissions(true, false)

   // Then make call
   await makeCall(targetUri)
   ```

2. **Check audio devices are selected**
   ```typescript
   const { audioInputDevices, audioOutputDevices, enumerateDevices } = useMediaDevices()

   await enumerateDevices()
   console.log('Input devices:', audioInputDevices.value)
   console.log('Output devices:', audioOutputDevices.value)
   ```

3. **Configure STUN/TURN servers**

   ⚠️ **Most Important:** This is the #1 cause of no-audio issues!

   ```typescript
   // Add STUN/TURN configuration
   const config = {
     uri: 'wss://sip.example.com:7443',
     sipUri: 'sip:1000@example.com',
     password: 'secret',

     // CRITICAL: STUN/TURN for NAT traversal
     rtcConfiguration: {
       stunServers: [
         'stun:stun.l.google.com:19302'
       ],
       turnServers: [
         {
           urls: 'turn:turn.example.com:3478',
           username: 'turnuser',
           credential: 'turnpass'
         }
       ]
     }
   }
   ```

4. **Test devices independently**
   ```typescript
   const { testAudioInput, testAudioOutput } = useMediaDevices()

   // Test microphone
   const micWorks = await testAudioInput()
   console.log('Microphone test:', micWorks ? 'PASS' : 'FAIL')

   // Test speakers
   const speakersWork = await testAudioOutput()
   console.log('Speaker test:', speakersWork ? 'PASS' : 'FAIL')
   ```

5. **Check browser console for WebRTC errors**
   - Look for ICE connection failures
   - Check for "iceConnectionState: failed"
   - Verify no "Permission denied" errors

### Registration Failures

**Problem:** Connection succeeds but registration fails - can't make or receive calls

**Symptoms:**
- `isConnected` is true
- `isRegistered` remains false
- Error about registration failure or authentication

**Solutions:**

1. **Verify SIP URI format**
   ```typescript
   // ✅ Correct format
   sipUri: 'sip:1000@example.com'

   // ❌ Wrong - missing sip: prefix
   sipUri: '1000@example.com'

   // ❌ Wrong - wrong domain
   sipUri: 'sip:1000@wrong-domain.com'
   ```

2. **Check authentication credentials**
   ```typescript
   {
     sipUri: 'sip:1000@example.com',
     password: 'correct-password',  // Case-sensitive!

     // If auth username differs from SIP username
     authorizationUsername: '1000',

     // If realm is required
     realm: 'example.com'
   }
   ```

3. **Verify registration expiry isn't too short**
   ```typescript
   registrationOptions: {
     expires: 600,  // 10 minutes (minimum usually 60 seconds)
   }
   ```

4. **Enable debug mode to see registration messages**
   ```typescript
   debug: true  // See exact SIP REGISTER messages and responses
   ```

5. **Check server logs**
   - Your SIP server logs will show why registration failed
   - Common reasons: wrong password, account disabled, IP restrictions

### Browser Permission Issues

**Problem:** Browser blocks microphone access or doesn't prompt for permission

**Solutions:**

1. **Use HTTPS in production**

   ⚠️ **Critical:** Browsers require HTTPS for media access (except localhost)

   ```
   ✅ https://yourapp.com - Will work
   ✅ http://localhost:3000 - Will work (development only)
   ❌ http://yourapp.com - Will NOT work
   ```

2. **Request permissions on user interaction**
   ```typescript
   // ✅ Good - Request on button click
   const handleStartCall = async () => {
     await requestPermissions(true, false)
     await makeCall(targetUri)
   }

   // ❌ Bad - Request immediately on page load
   // Some browsers block this
   ```

3. **Provide clear instructions if denied**
   ```typescript
   try {
     await requestPermissions(true, false)
   } catch (error) {
     if (error.name === 'NotAllowedError') {
       showModal({
         title: 'Microphone Access Needed',
         message: 'Click the camera icon in your address bar and allow microphone access.'
       })
     }
   }
   ```

## Getting Help

**Need more assistance?** Here's where to find help:

📚 **Documentation:**
- **[Full API Reference](https://vuesip.dev/api)** - Complete API documentation
- **[Composables Guide](https://vuesip.dev/composables)** - Detailed composable reference
- **[Configuration Reference](./configuration.md)** - All configuration options

🐛 **Bug Reports & Feature Requests:**
- **[GitHub Issues](https://github.com/yourusername/vuesip/issues)** - Report bugs or request features
- Include: VueSip version, Vue version, browser, and minimal reproduction

💬 **Community:**
- **[GitHub Discussions](https://github.com/yourusername/vuesip/discussions)** - Ask questions and share tips
- **[Discord Server](https://discord.gg/vuesip)** - Real-time community help

📖 **Examples:**
- **[Example Repository](https://github.com/yourusername/vuesip/tree/main/examples)** - Working example applications
- **[CodeSandbox Demos](https://codesandbox.io/s/vuesip-examples)** - Try online without installing

## Summary

**What you've accomplished:** You now have all the knowledge to build production-ready VoIP applications with VueSip!

### You've learned how to:

✅ **Install and configure VueSip** in your Vue 3 application
✅ **Connect to a SIP server** with proper authentication and registration
✅ **Make and receive calls** with full state management
✅ **Send DTMF tones** for IVR navigation
✅ **Manage audio devices** with selection and testing
✅ **Handle errors gracefully** with user-friendly feedback
✅ **Clean up resources properly** to prevent memory leaks
✅ **Configure STUN/TURN** for reliable connectivity through NAT
✅ **Debug issues effectively** using debug mode and browser tools

### Key Takeaways:

💡 **VueSip is headless** - You control the UI completely while VueSip handles all the complex VoIP logic

💡 **Reactivity is built-in** - Use Vue's watch and computed to automatically update your UI based on call state

💡 **TypeScript is your friend** - Full type safety helps catch errors early and improves development experience

💡 **STUN/TURN is essential** - Configure these servers for production to ensure calls work through firewalls and NAT

💡 **Error handling matters** - Always wrap async operations in try-catch and provide user-friendly feedback

### What's Next?

Now that you have a solid foundation, you can:

1. **Build your first softphone** - Create a complete calling interface
2. **Explore advanced features** - Add conferencing, call transfer, and recording
3. **Optimize for production** - Configure STUN/TURN, error handling, and monitoring
4. **Customize the experience** - Design your perfect calling UI with full flexibility

VueSip's headless architecture gives you complete flexibility to build any SIP interface you need. The composables handle all the complex SIP and WebRTC logic, so you can focus on creating an amazing user experience.

Happy coding! 🚀
