/**
 * Plugin Manager
 *
 * Manages plugin registration, installation, and lifecycle.
 * Coordinates between plugins and the hook system.
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
 * Plugin Manager
 *
 * Manages the registration, installation, and lifecycle of plugins.
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
   * Constructor
   *
   * @param eventBus - Event bus instance
   * @param version - Application version
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
   * Set the SIP client instance
   *
   * @param sipClient - SIP client
   */
  setSipClient(sipClient: SipClient | null): void {
    this.sipClient = sipClient
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Set the media manager instance
   *
   * @param mediaManager - Media manager
   */
  setMediaManager(mediaManager: MediaManager | null): void {
    this.mediaManager = mediaManager
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Set the SIP configuration
   *
   * @param config - SIP configuration
   */
  setConfig(config: SipClientConfig | null): void {
    this.config = config
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Set active calls map
   *
   * @param activeCalls - Active calls
   */
  setActiveCalls(activeCalls: Map<string, CallSession>): void {
    this.activeCalls = activeCalls
    this.hookManager.setContext(this.createContext())
  }

  /**
   * Create plugin context
   *
   * @param pluginName - Name of the plugin requesting context (optional, defaults to 'core')
   * @returns Plugin context
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
   * Register and install a plugin
   *
   * @param plugin - Plugin to register
   * @param config - Plugin configuration
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
   * Install a plugin
   *
   * @param pluginName - Plugin name
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
      this.eventBus.emit('plugin:installed', { pluginName, metadata: entry.plugin.metadata })
    } catch (error) {
      entry.state = PluginState.Failed
      entry.error = error instanceof Error ? error : new Error(String(error))

      logger.error(`Plugin installation failed: ${pluginName}`, error)

      // Emit error event
      this.eventBus.emit('plugin:error', { pluginName, error })

      throw error
    }
  }

  /**
   * Unregister and uninstall a plugin
   *
   * @param pluginName - Plugin name
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
      this.eventBus.emit('plugin:unregistered', { pluginName })
    }

    // Throw error after cleanup if uninstall failed
    if (uninstallError) {
      throw uninstallError
    }
  }

  /**
   * Get a registered plugin
   *
   * @param pluginName - Plugin name
   * @returns Plugin entry or undefined
   */
  get(pluginName: string): PluginEntry | undefined {
    return this.plugins.get(pluginName)
  }

  /**
   * Check if a plugin is registered
   *
   * @param pluginName - Plugin name
   * @returns True if registered
   */
  has(pluginName: string): boolean {
    return this.plugins.has(pluginName)
  }

  /**
   * Get all registered plugins
   *
   * @returns Map of plugin entries
   */
  getAll(): Map<string, PluginEntry> {
    return new Map(this.plugins)
  }

  /**
   * Update a plugin's configuration
   *
   * @param pluginName - Plugin name
   * @param config - New configuration
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
    this.eventBus.emit('plugin:configUpdated', { pluginName, config: entry.config })
  }

  /**
   * Execute a hook
   *
   * @param name - Hook name
   * @param data - Hook data
   * @returns Array of results
   */
  async executeHook<TData = any, TReturn = any>(name: HookName, data?: TData): Promise<TReturn[]> {
    return this.hookManager.execute<TData, TReturn>(name, data)
  }

  /**
   * Get hook manager instance
   *
   * @returns Hook manager
   */
  getHookManager(): HookManager {
    return this.hookManager
  }

  /**
   * Check version compatibility
   *
   * @param plugin - Plugin to check
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
   * Check plugin dependencies
   *
   * @param plugin - Plugin to check
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
   * Compare versions (simple semver)
   *
   * @param v1 - Version 1
   * @param v2 - Version 2
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
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
   * Destroy the plugin manager
   *
   * Uninstalls all plugins and cleans up resources.
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
   * Get statistics about registered plugins
   *
   * @returns Plugin statistics
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
