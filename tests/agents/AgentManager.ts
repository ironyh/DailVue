/**
 * Agent Manager
 *
 * Manages multiple SIP test agents and facilitates agent-to-agent communication
 * and complex multi-agent test scenarios.
 */

import { EventEmitter } from 'events'
import { SipTestAgent, type SipTestAgentConfig } from './SipTestAgent'
import type {
  AgentIdentity,
  AgentManagerConfig,
  ConferenceInfo,
  ConferenceParticipant,
} from './types'

/**
 * Agent Manager
 */
export class AgentManager extends EventEmitter {
  private agents: Map<string, SipTestAgent> = new Map()
  private conferences: Map<string, ConferenceInfo> = new Map()
  private config: Required<AgentManagerConfig>
  private destroyed = false

  constructor(config: AgentManagerConfig = {}) {
    super()

    this.config = {
      autoCleanup: config.autoCleanup ?? true,
      verbose: config.verbose ?? false,
      defaultNetworkProfile: config.defaultNetworkProfile,
    }

    this.log('Agent Manager created')
  }

  /**
   * Create and register a new agent
   */
  async createAgent(config: SipTestAgentConfig): Promise<SipTestAgent> {
    this.ensureNotDestroyed()

    if (this.agents.has(config.identity.id)) {
      throw new Error(`Agent with ID ${config.identity.id} already exists`)
    }

    // Apply default network profile if not specified
    if (!config.networkProfile && this.config.defaultNetworkProfile) {
      config.networkProfile = this.config.defaultNetworkProfile
    }

    const agent = new SipTestAgent({
      ...config,
      verbose: config.verbose ?? this.config.verbose,
    })

    // Forward agent events
    this.setupAgentEventForwarding(agent)

    // Initialize the agent
    await agent.initialize()

    // Register the agent
    this.agents.set(config.identity.id, agent)

    this.log(`Agent created: ${config.identity.id}`)
    this.emit('manager:agent-created', { agentId: config.identity.id })

    return agent
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): SipTestAgent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get all agents
   */
  getAllAgents(): SipTestAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Remove an agent
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      return
    }

    await agent.destroy()
    this.agents.delete(agentId)

    this.log(`Agent removed: ${agentId}`)
    this.emit('manager:agent-removed', { agentId })
  }

  /**
   * Setup a call between two agents
   */
  async setupCall(
    callerAgentId: string,
    calleeAgentId: string,
    autoAnswer = true
  ): Promise<{ callerId: string; calleeId: string; sessionId: string }> {
    const caller = this.getAgent(callerAgentId)
    const callee = this.getAgent(calleeAgentId)

    if (!caller || !callee) {
      throw new Error('One or both agents not found')
    }

    this.log(`Setting up call: ${callerAgentId} -> ${calleeAgentId}`)

    // Caller makes the call
    const session = await caller.call.makeCall(callee.getIdentity().uri)

    // Simulate the call being received by callee
    const calleeSession = callee.getMockServer().simulateIncomingCall(
      caller.getIdentity().uri,
      callee.getIdentity().uri
    )

    // Wait for the incoming call event to be processed
    await new Promise(resolve => setTimeout(resolve, 50))

    // Auto-answer if configured
    if (autoAnswer) {
      await callee.call.answerCall(calleeSession.id)

      // Simulate call progress and acceptance
      callee.getMockServer().simulateCallProgress(calleeSession)
      caller.getMockServer().simulateCallProgress(session)

      await new Promise(resolve => setTimeout(resolve, 100))

      caller.getMockServer().simulateCallAccepted(session)
      callee.getMockServer().simulateCallAccepted(calleeSession)

      caller.getMockServer().simulateCallConfirmed(session)
      callee.getMockServer().simulateCallConfirmed(calleeSession)
    }

    this.log(`Call established: ${callerAgentId} <-> ${calleeAgentId}`)

    return {
      callerId: callerAgentId,
      calleeId: calleeAgentId,
      sessionId: session.id,
    }
  }

  /**
   * Send a message between two agents
   */
  async sendMessageBetweenAgents(
    fromAgentId: string,
    toAgentId: string,
    body: string
  ): Promise<void> {
    const fromAgent = this.getAgent(fromAgentId)
    const toAgent = this.getAgent(toAgentId)

    if (!fromAgent || !toAgent) {
      throw new Error('One or both agents not found')
    }

    // Send message
    await fromAgent.presence.sendMessage(toAgent.getIdentity().uri, body)

    // Simulate receiving the message
    toAgent.presence.receiveMessage(fromAgent.getIdentity().uri, body)

    this.log(`Message sent: ${fromAgentId} -> ${toAgentId}`)
  }

  /**
   * Create a conference with multiple agents
   */
  async createConference(
    conferenceUri: string,
    participantAgentIds: string[]
  ): Promise<ConferenceInfo> {
    this.log(`Creating conference: ${conferenceUri} with ${participantAgentIds.length} participants`)

    const conference: ConferenceInfo = {
      id: `conf-${Date.now()}`,
      uri: conferenceUri,
      participants: [],
      startedAt: Date.now(),
      recording: false,
    }

    // Add all participants
    for (const agentId of participantAgentIds) {
      const agent = this.getAgent(agentId)
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`)
      }

      const participant: ConferenceParticipant = {
        agentId,
        joinedAt: Date.now(),
        muted: false,
        speaking: false,
        audioLevel: 0,
      }

      conference.participants.push(participant)

      // Make call to conference URI
      await agent.call.makeCall(conferenceUri)
    }

    this.conferences.set(conference.id, conference)

    this.log(`Conference created: ${conference.id}`)
    this.emit('manager:conference-created', { conferenceId: conference.id })

    return conference
  }

  /**
   * Get a conference by ID
   */
  getConference(conferenceId: string): ConferenceInfo | undefined {
    return this.conferences.get(conferenceId)
  }

  /**
   * End a conference
   */
  async endConference(conferenceId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      return
    }

    this.log(`Ending conference: ${conferenceId}`)

    // Terminate all participant calls
    for (const participant of conference.participants) {
      const agent = this.getAgent(participant.agentId)
      if (agent) {
        const calls = agent.call.getActiveCalls()
        for (const call of calls) {
          await agent.call.terminateCall(call.id)
        }
      }
    }

    conference.endedAt = Date.now()
    this.conferences.delete(conferenceId)

    this.log(`Conference ended: ${conferenceId}`)
    this.emit('manager:conference-ended', { conferenceId })
  }

  /**
   * Connect all agents
   */
  async connectAllAgents(): Promise<void> {
    this.log('Connecting all agents...')

    const promises = this.getAllAgents().map(agent => agent.connect())
    await Promise.all(promises)

    this.log('All agents connected')
  }

  /**
   * Register all agents
   */
  async registerAllAgents(): Promise<void> {
    this.log('Registering all agents...')

    const promises = this.getAllAgents().map(agent => agent.register())
    await Promise.all(promises)

    this.log('All agents registered')
  }

  /**
   * Disconnect all agents
   */
  async disconnectAllAgents(): Promise<void> {
    this.log('Disconnecting all agents...')

    const promises = this.getAllAgents().map(agent => agent.disconnect())
    await Promise.all(promises)

    this.log('All agents disconnected')
  }

  /**
   * Get statistics for all agents
   */
  getStatistics(): {
    totalAgents: number
    connectedAgents: number
    registeredAgents: number
    activeCalls: number
    totalCallsMade: number
    totalMessagesExchanged: number
    activeConferences: number
  } {
    const agents = this.getAllAgents()

    let connectedAgents = 0
    let registeredAgents = 0
    let activeCalls = 0
    let totalCallsMade = 0
    let totalMessagesExchanged = 0

    for (const agent of agents) {
      const state = agent.getState()
      const metrics = agent.getMetrics()

      if (state.connected) connectedAgents++
      if (state.registered) registeredAgents++
      activeCalls += state.activeSessions.length
      totalCallsMade += metrics.callsMade
      totalMessagesExchanged += metrics.messagesSent + metrics.messagesReceived
    }

    return {
      totalAgents: agents.length,
      connectedAgents,
      registeredAgents,
      activeCalls,
      totalCallsMade,
      totalMessagesExchanged,
      activeConferences: this.conferences.size,
    }
  }

  /**
   * Cleanup all agents
   */
  async cleanup(): Promise<void> {
    if (this.destroyed) {
      return
    }

    this.log('Cleaning up agent manager...')

    // End all conferences
    for (const conferenceId of this.conferences.keys()) {
      await this.endConference(conferenceId)
    }

    // Cleanup all agents
    const agentIds = Array.from(this.agents.keys())
    for (const agentId of agentIds) {
      await this.removeAgent(agentId)
    }

    this.log('Agent manager cleaned up')
  }

  /**
   * Destroy the agent manager
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return
    }

    await this.cleanup()

    this.destroyed = true
    this.removeAllListeners()

    this.log('Agent manager destroyed')
  }

  /**
   * Setup event forwarding from agent to manager
   */
  private setupAgentEventForwarding(agent: SipTestAgent): void {
    // Forward all agent events to manager
    const forwardEvent = (eventName: string) => {
      agent.on(eventName, (data: any) => {
        this.emit(eventName, data)
      })
    }

    // Registration events
    forwardEvent('registration:started')
    forwardEvent('registration:success')
    forwardEvent('registration:failed')
    forwardEvent('registration:unregistered')

    // Call events
    forwardEvent('call:made')
    forwardEvent('call:incoming')
    forwardEvent('call:answered')
    forwardEvent('call:rejected')
    forwardEvent('call:terminated')
    forwardEvent('call:ended')
    forwardEvent('call:held')
    forwardEvent('call:unheld')
    forwardEvent('call:transferred')

    // Presence events
    forwardEvent('presence:status-changed')
    forwardEvent('presence:message-sent')
    forwardEvent('presence:message-received')

    // Agent lifecycle events
    forwardEvent('agent:initialized')
    forwardEvent('agent:connected')
    forwardEvent('agent:disconnected')
    forwardEvent('agent:cleaned-up')
  }

  /**
   * Ensure manager is not destroyed
   */
  private ensureNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error('Agent manager has been destroyed')
    }
  }

  /**
   * Log a message
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[AgentManager] ${message}`)
    }
  }
}

/**
 * Create an agent manager
 */
export function createAgentManager(config?: AgentManagerConfig): AgentManager {
  return new AgentManager(config)
}

/**
 * Helper to create a basic agent identity
 */
export function createAgentIdentity(
  id: string,
  username?: string,
  domain = 'example.com'
): AgentIdentity {
  const user = username || id
  return {
    id,
    uri: `sip:${user}@${domain}`,
    username: user,
    password: 'password',
    displayName: id.charAt(0).toUpperCase() + id.slice(1),
    wsServer: `wss://sip.${domain}`,
  }
}
