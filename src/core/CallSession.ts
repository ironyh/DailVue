/**
 * CallSession - Manages individual SIP call sessions
 * Handles call lifecycle, state transitions, and media management
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: JsSIP doesn't have TypeScript types, so 'any' is necessary for RTCSession integration

import type { EventBus } from './EventBus'
import type {
  CallState,
  CallDirection,
  AnswerOptions,
  DTMFOptions,
  CallTimingInfo,
  CallStatistics,
  TerminationCause,
  CallSession as ICallSession,
} from '@/types/call.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('CallSession')

/**
 * Call session options
 */
export interface CallSessionOptions {
  /** Call ID */
  id: string
  /** Call direction */
  direction: CallDirection
  /** Local SIP URI */
  localUri: string
  /** Remote SIP URI */
  remoteUri: string
  /** Remote display name */
  remoteDisplayName?: string
  /** JsSIP RTCSession instance */
  rtcSession: any
  /** Event bus for emitting events */
  eventBus: EventBus
  /** Custom data */
  data?: Record<string, any>
}

/**
 * CallSession manages an individual call session
 *
 * Features:
 * - Call lifecycle management (outgoing/incoming/termination)
 * - State transition tracking
 * - Call timing tracking
 * - Media stream management
 * - Call controls (hold, mute, DTMF)
 * - Statistics collection
 * - Event-driven architecture
 *
 * @example
 * ```ts
 * const session = new CallSession(options)
 * await session.answer()
 * await session.hangup()
 * ```
 */
export class CallSession {
  // Core properties
  private readonly _id: string
  private readonly _direction: CallDirection
  private readonly _localUri: string
  private readonly _remoteUri: string
  private readonly _remoteDisplayName?: string
  private readonly rtcSession: any
  private readonly eventBus: EventBus
  private readonly _data: Record<string, any>

  // State
  private _state: CallState = 'idle' as CallState
  private _isOnHold = false
  private _isMuted = false
  private _hasRemoteVideo = false
  private _hasLocalVideo = false

  // Media streams
  private _localStream?: MediaStream
  private _remoteStream?: MediaStream

  // Timing
  private readonly _timing: CallTimingInfo = {}

  // Termination
  private _terminationCause?: TerminationCause

  // Flags
  private isAnswering = false
  private isTerminating = false
  private isHoldPending = false

  // Timers
  private holdTimeoutTimer?: ReturnType<typeof setTimeout>

  // DTMF queue
  private dtmfQueue: string[] = []

  // Constants
  private readonly HOLD_TIMEOUT_MS = 10000 // 10 seconds timeout for hold/unhold operations
  private isDtmfSending = false

  constructor(options: CallSessionOptions) {
    // Validate URIs
    this.validateUri(options.localUri, 'localUri')
    this.validateUri(options.remoteUri, 'remoteUri')

    this._id = options.id
    this._direction = options.direction
    this._localUri = options.localUri
    this._remoteUri = options.remoteUri
    this._remoteDisplayName = options.remoteDisplayName
    this.rtcSession = options.rtcSession
    this.eventBus = options.eventBus
    this._data = options.data ?? {}

    // Set initial timing
    this._timing.startTime = new Date()

    // Setup RTCSession event handlers
    this.setupEventHandlers()

    logger.debug(`CallSession created: ${this._id}`, {
      direction: this._direction,
      localUri: this._localUri,
      remoteUri: this._remoteUri,
    })
  }

  // Getters
  get id(): string {
    return this._id
  }

  get state(): CallState {
    return this._state
  }

  get direction(): CallDirection {
    return this._direction
  }

  get localUri(): string {
    return this._localUri
  }

  get remoteUri(): string {
    return this._remoteUri
  }

  get remoteDisplayName(): string | undefined {
    return this._remoteDisplayName
  }

  get localStream(): MediaStream | undefined {
    return this._localStream
  }

  get remoteStream(): MediaStream | undefined {
    return this._remoteStream
  }

  get isOnHold(): boolean {
    return this._isOnHold
  }

  get isMuted(): boolean {
    return this._isMuted
  }

  get hasRemoteVideo(): boolean {
    return this._hasRemoteVideo
  }

  get hasLocalVideo(): boolean {
    return this._hasLocalVideo
  }

  get timing(): Readonly<CallTimingInfo> {
    return { ...this._timing }
  }

  get terminationCause(): TerminationCause | undefined {
    return this._terminationCause
  }

  get data(): Record<string, any> {
    return { ...this._data }
  }

  /**
   * Get the current call session as an interface
   */
  toInterface(): ICallSession {
    return {
      id: this._id,
      state: this._state,
      direction: this._direction,
      localUri: this._localUri,
      remoteUri: this._remoteUri,
      remoteDisplayName: this._remoteDisplayName,
      localStream: this._localStream,
      remoteStream: this._remoteStream,
      isOnHold: this._isOnHold,
      isMuted: this._isMuted,
      hasRemoteVideo: this._hasRemoteVideo,
      hasLocalVideo: this._hasLocalVideo,
      timing: this.timing,
      terminationCause: this._terminationCause,
      data: { ...this._data },
    }
  }

  /**
   * Answer an incoming call
   *
   * Implements incoming call flow:
   * 1. Validate call state
   * 2. Get local media stream
   * 3. Create answer SDP
   * 4. Send 200 OK with SDP
   * 5. Wait for ACK
   * 6. Establish media flow
   * 7. Transition to active state
   */
  async answer(options?: AnswerOptions): Promise<void> {
    if (this._direction !== ('incoming' as CallDirection)) {
      throw new Error('Cannot answer outgoing call')
    }

    if (this._state !== ('ringing' as CallState)) {
      throw new Error(`Cannot answer call in state: ${this._state}`)
    }

    if (this.isAnswering) {
      logger.warn('Call is already being answered')
      return
    }

    this.isAnswering = true

    try {
      logger.info(`Answering call: ${this._id}`)
      this.updateState('answering' as CallState)

      // Prepare answer options
      const answerOptions: any = {}

      // Media constraints
      if (options?.mediaConstraints) {
        answerOptions.mediaConstraints = options.mediaConstraints
      }

      // RTC configuration
      if (options?.rtcConfiguration) {
        answerOptions.rtcConfiguration = options.rtcConfiguration
      }

      // Extra headers
      if (options?.extraHeaders) {
        answerOptions.extraHeaders = options.extraHeaders
      }

      // Answer the call using JsSIP
      this.rtcSession.answer(answerOptions)

      // The 'accepted' and 'confirmed' events will handle state transitions
    } catch (error) {
      logger.error(`Failed to answer call: ${this._id}`, error)
      this.updateState('failed' as CallState)
      throw error
    } finally {
      this.isAnswering = false
    }
  }

  /**
   * Reject an incoming call
   *
   * @param statusCode - SIP status code (default: 603 Decline)
   *   - 486: Busy Here
   *   - 603: Decline
   *   - 480: Temporarily Unavailable
   */
  async reject(statusCode: number = 603): Promise<void> {
    if (this._direction !== ('incoming' as CallDirection)) {
      throw new Error('Cannot reject outgoing call')
    }

    if (this._state !== ('ringing' as CallState)) {
      throw new Error(`Cannot reject call in state: ${this._state}`)
    }

    // Validate status code
    if (statusCode < 400 || statusCode > 699) {
      throw new Error(`Invalid rejection status code: ${statusCode}. Must be 4xx-6xx`)
    }

    try {
      logger.info(`Rejecting call: ${this._id} with status ${statusCode}`)
      this.updateState('terminating' as CallState)

      // Reject using JsSIP terminate with status code
      this.rtcSession.terminate({
        status_code: statusCode,
        reason_phrase: this.getReasonPhrase(statusCode),
      })

      // The 'failed' event will handle final state transition
    } catch (error) {
      logger.error(`Failed to reject call: ${this._id}`, error)
      this.updateState('failed' as CallState)
      throw error
    }
  }

  /**
   * Get reason phrase for status code
   */
  private getReasonPhrase(statusCode: number): string {
    const reasonPhrases: Record<number, string> = {
      480: 'Temporarily Unavailable',
      486: 'Busy Here',
      603: 'Decline',
      404: 'Not Found',
      406: 'Not Acceptable',
    }
    return reasonPhrases[statusCode] || 'Rejected'
  }

  /**
   * Terminate the call
   *
   * Implements call termination flow:
   * 1. Validate call state
   * 2. Send BYE request (or CANCEL for early states)
   * 3. Stop media streams
   * 4. Close peer connection
   * 5. Update call state
   * 6. Emit termination event
   * 7. Clean up resources
   */
  async hangup(): Promise<void> {
    if (this._state === ('terminated' as CallState)) {
      logger.warn(`Call already terminated: ${this._id}`)
      return
    }

    if (this.isTerminating) {
      logger.warn('Call is already terminating')
      return
    }

    this.isTerminating = true

    try {
      logger.info(`Terminating call: ${this._id}`)
      this.updateState('terminating' as CallState)

      // Terminate using JsSIP
      this.rtcSession.terminate()

      // The 'ended' event will handle final cleanup
    } catch (error) {
      logger.error(`Failed to terminate call: ${this._id}`, error)
      throw error
    } finally {
      this.isTerminating = false
    }
  }

  /**
   * Put call on hold
   */
  async hold(): Promise<void> {
    if (this._state !== ('active' as CallState)) {
      throw new Error(`Cannot hold call in state: ${this._state}`)
    }

    if (this._isOnHold) {
      logger.warn('Call is already on hold')
      return
    }

    if (this.isHoldPending) {
      throw new Error('Hold/unhold operation already in progress')
    }

    this.isHoldPending = true

    // Set timeout to prevent flag from getting stuck
    this.holdTimeoutTimer = setTimeout(() => {
      if (this.isHoldPending) {
        logger.error(`Hold operation timed out after ${this.HOLD_TIMEOUT_MS}ms: ${this._id}`)
        this.isHoldPending = false
        this.holdTimeoutTimer = undefined
      }
    }, this.HOLD_TIMEOUT_MS)

    try {
      logger.info(`Putting call on hold: ${this._id}`)

      // Hold using JsSIP
      this.rtcSession.hold()

      // The 'hold' event will update state and reset flag
    } catch (error) {
      logger.error(`Failed to hold call: ${this._id}`, error)
      this.clearHoldTimeout()
      this.isHoldPending = false
      throw error
    }
  }

  /**
   * Resume call from hold
   */
  async unhold(): Promise<void> {
    if (!this._isOnHold) {
      logger.warn('Call is not on hold')
      return
    }

    if (this.isHoldPending) {
      throw new Error('Hold/unhold operation already in progress')
    }

    this.isHoldPending = true

    // Set timeout to prevent flag from getting stuck
    this.holdTimeoutTimer = setTimeout(() => {
      if (this.isHoldPending) {
        logger.error(`Unhold operation timed out after ${this.HOLD_TIMEOUT_MS}ms: ${this._id}`)
        this.isHoldPending = false
        this.holdTimeoutTimer = undefined
      }
    }, this.HOLD_TIMEOUT_MS)

    try {
      logger.info(`Resuming call from hold: ${this._id}`)

      // Unhold using JsSIP
      this.rtcSession.unhold()

      // The 'unhold' event will update state and reset flag
    } catch (error) {
      logger.error(`Failed to unhold call: ${this._id}`, error)
      this.clearHoldTimeout()
      this.isHoldPending = false
      throw error
    }
  }

  /**
   * Mute local audio
   */
  mute(): void {
    if (this._isMuted) {
      logger.warn('Call is already muted')
      return
    }

    try {
      logger.debug(`Muting call: ${this._id}`)

      // Mute using JsSIP
      this.rtcSession.mute({ audio: true })

      this._isMuted = true
      this.emitCallEvent('call:muted')
    } catch (error) {
      logger.error(`Failed to mute call: ${this._id}`, error)
      throw error
    }
  }

  /**
   * Unmute local audio
   */
  unmute(): void {
    if (!this._isMuted) {
      logger.warn('Call is not muted')
      return
    }

    try {
      logger.debug(`Unmuting call: ${this._id}`)

      // Unmute using JsSIP
      this.rtcSession.unmute({ audio: true })

      this._isMuted = false
      this.emitCallEvent('call:unmuted')
    } catch (error) {
      logger.error(`Failed to unmute call: ${this._id}`, error)
      throw error
    }
  }

  /**
   * Send DTMF tone or tone sequence
   * Tones are queued and sent sequentially with proper timing
   *
   * @param tone - Single tone (0-9, *, #, A-D) or sequence of tones (e.g., "123#")
   * @param options - DTMF options for duration, gap, and transport
   */
  sendDTMF(tone: string, options?: DTMFOptions): void {
    if (this._state !== ('active' as CallState)) {
      throw new Error(`Cannot send DTMF in state: ${this._state}`)
    }

    // Validate tone
    const validTones = /^[0-9A-D*#]+$/i
    if (!validTones.test(tone)) {
      throw new Error(`Invalid DTMF tone: ${tone}. Valid characters: 0-9, A-D, *, #`)
    }

    // Add tones to queue (split string into individual characters)
    const tones = tone.split('')
    this.dtmfQueue.push(...tones)

    logger.debug(`Added ${tones.length} tone(s) to DTMF queue: ${tone}`)

    // Start processing queue
    this.processDTMFQueue(options)
  }

  /**
   * Process DTMF queue sequentially
   */
  private async processDTMFQueue(options?: DTMFOptions): Promise<void> {
    // If already sending, return (queue will be processed)
    if (this.isDtmfSending) {
      return
    }

    this.isDtmfSending = true

    try {
      while (this.dtmfQueue.length > 0) {
        const tone = this.dtmfQueue.shift()!

        logger.debug(`Sending DTMF tone from queue: ${tone}`)

        // Prepare DTMF options
        const dtmfOptions: any = {}

        const duration = options?.duration || 100 // Default 100ms
        const interToneGap = options?.interToneGap || 70 // Default 70ms

        dtmfOptions.duration = duration

        // Send DTMF using JsSIP
        if (options?.transportType === 'INFO') {
          this.rtcSession.sendDTMF(tone, { ...dtmfOptions, transportType: 'INFO' })
        } else {
          // Default to RFC2833
          this.rtcSession.sendDTMF(tone, dtmfOptions)
        }

        this.emitCallEvent('call:dtmf_sent', { tone })

        // Wait for inter-tone gap before sending next tone
        if (this.dtmfQueue.length > 0) {
          await this.delay(interToneGap)
        }
      }
    } catch (error) {
      logger.error(`Failed to send DTMF: ${this._id}`, error)
      // Clear queue on error
      this.dtmfQueue = []
      throw error
    } finally {
      this.isDtmfSending = false
    }
  }

  /**
   * Clear DTMF queue
   */
  clearDTMFQueue(): void {
    logger.debug(`Clearing DTMF queue (${this.dtmfQueue.length} tones)`)
    this.dtmfQueue = []
  }

  /**
   * Perform blind transfer (REFER without consultation)
   * Transfers the call to a target URI using SIP REFER method
   *
   * @param targetUri - Target SIP URI to transfer to
   * @param extraHeaders - Optional SIP headers
   */
  async transfer(targetUri: string, extraHeaders?: string[]): Promise<void> {
    if (this._state !== ('active' as CallState)) {
      throw new Error(`Cannot transfer call in state: ${this._state}`)
    }

    logger.info(`Initiating blind transfer to: ${targetUri}`)

    try {
      // Use JsSIP refer method for blind transfer
      const referOptions: any = {}

      if (extraHeaders && extraHeaders.length > 0) {
        referOptions.extraHeaders = extraHeaders
      }

      // JsSIP refer method sends REFER to target URI
      this.rtcSession.refer(targetUri, referOptions)

      logger.info(`Blind transfer initiated successfully to: ${targetUri}`)

      // Emit transfer event
      this.emitCallEvent('call:transfer_initiated', {
        target: targetUri,
        transferType: 'blind',
      })
    } catch (error) {
      logger.error(`Failed to transfer call: ${this._id}`, error)
      throw error
    }
  }

  /**
   * Perform attended transfer (REFER with Replaces header)
   * Transfers the call after consultation with target
   *
   * @param targetUri - Target SIP URI
   * @param replaceCallId - Call ID of the consultation call to replace
   */
  async attendedTransfer(targetUri: string, replaceCallId: string): Promise<void> {
    if (this._state !== ('active' as CallState)) {
      throw new Error(`Cannot transfer call in state: ${this._state}`)
    }

    logger.info(`Initiating attended transfer to: ${targetUri} (replacing call: ${replaceCallId})`)

    try {
      // For attended transfer, we need to add Replaces header
      // The replaceCallId should reference the consultation call
      const referOptions: any = {
        replaces: replaceCallId, // JsSIP will construct the Replaces header
      }

      // JsSIP refer method with replaces option
      this.rtcSession.refer(targetUri, referOptions)

      logger.info(`Attended transfer initiated successfully to: ${targetUri}`)

      // Emit transfer event
      this.emitCallEvent('call:transfer_initiated', {
        target: targetUri,
        transferType: 'attended',
        replaceCallId,
      })
    } catch (error) {
      logger.error(`Failed to perform attended transfer: ${this._id}`, error)
      throw error
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get call statistics
   */
  async getStats(): Promise<CallStatistics> {
    try {
      const connection = this.rtcSession.connection

      if (!connection) {
        throw new Error('No peer connection available')
      }

      const stats = await connection.getStats()
      const callStats: CallStatistics = {
        audio: {},
        video: {},
        network: {},
      }

      // Parse WebRTC stats
      stats.forEach((report: any) => {
        if (report.type === 'inbound-rtp') {
          if (report.kind === 'audio') {
            callStats.audio = {
              bytesReceived: report.bytesReceived,
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost,
              jitter: report.jitter,
              codecName: report.codecId,
            }
          } else if (report.kind === 'video') {
            callStats.video = {
              bytesReceived: report.bytesReceived,
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost,
              frameRate: report.framesPerSecond,
              frameWidth: report.frameWidth,
              frameHeight: report.frameHeight,
              codecName: report.codecId,
            }
          }
        } else if (report.type === 'outbound-rtp') {
          if (report.kind === 'audio') {
            callStats.audio = {
              ...callStats.audio,
              bytesSent: report.bytesSent,
              packetsSent: report.packetsSent,
            }
          } else if (report.kind === 'video') {
            callStats.video = {
              ...callStats.video,
              bytesSent: report.bytesSent,
              packetsSent: report.packetsSent,
            }
          }
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          callStats.network = {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
            availableIncomingBitrate: report.availableIncomingBitrate,
          }
        }
      })

      return callStats
    } catch (error) {
      logger.error(`Failed to get call statistics: ${this._id}`, error)
      throw error
    }
  }

  /**
   * Setup JsSIP RTCSession event handlers
   */
  private setupEventHandlers(): void {
    // Progress event (provisional responses: 100, 180, 183)
    this.rtcSession.on('progress', (e: any) => {
      logger.debug(`Call progress: ${this._id}`, e)

      // Handle different provisional responses
      if (e.response) {
        const code = e.response.status_code

        if (code === 180) {
          // Ringing
          this.updateState('ringing' as CallState)
        } else if (code === 183) {
          // Early media
          this.updateState('early_media' as CallState)
        }
      }

      this.emitCallEvent('call:progress', {
        responseCode: e.response?.status_code,
        reasonPhrase: e.response?.reason_phrase,
      })
    })

    // Accepted event (200 OK received)
    this.rtcSession.on('accepted', (e: any) => {
      logger.info(`Call accepted: ${this._id}`)

      // Record answer time
      this._timing.answerTime = new Date()

      this.emitCallEvent('call:accepted', {
        responseCode: e.response?.status_code,
      })
    })

    // Confirmed event (ACK sent/received)
    this.rtcSession.on('confirmed', (_e: any) => {
      logger.info(`Call confirmed: ${this._id}`)

      this.updateState('active' as CallState)

      this.emitCallEvent('call:confirmed')
    })

    // Ended event (call terminated)
    this.rtcSession.on('ended', (e: any) => {
      logger.info(`Call ended: ${this._id}`, e)

      // Record end time
      this._timing.endTime = new Date()

      // Calculate duration (only if answered and endTime > answerTime)
      if (this._timing.answerTime && this._timing.endTime > this._timing.answerTime) {
        this._timing.duration = Math.floor(
          (this._timing.endTime.getTime() - this._timing.answerTime.getTime()) / 1000
        )
      }

      // Calculate ring duration (only if answerTime > startTime)
      if (
        this._timing.startTime &&
        this._timing.answerTime &&
        this._timing.answerTime > this._timing.startTime
      ) {
        this._timing.ringDuration = Math.floor(
          (this._timing.answerTime.getTime() - this._timing.startTime.getTime()) / 1000
        )
      }

      // Determine termination cause
      this._terminationCause = this.mapTerminationCause(e.cause)

      this.updateState('terminated' as CallState)

      this.emitCallEvent('call:ended', {
        cause: this._terminationCause,
        originator: e.originator,
      })

      // Clean up resources
      this.cleanup()
    })

    // Failed event (call failed)
    this.rtcSession.on('failed', (e: any) => {
      logger.error(`Call failed: ${this._id}`, e)

      // Record end time
      this._timing.endTime = new Date()

      // Determine termination cause
      this._terminationCause = this.mapTerminationCause(e.cause)

      this.updateState('failed' as CallState)

      this.emitCallEvent('call:failed', {
        cause: this._terminationCause,
        responseCode: e.response?.status_code,
        reasonPhrase: e.response?.reason_phrase,
        message: e.message,
      })

      // Clean up resources
      this.cleanup()
    })

    // Hold event
    this.rtcSession.on('hold', (e: any) => {
      logger.debug(`Call hold: ${this._id}`, e)

      if (e.originator === 'local') {
        this._isOnHold = true
        this.updateState('held' as CallState)
        this.clearHoldTimeout() // Clear timeout
        this.isHoldPending = false // Reset operation lock
      } else {
        this.updateState('remote_held' as CallState)
      }

      this.emitCallEvent('call:hold', {
        originator: e.originator,
      })
    })

    // Unhold event
    this.rtcSession.on('unhold', (e: any) => {
      logger.debug(`Call unhold: ${this._id}`, e)

      if (e.originator === 'local') {
        this._isOnHold = false
        this.clearHoldTimeout() // Clear timeout
        this.isHoldPending = false // Reset operation lock
      }

      this.updateState('active' as CallState)

      this.emitCallEvent('call:unhold', {
        originator: e.originator,
      })
    })

    // Muted event
    this.rtcSession.on('muted', (e: any) => {
      logger.debug(`Call muted: ${this._id}`, e)
      this._isMuted = true
    })

    // Unmuted event
    this.rtcSession.on('unmuted', (e: any) => {
      logger.debug(`Call unmuted: ${this._id}`, e)
      this._isMuted = false
    })

    // PeerConnection event (for media streams)
    this.rtcSession.on('peerconnection', (e: any) => {
      logger.debug(`PeerConnection created: ${this._id}`)

      const peerConnection = e.peerconnection

      // Listen for remote stream
      peerConnection.ontrack = (event: RTCTrackEvent) => {
        logger.debug(`Remote track received: ${event.track.kind}`)

        // Create or update remote stream
        if (!this._remoteStream) {
          this._remoteStream = new MediaStream()
        }

        // Check if track already exists to avoid duplication
        const existingTrack = this._remoteStream.getTracks().find((t) => t.id === event.track.id)
        if (!existingTrack) {
          this._remoteStream.addTrack(event.track)
          logger.debug(`Added remote track: ${event.track.id}`)
        } else {
          logger.debug(`Track ${event.track.id} already exists, skipping`)
        }

        // Check for video tracks
        if (event.track.kind === 'video') {
          this._hasRemoteVideo = true
        }

        this.emitCallEvent('call:stream_added', {
          stream: this._remoteStream,
          type: 'remote',
        })
      }

      // Listen for local stream
      peerConnection.getSenders().forEach((sender: RTCRtpSender) => {
        if (sender.track) {
          if (!this._localStream) {
            this._localStream = new MediaStream()
          }

          // Check if track already exists to avoid duplication
          const existingTrack = this._localStream.getTracks().find((t) => t.id === sender.track!.id)
          if (!existingTrack) {
            this._localStream.addTrack(sender.track)
            logger.debug(`Added local track: ${sender.track.id}`)
          } else {
            logger.debug(`Track ${sender.track.id} already exists, skipping`)
          }

          // Check for video tracks
          if (sender.track.kind === 'video') {
            this._hasLocalVideo = true
          }
        }
      })

      if (this._localStream) {
        this.emitCallEvent('call:stream_added', {
          stream: this._localStream,
          type: 'local',
        })
      }
    })

    // ICE candidate event
    this.rtcSession.on('icecandidate', (e: any) => {
      logger.debug(`ICE candidate: ${this._id}`, e.candidate)
    })

    // SDP event (for debugging)
    this.rtcSession.on('sdp', (e: any) => {
      logger.debug(`SDP ${e.type}: ${this._id}`)
    })
  }

  /**
   * Update call state and emit event
   */
  private updateState(state: CallState): void {
    if (this._state !== state) {
      const previousState = this._state
      this._state = state

      logger.debug(`Call state changed: ${previousState} -> ${state}`)

      this.emitCallEvent('call:state_changed', {
        previousState,
        currentState: state,
      })
    }
  }

  /**
   * Emit call event
   */
  private emitCallEvent(event: string, data?: any): void {
    this.eventBus.emitSync(event, {
      session: this.toInterface(),
      timestamp: new Date(),
      ...data,
    })
  }

  /**
   * Validate SIP URI format
   */
  private validateUri(uri: string, fieldName: string): void {
    if (!uri) {
      throw new Error(`${fieldName} is required`)
    }

    // Basic SIP URI validation: sip: or sips: followed by user@host
    const sipUriPattern = /^sips?:[\w\-.!~*'()&=+$,;?/]+@[\w\-.]+/
    if (!sipUriPattern.test(uri)) {
      throw new Error(
        `Invalid SIP URI format for ${fieldName}: ${uri}. Expected format: sip:user@host or sips:user@host`
      )
    }
  }

  /**
   * Map JsSIP termination cause to our TerminationCause enum
   */
  private mapTerminationCause(cause: string): TerminationCause {
    const causeMap: Record<string, TerminationCause> = {
      Canceled: 'canceled' as TerminationCause,
      Rejected: 'rejected' as TerminationCause,
      'No Answer': 'no_answer' as TerminationCause,
      Unavailable: 'unavailable' as TerminationCause,
      Busy: 'busy' as TerminationCause,
      BYE: 'bye' as TerminationCause,
      'Request Timeout': 'request_timeout' as TerminationCause,
      'WebRTC Error': 'webrtc_error' as TerminationCause,
      'Internal Error': 'internal_error' as TerminationCause,
      'Connection Error': 'network_error' as TerminationCause,
    }

    return causeMap[cause] ?? ('other' as TerminationCause)
  }

  /**
   * Clean up resources
   */
  /**
   * Clear hold/unhold timeout
   */
  private clearHoldTimeout(): void {
    if (this.holdTimeoutTimer) {
      clearTimeout(this.holdTimeoutTimer)
      this.holdTimeoutTimer = undefined
    }
  }

  private cleanup(): void {
    logger.debug(`Cleaning up call session: ${this._id}`)

    // Clear any pending timeouts
    this.clearHoldTimeout()

    // Stop local stream tracks
    if (this._localStream) {
      this._localStream.getTracks().forEach((track) => {
        track.stop()
      })
    }

    // Stop remote stream tracks
    if (this._remoteStream) {
      this._remoteStream.getTracks().forEach((track) => {
        track.stop()
      })
    }

    // Remove all event listeners from RTCSession
    if (this.rtcSession) {
      this.rtcSession.removeAllListeners()
    }
  }

  /**
   * Destroy the call session
   */
  destroy(): void {
    logger.info(`Destroying call session: ${this._id}`)

    // Terminate if not already terminated
    if (this._state !== ('terminated' as CallState) && this._state !== ('failed' as CallState)) {
      this.hangup().catch((error) => {
        logger.error(`Error during destroy hangup: ${error}`)
      })
    }

    this.cleanup()
  }
}

/**
 * Create a CallSession from a JsSIP RTCSession
 */
export function createCallSession(
  rtcSession: any,
  direction: CallDirection,
  localUri: string,
  eventBus: EventBus,
  data?: Record<string, any>
): CallSession {
  // Extract session information
  const id = rtcSession.id || `call-${Date.now()}`
  const remoteUri = rtcSession.remote_identity?.uri?.toString() || 'sip:unknown@unknown'
  const remoteDisplayName = rtcSession.remote_identity?.display_name

  // Set initial state based on direction
  const initialState =
    direction === ('incoming' as CallDirection)
      ? ('ringing' as CallState)
      : ('calling' as CallState)

  const session = new CallSession({
    id,
    direction,
    localUri,
    remoteUri,
    remoteDisplayName,
    rtcSession,
    eventBus,
    data,
  })

  // Set initial state after creation
  ;(session as any)._state = initialState

  return session
}
