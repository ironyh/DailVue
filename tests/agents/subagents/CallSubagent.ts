/**
 * Call Subagent
 *
 * Handles call lifecycle management for the agent
 */

import { BaseSubagent } from './BaseSubagent'
import type { SipTestAgent } from '../SipTestAgent'
import type { MockRTCSession } from '../../helpers/MockSipServer'
import type { CallOptions } from '../types'

export interface CallState {
  activeCalls: Map<string, MockRTCSession>
  callsMade: number
  callsReceived: number
  callsAccepted: number
  callsRejected: number
  callsEnded: number
  totalCallDuration: number
}

/**
 * Call subagent
 */
export class CallSubagent extends BaseSubagent {
  private state: CallState = {
    activeCalls: new Map(),
    callsMade: 0,
    callsReceived: 0,
    callsAccepted: 0,
    callsRejected: 0,
    callsEnded: 0,
    totalCallDuration: 0,
  }

  private callStartTimes: Map<string, number> = new Map()

  constructor(agent: SipTestAgent) {
    super(agent, 'call')
  }

  /**
   * Initialize call handlers
   */
  protected async onInitialize(): Promise<void> {
    const ua = this.agent.getUA()

    // Listen for incoming calls
    ua.on('newRTCSession', (data: any) => {
      if (data.originator === 'remote') {
        this.handleIncomingCall(data.session)
      }
    })
  }

  /**
   * Cleanup active calls
   */
  protected async onCleanup(): Promise<void> {
    // Terminate all active calls
    const calls = Array.from(this.state.activeCalls.values())
    for (const call of calls) {
      call.terminate()
      this.state.activeCalls.delete(call.id)
      this.callStartTimes.delete(call.id)
    }
  }

  /**
   * Make a call to another agent or SIP URI
   */
  async makeCall(targetUri: string, options: CallOptions = {}): Promise<MockRTCSession> {
    const ua = this.agent.getUA()

    // Make the call
    const session = ua.call(targetUri, options)

    // Track the call
    this.state.activeCalls.set(session.id, session)
    this.state.callsMade++
    this.callStartTimes.set(session.id, Date.now())

    // Setup session event handlers
    this.setupSessionHandlers(session)

    this.emit('call:made', {
      agentId: this.agentId,
      sessionId: session.id,
      target: targetUri,
    })

    return session
  }

  /**
   * Answer an incoming call
   */
  async answerCall(sessionId: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    session.answer()
    this.state.callsAccepted++

    this.emit('call:answered', {
      agentId: this.agentId,
      sessionId,
    })
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(sessionId: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    session.terminate()
    this.state.callsRejected++

    this.emit('call:rejected', {
      agentId: this.agentId,
      sessionId,
    })
  }

  /**
   * Terminate a call
   */
  async terminateCall(sessionId: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    session.terminate()

    // Remove from active calls immediately
    const startTime = this.callStartTimes.get(sessionId)
    if (startTime) {
      const duration = Date.now() - startTime
      this.state.totalCallDuration += duration
      this.callStartTimes.delete(sessionId)
    }

    this.state.activeCalls.delete(sessionId)
    this.state.callsEnded++

    this.emit('call:terminated', {
      agentId: this.agentId,
      sessionId,
    })
  }

  /**
   * Hold a call
   */
  async holdCall(sessionId: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    await session.hold()

    this.emit('call:held', {
      agentId: this.agentId,
      sessionId,
    })
  }

  /**
   * Unhold a call
   */
  async unholdCall(sessionId: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    await session.unhold()

    this.emit('call:unheld', {
      agentId: this.agentId,
      sessionId,
    })
  }

  /**
   * Transfer a call
   */
  async transferCall(sessionId: string, targetUri: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    session.refer(targetUri)

    this.emit('call:transferred', {
      agentId: this.agentId,
      sessionId,
      target: targetUri,
    })
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(sessionId: string, tone: string): Promise<void> {
    const session = this.state.activeCalls.get(sessionId)
    if (!session) {
      throw new Error(`Call session ${sessionId} not found`)
    }

    session.sendDTMF(tone)

    this.emit('call:dtmf', {
      agentId: this.agentId,
      sessionId,
      tone,
    })
  }

  /**
   * Get active calls
   */
  getActiveCalls(): MockRTCSession[] {
    return Array.from(this.state.activeCalls.values())
  }

  /**
   * Get call by ID
   */
  getCall(sessionId: string): MockRTCSession | undefined {
    return this.state.activeCalls.get(sessionId)
  }

  /**
   * Wait for an incoming call
   */
  async waitForIncomingCall(timeout = 5000): Promise<MockRTCSession> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`No incoming call received within ${timeout}ms`))
      }, timeout)

      const initialCallCount = this.state.callsReceived

      const checkIncomingCall = () => {
        if (this.state.callsReceived > initialCallCount) {
          clearTimeout(timer)
          // Get the most recent call
          const calls = this.getActiveCalls()
          resolve(calls[calls.length - 1])
        } else {
          setTimeout(checkIncomingCall, 100)
        }
      }

      checkIncomingCall()
    })
  }

  /**
   * Get call state
   */
  getState(): Record<string, unknown> {
    return {
      activeCallCount: this.state.activeCalls.size,
      callsMade: this.state.callsMade,
      callsReceived: this.state.callsReceived,
      callsAccepted: this.state.callsAccepted,
      callsRejected: this.state.callsRejected,
      callsEnded: this.state.callsEnded,
      averageCallDuration:
        this.state.callsEnded > 0 ? this.state.totalCallDuration / this.state.callsEnded : 0,
    }
  }

  /**
   * Handle incoming call
   */
  private handleIncomingCall(session: MockRTCSession): void {
    this.state.activeCalls.set(session.id, session)
    this.state.callsReceived++
    this.callStartTimes.set(session.id, Date.now())

    // Setup session event handlers
    this.setupSessionHandlers(session)

    this.emit('call:incoming', {
      agentId: this.agentId,
      sessionId: session.id,
    })
  }

  /**
   * Setup event handlers for a call session
   */
  private setupSessionHandlers(session: MockRTCSession): void {
    session.on('progress', () => {
      this.emit('call:progress', {
        agentId: this.agentId,
        sessionId: session.id,
      })
    })

    session.on('accepted', () => {
      this.emit('call:accepted', {
        agentId: this.agentId,
        sessionId: session.id,
      })
    })

    session.on('confirmed', () => {
      this.emit('call:confirmed', {
        agentId: this.agentId,
        sessionId: session.id,
      })
    })

    session.on('ended', (data: any) => {
      this.handleCallEnded(session.id, data)
    })

    session.on('hold', (data: any) => {
      this.emit('call:hold', {
        agentId: this.agentId,
        sessionId: session.id,
        originator: data.originator,
      })
    })

    session.on('unhold', (data: any) => {
      this.emit('call:unhold', {
        agentId: this.agentId,
        sessionId: session.id,
        originator: data.originator,
      })
    })
  }

  /**
   * Handle call ended
   */
  private handleCallEnded(sessionId: string, data: any): void {
    const startTime = this.callStartTimes.get(sessionId)
    if (startTime) {
      const duration = Date.now() - startTime
      this.state.totalCallDuration += duration
      this.callStartTimes.delete(sessionId)
    }

    this.state.activeCalls.delete(sessionId)
    this.state.callsEnded++

    this.emit('call:ended', {
      agentId: this.agentId,
      sessionId,
      originator: data.originator,
      cause: data.cause,
    })
  }
}
