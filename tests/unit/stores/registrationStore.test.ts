/**
 * Registration Store Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { registrationStore } from '../../../src/stores/registrationStore'
import { RegistrationState } from '../../../src/types/sip.types'

describe('registrationStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    registrationStore.reset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should start in Unregistered state', () => {
      expect(registrationStore.state).toBe(RegistrationState.Unregistered)
      expect(registrationStore.isRegistered).toBe(false)
    })

    it('should have no registered URI', () => {
      expect(registrationStore.registeredUri).toBeNull()
    })

    it('should have default expiry', () => {
      expect(registrationStore.expires).toBe(600) // DEFAULT_REGISTER_EXPIRES
    })

    it('should have zero retry count', () => {
      expect(registrationStore.retryCount).toBe(0)
    })

    it('should have no last error', () => {
      expect(registrationStore.lastError).toBeNull()
    })
  })

  describe('State Transitions', () => {
    it('should transition to Registering state', () => {
      registrationStore.setRegistering('sip:alice@example.com')

      expect(registrationStore.state).toBe(RegistrationState.Registering)
      expect(registrationStore.isRegistering).toBe(true)
      expect(registrationStore.registeredUri).toBe('sip:alice@example.com')
      expect(registrationStore.lastError).toBeNull()
    })

    it('should transition to Registered state', () => {
      registrationStore.setRegistered('sip:alice@example.com', 600)

      expect(registrationStore.state).toBe(RegistrationState.Registered)
      expect(registrationStore.isRegistered).toBe(true)
      expect(registrationStore.registeredUri).toBe('sip:alice@example.com')
      expect(registrationStore.expires).toBe(600)
      expect(registrationStore.retryCount).toBe(0)
    })

    it('should set expiry time when registering', () => {
      const now = new Date()
      vi.setSystemTime(now)

      registrationStore.setRegistered('sip:alice@example.com', 600)

      expect(registrationStore.expiryTime).toBeTruthy()
      expect(registrationStore.lastRegistrationTime).toBeTruthy()

      const expectedExpiry = new Date(now.getTime() + 600 * 1000)
      expect(registrationStore.expiryTime?.getTime()).toBe(expectedExpiry.getTime())
    })

    it('should transition to RegistrationFailed state', () => {
      registrationStore.setRegistrationFailed('Connection timeout')

      expect(registrationStore.state).toBe(RegistrationState.RegistrationFailed)
      expect(registrationStore.hasRegistrationFailed).toBe(true)
      expect(registrationStore.lastError).toBe('Connection timeout')
      expect(registrationStore.retryCount).toBe(1)
    })

    it('should increment retry count on repeated failures', () => {
      registrationStore.setRegistrationFailed('Error 1')
      registrationStore.setRegistrationFailed('Error 2')
      registrationStore.setRegistrationFailed('Error 3')

      expect(registrationStore.retryCount).toBe(3)
    })

    it('should transition to Unregistering state', () => {
      registrationStore.setRegistered('sip:alice@example.com')
      registrationStore.setUnregistering()

      expect(registrationStore.state).toBe(RegistrationState.Unregistering)
      expect(registrationStore.isUnregistering).toBe(true)
    })

    it('should transition to Unregistered state', () => {
      registrationStore.setRegistered('sip:alice@example.com')
      registrationStore.setUnregistered()

      expect(registrationStore.state).toBe(RegistrationState.Unregistered)
      expect(registrationStore.registeredUri).toBeNull()
      expect(registrationStore.expiryTime).toBeNull()
    })
  })

  describe('Expiry Tracking', () => {
    it('should calculate seconds until expiry correctly', () => {
      const now = new Date()
      vi.setSystemTime(now)

      registrationStore.setRegistered('sip:alice@example.com', 600)

      expect(registrationStore.secondsUntilExpiry).toBe(600)

      // Advance time by 300 seconds
      vi.setSystemTime(new Date(now.getTime() + 300 * 1000))
      registrationStore._triggerTimeUpdate()
      expect(registrationStore.secondsUntilExpiry).toBe(300)
    })

    it('should detect when registration is expiring soon', () => {
      const now = new Date()
      vi.setSystemTime(now)

      registrationStore.setRegistered('sip:alice@example.com', 60)

      // Not expiring soon yet
      expect(registrationStore.isExpiringSoon).toBe(false)

      // Advance to 35 seconds remaining
      vi.setSystemTime(new Date(now.getTime() + 25 * 1000))
      registrationStore._triggerTimeUpdate()
      expect(registrationStore.secondsUntilExpiry).toBe(35)
      expect(registrationStore.isExpiringSoon).toBe(false)

      // Advance to 25 seconds remaining
      vi.setSystemTime(new Date(now.getTime() + 35 * 1000))
      registrationStore._triggerTimeUpdate()
      expect(registrationStore.secondsUntilExpiry).toBe(25)
      expect(registrationStore.isExpiringSoon).toBe(true)
    })

    it('should detect when registration has expired', () => {
      const now = new Date()
      vi.setSystemTime(now)

      registrationStore.setRegistered('sip:alice@example.com', 60)

      expect(registrationStore.hasExpired).toBe(false)

      // Advance past expiry
      vi.setSystemTime(new Date(now.getTime() + 61 * 1000))
      registrationStore._triggerTimeUpdate()
      expect(registrationStore.hasExpired).toBe(true)
    })

    it('should handle expiry time of zero gracefully', () => {
      expect(registrationStore.secondsUntilExpiry).toBe(0)
      expect(registrationStore.hasExpired).toBe(true)
    })
  })

  describe('Auto-Refresh', () => {
    it('should setup auto-refresh timer when registered', () => {
      const now = new Date()
      vi.setSystemTime(now)

      registrationStore.setRegistered('sip:alice@example.com', 100)

      // Timer should be set up for 90% of expiry (90 seconds)
      const stats = registrationStore.getStatistics()
      expect(stats.hasAutoRefreshTimer).toBe(true)
    })

    it('should trigger refresh at 90% of expiry time', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const triggerSpy = vi.spyOn(registrationStore, 'triggerRefresh')

      registrationStore.setRegistered('sip:alice@example.com', 100)

      // Advance to 90 seconds (90% of 100 seconds)
      vi.advanceTimersByTime(90 * 1000)

      expect(triggerSpy).toHaveBeenCalled()
    })

    it('should clear auto-refresh timer when unregistering', () => {
      registrationStore.setRegistered('sip:alice@example.com', 600)
      registrationStore.setUnregistering()

      const stats = registrationStore.getStatistics()
      expect(stats.hasAutoRefreshTimer).toBe(false)
    })

    it('should clear auto-refresh timer when registration fails', () => {
      registrationStore.setRegistered('sip:alice@example.com', 600)
      registrationStore.setRegistrationFailed('Network error')

      const stats = registrationStore.getStatistics()
      expect(stats.hasAutoRefreshTimer).toBe(false)
    })

    it('should allow manual refresh', () => {
      registrationStore.setRegistered('sip:alice@example.com', 600)

      // Manual refresh should clear timer
      registrationStore.manualRefresh()

      const stats = registrationStore.getStatistics()
      expect(stats.hasAutoRefreshTimer).toBe(false)
    })

    it('should replace existing timer when setting up new one', () => {
      registrationStore.setRegistered('sip:alice@example.com', 100)

      const stats1 = registrationStore.getStatistics()
      expect(stats1.hasAutoRefreshTimer).toBe(true)

      // Register again (should replace timer)
      registrationStore.setRegistered('sip:alice@example.com', 200)

      const stats2 = registrationStore.getStatistics()
      expect(stats2.hasAutoRefreshTimer).toBe(true)
    })
  })

  describe('Retry Management', () => {
    it('should reset retry count on successful registration', () => {
      registrationStore.setRegistrationFailed('Error 1')
      registrationStore.setRegistrationFailed('Error 2')

      expect(registrationStore.retryCount).toBe(2)

      registrationStore.setRegistered('sip:alice@example.com')

      expect(registrationStore.retryCount).toBe(0)
    })

    it('should allow manual retry count reset', () => {
      registrationStore.setRegistrationFailed('Error')
      registrationStore.setRegistrationFailed('Error')

      registrationStore.resetRetryCount()

      expect(registrationStore.retryCount).toBe(0)
    })

    it('should allow manual retry count increment', () => {
      const count1 = registrationStore.incrementRetryCount()
      expect(count1).toBe(1)

      const count2 = registrationStore.incrementRetryCount()
      expect(count2).toBe(2)
    })
  })

  describe('Configuration', () => {
    it('should set default expiry', () => {
      registrationStore.setDefaultExpiry(3600)

      expect(registrationStore.expires).toBe(3600)
    })

    it('should not allow setting expiry to 0 or negative', () => {
      registrationStore.setDefaultExpiry(600)
      registrationStore.setDefaultExpiry(0)

      expect(registrationStore.expires).toBe(600) // Should remain unchanged
    })

    it('should use default expiry if not specified in setRegistered', () => {
      registrationStore.setDefaultExpiry(300)
      registrationStore.setRegistered('sip:alice@example.com')

      expect(registrationStore.expires).toBe(300)
    })
  })

  describe('Store Reset', () => {
    it('should reset store to initial state', () => {
      registrationStore.setRegistered('sip:alice@example.com', 600)
      registrationStore.setRegistrationFailed('Error')

      registrationStore.reset()

      expect(registrationStore.state).toBe(RegistrationState.Unregistered)
      expect(registrationStore.registeredUri).toBeNull()
      expect(registrationStore.retryCount).toBe(0)
      expect(registrationStore.lastError).toBeNull()
      expect(registrationStore.expiryTime).toBeNull()

      const stats = registrationStore.getStatistics()
      expect(stats.hasAutoRefreshTimer).toBe(false)
    })
  })

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      registrationStore.setRegistered('sip:alice@example.com', 600)

      const stats = registrationStore.getStatistics()

      expect(stats.state).toBe(RegistrationState.Registered)
      expect(stats.registeredUri).toBe('sip:alice@example.com')
      expect(stats.isRegistered).toBe(true)
      expect(stats.expires).toBe(600)
      expect(stats.retryCount).toBe(0)
      expect(stats.hasAutoRefreshTimer).toBe(true)
    })

    it('should show error in statistics when registration fails', () => {
      registrationStore.setRegistrationFailed('Connection timeout')

      const stats = registrationStore.getStatistics()

      expect(stats.lastError).toBe('Connection timeout')
      expect(stats.retryCount).toBe(1)
    })
  })

  describe('Computed Properties', () => {
    it('should correctly compute isRegistered', () => {
      expect(registrationStore.isRegistered).toBe(false)

      registrationStore.setRegistering('sip:alice@example.com')
      expect(registrationStore.isRegistered).toBe(false)

      registrationStore.setRegistered('sip:alice@example.com')
      expect(registrationStore.isRegistered).toBe(true)

      registrationStore.setUnregistering()
      expect(registrationStore.isRegistered).toBe(false)
    })

    it('should correctly compute isRegistering', () => {
      expect(registrationStore.isRegistering).toBe(false)

      registrationStore.setRegistering('sip:alice@example.com')
      expect(registrationStore.isRegistering).toBe(true)

      registrationStore.setRegistered('sip:alice@example.com')
      expect(registrationStore.isRegistering).toBe(false)
    })

    it('should correctly compute isUnregistering', () => {
      registrationStore.setRegistered('sip:alice@example.com')
      expect(registrationStore.isUnregistering).toBe(false)

      registrationStore.setUnregistering()
      expect(registrationStore.isUnregistering).toBe(true)

      registrationStore.setUnregistered()
      expect(registrationStore.isUnregistering).toBe(false)
    })

    it('should correctly compute hasRegistrationFailed', () => {
      expect(registrationStore.hasRegistrationFailed).toBe(false)

      registrationStore.setRegistrationFailed('Error')
      expect(registrationStore.hasRegistrationFailed).toBe(true)

      registrationStore.setRegistering('sip:alice@example.com')
      expect(registrationStore.hasRegistrationFailed).toBe(false)
    })
  })
})
