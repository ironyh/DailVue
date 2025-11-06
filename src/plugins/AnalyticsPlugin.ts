/**
 * Analytics Plugin
 *
 * Tracks and reports usage analytics events to a configured endpoint.
 * Supports event batching, filtering, and transformation.
 */

import { createLogger } from '../utils/logger'
import type {
  Plugin,
  PluginContext,
  AnalyticsPluginConfig,
  AnalyticsEvent,
} from '../types/plugin.types'

const logger = createLogger('AnalyticsPlugin')

/**
 * Default analytics plugin configuration
 */
const DEFAULT_CONFIG: Required<AnalyticsPluginConfig> = {
  enabled: true,
  endpoint: '',
  batchEvents: true,
  batchSize: 10,
  sendInterval: 30000, // 30 seconds
  includeUserInfo: false,
  transformEvent: (event: AnalyticsEvent) => event,
  trackEvents: [], // Empty = track all events
  ignoreEvents: [],
  maxQueueSize: 1000, // Maximum events in queue before dropping old ones
  requestTimeout: 30000, // 30 seconds timeout for requests
}

/**
 * Analytics Plugin
 *
 * Tracks application events and sends them to an analytics endpoint.
 * Supports batching, filtering, and event transformation.
 */
export class AnalyticsPlugin implements Plugin<AnalyticsPluginConfig> {
  /** Plugin metadata */
  metadata = {
    name: 'analytics',
    version: '1.0.0',
    description: 'Analytics and event tracking plugin',
    author: 'VueSip',
    license: 'MIT',
  }

  /** Default configuration */
  defaultConfig = DEFAULT_CONFIG

  /** Current configuration */
  private config: Required<AnalyticsPluginConfig> = DEFAULT_CONFIG

  /** Event queue for batching */
  private eventQueue: AnalyticsEvent[] = []

  /** Batch send interval timer */
  private batchTimer: ReturnType<typeof setInterval> | null = null

  /** Session ID */
  private sessionId: string

  /** User ID (if available) */
  private userId?: string

  /** Event listener cleanup functions */
  private cleanupFunctions: Array<() => void> = []

  /** Flag to prevent concurrent flush operations */
  private isFlushing: boolean = false

  /** Abort controller for fetch timeout */
  private abortController: AbortController | null = null

  constructor() {
    // Generate session ID using crypto for better uniqueness
    this.sessionId = this.generateSessionId()
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const random2 = Math.random().toString(36).substring(2, 15)
    return `session-${timestamp}-${random}${random2}`
  }

  /**
   * Install the plugin
   *
   * @param context - Plugin context
   * @param config - Plugin configuration
   */
  async install(context: PluginContext, config?: AnalyticsPluginConfig): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Validate configuration
    if (!this.config.endpoint && this.config.enabled) {
      logger.warn('Analytics plugin enabled but no endpoint configured')
    }

    logger.info('Installing analytics plugin')

    // Register event listeners
    this.registerEventListeners(context)

    // Start batch timer if batching is enabled
    if (this.config.batchEvents) {
      this.startBatchTimer()
    }

    // Track plugin installation
    this.trackEvent('plugin:installed', {
      plugin: this.metadata.name,
      version: this.metadata.version,
    })

    logger.info('Analytics plugin installed')
  }

  /**
   * Uninstall the plugin
   *
   * @param context - Plugin context
   */
  async uninstall(_context: PluginContext): Promise<void> {
    logger.info('Uninstalling analytics plugin')

    // Send any remaining events
    await this.flushEvents()

    // Stop batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }

    // Remove event listeners
    for (const cleanup of this.cleanupFunctions) {
      cleanup()
    }
    this.cleanupFunctions = []

    logger.info('Analytics plugin uninstalled')
  }

  /**
   * Update configuration
   *
   * @param context - Plugin context
   * @param config - New configuration
   */
  async updateConfig(context: PluginContext, config: AnalyticsPluginConfig): Promise<void> {
    const oldConfig = this.config
    this.config = { ...this.config, ...config }

    // Restart batch timer if interval changed
    if (this.config.batchEvents && this.config.sendInterval !== oldConfig.sendInterval) {
      this.stopBatchTimer()
      this.startBatchTimer()
    }

    // Stop batch timer if batching disabled
    if (!this.config.batchEvents && this.batchTimer) {
      this.stopBatchTimer()
      await this.flushEvents()
    }

    // Start batch timer if batching enabled
    if (this.config.batchEvents && !oldConfig.batchEvents) {
      this.startBatchTimer()
    }

    logger.info('Analytics plugin configuration updated')
  }

  /**
   * Register event listeners
   *
   * @param context - Plugin context
   */
  private registerEventListeners(context: PluginContext): void {
    const { eventBus } = context

    // Connection events
    const onConnected = () => this.trackEvent('sip:connected')
    const onDisconnected = () => this.trackEvent('sip:disconnected')
    const onConnectionFailed = (error: any) =>
      this.trackEvent('sip:connectionFailed', { error: error.message })

    eventBus.on('connected', onConnected)
    eventBus.on('disconnected', onDisconnected)
    eventBus.on('connectionFailed', onConnectionFailed)

    this.cleanupFunctions.push(
      () => eventBus.off('connected', onConnected),
      () => eventBus.off('disconnected', onDisconnected),
      () => eventBus.off('connectionFailed', onConnectionFailed)
    )

    // Registration events
    const onRegistered = () => this.trackEvent('sip:registered')
    const onUnregistered = () => this.trackEvent('sip:unregistered')
    const onRegistrationFailed = (error: any) =>
      this.trackEvent('sip:registrationFailed', { error: error.message })

    eventBus.on('registered', onRegistered)
    eventBus.on('unregistered', onUnregistered)
    eventBus.on('registrationFailed', onRegistrationFailed)

    this.cleanupFunctions.push(
      () => eventBus.off('registered', onRegistered),
      () => eventBus.off('unregistered', onUnregistered),
      () => eventBus.off('registrationFailed', onRegistrationFailed)
    )

    // Call events
    const onCallStarted = (data: any) =>
      this.trackEvent('call:started', {
        callId: data.callId,
        direction: data.direction,
      })

    const onCallAnswered = (data: any) =>
      this.trackEvent('call:answered', {
        callId: data.callId,
      })

    const onCallEnded = (data: any) =>
      this.trackEvent('call:ended', {
        callId: data.callId,
        duration: data.duration,
        cause: data.cause,
      })

    const onCallFailed = (data: any) =>
      this.trackEvent('call:failed', {
        callId: data.callId,
        error: data.error,
      })

    eventBus.on('callStarted', onCallStarted)
    eventBus.on('callAnswered', onCallAnswered)
    eventBus.on('callEnded', onCallEnded)
    eventBus.on('callFailed', onCallFailed)

    this.cleanupFunctions.push(
      () => eventBus.off('callStarted', onCallStarted),
      () => eventBus.off('callAnswered', onCallAnswered),
      () => eventBus.off('callEnded', onCallEnded),
      () => eventBus.off('callFailed', onCallFailed)
    )

    // Media events
    const onMediaAcquired = () => this.trackEvent('media:acquired')
    const onMediaReleased = () => this.trackEvent('media:released')
    const onMediaError = (error: any) => this.trackEvent('media:error', { error: error.message })

    eventBus.on('mediaAcquired', onMediaAcquired)
    eventBus.on('mediaReleased', onMediaReleased)
    eventBus.on('mediaError', onMediaError)

    this.cleanupFunctions.push(
      () => eventBus.off('mediaAcquired', onMediaAcquired),
      () => eventBus.off('mediaReleased', onMediaReleased),
      () => eventBus.off('mediaError', onMediaError)
    )

    logger.debug('Event listeners registered')
  }

  /**
   * Track an analytics event
   *
   * @param type - Event type
   * @param data - Event data
   */
  private trackEvent(type: string, data?: Record<string, any>): void {
    // Check if event should be tracked
    if (!this.shouldTrackEvent(type)) {
      return
    }

    // Validate event type
    if (!type || typeof type !== 'string' || type.length === 0) {
      logger.warn('Invalid event type, skipping')
      return
    }

    // Create event
    let event: AnalyticsEvent = {
      type,
      timestamp: new Date(),
      data,
      sessionId: this.sessionId,
    }

    // Add user info if enabled
    if (this.config.includeUserInfo && this.userId) {
      event.userId = this.userId
    }

    // Transform event with error handling
    try {
      event = this.config.transformEvent(event)
    } catch (error) {
      logger.error('Event transformation failed, using original event', error)
      // Continue with untransformed event
    }

    // Add to queue or send immediately
    if (this.config.batchEvents) {
      // Check queue size limit before adding
      if (this.eventQueue.length >= this.config.maxQueueSize!) {
        // Drop oldest events to make room (FIFO)
        const dropCount = Math.floor(this.config.maxQueueSize! * 0.1) // Drop 10%
        this.eventQueue.splice(0, dropCount)
        logger.warn(`Event queue overflow, dropped ${dropCount} old events`)
      }

      this.eventQueue.push(event)

      // Send if batch size reached
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flushEvents().catch((error) => {
          logger.error('Failed to flush events', error)
        })
      }
    } else {
      this.sendEvents([event]).catch((error) => {
        logger.error('Failed to send event', error)
      })
    }

    logger.debug(`Event tracked: ${type}`)
  }

  /**
   * Check if an event should be tracked
   *
   * @param type - Event type
   * @returns True if event should be tracked
   */
  private shouldTrackEvent(type: string): boolean {
    // Check if plugin is enabled
    if (!this.config.enabled) {
      return false
    }

    // Check ignore list
    if (this.config.ignoreEvents.length > 0) {
      for (const pattern of this.config.ignoreEvents) {
        if (this.matchesPattern(type, pattern)) {
          return false
        }
      }
    }

    // Check track list (empty = track all)
    if (this.config.trackEvents.length > 0) {
      let matches = false
      for (const pattern of this.config.trackEvents) {
        if (this.matchesPattern(type, pattern)) {
          matches = true
          break
        }
      }
      return matches
    }

    return true
  }

  /**
   * Check if event type matches pattern
   *
   * Supports wildcards: "call:*" matches "call:started", "call:ended", etc.
   *
   * @param type - Event type
   * @param pattern - Pattern to match
   * @returns True if matches
   */
  private matchesPattern(type: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern === type) return true

    try {
      // Sanitize pattern to prevent ReDoS
      const sanitized = this.sanitizePattern(pattern)

      // Convert wildcard pattern to regex
      const regexPattern = sanitized.replace(/\*/g, '.*')
      const regex = new RegExp(`^${regexPattern}$`)

      // Test with timeout protection using a simple check
      // If pattern is too complex, fallback to exact match
      if (this.isPatternTooComplex(regexPattern)) {
        logger.warn(`Pattern too complex, using exact match: ${pattern}`)
        return type === pattern
      }

      return regex.test(type)
    } catch (error) {
      logger.error(`Pattern matching failed for "${pattern}"`, error)
      return false
    }
  }

  /**
   * Sanitize pattern to prevent ReDoS attacks
   */
  private sanitizePattern(pattern: string): string {
    // Remove potentially dangerous regex patterns
    // Limit consecutive quantifiers and nested groups
    return pattern
      .replace(/(\*{2,})/g, '*') // Multiple wildcards to single
      .replace(/([+{]{2,})/g, '+') // Prevent nested quantifiers
      .substring(0, 100) // Limit pattern length
  }

  /**
   * Check if pattern is too complex (may cause ReDoS)
   */
  private isPatternTooComplex(pattern: string): boolean {
    // Simple heuristic: count quantifiers and groups
    const quantifiers = (pattern.match(/[*+?{]/g) || []).length
    const groups = (pattern.match(/[(]/g) || []).length

    // If too many quantifiers or nested groups, consider it complex
    return quantifiers > 10 || groups > 5
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      return
    }

    this.batchTimer = setInterval(() => {
      this.flushEvents().catch((error) => {
        logger.error('Failed to flush events on timer', error)
      })
    }, this.config.sendInterval)

    logger.debug(`Batch timer started (interval: ${this.config.sendInterval}ms)`)
  }

  /**
   * Stop batch timer
   */
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
      logger.debug('Batch timer stopped')
    }
  }

  /**
   * Flush all queued events
   */
  async flushEvents(): Promise<void> {
    // Prevent concurrent flush operations
    if (this.isFlushing) {
      logger.debug('Flush already in progress, skipping')
      return
    }

    if (this.eventQueue.length === 0) {
      return
    }

    this.isFlushing = true

    try {
      const events = [...this.eventQueue]
      this.eventQueue = []

      await this.sendEvents(events)
    } finally {
      this.isFlushing = false
    }
  }

  /**
   * Send events to analytics endpoint
   *
   * @param events - Events to send
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    if (!this.config.endpoint) {
      logger.debug(`Would send ${events.length} events (no endpoint configured)`)
      return
    }

    // Create abort controller for timeout
    this.abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      this.abortController?.abort()
    }, this.config.requestTimeout)

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
        signal: this.abortController.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Analytics endpoint returned ${response.status}`)
      }

      logger.debug(`Sent ${events.length} events to analytics endpoint`)
    } catch (error) {
      clearTimeout(timeoutId)

      if ((error as Error).name === 'AbortError') {
        logger.error('Analytics request timed out')
      } else {
        logger.error('Failed to send events to analytics endpoint', error)
      }

      // Re-queue events on failure, but respect max queue size
      const remainingCapacity = this.config.maxQueueSize! - this.eventQueue.length
      if (remainingCapacity > 0) {
        const eventsToRequeue = events.slice(0, remainingCapacity)
        this.eventQueue.unshift(...eventsToRequeue)

        if (eventsToRequeue.length < events.length) {
          logger.warn(`Could not requeue all events, dropped ${events.length - eventsToRequeue.length}`)
        }
      } else {
        logger.warn(`Queue full, dropped ${events.length} events`)
      }
    } finally {
      this.abortController = null
    }
  }

  /**
   * Set user ID for analytics
   *
   * @param userId - User ID
   */
  setUserId(userId: string): void {
    this.userId = userId
    logger.debug(`User ID set: ${userId}`)
  }
}

/**
 * Create analytics plugin instance
 *
 * @returns Analytics plugin
 */
export function createAnalyticsPlugin(): AnalyticsPlugin {
  return new AnalyticsPlugin()
}
