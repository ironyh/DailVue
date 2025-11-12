# Examples

Learn VueSip by exploring working code examples. Each example demonstrates specific features and use cases, from simple audio calls to complex multi-line business phone systems.

## Available Examples

### 🎧 Basic Audio Call

A complete, production-ready example of a simple one-to-one audio calling application.

**Perfect for:**
- Getting started with VueSip
- Understanding core concepts
- Building simple softphones
- Click-to-call features

**Features:**
- SIP client connection and registration
- Make and receive audio calls
- Call controls (mute, hold, hangup)
- Audio device selection (microphone/speaker)
- Call state tracking and duration display
- Error handling and user feedback

**Technologies:**
- Vue 3 with Composition API
- TypeScript
- Vite

[View Basic Audio Call Example →](https://github.com/ironyh/VueSip/tree/main/examples/basic-audio-call)

---

### 🎥 Video Call

One-to-one video calling with camera selection, preview, and comprehensive call controls.

**Perfect for:**
- Video conferencing applications
- Remote collaboration tools
- Telemedicine platforms
- Video chat features

**Features:**
- Bidirectional video and audio calls
- Local video preview (picture-in-picture)
- Camera enumeration and selection
- Remote video display with proper aspect ratio
- Switch cameras during active calls
- Enable/disable video during calls
- All audio call features (mute, hold, etc.)
- Clean UI with responsive design

**Technologies:**
- Vue 3 with Composition API
- TypeScript
- WebRTC video APIs
- Vite

[View Video Call Example →](https://github.com/ironyh/VueSip/tree/main/examples/video-call)

---

### 📞 Multi-Line Phone

Advanced multi-line phone system supporting up to 5 concurrent calls with professional call management features.

**Perfect for:**
- Business phone systems
- Call centers
- Customer support applications
- Enterprise communications

**Features:**
- Up to 5 concurrent calls
- Visual call line management
- Call switching between lines
- Individual line controls (hold, mute, transfer)
- Automatic audio routing to active line
- Call history tracking
- DTMF support per line
- Incoming call alerts
- Call duration tracking per line

**Technologies:**
- Vue 3 with Composition API
- TypeScript
- Advanced state management
- Vite

[View Multi-Line Phone Example →](https://github.com/ironyh/VueSip/tree/main/examples/multi-line-phone)

---

### 🎤 Conference Call

Multi-party conference calling with participant management and moderation features.

**Perfect for:**
- Team meetings
- Conference bridges
- Group calling features
- Webinar platforms

**Features:**
- Multi-party audio/video conferences
- Participant management
- Mute individual participants
- Conference controls
- Participant list
- Join/leave notifications

**Technologies:**
- Vue 3 with Composition API
- TypeScript
- WebRTC conferencing
- Vite

[View Conference Call Example →](https://github.com/ironyh/VueSip/tree/main/examples/conference-call)

---

### 📞 Call Center

Professional call center application with queue management and agent features.

**Perfect for:**
- Customer service centers
- Support desk applications
- Sales teams
- Help desk systems

**Features:**
- Call queue management
- Agent status management
- Call routing
- Call metrics and statistics
- Wrap-up codes
- Call disposition

**Technologies:**
- Vue 3 with Composition API
- TypeScript
- Advanced call management
- Vite

[View Call Center Example →](https://github.com/ironyh/VueSip/tree/main/examples/call-center)

---

## Quick Comparison

| Example | Difficulty | Lines of Code | Key Composables | Use Case |
|---------|-----------|---------------|-----------------|----------|
| Basic Audio Call | Beginner | ~500 | useSipClient, useCallSession, useMediaDevices | Simple softphone |
| Video Call | Intermediate | ~800 | + video device management | Video conferencing |
| Multi-Line Phone | Advanced | ~1500 | + multi-session management | Business phone |
| Conference Call | Advanced | ~1200 | + useConference | Team meetings |
| Call Center | Advanced | ~1800 | + queue management | Customer service |

---

## Getting Started with Examples

### Prerequisites

All examples require:
- **Node.js** 20.0.0 or higher
- **pnpm** 8.0.0 or higher (or npm/yarn)
- **SIP Server** with WebSocket support
- **Browser** with WebRTC support

### Installation

Each example is a standalone application. To run an example:

```bash
# Navigate to the example directory
cd examples/basic-audio-call

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### SIP Server Configuration

All examples require a SIP server with WebSocket support. Compatible servers include:

- **Asterisk** (16.0+) with `chan_pjsip` and WebSocket transport
- **FreeSWITCH** with `mod_verto` or WebSocket-enabled `mod_sofia`
- **Kamailio** with WebSocket module
- **OpenSIPS** with WebSocket support

Example Asterisk configuration:

```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089

[webrtc-endpoint]
type=endpoint
context=default
disallow=all
allow=opus,ulaw
webrtc=yes
```

---

## Learning Path

### Path 1: Beginner → Intermediate

**Goal:** Build a functional video calling app

1. **Basic Audio Call** (2 hours)
   - Understand VueSip basics
   - Learn SIP connection and registration
   - Make your first call

2. **Video Call** (3 hours)
   - Add video capabilities
   - Manage cameras
   - Handle media streams

**Outcome:** Working video calling application

---

### Path 2: Beginner → Advanced

**Goal:** Build a business phone system

1. **Basic Audio Call** (2 hours)
   - Core concepts and basics

2. **Multi-Line Phone** (6 hours)
   - Multiple concurrent calls
   - Advanced state management
   - Professional call features

**Outcome:** Production-ready multi-line phone system

---

### Path 3: Advanced Integration

**Goal:** Build a complete call center

1. **Multi-Line Phone** (6 hours)
   - Master multi-session management

2. **Conference Call** (4 hours)
   - Learn conferencing features

3. **Call Center** (8 hours)
   - Integrate queue management
   - Add agent features
   - Implement metrics

**Outcome:** Full-featured call center application

---

## Common Patterns

### Pattern 1: Basic Setup

All examples follow this initialization pattern:

```vue
<script setup lang="ts">
import { useSipClient, useCallSession } from 'vuesip'

// Initialize SIP client
const {
  connect,
  disconnect,
  isConnected,
  isRegistered
} = useSipClient()

// Initialize call session
const {
  makeCall,
  answer,
  hangup,
  currentCall
} = useCallSession()

// Connect to SIP server
await connect({
  uri: 'sip:user@example.com',
  password: 'password',
  server: 'wss://sip.example.com:7443'
})
</script>
```

### Pattern 2: Making Calls

```typescript
// Simple call
await makeCall('sip:1234@example.com')

// Call with options
await makeCall('sip:1234@example.com', {
  mediaConstraints: {
    audio: true,
    video: true
  }
})
```

### Pattern 3: Handling Incoming Calls

```vue
<script setup>
const { currentCall, answer, reject } = useCallSession()

// Listen for incoming calls via event or watch currentCall
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

### Pattern 4: Device Management

```typescript
const {
  audioInputDevices,
  audioOutputDevices,
  selectAudioInput,
  selectAudioOutput
} = useMediaDevices()

// Request permissions
await requestPermissions(true, false) // audio: true, video: false

// Select devices
selectAudioInput(deviceId)
selectAudioOutput(deviceId)
```

---

## Integration Examples

### With UI Libraries

#### PrimeVue Integration

```vue
<script setup>
import { Button } from 'primevue/button'
import { InputText } from 'primevue/inputtext'
import { useSipClient, useCallSession } from 'vuesip'

const { connect, isConnected } = useSipClient()
const { makeCall } = useCallSession()

const phoneNumber = ref('')
</script>

<template>
  <div>
    <InputText
      v-model="phoneNumber"
      placeholder="Enter number"
    />
    <Button
      @click="makeCall(phoneNumber)"
      label="Call"
      icon="pi pi-phone"
      :disabled="!isConnected"
    />
  </div>
</template>
```

#### Vuetify Integration

```vue
<script setup>
import { useSipClient, useCallSession } from 'vuesip'

const { makeCall, hangup, currentCall } = useCallSession()
</script>

<template>
  <v-container>
    <v-text-field
      v-model="phoneNumber"
      label="Phone Number"
      prepend-icon="mdi-phone"
    />
    <v-btn
      v-if="!currentCall"
      @click="makeCall(phoneNumber)"
      color="primary"
    >
      Call
    </v-btn>
    <v-btn
      v-else
      @click="hangup()"
      color="error"
    >
      Hang Up
    </v-btn>
  </v-container>
</template>
```

---

## Testing the Examples

### Browser Testing

Test examples in multiple browsers:
- Chrome/Edge (Chromium) 74+
- Firefox 66+
- Safari 14.1+

### Two-User Testing

The easiest way to test calling functionality:

1. Open two browser windows/tabs
2. Register each with different SIP accounts (e.g., 1001 and 1002)
3. Make a call from one window to the other
4. Test all call features

### Echo Test

If your SIP server has an echo test extension:

1. Connect to your SIP server
2. Call the echo test number (commonly `*43` or `600` on Asterisk)
3. Speak into your microphone
4. Hear your voice echoed back

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to SIP server

**Solutions:**
- Verify WebSocket URL format (`wss://` or `ws://`)
- Check SIP credentials
- Ensure SIP server is running
- Check firewall rules
- Test with `ws://` (non-secure) first

### Audio Issues

**Problem:** No audio during calls

**Solutions:**
- Check browser microphone permissions
- Verify audio devices are selected
- Ensure remote party's audio is working
- Test with echo extension
- Check codec support on server

### Video Issues

**Problem:** Video not displaying

**Solutions:**
- Check camera permissions
- Verify camera is not in use by another app
- Ensure SIP server supports video codecs (VP8, H.264)
- Check WebRTC ICE/STUN configuration

---

## Production Deployment

Before deploying examples to production:

### Security

- ✅ Use WSS (WebSocket Secure) only
- ✅ Never hardcode credentials
- ✅ Implement proper authentication
- ✅ Sanitize all user inputs
- ✅ Use environment variables for config

### Performance

- ✅ Optimize bundle size
- ✅ Implement code splitting
- ✅ Monitor memory usage
- ✅ Handle network reconnection
- ✅ Add error logging

### User Experience

- ✅ Add loading states
- ✅ Provide user-friendly error messages
- ✅ Test on target devices
- ✅ Ensure accessibility
- ✅ Add keyboard shortcuts

---

## Source Code

All examples are available in the VueSip repository:

[View Examples on GitHub →](https://github.com/ironyh/VueSip/tree/main/examples)

Each example includes:
- Complete source code
- Detailed README
- Setup instructions
- Configuration examples
- Testing guidelines

---

## Next Steps

1. **Choose an example** based on your use case
2. **Follow the setup instructions** in each example's README
3. **Configure your SIP server** for WebRTC support
4. **Run the example** and test features
5. **Customize** for your needs
6. **Read the guides** for deeper understanding:
   - [Getting Started Guide](/guide/getting-started)
   - [API Reference](/api/)
   - [FAQ](/faq)

---

## Contributing Examples

Have an example to share? We welcome contributions!

- Fork the repository
- Create your example in `examples/your-example-name/`
- Include a comprehensive README
- Submit a pull request

[Contribution Guidelines →](https://github.com/ironyh/VueSip/blob/main/CONTRIBUTING.md)

---

## Support

Need help with the examples?

- **Documentation:** [Read the guides](/guide/)
- **API Reference:** [Browse the API](/api/)
- **Issues:** [Report bugs](https://github.com/ironyh/VueSip/issues)
- **Discussions:** [Ask questions](https://github.com/ironyh/VueSip/discussions)
