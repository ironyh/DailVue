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
  /** Whether to simulate registration failures */
  simulateRegistrationFailure?: boolean
  /** Custom response codes for testing */
  customResponseCodes?: Record<string, number>
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (data: T) => void

/**
 * Mock RTC Peer Connection
 */
export interface MockRTCPeerConnection {
  getSenders: Mock<() => unknown[]>
  getReceivers: Mock<() => unknown[]>
  addEventListener: Mock<(type: string, listener: EventListener) => void>
  removeEventListener: Mock<(type: string, listener: EventListener) => void>
}

/**
 * Mock SIP call session
 */
export interface MockRTCSession {
  id: string
  connection: MockRTCPeerConnection
  isInProgress: Mock<() => boolean>
  isEstablished: Mock<() => boolean>
  isEnded: Mock<() => boolean>
  answer: Mock<() => void>
  terminate: Mock<() => void>
  hold: Mock<() => Promise<void>>
  unhold: Mock<() => Promise<void>>
  renegotiate: Mock<() => Promise<void>>
  refer: Mock<(target: string) => void>
  sendDTMF: Mock<(tone: string, options?: unknown) => void>
  on: Mock<(event: string, handler: EventHandler) => void>
  off: Mock<(event: string, handler: EventHandler) => void>
  _handlers: Record<string, EventHandler[]>
}

/**
 * Mock SIP User Agent
 */
export interface MockUA {
  start: Mock<() => void>
  stop: Mock<() => void>
  register: Mock<() => void>
  unregister: Mock<() => void>
  call: Mock<(target: string, options?: unknown) => MockRTCSession>
  sendMessage: Mock<(target: string, body: string, options?: unknown) => void>
  isConnected: Mock<() => boolean>
  isRegistered: Mock<() => boolean>
  on: Mock<(event: string, handler: EventHandler) => void>
  once: Mock<(event: string, handler: EventHandler) => void>
  off: Mock<(event: string, handler: EventHandler) => void>
  _handlers: Record<string, EventHandler[]>
  _onceHandlers: Record<string, EventHandler[]>
}

/**
 * Mock SIP Server class for comprehensive integration testing
 */
export class MockSipServer {
  private config: Required<MockSipServerConfig>
  private mockUA: MockUA
  private activeSessions: Map<string, MockRTCSession>
  private sessionIdCounter = 0
  private timeouts: NodeJS.Timeout[] = []

  constructor(config: MockSipServerConfig = {}) {
    this.config = {
      autoRegister: config.autoRegister ?? true,
      registrationExpires: config.registrationExpires ?? 600,
      autoAcceptCalls: config.autoAcceptCalls ?? false,
      networkLatency: config.networkLatency ?? 10,
      simulateConnectionFailure: config.simulateConnectionFailure ?? false,
      simulateRegistrationFailure: config.simulateRegistrationFailure ?? false,
      customResponseCodes: config.customResponseCodes ?? {},
    }

    this.activeSessions = new Map()
    this.mockUA = this.createMockUA()
  }

  /**
   * Create a tracked setTimeout that will be cleaned up on reset/destroy
   */
  private createTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(callback, delay)
    this.timeouts.push(timeout)
    return timeout
  }

  /**
   * Parse and validate a SIP URI
   * @param uri - The SIP URI to parse (e.g., "sip:user@domain.com")
   * @returns Parsed URI components
   * @throws Error if URI format is invalid
   */
  private parseUri(uri: string): { user: string; host: string } {
    if (!uri || typeof uri !== 'string') {
      throw new Error(`Invalid SIP URI: must be a non-empty string, got ${typeof uri}`)
    }

    const match = uri.match(/^sip:([^@]+)@(.+)$/)
    if (!match) {
      throw new Error(
        `Invalid SIP URI format: "${uri}". Expected format: "sip:user@domain.com"`
      )
    }

    return {
      user: match[1],
      host: match[2],
    }
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
   * Simulate an incoming call from a remote party
   * @param from - SIP URI of the caller (e.g., "sip:caller@example.com")
   * @param to - SIP URI of the callee (e.g., "sip:callee@example.com")
   * @returns The created mock RTC session
   * @throws Error if URI format is invalid
   */
  simulateIncomingCall(from: string, to: string): MockRTCSession {
    const session = this.createSession()
    const fromUri = this.parseUri(from)
    const toUri = this.parseUri(to)

    this.createTimeout(() => {
      const handlers = this.mockUA._handlers['newRTCSession'] || []
      handlers.forEach((handler) => {
        handler({
          session,
          originator: 'remote',
          request: {
            from: { uri: fromUri },
            to: { uri: toUri },
          },
        })
      })
    }, this.config.networkLatency)

    return session
  }

  /**
   * Simulate call progress (ringing state)
   * @param session - The mock RTC session to update
   */
  simulateCallProgress(session: MockRTCSession): void {
    session.isInProgress.mockReturnValue(true)
    this.createTimeout(() => {
      const handlers = session._handlers['progress'] || []
      handlers.forEach((handler) => handler({ originator: 'remote' }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate call being accepted by the remote party
   * @param session - The mock RTC session to update
   */
  simulateCallAccepted(session: MockRTCSession): void {
    session.isEstablished.mockReturnValue(true)
    session.isInProgress.mockReturnValue(false)

    this.createTimeout(() => {
      const handlers = session._handlers['accepted'] || []
      handlers.forEach((handler) => handler({ originator: 'remote' }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate call confirmation (ACK received)
   * @param session - The mock RTC session to update
   */
  simulateCallConfirmed(session: MockRTCSession): void {
    this.createTimeout(() => {
      const handlers = session._handlers['confirmed'] || []
      handlers.forEach((handler) => handler())
    }, this.config.networkLatency)
  }

  /**
   * Simulate call termination
   * @param session - The mock RTC session to terminate
   * @param originator - Who initiated the termination ('local' or 'remote')
   * @param cause - Reason for termination (default: 'Bye')
   */
  simulateCallEnded(session: MockRTCSession, originator: 'local' | 'remote' = 'remote', cause = 'Bye'): void {
    session.isEnded.mockReturnValue(true)
    session.isEstablished.mockReturnValue(false)

    this.createTimeout(() => {
      const handlers = session._handlers['ended'] || []
      handlers.forEach((handler) => handler({ originator, cause }))
      this.activeSessions.delete(session.id)
    }, this.config.networkLatency)
  }

  /**
   * Simulate hold event
   */
  simulateHold(session: MockRTCSession, originator: 'local' | 'remote' = 'remote'): void {
    this.createTimeout(() => {
      const handlers = session._handlers['hold'] || []
      handlers.forEach((handler) => handler({ originator }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate unhold event
   */
  simulateUnhold(session: MockRTCSession, originator: 'local' | 'remote' = 'remote'): void {
    this.createTimeout(() => {
      const handlers = session._handlers['unhold'] || []
      handlers.forEach((handler) => handler({ originator }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate network disconnect
   * @param code - WebSocket close code (default: 1006)
   * @param reason - Disconnect reason (default: 'Connection lost')
   */
  simulateDisconnect(code = 1006, reason = 'Connection lost'): void {
    this.mockUA.isConnected.mockReturnValue(false)

    this.createTimeout(() => {
      const handlers = this.mockUA._handlers['disconnected'] || []
      handlers.forEach((handler) => handler({ code, reason }))

      // Also trigger once handlers
      const onceHandlers = this.mockUA._onceHandlers['disconnected'] || []
      onceHandlers.forEach((handler) => handler({ code, reason }))
      this.mockUA._onceHandlers['disconnected'] = []
    }, this.config.networkLatency)
  }

  /**
   * Simulate successful WebSocket connection
   * @param url - WebSocket URL (default: 'wss://sip.example.com')
   */
  simulateConnect(url = 'wss://sip.example.com'): void {
    this.mockUA.isConnected.mockReturnValue(true)

    this.createTimeout(() => {
      const handlers = this.mockUA._onceHandlers['connected'] || []
      handlers.forEach((handler) => handler({ socket: { url } }))
      this.mockUA._onceHandlers['connected'] = []

      const onHandlers = this.mockUA._handlers['connected'] || []
      onHandlers.forEach((handler) => handler({ socket: { url } }))
    }, this.config.networkLatency)
  }

  /**
   * Simulate successful SIP registration
   * @param expires - Registration expiration time in seconds (default: from config)
   */
  simulateRegistered(expires?: number): void {
    this.mockUA.isRegistered.mockReturnValue(true)

    this.createTimeout(() => {
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
    this.createTimeout(() => {
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

    this.createTimeout(() => {
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
    this.clearTimeouts()
    this.mockUA.isConnected.mockReturnValue(false)
    this.mockUA.isRegistered.mockReturnValue(false)
    this.mockUA._handlers = {}
    this.mockUA._onceHandlers = {}
  }

  /**
   * Clear all pending timeouts
   */
  private clearTimeouts(): void {
    this.timeouts.forEach(clearTimeout)
    this.timeouts = []
  }

  /**
   * Destroy the mock server and clean up all resources
   */
  destroy(): void {
    this.reset()
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
      call: vi.fn((target: string, options?: unknown) => {
        const session = this.createSession()

        if (this.config.autoAcceptCalls) {
          this.simulateCallProgress(session)
          this.createTimeout(() => {
            this.simulateCallAccepted(session)
            this.simulateCallConfirmed(session)
          }, this.config.networkLatency * 2)
        }

        return session
      }),
      sendMessage: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      isRegistered: vi.fn().mockReturnValue(false),
      on: vi.fn((event: string, handler: EventHandler) => {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(handler)
      }),
      once: vi.fn((event: string, handler: EventHandler) => {
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
      off: vi.fn((event: string, handler: EventHandler) => {
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
