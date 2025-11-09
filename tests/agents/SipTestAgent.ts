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
import type {
  AgentIdentity,
  AgentState,
  AgentMetrics,
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
  private initialized = false
  private destroyed = false

  constructor(config: SipTestAgentConfig) {
    super()

    this.identity = config.identity
    this.config = {
      networkProfile: config.networkProfile || NETWORK_PROFILES.PERFECT,
      autoRegister: config.autoRegister ?? true,
      verbose: config.verbose ?? false,
    }

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
      await new Promise(resolve => setTimeout(resolve, 50))
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
    await this.networkSimulator.applyLatency(
      this.mockServer.simulateRegistered()
    )

    await this.registration.waitForRegistration()
    this.log('Registered successfully')
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
      errors: [],
      lastActivity: Date.now(),
    }
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    const callState = this.call.getState()
    const presenceState = this.presence.getState()
    const registrationState = this.registration.getState()

    return {
      callsMade: callState.callsMade as number,
      callsReceived: callState.callsReceived as number,
      callsAccepted: callState.callsAccepted as number,
      callsRejected: callState.callsRejected as number,
      callsEnded: callState.callsEnded as number,
      messagesSent: presenceState.messagesSent as number,
      messagesReceived: presenceState.messagesReceived as number,
      avgCallDuration: callState.averageCallDuration as number,
      registrationAttempts: registrationState.registrationAttempts,
      registrationFailures: registrationState.registrationFailures,
      networkErrors: 0,
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
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup agent resources
   */
  async cleanup(): Promise<void> {
    if (this.destroyed) {
      return
    }

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
  }

  /**
   * Destroy agent (cannot be reused after this)
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return
    }

    await this.cleanup()

    this.mockServer.destroy()
    this.networkSimulator.destroy()

    this.destroyed = true
    this.removeAllListeners()

    this.log('Agent destroyed')
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
    if (this.config.verbose) {
      console.log(`[Agent ${this.identity.id}] ${message}`)
    }
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
