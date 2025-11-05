/**
 * Event system type definitions
 * @packageDocumentation
 */

import type { CallEvent } from './call.types'
import type { RegistrationEvent, ConnectionEvent } from './sip.types'
import type { MediaStreamEvent, MediaTrackEvent, MediaDeviceChangeEvent } from './media.types'

/**
 * Base event interface
 */
export interface BaseEvent<T = any> {
  /** Event type */
  type: string
  /** Event payload */
  payload?: T
  /** Timestamp when the event occurred */
  timestamp: Date
  /** Event metadata */
  metadata?: Record<string, any>
}

/**
 * Event payload generic type
 */
export type EventPayload<T extends BaseEvent> = T extends BaseEvent<infer P> ? P : never

/**
 * Event handler type
 */
export type EventHandler<T = any> = (event: T) => void | Promise<void>

/**
 * Event handler with error boundary
 */
export type SafeEventHandler<T = any> = (event: T) => void

/**
 * Event listener options
 */
export interface EventListenerOptions {
  /** Execute only once */
  once?: boolean
  /** Priority (higher priority handlers execute first) */
  priority?: number
  /** Handler ID (for removal) */
  id?: string
}

/**
 * Event names constants
 */
export const EventNames = {
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTION_FAILED: 'connection_failed',
  RECONNECTING: 'reconnecting',

  // Registration events
  REGISTERED: 'registered',
  UNREGISTERED: 'unregistered',
  REGISTERING: 'registering',
  REGISTRATION_FAILED: 'registration_failed',

  // Call events
  CALL_INCOMING: 'call:incoming',
  CALL_OUTGOING: 'call:outgoing',
  CALL_PROGRESS: 'call:progress',
  CALL_RINGING: 'call:ringing',
  CALL_ACCEPTED: 'call:accepted',
  CALL_CONFIRMED: 'call:confirmed',
  CALL_FAILED: 'call:failed',
  CALL_ENDED: 'call:ended',
  CALL_HOLD: 'call:hold',
  CALL_UNHOLD: 'call:unhold',
  CALL_MUTED: 'call:muted',
  CALL_UNMUTED: 'call:unmuted',

  // Media events
  MEDIA_STREAM_ADDED: 'media:stream:added',
  MEDIA_STREAM_REMOVED: 'media:stream:removed',
  MEDIA_TRACK_ADDED: 'media:track:added',
  MEDIA_TRACK_REMOVED: 'media:track:removed',
  MEDIA_TRACK_MUTED: 'media:track:muted',
  MEDIA_TRACK_UNMUTED: 'media:track:unmuted',
  MEDIA_DEVICE_CHANGED: 'media:device:changed',

  // Transfer events
  TRANSFER_INITIATED: 'transfer:initiated',
  TRANSFER_ACCEPTED: 'transfer:accepted',
  TRANSFER_FAILED: 'transfer:failed',
  TRANSFER_COMPLETED: 'transfer:completed',

  // Presence events
  PRESENCE_UPDATED: 'presence:updated',
  PRESENCE_SUBSCRIBED: 'presence:subscribed',
  PRESENCE_UNSUBSCRIBED: 'presence:unsubscribed',

  // Messaging events
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_FAILED: 'message:failed',

  // Conference events
  CONFERENCE_CREATED: 'conference:created',
  CONFERENCE_JOINED: 'conference:joined',
  CONFERENCE_LEFT: 'conference:left',
  CONFERENCE_PARTICIPANT_JOINED: 'conference:participant:joined',
  CONFERENCE_PARTICIPANT_LEFT: 'conference:participant:left',
  CONFERENCE_ENDED: 'conference:ended',

  // DTMF events
  DTMF_SENT: 'dtmf:sent',
  DTMF_RECEIVED: 'dtmf:received',

  // Error events
  ERROR: 'error',
} as const

/**
 * Event name type
 */
export type EventName = (typeof EventNames)[keyof typeof EventNames]

/**
 * Wildcard event pattern
 */
export type WildcardPattern = `${string}:*` | '*'

/**
 * Event map for type-safe event handling
 */
export interface EventMap {
  // Connection events
  [EventNames.CONNECTED]: ConnectionEvent
  [EventNames.DISCONNECTED]: ConnectionEvent
  [EventNames.CONNECTING]: ConnectionEvent
  [EventNames.CONNECTION_FAILED]: ConnectionEvent
  [EventNames.RECONNECTING]: ConnectionEvent

  // Registration events
  [EventNames.REGISTERED]: RegistrationEvent
  [EventNames.UNREGISTERED]: RegistrationEvent
  [EventNames.REGISTERING]: RegistrationEvent
  [EventNames.REGISTRATION_FAILED]: RegistrationEvent

  // Call events
  [EventNames.CALL_INCOMING]: CallEvent
  [EventNames.CALL_OUTGOING]: CallEvent
  [EventNames.CALL_PROGRESS]: CallEvent
  [EventNames.CALL_RINGING]: CallEvent
  [EventNames.CALL_ACCEPTED]: CallEvent
  [EventNames.CALL_CONFIRMED]: CallEvent
  [EventNames.CALL_FAILED]: CallEvent
  [EventNames.CALL_ENDED]: CallEvent
  [EventNames.CALL_HOLD]: CallEvent
  [EventNames.CALL_UNHOLD]: CallEvent
  [EventNames.CALL_MUTED]: CallEvent
  [EventNames.CALL_UNMUTED]: CallEvent

  // Media events
  [EventNames.MEDIA_STREAM_ADDED]: MediaStreamEvent
  [EventNames.MEDIA_STREAM_REMOVED]: MediaStreamEvent
  [EventNames.MEDIA_TRACK_ADDED]: MediaTrackEvent
  [EventNames.MEDIA_TRACK_REMOVED]: MediaTrackEvent
  [EventNames.MEDIA_TRACK_MUTED]: MediaTrackEvent
  [EventNames.MEDIA_TRACK_UNMUTED]: MediaTrackEvent
  [EventNames.MEDIA_DEVICE_CHANGED]: MediaDeviceChangeEvent

  // Generic event fallback
  [key: string]: BaseEvent
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseEvent {
  type: typeof EventNames.ERROR
  /** Error object */
  error: Error
  /** Error context */
  context?: string
  /** Error severity */
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  /**
   * Add an event listener
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
    options?: EventListenerOptions
  ): void

  /**
   * Add a one-time event listener
   */
  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void

  /**
   * Remove an event listener
   */
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void

  /**
   * Emit an event
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: keyof EventMap): void

  /**
   * Wait for an event to be emitted
   */
  waitFor<K extends keyof EventMap>(event: K, timeout?: number): Promise<EventMap[K]>
}
