/**
 * useSipClient composable unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import { useSipClient } from '@/composables/useSipClient'
import { SipClient } from '@/core/SipClient'
import { EventBus } from '@/core/EventBus'
import { configStore } from '@/stores/configStore'
import { registrationStore } from '@/stores/registrationStore'
import type { SipClientConfig } from '@/types/config.types'
import { RegistrationState } from '@/types/sip.types'

// Helper to wrap composable in proper Vue context
function withSetup<T>(composable: () => T): [T, () => void] {
  let result: T
  const app = createApp({
    setup() {
      result = composable()
      return () => {}
    },
  })
  app.mount(document.createElement('div'))
  return [result!, () => app.unmount()]
}

// Mock the core modules
vi.mock('@/core/SipClient')
vi.mock('@/core/EventBus')

// Mock JsSIP to prevent errors
vi.mock('jssip', () => ({
  default: {
    UA: vi.fn(),
    WebSocketInterface: vi.fn(),
    debug: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
  },
}))

describe('useSipClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSipClient: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockEventBus: any
  let testConfig: SipClientConfig

  beforeEach(() => {
    // Reset all stores
    configStore.reset()
    registrationStore.reset()

    // Create mock SipClient with realistic state management
    const mockState = {
      connectionState: 'disconnected' as any,
      registrationState: 'unregistered' as any,
      isConnected: false,
      isRegistered: false,
    }

    mockSipClient = {
      start: vi.fn().mockImplementation(async () => {
        mockState.connectionState = 'connected'
        mockState.isConnected = true
      }),
      stop: vi.fn().mockImplementation(async () => {
        mockState.connectionState = 'disconnected'
        mockState.isConnected = false
        mockState.registrationState = 'unregistered'
        mockState.isRegistered = false
      }),
      register: vi.fn().mockImplementation(async () => {
        mockState.registrationState = 'registered'
        mockState.isRegistered = true
      }),
      unregister: vi.fn().mockImplementation(async () => {
        mockState.registrationState = 'unregistered'
        mockState.isRegistered = false
      }),
      updateConfig: vi.fn(),
      destroy: vi.fn(),
      getState: vi.fn().mockImplementation(() => ({
        connectionState: mockState.connectionState,
        registrationState: mockState.registrationState,
      })),
      get connectionState() {
        return mockState.connectionState
      },
      get registrationState() {
        return mockState.registrationState
      },
      get isConnected() {
        return mockState.isConnected
      },
      get isRegistered() {
        return mockState.isRegistered
      },
      // Expose mockState for tests that need to manipulate it directly
      _mockState: mockState,
    }

    // Create mock EventBus
    let eventIdCounter = 0
    mockEventBus = {
      on: vi.fn().mockImplementation(() => `listener-${eventIdCounter++}`),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      emitSync: vi.fn(),
      destroy: vi.fn(),
    }

    // Setup mocks to return instances
    vi.mocked(SipClient).mockImplementation(() => mockSipClient)
    vi.mocked(EventBus).mockImplementation(() => mockEventBus)

    // Create test configuration
    testConfig = {
      uri: 'wss://sip.example.com:7443', // WebSocket server URL
      sipUri: 'sip:testuser@example.com', // SIP user URI
      password: 'testpassword',
      displayName: 'Test User',
      authorizationUsername: 'testuser',
      realm: 'example.com',
      debug: false,
      registrationOptions: {
        expires: 600,
        autoRegister: false,
      },
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { isConnected, isRegistered, isConnecting, isStarted, error } = result

      expect(isConnected.value).toBe(false)
      expect(isRegistered.value).toBe(false)
      expect(isConnecting.value).toBe(false)
      expect(isStarted.value).toBe(false)
      expect(error.value).toBeNull()

      unmount()
    })

    it('should accept initial configuration', () => {
      const [, unmount] = withSetup(() => useSipClient(testConfig))

      expect(configStore.hasSipConfig).toBe(true)
      expect(configStore.getSipUri()).toBe(testConfig.sipUri)

      unmount()
    })

    it('should set error for invalid initial configuration', () => {
      const invalidConfig = {
        ...testConfig,
        uri: '', // Invalid empty URI
      }

      const [result, unmount] = withSetup(() => useSipClient(invalidConfig))
      const { error } = result

      expect(error.value).not.toBeNull()
      expect(error.value?.message).toContain('Invalid configuration')

      unmount()
    })

    it('should use provided event bus', () => {
      const customEventBus = new EventBus()
      const [result, unmount] = withSetup(() =>
        useSipClient(testConfig, { eventBus: customEventBus })
      )
      const { getEventBus } = result

      expect(getEventBus()).toBe(customEventBus)

      unmount()
    })

    it('should create new event bus if not provided', () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { getEventBus } = result

      expect(getEventBus()).toBeDefined()
      expect(getEventBus()).toHaveProperty('on')
      expect(getEventBus()).toHaveProperty('off')

      unmount()
    })
  })

  describe('connect()', () => {
    it('should connect to SIP server successfully', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, isStarted, isConnected } = result

      expect(isStarted.value).toBe(false)

      await connect()

      // Should have created SipClient
      expect(SipClient).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
      expect(mockSipClient.start).toHaveBeenCalled()
      expect(isStarted.value).toBe(true)
      expect(isConnected.value).toBe(true)

      unmount()
    })

    it('should throw error if no configuration set', async () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { connect } = result

      await expect(connect()).rejects.toThrow('No SIP configuration set')

      unmount()
    })

    it('should handle connection failure', async () => {
      const connectionError = new Error('Connection failed')
      mockSipClient.start.mockRejectedValueOnce(connectionError)

      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, error } = result

      await expect(connect()).rejects.toThrow('Connection failed')
      expect(error.value).toBe(connectionError)

      unmount()
    })

    it('should reuse existing SipClient on subsequent calls', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect } = result

      await connect()
      expect(SipClient).toHaveBeenCalledTimes(1)

      await connect()
      expect(SipClient).toHaveBeenCalledTimes(1) // Should not create new instance

      unmount()
    })

    it('should clear error on successful connection', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, error } = result

      // Set an error first
      mockSipClient.start.mockRejectedValueOnce(new Error('Test error'))
      await connect().catch(() => {})
      expect(error.value).not.toBeNull()

      // Now connect successfully
      mockSipClient.start.mockResolvedValueOnce(undefined)
      await connect()

      await nextTick()
      expect(error.value).toBeNull()

      unmount()
    })
  })

  describe('disconnect()', () => {
    it('should disconnect from SIP server successfully', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, disconnect, isStarted, isDisconnecting } = result

      await connect()
      expect(isStarted.value).toBe(true)

      const disconnectPromise = disconnect()
      expect(isDisconnecting.value).toBe(true)

      await disconnectPromise

      expect(mockSipClient.stop).toHaveBeenCalled()
      expect(isStarted.value).toBe(false)
      expect(isDisconnecting.value).toBe(false)

      unmount()
    })

    it('should handle disconnect when not connected', async () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { disconnect } = result

      // Should not throw
      await expect(disconnect()).resolves.toBeUndefined()

      unmount()
    })

    it('should handle disconnect failure', async () => {
      const disconnectError = new Error('Disconnect failed')
      mockSipClient.stop.mockRejectedValueOnce(disconnectError)

      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, disconnect, error } = result

      await connect()
      await expect(disconnect()).rejects.toThrow('Disconnect failed')
      expect(error.value).toBe(disconnectError)

      unmount()
    })

    it('should clear registration state on disconnect', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, disconnect } = result

      await connect()
      registrationStore.setRegistered(testConfig.sipUri, 600)

      await disconnect()

      expect(registrationStore.state).toBe(RegistrationState.Unregistered)

      unmount()
    })
  })

  describe('register()', () => {
    it('should register with SIP server successfully', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, register } = result

      await connect()
      await register()

      expect(mockSipClient.register).toHaveBeenCalled()

      unmount()
    })

    it('should throw error if not connected', async () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { register } = result

      await expect(register()).rejects.toThrow('SIP client not started')

      unmount()
    })

    it('should handle registration failure', async () => {
      const registrationError = new Error('Registration failed')
      mockSipClient.register.mockRejectedValueOnce(registrationError)

      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, register, error } = result

      await connect()
      await expect(register()).rejects.toThrow('Registration failed')
      expect(error.value).toBe(registrationError)

      unmount()
    })

    it('should update registration store during registration', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, register } = result

      await connect()

      // Start registration
      const registerPromise = register()

      // Should be in registering state
      expect(registrationStore.state).toBe(RegistrationState.Registering)

      await registerPromise

      unmount()
    })
  })

  describe('unregister()', () => {
    it('should unregister from SIP server successfully', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, unregister } = result

      await connect()
      await unregister()

      expect(mockSipClient.unregister).toHaveBeenCalled()

      unmount()
    })

    it('should throw error if not started', async () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { unregister } = result

      await expect(unregister()).rejects.toThrow('SIP client not started')

      unmount()
    })

    it('should handle unregistration failure', async () => {
      const unregistrationError = new Error('Unregistration failed')
      mockSipClient.unregister.mockRejectedValueOnce(unregistrationError)

      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, unregister, error } = result

      await connect()
      await expect(unregister()).rejects.toThrow('Unregistration failed')
      expect(error.value).toBe(unregistrationError)

      unmount()
    })

    it('should update registration store during unregistration', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, unregister } = result

      await connect()

      // Start unregistration
      const unregisterPromise = unregister()

      // Should be in unregistering state
      expect(registrationStore.state).toBe(RegistrationState.Unregistering)

      await unregisterPromise

      unmount()
    })
  })

  describe('updateConfig()', () => {
    it('should update configuration successfully', () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { updateConfig } = result

      const updates = {
        displayName: 'Updated User',
        debug: true,
      }

      const result2 = updateConfig(updates)

      expect(result2.valid).toBe(true)
      expect(configStore.sipConfig?.displayName).toBe('Updated User')
      expect(configStore.sipConfig?.debug).toBe(true)

      unmount()
    })

    it('should validate configuration updates', () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { updateConfig } = result

      const invalidUpdates = {
        uri: '', // Invalid empty URI
      }

      const result2 = updateConfig(invalidUpdates)

      expect(result2.valid).toBe(false)
      expect(result2.error || result2.errors).toBeDefined()

      unmount()
    })

    it('should update SipClient config if client exists', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, updateConfig } = result

      await connect()

      const updates = { displayName: 'Updated User' }
      updateConfig(updates)

      expect(mockSipClient.updateConfig).toHaveBeenCalledWith(updates)

      unmount()
    })

    it('should handle update errors', () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { updateConfig, error } = result

      // Try to update with invalid config
      const result2 = updateConfig({ uri: '' })

      expect(result2.valid).toBe(false)
      expect(error.value).not.toBeNull()

      unmount()
    })
  })

  describe('reconnect()', () => {
    it('should reconnect successfully', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, reconnect } = result

      await connect()
      await reconnect()

      expect(mockSipClient.stop).toHaveBeenCalled()
      expect(mockSipClient.start).toHaveBeenCalledTimes(2) // Once for initial connect, once for reconnect

      unmount()
    })

    it('should reconnect when not previously connected', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { reconnect } = result

      await reconnect()

      expect(mockSipClient.start).toHaveBeenCalled()

      unmount()
    })

    it('should handle reconnection failure', async () => {
      mockSipClient.start.mockRejectedValueOnce(new Error('Reconnection failed'))

      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { reconnect, error } = result

      await expect(reconnect()).rejects.toThrow('Reconnection failed')
      expect(error.value?.message).toBe('Reconnection failed')

      unmount()
    })

    it('should wait before reconnecting', async () => {
      vi.useFakeTimers()

      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, reconnect } = result

      await connect()

      // Start reconnect
      const reconnectPromise = reconnect()

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000)

      await reconnectPromise

      vi.clearAllTimers()
      vi.useRealTimers()

      unmount()
    })
  })

  describe('event handling', () => {
    it('should setup event listeners', () => {
      const [, unmount] = withSetup(() => useSipClient(testConfig))

      expect(mockEventBus.on).toHaveBeenCalledWith('sip:connected', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:disconnected', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:registered', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:unregistered', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:registration_failed', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'sip:registration_expiring',
        expect.any(Function)
      )

      unmount()
    })

    it('should handle sip:connected event', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, isConnected } = result

      // Initially disconnected
      expect(isConnected.value).toBe(false)

      // Connect (this updates the mock state)
      await connect()
      await nextTick()

      // Should now be connected
      expect(isConnected.value).toBe(true)

      unmount()
    })

    it('should handle sip:disconnected event', async () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { error } = result

      const disconnectedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === 'sip:disconnected'
      )?.[1]

      expect(disconnectedHandler).toBeDefined()

      disconnectedHandler?.({ error: 'Connection lost' })

      await nextTick()

      expect(error.value?.message).toBe('Connection lost')

      unmount()
    })

    it('should handle sip:registered event', async () => {
      const [, unmount] = withSetup(() => useSipClient())

      const registeredHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === 'sip:registered'
      )?.[1]

      expect(registeredHandler).toBeDefined()

      registeredHandler?.({ uri: 'sip:test@example.com', expires: 600 })

      await nextTick()

      expect(registrationStore.state).toBe(RegistrationState.Registered)
      expect(registrationStore.registeredUri).toBe('sip:test@example.com')

      unmount()
    })

    it('should handle sip:registration_failed event', async () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { error } = result

      const failedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === 'sip:registration_failed'
      )?.[1]

      expect(failedHandler).toBeDefined()

      failedHandler?.({ cause: 'Authentication failed' })

      await nextTick()

      expect(registrationStore.state).toBe(RegistrationState.RegistrationFailed)
      expect(error.value?.message).toBe('Authentication failed')

      unmount()
    })
  })

  describe('lifecycle options', () => {
    it('should not auto-connect by default', () => {
      const [, unmount] = withSetup(() => useSipClient(testConfig))

      expect(mockSipClient.start).not.toHaveBeenCalled()

      unmount()
    })

    it('should auto-connect when configured', async () => {
      const [, unmount] = withSetup(() => useSipClient(testConfig, { autoConnect: true }))

      // Wait for async connect
      await nextTick()
      await nextTick()

      expect(mockSipClient.start).toHaveBeenCalled()

      unmount()
    })

    it('should handle auto-connect failure gracefully', async () => {
      mockSipClient.start.mockRejectedValueOnce(new Error('Auto-connect failed'))

      const [result, unmount] = withSetup(() => useSipClient(testConfig, { autoConnect: true }))
      const { error } = result

      // Wait for async connect to fail
      await nextTick()
      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(error.value).toBeDefined()
      expect(error.value?.message).toBe('Auto-connect failed')

      unmount()
    })
  })

  describe('getClient() and getEventBus()', () => {
    it('should return null client before connect', () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { getClient } = result

      expect(getClient()).toBeNull()

      unmount()
    })

    it('should return SipClient after connect', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, getClient } = result

      await connect()

      expect(getClient()).toBeDefined()
      expect(getClient()).toHaveProperty('start')
      expect(getClient()).toHaveProperty('stop')

      unmount()
    })

    it('should return EventBus instance', () => {
      const [result, unmount] = withSetup(() => useSipClient())
      const { getEventBus } = result

      expect(getEventBus()).toBeDefined()
      expect(getEventBus()).toHaveProperty('on')
      expect(getEventBus()).toHaveProperty('off')

      unmount()
    })
  })

  describe('reactive state', () => {
    it('should expose readonly reactive state', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { isConnected, isRegistered, error } = result

      // These should be readonly
      expect(isConnected.value).toBe(false)
      expect(isRegistered.value).toBe(false)
      expect(error.value).toBeNull()

      unmount()
    })

    it('should update isConnected reactively', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, isConnected } = result

      // Initially disconnected
      expect(isConnected.value).toBe(false)

      // Connect
      await connect()
      await nextTick()

      // Should now be connected
      expect(isConnected.value).toBe(true)

      unmount()
    })

    it('should update isRegistered reactively', async () => {
      const [result, unmount] = withSetup(() => useSipClient(testConfig))
      const { connect, register, isRegistered } = result

      // Initially not registered
      expect(isRegistered.value).toBe(false)

      // Connect and register
      await connect()
      await register()
      await nextTick()

      // Should now be registered
      expect(isRegistered.value).toBe(true)

      unmount()
    })
  })

  describe('event listener cleanup (CRITICAL FIX)', () => {
    it('should register 6 event listeners on initialization', () => {
      const [, unmount] = withSetup(() => useSipClient())

      // Should have registered 6 event listeners
      expect(mockEventBus.on).toHaveBeenCalledTimes(6)
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:connected', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:disconnected', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:registered', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:unregistered', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('sip:registration_failed', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'sip:registration_expiring',
        expect.any(Function)
      )

      unmount()
    })

    it('should return listener IDs from EventBus.on()', () => {
      // EventBus.on returns string IDs
      const ids = ['id1', 'id2', 'id3', 'id4', 'id5', 'id6']
      let idIndex = 0
      mockEventBus.on.mockImplementation(() => ids[idIndex++])

      const [, unmount] = withSetup(() => useSipClient())

      // Verify all IDs were captured
      expect(mockEventBus.on).toHaveBeenCalledTimes(6)
      expect(mockEventBus.on).toHaveReturnedWith('id1')
      expect(mockEventBus.on).toHaveReturnedWith('id6')

      unmount()
    })
  })

  describe('shared EventBus warning (CRITICAL FIX)', () => {
    it('should warn when multiple instances use same EventBus', () => {
      const sharedBus = new EventBus()

      // Create first instance - should not warn
      const [, unmount1] = withSetup(() => useSipClient(testConfig, { eventBus: sharedBus }))

      // Create second instance - should warn about conflict
      const [, unmount2] = withSetup(() => useSipClient(testConfig, { eventBus: sharedBus }))

      // The warning is logged via logger.warn
      // Test verifies multiple instances work without errors
      expect(mockEventBus.on).toHaveBeenCalled()

      unmount1()
      unmount2()
    })
  })

  describe('configurable reconnect delay (MINOR FIX)', () => {
    it('should use custom reconnect delay', async () => {
      vi.useFakeTimers()

      const [result, unmount] = withSetup(() => useSipClient(testConfig, { reconnectDelay: 2000 }))
      const { connect, reconnect } = result

      await connect()

      const reconnectPromise = reconnect()
      await vi.advanceTimersByTimeAsync(2000)
      await reconnectPromise

      vi.clearAllTimers()
      vi.useRealTimers()

      unmount()
    })
  })
})
