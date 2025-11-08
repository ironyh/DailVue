/**
 * Analytics Plugin for VueSip
 *
 * Provides comprehensive analytics and event tracking capabilities for VueSip applications.
 * Tracks SIP connection events, call lifecycle, media events, and custom application events,
 * then sends them to a configured analytics endpoint with support for batching, filtering,
 * transformation, and queue management.
 *
 * @remarks
 * This plugin integrates with VueSip's event system to automatically track important events
 * and report them to your analytics backend. It provides intelligent batching to reduce
 * network overhead, flexible event filtering to track only relevant events, and robust
 * queue management to handle temporary network failures.
 *
 * ## Features
 * - Automatic tracking of SIP connection, registration, call, and media events
 * - Event batching with configurable size and time intervals
 * - Flexible event filtering with wildcard pattern support
 * - Event transformation for data sanitization or enrichment
 * - Session and user tracking
 * - Queue management with overflow protection (FIFO)
 * - Payload size validation to prevent oversized requests
 * - Request timeout handling with AbortController
 * - Event requeuing on failure for reliability
 * - Cryptographic session ID generation
 *
 * ## Event Batching Mechanism
 * The plugin supports two sending modes:
 *
 * **Batch Mode (batchEvents: true)**:
 * - Events are queued in memory until batch size or time interval is reached
 * - Batch size trigger: When queue reaches `batchSize` events (default: 10)
 * - Time interval trigger: Every `sendInterval` milliseconds (default: 30 seconds)
 * - Reduces network requests and server load for high-volume applications
 * - Events are sent as an array in a single HTTP POST request
 *
 * **Immediate Mode (batchEvents: false)**:
 * - Each event is sent immediately in its own HTTP POST request
 * - No batching timer is started
 * - Suitable for low-volume applications or real-time requirements
 * - Higher network overhead but lower latency
 *
 * ## Event Filtering
 * The plugin provides two complementary filtering mechanisms:
 *
 * **trackEvents** (whitelist):
 * - When empty array (default): Track all events
 * - When populated: Only track events matching these patterns
 * - Example: `['call:*', 'sip:connected']` tracks only call events and SIP connection
 *
 * **ignoreEvents** (blacklist):
 * - Always applied after trackEvents check
 * - Prevents tracking of specific events even if they match trackEvents
 * - Takes precedence over trackEvents
 * - Example: `['call:failed', 'media:error']` ignores error events
 *
 * **Wildcard Patterns**:
 * Both filtering options support wildcard patterns:
 * - `'*'`: Matches all events
 * - `'call:*'`: Matches all call events (call:started, call:ended, call:failed, etc.)
 * - `'sip:*'`: Matches all SIP events
 * - Includes ReDoS protection with pattern sanitization and complexity checks
 *
 * ## Event Transformation
 * The `transformEvent` callback allows you to:
 * - Sanitize sensitive data (remove PII, mask phone numbers)
 * - Enrich events with additional context
 * - Normalize event data for your analytics backend
 * - Filter out specific properties
 * - Transformation errors are caught and logged, original event is sent
 *
 * ## Session and User Tracking
 * - **Session ID**: Automatically generated using crypto.randomUUID() for uniqueness
 * - Included in every event for session correlation
 * - Generated once when plugin is instantiated, persists for plugin lifetime
 * - **User ID**: Optional, can be set via setUserId() method
 * - Only included in events when `includeUserInfo: true` and userId is set
 * - Allows tracking user behavior across sessions
 *
 * ## Queue Management
 * The event queue has built-in overflow protection:
 * - Maximum queue size: `maxQueueSize` events (default: 1000)
 * - When queue is full and new event arrives:
 *   1. Calculate drop count: 10% of maxQueueSize
 *   2. Remove oldest events (FIFO) to make room
 *   3. Log warning with drop count
 *   4. Add new event to queue
 * - Prevents unbounded memory growth during network outages
 * - Failed requests requeue events (respecting capacity)
 *
 * ## Payload Size Validation
 * Each event is validated before queuing:
 * - Serializes event to JSON and calculates size in bytes
 * - Maximum size: `maxPayloadSize` bytes (default: 100KB)
 * - Events exceeding limit are rejected and logged
 * - Prevents server rejection due to oversized payloads
 * - Uses Blob API for accurate size calculation
 *
 * ## Request Timeout Handling
 * HTTP requests have timeout protection:
 * - Timeout duration: `requestTimeout` milliseconds (default: 30 seconds)
 * - Uses AbortController to cancel stalled requests
 * - Timed out requests are treated as failures
 * - Events from timed out requests are requeued (respecting capacity)
 * - Prevents indefinite hanging on network issues
 *
 * @example Basic analytics setup
 * ```typescript
 * import { createAnalyticsPlugin } from './plugins/AnalyticsPlugin'
 *
 * const analyticsPlugin = createAnalyticsPlugin()
 *
 * // Install with basic configuration
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   includeUserInfo: true
 * })
 *
 * // Set user ID for tracking
 * analyticsPlugin.setUserId('user-123')
 * ```
 *
 * @example Event batching configuration
 * ```typescript
 * // High-volume application with aggressive batching
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   batchEvents: true,
 *   batchSize: 50,         // Send when 50 events accumulated
 *   sendInterval: 60000,   // Or send every 60 seconds
 *   maxQueueSize: 2000     // Allow larger queue for high volume
 * })
 *
 * // Low-volume application with immediate sending
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   batchEvents: false     // Send each event immediately
 * })
 * ```
 *
 * @example Event filtering with wildcards
 * ```typescript
 * // Track only call-related events
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   trackEvents: ['call:*', 'plugin:installed']  // Whitelist
 * })
 *
 * // Track all events except errors
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   trackEvents: [],                              // Track all
 *   ignoreEvents: ['*:*Failed', '*:error']        // Blacklist errors
 * })
 *
 * // Track all SIP events except failed registration
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   trackEvents: ['sip:*'],
 *   ignoreEvents: ['sip:registrationFailed']
 * })
 * ```
 *
 * @example Event transformation for data sanitization
 * ```typescript
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   transformEvent: (event) => {
 *     // Remove sensitive data
 *     if (event.data?.phoneNumber) {
 *       event.data.phoneNumber = event.data.phoneNumber.replace(/\d{4}$/, '****')
 *     }
 *
 *     // Add application context
 *     event.data = {
 *       ...event.data,
 *       appVersion: '1.0.0',
 *       environment: 'production'
 *     }
 *
 *     return event
 *   }
 * })
 * ```
 *
 * @example Custom event tracking
 * ```typescript
 * // The plugin automatically tracks SIP and call events
 * // For custom events, emit through the event bus
 *
 * // In your application code:
 * eventBus.emit('userAction', { action: 'buttonClick', button: 'hangup' })
 *
 * // Register listener in plugin if you need to track custom events
 * const analyticsPlugin = createAnalyticsPlugin()
 *
 * // After installation, listen for custom events
 * eventBus.on('userAction', (data) => {
 *   // Plugin will track this if event type matches filters
 * })
 * ```
 *
 * @example Error handling and monitoring
 * ```typescript
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   requestTimeout: 10000,  // 10 second timeout
 *   maxPayloadSize: 50000,  // 50KB limit
 *   validateEventData: true // Enable validation
 * })
 *
 * // Monitor analytics errors
 * eventBus.on('plugin:error', ({ pluginName, error }) => {
 *   if (pluginName === 'analytics') {
 *     console.error('Analytics error:', error)
 *     // Handle error (e.g., disable analytics, notify monitoring)
 *   }
 * })
 * ```
 *
 * @example Queue management and overflow handling
 * ```typescript
 * // Configure queue management for unreliable networks
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   maxQueueSize: 500,      // Limit queue size
 *   batchSize: 20,          // Send in batches of 20
 *   sendInterval: 15000,    // Try sending every 15 seconds
 *   requestTimeout: 5000    // Fail fast with 5s timeout
 * })
 *
 * // When queue overflows:
 * // 1. Plugin drops oldest 10% (50 events) from queue
 * // 2. Logs warning: "Event queue overflow, dropped 50 old events"
 * // 3. Adds new event to queue
 * // 4. This prevents unbounded memory growth during outages
 * ```
 */

import { createLogger } from '../utils/logger'
import type {
  Plugin,
  PluginContext,
  AnalyticsPluginConfig,
  AnalyticsEvent,
} from '../types/plugin.types'

const logger = createLogger('AnalyticsPlugin')

/**
 * Default analytics plugin configuration
 *
 * @remarks
 * This configuration object defines all available options for the analytics plugin.
 * All options can be overridden when installing the plugin or updating configuration at runtime.
 *
 * ## Configuration Options
 *
 * ### enabled
 * - Type: `boolean`
 * - Default: `true`
 * - Description: Whether the analytics plugin is enabled. When disabled, events are not tracked
 *   or sent to the endpoint. Useful for development environments or feature toggling.
 *
 * ### endpoint
 * - Type: `string`
 * - Default: `''` (empty string)
 * - Description: The HTTP endpoint URL where analytics events will be sent via POST requests.
 *   When empty, events are logged but not sent (useful for testing). The endpoint should accept
 *   JSON POST requests with a body of `{ events: AnalyticsEvent[] }` for batch mode or
 *   `{ events: [AnalyticsEvent] }` for immediate mode.
 *
 * ### batchEvents
 * - Type: `boolean`
 * - Default: `true`
 * - Description: Enable event batching to reduce network requests. When true, events are queued
 *   and sent in batches when either `batchSize` is reached or `sendInterval` expires. When false,
 *   each event is sent immediately in its own request.
 *
 * ### batchSize
 * - Type: `number`
 * - Default: `10`
 * - Description: Number of events to accumulate before automatically sending a batch. Only used
 *   when `batchEvents` is true. When the queue reaches this size, events are sent immediately
 *   without waiting for the send interval. Higher values reduce network overhead but increase
 *   latency and memory usage.
 *
 * ### sendInterval
 * - Type: `number`
 * - Default: `30000` (30 seconds)
 * - Description: Time in milliseconds between automatic batch sends. Only used when `batchEvents`
 *   is true. Events are sent when this interval expires, even if `batchSize` has not been reached.
 *   Lower values reduce event latency but increase network requests. Set to a higher value for
 *   high-volume applications to maximize batching efficiency.
 *
 * ### includeUserInfo
 * - Type: `boolean`
 * - Default: `false`
 * - Description: Whether to include user ID in tracked events. When true and a user ID has been
 *   set via `setUserId()`, the `userId` field is added to each event. When false, user ID is
 *   never included, even if set. Useful for privacy-conscious applications or when user tracking
 *   is handled separately.
 *
 * ### transformEvent
 * - Type: `(event: AnalyticsEvent) => AnalyticsEvent`
 * - Default: Identity function (returns event unchanged)
 * - Description: Callback function to transform events before they are queued or sent. Receives
 *   the original event and must return a transformed event. Common use cases include:
 *   - Sanitizing sensitive data (remove PII, mask phone numbers)
 *   - Enriching events with application context (version, environment)
 *   - Normalizing event data for backend requirements
 *   - Filtering or modifying event properties
 *   If transformation throws an error, it is caught and logged, and the original event is used.
 *
 * ### trackEvents
 * - Type: `string[]`
 * - Default: `[]` (empty array - track all events)
 * - Description: Whitelist of event type patterns to track. When empty, all events are tracked.
 *   When populated, only events matching these patterns are tracked. Supports wildcard patterns:
 *   - `'*'`: Matches all events
 *   - `'call:*'`: Matches all call events (call:started, call:answered, call:ended, etc.)
 *   - `'sip:connected'`: Matches exact event type
 *   Patterns are checked before `ignoreEvents`. If an event matches both `trackEvents` and
 *   `ignoreEvents`, it is ignored (blacklist takes precedence).
 *
 * ### ignoreEvents
 * - Type: `string[]`
 * - Default: `[]` (empty array - don't ignore any events)
 * - Description: Blacklist of event type patterns to ignore. Events matching these patterns are
 *   never tracked, even if they match `trackEvents`. Supports the same wildcard patterns as
 *   `trackEvents`. Takes precedence over `trackEvents`. Useful for filtering out noise or
 *   error events:
 *   - `['*:*Failed', '*:error']`: Ignore all failure and error events
 *   - `['media:*']`: Ignore all media events
 *   - `['call:failed']`: Ignore specific event type
 *
 * ### maxQueueSize
 * - Type: `number`
 * - Default: `1000`
 * - Description: Maximum number of events to keep in the queue before dropping old events.
 *   When the queue reaches this size and a new event arrives, the oldest 10% of events are
 *   removed (FIFO) to make room. This prevents unbounded memory growth during network outages
 *   or when the endpoint is unreachable. Higher values provide more buffering for unreliable
 *   networks but consume more memory.
 *
 * ### requestTimeout
 * - Type: `number`
 * - Default: `30000` (30 seconds)
 * - Description: Maximum time in milliseconds to wait for HTTP requests to complete. Requests
 *   that exceed this timeout are aborted using AbortController and treated as failures. Events
 *   from timed out requests are requeued (respecting `maxQueueSize`). Lower values fail faster
 *   but may drop events on slow networks. Higher values are more tolerant of latency but can
 *   delay error detection.
 *
 * ### maxPayloadSize
 * - Type: `number`
 * - Default: `100000` (100KB)
 * - Description: Maximum size in bytes for individual event payloads. Events exceeding this size
 *   are rejected and logged as warnings. This prevents server rejection due to oversized payloads
 *   and catches potential data issues (e.g., accidentally including large objects). Size is
 *   calculated by serializing the event to JSON and measuring the resulting byte length.
 *
 * ### validateEventData
 * - Type: `boolean`
 * - Default: `true`
 * - Description: Whether to validate event data before queuing. When enabled, the plugin checks:
 *   - Event data is undefined, null, or a plain object (not an array or primitive)
 *   - Events with invalid data are rejected and logged
 *   When disabled, all event data is accepted without validation. Disabling validation can
 *   improve performance but may allow malformed events to be sent to the analytics endpoint.
 */
const DEFAULT_CONFIG: Required<AnalyticsPluginConfig> = {
  enabled: true,
  endpoint: '',
  batchEvents: true,
  batchSize: 10,
  sendInterval: 30000, // 30 seconds
  includeUserInfo: false,
  transformEvent: (event: AnalyticsEvent) => event,
  trackEvents: [], // Empty = track all events
  ignoreEvents: [],
  maxQueueSize: 1000, // Maximum events in queue before dropping old ones
  requestTimeout: 30000, // 30 seconds timeout for requests
  maxPayloadSize: 100000, // 100KB maximum payload size
  validateEventData: true, // Validate event data by default
}

/**
 * AnalyticsPlugin class
 *
 * Main plugin class that implements the Plugin interface for VueSip analytics tracking.
 * Manages event tracking, batching, filtering, queue management, and HTTP delivery to
 * analytics endpoints. Integrates with VueSip's event system to automatically track
 * SIP, call, and media events.
 *
 * @remarks
 * This class is the core implementation of the analytics functionality. It maintains
 * an event queue for batching, manages a periodic send timer, tracks session and user
 * information, and provides robust error handling with event requeuing on failures.
 *
 * ## Event Queue Management
 * The plugin maintains an in-memory queue of events:
 * - Events are added to the queue when tracked (after filtering and validation)
 * - Queue has a maximum size (`maxQueueSize`) to prevent unbounded growth
 * - When full, oldest 10% of events are dropped (FIFO) to make room
 * - Queue is flushed when batch size is reached or send interval expires
 * - Failed requests requeue events (respecting capacity limits)
 * - Queue is flushed on plugin uninstallation to avoid data loss
 *
 * ## Session Tracking
 * Each plugin instance generates a unique session ID:
 * - Generated once during construction using crypto.randomUUID() if available
 * - Falls back to timestamp + random string for compatibility
 * - Included in every tracked event for session correlation
 * - Persists for the lifetime of the plugin instance
 * - New session ID generated if plugin is reinstantiated
 *
 * ## Batching vs Immediate Sending
 * The plugin supports two sending modes based on `batchEvents` configuration:
 *
 * **Batch Mode** (batchEvents: true):
 * - Batch timer started during installation
 * - Events accumulated in queue until trigger condition:
 *   - Queue size reaches `batchSize`, OR
 *   - `sendInterval` expires
 * - All queued events sent together in single HTTP request
 * - Concurrent flush operations prevented with `isFlushing` flag
 * - Timer stopped during uninstallation or config update
 *
 * **Immediate Mode** (batchEvents: false):
 * - No batch timer started
 * - Each event sent individually in its own HTTP request
 * - Higher network overhead but lower latency
 * - No queue accumulation (events sent immediately)
 *
 * ## Tracked Events
 * The plugin automatically registers listeners for these VueSip events:
 * - **Connection**: connected, disconnected, connectionFailed
 * - **Registration**: registered, unregistered, registrationFailed
 * - **Call**: callStarted, callAnswered, callEnded, callFailed
 * - **Media**: mediaAcquired, mediaReleased, mediaError
 * - **Plugin**: plugin:installed (tracks its own installation)
 *
 * All events are subject to filtering via `trackEvents` and `ignoreEvents` configuration.
 *
 * @see {@link createAnalyticsPlugin} for the factory function to create instances
 * @see {@link DEFAULT_CONFIG} for available configuration options
 */
export class AnalyticsPlugin implements Plugin<AnalyticsPluginConfig> {
  /** Plugin metadata */
  metadata = {
    name: 'analytics',
    version: '1.0.0',
    description: 'Analytics and event tracking plugin',
    author: 'VueSip',
    license: 'MIT',
  }

  /** Default configuration */
  defaultConfig = DEFAULT_CONFIG

  /** Current configuration */
  private config: Required<AnalyticsPluginConfig> = DEFAULT_CONFIG

  /** Event queue for batching */
  private eventQueue: AnalyticsEvent[] = []

  /** Batch send interval timer */
  private batchTimer: ReturnType<typeof setInterval> | null = null

  /** Session ID */
  private sessionId: string

  /** User ID (if available) */
  private userId?: string

  /** Event listener cleanup functions */
  private cleanupFunctions: Array<() => void> = []

  /** Flag to prevent concurrent flush operations */
  private isFlushing: boolean = false

  /** Abort controller for fetch timeout */
  private abortController: AbortController | null = null

  /** Flag to prevent multiple install calls */
  private isInstalled: boolean = false

  constructor() {
    // Generate session ID using crypto for better uniqueness
    this.sessionId = this.generateSessionId()
  }

  /**
   * Generate a unique session ID using cryptographically secure random values
   * @returns A unique session ID
   */
  private generateSessionId(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `session-${crypto.randomUUID()}`
    }

    // Fallback: Use Web Crypto API with getRandomValues
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(4)
      crypto.getRandomValues(array)
      const hex = Array.from(array)
        .map((num) => num.toString(16).padStart(8, '0'))
        .join('')
      return `session-${Date.now()}-${hex}`
    }

    // Final fallback for non-browser environments (testing)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const random2 = Math.random().toString(36).substring(2, 15)
    logger.warn('Using non-cryptographic session ID generation - crypto API not available')
    return `session-${timestamp}-${random}${random2}`
  }

  /**
   * Install the analytics plugin into VueSip
   *
   * Initializes the analytics plugin by merging configuration, registering event listeners for
   * automatic tracking, and starting the batch send timer if batching is enabled. This method
   * must be called before any events can be tracked and sent to the analytics endpoint.
   *
   * @param context - The plugin context provided by VueSip's plugin manager, containing the event bus
   *   and other runtime information needed for plugin integration
   * @param config - Optional configuration object to override default settings. All properties are optional
   *   and will be merged with {@link DEFAULT_CONFIG}. Common options include:
   *   - `enabled`: Whether analytics is enabled (default: true)
   *   - `endpoint`: Analytics endpoint URL (default: '')
   *   - `batchEvents`: Enable event batching (default: true)
   *   - `batchSize`: Events per batch (default: 10)
   *   - `sendInterval`: Milliseconds between batch sends (default: 30000)
   *   - `trackEvents`: Whitelist of event patterns to track (default: [] - all events)
   *   - `ignoreEvents`: Blacklist of event patterns to ignore (default: [])
   *   - `transformEvent`: Event transformation function
   *   - `includeUserInfo`: Include user ID in events (default: false)
   *   - `maxQueueSize`: Maximum events in queue (default: 1000)
   *   - `requestTimeout`: HTTP request timeout (default: 30000ms)
   *   - `maxPayloadSize`: Maximum event size in bytes (default: 100000)
   *   - `validateEventData`: Validate event data (default: true)
   *
   * @returns A promise that resolves when installation is complete, including event listener
   *   registration and batch timer initialization
   *
   * @throws {Error} If the plugin is already installed (prevents double installation)
   *
   * @remarks
   * ## Installation Process
   * 1. Checks if plugin is already installed to prevent duplicate installation
   * 2. Merges provided config with {@link DEFAULT_CONFIG}
   * 3. Validates that endpoint is configured (logs warning if missing)
   * 4. Registers event listeners for SIP, call, and media events
   * 5. Starts batch timer if `batchEvents` is true
   * 6. Marks plugin as installed with `isInstalled` flag
   * 7. Tracks a 'plugin:installed' event to record the installation
   *
   * ## Event Listener Registration
   * The following event listeners are registered on the event bus:
   * - **Connection Events**: connected, disconnected, connectionFailed
   * - **Registration Events**: registered, unregistered, registrationFailed
   * - **Call Events**: callStarted, callAnswered, callEnded, callFailed
   * - **Media Events**: mediaAcquired, mediaReleased, mediaError
   *
   * All listeners are tracked in `cleanupFunctions` array for proper cleanup during uninstallation.
   *
   * ## Batch Timer Management
   * If `batchEvents` is true:
   * - Timer is started with interval of `sendInterval` milliseconds
   * - Timer calls `flushEvents()` on each tick to send queued events
   * - Timer is stored in `batchTimer` for cleanup during uninstallation
   * - Multiple calls to `startBatchTimer()` are prevented (idempotent)
   *
   * ## Configuration Validation
   * The plugin warns if enabled but no endpoint is configured:
   * - Events will be tracked but not sent (logged instead)
   * - Useful for testing and development environments
   * - Production deployments should always configure an endpoint
   *
   * ## Error Handling
   * If installation fails:
   * - Batch timer is stopped (if started)
   * - All registered event listeners are removed
   * - `cleanupFunctions` array is cleared
   * - Error is logged with context
   * - Error is re-thrown to caller
   *
   * ## Double Installation Prevention
   * The plugin uses `isInstalled` flag to prevent duplicate installation:
   * - Returns early with warning if already installed
   * - Prevents duplicate event listeners and timers
   * - Flag is cleared during uninstallation to allow reinstallation
   *
   * @example Basic installation with default settings
   * ```typescript
   * const plugin = createAnalyticsPlugin()
   * await plugin.install(context, {
   *   endpoint: 'https://analytics.example.com/events'
   * })
   * // Plugin ready with default batching and all events tracked
   * ```
   *
   * @example Installation with custom batching configuration
   * ```typescript
   * const plugin = createAnalyticsPlugin()
   * await plugin.install(context, {
   *   enabled: true,
   *   endpoint: 'https://analytics.example.com/events',
   *   batchEvents: true,
   *   batchSize: 50,        // Larger batches
   *   sendInterval: 60000,  // Send every minute
   *   maxQueueSize: 2000    // Larger queue for high volume
   * })
   * ```
   *
   * @example Installation with event filtering
   * ```typescript
   * const plugin = createAnalyticsPlugin()
   * await plugin.install(context, {
   *   enabled: true,
   *   endpoint: 'https://analytics.example.com/events',
   *   trackEvents: ['call:*', 'sip:connected'],  // Only track calls and SIP connection
   *   ignoreEvents: ['call:failed']              // Except call failures
   * })
   * ```
   *
   * @example Installation with event transformation
   * ```typescript
   * const plugin = createAnalyticsPlugin()
   * await plugin.install(context, {
   *   enabled: true,
   *   endpoint: 'https://analytics.example.com/events',
   *   includeUserInfo: true,
   *   transformEvent: (event) => {
   *     // Sanitize phone numbers
   *     if (event.data?.phoneNumber) {
   *       event.data.phoneNumber = event.data.phoneNumber.replace(/\d{4}$/, '****')
   *     }
   *     // Add application context
   *     event.data = {
   *       ...event.data,
   *       appVersion: '1.0.0',
   *       environment: 'production'
   *     }
   *     return event
   *   }
   * })
   * // Set user ID after installation
   * plugin.setUserId('user-123')
   * ```
   *
   * @example Installation with error handling
   * ```typescript
   * const plugin = createAnalyticsPlugin()
   * try {
   *   await plugin.install(context, {
   *     endpoint: 'https://analytics.example.com/events'
   *   })
   *   console.log('Analytics plugin installed successfully')
   * } catch (error) {
   *   console.error('Failed to install analytics plugin:', error)
   *   // Handle error (e.g., disable analytics, notify monitoring)
   * }
   * ```
   */
  async install(context: PluginContext, config?: AnalyticsPluginConfig): Promise<void> {
    // Prevent multiple install calls
    if (this.isInstalled) {
      logger.warn('Analytics plugin is already installed, ignoring')
      return
    }

    try {
      this.config = { ...DEFAULT_CONFIG, ...config }

      // Validate configuration
      if (!this.config.endpoint && this.config.enabled) {
        logger.warn('Analytics plugin enabled but no endpoint configured')
      }

      logger.info('Installing analytics plugin')

      // Register event listeners
      this.registerEventListeners(context)

      // Start batch timer if batching is enabled
      if (this.config.batchEvents) {
        this.startBatchTimer()
      }

      // Mark as installed
      this.isInstalled = true

      // Track plugin installation
      this.trackEvent('plugin:installed', {
        plugin: this.metadata.name,
        version: this.metadata.version,
      })

      logger.info('Analytics plugin installed')
    } catch (error) {
      // Cleanup timer if installation fails
      this.stopBatchTimer()

      // Remove any registered event listeners
      for (const cleanup of this.cleanupFunctions) {
        cleanup()
      }
      this.cleanupFunctions = []

      logger.error('Failed to install analytics plugin', error)
      throw error
    }
  }

  /**
   * Uninstall the analytics plugin from VueSip
   *
   * Performs cleanup of the analytics plugin by flushing remaining events, stopping the batch
   * timer, removing all event listeners, and resetting the installed flag. This ensures proper
   * cleanup and allows the plugin to be reinstalled if needed.
   *
   * @param _context - The plugin context (unused but required by Plugin interface)
   *
   * @returns A promise that resolves when uninstallation and cleanup are complete, including
   *   flushing of any remaining queued events
   *
   * @remarks
   * ## Uninstallation Process
   * 1. Flushes any remaining events in the queue to avoid data loss
   * 2. Stops the batch timer (if running) and clears the timer reference
   * 3. Removes all registered event listeners from the event bus
   * 4. Clears the `cleanupFunctions` array
   * 5. Resets the `isInstalled` flag to allow reinstallation
   *
   * ## Event Queue Flushing
   * Before cleanup, the plugin attempts to send any queued events:
   * - Calls `flushEvents()` to send all pending events
   * - This is a best-effort operation - failures are logged but don't prevent cleanup
   * - Prevents data loss of events that were queued but not yet sent
   * - Important for ensuring analytics data completeness
   *
   * ## Batch Timer Cleanup
   * If batch mode is enabled:
   * - Timer is stopped with `clearInterval()`
   * - Timer reference is set to null
   * - Prevents timer from continuing to run after uninstallation
   * - Avoids memory leaks and unnecessary operations
   *
   * ## Event Listener Cleanup
   * All registered event listeners are removed:
   * - Iterates through `cleanupFunctions` array
   * - Calls each cleanup function to remove its listener
   * - Clears the array after all listeners are removed
   * - Prevents orphaned listeners from firing after uninstallation
   *
   * ## Reinstallation Support
   * The plugin can be reinstalled after uninstallation:
   * - `isInstalled` flag is reset to false
   * - New installation will register fresh listeners and timers
   * - Session ID remains the same (tied to instance, not installation)
   * - User ID is preserved (not cleared during uninstallation)
   *
   * ## Error Handling
   * The uninstallation process is designed to always complete:
   * - Event flush errors are handled by `flushEvents()` internally
   * - Cleanup operations are simple and unlikely to fail
   * - Even if flush fails, cleanup proceeds normally
   * - Ensures plugin can be removed even in error scenarios
   *
   * @example Basic uninstallation
   * ```typescript
   * // Uninstall the plugin during shutdown
   * await analyticsPlugin.uninstall(context)
   * console.log('Analytics plugin uninstalled')
   * // Plugin can be reinstalled if needed
   * ```
   *
   * @example Uninstallation with reinstallation
   * ```typescript
   * // Uninstall existing plugin
   * await analyticsPlugin.uninstall(context)
   *
   * // Reinstall with new configuration
   * await analyticsPlugin.install(context, {
   *   endpoint: 'https://new-analytics.example.com/events',
   *   batchSize: 20
   * })
   * // Plugin operational again with new settings
   * ```
   *
   * @example Application shutdown sequence
   * ```typescript
   * // During application shutdown
   * try {
   *   await analyticsPlugin.uninstall(context)
   *   console.log('Analytics events flushed and plugin cleaned up')
   * } catch (error) {
   *   console.error('Error during analytics cleanup:', error)
   *   // Continue shutdown anyway - cleanup attempted
   * }
   * ```
   */
  async uninstall(_context: PluginContext): Promise<void> {
    logger.info('Uninstalling analytics plugin')

    // Send any remaining events
    await this.flushEvents()

    // Stop batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }

    // Remove event listeners
    for (const cleanup of this.cleanupFunctions) {
      cleanup()
    }
    this.cleanupFunctions = []

    // Reset installed flag to allow reinstallation
    this.isInstalled = false

    logger.info('Analytics plugin uninstalled')
  }

  /**
   * Update the analytics plugin configuration at runtime
   *
   * Merges the provided configuration with the current configuration and dynamically adjusts
   * plugin behavior including batch timer management and batching mode. This allows the plugin
   * to adapt its behavior without requiring reinstallation.
   *
   * @param _context - The plugin context (unused but required by Plugin interface)
   * @param config - Partial or complete configuration object to merge with existing config.
   *   Properties not specified retain their current values. Can include any of the configuration
   *   options from {@link DEFAULT_CONFIG}. The configuration is shallow merged.
   *
   * @returns A promise that resolves when the configuration update completes, including any
   *   necessary timer restarts or event queue flushing
   *
   * @remarks
   * ## Update Process
   * 1. Saves old configuration for comparison
   * 2. Merges new config with existing config (shallow merge)
   * 3. Checks for batch timer interval changes
   * 4. Restarts batch timer if interval changed and batching enabled
   * 5. Handles batching mode toggle (enabled ↔ disabled)
   * 6. Logs configuration update
   *
   * ## Configuration Merging
   * Configuration is merged using object spread:
   * ```typescript
   * this.config = { ...this.config, ...config }
   * ```
   * - Provided properties override existing values
   * - Missing properties retain current values
   * - Nested objects are not deep merged (shallow merge only)
   *
   * ## Batch Timer Management
   * The plugin intelligently manages the batch timer based on configuration changes:
   *
   * **Send Interval Change** (batchEvents remains true):
   * - Stops existing timer
   * - Starts new timer with updated `sendInterval`
   * - Existing queue is preserved
   *
   * **Batching Disabled** (batchEvents: false):
   * - Stops batch timer
   * - Flushes current queue to send pending events
   * - Future events sent immediately (no queuing)
   *
   * **Batching Enabled** (batchEvents: true, was false):
   * - Starts batch timer with `sendInterval`
   * - Future events will be queued and batched
   *
   * ## Event Queue Behavior
   * The event queue is preserved across configuration updates:
   * - Events in queue remain queued
   * - Only sending behavior changes
   * - When disabling batching, queue is flushed before switching modes
   * - When enabling batching, new events start accumulating
   *
   * ## Runtime Configuration Updates
   * Common configuration updates include:
   * - Changing batch size or interval for performance tuning
   * - Enabling/disabling batching based on network conditions
   * - Updating event filters (trackEvents, ignoreEvents)
   * - Changing endpoint URL
   * - Toggling user info inclusion
   * - Adjusting queue size limits
   *
   * ## No Event Emission
   * Unlike PluginManager.updateConfig(), this method does not emit events:
   * - Plugin-level updates are internal
   * - PluginManager emits 'plugin:configUpdated' when called through it
   * - Direct plugin updates are silent
   *
   * @example Update batch settings for performance tuning
   * ```typescript
   * // Reduce batching for lower latency
   * await analyticsPlugin.updateConfig(context, {
   *   batchSize: 5,
   *   sendInterval: 10000  // Send every 10 seconds
   * })
   * // Timer restarts with new interval
   * ```
   *
   * @example Toggle batching mode
   * ```typescript
   * // Switch to immediate sending
   * await analyticsPlugin.updateConfig(context, {
   *   batchEvents: false
   * })
   * // Queue flushed, future events sent immediately
   *
   * // Switch back to batching
   * await analyticsPlugin.updateConfig(context, {
   *   batchEvents: true,
   *   batchSize: 10,
   *   sendInterval: 30000
   * })
   * // Batch timer started, events will be queued
   * ```
   *
   * @example Update event filters
   * ```typescript
   * // Change which events are tracked
   * await analyticsPlugin.updateConfig(context, {
   *   trackEvents: ['call:*'],      // Only track call events
   *   ignoreEvents: ['call:failed'] // Except failures
   * })
   * // New filters apply to future events immediately
   * ```
   *
   * @example Update endpoint and queue settings
   * ```typescript
   * // Switch to new analytics backend with larger queue
   * await analyticsPlugin.updateConfig(context, {
   *   endpoint: 'https://new-analytics.example.com/events',
   *   maxQueueSize: 2000,
   *   requestTimeout: 10000
   * })
   * // Future requests use new endpoint and settings
   * ```
   *
   * @example Dynamic user tracking control
   * ```typescript
   * // Enable user tracking after user logs in
   * await analyticsPlugin.updateConfig(context, {
   *   includeUserInfo: true
   * })
   * analyticsPlugin.setUserId('user-123')
   * // Future events include user ID
   *
   * // Disable user tracking after logout
   * await analyticsPlugin.updateConfig(context, {
   *   includeUserInfo: false
   * })
   * // Future events don't include user ID (even if set)
   * ```
   */
  async updateConfig(_context: PluginContext, config: AnalyticsPluginConfig): Promise<void> {
    const oldConfig = this.config
    this.config = { ...this.config, ...config }

    // Restart batch timer if interval changed
    if (this.config.batchEvents && this.config.sendInterval !== oldConfig.sendInterval) {
      this.stopBatchTimer()
      this.startBatchTimer()
    }

    // Stop batch timer if batching disabled
    if (!this.config.batchEvents && this.batchTimer) {
      this.stopBatchTimer()
      await this.flushEvents()
    }

    // Start batch timer if batching enabled
    if (this.config.batchEvents && !oldConfig.batchEvents) {
      this.startBatchTimer()
    }

    logger.info('Analytics plugin configuration updated')
  }

  /**
   * Register event listeners for automatic event tracking
   *
   * Sets up listeners for VueSip events on the event bus to automatically track SIP connection,
   * registration, call, and media events. All listeners are registered with cleanup functions
   * stored in the `cleanupFunctions` array for proper removal during uninstallation.
   *
   * @param context - The plugin context containing the event bus to register listeners on
   *
   * @internal
   *
   * @remarks
   * ## Tracked Events
   * This method registers listeners for the following event categories:
   *
   * **Connection Events**:
   * - `connected`: SIP connection established
   * - `disconnected`: SIP connection terminated
   * - `connectionFailed`: SIP connection attempt failed (includes error message)
   *
   * **Registration Events**:
   * - `registered`: SIP registration successful
   * - `unregistered`: SIP unregistration completed
   * - `registrationFailed`: SIP registration failed (includes error message)
   *
   * **Call Events**:
   * - `callStarted`: Call initiated (includes callId and direction)
   * - `callAnswered`: Call answered by remote party (includes callId)
   * - `callEnded`: Call terminated (includes callId, duration, and cause)
   * - `callFailed`: Call failed (includes callId and error)
   *
   * **Media Events**:
   * - `mediaAcquired`: Media stream acquired successfully
   * - `mediaReleased`: Media stream released
   * - `mediaError`: Media acquisition or operation failed (includes error message)
   *
   * ## Event Data Mapping
   * Some events extract specific fields from the event data:
   * - Call events extract `callId`, `direction`, `duration`, `cause`
   * - Error events extract `error.message` for cleaner analytics data
   * - Simple events (connected, disconnected) have no additional data
   *
   * ## Cleanup Function Storage
   * For each registered listener:
   * - A cleanup function is created that removes the listener
   * - Cleanup functions are stored in the `cleanupFunctions` array
   * - During uninstallation, all cleanup functions are called
   * - This ensures complete listener removal and prevents memory leaks
   *
   * ## Event Filtering
   * All tracked events are subject to filtering:
   * - Events pass through `shouldTrackEvent()` before being recorded
   * - `trackEvents` and `ignoreEvents` configuration applies
   * - Filtered events are discarded silently (not logged)
   * - Allows selective tracking of relevant events only
   *
   * ## Listener Registration Pattern
   * The method follows this pattern for each event:
   * ```typescript
   * const handler = (data) => this.trackEvent('eventType', data)
   * eventBus.on('eventName', handler)
   * this.cleanupFunctions.push(() => eventBus.off('eventName', handler))
   * ```
   *
   * This pattern ensures:
   * - Handler has access to the plugin instance (via `this`)
   * - Cleanup function references the exact same handler instance
   * - Listener removal works correctly (function identity preserved)
   *
   * ## Error Handling
   * Event handlers do not directly handle errors:
   * - Errors in `trackEvent()` are handled by that method
   * - Handler failures do not affect other listeners
   * - Event bus continues to function normally
   * - Errors are logged by `trackEvent()` with context
   *
   * @example Listener registration flow
   * ```typescript
   * // Internal flow during plugin installation:
   * registerEventListeners(context)
   * // → Registers ~15 event listeners
   * // → Stores ~15 cleanup functions
   *
   * // Later, during uninstallation:
   * for (const cleanup of this.cleanupFunctions) {
   *   cleanup()  // Removes each listener
   * }
   * this.cleanupFunctions = []  // Clear array
   * ```
   */
  private registerEventListeners(context: PluginContext): void {
    const { eventBus } = context

    // Connection events
    const onConnected = () => this.trackEvent('sip:connected')
    const onDisconnected = () => this.trackEvent('sip:disconnected')
    const onConnectionFailed = (error: any) =>
      this.trackEvent('sip:connectionFailed', { error: error.message })

    eventBus.on('connected', onConnected)
    eventBus.on('disconnected', onDisconnected)
    eventBus.on('connectionFailed', onConnectionFailed)

    this.cleanupFunctions.push(
      () => eventBus.off('connected', onConnected),
      () => eventBus.off('disconnected', onDisconnected),
      () => eventBus.off('connectionFailed', onConnectionFailed)
    )

    // Registration events
    const onRegistered = () => this.trackEvent('sip:registered')
    const onUnregistered = () => this.trackEvent('sip:unregistered')
    const onRegistrationFailed = (error: any) =>
      this.trackEvent('sip:registrationFailed', { error: error.message })

    eventBus.on('registered', onRegistered)
    eventBus.on('unregistered', onUnregistered)
    eventBus.on('registrationFailed', onRegistrationFailed)

    this.cleanupFunctions.push(
      () => eventBus.off('registered', onRegistered),
      () => eventBus.off('unregistered', onUnregistered),
      () => eventBus.off('registrationFailed', onRegistrationFailed)
    )

    // Call events
    const onCallStarted = (data: any) =>
      this.trackEvent('call:started', {
        callId: data.callId,
        direction: data.direction,
      })

    const onCallAnswered = (data: any) =>
      this.trackEvent('call:answered', {
        callId: data.callId,
      })

    const onCallEnded = (data: any) =>
      this.trackEvent('call:ended', {
        callId: data.callId,
        duration: data.duration,
        cause: data.cause,
      })

    const onCallFailed = (data: any) =>
      this.trackEvent('call:failed', {
        callId: data.callId,
        error: data.error,
      })

    eventBus.on('callStarted', onCallStarted)
    eventBus.on('callAnswered', onCallAnswered)
    eventBus.on('callEnded', onCallEnded)
    eventBus.on('callFailed', onCallFailed)

    this.cleanupFunctions.push(
      () => eventBus.off('callStarted', onCallStarted),
      () => eventBus.off('callAnswered', onCallAnswered),
      () => eventBus.off('callEnded', onCallEnded),
      () => eventBus.off('callFailed', onCallFailed)
    )

    // Media events
    const onMediaAcquired = () => this.trackEvent('media:acquired')
    const onMediaReleased = () => this.trackEvent('media:released')
    const onMediaError = (error: any) => this.trackEvent('media:error', { error: error.message })

    eventBus.on('mediaAcquired', onMediaAcquired)
    eventBus.on('mediaReleased', onMediaReleased)
    eventBus.on('mediaError', onMediaError)

    this.cleanupFunctions.push(
      () => eventBus.off('mediaAcquired', onMediaAcquired),
      () => eventBus.off('mediaReleased', onMediaReleased),
      () => eventBus.off('mediaError', onMediaError)
    )

    logger.debug('Event listeners registered')
  }

  /**
   * Track an analytics event by creating, validating, and queueing it
   *
   * The core method for event tracking that performs filtering, validation, transformation,
   * and queuing. Creates an AnalyticsEvent object with the provided type and data, enriches
   * it with session/user information, and either queues it for batching or sends it immediately.
   *
   * @param type - The event type identifier (e.g., 'call:started', 'sip:connected'). Should follow
   *   the namespace:action convention for consistency. Must be a non-empty string.
   * @param data - Optional event data as a key-value object. Should contain relevant information
   *   about the event. Must be undefined or a plain object (not an array or primitive) when
   *   validation is enabled. Properties are application-specific.
   *
   * @internal
   *
   * @remarks
   * ## Event Creation and Validation Workflow
   * The method follows these steps to create and process an event:
   * 1. **Filtering Check**: Calls `shouldTrackEvent()` to check if event should be tracked
   * 2. **Type Validation**: Validates event type is non-empty string
   * 3. **Data Validation**: Validates event data structure (if `validateEventData` enabled)
   * 4. **Event Creation**: Creates AnalyticsEvent object with type, timestamp, data, sessionId
   * 5. **User Info Addition**: Adds userId if `includeUserInfo` is enabled and userId is set
   * 6. **Transformation**: Applies `transformEvent` callback with error handling
   * 7. **Payload Size Check**: Validates serialized size doesn't exceed `maxPayloadSize`
   * 8. **Queuing/Sending**: Adds to queue or sends immediately based on batching mode
   *
   * ## Event Filtering
   * Events are filtered before any processing:
   * - Calls `shouldTrackEvent(type)` to check against filters
   * - Returns early if event is filtered (no validation or creation occurs)
   * - Silent discard (no logging) for filtered events
   * - Reduces overhead for unwanted events
   *
   * ## Type Validation
   * Event type must meet these requirements:
   * - Must be defined (not null/undefined)
   * - Must be a string
   * - Must have length > 0
   * - Invalid types are logged and rejected
   *
   * ## Data Validation
   * When `validateEventData` is true, event data must be:
   * - `undefined` (no data) - valid
   * - Plain object (`typeof data === 'object'` and not an array) - valid
   * - Not `null` - invalid
   * - Not an array - invalid
   * - Not a primitive (string, number, boolean) - invalid
   * - Empty objects (`{}`) are valid (some events have no extra data)
   *
   * ## Event Structure
   * Created events have this structure:
   * ```typescript
   * {
   *   type: string,           // Event type
   *   timestamp: Date,        // Creation timestamp
   *   data?: object,          // Optional event data
   *   sessionId: string,      // Plugin session ID
   *   userId?: string         // Optional user ID (if includeUserInfo)
   * }
   * ```
   *
   * ## Event Transformation
   * The `transformEvent` callback is applied:
   * - Receives the created event as input
   * - Must return a transformed event (or same event)
   * - Errors are caught and logged
   * - On error, original untransformed event is used
   * - Allows data sanitization, enrichment, or normalization
   *
   * ## Payload Size Validation
   * Before queuing, event size is checked:
   * - Event is serialized to JSON
   * - Size is calculated using Blob API (accurate byte count)
   * - Events exceeding `maxPayloadSize` are rejected and logged
   * - Prevents server rejection and identifies data issues
   *
   * ## Batching Mode (batchEvents: true)
   * In batch mode:
   * - Event is added to the queue
   * - Queue overflow check: If queue at `maxQueueSize`, drop oldest 10%
   * - Batch trigger check: If queue reaches `batchSize`, call `flushEvents()`
   * - Events accumulate until batch size or timer interval reached
   *
   * ## Immediate Mode (batchEvents: false)
   * In immediate mode:
   * - Event is wrapped in array: `[event]`
   * - `sendEvents()` is called immediately with single event
   * - No queuing occurs
   * - Higher network overhead but lower latency
   *
   * ## Queue Overflow Handling
   * When queue is full and new event arrives:
   * - Calculate drop count: `Math.floor(maxQueueSize * 0.1)` (10%)
   * - Remove oldest events using `splice(0, dropCount)` (FIFO)
   * - Log warning with drop count
   * - Add new event to queue
   * - Prevents unbounded memory growth during network issues
   *
   * ## Error Handling
   * Errors are caught at multiple stages:
   * - Invalid type: logged and event rejected
   * - Invalid data: logged and event rejected
   * - Transformation error: logged, original event used
   * - Payload too large: logged and event rejected
   * - Send error: logged by `sendEvents()` or `flushEvents()`
   *
   * @example Event tracking flow - batch mode
   * ```typescript
   * // Internal flow when tracking an event:
   * this.trackEvent('call:started', { callId: 'call-123', direction: 'outgoing' })
   * // 1. shouldTrackEvent('call:started') → true (passes filter)
   * // 2. Validate type and data → valid
   * // 3. Create event object with sessionId
   * // 4. Apply transformEvent() → event possibly modified
   * // 5. Check payload size → 245 bytes, within limit
   * // 6. Add to queue → queue now has 5 events
   * // 7. Check batch size → 5 < 10, no flush
   * // Event queued, will be sent with next batch
   * ```
   *
   * @example Event tracking flow - queue overflow
   * ```typescript
   * // Queue at maxQueueSize (1000), new event arrives:
   * this.trackEvent('call:ended', data)
   * // 1. Event passes all checks
   * // 2. Queue full: 1000 >= 1000
   * // 3. Calculate drop count: 1000 * 0.1 = 100
   * // 4. Remove 100 oldest events from queue
   * // 5. Log: "Event queue overflow, dropped 100 old events"
   * // 6. Add new event to queue (now 901 events)
   * ```
   *
   * @example Event tracking flow - batch trigger
   * ```typescript
   * // Queue has 9 events, new event arrives:
   * this.trackEvent('sip:registered')
   * // 1. Event passes all checks
   * // 2. Add to queue → queue now has 10 events
   * // 3. Check batch size → 10 >= 10, trigger flush
   * // 4. flushEvents() called asynchronously
   * // 5. Queue contents sent to endpoint
   * // Event sent immediately as part of batch
   * ```
   */
  private trackEvent(type: string, data?: Record<string, any>): void {
    // Check if event should be tracked
    if (!this.shouldTrackEvent(type)) {
      return
    }

    // Validate event type
    if (!type || typeof type !== 'string' || type.length === 0) {
      logger.warn('Invalid event type, skipping')
      return
    }

    // Validate event data if enabled
    if (this.config.validateEventData && !this.isValidEventData(data)) {
      logger.warn(`Invalid event data for type "${type}", skipping`)
      return
    }

    // Create event
    let event: AnalyticsEvent = {
      type,
      timestamp: new Date(),
      data,
      sessionId: this.sessionId,
    }

    // Add user info if enabled
    if (this.config.includeUserInfo && this.userId) {
      event.userId = this.userId
    }

    // Transform event with error handling
    try {
      event = this.config.transformEvent(event)
    } catch (error) {
      logger.error('Event transformation failed, using original event', error)
      // Continue with untransformed event
    }

    // Check payload size
    if (!this.isPayloadSizeValid(event)) {
      logger.warn(`Event payload too large for type "${type}", skipping`)
      return
    }

    // Add to queue or send immediately
    if (this.config.batchEvents) {
      // Check queue size limit before adding
      if (this.eventQueue.length >= this.config.maxQueueSize!) {
        // Drop oldest events to make room (FIFO)
        const dropCount = Math.floor(this.config.maxQueueSize! * 0.1) // Drop 10%
        this.eventQueue.splice(0, dropCount)
        logger.warn(`Event queue overflow, dropped ${dropCount} old events`)
      }

      this.eventQueue.push(event)

      // Send if batch size reached
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flushEvents().catch((error) => {
          logger.error('Failed to flush events', error)
        })
      }
    } else {
      this.sendEvents([event]).catch((error) => {
        logger.error('Failed to send event', error)
      })
    }

    logger.debug(`Event tracked: ${type}`)
  }

  /**
   * Validate event data
   * Checks for null, undefined, and empty objects
   *
   * @param data - Event data
   * @returns True if data is valid
   */
  private isValidEventData(data?: Record<string, any>): boolean {
    // Undefined is okay (no data)
    if (data === undefined) {
      return true
    }

    // Null is not okay
    if (data === null) {
      logger.debug('Event data is null')
      return false
    }

    // Must be an object
    if (typeof data !== 'object') {
      logger.debug('Event data is not an object')
      return false
    }

    // Arrays are not okay
    if (Array.isArray(data)) {
      logger.debug('Event data is an array, not an object')
      return false
    }

    // Empty objects are okay (some events may not have additional data)
    return true
  }

  /**
   * Check if payload size is within limits
   *
   * @param event - Analytics event
   * @returns True if payload size is valid
   */
  private isPayloadSizeValid(event: AnalyticsEvent): boolean {
    try {
      const serialized = JSON.stringify(event)
      const sizeInBytes = new Blob([serialized]).size

      if (sizeInBytes > this.config.maxPayloadSize!) {
        logger.warn(`Payload size ${sizeInBytes} exceeds limit ${this.config.maxPayloadSize}`)
        return false
      }

      return true
    } catch (error) {
      // If serialization fails, reject the event
      logger.error('Failed to serialize event for size check', error)
      return false
    }
  }

  /**
   * Check if an event should be tracked based on filtering configuration
   *
   * Determines whether an event type should be tracked by applying the `trackEvents` whitelist
   * and `ignoreEvents` blacklist filters. Also checks if the plugin is enabled. This is the
   * primary filtering mechanism for controlling which events are recorded.
   *
   * @param type - The event type to check (e.g., 'call:started', 'sip:connected')
   *
   * @returns True if the event should be tracked, false if it should be ignored
   *
   * @internal
   *
   * @remarks
   * ## Filtering Algorithm
   * The method applies filters in this order:
   * 1. **Enabled Check**: If plugin is disabled, return false (track nothing)
   * 2. **Ignore List Check**: If type matches any `ignoreEvents` pattern, return false
   * 3. **Track List Check**: If `trackEvents` is empty, return true (track all)
   * 4. **Track List Check**: If `trackEvents` is not empty, return true only if type matches a pattern
   *
   * ## Filter Precedence
   * The filters are applied with this precedence:
   * - **Plugin Disabled**: Takes highest precedence, blocks all events
   * - **Ignore List**: Takes precedence over track list (blacklist wins)
   * - **Track List**: Only applies if ignore list doesn't match
   * - **Default**: Track all if both lists are empty
   *
   * ## Whitelist Behavior (trackEvents)
   * When `trackEvents` is configured:
   * - Empty array `[]`: Track all events (no whitelist filtering)
   * - Non-empty array: Only track events matching at least one pattern
   * - Supports wildcard patterns (e.g., 'call:*', 'sip:*')
   * - All patterns must be strings
   *
   * ## Blacklist Behavior (ignoreEvents)
   * When `ignoreEvents` is configured:
   * - Empty array `[]`: Ignore no events (no blacklist filtering)
   * - Non-empty array: Ignore events matching any pattern
   * - Takes precedence over `trackEvents` (blocks even whitelisted events)
   * - Supports wildcard patterns (e.g., '*:error', '*:*Failed')
   *
   * ## Pattern Matching
   * Both whitelist and blacklist support wildcard patterns:
   * - Patterns are matched using `matchesPattern()` method
   * - Exact matches: 'call:started' matches 'call:started'
   * - Wildcard matches: 'call:*' matches 'call:started', 'call:ended', etc.
   * - Universal wildcard: '*' matches all events
   * - ReDoS protection applied to prevent malicious patterns
   *
   * ## Performance Considerations
   * This method is called for every event:
   * - Plugin enabled check is fast (single boolean check)
   * - Ignore list checked first to short-circuit unwanted events
   * - Track list only checked if ignore list doesn't match
   * - Pattern matching uses regex (cached internally by browser)
   * - Early returns minimize processing for filtered events
   *
   * @example Filter evaluation - event allowed
   * ```typescript
   * // Configuration:
   * // trackEvents: ['call:*']
   * // ignoreEvents: ['call:failed']
   *
   * shouldTrackEvent('call:started')
   * // 1. Plugin enabled? ✓ true
   * // 2. Matches ignoreEvents? ✗ false (not 'call:failed')
   * // 3. trackEvents not empty, check patterns
   * // 4. Matches 'call:*'? ✓ true
   * // → Returns true (event will be tracked)
   * ```
   *
   * @example Filter evaluation - event ignored by blacklist
   * ```typescript
   * // Configuration:
   * // trackEvents: ['call:*']
   * // ignoreEvents: ['call:failed']
   *
   * shouldTrackEvent('call:failed')
   * // 1. Plugin enabled? ✓ true
   * // 2. Matches ignoreEvents? ✓ true (matches 'call:failed')
   * // → Returns false (event will be ignored)
   * // Note: trackEvents not checked because blacklist matched
   * ```
   *
   * @example Filter evaluation - event not whitelisted
   * ```typescript
   * // Configuration:
   * // trackEvents: ['call:*']
   * // ignoreEvents: []
   *
   * shouldTrackEvent('sip:connected')
   * // 1. Plugin enabled? ✓ true
   * // 2. Matches ignoreEvents? ✗ false (empty list)
   * // 3. trackEvents not empty, check patterns
   * // 4. Matches any pattern? ✗ false (doesn't match 'call:*')
   * // → Returns false (event will be ignored)
   * ```
   *
   * @example Filter evaluation - track all
   * ```typescript
   * // Configuration:
   * // trackEvents: []
   * // ignoreEvents: []
   *
   * shouldTrackEvent('media:acquired')
   * // 1. Plugin enabled? ✓ true
   * // 2. Matches ignoreEvents? ✗ false (empty list)
   * // 3. trackEvents is empty
   * // → Returns true (track all events)
   * ```
   */
  private shouldTrackEvent(type: string): boolean {
    // Check if plugin is enabled
    if (!this.config.enabled) {
      return false
    }

    // Check ignore list
    if (this.config.ignoreEvents.length > 0) {
      for (const pattern of this.config.ignoreEvents) {
        if (this.matchesPattern(type, pattern)) {
          return false
        }
      }
    }

    // Check track list (empty = track all)
    if (this.config.trackEvents.length > 0) {
      let matches = false
      for (const pattern of this.config.trackEvents) {
        if (this.matchesPattern(type, pattern)) {
          matches = true
          break
        }
      }
      return matches
    }

    return true
  }

  /**
   * Check if an event type matches a wildcard pattern
   *
   * Performs pattern matching with support for wildcards, including ReDoS (Regular Expression
   * Denial of Service) protection. Converts wildcard patterns to regular expressions for flexible
   * event filtering.
   *
   * @param type - The event type to test (e.g., 'call:started', 'sip:connected')
   * @param pattern - The pattern to match against. Supports wildcards:
   *   - `'*'`: Matches any event type
   *   - `'call:*'`: Matches any event starting with 'call:' (e.g., 'call:started', 'call:ended')
   *   - `'sip:connected'`: Exact match only
   *   - `'*:error'`: Matches any event ending with ':error'
   *
   * @returns True if the event type matches the pattern, false otherwise
   *
   * @internal
   *
   * @remarks
   * ## Pattern Matching Algorithm
   * The method follows these steps:
   * 1. **Universal Wildcard**: If pattern is '*', return true immediately
   * 2. **Exact Match**: If pattern equals type exactly, return true
   * 3. **Sanitization**: Sanitize pattern to prevent ReDoS attacks
   * 4. **Complexity Check**: Check if pattern is too complex (may cause ReDoS)
   * 5. **Regex Conversion**: Convert wildcards to regex (replace '*' with '.*')
   * 6. **Regex Test**: Test type against regex pattern
   *
   * ## Wildcard Support
   * Wildcards work as follows:
   * - `*` in pattern is converted to `.*` in regex (matches zero or more characters)
   * - Pattern is anchored with `^` and `$` for exact matching
   * - Example: `'call:*'` becomes `/^call:.*$/`
   * - Example: `'*:error'` becomes `/^.*:error$/`
   *
   * ## ReDoS Protection
   * The method includes multiple layers of ReDoS protection:
   *
   * **Sanitization**:
   * - Multiple consecutive wildcards collapsed to single wildcard
   * - Multiple consecutive quantifiers removed
   * - Pattern length limited to 100 characters
   * - Prevents exponential backtracking
   *
   * **Complexity Check**:
   * - Counts quantifiers (`*`, `+`, `?`, `{`) in pattern
   * - Counts groups (`(`) in pattern
   * - If more than 10 quantifiers or 5 groups, fallback to exact match
   * - Prevents patterns that could cause excessive backtracking
   *
   * **Fallback Behavior**:
   * - If complexity check fails, uses exact string comparison
   * - Logs warning about complex pattern
   * - Ensures matching always completes quickly
   *
   * ## Error Handling
   * Pattern matching errors are caught:
   * - Invalid regex syntax logged and returns false
   * - Regex exceptions caught and logged
   * - Method never throws (always returns boolean)
   *
   * ## Performance
   * Pattern matching is optimized:
   * - Fast paths for universal wildcard and exact match
   * - Regex compiled once per pattern (cached by JavaScript engine)
   * - Complexity check prevents slow patterns
   * - Most patterns complete in constant time
   *
   * @example Universal wildcard
   * ```typescript
   * matchesPattern('call:started', '*')      // true
   * matchesPattern('sip:connected', '*')     // true
   * matchesPattern('anything', '*')          // true
   * ```
   *
   * @example Exact match
   * ```typescript
   * matchesPattern('call:started', 'call:started')  // true
   * matchesPattern('call:started', 'call:ended')    // false
   * matchesPattern('sip:connected', 'sip:connected') // true
   * ```
   *
   * @example Prefix wildcard
   * ```typescript
   * matchesPattern('call:started', 'call:*')   // true
   * matchesPattern('call:ended', 'call:*')     // true
   * matchesPattern('call:failed', 'call:*')    // true
   * matchesPattern('sip:connected', 'call:*')  // false
   * ```
   *
   * @example Suffix wildcard
   * ```typescript
   * matchesPattern('call:error', '*:error')        // true
   * matchesPattern('sip:error', '*:error')         // true
   * matchesPattern('media:error', '*:error')       // true
   * matchesPattern('call:started', '*:error')      // false
   * ```
   *
   * @example Complex patterns with ReDoS protection
   * ```typescript
   * // Pattern with many wildcards - sanitized
   * matchesPattern('call:started', 'call:***')
   * // → Sanitized to 'call:*', matches
   *
   * // Extremely complex pattern - falls back to exact match
   * matchesPattern('event', '(a*)*'*)*'*)*'*)
   * // → Too complex, uses exact match, returns false
   * // → Logs: "Pattern too complex, using exact match"
   * ```
   */
  private matchesPattern(type: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern === type) return true

    try {
      // Sanitize pattern to prevent ReDoS
      const sanitized = this.sanitizePattern(pattern)

      // Convert wildcard pattern to regex
      const regexPattern = sanitized.replace(/\*/g, '.*')
      const regex = new RegExp(`^${regexPattern}$`)

      // Test with timeout protection using a simple check
      // If pattern is too complex, fallback to exact match
      if (this.isPatternTooComplex(regexPattern)) {
        logger.warn(`Pattern too complex, using exact match: ${pattern}`)
        return type === pattern
      }

      return regex.test(type)
    } catch (error) {
      logger.error(`Pattern matching failed for "${pattern}"`, error)
      return false
    }
  }

  /**
   * Sanitize pattern to prevent ReDoS attacks
   */
  private sanitizePattern(pattern: string): string {
    // Remove potentially dangerous regex patterns
    // Limit consecutive quantifiers and nested groups
    return pattern
      .replace(/(\*{2,})/g, '*') // Multiple wildcards to single
      .replace(/([+{]{2,})/g, '+') // Prevent nested quantifiers
      .substring(0, 100) // Limit pattern length
  }

  /**
   * Check if pattern is too complex (may cause ReDoS)
   */
  private isPatternTooComplex(pattern: string): boolean {
    // Simple heuristic: count quantifiers and groups
    const quantifiers = (pattern.match(/[*+?{]/g) || []).length
    const groups = (pattern.match(/[(]/g) || []).length

    // If too many quantifiers or nested groups, consider it complex
    return quantifiers > 10 || groups > 5
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      return
    }

    this.batchTimer = setInterval(() => {
      this.flushEvents().catch((error) => {
        logger.error('Failed to flush events on timer', error)
      })
    }, this.config.sendInterval)

    logger.debug(`Batch timer started (interval: ${this.config.sendInterval}ms)`)
  }

  /**
   * Stop batch timer
   */
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
      logger.debug('Batch timer stopped')
    }
  }

  /**
   * Flush all queued events by sending them to the analytics endpoint
   *
   * Sends all events currently in the queue to the analytics endpoint and clears the queue.
   * Prevents concurrent flush operations using the `isFlushing` flag. This method is called
   * automatically by the batch timer or when the batch size is reached, and manually during
   * plugin uninstallation.
   *
   * @returns A promise that resolves when all queued events have been sent (or the send attempt completes)
   *
   * @internal
   *
   * @remarks
   * ## Flush Process
   * The flush operation follows these steps:
   * 1. **Concurrent Check**: If already flushing, log and return early
   * 2. **Empty Check**: If queue is empty, return early (nothing to send)
   * 3. **Set Flag**: Set `isFlushing` to true to prevent concurrent flushes
   * 4. **Copy Queue**: Create copy of queue and clear original
   * 5. **Send Events**: Call `sendEvents()` with the copied events
   * 6. **Clear Flag**: Always clear `isFlushing` flag (in finally block)
   *
   * ## Concurrent Flush Prevention
   * The `isFlushing` flag prevents concurrent flush operations:
   * - Set to true at start of flush
   * - Checked at start, returns early if already true
   * - Cleared in finally block (always runs)
   * - Prevents duplicate sends of same events
   * - Prevents race conditions during async operations
   *
   * ## Queue Handling
   * The queue is managed carefully during flush:
   * - Queue is copied before sending: `[...this.eventQueue]`
   * - Original queue cleared immediately: `this.eventQueue = []`
   * - If send fails, events are requeued by `sendEvents()`
   * - New events can be added to queue during flush
   * - Cleared queue prevents duplicate sends
   *
   * ## Error Handling
   * Errors during flush are handled gracefully:
   * - `sendEvents()` handles HTTP errors internally
   * - Failed events are requeued by `sendEvents()`
   * - `isFlushing` flag is always cleared (finally block)
   * - Flush operation always completes
   * - Subsequent flushes can proceed normally
   *
   * ## When Called
   * This method is called in several scenarios:
   * - **Batch Timer**: Periodically (every `sendInterval` ms)
   * - **Batch Size**: When queue reaches `batchSize`
   * - **Uninstallation**: During plugin cleanup to avoid data loss
   * - **Config Update**: When disabling batching
   *
   * ## Performance
   * Flush operations are optimized:
   * - Concurrent flushes prevented (no duplicate work)
   * - Queue copied and cleared quickly (O(n) operations)
   * - Async send operation doesn't block queue
   * - New events can accumulate during send
   *
   * @example Normal flush operation
   * ```typescript
   * // Queue has 10 events, flush is triggered
   * await flushEvents()
   * // 1. isFlushing = false, proceed
   * // 2. Queue not empty, proceed
   * // 3. Set isFlushing = true
   * // 4. Copy queue (10 events)
   * // 5. Clear queue (now empty)
   * // 6. Send 10 events to endpoint
   * // 7. isFlushing = false
   * // Queue empty, ready for new events
   * ```
   *
   * @example Concurrent flush prevention
   * ```typescript
   * // Flush already in progress
   * // Second flush call arrives:
   * await flushEvents()
   * // 1. isFlushing = true (from first call)
   * // 2. Log "Flush already in progress, skipping"
   * // 3. Return early
   * // No duplicate send, no race condition
   * ```
   *
   * @example Flush with queue accumulation
   * ```typescript
   * // Queue: [e1, e2, e3]
   * const flushPromise = flushEvents()
   * // → Queue copied and cleared
   * // → Send started asynchronously
   * // → isFlushing = true
   *
   * // New events arrive during flush:
   * trackEvent('call:started')
   * // → Queue: [e4]
   *
   * await flushPromise
   * // → isFlushing = false
   * // → Queue: [e4] (new event preserved)
   * // → Events e1, e2, e3 sent successfully
   * ```
   */
  async flushEvents(): Promise<void> {
    // Prevent concurrent flush operations
    if (this.isFlushing) {
      logger.debug('Flush already in progress, skipping')
      return
    }

    if (this.eventQueue.length === 0) {
      return
    }

    this.isFlushing = true

    try {
      const events = [...this.eventQueue]
      this.eventQueue = []

      await this.sendEvents(events)
    } finally {
      this.isFlushing = false
    }
  }

  /**
   * Send events to the analytics endpoint via HTTP POST request
   *
   * Performs the actual HTTP request to send events to the configured endpoint. Handles request
   * timeout with AbortController, validates response status, and requeues events on failure to
   * provide resilience against temporary network issues.
   *
   * @param events - Array of analytics events to send. Can contain one or more events depending
   *   on batching mode. Events are sent as JSON in the request body: `{ events: [...] }`
   *
   * @returns A promise that resolves when the send operation completes (success or failure)
   *
   * @internal
   *
   * @remarks
   * ## Send Process
   * The send operation follows these steps:
   * 1. **Endpoint Check**: If no endpoint configured, log and return
   * 2. **Abort Controller**: Create AbortController for timeout handling
   * 3. **Timeout Timer**: Set timeout that aborts request after `requestTimeout` ms
   * 4. **HTTP Request**: POST events to endpoint as JSON
   * 5. **Response Check**: Verify response status is OK (200-299)
   * 6. **Success**: Clear timeout, log success
   * 7. **Error**: Clear timeout, log error, requeue events
   *
   * ## Request Format
   * Events are sent as JSON POST request:
   * ```typescript
   * {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({ events: [...] })
   * }
   * ```
   *
   * Expected endpoint response:
   * - Status: 200-299 (OK range)
   * - Body: Any valid JSON (not validated)
   *
   * ## Timeout Handling
   * Requests have timeout protection:
   * - AbortController created for each request
   * - Timeout set to `requestTimeout` milliseconds (default: 30000)
   * - Timeout calls `abortController.abort()` to cancel request
   * - Aborted requests throw AbortError
   * - Timeout is cleared on success or error
   * - Prevents indefinite hanging on network issues
   *
   * ## No Endpoint Handling
   * If `endpoint` is empty string:
   * - Method logs: "Would send N events (no endpoint configured)"
   * - No HTTP request is made
   * - Events are considered sent (not requeued)
   * - Useful for testing and development
   *
   * ## Event Requeuing on Failure
   * If the send fails (network error, timeout, non-OK response):
   * - Events are requeued to the front of the queue
   * - Only as many events as fit in remaining capacity are requeued
   * - Respects `maxQueueSize` limit
   * - Events beyond capacity are dropped
   * - Provides resilience against temporary failures
   *
   * ## Requeue Algorithm
   * The requeue process:
   * 1. Calculate remaining capacity: `maxQueueSize - currentQueueSize`
   * 2. Slice events to fit capacity: `events.slice(0, remainingCapacity)`
   * 3. Add to front of queue: `this.eventQueue.unshift(...eventsToRequeue)`
   * 4. Log warning if some events dropped due to capacity
   * 5. Log warning if all events dropped (queue full)
   *
   * ## Error Types
   * Different error types are handled:
   * - **AbortError**: Request timed out, logged as "Analytics request timed out"
   * - **Network Error**: Connection failed, logged with error details
   * - **HTTP Error**: Non-OK status (e.g., 500), thrown as Error with status
   * - All errors trigger event requeuing
   *
   * ## AbortController Cleanup
   * The abort controller is cleaned up:
   * - Stored in `this.abortController` during request
   * - Set to null after request completes (success or error)
   * - Cleared in finally block (always runs)
   * - Prevents memory leaks
   *
   * ## Logging
   * The method logs different scenarios:
   * - No endpoint: Debug log with event count
   * - Success: Debug log with event count
   * - Timeout: Error log
   * - Network/HTTP error: Error log with details
   * - Partial requeue: Warning with dropped count
   * - Full queue: Warning with dropped count
   *
   * @example Successful send
   * ```typescript
   * // Send 5 events to endpoint
   * await sendEvents([e1, e2, e3, e4, e5])
   * // → POST https://analytics.example.com/events
   * // → Body: { events: [e1, e2, e3, e4, e5] }
   * // → Response: 200 OK
   * // → Log: "Sent 5 events to analytics endpoint"
   * ```
   *
   * @example Failed send with requeue
   * ```typescript
   * // Send fails due to network error
   * // Queue currently has 10 events
   * // maxQueueSize = 1000
   * await sendEvents([e1, e2, e3])
   * // → POST fails with network error
   * // → Remaining capacity: 1000 - 10 = 990
   * // → Requeue all 3 events (fits in capacity)
   * // → Queue now: [e1, e2, e3, ...original 10...]
   * // → Log: "Failed to send events to analytics endpoint: NetworkError"
   * ```
   *
   * @example Timeout handling
   * ```typescript
   * // Request exceeds requestTimeout (30s)
   * await sendEvents([e1, e2, e3])
   * // → POST started
   * // → After 30s, no response
   * // → AbortController.abort() called
   * // → Request cancelled
   * // → Log: "Analytics request timed out"
   * // → Events requeued
   * ```
   *
   * @example Partial requeue due to capacity
   * ```typescript
   * // Send 100 events fails
   * // Queue has 950 events
   * // maxQueueSize = 1000
   * await sendEvents([...100 events...])
   * // → POST fails
   * // → Remaining capacity: 1000 - 950 = 50
   * // → Requeue first 50 events only
   * // → Drop remaining 50 events
   * // → Log: "Could not requeue all events, dropped 50"
   * ```
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    if (!this.config.endpoint) {
      logger.debug(`Would send ${events.length} events (no endpoint configured)`)
      return
    }

    // Create abort controller for timeout
    this.abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      this.abortController?.abort()
    }, this.config.requestTimeout)

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
        signal: this.abortController.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Analytics endpoint returned ${response.status}`)
      }

      logger.debug(`Sent ${events.length} events to analytics endpoint`)
    } catch (error) {
      clearTimeout(timeoutId)

      if ((error as Error).name === 'AbortError') {
        logger.error('Analytics request timed out')
      } else {
        logger.error('Failed to send events to analytics endpoint', error)
      }

      // Re-queue events on failure, but respect max queue size
      const remainingCapacity = this.config.maxQueueSize! - this.eventQueue.length
      if (remainingCapacity > 0) {
        const eventsToRequeue = events.slice(0, remainingCapacity)
        this.eventQueue.unshift(...eventsToRequeue)

        if (eventsToRequeue.length < events.length) {
          logger.warn(
            `Could not requeue all events, dropped ${events.length - eventsToRequeue.length}`
          )
        }
      } else {
        logger.warn(`Queue full, dropped ${events.length} events`)
      }
    } finally {
      this.abortController = null
    }
  }

  /**
   * Set the user ID for analytics tracking
   *
   * Associates a user identifier with all future analytics events. The user ID is only included
   * in events when `includeUserInfo` configuration is enabled. This allows tracking user behavior
   * across sessions and correlating events with specific users.
   *
   * @param userId - The user identifier to associate with analytics events. Can be any string
   *   that uniquely identifies the user (user ID, email, username, UUID, etc.). The format and
   *   content are application-specific. Should not contain sensitive information unless properly
   *   encrypted or hashed.
   *
   * @remarks
   * ## User ID Behavior
   * - Stored in the plugin instance's `userId` property
   * - Persists until explicitly changed or plugin is destroyed
   * - Only included in events when `includeUserInfo: true` in configuration
   * - Added to the `userId` field of each tracked event
   * - Not cleared during uninstallation (survives across install/uninstall cycles)
   *
   * ## Privacy Considerations
   * When setting user IDs:
   * - Consider privacy regulations (GDPR, CCPA, etc.)
   * - Avoid including PII (personally identifiable information) directly
   * - Consider using hashed or anonymized identifiers
   * - Ensure user consent for tracking before setting
   * - Provide way for users to opt out (disable `includeUserInfo`)
   *
   * ## Configuration Interaction
   * The user ID works in conjunction with `includeUserInfo` config:
   * - `includeUserInfo: false`: User ID set but not included in events
   * - `includeUserInfo: true`: User ID included in all future events
   * - Toggle `includeUserInfo` at runtime to control tracking
   * - Useful for respecting user privacy preferences
   *
   * ## Session vs User Tracking
   * The plugin tracks both sessions and users:
   * - **Session ID**: Automatically generated, always included, tracks single session
   * - **User ID**: Manually set, conditionally included, tracks user across sessions
   * - Correlate events using both IDs for complete user journey analysis
   *
   * ## Lifecycle
   * User ID lifecycle considerations:
   * - Set after user authentication/login
   * - Persists across plugin reinstallation (tied to instance)
   * - Clear by setting to empty string or undefined
   * - Not affected by configuration updates
   * - Survives browser refreshes if plugin instance persists
   *
   * @example Set user ID after login
   * ```typescript
   * // User logs in
   * const user = await authenticate(credentials)
   *
   * // Set user ID for analytics
   * analyticsPlugin.setUserId(user.id)
   * // Future events (if includeUserInfo: true) will include userId: user.id
   * ```
   *
   * @example Use hashed user ID for privacy
   * ```typescript
   * // Hash user email for privacy-conscious tracking
   * const hashedEmail = await hashString(user.email)
   * analyticsPlugin.setUserId(hashedEmail)
   * // Events include hashed ID, not raw email
   * ```
   *
   * @example Clear user ID on logout
   * ```typescript
   * // User logs out
   * analyticsPlugin.setUserId('')
   * // Or disable user tracking entirely
   * await pluginManager.updateConfig('analytics', {
   *   includeUserInfo: false
   * })
   * ```
   *
   * @example Conditional user tracking
   * ```typescript
   * // Check user consent before tracking
   * if (userConsents ToTracking) {
   *   // Enable user tracking
   *   await pluginManager.updateConfig('analytics', {
   *     includeUserInfo: true
   *   })
   *   analyticsPlugin.setUserId(user.id)
   * } else {
   *   // Track sessions only, no user ID
   *   await pluginManager.updateConfig('analytics', {
   *     includeUserInfo: false
   *   })
   * }
   * ```
   *
   * @example User journey tracking across sessions
   * ```typescript
   * // Track user journey across multiple sessions
   * analyticsPlugin.setUserId(user.id)
   *
   * // Session 1: user.id + sessionId1 → events
   * // ... user closes browser ...
   * // Session 2: user.id + sessionId2 → events
   *
   * // Correlate events:
   * // - By userId: See all actions across sessions
   * // - By sessionId: See actions within single session
   * // - By both: Complete user journey with session boundaries
   * ```
   */
  setUserId(userId: string): void {
    this.userId = userId
    logger.debug(`User ID set: ${userId}`)
  }
}

/**
 * Create a new AnalyticsPlugin instance
 *
 * Factory function that creates and returns a new instance of the AnalyticsPlugin.
 * This is the recommended way to create plugin instances for use with VueSip's plugin system.
 *
 * @returns A new AnalyticsPlugin instance with:
 *   - Freshly generated session ID (using crypto.randomUUID())
 *   - Default configuration (can be overridden during installation)
 *   - Empty event queue
 *   - No batch timer (started during installation if batching enabled)
 *   - No registered event listeners (registered during installation)
 *
 * @remarks
 * ## Factory Pattern
 * This function follows the factory pattern used throughout VueSip plugins:
 * - Provides consistent interface for plugin creation
 * - Hides constructor complexity from consumers
 * - Allows for future initialization logic without API changes
 * - Makes plugin instantiation explicit and clear
 *
 * ## Session ID Generation
 * Each created instance gets a unique session ID:
 * - Generated in the constructor during instance creation
 * - Uses crypto.randomUUID() for cryptographic randomness (if available)
 * - Falls back to timestamp + random string for compatibility
 * - Unique per instance (reinstantiation creates new session ID)
 * - Included in all events tracked by this instance
 *
 * ## Instance Independence
 * Each instance is completely independent:
 * - Has its own event queue
 * - Has its own batch timer
 * - Has its own session ID
 * - Can be configured differently
 * - Multiple instances can coexist (though typically only one is needed)
 *
 * ## Usage Pattern
 * The typical usage pattern is:
 * 1. Create instance using this factory function
 * 2. Register with PluginManager
 * 3. PluginManager calls install() with configuration
 * 4. Plugin becomes operational and tracks events
 *
 * @example Basic plugin creation
 * ```typescript
 * import { createAnalyticsPlugin } from './plugins/AnalyticsPlugin'
 *
 * const analyticsPlugin = createAnalyticsPlugin()
 * // Plugin instance created, ready to register
 * ```
 *
 * @example Plugin creation and registration
 * ```typescript
 * import { createAnalyticsPlugin } from './plugins/AnalyticsPlugin'
 * import { PluginManager } from './plugins/PluginManager'
 *
 * const pluginManager = new PluginManager(eventBus, '1.0.0')
 * const analyticsPlugin = createAnalyticsPlugin()
 *
 * await pluginManager.register(analyticsPlugin, {
 *   enabled: true,
 *   endpoint: 'https://analytics.example.com/events',
 *   batchEvents: true,
 *   batchSize: 10
 * })
 * // Plugin installed and tracking events
 * ```
 *
 * @example Multiple independent instances
 * ```typescript
 * // Create two separate analytics instances (unusual but possible)
 * const productionAnalytics = createAnalyticsPlugin()
 * const debugAnalytics = createAnalyticsPlugin()
 *
 * // Each has different configuration and session ID
 * await pluginManager.register(productionAnalytics, {
 *   endpoint: 'https://analytics.example.com/events',
 *   trackEvents: ['call:*']
 * })
 *
 * await pluginManager.register(debugAnalytics, {
 *   endpoint: 'https://debug-analytics.example.com/events',
 *   trackEvents: ['*']  // Track everything for debugging
 * })
 * ```
 */
export function createAnalyticsPlugin(): AnalyticsPlugin {
  return new AnalyticsPlugin()
}
