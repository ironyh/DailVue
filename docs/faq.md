# Frequently Asked Questions

Common questions and answers about VueSip. Can't find what you're looking for? Ask in [GitHub Discussions](https://github.com/ironyh/VueSip/discussions).

## General Questions

### What is VueSip?

VueSip is a headless Vue.js component library for building SIP/VoIP applications. It provides Vue 3 composables that handle the complex SIP protocol and WebRTC logic, while giving you complete control over your UI.

**Headless** means VueSip doesn't impose any UI components or styles - you bring your own design and components. VueSip handles the business logic, state management, and SIP/WebRTC communication.

### Why choose VueSip over other solutions?

- **Vue 3 Native:** Built specifically for Vue 3 with Composition API
- **Type-Safe:** Complete TypeScript support with excellent IntelliSense
- **Headless:** Full UI control - no fighting pre-built components
- **Modern:** Uses latest WebRTC and Vue 3 features
- **Composable:** Use only what you need
- **Production-Ready:** Comprehensive error handling and testing

### What SIP servers does VueSip support?

VueSip works with any SIP server that supports WebRTC and WebSocket transport:

- **Asterisk** (16.0+) with `chan_pjsip` and WebSocket
- **FreeSWITCH** with `mod_verto` or WebSocket-enabled `mod_sofia`
- **Kamailio** with WebSocket module
- **OpenSIPS** with WebSocket support
- Any other SIP server with WebRTC/WebSocket support

### Is VueSip free to use?

Yes! VueSip is open source and released under the MIT license. You can use it freely in both personal and commercial projects.

### What browsers does VueSip support?

VueSip supports all modern browsers with WebRTC:

- Chrome/Chromium 74+
- Firefox 66+
- Safari 14.1+
- Edge 79+

**Note:** Internet Explorer is not supported as it lacks WebRTC.

---

## Getting Started

### How do I install VueSip?

```bash
npm install vuesip
# or
pnpm add vuesip
# or
yarn add vuesip
```

See the [Getting Started Guide](/guide/getting-started) for complete setup instructions.

### Do I need a SIP server to use VueSip?

Yes. VueSip is a SIP client library, so you need a SIP server to handle call routing, registration, and media relay. You can:

- Use a cloud SIP provider (Twilio, Vonage, etc.)
- Set up your own server (Asterisk, FreeSWITCH)
- Use a hosted PBX solution

### Can I use VueSip without TypeScript?

Yes! While VueSip is written in TypeScript and provides excellent type definitions, you can use it in plain JavaScript Vue projects. The types are optional but recommended for better developer experience.

### What Vue version is required?

VueSip requires **Vue 3.4.0 or higher**. It uses Vue 3's Composition API and is not compatible with Vue 2.

---

## Configuration & Setup

### How do I configure the SIP client?

```typescript
import { useSipClient } from 'vuesip'

const { connect } = useSipClient()

await connect({
  uri: 'sip:1000@example.com',        // Your SIP address
  password: 'your-password',           // SIP password
  server: 'wss://sip.example.com:7443', // WebSocket server URL
  displayName: 'Your Name'             // Optional display name
})
```

See [Getting Started](/guide/getting-started) for more configuration options.

### What is the WebSocket URL format?

WebSocket URLs follow this format:

- **Secure (recommended):** `wss://sip.example.com:8089/ws`
- **Insecure (development only):** `ws://sip.example.com:8088/ws`

Always use `wss://` (secure WebSocket) in production. Some browsers require HTTPS for microphone/camera access.

### How do I handle SIP server credentials securely?

**Never hardcode credentials!** Use environment variables:

```typescript
// vite.config.ts or .env
VITE_SIP_URI=sip:1000@example.com
VITE_SIP_PASSWORD=your-password
VITE_SIP_SERVER=wss://sip.example.com:7443

// In your app
const { connect } = useSipClient()

await connect({
  uri: import.meta.env.VITE_SIP_URI,
  password: import.meta.env.VITE_SIP_PASSWORD,
  server: import.meta.env.VITE_SIP_SERVER
})
```

For production, use a backend authentication service instead of storing credentials client-side.

---

## Calling Features

### How do I make a call?

```typescript
import { useCallSession } from 'vuesip'

const { makeCall } = useCallSession()

// Simple audio call
await makeCall('sip:2000@example.com')

// Video call
await makeCall('sip:2000@example.com', {
  mediaConstraints: {
    audio: true,
    video: true
  }
})
```

See [Making Calls Guide](/guide/making-calls) for more details.

### How do I receive incoming calls?

```vue
<script setup>
import { useCallSession } from 'vuesip'

const { currentCall, answer, reject } = useCallSession()

// Watch for incoming calls
watch(currentCall, (call) => {
  if (call?.direction === 'incoming' && call.state === 'ringing') {
    // Show UI to answer/reject
  }
})
</script>

<template>
  <div v-if="currentCall?.direction === 'incoming'">
    <p>Incoming call from {{ currentCall.remoteUri }}</p>
    <button @click="answer()">Answer</button>
    <button @click="reject()">Reject</button>
  </div>
</template>
```

See [Receiving Calls Guide](/guide/receiving-calls) for more details.

### Can I handle multiple simultaneous calls?

Yes! See the [Multi-Line Phone Example](/examples/#multi-line-phone) which demonstrates handling up to 5 concurrent calls.

For multiple calls, you'll need to manage multiple call sessions and implement call switching logic.

### How do I add video to a call?

```typescript
const { makeCall } = useCallSession()

await makeCall('sip:2000@example.com', {
  mediaConstraints: {
    audio: true,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  }
})
```

See [Video Calling Guide](/guide/video-calling) for complete video calling documentation.

### How do I send DTMF tones?

```typescript
import { useDTMF } from 'vuesip'

const { sendDTMF, sendDTMFSequence } = useDTMF()

// Send single digit
await sendDTMF('1')

// Send sequence
await sendDTMFSequence('1234')
```

See [Call Controls Guide](/guide/call-controls#dtmf-tones) for more details.

### How do I transfer a call?

```typescript
import { useCallControls } from 'vuesip'

const { transfer, attendedTransfer } = useCallControls()

// Blind transfer
await transfer('sip:3000@example.com')

// Attended transfer (consult first)
await attendedTransfer('sip:3000@example.com')
```

See [Call Controls Guide](/guide/call-controls#call-transfer) for transfer documentation.

---

## Media & Devices

### How do I access the microphone and camera?

VueSip automatically requests media permissions when you make or answer a call. You can also request permissions explicitly:

```typescript
import { useMediaDevices } from 'vuesip'

const { requestPermissions } = useMediaDevices()

// Request audio and video
await requestPermissions(true, true)

// Audio only
await requestPermissions(true, false)
```

See [Device Management Guide](/guide/device-management) for more details.

### How do I select audio/video devices?

```typescript
import { useMediaDevices } from 'vuesip'

const {
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  selectAudioInput,
  selectAudioOutput,
  selectVideoInput
} = useMediaDevices()

// Enumerate devices
await enumerateDevices()

// Select devices
selectAudioInput('microphone-device-id')
selectAudioOutput('speaker-device-id')
selectVideoInput('camera-device-id')
```

See [Device Management Guide](/guide/device-management#device-selection) for more details.

### Can I switch cameras during a call?

Yes, but with some limitations. You can switch cameras, but the implementation depends on properly replacing the video track in the peer connection:

```typescript
const { selectVideoInput } = useMediaDevices()

// Switch to different camera
await selectVideoInput('new-camera-device-id')
```

See the [Video Call Example](/examples/#video-call) for a working implementation.

### How do I implement screen sharing?

```typescript
import { useMediaDevices } from 'vuesip'

const { startScreenShare, stopScreenShare } = useMediaDevices()

// Start screen sharing
const screenStream = await startScreenShare()

// Stop screen sharing
stopScreenShare()
```

See [Video Calling Guide](/guide/video-calling#screen-sharing) for more details.

---

## Troubleshooting

### Why can't I connect to my SIP server?

**Common causes:**

1. **Wrong WebSocket URL**
   - Check URL format: `wss://server:port/path`
   - Verify server address and port
   - Check WebSocket endpoint path (often `/ws`)

2. **SSL certificate issues**
   - Use valid SSL certificate for `wss://`
   - Try `ws://` (insecure) for testing

3. **Firewall blocking connection**
   - Ensure WebSocket port is open
   - Check browser console for errors

4. **SIP server not configured for WebSocket**
   - Verify WebSocket transport is enabled
   - Check server logs

**Debug steps:**
```typescript
const { connect, error } = useSipClient()

try {
  await connect({ /* config */ })
} catch (err) {
  console.error('Connection failed:', err)
  console.error('Error details:', error.value)
}
```

### Why is there no audio during calls?

**Common causes:**

1. **Microphone permission denied**
   - Check browser permissions
   - Look for permission icon in address bar

2. **Wrong audio device selected**
   - Verify correct microphone/speaker selected
   - Test with different devices

3. **Codec mismatch**
   - Ensure SIP server supports WebRTC codecs (Opus, G.711)
   - Check codec negotiation in SDP

4. **Network/firewall issues**
   - Check if UDP ports for RTP are blocked
   - Verify STUN/TURN server configuration

**Debug steps:**
```typescript
// Check if local stream has audio
const { getLocalStream } = useMediaDevices()
const stream = getLocalStream()
const audioTracks = stream?.getAudioTracks()
console.log('Audio tracks:', audioTracks)
console.log('Track enabled:', audioTracks[0]?.enabled)
```

### Why can't I see video?

**Common causes:**

1. **Camera permission denied**
   - Check browser permissions
   - Grant camera access when prompted

2. **Camera in use by another app**
   - Close other apps using camera
   - Check if camera is available

3. **Video codec not supported**
   - Ensure server supports VP8, VP9, or H.264
   - Check browser codec support

4. **Video element not properly configured**
   - Verify video element has `autoplay` attribute
   - Check `srcObject` is set to stream

**Debug steps:**
```typescript
const { getLocalStream } = useMediaDevices()
const stream = getLocalStream()
const videoTracks = stream?.getVideoTracks()
console.log('Video tracks:', videoTracks)
console.log('Track settings:', videoTracks[0]?.getSettings())
```

### Why do calls fail immediately?

**Common causes:**

1. **Not registered with SIP server**
   - Ensure `isRegistered` is `true` before calling
   - Check registration status

2. **Invalid target URI**
   - Verify SIP URI format: `sip:user@domain`
   - Check target exists on server

3. **Network issues**
   - Check internet connectivity
   - Verify server is reachable

4. **Server rejecting calls**
   - Check SIP server logs
   - Verify account permissions

**Debug steps:**
```typescript
const { makeCall } = useCallSession()
const { isRegistered } = useSipClient()

if (!isRegistered.value) {
  console.error('Not registered!')
  return
}

try {
  await makeCall('sip:2000@example.com')
} catch (err) {
  console.error('Call failed:', err)
}
```

### How do I debug WebRTC issues?

**Browser DevTools:**

1. **Chrome:** `chrome://webrtc-internals`
   - View detailed WebRTC statistics
   - See ICE candidates and connection state
   - Monitor media streams

2. **Firefox:** `about:webrtc`
   - Similar to Chrome's internals
   - View connection details

**Enable VueSip logging:**
```typescript
import { enableDebugLogging } from 'vuesip'

enableDebugLogging(true)
```

**Check console for errors:**
- Look for SIP errors (4xx, 5xx responses)
- Check for WebRTC errors (ICE failures)
- Monitor media errors

### Why is call quality poor?

**Common causes:**

1. **Network bandwidth insufficient**
   - Video calls need 500 kbps - 2 Mbps
   - Check network speed

2. **High CPU usage**
   - Close other applications
   - Reduce video quality

3. **Network latency/jitter**
   - Check ping to server
   - Use TURN server for better routing

**Optimize quality:**
```typescript
// Reduce video quality for better performance
await makeCall('sip:2000@example.com', {
  mediaConstraints: {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 }
    }
  }
})
```

See [Performance Guide](/guide/performance) for optimization tips.

---

## Advanced Topics

### How do I implement call recording?

```typescript
import { useCallRecording } from 'vuesip'

const { startRecording, stopRecording, recordings } = useCallRecording()

// Start recording
await startRecording()

// Stop recording
const blob = await stopRecording()

// Download recording
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'recording.webm'
a.click()
```

### How do I add presence/messaging?

```typescript
import { usePresence, useMessaging } from 'vuesip'

// Presence
const { publishPresence, subscribeToPresence } = usePresence()

await publishPresence('available')
await subscribeToPresence('sip:buddy@example.com')

// Messaging
const { sendMessage, onMessageReceived } = useMessaging()

await sendMessage('sip:buddy@example.com', 'Hello!')

onMessageReceived((message) => {
  console.log('Received:', message.body)
})
```

See [Presence & Messaging Guide](/guide/presence-messaging) for complete documentation.

### How do I persist call history?

```typescript
import { useCallHistory } from 'vuesip'

const {
  history,
  addToHistory,
  clearHistory,
  exportHistory
} = useCallHistory({
  storageType: 'localStorage', // or 'sessionStorage' or 'indexedDB'
  maxEntries: 1000,
  encrypted: true
})

// History is automatically tracked
// Export to JSON
const json = exportHistory('json')

// Export to CSV
const csv = exportHistory('csv')
```

See [Call History Guide](/guide/call-history) for more details.

### Can I use VueSip with Nuxt?

Yes! VueSip works with Nuxt 3. Since VueSip uses browser APIs (WebRTC), you'll need to:

1. **Import VueSip components client-side only:**

```vue
<script setup>
import { useSipClient } from 'vuesip'

// Only run on client
onMounted(() => {
  const { connect } = useSipClient()
  // ... rest of logic
})
</script>
```

2. **Or use `<ClientOnly>` wrapper:**

```vue
<template>
  <ClientOnly>
    <YourVueSipComponent />
  </ClientOnly>
</template>
```

### How do I handle network reconnection?

VueSip automatically handles reconnection, but you can customize the behavior:

```typescript
const { connect, disconnect, onDisconnected } = useSipClient()

// Listen for disconnection
onDisconnected(() => {
  console.log('Disconnected from server')

  // Attempt to reconnect
  setTimeout(async () => {
    try {
      await connect()
      console.log('Reconnected!')
    } catch (err) {
      console.error('Reconnection failed:', err)
    }
  }, 5000) // Retry after 5 seconds
})
```

### How do I customize SIP headers?

```typescript
const { makeCall } = useCallSession()

await makeCall('sip:2000@example.com', {
  customHeaders: [
    'X-Custom-Header: Value',
    'X-Another-Header: Another Value'
  ]
})
```

---

## Performance & Production

### How do I optimize bundle size?

VueSip is tree-shakeable. Import only what you need:

```typescript
// Good: Import only what you use
import { useSipClient, useCallSession } from 'vuesip'

// Avoid: Importing everything
import * as VueSip from 'vuesip'
```

See [Performance Guide](/guide/performance#bundle-size) for more optimization tips.

### Is VueSip production-ready?

Yes! VueSip includes:

- ✅ Comprehensive error handling
- ✅ Automatic reconnection
- ✅ Memory leak prevention
- ✅ Extensive testing
- ✅ TypeScript support
- ✅ Security best practices

See [Security Guide](/guide/security) and [Error Handling Guide](/guide/error-handling) for production considerations.

### How do I monitor call quality?

```typescript
import { useCallSession } from 'vuesip'

const { session, getStats } = useCallSession()

// Get WebRTC statistics
const stats = await getStats()

console.log('Audio stats:', stats.audio)
console.log('Video stats:', stats.video)
console.log('Bitrate:', stats.bitrate)
console.log('Packet loss:', stats.packetLoss)
```

### What are the performance considerations?

- **Memory:** Each active call uses ~10-50 MB depending on media
- **CPU:** Video encoding can be CPU-intensive
- **Network:** Video calls need 500 kbps - 2 Mbps bandwidth
- **Concurrent calls:** Limit based on device capabilities

See [Performance Guide](/guide/performance) for detailed recommendations.

---

## Support & Community

### Where can I get help?

- **Documentation:** [Browse the guides](/guide/)
- **API Reference:** [View API docs](/api/)
- **Examples:** [Check working examples](/examples/)
- **GitHub Issues:** [Report bugs](https://github.com/ironyh/VueSip/issues)
- **Discussions:** [Ask questions](https://github.com/ironyh/VueSip/discussions)

### How do I report a bug?

[Create an issue on GitHub](https://github.com/ironyh/VueSip/issues/new) with:

1. VueSip version
2. Browser and version
3. SIP server type
4. Steps to reproduce
5. Expected vs actual behavior
6. Console errors (if any)

### How can I contribute?

We welcome contributions! See the [Contributing Guide](https://github.com/ironyh/VueSip/blob/main/CONTRIBUTING.md) for:

- Code contributions
- Documentation improvements
- Bug reports
- Feature requests
- Example applications

### Is there a roadmap?

Yes! Check the [GitHub Projects](https://github.com/ironyh/VueSip/projects) for planned features and the [Changelog](https://github.com/ironyh/VueSip/releases) for release history.

---

## Still Have Questions?

Can't find your answer here? Try these resources:

- 📚 [Read the Guides](/guide/) - Comprehensive documentation
- 🔧 [Browse the API](/api/) - Detailed API reference
- 💡 [See Examples](/examples/) - Working code examples
- 💬 [Ask on GitHub Discussions](https://github.com/ironyh/VueSip/discussions)
- 🐛 [Report an Issue](https://github.com/ironyh/VueSip/issues)

We're here to help! 🚀
