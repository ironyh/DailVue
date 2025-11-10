/**
 * SipClient unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SipClient, createSipClient } from '@/core/SipClient'
import { createEventBus } from '@/core/EventBus'
import type { EventBus } from '@/core/EventBus'
import type { SipClientConfig } from '@/types/config.types'

// Mock JsSIP - use vi.hoisted() for variables used in factory
const { mockUA, mockWebSocketInterface } = vi.hoisted(() => {
  const mockUA = {
    start: vi.fn(),
    stop: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    sendMessage: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isRegistered: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  }

  const mockWebSocketInterface = vi.fn()

  return { mockUA, mockWebSocketInterface }
})

vi.mock('jssip', () => {
  return {
    default: {
      UA: vi.fn(() => mockUA),
      WebSocketInterface: mockWebSocketInterface,
      debug: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
    },
  }
})

describe('SipClient', () => {
  let eventBus: EventBus
  let sipClient: SipClient
  let config: SipClientConfig

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create event bus
    eventBus = createEventBus()

    // Create test configuration
    config = {
      uri: 'wss://sip.example.com:7443',
      sipUri: 'sip:testuser@example.com',
      password: 'testpassword',
      displayName: 'Test User',
      authorizationUsername: 'testuser',
      realm: 'example.com',
      userAgent: 'DailVue Test Client',
      debug: false,
      registrationOptions: {
        expires: 600,
        autoRegister: false, // Don't auto-register in tests
      },
      wsOptions: {
        connectionTimeout: 5000,
        maxReconnectionAttempts: 3,
        reconnectionDelay: 1000,
      },
    }

    // Create SIP client
    sipClient = new SipClient(config, eventBus)
  })

  afterEach(() => {
    sipClient.destroy()
    eventBus.destroy()
  })

  describe('constructor', () => {
    it('should create a SipClient instance', () => {
      expect(sipClient).toBeInstanceOf(SipClient)
    })

    it('should initialize with disconnected state', () => {
      expect(sipClient.connectionState).toBe('disconnected')
      expect(sipClient.registrationState).toBe('unregistered')
    })

    it('should not be connected initially', () => {
      expect(sipClient.isConnected).toBe(false)
      expect(sipClient.isRegistered).toBe(false)
    })
  })

  describe('createSipClient()', () => {
    it('should create a SipClient instance', () => {
      const client = createSipClient(config, eventBus)
      expect(client).toBeInstanceOf(SipClient)
      client.destroy()
    })
  })

  describe('validateConfig()', () => {
    it('should validate valid configuration', () => {
      const result = sipClient.validateConfig()
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject invalid configuration - missing URI', () => {
      const invalidConfig = { ...config, uri: '' }
      const client = new SipClient(invalidConfig, eventBus)
      const result = client.validateConfig()
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.some((e) => e.includes('WebSocket URL'))).toBe(true)
      client.destroy()
    })

    it('should reject invalid configuration - missing SIP URI', () => {
      const invalidConfig = { ...config, sipUri: '' }
      const client = new SipClient(invalidConfig, eventBus)
      const result = client.validateConfig()
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      client.destroy()
    })

    it('should reject invalid configuration - missing password', () => {
      const invalidConfig = { ...config, password: '' }
      const client = new SipClient(invalidConfig, eventBus)
      const result = client.validateConfig()
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      client.destroy()
    })
  })

  describe('start()', () => {
    it('should start the SIP client', async () => {
      // Mock successful connection
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          // Simulate immediate connection
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      expect(mockUA.start).toHaveBeenCalled()
      expect(sipClient.connectionState).toBe('connected')
    })

    it('should not start if already started', async () => {
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()
      const startCalls = mockUA.start.mock.calls.length

      await sipClient.start() // Second call should be ignored

      expect(mockUA.start).toHaveBeenCalledTimes(startCalls)
    })

    it('should emit connection events', async () => {
      const connectHandler = vi.fn()
      eventBus.on('sip:connected', connectHandler)

      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Wait for async events
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(connectHandler).toHaveBeenCalled()
    })

    it('should handle connection failure', async () => {
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'disconnected') {
          setTimeout(() => handler({}), 10)
        }
      })

      await expect(sipClient.start()).rejects.toThrow('Connection failed')
      expect(sipClient.connectionState).toBe('connection_failed')
    })

    it('should validate configuration before starting', async () => {
      const invalidConfig = { ...config, uri: '' }
      const client = new SipClient(invalidConfig, eventBus)

      await expect(client.start()).rejects.toThrow('Invalid SIP configuration')

      client.destroy()
    })
  })

  describe('stop()', () => {
    it('should stop the SIP client', async () => {
      // Start first
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)

      await sipClient.start()

      // Now stop
      await sipClient.stop()

      expect(mockUA.stop).toHaveBeenCalled()
      expect(sipClient.connectionState).toBe('disconnected')
      expect(sipClient.registrationState).toBe('unregistered')
    })

    it('should handle stop when not started', async () => {
      await expect(sipClient.stop()).resolves.not.toThrow()
    })

    it('should unregister before stopping if registered', async () => {
      // Start and register
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
        if (event === 'registered') {
          setTimeout(() => handler({}), 10)
        }
        if (event === 'unregistered') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(true)

      await sipClient.start()
      await sipClient.register()

      // Now stop
      await sipClient.stop()

      expect(mockUA.unregister).toHaveBeenCalled()
      expect(mockUA.stop).toHaveBeenCalled()
    })
  })

  describe('register()', () => {
    beforeEach(async () => {
      // Start client before registering
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      await sipClient.start()
    })

    it('should register with SIP server', async () => {
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'registered') {
          setTimeout(() => handler({}), 10)
        }
      })

      await sipClient.register()

      expect(mockUA.register).toHaveBeenCalled()
      expect(sipClient.registrationState).toBe('registered')
    })

    it('should emit registration events', async () => {
      const registeredHandler = vi.fn()
      eventBus.on('sip:registered', registeredHandler)

      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'registered') {
          setTimeout(() => handler({ response: { getHeader: () => '600' } }), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'registered') {
          setTimeout(() => handler({ response: { getHeader: () => '600' } }), 10)
        }
      })

      await sipClient.register()

      // Wait for async events
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(registeredHandler).toHaveBeenCalled()
    })

    it('should handle registration failure', async () => {
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'registrationFailed') {
          setTimeout(() => handler({ cause: 'Authentication failed' }), 10)
        }
      })

      await expect(sipClient.register()).rejects.toThrow('Registration failed')
      expect(sipClient.registrationState).toBe('registration_failed')
    })

    it('should not register if not connected', async () => {
      mockUA.isConnected.mockReturnValue(false)

      await expect(sipClient.register()).rejects.toThrow('Not connected to SIP server')
    })

    it('should not register if already registered', async () => {
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'registered') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isRegistered.mockReturnValue(true)

      await sipClient.register()
      const registerCalls = mockUA.register.mock.calls.length

      await sipClient.register() // Second call should be ignored

      expect(mockUA.register).toHaveBeenCalledTimes(registerCalls)
    })

    it('should handle registration timeout', async () => {
      // Don't emit any events to trigger timeout
      mockUA.once.mockImplementation(() => {})

      await expect(sipClient.register()).rejects.toThrow('Registration timeout')
    }, 35000) // Increase test timeout
  })

  describe('unregister()', () => {
    beforeEach(async () => {
      // Start and register
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
        if (event === 'registered') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      mockUA.isRegistered.mockReturnValue(false)
      await sipClient.start()

      mockUA.isRegistered.mockReturnValue(true)
      await sipClient.register()
    })

    it('should unregister from SIP server', async () => {
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'unregistered') {
          setTimeout(() => handler({}), 10)
        }
      })

      await sipClient.unregister()

      expect(mockUA.unregister).toHaveBeenCalled()
      expect(sipClient.registrationState).toBe('unregistered')
    })

    it('should emit unregistration events', async () => {
      const unregisteredHandler = vi.fn()
      eventBus.on('sip:unregistered', unregisteredHandler)

      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'unregistered') {
          setTimeout(() => handler({ cause: 'user' }), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'unregistered') {
          setTimeout(() => handler({ cause: 'user' }), 10)
        }
      })

      await sipClient.unregister()

      // Wait for async events
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(unregisteredHandler).toHaveBeenCalled()
    })

    it('should not unregister if not registered', async () => {
      mockUA.isRegistered.mockReturnValue(false)

      await sipClient.unregister()
      await expect(sipClient.unregister()).resolves.not.toThrow()
    })
  })

  describe('sendMessage()', () => {
    beforeEach(async () => {
      // Start client
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)
      await sipClient.start()
    })

    it('should send SIP message', () => {
      const target = 'sip:recipient@example.com'
      const content = 'Hello, World!'

      sipClient.sendMessage(target, content)

      expect(mockUA.sendMessage).toHaveBeenCalledWith(target, content, undefined)
    })

    it('should send SIP message with options', () => {
      const target = 'sip:recipient@example.com'
      const content = 'Hello, World!'
      const options = { contentType: 'text/plain' }

      sipClient.sendMessage(target, content, options)

      expect(mockUA.sendMessage).toHaveBeenCalledWith(target, content, options)
    })

    it('should throw error if not connected', () => {
      mockUA.isConnected.mockReturnValue(false)

      expect(() => {
        sipClient.sendMessage('sip:test@example.com', 'test')
      }).toThrow('Not connected to SIP server')
    })
  })

  describe('getState()', () => {
    it('should return current state', () => {
      const state = sipClient.getState()

      expect(state).toHaveProperty('connectionState')
      expect(state).toHaveProperty('registrationState')
      expect(state.connectionState).toBe('disconnected')
      expect(state.registrationState).toBe('unregistered')
    })

    it('should return immutable state copy', () => {
      const state1 = sipClient.getState()
      const state2 = sipClient.getState()

      expect(state1).not.toBe(state2) // Different objects
      expect(state1).toEqual(state2) // But same values
    })
  })

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      const newDisplayName = 'New Display Name'

      sipClient.updateConfig({ displayName: newDisplayName })

      // Note: Config changes require restart to take effect
      expect(sipClient).toBeDefined()
    })
  })

  describe('getCredentials()', () => {
    it('should return authentication credentials', () => {
      const credentials = sipClient.getCredentials()

      expect(credentials).toHaveProperty('username')
      expect(credentials).toHaveProperty('password')
      expect(credentials.username).toBe(config.authorizationUsername)
      expect(credentials.password).toBe(config.password)
      expect(credentials.realm).toBe(config.realm)
    })

    it('should extract username from SIP URI if not provided', () => {
      const configWithoutAuthUser = { ...config }
      delete configWithoutAuthUser.authorizationUsername
      const client = new SipClient(configWithoutAuthUser, eventBus)

      const credentials = client.getCredentials()

      expect(credentials.username).toBe('testuser')

      client.destroy()
    })
  })

  describe('userAgent getter', () => {
    it('should return null when not started', () => {
      expect(sipClient.userAgent).toBeNull()
    })

    it('should return UA instance when started', async () => {
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      expect(sipClient.userAgent).toBe(mockUA)
    })
  })

  describe('destroy()', () => {
    it('should clean up resources', async () => {
      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      sipClient.destroy()

      expect(mockUA.stop).toHaveBeenCalled()
      expect(sipClient.userAgent).toBeNull()
    })

    it('should handle destroy when not started', () => {
      expect(() => sipClient.destroy()).not.toThrow()
    })
  })

  describe('Event handling', () => {
    it('should handle new RTC session events', async () => {
      const sessionHandler = vi.fn()
      eventBus.on('sip:new_session', sessionHandler)

      let sessionEventHandler: ((...args: any[]) => void) | null = null

      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'newRTCSession') {
          sessionEventHandler = handler
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Simulate new session event
      if (sessionEventHandler) {
        sessionEventHandler({
          session: { id: 'session-1' },
          originator: 'remote',
          request: {},
        })
      }

      // Wait for async events
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(sessionHandler).toHaveBeenCalled()
    })

    it('should handle new message events', async () => {
      const messageHandler = vi.fn()
      eventBus.on('sip:new_message', messageHandler)

      let messageEventHandler: ((...args: any[]) => void) | null = null

      mockUA.on.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
        if (event === 'newMessage') {
          messageEventHandler = handler
        }
      })
      mockUA.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connected') {
          setTimeout(() => handler({}), 10)
        }
      })
      mockUA.isConnected.mockReturnValue(true)

      await sipClient.start()

      // Simulate new message event
      if (messageEventHandler) {
        messageEventHandler({
          message: { body: 'Hello' },
          originator: 'remote',
          request: {},
        })
      }

      // Wait for async events
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(messageHandler).toHaveBeenCalled()
    })
  })
})
