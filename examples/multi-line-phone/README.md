# Multi-Line Phone Example

A complete, production-ready example demonstrating advanced VueSip features for managing multiple concurrent SIP calls. This application showcases how to build a professional multi-line phone system with call holding, switching, and full state management.

## Features

This example demonstrates the following advanced VueSip capabilities:

### Core Features
- **Multiple Concurrent Calls**: Handle up to 5 simultaneous calls using multiple `useCallSession` instances
- **Call Switching**: Seamlessly switch between active calls with automatic hold management
- **Hold/Resume**: Put calls on hold and resume them independently
- **Call State Management**: Visual indicators for active, held, ringing, and terminated calls
- **Audio Routing**: Automatic audio stream management when switching between calls
- **Call Duration Tracking**: Real-time duration tracking for each active call
- **DTMF Support**: Send touch tones during active calls via on-screen keypad

### User Experience
- **Incoming Call Alerts**: Toast notifications for incoming calls while on another call
- **Visual Call Lines**: Dedicated UI for each active call line with status indicators
- **Dialpad**: Full numeric dialpad with quick dial functionality
- **Call History**: Recent calls display with duration and direction
- **Connection Management**: Easy SIP server configuration and connection control
- **Responsive Design**: Works on desktop and tablet devices

### Technical Highlights
- **Multiple Call Session Managers**: Dynamic creation and management of call session instances
- **State Synchronization**: Proper reactive state management across multiple calls
- **Audio Stream Handling**: Correct WebRTC stream attachment and muting for inactive lines
- **Memory Management**: Automatic cleanup of terminated calls with proper watcher disposal
- **Race Condition Prevention**: Operation locks to prevent concurrent state modifications
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **TypeScript**: Full type safety throughout the application

## Prerequisites

Before running this example, you need:

1. **Node.js**: Version 20.0.0 or higher
2. **pnpm**: Version 8 or higher (for workspace support)
3. **SIP Server**: An Asterisk, FreePBX, or compatible SIP server with:
   - WebSocket/WebRTC transport enabled
   - Multiple simultaneous calls per user allowed
   - CORS properly configured
   - At least one SIP account configured

### SIP Server Configuration

#### Asterisk Configuration Example

For Asterisk, you need to configure WebRTC support. Add to your configuration:

**http.conf:**
```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088

[cors]
enabled=yes
allowed_origins=*
```

**pjsip.conf:**
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:7443
cert_file=/path/to/cert.pem
priv_key_file=/path/to/privkey.pem
external_media_address=YOUR_PUBLIC_IP
external_signaling_address=YOUR_PUBLIC_IP

[1000]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw,opus
webrtc=yes
auth=1000
aors=1000
dtls_auto_generate_cert=yes
max_audio_streams=10
max_video_streams=0

[1000]
type=auth
auth_type=userpass
password=yourpassword
username=1000

[1000]
type=aor
max_contacts=5
```

**extensions.conf:**
```ini
[from-internal]
exten => _XXXX,1,Dial(PJSIP/${EXTEN})
```

## Installation

1. Navigate to the example directory:
```bash
cd examples/multi-line-phone
```

2. Install dependencies (from the workspace root):
```bash
cd ../..
pnpm install
```

3. Return to the example directory:
```bash
cd examples/multi-line-phone
```

4. Start the development server:
```bash
pnpm dev
```

5. Open your browser to `http://localhost:5174`

## Usage

### Getting Started

1. **Configure Connection**:
   - Enter your SIP URI (e.g., `sip:1000@yourserver.com`)
   - Enter your password
   - Enter WebSocket URI (e.g., `wss://yourserver.com:7443`)
   - Optionally enter a display name
   - Click "Connect"

2. **Make Your First Call**:
   - Once registered, click "+ New Call" to open the dialpad
   - Enter a SIP URI or extension number
   - Click "Call"

3. **Handle Multiple Calls**:
   - Make another call using the dialpad while on an existing call
   - The first call will automatically be put on hold
   - Click on any call line to make it active
   - Use hold/resume buttons to manage call states

### Testing Multiple Calls

Here are some scenarios to test the multi-line functionality:

#### Scenario 1: Basic Call Switching
1. Call extension 2000
2. Once connected, click "+ New Call"
3. Call extension 3000
4. Notice the first call is automatically placed on hold
5. Click on the first call line to switch back
6. The second call is now on hold

#### Scenario 2: Incoming Call While Active
1. Make a call to any extension
2. Have someone call your extension
3. You'll see an incoming call alert
4. Click "Answer" - the current call is automatically held
5. Talk to the new caller
6. Switch between calls by clicking on their lines

#### Scenario 3: Multiple Held Calls
1. Make or receive call #1
2. Make or receive call #2 (call #1 held)
3. Make or receive call #3 (call #2 held)
4. Now you have 2 held calls and 1 active call
5. Switch between them by clicking on the lines
6. Only one call is ever active (unmuted audio)

#### Scenario 4: DTMF During Calls
1. While on an active call, click "DTMF" button
2. Use the number pad to send touch tones
3. Useful for IVR systems or voicemail

## Architecture

### Component Structure

```
src/
├── main.ts                          # Application entry point
├── App.vue                          # Main application orchestrator
└── components/
    ├── CallLine.vue                 # Individual call line component
    ├── Dialpad.vue                  # Dialpad for making calls
    ├── IncomingCallAlert.vue        # Toast notification for incoming calls
    └── ConnectionPanel.vue          # SIP connection management
```

### State Management

The application uses Vue 3's Composition API with reactive state management:

1. **Call Line State**: Each call line maintains its own state including:
   - Call session reference
   - Call state (idle, ringing, calling, active, held, terminated)
   - Remote party information
   - Duration tracking
   - Hold/mute status
   - Media streams

2. **Global State**: The App component manages:
   - Collection of all call lines
   - Active line tracking
   - SIP connection state
   - Call history

3. **Call Session Managers**: Each call gets its own `useCallSession` instance:
   ```typescript
   const callSessionManagers = ref<Map<string, ReturnType<typeof useCallSession>>>(new Map())
   ```

### Multi-Call Management

The key to managing multiple calls is creating separate `useCallSession` instances for each call:

```typescript
// Get or create a call session manager for a line
function getCallSessionManager(lineId: string): ReturnType<typeof useCallSession> {
  if (!callSessionManagers.value.has(lineId)) {
    const client = ref(getClient())
    const manager = useCallSession(client)
    callSessionManagers.value.set(lineId, manager)
  }
  return callSessionManagers.value.get(lineId)!
}
```

Each manager independently handles:
- Call lifecycle (making calls, answering, hanging up)
- Media streams
- Call controls (hold, mute, DTMF)
- State tracking

### Audio Stream Management

Critical for multi-line phones is proper audio management:

```vue
<!-- In CallLine.vue -->
<audio ref="localAudioRef" autoplay muted></audio>
<audio ref="remoteAudioRef" autoplay :muted="!isActiveLine"></audio>
```

- **Local audio**: Always muted (prevent echo)
- **Remote audio**: Muted for all non-active lines
- Only the active line has unmuted remote audio
- Switching lines automatically updates muting

### Call Switching Logic

When switching to a different call, the system uses operation locks to prevent race conditions:

```typescript
async function makeLineActive(lineId: string) {
  // Check for ongoing operations to prevent race conditions
  if (operationLocks.value.get(lineId)) {
    console.warn('Operation already in progress for line', lineId)
    return
  }

  try {
    // Lock this operation
    operationLocks.value.set(lineId, true)

    // Put current active line on hold
    if (activeLineId.value) {
      const currentActiveLine = callLines.value.find(l => l.id === activeLineId.value)
      if (currentActiveLine && !currentActiveLine.isOnHold) {
        await handleHold(currentActiveLine)
      }
    }

    // Unhold the new active line
    const newActiveLine = callLines.value.find(l => l.id === lineId)
    if (newActiveLine?.isOnHold) {
      await handleUnhold(newActiveLine)
    }

    activeLineId.value = lineId
  } finally {
    // Release the lock
    operationLocks.value.delete(lineId)
  }
}
```

## Code Examples

### Making Multiple Calls

```typescript
// Make first call
const line1 = findAvailableLine()
const manager1 = getCallSessionManager(line1.id)
await manager1.makeCall('sip:2000@domain.com')

// Make second call (first is automatically held)
const line2 = findAvailableLine()
const manager2 = getCallSessionManager(line2.id)
await manager2.makeCall('sip:3000@domain.com')
```

### Handling Incoming Calls

The system automatically handles incoming calls and rejects them when all lines are busy:

```typescript
// Listen for incoming calls
eventBus.on('call:incoming', (event) => {
  const line = findAvailableLine()
  if (!line) {
    // Auto-reject when no lines available
    if (event.session && typeof event.session.terminate === 'function') {
      event.session.terminate({
        status_code: 486, // Busy Here
        reason_phrase: 'Busy Here - All Lines Occupied'
      })
    }
    return
  }

  const manager = getCallSessionManager(line.id)
  // IMPORTANT: Set the session in the manager's ref
  if (manager.session && typeof manager.session === 'object' && 'value' in manager.session) {
    manager.session.value = event.session
  }
  line.session = event.session
  setupLineWatchers(line, manager)
})
```

### Call Line Watchers

```typescript
function setupLineWatchers(line: CallLine, manager: ReturnType<typeof useCallSession>) {
  // Watch all reactive properties
  watch(manager.state, () => updateLineFromSession(line, manager))
  watch(manager.duration, () => updateLineFromSession(line, manager))
  watch(manager.isOnHold, () => updateLineFromSession(line, manager))
  watch(manager.localStream, () => updateLineFromSession(line, manager))
  watch(manager.remoteStream, () => updateLineFromSession(line, manager))
}
```

## Customization

### Changing Maximum Lines

Update the constant in `App.vue`:

```typescript
const MAX_LINES = 5  // Change to desired number
```

### Adding Quick Dial Contacts

Quick dial contacts are stored in localStorage. Add them programmatically:

```typescript
const quickDial = [
  { name: 'Alice', uri: 'sip:2000@domain.com' },
  { name: 'Bob', uri: 'sip:3000@domain.com' },
]
localStorage.setItem('quickDial', JSON.stringify(quickDial))
```

### Customizing Call Line Appearance

Edit `CallLine.vue` styles to match your design:

```css
.call-line--active {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
  border-color: #your-border-color;
}
```

## Troubleshooting

### Common Issues

#### 1. Calls Not Connecting
- Verify SIP server WebSocket/WebRTC is configured correctly
- Check browser console for connection errors
- Ensure CORS headers are set on SIP server
- Verify firewall allows WebSocket connections
- **Check microphone permissions**: The browser must have permission to access your microphone

#### 2. No Audio on Second Call
- Check that browser has microphone permission
- Verify only one call line is active (not on hold)
- Check browser console for media errors
- Ensure SIP server allows multiple simultaneous calls
- Verify that only the active line has unmuted remote audio

#### 3. Incoming Calls Not Showing
- Verify event bus is properly initialized
- Check that `call:incoming` events are being emitted
- Ensure at least one line is available (under MAX_LINES)
- **Note**: If all lines are occupied, incoming calls are automatically rejected with "486 Busy Here"
- Check browser console for errors

#### 4. Call Switching Not Working
- Verify hold/unhold operations complete successfully
- Check network connectivity (hold requires SIP re-INVITE)
- Ensure SIP server supports hold (sendonly/recvonly)
- **Note**: Rapid clicking may be throttled by operation locks to prevent race conditions

#### 5. Maximum Lines Warning
- If you see the "Maximum Lines Reached" warning, you need to end a call before starting a new one
- The system enforces a limit of 5 concurrent calls for stability

### Debug Mode

Enable debug logging in the browser console:

```javascript
localStorage.setItem('debug', 'vuesip:*')
```

Then refresh the page. You'll see detailed logs of all VueSip operations.

## Performance Considerations

### Memory Management

The application automatically cleans up terminated calls after 5 seconds and properly disposes of all watchers:

```typescript
watch(manager.state, (newState) => {
  if (newState === 'terminated' || newState === 'failed') {
    setTimeout(() => {
      if (line.state === 'terminated' || line.state === 'failed') {
        // Clean up watchers first
        cleanupLineWatchers(line.id)
        // Remove line and cleanup manager
        callLines.value.splice(index, 1)
        callSessionManagers.value.delete(line.id)
      }
    }, 5000)
  }
})
```

All watchers are stored and properly disposed of to prevent memory leaks:

```typescript
const watcherCleanupFns = ref<Map<string, Array<() => void>>>(new Map())

function cleanupLineWatchers(lineId: string) {
  const cleanupFns = watcherCleanupFns.value.get(lineId)
  if (cleanupFns) {
    cleanupFns.forEach(fn => fn())
    watcherCleanupFns.value.delete(lineId)
  }
}
```

### Audio Performance

- Only one remote audio stream is unmuted at a time
- Local audio is always muted (prevents echo)
- Audio elements are reused, not recreated

### State Updates

- Watchers are set up once per call
- State updates are batched via Vue's reactivity system
- Duration tracking uses efficient interval timers

## Browser Compatibility

Tested and working on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

WebRTC and WebSocket support required.

## License

This example is part of the VueSip project and shares the same MIT license.

## Further Reading

- [VueSip Documentation](../../docs/)
- [WebRTC Documentation](https://webrtc.org/)
- [Asterisk WebRTC Guide](https://wiki.asterisk.org/wiki/display/AST/WebRTC)
- [JsSIP Documentation](https://jssip.net/documentation/)

## Support

For issues or questions:
1. Check the [main VueSip README](../../README.md)
2. Review the [VueSip documentation](../../docs/)
3. Open an issue on GitHub

## Credits

Built with:
- [Vue 3](https://vuejs.org/)
- [VueSip](../../)
- [JsSIP](https://jssip.net/)
- [Vite](https://vitejs.dev/)
