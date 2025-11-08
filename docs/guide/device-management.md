# Device Management Guide

This guide covers comprehensive device management in VueSip, including device enumeration, selection, permission handling, and testing. Master these techniques to build professional audio/video applications with robust device support.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Device Enumeration](#device-enumeration)
- [Device Selection](#device-selection)
- [Permission Handling](#permission-handling)
- [Device Testing](#device-testing)
- [Device Change Monitoring](#device-change-monitoring)
- [Best Practices](#best-practices)
- [Complete Examples](#complete-examples)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Overview

### What is Device Management?

Device management is the foundation of any WebRTC application. Before users can make calls or participate in conferences, your application needs to:

1. **Discover** what audio/video devices are available (microphones, speakers, cameras)
2. **Request permission** to access these devices (browser security requirement)
3. **Let users select** their preferred devices
4. **Test devices** to ensure they work before calls
5. **Monitor changes** when devices are plugged in or unplugged

VueSip's `useMediaDevices` composable handles all these concerns automatically, providing a reactive, Vue-friendly interface to WebRTC's MediaDevices API.

### Core Capabilities

VueSip provides powerful device management capabilities through the `useMediaDevices` composable:

- ✅ **Reactive device lists**: Automatically updated when devices change
- ✅ **Device enumeration**: List all available audio/video devices
- ✅ **Device selection**: Select specific devices for input/output
- ✅ **Permission management**: Request and track media permissions
- ✅ **Device testing**: Test devices before use
- ✅ **Change monitoring**: Automatically detect device changes (plug/unplug)

### Key Components

Understanding VueSip's device management architecture:

- **`useMediaDevices`** - Vue composable that provides reactive device state and methods
- **`deviceStore`** - Internal reactive store that maintains device state across your application
- **`MediaManager`** - Core engine that interfaces with browser APIs and manages media streams

💡 **Tip**: In most cases, you'll only interact with `useMediaDevices`. The other components work behind the scenes.

## Getting Started

### Basic Setup

The simplest way to start managing devices is to import and use the `useMediaDevices` composable. Here's what you get out of the box:

```typescript
import { useMediaDevices } from 'vuesip'

const {
  // 📋 Device lists (automatically populated and kept up-to-date)
  audioInputDevices,      // Array of microphones
  audioOutputDevices,     // Array of speakers/headphones
  videoInputDevices,      // Array of cameras

  // 🎯 Currently selected devices (reactive refs)
  selectedAudioInputId,   // ID of selected microphone
  selectedAudioOutputId,  // ID of selected speaker
  selectedVideoInputId,   // ID of selected camera

  // 🔐 Permission states (reactive computed refs)
  hasAudioPermission,     // Boolean: true if user granted mic access
  hasVideoPermission,     // Boolean: true if user granted camera access

  // 🛠️ Methods to interact with devices
  enumerateDevices,       // Refresh the device list
  requestPermissions,     // Ask user for device permissions
  selectAudioInput,       // Choose a microphone
  testAudioInput          // Test if a microphone works
} = useMediaDevices()
```

⚠️ **Important**: The composable automatically enumerates devices on mount, so your device lists will populate without additional code.

### With MediaManager

If you're building a more complex application with call management, you'll want to share a single `MediaManager` instance. Here's how to connect them:

```typescript
import { ref } from 'vue'
import { MediaManager } from 'vuesip'
import { useMediaDevices } from 'vuesip'

// Create a shared MediaManager instance (typically done once at app root)
const mediaManager = ref(new MediaManager({ eventBus }))

// Pass it to useMediaDevices to ensure synchronized state
const devices = useMediaDevices(mediaManager)
```

💡 **Why share a MediaManager?** It ensures device selections and media streams are consistent across your entire application. When you select a microphone in settings, the same device is used during calls.

---

## Device Enumeration

### What is Device Enumeration?

Device enumeration is the process of asking the browser "what audio/video devices are available?" This includes microphones, speakers, and cameras connected to the user's computer.

📝 **Note**: Device enumeration respects browser security policies. Without permissions, device labels may be hidden or generic (e.g., "Microphone (1234)").

### Automatic Enumeration

By default, VueSip automatically enumerates devices when the composable is initialized. This means device lists are populated as soon as your component mounts:

```typescript
const {
  audioInputDevices,    // Automatically populated
  audioOutputDevices,   // Automatically populated
  videoInputDevices,    // Automatically populated
  isEnumerating         // Boolean: true during enumeration
} = useMediaDevices()

// React to device changes as they're discovered
watch(audioInputDevices, (devices) => {
  console.log('Audio input devices:', devices)
  // Example output: [{ deviceId: '123', label: 'Built-in Microphone', kind: 'audioinput' }]
})
```

✅ **Best Practice**: Use `isEnumerating` to show loading states in your UI while devices are being discovered.

### Manual Enumeration

Sometimes you need control over when enumeration happens - for example, when building a "Refresh Devices" button:

```typescript
const { enumerateDevices, isEnumerating } = useMediaDevices({
  autoEnumerate: false  // Disable automatic enumeration on mount
})

// Trigger enumeration manually (e.g., when user clicks "Refresh")
async function refreshDevices() {
  try {
    const devices = await enumerateDevices()
    console.log('Found devices:', devices)
    // devices is an array of all audio/video devices
  } catch (error) {
    console.error('Failed to enumerate devices:', error)
    // Common causes: browser doesn't support MediaDevices API
  }
}
```

💡 **When to use manual enumeration**:
- After requesting permissions (to get updated device labels)
- When implementing a "refresh devices" button
- After detecting device changes to get the latest list

### Filtering Devices

The composable provides pre-filtered device lists for convenience. Here's how to access specific device types:

```typescript
const {
  audioInputDevices,    // Only microphones
  audioOutputDevices,   // Only speakers/headphones
  videoInputDevices,    // Only cameras
  allDevices,           // All devices combined
  totalDevices          // Count of all devices
} = useMediaDevices()

// Display device counts in your UI
console.log(`Total devices: ${totalDevices.value}`)
// Example: "Total devices: 5"

// Work with specific device types
const microphones = audioInputDevices.value  // Array of mic devices
const speakers = audioOutputDevices.value    // Array of speaker devices
const cameras = videoInputDevices.value      // Array of camera devices

// Find the default device (if marked by the OS)
const defaultMic = microphones.find(d => d.isDefault)
if (defaultMic) {
  console.log('System default microphone:', defaultMic.label)
}
```

📝 **Note**: The `isDefault` property indicates the operating system's default device. This is useful for auto-selecting sensible defaults.

### Using getDevicesByKind

For more advanced filtering, use the `getDevicesByKind` helper:

```typescript
import { MediaDeviceKind } from 'vuesip'

const { getDevicesByKind, getDeviceById } = useMediaDevices()

// Filter devices by type using the MediaDeviceKind enum
const audioInputs = getDevicesByKind(MediaDeviceKind.AudioInput)
const audioOutputs = getDevicesByKind(MediaDeviceKind.AudioOutput)
const videoInputs = getDevicesByKind(MediaDeviceKind.VideoInput)

// Look up a specific device by its ID (useful when restoring saved preferences)
const device = getDeviceById('device-id-123')
if (device) {
  console.log(`Device: ${device.label}`)
} else {
  console.log('Device not found - may have been unplugged')
}
```

💡 **Use Case**: `getDeviceById` is perfect for validating saved device preferences before applying them.

---

## Device Selection

### Understanding Device Selection

Device selection is how users choose which microphone, speaker, or camera to use. When a device is selected, VueSip updates the reactive state and any active media streams automatically switch to the new device.

### Selecting Audio Input

Audio input selection determines which microphone captures the user's voice during calls:

```typescript
const {
  audioInputDevices,      // Array of available microphones
  selectedAudioInputId,   // Currently selected microphone ID (reactive)
  selectAudioInput        // Function to change selection
} = useMediaDevices()

// Auto-select the first available microphone (good for first-time setup)
if (audioInputDevices.value.length > 0) {
  selectAudioInput(audioInputDevices.value[0].deviceId)
}

// Monitor selection changes (useful for saving preferences)
watch(selectedAudioInputId, (deviceId) => {
  console.log('Selected audio input:', deviceId)
  // Tip: Save to localStorage here to restore on next visit
})
```

✅ **Best Practice**: Always validate that devices exist before selecting them, especially when restoring saved preferences.

### Selecting Audio Output

Audio output selection determines which speaker plays incoming audio during calls:

```typescript
const {
  audioOutputDevices,        // Array of available speakers
  selectedAudioOutputId,     // Currently selected speaker ID
  selectAudioOutput,         // Function to change selection
  selectedAudioOutputDevice  // Full device object (includes label, etc.)
} = useMediaDevices()

// Let user choose a speaker (typically from a dropdown)
function selectSpeaker(deviceId: string) {
  selectAudioOutput(deviceId)
  // VueSip automatically routes audio to the new speaker
}

// Display the selected speaker's name in your UI
console.log('Selected speaker:', selectedAudioOutputDevice.value?.label)
// Example output: "Selected speaker: External Speakers"
```

⚠️ **Browser Limitation**: Not all browsers support audio output selection (e.g., Firefox). Always check if `audioOutputDevices` is empty and provide fallback UI.

### Selecting Video Input

Video input selection determines which camera is used during video calls:

```typescript
const {
  videoInputDevices,        // Array of available cameras
  selectedVideoInputId,     // Currently selected camera ID
  selectVideoInput,         // Function to change selection
  selectedVideoInputDevice  // Full device object
} = useMediaDevices()

// Let user choose a camera
function selectCamera(deviceId: string) {
  selectVideoInput(deviceId)
  // Video stream automatically switches to new camera
}

// Display selected camera info
console.log('Selected camera:', selectedVideoInputDevice.value?.label)
// Example output: "Selected camera: FaceTime HD Camera"
```

💡 **Tip**: Many laptops have multiple cameras (built-in + external). Provide clear camera names in your UI to avoid confusion.

### Building a Device Selector

Here's a complete, production-ready device selector component:

```vue
<template>
  <div class="device-selector">
    <!-- Microphone Selector -->
    <label for="microphone">Microphone:</label>
    <select
      id="microphone"
      v-model="selectedAudioInputId"
      @change="onMicrophoneChange"
    >
      <option
        v-for="device in audioInputDevices"
        :key="device.deviceId"
        :value="device.deviceId"
      >
        {{ device.label }}
      </option>
    </select>

    <!-- Speaker Selector -->
    <label for="speaker">Speaker:</label>
    <select
      id="speaker"
      v-model="selectedAudioOutputId"
      @change="onSpeakerChange"
    >
      <option
        v-for="device in audioOutputDevices"
        :key="device.deviceId"
        :value="device.deviceId"
      >
        {{ device.label }}
      </option>
    </select>

    <!-- Camera Selector -->
    <label for="camera">Camera:</label>
    <select
      id="camera"
      v-model="selectedVideoInputId"
      @change="onCameraChange"
    >
      <option
        v-for="device in videoInputDevices"
        :key="device.deviceId"
        :value="device.deviceId"
      >
        {{ device.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { useMediaDevices } from 'vuesip'

const {
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId
} = useMediaDevices()

// Optional: Add handlers for custom logic when devices change
function onMicrophoneChange() {
  console.log('User selected new microphone:', selectedAudioInputId.value)
}

function onSpeakerChange() {
  console.log('User selected new speaker:', selectedAudioOutputId.value)
}

function onCameraChange() {
  console.log('User selected new camera:', selectedVideoInputId.value)
}
</script>
```

✅ **What makes this production-ready**:
- Two-way binding with `v-model` for seamless reactivity
- Change handlers for custom logic (logging, analytics, saving preferences)
- Accessible with proper `<label>` elements and `id` attributes
- Automatically updates when devices are plugged/unplugged

---

## Permission Handling

### Understanding Browser Permissions

Modern browsers require explicit user permission before accessing cameras and microphones. This protects user privacy but adds complexity to your application. VueSip simplifies permission management with a clear state model.

📝 **Why permissions matter**:
- **Security**: Prevents malicious websites from spying on users
- **Device labels**: Full device names are only available after permission is granted
- **User control**: Users can grant/deny permissions at any time

### Permission States

VueSip tracks four distinct permission states for both audio and video:

- **`NotRequested`** - Your app hasn't asked for permission yet (initial state)
- **`Prompt`** - Browser will show a permission dialog when you request access
- **`Granted`** - User clicked "Allow" - you can access devices
- **`Denied`** - User clicked "Block" - you cannot access devices (user must reset in browser settings)

### Requesting Permissions

Here's how to request device permissions in your application:

```typescript
const {
  requestPermissions,       // Request audio and/or video permissions
  requestAudioPermission,   // Request audio only
  requestVideoPermission,   // Request video only
  audioPermission,          // Current audio permission state
  videoPermission,          // Current video permission state
  hasAudioPermission,       // Boolean: true if audio granted
  hasVideoPermission        // Boolean: true if video granted
} = useMediaDevices()

// Request both audio and video permissions (common for video calls)
async function requestBothPermissions() {
  try {
    await requestPermissions(true, true)
    console.log('Permissions granted!')
    // User clicked "Allow" - you can now access devices
  } catch (error) {
    console.error('Permission denied:', error)
    // User clicked "Block" or closed the dialog
  }
}

// Request audio only (common for audio-only calls)
async function requestAudio() {
  const granted = await requestAudioPermission()
  if (granted) {
    console.log('Audio permission granted')
    // Re-enumerate to get full device labels
    await enumerateDevices()
  } else {
    console.log('Audio permission denied')
    // Show user instructions to enable in browser settings
  }
}

// Request video only (less common, usually request both)
async function requestVideo() {
  const granted = await requestVideoPermission()
  if (granted) {
    console.log('Video permission granted')
    // Now you can access camera devices
  }
}
```

⚠️ **Important**: Always request permissions in response to user action (button click). Browsers block automatic permission requests on page load.

### Checking Permission Status

Before requesting permissions, check the current state to provide appropriate UI:

```typescript
const {
  audioPermission,      // PermissionStatus enum value
  videoPermission,      // PermissionStatus enum value
  hasAudioPermission,   // Convenience boolean
  hasVideoPermission    // Convenience boolean
} = useMediaDevices()

// Simple boolean check (most common use case)
if (hasAudioPermission.value) {
  console.log('Audio permission is granted - ready to make calls')
}

// Detailed permission state check (for advanced UI)
import { PermissionStatus } from 'vuesip'

if (audioPermission.value === PermissionStatus.Denied) {
  // Show instructions to reset permission in browser settings
  console.log('User denied audio permission')
} else if (audioPermission.value === PermissionStatus.NotRequested) {
  // Show "Grant Permission" button
  console.log('Audio permission not requested yet')
} else if (audioPermission.value === PermissionStatus.Prompt) {
  // Browser will prompt when we request
  console.log('Browser ready to show permission dialog')
}
```

💡 **UI Guidance**:
- `NotRequested`: Show a "Grant Permissions" button
- `Prompt`: Same as NotRequested
- `Granted`: Show device selectors
- `Denied`: Show instructions to reset permissions in browser settings

### Permission-Aware UI

Build a user-friendly UI that adapts to permission states:

```vue
<template>
  <div class="permission-ui">
    <!-- Show permission prompt when not granted -->
    <div v-if="!hasAudioPermission" class="permission-prompt">
      <p>🎤 Microphone access is required for calls</p>
      <button @click="requestAudio">Grant Microphone Access</button>

      <!-- Show additional help if permission was denied -->
      <div v-if="audioPermission === 'denied'" class="permission-denied">
        <p>⚠️ Permission was blocked. Please enable it in your browser settings:</p>
        <ol>
          <li>Click the lock icon in your address bar</li>
          <li>Find "Microphone" in the permissions list</li>
          <li>Change from "Block" to "Allow"</li>
          <li>Refresh this page</li>
        </ol>
      </div>
    </div>

    <!-- Show device selector when permission granted -->
    <div v-else class="device-selector">
      <label for="microphone">Select Microphone:</label>
      <select id="microphone" v-model="selectedAudioInputId">
        <option
          v-for="device in audioInputDevices"
          :key="device.deviceId"
          :value="device.deviceId"
        >
          {{ device.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMediaDevices } from 'vuesip'

const {
  audioInputDevices,
  selectedAudioInputId,
  hasAudioPermission,
  audioPermission,
  requestAudioPermission,
  enumerateDevices
} = useMediaDevices()

// Request permission and refresh device list
async function requestAudio() {
  const granted = await requestAudioPermission()
  if (granted) {
    // Re-enumerate to get full device labels (not generic ones)
    await enumerateDevices()
  }
}
</script>
```

✅ **What makes this good UX**:
- Clear explanation of why permission is needed
- Different UI states for different permission states
- Helpful recovery instructions when permission is denied
- Automatic device enumeration after permission granted

---

## Device Testing

### Why Test Devices?

Device testing helps ensure users' hardware is working before they join important calls. This prevents frustrating situations where users realize their microphone isn't working after joining a meeting.

💡 **Use Cases**:
- Pre-call device checks
- Settings/preferences pages
- Troubleshooting audio/video issues
- Device comparison (testing multiple microphones)

### Testing Audio Input (Microphone)

Test a microphone to verify it's working and detecting audio properly:

```typescript
const { testAudioInput, selectedAudioInputId } = useMediaDevices()

// Test the currently selected microphone
async function testMicrophone() {
  try {
    // Returns true if audio levels detected, false otherwise
    const success = await testAudioInput()

    if (success) {
      console.log('✓ Microphone is working!')
      // Audio levels exceeded threshold - mic is picking up sound
    } else {
      console.log('✗ No audio detected from microphone')
      // Mic may be muted, unplugged, or not working
    }
  } catch (error) {
    console.error('Failed to test microphone:', error)
    // Common causes: no permission, device unplugged during test
  }
}

// Test a specific device with custom options
async function testSpecificDevice(deviceId: string) {
  const success = await testAudioInput(deviceId, {
    duration: 3000,           // Test for 3 seconds (default: 2000ms)
    audioLevelThreshold: 0.02 // Minimum audio level to pass (default: 0.01)
  })

  return success
}
```

📝 **How it works**:
1. VueSip captures audio from the microphone for the specified duration
2. Monitors audio levels in real-time
3. Returns `true` if audio exceeds the threshold, `false` otherwise

⚠️ **Note**: The test requires actual sound. Tell users to speak or tap the microphone during testing.

### Testing Audio Output (Speaker)

Test a speaker by playing a tone to verify audio is working:

```typescript
const { testAudioOutput, selectedAudioOutputId } = useMediaDevices()

// Test the currently selected speaker
async function testSpeaker() {
  try {
    // Plays a 1kHz tone for 500ms through the selected speaker
    const success = await testAudioOutput()

    if (success) {
      console.log('✓ Speaker test tone played successfully')
      // Ask user: "Did you hear a beep?"
    } else {
      console.log('✗ Failed to play test tone')
      // Browser may not support speaker selection
    }
  } catch (error) {
    console.error('Speaker test failed:', error)
  }
}

// Test a specific speaker device
async function testSpecificSpeaker(deviceId: string) {
  const success = await testAudioOutput(deviceId)
  return success
}
```

📝 **How it works**:
1. VueSip generates a 1kHz audio tone
2. Routes it through the specified speaker
3. Returns `true` if playback succeeded, `false` otherwise

💡 **UX Tip**: After playing the tone, ask users "Did you hear a beep?" to confirm audio output is working.

### Building a Device Tester

Here's a complete device testing component ready for production:

```vue
<template>
  <div class="device-tester">
    <h3>Test Your Devices</h3>

    <!-- Microphone Test Section -->
    <div class="test-section">
      <h4>🎤 Microphone Test</h4>
      <p class="instructions">Click test and speak into your microphone</p>

      <button
        @click="performMicTest"
        :disabled="testing || !hasAudioPermission"
      >
        {{ testing ? 'Testing... Speak now!' : 'Test Microphone' }}
      </button>

      <!-- Show result after test completes -->
      <div v-if="micTestResult !== null" class="result">
        <span v-if="micTestResult" class="success">
          ✅ Working! Audio detected.
        </span>
        <span v-else class="failure">
          ❌ Not detected. Check if microphone is muted or unplugged.
        </span>
      </div>
    </div>

    <!-- Speaker Test Section -->
    <div class="test-section">
      <h4>🔊 Speaker Test</h4>
      <p class="instructions">Click test and listen for a beep</p>

      <button
        @click="performSpeakerTest"
        :disabled="testing"
      >
        {{ testing ? 'Testing... Listen!' : 'Test Speaker' }}
      </button>

      <!-- Show result after test completes -->
      <div v-if="speakerTestResult !== null" class="result">
        <span v-if="speakerTestResult" class="success">
          ✅ Tone played. Did you hear it?
        </span>
        <span v-else class="failure">
          ❌ Failed to play tone.
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMediaDevices } from 'vuesip'

const {
  testAudioInput,
  testAudioOutput,
  hasAudioPermission
} = useMediaDevices()

// Track testing state to prevent overlapping tests
const testing = ref(false)
const micTestResult = ref<boolean | null>(null)
const speakerTestResult = ref<boolean | null>(null)

// Test microphone with custom options
async function performMicTest() {
  testing.value = true
  micTestResult.value = null  // Clear previous result

  try {
    const success = await testAudioInput(undefined, {
      duration: 2000,            // Test for 2 seconds
      audioLevelThreshold: 0.01  // Sensitive threshold
    })
    micTestResult.value = success
  } catch (error) {
    console.error('Microphone test error:', error)
    micTestResult.value = false
  } finally {
    testing.value = false
  }
}

// Test speaker
async function performSpeakerTest() {
  testing.value = true
  speakerTestResult.value = null  // Clear previous result

  try {
    const success = await testAudioOutput()
    speakerTestResult.value = success
  } catch (error) {
    console.error('Speaker test error:', error)
    speakerTestResult.value = false
  } finally {
    testing.value = false
  }
}
</script>
```

✅ **Production-ready features**:
- Clear instructions for users
- Disabled states to prevent overlapping tests
- Visual feedback during testing
- Detailed result messages
- Error handling
- Permission checks

---

## Device Change Monitoring

### Why Monitor Device Changes?

Users frequently plug and unplug devices during use:
- Switching from built-in mic to external USB microphone
- Connecting Bluetooth headphones
- Unplugging a webcam after a video call

VueSip automatically detects these changes and updates device lists in real-time, ensuring your UI always reflects the current hardware state.

### Automatic Monitoring

Device change monitoring is enabled by default - no setup required:

```typescript
const {
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices
} = useMediaDevices({
  autoMonitor: true  // Default behavior (can omit this line)
})

// Device lists automatically update when hardware changes
watch(audioInputDevices, (devices, oldDevices) => {
  console.log('Audio devices changed!')
  console.log('Old count:', oldDevices.length)
  console.log('New count:', devices.length)

  // Detect if a device was added or removed
  if (devices.length > oldDevices.length) {
    console.log('✓ Device plugged in')
  } else if (devices.length < oldDevices.length) {
    console.log('✗ Device unplugged')
  }
})
```

💡 **What's happening behind the scenes**: VueSip listens to the browser's `devicechange` event and automatically re-enumerates devices.

### Manual Monitoring Control

For advanced use cases, you can control monitoring manually:

```typescript
const {
  startDeviceChangeMonitoring,
  stopDeviceChangeMonitoring
} = useMediaDevices({
  autoMonitor: false  // Disable automatic monitoring
})

// Start monitoring when user enters settings page
onMounted(() => {
  startDeviceChangeMonitoring()
})

// Stop monitoring to save resources when leaving settings page
onUnmounted(() => {
  stopDeviceChangeMonitoring()
})
```

⚠️ **When to use manual control**:
- Building a device settings page that's not always visible
- Optimizing performance in large applications
- Coordinating with other device monitoring systems

### Handling Device Changes

Build responsive UIs that react to device changes:

```vue
<template>
  <div class="device-monitor">
    <p>📱 Connected Devices: {{ totalDevices }}</p>

    <!-- Show notification when devices change -->
    <div v-if="deviceJustChanged" class="notification">
      ⚠️ Device configuration changed! Your device list has been updated.
    </div>

    <!-- List current devices -->
    <div class="device-list">
      <h4>Available Microphones:</h4>
      <ul>
        <li v-for="device in audioInputDevices" :key="device.deviceId">
          {{ device.label }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMediaDevices } from 'vuesip'

const {
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  totalDevices
} = useMediaDevices()

const deviceJustChanged = ref(false)

// Watch for any device changes
watch(
  [audioInputDevices, audioOutputDevices, videoInputDevices],
  () => {
    // Show notification when devices change
    deviceJustChanged.value = true

    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      deviceJustChanged.value = false
    }, 3000)
  }
)
</script>
```

✅ **User benefits**:
- Users see immediate feedback when plugging/unplugging devices
- Device lists stay current without manual refreshing
- Clear visual indication that the system detected the change

### Recovering from Device Loss

Handle the case where a user's selected device is unplugged:

```typescript
import { watch } from 'vue'

const {
  selectedAudioInputId,
  audioInputDevices,
  selectAudioInput
} = useMediaDevices()

// Automatically switch to another device if selected one is unplugged
watch([selectedAudioInputId, audioInputDevices], ([selectedId, devices]) => {
  // Check if currently selected device still exists
  if (selectedId) {
    const deviceExists = devices.some(d => d.deviceId === selectedId)

    // If selected device was unplugged, fall back to first available
    if (!deviceExists && devices.length > 0) {
      console.log('⚠️ Selected device lost, switching to first available')
      selectAudioInput(devices[0].deviceId)
    } else if (!deviceExists && devices.length === 0) {
      console.log('❌ No audio input devices available')
      // Show user message: "Please connect a microphone"
    }
  }
})
```

💡 **Advanced**: Store user's preferred device by label (not ID). When devices change, find the device with matching label and select it.

---

## Best Practices

### 1. Request Permissions Early

**Why**: Device labels are only available after permission is granted. Without permission, you'll see generic labels like "Microphone (1234)".

```typescript
// ✅ Good: Request permission first to get full device labels
async function initialize() {
  await requestPermissions(true, false)  // Request audio permission
  await enumerateDevices()               // Now device labels are clear
  // Result: "Built-in Microphone", "USB Audio Device"
}

// ❌ Bad: Enumerate without permission
async function initialize() {
  await enumerateDevices()
  // Result: "Microphone (12345)", "Microphone (67890)" - confusing!
}
```

💡 **Tip**: Request permissions on a "Settings" or "Setup" page before users need to make calls.

### 2. Handle Permission Denials Gracefully

**Why**: Users may deny permissions accidentally or intentionally. Provide clear recovery instructions.

```typescript
async function setupAudio() {
  try {
    await requestAudioPermission()
  } catch (error) {
    // Show user-friendly message with recovery instructions
    showError(
      'Microphone access is required for calls. ' +
      'Please enable it in your browser settings (click the lock icon in the address bar).'
    )
    return
  }

  // Continue with setup only if permission granted
  await enumerateDevices()
}
```

⚠️ **Important**: Never silently fail permission requests. Always inform users and provide next steps.

### 3. Validate Device Selection

**Why**: Saved device preferences may reference devices that are no longer connected.

```typescript
function selectDevice(deviceId: string) {
  // Verify device exists before selecting
  const device = getDeviceById(deviceId)

  if (!device) {
    console.warn('Device not found:', deviceId)
    // Fall back to first available device
    if (audioInputDevices.value.length > 0) {
      selectAudioInput(audioInputDevices.value[0].deviceId)
    }
    return
  }

  // Device exists - safe to select
  selectAudioInput(deviceId)
}
```

✅ **Best Practice**: Always validate before selecting, especially when restoring saved preferences.

### 4. Test Devices Before Important Calls

**Why**: Prevent embarrassing situations where users realize their mic doesn't work after joining a meeting.

```typescript
async function prepareForCall() {
  // Test microphone before allowing user to join
  const micWorks = await testAudioInput(undefined, {
    duration: 2000,            // Quick 2-second test
    audioLevelThreshold: 0.01  // Sensitive threshold
  })

  if (!micWorks) {
    // Block call and show warning
    showWarning(
      '⚠️ No audio detected from microphone. ' +
      'Please check your device and try again.'
    )
    return false
  }

  return true  // Ready to join call
}

// Use before joining call
async function joinCall() {
  const ready = await prepareForCall()
  if (ready) {
    // Proceed with call
  }
}
```

💡 **UX Enhancement**: Add a pre-call "Test Setup" page where users can test devices before joining.

### 5. Save User Preferences

**Why**: Users don't want to select their devices every time they visit your application.

```typescript
import { watch } from 'vue'

const {
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId
} = useMediaDevices()

// Auto-save to localStorage whenever selection changes
watch(selectedAudioInputId, (deviceId) => {
  if (deviceId) {
    localStorage.setItem('preferredMicrophone', deviceId)
  }
})

watch(selectedAudioOutputId, (deviceId) => {
  if (deviceId) {
    localStorage.setItem('preferredSpeaker', deviceId)
  }
})

// Restore saved preferences on app mount
onMounted(async () => {
  // Wait for device enumeration
  await enumerateDevices()

  // Restore saved selections
  const savedMic = localStorage.getItem('preferredMicrophone')
  if (savedMic && getDeviceById(savedMic)) {
    selectAudioInput(savedMic)
  }
})
```

✅ **Enhancement**: Save device labels too, so you can match by label if device ID changes.

### 6. Handle Mobile Devices

**Why**: Mobile devices have different behavior - usually only one mic and speaker, and fewer options.

```typescript
// Detect mobile platform
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

if (isMobile) {
  // Mobile devices typically have fewer choices
  // Auto-select defaults to simplify UI
  if (audioInputDevices.value.length > 0) {
    selectAudioInput(audioInputDevices.value[0].deviceId)
  }

  // Consider hiding device selectors on mobile
  // Most users won't need to change devices
}
```

💡 **Mobile UX**: Consider showing a simplified UI without device selectors, or hide them by default with an "Advanced" toggle.

### 7. Provide Clear User Feedback

**Why**: Device operations can take time. Keep users informed about what's happening.

```vue
<template>
  <div class="device-status">
    <!-- Loading state -->
    <div v-if="isEnumerating" class="loading">
      🔄 Loading devices...
    </div>

    <!-- No devices found -->
    <div v-else-if="!hasAudioInputDevices" class="warning">
      ⚠️ No microphone detected. Please connect a microphone and click refresh.
    </div>

    <!-- Devices available -->
    <div v-else class="success">
      ✅ {{ audioInputDevices.length }} microphone(s) available
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMediaDevices } from 'vuesip'

const {
  isEnumerating,
  hasAudioInputDevices,
  audioInputDevices
} = useMediaDevices()
</script>
```

✅ **Good UX includes**:
- Loading indicators during operations
- Success messages when complete
- Warning messages for empty states
- Error messages with recovery steps

---

## Complete Examples

### Full Device Manager Component

A complete, production-ready device settings component with all features:

```vue
<template>
  <div class="device-manager">
    <h2>Device Settings</h2>

    <!-- Permission Request Section (shown when permission not granted) -->
    <div v-if="!hasAudioPermission" class="permission-section">
      <p>🔐 Microphone and camera access is required for calls.</p>
      <button @click="handleRequestPermission" class="primary-button">
        Grant Permissions
      </button>
      <p class="help-text">
        Click "Allow" in the browser prompt to continue
      </p>
    </div>

    <!-- Device Selection Section (shown when permission granted) -->
    <div v-else class="device-section">
      <!-- Microphone Selector with Test Button -->
      <div class="device-group">
        <label for="microphone">🎤 Microphone</label>
        <select
          id="microphone"
          v-model="selectedAudioInputId"
          :disabled="isEnumerating"
        >
          <option
            v-for="device in audioInputDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label }}
          </option>
        </select>
        <button
          @click="testMic"
          :disabled="testingMic || !selectedAudioInputId"
          class="test-button"
        >
          {{ testingMic ? 'Testing...' : 'Test' }}
        </button>
        <!-- Test Result Indicator -->
        <span v-if="micTestResult !== null" class="test-result">
          {{ micTestResult ? '✅' : '❌' }}
        </span>
      </div>

      <!-- Speaker Selector with Test Button -->
      <div class="device-group">
        <label for="speaker">🔊 Speaker</label>
        <select
          id="speaker"
          v-model="selectedAudioOutputId"
          :disabled="isEnumerating"
        >
          <option
            v-for="device in audioOutputDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label }}
          </option>
        </select>
        <button
          @click="testSpeaker"
          :disabled="testingSpeaker || !selectedAudioOutputId"
          class="test-button"
        >
          {{ testingSpeaker ? 'Testing...' : 'Test' }}
        </button>
        <!-- Test Result Indicator -->
        <span v-if="speakerTestResult !== null" class="test-result">
          {{ speakerTestResult ? '✅' : '❌' }}
        </span>
      </div>

      <!-- Camera Selector (optional - can be "No camera") -->
      <div class="device-group">
        <label for="camera">📹 Camera</label>
        <select
          id="camera"
          v-model="selectedVideoInputId"
          :disabled="isEnumerating || !hasVideoInputDevices"
        >
          <option value="">No camera</option>
          <option
            v-for="device in videoInputDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label }}
          </option>
        </select>
      </div>

      <!-- Refresh Devices Button -->
      <button
        @click="handleRefreshDevices"
        :disabled="isEnumerating"
        class="refresh-button"
      >
        {{ isEnumerating ? '🔄 Refreshing...' : '🔄 Refresh Devices' }}
      </button>
    </div>

    <!-- Error Display -->
    <div v-if="lastError" class="error">
      ❌ Error: {{ lastError.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMediaDevices } from 'vuesip'

const {
  // Device Lists
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  hasAudioInputDevices,
  hasAudioOutputDevices,
  hasVideoInputDevices,

  // Selected Devices
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId,

  // Permissions
  hasAudioPermission,
  hasVideoPermission,
  requestPermissions,

  // Methods
  enumerateDevices,
  testAudioInput,
  testAudioOutput,

  // State
  isEnumerating,
  lastError
} = useMediaDevices()

// Testing state management
const testingMic = ref(false)
const testingSpeaker = ref(false)
const micTestResult = ref<boolean | null>(null)
const speakerTestResult = ref<boolean | null>(null)

// Request both audio and video permissions
async function handleRequestPermission() {
  try {
    await requestPermissions(true, true)  // Request audio and video
    await enumerateDevices()              // Refresh to get labels
  } catch (error) {
    console.error('Permission request failed:', error)
  }
}

// Refresh device list (useful after plugging/unplugging devices)
async function handleRefreshDevices() {
  try {
    await enumerateDevices()
  } catch (error) {
    console.error('Failed to refresh devices:', error)
  }
}

// Test microphone - captures audio and checks if levels detected
async function testMic() {
  testingMic.value = true
  micTestResult.value = null  // Clear previous result

  try {
    const result = await testAudioInput(undefined, {
      duration: 2000,            // Test for 2 seconds
      audioLevelThreshold: 0.01  // Minimum audio level to pass
    })
    micTestResult.value = result
  } catch (error) {
    console.error('Mic test failed:', error)
    micTestResult.value = false
  } finally {
    testingMic.value = false
  }
}

// Test speaker - plays a tone through the selected speaker
async function testSpeaker() {
  testingSpeaker.value = true
  speakerTestResult.value = null  // Clear previous result

  try {
    const result = await testAudioOutput()
    speakerTestResult.value = result
  } catch (error) {
    console.error('Speaker test failed:', error)
    speakerTestResult.value = false
  } finally {
    testingSpeaker.value = false
  }
}
</script>

<style scoped>
.device-manager {
  padding: 20px;
  max-width: 600px;
}

.device-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.device-group label {
  min-width: 100px;
}

.device-group select {
  flex: 1;
  padding: 8px;
}

.test-result {
  font-size: 20px;
}

.error {
  color: red;
  margin-top: 10px;
  padding: 10px;
  background: #fee;
  border-radius: 4px;
}

.permission-section {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
}

.help-text {
  font-size: 14px;
  color: #666;
  margin-top: 10px;
}
</style>
```

📝 **What this component includes**:
- Permission request flow with clear instructions
- Device selectors for mic, speaker, and camera
- Device testing with visual feedback
- Refresh button for manual updates
- Error handling and display
- Disabled states to prevent invalid operations
- Accessibility with proper labels

### Settings Page with Persistence

A settings page that saves and restores user preferences:

```vue
<template>
  <div class="device-settings">
    <h2>Audio/Video Settings</h2>

    <p class="intro">
      Select your preferred devices. Your choices will be saved and used for all future calls.
    </p>

    <!-- Microphone Settings -->
    <div class="settings-section">
      <h3>🎤 Microphone</h3>
      <select v-model="selectedAudioInputId" @change="onSelectionChange">
        <option
          v-for="device in audioInputDevices"
          :key="device.deviceId"
          :value="device.deviceId"
        >
          {{ device.label }}
        </option>
      </select>
      <p class="device-info">{{ audioInputDevices.length }} device(s) available</p>
    </div>

    <!-- Speaker Settings -->
    <div class="settings-section">
      <h3>🔊 Speaker</h3>
      <select v-model="selectedAudioOutputId" @change="onSelectionChange">
        <option
          v-for="device in audioOutputDevices"
          :key="device.deviceId"
          :value="device.deviceId"
        >
          {{ device.label }}
        </option>
      </select>
      <p class="device-info">{{ audioOutputDevices.length }} device(s) available</p>
    </div>

    <!-- Camera Settings -->
    <div class="settings-section">
      <h3>📹 Camera</h3>
      <select v-model="selectedVideoInputId" @change="onSelectionChange">
        <option value="">None (audio only)</option>
        <option
          v-for="device in videoInputDevices"
          :key="device.deviceId"
          :value="device.deviceId"
        >
          {{ device.label }}
        </option>
      </select>
      <p class="device-info">{{ videoInputDevices.length }} camera(s) available</p>
    </div>

    <!-- Save Confirmation -->
    <div v-if="settingsSaved" class="save-confirmation">
      ✅ Settings saved automatically
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useMediaDevices } from 'vuesip'

const {
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId,
  selectAudioInput,
  selectAudioOutput,
  selectVideoInput,
  requestPermissions,
  enumerateDevices
} = useMediaDevices()

const settingsSaved = ref(false)

// Initialize: Request permissions and restore saved preferences
onMounted(async () => {
  try {
    // Step 1: Request permissions to access devices
    await requestPermissions(true, true)

    // Step 2: Enumerate devices to populate lists
    await enumerateDevices()

    // Step 3: Restore user's saved preferences from localStorage
    const savedMic = localStorage.getItem('preferredMicrophone')
    const savedSpeaker = localStorage.getItem('preferredSpeaker')
    const savedCamera = localStorage.getItem('preferredCamera')

    // Step 4: Apply saved selections (if devices still exist)
    if (savedMic) selectAudioInput(savedMic)
    if (savedSpeaker) selectAudioOutput(savedSpeaker)
    if (savedCamera) selectVideoInput(savedCamera)
  } catch (error) {
    console.error('Failed to initialize device settings:', error)
  }
})

// Auto-save microphone selection to localStorage
watch(selectedAudioInputId, (deviceId) => {
  if (deviceId) {
    localStorage.setItem('preferredMicrophone', deviceId)
    showSaveConfirmation()
  }
})

// Auto-save speaker selection to localStorage
watch(selectedAudioOutputId, (deviceId) => {
  if (deviceId) {
    localStorage.setItem('preferredSpeaker', deviceId)
    showSaveConfirmation()
  }
})

// Auto-save camera selection to localStorage
watch(selectedVideoInputId, (deviceId) => {
  if (deviceId) {
    localStorage.setItem('preferredCamera', deviceId)
    showSaveConfirmation()
  }
})

// Show temporary confirmation message when settings change
function onSelectionChange() {
  showSaveConfirmation()
}

// Display "settings saved" message temporarily
function showSaveConfirmation() {
  settingsSaved.value = true
  setTimeout(() => {
    settingsSaved.value = false
  }, 2000)
}
</script>

<style scoped>
.device-settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.intro {
  color: #666;
  margin-bottom: 30px;
}

.settings-section {
  margin-bottom: 25px;
}

.settings-section h3 {
  margin-bottom: 10px;
}

.settings-section select {
  width: 100%;
  padding: 10px;
  font-size: 16px;
}

.device-info {
  font-size: 14px;
  color: #888;
  margin-top: 5px;
}

.save-confirmation {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #4caf50;
  color: white;
  padding: 15px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
</style>
```

✅ **Production features**:
- Automatic permission request on mount
- Saves preferences to localStorage automatically
- Restores saved preferences on page load
- Visual confirmation when settings save
- Device counts for user awareness
- Graceful error handling

---

## API Reference

### useMediaDevices()

Primary composable for device management. This is your main interface to VueSip's device management system.

#### Parameters

```typescript
function useMediaDevices(
  mediaManager?: Ref<MediaManager | null>,  // Optional: Share MediaManager instance
  options?: {
    autoEnumerate?: boolean  // Default: true - Auto-enumerate devices on mount
    autoMonitor?: boolean    // Default: true - Auto-detect device changes
  }
): UseMediaDevicesReturn
```

**Parameter Details**:
- `mediaManager`: Pass a shared MediaManager instance to synchronize device state across components
- `autoEnumerate`: When true, devices are automatically enumerated when component mounts
- `autoMonitor`: When true, listens for device changes and updates lists automatically

#### Returns

##### Reactive State

**Device Lists** (read-only computed refs):
- `audioInputDevices: ComputedRef<readonly MediaDevice[]>` - Array of microphones
- `audioOutputDevices: ComputedRef<readonly MediaDevice[]>` - Array of speakers/headphones
- `videoInputDevices: ComputedRef<readonly MediaDevice[]>` - Array of cameras
- `allDevices: ComputedRef<readonly MediaDevice[]>` - All devices combined
- `totalDevices: ComputedRef<number>` - Count of all devices

**Selected Devices** (reactive refs, supports v-model):
- `selectedAudioInputId: Ref<string | null>` - ID of selected microphone
- `selectedAudioOutputId: Ref<string | null>` - ID of selected speaker
- `selectedVideoInputId: Ref<string | null>` - ID of selected camera
- `selectedAudioInputDevice: ComputedRef<MediaDevice | undefined>` - Full selected mic object
- `selectedAudioOutputDevice: ComputedRef<MediaDevice | undefined>` - Full selected speaker object
- `selectedVideoInputDevice: ComputedRef<MediaDevice | undefined>` - Full selected camera object

**Permission State**:
- `audioPermission: ComputedRef<PermissionStatus>` - Audio permission state enum
- `videoPermission: ComputedRef<PermissionStatus>` - Video permission state enum
- `hasAudioPermission: ComputedRef<boolean>` - True if audio granted
- `hasVideoPermission: ComputedRef<boolean>` - True if video granted

**Device Availability** (boolean convenience refs):
- `hasAudioInputDevices: ComputedRef<boolean>` - True if microphones available
- `hasAudioOutputDevices: ComputedRef<boolean>` - True if speakers available
- `hasVideoInputDevices: ComputedRef<boolean>` - True if cameras available

**Operation State**:
- `isEnumerating: Ref<boolean>` - True during device enumeration
- `lastError: Ref<Error | null>` - Most recent error (null if none)

##### Methods

**Device Enumeration**:
- `enumerateDevices(): Promise<MediaDevice[]>` - Manually refresh device list

**Permission Requests**:
- `requestAudioPermission(): Promise<boolean>` - Request microphone permission only
- `requestVideoPermission(): Promise<boolean>` - Request camera permission only
- `requestPermissions(audio?: boolean, video?: boolean): Promise<void>` - Request both permissions

**Device Selection**:
- `selectAudioInput(deviceId: string): void` - Select a microphone by ID
- `selectAudioOutput(deviceId: string): void` - Select a speaker by ID
- `selectVideoInput(deviceId: string): void` - Select a camera by ID

**Device Testing**:
- `testAudioInput(deviceId?: string, options?: DeviceTestOptions): Promise<boolean>` - Test microphone
- `testAudioOutput(deviceId?: string): Promise<boolean>` - Test speaker

**Device Lookup**:
- `getDeviceById(deviceId: string): MediaDevice | undefined` - Find device by ID
- `getDevicesByKind(kind: MediaDeviceKind): readonly MediaDevice[]` - Filter by device kind

**Change Monitoring**:
- `startDeviceChangeMonitoring(): void` - Start listening for device changes
- `stopDeviceChangeMonitoring(): void` - Stop listening for device changes

### Types

#### MediaDevice

Represents a single audio or video device:

```typescript
interface MediaDevice {
  deviceId: string      // Unique device identifier
  kind: MediaDeviceKind // Type: audioinput, audiooutput, videoinput
  label: string         // Human-readable name (e.g., "Built-in Microphone")
  groupId: string       // Groups related devices (e.g., mic & speaker on headset)
  isDefault?: boolean   // True if OS default device
}
```

#### MediaDeviceKind

Enum for device types:

```typescript
enum MediaDeviceKind {
  AudioInput = 'audioinput',    // Microphones
  AudioOutput = 'audiooutput',  // Speakers/headphones
  VideoInput = 'videoinput'     // Cameras
}
```

#### PermissionStatus

Enum for permission states:

```typescript
enum PermissionStatus {
  Granted = 'granted',          // User clicked "Allow"
  Denied = 'denied',            // User clicked "Block"
  Prompt = 'prompt',            // Browser will show prompt
  NotRequested = 'not_requested' // Haven't asked yet
}
```

#### DeviceTestOptions

Options for device testing:

```typescript
interface DeviceTestOptions {
  duration?: number              // Test duration in milliseconds (default: 2000)
  audioLevelThreshold?: number   // Min audio level 0-1 to pass test (default: 0.01)
}
```

**Option Details**:
- `duration`: How long to capture audio before checking results (2000ms = 2 seconds)
- `audioLevelThreshold`: Minimum audio level required to pass. Range 0.0 (silence) to 1.0 (max). Default 0.01 is very sensitive.

---

## Troubleshooting

### Devices Not Showing Labels

**Problem**: Device labels show as empty or generic (e.g., "Microphone (12345)" instead of "Built-in Microphone")

**Cause**: Browser security hides device labels until permission is granted

**Solution**: Request permissions before enumerating devices:

```typescript
// ✅ Correct order
await requestPermissions(true, false)  // Request permission first
await enumerateDevices()               // Then enumerate - labels now visible
```

⚠️ **Why this happens**: Browsers hide device labels to prevent fingerprinting until users grant permission.

### Selected Device Not Working

**Problem**: Selected device doesn't produce audio/video during calls

**Possible causes**:
- Device is muted in operating system
- Device was unplugged
- Device is in use by another application
- Browser doesn't have permission

**Solution**: Test the device before use:

```typescript
// Test before joining call
const works = await testAudioInput(deviceId)
if (!works) {
  console.error('Device not working')
  showError('Microphone test failed. Please check your device and try again.')
}
```

💡 **Prevention**: Add a pre-call test page where users can verify devices work.

### Permission Denied

**Problem**: User denied permission and can't use audio/video features

**Cause**: User clicked "Block" in the permission prompt

**Solution**: Provide clear instructions to reset in browser settings:

```typescript
if (audioPermission.value === PermissionStatus.Denied) {
  showMessage(
    'Microphone permission was blocked. To enable:\n\n' +
    '1. Click the lock icon in your browser address bar\n' +
    '2. Find "Microphone" in the permissions list\n' +
    '3. Change from "Block" to "Allow"\n' +
    '4. Refresh this page'
  )
}
```

⚠️ **Important**: Browsers won't show the permission prompt again after denial. Only the user can reset it in browser settings.

### Device Change Not Detected

**Problem**: Plugging/unplugging devices doesn't update the device list

**Possible causes**:
- Device monitoring is disabled
- Browser doesn't support `devicechange` event
- Component was unmounted

**Solution**: Ensure device monitoring is enabled:

```typescript
// Verify auto-monitoring is enabled (it is by default)
const devices = useMediaDevices({
  autoMonitor: true  // Should be enabled
})

// Or start monitoring manually
startDeviceChangeMonitoring()
```

💡 **Debug tip**: Log to console when devices change to verify monitoring is working:

```typescript
watch(audioInputDevices, () => {
  console.log('Devices changed!', audioInputDevices.value)
})
```

### Audio Output Selection Not Working

**Problem**: Selecting a speaker doesn't change where audio plays

**Cause**: Browser doesn't support `setSinkId()` (e.g., Firefox)

**Solution**: Detect support and show appropriate UI:

```typescript
// Check if browser supports audio output selection
const supportsAudioOutput = 'sinkId' in HTMLMediaElement.prototype

if (!supportsAudioOutput) {
  console.warn('Browser does not support audio output selection')
  // Hide speaker selector or show warning message
}
```

📝 **Browser Support**: Chrome, Edge, and Safari support audio output selection. Firefox does not (as of 2025).

---

## Related Documentation

Continue learning about VueSip's capabilities:

- [Call Management Guide](./call-management.md) - Learn how to make and manage SIP calls
- [Conference Management Guide](./conference-management.md) - Build multi-party conference features
- [Testing Guide](../testing-guide.md) - Test your device management implementation

## Further Reading

Deepen your understanding of the underlying web technologies:

- [WebRTC getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) - Browser API for accessing media devices
- [MediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices) - Full MediaDevices specification
- [Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API) - How browser permissions work
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API) - Working with audio/video streams
