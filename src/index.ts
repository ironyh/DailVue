/**
 * VueSip - A headless Vue.js component library for SIP/VoIP applications
 *
 * VueSip provides a set of powerful, headless Vue 3 composables for building SIP (Session Initiation Protocol)
 * interfaces with Asterisk and other VoIP systems. Built with TypeScript and designed for flexibility,
 * VueSip gives you the business logic while letting you control the UI.
 *
 * @packageDocumentation
 * @module vuesip
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Basic usage with Vue plugin
 * import { createApp } from 'vue'
 * import { createVueSip } from 'vuesip'
 * import App from './App.vue'
 *
 * const app = createApp(App)
 * app.use(createVueSip({
 *   debug: true,
 *   logLevel: 'info'
 * }))
 * app.mount('#app')
 * ```
 *
 * @example
 * ```vue
 * <script setup>
 * // Direct composable usage (no plugin required)
 * import { useSipClient, useCallSession } from 'vuesip'
 *
 * const { connect, isConnected, isRegistered } = useSipClient({
 *   uri: 'wss://sip.example.com',
 *   sipUri: 'sip:user@example.com',
 *   password: 'secret'
 * })
 *
 * const { makeCall, currentCall } = useCallSession()
 *
 * await connect()
 * await makeCall('sip:friend@example.com')
 * </script>
 * ```
 *
 * @example
 * ```vue
 * <template>
 *   <!-- Using providers for global state -->
 *   <SipClientProvider :config="sipConfig">
 *     <MediaProvider :auto-enumerate="true">
 *       <YourApp />
 *     </MediaProvider>
 *   </SipClientProvider>
 * </template>
 * ```
 */

// ============================================================================
// Composables
// ============================================================================

/**
 * Vue composables for SIP/VoIP functionality.
 *
 * These composables provide reactive state and methods for managing SIP connections,
 * calls, media devices, and advanced features like presence, messaging, and conferencing.
 *
 * @see {@link useSipClient} for SIP client connection management
 * @see {@link useCallSession} for call session management
 * @see {@link useMediaDevices} for audio/video device management
 */
export * from './composables'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * TypeScript type definitions for VueSip.
 *
 * Includes interfaces and types for configuration, call sessions, media devices,
 * events, presence, messaging, conferencing, and more.
 *
 * @example
 * ```typescript
 * import type { SipClientConfig, CallSession, MediaDevice } from 'vuesip'
 *
 * const config: SipClientConfig = {
 *   uri: 'wss://sip.example.com',
 *   sipUri: 'sip:user@example.com',
 *   password: 'secret'
 * }
 * ```
 */
export * from './types'

// ============================================================================
// Provider Components
// ============================================================================

/**
 * Vue provider components for sharing functionality with child components.
 *
 * These components use Vue's provide/inject pattern to share SIP client, configuration,
 * and media device state with all descendant components.
 *
 * @see {@link SipClientProvider} for SIP client context
 * @see {@link ConfigProvider} for configuration management
 * @see {@link MediaProvider} for media device management
 *
 * @example
 * ```vue
 * <template>
 *   <SipClientProvider :config="sipConfig">
 *     <ConfigProvider :sip-config="sipConfig">
 *       <MediaProvider :auto-enumerate="true">
 *         <YourApp />
 *       </MediaProvider>
 *     </ConfigProvider>
 *   </SipClientProvider>
 * </template>
 * ```
 */
export * from './providers'

// ============================================================================
// Core Classes
// ============================================================================

/**
 * Core low-level classes for SIP and WebRTC functionality.
 *
 * These classes are used internally by composables but can be used directly
 * for advanced use cases or custom implementations.
 *
 * @see {@link EventBus} for event management
 * @see {@link SipClient} for SIP protocol handling
 * @see {@link CallSession} for call session management
 * @see {@link MediaManager} for WebRTC media handling
 * @see {@link TransportManager} for WebSocket transport
 *
 * @example
 * ```typescript
 * import { SipClient, EventBus } from 'vuesip'
 *
 * const eventBus = new EventBus()
 * const sipClient = new SipClient(config, eventBus)
 * await sipClient.start()
 * ```
 */
// Export core classes (CallSession class from core takes precedence over interface from types)
export { EventBus } from './core/EventBus'
export { TransportManager } from './core/TransportManager'
export { SipClient } from './core/SipClient'
export { CallSession } from './core/CallSession' // Class, not the interface from types
export { MediaManager } from './core/MediaManager'
// Note: CallSessionOptions exported from composables, not core

// ============================================================================
// State Stores
// ============================================================================

/**
 * Reactive state stores for managing application state.
 *
 * These stores use Vue's reactivity system to manage global state for calls,
 * registration, devices, and configuration. They can be used directly or
 * accessed through composables.
 *
 * @see {@link callStore} for call state management
 * @see {@link registrationStore} for SIP registration state
 * @see {@link deviceStore} for media device state
 * @see {@link configStore} for configuration state
 *
 * @example
 * ```typescript
 * import { callStore, registrationStore } from 'vuesip'
 *
 * console.log(callStore.activeCalls)
 * console.log(registrationStore.state.isRegistered)
 * ```
 */
export * from './stores'

// ============================================================================
// Plugin System
// ============================================================================

/**
 * Plugin system for extending VueSip functionality.
 *
 * The plugin system provides hooks for intercepting and extending SIP events,
 * call lifecycle events, and media events. Built-in plugins include analytics
 * and call recording.
 *
 * @see {@link PluginManager} for managing plugins
 * @see {@link HookManager} for hook-based event interception
 * @see {@link AnalyticsPlugin} for call analytics
 * @see {@link RecordingPlugin} for call recording
 *
 * @example
 * ```typescript
 * import { PluginManager, createAnalyticsPlugin, createRecordingPlugin } from 'vuesip'
 *
 * const pluginManager = new PluginManager(eventBus)
 * await pluginManager.register(createAnalyticsPlugin({
 *   trackEvents: ['call:*', 'registration:*']
 * }))
 * await pluginManager.register(createRecordingPlugin({
 *   autoStart: true
 * }))
 * ```
 */
// Export plugin system (PluginManager class from plugins takes precedence)
export { HookManager, PluginManager } from './plugins'
export { AnalyticsPlugin, createAnalyticsPlugin } from './plugins'
export { RecordingPlugin, createRecordingPlugin } from './plugins'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Utility functions and helpers.
 *
 * Includes validators, formatters, logging, encryption, error handling,
 * abort controller utilities, and storage quota helpers.
 *
 * @see {@link validateSipUri} for SIP URI validation
 * @see {@link formatDuration} for duration formatting
 * @see {@link createLogger} for logging
 * @see {@link encrypt} for data encryption
 * @see {@link logErrorWithContext} for structured error logging
 * @see {@link throwIfAborted} for abort signal checking
 *
 * @example
 * ```typescript
 * import { validateSipUri, formatDuration, createLogger } from 'vuesip'
 *
 * const result = validateSipUri('sip:user@example.com')
 * const formatted = formatDuration(125) // "02:05"
 * const logger = createLogger('MyApp')
 * logger.info('Application started')
 * ```
 *
 * @example
 * Error handling utilities:
 * ```typescript
 * import { logErrorWithContext, ErrorSeverity, createLogger } from 'vuesip'
 *
 * const logger = createLogger('MyComponent')
 *
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   logErrorWithContext(
 *     logger,
 *     'Operation failed',
 *     error,
 *     'riskyOperation',
 *     'MyComponent',
 *     ErrorSeverity.HIGH,
 *     { context: { userId: '123' } }
 *   )
 * }
 * ```
 *
 * @example
 * Abort controller utilities:
 * ```typescript
 * import { throwIfAborted, isAbortError, abortableSleep } from 'vuesip'
 *
 * async function cancellableOperation(signal?: AbortSignal) {
 *   throwIfAborted(signal)
 *   await abortableSleep(1000, signal)
 * }
 * ```
 */
// Export utilities (excluding duplicates: getStorageQuota, getStorageUsageSummary from stores, STORAGE_KEYS from types)
export * from './utils/validators'
export * from './utils/formatters'
export * from './utils/logger'
export * from './utils/encryption'
export * from './utils/errorContext'
export * from './utils/abortController'
// storageQuota functions exported from stores instead
// constants partially exported (STORAGE_KEYS from types instead)

// ============================================================================
// Storage Adapters
// ============================================================================

/**
 * Storage adapters for persisting application state.
 *
 * Includes adapters for LocalStorage, SessionStorage, and IndexedDB, along with
 * a persistence manager for automatic state synchronization.
 *
 * @see {@link LocalStorageAdapter} for LocalStorage persistence
 * @see {@link SessionStorageAdapter} for SessionStorage persistence
 * @see {@link IndexedDBAdapter} for IndexedDB persistence
 * @see {@link PersistenceManager} for automatic state persistence
 *
 * @example
 * ```typescript
 * import { LocalStorageAdapter, createPersistence } from 'vuesip'
 *
 * const storage = new LocalStorageAdapter()
 * await storage.set('userPrefs', { theme: 'dark' })
 *
 * const persistence = createPersistence({
 *   key: 'myState',
 *   storage: new LocalStorageAdapter(),
 *   debounce: 500
 * })
 * ```
 */
export * from './storage'

// ============================================================================
// Vue Plugin
// ============================================================================

import type { App, Plugin } from 'vue'
import { createLogger, setLogLevel, type LogLevel } from './utils/logger'
import { configStore } from './stores'

/**
 * Options for the VueSip Vue plugin.
 *
 * @public
 */
export interface VueSipOptions {
  /**
   * Enable debug mode
   * @default false
   */
  debug?: boolean

  /**
   * Logging level
   * @default 'warn'
   */
  logLevel?: LogLevel

  /**
   * Global SIP configuration
   * Can also be provided via ConfigProvider component
   */
  sipConfig?: {
    uri?: string
    sipUri?: string
    password?: string
    displayName?: string
    autoRegister?: boolean
    [key: string]: unknown
  }

  /**
   * Global media configuration
   */
  mediaConfig?: {
    audioEnabled?: boolean
    videoEnabled?: boolean
    [key: string]: unknown
  }

  /**
   * User preferences
   */
  userPreferences?: {
    autoAnswer?: boolean
    recordCalls?: boolean
    [key: string]: unknown
  }

  /**
   * Custom logger instance
   */
  logger?: ReturnType<typeof createLogger>
}

/**
 * Create VueSip Vue plugin.
 *
 * This plugin initializes VueSip with global configuration and makes it available
 * throughout your Vue application. It's optional - you can use VueSip composables
 * directly without installing the plugin.
 *
 * @param options - Plugin configuration options
 * @returns Vue plugin object
 *
 * @public
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { createApp } from 'vue'
 * import { createVueSip } from 'vuesip'
 *
 * const app = createApp(App)
 * app.use(createVueSip({
 *   debug: true,
 *   logLevel: 'info'
 * }))
 * ```
 *
 * @example
 * With global configuration:
 * ```typescript
 * app.use(createVueSip({
 *   debug: import.meta.env.DEV,
 *   logLevel: 'debug',
 *   sipConfig: {
 *     uri: 'wss://sip.example.com',
 *     autoRegister: true
 *   },
 *   mediaConfig: {
 *     audioEnabled: true,
 *     videoEnabled: false
 *   },
 *   userPreferences: {
 *     autoAnswer: false,
 *     recordCalls: false
 *   }
 * }))
 * ```
 *
 * @remarks
 * The plugin performs the following initialization:
 * 1. Configures global logging level and debug mode
 * 2. Initializes configuration store with provided config
 * 3. Sets up global error handling (optional)
 * 4. Logs initialization info
 */
export function createVueSip(options: VueSipOptions = {}): Plugin {
  const {
    debug = false,
    logLevel = 'warn',
    sipConfig,
    mediaConfig,
    userPreferences,
    logger: customLogger,
  } = options

  return {
    install(app: App) {
      // Create logger
      const logger = customLogger || createLogger('VueSip')

      // Configure logging
      if (debug) {
        setLogLevel('debug')
      } else if (logLevel) {
        setLogLevel(logLevel)
      }

      // Initialize configuration store if config provided
      if (sipConfig) {
        configStore.setSipConfig(sipConfig as never)
        logger.debug('SIP configuration initialized')
      }

      if (mediaConfig) {
        configStore.setMediaConfig(mediaConfig as never)
        logger.debug('Media configuration initialized')
      }

      if (userPreferences) {
        configStore.setUserPreferences(userPreferences as never)
        logger.debug('User preferences initialized')
      }

      // Store plugin options on app instance for access by components
      app.config.globalProperties.$vuesip = {
        version,
        options,
        logger,
      }

      // Log successful initialization
      logger.info(`VueSip v${version} initialized`)

      if (debug) {
        logger.debug('Configuration:', {
          debug,
          logLevel,
          hasSipConfig: !!sipConfig,
          hasMediaConfig: !!mediaConfig,
          hasUserPreferences: !!userPreferences,
        })
      }
    },
  }
}

// ============================================================================
// Version & Metadata
// ============================================================================

/**
 * VueSip library version.
 *
 * @public
 */
export const version = '1.0.0'

/**
 * VueSip library metadata.
 *
 * @public
 */
export const metadata = {
  name: 'VueSip',
  version,
  description: 'A headless Vue.js component library for SIP/VoIP applications',
  author: 'VueSip Team',
  license: 'MIT',
  repository: 'https://github.com/yourusername/vuesip',
  homepage: 'https://vuesip.dev',
  bugs: 'https://github.com/yourusername/vuesip/issues',
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export for convenience.
 *
 * @example
 * ```typescript
 * import VueSip from 'vuesip'
 *
 * app.use(VueSip.createVueSip())
 * ```
 */
export default {
  version,
  metadata,
  createVueSip,
  install: createVueSip().install,
}

// ============================================================================
// Type Augmentation
// ============================================================================

/**
 * Augment Vue's ComponentCustomProperties to include $vuesip
 */
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    /**
     * VueSip plugin instance
     */
    $vuesip: {
      version: string
      options: VueSipOptions
      logger: ReturnType<typeof createLogger>
    }
  }
}
