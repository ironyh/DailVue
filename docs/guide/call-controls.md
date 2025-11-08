# Call Controls Guide

This guide covers the essential call control features in VueSip, enabling you to build professional phone applications with hold/unhold functionality, mute controls, DTMF tone sending, and call transfer capabilities.

## Overview

Call controls are the building blocks of any VoIP application. Whether you're building a simple softphone, a customer service application, or a complex call center solution, you need reliable ways to manage active calls.

**Why Call Controls Matter:**
- **User Experience**: Users expect familiar phone controls (hold, mute, transfer)
- **Professional Features**: Business applications require advanced features like attended transfers
- **Compliance**: Some industries require call recording indicators (mute status)
- **Efficiency**: Quick access to controls improves agent productivity

VueSip provides comprehensive call control features through two main composables:

- **`useCallControls`** - Advanced call transfer and forwarding capabilities
- **`useDTMF`** - DTMF tone sending with intelligent queue management

Additionally, basic call controls (hold, mute, DTMF) are available directly on `CallSession` instances for simple use cases.

## Table of Contents

- [Hold/Unhold Functionality](#holdunhold-functionality)
- [Mute/Unmute Controls](#muteunmute-controls)
- [DTMF Tone Sending](#dtmf-tone-sending)
- [Call Transfer](#call-transfer)
- [Best Practices](#best-practices)

---

## Hold/Unhold Functionality

### What is Call Hold?

Call hold temporarily pauses the audio stream in both directions while keeping the call connected. This is useful when you need to:
- Look up information without the other party hearing background noise
- Consult with a colleague privately
- Switch between multiple calls
- Step away briefly during a call

**Technical Context**: When you put a call on hold, VueSip sends a SIP re-INVITE message to update the session, typically with `a=sendonly` or `a=inactive` in the SDP. The call remains established but audio stops flowing.

### Basic Hold/Unhold

The `CallSession` class provides `hold()` and `unhold()` methods for managing call hold state. Both methods are asynchronous because they require SIP negotiation with the remote party.

#### Putting a Call on Hold

```typescript
import { useSipClient } from 'vuesip'

const { currentCall } = useSipClient()

// Put the current call on hold
try {
  // This sends a SIP re-INVITE to negotiate hold
  await currentCall.value?.hold()
  console.log('Call placed on hold')

  // At this point:
  // - Audio is muted in both directions
  // - Call state changes to 'held'
  // - Remote party typically hears hold music (if configured on server)
} catch (error) {
  console.error('Failed to hold call:', error)
  // Hold can fail if network issues occur or if SIP negotiation fails
}
```

💡 **Tip**: Always await the `hold()` operation to ensure it completes before performing other actions like making a second call.

#### Resuming a Call from Hold

```typescript
// Resume call from hold
try {
  // This sends another SIP re-INVITE to reactivate audio
  await currentCall.value?.unhold()
  console.log('Call resumed')

  // At this point:
  // - Audio is restored in both directions
  // - Call state returns to 'active'
  // - You can speak with the remote party again
} catch (error) {
  console.error('Failed to unhold call:', error)
}
```

### Hold State Management

Monitoring hold state is essential for updating your UI and providing feedback to users. The call session maintains reactive hold state that you can watch.

```typescript
import { watch } from 'vue'

// Watch hold state changes for UI updates
watch(
  () => currentCall.value?.isOnHold,
  (isOnHold) => {
    if (isOnHold) {
      console.log('Call is now on hold')
      // Update UI to show hold state:
      // - Change button text to "Resume"
      // - Display hold icon
      // - Show hold duration timer
    } else {
      console.log('Call is active')
      // Update UI to show active state:
      // - Change button text to "Hold"
      // - Display active call icon
      // - Update call timer
    }
  }
)
```

### Understanding Call States During Hold

VueSip distinguishes between different hold scenarios to give you precise control over your UI.

**Local Hold vs Remote Hold:**
- **Local Hold**: You put the call on hold (state: `'held'`)
- **Remote Hold**: The other party put you on hold (state: `'remote_held'`)
- **Active**: Call is active with audio flowing (state: `'active'`)

```typescript
import { watch } from 'vue'

// Monitor call state changes to handle both local and remote hold
watch(
  () => currentCall.value?.state,
  (state) => {
    switch (state) {
      case 'held':
        console.log('You put the call on hold')
        // Show: "Call on Hold - Resume"
        // Enable: Resume button
        break

      case 'remote_held':
        console.log('Remote party put you on hold')
        // Show: "Other party has placed you on hold"
        // Disable: Hold button (already on hold)
        break

      case 'active':
        console.log('Call is active')
        // Show: Active call timer
        // Enable: Hold and Mute buttons
        break
    }
  }
)
```

📝 **Note**: Knowing whether hold is local or remote helps provide better user feedback. For example, you shouldn't allow the user to "unhold" a call that was put on hold by the remote party.

### Hold Timeout Protection

⚠️ **Important**: VueSip includes automatic timeout protection for hold operations (10 seconds by default). If a hold/unhold operation doesn't complete within the timeout period, the operation lock is automatically released to prevent the call from getting stuck in an intermediate state.

This protection ensures your application remains responsive even when:
- Network latency is high
- The remote SIP server is slow to respond
- SIP messages are lost or delayed

---

## Mute/Unmute Controls

### What is Mute?

Mute controls your local microphone without affecting the call connection. Unlike hold, which pauses audio in both directions:
- **Mute**: You can't be heard, but you can still hear the other party
- **Hold**: Neither party can hear each other

**Use Cases for Mute:**
- Coughing or sneezing during a call
- Speaking to someone in your office without the caller hearing
- Reducing background noise while listening
- Call center agents consulting notes while caller speaks

**Technical Context**: Mute is a local-only operation that controls the WebRTC audio track. No SIP signaling is required, making it instantaneous.

### Basic Mute/Unmute

The `CallSession` class provides synchronous `mute()` and `unmute()` methods for controlling local audio. These methods are synchronous because they only affect your local audio track.

#### Muting the Microphone

```typescript
import { useSipClient } from 'vuesip'

const { currentCall } = useSipClient()

// Mute the microphone (local operation, instant)
try {
  currentCall.value?.mute()
  console.log('Microphone muted')

  // At this point:
  // - Your audio track is disabled
  // - You can still hear the other party
  // - No network communication required
} catch (error) {
  console.error('Failed to mute:', error)
  // Mute rarely fails, but could if the audio track is not available
}
```

#### Unmuting the Microphone

```typescript
// Unmute the microphone
try {
  currentCall.value?.unmute()
  console.log('Microphone unmuted')

  // At this point:
  // - Your audio track is re-enabled
  // - The other party can hear you again
} catch (error) {
  console.error('Failed to unmute:', error)
}
```

💡 **Tip**: Mute/unmute operations are instant and don't require network communication, making them perfect for quick toggling during conversations.

### Mute State Management

Track mute state using the `isMuted` property for responsive UI updates:

```typescript
import { computed } from 'vue'

// Reactive mute state for UI binding
const isMuted = computed(() => currentCall.value?.isMuted ?? false)

// Toggle mute function for button clicks
function toggleMute() {
  if (!currentCall.value) return

  if (isMuted.value) {
    // Currently muted, so unmute
    currentCall.value.unmute()
  } else {
    // Currently unmuted, so mute
    currentCall.value.mute()
  }
}
```

### Mute Events

Listen for mute state changes to update your UI reactively. This is especially useful when multiple components need to know about mute state changes.

```typescript
import { useSipClient } from 'vuesip'

const { on } = useSipClient()

// Listen for mute events
on('call:muted', (event) => {
  console.log('Call muted:', event.session.id)
  // Update UI:
  // - Show mute icon
  // - Change button appearance
  // - Display "Microphone Off" indicator
})

on('call:unmuted', (event) => {
  console.log('Call unmuted:', event.session.id)
  // Update UI:
  // - Hide mute icon
  // - Restore button appearance
  // - Remove "Microphone Off" indicator
})
```

### Complete Mute Toggle Component

Here's a production-ready component demonstrating best practices for mute control:

```vue
<template>
  <button
    @click="toggleMute"
    :disabled="!hasActiveCall"
    :class="{ 'muted': isMuted }"
    :aria-label="isMuted ? 'Unmute microphone' : 'Mute microphone'"
  >
    {{ isMuted ? '🔇 Unmute' : '🔊 Mute' }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSipClient } from 'vuesip'

const { currentCall } = useSipClient()

// Only enable mute button when call is active
const hasActiveCall = computed(() =>
  currentCall.value?.state === 'active'
)

// Track current mute state
const isMuted = computed(() =>
  currentCall.value?.isMuted ?? false
)

// Toggle between muted and unmuted states
function toggleMute() {
  if (!currentCall.value) return

  if (isMuted.value) {
    currentCall.value.unmute()
  } else {
    currentCall.value.mute()
  }
}
</script>
```

✅ **Best Practice**: This component includes proper accessibility attributes (`aria-label`), disabled state management, and visual feedback for mute state.

---

## DTMF Tone Sending

### What is DTMF?

**DTMF (Dual-Tone Multi-Frequency)** is the technology behind touch-tone dialing. When you press a number on a phone keypad, it generates a specific combination of two frequencies that represent that digit.

**Common Use Cases:**
- **IVR Navigation**: Pressing numbers to navigate automated phone menus ("Press 1 for Sales...")
- **Authentication**: Entering PIN codes or account numbers during calls
- **Extension Dialing**: Dialing extensions after reaching a company's main line
- **Conference Controls**: Using keypad commands to mute/unmute in conferences

**Real-World Example**: When calling your bank, you might press your account number using DTMF tones, then navigate through menu options to check your balance.

VueSip provides two ways to send DTMF tones:
1. **Direct sending via `CallSession`** - Simple, immediate tone sending for basic use cases
2. **Advanced queue management via `useDTMF` composable** - Sophisticated queue management for complex scenarios

### Using CallSession for DTMF

The `CallSession` class provides a simple `sendDTMF()` method for straightforward tone sending:

```typescript
import { useSipClient } from 'vuesip'

const { currentCall } = useSipClient()

// Send single tone (e.g., navigating an IVR menu)
currentCall.value?.sendDTMF('1')

// Send sequence (e.g., entering a PIN code: 1234#)
currentCall.value?.sendDTMF('1234#')

// Send with custom options for different scenarios
currentCall.value?.sendDTMF('5', {
  duration: 100,              // Tone duration in milliseconds
  interToneGap: 70,           // Gap between tones in milliseconds
  transportType: 'RFC2833'    // Transport method: 'RFC2833' (in-band) or 'INFO' (out-of-band)
})
```

💡 **Tip**: For most use cases, the default options work well. Use `RFC2833` for better reliability and `INFO` only if your SIP server requires it.

### Using the useDTMF Composable

For advanced DTMF functionality with queue management, state tracking, and callbacks, use the `useDTMF` composable. This is ideal for building dialers, IVR interfaces, or any scenario requiring sophisticated tone management.

```typescript
import { ref } from 'vue'
import { useSipClient } from 'vuesip'
import { useDTMF } from 'vuesip/composables'

const { currentCall } = useSipClient()

// Initialize DTMF composable with comprehensive features
const {
  // Methods for sending tones
  sendTone,              // Send a single tone immediately
  sendToneSequence,      // Send multiple tones in sequence
  queueTone,            // Add tone to queue for later sending
  queueToneSequence,    // Add multiple tones to queue
  processQueue,         // Process all queued tones
  clearQueue,           // Clear the queue without sending

  // Reactive state
  isSending,            // Currently sending tones?
  queuedTones,          // Array of tones waiting in queue
  lastSentTone,         // Most recently sent tone
  tonesSentCount        // Total count of tones sent
} = useDTMF(currentCall)
```

### Sending Individual Tones

Send tones immediately with full control over timing and transport:

```typescript
// Send a single tone immediately (e.g., pressing "5" in a menu)
try {
  await sendTone('5')
  console.log('Tone sent successfully')
  // The tone has been sent and acknowledged
} catch (error) {
  console.error('Failed to send tone:', error)
  // Handle failure (e.g., network issue, call ended)
}

// Send with custom duration for special requirements
await sendTone('9', {
  duration: 150,           // Longer duration for older IVR systems
  transport: 'RFC2833'     // In-band signaling (most reliable)
})
```

### Sending Tone Sequences

Send multiple tones in sequence with callbacks for progress tracking:

```typescript
// Send a sequence of tones (e.g., entering account number: 1234#)
await sendToneSequence('1234#', {
  duration: 100,              // Each tone plays for 100ms
  interToneGap: 70,          // 70ms pause between tones

  // Callback after each tone is sent (useful for UI updates)
  onToneSent: (tone) => {
    console.log(`Sent: ${tone}`)
    // Update display: "Sending: 1234#"
    //                           ^
  },

  // Callback when entire sequence completes
  onComplete: () => {
    console.log('Sequence complete')
    // Show success message: "Account number entered"
  },

  // Callback if any tone fails
  onError: (error, tone) => {
    console.error(`Failed to send ${tone}:`, error)
    // Show error: "Failed to enter digit. Please try again."
  }
})
```

📝 **Note**: The callbacks allow you to provide real-time feedback to users, which is especially important for long sequences like account numbers or PIN codes.

### Queue Management

Queue management is powerful for scenarios where tones need to be collected and sent as a batch, or when you want to allow rapid input without waiting for each tone to complete.

**Why Use Queues?**
- **Rapid Input**: Users can type quickly without waiting for each tone to send
- **Batch Processing**: Collect all tones then send when ready (e.g., "dial" button)
- **Smoother UX**: No blocking while users enter information

```typescript
// Build up a queue of tones (user typing rapidly on dialpad)
queueTone('1')    // User presses 1
queueTone('2')    // User presses 2
queueTone('3')    // User presses 3

// Queue a sequence (e.g., area code)
queueToneSequence('456#')

// Check queue status before sending
console.log('Queue size:', queueSize.value)         // 7 tones waiting
console.log('Queued tones:', queuedTones.value)    // ['1','2','3','4','5','6','#']

// Process the entire queue when user clicks "Send"
await processQueue({
  duration: 100,          // Standard tone duration
  interToneGap: 70,      // Standard gap between tones

  onComplete: () => {
    console.log('Queue processed')
    // Show: "Number dialed successfully"
  }
})

// Clear the queue if user cancels (e.g., clicks "Clear" button)
clearQueue()
console.log('Queue cleared')  // User started over
```

💡 **Tip**: Queue management is perfect for building dialers where users enter a full number before dialing, just like a traditional phone.

### DTMF State Tracking

Monitor DTMF operations to provide responsive feedback:

```typescript
import { watch } from 'vue'

// Monitor sending state for UI feedback
watch(isSending, (sending) => {
  if (sending) {
    console.log('Sending DTMF...')
    // Show: Loading spinner or "Sending..." indicator
    // Disable: Dialpad buttons (prevent overlapping sends)
  } else {
    console.log('DTMF idle')
    // Hide: Loading indicator
    // Enable: Dialpad buttons (ready for next input)
  }
})

// Track total tones sent for analytics or debugging
watch(tonesSentCount, (count) => {
  console.log(`Total tones sent: ${count}`)
  // Analytics: Track user interaction patterns
  // Debug: Verify expected number of tones sent
})

// Monitor last sent tone for display feedback
watch(lastSentTone, (tone) => {
  if (tone) {
    console.log(`Last tone: ${tone}`)
    // Display: Show last pressed key with visual feedback
    // Accessibility: Announce tone to screen readers
  }
})
```

### Valid DTMF Tones

VueSip supports all standard DTMF tones used in telephony:

- **Digits**: `0-9` (standard number keys)
- **Symbols**: `*` (star/asterisk), `#` (hash/pound)
- **Letters**: `A`, `B`, `C`, `D` (extended DTMF, used in some military and specialized applications)

⚠️ **Warning**: While VueSip supports extended DTMF tones (A, B, C, D), many IVR systems only recognize 0-9, *, and #. Test with your specific SIP server before using extended tones in production.

### Queue Size Limits

The DTMF queue has a maximum size limit (default: 1000 tones) to prevent unbounded memory growth. When the limit is reached, the oldest tones are automatically dropped (FIFO - First In, First Out).

📝 **Note**: A queue of 1000 tones is enormous in practice (imagine pressing 1000 keys!). This limit primarily protects against programming errors or infinite loops that might continuously queue tones.

### Complete DTMF Dialer Component

Here's a production-ready dialer component demonstrating best practices:

```vue
<template>
  <div class="dtmf-dialer">
    <!-- Display area showing entered digits -->
    <div class="display">{{ display }}</div>

    <!-- Keypad grid with all standard DTMF keys -->
    <div class="keypad">
      <button
        v-for="key in keys"
        :key="key"
        @click="dialTone(key)"
        :disabled="!canDial"
        :aria-label="`Dial ${key}`"
      >
        {{ key }}
      </button>
    </div>

    <!-- Status area showing operation feedback -->
    <div class="status">
      <span v-if="isSending">Sending...</span>
      <span v-else>Tones sent: {{ tonesSentCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient } from 'vuesip'
import { useDTMF } from 'vuesip/composables'

const { currentCall } = useSipClient()

const {
  sendTone,
  isSending,
  tonesSentCount
} = useDTMF(currentCall)

// Standard phone keypad layout
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

// Track entered digits for display
const display = ref('')

// Only allow dialing when call is active and not currently sending
const canDial = computed(() =>
  currentCall.value?.state === 'active' && !isSending.value
)

async function dialTone(tone: string) {
  // Add to display immediately for instant feedback
  display.value += tone

  try {
    // Send the tone to the remote party
    await sendTone(tone, {
      duration: 100,           // Standard duration
      transport: 'RFC2833'     // Reliable in-band signaling
    })
  } catch (error) {
    console.error('Failed to send tone:', error)
    // In production, show user-friendly error message
  }

  // Clear display after 2 seconds for better UX
  setTimeout(() => {
    display.value = ''
  }, 2000)
}
</script>
```

✅ **Best Practice**: This component provides immediate visual feedback (display updates instantly), proper state management (disabled during sending), and accessibility support (aria-labels).

---

## Call Transfer

### What is Call Transfer?

Call transfer allows you to redirect an active call to another party. This is essential for:
- **Reception/Routing**: Directing calls to the appropriate department
- **Escalation**: Moving calls to supervisors or specialists
- **Consultation**: Asking a colleague for help with a customer's question
- **Handoff**: Passing a customer between service representatives

VueSip supports two types of call transfer, each suited to different scenarios:

1. **Blind Transfer (Direct Transfer)** - Transfer immediately without consultation
   - **Use Case**: Reception transferring to a known extension
   - **Example**: "Let me transfer you to the sales department"
   - **Behavior**: Original call ends immediately when transfer is initiated

2. **Attended Transfer (Consultative Transfer)** - Transfer after speaking with the target
   - **Use Case**: Making sure the target can help before transferring
   - **Example**: "Let me check if they're available..." (calls target, confirms, completes transfer)
   - **Behavior**: Original call placed on hold while you consult, then connected

**Technical Context**: VueSip uses the SIP REFER method for transfers. Attended transfers use the Replaces header to connect the two calls together.

### Using the useCallControls Composable

The `useCallControls` composable provides comprehensive transfer management:

```typescript
import { ref } from 'vue'
import { useSipClient } from 'vuesip'
import { useCallControls } from 'vuesip/composables'

const { sipClient } = useSipClient()

const {
  // Reactive State
  activeTransfer,        // Current transfer details (type, state, call IDs)
  transferState,         // Current state: 'idle' | 'initiated' | 'in_progress' | 'completed' | 'failed' | 'canceled'
  isTransferring,        // Boolean: Is a transfer currently in progress?
  consultationCall,      // The consultation call session (for attended transfers)

  // Transfer Methods
  blindTransfer,               // Perform immediate transfer without consultation
  initiateAttendedTransfer,    // Start attended transfer (creates consultation call)
  completeAttendedTransfer,    // Complete attended transfer (connect the two parties)
  cancelTransfer,              // Cancel transfer (resume original call)
  forwardCall,                 // Forward incoming call before answering

  // Utility Methods
  getTransferProgress,   // Get detailed progress information
  onTransferEvent       // Subscribe to transfer events
} = useCallControls(sipClient)
```

### Blind Transfer

Blind transfer immediately redirects the call to another party without consultation. Use this when you're confident the target can handle the call.

**Real-World Scenario**: A receptionist receives a call asking for the sales department. They know the sales extension is available, so they perform a blind transfer.

```typescript
// Perform blind transfer to known extension
try {
  await blindTransfer(
    'call-123',                      // ID of call to transfer
    'sip:sales@example.com'         // Target SIP URI (sales department)
  )
  console.log('Blind transfer initiated')

  // At this point:
  // - Original call is transferred
  // - You are disconnected from the call
  // - Caller is now ringing the target

} catch (error) {
  console.error('Transfer failed:', error)
  // Transfer can fail if:
  // - Target URI is invalid
  // - Network error occurs
  // - SIP server rejects the transfer
}

// Blind transfer with custom SIP headers for advanced scenarios
await blindTransfer(
  'call-123',
  'sip:support@example.com',
  ['X-Transfer-Reason: Customer request',  // Custom header for logging
   'X-Transfer-From: Reception']           // Custom header for tracking
)
```

💡 **Tip**: Blind transfer is faster and simpler, but use it only when you're certain the target can help. There's no way to take the call back if the target doesn't answer.

### Attended Transfer

Attended transfer (also called consultative transfer) allows you to speak with the transfer target before completing the transfer. This provides a better customer experience and ensures the target can help.

**Real-World Scenario**: A support agent receives a technical question they can't answer. They perform an attended transfer:
1. Put customer on hold
2. Call the technical specialist
3. Explain the situation: "I have a customer with a database question..."
4. Either complete transfer ("I'm connecting you now") or cancel ("Sorry, they're not available")

#### Step 1: Initiate Attended Transfer

```typescript
// Start attended transfer (original call is automatically placed on hold)
try {
  const consultationCallId = await initiateAttendedTransfer(
    'call-123',                      // Original call ID (customer)
    'sip:specialist@example.com'    // Target to consult with (colleague)
  )

  console.log('Consultation call started:', consultationCallId)
  console.log('Original call on hold:', activeTransfer.value?.callId)

  // At this point:
  // - Original call (customer) is on hold
  // - You're now in a new call with the target (colleague)
  // - You can explain the situation before completing transfer
  // - Customer cannot hear your consultation

} catch (error) {
  console.error('Failed to initiate transfer:', error)
  // If initiation fails:
  // - Original call remains active (not on hold)
  // - No consultation call is created
  // - You can continue speaking with original caller
}
```

#### Step 2: Complete or Cancel Transfer

After consulting with the target, you have two options:

```typescript
// Option 1: Complete the transfer (connect customer to specialist)
try {
  await completeAttendedTransfer()
  console.log('Transfer completed')

  // At this point:
  // - Customer is connected to specialist
  // - You are disconnected from both calls
  // - Customer and specialist can now speak directly

} catch (error) {
  console.error('Failed to complete transfer:', error)
  // If completion fails, both calls may still be active
  // You may need to manually cancel the transfer
}

// Option 2: Cancel the transfer (if specialist can't help or doesn't answer)
try {
  await cancelTransfer()
  console.log('Transfer cancelled, original call resumed')

  // At this point:
  // - Consultation call is hung up (specialist disconnected)
  // - Original call is taken off hold
  // - You're back speaking with the customer
  // - You can explain and try a different solution

} catch (error) {
  console.error('Failed to cancel transfer:', error)
}
```

✅ **Best Practice**: Always provide UI controls for both "Complete Transfer" and "Cancel Transfer" during the consultation phase. The agent needs flexibility to handle different scenarios.

### Call Forwarding

Call forwarding allows you to redirect an incoming call to another destination before you answer it. This is different from transfer (which works on active calls).

**Real-World Scenario**: You're away from your desk, and calls should go to your mobile phone or voicemail.

```typescript
// Forward incoming call to voicemail (before answering)
await forwardCall(
  'call-456',                      // Incoming call ID
  'sip:voicemail@example.com'     // Forward destination
)

// At this point:
// - The incoming call is redirected to voicemail
// - You never answered the call
// - The caller doesn't know the call was forwarded
```

📝 **Note**: Call forwarding happens before answering, while transfer happens during an active call. Use forwarding for Do Not Disturb scenarios or automatic routing.

### Transfer State Management

Monitor transfer state to provide appropriate UI feedback throughout the transfer process:

```typescript
import { watch } from 'vue'

// Watch transfer state for comprehensive UI updates
watch(transferState, (state) => {
  switch (state) {
    case 'idle':
      console.log('No active transfer')
      // UI: Show "Transfer" button (enabled)
      break

    case 'initiated':
      console.log('Transfer initiated')
      // UI: Show "Transfer in progress..." message
      // UI: Disable other call controls during transfer
      break

    case 'in_progress':
      console.log('Transfer in progress')
      // UI: For attended transfer, show consultation controls
      // UI: Display "Complete Transfer" and "Cancel" buttons
      break

    case 'completed':
      console.log('Transfer completed')
      // UI: Show success message: "Call transferred successfully"
      // UI: Clear transfer UI and return to call list
      break

    case 'failed':
      console.log('Transfer failed')
      // UI: Show error message: "Transfer failed. Please try again."
      // UI: Re-enable transfer button for retry
      break

    case 'canceled':
      console.log('Transfer canceled')
      // UI: Show message: "Transfer canceled. Call resumed."
      // UI: Return to active call state
      break
  }
})

// Check if any transfer is in progress (simpler boolean check)
if (isTransferring.value) {
  console.log('Transfer currently active')
  // Disable other operations that conflict with transfer
}

// Get detailed transfer progress for advanced UI
const progress = getTransferProgress()
if (progress) {
  console.log(`Transfer: ${progress.progress}% complete`)
  console.log(`State: ${progress.state}`)
  console.log(`Type: ${progress.type}`)  // 'blind' or 'attended'

  // Use progress for progress bar or detailed status display
}
```

### Transfer Events

Subscribe to transfer events for real-time notifications across your application:

```typescript
// Subscribe to transfer events (useful for logging, analytics, or UI updates)
const unsubscribe = onTransferEvent((event) => {
  console.log('Transfer event:', event.type)      // Event type
  console.log('Transfer ID:', event.transferId)   // Unique transfer ID
  console.log('State:', event.state)              // Current state
  console.log('Target:', event.target)            // Transfer target URI

  if (event.error) {
    console.error('Transfer error:', event.error)
    // Log error for debugging or analytics
    // Show user-friendly error message
  }

  // Example: Update global notification system
  if (event.state === 'completed') {
    showNotification('Transfer completed successfully')
  }
})

// Unsubscribe when component unmounts to prevent memory leaks
onUnmounted(() => {
  unsubscribe()
})
```

💡 **Tip**: Transfer events are useful for updating multiple UI components, logging transfer activity, or integrating with analytics systems.

### Complete Transfer Component

Here's a production-ready transfer component demonstrating best practices:

```vue
<template>
  <div class="transfer-controls">
    <!-- Initial State: Transfer Type Selection -->
    <div v-if="!isTransferring" class="transfer-input">
      <!-- Target URI input with validation feedback -->
      <input
        v-model="targetUri"
        placeholder="sip:extension@example.com"
        :disabled="!hasActiveCall"
        aria-label="Transfer target"
        @keyup.enter="startBlindTransfer"
      />

      <!-- Blind transfer button for quick transfers -->
      <button
        @click="startBlindTransfer"
        :disabled="!canTransfer"
        title="Transfer immediately without consultation"
      >
        Blind Transfer
      </button>

      <!-- Attended transfer button for consultative transfers -->
      <button
        @click="startAttendedTransfer"
        :disabled="!canTransfer"
        title="Consult with target before completing transfer"
      >
        Attended Transfer
      </button>
    </div>

    <!-- Transfer In Progress: Status and Controls -->
    <div v-else class="transfer-status">
      <p>Transfer in progress...</p>
      <p>State: {{ transferState }}</p>

      <!-- Show progress if available -->
      <p v-if="progress">Progress: {{ progress.progress }}%</p>

      <!-- Attended Transfer Controls (only shown during consultation) -->
      <div v-if="activeTransfer?.type === 'attended'" class="consultation-controls">
        <p>Consulting with target...</p>
        <p class="hint">The original caller is on hold</p>

        <!-- Complete button to connect the two parties -->
        <button
          @click="completeTransfer"
          class="primary"
          title="Connect the caller to the transfer target"
        >
          Complete Transfer
        </button>

        <!-- Cancel button to resume original call -->
        <button
          @click="cancelTransferAction"
          class="secondary"
          title="End consultation and resume original call"
        >
          Cancel Transfer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient } from 'vuesip'
import { useCallControls } from 'vuesip/composables'

const { sipClient, currentCall } = useSipClient()

const {
  activeTransfer,
  transferState,
  isTransferring,
  blindTransfer,
  initiateAttendedTransfer,
  completeAttendedTransfer,
  cancelTransfer,
  getTransferProgress
} = useCallControls(sipClient)

// Target URI input binding
const targetUri = ref('')

// Only allow transfer when call is active
const hasActiveCall = computed(() =>
  currentCall.value?.state === 'active'
)

// Enable transfer button when all conditions are met
const canTransfer = computed(() =>
  hasActiveCall.value &&           // Must have active call
  targetUri.value.length > 0 &&   // Must have target URI
  !isTransferring.value            // No transfer already in progress
)

// Get current transfer progress for display
const progress = computed(() => getTransferProgress())

// Initiate blind transfer
async function startBlindTransfer() {
  if (!currentCall.value) return

  try {
    // Perform blind transfer
    await blindTransfer(currentCall.value.id, targetUri.value)

    // Clear input on success
    targetUri.value = ''
  } catch (error) {
    console.error('Blind transfer failed:', error)
    // In production, show user-friendly error message
  }
}

// Initiate attended transfer with consultation
async function startAttendedTransfer() {
  if (!currentCall.value) return

  try {
    // Initiate attended transfer (creates consultation call)
    await initiateAttendedTransfer(currentCall.value.id, targetUri.value)

    // Clear input on success
    targetUri.value = ''
  } catch (error) {
    console.error('Attended transfer failed:', error)
    // In production, show user-friendly error message
  }
}

// Complete the attended transfer (connect the two parties)
async function completeTransfer() {
  try {
    await completeAttendedTransfer()
  } catch (error) {
    console.error('Failed to complete transfer:', error)
    // In production, show error and provide retry option
  }
}

// Cancel the attended transfer (resume original call)
async function cancelTransferAction() {
  try {
    await cancelTransfer()
  } catch (error) {
    console.error('Failed to cancel transfer:', error)
    // In production, may need manual intervention
  }
}
</script>
```

✅ **Best Practice**: This component provides clear visual feedback at every stage, disables controls appropriately, and includes helpful hints for users during attended transfers.

---

## Best Practices

### Hold/Unhold

#### ✅ Always Check Call State Before Holding

```typescript
// Good: Check state first to prevent errors
if (currentCall.value?.state === 'active') {
  await currentCall.value.hold()
}

// Bad: Attempting to hold without checking state
await currentCall.value?.hold()  // May fail if call is not active
```

**Why**: Attempting to hold a call that isn't active (e.g., already held, ended, or ringing) will fail. Checking state first prevents errors and provides better UX.

#### ✅ Handle Hold/Unhold Errors Gracefully

```typescript
// Good: Graceful error handling with user feedback
try {
  await currentCall.value?.hold()
} catch (error) {
  console.error('Hold failed:', error)
  // Show user-friendly error message
  showNotification('Unable to hold call. Please try again.')
}

// Bad: No error handling
await currentCall.value?.hold()  // Silent failure confuses users
```

**Why**: Hold operations can fail due to network issues or SIP negotiation problems. Users need to know when operations fail so they can retry or take alternative action.

#### ✅ Don't Hold Already Held Calls

```typescript
// Good: Check hold state before holding
if (!currentCall.value?.isOnHold) {
  await currentCall.value?.hold()
}

// Bad: Holding without checking current state
await currentCall.value?.hold()  // Redundant if already held
```

**Why**: Attempting to hold an already held call wastes network resources and may confuse state management. Always check `isOnHold` first.

⚠️ **Warning**: Remember that `isOnHold` only indicates LOCAL hold state. If the remote party has put you on hold (`remote_held` state), `isOnHold` will be false.

### Mute/Unmute

#### ✅ Provide Clear Visual Feedback for Mute State

```typescript
// Good: Clear visual indicators for mute state
const muteIcon = computed(() =>
  isMuted.value ? '🔇' : '🔊'
)
const muteColor = computed(() =>
  isMuted.value ? 'red' : 'green'
)
```

**Why**: Users must always know if their microphone is muted. Unclear mute state leads to awkward situations where users speak while muted or are heard when they expect privacy.

💡 **Tip**: Use multiple visual cues (icon, color, text) to ensure mute state is unmistakable, especially in video conferencing or call center applications.

#### ✅ Prevent Double Muting/Unmuting

```typescript
// Good: Check state before muting
if (!currentCall.value?.isMuted) {
  currentCall.value?.mute()
}

// Good: Toggle pattern automatically prevents double operations
function toggleMute() {
  if (isMuted.value) {
    unmute()
  } else {
    mute()
  }
}
```

**Why**: While mute operations are idempotent (muting twice doesn't cause errors), checking state first is more efficient and makes your code more predictable.

#### ✅ Consider Push-to-Talk Scenarios

```typescript
// Good: Push-to-talk implementation (hold Space to speak)
function handleKeyDown(event: KeyboardEvent) {
  if (event.code === 'Space') {
    currentCall.value?.unmute()
    // Visual feedback: Show "Talking" indicator
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    currentCall.value?.mute()
    // Visual feedback: Hide "Talking" indicator
  }
}
```

**Why**: Push-to-talk is essential in noisy environments (warehouses, factories, outdoor work) where keeping the mic muted by default reduces background noise.

💡 **Tip**: In push-to-talk mode, start calls muted by default and clearly indicate users must press and hold to speak.

### DTMF

#### ✅ Validate Tone Input

```typescript
// Good: Validate tones before sending
const validTones = /^[0-9*#A-D]+$/i

function validateTone(tone: string): boolean {
  return validTones.test(tone)
}

// Use validation before sending
if (validateTone(userInput)) {
  await sendTone(userInput)
} else {
  showError('Invalid DTMF tone. Use 0-9, *, #, or A-D.')
}
```

**Why**: Invalid tones cause sending errors. Validating input client-side provides instant feedback and prevents unnecessary network traffic.

#### ✅ Use Appropriate Transport Method

```typescript
// Good: Use RFC2833 (in-band) for reliability
await sendTone('1', { transport: 'RFC2833' })

// Alternative: Use INFO (out-of-band) for compatibility
await sendTone('2', { transport: 'INFO' })
```

**Why RFC2833 is better**:
- More reliable (tones are embedded in audio stream)
- Works through NAT and firewalls more easily
- Standard method used by most modern SIP systems
- Real-time delivery with the audio

**When to use INFO**:
- Legacy SIP servers that don't support RFC2833
- Networks with audio codec restrictions
- Explicit requirement from your SIP provider

💡 **Tip**: Test both methods with your SIP server. Most modern systems prefer RFC2833, but some older systems only support INFO.

#### ✅ Provide Audio Feedback

```typescript
// Good: Play local tone sound for immediate feedback
async function sendToneWithFeedback(tone: string) {
  // Play local tone audio immediately (instant user feedback)
  playDTMFSound(tone)

  // Send to remote party (may have slight network delay)
  await sendTone(tone)
}
```

**Why**: Local audio feedback provides instant confirmation to the user, even if network latency delays the actual tone sending. This matches the behavior of traditional phones.

#### ✅ Use Queue for Rapid Input

```typescript
// Good: Queue tones for smooth dialing experience
function dialNumber(number: string) {
  // Add all tones to queue (instant, no waiting)
  queueToneSequence(number)

  // Process queue with appropriate timing
  processQueue({
    duration: 100,
    interToneGap: 70
  })
}

// Bad: Sending tones synchronously (slow, blocks UI)
async function dialNumberSlow(number: string) {
  for (const digit of number) {
    await sendTone(digit)  // Each tone blocks until complete
  }
}
```

**Why**: Queueing allows users to type rapidly without waiting, then processes tones with proper timing. This provides a much smoother experience than blocking on each tone.

### Call Transfer

#### ✅ Always Validate Transfer Target

```typescript
// Good: Validate SIP URI before transferring
function isValidSipUri(uri: string): boolean {
  // Regex matches sip: or sips: URIs
  return /^sips?:[\w\-.!~*'()&=+$,;?/]+@[\w\-.]+/.test(uri)
}

// Use before transfer
if (!isValidSipUri(targetUri)) {
  showError('Invalid transfer target. Please use format: sip:user@domain')
  return
}

await blindTransfer(callId, targetUri)
```

**Why**: Invalid SIP URIs cause transfer failures. Client-side validation provides instant feedback and prevents wasted network requests.

📝 **Note**: This regex is a basic check. For production, consider also validating domain names, checking for required extensions, or consulting your organization's numbering plan.

#### ✅ Handle Transfer Failures Gracefully

```typescript
// Good: Comprehensive error handling with recovery
try {
  await blindTransfer(callId, targetUri)
} catch (error) {
  console.error('Transfer failed:', error)

  // Notify user with actionable information
  showNotification('Transfer failed. Call maintained. Please try again or use a different extension.')

  // Original call should still be active
  // User can retry transfer or continue conversation
}
```

**Why**: Transfer failures should not disconnect the original call. Users need to know the transfer failed and have the opportunity to retry or try a different approach.

⚠️ **Warning**: If a blind transfer fails, you may have already ended your connection to the call. Test your SIP server's behavior to understand whether you remain connected on failure.

#### ✅ Provide Clear UI During Attended Transfer

```typescript
// Good: Show both calls clearly during consultation
if (activeTransfer.value?.type === 'attended') {
  // Display original call status
  showCallCard({
    label: 'Original Call (On Hold)',
    caller: originalCaller,
    duration: originalCallDuration,
    status: 'held'
  })

  // Display consultation call status
  showCallCard({
    label: 'Consultation Call (Active)',
    caller: transferTarget,
    duration: consultationDuration,
    status: 'active'
  })

  // Show clear action buttons
  showButtons([
    { label: 'Complete Transfer', action: completeTransfer },
    { label: 'Cancel Transfer', action: cancelTransfer }
  ])
}
```

**Why**: During attended transfers, users are managing two calls simultaneously. Clear UI prevents confusion about which call is which and what actions are available.

💡 **Tip**: Include visual indicators like "ON HOLD" badges, color coding, or icons to differentiate between the held original call and the active consultation call.

#### ✅ Monitor Transfer Progress

```typescript
// Good: Watch for transfer failures and recover automatically
watch(transferState, (state) => {
  if (state === 'failed') {
    console.error('Transfer failed')

    // Automatically resume original call if it was held
    if (currentCall.value?.isOnHold) {
      currentCall.value.unhold()
    }

    // Notify user
    showNotification('Transfer failed. Resuming original call.')
  }
})
```

**Why**: Automatic recovery from transfer failures provides better UX. Users don't want to manually check if the call is still on hold after a failed transfer.

#### ✅ Clean Up After Transfer

```typescript
// Good: Handle transfer completion with full cleanup
watch(transferState, (state) => {
  if (state === 'completed') {
    // Clear transfer UI state
    clearTransferUI()

    // Update call list (transferred call is now ended for you)
    refreshCallList()

    // Show success notification
    showNotification('Transfer completed successfully')

    // Log transfer for analytics/auditing
    logTransfer({
      callId: activeTransfer.value?.callId,
      target: activeTransfer.value?.target,
      type: activeTransfer.value?.type,
      timestamp: new Date()
    })
  }
})
```

**Why**: Proper cleanup after transfer ensures your UI accurately reflects the current state and provides closure to the user. Logging transfers is important for analytics and compliance.

### General Guidelines

#### ✅ Only Perform Operations on Active Calls

```typescript
// Good: Check call state before operations
const canPerformAction = computed(() =>
  currentCall.value?.state === 'active'
)

// Use in UI
<button :disabled="!canPerformAction" @click="holdCall">
  Hold
</button>
```

**Why**: Most call control operations (hold, transfer, DTMF) only work on active calls. Attempting operations on non-active calls leads to errors and confused users.

#### ✅ Prevent Concurrent Operations

```typescript
// Good: Check for ongoing operations before starting new ones
async function transferCall(target: string) {
  // Don't start transfer if another operation is in progress
  if (isTransferring.value || isSending.value) {
    showNotification('Please wait for current operation to complete')
    return
  }

  await blindTransfer(currentCall.value.id, target)
}
```

**Why**: Concurrent operations can cause state conflicts. For example, sending DTMF during a transfer operation may fail or cause unpredictable behavior.

#### ✅ Provide User Feedback

```typescript
// Good: Show operation status at every stage
async function holdCall() {
  try {
    // Show loading state immediately
    showLoading('Holding call...')

    // Perform operation
    await currentCall.value?.hold()

    // Show success
    showSuccess('Call placed on hold')

  } catch (error) {
    // Show error
    showError('Failed to hold call. Please try again.')

  } finally {
    // Hide loading state
    hideLoading()
  }
}
```

**Why**: Users need to know what's happening, especially during operations with network latency. Loading states, success messages, and error messages provide essential feedback.

💡 **Tip**: Use different notification styles (info, success, error) and durations based on the message importance and type.

#### ✅ Handle Edge Cases

```typescript
// Good: Comprehensive edge case handling
async function performCallOperation() {
  // Check if SIP client is initialized
  if (!sipClient.value) {
    showError('SIP client not connected')
    return
  }

  // Check if call still exists
  if (!currentCall.value) {
    showError('No active call')
    return
  }

  // Check if call is in correct state
  if (currentCall.value.state !== 'active') {
    showError('Call must be active to perform this operation')
    return
  }

  // Prevent rapid double-clicks
  if (operationInProgress.value) {
    return  // Silently ignore duplicate clicks
  }

  operationInProgress.value = true

  try {
    // Perform operation with timeout
    await performOperation()
  } catch (error) {
    if (error.message.includes('network')) {
      showError('Network connection lost')
    } else {
      showError('Operation failed')
    }
  } finally {
    operationInProgress.value = false
  }
}
```

**Why**: Real-world applications face many edge cases:
- Network disconnections during operations
- Calls ending while operations are in progress
- Rapid button clicks causing duplicate operations
- SIP client disconnecting unexpectedly

Handling these cases gracefully prevents errors and frustrated users.

#### ✅ Test with Real SIP Servers

```typescript
// Good: Document server-specific behavior
/**
 * Transfer implementation notes:
 *
 * - Asterisk: Blind transfers work with REFER
 * - FreeSWITCH: Requires Replaces header for attended transfers
 * - 3CX: DTMF works best with RFC2833 transport
 *
 * Test checklist:
 * - [ ] Blind transfer to extension
 * - [ ] Blind transfer to external number
 * - [ ] Attended transfer with consultation
 * - [ ] Attended transfer cancellation
 * - [ ] DTMF with both RFC2833 and INFO
 * - [ ] Hold timeout recovery
 */
```

**Why**: Different SIP server implementations have subtle variations in behavior. Testing with your actual SIP infrastructure is essential:
- Asterisk may handle transfers differently than FreeSWITCH
- Some servers require specific headers
- DTMF transport support varies
- Attended transfer mechanics differ between servers

📝 **Note**: Always test with your production SIP server before deploying. Behavior that works in development may differ in production.

---

## Summary

VueSip provides comprehensive call control features that enable you to build professional-grade VoIP applications:

### Core Features

- **Hold/Unhold**: Async methods with automatic timeout protection and state management
  - ✅ Distinguishes between local and remote hold
  - ✅ Prevents stuck states with timeout protection
  - ✅ Reactive state tracking with `isOnHold`

- **Mute/Unmute**: Synchronous local audio control with instant feedback
  - ✅ No network latency (local-only operation)
  - ✅ Event-driven state updates
  - ✅ Perfect for rapid toggling

- **DTMF**: Flexible tone sending with queue management for complex scenarios
  - ✅ Simple API for basic use cases
  - ✅ Advanced queue management for complex dialers
  - ✅ Both RFC2833 (in-band) and INFO (out-of-band) transport
  - ✅ State tracking and callbacks

- **Call Transfer**: Both blind and attended transfer with consultation support
  - ✅ Blind transfer for quick routing
  - ✅ Attended transfer for consultative scenarios
  - ✅ Comprehensive state management
  - ✅ Progress tracking and events

### Key Benefits

All features include:
- **Type Safety**: Full TypeScript interfaces and type checking
- **Reactive State**: Vue 3 composable API with reactive state management
- **Event-Driven**: Subscribe to events for loose coupling
- **Error Handling**: Comprehensive error handling and recovery
- **Best Practices**: Production-ready examples and patterns
- **Real-World Ready**: Tested with major SIP servers

### Next Steps

Now that you understand call controls, explore these related topics:

- **[API Reference](/api/)** - Detailed API documentation for all methods and properties
- **[SIP Client Guide](/guide/sip-client)** - Learn about the core SIP client setup
- **[Conference Guide](/guide/conferences)** - Build multi-party conference calls
- **[Examples Repository](https://github.com/yourusername/vuesip-examples)** - Complete working examples

💡 **Tip**: Start with basic controls (hold, mute) in your application, then add advanced features (transfer, DTMF queuing) as your requirements grow.
