/**
 * Base Subagent
 *
 * Abstract base class for all subagents providing common functionality
 */

import type { ISubagent } from '../types'
import type { SipTestAgent } from '../SipTestAgent'

/**
 * Base subagent class
 */
export abstract class BaseSubagent implements ISubagent {
  protected agent: SipTestAgent
  protected initialized = false

  constructor(agent: SipTestAgent, public readonly name: string) {
    this.agent = agent
  }

  /**
   * Initialize the subagent
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error(`Subagent ${this.name} already initialized`)
    }

    await this.onInitialize()
    this.initialized = true
  }

  /**
   * Cleanup the subagent
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return
    }

    await this.onCleanup()
    this.initialized = false
  }

  /**
   * Get subagent state
   */
  abstract getState(): Record<string, unknown>

  /**
   * Hook called during initialization
   */
  protected abstract onInitialize(): Promise<void>

  /**
   * Hook called during cleanup
   */
  protected abstract onCleanup(): Promise<void>

  /**
   * Check if subagent is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Emit an event through the agent
   */
  protected emit(event: string, data?: unknown): void {
    this.agent.emit(event, data)
  }

  /**
   * Get agent's identity
   */
  protected get identity() {
    return this.agent.getIdentity()
  }

  /**
   * Get agent's ID
   */
  protected get agentId(): string {
    return this.agent.getId()
  }
}
