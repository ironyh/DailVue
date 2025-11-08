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
import { validateSipUri } from '../utils/validators'
import { CONFERENCE_CONSTANTS } from './constants'

const log = createLogger('useConference')

/**
 * Return type for useConference composable
 *
 * Provides reactive state and methods for managing SIP conference calls.
 * Includes participant management, audio controls, recording capabilities,
 * and conference state monitoring.
 *
 * @since 1.0.0
 */
export interface UseConferenceReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /**
   * Current conference state object containing all conference data
   * @remarks Null when no conference exists, populated after creating or joining
   */
  conference: Ref<ConferenceStateInterface | null>

  /**
   * Current state of the conference (Idle, Creating, Active, Ending, Ended, Failed)
   * @remarks Returns Idle when no conference exists. Watch this for state transitions.
   */
  state: ComputedRef<ConferenceState>

  /**
   * Array of all participants in the conference
   * @remarks Empty array when no conference exists. Includes the local participant.
   * Updates reactively as participants join/leave.
   */
  participants: ComputedRef<Participant[]>

  /**
   * The local participant (self) in the conference
   * @remarks Null when no conference exists. Always has isSelf=true and isModerator=true.
   */
  localParticipant: ComputedRef<Participant | null>

  /**
   * Total number of participants currently in the conference
   * @remarks Returns 0 when no conference exists. Includes the local participant in the count.
   */
  participantCount: ComputedRef<number>

  /**
   * Whether the conference is currently active
   * @remarks True only when state is ConferenceState.Active
   */
  isActive: ComputedRef<boolean>

  /**
   * Whether the conference is locked (no new participants allowed)
   * @remarks Returns false when no conference exists. Locked conferences reject addParticipant calls.
   */
  isLocked: ComputedRef<boolean>

  /**
   * Whether the conference is currently being recorded
   * @remarks Returns false when no conference exists or recording not started
   */
  isRecording: ComputedRef<boolean>

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Create a new conference
   * @param options - Optional conference configuration
   * @returns Conference ID
   * @throws {Error} If SIP client not initialized or conference already active
   */
  createConference: (options?: ConferenceOptions) => Promise<string>

  /**
   * Join an existing conference
   * @param conferenceUri - SIP URI of the conference to join
   * @param options - Optional conference configuration
   * @throws {Error} If SIP client not initialized or join fails
   */
  joinConference: (conferenceUri: string, options?: ConferenceOptions) => Promise<void>

  /**
   * Add a participant to the conference
   * @param uri - SIP URI of the participant to add
   * @param displayName - Optional display name for the participant
   * @returns Participant ID
   * @throws {Error} If no active conference, conference locked, or conference full
   */
  addParticipant: (uri: string, displayName?: string) => Promise<string>

  /**
   * Remove a participant from the conference
   * @param participantId - ID of the participant to remove
   * @param reason - Optional reason for removal
   * @throws {Error} If no active conference or participant not found
   */
  removeParticipant: (participantId: string, reason?: string) => Promise<void>

  /**
   * Mute a participant's audio
   * @param participantId - ID of the participant to mute
   * @throws {Error} If no active conference or participant not found
   */
  muteParticipant: (participantId: string) => Promise<void>

  /**
   * Unmute a participant's audio
   * @param participantId - ID of the participant to unmute
   * @throws {Error} If no active conference or participant not found
   */
  unmuteParticipant: (participantId: string) => Promise<void>

  /**
   * End the conference for all participants
   * @throws {Error} If no active conference
   */
  endConference: () => Promise<void>

  /**
   * Lock the conference to prevent new participants from joining
   * @throws {Error} If no active conference
   */
  lockConference: () => Promise<void>

  /**
   * Unlock the conference to allow new participants to join
   * @throws {Error} If no active conference
   */
  unlockConference: () => Promise<void>

  /**
   * Start recording the conference
   * @throws {Error} If no active conference or recording fails
   */
  startRecording: () => Promise<void>

  /**
   * Stop recording the conference
   * @throws {Error} If no active conference
   */
  stopRecording: () => Promise<void>

  /**
   * Get a specific participant by their ID
   * @param participantId - ID of the participant to retrieve
   * @returns Participant object or null if not found
   */
  getParticipant: (participantId: string) => Participant | null

  /**
   * Register an event listener for conference events
   * @param callback - Function to call when conference events occur
   * @returns Unsubscribe function to remove the event listener
   */
  onConferenceEvent: (callback: (event: ConferenceEvent) => void) => () => void
}

/**
 * Conference Composable
 *
 * Manages SIP conference calls with support for multiple participants,
 * audio level monitoring, and advanced controls like muting, recording, and locking.
 *
 * Features:
 * - Create and join conferences
 * - Add/remove participants dynamically
 * - Mute/unmute participants
 * - Lock/unlock conference (control participant access)
 * - Record conference sessions
 * - Monitor audio levels in real-time
 * - Event-driven participant updates
 *
 * @param sipClient - Reactive reference to the SIP client instance
 * @returns Object containing conference state and control methods
 *
 * @throws {Error} Various errors can be thrown by the returned methods. See individual method documentation.
 *
 * ## Lifecycle and Cleanup
 *
 * - The composable automatically cleans up on component unmount (via onUnmounted)
 * - Active conferences are ended automatically during cleanup
 * - Audio level monitoring is stopped during cleanup
 * - Event listeners are cleared during cleanup
 * - You can manually call endConference() before unmount if needed
 *
 * ## Best Practices
 *
 * - Always check `isActive` before performing conference operations
 * - Use the `onConferenceEvent` listener to react to participant changes
 * - Lock conferences when you want to prevent new participants
 * - Handle errors from all async methods appropriately
 * - Clean up event listeners when no longer needed (call the unsubscribe function)
 * - Consider the max participants limit when designing your UI
 *
 * ## Common Pitfalls
 *
 * - Don't create multiple conferences simultaneously - check `isActive` first
 * - Don't call `removeParticipant` to leave - use `endConference` instead
 * - Remember that `participantCount` includes yourself (the local participant)
 * - Conference state transitions are asynchronous - watch the `state` property
 * - Muting yourself vs muting others uses different underlying mechanisms
 *
 * @since 1.0.0
 *
 * @example Basic conference creation and management
 * ```typescript
 * import { ref } from 'vue'
 * import { useConference } from './composables/useConference'
 *
 * const sipClient = ref(mySipClient)
 * const {
 *   createConference,
 *   addParticipant,
 *   participants,
 *   participantCount,
 *   endConference
 * } = useConference(sipClient)
 *
 * // Create a new conference
 * const confId = await createConference({
 *   maxParticipants: 10,
 *   locked: false
 * })
 * console.log(`Created conference: ${confId}`)
 *
 * // Add participants
 * await addParticipant('sip:alice@domain.com', 'Alice')
 * await addParticipant('sip:bob@domain.com', 'Bob')
 *
 * // Monitor participants
 * console.log(`Active participants: ${participantCount.value}`)
 *
 * // End conference when done
 * await endConference()
 * ```
 *
 * @example Joining an existing conference
 * ```typescript
 * const { joinConference, participants, isActive } = useConference(sipClient)
 *
 * // Join existing conference
 * await joinConference('sip:conference123@server.com')
 *
 * // Check if joined successfully
 * if (isActive.value) {
 *   console.log(`Joined with ${participants.value.length} participants`)
 * }
 * ```
 *
 * @example Managing participant controls
 * ```typescript
 * const {
 *   addParticipant,
 *   muteParticipant,
 *   removeParticipant,
 *   participants
 * } = useConference(sipClient)
 *
 * // Add and manage a participant
 * const participantId = await addParticipant('sip:user@domain.com', 'User')
 *
 * // Mute the participant
 * await muteParticipant(participantId)
 *
 * // Remove participant if needed
 * await removeParticipant(participantId, 'Violating terms')
 * ```
 *
 * @example Conference locking and recording
 * ```typescript
 * const {
 *   createConference,
 *   lockConference,
 *   startRecording,
 *   stopRecording,
 *   isLocked,
 *   isRecording
 * } = useConference(sipClient)
 *
 * await createConference()
 *
 * // Lock conference to prevent new joins
 * await lockConference()
 * console.log(`Locked: ${isLocked.value}`)
 *
 * // Start recording
 * await startRecording()
 * console.log(`Recording: ${isRecording.value}`)
 *
 * // Stop recording when done
 * await stopRecording()
 * ```
 *
 * @example Listening to conference events
 * ```typescript
 * const { onConferenceEvent, createConference } = useConference(sipClient)
 *
 * // Register event listener
 * const unsubscribe = onConferenceEvent((event) => {
 *   switch (event.type) {
 *     case 'participant:joined':
 *       console.log('New participant:', event.participant.displayName)
 *       break
 *     case 'participant:left':
 *       console.log('Participant left:', event.participant.displayName)
 *       break
 *     case 'audio:level':
 *       console.log('Audio levels:', event.levels)
 *       break
 *   }
 * })
 *
 * await createConference()
 *
 * // Clean up when done
 * unsubscribe()
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
   *
   * Internal method that notifies all registered event listeners of a conference event.
   * Handles errors in individual listeners to prevent one failing listener from
   * affecting others.
   *
   * @param event - Conference event to emit
   * @internal
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
   *
   * Internal method that transitions the conference to a new state and emits
   * a state change event. Automatically sets the endedAt timestamp when
   * transitioning to the Ended state.
   *
   * @param newState - New conference state to transition to
   * @internal
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
   * Initializes a new conference session with the local participant as moderator.
   * Automatically starts audio level monitoring and sets up the conference infrastructure.
   *
   * **Side Effects:**
   * - Sets `conference.value` to the new conference state
   * - Changes `state` to Creating, then Active
   * - Adds local participant to the conference
   * - Starts audio level monitoring (emits events every 100ms)
   * - Emits a 'created' conference event
   * - Calls sipClient.createConference() on the server
   *
   * **State Changes:**
   * - `state`: Idle → Creating → Active
   * - `isActive`: false → true
   * - `participantCount`: 0 → 1 (includes self)
   *
   * @param options - Conference configuration options
   * @param options.maxParticipants - Maximum number of participants allowed (default: 10)
   * @param options.locked - Whether the conference starts locked (default: false)
   * @param options.metadata - Additional metadata for the conference
   * @returns Promise resolving to the unique conference ID (use this for reference)
   *
   * @throws {Error} 'SIP client not initialized' - sipClient.value is null
   * @throws {Error} 'A conference is already active' - Cannot create multiple conferences
   * @throws {Error} If conference creation on server fails (network, permissions, etc.)
   *
   * @see {@link joinConference} - To join an existing conference instead of creating
   * @see {@link endConference} - To terminate the conference
   * @see {@link lockConference} - To lock the conference after creation
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Create basic conference
   * const confId = await createConference()
   *
   * // Create with options
   * const confId = await createConference({
   *   maxParticipants: 20,
   *   locked: true,
   *   metadata: { topic: 'Team Meeting' }
   * })
   * ```
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
   * Connects to an existing conference using its SIP URI. Automatically
   * starts audio level monitoring upon successful join. Unlike createConference,
   * this joins as a regular participant (not necessarily as moderator).
   *
   * **Side Effects:**
   * - Sets `conference.value` to the new conference state
   * - Changes `state` to Creating, then Active
   * - Starts audio level monitoring
   * - Calls sipClient.joinConference() on the server
   * - Local participant may not have moderator privileges
   *
   * **State Changes:**
   * - `state`: Idle → Creating → Active
   * - `isActive`: false → true
   * - Other participants' data will be populated by server
   *
   * @param conferenceUri - SIP URI of the conference to join (e.g., 'sip:conf123@server.com')
   * @param options - Optional conference configuration
   * @param options.maxParticipants - Maximum participants to expect (default: 10)
   * @returns Promise that resolves when successfully joined
   *
   * @throws {Error} 'SIP client not initialized' - sipClient.value is null
   * @throws {Error} If the conference doesn't exist on the server
   * @throws {Error} If the conference is locked and you're not invited
   * @throws {Error} If joining fails due to network or server issues
   *
   * @see {@link createConference} - To create a new conference instead of joining
   * @see {@link endConference} - To leave the conference
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Join a conference
   * await joinConference('sip:conference-room-1@example.com')
   *
   * // Join with options
   * await joinConference('sip:conf@example.com', {
   *   maxParticipants: 50
   * })
   * ```
   */
  const joinConference = async (
    conferenceUri: string,
    options: ConferenceOptions = {}
  ): Promise<void> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    // Validate conference URI
    const uriValidation = validateSipUri(conferenceUri)
    if (!uriValidation.valid) {
      const error = `Invalid conference URI: ${uriValidation.error}`
      log.error(error, { conferenceUri, validation: uriValidation })
      throw new Error(error)
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
   * Invites a new participant to join the active conference. The participant
   * will be added to the conference and an event will be emitted when they
   * successfully join. The participant starts in 'Connecting' state and
   * transitions to 'Connected' when the invitation succeeds.
   *
   * **Side Effects:**
   * - Adds participant to `participants` array
   * - Increments `participantCount`
   * - Emits 'participant:joined' event
   * - Sends SIP INVITE to the participant's URI
   * - Participant state: Connecting → Connected
   *
   * **Timing:**
   * - Returns immediately after participant is added locally
   * - Server-side connection may still be in progress
   * - Listen to events for actual connection status
   *
   * @param uri - SIP URI of the participant to invite (e.g., 'sip:user@domain.com')
   * @param displayName - Optional display name for the participant
   * @returns Promise resolving to the unique participant ID (save this for later operations)
   *
   * @throws {Error} 'No active conference' - Must create/join conference first
   * @throws {Error} 'Conference is locked' - Call unlockConference first
   * @throws {Error} 'Conference is full' - Maximum participants reached
   * @throws {Error} If the participant URI is invalid
   * @throws {Error} If the invitation fails (network, permissions, etc.)
   *
   * @see {@link removeParticipant} - To remove a participant
   * @see {@link muteParticipant} - To mute a participant
   * @see {@link lockConference} - To prevent new participants
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Add participant with display name
   * const participantId = await addParticipant(
   *   'sip:alice@example.com',
   *   'Alice Smith'
   * )
   * console.log(`Added participant: ${participantId}`)
   *
   * // Add participant without display name
   * const id = await addParticipant('sip:bob@example.com')
   * ```
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

    // Validate participant URI
    const uriValidation = validateSipUri(uri)
    if (!uriValidation.valid) {
      const error = `Invalid participant URI: ${uriValidation.error}`
      log.error(error, { uri, validation: uriValidation })
      throw new Error(error)
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
   * Disconnects a participant from the conference. A 'participant:left' event
   * will be emitted. Cannot be used to remove yourself - use endConference() instead.
   * The participant's call will be terminated gracefully.
   *
   * **Side Effects:**
   * - Removes participant from `participants` array
   * - Decrements `participantCount`
   * - Sets participant state to Disconnected
   * - Emits 'participant:left' event with optional reason
   * - Sends SIP BYE to disconnect the participant
   *
   * **Important:**
   * - Cannot remove yourself (isSelf=true) - use endConference instead
   * - The reason parameter is included in the event for logging/UI purposes
   *
   * @param participantId - Unique ID of the participant to remove
   * @param reason - Optional reason for removal (e.g., 'Violating terms', 'Inactive')
   * @returns Promise that resolves when participant is removed
   *
   * @throws {Error} 'No active conference' - Must have an active conference
   * @throws {Error} 'Participant {id} not found' - Invalid participant ID
   * @throws {Error} 'Cannot remove yourself, use endConference() instead' - Tried to remove self
   * @throws {Error} If removal fails on the server
   *
   * @see {@link addParticipant} - To add a participant
   * @see {@link endConference} - To leave the conference yourself
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Remove participant without reason
   * await removeParticipant('part-123-abc')
   *
   * // Remove with reason
   * await removeParticipant('part-456-def', 'Inactive for 5 minutes')
   * ```
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
   *
   * Mutes the audio of a specific participant in the conference. This operation
   * behaves differently depending on whether you're muting yourself or another participant.
   *
   * **Behavior:**
   * - **Muting yourself (isSelf=true):** Uses local audio track muting (immediate)
   * - **Muting others:** Sends command to server to mute their audio (requires permissions)
   * - **Idempotent:** Safe to call if participant is already muted
   *
   * **Side Effects:**
   * - Sets `participant.isMuted = true`
   * - Emits 'participant:updated' event with changes
   * - For self: Calls sipClient.muteAudio()
   * - For others: Calls sipClient.muteParticipant()
   *
   * @param participantId - ID of the participant to mute
   * @returns Promise that resolves when participant is muted
   *
   * @throws {Error} 'No active conference' - Must have an active conference
   * @throws {Error} 'Participant {id} not found' - Invalid participant ID
   * @throws {Error} If mute operation fails (permissions, network, etc.)
   *
   * @see {@link unmuteParticipant} - To unmute a participant
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Mute a specific participant
   * await muteParticipant('part-123-abc')
   *
   * // Safe to call even if already muted (idempotent)
   * await muteParticipant(participantId)
   * ```
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
   *
   * Unmutes the audio of a specific participant in the conference. This operation
   * behaves differently depending on whether you're unmuting yourself or another participant.
   *
   * **Behavior:**
   * - **Unmuting yourself (isSelf=true):** Uses local audio track unmuting (immediate)
   * - **Unmuting others:** Sends command to server to unmute their audio (requires permissions)
   * - **Idempotent:** Safe to call if participant is not muted
   *
   * **Side Effects:**
   * - Sets `participant.isMuted = false`
   * - Emits 'participant:updated' event with changes
   * - For self: Calls sipClient.unmuteAudio()
   * - For others: Calls sipClient.unmuteParticipant()
   *
   * @param participantId - ID of the participant to unmute
   * @returns Promise that resolves when participant is unmuted
   *
   * @throws {Error} 'No active conference' - Must have an active conference
   * @throws {Error} 'Participant {id} not found' - Invalid participant ID
   * @throws {Error} If unmute operation fails (permissions, network, etc.)
   *
   * @see {@link muteParticipant} - To mute a participant
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Unmute a specific participant
   * await unmuteParticipant('part-123-abc')
   *
   * // Toggle mute state
   * if (participant.isMuted) {
   *   await unmuteParticipant(participant.id)
   * } else {
   *   await muteParticipant(participant.id)
   * }
   * ```
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
   *
   * Terminates the conference for all participants, stops audio level monitoring,
   * and cleans up resources. The conference state will transition to 'Ending'
   * then 'Ended'. Conference data is cleared after a short delay.
   *
   * **Side Effects:**
   * - Sets state to Ending, then Ended
   * - Stops audio level monitoring
   * - Disconnects all participants
   * - Emits 'state:changed' events
   * - Calls sipClient.endConference()
   * - Clears `conference.value` after delay (for state transition visibility)
   * - Sets `endedAt` timestamp
   *
   * **State Changes:**
   * - `state`: Active → Ending → Ended
   * - `isActive`: true → false
   * - `conference`: populated → null (after delay)
   * - `participants`: cleared
   * - `participantCount`: drops to 0
   *
   * **Cleanup Timing:**
   * - Audio monitoring stops immediately
   * - Server-side conference ends immediately
   * - Local state cleared after `CONFERENCE_CONSTANTS.STATE_TRANSITION_DELAY`
   * - This delay allows UI to show "Ended" state before clearing
   *
   * @returns Promise that resolves when the conference is ended
   *
   * @throws {Error} 'No active conference' - Must have an active conference
   * @throws {Error} If ending the conference fails on the server
   *
   * @see {@link createConference} - To create a new conference after ending
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // End the conference
   * await endConference()
   * console.log('Conference ended successfully')
   * ```
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
   *
   * Locks the conference to prevent new participants from joining. Existing
   * participants remain connected. Emits a 'locked' event. This is idempotent -
   * calling it on an already locked conference has no effect.
   *
   * @returns Promise that resolves when the conference is locked
   *
   * @throws {Error} If no active conference exists
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Lock conference after all participants join
   * await lockConference()
   * console.log(`Conference locked: ${isLocked.value}`)
   *
   * // Prevent late joiners
   * if (participantCount.value >= maxParticipants) {
   *   await lockConference()
   * }
   * ```
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
   *
   * Unlocks the conference to allow new participants to join. Emits an 'unlocked'
   * event. This is idempotent - calling it on an already unlocked conference has
   * no effect.
   *
   * @returns Promise that resolves when the conference is unlocked
   *
   * @throws {Error} If no active conference exists
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Unlock a previously locked conference
   * await unlockConference()
   * console.log(`Conference unlocked: ${!isLocked.value}`)
   * ```
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
   *
   * Begins recording the conference audio/video. Emits a 'recording:started' event
   * when recording begins. This is idempotent - calling it when already recording
   * has no effect. Recording data handling depends on SIP server implementation.
   *
   * **Side Effects:**
   * - Sets `isRecording` to true
   * - Emits 'recording:started' event
   * - Calls sipClient.startConferenceRecording()
   * - Server begins capturing audio/video streams
   *
   * **Important Legal/Privacy Considerations:**
   * - ⚠️ **Always notify participants before recording**
   * - Check local laws regarding call recording consent
   * - Some jurisdictions require all-party consent
   * - Consider displaying a recording indicator in your UI
   * - Recording files may contain sensitive information
   *
   * **Server Configuration:**
   * - Recording location and format depend on server setup
   * - Check server capabilities before enabling recording features
   * - Ensure adequate storage is available on the server
   *
   * @returns Promise that resolves when recording starts
   *
   * @throws {Error} 'No active conference' - Must have an active conference
   * @throws {Error} If starting recording fails (permissions, storage, etc.)
   * @throws {Error} If server doesn't support recording
   *
   * @see {@link stopRecording} - To stop the recording
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Start recording the conference
   * await startRecording()
   * console.log(`Recording: ${isRecording.value}`)
   *
   * // Record important meetings with consent
   * if (allParticipantsConsented) {
   *   await startRecording()
   * }
   * ```
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
   *
   * Stops recording the conference. Emits a 'recording:stopped' event when
   * recording ends. This is idempotent - calling it when not recording has
   * no effect. The recording file location depends on SIP server configuration.
   *
   * **Side Effects:**
   * - Sets `isRecording` to false
   * - Emits 'recording:stopped' event
   * - Calls sipClient.stopConferenceRecording()
   * - Server finalizes and saves the recording file
   *
   * **Post-Recording:**
   * - Recording file location is determined by server configuration
   * - File may require processing time before it's available
   * - Check server logs or API for recording file location
   * - Consider implementing a callback for recording completion
   *
   * @returns Promise that resolves when recording stops (file may still be processing)
   *
   * @throws {Error} 'No active conference' - Must have an active conference
   * @throws {Error} If stopping recording fails on the server
   *
   * @see {@link startRecording} - To start the recording
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Stop recording
   * await stopRecording()
   * console.log(`Recording stopped: ${!isRecording.value}`)
   *
   * // Toggle recording
   * if (isRecording.value) {
   *   await stopRecording()
   * } else {
   *   await startRecording()
   * }
   * ```
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
   *
   * Internal method that begins periodic monitoring of participant audio levels.
   * Updates participant audio levels and emits 'audio:level' events at regular
   * intervals (default: 100ms). Automatically called when creating or joining
   * a conference.
   *
   * @internal
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
   *
   * Internal method that stops the periodic audio level monitoring interval.
   * Automatically called when ending a conference or during cleanup.
   *
   * @internal
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
   *
   * Retrieves a specific participant from the conference by their unique ID.
   * Returns null if the participant is not found or if no conference is active.
   *
   * @param participantId - Unique ID of the participant to retrieve
   * @returns Participant object if found, null otherwise
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Get a specific participant
   * const participant = getParticipant('part-123-abc')
   * if (participant) {
   *   console.log(`Found: ${participant.displayName}`)
   * }
   *
   * // Check participant state
   * const p = getParticipant(participantId)
   * if (p?.isMuted) {
   *   console.log('Participant is muted')
   * }
   * ```
   */
  const getParticipant = (participantId: string): Participant | null => {
    return conference.value?.participants.get(participantId) || null
  }

  /**
   * Listen for conference events
   *
   * Registers a callback function to be notified of all conference events.
   * Events include participant joins/leaves, state changes, audio levels,
   * and recording state changes. Returns an unsubscribe function to remove
   * the listener.
   *
   * **Event Types:**
   * - `'created'` - Conference was created
   * - `'state:changed'` - Conference state changed (Creating, Active, Ending, Ended, Failed)
   * - `'participant:joined'` - New participant joined the conference
   * - `'participant:left'` - Participant left the conference
   * - `'participant:updated'` - Participant properties changed (muted, on hold, etc.)
   * - `'audio:level'` - Audio levels updated (emitted every 100ms when monitoring)
   * - `'locked'` - Conference was locked
   * - `'unlocked'` - Conference was unlocked
   * - `'recording:started'` - Recording began
   * - `'recording:stopped'` - Recording stopped
   *
   * **Event Handling:**
   * - Multiple listeners can be registered
   * - Listeners are called synchronously in registration order
   * - Errors in one listener don't affect others
   * - Always call the returned unsubscribe function to prevent memory leaks
   *
   * @param callback - Function to call when conference events occur
   * @returns Unsubscribe function to remove this event listener
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Listen for all conference events
   * const unsubscribe = onConferenceEvent((event) => {
   *   console.log('Conference event:', event.type, event)
   * })
   *
   * // Clean up when done (important to prevent memory leaks!)
   * unsubscribe()
   * ```
   *
   * @example Handle specific event types
   * ```typescript
   * onConferenceEvent((event) => {
   *   switch (event.type) {
   *     case 'participant:joined':
   *       console.log(`${event.participant.displayName} joined`)
   *       break
   *     case 'participant:left':
   *       console.log(`${event.participant.displayName} left`)
   *       break
   *     case 'participant:updated':
   *       console.log('Participant updated:', event.changes)
   *       break
   *     case 'state:changed':
   *       console.log('Conference state:', event.state)
   *       break
   *     case 'audio:level':
   *       // Handle audio levels for visualization
   *       break
   *     case 'locked':
   *     case 'unlocked':
   *       console.log('Conference lock changed')
   *       break
   *     case 'recording:started':
   *     case 'recording:stopped':
   *       console.log('Recording state changed')
   *       break
   *   }
   * })
   * ```
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
