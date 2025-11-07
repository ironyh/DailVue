/**
 * Mock SIP Server for Integration Testing
 *
 * Provides a comprehensive mock SIP server that simulates realistic SIP server behavior
 * including configurable responses, error injection, and latency simulation.
 */

import { vi } from 'vitest'
import type { Mock } from 'vitest'

/**
 * Configuration for mock SIP server responses
 */
export interface MockSipServerConfig {
  /** Whether to auto-respond to registration requests */
  autoRegister?: boolean
  /** Registration expiration time in seconds */
  registrationExpires?: number
  /** Whether to auto-respond to call requests */
  autoAcceptCalls?: boolean
  /** Simulated network latency in milliseconds */
  networkLatency?: number
  /** Whether to simulate connection failures */
  simulateConnectionFailure?: boolean
  /** Connection failure rate (0-1) */
  connectionFailureRate?: number
  /** Whether to simulate registration failures */
  simulateRegistrationFailure?: boolean
  /** Registration failure rate (0-1) */
  registrationFailureRate?: number
  /** Custom response codes for testing */
  customResponseCodes?: Record<string, number>
}

/**
 * Mock SIP call session
 */
export interface MockRTCSession {
  id: string
  connection: any
  isInProgress: Mock
  isEstablished: Mock
  isEnded: Mock
  answer: Mock
  terminate: Mock
  hold: Mock
  unhold: Mock
  renegotiate: Mock
  refer: Mock
  sendDTMF: Mock
  on: Mock
  off: Mock
  _handlers: Record<string, Function[]>
}

/**
 * Mock SIP User Agent
 */
export interface MockUA {
  start: Mock
  stop: Mock
  register: Mock
  unregister: Mock
  call: Mock
  sendMessage: Mock
  isConnected: Mock
  isRegistered: Mock
  on: Mock
  once: Mock
  off: Mock
  _handlers: Record<string, Function[]>
  _onceHandlers: Record<string, Function[]>
}

/**
 * Mock SIP Server class for comprehensive integration testing
 */
export class MockSipServer {
  private config: Required<MockSipServerConfig>
  private mockUA: MockUA
  private activeSessions: Map<string, MockRTCSession>
  private sessionIdCounter = 0

  constructor(config: MockSipServerConfig = {}) {
    this.config = {
      autoRegister: config.autoRegister ?? true,
      registrationExpires: config.registrationExpires ?? 600,
      autoAcceptCalls: config.autoAcceptCalls ?? false,
      networkLatency: config.networkLatency ?? 10,
      simulateConnectionFailure: config.simulateConnectionFailure ?? false,
      connectionFailureRate: config.connectionFailureRate ?? 0,
      simulateRegistrationFailure: config.simulateRegistrationFailure ?? false,
      registrationFailureRate: config.registrationFailureRate ?? 0,
      customResponseCodes: config.customResponseCodes ?? {},
    }

    this.activeSessions = new Map()
    this.mockUA = this.createMockUA()
  }

  /**
   * Get the mock UA instance
   */
  getUA(): MockUA {
    return this.mockUA
  }

  /**
   * Create a new mock RTC session
   */
  createSession(sessionId?: string): MockRTCSession {
    const id = sessionId || `session-${++this.sessionIdCounter}`

    const handlers: Record<string, Function[]> = {}

    const session: MockRTCSession = {
      id,
      connection: {
        getSenders: vi.fn().mockReturnValue([]),
        getReceivers: vi.fn().mockReturnValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      isInProgress: vi.fn().mockReturnValue(false),
      isEstablished: vi.fn().mockReturnValue(false),
      isEnded: vi.fn().mockReturnValue(false),
      answer: vi.fn(),
      terminate: vi.fn(),
      hold: vi.fn().mockResolvedValue(undefined),
      unhold: vi.fn().mockResolvedValue(undefined),
      renegotiate: vi.fn().mockResolvedValue(undefined),
      refer: vi.fn(),
      sendDTMF: vi.fn(),
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(handler)
      }),
      off: vi.fn((event: string, handler: Function) => {
        if (handlers[event]) {
          handlers[event] = handlers[event].filter((h) => h !== handler)
        }
      }),
      _handlers: handlers,
    }

    this.activeSessions.set(id, session)
    return session
  }

  /**
   * Simulate an incoming call
   */
  simulateIncomingCall(from: string, to: string): MockRTCSession {
    const session = this.createSession()

    setTimeout(() => {
      const handlers = this.mockUA._handlers['newRTCSession'] || []
      handlers.forEach((handler) => {
        handler({
          session,
          originator: 'remote',
          request: {
            from: { uri: { user: from.split(':')[1]?.split('@')[0], host: from.split('@')[1] } },
            to: { uri: { user: to.split(':')[1]?.split('@')[0], host: to.split('@')[1] } },
          },
        })
      })
    }, this.config.networkLatency)

    return session
  }

  /**
   * Simulate call progress (ringing)
   */
  simulateCallProgress(session: MockRTCSession): void {
    session.isInProgress.mockReturnValue(true)
    setTimeout(() => {
      const handlers = session._handlers['progress'] || []
      handlers.forEach((handler) => handler({ originator: 'remote' }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate call acceptance
   */
  simulateCallAccepted(session: MockRTCSession): void {
    session.isEstablished.mockReturnValue(true)
    session.isInProgress.mockReturnValue(false)

    setTimeout(() => {
      const handlers = session._handlers['accepted'] || []
      handlers.forEach((handler) => handler({ originator: 'remote' }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate call confirmation
   */
  simulateCallConfirmed(session: MockRTCSession): void {
    setTimeout(() => {
      const handlers = session._handlers['confirmed'] || []
      handlers.forEach((handler) => handler())
    }, this.config.networkLatency)
  }

  /**
   * Simulate call termination
   */
  simulateCallEnded(session: MockRTCSession, originator: 'local' | 'remote' = 'remote', cause = 'Bye'): void {
    session.isEnded.mockReturnValue(true)
    session.isEstablished.mockReturnValue(false)

    setTimeout(() => {
      const handlers = session._handlers['ended'] || []
      handlers.forEach((handler) => handler({ originator, cause }))
      this.activeSessions.delete(session.id)
    }, this.config.networkLatency)
  }

  /**
   * Simulate hold event
   */
  simulateHold(session: MockRTCSession, originator: 'local' | 'remote' = 'remote'): void {
    setTimeout(() => {
      const handlers = session._handlers['hold'] || []
      handlers.forEach((handler) => handler({ originator }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate unhold event
   */
  simulateUnhold(session: MockRTCSession, originator: 'local' | 'remote' = 'remote'): void {
    setTimeout(() => {
      const handlers = session._handlers['unhold'] || []
      handlers.forEach((handler) => handler({ originator }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate network disconnect
   */
  simulateDisconnect(code = 1006, reason = 'Connection lost'): void {
    this.mockUA.isConnected.mockReturnValue(false)

    setTimeout(() => {
      const handlers = this.mockUA._handlers['disconnected'] || []
      handlers.forEach((handler) => handler({ code, reason }))

      // Also trigger once handlers
      const onceHandlers = this.mockUA._onceHandlers['disconnected'] || []
      onceHandlers.forEach((handler) => handler({ code, reason }))
      this.mockUA._onceHandlers['disconnected'] = []
    }, this.config.networkLatency)
  }

  /**
   * Simulate successful connection
   */
  simulateConnect(url = 'wss://sip.example.com'): void {
    this.mockUA.isConnected.mockReturnValue(true)

    setTimeout(() => {
      const handlers = this.mockUA._onceHandlers['connected'] || []
      handlers.forEach((handler) => handler({ socket: { url } }))
      this.mockUA._onceHandlers['connected'] = []

      const onHandlers = this.mockUA._handlers['connected'] || []
      onHandlers.forEach((handler) => handler({ socket: { url } }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate successful registration
   */
  simulateRegistered(expires?: number): void {
    this.mockUA.isRegistered.mockReturnValue(true)

    setTimeout(() => {
      const expiresValue = expires || this.config.registrationExpires
      const handlers = this.mockUA._onceHandlers['registered'] || []
      handlers.forEach((handler) => handler({
        response: {
          getHeader: () => String(expiresValue)
        }
      }))
      this.mockUA._onceHandlers['registered'] = []

      const onHandlers = this.mockUA._handlers['registered'] || []
      onHandlers.forEach((handler) => handler({
        response: {
          getHeader: () => String(expiresValue)
        }
      }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate registration failure
   */
  simulateRegistrationFailed(cause = 'Authentication failed'): void {
    setTimeout(() => {
      const handlers = this.mockUA._onceHandlers['registrationFailed'] || []
      handlers.forEach((handler) => handler({ cause }))
      this.mockUA._onceHandlers['registrationFailed'] = []

      const onHandlers = this.mockUA._handlers['registrationFailed'] || []
      onHandlers.forEach((handler) => handler({ cause }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate unregistration
   */
  simulateUnregistered(): void {
    this.mockUA.isRegistered.mockReturnValue(false)

    setTimeout(() => {
      const handlers = this.mockUA._onceHandlers['unregistered'] || []
      handlers.forEach((handler) => handler())
      this.mockUA._onceHandlers['unregistered'] = []

      const onHandlers = this.mockUA._handlers['unregistered'] || []
      onHandlers.forEach((handler) => handler())
    }, this.config.networkLatency)
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): MockRTCSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Clear all active sessions
   */
  clearSessions(): void {
    this.activeSessions.clear()
  }

  /**
   * Reset the mock server state
   */
  reset(): void {
    this.clearSessions()
    this.mockUA.isConnected.mockReturnValue(false)
    this.mockUA.isRegistered.mockReturnValue(false)
    this.mockUA._handlers = {}
    this.mockUA._onceHandlers = {}
  }

  /**
   * Create mock UA with handlers
   */
  private createMockUA(): MockUA {
    const handlers: Record<string, Function[]> = {}
    const onceHandlers: Record<string, Function[]> = {}

    const mockUA: MockUA = {
      start: vi.fn(),
      stop: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),
      call: vi.fn((target: string, options: any) => {
        const session = this.createSession()

        if (this.config.autoAcceptCalls) {
          this.simulateCallProgress(session)
          setTimeout(() => {
            this.simulateCallAccepted(session)
            this.simulateCallConfirmed(session)
          }, this.config.networkLatency * 2)
        }

        return session
      }),
      sendMessage: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      isRegistered: vi.fn().mockReturnValue(false),
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(handler)
      }),
      once: vi.fn((event: string, handler: Function) => {
        if (!onceHandlers[event]) onceHandlers[event] = []
        onceHandlers[event].push(handler)

        // Auto-trigger based on config
        if (event === 'connected' && this.config.autoRegister && !this.config.simulateConnectionFailure) {
          this.simulateConnect()
        }

        if (event === 'registered' && this.config.autoRegister && !this.config.simulateRegistrationFailure) {
          this.simulateRegistered()
        }
      }),
      off: vi.fn((event: string, handler: Function) => {
        if (handlers[event]) {
          handlers[event] = handlers[event].filter((h) => h !== handler)
        }
        if (onceHandlers[event]) {
          onceHandlers[event] = onceHandlers[event].filter((h) => h !== handler)
        }
      }),
      _handlers: handlers,
      _onceHandlers: onceHandlers,
    }

    return mockUA
  }
}

/**
 * Create a mock SIP server with default configuration
 */
export function createMockSipServer(config?: MockSipServerConfig): MockSipServer {
  return new MockSipServer(config)
}

/**
 * Create a mock RTC session for testing
 */
export function createMockRTCSession(sessionId = 'test-session'): MockRTCSession {
  const handlers: Record<string, Function[]> = {}

  return {
    id: sessionId,
    connection: {
      getSenders: vi.fn().mockReturnValue([]),
      getReceivers: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    isInProgress: vi.fn().mockReturnValue(false),
    isEstablished: vi.fn().mockReturnValue(false),
    isEnded: vi.fn().mockReturnValue(false),
    answer: vi.fn(),
    terminate: vi.fn(),
    hold: vi.fn().mockResolvedValue(undefined),
    unhold: vi.fn().mockResolvedValue(undefined),
    renegotiate: vi.fn().mockResolvedValue(undefined),
    refer: vi.fn(),
    sendDTMF: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = []
      handlers[event].push(handler)
    }),
    off: vi.fn((event: string, handler: Function) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter((h) => h !== handler)
      }
    }),
    _handlers: handlers,
  }
}
