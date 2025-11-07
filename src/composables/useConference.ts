/**
 * Conference Composable
 *
 * Provides conference call functionality for managing multi-party calls
 * with participant management, audio level monitoring, and conference controls.
 *
 * @module composables/useConference
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { SipClient } from '../core/SipClient'
import {
  ConferenceState,
  ParticipantState,
  type Participant,
  type ConferenceStateInterface,
  type ConferenceOptions,
  type ConferenceEvent,
  type ParticipantJoinedEvent,
  type ParticipantLeftEvent,
  type ParticipantUpdatedEvent,
  type AudioLevelEvent,
} from '../types/conference.types'
import { createLogger } from '../utils/logger'
import { CONFERENCE_CONSTANTS } from './constants'

const log = createLogger('useConference')

/**
 * Return type for useConference composable
 */
export interface UseConferenceReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Conference state */
  conference: Ref<ConferenceStateInterface | null>
  /** Conference state enum */
  state: ComputedRef<ConferenceState>
  /** Participants array */
  participants: ComputedRef<Participant[]>
  /** Local participant */
  localParticipant: ComputedRef<Participant | null>
  /** Participant count */
  participantCount: ComputedRef<number>
  /** Is conference active */
  isActive: ComputedRef<boolean>
  /** Is conference locked */
  isLocked: ComputedRef<boolean>
  /** Is recording */
  isRecording: ComputedRef<boolean>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Create a new conference */
  createConference: (options?: ConferenceOptions) => Promise<string>
  /** Join an existing conference */
  joinConference: (conferenceUri: string, options?: ConferenceOptions) => Promise<void>
  /** Add a participant to the conference */
  addParticipant: (uri: string, displayName?: string) => Promise<string>
  /** Remove a participant from the conference */
  removeParticipant: (participantId: string, reason?: string) => Promise<void>
  /** Mute a participant */
  muteParticipant: (participantId: string) => Promise<void>
  /** Unmute a participant */
  unmuteParticipant: (participantId: string) => Promise<void>
  /** End the conference */
  endConference: () => Promise<void>
  /** Lock the conference (prevent new participants) */
  lockConference: () => Promise<void>
  /** Unlock the conference */
  unlockConference: () => Promise<void>
  /** Start recording */
  startRecording: () => Promise<void>
  /** Stop recording */
  stopRecording: () => Promise<void>
  /** Get participant by ID */
  getParticipant: (participantId: string) => Participant | null
  /** Listen for conference events */
  onConferenceEvent: (callback: (event: ConferenceEvent) => void) => () => void
}

/**
 * Conference Composable
 *
 * Manages SIP conference calls with support for multiple participants,
 * audio level monitoring, and advanced controls like muting, recording, and locking.
 *
 * @param sipClient - SIP client instance
 * @returns Conference state and methods
 *
 * @example
 * ```typescript
 * const {
 *   createConference,
 *   addParticipant,
 *   participants,
 *   endConference
 * } = useConference(sipClient)
 *
 * // Create conference
 * const confId = await createConference({ maxParticipants: 10 })
 *
 * // Add participants
 * await addParticipant('sip:alice@domain.com', 'Alice')
 * await addParticipant('sip:bob@domain.com', 'Bob')
 *
 * // Check participants
 * console.log(`Participants: ${participants.value.length}`)
 *
 * // End conference
 * await endConference()
 * ```
 */
export function useConference(sipClient: Ref<SipClient | null>): UseConferenceReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  const conference = ref<ConferenceStateInterface | null>(null)
  const conferenceEventListeners = ref<Array<(event: ConferenceEvent) => void>>([])

  // Audio level monitoring
  let audioLevelInterval: number | null = null

  // ============================================================================
  // Computed Values
  // ============================================================================

  const state = computed(() => conference.value?.state || ConferenceState.Idle)

  const participants = computed(() =>
    conference.value ? Array.from(conference.value.participants.values()) : []
  )

  const localParticipant = computed(() => conference.value?.localParticipant || null)

  const participantCount = computed(() => conference.value?.participants.size || 0)

  const isActive = computed(() => state.value === ConferenceState.Active)

  const isLocked = computed(() => conference.value?.isLocked || false)

  const isRecording = computed(() => conference.value?.isRecording || false)

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Emit conference event
   */
  const emitConferenceEvent = (event: ConferenceEvent): void => {
    log.debug('Conference event:', event)
    conferenceEventListeners.value.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        log.error('Error in conference event listener:', error)
      }
    })
  }

  /**
   * Update conference state
   */
  const updateConferenceState = (newState: ConferenceState): void => {
    if (!conference.value) return

    const oldState = conference.value.state
    conference.value.state = newState

    if (newState === ConferenceState.Ended) {
      conference.value.endedAt = new Date()
    }

    log.debug(`Conference state changed: ${oldState} -> ${newState}`)

    emitConferenceEvent({
      type: 'state:changed',
      conferenceId: conference.value.id,
      state: newState,
      timestamp: new Date(),
    })
  }

  // ============================================================================
  // Conference Creation and Management
  // ============================================================================

  /**
   * Create a new conference
   *
   * @param options - Conference options
   * @returns Conference ID
   * @throws Error if SIP client not initialized or creation fails
   */
  const createConference = async (options: ConferenceOptions = {}): Promise<string> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    if (conference.value && isActive.value) {
      throw new Error('A conference is already active')
    }

    try {
      log.info('Creating conference')

      const conferenceId = `conf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Initialize conference state
      conference.value = {
        id: conferenceId,
        state: ConferenceState.Creating,
        participants: new Map(),
        isLocked: options.locked || false,
        isRecording: false,
        maxParticipants: options.maxParticipants || CONFERENCE_CONSTANTS.DEFAULT_MAX_PARTICIPANTS,
        metadata: options.metadata,
      }

      // Create local participant
      const localUri = sipClient.value.getConfig().uri
      const localPart: Participant = {
        id: `part-local-${Date.now()}`,
        uri: localUri,
        displayName: sipClient.value.getConfig().displayName,
        state: ParticipantState.Connected,
        isMuted: false,
        isOnHold: false,
        isModerator: true,
        isSelf: true,
        joinedAt: new Date(),
      }

      conference.value.localParticipant = localPart
      conference.value.participants.set(localPart.id, localPart)

      // Create conference on server (implementation-specific)
      await sipClient.value.createConference(conferenceId, options)

      conference.value.state = ConferenceState.Active
      conference.value.startedAt = new Date()

      // Start audio level monitoring
      startAudioLevelMonitoring()

      log.info(`Conference created: ${conferenceId}`)

      emitConferenceEvent({
        type: 'created',
        conferenceId,
        state: ConferenceState.Active,
        timestamp: new Date(),
      })

      return conferenceId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create conference'
      log.error('Failed to create conference:', errorMessage)

      if (conference.value) {
        updateConferenceState(ConferenceState.Failed)
      }

      throw error
    }
  }

  /**
   * Join an existing conference
   *
   * @param conferenceUri - Conference SIP URI
   * @param options - Conference options
   */
  const joinConference = async (
    conferenceUri: string,
    options: ConferenceOptions = {}
  ): Promise<void> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    try {
      log.info(`Joining conference: ${conferenceUri}`)

      const conferenceId = `conf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      conference.value = {
        id: conferenceId,
        state: ConferenceState.Creating,
        uri: conferenceUri,
        participants: new Map(),
        isLocked: false,
        isRecording: false,
        maxParticipants: options.maxParticipants || CONFERENCE_CONSTANTS.DEFAULT_MAX_PARTICIPANTS,
      }

      // Join conference via SIP client
      await sipClient.value.joinConference(conferenceUri, options)

      conference.value.state = ConferenceState.Active
      conference.value.startedAt = new Date()

      // Start audio level monitoring
      startAudioLevelMonitoring()

      log.info('Joined conference successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join conference'
      log.error('Failed to join conference:', errorMessage)

      if (conference.value) {
        updateConferenceState(ConferenceState.Failed)
      }

      throw error
    }
  }

  /**
   * Add a participant to the conference
   *
   * @param uri - Participant SIP URI
   * @param displayName - Participant display name
   * @returns Participant ID
   */
  const addParticipant = async (uri: string, displayName?: string): Promise<string> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    if (isLocked.value) {
      throw new Error('Conference is locked')
    }

    if (
      participantCount.value >=
      (conference.value.maxParticipants || CONFERENCE_CONSTANTS.DEFAULT_MAX_PARTICIPANTS)
    ) {
      throw new Error('Conference is full')
    }

    try {
      log.info(`Adding participant: ${uri}`)

      const participantId = `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const participant: Participant = {
        id: participantId,
        uri,
        displayName,
        state: ParticipantState.Connecting,
        isMuted: false,
        isOnHold: false,
        isModerator: false,
        isSelf: false,
        joinedAt: new Date(),
      }

      conference.value.participants.set(participantId, participant)

      // Invite participant via SIP client
      if (sipClient.value) {
        await sipClient.value.inviteToConference(conference.value.id, uri)
      }

      participant.state = ParticipantState.Connected

      // Emit event
      const event: ParticipantJoinedEvent = {
        type: 'participant:joined',
        conferenceId: conference.value.id,
        participant,
        timestamp: new Date(),
      }
      emitConferenceEvent(event)

      log.info(`Participant added: ${participantId}`)
      return participantId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add participant'
      log.error('Failed to add participant:', errorMessage)
      throw error
    }
  }

  /**
   * Remove a participant from the conference
   *
   * @param participantId - Participant ID
   * @param reason - Reason for removal
   */
  const removeParticipant = async (participantId: string, reason?: string): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    const participant = conference.value.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`)
    }

    if (participant.isSelf) {
      throw new Error('Cannot remove yourself, use endConference() instead')
    }

    try {
      log.info(`Removing participant: ${participantId}`)

      participant.state = ParticipantState.Disconnected

      // Remove participant via SIP client
      if (sipClient.value) {
        await sipClient.value.removeFromConference(conference.value.id, participant.uri)
      }

      conference.value.participants.delete(participantId)

      // Emit event
      const event: ParticipantLeftEvent = {
        type: 'participant:left',
        conferenceId: conference.value.id,
        participant,
        reason,
        timestamp: new Date(),
      }
      emitConferenceEvent(event)

      log.info(`Participant removed: ${participantId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove participant'
      log.error('Failed to remove participant:', errorMessage)
      throw error
    }
  }

  // ============================================================================
  // Participant Controls
  // ============================================================================

  /**
   * Mute a participant
   */
  const muteParticipant = async (participantId: string): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    const participant = conference.value.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`)
    }

    if (participant.isMuted) {
      return // Already muted
    }

    try {
      log.debug(`Muting participant: ${participantId}`)

      if (participant.isSelf && sipClient.value) {
        await sipClient.value.muteAudio()
      } else if (sipClient.value) {
        await sipClient.value.muteParticipant(conference.value.id, participant.uri)
      }

      participant.isMuted = true

      // Emit event
      const event: ParticipantUpdatedEvent = {
        type: 'participant:updated',
        conferenceId: conference.value.id,
        participant,
        changes: { isMuted: true },
        timestamp: new Date(),
      }
      emitConferenceEvent(event)
    } catch (error) {
      log.error('Failed to mute participant:', error)
      throw error
    }
  }

  /**
   * Unmute a participant
   */
  const unmuteParticipant = async (participantId: string): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    const participant = conference.value.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`)
    }

    if (!participant.isMuted) {
      return // Not muted
    }

    try {
      log.debug(`Unmuting participant: ${participantId}`)

      if (participant.isSelf && sipClient.value) {
        await sipClient.value.unmuteAudio()
      } else if (sipClient.value) {
        await sipClient.value.unmuteParticipant(conference.value.id, participant.uri)
      }

      participant.isMuted = false

      // Emit event
      const event: ParticipantUpdatedEvent = {
        type: 'participant:updated',
        conferenceId: conference.value.id,
        participant,
        changes: { isMuted: false },
        timestamp: new Date(),
      }
      emitConferenceEvent(event)
    } catch (error) {
      log.error('Failed to unmute participant:', error)
      throw error
    }
  }

  // ============================================================================
  // Conference Controls
  // ============================================================================

  /**
   * End the conference
   */
  const endConference = async (): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    try {
      log.info('Ending conference')

      updateConferenceState(ConferenceState.Ending)

      // End conference via SIP client
      if (sipClient.value) {
        await sipClient.value.endConference(conference.value.id)
      }

      // Stop audio level monitoring
      stopAudioLevelMonitoring()

      updateConferenceState(ConferenceState.Ended)

      // Clear conference after a delay
      setTimeout(() => {
        conference.value = null
      }, CONFERENCE_CONSTANTS.STATE_TRANSITION_DELAY)

      log.info('Conference ended')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end conference'
      log.error('Failed to end conference:', errorMessage)
      throw error
    }
  }

  /**
   * Lock the conference
   */
  const lockConference = async (): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    if (isLocked.value) {
      return // Already locked
    }

    conference.value.isLocked = true
    log.info('Conference locked')

    emitConferenceEvent({
      type: 'locked',
      conferenceId: conference.value.id,
      timestamp: new Date(),
    })
  }

  /**
   * Unlock the conference
   */
  const unlockConference = async (): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    if (!isLocked.value) {
      return // Not locked
    }

    conference.value.isLocked = false
    log.info('Conference unlocked')

    emitConferenceEvent({
      type: 'unlocked',
      conferenceId: conference.value.id,
      timestamp: new Date(),
    })
  }

  /**
   * Start recording
   */
  const startRecording = async (): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    if (isRecording.value) {
      return // Already recording
    }

    try {
      log.info('Starting conference recording')

      if (sipClient.value) {
        await sipClient.value.startConferenceRecording(conference.value.id)
      }

      conference.value.isRecording = true

      emitConferenceEvent({
        type: 'recording:started',
        conferenceId: conference.value.id,
        timestamp: new Date(),
      })
    } catch (error) {
      log.error('Failed to start recording:', error)
      throw error
    }
  }

  /**
   * Stop recording
   */
  const stopRecording = async (): Promise<void> => {
    if (!conference.value) {
      throw new Error('No active conference')
    }

    if (!isRecording.value) {
      return // Not recording
    }

    try {
      log.info('Stopping conference recording')

      if (sipClient.value) {
        await sipClient.value.stopConferenceRecording(conference.value.id)
      }

      conference.value.isRecording = false

      emitConferenceEvent({
        type: 'recording:stopped',
        conferenceId: conference.value.id,
        timestamp: new Date(),
      })
    } catch (error) {
      log.error('Failed to stop recording:', error)
      throw error
    }
  }

  // ============================================================================
  // Audio Level Monitoring
  // ============================================================================

  /**
   * Start audio level monitoring
   */
  const startAudioLevelMonitoring = (): void => {
    if (audioLevelInterval) {
      return // Already monitoring
    }

    audioLevelInterval = window.setInterval(() => {
      if (!conference.value || !sipClient.value) return

      // Get audio levels from SIP client (Phase 11+ feature)
      const levels = sipClient.value.getConferenceAudioLevels?.(conference.value.id) as
        | Map<string, number>
        | undefined
      if (levels) {
        // Update participant audio levels
        levels.forEach((level: number, uri: string) => {
          const participant = participants.value.find((p) => p.uri === uri)
          if (participant) {
            participant.audioLevel = level
          }
        })

        // Emit audio level event
        const event: AudioLevelEvent = {
          type: 'audio:level',
          conferenceId: conference.value.id,
          levels,
          timestamp: new Date(),
        }
        emitConferenceEvent(event)
      }
    }, CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL) // Update every 100ms
  }

  /**
   * Stop audio level monitoring
   */
  const stopAudioLevelMonitoring = (): void => {
    if (audioLevelInterval) {
      clearInterval(audioLevelInterval)
      audioLevelInterval = null
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get participant by ID
   */
  const getParticipant = (participantId: string): Participant | null => {
    return conference.value?.participants.get(participantId) || null
  }

  /**
   * Listen for conference events
   */
  const onConferenceEvent = (callback: (event: ConferenceEvent) => void): (() => void) => {
    conferenceEventListeners.value.push(callback)

    // Return unsubscribe function
    return () => {
      const index = conferenceEventListeners.value.indexOf(callback)
      if (index !== -1) {
        conferenceEventListeners.value.splice(index, 1)
      }
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(async () => {
    log.debug('Composable unmounting')

    // Stop audio monitoring
    stopAudioLevelMonitoring()

    // End conference if active
    if (conference.value && isActive.value) {
      await endConference().catch((error) => {
        log.error('Error ending conference during cleanup:', error)
      })
    }

    // Clear event listeners
    conferenceEventListeners.value = []
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    conference,
    state,
    participants,
    localParticipant,
    participantCount,
    isActive,
    isLocked,
    isRecording,

    // Methods
    createConference,
    joinConference,
    addParticipant,
    removeParticipant,
    muteParticipant,
    unmuteParticipant,
    endConference,
    lockConference,
    unlockConference,
    startRecording,
    stopRecording,
    getParticipant,
    onConferenceEvent,
  }
}
