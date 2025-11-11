/**
 * SipClientProvider - Vue provider component for SIP client
 *
 * Provides SIP client instance and event bus to child components
 * using Vue's provide/inject API. Handles lifecycle management
 * and cleanup automatically.
 *
 * @example
 * ```vue
 * <template>
 *   <SipClientProvider :config="sipConfig">
 *     <MyCallComponent />
 *   </SipClientProvider>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider } from 'vuesip'
 *
 * const sipConfig = {
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:alice@example.com',
 *   password: 'secret123'
 * }
 * </script>
 * ```
 *
 * @packageDocumentation
 */

import {
  defineComponent,
  provide,
  inject,
  onMounted,
  onBeforeUnmount,
  watch,
  readonly,
  ref,
  h,
  type InjectionKey,
  type Ref,
  type PropType,
} from 'vue'
import { SipClient } from '@/core/SipClient'
import { EventBus } from '@/core/EventBus'
import type { SipClientConfig } from '@/types/config.types'
import { ConnectionState, RegistrationState } from '@/types/sip.types'
import { createLogger } from '@/utils/logger'
import { validateSipConfig } from '@/utils/validators'

const logger = createLogger('SipClientProvider')

/**
 * Injection key for SIP client instance
 */
export const SipClientKey: InjectionKey<Ref<SipClient | null>> = Symbol('sip-client')

/**
 * Injection key for event bus instance
 */
export const EventBusKey: InjectionKey<Ref<EventBus>> = Symbol('event-bus')

/**
 * Injection key for connection state
 */
export const ConnectionStateKey: InjectionKey<Ref<ConnectionState>> = Symbol('connection-state')

/**
 * Injection key for registration state
 */
export const RegistrationStateKey: InjectionKey<Ref<RegistrationState>> =
  Symbol('registration-state')

/**
 * Provider context shape - what gets injected into children
 */
export interface SipClientProviderContext {
  /** SIP client instance (null if not initialized) */
  client: Ref<SipClient | null>
  /** Event bus instance for subscribing to events */
  eventBus: Ref<EventBus>
  /** Current connection state */
  connectionState: Ref<ConnectionState>
  /** Current registration state */
  registrationState: Ref<RegistrationState>
  /** Whether client is ready to use */
  isReady: Ref<boolean>
  /** Current error (null if no error) */
  error: Ref<Error | null>
  /** Programmatically connect to SIP server */
  connect: () => Promise<void>
  /** Programmatically disconnect from SIP server */
  disconnect: () => Promise<void>
}

/**
 * Injection key for complete provider context
 */
export const SipClientProviderKey: InjectionKey<SipClientProviderContext> =
  Symbol('sip-client-provider')

/**
 * SipClientProvider component
 *
 * Provides SIP client functionality to all child components via
 * Vue's dependency injection system.
 *
 * @example
 * ```ts
 * import { useSipClientProvider } from 'vuesip'
 *
 * // In child component
 * const { client, eventBus, isReady } = useSipClientProvider()
 *
 * watchEffect(() => {
 *   if (isReady.value) {
 *     console.log('SIP client is ready!')
 *   }
 * })
 * ```
 */
export const SipClientProvider = defineComponent({
  name: 'SipClientProvider',

  props: {
    /**
     * SIP client configuration
     */
    config: {
      type: Object as PropType<SipClientConfig>,
      required: true,
    },

    /**
     * Whether to automatically connect on mount
     * @default true
     */
    autoConnect: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically register after connecting
     * @default true
     */
    autoRegister: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically cleanup on unmount
     * @default true
     */
    autoCleanup: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to watch config changes and reinitialize client
     * WARNING: This will disconnect and reconnect when config changes
     * @default false
     */
    watchConfig: {
      type: Boolean,
      default: false,
    },
  },

  emits: {
    /**
     * Emitted when client is ready (connected and optionally registered)
     */
    ready: () => true,

    /**
     * Emitted when client connects to SIP server
     */
    connected: () => true,

    /**
     * Emitted when client disconnects from SIP server
     */
    disconnected: (_error?: Error) => true,

    /**
     * Emitted when client registers with SIP server
     */
    registered: (_uri: string) => true,

    /**
     * Emitted when client unregisters from SIP server
     */
    unregistered: () => true,

    /**
     * Emitted when an error occurs
     */
    error: (_error: Error) => true,
  },

  setup(props, { emit, slots }) {
    // Create or use external event bus instance (shared across provider)
    const eventBus = ref<EventBus>(props.eventBus ?? new EventBus())

    // SIP client instance
    const client = ref<SipClient | null>(null)

    // Reactive state
    const connectionState = ref<ConnectionState>(ConnectionState.Disconnected)
    const registrationState = ref<RegistrationState>(RegistrationState.Unregistered)
    const isReady = ref(false)
    const error = ref<Error | null>(null)

    // Track event listener IDs for cleanup
    const eventListenerIds = ref<string[]>([])

    /**
     * Initialize SIP client with configuration
     */
    const initialized = ref(false)

    const initializeClient = (): void => {
      try {
        // Validate configuration
        const validation = validateSipConfig(props.config)
        if (!validation.valid) {
          const err = new Error(`Invalid SIP configuration: ${validation.errors?.join(', ')}`)
          logger.error('Configuration validation failed', { validation })
          error.value = err
          emit('error', err)
          return
        }

        logger.info('Initializing SIP client', {
          uri: props.config.uri,
          sipUri: props.config.sipUri,
        })

        // Create SIP client instance
        client.value = new SipClient(props.config, eventBus.value as EventBus)
        initialized.value = true

        // Setup event listeners
        setupEventListeners()

        logger.debug('SIP client initialized successfully')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to initialize SIP client', err)
        error.value = errorObj
        emit('error', errorObj)
      }
    }

    /**
     * Setup event listeners for SIP client events
     * Tracks listener IDs for proper cleanup
     */
    const setupEventListeners = (): void => {
      if (!client.value) return

      // Connection events
      const connectedId = eventBus.value.on('sip:connected', () => {
        logger.info('SIP client connected')
        connectionState.value = ConnectionState.Connected
        emit('connected')

        // Auto-register if enabled
        if (props.autoRegister && client.value) {
          client.value.register().catch((err) => {
            logger.error('Auto-registration failed', err)
            const errorObj = err instanceof Error ? err : new Error(String(err))
            error.value = errorObj
            emit('error', errorObj)
          })
        } else if (!props.autoRegister) {
          // If not auto-registering, client is ready once connected
          isReady.value = true
          emit('ready')
        }
      })
      eventListenerIds.value.push(connectedId)

      const disconnectedId = eventBus.value.on(
        'sip:disconnected',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data?: any) => {
          logger.info('SIP client disconnected', data)
          connectionState.value = ConnectionState.Disconnected
          registrationState.value = RegistrationState.Unregistered
          isReady.value = false

          const errorObj = data?.error ? new Error(data.error) : undefined
          emit('disconnected', errorObj)
        }
      )
      eventListenerIds.value.push(disconnectedId)

      const connectingId = eventBus.value.on('sip:connecting', () => {
        logger.debug('SIP client connecting')
        connectionState.value = ConnectionState.Connecting
      })
      eventListenerIds.value.push(connectingId)

      // Registration events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registeredId = eventBus.value.on('sip:registered', (data: any) => {
        logger.info('SIP client registered', data)
        registrationState.value = RegistrationState.Registered
        isReady.value = true
        emit('registered', data.uri)
        emit('ready')
      })
      eventListenerIds.value.push(registeredId)

      const unregisteredId = eventBus.value.on('sip:unregistered', () => {
        logger.info('SIP client unregistered')
        registrationState.value = RegistrationState.Unregistered
        emit('unregistered')
      })
      eventListenerIds.value.push(unregisteredId)

      const registeringId = eventBus.value.on('sip:registering', () => {
        logger.debug('SIP client registering')
        registrationState.value = RegistrationState.Registering
      })
      eventListenerIds.value.push(registeringId)

      const registrationFailedId = eventBus.value.on(
        'sip:registration_failed',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any) => {
          logger.error('SIP registration failed', data)
          registrationState.value = RegistrationState.Unregistered
          const errorObj = new Error(`Registration failed: ${data.cause}`)
          error.value = errorObj
          emit('error', errorObj)
        }
      )
      eventListenerIds.value.push(registrationFailedId)

      logger.debug(`Registered ${eventListenerIds.value.length} event listeners`)
    }

    /**
     * Remove all event listeners to prevent memory leaks
     */
    const removeEventListeners = (): void => {
      logger.debug(`Removing ${eventListenerIds.value.length} event listeners`)
      eventListenerIds.value.forEach((id) => {
        eventBus.value.removeById(id)
      })
      eventListenerIds.value = []
    }

    /**
     * Connect to SIP server
     */
    const connect = async (): Promise<void> => {
      if (!client.value) {
        const err = new Error('SIP client not initialized')
        logger.error(err.message)
        error.value = err
        emit('error', err)
        throw err
      }

      try {
        logger.info('Connecting to SIP server')
        await client.value.start()
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to connect', err)
        error.value = errorObj
        emit('error', errorObj)
        throw errorObj
      }
    }

    /**
     * Disconnect from SIP server and cleanup
     */
    const disconnect = async (): Promise<void> => {
      if (!client.value) {
        logger.debug('No client to disconnect')
        return
      }

      try {
        logger.info('Disconnecting from SIP server')
        await client.value.stop()
        isReady.value = false
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to disconnect', err)
        error.value = errorObj
        emit('error', errorObj)
        throw errorObj
      }
    }

    /**
     * Cleanup resources
     * Note: This is intentionally synchronous to work properly with Vue lifecycle
     */
    const cleanup = (): void => {
      logger.debug('Cleaning up SIP client provider')

      // Remove event listeners first to prevent further updates
      removeEventListeners()

      // Stop client if connected (synchronously - fire and forget)
      if (client.value) {
        client.value.stop().catch((err) => {
          logger.warn('Error stopping client during cleanup', err)
        })
      }

      // Clear references
      client.value = null
      isReady.value = false
      error.value = null
      connectionState.value = ConnectionState.Disconnected
      registrationState.value = RegistrationState.Unregistered
    }

    /**
     * Reinitialize client with new config
     * Used when config changes (if watchConfig is enabled)
     */
    const reinitializeClient = async (): Promise<void> => {
      logger.info('Config changed, reinitializing client')

      // Cleanup existing client
      removeEventListeners()
      if (client.value) {
        try {
          await client.value.stop()
        } catch (err) {
          logger.warn('Error stopping client during reinitialization', err)
        }
      }

      // Reset state
      connectionState.value = ConnectionState.Disconnected
      registrationState.value = RegistrationState.Unregistered
      isReady.value = false
      error.value = null

      // Reinitialize
      initializeClient()

      // Auto-connect if enabled
      if (props.autoConnect && client.value) {
        try {
          await connect()
        } catch (err) {
          logger.error('Auto-connect failed during reinitialization', err)
        }
      }
    }

    // Watch config changes (if enabled)
    if (props.watchConfig) {
      watch(
        () => props.config,
        async (newConfig, oldConfig) => {
          // Only reinitialize if config actually changed
          if (JSON.stringify(newConfig) !== JSON.stringify(oldConfig)) {
            await reinitializeClient()
          }
        },
        { deep: true }
      )
    }

    // Lifecycle hooks
    // Initialize immediately so listeners are ready and tests' EventBus.on handlers can fire
    initializeClient()

    onMounted(async () => {
      logger.debug('SipClientProvider mounted')

      // Already initialized in setup to register event listeners

      // Auto-connect if enabled
      if (props.autoConnect && client.value) {
        try {
          await connect()
        } catch (err) {
          logger.error('Auto-connect failed', err)
          // error already emitted in connect()
        }
      }
    })

    onBeforeUnmount(() => {
      logger.debug('SipClientProvider unmounting')

      if (props.autoCleanup) {
        cleanup()
      }
    })

    // Create provider context
    const providerContext: SipClientProviderContext = {
      client: readonly(client) as Ref<SipClient | null>,
      eventBus: readonly(eventBus) as Ref<EventBus>,
      connectionState: readonly(connectionState) as Ref<ConnectionState>,
      registrationState: readonly(registrationState) as Ref<RegistrationState>,
      isReady: readonly(isReady) as Ref<boolean>,
      error: readonly(error) as Ref<Error | null>,
      connect,
      disconnect,
    }

    // Provide context to children
    provide(SipClientProviderKey, providerContext)
    provide(SipClientKey, readonly(client) as Ref<SipClient | null>)
    provide(EventBusKey, readonly(eventBus) as Ref<EventBus>)
    provide(ConnectionStateKey, readonly(connectionState) as Ref<ConnectionState>)
    provide(RegistrationStateKey, readonly(registrationState) as Ref<RegistrationState>)

    // Render default slot
    return () => {
      return h('div', { class: 'sip-client-provider' }, slots.default ? slots.default() : null)
    }
  },
})

/**
 * Composable for consuming SipClientProvider context
 *
 * Must be used inside a component that is a child of SipClientProvider.
 *
 * @throws {Error} If used outside of SipClientProvider
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 *
 * const { client, eventBus, isReady, connectionState } = useSipClientProvider()
 *
 * watchEffect(() => {
 *   console.log('Connection state:', connectionState.value)
 * })
 * </script>
 * ```
 */
export function useSipClientProvider(): SipClientProviderContext {
  const context = inject(SipClientProviderKey)

  if (!context) {
    throw new Error(
      'useSipClientProvider() must be called inside a component that is a child of <SipClientProvider>'
    )
  }

  return context
}
