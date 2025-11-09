---
layout: home

hero:
  name: VueSip
  text: Headless SIP/VoIP for Vue
  tagline: A modern, type-safe Vue.js component library for building SIP/VoIP applications with WebRTC
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/ironyh/VueSip
    - theme: alt
      text: API Reference
      link: /api/

features:
  - icon: 🎯
    title: Headless Architecture
    details: Full control over your UI while we handle the SIP/VoIP complexity. Build custom interfaces without fighting pre-built components.
  - icon: 🔒
    title: Type-Safe
    details: Built with TypeScript for complete type safety and excellent developer experience. IntelliSense support throughout.
  - icon: ⚡
    title: Modern WebRTC
    details: Leverages modern WebRTC APIs for high-quality audio and video calls. Works with Asterisk, FreeSWITCH, and other SIP servers.
  - icon: 🔌
    title: Composable
    details: Vue 3 Composition API based composables for maximum flexibility. Use only what you need, when you need it.
  - icon: 🎨
    title: Bring Your Own UI
    details: No imposed styles or components - build the UI that fits your design. Complete freedom over appearance and UX.
  - icon: 📦
    title: Lightweight
    details: Small bundle size with tree-shaking support. Production-ready with minimal overhead.
  - icon: 📞
    title: Full Call Control
    details: Handle incoming/outgoing calls, hold, mute, transfer, DTMF, and more with simple composable APIs.
  - icon: 🎥
    title: Video & Audio
    details: Support for audio-only and video calls with advanced device management and screen sharing capabilities.
  - icon: 💬
    title: Presence & Messaging
    details: Real-time presence tracking, instant messaging, typing indicators, and status updates built-in.
  - icon: 🔐
    title: Security First
    details: Multi-layer security with transport encryption, media encryption (SRTP), and secure credential storage.
  - icon: 📊
    title: Call History
    details: Built-in call history management with filtering, searching, export capabilities, and persistence.
  - icon: 🛠️
    title: Developer Experience
    details: Comprehensive documentation, working examples, detailed error handling, and debugging support.
---

## Quick Start

Install VueSip in your Vue 3 project:

```bash
npm install vuesip
# or
pnpm add vuesip
# or
yarn add vuesip
```

Start making calls in minutes:

```vue
<script setup lang="ts">
import { useSipClient, useCallSession } from 'vuesip'

const { register, isRegistered } = useSipClient({
  uri: 'sip:user@example.com',
  password: 'your-password',
  server: 'wss://sip.example.com:7443'
})

const { call, answer, hangup, currentCall } = useCallSession()

// Register with SIP server
await register()

// Make a call
function makeCall(target: string) {
  call(target)
}
</script>

<template>
  <div v-if="isRegistered">
    <button @click="makeCall('sip:1234@example.com')">
      Call Extension 1234
    </button>
    <div v-if="currentCall">
      Call in progress...
      <button @click="hangup">Hang Up</button>
    </div>
  </div>
</template>
```

## Why VueSip?

**Headless Design** means you control the UI completely. VueSip provides the business logic and state management for SIP/VoIP functionality, while you build the interface that matches your application's design system.

**Production Ready** with comprehensive error handling, automatic reconnection, call recovery, and performance optimization built-in.

**Developer Friendly** with TypeScript support, detailed documentation, working examples, and excellent debugging capabilities.

## What Can You Build?

- 📞 **Softphones** - Desktop or web-based SIP phones
- 🏢 **Business Phone Systems** - Multi-line, transfer, conferencing
- 📱 **Click-to-Call** - Add calling to web applications
- 💼 **Customer Support** - Integrated calling in CRM/support tools
- 🎮 **WebRTC Applications** - Gaming voice chat, remote collaboration
- 📡 **IoT Communication** - Device-to-device calling

## Key Features

### Call Management
- Outgoing and incoming calls
- Call hold, resume, and transfer
- DTMF tone generation
- Multi-line support
- Call history with persistence

### Media Handling
- Audio and video calls
- Device enumeration and selection
- Local media preview
- Screen sharing
- Audio/video quality controls

### Advanced Capabilities
- SIP presence and messaging
- Real-time status updates
- Typing indicators
- Encrypted messaging
- Custom SIP headers

### Quality Assurance
- Comprehensive error handling
- Automatic reconnection
- Network quality monitoring
- Performance optimization
- Security best practices

## Learn More

- [Getting Started Guide](/guide/getting-started) - Begin your VueSip journey
- [API Reference](/api/) - Complete API documentation
- [Examples](/examples/) - Working code examples
- [FAQ](/faq) - Common questions and troubleshooting

## Community & Support

- [GitHub Issues](https://github.com/ironyh/VueSip/issues) - Report bugs or request features
- [GitHub Discussions](https://github.com/ironyh/VueSip/discussions) - Ask questions and share ideas

## License

VueSip is [MIT licensed](https://github.com/ironyh/VueSip/blob/main/LICENSE).
