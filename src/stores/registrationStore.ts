/**
 * Registration Store
 *
 * Reactive store for managing SIP registration state, including registration
 * status, expiry tracking, and auto-refresh logic.
 *
 * @module stores/registrationStore
 */

import { reactive, computed } from 'vue'
import { RegistrationState } from '../types/sip.types'
import { createLogger } from '../utils/logger'
import { DEFAULT_REGISTER_EXPIRES } from '../utils/constants'

const log = createLogger('RegistrationStore')

/**
 * Registration store state interface
 */
interface RegistrationStoreState {
  /** Current registration state */
  state: RegistrationState
  /** Registered SIP URI */
  registeredUri: string | null
  /** Registration expiry time in seconds */
  expires: number
  /** Timestamp when registration was last successful */
  lastRegistrationTime: Date | null
  /** Timestamp when registration will expire */
  expiryTime: Date | null
  /** Number of registration retry attempts */
  retryCount: number
  /** Last registration error message */
  lastError: string | null
  /** Auto-refresh timer ID */
  autoRefreshTimerId: number | null
  /** Time trigger for computed property updates (internal, for testing) */
  _timeTrigger: number
}

/**
 * Internal reactive state
 */
const state = reactive<RegistrationStoreState>({
  state: RegistrationState.Unregistered,
  registeredUri: null,
  expires: DEFAULT_REGISTER_EXPIRES,
  lastRegistrationTime: null,
  expiryTime: null,
  retryCount: 0,
  lastError: null,
  autoRefreshTimerId: null,
  _timeTrigger: 0,
})

/**
 * Computed values
 */
const computed_values: Record<string, any> = {
  /** Whether currently registered */
  isRegistered: computed(() => state.state === RegistrationState.Registered),

  /** Whether registration is in progress */
  isRegistering: computed(() => state.state === RegistrationState.Registering),

  /** Whether unregistration is in progress */
  isUnregistering: computed(() => state.state === RegistrationState.Unregistering),

  /** Whether registration has failed */
  hasRegistrationFailed: computed(() => state.state === RegistrationState.RegistrationFailed),

  /** Seconds remaining until registration expires */
  secondsUntilExpiry: computed(() => {
    // Access _timeTrigger to make this computed reactive to time changes
    state._timeTrigger // eslint-disable-line @typescript-eslint/no-unused-expressions
    if (!state.expiryTime) return 0
    const now = new Date().getTime()
    const expiry = state.expiryTime.getTime()
    return Math.max(0, Math.floor((expiry - now) / 1000))
  }),

  /** Whether registration is about to expire (less than 30 seconds) */
  isExpiringSoon: computed(() => computed_values.secondsUntilExpiry.value < 30),

  /** Whether registration has expired */
  hasExpired: computed(() => computed_values.secondsUntilExpiry.value === 0),
}

/**
 * Registration Store
 *
 * Manages SIP registration state with auto-refresh capabilities.
 */
export const registrationStore = {
  // ============================================================================
  // State Access (readonly to prevent direct mutation)
  // ============================================================================

  /**
   * Get current registration state
   */
  get state() {
    return state.state
  },

  /**
   * Get registered URI
   */
  get registeredUri() {
    return state.registeredUri
  },

  /**
   * Get registration expiry in seconds
   */
  get expires() {
    return state.expires
  },

  /**
   * Get last registration time
   */
  get lastRegistrationTime() {
    return state.lastRegistrationTime
  },

  /**
   * Get expiry time
   */
  get expiryTime() {
    return state.expiryTime
  },

  /**
   * Get retry count
   */
  get retryCount() {
    return state.retryCount
  },

  /**
   * Get last error
   */
  get lastError() {
    return state.lastError
  },

  /**
   * Check if registered
   */
  get isRegistered() {
    return computed_values.isRegistered.value
  },

  /**
   * Check if registering
   */
  get isRegistering() {
    return computed_values.isRegistering.value
  },

  /**
   * Check if unregistering
   */
  get isUnregistering() {
    return computed_values.isUnregistering.value
  },

  /**
   * Check if registration failed
   */
  get hasRegistrationFailed() {
    return computed_values.hasRegistrationFailed.value
  },

  /**
   * Get seconds until expiry
   */
  get secondsUntilExpiry() {
    return computed_values.secondsUntilExpiry.value
  },

  /**
   * Check if expiring soon
   */
  get isExpiringSoon() {
    return computed_values.isExpiringSoon.value
  },

  /**
   * Check if expired
   */
  get hasExpired() {
    return computed_values.hasExpired.value
  },

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Set registration state to Registering
   *
   * @param uri - SIP URI being registered
   */
  setRegistering(uri: string): void {
    state.state = RegistrationState.Registering
    state.registeredUri = uri
    state.lastError = null
    log.debug(`Registration started for ${uri}`)
  },

  /**
   * Set registration state to Registered
   *
   * @param uri - Registered SIP URI
   * @param expires - Registration expiry time in seconds (default: 600)
   */
  setRegistered(uri: string, expires?: number): void {
    const expirySeconds = expires || state.expires
    const now = new Date()

    state.state = RegistrationState.Registered
    state.registeredUri = uri
    state.expires = expirySeconds
    state.lastRegistrationTime = now
    state.expiryTime = new Date(now.getTime() + expirySeconds * 1000)
    state.retryCount = 0
    state.lastError = null

    log.info(`Registered ${uri} (expires in ${expirySeconds}s)`)

    // Setup auto-refresh timer (refresh at 90% of expiry time)
    this.setupAutoRefresh()
  },

  /**
   * Set registration state to RegistrationFailed
   *
   * @param error - Error message
   */
  setRegistrationFailed(error: string): void {
    state.state = RegistrationState.RegistrationFailed
    state.lastError = error
    state.retryCount++
    state.expiryTime = null

    log.error(`Registration failed: ${error} (retry count: ${state.retryCount})`)

    // Clear auto-refresh timer
    this.clearAutoRefresh()
  },

  /**
   * Set registration state to Unregistering
   */
  setUnregistering(): void {
    state.state = RegistrationState.Unregistering
    state.lastError = null
    log.debug('Unregistration started')

    // Clear auto-refresh timer
    this.clearAutoRefresh()
  },

  /**
   * Set registration state to Unregistered
   */
  setUnregistered(): void {
    state.state = RegistrationState.Unregistered
    state.registeredUri = null
    state.expiryTime = null
    state.lastError = null
    log.info('Unregistered')

    // Clear auto-refresh timer
    this.clearAutoRefresh()
  },

  // ============================================================================
  // Auto-Refresh Logic
  // ============================================================================

  /**
   * Setup auto-refresh timer
   *
   * Schedules a refresh at 90% of the expiry time to ensure registration
   * doesn't expire. This follows best practices for SIP registration refresh.
   */
  setupAutoRefresh(): void {
    // Clear any existing timer
    this.clearAutoRefresh()

    if (!state.expiryTime || state.expires <= 0) {
      log.debug('Cannot setup auto-refresh: no expiry time set')
      return
    }

    // Calculate refresh time (90% of expiry time)
    const refreshPercentage = 0.9
    const refreshDelay = state.expires * refreshPercentage * 1000

    log.debug(
      `Setting up auto-refresh in ${Math.floor(refreshDelay / 1000)}s (90% of ${state.expires}s)`
    )

    state.autoRefreshTimerId = window.setTimeout(() => {
      log.info('Auto-refresh timer triggered')
      this.triggerRefresh()
    }, refreshDelay)
  },

  /**
   * Clear auto-refresh timer
   */
  clearAutoRefresh(): void {
    if (state.autoRefreshTimerId !== null) {
      clearTimeout(state.autoRefreshTimerId)
      state.autoRefreshTimerId = null
      log.debug('Cleared auto-refresh timer')
    }
  },

  /**
   * Trigger refresh callback
   *
   * This is a placeholder that should be called when auto-refresh is needed.
   * The actual SIP client should listen for this and perform the refresh.
   *
   * @internal
   */
  triggerRefresh(): void {
    log.info('Registration refresh needed')
    // This will be handled by the SipClient or composable
    // They should listen for state changes or implement a callback mechanism
  },

  /**
   * Manually trigger a refresh
   *
   * Forces an immediate registration refresh. This can be called by the
   * SipClient or composable when needed.
   */
  manualRefresh(): void {
    log.info('Manual registration refresh requested')
    this.clearAutoRefresh()
    // The caller should perform the actual refresh after calling this
  },

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set default expiry time
   *
   * @param expires - Expiry time in seconds (must be > 0)
   */
  setDefaultExpiry(expires: number): void {
    if (expires <= 0) {
      log.warn('Expiry must be greater than 0, ignoring')
      return
    }
    state.expires = expires
    log.debug(`Default expiry set to ${expires}s`)
  },

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Reset retry count
   */
  resetRetryCount(): void {
    state.retryCount = 0
    log.debug('Reset retry count')
  },

  /**
   * Increment retry count
   *
   * @returns New retry count
   */
  incrementRetryCount(): number {
    state.retryCount++
    log.debug(`Retry count incremented to ${state.retryCount}`)
    return state.retryCount
  },

  /**
   * Reset the store to initial state
   */
  reset(): void {
    this.clearAutoRefresh()
    state.state = RegistrationState.Unregistered
    state.registeredUri = null
    state.expires = DEFAULT_REGISTER_EXPIRES
    state.lastRegistrationTime = null
    state.expiryTime = null
    state.retryCount = 0
    state.lastError = null
    state._timeTrigger = 0
    log.info('Registration store reset to initial state')
  },

  /**
   * Trigger time-based computed properties to re-evaluate
   * (Internal method for testing with fake timers)
   */
  _triggerTimeUpdate(): void {
    state._timeTrigger++
  },

  /**
   * Get store statistics
   *
   * @returns Object with store statistics
   */
  getStatistics() {
    return {
      state: state.state,
      registeredUri: state.registeredUri,
      isRegistered: computed_values.isRegistered.value,
      expires: state.expires,
      secondsUntilExpiry: computed_values.secondsUntilExpiry.value,
      retryCount: state.retryCount,
      hasAutoRefreshTimer: state.autoRefreshTimerId !== null,
      lastError: state.lastError,
    }
  },
}
