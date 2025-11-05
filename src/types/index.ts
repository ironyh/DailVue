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