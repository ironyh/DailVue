# Agent-Based Testing Framework

## Overview

The Agent-Based Testing Framework is a comprehensive system for testing complex SIP scenarios using multiple simulated agents. Each agent represents a complete SIP client with its own identity, state, and capabilities.

## Architecture

### Core Components

1. **SipTestAgent**: Main agent class representing a complete SIP client
2. **AgentManager**: Orchestrates multiple agents and facilitates communication
3. **Subagents**: Specialized components handling specific domains
4. **NetworkSimulator**: Simulates various network conditions

### Subagent Components

Each agent has four specialized subagents:

- **RegistrationSubagent**: Handles SIP registration and authentication
- **CallSubagent**: Manages call lifecycle (make, answer, hold, transfer, etc.)
- **MediaSubagent**: Controls media devices and streams
- **PresenceSubagent**: Manages presence status and messaging

## Getting Started

### Basic Agent Creation

```typescript
import { createAgentManager, createAgentIdentity } from '../agents'

// Create agent manager
const manager = createAgentManager({ verbose: true })

// Create an agent
const alice = await manager.createAgent({
  identity: createAgentIdentity('alice', 'alice'),
  autoRegister: true,
})

// Connect and register
await alice.connect()
await alice.register()
```

### Setting Up a Call

```typescript
// Create two agents
const alice = await manager.createAgent({
  identity: createAgentIdentity('alice'),
  autoRegister: true,
})

const bob = await manager.createAgent({
  identity: createAgentIdentity('bob'),
  autoRegister: true,
})

await manager.connectAllAgents()
await manager.registerAllAgents()

// Setup a call (auto-answer)
const { sessionId } = await manager.setupCall('alice', 'bob', true)

// Verify call
expect(alice.call.getActiveCalls()).toHaveLength(1)
expect(bob.call.getActiveCalls()).toHaveLength(1)
```

## Agent Manager

The `AgentManager` class orchestrates multiple agents and provides high-level operations.

### Configuration

```typescript
const manager = createAgentManager({
  autoCleanup: true, // Automatically cleanup on test end
  verbose: false, // Enable detailed logging
  defaultNetworkProfile: NETWORK_PROFILES.PERFECT,
})
```

### Managing Agents

```typescript
// Create agent
const agent = await manager.createAgent({
  identity: createAgentIdentity('alice'),
  networkProfile: NETWORK_PROFILES.WIFI_GOOD,
  autoRegister: true,
})

// Get agent
const alice = manager.getAgent('alice')

// Remove agent
await manager.removeAgent('alice')

// Get all agents
const allAgents = manager.getAllAgents()

// Connect/register all
await manager.connectAllAgents()
await manager.registerAllAgents()
```

### Agent-to-Agent Communication

```typescript
// Setup call
await manager.setupCall('alice', 'bob', autoAnswer)

// Send message
await manager.sendMessageBetweenAgents('alice', 'bob', 'Hello!')

// Create conference
const conference = await manager.createConference('sip:conf@example.com', [
  'alice',
  'bob',
  'charlie',
])
```

## SipTestAgent

Each `SipTestAgent` represents a complete SIP user with full functionality.

### Agent Identity

```typescript
const identity = createAgentIdentity('alice', 'alice_username', 'example.com')

// Identity structure:
{
  id: 'alice',
  uri: 'sip:alice_username@example.com',
  username: 'alice_username',
  password: 'password',
  displayName: 'Alice',
  wsServer: 'wss://sip.example.com'
}
```

### Agent State and Metrics

```typescript
// Get current state
const state = agent.getState()
// Returns: { connected, registered, activeSessions, presenceStatus, errors, lastActivity }

// Get metrics
const metrics = agent.getMetrics()
// Returns: { callsMade, callsReceived, messagesSent, messagesReceived, avgCallDuration, ... }
```

### Agent Lifecycle

```typescript
const agent = createSipTestAgent({ identity, autoRegister: true })

// Initialize
await agent.initialize()

// Connect to server
await agent.connect()

// Register
await agent.register()

// Cleanup (keeps agent reusable)
await agent.cleanup()

// Destroy (cannot be reused)
await agent.destroy()
```

## Subagents

### RegistrationSubagent

Handles SIP registration:

```typescript
// Register
await agent.registration.register()

// Wait for registration
await agent.registration.waitForRegistration(timeout)

// Check status
const isRegistered = agent.registration.isRegistered()

// Get state
const regState = agent.registration.getState()
```

### CallSubagent

Manages calls:

```typescript
// Make call
const session = await agent.call.makeCall(targetUri, options)

// Answer call
await agent.call.answerCall(sessionId)

// Reject call
await agent.call.rejectCall(sessionId)

// Terminate call
await agent.call.terminateCall(sessionId)

// Hold/unhold
await agent.call.holdCall(sessionId)
await agent.call.unholdCall(sessionId)

// Transfer
await agent.call.transferCall(sessionId, targetUri)

// Send DTMF
await agent.call.sendDTMF(sessionId, '123')

// Get active calls
const calls = agent.call.getActiveCalls()

// Wait for incoming call
const incomingSession = await agent.call.waitForIncomingCall(timeout)
```

### MediaSubagent

Controls media:

```typescript
// Enable/disable audio/video
agent.media.setAudioEnabled(true)
agent.media.setVideoEnabled(true)

// Enumerate devices
const devices = await agent.media.enumerateDevices()

// Select devices
agent.media.selectAudioInput(deviceId)
agent.media.selectAudioOutput(deviceId)
agent.media.selectVideoInput(deviceId)

// Get user media
const stream = await agent.media.getUserMedia({ audio: true, video: true })

// Check status
const isAudioEnabled = agent.media.isAudioEnabled()
const isVideoEnabled = agent.media.isVideoEnabled()
```

### PresenceSubagent

Manages presence and messaging:

```typescript
// Set status
agent.presence.setStatus('busy', 'In a meeting')

// Send message
const message = await agent.presence.sendMessage(targetUri, 'Hello!')

// Receive message (called by framework)
agent.presence.receiveMessage(fromUri, body)

// Get messages
const messages = agent.presence.getMessages()
const messagesWithAgent = agent.presence.getMessagesWithAgent(agentUri)

// Wait for message
const message = await agent.presence.waitForMessage(timeout)

// Get status
const status = agent.presence.getStatus()
const statusMessage = agent.presence.getStatusMessage()
```

## Network Simulation

### Network Profiles

Pre-defined network profiles:

```typescript
NETWORK_PROFILES.PERFECT // No latency, no packet loss
NETWORK_PROFILES.WIFI_GOOD // 10ms latency, 0.1% loss
NETWORK_PROFILES.WIFI_POOR // 50ms latency, 2% loss
NETWORK_PROFILES.MOBILE_4G // 30ms latency, 0.5% loss
NETWORK_PROFILES.MOBILE_3G // 100ms latency, 1% loss
NETWORK_PROFILES.MOBILE_2G // 300ms latency, 3% loss
NETWORK_PROFILES.SATELLITE // 600ms latency, 2% loss
NETWORK_PROFILES.CONGESTED // 200ms latency, 5% loss
```

### Using Network Profiles

```typescript
// Create agent with network profile
const agent = await manager.createAgent({
  identity: createAgentIdentity('alice'),
  networkProfile: NETWORK_PROFILES.MOBILE_4G,
})

// Change profile at runtime
agent.setNetworkProfile(NETWORK_PROFILES.WIFI_POOR)

// Get current profile
const profile = agent.getNetworkSimulator().getProfile()
```

### Network Simulator Features

```typescript
const simulator = agent.getNetworkSimulator()

// Apply latency
await simulator.applyLatency(promise)

// Check packet loss
const shouldDrop = simulator.shouldDropPacket()

// Calculate bandwidth delay
const delay = simulator.calculateBandwidthDelay(dataSize)

// Schedule interruption
simulator.scheduleInterruption({
  type: 'disconnect',
  duration: 1000, // ms
  delay: 500, // ms
})

// Check interruption status
const isInterrupted = simulator.isNetworkInterrupted()

// Get statistics
const stats = simulator.getStatistics()

// Reset
simulator.reset()
```

## Conference Testing

### Creating Conferences

```typescript
// Create conference with multiple participants
const conference = await manager.createConference('sip:conf@example.com', [
  'alice',
  'bob',
  'charlie',
  'david',
])

// Conference info
console.log(conference.id)
console.log(conference.participants)
console.log(conference.startedAt)

// Get conference
const conf = manager.getConference(conferenceId)

// End conference
await manager.endConference(conferenceId)
```

### Managing Conference Participants

```typescript
// Access participants
for (const participant of conference.participants) {
  console.log(participant.agentId)
  console.log(participant.joinedAt)
  console.log(participant.muted)
  console.log(participant.speaking)
  console.log(participant.audioLevel)
}

// Mute/unmute participant
conference.participants[0].muted = true

// Track speaking
conference.participants[0].speaking = true
conference.participants[0].audioLevel = 0.8
```

## Test Examples

### Basic Call Test

```typescript
it('should establish a call between two agents', async () => {
  const { sessionId } = await manager.setupCall('alice', 'bob', true)

  expect(alice.call.getActiveCalls()).toHaveLength(1)
  expect(bob.call.getActiveCalls()).toHaveLength(1)

  const metrics = alice.getMetrics()
  expect(metrics.callsMade).toBe(1)
})
```

### Conference Test

```typescript
it('should create conference with 5 participants', async () => {
  const agents = await createAgents(5)
  const agentIds = agents.map((a) => a.getId())

  const conference = await manager.createConference('sip:conf@example.com', agentIds)

  expect(conference.participants).toHaveLength(5)
})
```

### Network Condition Test

```typescript
it('should handle call with poor network', async () => {
  const alice = await manager.createAgent({
    identity: createAgentIdentity('alice'),
    networkProfile: NETWORK_PROFILES.WIFI_POOR,
  })

  const bob = await manager.createAgent({
    identity: createAgentIdentity('bob'),
    networkProfile: NETWORK_PROFILES.PERFECT,
  })

  await manager.connectAllAgents()
  await manager.registerAllAgents()

  // Call still works despite poor network
  const { sessionId } = await manager.setupCall('alice', 'bob', true)

  expect(alice.call.getActiveCalls()).toHaveLength(1)
})
```

### Complex Scenario Test

```typescript
it('should handle call transfer', async () => {
  // Alice calls Bob
  await manager.setupCall('alice', 'bob', true)

  // Bob transfers to Charlie
  const bobCalls = bob.call.getActiveCalls()
  await bob.call.transferCall(bobCalls[0].id, charlie.getIdentity().uri)

  expect(bobCalls[0].refer).toHaveBeenCalled()
})
```

## Event System

Agents and the manager emit events for monitoring:

```typescript
// Listen to agent events
alice.on('call:made', (data) => {
  console.log(`Call made: ${data.sessionId}`)
})

alice.on('registration:success', (data) => {
  console.log(`Registered: ${data.agentId}`)
})

// Listen to manager events (aggregates all agent events)
manager.on('call:made', (data) => {
  console.log(`Agent ${data.agentId} made a call`)
})

manager.on('manager:conference-created', (data) => {
  console.log(`Conference created: ${data.conferenceId}`)
})
```

### Available Events

**Registration Events:**

- `registration:started`
- `registration:success`
- `registration:failed`
- `registration:unregistered`

**Call Events:**

- `call:made`
- `call:incoming`
- `call:answered`
- `call:rejected`
- `call:terminated`
- `call:ended`
- `call:held`
- `call:unheld`
- `call:transferred`
- `call:progress`
- `call:accepted`
- `call:confirmed`
- `call:dtmf`

**Presence Events:**

- `presence:status-changed`
- `presence:message-sent`
- `presence:message-received`
- `presence:messages-cleared`

**Media Events:**

- `media:stream-started`
- `media:stream-stopped`
- `media:audio-changed`
- `media:video-changed`
- `media:audio-input-changed`
- `media:audio-output-changed`
- `media:video-input-changed`

**Agent Lifecycle Events:**

- `agent:initialized`
- `agent:connected`
- `agent:disconnected`
- `agent:cleaned-up`

**Manager Events:**

- `manager:agent-created`
- `manager:agent-removed`
- `manager:conference-created`
- `manager:conference-ended`

## Statistics and Monitoring

### Agent Statistics

```typescript
const stats = manager.getStatistics()

console.log(stats.totalAgents)
console.log(stats.connectedAgents)
console.log(stats.registeredAgents)
console.log(stats.activeCalls)
console.log(stats.totalCallsMade)
console.log(stats.totalMessagesExchanged)
console.log(stats.activeConferences)
```

### Individual Agent Metrics

```typescript
const metrics = agent.getMetrics()

console.log(metrics.callsMade)
console.log(metrics.callsReceived)
console.log(metrics.messagesSent)
console.log(metrics.messagesReceived)
console.log(metrics.avgCallDuration)
console.log(metrics.registrationAttempts)
console.log(metrics.registrationFailures)
console.log(metrics.networkErrors)
```

### Network Statistics

```typescript
const stats = agent.getNetworkSimulator().getStatistics()

console.log(stats.profile)
console.log(stats.events)
console.log(stats.totalPacketsDropped)
console.log(stats.totalLatencyEvents)
console.log(stats.averageLatency)
```

## Best Practices

### 1. Use Agent Manager for Multi-Agent Tests

```typescript
// Good: Use manager for coordination
const manager = createAgentManager()
const alice = await manager.createAgent(...)
const bob = await manager.createAgent(...)
await manager.setupCall('alice', 'bob', true)

// Avoid: Managing agents manually
const alice = createSipTestAgent(...)
const bob = createSipTestAgent(...)
// ... manual setup
```

### 2. Always Cleanup

```typescript
afterEach(async () => {
  await manager.destroy()
})
```

### 3. Use Realistic Network Profiles

```typescript
// Simulate real-world conditions
const agent = await manager.createAgent({
  identity: createAgentIdentity('alice'),
  networkProfile: NETWORK_PROFILES.MOBILE_4G, // Realistic
})
```

### 4. Test Error Scenarios

```typescript
it('should handle call failure gracefully', async () => {
  const session = await alice.call.makeCall(bob.getIdentity().uri)

  // Simulate failure
  alice.getMockServer().simulateCallEnded(session, 'local', 'Failed')

  // Verify error handling
  // ...
})
```

### 5. Use Wait Functions

```typescript
// Wait for incoming call
const session = await bob.call.waitForIncomingCall(5000)

// Wait for message
const message = await bob.presence.waitForMessage(5000)

// Wait for registration
await alice.registration.waitForRegistration(5000)
```

## Troubleshooting

### Agents Not Connecting

```typescript
// Ensure proper initialization
await agent.initialize()
await agent.connect()
await agent.register()

// Check state
console.log(agent.getState())
```

### Calls Not Establishing

```typescript
// Ensure both agents are registered
expect(alice.registration.isRegistered()).toBe(true)
expect(bob.registration.isRegistered()).toBe(true)

// Use manager for automatic setup
await manager.setupCall('alice', 'bob', true)
```

### Network Simulation Not Working

```typescript
// Ensure profile is set
const profile = agent.getNetworkSimulator().getProfile()
console.log(profile)

// Use simulator methods
await agent.getNetworkSimulator().applyLatency(promise)
```

## Advanced Features

### Custom Network Profiles

```typescript
const customProfile: NetworkProfile = {
  name: 'Custom Network',
  latency: 75,
  packetLoss: 1.5,
  bandwidth: 10000,
  jitter: 20,
}

agent.setNetworkProfile(customProfile)
```

### Network Interruptions

```typescript
// Schedule interruption
agent.getNetworkSimulator().scheduleInterruption({
  type: 'disconnect',
  duration: 2000, // 2 seconds
  delay: 1000, // Start after 1 second
})

// Test recovery
await new Promise((resolve) => setTimeout(resolve, 3500))
expect(agent.getNetworkSimulator().isNetworkInterrupted()).toBe(false)
```

### Large-Scale Tests

```typescript
// Create many agents
const agents = []
for (let i = 0; i < 50; i++) {
  const agent = await manager.createAgent({
    identity: createAgentIdentity(`agent${i}`),
    autoRegister: true,
  })
  agents.push(agent)
}

await manager.connectAllAgents()
await manager.registerAllAgents()

// Create large conference
const agentIds = agents.map((a) => a.getId())
const conference = await manager.createConference('sip:bigconf@example.com', agentIds)
```

## Code Quality and Best Practices

### Type Safety

The framework has been updated to eliminate type assertions and provide full type safety:

```typescript
// Subagents now provide typed metrics interfaces
const callMetrics: CallMetrics = agent.call.getMetrics()
const presenceMetrics: PresenceMetrics = agent.presence.getMetrics()
const registrationMetrics: RegistrationMetrics = agent.registration.getMetrics()

// No type assertions needed
console.log(callMetrics.callsMade) // Fully typed
```

### Input Validation

All SIP URIs and agent IDs are automatically validated:

```typescript
import { validateSipUri, validateAgentId, isValidSipUri } from '../agents'

// Validation happens automatically
const agent = await manager.createAgent({
  identity: {
    id: 'my-agent', // Validated: alphanumeric, hyphens, underscores, 1-64 chars
    uri: 'sip:user@domain.com', // Validated: proper SIP URI format
    // ...
  },
})

// Manual validation available
if (isValidSipUri(someUri)) {
  // URI is valid
}

validateSipUri(uri, 'parameter name') // Throws if invalid
```

### Resource Management

The framework includes comprehensive resource management:

**Collection Size Limits:**

```typescript
// Constants define maximum collection sizes
import { LIMITS } from '../agents'

LIMITS.MAX_NETWORK_EVENTS // 1000 events max
LIMITS.MAX_MESSAGES // 500 messages per agent
LIMITS.MAX_ERRORS // 100 errors per agent

// Old items automatically evicted when limits reached (FIFO)
```

**Cleanup Race Condition Protection:**

```typescript
// Cleanup operations are protected against race conditions
await agent.cleanup() // Can be called multiple times safely
await agent.destroy() // Waits for cleanup to complete

// cleanupInProgress flag prevents concurrent cleanup
```

### Logging Abstraction

Configurable logging system for debugging and production:

```typescript
import { createLogger, globalLogger, type LogLevel } from '../agents'

// Create logger for specific component
const logger = createLogger('my-component', {
  level: 'debug', // 'debug' | 'info' | 'warn' | 'error' | 'none'
  timestamps: true,
  prefix: 'MyApp',
})

logger.debug('Debug message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error message')

// Change log level dynamically
logger.setLevel('none') // Disable logging for performance

// Create child logger with nested prefix
const childLogger = logger.child('SubComponent')
// Logs will be prefixed with "MyApp:SubComponent"
```

### Configuration Constants

All magic numbers extracted to named constants:

```typescript
import { TIMING, LIMITS, NETWORK, DEFAULTS } from '../agents'

// Timing constants (milliseconds)
TIMING.EVENT_PROCESSING_DELAY // 50ms
TIMING.POLLING_INTERVAL // 100ms
TIMING.DEFAULT_WAIT_TIMEOUT // 5000ms
TIMING.CLEANUP_DELAY // 150ms
TIMING.NETWORK_LATENCY_BUFFER // 200ms

// Network constraints
NETWORK.MIN_LATENCY // 0ms
NETWORK.MAX_LATENCY // 10000ms
NETWORK.MIN_PACKET_LOSS // 0%
NETWORK.MAX_PACKET_LOSS // 100%

// Default values
DEFAULTS.WS_SERVER // 'wss://sip.example.com'
DEFAULTS.SIP_DOMAIN // 'example.com'
```

### Error Tracking

Comprehensive error tracking with automatic limits:

```typescript
// Errors are automatically tracked
const state = agent.getState()
console.log(state.errors) // Array of AgentError objects

interface AgentError {
  timestamp: number
  code: string
  message: string
  source: 'registration' | 'call' | 'media' | 'presence' | 'network'
}

// Manually add errors if needed
agent.addError('CUSTOM_ERROR', 'Something went wrong', 'network')

// Clear all errors
agent.clearErrors()

// Get error count by source
const metrics = agent.getMetrics()
console.log(metrics.networkErrors) // Count of network-related errors
```

## Future Enhancements

Possible future additions to the framework:

1. **Screenshot/Video Recording**: Capture test failures visually
2. **Performance Profiling**: Detailed performance metrics
3. **Real SIP Server Integration**: Connect to actual SIP servers
4. **Advanced Media Simulation**: Actual audio/video stream testing
5. **Load Testing Tools**: Automated stress testing utilities
6. **Visual Regression Testing**: UI state comparison
7. **Test Report Generation**: Comprehensive test reports with metrics

## Conclusion

The Agent-Based Testing Framework provides a powerful, flexible way to test complex SIP scenarios. By simulating multiple agents with realistic network conditions, you can ensure your SIP application works correctly in real-world situations.

For more examples, see the test files:

- `tests/integration/agent-to-agent.test.ts`
- `tests/integration/multi-agent-conference.test.ts`
- `tests/integration/agent-network-conditions.test.ts`
- `tests/integration/agent-complex-scenarios.test.ts`
