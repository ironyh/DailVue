/**
 * SIP Test Agent
 *
 * Represents a complete SIP client agent for testing.
 * Each agent has its own identity, SIP UA, and set of subagents for handling
 * different aspects of SIP functionality.
 */

import { EventEmitter } from 'events'
import { createMockSipServer, type MockSipServer, type MockUA } from '../helpers/MockSipServer'
import { NetworkSimulator, NETWORK_PROFILES } from './NetworkSimulator'
import { RegistrationSubagent } from './subagents/RegistrationSubagent'
import { CallSubagent } from './subagents/CallSubagent'
import { MediaSubagent } from './subagents/MediaSubagent'
import { PresenceSubagent } from './subagents/PresenceSubagent'
import { TIMING, LIMITS } from './constants'
import { validateSipUri, validateAgentId } from './utils'
import { createLogger, type Logger } from './logger'
import type {
  AgentIdentity,
  AgentState,
  AgentMetrics,
  AgentError,
  NetworkProfile,
  ISubagent,
} from './types'

/**
 * Agent configuration
 */
export interface SipTestAgentConfig {
  /** Agent identity */
  identity: AgentIdentity
  /** Network profile to use */
  networkProfile?: NetworkProfile
  /** Auto-register on connect */
  autoRegister?: boolean
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * SIP Test Agent
 */
export class SipTestAgent extends EventEmitter {
  private identity: AgentIdentity
  private mockServer: MockSipServer
  private mockUA: MockUA
  private networkSimulator: NetworkSimulator
  private config: Required<Omit<SipTestAgentConfig, 'identity'>>

  // Subagents
  public readonly registration: RegistrationSubagent
  public readonly call: CallSubagent
  public readonly media: MediaSubagent
  public readonly presence: PresenceSubagent

  private subagents: ISubagent[]
  private errors: AgentError[] = []
  private logger: Logger
  private initialized = false
  private destroyed = false
  private cleanupInProgress = false

  constructor(config: SipTestAgentConfig) {
    super()

    // Validate identity
    validateAgentId(config.identity.id)
    validateSipUri(config.identity.uri, 'identity.uri')

    this.identity = config.identity
    this.config = {
      networkProfile: config.networkProfile || NETWORK_PROFILES.PERFECT,
      autoRegister: config.autoRegister ?? true,
      verbose: config.verbose ?? false,
    }

    // Create logger
    this.logger = createLogger(config.identity.id, {
      level: this.config.verbose ? 'debug' : 'none',
    })

    // Create mock server
    this.mockServer = createMockSipServer({
      autoRegister: this.config.autoRegister,
      autoAcceptCalls: false,
      networkLatency: this.config.networkProfile.latency,
    })

    this.mockUA = this.mockServer.getUA()

    // Create network simulator
    this.networkSimulator = new NetworkSimulator(this.config.networkProfile)

    // Create subagents
    this.registration = new RegistrationSubagent(this)
    this.call = new CallSubagent(this)
    this.media = new MediaSubagent(this)
    this.presence = new PresenceSubagent(this)

    this.subagents = [this.registration, this.call, this.media, this.presence]

    this.log(`Agent created: ${this.identity.id} (${this.identity.uri})`)
  }

  /**
   * Initialize the agent and all subagents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Agent already initialized')
    }

    if (this.destroyed) {
      throw new Error('Agent has been destroyed')
    }

    this.log('Initializing agent...')

    // Initialize all subagents
    for (const subagent of this.subagents) {
      await subagent.initialize()
      this.log(`Subagent initialized: ${subagent.name}`)
    }

    this.initialized = true
    this.emit('agent:initialized', { agentId: this.identity.id })

    this.log('Agent initialized')
  }

  /**
   * Connect to SIP server
   */
  async connect(): Promise<void> {
    this.ensureInitialized()

    this.log('Connecting to SIP server...')
    this.mockUA.start()

    // Simulate connection with network latency
    await this.networkSimulator.applyLatency(
      this.mockServer.simulateConnect(this.identity.wsServer)
    )

    this.emit('agent:connected', { agentId: this.identity.id })
    this.log('Connected to SIP server')
  }

  /**
   * Disconnect from SIP server
   */
  async disconnect(): Promise<void> {
    this.ensureInitialized()

    this.log('Disconnecting from SIP server...')

    if (this.registration.isRegistered()) {
      await this.registration.unregister()
      // Simulate unregistration event
      this.mockServer.simulateUnregistered()
      await new Promise((resolve) => setTimeout(resolve, TIMING.EVENT_PROCESSING_DELAY))
    }

    this.mockUA.stop()
    this.mockServer.simulateDisconnect()

    this.emit('agent:disconnected', { agentId: this.identity.id })
    this.log('Disconnected from SIP server')
  }

  /**
   * Register with SIP server
   */
  async register(): Promise<void> {
    this.ensureInitialized()

    this.log('Registering...')
    await this.registration.register()

    // Simulate registration with network latency
    await this.networkSimulator.applyLatency(this.mockServer.simulateRegistered())

    await this.registration.waitForRegistration()
    this.log('Registered successfully')
  }

  /**
   * Add an error to the agent's error log
   */
  addError(
    code: string,
    message: string,
    source: 'registration' | 'call' | 'media' | 'presence' | 'network'
  ): void {
    const error: AgentError = {
      timestamp: Date.now(),
      code,
      message,
      source,
    }

    this.errors.push(error)

    // Enforce MAX_ERRORS limit
    if (this.errors.length > LIMITS.MAX_ERRORS) {
      this.errors.shift() // Remove oldest error
    }

    this.log(`Error: [${source}] ${code} - ${message}`)
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = []
  }

  /**
   * Get agent state
   */
  getState(): AgentState {
    return {
      connected: this.mockUA.isConnected(),
      registered: this.registration.isRegistered(),
      activeSessions: this.call.getActiveCalls(),
      presenceStatus: this.presence.getStatus(),
      errors: [...this.errors], // Return a copy
      lastActivity: Date.now(),
    }
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    const callMetrics = this.call.getMetrics()
    const presenceMetrics = this.presence.getMetrics()
    const registrationMetrics = this.registration.getMetrics()

    return {
      callsMade: callMetrics.callsMade,
      callsReceived: callMetrics.callsReceived,
      callsAccepted: callMetrics.callsAccepted,
      callsRejected: callMetrics.callsRejected,
      callsEnded: callMetrics.callsEnded,
      messagesSent: presenceMetrics.messagesSent,
      messagesReceived: presenceMetrics.messagesReceived,
      avgCallDuration: callMetrics.averageCallDuration,
      registrationAttempts: registrationMetrics.registrationAttempts,
      registrationFailures: registrationMetrics.registrationFailures,
      networkErrors: this.errors.filter((e) => e.source === 'network').length,
    }
  }

  /**
   * Get agent identity
   */
  getIdentity(): AgentIdentity {
    return { ...this.identity }
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.identity.id
  }

  /**
   * Get mock UA instance
   */
  getUA(): MockUA {
    return this.mockUA
  }

  /**
   * Get mock server instance
   */
  getMockServer(): MockSipServer {
    return this.mockServer
  }

  /**
   * Get network simulator
   */
  getNetworkSimulator(): NetworkSimulator {
    return this.networkSimulator
  }

  /**
   * Set network profile
   */
  setNetworkProfile(profile: NetworkProfile): void {
    this.networkSimulator.setProfile(profile)
    this.log(`Network profile changed to: ${profile.name}`)
  }

  /**
   * Wait for a specific amount of time with network latency applied
   */
  async wait(ms: number): Promise<void> {
    // Apply network latency first
    await this.networkSimulator.applyLatency(Promise.resolve())
    // Then wait for the specified time
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Cleanup agent resources
   */
  async cleanup(): Promise<void> {
    if (this.destroyed || this.cleanupInProgress) {
      return
    }

    this.cleanupInProgress = true

    try {
      this.log('Cleaning up agent...')

      // Disconnect if connected
      if (this.mockUA.isConnected()) {
        await this.disconnect()
      }

      // Cleanup all subagents in reverse order
      for (const subagent of [...this.subagents].reverse()) {
        await subagent.cleanup()
        this.log(`Subagent cleaned up: ${subagent.name}`)
      }

      this.initialized = false
      this.emit('agent:cleaned-up', { agentId: this.identity.id })

      this.log('Agent cleaned up')
    } finally {
      this.cleanupInProgress = false
    }
  }

  /**
   * Destroy agent (cannot be reused after this)
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return
    }

    try {
      // Run cleanup first before marking as destroyed
      await this.cleanup()

      // Now mark as destroyed to prevent further operations
      this.destroyed = true

      this.mockServer.destroy()
      this.networkSimulator.destroy()
      this.removeAllListeners()

      this.log('Agent destroyed')
    } catch (error) {
      this.log(`Error during destroy: ${error}`)
      // Still mark as destroyed even if cleanup failed
      this.destroyed = true
      throw error
    }
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Check if agent is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed
  }

  /**
   * Ensure agent is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Agent not initialized. Call initialize() first.')
    }

    if (this.destroyed) {
      throw new Error('Agent has been destroyed')
    }
  }

  /**
   * Log a message
   */
  private log(message: string): void {
    this.logger.debug(message)
  }

  /**
   * Override emit to ensure type safety
   */
  emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args)
  }
}

/**
 * Create a SIP test agent
 */
export function createSipTestAgent(config: SipTestAgentConfig): SipTestAgent {
  return new SipTestAgent(config)
}
