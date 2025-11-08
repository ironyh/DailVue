/**
 * Hook Manager for VueSip
 *
 * Provides comprehensive lifecycle hook management with priority-based execution ordering,
 * conditional execution, once-only handlers, propagation control, and automatic cleanup.
 * Enables plugins to observe and modify VueSip behavior at critical lifecycle points.
 *
 * @remarks
 * The HookManager is the core of VueSip's extensibility system, coordinating hook registration
 * from multiple plugins and executing them in a predictable, priority-based order. It manages
 * hook lifecycle from registration through execution to cleanup, ensuring proper coordination
 * between plugins and the VueSip core.
 *
 * ## Hook Priorities and Execution Order
 *
 * Hooks are executed in strict priority order, from highest to lowest priority:
 * - **Highest (1000)**: Runs first - use for critical pre-processing, validation, or blocking operations
 * - **High (500)**: Runs before normal - use for important setup or early intervention
 * - **Normal (0)**: Default priority - use for standard plugin operations
 * - **Low (-500)**: Runs after normal - use for post-processing or cleanup operations
 * - **Lowest (-1000)**: Runs last - use for final cleanup, logging, or auditing
 *
 * Within the same priority level, handlers execute in registration order (first registered, first executed).
 *
 * ## Priority-Based Handler Ordering
 *
 * When hooks are registered, they are automatically sorted by priority:
 * 1. Handlers with higher numeric priority values execute first
 * 2. Handlers with lower numeric priority values execute last
 * 3. Within the same priority, handlers execute in registration order
 * 4. Sorting occurs immediately on registration, not during execution
 * 5. This ensures consistent, predictable execution order across all hook invocations
 *
 * ## Hook Execution Workflow
 *
 * When a hook is executed via execute(), the following workflow occurs:
 *
 * 1. **Lookup**: Retrieve all handlers registered for the hook name
 * 2. **Context Check**: Verify plugin context is set (returns empty array if not)
 * 3. **Iteration**: Loop through handlers in priority order (highest to lowest)
 * 4. **Condition Evaluation**: For each handler, evaluate its condition function (if provided)
 *    - If condition returns false, skip the handler and continue to next
 *    - If condition throws error, log error, skip handler, and continue to next
 * 5. **Handler Execution**: Execute the handler with context and data
 *    - Handler receives: (context: PluginContext, data?: TData) => TReturn | Promise<TReturn>
 *    - Handler can perform async operations (execution waits for completion)
 *    - If handler throws error, log error and continue to next handler
 * 6. **Result Collection**: Store handler result in results array
 * 7. **Once Cleanup**: Mark once-only handlers for removal after execution
 * 8. **Propagation Check**: If handler returns false, stop execution (break loop)
 * 9. **Cleanup**: Remove all marked once-only handlers from registry
 * 10. **Return**: Return array of all collected results
 *
 * ## Condition Evaluation
 *
 * Handlers can specify a condition function that determines if they should execute:
 * - Condition signature: (context: PluginContext, data?: any) => boolean
 * - Evaluated before each handler execution
 * - If condition returns false, handler is skipped (not executed)
 * - If condition throws error, handler is skipped and error is logged
 * - Condition errors don't stop execution of other handlers
 * - Useful for context-dependent hooks (e.g., only run for incoming calls)
 *
 * ## Once-Only Handlers
 *
 * Handlers can be marked as once-only via options.once = true:
 * - Handler executes only once, then is automatically removed from registry
 * - Removal occurs after handler execution completes
 * - Useful for initialization hooks or one-time setup operations
 * - Once handlers are removed even if they throw errors
 * - Multiple once handlers in same execution are all removed together
 *
 * ## Propagation Stopping
 *
 * Handlers can stop propagation to subsequent handlers by returning false:
 * - When a handler returns exactly false (not falsy), execution stops
 * - No subsequent handlers are executed (even higher priority ones already ran)
 * - Results from executed handlers are still returned
 * - Useful for validation hooks that can block operations
 * - Example: A "beforeCall" hook that rejects the call prevents later hooks from running
 *
 * ## Error Handling in Hooks
 *
 * Hook execution is designed to be resilient to errors:
 * - **Handler Errors**: Caught, logged, and execution continues with next handler
 * - **Condition Errors**: Caught, logged, handler is skipped, execution continues
 * - **Context Not Set**: Execution returns empty array, warning is logged
 * - **No Handlers**: Execution returns empty array, no error
 * - Errors in one handler never prevent execution of other handlers
 * - All errors are logged with handler ID and hook name for debugging
 *
 * ## Hook Storage Structure
 *
 * Hooks are stored internally as a Map<HookName, HookRegistration[]>:
 * - Each hook name maps to an array of registrations
 * - Registrations include handler, options, plugin name, and unique ID
 * - Arrays are kept sorted by priority (highest first)
 * - Empty arrays are removed from the map to save memory
 * - Registration IDs are globally unique (incremented counter)
 *
 * ## Hook Cleanup
 *
 * Hooks can be cleaned up in several ways:
 * - **unregister(hookId)**: Remove specific hook by its unique ID
 * - **unregisterByPlugin(pluginName)**: Remove all hooks from a specific plugin
 * - **clear()**: Remove all hooks from all plugins (nuclear option)
 * - **Automatic**: Once-only handlers are removed after first execution
 * - Cleanup is automatic when plugins are unregistered via PluginManager
 *
 * @example Basic hook registration and execution
 * ```typescript
 * import { HookManager } from './plugins/HookManager'
 * import { HookPriority } from './types/plugin.types'
 *
 * const hookManager = new HookManager()
 * hookManager.setContext(pluginContext)
 *
 * // Register a normal priority hook
 * const hookId = hookManager.register(
 *   'beforeCall',
 *   async (context, data) => {
 *     console.log('Call about to start:', data.targetUri)
 *     // Can modify data or return false to block
 *     return true
 *   },
 *   { priority: HookPriority.Normal },
 *   'my-plugin'
 * )
 *
 * // Execute the hook
 * const results = await hookManager.execute('beforeCall', {
 *   targetUri: 'alice@example.com'
 * })
 * console.log('Hook results:', results)
 * ```
 *
 * @example Priority-based execution order
 * ```typescript
 * // Register hooks with different priorities
 * hookManager.register('callStarted', async (ctx, data) => {
 *   console.log('1. HIGHEST priority - runs first')
 *   return 'highest'
 * }, { priority: HookPriority.Highest }, 'plugin-1')
 *
 * hookManager.register('callStarted', async (ctx, data) => {
 *   console.log('2. HIGH priority - runs second')
 *   return 'high'
 * }, { priority: HookPriority.High }, 'plugin-2')
 *
 * hookManager.register('callStarted', async (ctx, data) => {
 *   console.log('3. NORMAL priority - runs third')
 *   return 'normal'
 * }, { priority: HookPriority.Normal }, 'plugin-3')
 *
 * hookManager.register('callStarted', async (ctx, data) => {
 *   console.log('4. LOW priority - runs fourth')
 *   return 'low'
 * }, { priority: HookPriority.Low }, 'plugin-4')
 *
 * hookManager.register('callStarted', async (ctx, data) => {
 *   console.log('5. LOWEST priority - runs last')
 *   return 'lowest'
 * }, { priority: HookPriority.Lowest }, 'plugin-5')
 *
 * // Execute - handlers run in priority order
 * const results = await hookManager.execute('callStarted', { callId: 'call-123' })
 * console.log(results) // ['highest', 'high', 'normal', 'low', 'lowest']
 * ```
 *
 * @example Conditional hook execution
 * ```typescript
 * // Hook that only runs for incoming calls
 * hookManager.register(
 *   'callStarted',
 *   async (context, data) => {
 *     console.log('Processing incoming call:', data.callId)
 *   },
 *   {
 *     priority: HookPriority.Normal,
 *     condition: (context, data) => data.direction === 'incoming'
 *   },
 *   'incoming-call-plugin'
 * )
 *
 * // This will execute the handler
 * await hookManager.execute('callStarted', {
 *   callId: 'call-1',
 *   direction: 'incoming'
 * })
 *
 * // This will skip the handler (condition not met)
 * await hookManager.execute('callStarted', {
 *   callId: 'call-2',
 *   direction: 'outgoing'
 * })
 * ```
 *
 * @example Once-only hook handlers
 * ```typescript
 * // Hook that runs only once (initialization)
 * hookManager.register(
 *   'callStarted',
 *   async (context, data) => {
 *     console.log('First call started - initializing analytics')
 *     await initializeAnalytics()
 *   },
 *   {
 *     priority: HookPriority.High,
 *     once: true  // Automatically removed after first execution
 *   },
 *   'analytics-plugin'
 * )
 *
 * // First execution - handler runs and is removed
 * await hookManager.execute('callStarted', { callId: 'call-1' })
 * console.log(hookManager.count('callStarted')) // 0 (handler was removed)
 *
 * // Second execution - handler doesn't run (already removed)
 * await hookManager.execute('callStarted', { callId: 'call-2' })
 * ```
 *
 * @example Stopping propagation with false return
 * ```typescript
 * // Validation hook that can block call
 * hookManager.register(
 *   'beforeCall',
 *   async (context, data) => {
 *     if (data.targetUri.includes('blocked.com')) {
 *       console.log('Call blocked by blacklist')
 *       return false  // Stop propagation, block call
 *     }
 *     return true
 *   },
 *   { priority: HookPriority.Highest },  // Run first for validation
 *   'blacklist-plugin'
 * )
 *
 * // This hook won't run if previous returned false
 * hookManager.register(
 *   'beforeCall',
 *   async (context, data) => {
 *     console.log('Call allowed, logging...')
 *   },
 *   { priority: HookPriority.Normal },
 *   'logging-plugin'
 * )
 *
 * // Execute - first hook blocks, second never runs
 * const results = await hookManager.execute('beforeCall', {
 *   targetUri: 'user@blocked.com'
 * })
 * console.log(results.length) // 1 (only first hook ran)
 * ```
 *
 * @example Error handling in hooks
 * ```typescript
 * // Hook that might throw error
 * hookManager.register('callStarted', async (context, data) => {
 *   throw new Error('Handler failed!')
 *   // Error is caught, logged, and execution continues
 * }, { priority: HookPriority.High }, 'faulty-plugin')
 *
 * // This hook still runs even though previous failed
 * hookManager.register('callStarted', async (context, data) => {
 *   console.log('This handler still executes!')
 *   return 'success'
 * }, { priority: HookPriority.Normal }, 'healthy-plugin')
 *
 * // Execute - first handler fails, second succeeds
 * const results = await hookManager.execute('callStarted', { callId: 'call-1' })
 * console.log(results) // ['success'] (failed handler didn't add result)
 * // Error is logged but doesn't prevent other handlers from running
 * ```
 *
 * @example Hook cleanup and management
 * ```typescript
 * // Register multiple hooks
 * const hookId1 = hookManager.register('callStarted', handler1, {}, 'plugin-1')
 * const hookId2 = hookManager.register('callStarted', handler2, {}, 'plugin-1')
 * const hookId3 = hookManager.register('callEnded', handler3, {}, 'plugin-2')
 *
 * // Remove specific hook
 * hookManager.unregister(hookId1)
 *
 * // Remove all hooks from plugin-1
 * const removed = hookManager.unregisterByPlugin('plugin-1')
 * console.log(`Removed ${removed} hooks`)
 *
 * // Check if hooks exist
 * console.log(hookManager.has('callEnded')) // true
 * console.log(hookManager.count('callEnded')) // 1
 *
 * // Get all hooks for inspection
 * const allHooks = hookManager.getAll()
 * for (const [name, registrations] of allHooks) {
 *   console.log(`${name}: ${registrations.length} handlers`)
 * }
 *
 * // Clear everything
 * hookManager.clear()
 * console.log(hookManager.count('callEnded')) // 0
 * ```
 *
 * @example Hook statistics and debugging
 * ```typescript
 * // Register various hooks
 * hookManager.register('beforeCall', handler1, {}, 'auth-plugin')
 * hookManager.register('beforeCall', handler2, {}, 'logging-plugin')
 * hookManager.register('callStarted', handler3, {}, 'recording-plugin')
 * hookManager.register('callEnded', handler4, {}, 'analytics-plugin')
 *
 * // Get comprehensive statistics
 * const stats = hookManager.getStats()
 * console.log('Total unique hooks:', stats.totalHooks) // 3
 * console.log('Hook names:', stats.hookNames) // ['beforeCall', 'callStarted', 'callEnded']
 * console.log('Total handlers:', stats.totalHandlers) // 4
 * console.log('Handlers by plugin:', stats.handlersByPlugin)
 * // {
 * //   'auth-plugin': 1,
 * //   'logging-plugin': 1,
 * //   'recording-plugin': 1,
 * //   'analytics-plugin': 1
 * // }
 *
 * // Get specific hook details
 * const beforeCallHooks = hookManager.get('beforeCall')
 * beforeCallHooks.forEach(hook => {
 *   console.log(`Hook ID: ${hook.id}, Plugin: ${hook.pluginName}, Priority: ${hook.options.priority}`)
 * })
 * ```
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
 * HookManager class
 *
 * Main manager class that implements centralized hook lifecycle management for VueSip.
 * Coordinates hook registration from multiple plugins, executes hooks in priority order,
 * manages conditional execution, handles once-only hooks, and provides hook cleanup.
 *
 * @remarks
 * This class serves as the central registry and orchestrator for all hooks in the VueSip ecosystem.
 * It maintains hook state, manages priority-based execution ordering, and ensures proper lifecycle
 * transitions from registration through execution to cleanup.
 *
 * ## Internal State Management
 *
 * The HookManager maintains several internal data structures:
 * - **hooks**: Map<HookName, HookRegistration[]> - Maps hook names to sorted arrays of registrations
 * - **idCounter**: number - Monotonically increasing counter for generating unique hook IDs
 * - **context**: PluginContext | null - Shared context passed to all hook handlers during execution
 *
 * ## Priority-Based Storage
 *
 * Hook registrations are stored in arrays sorted by priority:
 * - Arrays are sorted immediately upon registration (highest priority first)
 * - Sorting uses numeric comparison: higher values execute first
 * - Within same priority, registration order is preserved
 * - Sorted storage ensures O(n) execution time without sorting overhead
 *
 * ## Hook Registration Workflow
 *
 * When a hook is registered via register():
 * 1. Generate unique hook ID (hook-{counter})
 * 2. Create HookRegistration object with handler, options, plugin name, and ID
 * 3. Apply default values to options (priority: Normal, once: false, condition: () => true)
 * 4. Retrieve or create hook array for the hook name
 * 5. Add registration to array
 * 6. Sort array by priority (highest first)
 * 7. Store sorted array back in the map
 * 8. Log registration with details
 * 9. Return unique hook ID
 *
 * ## Context Management
 *
 * The plugin context is set via setContext() and provides:
 * - Access to VueSip services (sipClient, mediaManager, config, activeCalls)
 * - Event bus for plugin communication
 * - Logger for debug output
 * - Hooks interface for recursive hook registration
 * - Application version string
 *
 * ## Execution Context
 *
 * During hook execution, each handler receives:
 * - context: The PluginContext set via setContext()
 * - data: Optional data passed to execute()
 * - Handlers can access all VueSip services through context
 * - Handlers can be async (execution awaits completion)
 *
 * ## Memory Management
 *
 * The HookManager manages memory efficiently:
 * - Empty hook arrays are deleted from the map
 * - Once-only handlers are removed after execution
 * - Cleanup removes all handlers for a plugin
 * - Clear removes all hooks from the system
 *
 * @see {@link register} for hook registration workflow
 * @see {@link execute} for hook execution workflow
 * @see {@link unregisterByPlugin} for plugin cleanup workflow
 */
export class HookManager {
  /** Map of hook name to array of registrations */
  private hooks: Map<HookName, HookRegistration[]> = new Map()

  /** Counter for generating unique hook IDs */
  private idCounter = 0

  /** Plugin context (set after construction) */
  private context: PluginContext | null = null

  /**
   * Set the plugin context and make it available to all hook handlers
   *
   * Updates the PluginContext reference that will be passed to all hook handlers during
   * execution. This context provides hooks with access to VueSip services, event bus,
   * logger, and other application state. Should be called during initialization and
   * whenever the context needs to be updated with new service references.
   *
   * @param context - The PluginContext object to make available to all hook handlers.
   *   Contains references to VueSip services (sipClient, mediaManager, config, activeCalls),
   *   event bus for plugin communication, logger for debugging, hooks interface for hook
   *   registration, and application version string.
   *
   * @remarks
   * ## When to Call
   * This method should be called:
   * - During HookManager initialization (after construction)
   * - When VueSip services are initialized or updated (sipClient, mediaManager, etc.)
   * - Via PluginManager.createContext() whenever service references change
   * - Before executing any hooks (execution requires context to be set)
   *
   * ## Impact on Hook Execution
   * When this method is called:
   * - The context reference is updated immediately
   * - All subsequent hook executions receive the new context
   * - Already-registered hooks automatically see the updated context
   * - No need to re-register hooks when context changes
   *
   * ## Context Structure
   * The context typically includes:
   * - `eventBus`: EventBus instance for emitting and listening to events
   * - `sipClient`: SipClient instance (null if not yet initialized)
   * - `mediaManager`: MediaManager instance (null if not yet initialized)
   * - `config`: SipClientConfig object (null if not yet loaded)
   * - `activeCalls`: Map of active CallSession instances
   * - `hooks`: Hook registration and execution interface
   * - `logger`: Logger instance for debug output
   * - `version`: Application version string
   *
   * ## Service Availability
   * Services in the context may be null if not yet initialized:
   * - Hook handlers should check for null before accessing services
   * - Services are gradually populated as the application initializes
   * - Context is shared by reference (all hooks see the same instance)
   *
   * @example Set context during initialization
   * ```typescript
   * const hookManager = new HookManager()
   *
   * // Create initial context with available services
   * const context: PluginContext = {
   *   eventBus,
   *   sipClient: null,  // Not yet initialized
   *   mediaManager: null,  // Not yet initialized
   *   config: null,
   *   activeCalls: new Map(),
   *   hooks: hooksInterface,
   *   logger,
   *   version: '1.0.0'
   * }
   *
   * hookManager.setContext(context)
   * // Context is now available to all hook handlers
   * ```
   *
   * @example Update context when services become available
   * ```typescript
   * // Later, when SipClient is initialized
   * const updatedContext = {
   *   ...context,
   *   sipClient: newSipClient
   * }
   * hookManager.setContext(updatedContext)
   * // All hooks now have access to sipClient
   * ```
   */
  setContext(context: PluginContext): void {
    this.context = context
  }

  /**
   * Register a hook handler with priority-based execution ordering
   *
   * Registers a new hook handler for the specified hook name with configurable priority,
   * conditional execution, and once-only behavior. Handlers are automatically sorted by
   * priority (highest first) and executed in that order when the hook is triggered.
   *
   * @param name - The name of the hook to register the handler for. This corresponds to
   *   lifecycle events in VueSip (e.g., 'beforeCall', 'callStarted', 'callEnded').
   * @param handler - The handler function to execute when the hook is triggered. Receives
   *   the plugin context and optional data. Can be async. Signature:
   *   (context: PluginContext, data?: TData) => TReturn | Promise<TReturn>
   * @param options - Optional configuration for the hook handler:
   *   - `priority`: Execution priority (default: HookPriority.Normal = 0). Higher values run first.
   *   - `once`: If true, handler is removed after first execution (default: false)
   *   - `condition`: Function that determines if handler should execute (default: () => true)
   * @param pluginName - Name of the plugin registering this hook (default: 'core').
   *   Used for tracking and cleanup via unregisterByPlugin().
   *
   * @returns A unique hook ID string (format: 'hook-{number}') that can be used to
   *   unregister the specific handler via unregister(hookId).
   *
   * @remarks
   * ## Registration Workflow
   * When this method is called, the following steps occur:
   * 1. **ID Generation**: Generate unique hook ID using incrementing counter
   * 2. **Registration Creation**: Create HookRegistration object with handler, options, plugin name, and ID
   * 3. **Default Options**: Apply default values to missing options (priority: Normal, once: false, condition: () => true)
   * 4. **Array Retrieval**: Get existing hook array for this hook name, or create new empty array
   * 5. **Array Addition**: Add new registration to the array
   * 6. **Priority Sorting**: Sort array by priority (highest numeric value first)
   * 7. **Map Update**: Store sorted array back in the hooks map
   * 8. **Logging**: Log registration details (hook name, ID, plugin name, priority)
   * 9. **Return**: Return the unique hook ID to caller
   *
   * ## Hook Priorities
   * Priority determines execution order (highest to lowest):
   * - **Highest (1000)**: Runs first - critical pre-processing, validation, blocking operations
   * - **High (500)**: Runs before normal - important setup, early intervention
   * - **Normal (0)**: Default priority - standard plugin operations
   * - **Low (-500)**: Runs after normal - post-processing, cleanup
   * - **Lowest (-1000)**: Runs last - final cleanup, logging, auditing
   *
   * ## Priority Sorting Algorithm
   * Handlers are sorted using: (a, b) => b.options.priority - a.options.priority
   * - Descending numeric sort (highest priority first)
   * - Within same priority, registration order is preserved (stable sort)
   * - Sorting occurs immediately on registration, not during execution
   * - Ensures consistent execution order across all invocations
   *
   * ## Execution Order Guarantees
   * When hooks are executed:
   * 1. Higher priority handlers always execute before lower priority handlers
   * 2. Within same priority level, handlers execute in registration order (first registered, first executed)
   * 3. Order is deterministic and predictable
   * 4. New registrations are inserted in correct priority position
   *
   * ## Condition Evaluation Timing
   * If a condition function is provided:
   * - Evaluated immediately before handler execution (not at registration time)
   * - Receives current context and data at execution time
   * - If condition returns false, handler is skipped
   * - If condition throws error, handler is skipped and error is logged
   * - Allows dynamic, context-dependent hook execution
   *
   * ## Once Handler Cleanup
   * If options.once is true:
   * - Handler executes only once (on first trigger)
   * - After execution completes, handler is automatically removed from registry
   * - Removal occurs even if handler throws error
   * - Useful for initialization or one-time setup hooks
   * - ID becomes invalid after removal (unregister will return false)
   *
   * ## Handler Signature
   * The handler function signature:
   * ```typescript
   * async (context: PluginContext, data?: TData): Promise<TReturn> => {
   *   // Access VueSip services via context
   *   const { sipClient, mediaManager, config, activeCalls, eventBus } = context
   *
   *   // Process the hook data
   *   console.log('Hook triggered with data:', data)
   *
   *   // Return false to stop propagation, or any other value
   *   return someResult
   * }
   * ```
   *
   * ## Type Parameters
   * - `TData`: The type of data passed to the handler (from execute())
   * - `TReturn`: The type of value returned by the handler
   *
   * @example Register a basic hook with normal priority
   * ```typescript
   * const hookId = hookManager.register(
   *   'callStarted',
   *   async (context, data) => {
   *     console.log('Call started:', data.callId)
   *     // Handler logic here
   *   },
   *   { priority: HookPriority.Normal },
   *   'my-plugin'
   * )
   * // Returns: 'hook-0' (can be used to unregister later)
   * ```
   *
   * @example Register with high priority for early execution
   * ```typescript
   * // This handler runs before Normal priority handlers
   * hookManager.register(
   *   'beforeCall',
   *   async (context, data) => {
   *     // Validate call parameters
   *     if (!isValidUri(data.targetUri)) {
   *       return false  // Block the call
   *     }
   *     return true
   *   },
   *   { priority: HookPriority.High },  // Runs early for validation
   *   'validation-plugin'
   * )
   * ```
   *
   * @example Register with conditional execution
   * ```typescript
   * // Only runs for video calls
   * hookManager.register(
   *   'callStarted',
   *   async (context, data) => {
   *     console.log('Video call started')
   *     // Video-specific handling
   *   },
   *   {
   *     priority: HookPriority.Normal,
   *     condition: (context, data) => data.hasVideo === true
   *   },
   *   'video-plugin'
   * )
   * ```
   *
   * @example Register a once-only initialization hook
   * ```typescript
   * // Runs only on first call, then auto-removes
   * hookManager.register(
   *   'callStarted',
   *   async (context, data) => {
   *     console.log('First call - initializing resources')
   *     await initializeResources()
   *   },
   *   {
   *     priority: HookPriority.High,
   *     once: true  // Automatically removed after first execution
   *   },
   *   'init-plugin'
   * )
   * ```
   *
   * @example Demonstrate priority execution order
   * ```typescript
   * // Register handlers in random order with different priorities
   * hookManager.register('test', async () => {
   *   console.log('C: Normal priority')
   * }, { priority: HookPriority.Normal }, 'plugin-c')
   *
   * hookManager.register('test', async () => {
   *   console.log('A: Highest priority')
   * }, { priority: HookPriority.Highest }, 'plugin-a')
   *
   * hookManager.register('test', async () => {
   *   console.log('B: High priority')
   * }, { priority: HookPriority.High }, 'plugin-b')
   *
   * await hookManager.execute('test')
   * // Output:
   * // A: Highest priority
   * // B: High priority
   * // C: Normal priority
   * ```
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
   * Unregister a specific hook handler by its unique ID
   *
   * Removes a single hook handler from the registry using its unique ID returned from
   * register(). Useful for cleaning up individual hooks without affecting other handlers
   * or requiring knowledge of the hook name or plugin.
   *
   * @param hookId - The unique hook ID returned from register() (format: 'hook-{number}').
   *   Must be a valid ID from a currently registered hook.
   *
   * @returns True if the hook was found and successfully removed, false if the hook ID
   *   was not found in the registry (already removed or never existed).
   *
   * @remarks
   * ## Unregistration Workflow
   * When this method is called:
   * 1. **Iteration**: Loop through all hook names in the hooks map
   * 2. **Search**: For each hook name, search its array for matching hook ID
   * 3. **Removal**: If found, remove the hook from the array using splice()
   * 4. **Cleanup**: If array becomes empty after removal, delete the hook name from map
   * 5. **Logging**: Log the unregistration event with hook ID
   * 6. **Return**: Return true immediately if found, false if not found after searching all hooks
   *
   * ## Memory Cleanup
   * This method performs automatic memory cleanup:
   * - Removes the hook from its array (frees handler function reference)
   * - If array becomes empty, removes the hook name entry from the map
   * - Prevents memory leaks from orphaned hooks
   * - Helps maintain efficient map size
   *
   * ## Use Cases
   * Unregister by ID is useful when:
   * - You have the hook ID from registration
   * - You want to remove a specific hook instance
   * - You don't know which hook name the handler is registered under
   * - You're implementing conditional hook registration (register/unregister based on state)
   * - You're cleaning up individual hooks without affecting others
   *
   * ## Performance Characteristics
   * - Time complexity: O(n * m) where n is number of hook names, m is average handlers per name
   * - Searches all hooks until match is found
   * - Early return on first match (doesn't search remaining hooks)
   * - For frequent unregistration, consider using unregisterByPlugin() for batch removal
   *
   * ## Return Value Semantics
   * The return value indicates success:
   * - `true`: Hook was found and removed successfully
   * - `false`: Hook ID not found (may have been already removed or never existed)
   * - No error is thrown for invalid IDs (returns false instead)
   * - Idempotent: calling multiple times with same ID returns false after first call
   *
   * ## Comparison with Other Cleanup Methods
   * - **unregister(id)**: Remove specific hook by ID (this method)
   * - **unregisterByPlugin(name)**: Remove all hooks from a plugin (batch operation)
   * - **clear()**: Remove all hooks from all plugins (nuclear option)
   *
   * @example Unregister a specific hook
   * ```typescript
   * // Register a hook and save its ID
   * const hookId = hookManager.register(
   *   'callStarted',
   *   async (context, data) => {
   *     console.log('Handler called')
   *   },
   *   {},
   *   'my-plugin'
   * )
   *
   * // Later, remove the specific hook
   * const removed = hookManager.unregister(hookId)
   * console.log('Hook removed:', removed) // true
   *
   * // Trying to remove again returns false
   * const removedAgain = hookManager.unregister(hookId)
   * console.log('Hook removed again:', removedAgain) // false
   * ```
   *
   * @example Conditional hook cleanup
   * ```typescript
   * // Register temporary hook
   * const tempHookId = hookManager.register(
   *   'callStarted',
   *   async (context, data) => {
   *     if (someCondition) {
   *       // Do something
   *       // Then clean up this hook
   *       hookManager.unregister(tempHookId)
   *     }
   *   },
   *   {},
   *   'temp-plugin'
   * )
   * ```
   *
   * @example Track and cleanup multiple hooks
   * ```typescript
   * const hookIds: string[] = []
   *
   * // Register multiple hooks and track IDs
   * hookIds.push(hookManager.register('beforeCall', handler1, {}, 'plugin'))
   * hookIds.push(hookManager.register('callStarted', handler2, {}, 'plugin'))
   * hookIds.push(hookManager.register('callEnded', handler3, {}, 'plugin'))
   *
   * // Later, clean up all tracked hooks
   * hookIds.forEach(id => {
   *   const removed = hookManager.unregister(id)
   *   console.log(`Hook ${id} removed: ${removed}`)
   * })
   * ```
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
   * Unregister all hooks registered by a specific plugin
   *
   * Removes all hook handlers that were registered with the specified plugin name.
   * This is a batch operation that efficiently cleans up all hooks for a plugin
   * without requiring individual hook IDs. Typically called when a plugin is
   * uninstalled via PluginManager.unregister().
   *
   * @param pluginName - The name of the plugin whose hooks should be removed. This is
   *   the plugin name that was passed to register() when hooks were registered.
   *
   * @returns The total number of hooks that were removed across all hook names. Returns
   *   0 if no hooks were found for the specified plugin.
   *
   * @remarks
   * ## Unregistration Workflow
   * When this method is called:
   * 1. **Initialize Counter**: Set removed count to 0
   * 2. **Iterate Hooks**: Loop through all hook names in the hooks map
   * 3. **Filter Arrays**: For each hook name, filter out hooks matching the plugin name
   * 4. **Count Removed**: Calculate how many hooks were removed (original length - filtered length)
   * 5. **Update Map**: If filtered array is empty, delete hook name from map; otherwise update with filtered array
   * 6. **Accumulate**: Add removed count to total
   * 7. **Logging**: If any hooks were removed, log the total count with plugin name
   * 8. **Return**: Return total number of hooks removed
   *
   * ## Batch Removal Efficiency
   * This method is optimized for batch removal:
   * - Single pass through all hooks for the plugin
   * - Uses Array.filter() for efficient removal
   * - Automatically cleans up empty hook arrays
   * - More efficient than calling unregister() multiple times
   * - Single log message for entire batch operation
   *
   * ## Memory Cleanup
   * This method performs comprehensive memory cleanup:
   * - Removes all hook registrations for the plugin
   * - Deletes hook name entries that become empty
   * - Frees all handler function references
   * - Prevents memory leaks from orphaned plugin hooks
   * - Ensures complete cleanup when plugins are uninstalled
   *
   * ## When to Use
   * This method is typically used:
   * - Automatically by PluginManager when unregistering a plugin
   * - During plugin uninstallation to ensure complete cleanup
   * - When resetting a plugin's hooks without reinstalling
   * - During shutdown to clean up plugin hooks by name
   * - In tests to clean up plugin hooks between test cases
   *
   * ## Return Value Semantics
   * The return value indicates the scope of cleanup:
   * - `> 0`: Hooks were found and removed (number indicates how many)
   * - `0`: No hooks found for this plugin (may not have registered any, or already cleaned up)
   * - Never negative (count is always >= 0)
   * - Can be used to verify cleanup occurred
   *
   * ## Integration with PluginManager
   * This method is called automatically by PluginManager:
   * - Called in PluginManager.unregister() during plugin cleanup
   * - Ensures all plugin hooks are removed when plugin is uninstered
   * - Occurs in the finally block to guarantee cleanup even if uninstall() fails
   * - Plugin entry is deleted after hooks are cleaned up
   * - Prevents orphaned hooks from executing after plugin removal
   *
   * ## Comparison with Other Cleanup Methods
   * - **unregister(id)**: Remove specific hook by ID (single hook)
   * - **unregisterByPlugin(name)**: Remove all hooks from a plugin (this method - batch)
   * - **clear()**: Remove all hooks from all plugins (nuclear option)
   *
   * @example Unregister all hooks from a plugin
   * ```typescript
   * // Plugin registers multiple hooks
   * hookManager.register('beforeCall', handler1, {}, 'my-plugin')
   * hookManager.register('callStarted', handler2, {}, 'my-plugin')
   * hookManager.register('callEnded', handler3, {}, 'my-plugin')
   *
   * console.log('Total hooks:', hookManager.getStats().totalHandlers) // 3
   *
   * // Remove all hooks for the plugin
   * const removed = hookManager.unregisterByPlugin('my-plugin')
   * console.log('Removed hooks:', removed) // 3
   *
   * console.log('Total hooks:', hookManager.getStats().totalHandlers) // 0
   * ```
   *
   * @example Cleanup during plugin uninstall
   * ```typescript
   * async function uninstallPlugin(pluginName: string) {
   *   // Get plugin entry
   *   const entry = pluginManager.get(pluginName)
   *   if (!entry) return
   *
   *   try {
   *     // Call plugin's uninstall method
   *     await entry.plugin.uninstall?.(context)
   *   } finally {
   *     // Always clean up hooks, even if uninstall fails
   *     const removed = hookManager.unregisterByPlugin(pluginName)
   *     console.log(`Cleaned up ${removed} hooks for ${pluginName}`)
   *   }
   * }
   * ```
   *
   * @example Verify cleanup occurred
   * ```typescript
   * // Check if plugin has any hooks before cleanup
   * const statsBefore = hookManager.getStats()
   * const beforeCount = statsBefore.handlersByPlugin['analytics-plugin'] || 0
   * console.log('Hooks before cleanup:', beforeCount)
   *
   * // Clean up plugin hooks
   * const removed = hookManager.unregisterByPlugin('analytics-plugin')
   *
   * // Verify cleanup
   * const statsAfter = hookManager.getStats()
   * const afterCount = statsAfter.handlersByPlugin['analytics-plugin'] || 0
   * console.log('Hooks after cleanup:', afterCount) // 0
   * console.log('Cleanup successful:', removed === beforeCount)
   * ```
   *
   * @example Selective plugin cleanup
   * ```typescript
   * // Remove hooks from specific plugins while keeping others
   * const pluginsToCleanup = ['temp-plugin', 'debug-plugin', 'test-plugin']
   *
   * let totalRemoved = 0
   * for (const pluginName of pluginsToCleanup) {
   *   const removed = hookManager.unregisterByPlugin(pluginName)
   *   totalRemoved += removed
   *   console.log(`Removed ${removed} hooks from ${pluginName}`)
   * }
   *
   * console.log(`Total hooks removed: ${totalRemoved}`)
   * ```
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
   * Execute all registered handlers for a hook in priority order
   *
   * Executes all hook handlers registered for the specified hook name, following strict
   * priority ordering (highest to lowest), evaluating conditions, handling once-only hooks,
   * respecting propagation stopping, and collecting results. This is the primary method
   * for triggering hooks and coordinating plugin responses to lifecycle events.
   *
   * @param name - The name of the hook to execute. This corresponds to lifecycle events
   *   in VueSip (e.g., 'beforeCall', 'callStarted', 'callEnded', 'messageReceived').
   * @param data - Optional data to pass to all hook handlers. The data structure should
   *   match the expected input type for the specific hook. All handlers receive the same
   *   data object (shared by reference, handlers can mutate it).
   *
   * @returns A promise that resolves to an array of results returned by all executed handlers.
   *   The array maintains priority order (highest priority results first). Handlers that
   *   were skipped (condition failed) or threw errors don't contribute to the results array.
   *   Returns empty array if no handlers are registered or context is not set.
   *
   * @remarks
   * ## Execution Workflow
   * When this method is called, handlers execute through the following workflow:
   *
   * 1. **Lookup**: Retrieve all handlers registered for the hook name from the hooks map
   * 2. **Empty Check**: If no handlers found, return empty array immediately
   * 3. **Context Check**: If context is not set, log warning and return empty array
   * 4. **Logging**: Log execution start with hook name and handler count
   * 5. **Initialize**: Create empty results array and toRemove array for once handlers
   * 6. **Iteration**: Loop through handlers in priority order (highest to lowest)
   *
   * For each handler:
   * - **Condition Evaluation**:
   *   - If condition function exists, call it with (context, data)
   *   - If condition returns false, skip handler and continue to next
   *   - If condition throws error, log error, skip handler, continue to next
   * - **Handler Execution**:
   *   - Call handler with (context, data)
   *   - Await async handlers (execution waits for completion)
   *   - If handler throws error, log error and continue to next handler
   * - **Result Collection**: Store handler result in results array
   * - **Once Marking**: If handler has once=true, add hook ID to toRemove array
   * - **Propagation Check**: If result === false (strict equality), break loop (stop execution)
   *
   * 7. **Cleanup**: Remove all hook IDs in toRemove array via unregister()
   * 8. **Return**: Return results array to caller
   *
   * ## Hook Priority and Execution Order
   *
   * Handlers execute in strict priority order:
   * - **Highest (1000)** → **High (500)** → **Normal (0)** → **Low (-500)** → **Lowest (-1000)**
   * - Higher numeric priority values execute first
   * - Within same priority, registration order is preserved (first registered, first executed)
   * - Priority is set during registration and cannot be changed
   * - Arrays are pre-sorted by priority, ensuring O(n) execution time
   *
   * ## Condition Evaluation Details
   *
   * Conditions provide dynamic, context-dependent execution:
   * - **Timing**: Evaluated immediately before each handler execution (not at registration)
   * - **Signature**: (context: PluginContext, data?: TData) => boolean
   * - **True Return**: Handler executes normally
   * - **False Return**: Handler is skipped, execution continues with next handler
   * - **Error Thrown**: Handler is skipped, error is logged, execution continues
   * - **Use Cases**: Direction filtering (incoming/outgoing), state checks, feature flags
   *
   * ## Once Handler Cleanup Mechanism
   *
   * Once-only handlers are automatically cleaned up:
   * - **Marking**: During execution, once handlers' IDs are added to toRemove array
   * - **Timing**: Removal occurs after all handlers execute (not immediately after individual handler)
   * - **Method**: Uses unregister(hookId) for each marked ID
   * - **Guarantee**: Removal occurs even if handler throws error
   * - **Batch**: Multiple once handlers are removed together after execution completes
   * - **Purpose**: Initialization hooks, one-time setup, feature detection
   *
   * ## Propagation Stopping (return false)
   *
   * Handlers can halt execution by returning false:
   * - **Detection**: Uses strict equality (result === false), not falsy check
   * - **Effect**: Immediately stops iteration, no subsequent handlers execute
   * - **Results**: Already-executed handlers' results are included in returned array
   * - **Logging**: Logs which handler stopped propagation with its hook ID
   * - **Use Cases**: Validation hooks blocking operations, access control, cancellation
   * - **Note**: Higher priority handlers have already executed (can't be stopped retroactively)
   *
   * ## Error Handling Strategies
   *
   * Execution is resilient to errors at multiple levels:
   *
   * **Condition Errors**:
   * - Caught in inner try-catch within condition evaluation
   * - Logged with error message: "Hook condition error: {hookId}"
   * - Handler is skipped (continues to next handler)
   * - Does not stop execution of other handlers
   *
   * **Handler Errors**:
   * - Caught in outer try-catch around handler execution
   * - Logged with error message: "Hook handler error: {hookId}"
   * - Handler result is not added to results array
   * - Does not stop execution of other handlers
   *
   * **Context Not Set**:
   * - Checked before execution begins
   * - Logs warning: "Hook execution before context set: {hookName}"
   * - Returns empty array immediately
   * - No handlers are executed
   *
   * **No Handlers Registered**:
   * - Returns empty array immediately
   * - No warning or error (normal case)
   * - Minimal performance overhead
   *
   * ## Performance Characteristics
   *
   * Execution performance:
   * - **Time Complexity**: O(n) where n is number of registered handlers for the hook
   * - **No Sorting Overhead**: Arrays are pre-sorted at registration time
   * - **Early Termination**: Stops if handler returns false (can reduce iterations)
   * - **Async Handling**: Sequential execution with await (handlers run one at a time)
   * - **Memory**: Results array grows with number of successful handler executions
   *
   * ## Type Parameters
   * - `TData`: The type of data passed to all hook handlers
   * - `TReturn`: The type of value returned by hook handlers
   *
   * @example Basic hook execution
   * ```typescript
   * // Execute a hook with data
   * const results = await hookManager.execute('callStarted', {
   *   callId: 'call-123',
   *   direction: 'incoming',
   *   remoteParty: 'alice@example.com'
   * })
   *
   * console.log(`${results.length} handlers executed`)
   * console.log('Results:', results)
   * ```
   *
   * @example Priority-based execution order
   * ```typescript
   * // Handlers execute in priority order regardless of registration order
   * hookManager.register('test', async () => {
   *   console.log('3rd: Normal priority')
   *   return 'normal'
   * }, { priority: HookPriority.Normal }, 'plugin-c')
   *
   * hookManager.register('test', async () => {
   *   console.log('1st: Highest priority')
   *   return 'highest'
   * }, { priority: HookPriority.Highest }, 'plugin-a')
   *
   * hookManager.register('test', async () => {
   *   console.log('2nd: High priority')
   *   return 'high'
   * }, { priority: HookPriority.High }, 'plugin-b')
   *
   * const results = await hookManager.execute('test')
   * console.log(results) // ['highest', 'high', 'normal']
   * // Output demonstrates priority ordering
   * ```
   *
   * @example Stopping propagation with false return
   * ```typescript
   * // First handler blocks execution
   * hookManager.register('beforeCall', async (ctx, data) => {
   *   if (data.targetUri.includes('blocked.com')) {
   *     console.log('Call blocked by validation')
   *     return false  // Stop execution
   *   }
   *   return true
   * }, { priority: HookPriority.Highest }, 'validator')
   *
   * // This won't run if previous handler returned false
   * hookManager.register('beforeCall', async (ctx, data) => {
   *   console.log('Logging allowed call')
   * }, { priority: HookPriority.Normal }, 'logger')
   *
   * const results = await hookManager.execute('beforeCall', {
   *   targetUri: 'user@blocked.com'
   * })
   * console.log(results) // [false] - only first handler ran
   * // "Logging allowed call" is NOT printed
   * ```
   *
   * @example Conditional execution filtering
   * ```typescript
   * // Handler that only runs for video calls
   * hookManager.register('callStarted', async (ctx, data) => {
   *   console.log('Video call handling')
   *   return 'video'
   * }, {
   *   priority: HookPriority.Normal,
   *   condition: (ctx, data) => data.hasVideo === true
   * }, 'video-plugin')
   *
   * // Execute with video call - handler runs
   * let results = await hookManager.execute('callStarted', {
   *   callId: 'call-1',
   *   hasVideo: true
   * })
   * console.log(results) // ['video']
   *
   * // Execute without video - handler is skipped
   * results = await hookManager.execute('callStarted', {
   *   callId: 'call-2',
   *   hasVideo: false
   * })
   * console.log(results) // [] (handler skipped)
   * ```
   *
   * @example Once-only handler automatic cleanup
   * ```typescript
   * // Handler runs only once then auto-removes
   * hookManager.register('callStarted', async (ctx, data) => {
   *   console.log('First call initialization')
   *   await initializeResources()
   *   return 'initialized'
   * }, {
   *   priority: HookPriority.High,
   *   once: true
   * }, 'init-plugin')
   *
   * console.log('Before:', hookManager.count('callStarted')) // 1
   *
   * // First execution - handler runs and is removed
   * let results = await hookManager.execute('callStarted', { callId: 'call-1' })
   * console.log('First results:', results) // ['initialized']
   * console.log('After:', hookManager.count('callStarted')) // 0
   *
   * // Second execution - handler doesn't exist anymore
   * results = await hookManager.execute('callStarted', { callId: 'call-2' })
   * console.log('Second results:', results) // []
   * ```
   *
   * @example Error handling resilience
   * ```typescript
   * // Handler that throws error
   * hookManager.register('callStarted', async () => {
   *   throw new Error('Handler 1 failed')
   *   // Error is caught and logged, execution continues
   * }, { priority: HookPriority.High }, 'faulty-plugin')
   *
   * // This handler still runs
   * hookManager.register('callStarted', async () => {
   *   console.log('Handler 2 executing')
   *   return 'success'
   * }, { priority: HookPriority.Normal }, 'healthy-plugin')
   *
   * const results = await hookManager.execute('callStarted', { callId: 'call-1' })
   * console.log('Results:', results) // ['success']
   * // Handler 2 ran successfully despite Handler 1 throwing error
   * // Error is logged but doesn't prevent other handlers from running
   * ```
   *
   * @example Processing hook results
   * ```typescript
   * // Multiple handlers return different data
   * hookManager.register('dataValidation', async (ctx, data) => {
   *   return { validator: 'schema', valid: true }
   * }, { priority: HookPriority.High }, 'schema-validator')
   *
   * hookManager.register('dataValidation', async (ctx, data) => {
   *   return { validator: 'business-rules', valid: true }
   * }, { priority: HookPriority.Normal }, 'business-validator')
   *
   * const results = await hookManager.execute('dataValidation', { value: 123 })
   *
   * // Process all validation results
   * const allValid = results.every(r => r.valid)
   * console.log('All validations passed:', allValid)
   *
   * // Check specific validator
   * const schemaResult = results.find(r => r.validator === 'schema')
   * console.log('Schema validation:', schemaResult)
   * ```
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
   * Get all registered hooks with their handlers
   *
   * Returns a copy of the internal hooks map containing all registered hook names and
   * their associated handler registrations. The returned map is a shallow copy, so
   * modifications to the map itself don't affect the internal registry.
   *
   * @returns A new Map containing all hook registrations, indexed by hook name. Each entry
   *   contains an array of HookRegistration objects sorted by priority (highest first).
   *   The map is empty if no hooks are registered.
   *
   * @remarks
   * ## Copy Semantics
   * This method returns a shallow copy of the internal hooks map:
   * - The Map itself is a new instance (modifications don't affect the registry)
   * - The HookRegistration arrays are the same references (not deep cloned)
   * - Safe to iterate or modify the returned map without affecting the registry
   * - Modifications to arrays or registrations would affect the registry
   *
   * ## Use Cases
   * Getting all hooks is useful for:
   * - Inspecting registered hooks for debugging
   * - Generating hook statistics or reports
   * - Implementing hook visualization or admin UI
   * - Testing hook registration
   * - Auditing plugin hook usage
   *
   * @example Inspect all registered hooks
   * ```typescript
   * const allHooks = hookManager.getAll()
   *
   * for (const [hookName, registrations] of allHooks) {
   *   console.log(`Hook: ${hookName}`)
   *   console.log(`  Handlers: ${registrations.length}`)
   *   registrations.forEach(reg => {
   *     console.log(`    - ${reg.pluginName} (priority: ${reg.options.priority})`)
   *   })
   * }
   * ```
   */
  getAll(): Map<HookName, HookRegistration[]> {
    return new Map(this.hooks)
  }

  /**
   * Get all handler registrations for a specific hook name
   *
   * Retrieves the array of hook handlers registered for the specified hook name,
   * sorted by priority (highest first). Returns an empty array if no handlers are
   * registered for the hook.
   *
   * @param name - The name of the hook to retrieve handlers for (e.g., 'beforeCall',
   *   'callStarted', 'callEnded').
   *
   * @returns An array of HookRegistration objects for the specified hook, sorted by
   *   priority (highest first). Returns empty array if no handlers are registered.
   *   The array contains the actual registration objects (not a copy).
   *
   * @remarks
   * ## Array Structure
   * The returned array contains HookRegistration objects with:
   * - `name`: The hook name (same as the parameter)
   * - `handler`: The handler function
   * - `options`: Hook options (priority, once, condition)
   * - `pluginName`: Name of the plugin that registered the hook
   * - `id`: Unique hook ID
   *
   * ## Priority Ordering
   * The array is sorted by priority:
   * - Highest priority handlers appear first in the array
   * - Within same priority, registration order is preserved
   * - Array is already sorted (no need to sort on retrieval)
   *
   * ## Use Cases
   * Getting hooks for a specific name is useful for:
   * - Inspecting which plugins registered handlers for a hook
   * - Checking handler priorities before execution
   * - Debugging hook execution order
   * - Verifying hook registration in tests
   * - Generating hook-specific reports
   *
   * @example Inspect handlers for a specific hook
   * ```typescript
   * const handlers = hookManager.get('callStarted')
   *
   * console.log(`${handlers.length} handlers registered for 'callStarted'`)
   * handlers.forEach((registration, index) => {
   *   console.log(`${index + 1}. ${registration.pluginName}`)
   *   console.log(`   Priority: ${registration.options.priority}`)
   *   console.log(`   Once: ${registration.options.once}`)
   *   console.log(`   ID: ${registration.id}`)
   * })
   * ```
   */
  get(name: HookName): HookRegistration[] {
    return this.hooks.get(name) || []
  }

  /**
   * Check if a hook has any registered handlers
   *
   * Tests whether any handlers are registered for the specified hook name. Returns
   * true if at least one handler exists, false if no handlers are registered.
   *
   * @param name - The name of the hook to check (e.g., 'beforeCall', 'callStarted').
   *
   * @returns True if one or more handlers are registered for the hook, false if no
   *   handlers are registered or the hook doesn't exist in the registry.
   *
   * @remarks
   * ## Use Cases
   * Checking for hook handlers is useful for:
   * - Conditional hook execution (skip if no handlers)
   * - Optimization (avoid execution overhead if no handlers)
   * - Feature detection (check if plugins provide functionality)
   * - Debugging (verify hooks are registered)
   * - Testing (assert hooks are registered correctly)
   *
   * ## Performance
   * This is a fast O(1) operation:
   * - Map lookup is O(1)
   * - Array length check is O(1)
   * - No iteration through handlers
   *
   * @example Conditional hook execution
   * ```typescript
   * if (hookManager.has('beforeCall')) {
   *   // Only execute if handlers are registered
   *   const results = await hookManager.execute('beforeCall', callData)
   *   // Process results...
   * } else {
   *   console.log('No beforeCall handlers registered, skipping')
   * }
   * ```
   *
   * @example Feature detection
   * ```typescript
   * const hasRecordingHooks = hookManager.has('recordingStarted')
   * if (hasRecordingHooks) {
   *   console.log('Recording plugin is installed')
   *   enableRecordingUI()
   * }
   * ```
   */
  has(name: HookName): boolean {
    const hooks = this.hooks.get(name)
    return hooks !== undefined && hooks.length > 0
  }

  /**
   * Get the number of handlers registered for a hook
   *
   * Returns the count of handlers registered for the specified hook name. This is
   * the number of handlers that would execute if the hook is triggered (subject to
   * conditions and propagation stopping).
   *
   * @param name - The name of the hook to count handlers for (e.g., 'beforeCall').
   *
   * @returns The number of handlers registered for the hook. Returns 0 if no handlers
   *   are registered or the hook doesn't exist in the registry.
   *
   * @remarks
   * ## Use Cases
   * Counting hook handlers is useful for:
   * - Monitoring hook registration
   * - Generating statistics
   * - Testing (verify expected number of handlers)
   * - Debugging (check handler count)
   * - Performance analysis (identify hooks with many handlers)
   *
   * ## Performance
   * This is a fast O(1) operation:
   * - Map lookup is O(1)
   * - Array length property is O(1)
   * - No iteration required
   *
   * @example Monitor hook handler counts
   * ```typescript
   * console.log('beforeCall handlers:', hookManager.count('beforeCall'))
   * console.log('callStarted handlers:', hookManager.count('callStarted'))
   * console.log('callEnded handlers:', hookManager.count('callEnded'))
   * ```
   *
   * @example Verify hook registration in tests
   * ```typescript
   * // Register hooks
   * hookManager.register('testHook', handler1, {}, 'plugin-1')
   * hookManager.register('testHook', handler2, {}, 'plugin-2')
   *
   * // Verify count
   * expect(hookManager.count('testHook')).toBe(2)
   * ```
   */
  count(name: HookName): number {
    return this.hooks.get(name)?.length || 0
  }

  /**
   * Clear all registered hooks from all plugins
   *
   * Removes all hook handlers from the registry, effectively resetting the HookManager
   * to its initial empty state. This is a nuclear option that removes all hooks regardless
   * of which plugin registered them. Use with caution as it cannot be undone.
   *
   * @remarks
   * ## Cleanup Process
   * When this method is called:
   * - All hook name entries are removed from the map
   * - All handler references are released for garbage collection
   * - The hooks map becomes empty
   * - Hook ID counter is NOT reset (IDs continue from last value)
   * - Context reference is NOT cleared (remains set)
   *
   * ## When to Use
   * This method is typically used:
   * - During application shutdown
   * - When resetting the entire plugin system
   * - In test cleanup between test cases
   * - When reinitializing the HookManager
   * - As part of PluginManager.destroy()
   *
   * ## Caution
   * This operation is destructive and irreversible:
   * - All registered hooks are permanently removed
   * - Plugins are not notified (no uninstall callbacks)
   * - Cannot selectively preserve some hooks
   * - Consider using unregisterByPlugin() for selective cleanup
   *
   * ## Comparison with Other Cleanup Methods
   * - **unregister(id)**: Remove specific hook by ID (surgical)
   * - **unregisterByPlugin(name)**: Remove all hooks from a plugin (selective)
   * - **clear()**: Remove all hooks from all plugins (this method - nuclear)
   *
   * @example Clear all hooks during shutdown
   * ```typescript
   * // Application shutdown
   * console.log('Shutting down, clearing all hooks')
   * hookManager.clear()
   * console.log('All hooks cleared')
   * ```
   *
   * @example Test cleanup
   * ```typescript
   * afterEach(() => {
   *   // Clean up hooks after each test
   *   hookManager.clear()
   *   // Ensure clean state for next test
   * })
   * ```
   *
   * @example Complete reset
   * ```typescript
   * // Reset entire hook system
   * hookManager.clear()
   * console.log('Hook count:', hookManager.getStats().totalHooks) // 0
   * // Ready to register new hooks
   * ```
   */
  clear(): void {
    this.hooks.clear()
    logger.debug('All hooks cleared')
  }

  /**
   * Get comprehensive statistics about registered hooks
   *
   * Collects and returns detailed statistics about all registered hooks, including
   * total counts, hook names, total handlers, and breakdown of handlers by plugin.
   * Useful for monitoring, debugging, and displaying hook system health.
   *
   * @returns An object containing comprehensive hook statistics:
   *   - `totalHooks`: Total number of unique hook names that have handlers
   *   - `hookNames`: Array of all hook names with registered handlers
   *   - `totalHandlers`: Total count of all registered handlers across all hooks
   *   - `handlersByPlugin`: Object mapping plugin names to their handler counts
   *
   * @remarks
   * ## Statistics Collection
   * This method iterates through all hooks and collects:
   * - Count of unique hook names with handlers
   * - List of all hook names
   * - Total count of handlers across all hooks
   * - Breakdown showing how many handlers each plugin registered
   *
   * ## Return Value Structure
   * ```typescript
   * {
   *   totalHooks: number,        // Unique hook names with handlers
   *   hookNames: string[],       // Array of hook names
   *   totalHandlers: number,     // Total handler count
   *   handlersByPlugin: {        // Handlers per plugin
   *     'plugin-name': number
   *   }
   * }
   * ```
   *
   * ## Use Cases
   * Statistics are commonly used for:
   * - Monitoring hook system health
   * - Debugging hook registration issues
   * - Generating system reports
   * - Displaying hook status in admin UI
   * - Performance analysis
   * - Testing hook registration
   *
   * ## Performance
   * - Time complexity: O(n * m) where n is hook names, m is average handlers per hook
   * - Creates new arrays and objects (not cached)
   * - Safe to call frequently (not resource-intensive for typical loads)
   *
   * @example Display hook statistics
   * ```typescript
   * const stats = hookManager.getStats()
   *
   * console.log('Hook System Statistics:')
   * console.log(`  Unique hooks: ${stats.totalHooks}`)
   * console.log(`  Total handlers: ${stats.totalHandlers}`)
   * console.log(`  Hook names: ${stats.hookNames.join(', ')}`)
   * console.log('  Handlers by plugin:')
   * for (const [plugin, count] of Object.entries(stats.handlersByPlugin)) {
   *   console.log(`    ${plugin}: ${count}`)
   * }
   * ```
   *
   * @example Monitor hook system health
   * ```typescript
   * function checkHookHealth() {
   *   const stats = hookManager.getStats()
   *
   *   if (stats.totalHandlers === 0) {
   *     console.warn('No hooks registered!')
   *   } else if (stats.totalHandlers > 100) {
   *     console.warn(`High hook count: ${stats.totalHandlers}`)
   *   } else {
   *     console.log(`Hook system healthy: ${stats.totalHandlers} handlers`)
   *   }
   * }
   * ```
   *
   * @example Generate hook report
   * ```typescript
   * const stats = hookManager.getStats()
   *
   * const report = {
   *   timestamp: new Date().toISOString(),
   *   hooks: stats.totalHooks,
   *   handlers: stats.totalHandlers,
   *   averageHandlersPerHook: stats.totalHandlers / stats.totalHooks,
   *   plugins: Object.keys(stats.handlersByPlugin).length,
   *   details: stats.handlersByPlugin
   * }
   *
   * console.log('Hook System Report:', JSON.stringify(report, null, 2))
   * ```
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
