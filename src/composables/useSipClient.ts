/**
 * useSipClient - Vue composable for SIP client management
 *
 * Provides a Vue composable interface for managing SIP client connections,
 * registration, and configuration with reactive state management.
 *
 * @module composables/useSipClient
 */

import { ref, computed, onUnmounted, readonly, nextTick, type Ref, type ComputedRef } from 'vue'
import { SipClient } from '@/core/SipClient'
import { EventBus } from '@/core/EventBus'
import { configStore } from '@/stores/configStore'
import { registrationStore } from '@/stores/registrationStore'
import type { SipClientConfig, ValidationResult } from '@/types/config.types'
import type { ConnectionState, RegistrationState } from '@/types/sip.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useSipClient')

// Track instances using this EventBus to warn about potential conflicts
const eventBusInstanceCounts = new WeakMap<EventBus, number>()

/**
 * SIP Client composable return type
 */
export interface UseSipClientReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Whether client is connected to SIP server */
  isConnected: ComputedRef<boolean>

  /** Whether client is registered with SIP server */
  isRegistered: ComputedRef<boolean>

  /** Current connection state */
  connectionState: ComputedRef<ConnectionState>

  /** Current registration state */
  registrationState: ComputedRef<RegistrationState>

  /** Registered SIP URI */
  registeredUri: ComputedRef<string | null>

  /** Current error message */
  error: Ref<Error | null>

  /** Whether client is connecting */
  isConnecting: ComputedRef<boolean>

  /** Whether client is disconnecting */
  isDisconnecting: Ref<boolean>

  /** Whether client is started */
  isStarted: ComputedRef<boolean>

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Start the SIP client and connect to server
   * @throws {Error} If configuration is invalid or connection fails
   */
  connect: () => Promise<void>

  /**
   * Disconnect from SIP server and stop the client
   * @throws {Error} If disconnect fails
   */
  disconnect: () => Promise<void>

  /**
   * Register with SIP server
   * @throws {Error} If not connected or registration fails
   */
  register: () => Promise<void>

  /**
   * Unregister from SIP server
   * @throws {Error} If not registered or unregistration fails
   */
  unregister: () => Promise<void>

  /**
   * Update SIP client configuration
   * Requires disconnect and reconnect to take effect
   * @param config - Partial configuration to update
   */
  updateConfig: (config: Partial<SipClientConfig>) => ValidationResult

  /**
   * Reconnect to SIP server
   * Performs disconnect followed by connect
   * @throws {Error} If reconnection fails
   */
  reconnect: () => Promise<void>

  /**
   * Get the underlying SIP client instance
   * @returns SIP client instance or null
   */
  getClient: () => SipClient | null

  /**
   * Get the event bus instance
   * @returns Event bus instance
   */
  getEventBus: () => EventBus
}

/**
 * SIP Client Composable
 *
 * Provides reactive access to SIP client functionality including connection
 * management, registration, and configuration updates.
 *
 * @example
 * ```ts
 * const {
 *   isConnected,
 *   isRegistered,
 *   connect,
 *   disconnect,
 *   register
 * } = useSipClient(config)
 *
 * // Connect and register
 * await connect()
 * ```
 *
 * @param initialConfig - Optional initial SIP client configuration
 * @param options - Optional composable options
 * @returns Composable interface with reactive state and methods
 */
export function useSipClient(
  initialConfig?: SipClientConfig,
  options?: {
    /** Shared event bus instance */
    eventBus?: EventBus
    /** Auto-connect on mount */
    autoConnect?: boolean
    /** Auto-cleanup on unmount */
    autoCleanup?: boolean
    /** Reconnect delay in milliseconds (default: 1000) */
    reconnectDelay?: number
  }
): UseSipClientReturn {
  // ============================================================================
  // Setup
  // ============================================================================

  const {
    eventBus = new EventBus(),
    autoConnect = false,
    autoCleanup = true,
    reconnectDelay = 1000,
  } = options ?? {}

  // Track EventBus instance usage for conflict detection
  const currentCount = eventBusInstanceCounts.get(eventBus) ?? 0
  if (currentCount > 0) {
    logger.warn(
      `Multiple useSipClient instances (${currentCount + 1}) detected using the same EventBus. ` +
        'This may cause duplicate event handlers and state conflicts. ' +
        'Consider using separate EventBus instances or implementing instance-scoped state.'
    )
  }
  eventBusInstanceCounts.set(eventBus, currentCount + 1)

  // ============================================================================
  // Internal State
  // ============================================================================

  const sipClient = ref<SipClient | null>(null)
  const error = ref<Error | null>(null)
  const isDisconnecting = ref(false)
  // Store event listener IDs for cleanup
  const listenerIds = ref<string[]>([])

  // ============================================================================
  // Initialize Configuration
  // ============================================================================

  if (initialConfig) {
    const validationResult = configStore.setSipConfig(initialConfig, true)
    if (!validationResult.valid) {
      logger.error('Invalid initial configuration', validationResult.errors)
      error.value = new Error(`Invalid configuration: ${validationResult.errors?.join(', ')}`)
    }
  }

  // ============================================================================
  // Reactive State (Computed)
  // ============================================================================

  /**
   * Connection state - uses SipClient as single source of truth
   * Falls back to 'disconnected' if client not initialized
   */
  const connectionState = computed(() => {
    return sipClient.value?.connectionState ?? 'disconnected'
  })

  const isConnected = computed(() => {
    return sipClient.value?.isConnected ?? false
  })

  const isRegistered = computed(() => {
    return sipClient.value?.isRegistered ?? false
  })

  const registrationState = computed(() => {
    return sipClient.value?.registrationState ?? 'unregistered'
  })

  const registeredUri = computed(() => {
    return registrationStore.registeredUri
  })

  const isConnecting = computed(() => {
    return connectionState.value === 'connecting'
  })

  const isStarted = computed(() => {
    return sipClient.value !== null
  })

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Setup event listeners for SIP client events
   * @returns Cleanup function to remove all listeners
   */
  function setupEventListeners(): () => void {
    // Store listener IDs for cleanup
    const ids: string[] = []

    // Connection events
    ids.push(
      eventBus.on('sip:connected', () => {
        logger.debug('SIP client connected')
        error.value = null
      })
    )

    ids.push(
      eventBus.on('sip:disconnected', (data: unknown) => {
        logger.debug('SIP client disconnected', data)
        if (data && typeof data === 'object' && 'error' in data) {
          error.value = new Error(String(data.error))
        }
      })
    )

    // Registration events
    ids.push(
      eventBus.on('sip:registered', (data: unknown) => {
        logger.info('SIP registered', data)
        if (data && typeof data === 'object' && 'uri' in data) {
          const uri = String(data.uri)
          const expires = 'expires' in data ? Number(data.expires) : undefined
          registrationStore.setRegistered(uri, expires)
        }
      })
    )

    ids.push(
      eventBus.on('sip:unregistered', (data: unknown) => {
        logger.info('SIP unregistered', data)
        registrationStore.setUnregistered()
      })
    )

    ids.push(
      eventBus.on('sip:registration_failed', (data: unknown) => {
        logger.error('SIP registration failed', data)
        const errorMsg =
          data && typeof data === 'object' && 'cause' in data
            ? String(data.cause)
            : 'Registration failed'
        registrationStore.setRegistrationFailed(errorMsg)
        error.value = new Error(errorMsg)
      })
    )

    ids.push(
      eventBus.on('sip:registration_expiring', () => {
        logger.debug('SIP registration expiring, auto-refresh')
        // Auto-refresh will be handled by the SIP client
      })
    )

    // Store IDs for external access
    listenerIds.value = ids

    // Return cleanup function
    return () => {
      logger.debug(`Cleaning up ${ids.length} event listeners`)
      ids.forEach((id, index) => {
        const eventNames = [
          'sip:connected',
          'sip:disconnected',
          'sip:registered',
          'sip:unregistered',
          'sip:registration_failed',
          'sip:registration_expiring',
        ]
        eventBus.off(eventNames[index], id)
      })

      // Decrement instance count for this EventBus
      const count = eventBusInstanceCounts.get(eventBus) ?? 1
      if (count <= 1) {
        eventBusInstanceCounts.delete(eventBus)
      } else {
        eventBusInstanceCounts.set(eventBus, count - 1)
      }
    }
  }

  // Setup event listeners immediately and store cleanup function
  const cleanupEventListeners = setupEventListeners()

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Connect to SIP server
   */
  async function connect(): Promise<void> {
    try {
      error.value = null

      // Validate configuration
      const config = configStore.sipConfig
      if (!config) {
        throw new Error('No SIP configuration set. Call updateConfig() first.')
      }

      // Create SIP client if not exists
      if (!sipClient.value) {
        logger.info('Creating SIP client')
        sipClient.value = new SipClient(config, eventBus)
      }

      // Start the client
      logger.info('Starting SIP client')
      await sipClient.value.start()

      logger.info('SIP client connected successfully')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed'
      logger.error('Failed to connect', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)
      throw err
    }
  }

  /**
   * Disconnect from SIP server
   */
  async function disconnect(): Promise<void> {
    try {
      if (!sipClient.value) {
        logger.warn('No SIP client to disconnect')
        return
      }

      error.value = null
      isDisconnecting.value = true

      logger.info('Disconnecting SIP client')
      await sipClient.value.stop()

      // Clear client instance
      sipClient.value = null
      registrationStore.setUnregistered()

      logger.info('SIP client disconnected successfully')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Disconnect failed'
      logger.error('Failed to disconnect', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)
      throw err
    } finally {
      isDisconnecting.value = false
    }
  }

  /**
   * Register with SIP server
   */
  async function register(): Promise<void> {
    try {
      if (!sipClient.value) {
        throw new Error('SIP client not started. Call connect() first.')
      }

      error.value = null
      logger.info('Registering with SIP server')

      const config = configStore.sipConfig
      if (config?.sipUri) {
        registrationStore.setRegistering(config.sipUri)
      }

      await sipClient.value.register()

      logger.info('Registration successful')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed'
      logger.error('Failed to register', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)
      registrationStore.setRegistrationFailed(errorMsg)
      throw err
    }
  }

  /**
   * Unregister from SIP server
   */
  async function unregister(): Promise<void> {
    try {
      if (!sipClient.value) {
        throw new Error('SIP client not started')
      }

      error.value = null
      logger.info('Unregistering from SIP server')

      registrationStore.setUnregistering()
      await sipClient.value.unregister()

      logger.info('Unregistration successful')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unregistration failed'
      logger.error('Failed to unregister', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)
      throw err
    }
  }

  /**
   * Update SIP client configuration
   */
  function updateConfig(config: Partial<SipClientConfig>): ValidationResult {
    try {
      logger.info('Updating SIP client configuration')

      const validationResult = configStore.updateSipConfig(config, true)

      if (!validationResult.valid) {
        logger.error('Invalid configuration update', validationResult.errors)
        error.value = new Error(`Invalid configuration: ${validationResult.errors?.join(', ')}`)
        return validationResult
      }

      // Update client config if exists
      if (sipClient.value) {
        sipClient.value.updateConfig(config)
        logger.warn('Configuration updated. Reconnect required for changes to take effect.')
      }

      logger.info('Configuration updated successfully')
      return validationResult
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Config update failed'
      logger.error('Failed to update configuration', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)
      return {
        valid: false,
        errors: [errorMsg],
      }
    }
  }

  /**
   * Reconnect to SIP server
   */
  async function reconnect(): Promise<void> {
    try {
      logger.info('Reconnecting to SIP server')
      error.value = null

      // Disconnect if connected
      if (sipClient.value) {
        await disconnect()
      }

      // Wait before reconnecting (configurable delay)
      logger.debug(`Waiting ${reconnectDelay}ms before reconnecting`)
      await new Promise((resolve) => setTimeout(resolve, reconnectDelay))

      // Connect again
      await connect()

      logger.info('Reconnection successful')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Reconnection failed'
      logger.error('Failed to reconnect', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)
      throw err
    }
  }

  /**
   * Get the underlying SIP client instance
   */
  function getClient(): SipClient | null {
    return sipClient.value
  }

  /**
   * Get the event bus instance
   */
  function getEventBus(): EventBus {
    return eventBus
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Auto-connect if configured
   * Deferred to nextTick to ensure component lifecycle is complete
   */
  if (autoConnect && initialConfig) {
    nextTick(() => {
      connect().catch((err) => {
        logger.error('Auto-connect failed', err)
        error.value = err
      })
    })
  }

  /**
   * Cleanup on unmount
   */
  if (autoCleanup) {
    onUnmounted(() => {
      logger.debug('Component unmounted, cleaning up')

      // Clean up event listeners first (critical for memory leak prevention)
      cleanupEventListeners()

      // Then disconnect client
      if (sipClient.value) {
        disconnect().catch((err) => {
          logger.error('Cleanup disconnect failed', err)
        })
      }
    })
  }

  // ============================================================================
  // Return Interface
  // ============================================================================

  return {
    // Reactive state (readonly to prevent external mutation)
    isConnected: readonly(isConnected) as ComputedRef<boolean>,
    isRegistered: readonly(isRegistered) as ComputedRef<boolean>,
    connectionState: readonly(connectionState) as ComputedRef<ConnectionState>,
    registrationState: readonly(registrationState) as ComputedRef<RegistrationState>,
    registeredUri: readonly(registeredUri) as ComputedRef<string | null>,
    error: readonly(error) as Ref<Error | null>,
    isConnecting: readonly(isConnecting) as ComputedRef<boolean>,
    isDisconnecting: readonly(isDisconnecting) as Ref<boolean>,
    isStarted: readonly(isStarted) as ComputedRef<boolean>,

    // Methods
    connect,
    disconnect,
    register,
    unregister,
    updateConfig,
    reconnect,
    getClient,
    getEventBus,
  }
}
