# Plugin System API Reference

A comprehensive guide to VueSip's plugin system architecture, APIs, and built-in plugins.

## Table of Contents

- [Overview](#overview)
- [Plugin Interface](#plugin-interface)
  - [Plugin Metadata](#plugin-metadata)
  - [Plugin Lifecycle Methods](#plugin-lifecycle-methods)
  - [Plugin Configuration](#plugin-configuration)
- [Hook System](#hook-system)
  - [Available Hooks](#available-hooks)
  - [Hook Priorities](#hook-priorities)
  - [Hook Registration](#hook-registration)
  - [Hook Execution](#hook-execution)
- [Plugin Context](#plugin-context)
- [Creating Custom Plugins](#creating-custom-plugins)
  - [Basic Plugin Structure](#basic-plugin-structure)
  - [Plugin Examples](#plugin-examples)
- [Built-in Plugins](#built-in-plugins)
  - [AnalyticsPlugin](#analyticsplugin)
  - [RecordingPlugin](#recordingplugin)
- [Plugin Manager](#plugin-manager)
  - [Registration](#registration)
  - [Configuration Updates](#configuration-updates)
  - [Dependency Management](#dependency-management)
  - [Version Compatibility](#version-compatibility)
- [API Reference](#api-reference)
- [Source Code Links](#source-code-links)

---

## Overview

VueSip's plugin system provides a comprehensive, extensible architecture for extending SIP client functionality. The system is built around three core components:

- **PluginManager**: Central orchestrator for plugin lifecycle management
- **HookManager**: Priority-based event hook system for plugin coordination
- **Plugin Interface**: Standard interface that all plugins must implement

### Key Features

- **Lifecycle Management**: Complete install/uninstall lifecycle with state tracking
- **Dependency Resolution**: Automatic dependency checking and resolution
- **Version Compatibility**: Semantic version checking for plugin compatibility
- **Hook-Based Extensibility**: Priority-ordered hooks for observing and modifying behavior
- **Configuration Management**: Runtime configuration updates without reinstallation
- **State Tracking**: Monitor plugin states (Registered, Installing, Installed, Failed)

---

## Plugin Interface

All plugins must implement the `Plugin<TConfig>` interface, which defines the structure and lifecycle methods.

### Plugin Metadata

Every plugin must provide metadata describing its identity and requirements:

```typescript
interface PluginMetadata {
  /** Plugin name (must be unique) */
  name: string
  /** Plugin version */
  version: string
  /** Plugin description */
  description?: string
  /** Plugin author */
  author?: string
  /** Plugin license */
  license?: string
  /** Minimum VueSip version required */
  minVersion?: string
  /** Maximum VueSip version supported */
  maxVersion?: string
  /** Dependencies on other plugins */
  dependencies?: string[]
}
```

### Plugin Lifecycle Methods

#### install(context, config)

Called when the plugin is registered with the PluginManager. This is where you set up event listeners, register hooks, and initialize resources.

**Parameters:**
- `context: PluginContext` - Plugin context with access to VueSip services
- `config?: TConfig` - Optional configuration object

**Returns:** `Promise<void> | void`

**Example:**
```typescript
async install(context: PluginContext, config?: MyPluginConfig): Promise<void> {
  // Register hooks
  context.hooks.register('afterCallStart', async (context, data) => {
    console.log('Call started:', data.callId)
  }, { priority: HookPriority.Normal })

  // Listen to events
  context.eventBus.on('someEvent', this.handleEvent)
}
```

#### uninstall(context)

Optional cleanup method called when the plugin is unregistered. Use this to remove event listeners, close connections, and free resources.

**Parameters:**
- `context: PluginContext` - Plugin context

**Returns:** `Promise<void> | void`

**Note:** Hook cleanup is automatic - the PluginManager removes all hooks registered by the plugin.

**Example:**
```typescript
async uninstall(context: PluginContext): Promise<void> {
  // Remove event listeners
  context.eventBus.off('someEvent', this.handleEvent)

  // Cleanup resources
  await this.closeConnections()
}
```

#### updateConfig(context, config)

Optional method called when configuration is updated at runtime. Allows the plugin to adapt its behavior dynamically.

**Parameters:**
- `context: PluginContext` - Plugin context
- `config: TConfig` - New configuration object

**Returns:** `Promise<void> | void`

**Example:**
```typescript
async updateConfig(context: PluginContext, config: MyPluginConfig): Promise<void> {
  this.config = { ...this.config, ...config }

  // Restart services with new config
  if (config.endpoint) {
    await this.reconnect(config.endpoint)
  }
}
```

### Plugin Configuration

Plugins can define their own configuration interface extending `PluginConfig`:

```typescript
interface PluginConfig {
  /** Enable/disable the plugin */
  enabled?: boolean
  /** Plugin-specific configuration */
  [key: string]: any
}
```

**Example:**
```typescript
interface MyPluginConfig extends PluginConfig {
  endpoint: string
  apiKey?: string
  timeout?: number
  retryAttempts?: number
}
```

---

## Hook System

The hook system enables plugins to observe and modify VueSip behavior at critical lifecycle points.

### Available Hooks

The following hooks are available throughout the VueSip lifecycle:

#### Lifecycle Hooks

| Hook Name | When Fired | Data Provided |
|-----------|------------|---------------|
| `beforeInit` | Before SIP client initialization | `{ config: SipClientConfig }` |
| `afterInit` | After SIP client initialization | `{ sipClient: SipClient }` |
| `beforeDestroy` | Before SIP client destruction | `{ sipClient: SipClient }` |
| `afterDestroy` | After SIP client destruction | `{}` |

#### Connection Hooks

| Hook Name | When Fired | Data Provided |
|-----------|------------|---------------|
| `beforeConnect` | Before establishing SIP connection | `{ config: SipClientConfig }` |
| `afterConnect` | After SIP connection established | `{ sipClient: SipClient }` |
| `beforeDisconnect` | Before closing SIP connection | `{}` |
| `afterDisconnect` | After SIP connection closed | `{}` |

#### Registration Hooks

| Hook Name | When Fired | Data Provided |
|-----------|------------|---------------|
| `beforeRegister` | Before SIP registration | `{ config: SipClientConfig }` |
| `afterRegister` | After successful registration | `{ response: any }` |
| `beforeUnregister` | Before SIP unregistration | `{}` |
| `afterUnregister` | After successful unregistration | `{}` |

#### Call Hooks

| Hook Name | When Fired | Data Provided |
|-----------|------------|---------------|
| `beforeCall` | Before initiating a call | `{ targetUri: string, options?: any }` |
| `afterCallStart` | After call is initiated | `{ callId: string, session: CallSession }` |
| `beforeAnswer` | Before answering incoming call | `{ callId: string, session: CallSession }` |
| `afterAnswer` | After call is answered | `{ callId: string, session: CallSession }` |
| `beforeHangup` | Before ending a call | `{ callId: string, reason?: string }` |
| `afterHangup` | After call is ended | `{ callId: string, duration: number }` |

#### Media Hooks

| Hook Name | When Fired | Data Provided |
|-----------|------------|---------------|
| `beforeMediaAcquire` | Before acquiring media stream | `{ constraints: MediaStreamConstraints }` |
| `afterMediaAcquire` | After media stream acquired | `{ stream: MediaStream }` |
| `beforeMediaRelease` | Before releasing media stream | `{ stream: MediaStream }` |
| `afterMediaRelease` | After media stream released | `{}` |

#### Error Hooks

| Hook Name | When Fired | Data Provided |
|-----------|------------|---------------|
| `onError` | When a general error occurs | `{ error: Error, context?: string }` |
| `onCallError` | When a call error occurs | `{ callId: string, error: Error }` |
| `onConnectionError` | When a connection error occurs | `{ error: Error }` |

### Hook Priorities

Hooks are executed in strict priority order, from highest to lowest:

```typescript
enum HookPriority {
  Highest = 1000,  // Critical pre-processing, validation, blocking
  High = 500,      // Important setup, early intervention
  Normal = 0,      // Standard plugin operations (default)
  Low = -500,      // Post-processing, cleanup
  Lowest = -1000,  // Final cleanup, logging, auditing
}
```

**Priority Guidelines:**
- **Highest**: Use for validation that can block operations (e.g., permission checks)
- **High**: Use for setup that must happen before normal processing
- **Normal**: Default for most plugin operations
- **Low**: Use for operations that should happen after normal processing
- **Lowest**: Use for final cleanup, logging, or auditing

Within the same priority level, hooks execute in registration order (FIFO).

### Hook Registration

Hooks are registered through the plugin context:

```typescript
const hookId = context.hooks.register(
  hookName: HookName,
  handler: HookHandler,
  options?: HookOptions
)
```

**Hook Options:**
```typescript
interface HookOptions {
  /** Priority of this hook handler */
  priority?: HookPriority | number
  /** If true, removes handler after first execution */
  once?: boolean
  /** Optional condition function to determine if hook should run */
  condition?: (context: PluginContext, data?: any) => boolean
}
```

**Example:**
```typescript
// Register a high-priority validation hook
context.hooks.register(
  'beforeCall',
  async (context, data) => {
    if (!data.targetUri.match(/^sip:/)) {
      throw new Error('Invalid SIP URI')
    }
  },
  { priority: HookPriority.Highest }
)

// Register a conditional hook (only for incoming calls)
context.hooks.register(
  'afterCallStart',
  async (context, data) => {
    console.log('Incoming call:', data.callId)
  },
  {
    priority: HookPriority.Normal,
    condition: (context, data) => data.direction === 'incoming'
  }
)

// Register a one-time initialization hook
context.hooks.register(
  'afterInit',
  async (context, data) => {
    await initializeResources()
  },
  {
    priority: HookPriority.High,
    once: true  // Auto-removes after first execution
  }
)
```

### Hook Execution

Hooks are executed automatically by VueSip at the appropriate lifecycle points. Plugins can also execute hooks manually:

```typescript
// Execute a hook
const results = await context.hooks.execute('hookName', data)
```

**Stopping Propagation:**

A hook handler can stop propagation by returning `false` (strict equality):

```typescript
context.hooks.register('beforeCall', async (context, data) => {
  if (isBlacklisted(data.targetUri)) {
    console.log('Call blocked')
    return false  // Stop propagation - no subsequent hooks run
  }
  return true
}, { priority: HookPriority.Highest })
```

---

## Plugin Context

The `PluginContext` provides access to VueSip services and utilities:

```typescript
interface PluginContext {
  /** Event bus for global event communication */
  eventBus: EventBus

  /** SIP client instance (may be null before initialization) */
  sipClient: SipClient | null

  /** Media manager instance */
  mediaManager: MediaManager | null

  /** Current SIP configuration */
  config: SipClientConfig | null

  /** Active call sessions */
  activeCalls: Map<string, CallSession>

  /** Hook system for registering lifecycle hooks */
  hooks: {
    register: (name, handler, options?) => string
    unregister: (hookId: string) => boolean
    execute: (name, data?) => Promise<any[]>
  }

  /** Logger instance */
  logger: {
    debug: (message: string, ...args: any[]) => void
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
  }

  /** Application version */
  version: string
}
```

**Usage Example:**
```typescript
async install(context: PluginContext, config?: MyPluginConfig): Promise<void> {
  // Access event bus
  context.eventBus.on('callStarted', this.handleCall)

  // Access SIP client
  if (context.sipClient) {
    console.log('SIP client available')
  }

  // Access active calls
  console.log('Active calls:', context.activeCalls.size)

  // Use logger
  context.logger.info('Plugin installed')

  // Check version
  if (this.compareVersion(context.version, '1.0.0') >= 0) {
    // Use new features
  }
}
```

---

## Creating Custom Plugins

### Basic Plugin Structure

Here's a template for creating a custom plugin:

```typescript
import type { Plugin, PluginContext, PluginConfig } from '@/types/plugin.types'

// Define your plugin configuration
interface MyPluginConfig extends PluginConfig {
  enabled?: boolean
  myOption?: string
}

// Create the plugin class
export class MyPlugin implements Plugin<MyPluginConfig> {
  metadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My custom plugin',
    author: 'Your Name',
    license: 'MIT',
  }

  defaultConfig: MyPluginConfig = {
    enabled: true,
    myOption: 'default',
  }

  private config: MyPluginConfig = this.defaultConfig

  async install(context: PluginContext, config?: MyPluginConfig): Promise<void> {
    this.config = { ...this.defaultConfig, ...config }

    // Register hooks
    context.hooks.register('afterCallStart', async (context, data) => {
      // Handle call started
    })

    // Setup event listeners
    context.eventBus.on('someEvent', this.handleEvent)
  }

  async uninstall(context: PluginContext): Promise<void> {
    // Cleanup
    context.eventBus.off('someEvent', this.handleEvent)
  }

  async updateConfig(context: PluginContext, config: MyPluginConfig): Promise<void> {
    this.config = { ...this.config, ...config }
  }

  private handleEvent = (data: any) => {
    // Handle event
  }
}

// Factory function
export function createMyPlugin(): MyPlugin {
  return new MyPlugin()
}
```

### Plugin Examples

#### Example 1: Call Logger Plugin

A simple plugin that logs all call events:

```typescript
import type { Plugin, PluginContext, PluginConfig } from '@/types/plugin.types'
import { HookPriority } from '@/types/plugin.types'

interface CallLoggerConfig extends PluginConfig {
  logLevel?: 'info' | 'debug'
  includeTimestamps?: boolean
}

export class CallLoggerPlugin implements Plugin<CallLoggerConfig> {
  metadata = {
    name: 'call-logger',
    version: '1.0.0',
    description: 'Logs all call lifecycle events',
  }

  defaultConfig: CallLoggerConfig = {
    enabled: true,
    logLevel: 'info',
    includeTimestamps: true,
  }

  private config = this.defaultConfig
  private callStartTimes = new Map<string, number>()

  async install(context: PluginContext, config?: CallLoggerConfig): Promise<void> {
    this.config = { ...this.defaultConfig, ...config }

    // Log call start
    context.hooks.register('afterCallStart', async (context, data) => {
      this.callStartTimes.set(data.callId, Date.now())
      this.log(context, `Call started: ${data.callId}`)
    }, { priority: HookPriority.Low })

    // Log call end with duration
    context.hooks.register('afterHangup', async (context, data) => {
      const startTime = this.callStartTimes.get(data.callId)
      const duration = startTime ? Date.now() - startTime : 0
      this.log(context, `Call ended: ${data.callId}, Duration: ${duration}ms`)
      this.callStartTimes.delete(data.callId)
    }, { priority: HookPriority.Low })
  }

  private log(context: PluginContext, message: string): void {
    const timestamp = this.config.includeTimestamps
      ? `[${new Date().toISOString()}] `
      : ''

    const logFn = this.config.logLevel === 'debug'
      ? context.logger.debug
      : context.logger.info

    logFn(`${timestamp}${message}`)
  }
}

export function createCallLoggerPlugin(): CallLoggerPlugin {
  return new CallLoggerPlugin()
}
```

#### Example 2: Call Permission Plugin

A plugin that validates calls against a permission system:

```typescript
import type { Plugin, PluginContext, PluginConfig } from '@/types/plugin.types'
import { HookPriority } from '@/types/plugin.types'

interface CallPermissionConfig extends PluginConfig {
  permissionEndpoint: string
  allowedDomains?: string[]
  blockUnauthorized?: boolean
}

export class CallPermissionPlugin implements Plugin<CallPermissionConfig> {
  metadata = {
    name: 'call-permission',
    version: '1.0.0',
    description: 'Validates calls against permission system',
  }

  defaultConfig: CallPermissionConfig = {
    enabled: true,
    permissionEndpoint: '',
    blockUnauthorized: true,
  }

  private config = this.defaultConfig

  async install(context: PluginContext, config?: CallPermissionConfig): Promise<void> {
    this.config = { ...this.defaultConfig, ...config }

    // Validate before calls are made
    context.hooks.register('beforeCall', async (context, data) => {
      // Check allowed domains
      if (this.config.allowedDomains?.length) {
        const domain = this.extractDomain(data.targetUri)
        if (!this.config.allowedDomains.includes(domain)) {
          context.logger.warn(`Call blocked: domain ${domain} not in allowed list`)
          return false  // Block the call
        }
      }

      // Check permission endpoint
      if (this.config.permissionEndpoint) {
        const hasPermission = await this.checkPermission(data.targetUri)
        if (!hasPermission && this.config.blockUnauthorized) {
          context.logger.warn(`Call blocked: permission denied for ${data.targetUri}`)
          return false  // Block the call
        }
      }

      return true  // Allow the call
    }, { priority: HookPriority.Highest })
  }

  private extractDomain(uri: string): string {
    const match = uri.match(/@([^;]+)/)
    return match ? match[1] : ''
  }

  private async checkPermission(targetUri: string): Promise<boolean> {
    try {
      const response = await fetch(this.config.permissionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUri }),
      })
      const data = await response.json()
      return data.allowed === true
    } catch (error) {
      // On error, fail open or closed based on config
      return !this.config.blockUnauthorized
    }
  }
}

export function createCallPermissionPlugin(): CallPermissionPlugin {
  return new CallPermissionPlugin()
}
```

#### Example 3: Call Statistics Plugin

A plugin that collects and reports call statistics:

```typescript
import type { Plugin, PluginContext, PluginConfig } from '@/types/plugin.types'
import { HookPriority } from '@/types/plugin.types'

interface CallStatisticsConfig extends PluginConfig {
  reportInterval?: number  // Report stats every N ms
  onReport?: (stats: CallStats) => void
}

interface CallStats {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  averageDuration: number
  callsByDirection: { incoming: number; outgoing: number }
}

export class CallStatisticsPlugin implements Plugin<CallStatisticsConfig> {
  metadata = {
    name: 'call-statistics',
    version: '1.0.0',
    description: 'Collects and reports call statistics',
  }

  defaultConfig: CallStatisticsConfig = {
    enabled: true,
    reportInterval: 60000,  // Report every minute
  }

  private config = this.defaultConfig
  private stats: CallStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageDuration: 0,
    callsByDirection: { incoming: 0, outgoing: 0 },
  }
  private durations: number[] = []
  private reportTimer: ReturnType<typeof setInterval> | null = null

  async install(context: PluginContext, config?: CallStatisticsConfig): Promise<void> {
    this.config = { ...this.defaultConfig, ...config }

    // Track call starts
    context.hooks.register('afterCallStart', async (context, data) => {
      this.stats.totalCalls++
      if (data.direction === 'incoming') {
        this.stats.callsByDirection.incoming++
      } else {
        this.stats.callsByDirection.outgoing++
      }
    }, { priority: HookPriority.Low })

    // Track successful calls
    context.hooks.register('afterHangup', async (context, data) => {
      this.stats.successfulCalls++
      if (data.duration) {
        this.durations.push(data.duration)
        this.stats.averageDuration =
          this.durations.reduce((a, b) => a + b, 0) / this.durations.length
      }
    }, { priority: HookPriority.Low })

    // Track failed calls
    context.hooks.register('onCallError', async (context, data) => {
      this.stats.failedCalls++
    }, { priority: HookPriority.Low })

    // Start reporting timer
    if (this.config.reportInterval) {
      this.reportTimer = setInterval(() => {
        this.report(context)
      }, this.config.reportInterval)
    }
  }

  async uninstall(context: PluginContext): Promise<void> {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = null
    }

    // Final report
    this.report(context)
  }

  private report(context: PluginContext): void {
    context.logger.info('Call Statistics:', this.stats)

    if (this.config.onReport) {
      this.config.onReport({ ...this.stats })
    }
  }

  getStats(): CallStats {
    return { ...this.stats }
  }

  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
      callsByDirection: { incoming: 0, outgoing: 0 },
    }
    this.durations = []
  }
}

export function createCallStatisticsPlugin(): CallStatisticsPlugin {
  return new CallStatisticsPlugin()
}
```

---

## Built-in Plugins

VueSip includes two powerful built-in plugins for common use cases.

### AnalyticsPlugin

Provides comprehensive analytics and event tracking with support for batching, filtering, and transformation.

#### Features

- Automatic tracking of SIP, call, and media events
- Event batching with configurable size and time intervals
- Flexible event filtering with wildcard patterns
- Event transformation for data sanitization/enrichment
- Session and user tracking
- Queue management with overflow protection
- Request timeout handling
- Event requeuing on failure

#### Configuration

```typescript
interface AnalyticsPluginConfig extends PluginConfig {
  endpoint?: string                    // Analytics endpoint URL
  batchEvents?: boolean                // Enable event batching (default: true)
  batchSize?: number                   // Events per batch (default: 10)
  sendInterval?: number                // Send interval in ms (default: 30000)
  includeUserInfo?: boolean            // Include user ID (default: false)
  transformEvent?: (event) => event    // Event transformation function
  trackEvents?: string[]               // Whitelist patterns (default: [] = all)
  ignoreEvents?: string[]              // Blacklist patterns (default: [])
  maxQueueSize?: number                // Max queue size (default: 1000)
  requestTimeout?: number              // Request timeout (default: 30000)
  maxPayloadSize?: number              // Max payload size (default: 100000)
  validateEventData?: boolean          // Validate event data (default: true)
}
```

#### Usage Example

```typescript
import { createAnalyticsPlugin } from '@/plugins'

const analyticsPlugin = createAnalyticsPlugin()

await pluginManager.register(analyticsPlugin, {
  enabled: true,
  endpoint: 'https://analytics.example.com/events',
  batchEvents: true,
  batchSize: 20,
  sendInterval: 60000,
  trackEvents: ['call:*', 'sip:connected'],
  ignoreEvents: ['call:failed'],
  transformEvent: (event) => {
    // Sanitize phone numbers
    if (event.data?.phoneNumber) {
      event.data.phoneNumber = event.data.phoneNumber.replace(/\d{4}$/, '****')
    }
    return event
  }
})

// Set user ID after login
analyticsPlugin.setUserId('user-123')
```

#### API Methods

**setUserId(userId: string)**

Set the user ID for analytics tracking. Only included in events when `includeUserInfo` is enabled.

#### Source Code

See: [`src/plugins/AnalyticsPlugin.ts`](../../src/plugins/AnalyticsPlugin.ts)

---

### RecordingPlugin

Provides comprehensive call recording with MediaRecorder API support and IndexedDB storage.

#### Features

- Audio and video recording support
- Automatic or manual recording control
- IndexedDB storage with automatic cleanup
- Pause/resume recording
- Configurable recording options (bitrate, MIME type)
- Memory management and blob cleanup
- Recording download functionality
- Lifecycle callbacks

#### Configuration

```typescript
interface RecordingPluginConfig extends PluginConfig {
  autoStart?: boolean                  // Auto-start on call (default: false)
  recordingOptions?: {
    audio?: boolean                    // Record audio (default: true)
    video?: boolean                    // Record video (default: false)
    mimeType?: string                  // MIME type (default: 'audio/webm')
    audioBitsPerSecond?: number        // Audio bitrate (default: 128000)
    videoBitsPerSecond?: number        // Video bitrate
    timeslice?: number                 // Chunk interval in ms
  }
  storeInIndexedDB?: boolean           // Store in IndexedDB (default: true)
  dbName?: string                      // DB name (default: 'vuesip-recordings')
  maxRecordings?: number               // Max recordings (default: 50)
  autoDeleteOld?: boolean              // Auto-delete old (default: true)
  onRecordingStart?: (data) => void    // Start callback
  onRecordingStop?: (data) => void     // Stop callback
  onRecordingError?: (error) => void   // Error callback
}
```

#### Usage Example

```typescript
import { createRecordingPlugin } from '@/plugins'

const recordingPlugin = createRecordingPlugin()

// Install with auto-recording
await pluginManager.register(recordingPlugin, {
  enabled: true,
  autoStart: true,
  recordingOptions: {
    audio: true,
    video: false,
    mimeType: 'audio/webm',
    audioBitsPerSecond: 128000
  },
  storeInIndexedDB: true,
  maxRecordings: 50,
  onRecordingStop: (recording) => {
    console.log(`Recording saved: ${recording.id}`)
  }
})

// Manual recording control
const callId = 'call-123'
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

// Start recording
const recordingId = await recordingPlugin.startRecording(callId, stream, {
  audio: true,
  video: true  // Override default
})

// Pause/resume
recordingPlugin.pauseRecording(callId)
recordingPlugin.resumeRecording(callId)

// Stop recording
await recordingPlugin.stopRecording(callId)

// Download recording
recordingPlugin.downloadRecording(recordingId, 'my-call.webm')

// Get all recordings
const recordings = recordingPlugin.getAllRecordings()

// Check memory usage
const memoryUsage = recordingPlugin.getMemoryUsage()
```

#### API Methods

**startRecording(callId, stream, options?): Promise\<string\>**

Start recording for a call. Returns the recording ID.

**stopRecording(callId): Promise\<void\>**

Stop recording for a call and save to IndexedDB.

**pauseRecording(callId): void**

Pause an active recording.

**resumeRecording(callId): void**

Resume a paused recording.

**downloadRecording(recordingId, filename?): void**

Download a recording as a file.

**getAllRecordings(): RecordingData[]**

Get all recordings stored in memory (not from IndexedDB).

**getMemoryUsage(): number**

Get total memory usage of recordings in bytes.

**clearOldRecordingsFromMemory(maxAge): number**

Clear recordings from memory older than maxAge milliseconds. Returns count cleared.

#### Source Code

See: [`src/plugins/RecordingPlugin.ts`](../../src/plugins/RecordingPlugin.ts)

---

## Plugin Manager

The PluginManager coordinates all plugin lifecycle operations.

### Registration

```typescript
await pluginManager.register(plugin, config?)
```

**Parameters:**
- `plugin: Plugin` - Plugin instance to register
- `config?: PluginConfig` - Optional configuration

**Process:**
1. Validates plugin is not already registered
2. Checks version compatibility
3. Verifies dependencies are installed
4. Merges configuration with defaults
5. Creates plugin entry with state 'Registered'
6. If enabled, installs the plugin
7. Emits 'plugin:installed' event

**Example:**
```typescript
import { createMyPlugin } from './MyPlugin'

const myPlugin = createMyPlugin()

await pluginManager.register(myPlugin, {
  enabled: true,
  myOption: 'custom value'
})
```

### Configuration Updates

```typescript
await pluginManager.updateConfig(pluginName, config)
```

Update plugin configuration at runtime without reinstalling.

**Parameters:**
- `pluginName: string` - Name of the plugin
- `config: PluginConfig` - New configuration (partial or complete)

**Process:**
1. Merges new config with existing config
2. Calls plugin's `updateConfig()` method if implemented
3. Emits 'plugin:configUpdated' event

**Example:**
```typescript
await pluginManager.updateConfig('analytics', {
  batchSize: 50,
  sendInterval: 30000
})
```

### Dependency Management

Plugins can declare dependencies on other plugins:

```typescript
metadata: {
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['auth-plugin', 'logging-plugin']
}
```

**Requirements:**
- Dependencies must be registered before the dependent plugin
- Dependencies must be in 'Installed' state
- Circular dependencies are not detected (avoid them)
- Registration fails if dependencies are missing

**Example:**
```typescript
// Register base plugins first
await pluginManager.register(authPlugin)
await pluginManager.register(loggingPlugin)

// Now register dependent plugin
await pluginManager.register(analyticsPlugin)  // Success
```

### Version Compatibility

Plugins can specify version requirements:

```typescript
metadata: {
  name: 'my-plugin',
  version: '1.0.0',
  minVersion: '2.0.0',  // Requires VueSip >= 2.0.0
  maxVersion: '3.0.0'   // Requires VueSip <= 3.0.0
}
```

**Validation:**
- Version strings use semantic versioning (MAJOR.MINOR.PATCH)
- `minVersion` is inclusive (>=)
- `maxVersion` is inclusive (<=)
- Registration fails if current version is outside the range

---

## API Reference

### PluginManager

#### Methods

**register\<TConfig\>(plugin, config?): Promise\<void\>**

Register and install a plugin.

**unregister(pluginName): Promise\<void\>**

Unregister and uninstall a plugin.

**get(pluginName): PluginEntry | undefined**

Get a plugin entry by name.

**has(pluginName): boolean**

Check if a plugin is registered.

**getAll(): Map\<string, PluginEntry\>**

Get all registered plugins.

**updateConfig\<TConfig\>(pluginName, config): Promise\<void\>**

Update a plugin's configuration.

**executeHook\<TData, TReturn\>(name, data?): Promise\<TReturn[]\>**

Execute all handlers for a hook.

**destroy(): Promise\<void\>**

Destroy the plugin manager and uninstall all plugins.

**getStats(): PluginStats**

Get statistics about registered plugins and hooks.

#### Plugin States

```typescript
enum PluginState {
  Registered = 'registered',      // Registered but not installed
  Installing = 'installing',      // Installation in progress
  Installed = 'installed',        // Fully operational
  Uninstalling = 'uninstalling',  // Cleanup in progress
  Failed = 'failed',              // Installation failed
}
```

### HookManager

#### Methods

**register\<TData, TReturn\>(name, handler, options?, pluginName?): string**

Register a hook handler. Returns hook ID.

**unregister(hookId): boolean**

Unregister a specific hook by ID.

**unregisterByPlugin(pluginName): number**

Unregister all hooks from a plugin. Returns count removed.

**execute\<TData, TReturn\>(name, data?): Promise\<TReturn[]\>**

Execute all handlers for a hook.

**get(name): HookRegistration[]**

Get all handlers for a hook name.

**has(name): boolean**

Check if a hook has any handlers.

**count(name): number**

Get the number of handlers for a hook.

**clear(): void**

Remove all hooks from all plugins.

**getStats(): HookStats**

Get statistics about registered hooks.

---

## Source Code Links

- **Plugin System Overview**: [`src/plugins/index.ts`](../../src/plugins/index.ts)
- **Plugin Types**: [`src/types/plugin.types.ts`](../../src/types/plugin.types.ts)
- **PluginManager**: [`src/plugins/PluginManager.ts`](../../src/plugins/PluginManager.ts)
- **HookManager**: [`src/plugins/HookManager.ts`](../../src/plugins/HookManager.ts)
- **AnalyticsPlugin**: [`src/plugins/AnalyticsPlugin.ts`](../../src/plugins/AnalyticsPlugin.ts)
- **RecordingPlugin**: [`src/plugins/RecordingPlugin.ts`](../../src/plugins/RecordingPlugin.ts)

---

*Last updated: 2025-11-08*
