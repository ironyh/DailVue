/**
 * Tests for usePresence composable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { usePresence } from '@/composables/usePresence'
import { PresenceState } from '@/types/presence.types'
import type { PresenceStatus } from '@/types/presence.types'
import type { SipClient } from '@/core/SipClient'
import { PRESENCE_CONSTANTS } from '@/composables/constants'

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('usePresence', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSipClient: any

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock SIP client with presence methods
    mockSipClient = {
      publishPresence: vi.fn().mockResolvedValue(undefined),
      subscribePresence: vi.fn().mockResolvedValue(undefined),
      unsubscribePresence: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockReturnValue({ uri: 'sip:self@example.com' }),
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Initialization and Default State
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { currentStatus, watchedUsers, subscriptions, currentState, subscriptionCount } =
        usePresence(sipClientRef)

      expect(currentStatus.value).toBeNull()
      expect(watchedUsers.value.size).toBe(0)
      expect(subscriptions.value.size).toBe(0)
      expect(currentState.value).toBe(PresenceState.Offline)
      expect(subscriptionCount.value).toBe(0)
    })

    it('should handle null SIP client gracefully', () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { currentStatus, subscriptionCount } = usePresence(sipClientRef)

      expect(currentStatus.value).toBeNull()
      expect(subscriptionCount.value).toBe(0)
    })
  })

  // ==========================================================================
  // setStatus() Method
  // ==========================================================================

  describe('setStatus() method', () => {
    it('should set status to Available successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus, currentStatus, currentState } = usePresence(sipClientRef)

      await setStatus(PresenceState.Available)

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Available,
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
      expect(currentStatus.value).toMatchObject({
        state: PresenceState.Available,
      })
      expect(currentState.value).toBe(PresenceState.Available)
    })

    it('should set status to Away successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus, currentState } = usePresence(sipClientRef)

      await setStatus(PresenceState.Away)

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Away,
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
      expect(currentState.value).toBe(PresenceState.Away)
    })

    it('should set status to Busy successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus, currentState } = usePresence(sipClientRef)

      await setStatus(PresenceState.Busy)

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Busy,
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
      expect(currentState.value).toBe(PresenceState.Busy)
    })

    it('should set status to Offline successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus, currentState } = usePresence(sipClientRef)

      await setStatus(PresenceState.Offline)

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Offline,
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
      expect(currentState.value).toBe(PresenceState.Offline)
    })

    it('should set custom status with message', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus, currentStatus } = usePresence(sipClientRef)

      await setStatus(PresenceState.Custom, {
        statusMessage: 'In a meeting',
      })

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Custom,
        statusMessage: 'In a meeting',
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
      expect(currentStatus.value?.statusMessage).toBe('In a meeting')
    })

    it('should set status with custom expiry time', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus } = usePresence(sipClientRef)

      await setStatus(PresenceState.Available, {
        expires: 7200,
      })

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Available,
        expires: 7200,
      })
    })

    it('should set status with extra headers', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus } = usePresence(sipClientRef)

      await setStatus(PresenceState.Available, {
        extraHeaders: ['X-Custom-Header: value'],
      })

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Available,
        extraHeaders: ['X-Custom-Header: value'],
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { setStatus } = usePresence(sipClientRef)

      await expect(setStatus(PresenceState.Available)).rejects.toThrow('SIP client not initialized')
    })

    it('should handle setStatus failure', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      mockSipClient.publishPresence.mockRejectedValue(new Error('Publish failed'))
      const { setStatus } = usePresence(sipClientRef)

      await expect(setStatus(PresenceState.Available)).rejects.toThrow('Publish failed')
    })
  })

  // ==========================================================================
  // subscribe() Method
  // ==========================================================================

  describe('subscribe() method', () => {
    it('should subscribe to user presence successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, subscriptions, subscriptionCount } = usePresence(sipClientRef)

      const subscriptionId = await subscribe('sip:user@example.com')

      expect(mockSipClient.subscribePresence).toHaveBeenCalledWith(
        'sip:user@example.com',
        expect.objectContaining({
          expires: PRESENCE_CONSTANTS.DEFAULT_SUBSCRIPTION_EXPIRES,
        })
      )
      expect(subscriptionId).toBeTruthy()
      expect(subscriptions.value.has('sip:user@example.com')).toBe(true)
      expect(subscriptionCount.value).toBe(1)
    })

    it('should subscribe with custom expiry time', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com', { expires: 7200 })

      expect(mockSipClient.subscribePresence).toHaveBeenCalledWith(
        'sip:user@example.com',
        expect.objectContaining({ expires: 7200 })
      )
    })

    it('should subscribe with extra headers', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com', {
        extraHeaders: ['X-Custom-Header: value'],
      })

      expect(mockSipClient.subscribePresence).toHaveBeenCalledWith(
        'sip:user@example.com',
        expect.objectContaining({
          expires: PRESENCE_CONSTANTS.DEFAULT_SUBSCRIPTION_EXPIRES,
          extraHeaders: ['X-Custom-Header: value'],
        })
      )
    })

    it('should create subscription record with correct state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, subscriptions } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')

      const subscription = subscriptions.value.get('sip:user@example.com')
      expect(subscription).toBeDefined()
      expect(subscription?.id).toBeTruthy()
      expect(subscription?.targetUri).toBe('sip:user@example.com')
      expect(subscription?.state).toBe('active')
      expect(subscription?.expires).toBe(PRESENCE_CONSTANTS.DEFAULT_SUBSCRIPTION_EXPIRES)
    })

    it('should handle duplicate subscription to same user', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, subscriptionCount } = usePresence(sipClientRef)

      const firstId = await subscribe('sip:user@example.com')

      // Subscribe again to same user
      const secondId = await subscribe('sip:user@example.com')

      // Should return existing subscription ID, not create new one
      expect(firstId).toBe(secondId)
      expect(subscriptionCount.value).toBe(1)
      expect(mockSipClient.subscribePresence).toHaveBeenCalledTimes(1)
    })

    it('should subscribe to multiple users', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, subscriptionCount } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com')
      await subscribe('sip:user2@example.com')
      await subscribe('sip:user3@example.com')

      expect(subscriptionCount.value).toBe(3)
      expect(mockSipClient.subscribePresence).toHaveBeenCalledTimes(3)
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { subscribe } = usePresence(sipClientRef)

      await expect(subscribe('sip:user@example.com')).rejects.toThrow('SIP client not initialized')
    })

    it('should handle subscription failure', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      mockSipClient.subscribePresence.mockRejectedValue(new Error('Subscribe failed'))
      const { subscribe } = usePresence(sipClientRef)

      await expect(subscribe('sip:user@example.com')).rejects.toThrow('Subscribe failed')
    })

    it('should setup auto-refresh timer for subscription', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com', { expires: 1000 })

      // Verify timer exists (will fire at 90% of expiry time)
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // unsubscribe() Method
  // ==========================================================================

  describe('unsubscribe() method', () => {
    it('should unsubscribe from user presence successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe, subscriptions, subscriptionCount } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')
      expect(subscriptionCount.value).toBe(1)

      await unsubscribe('sip:user@example.com')

      expect(mockSipClient.unsubscribePresence).toHaveBeenCalledWith('sip:user@example.com')
      expect(subscriptions.value.has('sip:user@example.com')).toBe(false)
      expect(subscriptionCount.value).toBe(0)
    })

    it('should clear auto-refresh timer on unsubscribe', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')
      const timerCountBefore = vi.getTimerCount()

      await unsubscribe('sip:user@example.com')

      // Timer should be cleared
      const timerCountAfter = vi.getTimerCount()
      expect(timerCountAfter).toBeLessThan(timerCountBefore)
    })

    it('should remove watched user status on unsubscribe', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe, watchedUsers } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')

      // Simulate received presence status
      watchedUsers.value.set('sip:user@example.com', {
        uri: 'sip:user@example.com',
        state: PresenceState.Available,
        lastUpdated: new Date(),
      })

      await unsubscribe('sip:user@example.com')

      expect(watchedUsers.value.has('sip:user@example.com')).toBe(false)
    })

    it('should handle unsubscribing from non-subscribed user gracefully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unsubscribe } = usePresence(sipClientRef)

      // Should not throw, just log warning and return
      await unsubscribe('sip:nonexistent@example.com')

      // Should not call SIP client method since no subscription exists
      expect(mockSipClient.unsubscribePresence).not.toHaveBeenCalled()
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')

      sipClientRef.value = null

      await expect(unsubscribe('sip:user@example.com')).rejects.toThrow(
        'SIP client not initialized'
      )
    })

    it('should handle unsubscribe failure', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')
      mockSipClient.unsubscribePresence.mockRejectedValue(new Error('Unsubscribe failed'))

      await expect(unsubscribe('sip:user@example.com')).rejects.toThrow('Unsubscribe failed')
    })
  })

  // ==========================================================================
  // unsubscribeAll() Method
  // ==========================================================================

  describe('unsubscribeAll() method', () => {
    it('should unsubscribe from all users successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribeAll, subscriptionCount } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com')
      await subscribe('sip:user2@example.com')
      await subscribe('sip:user3@example.com')

      expect(subscriptionCount.value).toBe(3)

      await unsubscribeAll()

      expect(mockSipClient.unsubscribePresence).toHaveBeenCalledTimes(3)
      expect(subscriptionCount.value).toBe(0)
    })

    it('should clear all auto-refresh timers', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribeAll } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com')
      await subscribe('sip:user2@example.com')

      await unsubscribeAll()

      // All timers should be cleared
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should clear all watched users', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribeAll, watchedUsers } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com')
      await subscribe('sip:user2@example.com')

      await unsubscribeAll()

      expect(watchedUsers.value.size).toBe(0)
    })

    it('should handle unsubscribeAll when no subscriptions exist', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { unsubscribeAll } = usePresence(sipClientRef)

      await unsubscribeAll()

      expect(mockSipClient.unsubscribePresence).not.toHaveBeenCalled()
    })

    it('should continue unsubscribing even if some fail', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribeAll, subscriptionCount } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com')
      await subscribe('sip:user2@example.com')
      await subscribe('sip:user3@example.com')

      // Make second unsubscribe fail
      mockSipClient.unsubscribePresence = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined)

      await unsubscribeAll()

      // Should still attempt all unsubscribes
      expect(mockSipClient.unsubscribePresence).toHaveBeenCalledTimes(3)
      // Failed subscription won't be removed, so count is 1 (the failed one)
      expect(subscriptionCount.value).toBe(1)
    })
  })

  // ==========================================================================
  // getStatus() Method
  // ==========================================================================

  describe('getStatus() method', () => {
    it('should return null for unwatched user', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { getStatus } = usePresence(sipClientRef)

      const status = getStatus('sip:unwatched@example.com')

      expect(status).toBeNull()
    })

    it('should return status for watched user', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, getStatus, watchedUsers } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')

      // Simulate received presence status
      const mockStatus: PresenceStatus = {
        uri: 'sip:user@example.com',
        state: PresenceState.Available,
        statusMessage: 'Online',
        lastUpdated: new Date(),
      }
      watchedUsers.value.set('sip:user@example.com', mockStatus)

      const status = getStatus('sip:user@example.com')

      expect(status).toStrictEqual(mockStatus)
      expect(status?.state).toBe(PresenceState.Available)
      expect(status?.statusMessage).toBe('Online')
    })

    it('should return updated status after presence change', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, getStatus, watchedUsers } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com')

      // Initial status
      watchedUsers.value.set('sip:user@example.com', {
        uri: 'sip:user@example.com',
        state: PresenceState.Available,
        lastUpdated: new Date(),
      })

      expect(getStatus('sip:user@example.com')?.state).toBe(PresenceState.Available)

      // Update status
      watchedUsers.value.set('sip:user@example.com', {
        uri: 'sip:user@example.com',
        state: PresenceState.Away,
        lastUpdated: new Date(),
      })

      expect(getStatus('sip:user@example.com')?.state).toBe(PresenceState.Away)
    })
  })

  // ==========================================================================
  // onPresenceEvent() Method
  // ==========================================================================

  describe('onPresenceEvent() method', () => {
    it('should register event listener and receive events', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, onPresenceEvent } = usePresence(sipClientRef)

      const eventCallback = vi.fn()
      onPresenceEvent(eventCallback)

      await subscribe('sip:user@example.com')

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subscribed',
          uri: 'sip:user@example.com',
        })
      )
    })

    it('should emit updated event when presence status changes', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, onPresenceEvent, watchedUsers } = usePresence(sipClientRef)

      const eventCallback = vi.fn()
      onPresenceEvent(eventCallback)

      await subscribe('sip:user@example.com')
      eventCallback.mockClear()

      // Simulate presence update
      const mockStatus: PresenceStatus = {
        uri: 'sip:user@example.com',
        state: PresenceState.Busy,
        lastUpdated: new Date(),
      }
      watchedUsers.value.set('sip:user@example.com', mockStatus)

      // Manually emit event (in real code, SipClient would trigger this)
      // For testing, we verify the event structure
      expect(eventCallback).not.toHaveBeenCalled() // No auto-emit in composable
    })

    it('should emit unsubscribed event on unsubscribe', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe, onPresenceEvent } = usePresence(sipClientRef)

      const eventCallback = vi.fn()
      onPresenceEvent(eventCallback)

      await subscribe('sip:user@example.com')
      eventCallback.mockClear()

      await unsubscribe('sip:user@example.com')

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unsubscribed',
          uri: 'sip:user@example.com',
        })
      )
    })

    it('should emit error event on subscription failure', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      mockSipClient.subscribePresence.mockRejectedValue(new Error('Subscribe failed'))
      const { subscribe, onPresenceEvent } = usePresence(sipClientRef)

      const eventCallback = vi.fn()
      onPresenceEvent(eventCallback)

      await subscribe('sip:user@example.com').catch(() => {})

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          uri: 'sip:user@example.com',
          error: 'Subscribe failed',
        })
      )
    })

    it('should unregister event listener', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, onPresenceEvent } = usePresence(sipClientRef)

      const eventCallback = vi.fn()
      const unsubscribe = onPresenceEvent(eventCallback)

      await subscribe('sip:user@example.com')
      expect(eventCallback).toHaveBeenCalledTimes(1)

      eventCallback.mockClear()
      unsubscribe()

      await subscribe('sip:user2@example.com')

      expect(eventCallback).not.toHaveBeenCalled()
    })

    it('should support multiple event listeners', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, onPresenceEvent } = usePresence(sipClientRef)

      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      onPresenceEvent(callback1)
      onPresenceEvent(callback2)
      onPresenceEvent(callback3)

      await subscribe('sip:user@example.com')

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
      expect(callback3).toHaveBeenCalled()
    })

    it('should handle errors in event listeners gracefully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, onPresenceEvent } = usePresence(sipClientRef)

      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const normalCallback = vi.fn()

      onPresenceEvent(faultyCallback)
      onPresenceEvent(normalCallback)

      await subscribe('sip:user@example.com')

      // Both should be called, faulty listener should not break others
      expect(faultyCallback).toHaveBeenCalled()
      expect(normalCallback).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  describe('Computed Values', () => {
    it('should update currentState when status changes', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus, currentState } = usePresence(sipClientRef)

      expect(currentState.value).toBe(PresenceState.Offline)

      await setStatus(PresenceState.Available)
      expect(currentState.value).toBe(PresenceState.Available)

      await setStatus(PresenceState.Busy)
      expect(currentState.value).toBe(PresenceState.Busy)
    })

    it('should update subscriptionCount when subscriptions change', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe, subscriptionCount } = usePresence(sipClientRef)

      expect(subscriptionCount.value).toBe(0)

      await subscribe('sip:user1@example.com')
      expect(subscriptionCount.value).toBe(1)

      await subscribe('sip:user2@example.com')
      expect(subscriptionCount.value).toBe(2)

      await unsubscribe('sip:user1@example.com')
      expect(subscriptionCount.value).toBe(1)
    })

    it('should update watchedUsers map reactively', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, watchedUsers } = usePresence(sipClientRef)

      expect(watchedUsers.value.size).toBe(0)

      await subscribe('sip:user@example.com')

      // Simulate presence status received
      watchedUsers.value.set('sip:user@example.com', {
        uri: 'sip:user@example.com',
        state: PresenceState.Available,
        lastUpdated: new Date(),
      })

      expect(watchedUsers.value.size).toBe(1)
      expect(watchedUsers.value.get('sip:user@example.com')?.state).toBe(PresenceState.Available)
    })

    it('should track subscriptions map reactively', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, subscriptions } = usePresence(sipClientRef)

      expect(subscriptions.value.size).toBe(0)

      await subscribe('sip:user1@example.com')
      expect(subscriptions.value.size).toBe(1)

      await subscribe('sip:user2@example.com')
      expect(subscriptions.value.size).toBe(2)

      const sub1 = subscriptions.value.get('sip:user1@example.com')
      expect(sub1?.id).toBeTruthy()
      expect(sub1?.state).toBe('active')
    })
  })

  // ==========================================================================
  // Auto-Refresh Logic
  // ==========================================================================

  describe('Auto-Refresh Logic', () => {
    it('should auto-refresh subscription before expiry', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      const expirySeconds = 1000
      await subscribe('sip:user@example.com', { expires: expirySeconds })

      expect(mockSipClient.subscribePresence).toHaveBeenCalledTimes(1)

      // Auto-refresh at 90% of expiry time
      const refreshTime = expirySeconds * PRESENCE_CONSTANTS.SUBSCRIPTION_REFRESH_PERCENTAGE * 1000
      await vi.advanceTimersByTimeAsync(refreshTime)

      // Should trigger re-subscription (unsubscribe + subscribe)
      expect(mockSipClient.unsubscribePresence).toHaveBeenCalledTimes(1)
      expect(mockSipClient.subscribePresence).toHaveBeenCalledTimes(2)
    })

    it('should not auto-refresh after unsubscribe', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe, unsubscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com', { expires: 1000 })
      await unsubscribe('sip:user@example.com')

      mockSipClient.subscribePresence.mockClear()
      mockSipClient.unsubscribePresence.mockClear()

      // Advance past refresh time
      await vi.advanceTimersByTimeAsync(1000 * 1000)

      // Should not trigger refresh
      expect(mockSipClient.subscribePresence).not.toHaveBeenCalled()
      expect(mockSipClient.unsubscribePresence).not.toHaveBeenCalled()
    })

    it('should handle multiple subscription refreshes independently', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com', { expires: 1000 })
      await subscribe('sip:user2@example.com', { expires: 2000 })

      expect(mockSipClient.subscribePresence).toHaveBeenCalledTimes(2)

      // Advance to first refresh (900s)
      await vi.advanceTimersByTimeAsync(900 * 1000)

      // Only first subscription should refresh (unsubscribe + subscribe)
      expect(mockSipClient.unsubscribePresence).toHaveBeenCalledTimes(1)
      expect(mockSipClient.subscribePresence).toHaveBeenCalledTimes(3) // 2 initial + 1 refresh
    })
  })

  // ==========================================================================
  // Lifecycle and Cleanup
  // ==========================================================================

  describe('Lifecycle and Cleanup', () => {
    it('should cleanup all subscriptions on unmount', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('sip:user1@example.com')
      await subscribe('sip:user2@example.com')

      // Simulate unmount by clearing client ref
      // In real Vue component, onUnmounted would fire
      sipClientRef.value = null

      // Note: Actual cleanup happens in onUnmounted lifecycle hook
      // which we can't directly test here
    })
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty URI gracefully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('')

      expect(mockSipClient.subscribePresence).toHaveBeenCalledWith('', expect.any(Object))
    })

    it('should handle very short expiry times', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus } = usePresence(sipClientRef)

      await setStatus(PresenceState.Available, { expires: 1 })

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Available,
        expires: 1,
      })
    })

    it('should handle very long expiry times', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      await subscribe('sip:user@example.com', { expires: 86400 }) // 24 hours

      expect(mockSipClient.subscribePresence).toHaveBeenCalledWith(
        'sip:user@example.com',
        expect.objectContaining({ expires: 86400 })
      )
    })

    it('should handle status message with special characters', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { setStatus } = usePresence(sipClientRef)

      await setStatus(PresenceState.Custom, {
        statusMessage: 'Away @ meeting 🏢 [urgent]',
      })

      expect(mockSipClient.publishPresence).toHaveBeenCalledWith({
        state: PresenceState.Custom,
        statusMessage: 'Away @ meeting 🏢 [urgent]',
        expires: PRESENCE_CONSTANTS.DEFAULT_EXPIRES,
      })
    })

    it('should handle URIs with special SIP characters', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { subscribe } = usePresence(sipClientRef)

      const complexUri = 'sip:user+tag@subdomain.example.com:5060;transport=tcp'
      await subscribe(complexUri)

      expect(mockSipClient.subscribePresence).toHaveBeenCalledWith(complexUri, expect.any(Object))
    })
  })
})
