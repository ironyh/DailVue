/**
 * SIP Registration Composable
 *
 * Provides reactive SIP registration state management with automatic
 * refresh, retry logic, and expiry tracking.
 *
 * @module composables/useSipRegistration
 */

import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { registrationStore } from '../stores/registrationStore'
import { RegistrationState } from '../types/sip.types'
import { createLogger } from '../utils/logger'
import type { SipClient } from '../core/SipClient'
import { REGISTRATION_CONSTANTS, RETRY_CONFIG } from './constants'
import { type ExtendedSipClient, hasSipClientMethod } from './types'

const log = createLogger('useSipRegistration')

/**
 * Registration options
 */
export interface RegistrationOptions {
  /** Registration expiry time in seconds (default: 600) */
  expires?: number
  /** Maximum retry attempts before giving up (default: 3) */
  maxRetries?: number
  /** Enable automatic re-registration before expiry (default: true) */
  autoRefresh?: boolean
  /** Custom User-Agent header */
  userAgent?: string
}

/**
 * Return type for useSipRegistration composable
 */
export interface UseSipRegistrationReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Current registration state */
  state: Ref<RegistrationState>
  /** Registered SIP URI */
  registeredUri: Ref<string | null>
  /** Whether currently registered */
  isRegistered: ComputedRef<boolean>
  /** Whether registration is in progress */
  isRegistering: ComputedRef<boolean>
  /** Whether unregistration is in progress */
  isUnregistering: ComputedRef<boolean>
  /** Whether registration has failed */
  hasRegistrationFailed: ComputedRef<boolean>
  /** Registration expiry time in seconds */
  expires: Ref<number>
  /** Timestamp when registration was last successful */
  lastRegistrationTime: Ref<Date | null>
  /** Timestamp when registration will expire */
  expiryTime: Ref<Date | null>
  /** Seconds remaining until registration expires */
  secondsUntilExpiry: ComputedRef<number>
  /** Whether registration is about to expire (less than 30 seconds) */
  isExpiringSoon: ComputedRef<boolean>
  /** Whether registration has expired */
  hasExpired: ComputedRef<boolean>
  /** Number of registration retry attempts */
  retryCount: Ref<number>
  /** Last registration error message */
  lastError: Ref<string | null>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Register with SIP server */
  register: () => Promise<void>
  /** Unregister from SIP server */
  unregister: () => Promise<void>
  /** Manually refresh registration */
  refresh: () => Promise<void>
  /** Reset retry count */
  resetRetries: () => void
  /** Get registration statistics */
  getStatistics: () => RegistrationStatistics
}

/**
 * Registration statistics
 */
export interface RegistrationStatistics {
  state: RegistrationState
  registeredUri: string | null
  isRegistered: boolean
  expires: number
  secondsUntilExpiry: number
  retryCount: number
  hasAutoRefreshTimer: boolean
  lastError: string | null
  lastRegistrationTime: Date | null
  expiryTime: Date | null
}

/**
 * SIP Registration Composable
 *
 * Manages SIP registration lifecycle with reactive state, automatic refresh,
 * and retry logic. Integrates with registrationStore and SipClient.
 *
 * @param sipClient - SIP client instance
 * @param options - Registration options
 * @returns Registration state and methods
 *
 * @example
 * ```typescript
 * const { isRegistered, register, unregister } = useSipRegistration(sipClient, {
 *   expires: 600,
 *   maxRetries: 3,
 *   autoRefresh: true
 * })
 *
 * // Register
 * await register()
 *
 * // Check status
 * if (isRegistered.value) {
 *   console.log('Successfully registered')
 * }
 *
 * // Unregister
 * await unregister()
 * ```
 */
export function useSipRegistration(
  sipClient: Ref<SipClient | null>,
  options: RegistrationOptions = {}
): UseSipRegistrationReturn {
  const {
    expires = REGISTRATION_CONSTANTS.DEFAULT_EXPIRES,
    maxRetries = REGISTRATION_CONSTANTS.DEFAULT_MAX_RETRIES,
    autoRefresh = true,
    userAgent,
  } = options

  // ============================================================================
  // Reactive State (wrapping store state for reactivity)
  // ============================================================================

  const state = ref<RegistrationState>(registrationStore.state)
  const registeredUri = ref<string | null>(registrationStore.registeredUri)
  const expiresValue = ref<number>(registrationStore.expires)
  const lastRegistrationTime = ref<Date | null>(registrationStore.lastRegistrationTime)
  const expiryTime = ref<Date | null>(registrationStore.expiryTime)
  const retryCount = ref<number>(registrationStore.retryCount)
  const lastError = ref<string | null>(registrationStore.lastError)

  // Auto-refresh timer ID
  let refreshTimerId: number | null = null

  // ============================================================================
  // Computed Values
  // ============================================================================

  const isRegistered = computed(() => state.value === RegistrationState.Registered)
  const isRegistering = computed(() => state.value === RegistrationState.Registering)
  const isUnregistering = computed(() => state.value === RegistrationState.Unregistering)
  const hasRegistrationFailed = computed(() => state.value === RegistrationState.RegistrationFailed)

  const secondsUntilExpiry = computed(() => {
    if (!expiryTime.value) return 0
    const now = new Date().getTime()
    const expiry = expiryTime.value.getTime()
    return Math.max(0, Math.floor((expiry - now) / 1000))
  })

  const isExpiringSoon = computed(() => secondsUntilExpiry.value < REGISTRATION_CONSTANTS.EXPIRING_SOON_THRESHOLD)
  const hasExpired = computed(() => secondsUntilExpiry.value === 0)

  // ============================================================================
  // Store Synchronization
  // ============================================================================

  /**
   * Sync local state with store state
   */
  const syncWithStore = (): void => {
    state.value = registrationStore.state
    registeredUri.value = registrationStore.registeredUri
    expiresValue.value = registrationStore.expires
    lastRegistrationTime.value = registrationStore.lastRegistrationTime
    expiryTime.value = registrationStore.expiryTime
    retryCount.value = registrationStore.retryCount
    lastError.value = registrationStore.lastError
  }

  // Watch store for external changes and auto-sync
  // This ensures the composable stays in sync if the store is updated elsewhere
  const stopStoreWatch = watch(
    () => ({
      state: registrationStore.state,
      registeredUri: registrationStore.registeredUri,
      expires: registrationStore.expires,
      lastRegistrationTime: registrationStore.lastRegistrationTime,
      expiryTime: registrationStore.expiryTime,
      retryCount: registrationStore.retryCount,
      lastError: registrationStore.lastError,
    }),
    (newState) => {
      // Only sync if values actually changed to avoid infinite loops
      if (state.value !== newState.state) {
        state.value = newState.state
      }
      if (registeredUri.value !== newState.registeredUri) {
        registeredUri.value = newState.registeredUri
      }
      if (expiresValue.value !== newState.expires) {
        expiresValue.value = newState.expires
      }
      if (lastRegistrationTime.value !== newState.lastRegistrationTime) {
        lastRegistrationTime.value = newState.lastRegistrationTime
      }
      if (expiryTime.value !== newState.expiryTime) {
        expiryTime.value = newState.expiryTime
      }
      if (retryCount.value !== newState.retryCount) {
        retryCount.value = newState.retryCount
      }
      if (lastError.value !== newState.lastError) {
        lastError.value = newState.lastError
      }
    },
    { deep: true }
  )

  // ============================================================================
  // Auto-Refresh Logic
  // ============================================================================

  /**
   * Setup auto-refresh timer
   */
  const setupAutoRefresh = (): void => {
    if (!autoRefresh) {
      log.debug('Auto-refresh disabled')
      return
    }

    clearAutoRefresh()

    if (!expiryTime.value || expiresValue.value <= 0) {
      log.debug('Cannot setup auto-refresh: no expiry time set')
      return
    }

    // Calculate refresh time (90% of expiry time)
    const refreshDelay = expiresValue.value * REGISTRATION_CONSTANTS.REFRESH_PERCENTAGE * 1000

    log.debug(
      `Setting up auto-refresh in ${Math.floor(refreshDelay / 1000)}s ` +
        `(${REGISTRATION_CONSTANTS.REFRESH_PERCENTAGE * 100}% of ${expiresValue.value}s)`
    )

    refreshTimerId = window.setTimeout(async () => {
      log.info('Auto-refresh timer triggered')
      try {
        await refresh()
      } catch (error) {
        log.error('Auto-refresh failed:', error)
      }
    }, refreshDelay)
  }

  /**
   * Clear auto-refresh timer
   */
  const clearAutoRefresh = (): void => {
    if (refreshTimerId !== null) {
      clearTimeout(refreshTimerId)
      refreshTimerId = null
      log.debug('Cleared auto-refresh timer')
    }
  }

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register with SIP server
   *
   * @throws Error if SIP client is not initialized or registration fails
   */
  const register = async (): Promise<void> => {
    if (!sipClient.value) {
      const error = 'SIP client not initialized'
      log.error(error)
      throw new Error(error)
    }

    try {
      log.info('Starting registration...')

      // Get URI - prefer from SipClient if available, fallback to store
      const extendedClient = sipClient.value as ExtendedSipClient
      const uri = hasSipClientMethod(extendedClient, 'getConfig')
        ? extendedClient.getConfig!().uri
        : registeredUri.value || 'unknown'

      registrationStore.setRegistering(uri)

      // Configure expiry time
      if (expires !== registrationStore.expires) {
        registrationStore.setDefaultExpiry(expires)
      }

      // Perform registration via SIP client
      // Check if SipClient.register() accepts options (extended API)
      if (hasSipClientMethod(extendedClient, 'register')) {
        // Try calling with options first (extended API)
        try {
          await extendedClient.register!({ expires, userAgent })
        } catch (err) {
          // If that fails, fallback to basic register() without parameters
          log.debug('Extended register() not available, using basic register()')
          await sipClient.value.register()
        }
      } else {
        // Use the base SipClient.register() method
        await sipClient.value.register()
      }

      // Update store state
      registrationStore.setRegistered(uri, expires)
      syncWithStore()

      // Setup auto-refresh
      setupAutoRefresh()

      log.info('Registration successful')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown registration error'
      log.error('Registration failed:', errorMessage)

      registrationStore.setRegistrationFailed(errorMessage)
      syncWithStore()

      // Retry logic with exponential backoff
      if (retryCount.value < maxRetries) {
        const retryDelay = RETRY_CONFIG.calculateBackoff(
          retryCount.value,
          REGISTRATION_CONSTANTS.BASE_RETRY_DELAY,
          REGISTRATION_CONSTANTS.MAX_RETRY_DELAY
        )
        log.info(
          `Retrying registration in ${retryDelay / 1000}s ` +
            `(attempt ${retryCount.value + 1}/${maxRetries})`
        )

        setTimeout(() => {
          register().catch((err) => log.error('Retry failed:', err))
        }, retryDelay)
      } else {
        log.error(`Max retries (${maxRetries}) reached, giving up`)
      }

      throw error
    }
  }

  /**
   * Unregister from SIP server
   *
   * @throws Error if SIP client is not initialized
   */
  const unregister = async (): Promise<void> => {
    if (!sipClient.value) {
      const error = 'SIP client not initialized'
      log.error(error)
      throw new Error(error)
    }

    try {
      log.info('Starting unregistration...')
      registrationStore.setUnregistering()
      syncWithStore()

      // Clear auto-refresh
      clearAutoRefresh()

      // Perform unregistration via SIP client
      await sipClient.value.unregister()

      // Update store state
      registrationStore.setUnregistered()
      syncWithStore()

      log.info('Unregistration successful')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown unregistration error'
      log.error('Unregistration failed:', errorMessage)

      registrationStore.setRegistrationFailed(errorMessage)
      syncWithStore()

      throw error
    }
  }

  /**
   * Manually refresh registration
   *
   * Forces an immediate re-registration to refresh the expiry time.
   *
   * @throws Error if not currently registered
   */
  const refresh = async (): Promise<void> => {
    if (!isRegistered.value) {
      const error = 'Cannot refresh: not currently registered'
      log.error(error)
      throw new Error(error)
    }

    log.info('Refreshing registration...')

    // Clear current auto-refresh timer
    clearAutoRefresh()

    // Re-register
    await register()
  }

  /**
   * Reset retry count
   */
  const resetRetries = (): void => {
    registrationStore.resetRetryCount()
    syncWithStore()
    log.debug('Retry count reset')
  }

  /**
   * Get registration statistics
   */
  const getStatistics = (): RegistrationStatistics => {
    return {
      state: state.value,
      registeredUri: registeredUri.value,
      isRegistered: isRegistered.value,
      expires: expiresValue.value,
      secondsUntilExpiry: secondsUntilExpiry.value,
      retryCount: retryCount.value,
      hasAutoRefreshTimer: refreshTimerId !== null,
      lastError: lastError.value,
      lastRegistrationTime: lastRegistrationTime.value,
      expiryTime: expiryTime.value,
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // Cleanup on component unmount
  onUnmounted(() => {
    log.debug('Composable unmounting, clearing auto-refresh timer and store watch')
    clearAutoRefresh()
    stopStoreWatch()
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    state,
    registeredUri,
    isRegistered,
    isRegistering,
    isUnregistering,
    hasRegistrationFailed,
    expires: expiresValue,
    lastRegistrationTime,
    expiryTime,
    secondsUntilExpiry,
    isExpiringSoon,
    hasExpired,
    retryCount,
    lastError,

    // Methods
    register,
    unregister,
    refresh,
    resetRetries,
    getStatistics,
  }
}
