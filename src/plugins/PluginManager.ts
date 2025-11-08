/**
 * Plugin Manager for VueSip
 *
 * Provides comprehensive plugin lifecycle management including registration, installation,
 * configuration updates, dependency resolution, and version compatibility checking.
 * Coordinates between plugins and the hook system, manages plugin contexts, and provides
 * centralized event-based plugin communication.
 *
 * @remarks
 * The PluginManager is the central orchestrator for VueSip's extensibility system. It manages
 * the complete lifecycle of plugins from registration through installation and eventual cleanup,
 * ensuring proper dependency resolution, version compatibility, and integration with the hook system.
 *
 * ## Plugin Lifecycle States
 * Plugins progress through the following states during their lifecycle:
 * - **Registered**: Plugin has been registered but not yet installed. Configuration has been validated
 *   and dependencies checked, but the plugin's `install()` method has not been called.
 * - **Installing**: Plugin's `install()` method is currently executing. This is a transient state
 *   during the asynchronous installation process.
 * - **Installed**: Plugin has been successfully installed and is fully operational. The plugin can
 *   now interact with the system through hooks and receive events.
 * - **Uninstalling**: Plugin's `uninstall()` method is currently executing. This is a transient state
 *   during cleanup before removal.
 * - **Failed**: Plugin installation encountered an error and the plugin is non-operational. The error
 *   is stored in the plugin entry for debugging purposes.
 *
 * ## Registration Process
 * When a plugin is registered, the PluginManager:
 * 1. Validates that the plugin is not already registered
 * 2. Checks version compatibility against the application version
 * 3. Verifies all dependencies are installed and operational
 * 4. Merges provided configuration with plugin defaults
 * 5. Creates a plugin entry and stores it in the registry
 * 6. If enabled, automatically installs the plugin
 * 7. Emits 'plugin:installed' event on successful installation
 *
 * ## Version Compatibility
 * Plugins can specify version constraints using `minVersion` and `maxVersion` in their metadata:
 * - `minVersion`: Minimum required VueSip version (inclusive)
 * - `maxVersion`: Maximum supported VueSip version (inclusive)
 * - Version comparison uses semantic versioning (semver) format: MAJOR.MINOR.PATCH
 * - Registration fails if the current version is outside the supported range
 *
 * ## Dependency Management
 * Plugins can declare dependencies on other plugins via the `dependencies` array in metadata:
 * - Dependencies must be registered before the dependent plugin
 * - Dependencies must be in the Installed state
 * - Circular dependencies are not detected (plugins must avoid them)
 * - Registration fails if any dependency is missing or not installed
 *
 * ## Hook Integration
 * The PluginManager integrates with the HookManager to provide:
 * - Hook registration scoped to specific plugins
 * - Automatic cleanup of plugin hooks on unregistration
 * - Hook execution context with access to VueSip core services
 * - Lifecycle hooks for plugin events (installed, uninstalled, configUpdated)
 *
 * ## Context Management
 * Plugin contexts provide access to VueSip services and are updated dynamically:
 * - SipClient instance (set after SIP initialization)
 * - MediaManager instance (set during media setup)
 * - SipClientConfig (set during configuration)
 * - Active calls map (updated as calls are created/destroyed)
 * - Event bus for plugin communication
 * - Logger scoped to plugin name
 * - Hook registration/execution interface
 *
 * @example Basic plugin registration
 * ```typescript
 * import { PluginManager } from './plugins/PluginManager'
 * import { createRecordingPlugin } from './plugins/RecordingPlugin'
 *
 * const pluginManager = new PluginManager(eventBus, '1.0.0')
 *
 * // Register plugin with default configuration
 * const recordingPlugin = createRecordingPlugin()
 * await pluginManager.register(recordingPlugin)
 *
 * // Plugin is now installed and operational
 * console.log(pluginManager.has('recording')) // true
 * ```
 *
 * @example Plugin registration with custom configuration
 * ```typescript
 * const recordingPlugin = createRecordingPlugin()
 * await pluginManager.register(recordingPlugin, {
 *   enabled: true,
 *   autoStart: true,
 *   recordingOptions: {
 *     audio: true,
 *     video: false,
 *     mimeType: 'audio/webm',
 *     audioBitsPerSecond: 128000
 *   },
 *   storeInIndexedDB: true,
 *   maxRecordings: 50
 * })
 * ```
 *
 * @example Plugin lifecycle management
 * ```typescript
 * // Register without auto-install
 * await pluginManager.register(myPlugin, { enabled: false })
 *
 * // Check plugin state
 * const entry = pluginManager.get('my-plugin')
 * console.log(entry?.state) // 'Registered'
 *
 * // Manually enable and install
 * await pluginManager.updateConfig('my-plugin', { enabled: true })
 *
 * // Later, unregister and cleanup
 * await pluginManager.unregister('my-plugin')
 * console.log(pluginManager.has('my-plugin')) // false
 * ```
 *
 * @example Configuration updates
 * ```typescript
 * // Update plugin configuration at runtime
 * await pluginManager.updateConfig('recording', {
 *   autoStart: false,
 *   maxRecordings: 100
 * })
 *
 * // Plugin's updateConfig method is called if implemented
 * // 'plugin:configUpdated' event is emitted
 * ```
 *
 * @example Dependency management
 * ```typescript
 * // Register base plugin first
 * await pluginManager.register(authPlugin)
 *
 * // Register dependent plugin - works because dependency is installed
 * const analyticsPlugin = createPlugin({
 *   metadata: {
 *     name: 'analytics',
 *     version: '1.0.0',
 *     dependencies: ['auth'] // Requires auth plugin
 *   },
 *   // ... plugin implementation
 * })
 * await pluginManager.register(analyticsPlugin) // Success
 *
 * // Attempting to register without dependency fails
 * await pluginManager.register(anotherPlugin, {
 *   metadata: {
 *     dependencies: ['missing-plugin']
 *   }
 * }) // Throws: "Plugin ... requires plugin: missing-plugin"
 * ```
 *
 * @example Version compatibility
 * ```typescript
 * const pluginManager = new PluginManager(eventBus, '2.5.0')
 *
 * const myPlugin = createPlugin({
 *   metadata: {
 *     name: 'my-plugin',
 *     version: '1.0.0',
 *     minVersion: '2.0.0', // Requires VueSip >= 2.0.0
 *     maxVersion: '3.0.0'  // Requires VueSip <= 3.0.0
 *   },
 *   // ... plugin implementation
 * })
 *
 * await pluginManager.register(myPlugin) // Success - 2.5.0 is within range
 * ```
 *
 * @example Hook integration
 * ```typescript
 * // Plugin can register hooks through its context
 * const myPlugin = {
 *   metadata: { name: 'my-plugin', version: '1.0.0' },
 *   defaultConfig: {},
 *   async install(context) {
 *     // Register hook that runs before calls are made
 *     context.hooks.register('beforeCall', async (data) => {
 *       console.log('Call about to start:', data.callId)
 *       // Hooks are automatically cleaned up on unregister
 *     })
 *   }
 * }
 *
 * await pluginManager.register(myPlugin)
 *
 * // Execute hooks from anywhere
 * await pluginManager.executeHook('beforeCall', { callId: 'call-123' })
 * ```
 *
 * @example Error handling
 * ```typescript
 * try {
 *   await pluginManager.register(problematicPlugin)
 * } catch (error) {
 *   // Check plugin state to see what failed
 *   const entry = pluginManager.get('problematic-plugin')
 *   if (entry?.state === 'Failed') {
 *     console.error('Installation failed:', entry.error)
 *   }
 * }
 *
 * // Plugin manager emits error events
 * eventBus.on('plugin:error', ({ pluginName, error }) => {
 *   console.error(`Plugin ${pluginName} encountered error:`, error)
 * })
 * ```
 *
 * @example Monitoring plugin statistics
 * ```typescript
 * // Get comprehensive plugin statistics
 * const stats = pluginManager.getStats()
 * console.log('Total plugins:', stats.totalPlugins)
 * console.log('Installed plugins:', stats.installedPlugins)
 * console.log('Failed plugins:', stats.failedPlugins)
 * console.log('Plugins by state:', stats.pluginsByState)
 * console.log('Hook statistics:', stats.hookStats)
 *
 * // Example output:
 * // {
 * //   totalPlugins: 5,
 * //   installedPlugins: 4,
 * //   failedPlugins: 1,
 * //   pluginsByState: {
 * //     Registered: 0,
 * //     Installing: 0,
 * //     Installed: 4,
 * //     Uninstalling: 0,
 * //     Failed: 1
 * //   },
 * //   hookStats: { totalHooks: 12, hooksByName: {...} }
 * // }
 * ```
 *
 * @example Context management with dynamic updates
 * ```typescript
 * const pluginManager = new PluginManager(eventBus, '1.0.0')
 *
 * // Initially, context has minimal services
 * await pluginManager.register(myPlugin)
 *
 * // Later, as services become available, update context
 * pluginManager.setSipClient(sipClient)
 * pluginManager.setMediaManager(mediaManager)
 * pluginManager.setConfig(config)
 * pluginManager.setActiveCalls(callsMap)
 *
 * // All installed plugins now have access to updated context
 * // via the hook system and plugin context
 * ```
 *
 * @example Complete lifecycle with cleanup
 * ```typescript
 * const pluginManager = new PluginManager(eventBus, '1.0.0')
 *
 * // Register multiple plugins
 * await pluginManager.register(plugin1)
 * await pluginManager.register(plugin2)
 * await pluginManager.register(plugin3)
 *
 * // Application running...
 *
 * // Clean shutdown - uninstall all plugins
 * await pluginManager.destroy()
 * // All plugins uninstalled, hooks cleared, resources freed
 * ```
 */

import { createLogger } from '../utils/logger'
import { HookManager } from './HookManager'
import type { EventBus } from '../core/EventBus'
import type { SipClient } from '../core/SipClient'
import type { CallSession } from '../core/CallSession'
import type { MediaManager } from '../core/MediaManager'
import type { SipClientConfig } from '../types/config.types'
import {
  PluginState,
  type Plugin,
  type PluginConfig,
  type PluginEntry,
  type PluginContext,
  type PluginManager as IPluginManager,
  type HookName,
  type HookHandler,
  type HookOptions,
} from '../types/plugin.types'

const logger = createLogger('PluginManager')

/**
 * PluginManager class
 *
 * Main manager class that implements centralized plugin lifecycle management for VueSip.
 * Coordinates plugin registration, installation, configuration updates, dependency resolution,
 * version compatibility checking, and integration with the hook system.
 *
 * @remarks
 * This class serves as the central registry and orchestrator for all plugins in the VueSip ecosystem.
 * It maintains plugin state, manages the plugin context that provides access to VueSip services,
 * and ensures proper lifecycle transitions from registration through installation to cleanup.
 *
 * ## State Management
 * The PluginManager maintains several internal maps and references:
 * - **plugins**: Map of plugin entries indexed by plugin name, containing plugin instance,
 *   configuration, state, hook IDs, and error information
 * - **hookManager**: HookManager instance for coordinating hook registration and execution
 * - **eventBus**: EventBus instance for plugin communication and lifecycle events
 * - **sipClient**: Optional SipClient instance (set after SIP initialization)
 * - **mediaManager**: Optional MediaManager instance (set during media setup)
 * - **config**: Optional SipClientConfig (set during configuration)
 * - **activeCalls**: Map of active call sessions (updated as calls are created/destroyed)
 *
 * ## Hook System Integration
 * The PluginManager creates and maintains a bidirectional integration with the HookManager:
 * - Provides plugins with hook registration interface through their context
 * - Tracks hook IDs per plugin for automatic cleanup on unregistration
 * - Updates hook context when VueSip services are set or modified
 * - Executes hooks on behalf of the application and other plugins
 *
 * ## Thread Safety
 * While JavaScript is single-threaded, async operations can create race conditions:
 * - Plugin installation and uninstallation are asynchronous
 * - Multiple plugins can be registered/unregistered concurrently
 * - The manager does not implement locking mechanisms
 * - Callers should avoid concurrent operations on the same plugin
 *
 * @see {@link register} for plugin registration workflow
 * @see {@link unregister} for plugin cleanup workflow
 * @see {@link updateConfig} for runtime configuration updates
 */
export class PluginManager implements IPluginManager {
  /** Registered plugins */
  private plugins: Map<string, PluginEntry> = new Map()

  /** Hook manager instance */
  private hookManager: HookManager

  /** Event bus instance */
  private eventBus: EventBus

  /** SIP client instance (may be set later) */
  private sipClient: SipClient | null = null

  /** Media manager instance (may be set later) */
  private mediaManager: MediaManager | null = null

  /** SIP configuration (may be set later) */
  private config: SipClientConfig | null = null

  /** Active call sessions */
  private activeCalls: Map<string, CallSession> = new Map()

  /** Application version */
  private version: string

  /**
   * Create a new PluginManager instance
   *
   * Initializes the plugin manager with the provided event bus and application version.
   * Creates the internal hook manager and sets up the initial plugin context.
   *
   * @param eventBus - The event bus instance used for plugin communication and lifecycle events.
   *   Plugins receive this in their context and can use it to emit and listen to events.
   * @param version - The application version string in semver format (e.g., '1.0.0', '2.5.3').
   *   Used for plugin version compatibility checking via minVersion and maxVersion constraints.
   *
   * @remarks
   * ## Initialization Process
   * The constructor performs the following initialization steps:
   * 1. Stores the event bus reference for plugin communication
   * 2. Stores the application version for compatibility checking
   * 3. Creates a new HookManager instance for hook coordination
   * 4. Initializes the hook context with the current state (initially minimal)
   *
   * ## Initial State
   * After construction, the plugin manager has:
   * - Empty plugin registry (no plugins registered)
   * - Fresh hook manager (no hooks registered)
   * - Minimal plugin context (only eventBus, logger, version, and hooks interface)
   * - No SIP-related services (sipClient, mediaManager, config, activeCalls are null/empty)
   *
   * ## Service Availability
   * VueSip services are set later via setter methods as they become available:
   * - Use `setSipClient()` after SIP initialization
   * - Use `setMediaManager()` after media setup
   * - Use `setConfig()` after configuration
   * - Use `setActiveCalls()` to provide call tracking
   *
   * @example Create a plugin manager
   * ```typescript
   * import { PluginManager } from './plugins/PluginManager'
   * import { EventBus } from './core/EventBus'
   *
   * const eventBus = new EventBus()
   * const pluginManager = new PluginManager(eventBus, '1.0.0')
   * // Ready to register plugins
   * ```
   */
  constructor(eventBus: EventBus, version: string) {
    this.eventBus = eventBus
    this.version = version
    this.hookManager = new HookManager()

    // Set up the plugin context for hooks
    this.hookManager.setContext(this.createContext())

    logger.info('PluginManager initialized')
  }

  /**
   * Set the SIP client instance and update plugin context
   *
   * Updates the SipClient reference in the plugin context, making it available to all
   * installed plugins through their hook handlers and context access. This method should
   * be called after SIP initialization to provide plugins with access to SIP functionality.
   *
   * @param sipClient - The SipClient instance to make available to plugins, or null to
   *   remove SIP client access. Pass null during shutdown or when SIP becomes unavailable.
   *
   * @remarks
   * ## When to Call
   * This setter should be called:
   * - After SipClient is successfully initialized during application startup
   * - Before registering plugins that require SIP functionality
   * - When SipClient configuration changes (create new instance and set it)
   * - With null during shutdown to clear the reference
   *
   * ## Impact on Plugins
   * When this method is called:
   * - The hook manager's context is updated with the new SipClient instance
   * - All subsequent hook executions receive the updated context
   * - Plugins can access the SipClient through `context.sipClient` in hook handlers
   * - Already-registered hooks automatically see the updated context
   *
   * ## Context Update Mechanism
   * The method calls `createContext()` to rebuild the plugin context with all current
   * services, ensuring the context remains consistent across all context properties.
   *
   * @example Set SIP client after initialization
   * ```typescript
   * // Initialize SIP client
   * const sipClient = new SipClient(config)
   * await sipClient.connect()
   *
   * // Make it available to plugins
   * pluginManager.setSipClient(sipClient)
   *
   * // Plugins can now access sipClient in their hooks
   * ```
   *
   * @example Clear SIP client during shutdown
   * ```typescript
   * // Before destroying SIP client
   * pluginManager.setSipClient(null)
   * await sipClient.disconnect()
   * ```
   */
  setSipClient(sipClient: SipClient | null): void {
    this.sipClient = sipClient
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Set the media manager instance and update plugin context
   *
   * Updates the MediaManager reference in the plugin context, making it available to all
   * installed plugins through their hook handlers and context access. This method should
   * be called after media initialization to provide plugins with access to media functionality.
   *
   * @param mediaManager - The MediaManager instance to make available to plugins, or null to
   *   remove media manager access. Pass null during shutdown or when media becomes unavailable.
   *
   * @remarks
   * ## When to Call
   * This setter should be called:
   * - After MediaManager is successfully initialized during application startup
   * - Before registering plugins that require media functionality (e.g., recording)
   * - When MediaManager configuration changes (create new instance and set it)
   * - With null during shutdown to clear the reference
   *
   * ## Impact on Plugins
   * When this method is called:
   * - The hook manager's context is updated with the new MediaManager instance
   * - All subsequent hook executions receive the updated context
   * - Plugins can access the MediaManager through `context.mediaManager` in hook handlers
   * - Enables plugins to access media streams, control devices, and manage media state
   *
   * @example Set media manager after initialization
   * ```typescript
   * const mediaManager = new MediaManager(config)
   * await mediaManager.initialize()
   * pluginManager.setMediaManager(mediaManager)
   * // Plugins can now access media functionality
   * ```
   */
  setMediaManager(mediaManager: MediaManager | null): void {
    this.mediaManager = mediaManager
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Set the SIP configuration and update plugin context
   *
   * Updates the SipClientConfig reference in the plugin context, making the current
   * configuration available to all installed plugins. This method should be called
   * when configuration is loaded or updated.
   *
   * @param config - The SipClientConfig object containing current SIP settings, or null to
   *   remove configuration access. Pass null during shutdown or before configuration is loaded.
   *
   * @remarks
   * ## When to Call
   * This setter should be called:
   * - After loading application configuration during startup
   * - When configuration is updated at runtime
   * - Before registering plugins that need to access configuration
   * - With null during shutdown or configuration reset
   *
   * ## Impact on Plugins
   * When this method is called:
   * - The hook manager's context is updated with the new configuration
   * - All subsequent hook executions receive the updated context
   * - Plugins can access the configuration through `context.config` in hook handlers
   * - Enables plugins to adapt their behavior based on configuration settings
   *
   * ## Configuration Updates
   * When configuration changes at runtime:
   * 1. Call `setConfig()` with the new configuration
   * 2. Optionally notify affected plugins via events or hook execution
   * 3. Plugins see the updated configuration in subsequent hook executions
   *
   * @example Set configuration after loading
   * ```typescript
   * const config = await loadConfig()
   * pluginManager.setConfig(config)
   * // Plugins can now access configuration
   * ```
   */
  setConfig(config: SipClientConfig | null): void {
    this.config = config
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Set the active calls map and update plugin context
   *
   * Updates the active calls map reference in the plugin context, making the current
   * call sessions available to all installed plugins. This method should be called
   * to provide plugins with access to active call state.
   *
   * @param activeCalls - Map of active CallSession instances indexed by call ID. This map
   *   is typically maintained by the SipClient and updated as calls are created and destroyed.
   *
   * @remarks
   * ## When to Call
   * This setter should be called:
   * - After SipClient initialization to share the active calls map
   * - Once during setup (the map reference is shared, not copied)
   * - When replacing the calls map with a new instance (rare)
   *
   * ## Impact on Plugins
   * When this method is called:
   * - The hook manager's context is updated with the active calls map
   * - All subsequent hook executions receive the updated context
   * - Plugins can access active calls through `context.activeCalls` in hook handlers
   * - Enables plugins to monitor and interact with ongoing calls
   *
   * ## Map Sharing
   * The active calls map is shared by reference:
   * - Changes to the map (add/remove calls) are automatically visible to plugins
   * - No need to call `setActiveCalls()` when individual calls are added/removed
   * - Only call this method when replacing the entire map instance
   *
   * ## Call Lifecycle Access
   * Plugins can use the active calls map to:
   * - Enumerate all active calls
   * - Access call session details (call ID, state, remote party, etc.)
   * - Monitor call state changes
   * - Implement call-related features (recording, analytics, etc.)
   *
   * @example Set active calls map during initialization
   * ```typescript
   * const sipClient = new SipClient(config)
   * await sipClient.connect()
   *
   * // Share the active calls map with plugins
   * pluginManager.setActiveCalls(sipClient.getActiveCalls())
   * // Plugins can now monitor active calls
   * ```
   */
  setActiveCalls(activeCalls: Map<string, CallSession>): void {
    this.activeCalls = activeCalls
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Create a plugin context with access to VueSip services
   *
   * Constructs a PluginContext object that provides plugins with access to VueSip core services,
   * utilities, and the hook system. This context is passed to plugins during installation and
   * is also set on the HookManager for use during hook execution.
   *
   * @param pluginName - Name of the plugin requesting context. Defaults to 'core' for system-level
   *   operations. When provided, hooks registered through this context are associated with the plugin
   *   for automatic cleanup on plugin unregistration.
   *
   * @returns A PluginContext object containing:
   *   - `eventBus`: EventBus instance for emitting and listening to events
   *   - `sipClient`: SipClient instance (null if not yet initialized)
   *   - `mediaManager`: MediaManager instance (null if not yet initialized)
   *   - `config`: SipClientConfig object (null if not yet loaded)
   *   - `activeCalls`: Map of active CallSession instances
   *   - `hooks`: Hook registration and execution interface
   *   - `logger`: Scoped logger for plugin-specific logging
   *   - `version`: Application version string
   *
   * @internal
   *
   * @remarks
   * ## Context Lifecycle
   * The context is created multiple times throughout the application lifecycle:
   * - During PluginManager construction (initial context with minimal services)
   * - When services are set via setSipClient, setMediaManager, etc. (updated context)
   * - During plugin installation (plugin-specific context with plugin name)
   * - During hook execution (context provided to hook handlers)
   *
   * ## Hook Interface
   * The context's `hooks` property provides three methods:
   * - `register(name, handler, options)`: Register a new hook handler scoped to the plugin
   * - `unregister(hookId)`: Unregister a specific hook by its ID
   * - `execute(name, data)`: Execute all handlers for a hook and return results
   *
   * ## Hook ID Tracking
   * When a plugin registers a hook through the context:
   * 1. The hook is registered with the HookManager, associated with the plugin name
   * 2. The returned hook ID is added to the plugin entry's `hookIds` array
   * 3. When the plugin is unregistered, all its hook IDs are automatically unregistered
   * 4. This ensures complete cleanup and prevents orphaned hooks
   *
   * ## Logger Scoping
   * The logger in the context is not directly scoped to the plugin name in this implementation.
   * It uses the 'PluginManager' logger scope. Plugins should prefix their log messages with
   * their name for clarity, or use their own logger instances.
   *
   * ## Service Availability
   * Services in the context may be null if not yet initialized:
   * - `sipClient`: null until setSipClient() is called
   * - `mediaManager`: null until setMediaManager() is called
   * - `config`: null until setConfig() is called
   * - `activeCalls`: always initialized (empty map if not set)
   * - Plugins should check for null before using these services
   *
   * ## Context Sharing
   * The same context structure is shared with:
   * - Plugin's install() method during registration
   * - Plugin's uninstall() method during cleanup
   * - Plugin's updateConfig() method when configuration changes
   * - Hook handlers during hook execution
   * - All plugins see the same shared service instances
   *
   * @example Context structure
   * ```typescript
   * // Example of context structure returned by this method
   * const context = {
   *   eventBus: eventBusInstance,
   *   sipClient: sipClientInstance,  // or null
   *   mediaManager: mediaManagerInstance,  // or null
   *   config: configObject,  // or null
   *   activeCalls: new Map([
   *     ['call-123', callSession1],
   *     ['call-456', callSession2]
   *   ]),
   *   hooks: {
   *     register: (name, handler, options) => { ... },
   *     unregister: (hookId) => { ... },
   *     execute: (name, data) => { ... }
   *   },
   *   logger: {
   *     debug: (message, ...args) => { ... },
   *     info: (message, ...args) => { ... },
   *     warn: (message, ...args) => { ... },
   *     error: (message, ...args) => { ... }
   *   },
   *   version: '1.0.0'
   * }
   * ```
   */
  private createContext(pluginName = 'core'): PluginContext {
    return {
      eventBus: this.eventBus,
      sipClient: this.sipClient,
      mediaManager: this.mediaManager,
      config: this.config,
      activeCalls: this.activeCalls,
      hooks: {
        register: <TData = any, TReturn = any>(
          name: HookName,
          handler: HookHandler<TData, TReturn>,
          options?: HookOptions
        ) => {
          const hookId = this.hookManager.register(name, handler, options, pluginName)
          // Track hook ID in plugin entry for cleanup
          const entry = this.plugins.get(pluginName)
          if (entry) {
            entry.hookIds.push(hookId)
          }
          return hookId
        },
        unregister: (hookId: string) => this.hookManager.unregister(hookId),
        execute: <TData = any, TReturn = any>(name: HookName, data?: TData) =>
          this.hookManager.execute<TData, TReturn>(name, data),
      },
      logger: {
        debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
        info: (message: string, ...args: any[]) => logger.info(message, ...args),
        warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
        error: (message: string, ...args: any[]) => logger.error(message, ...args),
      },
      version: this.version,
    }
  }

  /**
   * Register and install a plugin in the VueSip system
   *
   * Validates the plugin, checks compatibility and dependencies, merges configuration,
   * creates a plugin entry, and optionally installs the plugin if enabled. This is the
   * primary method for adding plugins to the VueSip ecosystem.
   *
   * @param plugin - The plugin instance to register. Must implement the Plugin interface
   *   with metadata, defaultConfig, and install() method. The plugin's metadata.name must
   *   be unique across all registered plugins.
   * @param config - Optional configuration to override the plugin's default configuration.
   *   This is merged with plugin.defaultConfig, with provided values taking precedence.
   *   The `enabled` property defaults to true if not specified.
   *
   * @returns A promise that resolves when registration and optional installation complete.
   *   If the plugin is enabled (default), the promise resolves after successful installation.
   *   If disabled, the promise resolves after registration without installation.
   *
   * @throws {Error} If a plugin with the same name is already registered
   * @throws {Error} If the plugin's version requirements are not met by the current VueSip version
   * @throws {Error} If any of the plugin's dependencies are missing or not installed
   * @throws {Error} If the plugin's install() method throws an error (when enabled)
   *
   * @remarks
   * ## Registration Workflow
   * The registration process follows these steps in order:
   * 1. **Duplicate Check**: Verifies no plugin with the same name is already registered
   * 2. **Version Check**: Validates plugin's minVersion and maxVersion against app version
   * 3. **Dependency Check**: Ensures all dependencies are registered and installed
   * 4. **Config Merge**: Combines plugin defaults with provided configuration
   * 5. **Entry Creation**: Creates PluginEntry with initial state of 'Registered'
   * 6. **Registration**: Adds entry to the plugin registry
   * 7. **Installation**: If enabled, calls installPlugin() to complete setup
   *
   * ## Plugin Lifecycle State Transitions
   * State transitions during registration:
   * - Initial: (not in registry)
   * - After step 5: Registered (in registry, not yet operational)
   * - During installation: Installing (if enabled)
   * - After installation: Installed (operational) or Failed (installation error)
   *
   * ## Configuration Merging
   * Configuration is merged as follows:
   * ```typescript
   * finalConfig = {
   *   ...plugin.defaultConfig,  // Plugin defaults
   *   ...config,                 // Provided overrides
   *   enabled: config?.enabled ?? true  // Enabled by default
   * }
   * ```
   *
   * ## Event Emissions
   * This method may trigger the following events:
   * - `plugin:installed`: Emitted after successful installation (if enabled)
   * - `plugin:error`: Emitted if installation fails (if enabled)
   *
   * ## Error Handling
   * - Registration errors (duplicate, version, dependencies) are thrown immediately
   * - Installation errors are caught, plugin state is set to Failed, and error is rethrown
   * - Even if installation fails, the plugin remains in the registry with Failed state
   * - Failed plugins can be unregistered and re-registered after fixing issues
   *
   * ## Dependency Resolution
   * Dependencies are specified in plugin.metadata.dependencies as an array of plugin names:
   * - Dependencies must be registered before the dependent plugin
   * - Dependencies must be in Installed state (not just Registered)
   * - Circular dependencies are not detected (avoid them in plugin design)
   * - Missing or uninstalled dependencies cause registration to fail
   *
   * @example Register plugin with default configuration
   * ```typescript
   * import { createRecordingPlugin } from './plugins/RecordingPlugin'
   *
   * const recordingPlugin = createRecordingPlugin()
   * await pluginManager.register(recordingPlugin)
   * // Plugin installed with default config, auto-enabled
   * ```
   *
   * @example Register plugin with custom configuration
   * ```typescript
   * await pluginManager.register(recordingPlugin, {
   *   enabled: true,
   *   autoStart: true,
   *   recordingOptions: {
   *     audio: true,
   *     video: false,
   *     mimeType: 'audio/webm'
   *   }
   * })
   * ```
   *
   * @example Register plugin without auto-installation
   * ```typescript
   * // Register but don't install yet
   * await pluginManager.register(myPlugin, { enabled: false })
   *
   * // Plugin is registered but not operational
   * const entry = pluginManager.get('my-plugin')
   * console.log(entry?.state)  // 'Registered'
   *
   * // Install later via updateConfig
   * await pluginManager.updateConfig('my-plugin', { enabled: true })
   * ```
   *
   * @example Handle registration errors
   * ```typescript
   * try {
   *   await pluginManager.register(myPlugin)
   *   console.log('Plugin registered successfully')
   * } catch (error) {
   *   if (error.message.includes('already registered')) {
   *     console.error('Plugin name conflict')
   *   } else if (error.message.includes('requires VueSip version')) {
   *     console.error('Version incompatibility')
   *   } else if (error.message.includes('requires plugin')) {
   *     console.error('Missing dependency')
   *   } else {
   *     console.error('Installation failed:', error)
   *   }
   * }
   * ```
   *
   * @example Register plugin with dependencies
   * ```typescript
   * // Register base plugin first
   * const authPlugin = createAuthPlugin()
   * await pluginManager.register(authPlugin)
   *
   * // Register dependent plugin
   * const analyticsPlugin = createAnalyticsPlugin()
   * // analyticsPlugin.metadata.dependencies = ['auth']
   * await pluginManager.register(analyticsPlugin)
   * // Success - dependency is satisfied
   * ```
   */
  async register<TConfig extends PluginConfig = PluginConfig>(
    plugin: Plugin<TConfig>,
    config?: TConfig
  ): Promise<void> {
    const name = plugin.metadata.name

    // Check if already registered
    if (this.plugins.has(name)) {
      throw new Error(`Plugin already registered: ${name}`)
    }

    // Check version compatibility
    this.checkVersionCompatibility(plugin)

    // Check dependencies
    this.checkDependencies(plugin)

    // Merge config with defaults
    const finalConfig = {
      ...plugin.defaultConfig,
      ...config,
      enabled: config?.enabled ?? true,
    } as TConfig

    // Create plugin entry
    const entry: PluginEntry<TConfig> = {
      plugin,
      config: finalConfig,
      state: PluginState.Registered,
      hookIds: [],
    }

    this.plugins.set(name, entry)

    logger.info(`Plugin registered: ${name} v${plugin.metadata.version}`)

    // Install if enabled
    if (finalConfig.enabled) {
      await this.installPlugin(name)
    }
  }

  /**
   * Install a registered plugin by executing its install() method
   *
   * Performs the actual plugin installation by creating a plugin-specific context,
   * calling the plugin's install() method, updating plugin state, and emitting events.
   * This is called automatically during registration if the plugin is enabled.
   *
   * @param pluginName - The name of the plugin to install. Must be a registered plugin
   *   that exists in the plugin registry.
   *
   * @returns A promise that resolves when installation completes successfully. The promise
   *   resolves immediately if the plugin is already installed (idempotent).
   *
   * @throws {Error} If the plugin is not found in the registry
   * @throws {Error} If the plugin's install() method throws an error
   *
   * @internal
   *
   * @remarks
   * ## Installation Process
   * The installation workflow follows these steps:
   * 1. **Lookup**: Retrieves plugin entry from the registry
   * 2. **State Check**: Returns early if already installed (idempotent behavior)
   * 3. **State Transition**: Sets state to Installing
   * 4. **Context Creation**: Creates plugin-specific context with current services
   * 5. **Plugin Install**: Calls plugin.install(context, config)
   * 6. **Success Handling**: Sets state to Installed, records timestamp, logs success
   * 7. **Event Emission**: Emits 'plugin:installed' event
   * 8. **Error Handling**: Sets state to Failed, records error, emits error event, rethrows
   *
   * ## State Transitions
   * State changes during installation:
   * - Before: Registered (or any other state if retrying)
   * - During: Installing (transient state)
   * - Success: Installed (operational)
   * - Failure: Failed (non-operational, error recorded)
   *
   * ## Plugin Context
   * The context passed to plugin.install() includes:
   * - All VueSip services (sipClient, mediaManager, config, activeCalls)
   * - Event bus for plugin communication
   * - Hooks interface for registering hook handlers
   * - Scoped logger for plugin logging
   * - Application version string
   *
   * ## Error Handling Strategy
   * If installation fails:
   * - Plugin state is set to Failed
   * - Error is stored in plugin entry's error field
   * - Error is logged with context
   * - 'plugin:error' event is emitted
   * - Original error is rethrown to caller
   * - Plugin remains in registry (can be unregistered and retried)
   *
   * ## Idempotency
   * This method is idempotent for already-installed plugins:
   * - If state is already Installed, logs warning and returns
   * - Does not attempt to install again
   * - Does not emit events
   * - Useful for retry scenarios or configuration updates
   *
   * ## Timestamp Recording
   * On successful installation:
   * - Sets entry.installedAt to current Date
   * - Useful for tracking when plugins became operational
   * - Can be used for debugging or monitoring plugin lifecycle
   *
   * ## Event Emissions
   * This method emits events on the event bus:
   * - `plugin:installed`: On success, with { pluginName, metadata }
   * - `plugin:error`: On failure, with { pluginName, error }
   *
   * @example Installation flow (internal, called from register)
   * ```typescript
   * // During register() when config.enabled is true
   * await this.installPlugin(pluginName)
   * // Plugin state transitions: Registered → Installing → Installed
   * ```
   */
  private async installPlugin(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName)
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginName}`)
    }

    if (entry.state === PluginState.Installed) {
      logger.warn(`Plugin already installed: ${pluginName}`)
      return
    }

    try {
      entry.state = PluginState.Installing

      const context = this.createContext(pluginName)

      // Install the plugin
      await entry.plugin.install(context, entry.config)

      entry.state = PluginState.Installed
      entry.installedAt = new Date()

      logger.info(`Plugin installed: ${pluginName}`)

      // Emit event
      this.eventBus.emit('plugin:installed', { pluginName, metadata: entry.plugin.metadata } as any)
    } catch (error) {
      entry.state = PluginState.Failed
      entry.error = error instanceof Error ? error : new Error(String(error))

      logger.error(`Plugin installation failed: ${pluginName}`, error)

      // Emit error event
      this.eventBus.emit('plugin:error', { pluginName, error } as any)

      throw error
    }
  }

  /**
   * Unregister and uninstall a plugin from the VueSip system
   *
   * Performs complete cleanup of a plugin by calling its uninstall() method (if defined),
   * removing all registered hooks, deleting the plugin entry, and emitting events. This is
   * the primary method for removing plugins from the VueSip ecosystem.
   *
   * @param pluginName - The name of the plugin to unregister. Must be a registered plugin
   *   that exists in the plugin registry.
   *
   * @returns A promise that resolves when unregistration and cleanup are complete. The
   *   promise always resolves (cleanup always completes) but may throw after cleanup if
   *   the uninstall() method failed.
   *
   * @throws {Error} If the plugin is not found in the registry
   * @throws {Error} If the plugin's uninstall() method throws an error (thrown after cleanup)
   *
   * @remarks
   * ## Unregistration Workflow
   * The cleanup process follows these steps in order:
   * 1. **Lookup**: Retrieves plugin entry from the registry
   * 2. **State Transition**: Sets state to Uninstalling
   * 3. **Plugin Uninstall**: Calls plugin.uninstall(context) if method exists
   * 4. **Hook Cleanup**: Removes all hooks registered by the plugin (always, even if uninstall fails)
   * 5. **Registry Removal**: Deletes plugin entry from the registry (always)
   * 6. **Event Emission**: Emits 'plugin:unregistered' event (always)
   * 7. **Error Propagation**: Rethrows uninstall error if one occurred (after cleanup)
   *
   * ## Plugin Lifecycle State Transitions
   * State changes during unregistration:
   * - Before: Any state (Registered, Installed, Failed, etc.)
   * - During: Uninstalling (transient state)
   * - After: (removed from registry, no longer tracked)
   *
   * ## Guaranteed Cleanup
   * This method uses a try-catch-finally pattern to ensure cleanup always completes:
   * - Hooks are always removed, even if uninstall() fails
   * - Plugin is always removed from registry, even if uninstall() fails
   * - Event is always emitted, even if uninstall() fails
   * - This prevents orphaned hooks and registry entries
   *
   * ## Error Handling Strategy
   * If the plugin's uninstall() method throws:
   * - Error is caught and logged
   * - Cleanup continues in the finally block
   * - All hooks are removed via hookManager.unregisterByPlugin()
   * - Plugin entry is deleted from the registry
   * - 'plugin:unregistered' event is emitted
   * - Error is rethrown after all cleanup completes
   *
   * ## Hook Cleanup Mechanism
   * Hooks are cleaned up automatically:
   * - hookManager.unregisterByPlugin(pluginName) removes all hooks for the plugin
   * - Hook IDs tracked in entry.hookIds are all unregistered
   * - Prevents orphaned hooks from executing after plugin removal
   * - Ensures clean separation between plugin lifecycle and hook lifecycle
   *
   * ## Optional Uninstall Method
   * The plugin's uninstall() method is optional:
   * - Only called if the plugin implements it
   * - Allows plugins to perform custom cleanup (close connections, clear caches, etc.)
   * - Receives the same context structure as install()
   * - Can be async or sync
   *
   * ## Event Emissions
   * This method emits events on the event bus:
   * - `plugin:unregistered`: Always emitted with { pluginName }
   * - No error event is emitted (uninstall errors are thrown)
   *
   * ## Idempotency
   * This method is NOT idempotent:
   * - Throws "Plugin not found" if called on an unregistered plugin
   * - Does not silently ignore missing plugins
   * - Callers should check with has() before calling if unsure
   *
   * @example Basic plugin unregistration
   * ```typescript
   * // Unregister a plugin
   * await pluginManager.unregister('recording')
   * console.log(pluginManager.has('recording'))  // false
   * ```
   *
   * @example Unregister with error handling
   * ```typescript
   * try {
   *   await pluginManager.unregister('my-plugin')
   *   console.log('Plugin unregistered successfully')
   * } catch (error) {
   *   if (error.message.includes('not found')) {
   *     console.error('Plugin was not registered')
   *   } else {
   *     console.error('Plugin cleanup failed:', error)
   *     // Note: Plugin was still removed despite the error
   *   }
   * }
   * ```
   *
   * @example Conditional unregistration
   * ```typescript
   * if (pluginManager.has('analytics')) {
   *   await pluginManager.unregister('analytics')
   *   console.log('Analytics plugin removed')
   * }
   * ```
   *
   * @example Unregister all plugins
   * ```typescript
   * // Get all plugin names
   * const pluginNames = Array.from(pluginManager.getAll().keys())
   *
   * // Unregister each one
   * for (const name of pluginNames) {
   *   try {
   *     await pluginManager.unregister(name)
   *   } catch (error) {
   *     console.error(`Failed to unregister ${name}:`, error)
   *   }
   * }
   * ```
   */
  async unregister(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName)
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginName}`)
    }

    let uninstallError: Error | null = null

    try {
      entry.state = PluginState.Uninstalling

      // Uninstall if plugin has uninstall method
      if (entry.plugin.uninstall) {
        const context = this.createContext(pluginName)
        await entry.plugin.uninstall(context)
      }
    } catch (error) {
      uninstallError = error instanceof Error ? error : new Error(String(error))
      logger.error(`Plugin uninstallation failed: ${pluginName}`, error)
    } finally {
      // Always clean up, even if uninstall fails
      // Remove all hooks registered by this plugin
      this.hookManager.unregisterByPlugin(pluginName)

      // Remove from registry
      this.plugins.delete(pluginName)

      logger.info(`Plugin unregistered: ${pluginName}`)

      // Emit event
      this.eventBus.emit('plugin:unregistered', { pluginName } as any)
    }

    // Throw error after cleanup if uninstall failed
    if (uninstallError) {
      throw uninstallError
    }
  }

  /**
   * Get a registered plugin entry by name
   *
   * Retrieves the PluginEntry for a specific plugin, which contains the plugin instance,
   * configuration, state, hook IDs, installation timestamp, and error information (if failed).
   * Returns undefined if the plugin is not registered.
   *
   * @param pluginName - The name of the plugin to retrieve. This is the value from
   *   plugin.metadata.name.
   *
   * @returns The PluginEntry for the specified plugin if it exists, or undefined if the
   *   plugin is not registered. The entry contains:
   *   - `plugin`: The plugin instance
   *   - `config`: Current plugin configuration
   *   - `state`: Current lifecycle state (Registered, Installing, Installed, etc.)
   *   - `hookIds`: Array of hook IDs registered by this plugin
   *   - `installedAt`: Date when plugin was installed (if in Installed state)
   *   - `error`: Error that caused installation failure (if in Failed state)
   *
   * @remarks
   * ## Use Cases
   * Common reasons to retrieve a plugin entry:
   * - Check plugin state to see if it's operational
   * - Access plugin configuration for debugging
   * - Inspect error information if installation failed
   * - Verify installation timestamp
   * - Access the plugin instance to call plugin-specific methods
   *
   * ## State Inspection
   * The returned entry's state property indicates plugin status:
   * - `PluginState.Registered`: Plugin registered but not yet installed
   * - `PluginState.Installing`: Installation in progress
   * - `PluginState.Installed`: Plugin fully operational
   * - `PluginState.Uninstalling`: Cleanup in progress
   * - `PluginState.Failed`: Installation failed, see entry.error
   *
   * ## Return Value Handling
   * Always check for undefined before accessing entry properties:
   * ```typescript
   * const entry = pluginManager.get('my-plugin')
   * if (entry) {
   *   // Plugin is registered
   *   console.log(entry.state)
   * } else {
   *   // Plugin not found
   *   console.log('Plugin not registered')
   * }
   * ```
   *
   * @example Check plugin state
   * ```typescript
   * const entry = pluginManager.get('recording')
   * if (entry?.state === PluginState.Installed) {
   *   console.log('Recording plugin is operational')
   * } else if (entry?.state === PluginState.Failed) {
   *   console.error('Recording plugin failed:', entry.error)
   * } else {
   *   console.log('Recording plugin not ready')
   * }
   * ```
   *
   * @example Access plugin configuration
   * ```typescript
   * const entry = pluginManager.get('recording')
   * if (entry) {
   *   console.log('Auto-start:', entry.config.autoStart)
   *   console.log('Max recordings:', entry.config.maxRecordings)
   * }
   * ```
   *
   * @example Call plugin-specific methods
   * ```typescript
   * const entry = pluginManager.get('recording')
   * if (entry?.state === PluginState.Installed) {
   *   // Cast to specific plugin type to access custom methods
   *   const recordingPlugin = entry.plugin as RecordingPlugin
   *   const recordings = recordingPlugin.getAllRecordings()
   * }
   * ```
   */
  get(pluginName: string): PluginEntry | undefined {
    return this.plugins.get(pluginName)
  }

  /**
   * Check if a plugin is registered
   *
   * Tests whether a plugin with the specified name exists in the plugin registry.
   * This does not indicate the plugin's state (it may be registered but not installed).
   *
   * @param pluginName - The name of the plugin to check. This is the value from
   *   plugin.metadata.name.
   *
   * @returns True if a plugin with the specified name is registered (in any state),
   *   false if no plugin with that name exists in the registry.
   *
   * @remarks
   * ## State Independence
   * This method only checks for registration, not operational state:
   * - Returns true for plugins in any state (Registered, Installing, Installed, Failed, etc.)
   * - Does not indicate whether the plugin is operational
   * - Use get() and check the state property if you need to verify operational status
   *
   * ## Common Patterns
   * This method is often used for:
   * - Checking if a plugin name is already taken before registration
   * - Conditional plugin registration (register only if not already present)
   * - Conditional plugin unregistration (unregister only if present)
   * - Feature detection (check if optional plugin is available)
   *
   * @example Check before registering
   * ```typescript
   * if (!pluginManager.has('recording')) {
   *   await pluginManager.register(recordingPlugin)
   * } else {
   *   console.log('Recording plugin already registered')
   * }
   * ```
   *
   * @example Check before unregistering
   * ```typescript
   * if (pluginManager.has('analytics')) {
   *   await pluginManager.unregister('analytics')
   * }
   * ```
   *
   * @example Feature detection
   * ```typescript
   * if (pluginManager.has('recording')) {
   *   console.log('Recording feature available')
   *   enableRecordingUI()
   * } else {
   *   console.log('Recording feature not available')
   *   disableRecordingUI()
   * }
   * ```
   */
  has(pluginName: string): boolean {
    return this.plugins.has(pluginName)
  }

  /**
   * Get all registered plugins
   *
   * Returns a copy of the plugin registry containing all registered plugins and their
   * entries. The returned map is a shallow copy, so modifications to the map itself
   * do not affect the internal registry.
   *
   * @returns A new Map containing all plugin entries, indexed by plugin name. Each entry
   *   contains the plugin instance, configuration, state, hook IDs, and other metadata.
   *   The map is empty if no plugins are registered.
   *
   * @remarks
   * ## Copy Semantics
   * This method returns a shallow copy of the internal plugins map:
   * - The Map itself is a new instance (modifications don't affect the registry)
   * - The PluginEntry objects are the same references (not deep cloned)
   * - Safe to iterate or modify the returned map without affecting the registry
   * - Modifications to entries themselves would affect the registry
   *
   * ## Iteration Patterns
   * The returned map can be iterated in several ways:
   * - `for (const [name, entry] of map)` - Iterate over entries
   * - `map.keys()` - Get all plugin names
   * - `map.values()` - Get all plugin entries
   * - `map.entries()` - Get name-entry pairs
   *
   * ## Use Cases
   * Common reasons to get all plugins:
   * - Display plugin status in UI or admin panel
   * - Generate plugin statistics or reports
   * - Iterate over plugins to perform batch operations
   * - Export plugin configuration
   * - Debug plugin state during development
   *
   * @example List all registered plugins
   * ```typescript
   * const plugins = pluginManager.getAll()
   * console.log(`Total plugins: ${plugins.size}`)
   *
   * for (const [name, entry] of plugins) {
   *   console.log(`${name}: ${entry.state}`)
   * }
   * ```
   *
   * @example Filter plugins by state
   * ```typescript
   * const allPlugins = pluginManager.getAll()
   * const installedPlugins = Array.from(allPlugins.values())
   *   .filter(entry => entry.state === PluginState.Installed)
   *
   * console.log(`Operational plugins: ${installedPlugins.length}`)
   * ```
   *
   * @example Generate plugin report
   * ```typescript
   * const plugins = pluginManager.getAll()
   * const report = Array.from(plugins.entries()).map(([name, entry]) => ({
   *   name,
   *   version: entry.plugin.metadata.version,
   *   state: entry.state,
   *   installedAt: entry.installedAt?.toISOString(),
   *   error: entry.error?.message
   * }))
   * console.table(report)
   * ```
   */
  getAll(): Map<string, PluginEntry> {
    return new Map(this.plugins)
  }

  /**
   * Update a plugin's configuration at runtime
   *
   * Merges the provided configuration with the plugin's existing configuration and optionally
   * calls the plugin's updateConfig() method if implemented. This allows plugins to adapt
   * their behavior dynamically based on configuration changes.
   *
   * @param pluginName - The name of the plugin to configure. Must be a registered plugin
   *   that exists in the plugin registry.
   * @param config - Partial or complete configuration object to merge with existing config.
   *   Properties not specified retain their current values. The configuration is shallow merged.
   *
   * @returns A promise that resolves when the configuration update completes. If the plugin
   *   implements updateConfig(), the promise resolves after that method completes.
   *
   * @throws {Error} If the plugin is not found in the registry
   * @throws {Error} If the plugin's updateConfig() method throws an error
   *
   * @remarks
   * ## Update Workflow
   * The configuration update process follows these steps:
   * 1. **Lookup**: Retrieves plugin entry from the registry
   * 2. **Config Merge**: Shallow merges new config with existing config
   * 3. **Plugin Notification**: Calls plugin.updateConfig(context, config) if method exists
   * 4. **Logging**: Logs the configuration update
   * 5. **Event Emission**: Emits 'plugin:configUpdated' event
   *
   * ## Configuration Merging
   * Configuration is merged using object spread:
   * ```typescript
   * entry.config = { ...entry.config, ...config }
   * ```
   * - Provided properties override existing values
   * - Missing properties retain current values
   * - Nested objects are not deep merged (shallow merge only)
   *
   * ## Plugin Notification
   * If the plugin implements the optional updateConfig() method:
   * - The method is called with the plugin context and merged configuration
   * - The plugin can react to configuration changes (restart services, update state, etc.)
   * - The method can be async or sync
   * - Any errors thrown are propagated to the caller
   *
   * ## Event Emissions
   * This method emits events on the event bus:
   * - `plugin:configUpdated`: Always emitted with { pluginName, config }
   * - Other plugins can listen for this event to react to configuration changes
   *
   * ## State Independence
   * This method works regardless of plugin state:
   * - Can update configuration of Registered, Installed, or Failed plugins
   * - For Registered plugins, config is updated but plugin is not installed
   * - For Installed plugins, plugin.updateConfig() is called if implemented
   * - For Failed plugins, config is updated but plugin remains Failed
   *
   * ## Common Use Cases
   * Configuration updates are commonly used for:
   * - Enabling or disabling plugin features at runtime
   * - Adjusting plugin parameters without restart
   * - Toggling auto-start behavior
   * - Updating thresholds or limits
   * - Changing plugin behavior based on user preferences
   *
   * @example Enable plugin feature at runtime
   * ```typescript
   * // Toggle auto-recording feature
   * await pluginManager.updateConfig('recording', {
   *   autoStart: true
   * })
   * // Only the autoStart property is updated, other config unchanged
   * ```
   *
   * @example Update multiple configuration properties
   * ```typescript
   * await pluginManager.updateConfig('recording', {
   *   autoStart: false,
   *   maxRecordings: 100,
   *   storeInIndexedDB: true
   * })
   * ```
   *
   * @example Handle configuration update errors
   * ```typescript
   * try {
   *   await pluginManager.updateConfig('my-plugin', { enabled: true })
   * } catch (error) {
   *   if (error.message.includes('not found')) {
   *     console.error('Plugin not registered')
   *   } else {
   *     console.error('Plugin rejected configuration:', error)
   *   }
   * }
   * ```
   *
   * @example Listen for configuration changes
   * ```typescript
   * eventBus.on('plugin:configUpdated', ({ pluginName, config }) => {
   *   console.log(`Plugin ${pluginName} config updated:`, config)
   *   // React to configuration changes
   * })
   * ```
   */
  async updateConfig<TConfig extends PluginConfig = PluginConfig>(
    pluginName: string,
    config: TConfig
  ): Promise<void> {
    const entry = this.plugins.get(pluginName)
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginName}`)
    }

    // Merge with existing config
    entry.config = { ...entry.config, ...config }

    // Call plugin's updateConfig if available
    if (entry.plugin.updateConfig) {
      const context = this.createContext(pluginName)
      await entry.plugin.updateConfig(context, entry.config as TConfig)
    }

    logger.info(`Plugin config updated: ${pluginName}`)

    // Emit event
    this.eventBus.emit('plugin:configUpdated', { pluginName, config: entry.config } as any)
  }

  /**
   * Execute all registered handlers for a specific hook
   *
   * Delegates to the HookManager to execute all handlers registered for the specified hook name.
   * Handlers are executed in the order they were registered, and their results are collected
   * and returned as an array.
   *
   * @param name - The name of the hook to execute. This corresponds to the hook names defined
   *   in the HookName type (e.g., 'beforeCall', 'callStarted', 'callEnded', etc.).
   * @param data - Optional data to pass to all hook handlers. The data structure should match
   *   the expected input type for the specific hook. Each handler receives the same data object.
   *
   * @returns A promise that resolves to an array of results returned by all hook handlers.
   *   The array maintains the same order as handler registration. If no handlers are registered
   *   for the hook, returns an empty array. Handlers that don't return a value contribute
   *   undefined to the results array.
   *
   * @remarks
   * ## Hook Execution Flow
   * When this method is called:
   * 1. HookManager looks up all handlers registered for the hook name
   * 2. Handlers are executed sequentially in registration order
   * 3. Each handler receives the provided data and the plugin context
   * 4. Results from all handlers are collected into an array
   * 5. The results array is returned to the caller
   *
   * ## Handler Context
   * Each hook handler is executed with:
   * - The data parameter passed to this method
   * - The current plugin context (with all VueSip services)
   * - Access to the logger, event bus, and other context properties
   *
   * ## Error Handling
   * Hook execution behavior depends on HookManager configuration:
   * - Errors in handlers may be caught or propagated (see HookManager docs)
   * - Failed handlers may stop execution or allow continuation
   * - Check HookManager documentation for specific error handling behavior
   *
   * ## Use Cases
   * This method is typically used by:
   * - VueSip core to notify plugins of lifecycle events
   * - Application code to trigger custom hooks
   * - Plugins to execute hooks for cross-plugin communication
   *
   * ## Type Parameters
   * - `TData`: The type of data passed to hook handlers
   * - `TReturn`: The type of value returned by hook handlers
   *
   * @example Execute a hook with data
   * ```typescript
   * // Notify all plugins that a call started
   * const results = await pluginManager.executeHook('callStarted', {
   *   callId: 'call-123',
   *   remoteParty: 'alice@example.com',
   *   direction: 'incoming'
   * })
   * console.log(`${results.length} handlers executed`)
   * ```
   *
   * @example Execute a hook without data
   * ```typescript
   * // Execute a hook that doesn't require data
   * await pluginManager.executeHook('applicationReady')
   * ```
   *
   * @example Process hook results
   * ```typescript
   * // Execute a hook and process results
   * const results = await pluginManager.executeHook('beforeCall', {
   *   targetUri: 'bob@example.com'
   * })
   *
   * // Check if any handler rejected the call
   * const rejected = results.some(result => result?.reject === true)
   * if (rejected) {
   *   console.log('Call rejected by plugin')
   *   return
   * }
   * ```
   */
  async executeHook<TData = any, TReturn = any>(name: HookName, data?: TData): Promise<TReturn[]> {
    return this.hookManager.execute<TData, TReturn>(name, data)
  }

  /**
   * Get the HookManager instance
   *
   * Returns the internal HookManager instance used by this PluginManager. This provides
   * direct access to advanced hook management functionality not exposed through the
   * PluginManager interface.
   *
   * @returns The HookManager instance used by this PluginManager for coordinating hook
   *   registration, execution, and lifecycle management.
   *
   * @remarks
   * ## Use Cases
   * Direct access to HookManager is useful for:
   * - Advanced hook management operations
   * - Accessing hook statistics and debugging information
   * - Direct hook manipulation (use with caution)
   * - Integration with other systems that work with HookManager
   *
   * ## Caution
   * Direct manipulation of the HookManager bypasses PluginManager's tracking:
   * - Hooks registered directly won't be tracked in plugin entries
   * - Hooks won't be automatically cleaned up on plugin unregistration
   * - Prefer using the plugin context's hooks interface for normal use cases
   *
   * ## Typical Usage
   * Most applications don't need direct HookManager access:
   * - Plugins register hooks through their context
   * - Application code executes hooks via executeHook()
   * - Only advanced scenarios require direct HookManager access
   *
   * @example Get hook statistics
   * ```typescript
   * const hookManager = pluginManager.getHookManager()
   * const stats = hookManager.getStats()
   * console.log('Total hooks:', stats.totalHooks)
   * console.log('Hooks by name:', stats.hooksByName)
   * ```
   *
   * @example Advanced hook operations
   * ```typescript
   * const hookManager = pluginManager.getHookManager()
   * // Perform advanced operations (use with caution)
   * // Most use cases should use plugin context instead
   * ```
   */
  getHookManager(): HookManager {
    return this.hookManager
  }

  /**
   * Check plugin version compatibility against the application version
   *
   * Validates that the plugin's version requirements (minVersion and maxVersion) are satisfied
   * by the current VueSip version. Throws an error if the version is incompatible.
   *
   * @param plugin - The plugin to check version compatibility for. The method examines the
   *   minVersion and maxVersion properties in plugin.metadata.
   *
   * @throws {Error} If the current VueSip version is less than plugin.metadata.minVersion
   * @throws {Error} If the current VueSip version is greater than plugin.metadata.maxVersion
   *
   * @internal
   *
   * @remarks
   * ## Version Comparison Algorithm
   * This method uses semantic versioning (semver) comparison via compareVersions():
   * - Versions are compared as MAJOR.MINOR.PATCH (e.g., '1.2.3')
   * - minVersion constraint is inclusive (>= minVersion)
   * - maxVersion constraint is inclusive (<= maxVersion)
   * - Both constraints are optional (undefined means no constraint)
   *
   * ## Version Constraints
   * Plugins can specify version requirements:
   * - **minVersion**: Minimum required VueSip version (undefined = no minimum)
   * - **maxVersion**: Maximum supported VueSip version (undefined = no maximum)
   * - Both constraints can be specified together for a version range
   *
   * ## Error Messages
   * Errors include detailed information for troubleshooting:
   * - Plugin name
   * - Required version constraint (minVersion or maxVersion)
   * - Current VueSip version
   * - Clear indication of which constraint was violated
   *
   * ## When Called
   * This method is called during plugin registration:
   * - Called early in the register() method
   * - Executed before dependency checking
   * - Prevents registration of incompatible plugins
   * - Provides clear error before any installation attempts
   *
   * @example Version compatibility checks
   * ```typescript
   * // Plugin requires VueSip >= 2.0.0
   * plugin.metadata.minVersion = '2.0.0'
   * // If current version is '1.5.0', throws:
   * // "Plugin example requires VueSip version >= 2.0.0 (current: 1.5.0)"
   *
   * // Plugin supports VueSip <= 3.0.0
   * plugin.metadata.maxVersion = '3.0.0'
   * // If current version is '3.1.0', throws:
   * // "Plugin example requires VueSip version <= 3.0.0 (current: 3.1.0)"
   *
   * // Plugin supports VueSip 2.0.0 - 3.0.0
   * plugin.metadata.minVersion = '2.0.0'
   * plugin.metadata.maxVersion = '3.0.0'
   * // Version must be in range, otherwise throws
   * ```
   */
  private checkVersionCompatibility(plugin: Plugin): void {
    const { minVersion, maxVersion } = plugin.metadata

    if (minVersion && this.compareVersions(this.version, minVersion) < 0) {
      throw new Error(
        `Plugin ${plugin.metadata.name} requires VueSip version >= ${minVersion} (current: ${this.version})`
      )
    }

    if (maxVersion && this.compareVersions(this.version, maxVersion) > 0) {
      throw new Error(
        `Plugin ${plugin.metadata.name} requires VueSip version <= ${maxVersion} (current: ${this.version})`
      )
    }
  }

  /**
   * Check that all plugin dependencies are satisfied
   *
   * Validates that all plugins listed in the dependencies array are registered and installed.
   * Throws an error if any dependency is missing or not in the Installed state.
   *
   * @param plugin - The plugin to check dependencies for. The method examines the dependencies
   *   array in plugin.metadata.
   *
   * @throws {Error} If any dependency plugin is not registered
   * @throws {Error} If any dependency plugin is not in the Installed state
   *
   * @internal
   *
   * @remarks
   * ## Dependency Validation
   * For each dependency in plugin.metadata.dependencies:
   * 1. Checks if the dependency plugin is registered
   * 2. Checks if the dependency plugin is in Installed state
   * 3. Throws an error if either check fails
   *
   * ## Dependency Requirements
   * Plugins can declare dependencies via plugin.metadata.dependencies:
   * - An array of plugin names (strings)
   * - Each name must match exactly (case-sensitive)
   * - Dependencies must be registered before the dependent plugin
   * - Dependencies must be in Installed state (not just Registered)
   * - Empty array or undefined means no dependencies
   *
   * ## State Requirements
   * Dependencies must be in the Installed state:
   * - Registered dependencies are not sufficient
   * - Installing, Uninstalling, or Failed states are rejected
   * - Ensures dependencies are fully operational before dependent plugin installs
   *
   * ## Error Messages
   * Errors include detailed information:
   * - Dependent plugin name
   * - Missing dependency name
   * - Whether dependency is missing or not installed
   * - Clear guidance for resolution
   *
   * ## When Called
   * This method is called during plugin registration:
   * - Called in the register() method
   * - Executed after version compatibility check
   * - Executed before plugin installation
   * - Prevents registration of plugins with unmet dependencies
   *
   * ## Circular Dependencies
   * This method does NOT detect circular dependencies:
   * - Plugin A can depend on B, and B on A (circular)
   * - Such configurations will fail at registration time
   * - Plugins must be designed to avoid circular dependencies
   * - Resolution order must be acyclic
   *
   * ## Registration Order
   * Dependencies must be registered in the correct order:
   * 1. Register base plugins (no dependencies)
   * 2. Register plugins that depend on base plugins
   * 3. Register plugins that depend on level-2 plugins
   * 4. Continue until all plugins are registered
   *
   * @example Dependency checking
   * ```typescript
   * // Plugin with dependencies
   * plugin.metadata.dependencies = ['auth', 'logging']
   *
   * // If 'auth' is not registered, throws:
   * // "Plugin analytics requires plugin: auth"
   *
   * // If 'logging' is Registered but not Installed, throws:
   * // "Plugin analytics requires plugin logging to be installed"
   * ```
   */
  private checkDependencies(plugin: Plugin): void {
    const { dependencies } = plugin.metadata

    if (!dependencies || dependencies.length === 0) {
      return
    }

    for (const dep of dependencies) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Plugin ${plugin.metadata.name} requires plugin: ${dep}`)
      }

      const depEntry = this.plugins.get(dep)
      if (depEntry && depEntry.state !== PluginState.Installed) {
        throw new Error(`Plugin ${plugin.metadata.name} requires plugin ${dep} to be installed`)
      }
    }
  }

  /**
   * Compare two semantic version strings
   *
   * Implements a simplified semantic versioning (semver) comparison algorithm that compares
   * version strings in MAJOR.MINOR.PATCH format. Returns a numeric comparison result.
   *
   * @param v1 - The first version string to compare (e.g., '1.2.3', '2.0.0')
   * @param v2 - The second version string to compare (e.g., '1.2.3', '2.0.0')
   *
   * @returns A number indicating the comparison result:
   *   - Returns -1 if v1 is less than v2 (v1 < v2)
   *   - Returns 0 if v1 equals v2 (v1 === v2)
   *   - Returns 1 if v1 is greater than v2 (v1 > v2)
   *
   * @internal
   *
   * @remarks
   * ## Version Format
   * Versions should follow semantic versioning format:
   * - Format: MAJOR.MINOR.PATCH (e.g., '1.0.0', '2.5.3')
   * - Each component is compared as a number
   * - Components are separated by dots
   * - Missing components are treated as 0
   *
   * ## Comparison Algorithm
   * The comparison is performed left-to-right:
   * 1. Split both versions by '.' into numeric parts
   * 2. Compare each part numerically (MAJOR, then MINOR, then PATCH)
   * 3. First non-equal comparison determines the result
   * 4. If all parts are equal, versions are equal
   * 5. Missing parts are treated as 0 (e.g., '1.2' = '1.2.0')
   *
   * ## Comparison Process
   * ```
   * Compare MAJOR:
   *   If different, return comparison result
   *   If same, continue to MINOR
   * Compare MINOR:
   *   If different, return comparison result
   *   If same, continue to PATCH
   * Compare PATCH:
   *   Return comparison result
   * ```
   *
   * ## Edge Cases
   * - **Missing components**: Treated as 0 ('1.2' === '1.2.0')
   * - **Extra components**: Compared normally ('1.2.3.4' compares first 3 parts, then 4th)
   * - **Non-numeric parts**: Converted to number via Number() (may produce NaN)
   * - **Empty versions**: ''.split('.') produces [''], which becomes [0]
   *
   * ## Limitations
   * This is a simplified semver implementation:
   * - Does not support prerelease versions (e.g., '1.0.0-alpha')
   * - Does not support build metadata (e.g., '1.0.0+build123')
   * - Does not validate version format
   * - Assumes well-formed version strings
   *
   * ## Use Cases
   * Used internally for:
   * - Plugin version compatibility checking
   * - Comparing application version against plugin requirements
   * - Determining if plugin minVersion/maxVersion constraints are met
   *
   * @example Version comparisons
   * ```typescript
   * compareVersions('1.0.0', '2.0.0')  // -1 (1.0.0 < 2.0.0)
   * compareVersions('2.0.0', '1.0.0')  // 1  (2.0.0 > 1.0.0)
   * compareVersions('1.2.3', '1.2.3')  // 0  (equal)
   * compareVersions('1.2.0', '1.2')    // 0  (equal, missing parts = 0)
   * compareVersions('1.2.3', '1.2.4')  // -1 (1.2.3 < 1.2.4)
   * compareVersions('1.3.0', '1.2.9')  // 1  (1.3.0 > 1.2.9, minor takes precedence)
   * ```
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0

      if (p1 < p2) return -1
      if (p1 > p2) return 1
    }

    return 0
  }

  /**
   * Destroy the plugin manager and clean up all resources
   *
   * Performs complete cleanup by unregistering all plugins, clearing all hooks, and freeing
   * all resources. This method should be called during application shutdown to ensure proper
   * cleanup and prevent resource leaks.
   *
   * @returns A promise that resolves when all plugins have been unregistered and all resources
   *   have been cleaned up. The promise always resolves, even if some plugins fail to unregister.
   *
   * @remarks
   * ## Destruction Process
   * The cleanup process follows these steps:
   * 1. **Collect Plugin Names**: Gets array of all registered plugin names
   * 2. **Unregister Plugins**: Iterates through plugins and unregisters each one
   * 3. **Error Handling**: Logs errors but continues with remaining plugins
   * 4. **Clear Hooks**: Calls hookManager.clear() to remove all hooks
   * 5. **Logging**: Logs completion of destruction
   *
   * ## Plugin Unregistration
   * For each registered plugin:
   * - Calls unregister() which triggers plugin's uninstall() method
   * - Removes all hooks registered by the plugin
   * - Deletes the plugin entry from the registry
   * - Continues even if individual plugins fail to unregister
   *
   * ## Error Handling Strategy
   * This method is designed to always complete:
   * - Errors during plugin unregistration are caught and logged
   * - Failed unregistrations don't prevent cleanup of other plugins
   * - Hook cleanup proceeds even if all plugins fail
   * - Promise always resolves (never rejects)
   * - Ensures cleanup can complete during emergency shutdown
   *
   * ## Hook Cleanup
   * After unregistering all plugins:
   * - Calls hookManager.clear() to remove any remaining hooks
   * - Removes hooks that weren't properly cleaned up by plugins
   * - Ensures complete hook cleanup even if plugins left orphaned hooks
   * - Resets hook manager to initial state
   *
   * ## State After Destruction
   * After this method completes:
   * - All plugins are unregistered (plugins Map is empty)
   * - All hooks are removed (HookManager is cleared)
   * - PluginManager instance can still be used (not truly destroyed)
   * - New plugins can be registered (PluginManager is reusable)
   * - VueSip service references remain (sipClient, mediaManager, etc.)
   *
   * ## Reusability
   * The PluginManager can be reused after destruction:
   * - The instance remains valid
   * - New plugins can be registered
   * - Hook system is reset and ready for new hooks
   * - Consider creating a new instance instead if full reset is needed
   *
   * ## Typical Usage
   * This method is typically called:
   * - During application shutdown
   * - When reinitializing the plugin system
   * - In test cleanup to ensure clean state
   * - Before destroying the entire VueSip instance
   *
   * @example Application shutdown
   * ```typescript
   * // During application shutdown
   * await pluginManager.destroy()
   * console.log('All plugins cleaned up')
   * // Safe to destroy other VueSip components
   * ```
   *
   * @example Graceful shutdown with timeout
   * ```typescript
   * // Shutdown with timeout fallback
   * const destroyPromise = pluginManager.destroy()
   * const timeoutPromise = new Promise(resolve =>
   *   setTimeout(() => {
   *     console.warn('Plugin cleanup timed out')
   *     resolve()
   *   }, 5000)
   * )
   * await Promise.race([destroyPromise, timeoutPromise])
   * ```
   *
   * @example Test cleanup
   * ```typescript
   * afterEach(async () => {
   *   // Clean up plugins after each test
   *   await pluginManager.destroy()
   * })
   * ```
   */
  async destroy(): Promise<void> {
    logger.info('Destroying PluginManager')

    // Uninstall all plugins
    const pluginNames = Array.from(this.plugins.keys())
    for (const name of pluginNames) {
      try {
        await this.unregister(name)
      } catch (error) {
        logger.error(`Error unregistering plugin ${name}`, error)
      }
    }

    // Clear hooks
    this.hookManager.clear()

    logger.info('PluginManager destroyed')
  }

  /**
   * Get comprehensive statistics about registered plugins and hooks
   *
   * Collects and returns detailed statistics about all registered plugins, including counts
   * by state and hook statistics from the HookManager. Useful for monitoring, debugging,
   * and displaying plugin system health.
   *
   * @returns An object containing comprehensive plugin statistics:
   *   - `totalPlugins`: Total number of registered plugins (all states)
   *   - `installedPlugins`: Number of plugins in Installed state (operational)
   *   - `failedPlugins`: Number of plugins in Failed state (non-operational)
   *   - `pluginsByState`: Breakdown of plugin counts by each PluginState
   *   - `hookStats`: Hook statistics from HookManager (total hooks, hooks by name, etc.)
   *
   * @remarks
   * ## Statistics Collection
   * This method iterates through all registered plugins and collects:
   * - Total count of plugins
   * - Count of installed (operational) plugins
   * - Count of failed (error) plugins
   * - Count of plugins in each lifecycle state
   * - Hook statistics from the HookManager
   *
   * ## Plugin State Breakdown
   * The `pluginsByState` object contains counts for each PluginState:
   * - `Registered`: Plugins registered but not installed
   * - `Installing`: Plugins currently being installed (usually 0)
   * - `Installed`: Plugins fully operational
   * - `Uninstalling`: Plugins currently being uninstalled (usually 0)
   * - `Failed`: Plugins that failed installation
   *
   * ## Hook Statistics
   * The `hookStats` object is obtained from HookManager.getStats() and typically includes:
   * - Total number of registered hooks
   * - Breakdown of hooks by hook name
   * - Other hook system metrics
   * - See HookManager documentation for complete details
   *
   * ## Performance Considerations
   * This method iterates through all plugins:
   * - O(n) complexity where n is the number of registered plugins
   * - Creates new objects for state counts (not cached)
   * - Safe to call frequently (not resource-intensive)
   * - Consider caching results if called very frequently
   *
   * ## Use Cases
   * Statistics are commonly used for:
   * - Displaying plugin status in admin UI
   * - Monitoring plugin system health
   * - Debugging plugin issues
   * - Generating system reports
   * - Logging system state during startup/shutdown
   * - Automated testing and verification
   *
   * ## Return Value Structure
   * ```typescript
   * {
   *   totalPlugins: number,
   *   installedPlugins: number,
   *   failedPlugins: number,
   *   pluginsByState: {
   *     Registered: number,
   *     Installing: number,
   *     Installed: number,
   *     Uninstalling: number,
   *     Failed: number
   *   },
   *   hookStats: {
   *     totalHooks: number,
   *     hooksByName: { [hookName: string]: number },
   *     // ... other hook stats
   *   }
   * }
   * ```
   *
   * @example Display plugin statistics
   * ```typescript
   * const stats = pluginManager.getStats()
   * console.log(`Total plugins: ${stats.totalPlugins}`)
   * console.log(`Operational: ${stats.installedPlugins}`)
   * console.log(`Failed: ${stats.failedPlugins}`)
   * console.log('State breakdown:', stats.pluginsByState)
   * console.log('Total hooks:', stats.hookStats.totalHooks)
   * ```
   *
   * @example Health check
   * ```typescript
   * const stats = pluginManager.getStats()
   * if (stats.failedPlugins > 0) {
   *   console.warn(`${stats.failedPlugins} plugin(s) failed to install`)
   *   // Investigate failed plugins
   *   const allPlugins = pluginManager.getAll()
   *   for (const [name, entry] of allPlugins) {
   *     if (entry.state === PluginState.Failed) {
   *       console.error(`Plugin ${name} failed:`, entry.error)
   *     }
   *   }
   * }
   * ```
   *
   * @example Generate status report
   * ```typescript
   * const stats = pluginManager.getStats()
   * console.log('Plugin System Status Report')
   * console.log('===========================')
   * console.log(`Total Plugins: ${stats.totalPlugins}`)
   * console.log(`Installed: ${stats.installedPlugins}`)
   * console.log(`Failed: ${stats.failedPlugins}`)
   * console.log(`Registered: ${stats.pluginsByState.Registered}`)
   * console.log(`Total Hooks: ${stats.hookStats.totalHooks}`)
   * ```
   *
   * @example Monitor plugin system
   * ```typescript
   * // Periodic health monitoring
   * setInterval(() => {
   *   const stats = pluginManager.getStats()
   *   if (stats.failedPlugins > 0 || stats.installedPlugins === 0) {
   *     console.warn('Plugin system health check failed:', stats)
   *   }
   * }, 60000) // Every minute
   * ```
   */
  getStats(): {
    totalPlugins: number
    installedPlugins: number
    failedPlugins: number
    pluginsByState: Record<PluginState, number>
    hookStats: ReturnType<HookManager['getStats']>
  } {
    let installedPlugins = 0
    let failedPlugins = 0
    const pluginsByState: Record<PluginState, number> = {
      [PluginState.Registered]: 0,
      [PluginState.Installing]: 0,
      [PluginState.Installed]: 0,
      [PluginState.Uninstalling]: 0,
      [PluginState.Failed]: 0,
    }

    for (const entry of this.plugins.values()) {
      pluginsByState[entry.state]++
      if (entry.state === PluginState.Installed) installedPlugins++
      if (entry.state === PluginState.Failed) failedPlugins++
    }

    return {
      totalPlugins: this.plugins.size,
      installedPlugins,
      failedPlugins,
      pluginsByState,
      hookStats: this.hookManager.getStats(),
    }
  }
}
