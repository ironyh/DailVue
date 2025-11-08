# Receiving Calls Guide

This comprehensive guide covers everything you need to handle incoming calls in VueSip, from basic call detection to advanced queue management. You'll learn how to detect incoming calls, configure automatic answering, provide user-friendly feedback, and manage multiple simultaneous calls.

## Table of Contents

- [Detecting Incoming Calls](#detecting-incoming-calls)
- [Auto-Answer Configuration](#auto-answer-configuration)
- [Answering Calls](#answering-calls)
- [Rejecting Calls](#rejecting-calls)
- [Call Queuing](#call-queuing)
- [Best Practices](#best-practices)
- [Complete Examples](#complete-examples)

---

## Detecting Incoming Calls

**What you'll learn:** How VueSip automatically detects incoming calls and the different ways you can respond to them.

**Why it matters:** Proper call detection ensures your application never misses an incoming call and can respond appropriately whether you need simple notifications or complex call routing.

### Understanding Call Detection

When someone calls your SIP endpoint, VueSip's underlying SIP client (JsSIP) receives the INVITE request and emits a `sip:new_session` event. VueSip intercepts this event and makes it available through multiple convenient APIs, giving you flexibility in how you handle incoming calls.

### Method 1: Using Event Listeners

💡 **Tip:** Use this method when you need low-level control or want to handle calls before they enter the call store.

```typescript
import { useSipClient } from 'vuesip'
import { ref, watch } from 'vue'

const { sipClient, eventBus } = useSipClient()
const incomingCall = ref(null)

// Listen for new session events
eventBus.on('sip:new_session', (event) => {
  // The 'originator' property indicates who initiated the session
  if (event.originator === 'remote') {
    // This is an incoming call (remote party initiated it)
    console.log('Incoming call from:', event.session.remote_identity)
    incomingCall.value = event.session
  }
  // If originator === 'local', it's an outgoing call you initiated
})
```

📝 **Note:** The `originator` field distinguishes between incoming (`'remote'`) and outgoing (`'local'`) calls.

### Method 2: Using the Call Store

✅ **Best Practice:** This is the recommended approach for most applications as it provides automatic queue management.

The call store automatically tracks all calls and provides computed properties for easy access:

```typescript
import { callStore } from 'vuesip'
import { computed } from 'vue'

// Get all incoming calls currently in the queue
// This is reactive and updates automatically
const incomingCalls = computed(() => callStore.incomingCalls)

// Get the count of waiting calls
// Useful for displaying notifications like "3 calls waiting"
const incomingCallCount = computed(() => callStore.incomingCallCount)

// Get the next incoming call to handle
// This retrieves the oldest call in the queue (FIFO - First In, First Out)
const nextIncomingCall = callStore.getNextIncomingCall()
```

💡 **Tip:** The call store uses a FIFO (First In, First Out) queue, so `getNextIncomingCall()` always returns the oldest waiting call.

### Method 3: Using the Call Session Composable

✅ **Best Practice:** Use this method for component-level call handling with reactive state.

The `useCallSession` composable provides the most convenient API with reactive state management:

```typescript
import { useCallSession } from 'vuesip'
import { ref, watch } from 'vue'

const sipClient = ref(/* your SIP client */)

// The composable provides reactive state for the current call
const {
  session,    // The current call session object
  state,      // Current call state: 'ringing', 'established', 'terminated', etc.
  direction,  // 'incoming' or 'outgoing'
  answer,     // Function to answer the call
  reject      // Function to reject the call
} = useCallSession(sipClient)

// Watch for state changes to detect incoming calls
watch(state, (newState) => {
  // A call is incoming when:
  // 1. State is 'ringing' (call hasn't been answered yet)
  // 2. Direction is 'incoming' (someone is calling you)
  if (newState === 'ringing' && direction.value === 'incoming') {
    console.log('Incoming call detected!')
    // Show incoming call UI, play ringtone, etc.
  }
})
```

📝 **Note:** Each method has its use case:
- **Event listeners** - Low-level control, useful for middleware or logging
- **Call store** - Managing multiple calls, queue operations
- **useCallSession** - Component-level reactivity, simplest for UI components

---

## Auto-Answer Configuration

**What you'll learn:** How to automatically answer incoming calls with optional delays and custom conditions.

**Why it matters:** Auto-answer is essential for applications like call center agents, emergency lines, intercom systems, or testing environments where immediate connection is required.

### Built-in Auto-Answer

VueSip includes built-in auto-answer functionality that can be enabled through user preferences. This handles the complexity of timing and session management for you.

#### Step 1: Configure During Initialization

Enable auto-answer when creating your VueSip instance:

```typescript
import { createVueSip } from 'vuesip'

const vueSip = createVueSip({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@sip.example.com',
  password: 'your-password',
  userPreferences: {
    // Enable auto-answer for all incoming calls
    autoAnswer: true,

    // Optional: Add delay before auto-answering (in milliseconds)
    // Default: 0 (answer immediately)
    autoAnswerDelay: 2000 // Wait 2 seconds before answering
  }
})
```

💡 **Tip:** Use a delay to:
- Give users a moment to prepare (grab headset, stop other activities)
- Allow proper UI rendering before the call connects
- Comply with regulations requiring answer delays

⚠️ **Warning:** Auto-answer with zero delay might answer before your UI is ready. Consider using at least 500ms delay.

### Custom Auto-Answer Logic

For advanced scenarios like whitelisting, business hours, or conditional answering, implement custom logic:

```typescript
import { useCallSession } from 'vuesip'
import { ref, watch } from 'vue'

const sipClient = ref(/* your SIP client */)
const { session, state, direction, answer } = useCallSession(sipClient)

// Auto-answer incoming calls with custom logic
watch([state, direction], ([newState, newDirection]) => {
  if (newState === 'ringing' && newDirection === 'incoming') {
    // Check custom conditions before auto-answering
    const shouldAutoAnswer = checkAutoAnswerConditions()

    if (shouldAutoAnswer) {
      // Optional delay to allow UI setup
      setTimeout(async () => {
        // Verify the call is still ringing before answering
        // (it might have been canceled or timed out)
        if (state.value === 'ringing') {
          try {
            await answer({
              audio: true,
              video: false
            })
            console.log('Call auto-answered')
          } catch (error) {
            console.error('Auto-answer failed:', error)
          }
        }
      }, 2000) // 2 second delay
    }
  }
})

function checkAutoAnswerConditions(): boolean {
  // Implement your custom logic here
  // Examples:
  // - Check time of day (e.g., only during business hours)
  // - Check caller identity (e.g., only from specific numbers)
  // - Check user availability status (e.g., not in DND mode)
  // - Check if already in a call (e.g., reject if busy)

  const isBusinessHours = /* check current time */
  const isKnownCaller = /* check caller against whitelist */
  const isAvailable = /* check user status */

  return isBusinessHours && isKnownCaller && isAvailable
}
```

✅ **Best Practice:** Always verify the call state hasn't changed before answering within a timeout callback.

📝 **Note:** See [Example 3: Auto-Answer with Conditions](#example-3-auto-answer-with-conditions) for a complete implementation with whitelisting.

---

## Answering Calls

**What you'll learn:** Different ways to answer incoming calls with varying media configurations and options.

**Why it matters:** Proper call answering with correct media settings ensures good call quality and user experience. Different scenarios require different configurations (audio-only, video, custom quality settings).

### Basic Answer (Audio Only)

The simplest way to answer a call with default settings:

```typescript
import { useCallSession } from 'vuesip'

const { answer } = useCallSession(sipClient)

async function handleAnswer() {
  try {
    // Answer with default settings (audio only, standard quality)
    await answer()
    console.log('Call answered successfully')
  } catch (error) {
    console.error('Failed to answer call:', error)
    // Error could be: permission denied, no microphone, network error, etc.
  }
}
```

### Answer with Custom Options

Control exactly how the call is answered with detailed configuration:

```typescript
import type { AnswerOptions } from 'vuesip'

const answerOptions: AnswerOptions = {
  // Enable/disable audio stream
  audio: true,

  // Enable/disable video stream
  video: false,

  // Custom media constraints for fine-grained control
  mediaConstraints: {
    audio: {
      echoCancellation: true,      // Remove echo for better call quality
      noiseSuppression: true,       // Filter background noise
      autoGainControl: true,        // Automatically adjust volume
      // You can also specify device ID to select a specific microphone
      // deviceId: { exact: 'microphone-id-here' }
    },
    video: {
      width: { ideal: 1280 },       // Preferred width (not guaranteed)
      height: { ideal: 720 },       // Preferred height (not guaranteed)
      frameRate: { ideal: 30 },     // Frames per second
      // You can also specify:
      // facingMode: { ideal: 'user' }  // 'user' for front camera, 'environment' for back
    }
  },

  // Custom WebRTC configuration
  rtcConfiguration: {
    iceServers: [
      // STUN server helps with NAT traversal
      { urls: 'stun:stun.l.google.com:19302' },
      // You can add TURN servers for firewall traversal
      // {
      //   urls: 'turn:turn.example.com:3478',
      //   username: 'user',
      //   credential: 'pass'
      // }
    ]
  },

  // Additional SIP headers to send with the answer
  extraHeaders: [
    'X-Custom-Header: value',
    'X-App-Version: 1.0.0'
  ]
}

await answer(answerOptions)
```

💡 **Tip:** Use `ideal` constraints instead of `exact` when possible - they provide preferences without failing if exact values aren't available.

### Answer with Video

Enable video calling for face-to-face conversations:

```typescript
async function answerWithVideo() {
  try {
    await answer({
      audio: true,  // Always include audio for video calls
      video: true,
      mediaConstraints: {
        audio: true,
        video: {
          width: { ideal: 1280 },   // HD video
          height: { ideal: 720 },
          frameRate: { ideal: 30 }  // Smooth video
          // For mobile, you might want lower quality:
          // width: { ideal: 640 },
          // height: { ideal: 480 },
          // frameRate: { ideal: 15 }
        }
      }
    })
  } catch (error) {
    console.error('Failed to answer with video:', error)
    // Common errors:
    // - NotAllowedError: User denied camera permission
    // - NotFoundError: No camera available
    // - NotReadableError: Camera already in use
  }
}
```

⚠️ **Warning:** Always request camera and microphone permissions before answering a video call. See [Best Practice #3: Handle Media Permissions](#3-handle-media-permissions).

### Answer from Call Store

When managing multiple calls, answer a specific call from the queue:

```typescript
import { callStore } from 'vuesip'

// Get the next incoming call from the queue
const incomingCall = callStore.getNextIncomingCall()

if (incomingCall) {
  // Create a CallSession instance for this specific call
  const session = new CallSession({
    id: incomingCall.id,                  // Unique call identifier
    direction: incomingCall.direction,     // 'incoming'
    localUri: incomingCall.localUri,       // Your SIP URI
    remoteUri: incomingCall.remoteUri,     // Caller's SIP URI
    rtcSession: /* JsSIP RTCSession */,    // The underlying JsSIP session
    eventBus: /* event bus instance */     // For event emission
  })

  // Answer the specific call
  await session.answer({ audio: true, video: false })
}
```

📝 **Note:** This approach is useful when building custom call queue UIs where users can select which call to answer.

---

## Rejecting Calls

**What you'll learn:** How to reject incoming calls with appropriate SIP status codes to communicate the reason.

**Why it matters:** Different rejection codes communicate different things to the caller and the SIP network. Using the right code helps with proper call routing, billing, and user experience.

### Basic Reject (Decline)

Reject a call with the default status code (603 - Decline):

```typescript
import { useCallSession } from 'vuesip'

const { reject } = useCallSession(sipClient)

async function handleReject() {
  try {
    // Rejects with 603 Decline (user explicitly declined)
    await reject()
    console.log('Call rejected')
  } catch (error) {
    console.error('Failed to reject call:', error)
  }
}
```

### Reject with Specific Status Codes

Use different SIP status codes to communicate the specific reason for rejection:

```typescript
// 486 - Busy Here (you're on another call)
async function rejectBusy() {
  await reject(486)
  // The caller's system may retry later or show "User is busy"
}

// 603 - Decline (you explicitly don't want this call)
async function rejectDecline() {
  await reject(603)
  // Clear rejection - don't retry, user declined
}

// 480 - Temporarily Unavailable (you're away but might be back)
async function rejectUnavailable() {
  await reject(480)
  // Indicates temporary unavailability - caller might try again
}
```

### Understanding SIP Rejection Status Codes

| Code | Reason Phrase | Use Case | What It Communicates |
|------|---------------|----------|---------------------|
| 486  | Busy Here | User is already on another call | "I'm busy, try later" |
| 603  | Decline | User explicitly declined the call | "I don't want this call" |
| 480  | Temporarily Unavailable | User is temporarily unavailable | "I'm away, try later" |
| 404  | Not Found | User/extension not found | "Wrong number" |
| 406  | Not Acceptable | Call parameters not acceptable | "Can't support video/codec" |

💡 **Tip:** Choose the status code that best matches your rejection reason - it helps PBX systems and caller applications provide better feedback.

### Example: Smart Call Rejection

Automatically reject calls based on caller identity or blocklist:

```typescript
import { useCallSession } from 'vuesip'
import { watch } from 'vue'

const { session, state, direction, remoteUri, reject } = useCallSession(sipClient)

// Maintain a blocklist of unwanted callers
const blockedNumbers = ['sip:spam@example.com', 'sip:blocked@example.com']

// Watch for incoming calls and check against blocklist
watch([state, direction, remoteUri], ([newState, newDirection, newRemoteUri]) => {
  if (newState === 'ringing' && newDirection === 'incoming') {
    // Check if this caller is blocked
    const isBlocked = blockedNumbers.some(blocked =>
      newRemoteUri?.includes(blocked)
    )

    if (isBlocked) {
      // Silently reject blocked calls with 603 Decline
      reject(603)
        .then(() => console.log('Blocked call rejected'))
        .catch(err => console.error('Rejection failed:', err))
    }
  }
})
```

✅ **Best Practice:** Use status code 603 (Decline) for blocklisted numbers - it clearly indicates the call won't be accepted.

---

## Call Queuing

**What you'll learn:** How VueSip manages multiple incoming calls and how to handle them systematically.

**Why it matters:** In real-world applications, multiple calls can arrive simultaneously. Proper queue management ensures no calls are lost and users can handle them in an organized manner.

### Understanding the Call Queue System

VueSip includes a built-in call queue that automatically manages multiple incoming calls:

**How it works:**

1. **Automatic Queueing:** When calls arrive, they're automatically added to the queue
2. **FIFO Order:** Calls are queued in First-In-First-Out order (oldest call first)
3. **Automatic Tracking:** The queue tracks which calls are waiting, active, or completed
4. **Automatic Cleanup:** Answered or rejected calls are automatically removed

This ensures you never lose track of incoming calls, even when multiple arrive at once.

### Accessing the Queue

Get real-time information about waiting calls:

```typescript
import { callStore } from 'vuesip'
import { computed } from 'vue'

// Get all incoming calls in the queue (reactive)
// Returns an array of call objects, oldest first
const queuedCalls = computed(() => callStore.incomingCalls)

// Get the number of calls waiting (reactive)
// Useful for displaying "3 calls waiting" notifications
const queueLength = computed(() => callStore.incomingCallCount)

// Get the next call to handle (not reactive - it's a one-time retrieval)
// This retrieves but does NOT remove the call from the queue
const nextCall = callStore.getNextIncomingCall()
```

📝 **Note:** `getNextIncomingCall()` retrieves the next call but doesn't remove it from the queue. The call is removed only when answered or rejected.

### Basic Queue Handling

Process calls one at a time:

```typescript
import { callStore } from 'vuesip'

async function handleNextIncomingCall() {
  // Get the oldest waiting call
  const nextCall = callStore.getNextIncomingCall()

  if (!nextCall) {
    console.log('No incoming calls in queue')
    return
  }

  console.log(`Handling call from: ${nextCall.remoteUri}`)
  console.log(`Display name: ${nextCall.remoteDisplayName || 'Unknown'}`)

  // Show UI, let user decide to answer or reject
  // When they answer/reject, the call is automatically removed from queue
}
```

### Sequential Call Handling

Automatically handle calls one after another:

```typescript
import { callStore } from 'vuesip'
import { ref, watch } from 'vue'

// Track whether we're currently handling a call
const isHandlingCall = ref(false)

// Watch for new calls entering the queue
watch(() => callStore.incomingCallCount, (count) => {
  // If there are calls waiting and we're not busy, handle the next one
  if (count > 0 && !isHandlingCall.value) {
    handleNextCall()
  }
})

async function handleNextCall() {
  const nextCall = callStore.getNextIncomingCall()
  if (!nextCall) return

  // Mark as busy to prevent handling multiple calls simultaneously
  isHandlingCall.value = true

  try {
    // Show incoming call UI for this specific call
    // Display caller info, answer/reject buttons, etc.
    showIncomingCallUI(nextCall)

    // Wait for user action (answer or reject)
    // When they answer/reject, the call is removed from queue

  } finally {
    // Mark as not busy
    isHandlingCall.value = false

    // Check if there are more calls waiting
    if (callStore.incomingCallCount > 0) {
      // Handle the next call
      handleNextCall()
    }
  }
}

function showIncomingCallUI(call) {
  // Your UI logic here
  // Show modal/notification with call details
  // Provide answer/reject buttons
}
```

💡 **Tip:** This pattern ensures calls are handled one at a time in order, providing a smooth user experience.

### Managing Concurrent Call Limits

Control how many calls can be active at once:

```typescript
import { callStore } from 'vuesip'

// Set maximum concurrent calls (default: 4)
// This limits how many calls can be active simultaneously
callStore.setMaxConcurrentCalls(2)

// Check if at maximum capacity
if (callStore.isAtMaxCalls) {
  console.log('Cannot accept more calls - at maximum capacity')
  // You might want to auto-reject new calls or show a warning
}

// Get current active call count
const activeCallCount = callStore.establishedCalls.length

console.log(`${activeCallCount} calls active, max ${callStore.maxConcurrentCalls}`)
```

⚠️ **Warning:** Setting a very low limit (like 1) means users can only handle one call at a time. Higher limits allow call waiting and switching.

### Auto-Rejecting Queued Calls When Busy

Automatically reject new calls when you've reached capacity:

```typescript
import { callStore } from 'vuesip'
import { watch } from 'vue'

// Auto-reject incoming calls when already at max capacity
watch(() => callStore.incomingCallCount, async (count) => {
  // If there are incoming calls and we're at max capacity
  if (count > 0 && callStore.isAtMaxCalls) {
    const calls = callStore.incomingCalls

    // Reject all excess calls with "486 Busy Here" status
    for (const call of calls) {
      try {
        // Create a session for this call
        const session = /* get CallSession for this call */

        // Reject with 486 (Busy Here) to indicate you're on another call
        await session.reject(486)

        console.log(`Auto-rejected call from ${call.remoteUri} - at capacity`)
      } catch (error) {
        console.error('Failed to auto-reject call:', error)
      }
    }
  }
})
```

✅ **Best Practice:** Use status code 486 (Busy Here) when rejecting due to capacity - it accurately reflects the situation.

---

## Best Practices

Follow these proven patterns for robust, user-friendly incoming call handling:

### 1. Always Handle Incoming Call Events

⚠️ **Warning:** Unhandled incoming calls may ring indefinitely or disconnect, creating a poor user experience.

```typescript
import { onMounted, onUnmounted } from 'vue'

// Set up event listeners when component mounts
onMounted(() => {
  eventBus.on('sip:new_session', handleIncomingCall)
})

// CRITICAL: Clean up listeners when component unmounts
// Failing to do this causes memory leaks
onUnmounted(() => {
  eventBus.off('sip:new_session', handleIncomingCall)
})

function handleIncomingCall(event) {
  // Your call handling logic
}
```

✅ **Best Practice:** Always pair `eventBus.on()` with `eventBus.off()` to prevent memory leaks.

### 2. Provide User Feedback

Always give users clear visual and audio feedback for incoming calls:

```typescript
import { watch, ref } from 'vue'

const showIncomingCallModal = ref(false)
const ringtone = new Audio('/sounds/ringtone.mp3')

watch(state, (newState) => {
  if (newState === 'ringing' && direction.value === 'incoming') {
    // Visual feedback: Show modal/notification
    showIncomingCallModal.value = true

    // Audio feedback: Play ringtone
    ringtone.loop = true  // Keep ringing until answered
    ringtone.play().catch(err => {
      // Browser may block autoplay
      console.error('Failed to play ringtone:', err)
    })
  } else {
    // Call answered/rejected/ended - clean up
    showIncomingCallModal.value = false
    ringtone.pause()
    ringtone.currentTime = 0  // Reset to start
  }
})
```

💡 **Tip:** Modern browsers may block autoplay. Consider requiring a user interaction before enabling ringtones, or show a visual-only notification as a fallback.

📝 **Note:** Provide both visual AND audio feedback - users might not be looking at the screen when a call arrives.

### 3. Handle Media Permissions Properly

Request and verify media permissions BEFORE answering to avoid failures:

```typescript
async function handleAnswer() {
  try {
    // Step 1: Request permissions by getting a test stream
    // This triggers the browser's permission dialog
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })

    // Step 2: Stop the test stream (we don't need it anymore)
    // VueSip will create its own stream when answering
    stream.getTracks().forEach(track => track.stop())

    // Step 3: Now answer the call
    // At this point we know we have permission
    await answer({ audio: true, video: false })

  } catch (error) {
    // Handle different error types appropriately
    if (error.name === 'NotAllowedError') {
      console.error('Microphone permission denied')
      // Show user-friendly message:
      // "Please allow microphone access to answer calls"
      showPermissionError('microphone')
    } else if (error.name === 'NotFoundError') {
      console.error('No microphone found')
      // "No microphone detected. Please connect a microphone."
      showDeviceError('microphone')
    } else {
      console.error('Failed to answer:', error)
      showGenericError()
    }
  }
}
```

✅ **Best Practice:** Request permissions early (e.g., during app initialization) rather than waiting until a call arrives.

⚠️ **Warning:** If you answer without checking permissions first, the call may fail mid-connection, creating a poor experience.

### 4. Display Comprehensive Caller Information

Show users who's calling before they answer:

```typescript
import { computed } from 'vue'

const callerInfo = computed(() => {
  if (!session.value || direction.value !== 'incoming') {
    return null
  }

  return {
    // Display name from SIP headers (e.g., "John Doe")
    displayName: session.value.remoteDisplayName || 'Unknown',

    // Full SIP URI (e.g., "sip:john@company.com")
    uri: session.value.remoteUri,

    // Just the user part (e.g., "john" from "sip:john@company.com")
    username: session.value.remoteUri?.split('@')[0]?.replace('sip:', '') || 'Unknown',

    // When the call started ringing
    startTime: session.value.timing.startTime,

    // You might also want to:
    // - Look up the caller in your contacts database
    // - Display their avatar/photo
    // - Show call history with this person
  }
})
```

💡 **Tip:** Enhance caller identification by integrating with your user database to show friendly names and photos.

### 5. Handle Errors Gracefully

Always catch and handle errors with user-friendly feedback:

```typescript
async function handleAnswer() {
  try {
    await answer()
  } catch (error) {
    console.error('Answer failed:', error)

    // Provide clear user feedback
    showNotification({
      type: 'error',
      message: 'Failed to answer call. Please try again.',
      duration: 5000
    })

    // Optionally reject the call since we can't answer
    try {
      await reject(480) // 480 - Temporarily Unavailable
    } catch (rejectError) {
      console.error('Reject also failed:', rejectError)
    }
  }
}

function showNotification(options) {
  // Your notification implementation
  // Could use a toast library, modal, or native notifications
}
```

✅ **Best Practice:** Never silently fail - always inform users when something goes wrong.

### 6. Clean Up Resources Properly

Ensure all resources are cleaned up when calls end:

```typescript
import { watch } from 'vue'

watch(state, (newState) => {
  // Call has ended (either normally or with error)
  if (newState === 'terminated' || newState === 'failed') {
    // Step 1: Stop audio feedback
    if (ringtone) {
      ringtone.pause()
      ringtone.currentTime = 0
    }

    // Step 2: Close UI elements
    showIncomingCallModal.value = false

    // Step 3: Clear session reference
    clearSession()

    // Step 4: Remove from incoming call queue
    if (session.value) {
      callStore.removeFromIncomingQueue(session.value.id)
    }

    // Step 5: Clean up any media streams
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop())
      localStream.value = null
    }

    // Step 6: Reset component state
    resetComponentState()
  }
})

function resetComponentState() {
  // Reset any component-specific state
  callDuration.value = 0
  isMuted.value = false
  // etc.
}
```

⚠️ **Warning:** Failing to clean up media streams can leave the microphone/camera active even after the call ends.

### 7. Implement Call Waiting

Handle multiple calls with proper call waiting notifications:

```typescript
import { computed, watch } from 'vue'

// Check if user is already on a call
const hasActiveCall = computed(() => {
  return callStore.establishedCalls.length > 0
})

// Check if there's a call waiting while on another call
const hasWaitingCall = computed(() => {
  return callStore.incomingCallCount > 0 && hasActiveCall.value
})

// Show call waiting notification
watch(hasWaitingCall, (isWaiting) => {
  if (isWaiting) {
    // Show subtle notification during active call
    showCallWaitingNotification({
      message: 'Another call is waiting',
      action: 'View',
      onAction: () => showCallQueue()
    })
  }
})

function showCallQueue() {
  // Show UI listing all waiting calls
  // Allow user to:
  // - Hold current call and answer waiting call
  // - Reject waiting call
  // - See who's calling
}
```

💡 **Tip:** Call waiting is expected in business applications - implement it to match users' phone system expectations.

---

## Complete Examples

Real-world, production-ready examples you can adapt for your application:

### Example 1: Basic Incoming Call Handler

A complete component for handling incoming calls with UI feedback:

```typescript
<template>
  <div>
    <!-- Incoming Call Modal -->
    <div v-if="showIncomingCall" class="incoming-call-modal">
      <h2>Incoming Call</h2>

      <!-- Display caller information -->
      <div class="caller-info">
        <p class="caller-name">{{ callerName }}</p>
        <p class="caller-uri">{{ callerUri }}</p>
        <p class="call-duration">Ringing for {{ ringingDuration }}s</p>
      </div>

      <!-- Action buttons -->
      <div class="call-actions">
        <button @click="handleAnswer" class="btn-answer">
          📞 Answer
        </button>
        <button @click="handleReject" class="btn-reject">
          ❌ Decline
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useCallSession } from 'vuesip'

// Get SIP client reference (from your app's state/context)
const sipClient = ref(/* your SIP client */)

// Initialize call session composable
const {
  session,              // Current session object
  state,                // Call state (ringing, established, etc.)
  direction,            // incoming or outgoing
  remoteUri,            // Caller's SIP URI
  remoteDisplayName,    // Caller's display name
  answer,               // Function to answer
  reject                // Function to reject
} = useCallSession(sipClient)

// Component state
const showIncomingCall = ref(false)
const ringingDuration = ref(0)
let ringingInterval: number | null = null

// Create ringtone audio element
const ringtone = new Audio('/sounds/ringtone.mp3')
ringtone.loop = true  // Keep playing until answered

// Computed properties for caller info
const callerName = computed(() => {
  return remoteDisplayName.value || 'Unknown Caller'
})

const callerUri = computed(() => {
  return remoteUri.value || ''
})

// Watch for incoming calls
watch([state, direction], ([newState, newDirection]) => {
  if (newState === 'ringing' && newDirection === 'incoming') {
    // Incoming call detected!

    // Show the incoming call UI
    showIncomingCall.value = true

    // Start tracking ringing duration
    ringingDuration.value = 0
    ringingInterval = window.setInterval(() => {
      ringingDuration.value++
    }, 1000)

    // Play ringtone (with error handling for autoplay blocking)
    ringtone.play().catch(err => {
      console.error('Failed to play ringtone:', err)
      // Consider showing a visual-only notification
    })

  } else if (newState === 'terminated' || newState === 'failed') {
    // Call ended - clean up
    cleanupCall()
  }
})

// Answer the call
async function handleAnswer() {
  try {
    // Answer with audio only
    await answer({ audio: true, video: false })

    // Clean up incoming call UI
    showIncomingCall.value = false
    stopRingtone()

  } catch (error) {
    console.error('Failed to answer:', error)

    // Show error to user
    alert('Failed to answer call. Please check your microphone permissions.')
  }
}

// Reject the call
async function handleReject() {
  try {
    // Reject with 603 Decline
    await reject(603)

    // Clean up UI
    cleanupCall()

  } catch (error) {
    console.error('Failed to reject:', error)
  }
}

// Helper function to stop ringtone
function stopRingtone() {
  ringtone.pause()
  ringtone.currentTime = 0  // Reset to beginning
}

// Helper function to clean up call resources
function cleanupCall() {
  showIncomingCall.value = false
  stopRingtone()

  // Clear ringing duration timer
  if (ringingInterval) {
    clearInterval(ringingInterval)
    ringingInterval = null
  }
  ringingDuration.value = 0
}

// Clean up when component unmounts
onUnmounted(() => {
  cleanupCall()
})
</script>

<style scoped>
.incoming-call-modal {
  /* Your modal styles */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.caller-info {
  margin: 1.5rem 0;
  text-align: center;
}

.caller-name {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.caller-uri {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.call-duration {
  color: #999;
  font-size: 0.8rem;
}

.call-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-answer, .btn-reject {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-answer {
  background: #22c55e;
  color: white;
}

.btn-reject {
  background: #ef4444;
  color: white;
}
</style>
```

### Example 2: Call Queue Manager

A sophisticated queue manager for handling multiple simultaneous incoming calls:

```typescript
<template>
  <div>
    <!-- Queue Status Indicator -->
    <div v-if="queueLength > 0" class="queue-status">
      <p>📞 {{ queueLength }} call(s) waiting</p>
      <button @click="showQueue = !showQueue">
        {{ showQueue ? 'Hide' : 'Show' }} Queue
      </button>
    </div>

    <!-- Queue List (optional expanded view) -->
    <div v-if="showQueue && queueLength > 0" class="queue-list">
      <h3>Waiting Calls</h3>
      <ul>
        <li v-for="(call, index) in incomingCalls" :key="call.id">
          <span>{{ index + 1 }}. {{ call.remoteDisplayName || 'Unknown' }}</span>
          <span>{{ call.remoteUri }}</span>
        </li>
      </ul>
    </div>

    <!-- Current Incoming Call UI -->
    <div v-if="currentIncomingCall" class="incoming-call">
      <h2>
        Incoming Call {{ currentCallIndex + 1 }} of {{ queueLength }}
      </h2>

      <div class="caller-info">
        <p class="caller-name">
          {{ currentIncomingCall.remoteDisplayName || 'Unknown Caller' }}
        </p>
        <p class="caller-uri">{{ currentIncomingCall.remoteUri }}</p>
      </div>

      <div class="call-actions">
        <button @click="answerCurrent" class="btn-answer">
          📞 Answer
        </button>
        <button @click="rejectCurrent" class="btn-reject">
          ❌ Decline
        </button>
        <button v-if="queueLength > 1" @click="rejectAll" class="btn-reject-all">
          🚫 Decline All ({{ queueLength }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { callStore } from 'vuesip'
import { CallSession } from 'vuesip'

// Component state
const currentIncomingCall = ref(null)
const currentCallIndex = ref(0)
const showQueue = ref(false)

// Computed properties from call store
const queueLength = computed(() => callStore.incomingCallCount)
const incomingCalls = computed(() => callStore.incomingCalls)

// Watch for new calls entering the queue
watch(queueLength, (count) => {
  // If there are calls in queue and we're not showing one, show the next
  if (count > 0 && !currentIncomingCall.value) {
    showNextCall()
  }
})

// Show the next call from the queue
function showNextCall() {
  const nextCall = callStore.getNextIncomingCall()
  if (nextCall) {
    currentIncomingCall.value = nextCall
    currentCallIndex.value = 0

    // Play ringtone, show notification, etc.
    playRingtone()
  }
}

// Answer the currently displayed call
async function answerCurrent() {
  if (!currentIncomingCall.value) return

  try {
    // Create a CallSession instance for this call
    const session = new CallSession({
      id: currentIncomingCall.value.id,
      direction: currentIncomingCall.value.direction,
      localUri: currentIncomingCall.value.localUri,
      remoteUri: currentIncomingCall.value.remoteUri,
      rtcSession: currentIncomingCall.value.rtcSession,  // JsSIP session
      eventBus: currentIncomingCall.value.eventBus
    })

    // Answer the call
    await session.answer({ audio: true, video: false })

    // Stop ringtone
    stopRingtone()

    // Remove from queue
    callStore.removeFromIncomingQueue(currentIncomingCall.value.id)
    currentIncomingCall.value = null

    // Show next call if any
    if (queueLength.value > 0) {
      showNextCall()
    }

  } catch (error) {
    console.error('Failed to answer:', error)
    alert('Failed to answer call. Please try again.')
  }
}

// Reject the currently displayed call
async function rejectCurrent() {
  if (!currentIncomingCall.value) return

  try {
    // Create session and reject
    const session = new CallSession({
      id: currentIncomingCall.value.id,
      direction: currentIncomingCall.value.direction,
      localUri: currentIncomingCall.value.localUri,
      remoteUri: currentIncomingCall.value.remoteUri,
      rtcSession: currentIncomingCall.value.rtcSession,
      eventBus: currentIncomingCall.value.eventBus
    })

    await session.reject(603)  // 603 Decline

    // Stop ringtone
    stopRingtone()

    // Remove from queue
    callStore.removeFromIncomingQueue(currentIncomingCall.value.id)
    currentIncomingCall.value = null

    // Show next call if any
    if (queueLength.value > 0) {
      showNextCall()
    }

  } catch (error) {
    console.error('Failed to reject:', error)
  }
}

// Reject all calls in the queue
async function rejectAll() {
  // Create a copy of the array to avoid modification during iteration
  const calls = [...incomingCalls.value]

  for (const call of calls) {
    try {
      const session = new CallSession({
        id: call.id,
        direction: call.direction,
        localUri: call.localUri,
        remoteUri: call.remoteUri,
        rtcSession: call.rtcSession,
        eventBus: call.eventBus
      })

      await session.reject(603)  // 603 Decline
      callStore.removeFromIncomingQueue(call.id)

    } catch (error) {
      console.error('Failed to reject call:', error)
    }
  }

  // Clean up UI
  currentIncomingCall.value = null
  stopRingtone()
}

// Helper functions for ringtone (implement based on your needs)
function playRingtone() {
  // Your ringtone implementation
}

function stopRingtone() {
  // Your ringtone stop implementation
}
</script>

<style scoped>
.queue-status {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 999;
}

.queue-list {
  position: fixed;
  top: 5rem;
  right: 1rem;
  background: white;
  padding: 1rem;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  max-width: 300px;
  z-index: 998;
}

.queue-list ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0 0;
}

.queue-list li {
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.incoming-call {
  /* Similar styles to Example 1 */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 400px;
}

.btn-reject-all {
  background: #dc2626;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

### Example 3: Auto-Answer with Conditions

Sophisticated auto-answer with whitelisting and business rules:

```typescript
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useCallSession } from 'vuesip'

const sipClient = ref(/* your SIP client */)

const {
  session,
  state,
  direction,
  remoteUri,
  answer,
  reject
} = useCallSession(sipClient)

// Auto-answer configuration
const autoAnswerEnabled = ref(true)          // Can be toggled by user
const autoAnswerDelay = ref(2000)           // 2 seconds
const autoAnswering = ref(false)             // Track if we're in auto-answer process

// Whitelist of auto-answer numbers
const whitelistedNumbers = ref([
  'sip:boss@company.com',
  'sip:support@company.com',
  'sip:customer-service@company.com'
])

// Business hours configuration
const businessHours = {
  start: 9,   // 9 AM
  end: 17,    // 5 PM
  days: [1, 2, 3, 4, 5]  // Monday-Friday (0 = Sunday)
}

// Computed property to check if it's business hours
const isBusinessHours = computed(() => {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

  return businessHours.days.includes(day) &&
         hour >= businessHours.start &&
         hour < businessHours.end
})

// Watch for incoming calls
watch([state, direction, remoteUri], ([newState, newDirection, newRemoteUri]) => {
  if (newState === 'ringing' && newDirection === 'incoming') {
    handleIncomingCall(newRemoteUri)
  }
})

function handleIncomingCall(callerUri: string | null) {
  // Step 1: Check if auto-answer is enabled
  if (!autoAnswerEnabled.value) {
    console.log('Auto-answer disabled - showing manual UI')
    // Show manual answer UI
    return
  }

  // Step 2: Check if caller is whitelisted
  const isWhitelisted = whitelistedNumbers.value.some(num =>
    callerUri?.includes(num)
  )

  if (!isWhitelisted) {
    console.log('Caller not whitelisted:', callerUri)
    console.log('Showing manual answer UI')
    // Show manual answer UI for non-whitelisted callers
    return
  }

  // Step 3: Check business hours (optional check)
  // You might want to auto-answer whitelisted numbers even outside business hours
  // or only during business hours - adjust based on your needs
  if (!isBusinessHours.value) {
    console.log('Outside business hours - manual answer required')
    // Optionally still show UI or auto-answer anyway
    return
  }

  // Step 4: All checks passed - auto-answer
  autoAnswering.value = true
  console.log(`Auto-answering call from ${callerUri} in ${autoAnswerDelay.value}ms`)

  // Show a notification that auto-answer will occur
  showAutoAnswerNotification(callerUri, autoAnswerDelay.value)

  // Answer after delay
  setTimeout(async () => {
    // Verify call is still ringing (user might have manually answered/rejected)
    if (state.value === 'ringing' && autoAnswering.value) {
      try {
        await answer({
          audio: true,
          video: false,
          mediaConstraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          }
        })

        console.log('Call auto-answered successfully')
        showNotification({
          type: 'success',
          message: `Auto-answered call from ${callerUri}`
        })

      } catch (error) {
        console.error('Auto-answer failed:', error)

        // Fallback: Show manual answer UI
        showNotification({
          type: 'error',
          message: 'Auto-answer failed. Please answer manually.'
        })
      }
    }

    autoAnswering.value = false
  }, autoAnswerDelay.value)
}

// Helper function to show auto-answer notification
function showAutoAnswerNotification(callerUri: string | null, delay: number) {
  const seconds = Math.round(delay / 1000)
  showNotification({
    type: 'info',
    message: `Auto-answering call from ${callerUri} in ${seconds} seconds...`,
    duration: delay
  })
}

// Helper function to show notifications
function showNotification(options: {
  type: 'info' | 'success' | 'error'
  message: string
  duration?: number
}) {
  // Your notification implementation
  console.log(`[${options.type.toUpperCase()}]`, options.message)
}
</script>
```

💡 **Tip:** This example demonstrates a complete auto-answer system with multiple conditions. Adapt the whitelist and business rules to match your application's needs.

✅ **Best Practice:** Always provide a way for users to disable auto-answer and always show a notification when auto-answering is about to occur.

---

## Summary

This guide covered everything you need to handle incoming calls professionally:

- **Incoming Call Detection**: Three flexible methods (events, call store, composable) for detecting calls based on your architecture
- **Auto-Answer**: Built-in configuration and custom conditional logic for automatic call answering
- **Answering Calls**: Basic to advanced answering with media configuration and quality settings
- **Rejecting Calls**: Using appropriate SIP status codes to communicate rejection reasons
- **Call Queuing**: Managing multiple simultaneous calls with VueSip's built-in queue system
- **Best Practices**: Seven essential patterns for robust, user-friendly call handling
- **Complete Examples**: Three production-ready examples you can adapt for your needs

### Next Steps

Now that you understand incoming call handling, explore these related topics:

- **[Making Calls Guide](./making-calls.md)** - Learn how to initiate outgoing calls
- **[Call Controls Guide](./call-controls.md)** - Master in-call features like mute, hold, and transfer
- **[API Reference](../api/index.md)** - Deep dive into all available APIs and options

### Quick Reference

**Detect incoming calls:**
```typescript
const { state, direction } = useCallSession(sipClient)
// state === 'ringing' && direction === 'incoming'
```

**Answer a call:**
```typescript
await answer({ audio: true, video: false })
```

**Reject a call:**
```typescript
await reject(603)  // 603 Decline
```

**Check call queue:**
```typescript
const count = callStore.incomingCallCount
const next = callStore.getNextIncomingCall()
```

⚠️ **Remember:** Always clean up event listeners and media streams to prevent memory leaks and resource hogging!
