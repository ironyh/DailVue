# VueSip Guides

Welcome to the VueSip user guides! These comprehensive guides will help you build production-ready SIP/VoIP applications with Vue 3.

## Getting Started

New to VueSip? Start here to understand the basics and get your first application running.

### [Getting Started](/guide/getting-started)
Learn what VueSip is, why you should use it, and how to set up your first SIP client application. This guide covers installation, basic configuration, and your first call.

**What you'll learn:**
- VueSip's headless architecture and benefits
- Installation and setup
- Basic SIP client configuration
- Making your first call
- Project structure and best practices

**Prerequisites:** Basic Vue 3 knowledge, understanding of modern JavaScript/TypeScript

---

## Core Features

Master the essential functionality for building calling applications.

### [Making Calls](/guide/making-calls)
Learn how to initiate outgoing calls with full control over call options, media streams, and call lifecycle.

**What you'll learn:**
- Initiating outgoing calls
- Configuring call options (audio/video)
- Managing call state
- Handling call events
- Error handling for failed calls
- Custom SIP headers

**Recommended for:** All VueSip developers

---

### [Receiving Calls](/guide/receiving-calls)
Handle incoming calls with proper notification, queueing, and answering logic.

**What you'll learn:**
- Detecting incoming calls
- Incoming call notifications
- Auto-answer configuration
- Call queuing for multiple calls
- Rejecting calls with reason codes
- Custom ringtones

**Recommended for:** Any application that receives calls

---

### [Call Controls](/guide/call-controls)
Implement essential call control features like hold, mute, transfer, and DTMF.

**What you'll learn:**
- Hold and resume calls
- Mute/unmute audio
- Sending DTMF tones (dialpad)
- Call transfer (attended and blind)
- Call termination and cleanup
- Managing multiple active calls

**Recommended for:** Business phone systems, customer support applications

---

### [Video Calling](/guide/video-calling)
Build rich video calling experiences with camera management, screen sharing, and quality optimization.

**What you'll learn:**
- Setting up video calls
- Camera enumeration and selection
- Local video preview
- Remote video display
- Screen sharing capabilities
- Video quality optimization
- Bandwidth management
- Multi-party video conferencing

**Recommended for:** Video conferencing, remote collaboration tools

---

## Advanced Topics

Take your VueSip application to the next level with advanced features.

### [Device Management](/guide/device-management)
Master audio and video device management with enumeration, selection, permissions, and testing.

**What you'll learn:**
- Enumerating audio/video devices
- Device selection and persistence
- Browser permission handling
- Device testing and preview
- Handling device changes (hot-plug)
- Device monitoring and error recovery
- Multi-device scenarios

**Recommended for:** Applications with complex device requirements

---

### [Presence & Messaging](/guide/presence-messaging)
Add real-time presence tracking and instant messaging to your application.

**What you'll learn:**
- SIP presence protocol
- Publishing your presence status
- Subscribing to buddy presence
- Sending and receiving SIP messages
- Typing indicators
- Message history
- Encrypted messaging

**Recommended for:** Unified communications, team collaboration tools

---

### [Call History](/guide/call-history)
Implement comprehensive call history tracking with filtering, search, export, and persistence.

**What you'll learn:**
- Automatic call history tracking
- Call metadata and statistics
- Filtering and searching history
- Exporting call records
- Local storage with encryption
- History UI patterns
- Call analytics

**Recommended for:** Business applications, compliance requirements

---

## Quality & Reliability

Ensure your application is production-ready with these essential guides.

### [Error Handling](/guide/error-handling)
Build robust applications with comprehensive error handling and recovery strategies.

**What you'll learn:**
- Understanding VueSip error types
- Connection errors and recovery
- Call failure handling
- Media errors and fallbacks
- Network quality monitoring
- User-friendly error messages
- Debugging techniques

**Recommended for:** All production applications

---

### [Security](/guide/security)
Implement security best practices to protect your users and their communications.

**What you'll learn:**
- Transport layer security (WSS)
- Media encryption (SRTP)
- Credential storage and protection
- SIP authentication
- Preventing common vulnerabilities
- Privacy considerations
- Compliance requirements

**Recommended for:** All production applications, especially enterprise

---

### [Performance](/guide/performance)
Optimize your VueSip application for speed, efficiency, and scalability.

**What you'll learn:**
- Bundle size optimization
- Memory management
- Handling concurrent calls
- Network optimization
- CPU/GPU usage
- Battery impact on mobile
- Performance monitoring
- Scalability considerations

**Recommended for:** High-volume applications, mobile web apps

---

## Learning Paths

### Path 1: Basic Calling Application
Build a simple audio calling application.

1. [Getting Started](/guide/getting-started)
2. [Making Calls](/guide/making-calls)
3. [Receiving Calls](/guide/receiving-calls)
4. [Call Controls](/guide/call-controls)
5. [Error Handling](/guide/error-handling)

**Time estimate:** 2-3 hours
**Outcome:** Working audio calling application

---

### Path 2: Video Conferencing
Create a video calling or conferencing application.

1. [Getting Started](/guide/getting-started)
2. [Video Calling](/guide/video-calling)
3. [Device Management](/guide/device-management)
4. [Performance](/guide/performance)
5. [Error Handling](/guide/error-handling)

**Time estimate:** 4-6 hours
**Outcome:** Video calling application with device management

---

### Path 3: Business Phone System
Build a full-featured business phone system.

1. [Getting Started](/guide/getting-started)
2. [Making Calls](/guide/making-calls)
3. [Receiving Calls](/guide/receiving-calls)
4. [Call Controls](/guide/call-controls)
5. [Device Management](/guide/device-management)
6. [Call History](/guide/call-history)
7. [Security](/guide/security)
8. [Performance](/guide/performance)

**Time estimate:** 8-12 hours
**Outcome:** Production-ready business phone system

---

### Path 4: Unified Communications
Build a complete UC platform with calling, presence, and messaging.

1. [Getting Started](/guide/getting-started)
2. [Making Calls](/guide/making-calls)
3. [Receiving Calls](/guide/receiving-calls)
4. [Video Calling](/guide/video-calling)
5. [Presence & Messaging](/guide/presence-messaging)
6. [Device Management](/guide/device-management)
7. [Call History](/guide/call-history)
8. [Security](/guide/security)
9. [Performance](/guide/performance)

**Time estimate:** 12-16 hours
**Outcome:** Full unified communications platform

---

## Additional Resources

### API Reference
Detailed API documentation for all VueSip composables, types, and utilities.

[View API Reference →](/api/)

### Examples
Working code examples demonstrating VueSip features.

[View Examples →](/examples/)

### FAQ
Common questions and troubleshooting tips.

[View FAQ →](/faq)

---

## Quick Reference

### Essential Composables

| Composable | Use Case | Guide |
|------------|----------|-------|
| `useSipClient` | SIP connection & registration | [Getting Started](/guide/getting-started) |
| `useCallSession` | Making/receiving calls | [Making Calls](/guide/making-calls), [Receiving Calls](/guide/receiving-calls) |
| `useCallControls` | Hold, mute, transfer | [Call Controls](/guide/call-controls) |
| `useMediaDevices` | Device management | [Device Management](/guide/device-management) |
| `useDTMF` | Dialpad/DTMF tones | [Call Controls](/guide/call-controls) |
| `useCallHistory` | Call history tracking | [Call History](/guide/call-history) |
| `usePresence` | Presence tracking | [Presence & Messaging](/guide/presence-messaging) |
| `useMessaging` | Instant messaging | [Presence & Messaging](/guide/presence-messaging) |

### Common Tasks

- **Make a call:** [Making Calls](/guide/making-calls#initiating-a-call)
- **Answer a call:** [Receiving Calls](/guide/receiving-calls#answering-calls)
- **Hold a call:** [Call Controls](/guide/call-controls#hold-and-resume)
- **Transfer a call:** [Call Controls](/guide/call-controls#call-transfer)
- **Enable video:** [Video Calling](/guide/video-calling#enabling-video)
- **Share screen:** [Video Calling](/guide/video-calling#screen-sharing)
- **Select device:** [Device Management](/guide/device-management#device-selection)
- **Handle errors:** [Error Handling](/guide/error-handling#error-handling-patterns)

---

## Need Help?

- **Getting stuck?** Check the [FAQ](/faq)
- **Found a bug?** Report it on [GitHub Issues](https://github.com/ironyh/VueSip/issues)
- **Have questions?** Ask in [GitHub Discussions](https://github.com/ironyh/VueSip/discussions)
- **Need API details?** See the [API Reference](/api/)

Happy building! 🚀
