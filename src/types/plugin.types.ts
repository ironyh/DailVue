/**
 * Plugin System Type Definitions
 *
 * Defines the interfaces and types for the VueSip plugin system,
 * including plugin lifecycle, hooks, and context.
 */

import type { EventBus } from '../core/EventBus'
import type { SipClient } from '../core/SipClient'
import type { CallSession } from '../core/CallSession'
import type { MediaManager } from '../core/MediaManager'
import type { SipClientConfig } from './config.types'

/**
 * Hook priority levels
 *
 * Determines the order in which hook handlers are executed.
 * Higher priority handlers run first.
 */
export enum HookPriority {
  /** Runs first */
  Highest = 1000,
  /** Runs before normal */
  High = 500,
  /** Default priority */
  Normal = 0,
  /** Runs after normal */
  Low = -500,
  /** Runs last */
  Lowest = -1000,
}

/**
 * Standard hook names
 *
 * These hooks are called at specific points in the application lifecycle.
 */
export const HOOK_NAMES = {
  // Lifecycle hooks
  BEFORE_INIT: 'beforeInit',
  AFTER_INIT: 'afterInit',
  BEFORE_DESTROY: 'beforeDestroy',
  AFTER_DESTROY: 'afterDestroy',

  // Connection hooks
  BEFORE_CONNECT: 'beforeConnect',
  AFTER_CONNECT: 'afterConnect',
  BEFORE_DISCONNECT: 'beforeDisconnect',
  AFTER_DISCONNECT: 'afterDisconnect',

  // Registration hooks
  BEFORE_REGISTER: 'beforeRegister',
  AFTER_REGISTER: 'afterRegister',
  BEFORE_UNREGISTER: 'beforeUnregister',
  AFTER_UNREGISTER: 'afterUnregister',

  // Call hooks
  BEFORE_CALL: 'beforeCall',
  AFTER_CALL_START: 'afterCallStart',
  BEFORE_ANSWER: 'beforeAnswer',
  AFTER_ANSWER: 'afterAnswer',
  BEFORE_HANGUP: 'beforeHangup',
  AFTER_HANGUP: 'afterHangup',

  // Media hooks
  BEFORE_MEDIA_ACQUIRE: 'beforeMediaAcquire',
  AFTER_MEDIA_ACQUIRE: 'afterMediaAcquire',
  BEFORE_MEDIA_RELEASE: 'beforeMediaRelease',
  AFTER_MEDIA_RELEASE: 'afterMediaRelease',

  // Error hooks
  ON_ERROR: 'onError',
  ON_CALL_ERROR: 'onCallError',
  ON_CONNECTION_ERROR: 'onConnectionError',
} as const

/**
 * Hook name type
 */
export type HookName = (typeof HOOK_NAMES)[keyof typeof HOOK_NAMES] | string

/**
 * Hook handler function
 *
 * Receives context and optional data, can return a value or Promise.
 * Returning false stops hook propagation.
 */
export type HookHandler<TData = any, TReturn = any> = (
  context: PluginContext,
  data?: TData
) => TReturn | Promise<TReturn>

/**
 * Hook registration options
 */
export interface HookOptions {
  /** Priority of this hook handler */
  priority?: HookPriority | number
  /** If true, removes handler after first execution */
  once?: boolean
  /** Optional condition function to determine if hook should run */
  condition?: (context: PluginContext, data?: any) => boolean
}

/**
 * Hook registration details
 */
export interface HookRegistration<TData = any, TReturn = any> {
  /** The hook name */
  name: HookName
  /** The handler function */
  handler: HookHandler<TData, TReturn>
  /** Registration options */
  options: Required<HookOptions>
  /** Plugin that registered this hook (for cleanup) */
  pluginName: string
  /** Unique ID for this registration */
  id: string
}

/**
 * Plugin context
 *
 * Provides access to the application's core systems and utilities.
 */
export interface PluginContext {
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
    /** Register a hook handler */
    register: <TData = any, TReturn = any>(
      name: HookName,
      handler: HookHandler<TData, TReturn>,
      options?: HookOptions
    ) => string
    /** Unregister a hook handler by ID */
    unregister: (hookId: string) => boolean
    /** Execute all handlers for a hook */
    execute: <TData = any, TReturn = any>(name: HookName, data?: TData) => Promise<TReturn[]>
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

/**
 * Plugin metadata
 */
export interface PluginMetadata {
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

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  /** Enable/disable the plugin */
  enabled?: boolean
  /** Plugin-specific configuration */
  [key: string]: any
}

/**
 * Plugin interface
 *
 * All plugins must implement this interface.
 */
export interface Plugin<TConfig extends PluginConfig = PluginConfig> {
  /** Plugin metadata */
  metadata: PluginMetadata

  /** Default configuration */
  defaultConfig?: TConfig

  /**
   * Install the plugin
   *
   * Called when the plugin is registered.
   * Use this to set up event listeners, register hooks, etc.
   *
   * @param context - Plugin context
   * @param config - Plugin configuration
   * @returns Promise that resolves when installation is complete
   */
  install(context: PluginContext, config?: TConfig): Promise<void> | void

  /**
   * Uninstall the plugin
   *
   * Called when the plugin is unregistered or the application is destroyed.
   * Use this to clean up resources, remove event listeners, etc.
   *
   * @param context - Plugin context
   * @returns Promise that resolves when cleanup is complete
   */
  uninstall?(context: PluginContext): Promise<void> | void

  /**
   * Update plugin configuration
   *
   * Called when the plugin configuration is updated at runtime.
   *
   * @param context - Plugin context
   * @param config - New configuration
   * @returns Promise that resolves when configuration is applied
   */
  updateConfig?(context: PluginContext, config: TConfig): Promise<void> | void
}

/**
 * Plugin registration state
 */
export enum PluginState {
  /** Plugin is registered but not installed */
  Registered = 'registered',
  /** Plugin is being installed */
  Installing = 'installing',
  /** Plugin is installed and active */
  Installed = 'installed',
  /** Plugin is being uninstalled */
  Uninstalling = 'uninstalling',
  /** Plugin installation failed */
  Failed = 'failed',
}

/**
 * Plugin registry entry
 */
export interface PluginEntry<TConfig extends PluginConfig = PluginConfig> {
  /** The plugin instance */
  plugin: Plugin<TConfig>
  /** Plugin configuration */
  config: TConfig
  /** Current state */
  state: PluginState
  /** Installation timestamp */
  installedAt?: Date
  /** Error if installation failed */
  error?: Error
  /** Hook IDs registered by this plugin (for cleanup) */
  hookIds: string[]
}

/**
 * Plugin manager interface
 */
export interface PluginManager {
  /** Register a plugin */
  register<TConfig extends PluginConfig = PluginConfig>(
    plugin: Plugin<TConfig>,
    config?: TConfig
  ): Promise<void>

  /** Unregister a plugin */
  unregister(pluginName: string): Promise<void>

  /** Get a registered plugin */
  get(pluginName: string): PluginEntry | undefined

  /** Check if a plugin is registered */
  has(pluginName: string): boolean

  /** Get all registered plugins */
  getAll(): Map<string, PluginEntry>

  /** Update a plugin's configuration */
  updateConfig<TConfig extends PluginConfig = PluginConfig>(
    pluginName: string,
    config: TConfig
  ): Promise<void>

  /** Destroy the plugin manager and uninstall all plugins */
  destroy(): Promise<void>
}

/**
 * Analytics event types
 */
export interface AnalyticsEvent {
  /** Event type */
  type: string
  /** Event timestamp */
  timestamp: Date
  /** Event data */
  data?: Record<string, any>
  /** User session ID */
  sessionId?: string
  /** User ID */
  userId?: string
}

/**
 * Analytics plugin configuration
 */
export interface AnalyticsPluginConfig extends PluginConfig {
  /** Analytics endpoint URL */
  endpoint?: string
  /** Batch events before sending */
  batchEvents?: boolean
  /** Batch size */
  batchSize?: number
  /** Send interval (ms) */
  sendInterval?: number
  /** Include user information */
  includeUserInfo?: boolean
  /** Custom event transformer */
  transformEvent?: (event: AnalyticsEvent) => AnalyticsEvent
  /** Events to track */
  trackEvents?: string[]
  /** Events to ignore */
  ignoreEvents?: string[]
  /** Maximum events in queue before dropping (prevents memory overflow) */
  maxQueueSize?: number
  /** Request timeout in milliseconds (prevents hanging requests) */
  requestTimeout?: number
}

/**
 * Recording state
 */
export enum RecordingState {
  Idle = 'idle',
  Starting = 'starting',
  Recording = 'recording',
  Paused = 'paused',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Failed = 'failed',
}

/**
 * Recording options
 */
export interface RecordingOptions {
  /** Include audio */
  audio?: boolean
  /** Include video */
  video?: boolean
  /** MIME type for recording */
  mimeType?: string
  /** Audio bits per second */
  audioBitsPerSecond?: number
  /** Video bits per second */
  videoBitsPerSecond?: number
  /** Time slice for ondataavailable (ms) */
  timeSlice?: number
}

/**
 * Recording data
 */
export interface RecordingData {
  /** Recording ID */
  id: string
  /** Call session ID */
  callId: string
  /** Recording start time */
  startTime: Date
  /** Recording end time */
  endTime?: Date
  /** Recording duration (ms) */
  duration?: number
  /** Recorded blob */
  blob?: Blob
  /** MIME type */
  mimeType: string
  /** Recording state */
  state: RecordingState
}

/**
 * Recording plugin configuration
 */
export interface RecordingPluginConfig extends PluginConfig {
  /** Auto-start recording on call start */
  autoStart?: boolean
  /** Recording options */
  recordingOptions?: RecordingOptions
  /** Store recordings in IndexedDB */
  storeInIndexedDB?: boolean
  /** IndexedDB database name */
  dbName?: string
  /** Max recordings to keep */
  maxRecordings?: number
  /** Auto-delete old recordings */
  autoDeleteOld?: boolean
  /** Callback when recording starts */
  onRecordingStart?: (data: RecordingData) => void
  /** Callback when recording stops */
  onRecordingStop?: (data: RecordingData) => void
  /** Callback when recording fails */
  onRecordingError?: (error: Error) => void
}
