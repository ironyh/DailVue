/**
 * useSipClient - Vue composable for SIP client management
 *
 * Provides a Vue composable interface for managing SIP client connections,
 * registration, and configuration with reactive state management.
 *
 * @module composables/useSipClient
 */

import { ref, computed, onUnmounted, readonly, nextTick, watch, type Ref, type ComputedRef } from 'vue'
import { SipClient } from '@/core/SipClient'
import { EventBus } from '@/core/EventBus'
import { configStore } from '@/stores/configStore'
import { registrationStore } from '@/stores/registrationStore'
import type { SipClientConfig, ValidationResult } from '@/types/config.types'
import { ConnectionState, RegistrationState } from '@/types/sip.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useSipClient')

// Track instances using this EventBus to warn about potential conflicts
const eventBusInstanceCounts = new WeakMap<EventBus, number>()

/**
 * Typed event payloads for SIP events
 * Provides compile-time type safety for event data
 */
interface SipEventPayloads {
  'sip:connected': void
  'sip:disconnected': { error?: string }
  'sip:registered': { uri: string; expires?: number }
  'sip:unregistered': void
  'sip:registration_failed': { cause: string }
  'sip:registration_expiring': void
}

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
    /** Connection timeout in milliseconds (default: 30000) */
    connectionTimeout?: number
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
    connectionTimeout = 30000,
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

  // Track connection state reactively via refs that update on events
  // This ensures Vue reactivity works even when SipClient's internal state changes
  const _connectionState = ref<ConnectionState>(ConnectionState.Disconnected)
  const _isConnected = ref(false)

  /**
   * Connection state - uses reactive refs updated via events for Vue reactivity
   * Falls back to SipClient if reactive state not yet initialized
   * Updated reactively via event listeners and watchers
   */
  const connectionState = computed(() => {
    // Use reactive ref which is updated by events and watchers
    // The watcher syncs from SipClient, so this should always be up-to-date
    return _connectionState.value
  })

  const isConnected = computed(() => {
    // Use reactive ref which is updated by events and watchers
    // The watcher syncs from SipClient, so this should always be up-to-date
    return _isConnected.value
  })

  const isRegistered = computed(() => {
    return sipClient.value?.isRegistered ?? false
  })

  const registrationState = computed(() => {
    return sipClient.value?.registrationState ?? RegistrationState.Unregistered
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
    // Store event name + ID pairs for robust cleanup
    const listeners: Array<{ event: string; id: string }> = []

    // Connection events
    listeners.push({
      event: 'sip:connected',
      id: eventBus.on('sip:connected', () => {
        console.log('[useSipClient] sip:connected event received!')
        logger.debug('SIP client connected')
        error.value = null
        // Update reactive state
        console.log('[useSipClient] Updating _connectionState to Connected')
        _connectionState.value = ConnectionState.Connected
        console.log('[useSipClient] Updating _isConnected to true')
        _isConnected.value = true
        console.log('[useSipClient] State updated. connectionState:', _connectionState.value, 'isConnected:', _isConnected.value)
      }),
    })

    listeners.push({
      event: 'sip:disconnected',
      id: eventBus.on('sip:disconnected', (data: unknown) => {
        logger.debug('SIP client disconnected', data)
        const payload = data as SipEventPayloads['sip:disconnected'] | undefined
        if (payload?.error) {
          error.value = new Error(payload.error)
        }
        // Update reactive state
        _connectionState.value = ConnectionState.Disconnected
        _isConnected.value = false
      }),
    })

    // Registration events
    listeners.push({
      event: 'sip:registered',
      id: eventBus.on('sip:registered', (data: unknown) => {
        logger.info('SIP registered', data)
        const payload = data as SipEventPayloads['sip:registered']
        if (payload?.uri) {
          registrationStore.setRegistered(payload.uri, payload.expires)
        }
      }),
    })

    listeners.push({
      event: 'sip:unregistered',
      id: eventBus.on('sip:unregistered', () => {
        logger.info('SIP unregistered')
        registrationStore.setUnregistered()
      }),
    })

    listeners.push({
      event: 'sip:registration_failed',
      id: eventBus.on('sip:registration_failed', (data: unknown) => {
        logger.error('SIP registration failed', data)
        const payload = data as SipEventPayloads['sip:registration_failed'] | undefined
        const errorMsg = payload?.cause ?? 'Registration failed'
        registrationStore.setRegistrationFailed(errorMsg)
        error.value = new Error(errorMsg)
      }),
    })

    listeners.push({
      event: 'sip:registration_expiring',
      id: eventBus.on('sip:registration_expiring', () => {
        logger.debug('SIP registration expiring, auto-refresh')
        // Auto-refresh will be handled by the SIP client
      }),
    })

    // Return cleanup function
    return () => {
      logger.debug(`Cleaning up ${listeners.length} event listeners`)
      listeners.forEach(({ event, id }) => {
        eventBus.off(event, id)
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

  // Watch SipClient state and sync to reactive refs as fallback
  // This ensures reactivity even if events don't fire immediately
  watch(
    () => sipClient.value?.connectionState,
    (newState) => {
      if (newState !== undefined) {
        _connectionState.value = newState
      }
    },
    { immediate: true }
  )

  watch(
    () => sipClient.value?.isConnected,
    (newIsConnected) => {
      if (newIsConnected !== undefined) {
        _isConnected.value = newIsConnected
      }
    },
    { immediate: true }
  )

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
        // Extract raw config object from Vue reactivity system
        const plainConfig = JSON.parse(JSON.stringify(config)) as SipClientConfig
        console.log('useSipClient.connect plainConfig', plainConfig)
        sipClient.value = new SipClient(plainConfig, eventBus)
      }

      // Start the client with timeout
      logger.info('Starting SIP client')

      const connectPromise = sipClient.value.start()
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)),
          connectionTimeout
        )
      })

      await Promise.race([connectPromise, timeoutPromise])
      // Clear the timeout if connect resolved first to avoid stray timers
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
      // Manually sync state after connection (in case events don't fire immediately)
      // First, perform an immediate sync; if already connected, skip polling to avoid timer reliance
      if (sipClient.value) {
        _connectionState.value = sipClient.value.connectionState
        _isConnected.value = sipClient.value.isConnected
      }
      // Skip additional polling to avoid timer interactions in tests; consumers
      // receive state updates via event listeners and this initial sync

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

      // Properly destroy client to clean up all resources
      sipClient.value.destroy()
      sipClient.value = null
      registrationStore.setUnregistered()
      
      // Reset reactive state
      _connectionState.value = ConnectionState.Disconnected
      _isConnected.value = false

      logger.info('SIP client disconnected successfully')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Disconnect failed'
      logger.error('Failed to disconnect', err)
      error.value = err instanceof Error ? err : new Error(errorMsg)

      // Still attempt cleanup even if stop() failed
      try {
        if (sipClient.value) {
          sipClient.value.destroy()
          sipClient.value = null
        }
      } catch (cleanupErr) {
        logger.error('Cleanup failed during error handling', cleanupErr)
      }

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

      const hasExistingConfig = configStore.hasSipConfig
      let validationResult: ValidationResult
      const configSnapshot = JSON.parse(JSON.stringify(config))
      console.log('useSipClient.updateConfig', { hasExistingConfig, config: configSnapshot })

      if (hasExistingConfig) {
        validationResult = configStore.updateSipConfig(config, true)
      } else {
        const requiredFields: Array<keyof SipClientConfig> = ['uri', 'sipUri', 'password']
        const missingFields = requiredFields.filter(
          (field) => !(config as Partial<SipClientConfig>)[field]
        )
        if (missingFields.length > 0) {
          const message = `Missing required fields for initial config: ${missingFields.join(', ')}`
          logger.error(message)
          return {
            valid: false,
            errors: [message],
          }
        }

        validationResult = configStore.setSipConfig(config as SipClientConfig, true)
      }

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
    return sipClient.value as SipClient | null
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
    // Reactive state
    // Note: Computed refs are already readonly by nature, no wrapper needed
    isConnected,
    isRegistered,
    connectionState,
    registrationState,
    registeredUri,
    isConnecting,
    isStarted,

    // Refs need readonly wrapper to prevent external mutation
    error: readonly(error),
    isDisconnecting: readonly(isDisconnecting),

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
