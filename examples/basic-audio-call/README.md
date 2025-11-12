# Basic Audio Call Example

A complete, production-ready example demonstrating how to build a simple one-to-one audio call application using VueSip composables.

## Overview

This example showcases the core functionality of VueSip for building SIP-based voice calling applications:

- **SIP Client Connection** - Connect to a SIP server via WebSocket
- **User Registration** - Register as a SIP user with credentials
- **Outgoing Calls** - Initiate audio calls to other SIP users
- **Incoming Calls** - Receive and answer incoming calls
- **Call Controls** - Mute, hold, and hangup functionality
- **Audio Device Management** - Select microphone and speaker devices
- **Call State Display** - Real-time call state and duration tracking
- **Error Handling** - Proper error handling and user feedback

## Prerequisites

Before running this example, ensure you have:

1. **Node.js** - Version 20.0.0 or higher
2. **pnpm** - Version 8.0.0 or higher (or npm/yarn)
3. **SIP Server** - Access to a SIP server with WebSocket support (e.g., Asterisk, FreeSWITCH, Kamailio)
4. **SIP Credentials** - Valid SIP account credentials (URI, password)

### SIP Server Requirements

Your SIP server must support:
- WebSocket transport (WSS or WS)
- Audio codecs (e.g., G.711, Opus)
- WebRTC media handling

**Example SIP Servers:**
- **Asterisk** with `chan_pjsip` and `res_http_websocket`
- **FreeSWITCH** with `mod_verto` or `mod_sofia` WebSocket support
- **Kamailio** with WebSocket module

## Installation

1. **Navigate to the example directory:**

```bash
cd examples/basic-audio-call
```

2. **Install dependencies:**

```bash
pnpm install
```

This will install all necessary dependencies including Vue 3, Vite, TypeScript, and the VueSip library from the workspace.

## Configuration

Before running the application, you'll need to configure your SIP server settings. The application provides a connection form in the UI, but you can also set default values:

1. **Open `src/components/ConnectionPanel.vue`**

2. **Update the default form values (around line 118):**

```typescript
const form = reactive({
  uri: 'wss://your-sip-server.com:7443',      // Your SIP WebSocket URI
  sipUri: 'sip:1000@your-domain.com',          // Your SIP address
  password: '',                                 // Leave empty for security
  displayName: 'Your Name',                     // Your display name
})
```

3. **Update the default call target in `src/components/CallControls.vue` (around line 122):**

```typescript
const targetUri = ref('sip:2000@your-domain.com')
```

### Example Configuration

For a typical Asterisk setup:

```typescript
{
  uri: 'wss://pbx.example.com:8089/ws',
  sipUri: 'sip:1000@pbx.example.com',
  password: 'yourpassword',
  displayName: 'John Doe'
}
```

## Running the Example

1. **Start the development server:**

```bash
pnpm dev
```

2. **Open your browser:**

Navigate to `http://localhost:3000` (or the URL shown in the terminal)

3. **Allow microphone access:**

Your browser will request microphone permissions - this is required for audio calls.

## Using the Application

### Step 1: Connect to SIP Server

1. Enter your SIP server WebSocket URI (e.g., `wss://sip.example.com:7443`)
2. Enter your SIP URI (e.g., `sip:1000@example.com`)
3. Enter your password
4. Optionally enter your display name
5. Click **Connect**

The connection status will show "Connected" and "Registered" when successful.

### Step 2: Select Audio Devices

After connecting, you can select your preferred microphone and speaker from the dropdown menus.

### Step 3: Make a Call

1. Enter the target SIP URI (e.g., `sip:2000@example.com`)
2. Click **Call**
3. Wait for the other party to answer

### Step 4: Receive a Call

When someone calls you:
1. You'll see an "Incoming Call" notification with the caller's information
2. Click **Answer** to accept the call
3. Or click **Reject** to decline

### Step 5: Call Controls

During an active call, you can:
- **Mute/Unmute** - Toggle your microphone
- **Hold/Unhold** - Put the call on hold
- **Hangup** - End the call

### Step 6: Disconnect

When finished, click **Disconnect** to close the SIP connection.

## Testing Instructions

### Single User Testing (with Echo Test)

If your SIP server has an echo test extension (common on Asterisk as `*43` or `600`):

1. Connect to your SIP server
2. Call the echo test number (e.g., `sip:600@example.com`)
3. Speak into your microphone - you should hear your voice back with a slight delay
4. Test mute, hold, and hangup controls

### Two User Testing

For testing with two users:

1. **User A:** Connect with credentials for extension 1000
2. **User B:** Open another browser window (or use a different device) and connect with credentials for extension 2000
3. **User A:** Call `sip:2000@example.com`
4. **User B:** Answer the incoming call
5. Test two-way audio communication and call controls

### Browser Compatibility Testing

Test in multiple browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari (macOS/iOS)

**Note:** WebRTC and SIP support may vary between browsers.

## Code Structure

```
examples/basic-audio-call/
├── src/
│   ├── components/
│   │   ├── CallControls.vue       # Call control buttons and UI
│   │   └── ConnectionPanel.vue    # SIP connection form and status
│   ├── App.vue                     # Main application component
│   ├── main.ts                     # Vue app initialization
│   └── style.css                   # Global styles
├── index.html                      # HTML entry point
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite configuration
└── README.md                       # This file
```

### Key Files Explained

#### `src/App.vue`

The main application component that:
- Initializes VueSip composables (`useSipClient`, `useCallSession`, `useMediaDevices`)
- Manages SIP connection and registration
- Handles call lifecycle events (make, answer, reject, hangup)
- Coordinates between connection panel and call controls
- Manages audio device selection

**Key Composables Used:**

```typescript
// SIP Client - manages connection and registration
const { connect, disconnect, isConnected, isRegistered, updateConfig } = useSipClient()

// Get SIP client reference for useCallSession
const sipClientRef = computed(() => getClient())

// Call Session - manages call state and controls (requires sipClient ref)
const { makeCall, answer, reject, hangup, hold, unhold, mute, unmute } = useCallSession(sipClientRef)

// Media Devices - manages audio devices
const { audioInputDevices, audioOutputDevices, selectAudioInput, selectAudioOutput } = useMediaDevices()
```

#### `src/components/ConnectionPanel.vue`

Handles SIP server connection:
- Connection form with WebSocket URI, SIP URI, and password
- Connection status display (connected, registered)
- Disconnect functionality
- Error display

#### `src/components/CallControls.vue`

Manages call interactions:
- **Idle State:** Shows form to initiate outgoing calls
- **Incoming State:** Shows answer/reject buttons
- **Active State:** Shows call duration, mute, hold, and hangup controls
- Attaches remote audio stream to HTML audio element

## VueSip Composables

This example demonstrates three core VueSip composables:

### 1. `useSipClient()`

Manages WebSocket connection to SIP server and user registration.

```typescript
const {
  connect,        // Connect to SIP server (no parameters - config must be set first)
  disconnect,     // Disconnect from SIP server
  updateConfig,   // Update SIP configuration (call before connect)
  isConnected,    // Connection status
  isRegistered,   // Registration status
  error,          // Error message
  getClient       // Get underlying SIP client instance
} = useSipClient()

// Usage:
// 1. Update configuration first
updateConfig({ uri, sipUri, password, displayName, autoRegister: true })
// 2. Then connect
await connect()
```

### 2. `useCallSession()`

Manages call state, media streams, and call controls. **Requires** a ref to the SIP client instance.

```typescript
// First, get the SIP client reference
const sipClientRef = computed(() => getClient())

// Then pass it to useCallSession
const {
  session,              // Active call session
  state,                // Call state (idle, calling, active, etc.)
  remoteUri,            // Remote party's SIP URI
  remoteDisplayName,    // Remote party's display name
  isMuted,              // Mute status
  isOnHold,             // Hold status
  duration,             // Call duration in seconds
  remoteStream,         // Remote audio stream
  makeCall,             // Make outgoing call (target: string, options?: CallSessionOptions)
  answer,               // Answer incoming call (options?: AnswerOptions)
  reject,               // Reject incoming call (statusCode?: number)
  hangup,               // End call
  mute,                 // Mute microphone
  unmute,               // Unmute microphone
  hold,                 // Put call on hold
  unhold                // Resume from hold
} = useCallSession(sipClientRef)
```

### 3. `useMediaDevices()`

Manages audio/video device enumeration and selection.

```typescript
const {
  audioInputDevices,     // Available microphones (readonly MediaDevice[])
  audioOutputDevices,    // Available speakers (readonly MediaDevice[])
  selectedAudioInputId,  // Selected microphone ID (ref)
  selectedAudioOutputId, // Selected speaker ID (ref)
  enumerateDevices,      // Refresh device list
  selectAudioInput,      // Select microphone by device ID
  selectAudioOutput,     // Select speaker by device ID
  requestPermissions     // Request media permissions
} = useMediaDevices()

// Usage:
// 1. Request permissions
await requestPermissions(true, false) // audio: true, video: false
// 2. Enumerate devices
await enumerateDevices()
// 3. Select device
selectAudioInput(deviceId)
```

## TypeScript Support

This example is fully typed with TypeScript. Key type interfaces:

```typescript
import type {
  CallState,           // 'idle' | 'calling' | 'ringing' | 'active' | 'held' | 'ended'
  CallDirection,       // 'inbound' | 'outbound'
  CallSession,         // Call session object
  SipClientConfig      // SIP client configuration
} from 'vuesip'
```

## Troubleshooting

### Connection Issues

**Problem:** "Connection failed" error

**Solutions:**
- Verify WebSocket URI is correct (must start with `ws://` or `wss://`)
- Check that SIP server is running and accessible
- Ensure firewall allows WebSocket connections
- Try without TLS first (`ws://`) to isolate SSL issues

### Audio Issues

**Problem:** Can't hear remote audio

**Solutions:**
- Check browser console for errors
- Verify audio output device is selected correctly
- Ensure browser has microphone permissions
- Check that remote party's microphone is working
- Test with echo test extension first

**Problem:** Remote party can't hear you

**Solutions:**
- Check if microphone is muted
- Verify microphone permissions in browser
- Try different microphone in device selector
- Check browser's microphone settings

### Registration Issues

**Problem:** Shows "Connected" but not "Registered"

**Solutions:**
- Verify SIP URI format is correct (`sip:user@domain`)
- Check that password is correct
- Ensure SIP server allows WebSocket registrations
- Check SIP server logs for registration errors

### Call Issues

**Problem:** Call connects but no audio

**Solutions:**
- This is usually a codec negotiation issue
- Check SIP server supports WebRTC-compatible codecs (Opus, G.711)
- Verify NAT/firewall settings allow RTP/SRTP media
- Check browser console for ICE/STUN/TURN errors

## Production Considerations

When deploying this example to production:

1. **Security:**
   - Always use WSS (WebSocket Secure) in production
   - Never hardcode credentials - use environment variables
   - Implement proper authentication/authorization
   - Sanitize user inputs

2. **Error Handling:**
   - Add comprehensive error logging
   - Implement retry logic for failed connections
   - Handle network disconnections gracefully
   - Show user-friendly error messages

3. **Performance:**
   - Optimize bundle size with code splitting
   - Implement lazy loading for components
   - Monitor memory usage during long calls
   - Handle multiple simultaneous calls if needed

4. **Browser Support:**
   - Test on all target browsers
   - Provide fallbacks for unsupported features
   - Display browser compatibility warnings

5. **Accessibility:**
   - Add ARIA labels for screen readers
   - Ensure keyboard navigation works
   - Provide visual feedback for all actions

## Additional Resources

- [VueSip Documentation](https://vuesip.dev)
- [VueSip API Reference](https://vuesip.dev/api)
- [WebRTC Documentation](https://webrtc.org/)
- [SIP.js Documentation](https://sipjs.com/)
- [Asterisk WebRTC Guide](https://wiki.asterisk.org/wiki/display/AST/WebRTC)

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [https://github.com/yourusername/vuesip/issues](https://github.com/yourusername/vuesip/issues)
- Documentation: [https://vuesip.dev](https://vuesip.dev)
