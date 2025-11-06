/**
 * Hook Manager
 *
 * Manages lifecycle hooks for the plugin system.
 * Provides registration, execution, and cleanup of hook handlers.
 */

import { createLogger } from '../utils/logger'
import {
  HookPriority,
  type HookName,
  type HookHandler,
  type HookOptions,
  type HookRegistration,
  type PluginContext,
} from '../types/plugin.types'

const logger = createLogger('HookManager')

/**
 * Hook Manager
 *
 * Manages the registration and execution of lifecycle hooks.
 */
export class HookManager {
  /** Map of hook name to array of registrations */
  private hooks: Map<HookName, HookRegistration[]> = new Map()

  /** Counter for generating unique hook IDs */
  private idCounter = 0

  /** Plugin context (set after construction) */
  private context: PluginContext | null = null

  /**
   * Set the plugin context
   *
   * @param context - Plugin context
   */
  setContext(context: PluginContext): void {
    this.context = context
  }

  /**
   * Register a hook handler
   *
   * @param name - Hook name
   * @param handler - Handler function
   * @param options - Hook options
   * @param pluginName - Name of plugin registering the hook
   * @returns Unique hook ID
   */
  register<TData = any, TReturn = any>(
    name: HookName,
    handler: HookHandler<TData, TReturn>,
    options: HookOptions = {},
    pluginName = 'core'
  ): string {
    const id = `hook-${this.idCounter++}`

    const registration: HookRegistration<TData, TReturn> = {
      name,
      handler,
      options: {
        priority: options.priority ?? HookPriority.Normal,
        once: options.once ?? false,
        condition: options.condition ?? (() => true),
      },
      pluginName,
      id,
    }

    // Get or create hook array
    const hooks = this.hooks.get(name) || []
    hooks.push(registration)

    // Sort by priority (highest first)
    hooks.sort((a, b) => b.options.priority - a.options.priority)

    this.hooks.set(name, hooks)

    logger.debug(
      `Hook registered: ${name} (ID: ${id}, Plugin: ${pluginName}, Priority: ${registration.options.priority})`
    )

    return id
  }

  /**
   * Unregister a hook handler by ID
   *
   * @param hookId - Hook ID
   * @returns True if hook was found and removed
   */
  unregister(hookId: string): boolean {
    for (const [name, hooks] of this.hooks.entries()) {
      const index = hooks.findIndex((h) => h.id === hookId)
      if (index !== -1) {
        hooks.splice(index, 1)
        if (hooks.length === 0) {
          this.hooks.delete(name)
        }
        logger.debug(`Hook unregistered: ${hookId}`)
        return true
      }
    }
    return false
  }

  /**
   * Unregister all hooks for a plugin
   *
   * @param pluginName - Plugin name
   * @returns Number of hooks removed
   */
  unregisterByPlugin(pluginName: string): number {
    let count = 0
    for (const [name, hooks] of this.hooks.entries()) {
      const filtered = hooks.filter((h) => h.pluginName !== pluginName)
      count += hooks.length - filtered.length
      if (filtered.length === 0) {
        this.hooks.delete(name)
      } else {
        this.hooks.set(name, filtered)
      }
    }
    if (count > 0) {
      logger.debug(`Unregistered ${count} hooks for plugin: ${pluginName}`)
    }
    return count
  }

  /**
   * Execute all handlers for a hook
   *
   * Handlers are executed in priority order.
   * If a handler returns false, execution stops.
   * If a handler has once=true, it is removed after execution.
   *
   * @param name - Hook name
   * @param data - Data to pass to handlers
   * @returns Array of results from handlers
   */
  async execute<TData = any, TReturn = any>(name: HookName, data?: TData): Promise<TReturn[]> {
    const hooks = this.hooks.get(name)
    if (!hooks || hooks.length === 0) {
      return []
    }

    if (!this.context) {
      logger.warn(`Hook execution before context set: ${name}`)
      return []
    }

    logger.debug(`Executing hook: ${name} (${hooks.length} handlers)`)

    const results: TReturn[] = []
    const toRemove: string[] = []

    for (const hook of hooks) {
      try {
        // Check condition with error handling
        try {
          if (hook.options.condition && !hook.options.condition(this.context, data)) {
            logger.debug(`Hook condition not met, skipping: ${hook.id}`)
            continue
          }
        } catch (conditionError) {
          logger.error(`Hook condition error: ${hook.id}`, conditionError)
          // Skip this hook but continue with others
          continue
        }

        // Execute handler
        const result = await hook.handler(this.context, data)

        // Store result
        results.push(result)

        // Mark for removal if once
        if (hook.options.once) {
          toRemove.push(hook.id)
        }

        // Stop propagation if handler returns false
        if (result === false) {
          logger.debug(`Hook returned false, stopping propagation: ${hook.id}`)
          break
        }
      } catch (error) {
        logger.error(`Hook handler error: ${hook.id}`, error)
        // Continue executing other hooks
      }
    }

    // Remove once handlers
    for (const id of toRemove) {
      this.unregister(id)
    }

    return results
  }

  /**
   * Get all registered hooks
   *
   * @returns Map of hook names to registrations
   */
  getAll(): Map<HookName, HookRegistration[]> {
    return new Map(this.hooks)
  }

  /**
   * Get hooks for a specific name
   *
   * @param name - Hook name
   * @returns Array of registrations
   */
  get(name: HookName): HookRegistration[] {
    return this.hooks.get(name) || []
  }

  /**
   * Check if a hook has handlers
   *
   * @param name - Hook name
   * @returns True if hook has handlers
   */
  has(name: HookName): boolean {
    const hooks = this.hooks.get(name)
    return hooks !== undefined && hooks.length > 0
  }

  /**
   * Get the number of handlers for a hook
   *
   * @param name - Hook name
   * @returns Number of handlers
   */
  count(name: HookName): number {
    return this.hooks.get(name)?.length || 0
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear()
    logger.debug('All hooks cleared')
  }

  /**
   * Get statistics about registered hooks
   *
   * @returns Hook statistics
   */
  getStats(): {
    totalHooks: number
    hookNames: string[]
    totalHandlers: number
    handlersByPlugin: Record<string, number>
  } {
    const hookNames = Array.from(this.hooks.keys())
    let totalHandlers = 0
    const handlersByPlugin: Record<string, number> = {}

    for (const hooks of this.hooks.values()) {
      totalHandlers += hooks.length
      for (const hook of hooks) {
        handlersByPlugin[hook.pluginName] = (handlersByPlugin[hook.pluginName] || 0) + 1
      }
    }

    return {
      totalHooks: this.hooks.size,
      hookNames,
      totalHandlers,
      handlersByPlugin,
    }
  }
}
