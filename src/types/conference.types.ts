/**
 * Conference call type definitions
 * @packageDocumentation
 */

/**
 * Conference state enumeration
 */
export enum ConferenceState {
  /** Conference not started */
  Idle = 'idle',
  /** Conference is being created */
  Creating = 'creating',
  /** Conference is active */
  Active = 'active',
  /** Conference is on hold */
  OnHold = 'on_hold',
  /** Conference is ending */
  Ending = 'ending',
  /** Conference has ended */
  Ended = 'ended',
  /** Conference failed */
  Failed = 'failed',
}

/**
 * Participant state
 */
export enum ParticipantState {
  /** Participant is connecting */
  Connecting = 'connecting',
  /** Participant is connected */
  Connected = 'connected',
  /** Participant is on hold */
  OnHold = 'on_hold',
  /** Participant is muted */
  Muted = 'muted',
  /** Participant is disconnected */
  Disconnected = 'disconnected',
}

/**
 * Conference participant
 */
export interface Participant {
  /** Participant ID */
  id: string
  /** Participant URI */
  uri: string
  /** Display name */
  displayName?: string
  /** Participant state */
  state: ParticipantState
  /** Is muted */
  isMuted: boolean
  /** Is on hold */
  isOnHold: boolean
  /** Is moderator */
  isModerator: boolean
  /** Is self (local participant) */
  isSelf: boolean
  /** Audio level (0-1) */
  audioLevel?: number
  /** Media stream */
  stream?: MediaStream
  /** Join time */
  joinedAt: Date
  /** Custom metadata */
  metadata?: Record<string, any>
}

/**
 * Conference state interface
 */
export interface ConferenceStateInterface {
  /** Conference ID */
  id: string
  /** Conference state */
  state: ConferenceState
  /** Conference URI */
  uri?: string
  /** Participants */
  participants: Map<string, Participant>
  /** Local participant */
  localParticipant?: Participant
  /** Maximum participants allowed */
  maxParticipants?: number
  /** Start time */
  startedAt?: Date
  /** End time */
  endedAt?: Date
  /** Is locked */
  isLocked: boolean
  /** Is recording */
  isRecording: boolean
  /** Custom metadata */
  metadata?: Record<string, any>
}

/**
 * Conference options
 */
export interface ConferenceOptions {
  /** Maximum participants */
  maxParticipants?: number
  /** Enable recording */
  enableRecording?: boolean
  /** Enable video */
  enableVideo?: boolean
  /** Lock conference on creation */
  locked?: boolean
  /** Moderator PIN */
  moderatorPin?: string
  /** Custom metadata */
  metadata?: Record<string, any>
}

/**
 * Conference event
 */
export interface ConferenceEvent {
  /** Event type */
  type: string
  /** Conference ID */
  conferenceId: string
  /** Conference state */
  state?: ConferenceState
  /** Participant (if applicable) */
  participant?: Participant
  /** Timestamp */
  timestamp: Date
  /** Additional data */
  data?: any
}

/**
 * Participant joined event
 */
export interface ParticipantJoinedEvent extends ConferenceEvent {
  type: 'participant:joined'
  participant: Participant
}

/**
 * Participant left event
 */
export interface ParticipantLeftEvent extends ConferenceEvent {
  type: 'participant:left'
  participant: Participant
  /** Reason for leaving */
  reason?: string
}

/**
 * Participant updated event
 */
export interface ParticipantUpdatedEvent extends ConferenceEvent {
  type: 'participant:updated'
  participant: Participant
  /** Changed properties */
  changes: Partial<Participant>
}

/**
 * Audio level event
 */
export interface AudioLevelEvent extends ConferenceEvent {
  type: 'audio:level'
  /** Participant audio levels */
  levels: Map<string, number>
}
