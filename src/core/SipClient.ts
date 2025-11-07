/**
 * SipClient - Core SIP client implementation using JsSIP
 * Handles UA initialization, registration, and SIP method routing
 * @packageDocumentation
 */

import JsSIP, { type UA, type Socket } from 'jssip'
import type { UAConfiguration } from 'jssip/lib/UA'
import type { EventBus } from './EventBus'
import type { SipClientConfig, ValidationResult } from '@/types/config.types'
import type { ConferenceOptions } from '@/types/conference.types'
import type { PresencePublishOptions, PresenceSubscriptionOptions } from '@/types/presence.types'
import type { CallSession, CallOptions } from '@/types/call.types'
// Note: JsSIP types are defined in jssip.types.ts for documentation purposes,
// but we use 'any' for JsSIP event handlers since the library doesn't export proper types
import {
  RegistrationState,
  ConnectionState,
  type AuthenticationCredentials,
} from '@/types/sip.types'
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
        timestamp: new Date(),
        transport: e.socket?.url,
      } as any)
    })

    this.ua.on('disconnected', (e: any) => {
      logger.debug('UA disconnected:', e)
      this.updateConnectionState(ConnectionState.Disconnected)
      this.eventBus.emitSync('sip:disconnected', {
        timestamp: new Date(),
        error: e.error,
      } as any)
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
        timestamp: new Date(),
        uri: this.config.sipUri,
        expires: e.response?.getHeader('Expires'),
      } as any)
    })

    this.ua.on('unregistered', (e: any) => {
      logger.info('UA unregistered')
      this.updateRegistrationState(RegistrationState.Unregistered)
      this.state.registeredUri = undefined
      this.eventBus.emitSync('sip:unregistered', {
        timestamp: new Date(),
        cause: e.cause,
      } as any)
    })

    this.ua.on('registrationFailed', (e: any) => {
      logger.error('UA registration failed:', e)
      this.updateRegistrationState(RegistrationState.RegistrationFailed)
      this.eventBus.emitSync('sip:registration_failed', {
        timestamp: new Date(),
        cause: e.cause,
        response: e.response,
      } as any)
    })

    this.ua.on('registrationExpiring', () => {
      logger.debug('Registration expiring, refreshing')
      this.eventBus.emitSync('sip:registration_expiring', {
        timestamp: new Date(),
      } as any)
    })

    // Call events (will be handled by CallSession)
    this.ua.on('newRTCSession', (e: any) => {
      logger.debug('New RTC session:', e)
      this.eventBus.emitSync('sip:new_session', {
        timestamp: new Date(),
        session: e.session,
        originator: e.originator,
        request: e.request,
      } as any)
    })

    // Message events
    this.ua.on('newMessage', (e: any) => {
      logger.debug('New message:', e)
      this.eventBus.emitSync('sip:new_message', {
        timestamp: new Date(),
        message: e.message,
        originator: e.originator,
        request: e.request,
      } as any)
    })

    // SIP events
    this.ua.on('sipEvent', (e: any) => {
      logger.debug('SIP event:', e)
      this.eventBus.emitSync('sip:event', {
        timestamp: new Date(),
        event: e.event,
        request: e.request,
      } as any)
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
   * Create a conference (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async createConference(_conferenceId: string, _options?: ConferenceOptions): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Join a conference (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async joinConference(_conferenceUri: string, _options?: ConferenceOptions): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Invite participant to conference (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async inviteToConference(_conferenceId: string, _participantUri: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Remove participant from conference (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async removeFromConference(_conferenceId: string, _participantId: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Mute conference participant (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async muteParticipant(_conferenceId: string, _participantId: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Unmute conference participant (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async unmuteParticipant(_conferenceId: string, _participantId: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * End a conference (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async endConference(_conferenceId: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Start conference recording (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async startConferenceRecording(_conferenceId: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Stop conference recording (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  async stopConferenceRecording(_conferenceId: string): Promise<void> {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Get conference audio levels (Phase 11+ feature - stub implementation)
   * @todo Implement conference functionality in Phase 11
   */
  getConferenceAudioLevels?(_conferenceId: string): Map<string, number> | undefined {
    throw new Error('Conference functionality not yet implemented (Phase 11+)')
  }

  /**
   * Mute audio (Phase 11+ feature - stub implementation)
   * @todo Implement audio control functionality
   */
  async muteAudio(): Promise<void> {
    throw new Error('Audio control functionality not yet implemented (Phase 11+)')
  }

  /**
   * Unmute audio (Phase 11+ feature - stub implementation)
   * @todo Implement audio control functionality
   */
  async unmuteAudio(): Promise<void> {
    throw new Error('Audio control functionality not yet implemented (Phase 11+)')
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    logger.info('Destroying SIP client')
    if (this.ua) {
      this.ua.stop()
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
  onIncomingMessage(_handler: (from: string, content: string, contentType?: string) => void): void {
    throw new Error('Messaging functionality not yet implemented (Phase 11+)')
  }

  /**
   * Set composing indicator handler
   * @param handler - Composing indicator handler function
   */
  onComposingIndicator(_handler: (from: string, isComposing: boolean) => void): void {
    throw new Error('Messaging functionality not yet implemented (Phase 11+)')
  }

  /**
   * Publish presence information
   * @param presence - Presence data
   */
  async publishPresence(_presence: PresencePublishOptions): Promise<void> {
    throw new Error('Presence functionality not yet implemented (Phase 11+)')
  }

  /**
   * Subscribe to presence updates
   * @param uri - URI to subscribe to
   * @param options - Subscription options
   */
  async subscribePresence(_uri: string, _options?: PresenceSubscriptionOptions): Promise<void> {
    throw new Error('Presence functionality not yet implemented (Phase 11+)')
  }

  /**
   * Unsubscribe from presence updates
   * @param uri - URI to unsubscribe from
   */
  async unsubscribePresence(_uri: string): Promise<void> {
    throw new Error('Presence functionality not yet implemented (Phase 11+)')
  }

  // ============================================================================
  // Call Management Methods (Phase 11+)
  // ============================================================================

  /**
   * Get an active call session by ID
   * @param callId - Call ID to retrieve
   * @returns Call session or undefined if not found
   */
  getActiveCall(_callId: string): CallSession | undefined {
    throw new Error('Call management functionality not yet implemented (Phase 11+)')
  }

  /**
   * Make an outgoing call
   * @param target - Target SIP URI
   * @param options - Call options
   * @returns Promise resolving to call ID
   */
  async makeCall(_target: string, _options?: CallOptions): Promise<string> {
    throw new Error('Call management functionality not yet implemented (Phase 11+)')
  }
}

/**
 * Create a new SipClient instance
 */
export function createSipClient(config: SipClientConfig, eventBus: EventBus): SipClient {
  return new SipClient(config, eventBus)
}
