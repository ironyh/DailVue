# Performance Optimization

This guide covers performance optimization techniques for VueSip applications, helping you build fast, efficient VoIP applications that scale well and provide excellent user experience.

## Overview

Performance is critical in real-time communication applications. A slow or resource-intensive VoIP application leads to poor call quality, dropped connections, and frustrated users. VueSip is designed with performance as a core principle, providing you with tools and patterns to build highly optimized applications.

**What This Guide Covers:**
- **Bundle Size Optimization** - Keep your application lightweight and fast to load
- **Memory Management** - Prevent memory leaks and manage resources efficiently
- **Concurrent Call Handling** - Manage multiple simultaneous calls without degrading performance
- **Network Optimization** - Ensure reliable connections and efficient data transfer
- **State Persistence Optimization** - Efficiently save and load application state
- **Performance Monitoring** - Track and improve your application's performance over time
- **Performance Benchmarking** - Measure and verify your application's performance
- **Best Practices** - Production-ready guidelines and optimization workflows

### Core Performance Features

VueSip provides these performance optimizations out of the box:

- **Small Bundle Size** - Optimized for minimal footprint with tree-shaking support (under 150 KB minified)
- **Memory Efficient** - Automatic cleanup and resource management prevent memory leaks
- **Concurrent Calls** - Handle up to 4 simultaneous calls efficiently by default
- **Network Optimized** - Smart reconnection and keep-alive strategies maintain stable connections
- **Performance Monitoring** - Built-in statistics and metrics collection help you track performance

---

## Bundle Size Optimization

**Why Bundle Size Matters:** Every kilobyte of JavaScript must be downloaded, parsed, and executed before your application becomes interactive. Smaller bundles mean faster load times, especially on mobile networks or for users with slower connections.

### Understanding Tree-Shaking

📝 **What is Tree-Shaking?** Tree-shaking is the process of removing unused code from your final bundle. Think of it like shaking a tree to remove dead leaves - only the "live" code you actually use ends up in your application.

VueSip is built with ES modules (modern JavaScript module format) and supports tree-shaking out of the box. This means you only pay for what you use.

```typescript
// ✅ BEST PRACTICE: Import only what you need
// This allows your bundler to eliminate unused code
import { useSipClient, useCallSession } from 'vuesip'

// ❌ AVOID: Importing everything prevents tree-shaking
// Your bundle will include ALL of VueSip, even unused parts
import * as VueSip from 'vuesip'
```

💡 **Tip:** Modern bundlers like Vite, Webpack 5+, and Rollup automatically perform tree-shaking when using ES module imports.

### Managing External Dependencies

VueSip externalizes peer dependencies to avoid duplication and reduce bundle size:

```typescript
// package.json configuration
{
  "peerDependencies": {
    "vue": "^3.4.0"  // Your app provides Vue, not VueSip
  },
  "dependencies": {
    "jssip": "^3.10.0",          // SIP protocol implementation
    "webrtc-adapter": "^9.0.0"   // WebRTC compatibility layer
  }
}
```

📝 **Note:** When building your application, ensure peer dependencies are marked as external in your build configuration to prevent them from being bundled multiple times.

### Module Formats Explained

VueSip provides multiple module formats to support different build tools and environments:

```json
{
  "exports": {
    ".": {
      "import": "./dist/vuesip.js",      // ES Module (modern, tree-shakable)
      "require": "./dist/vuesip.cjs",    // CommonJS (legacy Node.js)
      "types": "./dist/index.d.ts"       // TypeScript type definitions
    }
  }
}
```

✅ **Recommendation:** Always use the ES module format (`import`) for optimal tree-shaking and smaller bundles.

### Build Optimization Strategy

📝 **What is Minification?** Minification removes whitespace, shortens variable names, and applies other transformations to reduce file size without changing functionality.

VueSip uses Vite with carefully tuned optimization settings:

```typescript
// vite.config.ts - VueSip's build configuration
export default defineConfig({
  build: {
    // Use Terser for minification (more aggressive than esbuild)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,    // Keep console.log for debugging
        drop_debugger: true,    // Remove debugger statements in production
      },
    },
    // Target modern browsers for smaller output
    // ES2020 = modern JavaScript features without polyfills
    target: 'es2020',
    // Generate source maps for debugging production issues
    sourcemap: true,
  }
})
```

### Bundle Size Targets

VueSip maintains strict size limits to ensure it stays lightweight:

```typescript
export const PERFORMANCE = {
  /** Maximum bundle size (minified) - raw JavaScript file */
  MAX_BUNDLE_SIZE: 150 * 1024,        // 150 KB

  /** Maximum bundle size (gzipped) - what users actually download */
  MAX_BUNDLE_SIZE_GZIPPED: 50 * 1024, // 50 KB
}
```

💡 **Context:** Gzipped size matters most because web servers compress files before sending them. 50 KB gzipped is roughly equivalent to a small image - very reasonable for a full-featured VoIP library.

### Lazy Loading Composables

For large applications with many features, you can load VueSip functionality on-demand rather than upfront:

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Only load conference functionality when needed
// This splits it into a separate chunk that loads on-demand
const loadConference = () => import('vuesip').then(m => m.useConference)

async function startConference() {
  // Conference code is downloaded only when this function runs
  const { useConference } = await import('vuesip')
  const conference = useConference(sipClient)
  await conference.createConference()
}
</script>
```

💡 **When to Use Lazy Loading:**
- Your app has features not all users need (e.g., conferencing)
- You want to minimize initial page load time
- You're building a large application with multiple sections

⚠️ **Trade-off:** Lazy loading reduces initial bundle size but adds a slight delay when loading features on-demand.

### Code Splitting Strategy

Split your SIP functionality across route boundaries so users only download what they need:

```typescript
// routes.ts - Vue Router configuration
const routes = [
  {
    path: '/call',
    // Call view loads only when user navigates to /call
    component: () => import('./views/CallView.vue'),
  },
  {
    path: '/conference',
    // Conference view loads only when user navigates to /conference
    component: () => import('./views/ConferenceView.vue'),
  },
]
```

✅ **Best Practice:** This is one of the most effective ways to reduce initial bundle size. A user making simple calls never downloads conference code.

---

## Memory Management

**Why Memory Management Matters:** Memory leaks cause applications to slow down over time and can crash browsers in long-running sessions. VoIP applications are particularly susceptible because they manage media streams, peer connections, and event listeners that must be properly cleaned up.

### Automatic Cleanup with Composables

The easiest way to avoid memory leaks is to use VueSip's composables, which automatically handle cleanup:

```vue
<script setup lang="ts">
import { useSipClient } from 'vuesip'

// Create SIP client
const sipClient = useSipClient(config)

// When this component unmounts, VueSip automatically:
// - Stops all media streams
// - Closes WebSocket connections
// - Removes all event listeners
// - Clears all timers and intervals
// You don't need to do anything!
</script>
```

✅ **Best Practice:** Always prefer composables over direct class instantiation. They integrate with Vue's lifecycle and handle cleanup automatically.

### Manual Resource Management

When using VueSip's classes directly (advanced usage), you're responsible for cleanup:

```typescript
import { SipClient, EventBus, MediaManager } from 'vuesip'

// Step 1: Create instances
const eventBus = new EventBus()
const sipClient = new SipClient(config, eventBus)
const mediaManager = new MediaManager({ eventBus })

// Step 2: Use instances for your application...

// Step 3: Clean up when done (e.g., on component unmount)
sipClient.stop()              // Disconnect from SIP server
mediaManager.destroy()        // Release media resources (camera, mic)
eventBus.removeAllListeners() // Prevent memory leaks from listeners
```

⚠️ **Warning:** Forgetting any of these cleanup calls will cause memory leaks in long-running applications.

### Media Stream Cleanup

Media streams (camera/microphone access) are a common source of memory leaks:

```typescript
import { useMediaDevices } from 'vuesip'

const { localStream, stopLocalStream } = useMediaDevices()

// ✅ Method 1: Use the built-in cleanup (recommended)
async function cleanup() {
  await stopLocalStream()  // Stops all tracks and releases devices
}

// ✅ Method 2: Manual cleanup (if needed)
function manualCleanup() {
  if (localStream.value) {
    // Stop each track individually
    localStream.value.getTracks().forEach(track => {
      track.stop()  // Releases camera/mic for other applications
    })
  }
}
```

💡 **Why This Matters:** If you don't stop media tracks, the camera/microphone indicator stays on in the browser, and the devices remain locked to your application.

### Event Listener Management

Event listeners that aren't removed continue to execute even after components unmount, causing memory leaks:

```typescript
import { EventBus } from 'vuesip'

const eventBus = new EventBus()

// Add a listener
const handler = (event) => console.log(event)
eventBus.on('call:incoming', handler)

// Remove specific listener (if you saved the reference)
eventBus.off('call:incoming', handler)

// Remove all listeners for a specific event
eventBus.removeAllListeners('call:incoming')

// Remove ALL listeners (cleanup before destroying)
eventBus.removeAllListeners()
```

✅ **Best Practice:** If you add event listeners manually, always remove them in Vue's `onUnmounted` hook.

### Call Session Cleanup

Call sessions automatically clean up all associated resources when terminated:

```typescript
import { useCallSession } from 'vuesip'

const { currentCall, hangup } = useCallSession()

// When you hang up, VueSip automatically cleans up:
// ✓ Media streams (camera/mic)
// ✓ RTCPeerConnection (WebRTC connection)
// ✓ Event listeners
// ✓ Timers and intervals
await hangup()
```

📝 **Note:** This automatic cleanup is another reason to prefer composables over direct class usage.

### Understanding Timer Management

Timers and intervals that aren't cleared continue running and consuming memory:

```typescript
// Example: MediaManager's cleanup process
destroy(): void {
  // Step 1: Stop all intervals
  this.stopStatsCollection()      // Clears statistics collection interval
  this.stopQualityAdjustment()    // Clears quality adjustment interval
  this.stopDeviceChangeMonitoring() // Removes device change listeners

  // Step 2: Close network connections
  this.closePeerConnection()      // Closes WebRTC peer connection

  // Step 3: Stop media streams
  this.stopLocalStream()          // Stops camera/microphone

  // Step 4: Clear state
  this.devices = []               // Release device references
  this.remoteStream = undefined   // Release remote stream reference
}
```

💡 **Learning Point:** Good cleanup follows a pattern: stop active processes → close connections → stop streams → clear references.

### Memory Limits

VueSip enforces memory limits to prevent runaway memory usage:

```typescript
export const PERFORMANCE = {
  /** Maximum memory per call in bytes (50 MB) */
  MAX_MEMORY_PER_CALL: 50 * 1024 * 1024,

  /** Maximum number of call history entries to store */
  DEFAULT_MAX_HISTORY_ENTRIES: 1000,
}
```

You can configure these limits based on your application's needs:

```typescript
import { callStore } from 'vuesip'

// Reduce history to 500 entries to save memory
// Useful for applications with many calls
callStore.setMaxHistoryEntries(500)
```

💡 **When to Adjust:** Lower the history limit if you're building a call center application with hundreds of calls per day.

### Monitoring Memory Usage

During development, monitor memory usage to catch leaks early:

```typescript
// Check memory usage (Chrome DevTools)
// Note: Only available in Chrome and Edge
if (performance.memory) {
  const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024
  const totalMB = performance.memory.totalJSHeapSize / 1024 / 1024
  const limitMB = performance.memory.jsHeapSizeLimit / 1024 / 1024

  console.log(`Used: ${usedMB.toFixed(2)} MB`)
  console.log(`Total: ${totalMB.toFixed(2)} MB`)
  console.log(`Limit: ${limitMB.toFixed(2)} MB`)
}
```

⚠️ **Warning:** If memory usage continuously grows after making and ending calls, you have a memory leak.

---

## Concurrent Call Handling

**Why This Matters:** Supporting multiple simultaneous calls is essential for many VoIP applications (call centers, conferencing, call forwarding). However, each call consumes CPU, memory, and network bandwidth. Proper management ensures your application remains responsive.

### Maximum Concurrent Calls

VueSip limits concurrent calls by default to maintain performance:

```typescript
import { callStore } from 'vuesip'

// Default limit: 4 concurrent calls
// This balances functionality with performance
const DEFAULT_MAX_CONCURRENT_CALLS = 4

// Check if at limit before making new calls
if (callStore.isAtMaxCalls) {
  console.log('Cannot make call: at maximum concurrent calls')
  // Show user message or queue the call
}

// Get current active call count
console.log(`Active calls: ${callStore.activeCallCount}`)
```

💡 **Why 4 Calls?** Most browsers can handle 4 simultaneous WebRTC connections efficiently. Beyond that, you risk audio/video quality degradation.

### Call Queue Management

When at capacity, queue incoming calls rather than rejecting them:

```typescript
import { useCallSession } from 'vuesip'

const { incomingCalls, answerCall } = useCallSession()

// Monitor the incoming call queue
watch(incomingCalls, (calls) => {
  if (calls.length > 0) {
    console.log(`${calls.length} calls waiting in queue`)

    // Answer first call in queue (FIFO approach)
    const firstCall = calls[0]
    answerCall(firstCall.id)
  }
})
```

✅ **Best Practice:** Implement a queue system for call centers where multiple calls arrive simultaneously.

### Conference Calls for Multiple Participants

For many participants, use conference calls instead of multiple individual calls:

```typescript
import { useConference } from 'vuesip'

const sipClient = useSipClient(config)
const conference = useConference(sipClient)

// Create a conference (more efficient than multiple peer-to-peer calls)
const conferenceId = await conference.createConference({
  maxParticipants: 10,  // Set reasonable limits
  locked: false,        // Allow new participants
  recording: false,     // Disable if not needed (saves bandwidth)
})

// Add participants to the conference
await conference.addParticipant('sip:user1@example.com')
await conference.addParticipant('sip:user2@example.com')

// Monitor participant count
watch(() => conference.participantCount.value, (count) => {
  console.log(`Conference has ${count} participants`)

  // Warn if approaching limit
  if (count >= 8) {
    console.warn('Conference approaching participant limit')
  }
})
```

💡 **Why Conferences Are Better:** One conference with 10 people uses fewer resources than 10 separate peer-to-peer calls.

### Call State Management

Efficiently access and manage call state:

```typescript
import { callStore } from 'vuesip'

// Access active calls (Map structure for O(1) lookup)
const activeCalls = callStore.activeCalls        // Map<string, CallSession>
const callsArray = callStore.activeCallsArray    // CallSession[] for iteration

// Get a specific call by ID
const call = callStore.getCall('call-id-123')
if (call) {
  console.log(`Call status: ${call.status}`)
}

// Get only established (active) calls
// Excludes calls that are ringing or connecting
const establishedCalls = callStore.establishedCalls

// Clean up terminated calls to free memory
callStore.removeCall('call-id-123')
```

### Performance Considerations for Multiple Calls

**Guidelines for Concurrent Calls:**

1. **Limit Active Calls** - Set a reasonable maximum based on your use case (default: 4)
   ```typescript
   // Before making a call
   if (callStore.activeCallCount >= 4) {
     showError('Maximum calls reached. Please end a call first.')
     return
   }
   ```

2. **Use Call Queuing** - Queue incoming calls instead of rejecting them outright
3. **Monitor Resources** - Check CPU and memory usage with Chrome DevTools
4. **Clean Up Terminated Calls** - Remove ended calls from the store promptly
5. **Optimize Media Settings** - Consider audio-only for multiple simultaneous calls

```typescript
// Example: Intelligent call rejection
import { useCallSession } from 'vuesip'

const { onIncomingCall } = useCallSession()

onIncomingCall((call) => {
  if (callStore.activeCallCount >= 4) {
    // Send 486 Busy Here response
    call.reject()
    console.log('Rejected call: at capacity')
  } else {
    // Accept call (add to queue or answer immediately)
    callStore.addIncomingCall(call.id)
  }
})
```

⚠️ **Warning:** Each active call consumes approximately 50 MB of memory and 5-15% CPU. Monitor your application's resource usage.

---

## Network Optimization

**Why Network Optimization Matters:** VoIP is extremely sensitive to network conditions. Poor network optimization leads to dropped calls, audio cutting out, and frustrated users. VueSip provides sophisticated network management to ensure stable, reliable connections.

### Connection Management

VueSip's TransportManager handles WebSocket connections with built-in resilience:

```typescript
const transportConfig = {
  // WebSocket server URL (secure WebSocket)
  url: 'wss://sip.example.com:7443',

  // How long to wait for connection before timing out
  connectionTimeout: 10000,  // 10 seconds

  // How many times to retry connecting after failure
  maxReconnectionAttempts: 5,

  // Send keep-alive packets every 30 seconds
  // Prevents firewalls/proxies from closing idle connections
  keepAliveInterval: 30000,

  // Type of keep-alive: 'crlf' (lightweight) or 'options' (SIP OPTIONS)
  keepAliveType: 'crlf',

  // Automatically reconnect if connection drops
  autoReconnect: true,
}
```

💡 **Real-World Scenario:** A user's phone switches from WiFi to cellular data. With `autoReconnect: true`, VueSip automatically reconnects without user intervention.

### Understanding Exponential Backoff

📝 **What is Exponential Backoff?** When reconnection fails, VueSip waits longer before each retry. This prevents overwhelming a struggling server with connection attempts.

```typescript
// Reconnection delay pattern
const RECONNECTION_DELAYS = [2000, 4000, 8000, 16000, 32000] // milliseconds

// How it works:
// Attempt 1: Wait 2 seconds before retry
// Attempt 2: Wait 4 seconds before retry
// Attempt 3: Wait 8 seconds before retry
// Attempt 4: Wait 16 seconds before retry
// Attempt 5: Wait 32 seconds before retry (final attempt)
```

💡 **Why This Helps:** If 1000 users lose connection simultaneously, exponential backoff staggers reconnection attempts, preventing server overload.

### Keep-Alive Strategies

Keep-alive packets prevent firewalls and proxies from closing idle connections:

#### CRLF Keep-Alive (Recommended)

```typescript
import { useSipClient } from 'vuesip'

const sipClient = useSipClient({
  uri: 'wss://sip.example.com:7443',
  wsOptions: {
    keepAliveType: 'crlf',        // Send CRLF (carriage return + line feed)
    keepAliveInterval: 30000,     // Every 30 seconds
  }
})
```

✅ **Why CRLF?** It's extremely lightweight (2 bytes) and keeps the connection alive without SIP protocol overhead.

#### OPTIONS Keep-Alive (Alternative)

```typescript
const sipClient = useSipClient({
  uri: 'wss://sip.example.com:7443',
  wsOptions: {
    keepAliveType: 'options',     // Send SIP OPTIONS request
    keepAliveInterval: 30000,
  }
})
```

📝 **When to Use OPTIONS:** Some SIP servers require proper SIP messages for keep-alive. Check your server's requirements.

### ICE Optimization

📝 **What is ICE?** Interactive Connectivity Establishment (ICE) is the process of finding the best path for audio/video between two peers, especially through firewalls and NAT.

```typescript
const rtcConfiguration = {
  iceServers: [
    // STUN server: helps discover your public IP address
    { urls: 'stun:stun.l.google.com:19302' },

    // TURN server: relays traffic when direct connection fails
    // Required for users behind strict firewalls
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass',
    },
  ],

  // ICE transport policy
  // 'all': Try direct connection first, use TURN as fallback
  // 'relay': Force all traffic through TURN (more privacy, higher latency)
  iceTransportPolicy: 'all',

  // Bundle policy: 'max-bundle' reduces ICE candidates
  // All media goes through one network connection (more efficient)
  bundlePolicy: 'max-bundle',

  // RTCP Mux: Combine RTP and RTCP on same port (saves network resources)
  rtcpMuxPolicy: 'require',
}
```

💡 **Cost Consideration:** TURN servers relay all your traffic and can be expensive. Use STUN when possible; TURN as fallback.

### ICE Gathering Timeout

VueSip prevents indefinite waiting during ICE candidate gathering:

```typescript
export const ICE_GATHERING_TIMEOUT = 5000  // 5 seconds

// If ICE gathering takes longer than 5 seconds, proceed anyway
// This prevents calls from hanging indefinitely
```

⚠️ **What This Means:** If optimal ICE candidates aren't ready after 5 seconds, VueSip proceeds with whatever candidates are available. This trades optimal quality for reliability.

### SDP Optimization

📝 **What is SDP?** Session Description Protocol describes media capabilities (codecs, formats) negotiated between peers.

```typescript
import { useCallSession } from 'vuesip'

const { makeCall } = useCallSession()

// Make call with optimized audio settings
await makeCall('sip:user@example.com', {
  mediaConstraints: {
    audio: {
      echoCancellation: true,     // Remove echo (essential for VoIP)
      noiseSuppression: true,     // Reduce background noise
      autoGainControl: true,      // Normalize volume levels
      sampleRate: 48000,          // High quality audio (48 kHz)
      channelCount: 1,            // Mono saves ~50% bandwidth vs stereo
    },
    video: false,  // Audio-only uses ~10x less bandwidth than video
  },
})
```

✅ **Best Practice:** Use audio-only calls when video isn't necessary. This significantly improves performance and reliability.

### Bandwidth Management

Understanding codec efficiency helps you optimize bandwidth usage:

```typescript
// Audio codec preferences (ordered by efficiency)
const AUDIO_CODECS = [
  'opus',   // BEST: Adaptive bitrate, excellent quality, 6-510 Kbps
  'G722',   // GOOD: Wideband audio, 64 Kbps
  'PCMU',   // OK: G.711 µ-law, 64 Kbps
  'PCMA',   // OK: G.711 A-law, 64 Kbps
]

// Video codec preferences
const VIDEO_CODECS = [
  'VP8',    // Required by WebRTC, good quality
  'VP9',    // Better compression than VP8 (~30% savings)
  'H264',   // Widely supported, hardware acceleration
]
```

💡 **Opus Codec:** Opus is the best choice for VoIP. It dynamically adjusts quality based on network conditions, using less bandwidth when needed.

### Network Quality Monitoring

Monitor real-time network statistics to detect and respond to quality issues:

```typescript
import { useCallSession } from 'vuesip'

const { currentCall, statistics } = useCallSession()

// Statistics update every second
watch(statistics, (stats) => {
  if (stats) {
    const audioQuality = {
      packetsLost: stats.audio.packetsLost,      // How many packets didn't arrive
      packetsSent: stats.audio.packetsSent,      // Total packets sent
      jitter: stats.audio.jitter,                // Variation in packet arrival (ms)
      roundTripTime: stats.network.roundTripTime, // Latency (ms)
    }

    console.log('Audio quality:', audioQuality)

    // Alert on poor quality
    if (stats.audio.packetsLost > 100) {
      console.warn('High packet loss detected - poor call quality likely')
      // Could trigger automatic quality adjustment
    }

    // Calculate packet loss percentage
    const lossPercent = (stats.audio.packetsLost / stats.audio.packetsSent) * 100
    if (lossPercent > 5) {
      console.warn(`${lossPercent.toFixed(2)}% packet loss`)
    }
  }
})
```

📝 **Understanding Metrics:**
- **Packet Loss:** Acceptable <1%, noticeable >5%, unusable >10%
- **Jitter:** Acceptable <30ms, noticeable >50ms
- **Round Trip Time:** Good <100ms, acceptable <300ms, poor >500ms

---

## State Persistence Optimization

**Why State Persistence Matters:** Persisting application state (call history, user preferences, registration data) improves user experience by maintaining state across sessions. However, inefficient persistence can cause performance issues like UI lag during saves or slow application startup.

### Understanding Storage Adapters

VueSip provides two storage adapters with different performance characteristics:

#### LocalStorage Adapter

```typescript
import { LocalStorageAdapter } from 'vuesip'

const adapter = new LocalStorageAdapter({
  prefix: 'vuesip',      // Namespace your keys
  version: '1.0.0',      // Support versioning for migrations
})

// LocalStorage characteristics:
// ✅ Synchronous (no async/await needed)
// ✅ Simple API
// ✅ Good for small data (< 5 MB)
// ❌ Blocks main thread during operations
// ❌ Limited to ~5-10 MB depending on browser
```

✅ **Best For:** Configuration, user preferences, small datasets

#### IndexedDB Adapter

```typescript
import { IndexedDBAdapter } from 'vuesip'

const adapter = new IndexedDBAdapter({
  dbName: 'vuesip-storage',
  version: 1,
})

// IndexedDB characteristics:
// ✅ Asynchronous (non-blocking)
// ✅ Large storage capacity (50+ MB, often hundreds of MB)
// ✅ Structured data with indexes
// ✅ Transaction support
// ❌ More complex API
// ❌ Slightly slower for tiny operations
```

✅ **Best For:** Call history, recordings, large datasets

💡 **Performance Tip:** Use IndexedDB for call history (can grow to thousands of entries) and LocalStorage for configuration (typically < 100 KB).

### Debounced Auto-Save

VueSip's persistence system uses debouncing to batch state updates and reduce write frequency:

```typescript
import { usePersistence } from 'vuesip'
import { callStore } from 'vuesip'

// Configure persistence with debouncing
const persistence = usePersistence(callStore, adapter, {
  // Wait 300ms after last change before saving
  // If more changes occur within 300ms, the timer resets
  debounce: 300,  // milliseconds

  // Auto-load state on initialization
  autoLoad: true,
})
```

📝 **What is Debouncing?** If your app makes 10 state changes in 200ms, debouncing saves only once (300ms after the last change) instead of 10 times. This dramatically reduces write operations.

**Example Without Debouncing:**
```typescript
// ❌ BAD: Each change triggers immediate save
callStore.addCall(call1)     // Save #1
callStore.addCall(call2)     // Save #2
callStore.addCall(call3)     // Save #3
// Result: 3 storage writes in quick succession (blocks UI)
```

**Example With Debouncing (300ms):**
```typescript
// ✅ GOOD: Changes are batched
callStore.addCall(call1)     // Start timer
callStore.addCall(call2)     // Reset timer
callStore.addCall(call3)     // Reset timer
// Wait 300ms with no changes...
// Result: 1 storage write with all changes (smooth UI)
```

### Adjusting Debounce Timing

Choose debounce timing based on your use case:

```typescript
// Short debounce (100ms) - Frequent saves, minimal batching
// Good for: Critical data that must be saved quickly
const fastPersistence = usePersistence(store, adapter, {
  debounce: 100,
})

// Medium debounce (300ms) - Default, balanced
// Good for: Most applications
const balancedPersistence = usePersistence(store, adapter, {
  debounce: 300,
})

// Long debounce (1000ms) - Maximum batching
// Good for: High-frequency updates (e.g., live statistics)
const batchedPersistence = usePersistence(store, adapter, {
  debounce: 1000,
})
```

⚠️ **Trade-off:** Longer debounce = better performance but higher risk of data loss if app crashes before save.

### Selective Persistence with Transformers

Optimize what you persist to reduce storage size and improve performance:

```typescript
import { usePersistence } from 'vuesip'
import { callStore } from 'vuesip'

const persistence = usePersistence(callStore, adapter, {
  debounce: 300,

  // Transform state before saving (reduce data size)
  serialize: (state) => {
    return {
      // Only persist completed calls, not active ones
      calls: state.calls.filter(call => call.status === 'ended'),

      // Limit call history to last 100 calls
      callHistory: state.callHistory.slice(-100),

      // Exclude runtime data that shouldn't persist
      // (activeCallCount, etc. will be recalculated)
    }
  },

  // Transform data when loading (restore full state)
  deserialize: (data) => {
    return {
      ...data,
      // Restore default values for runtime properties
      activeCalls: new Map(),
      activeCallCount: 0,
    }
  },
})
```

💡 **Why This Helps:**
- **Smaller storage footprint** - Only essential data is saved
- **Faster saves** - Less data to serialize and write
- **Faster loads** - Less data to read and deserialize
- **Better privacy** - Sensitive runtime data isn't persisted

### Storage Cleanup

Regularly clean up old data to maintain performance:

```typescript
import { LocalStorageAdapter, IndexedDBAdapter } from 'vuesip'

// Method 1: Clear all VueSip data
const adapter = new LocalStorageAdapter({ prefix: 'vuesip' })
await adapter.clear('vuesip')  // Removes all keys with 'vuesip' prefix

// Method 2: Selective cleanup (remove old call history)
import { callStore } from 'vuesip'

// Keep only last 30 days of call history
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
const recentCalls = callStore.callHistory.filter(call =>
  call.timestamp > thirtyDaysAgo
)
callStore.setCallHistory(recentCalls)

// Method 3: Manual storage quota management
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate()
  const usedMB = estimate.usage / 1024 / 1024
  const quotaMB = estimate.quota / 1024 / 1024

  console.log(`Storage: ${usedMB.toFixed(2)} MB / ${quotaMB.toFixed(2)} MB`)

  // Clean up if using more than 80% of quota
  if (estimate.usage / estimate.quota > 0.8) {
    console.warn('Storage quota nearly full, cleaning up...')
    // Trigger cleanup logic
  }
}
```

### Performance Impact of Storage Operations

Understanding the performance cost of different operations:

```typescript
// LocalStorage performance (synchronous, blocks main thread)
const start = performance.now()

// Small data (< 1 KB): ~0.5-1ms
localStorage.setItem('config', JSON.stringify(smallConfig))

// Medium data (~100 KB): ~5-15ms
localStorage.setItem('history', JSON.stringify(mediumHistory))

// Large data (~5 MB): ~100-300ms (AVOID - causes UI lag)
localStorage.setItem('recordings', JSON.stringify(largeData))

const duration = performance.now() - start
console.log(`LocalStorage write took ${duration.toFixed(2)}ms`)
```

```typescript
// IndexedDB performance (asynchronous, non-blocking)
const start = performance.now()

// Small data: ~2-5ms
await indexedDB.set('config', smallConfig)

// Large data (5 MB+): ~20-50ms (but doesn't block UI)
await indexedDB.set('recordings', largeData)

const duration = performance.now() - start
console.log(`IndexedDB write took ${duration.toFixed(2)}ms`)
```

📊 **Key Insight:** IndexedDB is slower for tiny operations but doesn't block the UI. For large data, always use IndexedDB.

### Best Practices for Storage Performance

**General Guidelines:**

1. **✅ Use IndexedDB for Large Data** - Call history, recordings, large datasets
   ```typescript
   // ✅ GOOD: IndexedDB for call history
   const historyAdapter = new IndexedDBAdapter({ dbName: 'vuesip-history' })
   usePersistence(callStore, historyAdapter)
   ```

2. **✅ Use LocalStorage for Small Config** - User preferences, settings
   ```typescript
   // ✅ GOOD: LocalStorage for small config
   const configAdapter = new LocalStorageAdapter({ prefix: 'vuesip-config' })
   ```

3. **✅ Enable Debouncing** - Batch updates to reduce write frequency
   ```typescript
   // ✅ GOOD: Debounced persistence
   usePersistence(store, adapter, { debounce: 300 })
   ```

4. **✅ Use Transformers** - Persist only necessary data
   ```typescript
   // ✅ GOOD: Filter before saving
   serialize: (state) => ({
     calls: state.calls.filter(c => c.status === 'ended').slice(-100)
   })
   ```

5. **✅ Clean Up Regularly** - Prevent unbounded growth
   ```typescript
   // ✅ GOOD: Periodic cleanup
   setInterval(() => {
     callStore.cleanupOldHistory(30) // Keep 30 days
   }, 24 * 60 * 60 * 1000) // Daily
   ```

6. **✅ Monitor Storage Usage** - Track quota consumption
   ```typescript
   // ✅ GOOD: Monitor storage
   async function checkStorageHealth() {
     const estimate = await navigator.storage.estimate()
     return (estimate.usage / estimate.quota) < 0.8  // < 80% is healthy
   }
   ```

### Storage Performance Checklist

Before deploying to production:

- [ ] **Use appropriate storage adapter** - IndexedDB for large data, LocalStorage for config
- [ ] **Configure debouncing** - At least 300ms for most use cases
- [ ] **Implement cleanup** - Remove old data regularly
- [ ] **Test with large datasets** - Ensure performance with 1000+ call history entries
- [ ] **Monitor storage quota** - Alert users before running out of space
- [ ] **Use transformers** - Persist only essential data
- [ ] **Encrypt sensitive data** - Use encryption for credentials and PII

💡 **Production Tip:** Monitor your application's storage usage in production to catch issues early:

```typescript
// Example: Storage monitoring service
class StorageMonitor {
  async reportUsage() {
    const estimate = await navigator.storage.estimate()

    analytics.track('storage_usage', {
      usedMB: estimate.usage / 1024 / 1024,
      quotaMB: estimate.quota / 1024 / 1024,
      percentUsed: (estimate.usage / estimate.quota * 100).toFixed(2),
    })
  }
}
```

---

## Performance Monitoring

**Why Monitor Performance:** You can't improve what you don't measure. Performance monitoring helps you identify bottlenecks, catch regressions, and ensure optimal user experience.

### Statistics Collection

VueSip automatically collects detailed performance statistics:

```typescript
import { MediaManager } from 'vuesip'

const mediaManager = new MediaManager({
  eventBus,
  // Enable automatic quality adjustment based on network conditions
  autoQualityAdjustment: true,
})

// Statistics collected every second
export const STATS_COLLECTION_INTERVAL = 1000
```

💡 **Automatic Quality Adjustment:** When enabled, VueSip reduces quality (e.g., bitrate) when network conditions degrade, maintaining a stable call.

### Available Metrics

VueSip provides comprehensive metrics for monitoring:

```typescript
interface MediaStatistics {
  audio: {
    packetsLost: number        // Packets that didn't arrive
    packetsSent: number        // Total packets sent
    packetsReceived: number    // Total packets received
    bytesSent: number          // Total bytes sent
    bytesReceived: number      // Total bytes received
    jitter: number             // Packet arrival time variation (ms)
    codecName?: string         // Codec being used (e.g., 'opus')
    bitrate?: number           // Current bitrate (bits per second)
  }

  video: {
    packetsLost: number        // Video packets lost
    framesSent: number         // Video frames sent
    framesReceived: number     // Video frames received
    framesDropped: number      // Frames dropped (performance issue)
    codecName?: string         // Video codec (e.g., 'VP8')
    bitrate?: number           // Video bitrate
  }

  network: {
    roundTripTime: number            // Latency in milliseconds
    availableOutgoingBitrate?: number // Estimated upload bandwidth
    availableIncomingBitrate?: number // Estimated download bandwidth
    currentRoundTripTime?: number     // Current RTT
  }

  timestamp: Date  // When these stats were collected
}
```

### Custom Performance Monitoring

Implement custom monitoring for specific metrics:

```typescript
import { EventBus } from 'vuesip'

const eventBus = new EventBus()

// Monitor call setup time (how long to establish connection)
let callStartTime: number

eventBus.on('call:outgoing', () => {
  callStartTime = Date.now()
})

eventBus.on('call:accepted', () => {
  const setupTime = Date.now() - callStartTime
  console.log(`Call setup time: ${setupTime}ms`)

  // Target: < 2 seconds for good UX
  if (setupTime > 2000) {
    console.warn('Call setup time exceeded target')
    // Could send to analytics service
  }
})

// Monitor event system performance
eventBus.on('*', (event) => {
  // Check how long it took for event to propagate
  const propagationTime = Date.now() - event.timestamp.getTime()

  // Events should propagate nearly instantly
  if (propagationTime > 10) {
    console.warn(`Slow event propagation: ${propagationTime}ms for ${event.type}`)
    // Indicates potential performance issues
  }
})
```

### Performance Targets

VueSip defines target metrics for optimal performance:

```typescript
export const PERFORMANCE = {
  /** Target call setup time: 2 seconds */
  // From makeCall() to hearing audio
  TARGET_CALL_SETUP_TIME: 2000,

  /** Maximum state update latency: 50ms */
  // Reactive state changes should be nearly instant
  MAX_STATE_UPDATE_LATENCY: 50,

  /** Maximum event propagation time: 10ms */
  // Events should dispatch and handle quickly
  MAX_EVENT_PROPAGATION_TIME: 10,

  /** Target CPU usage during call: 15% */
  // One active call should use minimal CPU
  TARGET_CPU_USAGE: 15,
}
```

💡 **Use These as Benchmarks:** If your application exceeds these targets, investigate potential performance issues.

---

## Performance Benchmarking

**Why Benchmark:** Benchmarking provides objective data about your application's performance, helps catch regressions during development, and guides optimization efforts.

### Call Setup Benchmark

Measure how long it takes to establish calls:

```typescript
async function benchmarkCallSetup() {
  const iterations = 10  // Run 10 calls for statistical significance
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()

    // Initiate call
    await makeCall('sip:test@example.com')

    // Wait for call to be accepted
    await new Promise(resolve => {
      eventBus.once('call:accepted', resolve)
    })

    const end = performance.now()
    times.push(end - start)

    // Clean up
    await hangup()

    // Wait between iterations to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Calculate statistics
  const average = times.reduce((a, b) => a + b) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)

  console.log(`Average call setup time: ${average.toFixed(2)}ms`)
  console.log(`Min: ${min.toFixed(2)}ms`)
  console.log(`Max: ${max.toFixed(2)}ms`)

  // Check against target
  if (average > 2000) {
    console.warn('⚠️ Call setup time exceeds 2-second target')
  } else {
    console.log('✅ Call setup time within target')
  }
}
```

### Memory Benchmark

Monitor memory usage to detect memory leaks:

```typescript
async function benchmarkMemory() {
  const measurements: number[] = []

  // Measure baseline memory (before any calls)
  if (performance.memory) {
    measurements.push(performance.memory.usedJSHeapSize)
  }

  // Make multiple calls and measure memory after each
  for (let i = 0; i < 5; i++) {
    await makeCall(`sip:user${i}@example.com`)

    if (performance.memory) {
      measurements.push(performance.memory.usedJSHeapSize)
    }
  }

  // Calculate memory usage per call
  const baseline = measurements[0]
  const final = measurements[measurements.length - 1]
  const memoryPerCall = (final - baseline) / 5

  console.log(`Baseline: ${(baseline / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Final: ${(final / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Memory per call: ${(memoryPerCall / 1024 / 1024).toFixed(2)} MB`)

  // Check against target (50 MB per call)
  if (memoryPerCall > 50 * 1024 * 1024) {
    console.warn('⚠️ Memory per call exceeds 50 MB target')
  } else {
    console.log('✅ Memory usage within target')
  }
}
```

⚠️ **Note:** `performance.memory` is only available in Chrome and Edge, not Firefox or Safari.

### Bundle Size Analysis

Analyze your bundle to identify optimization opportunities:

```bash
# Build your application
npm run build

# Check output file sizes
ls -lh dist/

# Example output:
# vuesip.js       145 KB (minified)
# vuesip.js.gz     48 KB (gzipped)

# Analyze bundle composition with visualizer
npx vite-bundle-visualizer
```

💡 **What to Look For:**
- Unexpectedly large dependencies
- Duplicate packages
- Opportunities for code splitting

### Comprehensive Performance Test Suite

Create a reusable test suite for regular performance testing:

```typescript
// performance-test.ts
import { useSipClient, useCallSession, callStore } from 'vuesip'

async function runPerformanceTests() {
  console.log('🚀 Starting VueSip Performance Tests...\n')

  // Test 1: Connection Speed
  console.log('1️⃣ Testing connection speed...')
  const connectionStart = performance.now()
  await sipClient.connect()
  const connectionTime = performance.now() - connectionStart
  console.log(`   ✓ Connection time: ${connectionTime.toFixed(2)}ms\n`)

  // Test 2: Registration Speed
  console.log('2️⃣ Testing registration speed...')
  const regStart = performance.now()
  await sipClient.register()
  const regTime = performance.now() - regStart
  console.log(`   ✓ Registration time: ${regTime.toFixed(2)}ms\n`)

  // Test 3: Call Setup Performance
  console.log('3️⃣ Testing call setup performance...')
  await benchmarkCallSetup()
  console.log()

  // Test 4: Concurrent Calls
  console.log('4️⃣ Testing concurrent calls...')
  const calls = []
  for (let i = 0; i < 4; i++) {
    calls.push(makeCall(`sip:test${i}@example.com`))
  }
  await Promise.all(calls)
  console.log(`   ✓ Active calls: ${callStore.activeCallCount}`)
  console.log(`   ✓ Memory usage: ${getMemoryUsage()}\n`)

  // Test 5: Memory Leak Detection
  console.log('5️⃣ Testing for memory leaks...')
  await testMemoryLeaks()

  console.log('\n✅ Performance tests complete!')
}

function getMemoryUsage(): string {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize
    return `${(used / 1024 / 1024).toFixed(2)} MB`
  }
  return 'N/A (not supported in this browser)'
}

async function testMemoryLeaks() {
  const iterations = 10
  const measurements: number[] = []

  // Make and end calls repeatedly
  for (let i = 0; i < iterations; i++) {
    await makeCall('sip:test@example.com')
    await hangup()

    if (performance.memory) {
      measurements.push(performance.memory.usedJSHeapSize)
    }
  }

  // Check for memory growth over iterations
  const first = measurements[0]
  const last = measurements[measurements.length - 1]
  const growth = ((last - first) / first * 100)

  console.log(`   Memory growth: ${growth.toFixed(2)}%`)

  // More than 10% growth indicates potential leak
  if (growth > 10) {
    console.warn('   ⚠️ WARNING: Potential memory leak detected!')
  } else {
    console.log('   ✅ No memory leaks detected')
  }
}

// Run the test suite
runPerformanceTests().catch(console.error)
```

💡 **Best Practice:** Run this test suite regularly (e.g., in CI/CD pipeline) to catch performance regressions early.

---

## Best Practices

### General Performance Guidelines

**Core Principles:**

1. **✅ Use Tree-Shaking** - Import only what you need to minimize bundle size
2. **✅ Clean Up Resources** - Always clean up media streams, connections, and listeners
3. **✅ Limit Concurrent Calls** - Set reasonable limits (default: 4) based on your use case
4. **✅ Monitor Statistics** - Track performance metrics in production
5. **✅ Prefer Audio-Only** - Video requires ~10x more resources than audio
6. **✅ Optimize ICE** - Use appropriate STUN/TURN servers for your network topology
7. **✅ Use Efficient Codecs** - Opus for audio, VP8/VP9 for video
8. **✅ Lazy Load Features** - Load features on-demand to reduce initial bundle size
9. **✅ Cache Configuration** - Reuse SIP client instances instead of recreating
10. **✅ Profile Regularly** - Use Chrome DevTools Performance tab to identify bottlenecks

### Production Readiness Checklist

Before deploying to production, verify:

- [ ] **Bundle size under 150 KB** (50 KB gzipped)
- [ ] **Tree-shaking enabled** in build configuration
- [ ] **Proper cleanup** in all components (no memory leaks)
- [ ] **Memory usage monitored** with performance benchmarks
- [ ] **Concurrent call limits** configured appropriately
- [ ] **Network reconnection** tested with simulated failures
- [ ] **Statistics collection** enabled for monitoring
- [ ] **Performance benchmarks** run and passing
- [ ] **Memory leak tests** passed
- [ ] **Production builds** optimized and minified

### Common Pitfalls to Avoid

#### ❌ Pitfall 1: Forgetting to Clean Up

```typescript
// ❌ BAD: No cleanup (memory leak)
const { connect } = useSipClient(config)
await connect()
// Component unmounts but connection stays open

// ✅ GOOD: Automatic cleanup with composable
// Composables automatically clean up on unmount

// ✅ GOOD: Manual cleanup when using classes
onUnmounted(() => {
  sipClient.stop()
})
```

#### ❌ Pitfall 2: Too Many Concurrent Calls

```typescript
// ❌ BAD: No limits, could make 20+ calls
for (let i = 0; i < users.length; i++) {
  await makeCall(`sip:user${i}@example.com`)
}

// ✅ GOOD: Respect limits
if (!callStore.isAtMaxCalls) {
  await makeCall(targetUri)
} else {
  console.log('At maximum calls, queueing...')
  queueCall(targetUri)
}
```

#### ❌ Pitfall 3: Not Monitoring Performance

```typescript
// ❌ BAD: No performance tracking
await makeCall(uri)

// ✅ GOOD: Monitor call setup time
const start = performance.now()
await makeCall(uri)
const setupTime = performance.now() - start
console.log(`Call setup: ${setupTime}ms`)

// Track in analytics
analytics.track('call_setup_time', { duration: setupTime })
```

#### ❌ Pitfall 4: Inefficient State Updates

```typescript
// ❌ BAD: Direct mutation (bypasses reactivity)
activeCalls.value.push(newCall)

// ✅ GOOD: Use store methods (proper reactivity)
callStore.addCall(newCall)
```

#### ❌ Pitfall 5: Importing Entire Library

```typescript
// ❌ BAD: Imports everything (no tree-shaking)
import * as VueSip from 'vuesip'
const client = VueSip.useSipClient(config)

// ✅ GOOD: Named imports (tree-shakable)
import { useSipClient } from 'vuesip'
const client = useSipClient(config)
```

### Performance Optimization Workflow

**Follow this iterative process:**

1. **📊 Measure** - Use Chrome DevTools to identify bottlenecks
   - Performance tab for CPU usage
   - Memory tab for memory leaks
   - Network tab for bandwidth usage

2. **🔍 Analyze** - Understand what's causing issues
   - Bundle size too large?
   - Memory usage growing?
   - Network quality poor?

3. **⚡ Optimize** - Apply relevant optimizations
   - Implement tree-shaking
   - Add lazy loading
   - Fix memory leaks

4. **✅ Test** - Verify improvements with benchmarks
   - Run performance test suite
   - Compare before/after metrics

5. **📈 Monitor** - Track metrics in production
   - Set up error tracking
   - Monitor performance metrics
   - Alert on regressions

6. **🔄 Iterate** - Continuously improve
   - Review metrics regularly
   - Optimize new bottlenecks
   - Update based on user feedback

---

## Conclusion

VueSip is optimized for performance out of the box, providing you with a solid foundation for building high-quality VoIP applications. By understanding and applying these optimization techniques, you can ensure your application:

- **Loads quickly** with minimal bundle size
- **Runs efficiently** without memory leaks
- **Handles multiple calls** smoothly
- **Maintains stable connections** even on unreliable networks
- **Provides excellent user experience** with low latency and high quality

### Key Takeaways

💡 **Use composables** - They handle cleanup automatically and integrate with Vue's lifecycle

💡 **Monitor performance** - You can't improve what you don't measure

💡 **Start simple** - Don't over-optimize prematurely. Profile first, then optimize what matters

💡 **Test regularly** - Run performance benchmarks in your CI/CD pipeline

### Next Steps

Now that you understand performance optimization, explore these related topics:

- [Getting Started](./getting-started.md) - Set up your first VueSip application
- [Making Calls](./making-calls.md) - Learn call management patterns
- [Device Management](./device-management.md) - Optimize media device handling
- [API Reference](/api/) - Detailed API documentation

**Remember:** Performance optimization is an ongoing process. Regular monitoring and testing ensure your application maintains optimal performance as it grows and evolves.
