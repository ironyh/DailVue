/**
 * Presence Composable
 *
 * Provides SIP presence (SUBSCRIBE/NOTIFY) functionality for tracking user
 * status (available, away, busy, offline) and watching other users' presence.
 *
 * @module composables/usePresence
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { SipClient } from '../core/SipClient'
import {
  PresenceState,
  type PresenceStatus,
  type PresenceSubscription,
  type PresenceEvent,
  type PresencePublishOptions,
  type PresenceSubscriptionOptions,
} from '../types/presence.types'
import { createLogger } from '../utils/logger'
import { validateSipUri } from '../utils/validators'
import { PRESENCE_CONSTANTS } from './constants'

const log = createLogger('usePresence')

/**
 * Return type for usePresence composable
 */
export interface UsePresenceReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Current user's presence status */
  currentStatus: Ref<PresenceStatus | null>
  /** Map of watched users and their presence status */
  watchedUsers: Ref<Map<string, PresenceStatus>>
  /** Active subscriptions */
  subscriptions: Ref<Map<string, PresenceSubscription>>
  /** Current presence state */
  currentState: ComputedRef<PresenceState>
  /** Number of active subscriptions */
  subscriptionCount: ComputedRef<number>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Set own presence status */
  setStatus: (state: PresenceState, options?: PresencePublishOptions) => Promise<void>
  /** Subscribe to user's presence */
  subscribe: (uri: string, options?: PresenceSubscriptionOptions) => Promise<string>
  /** Unsubscribe from user's presence */
  unsubscribe: (uri: string) => Promise<void>
  /** Get presence status for a specific user */
  getStatus: (uri: string) => PresenceStatus | null
  /** Unsubscribe from all watched users */
  unsubscribeAll: () => Promise<void>
  /** Listen for presence events */
  onPresenceEvent: (callback: (event: PresenceEvent) => void) => () => void
}

/**
 * Presence Composable
 *
 * Manages SIP presence functionality using SUBSCRIBE/NOTIFY/PUBLISH methods.
 * Allows setting own status and watching other users' status.
 *
 * @param sipClient - SIP client instance
 * @returns Presence state and methods
 *
 * @example
 * ```typescript
 * const { setStatus, subscribe, watchedUsers } = usePresence(sipClient)
 *
 * // Set own status
 * await setStatus(PresenceState.Available, {
 *   statusMessage: 'Working on project'
 * })
 *
 * // Watch another user
 * await subscribe('sip:alice@domain.com')
 *
 * // Check their status
 * watchedUsers.value.forEach((status, uri) => {
 *   console.log(`${uri}: ${status.state}`)
 * })
 * ```
 */
export function usePresence(sipClient: Ref<SipClient | null>): UsePresenceReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  const currentStatus = ref<PresenceStatus | null>(null)
  const watchedUsers = ref<Map<string, PresenceStatus>>(new Map())
  const subscriptions = ref<Map<string, PresenceSubscription>>(new Map())
  const presenceEventListeners = ref<Array<(event: PresenceEvent) => void>>([])

  // Auto-refresh timers for subscriptions
  const refreshTimers = new Map<string, number>()

  // ============================================================================
  // Computed Values
  // ============================================================================

  const currentState = computed(() => currentStatus.value?.state || PresenceState.Offline)
  const subscriptionCount = computed(() => subscriptions.value.size)

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Emit presence event
   */
  const emitPresenceEvent = (event: PresenceEvent): void => {
    log.debug('Presence event:', event)
    presenceEventListeners.value.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        log.error('Error in presence event listener:', error)
      }
    })
  }

  /**
   * Handle presence notification
   */
  const handlePresenceNotification = (uri: string, status: PresenceStatus): void => {
    log.debug(`Presence update for ${uri}:`, status)

    // Update watched users map
    watchedUsers.value.set(uri, status)

    // Update subscription last status
    const subscription = subscriptions.value.get(uri)
    if (subscription) {
      subscription.lastStatus = status
    }

    // Emit event
    emitPresenceEvent({
      type: 'updated',
      uri,
      status,
      timestamp: new Date(),
    })
  }

  // ============================================================================
  // Presence Publishing (Own Status)
  // ============================================================================

  /**
   * Set own presence status
   *
   * Publishes presence status to SIP server using PUBLISH method.
   *
   * @param state - Presence state to set
   * @param options - Publish options
   * @throws Error if SIP client not initialized or publish fails
   */
  const setStatus = async (
    state: PresenceState,
    options: Omit<PresencePublishOptions, 'state'> = {}
  ): Promise<void> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    try {
      log.info(`Setting presence status to ${state}`)

      const { statusMessage, expires = PRESENCE_CONSTANTS.DEFAULT_EXPIRES, extraHeaders } = options

      // Publish presence via SIP client
      await sipClient.value.publishPresence({
        state,
        statusMessage,
        expires,
        extraHeaders,
      })

      // Update current status
      currentStatus.value = {
        uri: sipClient.value.getConfig().uri,
        state,
        statusMessage,
        lastUpdated: new Date(),
      }

      log.info('Presence status updated successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set presence status'
      log.error('Failed to set presence status:', errorMessage)
      throw error
    }
  }

  // ============================================================================
  // Presence Subscription (Watching Others)
  // ============================================================================

  /**
   * Subscribe to user's presence
   *
   * Creates a subscription to monitor another user's presence status.
   * Receives NOTIFY messages when their status changes.
   *
   * @param uri - Target user URI to watch
   * @param options - Subscription options
   * @returns Subscription ID
   * @throws Error if SIP client not initialized or subscription fails
   */
  const subscribe = async (
    uri: string,
    options: PresenceSubscriptionOptions = {}
  ): Promise<string> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    // Validate target URI
    const uriValidation = validateSipUri(uri)
    if (!uriValidation.valid) {
      const error = `Invalid target URI: ${uriValidation.error}`
      log.error(error, { uri, validation: uriValidation })
      throw new Error(error)
    }

    // Check if already subscribed
    if (subscriptions.value.has(uri)) {
      log.warn(`Already subscribed to ${uri}`)
      return subscriptions.value.get(uri)!.id
    }

    try {
      log.info(`Subscribing to presence of ${uri}`)

      const { expires = PRESENCE_CONSTANTS.DEFAULT_EXPIRES, extraHeaders } = options

      // Create subscription ID
      const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Create subscription record
      const subscription: PresenceSubscription = {
        id: subscriptionId,
        targetUri: uri,
        state: 'pending',
        expires,
      }

      subscriptions.value.set(uri, subscription)

      // Subscribe via SIP client
      await sipClient.value.subscribePresence(uri, {
        expires,
        extraHeaders,
        onNotify: (status: PresenceStatus) => {
          handlePresenceNotification(uri, status)
        },
      })

      // Update subscription state
      subscription.state = 'active'

      // Setup auto-refresh (at 90% of expiry time)
      setupSubscriptionRefresh(uri, expires)

      // Emit event
      emitPresenceEvent({
        type: 'subscribed',
        uri,
        subscription,
        timestamp: new Date(),
      })

      log.info(`Successfully subscribed to ${uri}`)
      return subscriptionId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Subscription failed'
      log.error(`Failed to subscribe to ${uri}:`, errorMessage)

      // Remove failed subscription
      subscriptions.value.delete(uri)

      // Emit error event
      emitPresenceEvent({
        type: 'error',
        uri,
        timestamp: new Date(),
        error: errorMessage,
      })

      throw error
    }
  }

  /**
   * Setup subscription auto-refresh
   */
  const setupSubscriptionRefresh = (uri: string, expires: number): void => {
    // Clear any existing timer
    const existingTimer = refreshTimers.get(uri)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Setup new timer (refresh at 90% of expiry time)
    const refreshDelay = expires * PRESENCE_CONSTANTS.SUBSCRIPTION_REFRESH_PERCENTAGE * 1000

    const timerId = window.setTimeout(async () => {
      log.info(`Auto-refreshing subscription to ${uri}`)
      try {
        // Unsubscribe and re-subscribe
        await unsubscribe(uri)
        await subscribe(uri, { expires })
      } catch (error) {
        log.error(`Failed to refresh subscription to ${uri}:`, error)
      }
    }, refreshDelay)

    refreshTimers.set(uri, timerId)
  }

  /**
   * Unsubscribe from user's presence
   *
   * Terminates subscription to a user's presence.
   *
   * @param uri - Target user URI to stop watching
   * @throws Error if SIP client not initialized or unsubscription fails
   */
  const unsubscribe = async (uri: string): Promise<void> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    // Validate target URI
    const uriValidation = validateSipUri(uri)
    if (!uriValidation.valid) {
      const error = `Invalid target URI: ${uriValidation.error}`
      log.error(error, { uri, validation: uriValidation })
      throw new Error(error)
    }

    const subscription = subscriptions.value.get(uri)
    if (!subscription) {
      log.warn(`No active subscription for ${uri}`)
      return
    }

    try {
      log.info(`Unsubscribing from ${uri}`)

      // Unsubscribe via SIP client (send SUBSCRIBE with Expires: 0)
      await sipClient.value.unsubscribePresence(uri)

      // Clear refresh timer
      const timerId = refreshTimers.get(uri)
      if (timerId) {
        clearTimeout(timerId)
        refreshTimers.delete(uri)
      }

      // Update subscription state
      subscription.state = 'terminated'

      // Remove subscription and status
      subscriptions.value.delete(uri)
      watchedUsers.value.delete(uri)

      // Emit event
      emitPresenceEvent({
        type: 'unsubscribed',
        uri,
        subscription,
        timestamp: new Date(),
      })

      log.info(`Successfully unsubscribed from ${uri}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unsubscription failed'
      log.error(`Failed to unsubscribe from ${uri}:`, errorMessage)
      throw error
    }
  }

  /**
   * Unsubscribe from all watched users
   */
  const unsubscribeAll = async (): Promise<void> => {
    log.info('Unsubscribing from all watched users')

    const promises: Promise<void>[] = []
    subscriptions.value.forEach((_, uri) => {
      promises.push(
        unsubscribe(uri).catch((error) => {
          log.error(`Failed to unsubscribe from ${uri}:`, error)
        })
      )
    })

    await Promise.allSettled(promises)
    log.info('Unsubscribed from all users')
  }

  /**
   * Get presence status for a specific user
   */
  const getStatus = (uri: string): PresenceStatus | null => {
    // Validate target URI
    const uriValidation = validateSipUri(uri)
    if (!uriValidation.valid) {
      log.warn(`Invalid target URI for getStatus: ${uriValidation.error}`, { uri })
      return null
    }

    return watchedUsers.value.get(uri) || null
  }

  /**
   * Listen for presence events
   */
  const onPresenceEvent = (callback: (event: PresenceEvent) => void): (() => void) => {
    presenceEventListeners.value.push(callback)

    // Return unsubscribe function
    return () => {
      const index = presenceEventListeners.value.indexOf(callback)
      if (index !== -1) {
        presenceEventListeners.value.splice(index, 1)
      }
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(async () => {
    log.debug('Composable unmounting, unsubscribing from all presence')

    // Clear all refresh timers
    refreshTimers.forEach((timerId) => clearTimeout(timerId))
    refreshTimers.clear()

    // Unsubscribe from all
    await unsubscribeAll().catch((error) => {
      log.error('Error during cleanup:', error)
    })

    // Clear event listeners
    presenceEventListeners.value = []
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    currentStatus,
    watchedUsers,
    subscriptions,
    currentState,
    subscriptionCount,

    // Methods
    setStatus,
    subscribe,
    unsubscribe,
    getStatus,
    unsubscribeAll,
    onPresenceEvent,
  }
}
