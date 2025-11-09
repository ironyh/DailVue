/**
 * Registration Subagent
 *
 * Handles SIP registration and authentication for the agent
 */

import { BaseSubagent } from './BaseSubagent'
import type { SipTestAgent } from '../SipTestAgent'
import { TIMING } from '../constants'

export interface RegistrationState {
  registered: boolean
  registering: boolean
  expires: number
  lastRegistration: number | null
  lastUnregistration: number | null
  registrationAttempts: number
  registrationFailures: number
  lastError: string | null
}

export interface RegistrationMetrics {
  registered: boolean
  registering: boolean
  registrationAttempts: number
  registrationFailures: number
}

/**
 * Registration subagent
 */
export class RegistrationSubagent extends BaseSubagent {
  private state: RegistrationState = {
    registered: false,
    registering: false,
    expires: 0,
    lastRegistration: null,
    lastUnregistration: null,
    registrationAttempts: 0,
    registrationFailures: 0,
    lastError: null,
  }

  constructor(agent: SipTestAgent) {
    super(agent, 'registration')
  }

  /**
   * Initialize registration handlers
   */
  protected async onInitialize(): Promise<void> {
    // Setup event handlers on the mock UA
    const ua = this.agent.getUA()

    ua.on('registered', (data: any) => {
      this.handleRegistered(data)
    })

    ua.on('unregistered', () => {
      this.handleUnregistered()
    })

    ua.on('registrationFailed', (data: any) => {
      this.handleRegistrationFailed(data)
    })
  }

  /**
   * Cleanup registration handlers
   */
  protected async onCleanup(): Promise<void> {
    if (this.state.registered) {
      await this.unregister()
    }
  }

  /**
   * Register with SIP server
   */
  async register(): Promise<void> {
    if (this.state.registered || this.state.registering) {
      throw new Error('Already registered or registering')
    }

    this.state.registering = true
    this.state.registrationAttempts++

    const ua = this.agent.getUA()
    ua.register()

    this.emit('registration:started', { agentId: this.agentId })
  }

  /**
   * Unregister from SIP server
   */
  async unregister(): Promise<void> {
    if (!this.state.registered) {
      throw new Error('Not registered')
    }

    const ua = this.agent.getUA()
    ua.unregister()

    this.emit('registration:unregistering', { agentId: this.agentId })
  }

  /**
   * Wait for registration to complete
   */
  async waitForRegistration(timeout = TIMING.DEFAULT_WAIT_TIMEOUT): Promise<void> {
    if (this.state.registered) {
      return
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Registration timeout after ${timeout}ms`))
      }, timeout)

      const checkRegistration = () => {
        if (this.state.registered) {
          clearTimeout(timer)
          resolve()
        } else if (this.state.lastError) {
          clearTimeout(timer)
          reject(new Error(this.state.lastError))
        } else {
          setTimeout(checkRegistration, TIMING.POLLING_INTERVAL)
        }
      }

      checkRegistration()
    })
  }

  /**
   * Get registration state
   */
  getState(): RegistrationState {
    return { ...this.state }
  }

  /**
   * Get registration metrics
   */
  getMetrics(): RegistrationMetrics {
    return {
      registered: this.state.registered,
      registering: this.state.registering,
      registrationAttempts: this.state.registrationAttempts,
      registrationFailures: this.state.registrationFailures,
    }
  }

  /**
   * Is agent registered
   */
  isRegistered(): boolean {
    return this.state.registered
  }

  /**
   * Get registration expiry time
   */
  getExpires(): number {
    return this.state.expires
  }

  /**
   * Handle registered event
   */
  private handleRegistered(data: any): void {
    this.state.registered = true
    this.state.registering = false
    this.state.lastRegistration = Date.now()
    this.state.lastError = null

    // Extract expires from response
    if (data?.response?.getHeader) {
      const expires = data.response.getHeader('Expires')
      this.state.expires = expires ? parseInt(expires, 10) : 600
    }

    this.emit('registration:success', {
      agentId: this.agentId,
      expires: this.state.expires,
    })
  }

  /**
   * Handle unregistered event
   */
  private handleUnregistered(): void {
    this.state.registered = false
    this.state.lastUnregistration = Date.now()
    this.state.expires = 0

    this.emit('registration:unregistered', {
      agentId: this.agentId,
    })
  }

  /**
   * Handle registration failed event
   */
  private handleRegistrationFailed(data: any): void {
    this.state.registered = false
    this.state.registering = false
    this.state.registrationFailures++
    this.state.lastError = data?.cause || 'Unknown error'

    // Track error in agent
    this.agent.addError('REGISTRATION_FAILED', this.state.lastError, 'registration')

    this.emit('registration:failed', {
      agentId: this.agentId,
      error: this.state.lastError,
      attempts: this.state.registrationAttempts,
      failures: this.state.registrationFailures,
    })
  }
}
