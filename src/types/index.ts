export interface SipConfig {
  server: string
  username: string
  password: string
  displayName?: string
  realm?: string
  autoRegister?: boolean
  sessionDescriptionHandlerFactoryOptions?: {
    constraints?: MediaStreamConstraints
  }
}

export interface CallSession {
  id: string
  remoteIdentity: string
  direction: 'incoming' | 'outgoing'
  state: CallState
  startTime?: Date
  answerTime?: Date
  endTime?: Date
}

export type CallState = 
  | 'Initial'
  | 'Establishing'
  | 'Established'
  | 'Terminating'
  | 'Terminated'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

export interface SipError {
  code: number
  message: string
  cause?: Error
}
/**
 * Type definitions index
 * Export all type definitions from a single entry point
 * @packageDocumentation
 */

// Config types
export * from './config.types'

// SIP types
export * from './sip.types'

// Call types
export * from './call.types'

// Media types
export * from './media.types'

// Event types
export * from './events.types'

// Transfer types
export * from './transfer.types'

// Presence types
export * from './presence.types'

// Messaging types
export * from './messaging.types'

// Conference types
export * from './conference.types'

// History types
export * from './history.types'
