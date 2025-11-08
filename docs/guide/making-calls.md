# Making Calls Guide

Learn how to initiate and manage outgoing calls in VueSip. This guide covers everything from basic call setup to advanced error handling and call quality monitoring, helping you build robust voice and video calling features in your Vue application.

## Table of Contents

- [Quick Start](#quick-start)
- [Call Setup](#call-setup)
- [Call Options](#call-options)
- [Media Constraints](#media-constraints)
- [Call Events and Lifecycle](#call-events-and-lifecycle)
- [Error Handling](#error-handling)
- [Advanced Examples](#advanced-examples)
- [Best Practices](#best-practices)

## Quick Start

**Want to make a call in 5 lines of code?** Here's the simplest way to get started:

```typescript
import { useSipClient, useCallSession } from 'vuesip'

// Initialize the SIP client and call session
const { sipClient } = useSipClient()
const { makeCall, state, hangup } = useCallSession(sipClient)

// Make an audio call
await makeCall('sip:user@example.com')

// Later: end the call
await hangup()
```

💡 **Tip:** This creates an audio-only call by default. For video calls, see the [Call Options](#call-options) section below.

---

## Call Setup

### Understanding Call Setup

Before making calls, you need two things: a connected SIP client and a call session manager. Think of the SIP client as your phone line connection, and the call session manager as the phone itself that handles dialing and call controls.

### Basic Outgoing Call

Here's a complete example showing how to set up and make your first call:

```typescript
import { ref } from 'vue'
import { useSipClient, useCallSession } from 'vuesip'

// Step 1: Initialize and connect to the SIP server
const { sipClient, isConnected } = useSipClient({
  uri: 'wss://sip.example.com:7443',      // WebSocket server address
  sipUri: 'sip:alice@example.com',        // Your SIP identity
  password: 'your-password'                // Your SIP password
})

// Step 2: Initialize the call session manager
const {
  makeCall,       // Function to initiate calls
  hangup,         // Function to end calls
  state,          // Current call state (idle, calling, active, etc.)
  remoteUri,      // Who you're calling/talking to
  duration,       // Call duration in seconds (updates every second)
  localStream,    // Your audio/video stream (for display)
  remoteStream    // Remote party's audio/video stream (for playback)
} = useCallSession(sipClient)

// Step 3: Make a call (with proper validation)
const handleCall = async () => {
  // ✅ Always check connection status first
  if (!isConnected.value) {
    console.error('Not connected to SIP server')
    return
  }

  try {
    // Initiate the call
    await makeCall('sip:bob@example.com')
    console.log('Call initiated successfully')
  } catch (error) {
    // Handle any errors (network, permissions, invalid URI, etc.)
    console.error('Call failed:', error)
  }
}
```

📝 **Note:** The `makeCall` function is asynchronous and returns a Promise. Always use `await` or `.then()/.catch()` to handle it properly.

### Target URI Formats

VueSip is flexible and accepts multiple target URI formats, making it easy to integrate with different systems:

```typescript
// Full SIP URI (most explicit)
await makeCall('sip:user@domain.com')

// SIP URI with custom port
await makeCall('sip:user@domain.com:5060')

// SIP URI with display name (name shown in UI but not used in routing)
await makeCall('"Bob Smith" <sip:bob@domain.com>')

// Extension/short number (automatically formatted based on your config)
await makeCall('1000')  // Becomes sip:1000@your-domain.com
```

⚠️ **Important:** The target URI is validated before initiating the call. Invalid URIs will throw an error immediately, so you can catch and handle them before any network activity occurs.

💡 **Tip:** Use the `validateSipUri()` utility function (covered in [Error Handling](#error-handling)) to pre-validate URIs and provide better user feedback.

---

## Call Options

### Overview

The `makeCall` method is highly customizable. You can control media types (audio/video), attach custom metadata, and configure cleanup behavior. This flexibility lets you build everything from simple voice calls to complex video conferencing features.

### Available Options

```typescript
interface CallSessionOptions {
  /** Enable audio stream (default: true) */
  audio?: boolean | MediaTrackConstraints

  /** Enable video stream (default: false) */
  video?: boolean | MediaTrackConstraints

  /** Custom call metadata - attach any data you need */
  data?: Record<string, unknown>

  /** Auto-cleanup streams on hangup (default: true) */
  autoCleanup?: boolean
}
```

### Audio-Only Call (Default)

Audio-only calls are the default and most common use case:

```typescript
// Explicit audio-only configuration
await makeCall('sip:user@domain.com', {
  audio: true,   // Enable microphone
  video: false   // Disable camera
})

// Or simply use the default (same result)
await makeCall('sip:user@domain.com')
```

### Video Call

Enable video for face-to-face conversations:

```typescript
// Enable both audio and video
await makeCall('sip:user@domain.com', {
  audio: true,   // Enable microphone
  video: true    // Enable camera
})
```

⚠️ **Permission Required:** Video calls require both microphone and camera permissions from the user. Make sure to handle permission denials gracefully (see [Error Handling](#error-handling)).

### Attach Custom Data

Store metadata with your call for tracking, analytics, or business logic:

```typescript
// Add custom metadata to the call
await makeCall('sip:user@domain.com', {
  data: {
    callType: 'support',      // Categorize the call
    ticketId: '12345',        // Link to support ticket
    priority: 'high',         // Business priority
    customerId: 'ABC-789'     // Customer reference
  }
})

// Access the metadata later (during or after the call)
console.log(session.value?.data)
// Output: { callType: 'support', ticketId: '12345', ... }
```

💡 **Use Cases:** Custom data is perfect for call routing, analytics, CRM integration, or passing context between components.

---

## Media Constraints

### Understanding Media Constraints

Media constraints give you fine-grained control over audio and video quality, device selection, and processing features. Instead of just `true/false`, you can pass detailed configuration objects that specify exactly how you want the media to behave.

### Audio Constraints

Optimize audio quality with processing features:

```typescript
await makeCall('sip:user@domain.com', {
  audio: {
    echoCancellation: true,    // Remove echo feedback (✅ recommended)
    noiseSuppression: true,    // Filter background noise (✅ recommended)
    autoGainControl: true,     // Normalize volume levels (✅ recommended)
    sampleRate: 48000          // Higher quality audio (48kHz)
  },
  video: false
})
```

✅ **Best Practice:** Enable echo cancellation, noise suppression, and auto-gain control for professional call quality, especially in noisy environments.

### Video Constraints

Control video resolution and quality:

```typescript
await makeCall('sip:user@domain.com', {
  audio: true,
  video: {
    width: { ideal: 1280 },     // Prefer 1280px width (HD)
    height: { ideal: 720 },     // Prefer 720px height (HD)
    frameRate: { ideal: 30 },   // Smooth 30 fps video
    facingMode: 'user'          // Front camera ('environment' for rear)
  }
})
```

📝 **Note:** Using `ideal` constraints allows the browser to fall back to lower quality if the ideal isn't available. Use `exact` only when you must have specific settings.

💡 **Mobile Tip:** Use `facingMode: 'environment'` to use the rear camera on mobile devices, useful for showing things to the remote party.

### Specific Device Selection

Let users choose which microphone or camera to use:

```typescript
import { useMediaDevices } from 'vuesip'

// Get available devices
const { audioInputDevices, videoDevices } = useMediaDevices()

// Use a specific microphone and camera
await makeCall('sip:user@domain.com', {
  audio: {
    // Use the first available microphone
    deviceId: { exact: audioInputDevices.value[0].deviceId }
  },
  video: {
    // Use the first available camera
    deviceId: { exact: videoDevices.value[0].deviceId }
  }
})
```

💡 **UX Tip:** Build a device selection UI that lets users test and choose their preferred devices before making calls.

### Screen Sharing

Share your screen during calls (perfect for demos, support, or collaboration):

```typescript
import { useMediaManager } from 'vuesip'

const { mediaManager } = useMediaManager()

try {
  // Step 1: Request screen sharing permission from the user
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,   // Capture the screen
    audio: false   // Don't capture system audio (optional)
  })

  // Step 2: Set the screen stream as your local stream
  mediaManager.value?.setLocalStream(screenStream)

  // Step 3: Make the call (it will use the screen stream)
  await makeCall('sip:user@domain.com', {
    video: true  // Send the screen as video
  })
} catch (error) {
  console.error('Screen sharing failed:', error)
}
```

⚠️ **User Control:** Screen sharing shows a browser dialog where users select which screen/window/tab to share. They can also stop sharing at any time using browser controls.

💡 **Advanced Use Case:** You can switch between camera and screen sharing during a call by updating the local stream with `mediaManager.replaceLocalStream()`.

---

## Call Events and Lifecycle

### Understanding the Call Lifecycle

Every call goes through a series of states from initiation to termination. Understanding these states helps you build responsive UIs, handle edge cases, and provide better user feedback.

### Call States

Here's what each state means and when it occurs:

```typescript
type CallState =
  | 'idle'          // No active call - ready to make/receive calls
  | 'calling'       // Outgoing call initiated - waiting for response
  | 'ringing'       // Incoming call (not applicable for outgoing)
  | 'answering'     // Call being answered (not applicable for outgoing)
  | 'early_media'   // Early media playing (e.g., ringback tone or announcements)
  | 'active'        // Call connected - conversation in progress
  | 'held'          // Call on hold by you (local hold)
  | 'remote_held'   // Call on hold by remote party
  | 'terminating'   // Call ending - cleanup in progress
  | 'terminated'    // Call ended normally
  | 'failed'        // Call failed due to error
```

📝 **Note:** "Early media" is audio/video that plays before the call is fully answered, like ringback tones, busy signals, or "your call is important to us" messages.

### Monitoring Call State

Track state changes to update your UI and respond to call events:

```typescript
import { watch } from 'vue'

const { state, makeCall } = useCallSession(sipClient)

// Watch for state changes
watch(state, (newState, oldState) => {
  console.log(`Call state changed: ${oldState} → ${newState}`)

  // React to different states
  switch (newState) {
    case 'calling':
      console.log('Call is being placed...')
      // UI: Show "Calling..." with cancel button
      break

    case 'early_media':
      console.log('Ringback tone playing')
      // UI: Show "Ringing..." (remote phone is ringing)
      break

    case 'active':
      console.log('Call connected!')
      // UI: Show call controls (mute, hold, hangup)
      break

    case 'terminated':
      console.log('Call ended normally')
      // UI: Reset to idle state, show call duration summary
      break

    case 'failed':
      console.log('Call failed')
      // UI: Show error message, offer retry option
      break
  }
})
```

💡 **UX Tip:** Provide clear visual feedback for each state. Users should always know what's happening with their call.

### Call Lifecycle Hooks

Track detailed timing information for analytics or billing:

```typescript
const {
  makeCall,
  state,
  timing,           // Detailed timing information
  duration,         // Current duration in seconds (updates every second)
  terminationCause  // Why the call ended
} = useCallSession(sipClient)

// Monitor timing information
watch(timing, (timingInfo) => {
  console.log('Call started at:', timingInfo.startTime)    // When makeCall() was called
  console.log('Call answered at:', timingInfo.answerTime)  // When remote party answered
  console.log('Call ended at:', timingInfo.endTime)        // When call terminated
  console.log('Total duration:', timingInfo.duration, 'seconds')
})

// Show live duration to user (updates every second during active call)
watch(duration, (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  console.log(`Call duration: ${minutes}:${secs.toString().padStart(2, '0')}`)
  // UI: Display as "05:42" format
})

// Check why the call ended
watch(state, (newState) => {
  if (newState === 'terminated' || newState === 'failed') {
    console.log('Termination cause:', terminationCause.value)
    // Possible values:
    // 'canceled'        - You canceled before answer
    // 'rejected'        - Remote party declined
    // 'no_answer'       - No one answered
    // 'unavailable'     - Remote party unavailable
    // 'busy'            - Remote party busy
    // 'bye'             - Normal hangup
    // 'request_timeout' - Network timeout
    // 'webrtc_error'    - Media/connection error
    // 'internal_error'  - SIP stack error
    // 'network_error'   - Network disconnected
    // 'other'           - Unknown reason
  }
})
```

💡 **Analytics Use Case:** Use timing and termination data for call quality metrics, billing, or identifying connectivity issues.

### Media Stream Events

Access and display audio/video streams as they become available:

```typescript
const {
  localStream,      // Your microphone/camera stream
  remoteStream,     // Remote party's audio/video stream
  hasLocalVideo,    // Whether your local stream has video
  hasRemoteVideo    // Whether remote stream has video
} = useCallSession(sipClient)

// Handle your local stream (microphone/camera)
watch(localStream, (stream) => {
  if (stream) {
    console.log('Local media available:', stream.getTracks())

    // Attach to video element to show your camera
    const localVideo = document.getElementById('local-video') as HTMLVideoElement
    if (localVideo) {
      localVideo.srcObject = stream   // Display your video
      localVideo.muted = true          // ✅ Always mute local video to prevent feedback
    }
  }
})

// Handle remote party's stream (their audio/video)
watch(remoteStream, (stream) => {
  if (stream) {
    console.log('Remote media available:', stream.getTracks())

    // Attach to video element to show/play remote audio/video
    const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement
    if (remoteVideo) {
      remoteVideo.srcObject = stream  // Display/play their audio/video
      // Don't mute remote video - you want to hear them!
    }
  }
})

// Track video availability (useful for showing/hiding video elements)
watch([hasLocalVideo, hasRemoteVideo], ([local, remote]) => {
  console.log(`Video status - Your camera: ${local}, Their camera: ${remote}`)
  // UI: Show video elements only when video is available
})
```

⚠️ **Critical:** Always set `muted = true` on the local video element to prevent audio feedback loops.

---

## Error Handling

### Why Error Handling Matters

Calls can fail for many reasons: network issues, permission denials, invalid URIs, busy users, and more. Proper error handling ensures your users understand what went wrong and what they can do about it.

### Common Error Scenarios

#### 1. SIP Client Not Initialized

This happens when you try to make a call before connecting to the SIP server:

```typescript
try {
  await makeCall('sip:user@domain.com')
} catch (error) {
  if (error.message === 'SIP client not initialized') {
    console.error('Connect to SIP server first')

    // Solution: Connect to the server
    await connect()

    // UI: Show "Connecting..." message
  }
}
```

✅ **Prevention:** Always check `isConnected.value` before allowing calls.

#### 2. Invalid Target URI

This catches malformed or invalid SIP addresses:

```typescript
try {
  await makeCall('invalid-uri')  // Missing 'sip:' prefix
} catch (error) {
  if (error.message.includes('Invalid target URI')) {
    console.error('Please enter a valid SIP URI')

    // UI: Show validation error near input field
    // Example: "Please enter a valid format: sip:user@domain.com"
  }
}
```

✅ **Prevention:** Validate URIs before calling using `validateSipUri()`.

#### 3. Empty Target URI

This catches when users click "Call" without entering a number:

```typescript
try {
  await makeCall('')  // Empty string
} catch (error) {
  if (error.message === 'Target URI cannot be empty') {
    console.error('Please enter a phone number or URI')

    // UI: Focus the input field and show error
  }
}
```

#### 4. Call Operation In Progress

This prevents starting a new call while another operation is happening:

```typescript
try {
  await makeCall('sip:user@domain.com')
} catch (error) {
  if (error.message === 'Call operation already in progress') {
    console.error('Please wait for the current operation to complete')

    // UI: Disable call button temporarily
  }
}
```

📝 **Note:** This protects against race conditions and ensures operations complete properly.

#### 5. Media Acquisition Failed

This handles camera/microphone permission and availability issues:

```typescript
try {
  await makeCall('sip:user@domain.com', { video: true })
} catch (error) {
  if (error.name === 'NotAllowedError') {
    console.error('Camera/microphone access denied')

    // UI: Show instructions on how to grant permissions
    // "Please allow camera/microphone access in your browser settings"
  }
  else if (error.name === 'NotFoundError') {
    console.error('No camera/microphone found')

    // Solution: Fall back to audio-only
    await makeCall('sip:user@domain.com', { audio: true, video: false })
  }
  else if (error.name === 'NotReadableError') {
    console.error('Camera/microphone is in use by another application')

    // UI: "Please close other apps using your camera/microphone"
  }
}
```

⚠️ **Common Cause:** NotReadableError often occurs when another browser tab or application is already using the device.

### Comprehensive Error Handler

Create a reusable error handler for consistent error management:

```typescript
const handleCallError = (error: Error) => {
  console.error('Call error:', error)

  // Map errors to user-friendly messages
  if (error.message.includes('SIP client not initialized')) {
    showNotification('Please connect to SIP server first', 'error')
  }
  else if (error.message.includes('Invalid target URI')) {
    showNotification('Invalid phone number or SIP address', 'error')
  }
  else if (error.message.includes('Target URI cannot be empty')) {
    showNotification('Please enter a phone number', 'error')
  }
  else if (error.message.includes('Call operation already in progress')) {
    showNotification('Please wait for current operation to complete', 'warning')
  }
  else if (error.name === 'NotAllowedError') {
    showNotification('Please grant camera/microphone permissions', 'error')
  }
  else if (error.name === 'NotFoundError') {
    showNotification('No camera/microphone found', 'error')
  }
  else if (error.name === 'NotReadableError') {
    showNotification('Camera/microphone is already in use', 'error')
  }
  else {
    // Fallback for unexpected errors
    showNotification('Failed to make call. Please try again.', 'error')
  }
}

// Usage: Wrap all makeCall() calls with this handler
try {
  await makeCall(targetUri.value, callOptions.value)
} catch (error) {
  handleCallError(error)
}
```

💡 **Best Practice:** Log technical details to console for debugging, but show friendly messages to users.

### Validation Before Calling

Catch errors early with pre-call validation:

```typescript
import { validateSipUri } from 'vuesip'

const makeCallWithValidation = async (target: string) => {
  // Validate the URI before attempting to call
  const validation = validateSipUri(target)

  if (!validation.isValid) {
    // Show validation errors immediately (no network call made)
    console.error('Validation failed:', validation.error)
    console.error('Details:', validation.errors)

    // UI: Show specific error to user
    return
  }

  // URI is valid, proceed with the call
  try {
    await makeCall(target)
  } catch (error) {
    // Handle runtime errors (network, permissions, etc.)
    handleCallError(error)
  }
}
```

✅ **Benefit:** Pre-validation provides instant feedback without network delays.

### Network Error Recovery

Automatically handle network disconnections:

```typescript
import { watch } from 'vue'

const { makeCall, state, terminationCause } = useCallSession(sipClient)

// Monitor for network errors
watch(state, (newState) => {
  if (newState === 'failed' && terminationCause.value === 'network_error') {
    console.error('Network error detected')

    // Attempt automatic reconnection after 5 seconds
    setTimeout(async () => {
      console.log('Attempting to reconnect...')
      try {
        await connect()  // Reconnect to SIP server

        // Optionally: Retry the call automatically
        // await makeCall(lastTarget)

        // UI: Show "Reconnected" notification
      } catch (error) {
        console.error('Reconnection failed:', error)
        // UI: Show "Offline" state
      }
    }, 5000)
  }
})
```

💡 **UX Tip:** Always notify users when reconnecting, and give them the option to retry the call manually.

---

## Advanced Examples

### Complete Call Manager Component

Here's a production-ready component showing best practices:

```vue
<template>
  <div class="call-manager">
    <!-- Idle state: Show dial pad -->
    <div v-if="state === 'idle'" class="dial-section">
      <input
        v-model="targetUri"
        placeholder="Enter SIP URI or number"
        @keyup.enter="handleMakeCall"
      />
      <button
        @click="handleMakeCall"
        :disabled="!isConnected || isProcessing"
      >
        {{ isProcessing ? 'Calling...' : 'Call' }}
      </button>
    </div>

    <!-- Calling state: Show progress and cancel option -->
    <div v-else-if="state === 'calling'" class="calling">
      <p>Calling {{ remoteUri }}...</p>
      <button @click="handleHangup">Cancel</button>
    </div>

    <!-- Active call: Show controls and media -->
    <div v-else-if="state === 'active'" class="active-call">
      <p>Connected to {{ remoteUri }}</p>
      <p>Duration: {{ formatDuration(duration) }}</p>

      <!-- Call controls -->
      <div class="call-controls">
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

      <!-- Video display -->
      <div class="media-section">
        <video ref="localVideo" autoplay muted playsinline />
        <video ref="remoteVideo" autoplay playsinline />
      </div>
    </div>

    <!-- Error display -->
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSipClient, useCallSession, validateSipUri } from 'vuesip'

const targetUri = ref('')
const error = ref('')
const isProcessing = ref(false)

// Initialize SIP client
const { sipClient, isConnected } = useSipClient()

// Initialize call session
const {
  makeCall,
  hangup,
  toggleMute,
  toggleHold,
  state,
  remoteUri,
  duration,
  isMuted,
  isOnHold,
  localStream,
  remoteStream,
  terminationCause
} = useCallSession(sipClient)

const localVideo = ref<HTMLVideoElement>()
const remoteVideo = ref<HTMLVideoElement>()

// Format duration as MM:SS
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Make call with comprehensive validation
const handleMakeCall = async () => {
  error.value = ''

  // Check if input is empty
  if (!targetUri.value.trim()) {
    error.value = 'Please enter a phone number or SIP URI'
    return
  }

  // Validate URI format
  const validation = validateSipUri(targetUri.value)
  if (!validation.isValid) {
    error.value = validation.error || 'Invalid SIP URI'
    return
  }

  isProcessing.value = true

  try {
    // Initiate the call
    await makeCall(targetUri.value, {
      audio: true,
      video: false
    })
  } catch (err: any) {
    // Show user-friendly error
    error.value = err.message || 'Failed to make call'
    console.error('Call error:', err)
  } finally {
    isProcessing.value = false
  }
}

// Hang up call safely
const handleHangup = async () => {
  isProcessing.value = true
  try {
    await hangup()
  } catch (err: any) {
    error.value = err.message || 'Failed to hang up'
  } finally {
    isProcessing.value = false
  }
}

// Attach local stream to video element when available
watch(localStream, (stream) => {
  if (stream && localVideo.value) {
    localVideo.value.srcObject = stream
  }
})

// Attach remote stream to video element when available
watch(remoteStream, (stream) => {
  if (stream && remoteVideo.value) {
    remoteVideo.value.srcObject = stream
  }
})

// Handle call termination (reset UI)
watch(state, (newState) => {
  if (newState === 'terminated' || newState === 'failed') {
    // Clear input field for next call
    targetUri.value = ''

    // Log termination reason for debugging
    if (terminationCause.value) {
      console.log('Call ended:', terminationCause.value)
    }
  }
})
</script>

<style scoped>
.call-manager {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.dial-section {
  display: flex;
  gap: 10px;
}

.dial-section input {
  flex: 1;
  padding: 10px;
  font-size: 16px;
}

button {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.danger {
  background: #ef4444;
  color: white;
}

.call-controls {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.media-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

video {
  width: 100%;
  background: #000;
  border-radius: 8px;
}

.error {
  color: #ef4444;
  margin-top: 10px;
  padding: 10px;
  background: #fee;
  border-radius: 4px;
}
</style>
```

💡 **Key Features:** This component shows proper state management, error handling, media attachment, and user feedback.

### Auto-Retry on Failure

Automatically retry failed calls (useful for temporary network issues):

```typescript
const { makeCall, state, terminationCause } = useCallSession(sipClient)

/**
 * Make a call with automatic retry logic
 * @param target - The SIP URI to call
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 */
const makeCallWithRetry = async (
  target: string,
  maxRetries = 3,
  retryDelay = 2000
) => {
  let attempts = 0

  while (attempts < maxRetries) {
    try {
      attempts++
      console.log(`Call attempt ${attempts}/${maxRetries}`)

      // Attempt to make the call
      await makeCall(target)

      // Wait for call to resolve (success or failure)
      await new Promise<void>((resolve) => {
        const unwatch = watch(state, (newState) => {
          if (newState === 'active') {
            // Call connected successfully
            unwatch()
            resolve()
          } else if (newState === 'failed' || newState === 'terminated') {
            // Call failed or was rejected
            unwatch()
            resolve()
          }
        })
      })

      // Check if call is active (success)
      if (state.value === 'active') {
        console.log('Call connected successfully')
        return true
      }

      // If we have retries left, wait and try again
      if (attempts < maxRetries) {
        console.log(`Call failed, retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }

    } catch (error) {
      console.error(`Attempt ${attempts} failed:`, error)

      // Don't retry validation errors (they won't succeed)
      if (error.message.includes('Invalid target URI')) {
        throw error
      }

      // If we've exhausted retries, give up
      if (attempts >= maxRetries) {
        throw new Error(`Failed to connect after ${maxRetries} attempts`)
      }

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  return false
}

// Usage example
try {
  const success = await makeCallWithRetry('sip:user@domain.com', 3, 2000)
  if (!success) {
    console.error('All retry attempts failed')
    // UI: Show "Unable to connect. Please try again later."
  }
} catch (error) {
  console.error('Call failed:', error)
}
```

⚠️ **Use Carefully:** Auto-retry is great for network glitches but shouldn't retry user-initiated cancellations or invalid inputs.

💡 **UX Tip:** Show users that you're retrying: "Connecting... (attempt 2 of 3)"

### Call with Timeout

Prevent calls from ringing forever:

```typescript
/**
 * Make a call with a timeout
 * If the call isn't answered within the timeout, it's automatically canceled
 * @param target - The SIP URI to call
 * @param timeoutMs - Timeout in milliseconds (default: 30 seconds)
 */
const makeCallWithTimeout = async (
  target: string,
  timeoutMs = 30000  // 30 seconds
) => {
  // Create a timeout promise that rejects after timeoutMs
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Call timeout - no answer'))
    }, timeoutMs)
  })

  // Create a call promise that resolves when answered or fails
  const callPromise = new Promise<void>(async (resolve, reject) => {
    try {
      // Initiate the call
      await makeCall(target)

      // Wait for call to be answered or fail
      const unwatch = watch(state, (newState) => {
        if (newState === 'active') {
          // Call was answered
          unwatch()
          resolve()
        } else if (newState === 'failed') {
          // Call failed
          unwatch()
          reject(new Error('Call failed'))
        }
      })
    } catch (error) {
      reject(error)
    }
  })

  try {
    // Race between call answering and timeout
    await Promise.race([callPromise, timeoutPromise])
    console.log('Call answered within timeout')
  } catch (error) {
    // If timeout or failure, hang up
    await hangup()
    throw error
  }
}

// Usage example
try {
  await makeCallWithTimeout('sip:user@domain.com', 30000)
  console.log('Call connected!')
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('No answer - call canceled')
    // UI: Show "No answer. Please try again."
  } else {
    console.error('Call failed:', error)
  }
}
```

💡 **Use Case:** Timeouts prevent UI from being stuck in "calling" state indefinitely.

---

## Best Practices

### 1. Always Check Connection State

**Why:** Calling without a connection will fail immediately. Check first to provide better feedback:

```typescript
const handleCall = async () => {
  // ✅ Check connection before attempting call
  if (!isConnected.value) {
    console.error('Not connected to SIP server')
    // UI: Show "Connecting..." or "Connect to make calls"
    return
  }

  await makeCall(targetUri.value)
}
```

### 2. Validate URIs Before Calling

**Why:** Pre-validation catches errors instantly without network calls:

```typescript
import { validateSipUri } from 'vuesip'

// ✅ Validate first
const validation = validateSipUri(targetUri.value)
if (!validation.isValid) {
  showError(validation.error)  // Instant feedback
  return
}

// Now make the call
await makeCall(targetUri.value)
```

### 3. Handle Errors Gracefully

**Why:** Users need to know what went wrong and what to do next:

```typescript
try {
  await makeCall(targetUri.value)
} catch (error) {
  // ✅ Show user-friendly error messages
  showNotification(getUserFriendlyError(error), 'error')

  // ✅ Log technical details for debugging
  console.error('Call error:', error)
}
```

### 4. Clean Up Media Streams

**Why:** Media streams use system resources. VueSip handles this automatically:

```typescript
import { onUnmounted } from 'vue'

onUnmounted(() => {
  // ✅ No manual cleanup needed!
  // VueSip's composable automatically stops all streams
  // and releases microphone/camera when component unmounts
})
```

📝 **Note:** If you need custom cleanup behavior, set `autoCleanup: false` in call options.

### 5. Request Permissions Early

**Why:** Requesting permissions during call setup causes delays. Do it early:

```typescript
import { useMediaDevices } from 'vuesip'

const { requestPermissions, permissions } = useMediaDevices()

// ✅ Request permissions when component mounts or app starts
onMounted(async () => {
  try {
    await requestPermissions({ audio: true, video: false })
    // Permissions granted - calls will be instant
  } catch (error) {
    console.error('Permission denied:', error)
    // UI: Show why permissions are needed
  }
})

// Check permissions before calling
const handleCall = async () => {
  if (permissions.value.audio !== 'granted') {
    console.error('Microphone access required')
    // UI: Show permission request dialog
    return
  }

  await makeCall(targetUri.value)
}
```

💡 **UX Tip:** Explain why permissions are needed before requesting them: "We need microphone access to make calls."

### 6. Monitor Call Quality

**Why:** Detect and alert users about connection problems:

```typescript
const { getStats } = useCallSession(sipClient)

// ✅ Monitor call quality periodically
const monitorCallQuality = async () => {
  const stats = await getStats()

  if (stats?.audio) {
    console.log('Packets lost:', stats.audio.packetsLost)
    console.log('Jitter:', stats.audio.jitter)
    console.log('Round-trip time:', stats.audio.roundTripTime)

    // Alert on poor quality
    if (stats.audio.packetsLost > 50) {
      console.warn('High packet loss detected')
      // UI: Show "Poor connection quality" warning
    }
  }
}

// Check quality every 5 seconds during active call
const stopMonitoring = setInterval(() => {
  if (state.value === 'active') {
    monitorCallQuality()
  }
}, 5000)

// Clean up interval on component unmount
onUnmounted(() => {
  clearInterval(stopMonitoring)
})
```

📝 **Metrics Guide:**
- **Packet Loss** >5%: Noticeable quality degradation
- **Jitter** >30ms: Audio choppiness
- **RTT** >300ms: Noticeable delay

### 7. Provide User Feedback

**Why:** Users should always know what's happening:

```typescript
// ✅ Computed states for UI feedback
const isDialing = computed(() => state.value === 'calling')
const isConnecting = computed(() =>
  state.value === 'calling' || state.value === 'early_media'
)

// ✅ User-friendly status messages
const statusMessage = computed(() => {
  switch (state.value) {
    case 'calling':
      return 'Dialing...'
    case 'early_media':
      return 'Ringing...'
    case 'active':
      return 'Connected'
    case 'failed':
      return 'Call failed'
    default:
      return ''
  }
})
```

### 8. Handle Concurrent Calls

**Why:** Prevent starting a new call while one is active:

```typescript
// ✅ Check if call is already active
if (state.value !== 'idle') {
  console.error('Another call is active')
  // UI: Show "End current call first"
  return
}

await makeCall(targetUri.value)
```

💡 **Advanced:** For multi-call support, use multiple `useCallSession` instances.

### 9. Use Try-Catch for Async Operations

**Why:** All async operations can fail. Always handle errors:

```typescript
// ✅ Always wrap async calls in try-catch
const handleMakeCall = async () => {
  try {
    await makeCall(targetUri.value)
  } catch (error) {
    handleCallError(error)
  }
}

const handleHangup = async () => {
  try {
    await hangup()
  } catch (error) {
    console.error('Hangup error:', error)
  }
}
```

### 10. Log Important Events

**Why:** Logging helps debug issues and understand user behavior:

```typescript
// ✅ Log state transitions
watch(state, (newState, oldState) => {
  console.log(`[Call] ${oldState} → ${newState}`)
})

// ✅ Log timing metrics
watch(timing, (timingInfo) => {
  if (timingInfo.answerTime) {
    const ringDuration = timingInfo.answerTime.getTime() -
                        timingInfo.startTime.getTime()
    console.log(`[Call] Answered after ${ringDuration}ms`)
  }
})
```

---

## See Also

- [Receiving Calls Guide](./receiving-calls.md) - Learn how to handle incoming calls
- [Call Controls Guide](./call-controls.md) - Master hold, mute, transfer, DTMF, and more
- [Media Management Guide](./media-management.md) - Advanced audio/video configuration
- [API Reference](../api/use-call-session.md) - Complete API documentation

---

💡 **Next Steps:** Now that you know how to make calls, learn about [receiving incoming calls](./receiving-calls.md) and [managing call controls](./call-controls.md) to build a complete calling experience.
