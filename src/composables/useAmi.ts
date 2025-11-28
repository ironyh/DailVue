/**
 * AMI Composable
 *
 * Vue composable for Asterisk Manager Interface via amiws WebSocket proxy.
 * Provides reactive state for AMI connection and presence queries.
 *
 * @module composables/useAmi
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { AmiClient, createAmiClient } from '@/core/AmiClient'
import type {
  AmiConfig,
  AmiMessage,
  AmiEventData,
  AmiPresenceStateChangeEvent,
} from '@/types/ami.types'
import { AmiConnectionState } from '@/types/ami.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useAmi')

/**
 * Presence state from AMI
 */
export interface AmiPresenceState {
  /** Extension number */
  extension: string
  /** Current state (available, away, dnd, etc.) */
  state: string
  /** Optional subtype */
  subtype?: string
  /** Optional message */
  message?: string
  /** Last updated timestamp */
  lastUpdated: Date
}

/**
 * Return type for useAmi composable
 */
export interface UseAmiReturn {
  // State
  /** AMI connection state */
  connectionState: Ref<AmiConnectionState>
  /** Whether connected to AMI */
  isConnected: ComputedRef<boolean>
  /** Connection error message */
  error: Ref<string | null>
  /** Map of extension presence states */
  presenceStates: Ref<Map<string, AmiPresenceState>>
  /** List of discovered presence states (from events) */
  discoveredStates: Ref<Set<string>>

  // Methods
  /** Connect to AMI WebSocket */
  connect: (config: AmiConfig) => Promise<void>
  /** Disconnect from AMI */
  disconnect: () => void
  /** Get presence state for extension */
  getPresenceState: (extension: string) => Promise<AmiPresenceState>
  /** Set presence state for extension */
  setPresenceState: (extension: string, state: string, message?: string) => Promise<void>
  /** Query multiple extensions */
  queryExtensions: (extensions: string[]) => Promise<Map<string, AmiPresenceState>>
  /** Listen for AMI events */
  onEvent: (callback: (event: AmiMessage<AmiEventData>) => void) => () => void
  /** Listen for presence changes */
  onPresenceChange: (callback: (extension: string, state: AmiPresenceState) => void) => () => void
  /** Get underlying AMI client */
  getClient: () => AmiClient | null
}

/**
 * AMI Composable
 *
 * Provides reactive AMI functionality for Vue components.
 *
 * @example
 * ```typescript
 * const { connect, isConnected, presenceStates, getPresenceState } = useAmi()
 *
 * // Connect to amiws
 * await connect({ url: 'ws://pbx.example.com:8080' })
 *
 * // Query presence
 * const state = await getPresenceState('1000')
 * console.log(state) // { extension: '1000', state: 'available', ... }
 *
 * // Watch for changes
 * watch(presenceStates, (states) => {
 *   console.log('Presence updated:', states)
 * })
 * ```
 */
export function useAmi(): UseAmiReturn {
  // ============================================================================
  // State
  // ============================================================================

  const client = ref<AmiClient | null>(null)
  const connectionState = ref<AmiConnectionState>(AmiConnectionState.Disconnected)
  const error = ref<string | null>(null)
  const presenceStates = ref<Map<string, AmiPresenceState>>(new Map())
  const discoveredStates = ref<Set<string>>(new Set([
    'available',
    'away',
    'dnd',
    'busy',
    'unavailable',
    'xa',
    'chat',
  ]))

  const eventListeners = ref<Array<(event: AmiMessage<AmiEventData>) => void>>([])
  const presenceListeners = ref<Array<(extension: string, state: AmiPresenceState) => void>>([])

  // ============================================================================
  // Computed
  // ============================================================================

  const isConnected = computed(() => connectionState.value === AmiConnectionState.Connected)

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Connect to AMI WebSocket proxy
   */
  const connect = async (config: AmiConfig): Promise<void> => {
    if (client.value) {
      logger.warn('Already have AMI client, disconnecting first')
      disconnect()
    }

    error.value = null
    connectionState.value = AmiConnectionState.Connecting

    try {
      client.value = createAmiClient(config)

      // Setup event handlers
      client.value.on('connected', () => {
        connectionState.value = AmiConnectionState.Connected
        logger.info('AMI connected')
      })

      client.value.on('disconnected', (reason) => {
        connectionState.value = AmiConnectionState.Disconnected
        logger.info('AMI disconnected', { reason })
      })

      client.value.on('error', (err) => {
        error.value = err.message
        logger.error('AMI error', err)
      })

      client.value.on('event', (event) => {
        eventListeners.value.forEach((listener) => {
          try {
            listener(event)
          } catch (err) {
            logger.error('Error in event listener', err)
          }
        })
      })

      client.value.on('presenceChange', (event) => {
        handlePresenceChange(event)
      })

      await client.value.connect()
    } catch (err) {
      connectionState.value = AmiConnectionState.Failed
      error.value = err instanceof Error ? err.message : 'Failed to connect to AMI'
      throw err
    }
  }

  /**
   * Disconnect from AMI
   */
  const disconnect = (): void => {
    if (client.value) {
      client.value.disconnect()
      client.value = null
    }
    connectionState.value = AmiConnectionState.Disconnected
    presenceStates.value.clear()
  }

  /**
   * Get presence state for an extension
   */
  const getPresenceState = async (extension: string): Promise<AmiPresenceState> => {
    if (!client.value || !isConnected.value) {
      throw new Error('Not connected to AMI')
    }

    const result = await client.value.getPresenceState(extension)

    const state: AmiPresenceState = {
      extension,
      state: result.state,
      subtype: result.subtype,
      message: result.message,
      lastUpdated: new Date(),
    }

    // Update cache
    presenceStates.value.set(extension, state)

    // Discover new states
    if (result.state && !discoveredStates.value.has(result.state.toLowerCase())) {
      discoveredStates.value.add(result.state.toLowerCase())
    }

    return state
  }

  /**
   * Set presence state for an extension
   */
  const setPresenceState = async (
    extension: string,
    state: string,
    message?: string
  ): Promise<void> => {
    if (!client.value || !isConnected.value) {
      throw new Error('Not connected to AMI')
    }

    await client.value.setPresenceState(extension, state, { message })

    // Update local cache
    const existing = presenceStates.value.get(extension)
    presenceStates.value.set(extension, {
      extension,
      state: state.toLowerCase(),
      message,
      subtype: existing?.subtype,
      lastUpdated: new Date(),
    })
  }

  /**
   * Query multiple extensions
   */
  const queryExtensions = async (extensions: string[]): Promise<Map<string, AmiPresenceState>> => {
    const results = new Map<string, AmiPresenceState>()

    await Promise.all(
      extensions.map(async (ext) => {
        try {
          const state = await getPresenceState(ext)
          results.set(ext, state)
        } catch (err) {
          logger.warn(`Failed to get presence for ${ext}`, err)
        }
      })
    )

    return results
  }

  /**
   * Handle presence change event from AMI
   */
  const handlePresenceChange = (event: AmiMessage<AmiPresenceStateChangeEvent>): void => {
    const { Presentity, State, Subtype, Message } = event.data

    // Extract extension from Presentity (e.g., "CustomPresence:1000" -> "1000")
    const extension = Presentity?.split(':')[1] || Presentity

    if (!extension) {
      logger.warn('Presence change event without extension', event)
      return
    }

    const state: AmiPresenceState = {
      extension,
      state: State?.toLowerCase() || 'unknown',
      subtype: Subtype,
      message: Message,
      lastUpdated: new Date(),
    }

    // Update cache
    presenceStates.value.set(extension, state)

    // Discover new states
    if (State && !discoveredStates.value.has(State.toLowerCase())) {
      discoveredStates.value.add(State.toLowerCase())
      logger.info('Discovered new presence state', { state: State })
    }

    // Notify listeners
    presenceListeners.value.forEach((listener) => {
      try {
        listener(extension, state)
      } catch (err) {
        logger.error('Error in presence listener', err)
      }
    })
  }

  /**
   * Listen for AMI events
   */
  const onEvent = (callback: (event: AmiMessage<AmiEventData>) => void): (() => void) => {
    eventListeners.value.push(callback)
    return () => {
      const index = eventListeners.value.indexOf(callback)
      if (index !== -1) {
        eventListeners.value.splice(index, 1)
      }
    }
  }

  /**
   * Listen for presence changes
   */
  const onPresenceChange = (
    callback: (extension: string, state: AmiPresenceState) => void
  ): (() => void) => {
    presenceListeners.value.push(callback)
    return () => {
      const index = presenceListeners.value.indexOf(callback)
      if (index !== -1) {
        presenceListeners.value.splice(index, 1)
      }
    }
  }

  /**
   * Get underlying client
   */
  const getClient = (): AmiClient | null => client.value as AmiClient | null

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(() => {
    disconnect()
    eventListeners.value = []
    presenceListeners.value = []
  })

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    connectionState,
    isConnected,
    error,
    presenceStates,
    discoveredStates,

    // Methods
    connect,
    disconnect,
    getPresenceState,
    setPresenceState,
    queryExtensions,
    onEvent,
    onPresenceChange,
    getClient,
  }
}
