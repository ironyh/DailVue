# DailVue

Headless Vue components that makes it possible to create great working SIP interfaces!

DailVue provides a set of powerful, headless Vue 3 composables for building SIP (Session Initiation Protocol) interfaces with Asterisk and other VoIP systems. Built with TypeScript and designed for flexibility, DailVue gives you the business logic while letting you control the UI.

## Features

✨ **Headless Components** - Complete separation of logic and UI  
📞 **Full SIP Support** - WebRTC-based calling with SIP.js  
🎨 **UI Agnostic** - Use with any UI framework (PrimeVue, Vuetify, etc.)  
🔌 **Composable Architecture** - Vue 3 Composition API  
🎯 **TypeScript** - Full type safety and IntelliSense  
📱 **DTMF Support** - Send dialpad tones during calls  
🎤 **Audio Device Management** - Select microphones and speakers  
⚡ **Modern Stack** - Vue 3, Vite, TypeScript  
> A headless Vue.js component library for SIP/VoIP applications

[![npm version](https://img.shields.io/npm/v/dailvue.svg)](https://www.npmjs.com/package/dailvue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install dailvue
# or
yarn add dailvue
# or
pnpm add dailvue
```

## Quick Start

```vue
<script setup>
import { ref } from 'vue'
import { useSipConnection, useSipCall } from 'dailvue'

const config = {
  server: 'sip.example.com',
  username: '1000',
  password: 'secret',
  displayName: 'John Doe'
}

const { isConnected, isRegistered, connect } = useSipConnection(config)
const userAgent = ref(null)
const { currentCall, makeCall, endCall } = useSipCall(userAgent)

// Connect to SIP server
await connect()

// Make a call
await makeCall('2000')
</script>
```

## Core Composables

### useSipConnection

Manages SIP server connection and registration.

```typescript
import { useSipConnection } from 'dailvue'

const {
  isConnected,      // Ref<boolean> - Connection state
  isRegistered,     // Ref<boolean> - Registration state
  isConnecting,     // Ref<boolean> - Connecting state
  error,            // Ref<SipError | null> - Last error
  connect,          // () => Promise<void> - Connect to server
  disconnect,       // () => Promise<void> - Disconnect from server
  register,         // () => Promise<void> - Register
  unregister        // () => Promise<void> - Unregister
} = useSipConnection(config)
```

**Configuration:**

```typescript
interface SipConfig {
  server: string              // SIP server domain
  username: string            // SIP username
  password: string            // SIP password
  displayName?: string        // Display name for calls
  realm?: string             // Authentication realm
  autoRegister?: boolean     // Auto-register on connect (default: true)
}
```

### useSipCall

Manages call state and operations.

```typescript
import { useSipCall } from 'dailvue'

const {
  currentCall,      // Ref<CallSession | null> - Active call
  incomingCall,     // Ref<CallSession | null> - Incoming call
  isCalling,        // Ref<boolean> - Outgoing call in progress
  isInCall,         // Ref<boolean> - Call established
  makeCall,         // (target: string) => Promise<void> - Make call
  answerCall,       // () => Promise<void> - Answer incoming call
  endCall,          // () => Promise<void> - End active call
  rejectCall        // () => Promise<void> - Reject incoming call
} = useSipCall(userAgentRef)
```

**Call Session:**

```typescript
interface CallSession {
  id: string                           // Unique call ID
  remoteIdentity: string              // Remote party identifier
  direction: 'incoming' | 'outgoing'  // Call direction
  state: CallState                    // Current state
  startTime?: Date                    // Call start time
  answerTime?: Date                   // Call answer time
  endTime?: Date                      // Call end time
}
```

### useSipDtmf

Send DTMF (dialpad) tones during calls.

```typescript
import { useSipDtmf } from 'dailvue'

const {
  sendDtmf,         // (digit: string) => Promise<void> - Send single digit
  sendDtmfSequence  // (digits: string, interval?: number) => Promise<void>
} = useSipDtmf(currentSessionRef)

// Send single digit
await sendDtmf('1')

// Send sequence
await sendDtmfSequence('1234', 160)
```

### useAudioDevices

Manage audio input/output devices.

```typescript
import { useAudioDevices } from 'dailvue'

const {
  audioInputDevices,      // Ref<AudioDevice[]> - Available microphones
  audioOutputDevices,     // Ref<AudioDevice[]> - Available speakers
  selectedInputDevice,    // Ref<string | null> - Selected mic ID
  selectedOutputDevice,   // Ref<string | null> - Selected speaker ID
  refreshDevices,         // () => Promise<void> - Refresh device list
  setInputDevice,         // (deviceId: string) => void - Set microphone
  setOutputDevice         // (deviceId: string) => void - Set speaker
} = useAudioDevices()
```

## Example Components

DailVue includes example components built with PrimeVue to demonstrate usage:

### Dialpad Component

```vue
<template>
  <Dialpad 
    :is-calling="isCalling"
    @digit="handleDtmf"
    @call="handleMakeCall"
  />
</template>
```

### Call Controls Component

```vue
<template>
  <CallControls
    :current-call="currentCall"
    :incoming-call="incomingCall"
    :is-calling="isCalling"
    @answer="handleAnswer"
    @reject="handleReject"
    @end="handleEnd"
  />
</template>
```

## Running the Example

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build library
npm run build
```

Visit `http://localhost:5173` to see the example application.

## Use Cases

- **Asterisk Dialpad Interfaces** - Build custom dialpad UIs
- **Contact Center Applications** - Agent softphones
- **WebRTC Applications** - Browser-based calling
- **VoIP Integration** - Integrate calling into web apps
- **Custom SIP Clients** - Full control over UI/UX

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires WebRTC support.

## Architecture

DailVue follows the headless component pattern:

1. **Composables** provide the business logic and state management
2. **You** provide the UI components and styling
3. **Complete flexibility** to match your design system

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type { 
  SipConfig, 
  CallSession, 
  CallState, 
  AudioDevice, 
  SipError 
} from 'dailvue'
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Built with:
- [Vue 3](https://vuejs.org/)
- [SIP.js](https://sipjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
# npm
npm install dailvue

# pnpm
pnpm add dailvue

# yarn
yarn add dailvue
```

## Quick Start

```typescript
import { createDailVue } from 'dailvue'
import { createApp } from 'vue'

const app = createApp(App)
app.use(createDailVue())
```

## Documentation

Full documentation is available at [https://dailvue.dev](https://dailvue.dev) (coming soon)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari 14+
- Chrome Android 90+

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build library
pnpm build

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Generate coverage report
pnpm coverage

# Lint code
pnpm lint

# Format code
pnpm format
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)

## Acknowledgments

Built with:
- [Vue.js](https://vuejs.org/)
- [JsSIP](https://jssip.net/)
- [WebRTC](https://webrtc.org/)
