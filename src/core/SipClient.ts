/**
 * SipClient - Core SIP client implementation using JsSIP
 * Handles UA initialization, registration, and SIP method routing
 * @packageDocumentation
 */

import JsSIP, { type UA, type Socket } from 'jssip'
import type { UAConfiguration } from 'jssip/lib/UA'
import type { EventBus } from './EventBus'
import type { SipClientConfig, ValidationResult } from '@/types/config.types'
import type {
  ConferenceOptions,
  ConferenceStateInterface,
  Participant,
  ConferenceState,
  ParticipantState,
} from '@/types/conference.types'
import type { PresencePublishOptions, PresenceSubscriptionOptions } from '@/types/presence.types'
import type { CallSession, CallOptions } from '@/types/call.types'
import { CallState, CallDirection } from '@/types/call.types'
// Note: JsSIP types are defined in jssip.types.ts for documentation purposes,
// but we use 'any' for JsSIP event handlers since the library doesn't export proper types
import {
  RegistrationState,
  ConnectionState,
  type AuthenticationCredentials,
} from '@/types/sip.types'
import type {
  SipConnectedEvent,
  SipDisconnectedEvent,
  SipRegisteredEvent,
  SipUnregisteredEvent,
  SipRegistrationFailedEvent,
  SipRegistrationExpiringEvent,
  SipNewSessionEvent,
  SipNewMessageEvent,
  SipGenericEvent,
  ConferenceCreatedEvent,
  ConferenceJoinedEvent,
  ConferenceEndedEvent,
  ConferenceParticipantJoinedEvent,
  ConferenceParticipantLeftEvent,
  ConferenceParticipantInvitedEvent,
  ConferenceParticipantRemovedEvent,
  ConferenceParticipantMutedEvent,
  ConferenceParticipantUnmutedEvent,
  ConferenceRecordingStartedEvent,
  ConferenceRecordingStoppedEvent,
  AudioMutedEvent,
  AudioUnmutedEvent,
  PresencePublishEvent,
  PresenceSubscribeEvent,
  PresenceUnsubscribeEvent,
} from '@/types/events.types'
import { createLogger } from '@/utils/logger'
import { validateSipConfig } from '@/utils/validators'
import { USER_AGENT } from '@/utils/constants'

const logger = createLogger('SipClient')

/**
 * SIP Client state
 */
interface SipClientState {
  /** Current connection state */
  connectionState: ConnectionState
  /** Current registration state */
  registrationState: RegistrationState
  /** Registered SIP URI */
  registeredUri?: string
  /** Registration expiry time in seconds */
  registrationExpiry?: number
  /** Last registration timestamp */
  lastRegistrationTime?: Date
}

/**
 * SipClient manages the JsSIP User Agent and handles SIP communication
 *
 * Features:
 * - JsSIP UA initialization and lifecycle management
 * - SIP registration management
 * - Digest authentication (MD5)
 * - WebSocket transport integration
 * - Custom User-Agent header
 * - SIP trace logging
 * - Event-driven architecture
 *
 * @example
 * ```ts
 * const sipClient = new SipClient(config, eventBus)
 * await sipClient.start()
 * await sipClient.register()
 * ```
 */
export class SipClient {
  private ua: UA | null = null
  private config: SipClientConfig
  private eventBus: EventBus
  private state: SipClientState
  private isStarting = false
  private isStopping = false

  // Phase 11+ features
  private activeCalls = new Map<string, any>() // Maps call ID to RTCSession
  private messageHandlers: Array<(from: string, content: string, contentType?: string) => void> = []
  private composingHandlers: Array<(from: string, isComposing: boolean) => void> = []
  private presenceSubscriptions = new Map<string, any>()
  private isMuted = false

  // Conference management
  private conferences = new Map<string, ConferenceStateInterface>()

  constructor(config: SipClientConfig, eventBus: EventBus) {
    this.config = config
    this.eventBus = eventBus
    this.state = {
      connectionState: ConnectionState.Disconnected,
      registrationState: RegistrationState.Unregistered,
    }

    // Enable JsSIP debug mode if configured
    if (config.debug) {
      JsSIP.debug.enable('JsSIP:*')
    } else {
      JsSIP.debug.disable()
    }
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state.connectionState
  }

  /**
   * Get current registration state
   */
  get registrationState(): RegistrationState {
    return this.state.registrationState
  }

  /**
   * Check if connected to SIP server
   */
  get isConnected(): boolean {
    return this.ua?.isConnected() ?? false
  }

  /**
   * Check if registered with SIP server
   */
  get isRegistered(): boolean {
    return this.ua?.isRegistered() ?? false
  }

  /**
   * Get the JsSIP UA instance
   */
  get userAgent(): UA | null {
    return this.ua
  }

  /**
   * Get current client state
   */
  getState(): Readonly<SipClientState> {
    return { ...this.state }
  }

  /**
   * Get current configuration
   * @returns The SIP client configuration
   */
  getConfig(): Readonly<SipClientConfig> {
    return { ...this.config }
  }

  /**
   * Validate configuration
   */
  validateConfig(): ValidationResult {
    return validateSipConfig(this.config)
  }

  /**
   * Start the SIP client (initialize UA and connect)
   */
  async start(): Promise<void> {
    if (this.ua && this.isConnected) {
      logger.warn('SIP client is already started')
      return
    }

    if (this.isStarting) {
      logger.warn('SIP client is already starting')
      return
    }

    this.isStarting = true

    try {
      // Validate configuration
      const validation = this.validateConfig()
      if (!validation.valid) {
        throw new Error(`Invalid SIP configuration: ${validation.errors?.join(', ')}`)
      }

      // Create JsSIP configuration
      const uaConfig = this.createUAConfiguration()

      // Create UA instance
      logger.debug('Creating JsSIP UA instance')
      this.ua = new JsSIP.UA(uaConfig)

      // Setup event handlers
      this.setupEventHandlers()

      // Start UA (connect to WebSocket)
      logger.info('Starting SIP client')
      this.updateConnectionState(ConnectionState.Connecting)
      this.ua.start()

      // Wait for connection
      await this.waitForConnection()

      logger.info('SIP client started successfully')

      // Auto-register if configured
      if (this.config.registrationOptions?.autoRegister !== false) {
        await this.register()
      }
    } catch (error) {
      logger.error('Failed to start SIP client:', error)
      this.updateConnectionState(ConnectionState.ConnectionFailed)
      throw error
    } finally {
      this.isStarting = false
    }
  }

  /**
   * Stop the SIP client (unregister and disconnect)
   */
  async stop(): Promise<void> {
    if (!this.ua) {
      logger.warn('SIP client is not started')
      return
    }

    if (this.isStopping) {
      logger.warn('SIP client is already stopping')
      return
    }

    this.isStopping = true

    try {
      logger.info('Stopping SIP client')

      // Unregister if registered
      if (this.isRegistered) {
        await this.unregister()
      }

      // Stop UA (disconnect from WebSocket)
      this.ua.stop()

      // Clear UA instance
      this.ua = null

      this.updateConnectionState(ConnectionState.Disconnected)
      this.updateRegistrationState(RegistrationState.Unregistered)

      logger.info('SIP client stopped successfully')
    } catch (error) {
      logger.error('Failed to stop SIP client:', error)
      throw error
    } finally {
      this.isStopping = false
    }
  }

  /**
   * Register with SIP server
   */
  async register(): Promise<void> {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    if (!this.isConnected) {
      throw new Error('Not connected to SIP server')
    }

    if (this.isRegistered) {
      logger.warn('Already registered')
      return
    }

    logger.info('Registering with SIP server')
    this.updateRegistrationState(RegistrationState.Registering)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Registration timeout'))
      }, 30000) // 30 second timeout

      const onSuccess = () => {
        clearTimeout(timeout)
        logger.info('Registration successful')
        this.updateRegistrationState(RegistrationState.Registered)
        this.state.registeredUri = this.config.sipUri
        this.state.lastRegistrationTime = new Date()
        this.state.registrationExpiry = this.config.registrationOptions?.expires ?? 600
        resolve()
      }

      const onFailure = (cause: unknown) => {
        clearTimeout(timeout)
        logger.error('Registration failed:', cause)
        this.updateRegistrationState(RegistrationState.RegistrationFailed)
        reject(new Error(`Registration failed: ${String(cause)}`))
      }

      // Register using JsSIP
      this.ua!.register()

      // Listen for registration events
      this.ua!.once('registered', onSuccess)
      this.ua!.once('registrationFailed', onFailure)
    })
  }

  /**
   * Unregister from SIP server
   */
  async unregister(): Promise<void> {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    if (!this.isRegistered) {
      logger.warn('Not registered')
      return
    }

    logger.info('Unregistering from SIP server')
    this.updateRegistrationState(RegistrationState.Unregistering)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Unregistration timeout'))
      }, 10000) // 10 second timeout

      const onSuccess = () => {
        clearTimeout(timeout)
        logger.info('Unregistration successful')
        this.updateRegistrationState(RegistrationState.Unregistered)
        this.state.registeredUri = undefined
        this.state.lastRegistrationTime = undefined
        this.state.registrationExpiry = undefined
        resolve()
      }

      const onFailure = (cause: unknown) => {
        clearTimeout(timeout)
        logger.error('Unregistration failed:', cause)
        reject(new Error(`Unregistration failed: ${String(cause)}`))
      }

      // Unregister using JsSIP
      this.ua!.unregister()

      // Listen for unregistration events
      this.ua!.once('unregistered', onSuccess)
      // Note: JsSIP doesn't emit 'unregistrationFailed', but handle it anyway
      setTimeout(() => {
        if (this.state.registrationState === 'unregistering') {
          onFailure('timeout')
        }
      }, 10000)
    })
  }

  /**
   * Create JsSIP UA configuration from SipClientConfig
   */
  private createUAConfiguration(): UAConfiguration {
    const config = this.config

    // Build sockets configuration
    const sockets: Socket[] = [new JsSIP.WebSocketInterface(config.uri) as Socket]

    // Build authentication credentials
    const authConfig: Partial<UAConfiguration> = {}
    if (config.password) {
      authConfig.password = config.password
    }
    if (config.authorizationUsername) {
      authConfig.authorization_user = config.authorizationUsername
    }
    if (config.realm) {
      authConfig.realm = config.realm
    }
    if (config.ha1) {
      authConfig.ha1 = config.ha1
    }

    // Build UA configuration
    const uaConfig: UAConfiguration = {
      sockets,
      uri: config.sipUri,
      ...authConfig,
      display_name: config.displayName,
      user_agent: config.userAgent ?? USER_AGENT,
      register: false, // We'll handle registration manually
      register_expires: config.registrationOptions?.expires ?? 600,
      session_timers: config.sessionOptions?.sessionTimers ?? true,
      session_timers_refresh_method: config.sessionOptions?.sessionTimersRefreshMethod ?? 'UPDATE',
      connection_recovery_min_interval: config.wsOptions?.reconnectionDelay ?? 2,
      connection_recovery_max_interval: 30,
      no_answer_timeout: config.sessionOptions?.callTimeout ?? 60000,
      use_preloaded_route: false,
    }

    logger.debug('UA configuration created:', {
      uri: uaConfig.uri,
      display_name: uaConfig.display_name,
      user_agent: uaConfig.user_agent,
    })

    return uaConfig
  }

  /**
   * Setup JsSIP UA event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ua) return

    // Connection events
    this.ua.on('connected', (e: any) => {
      logger.debug('UA connected')
      this.updateConnectionState(ConnectionState.Connected)
      this.eventBus.emitSync('sip:connected', {
        type: 'sip:connected',
        timestamp: new Date(),
        transport: e.socket?.url,
      } satisfies SipConnectedEvent)
    })

    this.ua.on('disconnected', (e: any) => {
      logger.debug('UA disconnected:', e)
      this.updateConnectionState(ConnectionState.Disconnected)
      this.eventBus.emitSync('sip:disconnected', {
        type: 'sip:disconnected',
        timestamp: new Date(),
        error: e.error,
      } satisfies SipDisconnectedEvent)
    })

    this.ua.on('connecting', (_e: any) => {
      logger.debug('UA connecting')
      this.updateConnectionState(ConnectionState.Connecting)
    })

    // Registration events
    this.ua.on('registered', (e: any) => {
      logger.info('UA registered')
      this.updateRegistrationState(RegistrationState.Registered)
      this.state.registeredUri = this.config.sipUri
      this.state.lastRegistrationTime = new Date()
      this.eventBus.emitSync('sip:registered', {
        type: 'sip:registered',
        timestamp: new Date(),
        uri: this.config.sipUri,
        expires: e.response?.getHeader('Expires'),
      } satisfies SipRegisteredEvent)
    })

    this.ua.on('unregistered', (e: any) => {
      logger.info('UA unregistered')
      this.updateRegistrationState(RegistrationState.Unregistered)
      this.state.registeredUri = undefined
      this.eventBus.emitSync('sip:unregistered', {
        type: 'sip:unregistered',
        timestamp: new Date(),
        cause: e.cause,
      } satisfies SipUnregisteredEvent)
    })

    this.ua.on('registrationFailed', (e: any) => {
      logger.error('UA registration failed:', e)
      this.updateRegistrationState(RegistrationState.RegistrationFailed)
      this.eventBus.emitSync('sip:registration_failed', {
        type: 'sip:registration_failed',
        timestamp: new Date(),
        cause: e.cause,
        response: e.response,
      } satisfies SipRegistrationFailedEvent)
    })

    this.ua.on('registrationExpiring', () => {
      logger.debug('Registration expiring, refreshing')
      this.eventBus.emitSync('sip:registration_expiring', {
        type: 'sip:registration_expiring',
        timestamp: new Date(),
      } satisfies SipRegistrationExpiringEvent)
    })

    // Call events (will be handled by CallSession)
    this.ua.on('newRTCSession', (e: any) => {
      logger.debug('New RTC session:', e)

      const session = e.session
      const callId = session.id || this.generateCallId()

      // Track incoming calls
      if (e.originator === 'remote') {
        logger.info('Incoming call', { callId })
        this.activeCalls.set(callId, session)
        this.setupSessionHandlers(session, callId)
      }

      this.eventBus.emitSync('sip:new_session', {
        type: 'sip:new_session',
        timestamp: new Date(),
        session: e.session,
        originator: e.originator,
        request: e.request,
        callId,
      } satisfies SipNewSessionEvent)
    })

    // Message events
    this.ua.on('newMessage', (e: any) => {
      logger.debug('New message:', e)

      // Extract message details
      const from = e.originator === 'remote' ? e.request?.from?.uri?.toString() : ''
      const contentType = e.request?.getHeader('Content-Type')
      const content = e.request?.body || ''

      // Check for composing indicator
      if (contentType === 'application/im-iscomposing+xml') {
        // Parse composing state - handle whitespace variations
        const isComposing = /<state>\s*active\s*<\/state>/i.test(content)
        logger.debug('Composing indicator:', { from, isComposing })

        // Call composing handlers
        this.composingHandlers.forEach((handler) => {
          try {
            handler(from, isComposing)
          } catch (error) {
            logger.error('Error in composing handler:', error)
          }
        })
      } else {
        // Regular message
        logger.debug('Incoming message:', { from, content, contentType })

        // Call message handlers
        this.messageHandlers.forEach((handler) => {
          try {
            handler(from, content, contentType)
          } catch (error) {
            logger.error('Error in message handler:', error)
          }
        })
      }

      this.eventBus.emitSync('sip:new_message', {
        type: 'sip:new_message',
        timestamp: new Date(),
        message: e.message,
        originator: e.originator,
        request: e.request,
        from,
        content,
        contentType,
      } satisfies SipNewMessageEvent)
    })

    // SIP events
    this.ua.on('sipEvent', (e: any) => {
      logger.debug('SIP event:', e)
      this.eventBus.emitSync('sip:event', {
        type: 'sip:event',
        timestamp: new Date(),
        event: e.event,
        request: e.request,
      } satisfies SipGenericEvent)
    })
  }

  /**
   * Wait for UA connection with timeout
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Connection timeout'))
      }, this.config.wsOptions?.connectionTimeout ?? 10000)

      const onConnected = () => {
        cleanup()
        resolve()
      }

      const onDisconnected = () => {
        cleanup()
        reject(new Error('Connection failed'))
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.ua?.off('connected', onConnected)
        this.ua?.off('disconnected', onDisconnected)
      }

      this.ua?.once('connected', onConnected)
      this.ua?.once('disconnected', onDisconnected)
    })
  }

  /**
   * Update connection state and emit events
   */
  private updateConnectionState(state: ConnectionState): void {
    if (this.state.connectionState !== state) {
      this.state.connectionState = state
      logger.debug(`Connection state changed: ${state}`)
    }
  }

  /**
   * Update registration state and emit events
   */
  private updateRegistrationState(state: RegistrationState): void {
    if (this.state.registrationState !== state) {
      this.state.registrationState = state
      logger.debug(`Registration state changed: ${state}`)
    }
  }

  /**
   * Send custom SIP message (MESSAGE method)
   */
  sendMessage(target: string, content: string, options?: any): void {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    if (!this.isConnected) {
      throw new Error('Not connected to SIP server')
    }

    logger.debug(`Sending message to ${target}`)
    this.ua.sendMessage(target, content, options)
  }

  /**
   * Update client configuration (requires restart)
   */
  updateConfig(config: Partial<SipClientConfig>): void {
    logger.info('Updating SIP client configuration')
    this.config = { ...this.config, ...config }
  }

  /**
   * Get authentication credentials
   */
  getCredentials(): AuthenticationCredentials {
    return {
      username: this.config.authorizationUsername ?? this.extractUsername(this.config.sipUri),
      password: this.config.password,
      ha1: this.config.ha1,
      realm: this.config.realm,
    }
  }

  /**
   * Extract username from SIP URI
   */
  private extractUsername(sipUri: string): string {
    const match = sipUri.match(/sips?:([^@]+)@/)
    return match ? match[1]! : ''
  }

  /**
   * Create a conference
   */
  async createConference(conferenceId: string, options?: ConferenceOptions): Promise<void> {
    if (!this.ua || !this.isConnected) {
      throw new Error('SIP client is not connected')
    }

    logger.info('Creating conference', { conferenceId, options })

    // Check if conference already exists
    if (this.conferences.has(conferenceId)) {
      throw new Error(`Conference ${conferenceId} already exists`)
    }

    // Create conference state
    const conference: ConferenceStateInterface = {
      id: conferenceId,
      state: ConferenceState.Creating,
      participants: new Map(),
      isLocked: options?.locked || false,
      isRecording: false,
      maxParticipants: options?.maxParticipants,
      metadata: options?.metadata,
    }

    // Create local participant
    const localParticipant: Participant = {
      id: 'local',
      uri: this.config.sipUri,
      displayName: this.config.displayName,
      state: ParticipantState.Connected,
      isMuted: false,
      isOnHold: false,
      isModerator: true,
      isSelf: true,
      joinedAt: new Date(),
    }

    conference.participants.set('local', localParticipant)
    conference.localParticipant = localParticipant

    // Store conference
    this.conferences.set(conferenceId, conference)

    // Update state
    conference.state = ConferenceState.Active
    conference.startedAt = new Date()

    logger.info('Conference created', { conferenceId })

    // Emit event
    this.eventBus.emitSync('sip:conference:created', {
      type: 'sip:conference:created',
      timestamp: new Date(),
      conferenceId,
      conference,
    } satisfies ConferenceCreatedEvent)
  }

  /**
   * Join a conference
   */
  async joinConference(conferenceUri: string, options?: ConferenceOptions): Promise<void> {
    if (!this.ua || !this.isConnected) {
      throw new Error('SIP client is not connected')
    }

    logger.info('Joining conference', { conferenceUri, options })

    // Extract conference ID from URI
    const conferenceId = this.extractConferenceId(conferenceUri)

    // Check if already in conference
    if (this.conferences.has(conferenceId)) {
      logger.warn('Already in conference', { conferenceId })
      return
    }

    // Create conference state
    const conference: ConferenceStateInterface = {
      id: conferenceId,
      uri: conferenceUri,
      state: ConferenceState.Creating,
      participants: new Map(),
      isLocked: false,
      isRecording: false,
      maxParticipants: options?.maxParticipants,
      metadata: options?.metadata,
    }

    // Store conference early
    this.conferences.set(conferenceId, conference)

    try {
      // Make call to conference URI
      const callId = await this.makeCall(conferenceUri, {
        audio: true,
        video: options?.enableVideo,
      })

      // Create local participant
      const localParticipant: Participant = {
        id: callId,
        uri: this.config.sipUri,
        displayName: this.config.displayName,
        state: ParticipantState.Connecting,
        isMuted: false,
        isOnHold: false,
        isModerator: false,
        isSelf: true,
        joinedAt: new Date(),
      }

      conference.participants.set(callId, localParticipant)
      conference.localParticipant = localParticipant

      // Setup listener to update state when call connects
      const session = this.activeCalls.get(callId)
      if (session) {
        session.once('confirmed', () => {
          conference.state = ConferenceState.Active
          conference.startedAt = new Date()
          localParticipant.state = ParticipantState.Connected

          logger.info('Joined conference', { conferenceId })

          // Emit event
          this.eventBus.emitSync('sip:conference:joined', {
            type: 'sip:conference:joined',
            timestamp: new Date(),
            conferenceId,
            conference,
          } satisfies ConferenceJoinedEvent)
        })

        session.once('failed', (e: any) => {
          conference.state = ConferenceState.Failed
          localParticipant.state = ParticipantState.Disconnected
          this.conferences.delete(conferenceId)

          logger.error('Failed to join conference', { conferenceId, cause: e.cause })
        })
      }
    } catch (error) {
      // Clean up on error
      this.conferences.delete(conferenceId)
      logger.error('Failed to join conference:', error)
      throw error
    }
  }

  /**
   * Invite participant to conference
   */
  async inviteToConference(conferenceId: string, participantUri: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    logger.info('Inviting participant to conference', { conferenceId, participantUri })

    try {
      // Make call to participant
      const callId = await this.makeCall(participantUri, { audio: true })

      // Create participant
      const participant: Participant = {
        id: callId,
        uri: participantUri,
        state: ParticipantState.Connecting,
        isMuted: false,
        isOnHold: false,
        isModerator: false,
        isSelf: false,
        joinedAt: new Date(),
      }

      // Add to conference
      conference.participants.set(callId, participant)

      // Setup listener to update state when participant connects
      const session = this.activeCalls.get(callId)
      if (session) {
        session.once('confirmed', () => {
          participant.state = ParticipantState.Connected
          logger.info('Participant connected to conference', { conferenceId, participantUri, callId })

          // Emit participant joined event
          this.eventBus.emitSync('sip:conference:participant:joined', {
            type: 'sip:conference:participant:joined',
            timestamp: new Date(),
            conferenceId,
            participant,
          } satisfies ConferenceParticipantJoinedEvent)
        })

        session.once('failed', (e: any) => {
          participant.state = ParticipantState.Disconnected
          conference.participants.delete(callId)
          logger.error('Participant failed to join conference', {
            conferenceId,
            participantUri,
            cause: e.cause,
          })
        })

        session.once('ended', () => {
          participant.state = ParticipantState.Disconnected
          conference.participants.delete(callId)
          logger.info('Participant left conference', { conferenceId, participantUri, callId })

          // Emit participant left event
          this.eventBus.emitSync('sip:conference:participant:left', {
            type: 'sip:conference:participant:left',
            timestamp: new Date(),
            conferenceId,
            participant,
          } satisfies ConferenceParticipantLeftEvent)
        })
      }

      logger.info('Participant invited', { conferenceId, participantUri, callId })

      // Emit event
      this.eventBus.emitSync('sip:conference:participant:invited', {
        type: 'sip:conference:participant:invited',
        timestamp: new Date(),
        conferenceId,
        participant,
      } satisfies ConferenceParticipantInvitedEvent)
    } catch (error) {
      logger.error('Failed to invite participant to conference:', error)
      throw error
    }
  }

  /**
   * Remove participant from conference
   */
  async removeFromConference(conferenceId: string, participantId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    const participant = conference.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found in conference`)
    }

    logger.info('Removing participant from conference', { conferenceId, participantId })

    // End the call for this participant
    const session = this.activeCalls.get(participantId)
    if (session) {
      try {
        session.terminate()
      } catch (error) {
        logger.error('Failed to terminate participant session:', error)
      }
    }

    // Remove from conference
    conference.participants.delete(participantId)
    participant.state = ParticipantState.Disconnected

    logger.info('Participant removed', { conferenceId, participantId })

    // Emit event
    this.eventBus.emitSync('sip:conference:participant:removed', {
      type: 'sip:conference:participant:removed',
      timestamp: new Date(),
      conferenceId,
      participant,
    } satisfies ConferenceParticipantRemovedEvent)
  }

  /**
   * Mute conference participant
   */
  async muteParticipant(conferenceId: string, participantId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    const participant = conference.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found in conference`)
    }

    logger.info('Muting participant', { conferenceId, participantId })

    // If it's the local participant, mute locally
    if (participant.isSelf) {
      await this.muteAudio()
      participant.isMuted = true
    } else {
      // For remote participants, send SIP INFO or REFER to request mute
      // This is server-dependent functionality
      logger.warn('Remote participant muting requires server support')
      participant.isMuted = true
    }

    logger.info('Participant muted', { conferenceId, participantId })

    // Emit event
    this.eventBus.emitSync('sip:conference:participant:muted', {
      type: 'sip:conference:participant:muted',
      timestamp: new Date(),
      conferenceId,
      participant,
    } satisfies ConferenceParticipantMutedEvent)
  }

  /**
   * Unmute conference participant
   */
  async unmuteParticipant(conferenceId: string, participantId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    const participant = conference.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found in conference`)
    }

    logger.info('Unmuting participant', { conferenceId, participantId })

    // If it's the local participant, unmute locally
    if (participant.isSelf) {
      await this.unmuteAudio()
      participant.isMuted = false
    } else {
      // For remote participants, send SIP INFO or REFER to request unmute
      // This is server-dependent functionality
      logger.warn('Remote participant unmuting requires server support')
      participant.isMuted = false
    }

    logger.info('Participant unmuted', { conferenceId, participantId })

    // Emit event
    this.eventBus.emitSync('sip:conference:participant:unmuted', {
      type: 'sip:conference:participant:unmuted',
      timestamp: new Date(),
      conferenceId,
      participant,
    } satisfies ConferenceParticipantUnmutedEvent)
  }

  /**
   * End a conference
   */
  async endConference(conferenceId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    logger.info('Ending conference', { conferenceId })

    conference.state = ConferenceState.Ending

    // Terminate all participant calls
    const terminatePromises: Promise<void>[] = []

    conference.participants.forEach((participant, participantId) => {
      if (!participant.isSelf) {
        const session = this.activeCalls.get(participantId)
        if (session) {
          terminatePromises.push(
            new Promise<void>((resolve) => {
              try {
                session.terminate()
                resolve()
              } catch (error) {
                logger.error('Failed to terminate participant session:', error)
                resolve()
              }
            })
          )
        }
      }
    })

    // Wait for all calls to terminate
    await Promise.all(terminatePromises)

    // Update conference state
    conference.state = ConferenceState.Ended
    conference.endedAt = new Date()

    // Clean up
    this.conferences.delete(conferenceId)

    logger.info('Conference ended', { conferenceId })

    // Emit event
    this.eventBus.emitSync('sip:conference:ended', {
      type: 'sip:conference:ended',
      timestamp: new Date(),
      conferenceId,
      conference,
    } satisfies ConferenceEndedEvent)
  }

  /**
   * Start conference recording
   */
  async startConferenceRecording(conferenceId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    logger.info('Starting conference recording', { conferenceId })

    // Recording functionality is typically server-side
    // This would send a SIP INFO or use conference control protocol
    conference.isRecording = true

    logger.info('Conference recording started', { conferenceId })

    // Emit event
    this.eventBus.emitSync('sip:conference:recording:started', {
      type: 'sip:conference:recording:started',
      timestamp: new Date(),
      conferenceId,
    } satisfies ConferenceRecordingStartedEvent)
  }

  /**
   * Stop conference recording
   */
  async stopConferenceRecording(conferenceId: string): Promise<void> {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`)
    }

    logger.info('Stopping conference recording', { conferenceId })

    // Recording functionality is typically server-side
    conference.isRecording = false

    logger.info('Conference recording stopped', { conferenceId })

    // Emit event
    this.eventBus.emitSync('sip:conference:recording:stopped', {
      type: 'sip:conference:recording:stopped',
      timestamp: new Date(),
      conferenceId,
    } satisfies ConferenceRecordingStoppedEvent)
  }

  /**
   * Get conference audio levels
   */
  getConferenceAudioLevels?(conferenceId: string): Map<string, number> | undefined {
    const conference = this.conferences.get(conferenceId)
    if (!conference) {
      logger.warn('Conference not found', { conferenceId })
      return undefined
    }

    // Audio level monitoring would require WebRTC stats collection
    // For now, return participant audio levels if available
    const audioLevels = new Map<string, number>()

    conference.participants.forEach((participant, participantId) => {
      if (participant.audioLevel !== undefined) {
        audioLevels.set(participantId, participant.audioLevel)
      }
    })

    return audioLevels.size > 0 ? audioLevels : undefined
  }

  /**
   * Extract conference ID from URI
   */
  private extractConferenceId(conferenceUri: string): string {
    // Extract conference ID from SIP URI (e.g., sip:conf123@server.com -> conf123)
    const match = conferenceUri.match(/sips?:([^@]+)@/)
    return match ? match[1]! : conferenceUri
  }

  /**
   * Mute audio on all active calls
   */
  async muteAudio(): Promise<void> {
    if (this.isMuted) {
      logger.debug('Audio is already muted')
      return
    }

    logger.info('Muting audio on all active calls')
    let mutedCount = 0
    let errorCount = 0

    // Mute all active call sessions
    this.activeCalls.forEach((session) => {
      if (session && session.connection) {
        try {
          const senders = session.connection.getSenders()
          senders.forEach((sender: RTCRtpSender) => {
            try {
              if (sender.track && sender.track.kind === 'audio') {
                sender.track.enabled = false
                mutedCount++
              }
            } catch (error) {
              errorCount++
              logger.error('Failed to mute audio track:', error)
            }
          })
        } catch (error) {
          errorCount++
          logger.error('Failed to get senders from connection:', error)
        }
      }
    })

    this.isMuted = true
    this.eventBus.emitSync('sip:audio:muted', {
      type: 'sip:audio:muted',
      timestamp: new Date(),
    } satisfies AudioMutedEvent)
    logger.info(`Muted ${mutedCount} audio tracks (${errorCount} errors)`)
  }

  /**
   * Unmute audio on all active calls
   */
  async unmuteAudio(): Promise<void> {
    if (!this.isMuted) {
      logger.debug('Audio is not muted')
      return
    }

    logger.info('Unmuting audio on all active calls')
    let unmutedCount = 0
    let errorCount = 0

    // Unmute all active call sessions
    this.activeCalls.forEach((session) => {
      if (session && session.connection) {
        try {
          const senders = session.connection.getSenders()
          senders.forEach((sender: RTCRtpSender) => {
            try {
              if (sender.track && sender.track.kind === 'audio') {
                sender.track.enabled = true
                unmutedCount++
              }
            } catch (error) {
              errorCount++
              logger.error('Failed to unmute audio track:', error)
            }
          })
        } catch (error) {
          errorCount++
          logger.error('Failed to get senders from connection:', error)
        }
      }
    })

    this.isMuted = false
    this.eventBus.emitSync('sip:audio:unmuted', {
      type: 'sip:audio:unmuted',
      timestamp: new Date(),
    } satisfies AudioUnmutedEvent)
    logger.info(`Unmuted ${unmutedCount} audio tracks (${errorCount} errors)`)
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    logger.info('Destroying SIP client')

    try {
      // Stop UA
      if (this.ua) {
        try {
          this.ua.stop()
        } catch (error) {
          logger.error('Error stopping UA:', error)
        }
        this.ua = null
      }

      // Clear all handler arrays
      this.messageHandlers = []
      this.composingHandlers = []

      // Clear all Maps
      this.activeCalls.clear()
      this.conferences.clear()
      this.presenceSubscriptions.clear()

      // Reset mute state
      this.isMuted = false

      logger.info('SIP client destroyed and all resources cleared')
    } catch (error) {
      logger.error('Error during SIP client destruction:', error)
      // Still try to clear resources
      this.messageHandlers = []
      this.composingHandlers = []
      this.ua = null
    }
  }

  // ============================================================================
  // Messaging & Presence Methods (Phase 11+)
  // ============================================================================

  /**
   * Set incoming message handler
   * @param handler - Message handler function
   */
  onIncomingMessage(handler: (from: string, content: string, contentType?: string) => void): void {
    logger.debug('Registering incoming message handler')
    this.messageHandlers.push(handler)
  }

  /**
   * Remove incoming message handler
   * @param handler - Message handler function to remove
   */
  offIncomingMessage(handler: (from: string, content: string, contentType?: string) => void): void {
    const index = this.messageHandlers.indexOf(handler)
    if (index > -1) {
      this.messageHandlers.splice(index, 1)
      logger.debug('Unregistered incoming message handler')
    }
  }

  /**
   * Set composing indicator handler
   * @param handler - Composing indicator handler function
   */
  onComposingIndicator(handler: (from: string, isComposing: boolean) => void): void {
    logger.debug('Registering composing indicator handler')
    this.composingHandlers.push(handler)
  }

  /**
   * Remove composing indicator handler
   * @param handler - Composing indicator handler function to remove
   */
  offComposingIndicator(handler: (from: string, isComposing: boolean) => void): void {
    const index = this.composingHandlers.indexOf(handler)
    if (index > -1) {
      this.composingHandlers.splice(index, 1)
      logger.debug('Unregistered composing indicator handler')
    }
  }

  /**
   * Publish presence information
   * @param presence - Presence data
   */
  async publishPresence(presence: PresencePublishOptions): Promise<void> {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    if (!this.isConnected) {
      throw new Error('Not connected to SIP server')
    }

    logger.info('Publishing presence', { state: presence.state })

    // Build PIDF presence document
    const pidfBody = this.buildPresenceDocument(presence)

    // Clone extraHeaders to avoid mutating input
    const extraHeaders = [...(presence.extraHeaders || [])]
    extraHeaders.push('Event: presence')
    extraHeaders.push('Content-Type: application/pidf+xml')

    if (presence.expires) {
      extraHeaders.push(`Expires: ${presence.expires}`)
    }

    // Send PUBLISH request using JsSIP sendRequest
    // Note: JsSIP doesn't have built-in PUBLISH support, so we log it for now
    // A full implementation would require extending JsSIP or using raw SIP messages
    logger.warn('PUBLISH method not fully supported by JsSIP - emitting event for external handling')

    this.eventBus.emitSync('sip:presence:publish', {
      type: 'sip:presence:publish',
      timestamp: new Date(),
      presence,
      body: pidfBody,
      extraHeaders,
    } satisfies PresencePublishEvent)
  }

  /**
   * Subscribe to presence updates
   * @param uri - URI to subscribe to
   * @param options - Subscription options
   */
  async subscribePresence(uri: string, options?: PresenceSubscriptionOptions): Promise<void> {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    if (!this.isConnected) {
      throw new Error('Not connected to SIP server')
    }

    logger.info('Subscribing to presence', { uri })

    // Check if already subscribed
    if (this.presenceSubscriptions.has(uri)) {
      logger.warn('Already subscribed to presence for URI:', uri)
      return
    }

    // Store subscription
    const subscription = {
      uri,
      options,
      active: true,
    }
    this.presenceSubscriptions.set(uri, subscription)

    // Emit event for external handling
    // Note: JsSIP doesn't have built-in SUBSCRIBE support for presence
    logger.warn('SUBSCRIBE method not fully supported by JsSIP - emitting event for external handling')

    this.eventBus.emitSync('sip:presence:subscribe', {
      type: 'sip:presence:subscribe',
      timestamp: new Date(),
      uri,
      options,
    } satisfies PresenceSubscribeEvent)
  }

  /**
   * Unsubscribe from presence updates
   * @param uri - URI to unsubscribe from
   */
  async unsubscribePresence(uri: string): Promise<void> {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    logger.info('Unsubscribing from presence', { uri })

    // Check if subscribed
    if (!this.presenceSubscriptions.has(uri)) {
      logger.warn('Not subscribed to presence for URI:', uri)
      return
    }

    // Remove subscription
    this.presenceSubscriptions.delete(uri)

    // Emit event for external handling
    this.eventBus.emitSync('sip:presence:unsubscribe', {
      type: 'sip:presence:unsubscribe',
      timestamp: new Date(),
      uri,
    } satisfies PresenceUnsubscribeEvent)
  }

  /**
   * Build PIDF presence document
   */
  private buildPresenceDocument(presence: PresencePublishOptions): string {
    const status = presence.state === 'available' ? 'open' : 'closed'
    const note = presence.statusMessage || ''

    return `<?xml version="1.0" encoding="UTF-8"?>
<presence xmlns="urn:ietf:params:xml:ns:pidf" entity="${this.config.sipUri}">
  <tuple id="sipphone">
    <status>
      <basic>${status}</basic>
    </status>
    ${note ? `<note>${note}</note>` : ''}
  </tuple>
</presence>`
  }

  // ============================================================================
  // Call Management Methods (Phase 11+)
  // ============================================================================

  /**
   * Get an active call session by ID
   * @param callId - Call ID to retrieve
   * @returns Call session or undefined if not found
   */
  getActiveCall(callId: string): CallSession | undefined {
    const session = this.activeCalls.get(callId)
    if (!session) {
      return undefined
    }

    // Convert JsSIP session to CallSession interface
    return this.sessionToCallSession(session)
  }

  /**
   * Make an outgoing call
   * @param target - Target SIP URI
   * @param options - Call options
   * @returns Promise resolving to call ID
   */
  async makeCall(target: string, options?: CallOptions): Promise<string> {
    if (!this.ua) {
      throw new Error('SIP client is not started')
    }

    if (!this.isConnected) {
      throw new Error('Not connected to SIP server')
    }

    logger.info('Making call to', target)

    // Build call options
    const callOptions: any = {
      mediaConstraints: options?.mediaConstraints || {
        audio: options?.audio !== false,
        video: options?.video === true,
      },
      rtcConfiguration: options?.rtcConfiguration,
      extraHeaders: options?.extraHeaders || [],
      anonymous: options?.anonymous,
      sessionTimersExpires: options?.sessionTimersExpires || 90,
    }

    // Disable session timers if specified
    if (options?.sessionTimers === false) {
      callOptions.sessionTimersEnabled = false
    }

    // PCMA codec only
    if (options?.pcmaCodecOnly) {
      callOptions.pcmaCodecOnly = true
    }

    try {
      // Initiate call using JsSIP
      const session = this.ua.call(target, callOptions)
      const callId = session.id || this.generateCallId()

      // Store active call
      this.activeCalls.set(callId, session)

      // Setup session event handlers
      this.setupSessionHandlers(session, callId)

      logger.info('Call initiated', { callId, target })

      return callId
    } catch (error) {
      logger.error('Failed to make call:', error)
      throw error
    }
  }

  /**
   * Generate a unique call ID
   */
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  /**
   * Setup event handlers for a call session
   */
  private setupSessionHandlers(session: any, callId: string): void {
    // Session progress
    session.on('progress', (e: any) => {
      logger.debug('Call progress', { callId })
      this.eventBus.emitSync('sip:call:progress', {
        timestamp: new Date(),
        callId,
        session,
        response: e.response,
      } as any)
    })

    // Session accepted
    session.on('accepted', (e: any) => {
      logger.info('Call accepted', { callId })
      this.eventBus.emitSync('sip:call:accepted', {
        timestamp: new Date(),
        callId,
        session,
        response: e.response,
      } as any)
    })

    // Session confirmed
    session.on('confirmed', () => {
      logger.info('Call confirmed', { callId })
      this.eventBus.emitSync('sip:call:confirmed', {
        timestamp: new Date(),
        callId,
        session,
      } as any)
    })

    // Session ended
    session.on('ended', (e: any) => {
      logger.info('Call ended', { callId, cause: e.cause })
      this.activeCalls.delete(callId)
      this.eventBus.emitSync('sip:call:ended', {
        timestamp: new Date(),
        callId,
        session,
        cause: e.cause,
        originator: e.originator,
      } as any)
    })

    // Session failed
    session.on('failed', (e: any) => {
      logger.error('Call failed', { callId, cause: e.cause })
      this.activeCalls.delete(callId)
      this.eventBus.emitSync('sip:call:failed', {
        timestamp: new Date(),
        callId,
        session,
        cause: e.cause,
        message: e.message,
      } as any)
    })

    // Hold events
    session.on('hold', () => {
      logger.debug('Call on hold', { callId })
      this.eventBus.emitSync('sip:call:hold', {
        timestamp: new Date(),
        callId,
        session,
      } as any)
    })

    session.on('unhold', () => {
      logger.debug('Call resumed', { callId })
      this.eventBus.emitSync('sip:call:unhold', {
        timestamp: new Date(),
        callId,
        session,
      } as any)
    })
  }

  /**
   * Convert JsSIP session to CallSession interface
   */
  private sessionToCallSession(session: any): CallSession {
    const startTime = session.start_time ? new Date(session.start_time) : undefined
    const endTime = session.end_time ? new Date(session.end_time) : undefined

    return {
      id: session.id || this.generateCallId(),
      state: this.mapSessionState(session),
      direction: session.direction === 'incoming' ? CallDirection.Incoming : CallDirection.Outgoing,
      localUri: session.local_identity?.uri?.toString() || this.config.sipUri,
      remoteUri: session.remote_identity?.uri?.toString() || '',
      remoteDisplayName: session.remote_identity?.display_name,
      localStream: session.connection?.getLocalStreams()?.[0],
      remoteStream: session.connection?.getRemoteStreams()?.[0],
      isOnHold: session.isOnHold?.() || false,
      isMuted: this.isMuted,
      hasRemoteVideo: this.hasRemoteVideo(session),
      hasLocalVideo: this.hasLocalVideo(session),
      timing: {
        startTime,
        endTime,
        duration: startTime && endTime ? (endTime.getTime() - startTime.getTime()) / 1000 : undefined,
      },
      data: {},
    } as CallSession
  }

  /**
   * Map JsSIP session state to CallState
   */
  private mapSessionState(session: any): CallState {
    switch (session.status) {
      case 0:
        return CallState.Idle // NULL
      case 1:
        return CallState.Calling // INVITE_SENT
      case 2:
        return CallState.Ringing // INVITE_RECEIVED
      case 3:
        return CallState.Answering // ANSWERED
      case 4:
        return CallState.EarlyMedia // EARLY_MEDIA
      case 5:
        return CallState.Active // CONFIRMED
      case 6:
        return CallState.Terminating // WAITING_FOR_ACK
      case 7:
        return CallState.Terminated // CANCELED
      case 8:
        return CallState.Terminated // TERMINATED
      default:
        return CallState.Idle
    }
  }

  /**
   * Check if session has remote video
   */
  private hasRemoteVideo(session: any): boolean {
    const remoteStream = session.connection?.getRemoteStreams()?.[0]
    return remoteStream?.getVideoTracks()?.length > 0 || false
  }

  /**
   * Check if session has local video
   */
  private hasLocalVideo(session: any): boolean {
    const localStream = session.connection?.getLocalStreams()?.[0]
    return localStream?.getVideoTracks()?.length > 0 || false
  }
}

/**
 * Create a new SipClient instance
 */
export function createSipClient(config: SipClientConfig, eventBus: EventBus): SipClient {
  return new SipClient(config, eventBus)
}
