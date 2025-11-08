# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive changelog with full version history
- Developer documentation structure

## [1.0.0] - 2025-11-08

VueSip 1.0.0 is a complete, production-ready headless Vue.js component library for SIP/VoIP applications. This release represents the culmination of extensive development, testing, and documentation efforts across 11 major phases.

### Added

#### Core Infrastructure (Phases 1-4)
- **Project Foundation**: Complete TypeScript setup with Vite 5 build system
- **Type System**: Comprehensive TypeScript type definitions for SIP, calls, media, events, presence, messaging, and conferencing
- **Utility Layer**: Validators, formatters, logger, and constants
- **Event System**: Type-safe EventBus with wildcard listeners and async handler support
- **Transport Manager**: WebSocket management with automatic reconnection and exponential backoff
- **SIP Client**: Full JsSIP integration with UA lifecycle management and Digest authentication
- **Call Session Manager**: Complete call lifecycle management with state transitions and media handling
- **Media Manager**: WebRTC media management with device enumeration, ICE handling, and SDP negotiation

#### Composables (Phases 5-6)
- `useSipClient`: SIP connection and registration management
- `useSipRegistration`: SIP registration lifecycle control
- `useCallSession`: Call session management (make, answer, hold, mute, transfer)
- `useMediaDevices`: Media device enumeration and selection
- `useCallControls`: Call control operations (hold, mute, DTMF)
- `useCallHistory`: Call history tracking with filtering and export
- `useDTMF`: DTMF tone sending with queue management
- `usePresence`: SIP presence (SUBSCRIBE/NOTIFY) support
- `useMessaging`: SIP MESSAGE support for instant messaging
- `useConference`: Multi-party conference calling with participant management

#### State Management (Phase 5)
- `callStore`: Centralized call state management
- `deviceStore`: Media device state management
- `connectionStore`: SIP connection state management
- `presenceStore`: Presence state management
- Persistence system with localStorage and IndexedDB adapters
- Automatic state restoration on reload

#### Provider Components (Phase 6)
- `SipClientProvider`: Root-level SIP client management
- `ConfigProvider`: Configuration management with validation
- `MediaProvider`: Media device and permission management

#### Plugin System (Phase 7)
- `PluginManager`: Plugin lifecycle and registration
- `HookManager`: Hook system with priorities
- `AnalyticsPlugin`: Call analytics and event tracking
- `RecordingPlugin`: Call recording with MediaRecorder API and IndexedDB storage

#### Testing Infrastructure (Phases 8-10)
- 19 comprehensive unit test suites covering all utilities, core classes, composables, stores, plugins, and providers
- 584+ total unit tests with >80% code coverage
- 4 integration test suites with MockSipServer helper
- 45+ E2E tests with Playwright (cross-browser support)
- Parallel test execution configuration
- CI/CD-ready test infrastructure

#### Documentation (Phase 11.1-11.8)
- **Phase 11.1**: JSDoc/TSDoc documentation for `useConference` composable
- **Phase 11.4**: Complete plugin system documentation (PluginManager, HookManager, AnalyticsPlugin, RecordingPlugin)
- **Phase 11.5**: 11 comprehensive user guides covering:
  - Getting Started
  - Making Calls
  - Receiving Calls
  - Call Controls
  - Device Management
  - Call History
  - Presence and Messaging
  - Video Calling (with multi-party conferencing section)
  - Error Handling
  - Security Best Practices
  - Performance Optimization
- **Phase 11.6**: 5 production-ready example applications:
  - Basic Audio Call (~1,000 lines, 2 components)
  - Video Call (~2,500 lines, 4 components)
  - Multi-Line Phone (~2,200 lines, 4 components, supports 5 concurrent calls)
  - Conference Call (~1,331 lines, 5 components)
  - Call Center (~2,000 lines, 7 components, enterprise-grade)
  - Total: 64 files, ~9,031 lines of code, 22 components
- **Phase 11.7**: WCAG 2.1 Level AA accessibility improvements across all examples
- **Phase 11.8**: Developer documentation including comprehensive CHANGELOG

#### Features Highlights
- **Call Management**: Outgoing, incoming, hold, mute, transfer (blind and attended), DTMF
- **Media Handling**: Audio/video device enumeration, selection, permissions, stream management
- **Conference Calling**: Multi-party conferences with participant management, muting, audio levels
- **Call Recording**: MediaRecorder integration with IndexedDB storage
- **Call History**: Persistent call history with filtering, search, and CSV export
- **Presence**: SIP PUBLISH/SUBSCRIBE for user presence
- **Messaging**: SIP MESSAGE for instant messaging
- **Network Resilience**: Automatic reconnection, connection state management
- **Quality Management**: Automatic quality adjustment based on network conditions

### Changed
- **Breaking**: Renamed composables for consistency:
  - `useSipConnection` → `useSipClient`
  - `useSipCall` → `useCallSession`
  - `useSipDtmf` → `useDTMF`
  - `useAudioDevices` → `useMediaDevices`
- **Breaking**: Updated `useSipClient` API:
  - Must call `updateConfig()` before `connect()` (previously config was passed to `connect()`)
  - Added validation with `ValidationResult` return type
- **Breaking**: `useCallSession` now requires `sipClientRef` parameter
- **Breaking**: `useMediaDevices` method names:
  - `setAudioInput/Output` → `selectAudioInput/Output`
  - `selectedAudioInput` → `selectedAudioInputId`
- Improved TypeScript type safety across all modules (eliminated all 'any' types)
- Enhanced error handling with comprehensive try-catch blocks and user-friendly messages
- Improved call state transitions with proper event emission

### Fixed
- **Critical**: CallSession data exposure bug (toInterface() returned direct reference)
- **Critical**: CallSession duration calculation (added validation for negative durations)
- **Critical**: Media track duplication causing memory leaks
- **Critical**: Missing reject() method for incoming calls
- **Critical**: DTMF queue implementation (proper sequential sending with timing)
- **Critical**: 11 critical bugs in example applications (Phase 11.6 review)
- Fixed 200+ TypeScript errors through systematic improvements
- Fixed EventBus type alignment issues
- Fixed readonly config compatibility issues
- Fixed MediaDeviceKind type compatibility
- Fixed SipClient conference method stubs
- Fixed integration test timing and validation issues
- Fixed E2E test infrastructure for CI/CD compatibility

### Security
- Digest authentication (MD5) with 401/407 challenge handling
- Authorization username override support
- HA1 hash support for enhanced security
- Transport security (WSS/TLS) support
- Media encryption (DTLS-SRTP) via WebRTC
- Input validation for SIP URIs and phone numbers
- Credential storage best practices documentation

## [0.1.0] - 2025-11-05

### Added
- Initial prototype release of VueSip
- Basic SIP connection composable (`useSipConnection`)
- Basic call management (`useSipCall`)
- DTMF support (`useSipDtmf`)
- Audio device management (`useAudioDevices`)
- Example Dialpad and CallControls components
- TypeScript support
- MIT License

### Notes
- This version was a minimal prototype and is superseded by 1.0.0
- Breaking API changes were made between 0.1.0 and 1.0.0

[Unreleased]: https://github.com/ironyh/VueSip/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ironyh/VueSip/releases/tag/v1.0.0
[0.1.0]: https://github.com/ironyh/VueSip/releases/tag/v0.1.0
