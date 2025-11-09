/**
 * Presence Subagent
 *
 * Handles presence and messaging for the agent
 */

import { BaseSubagent } from './BaseSubagent'
import type { SipTestAgent } from '../SipTestAgent'
import type { PresenceStatus } from '../types'
import { TIMING, LIMITS } from '../constants'
import { validateSipUri } from '../utils'

export interface Message {
  id: string
  from: string
  to: string
  body: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
}

export interface PresenceState {
  status: PresenceStatus
  statusMessage: string | null
  lastStatusChange: number | null
  messages: Message[]
  messagesSent: number
  messagesReceived: number
}

export interface PresenceMetrics {
  status: PresenceStatus
  statusMessage: string | null
  lastStatusChange: number | null
  messageCount: number
  messagesSent: number
  messagesReceived: number
}

/**
 * Presence subagent
 */
export class PresenceSubagent extends BaseSubagent {
  private state: PresenceState = {
    status: 'offline',
    statusMessage: null,
    lastStatusChange: null,
    messages: [],
    messagesSent: 0,
    messagesReceived: 0,
  }

  private messageIdCounter = 0

  constructor(agent: SipTestAgent) {
    super(agent, 'presence')
  }

  /**
   * Initialize presence handlers
   */
  protected async onInitialize(): Promise<void> {
    // When agent connects, set status to online
    this.setStatus('online')
  }

  /**
   * Cleanup presence
   */
  protected async onCleanup(): Promise<void> {
    this.setStatus('offline')
  }

  /**
   * Set presence status
   */
  setStatus(status: PresenceStatus, message?: string): void {
    const previousStatus = this.state.status

    this.state.status = status
    this.state.statusMessage = message || null
    this.state.lastStatusChange = Date.now()

    this.emit('presence:status-changed', {
      agentId: this.agentId,
      previousStatus,
      newStatus: status,
      message: this.state.statusMessage,
    })
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(targetUri: string, body: string): Promise<Message> {
    validateSipUri(targetUri, 'targetUri')

    const ua = this.agent.getUA()

    // Send the message via UA
    ua.sendMessage(targetUri, body)

    // Create message record
    const message: Message = {
      id: `msg-${this.agentId}-${++this.messageIdCounter}`,
      from: this.identity.uri,
      to: targetUri,
      body,
      timestamp: Date.now(),
      direction: 'outgoing',
    }

    this.addMessage(message)
    this.state.messagesSent++

    this.emit('presence:message-sent', {
      agentId: this.agentId,
      message,
    })

    return message
  }

  /**
   * Simulate receiving a message
   * This would be called by the test framework or agent manager
   */
  receiveMessage(fromUri: string, body: string): Message {
    const message: Message = {
      id: `msg-rcv-${this.agentId}-${++this.messageIdCounter}`,
      from: fromUri,
      to: this.identity.uri,
      body,
      timestamp: Date.now(),
      direction: 'incoming',
    }

    this.addMessage(message)
    this.state.messagesReceived++

    this.emit('presence:message-received', {
      agentId: this.agentId,
      message,
    })

    return message
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return [...this.state.messages]
  }

  /**
   * Get messages with a specific agent
   */
  getMessagesWithAgent(agentUri: string): Message[] {
    return this.state.messages.filter((m) => m.from === agentUri || m.to === agentUri)
  }

  /**
   * Get current presence status
   */
  getStatus(): PresenceStatus {
    return this.state.status
  }

  /**
   * Get status message
   */
  getStatusMessage(): string | null {
    return this.state.statusMessage
  }

  /**
   * Clear message history
   */
  clearMessages(): void {
    this.state.messages = []

    this.emit('presence:messages-cleared', {
      agentId: this.agentId,
    })
  }

  /**
   * Wait for a message
   */
  async waitForMessage(timeout = TIMING.DEFAULT_WAIT_TIMEOUT): Promise<Message> {
    const initialCount = this.state.messagesReceived

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`No message received within ${timeout}ms`))
      }, timeout)

      const checkMessage = () => {
        if (this.state.messagesReceived > initialCount) {
          clearTimeout(timer)
          const messages = this.state.messages.filter((m) => m.direction === 'incoming')
          resolve(messages[messages.length - 1])
        } else {
          setTimeout(checkMessage, TIMING.POLLING_INTERVAL)
        }
      }

      checkMessage()
    })
  }

  /**
   * Add a message to the messages array with size limit enforcement
   */
  private addMessage(message: Message): void {
    this.state.messages.push(message)

    // Enforce MAX_MESSAGES limit
    if (this.state.messages.length > LIMITS.MAX_MESSAGES) {
      this.state.messages.shift() // Remove oldest message
    }
  }

  /**
   * Get presence metrics
   */
  getMetrics(): PresenceMetrics {
    return {
      status: this.state.status,
      statusMessage: this.state.statusMessage,
      lastStatusChange: this.state.lastStatusChange,
      messageCount: this.state.messages.length,
      messagesSent: this.state.messagesSent,
      messagesReceived: this.state.messagesReceived,
    }
  }

  /**
   * Get presence state (legacy compatibility)
   */
  getState(): Record<string, unknown> {
    return this.getMetrics()
  }
}
