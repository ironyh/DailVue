/**
 * SipClient - Core SIP client implementation using JsSIP
 * Handles UA initialization, registration, and SIP method routing
 * @packageDocumentation
 */

import JsSIP, { type UA, type UAConfiguration, type Socket } from 'jssip'
import type { EventBus } from './EventBus'
import type {
  SipClientConfig,
  ValidationResult,
} from '@/types/config.types'
import type {
  RegistrationState,
  ConnectionState,
  AuthenticationCredentials,
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
  private registrator: any = null
  private isStarting = false
  private isStopping = false

  constructor(config: SipClientConfig, eventBus: EventBus) {
    this.config = config
    this.eventBus = eventBus
    this.state = {
      connectionState: 'disconnected',
      registrationState: 'unregistered',
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
      this.updateConnectionState('connecting')
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
      this.updateConnectionState('connection_failed')
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
      this.registrator = null

      this.updateConnectionState('disconnected')
      this.updateRegistrationState('unregistered')

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
    this.updateRegistrationState('registering')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Registration timeout'))
      }, 30000) // 30 second timeout

      const onSuccess = () => {
        clearTimeout(timeout)
        logger.info('Registration successful')
        this.updateRegistrationState('registered')
        this.state.registeredUri = this.config.sipUri
        this.state.lastRegistrationTime = new Date()
        this.state.registrationExpiry = this.config.registrationOptions?.expires ?? 600
        resolve()
      }

      const onFailure = (cause: any) => {
        clearTimeout(timeout)
        logger.error('Registration failed:', cause)
        this.updateRegistrationState('registration_failed')
        reject(new Error(`Registration failed: ${cause}`))
      }

      // Register using JsSIP
      this.ua.register()

      // Listen for registration events
      this.ua.once('registered', onSuccess)
      this.ua.once('registrationFailed', onFailure)
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
    this.updateRegistrationState('unregistering')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Unregistration timeout'))
      }, 10000) // 10 second timeout

      const onSuccess = () => {
        clearTimeout(timeout)
        logger.info('Unregistration successful')
        this.updateRegistrationState('unregistered')
        this.state.registeredUri = undefined
        this.state.lastRegistrationTime = undefined
        this.state.registrationExpiry = undefined
        resolve()
      }

      const onFailure = (cause: any) => {
        clearTimeout(timeout)
        logger.error('Unregistration failed:', cause)
        reject(new Error(`Unregistration failed: ${cause}`))
      }

      // Unregister using JsSIP
      this.ua.unregister()

      // Listen for unregistration events
      this.ua.once('unregistered', onSuccess)
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
    const sockets: Socket[] = [
      new JsSIP.WebSocketInterface(config.uri) as Socket,
    ]

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
      this.updateConnectionState('connected')
      this.eventBus.emitSync('sip:connected', {
        timestamp: new Date(),
        transport: e.socket?.url,
      })
    })

    this.ua.on('disconnected', (e: any) => {
      logger.debug('UA disconnected:', e)
      this.updateConnectionState('disconnected')
      this.eventBus.emitSync('sip:disconnected', {
        timestamp: new Date(),
        error: e.error,
      })
    })

    this.ua.on('connecting', (e: any) => {
      logger.debug('UA connecting')
      this.updateConnectionState('connecting')
    })

    // Registration events
    this.ua.on('registered', (e: any) => {
      logger.info('UA registered')
      this.updateRegistrationState('registered')
      this.state.registeredUri = this.config.sipUri
      this.state.lastRegistrationTime = new Date()
      this.eventBus.emitSync('sip:registered', {
        timestamp: new Date(),
        uri: this.config.sipUri,
        expires: e.response?.getHeader('Expires'),
      })
    })

    this.ua.on('unregistered', (e: any) => {
      logger.info('UA unregistered')
      this.updateRegistrationState('unregistered')
      this.state.registeredUri = undefined
      this.eventBus.emitSync('sip:unregistered', {
        timestamp: new Date(),
        cause: e.cause,
      })
    })

    this.ua.on('registrationFailed', (e: any) => {
      logger.error('UA registration failed:', e)
      this.updateRegistrationState('registration_failed')
      this.eventBus.emitSync('sip:registration_failed', {
        timestamp: new Date(),
        cause: e.cause,
        response: e.response,
      })
    })

    this.ua.on('registrationExpiring', () => {
      logger.debug('Registration expiring, refreshing')
      this.eventBus.emitSync('sip:registration_expiring', {
        timestamp: new Date(),
      })
    })

    // Call events (will be handled by CallSession)
    this.ua.on('newRTCSession', (e: any) => {
      logger.debug('New RTC session:', e)
      this.eventBus.emitSync('sip:new_session', {
        timestamp: new Date(),
        session: e.session,
        originator: e.originator,
        request: e.request,
      })
    })

    // Message events
    this.ua.on('newMessage', (e: any) => {
      logger.debug('New message:', e)
      this.eventBus.emitSync('sip:new_message', {
        timestamp: new Date(),
        message: e.message,
        originator: e.originator,
        request: e.request,
      })
    })

    // SIP events
    this.ua.on('sipEvent', (e: any) => {
      logger.debug('SIP event:', e)
      this.eventBus.emitSync('sip:event', {
        timestamp: new Date(),
        event: e.event,
        request: e.request,
      })
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
    return match ? match[1] : ''
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
    this.registrator = null
  }
}

/**
 * Create a new SipClient instance
 */
export function createSipClient(config: SipClientConfig, eventBus: EventBus): SipClient {
  return new SipClient(config, eventBus)
}
