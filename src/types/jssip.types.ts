/**
 * JsSIP library type definitions
 *
 * Type definitions for JsSIP events and objects since the library
 * doesn't export proper TypeScript types.
 *
 * @packageDocumentation
 */

/**
 * JsSIP WebSocket connection event
 */
export interface JsSIPConnectedEvent {
  socket?: {
    url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * JsSIP disconnection event
 */
export interface JsSIPDisconnectedEvent {
  error?: boolean
  code?: number
  reason?: string
  [key: string]: unknown
}

/**
 * JsSIP registration success event
 */
export interface JsSIPRegisteredEvent {
  response?: {
    status_code?: number
    reason_phrase?: string
    getHeader?: (name: string) => string | undefined
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * JsSIP unregistration event
 */
export interface JsSIPUnregisteredEvent {
  cause?: string
  response?: {
    status_code?: number
    reason_phrase?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * JsSIP registration failure event
 */
export interface JsSIPRegistrationFailedEvent {
  response?: {
    status_code?: number
    reason_phrase?: string
    [key: string]: unknown
  }
  cause?: string
  [key: string]: unknown
}

/**
 * JsSIP new RTC session event
 */
export interface JsSIPNewRTCSessionEvent {
  originator?: 'local' | 'remote'
  session?: unknown // RTCSession from JsSIP
  request?: {
    from?: {
      uri?: {
        user?: string
        host?: string
        [key: string]: unknown
      }
      display_name?: string
      [key: string]: unknown
    }
    to?: {
      uri?: {
        user?: string
        host?: string
        [key: string]: unknown
      }
      display_name?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Generic JsSIP event
 */
export interface JsSIPEvent {
  [key: string]: unknown
}

/**
 * Union type for all JsSIP events
 */
export type AnyJsSIPEvent =
  | JsSIPConnectedEvent
  | JsSIPDisconnectedEvent
  | JsSIPRegisteredEvent
  | JsSIPUnregisteredEvent
  | JsSIPRegistrationFailedEvent
  | JsSIPNewRTCSessionEvent
  | JsSIPEvent
