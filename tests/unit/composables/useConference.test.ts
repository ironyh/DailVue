/**
 * Tests for useConference composable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { useConference } from '@/composables/useConference'
import type { SipClient } from '@/core/SipClient'
import { ConferenceState, ParticipantState, type ConferenceOptions } from '@/types/conference.types'
import { CONFERENCE_CONSTANTS } from '@/composables/constants'

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('useConference', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSipClient: any
  let sipClientRef: ReturnType<typeof ref<SipClient | null>>

  beforeEach(() => {
    vi.useFakeTimers()

    mockSipClient = {
      getConfig: vi.fn().mockReturnValue({
        uri: 'sip:self@example.com',
        displayName: 'Self User',
      }),
      createConference: vi.fn().mockResolvedValue(undefined),
      joinConference: vi.fn().mockResolvedValue(undefined),
      endConference: vi.fn().mockResolvedValue(undefined),
      inviteToConference: vi.fn().mockResolvedValue(undefined),
      removeFromConference: vi.fn().mockResolvedValue(undefined),
      muteAudio: vi.fn().mockResolvedValue(undefined),
      unmuteAudio: vi.fn().mockResolvedValue(undefined),
      muteParticipant: vi.fn().mockResolvedValue(undefined),
      unmuteParticipant: vi.fn().mockResolvedValue(undefined),
      startConferenceRecording: vi.fn().mockResolvedValue(undefined),
      stopConferenceRecording: vi.fn().mockResolvedValue(undefined),
      getConferenceAudioLevels: vi.fn().mockReturnValue(new Map()),
    }

    sipClientRef = ref<SipClient>(mockSipClient)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { conference, state, participants, participantCount, isActive, isLocked, isRecording } =
        useConference(sipClientRef)

      expect(conference.value).toBeNull()
      expect(state.value).toBe(ConferenceState.Idle)
      expect(participants.value).toEqual([])
      expect(participantCount.value).toBe(0)
      expect(isActive.value).toBe(false)
      expect(isLocked.value).toBe(false)
      expect(isRecording.value).toBe(false)
    })
  })

  // ============================================================================
  // createConference() method
  // ============================================================================

  describe('createConference() method', () => {
    it('should create conference successfully', async () => {
      const { createConference, conference, state, participants, isActive } =
        useConference(sipClientRef)

      const conferenceId = await createConference()

      expect(conferenceId).toBeTruthy()
      expect(conference.value).toBeTruthy()
      expect(conference.value?.id).toBe(conferenceId)
      expect(state.value).toBe(ConferenceState.Active)
      expect(isActive.value).toBe(true)
      expect(participants.value).toHaveLength(1) // Local participant
      expect(mockSipClient.createConference).toHaveBeenCalledWith(conferenceId, {})
    })

    it('should create conference with options', async () => {
      const { createConference, conference } = useConference(sipClientRef)

      const options: ConferenceOptions = {
        maxParticipants: 5,
        locked: true,
        metadata: { room: 'meeting-1' },
      }

      const conferenceId = await createConference(options)

      expect(conference.value?.maxParticipants).toBe(5)
      expect(conference.value?.isLocked).toBe(true)
      expect(conference.value?.metadata).toStrictEqual({ room: 'meeting-1' })
      expect(mockSipClient.createConference).toHaveBeenCalledWith(conferenceId, options)
    })

    it('should create local participant with moderator role', async () => {
      const { createConference, localParticipant, participants } = useConference(sipClientRef)

      await createConference()

      expect(localParticipant.value).toBeTruthy()
      expect(localParticipant.value?.uri).toBe('sip:self@example.com')
      expect(localParticipant.value?.displayName).toBe('Self User')
      expect(localParticipant.value?.isModerator).toBe(true)
      expect(localParticipant.value?.isSelf).toBe(true)
      expect(localParticipant.value?.state).toBe(ParticipantState.Connected)
      expect(participants.value[0]).toStrictEqual(localParticipant.value)
    })

    it('should throw error if SIP client not initialized', async () => {
      const nullClientRef = ref<SipClient | null>(null)
      const { createConference } = useConference(nullClientRef)

      await expect(createConference()).rejects.toThrow('SIP client not initialized')
    })

    it('should throw error if conference already active', async () => {
      const { createConference } = useConference(sipClientRef)

      await createConference()

      await expect(createConference()).rejects.toThrow('A conference is already active')
    })

    it('should handle createConference failure', async () => {
      mockSipClient.createConference.mockRejectedValueOnce(new Error('Network error'))
      const { createConference, state } = useConference(sipClientRef)

      await expect(createConference()).rejects.toThrow('Network error')
      expect(state.value).toBe(ConferenceState.Failed)
    })

    it('should emit created event', async () => {
      const { createConference, onConferenceEvent } = useConference(sipClientRef)
      const events: any[] = []

      onConferenceEvent((event) => events.push(event))

      const conferenceId = await createConference()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('created')
      expect(events[0].conferenceId).toBe(conferenceId)
      expect(events[0].state).toBe(ConferenceState.Active)
    })
  })

  // ============================================================================
  // joinConference() method
  // ============================================================================

  describe('joinConference() method', () => {
    it('should join conference successfully', async () => {
      const { joinConference, conference, state, isActive } = useConference(sipClientRef)

      await joinConference('sip:conference@example.com')

      expect(conference.value).toBeTruthy()
      expect(conference.value?.uri).toBe('sip:conference@example.com')
      expect(state.value).toBe(ConferenceState.Active)
      expect(isActive.value).toBe(true)
      expect(mockSipClient.joinConference).toHaveBeenCalledWith('sip:conference@example.com', {})
    })

    it('should join conference with options', async () => {
      const { joinConference } = useConference(sipClientRef)

      const options: ConferenceOptions = { maxParticipants: 20 }
      await joinConference('sip:conference@example.com', options)

      expect(mockSipClient.joinConference).toHaveBeenCalledWith(
        'sip:conference@example.com',
        options
      )
    })

    it('should throw error if SIP client not initialized', async () => {
      const nullClientRef = ref<SipClient | null>(null)
      const { joinConference } = useConference(nullClientRef)

      await expect(joinConference('sip:conference@example.com')).rejects.toThrow(
        'SIP client not initialized'
      )
    })

    it('should handle joinConference failure', async () => {
      mockSipClient.joinConference.mockRejectedValueOnce(new Error('Conference not found'))
      const { joinConference, state } = useConference(sipClientRef)

      await expect(joinConference('sip:conference@example.com')).rejects.toThrow(
        'Conference not found'
      )
      expect(state.value).toBe(ConferenceState.Failed)
    })
  })

  // ============================================================================
  // addParticipant() method
  // ============================================================================

  describe('addParticipant() method', () => {
    it('should add participant successfully', async () => {
      const { createConference, addParticipant, participants, participantCount } =
        useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')

      expect(participantId).toBeTruthy()
      expect(participantCount.value).toBe(2) // Local + Alice
      expect(participants.value[1].uri).toBe('sip:alice@example.com')
      expect(participants.value[1].displayName).toBe('Alice')
      expect(participants.value[1].state).toBe(ParticipantState.Connected)
      expect(participants.value[1].isModerator).toBe(false)
      expect(participants.value[1].isSelf).toBe(false)
    })

    it('should throw error if no active conference', async () => {
      const { addParticipant } = useConference(sipClientRef)

      await expect(addParticipant('sip:alice@example.com')).rejects.toThrow('No active conference')
    })

    it('should throw error if conference is locked', async () => {
      const { createConference, addParticipant } = useConference(sipClientRef)

      await createConference({ locked: true })

      await expect(addParticipant('sip:alice@example.com')).rejects.toThrow('Conference is locked')
    })

    it('should throw error if conference is full', async () => {
      const { createConference, addParticipant } = useConference(sipClientRef)

      await createConference({ maxParticipants: 1 }) // Only local participant

      await expect(addParticipant('sip:alice@example.com')).rejects.toThrow('Conference is full')
    })

    it('should emit participant:joined event', async () => {
      const { createConference, addParticipant, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'participant:joined') events.push(event)
      })

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('participant:joined')
      expect(events[0].participant.id).toBe(participantId)
      expect(events[0].participant.uri).toBe('sip:alice@example.com')
    })

    it('should call inviteToConference on SIP client', async () => {
      const { createConference, addParticipant, conference } = useConference(sipClientRef)

      await createConference()
      await addParticipant('sip:alice@example.com')

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(mockSipClient.inviteToConference).toHaveBeenCalledWith(
        conference.value!.id,
        'sip:alice@example.com'
      )
    })

    it('should allow adding same participant multiple times with different IDs', async () => {
      const { createConference, addParticipant, participantCount, participants } =
        useConference(sipClientRef)

      await createConference()
      const firstId = await addParticipant('sip:alice@example.com', 'Alice')
      const secondId = await addParticipant('sip:alice@example.com', 'Alice')

      expect(firstId).not.toBe(secondId)
      expect(participantCount.value).toBe(3) // Local + Alice + Alice
      expect(participants.value.filter((p) => p.uri === 'sip:alice@example.com')).toHaveLength(2)
    })

    it('should set joinedAt timestamp for new participants', async () => {
      const { createConference, addParticipant, participants } = useConference(sipClientRef)

      const beforeTime = new Date()
      await createConference()
      await addParticipant('sip:alice@example.com')
      const afterTime = new Date()

      const alice = participants.value.find((p) => p.uri === 'sip:alice@example.com')
      expect(alice?.joinedAt).toBeInstanceOf(Date)
      expect(alice!.joinedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(alice!.joinedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })
  })

  // ============================================================================
  // removeParticipant() method
  // ============================================================================

  describe('removeParticipant() method', () => {
    it('should remove participant successfully', async () => {
      const { createConference, addParticipant, removeParticipant, participantCount } =
        useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')

      expect(participantCount.value).toBe(2)

      await removeParticipant(participantId)

      expect(participantCount.value).toBe(1) // Only local participant
    })

    it('should throw error if no active conference', async () => {
      const { removeParticipant } = useConference(sipClientRef)

      await expect(removeParticipant('part-123')).rejects.toThrow('No active conference')
    })

    it('should throw error if participant not found', async () => {
      const { createConference, removeParticipant } = useConference(sipClientRef)

      await createConference()

      await expect(removeParticipant('nonexistent')).rejects.toThrow(
        'Participant nonexistent not found'
      )
    })

    it('should throw error when trying to remove self', async () => {
      const { createConference, removeParticipant, localParticipant } = useConference(sipClientRef)

      await createConference()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(removeParticipant(localParticipant.value!.id)).rejects.toThrow(
        'Cannot remove yourself, use endConference() instead'
      )
    })

    it('should emit participant:left event', async () => {
      const { createConference, addParticipant, removeParticipant, onConferenceEvent } =
        useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'participant:left') events.push(event)
      })

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')
      await removeParticipant(participantId, 'Kicked')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('participant:left')
      expect(events[0].participant.id).toBe(participantId)
      expect(events[0].reason).toBe('Kicked')
    })

    it('should call removeFromConference on SIP client', async () => {
      const { createConference, addParticipant, removeParticipant, conference } =
        useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')
      await removeParticipant(participantId)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(mockSipClient.removeFromConference).toHaveBeenCalledWith(
        conference.value!.id,
        'sip:alice@example.com'
      )
    })
  })

  // ============================================================================
  // muteParticipant() and unmuteParticipant() methods
  // ============================================================================

  describe('muteParticipant() method', () => {
    it('should mute remote participant', async () => {
      const { createConference, addParticipant, muteParticipant, participants } =
        useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')
      await muteParticipant(participantId)

      const participant = participants.value.find((p) => p.id === participantId)
      expect(participant?.isMuted).toBe(true)
      expect(mockSipClient.muteParticipant).toHaveBeenCalled()
    })

    it('should mute self using muteAudio', async () => {
      const { createConference, muteParticipant, localParticipant } = useConference(sipClientRef)

      await createConference()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await muteParticipant(localParticipant.value!.id)

      expect(localParticipant.value?.isMuted).toBe(true)
      expect(mockSipClient.muteAudio).toHaveBeenCalled()
    })

    it('should throw error if no active conference', async () => {
      const { muteParticipant } = useConference(sipClientRef)

      await expect(muteParticipant('part-123')).rejects.toThrow('No active conference')
    })

    it('should throw error if participant not found', async () => {
      const { createConference, muteParticipant } = useConference(sipClientRef)

      await createConference()

      await expect(muteParticipant('nonexistent')).rejects.toThrow(
        'Participant nonexistent not found'
      )
    })

    it('should handle already muted participant gracefully', async () => {
      const { createConference, addParticipant, muteParticipant } = useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')
      await muteParticipant(participantId)

      mockSipClient.muteParticipant.mockClear()

      await muteParticipant(participantId) // Mute again

      expect(mockSipClient.muteParticipant).not.toHaveBeenCalled() // No SIP call
    })

    it('should emit participant:updated event', async () => {
      const { createConference, addParticipant, muteParticipant, onConferenceEvent } =
        useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'participant:updated') events.push(event)
      })

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')
      await muteParticipant(participantId)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('participant:updated')
      expect(events[0].changes).toStrictEqual({ isMuted: true })
    })
  })

  describe('unmuteParticipant() method', () => {
    it('should unmute remote participant', async () => {
      const { createConference, addParticipant, muteParticipant, unmuteParticipant, participants } =
        useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')
      await muteParticipant(participantId)
      await unmuteParticipant(participantId)

      const participant = participants.value.find((p) => p.id === participantId)
      expect(participant?.isMuted).toBe(false)
      expect(mockSipClient.unmuteParticipant).toHaveBeenCalled()
    })

    it('should unmute self using unmuteAudio', async () => {
      const { createConference, muteParticipant, unmuteParticipant, localParticipant } =
        useConference(sipClientRef)

      await createConference()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await muteParticipant(localParticipant.value!.id)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await unmuteParticipant(localParticipant.value!.id)

      expect(localParticipant.value?.isMuted).toBe(false)
      expect(mockSipClient.unmuteAudio).toHaveBeenCalled()
    })

    it('should handle already unmuted participant gracefully', async () => {
      const { createConference, addParticipant, unmuteParticipant } = useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com')

      await unmuteParticipant(participantId) // Unmute when already unmuted

      expect(mockSipClient.unmuteParticipant).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // endConference() method
  // ============================================================================

  describe('endConference() method', () => {
    it('should end conference successfully', async () => {
      const { createConference, endConference, state } = useConference(sipClientRef)

      const conferenceId = await createConference()
      await endConference()

      expect(state.value).toBe(ConferenceState.Ended)
      expect(mockSipClient.endConference).toHaveBeenCalledWith(conferenceId)
    })

    it('should throw error if no active conference', async () => {
      const { endConference } = useConference(sipClientRef)

      await expect(endConference()).rejects.toThrow('No active conference')
    })

    it('should clear conference after delay', async () => {
      const { createConference, endConference, conference } = useConference(sipClientRef)

      await createConference()
      await endConference()

      expect(conference.value).not.toBeNull()

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.STATE_TRANSITION_DELAY)

      expect(conference.value).toBeNull()
    })

    it('should emit state:changed events', async () => {
      const { createConference, endConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'state:changed') events.push(event)
      })

      await createConference()
      await endConference()

      // Expect events: Ending -> Ended
      const endingEvents = events.filter((e) => e.state === ConferenceState.Ending)
      const endedEvents = events.filter((e) => e.state === ConferenceState.Ended)

      expect(endingEvents).toHaveLength(1)
      expect(endedEvents).toHaveLength(1)
    })

    it('should set startedAt timestamp on conference creation', async () => {
      const { createConference, conference } = useConference(sipClientRef)

      const beforeTime = new Date()
      await createConference()
      const afterTime = new Date()

      expect(conference.value?.startedAt).toBeInstanceOf(Date)
      expect(conference.value!.startedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(conference.value!.startedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })

    it('should set endedAt timestamp on conference end', async () => {
      const { createConference, endConference, conference } = useConference(sipClientRef)

      await createConference()
      expect(conference.value?.endedAt).toBeUndefined()

      const beforeEnd = new Date()
      await endConference()
      const afterEnd = new Date()

      expect(conference.value?.endedAt).toBeInstanceOf(Date)
      expect(conference.value!.endedAt!.getTime()).toBeGreaterThanOrEqual(beforeEnd.getTime())
      expect(conference.value!.endedAt!.getTime()).toBeLessThanOrEqual(afterEnd.getTime())
    })
  })

  // ============================================================================
  // lockConference() and unlockConference() methods
  // ============================================================================

  describe('lockConference() method', () => {
    it('should lock conference', async () => {
      const { createConference, lockConference, isLocked } = useConference(sipClientRef)

      await createConference()
      await lockConference()

      expect(isLocked.value).toBe(true)
    })

    it('should throw error if no active conference', async () => {
      const { lockConference } = useConference(sipClientRef)

      await expect(lockConference()).rejects.toThrow('No active conference')
    })

    it('should handle already locked conference gracefully', async () => {
      const { createConference, lockConference, isLocked } = useConference(sipClientRef)

      await createConference({ locked: true })
      expect(isLocked.value).toBe(true)

      await lockConference() // Lock again

      expect(isLocked.value).toBe(true)
    })

    it('should emit locked event', async () => {
      const { createConference, lockConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'locked') events.push(event)
      })

      await createConference()
      await lockConference()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('locked')
    })
  })

  describe('unlockConference() method', () => {
    it('should unlock conference', async () => {
      const { createConference, unlockConference, isLocked } = useConference(sipClientRef)

      await createConference({ locked: true })
      await unlockConference()

      expect(isLocked.value).toBe(false)
    })

    it('should throw error if no active conference', async () => {
      const { unlockConference } = useConference(sipClientRef)

      await expect(unlockConference()).rejects.toThrow('No active conference')
    })

    it('should handle already unlocked conference gracefully', async () => {
      const { createConference, unlockConference, isLocked } = useConference(sipClientRef)

      await createConference()
      expect(isLocked.value).toBe(false)

      await unlockConference() // Unlock again

      expect(isLocked.value).toBe(false)
    })

    it('should emit unlocked event', async () => {
      const { createConference, unlockConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'unlocked') events.push(event)
      })

      await createConference({ locked: true })
      await unlockConference()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('unlocked')
    })
  })

  // ============================================================================
  // startRecording() and stopRecording() methods
  // ============================================================================

  describe('startRecording() method', () => {
    it('should start recording', async () => {
      const { createConference, startRecording, isRecording, conference } =
        useConference(sipClientRef)

      await createConference()
      await startRecording()

      expect(isRecording.value).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(mockSipClient.startConferenceRecording).toHaveBeenCalledWith(conference.value!.id)
    })

    it('should throw error if no active conference', async () => {
      const { startRecording } = useConference(sipClientRef)

      await expect(startRecording()).rejects.toThrow('No active conference')
    })

    it('should handle already recording gracefully', async () => {
      const { createConference, startRecording } = useConference(sipClientRef)

      await createConference()
      await startRecording()

      mockSipClient.startConferenceRecording.mockClear()

      await startRecording() // Start again

      expect(mockSipClient.startConferenceRecording).not.toHaveBeenCalled()
    })

    it('should emit recording:started event', async () => {
      const { createConference, startRecording, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'recording:started') events.push(event)
      })

      await createConference()
      await startRecording()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('recording:started')
    })
  })

  describe('stopRecording() method', () => {
    it('should stop recording', async () => {
      const { createConference, startRecording, stopRecording, isRecording, conference } =
        useConference(sipClientRef)

      await createConference()
      await startRecording()
      await stopRecording()

      expect(isRecording.value).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(mockSipClient.stopConferenceRecording).toHaveBeenCalledWith(conference.value!.id)
    })

    it('should throw error if no active conference', async () => {
      const { stopRecording } = useConference(sipClientRef)

      await expect(stopRecording()).rejects.toThrow('No active conference')
    })

    it('should handle not recording gracefully', async () => {
      const { createConference, stopRecording } = useConference(sipClientRef)

      await createConference()

      await stopRecording() // Stop when not recording

      expect(mockSipClient.stopConferenceRecording).not.toHaveBeenCalled()
    })

    it('should emit recording:stopped event', async () => {
      const { createConference, startRecording, stopRecording, onConferenceEvent } =
        useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'recording:stopped') events.push(event)
      })

      await createConference()
      await startRecording()
      await stopRecording()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('recording:stopped')
    })
  })

  // ============================================================================
  // getParticipant() method
  // ============================================================================

  describe('getParticipant() method', () => {
    it('should get participant by ID', async () => {
      const { createConference, addParticipant, getParticipant } = useConference(sipClientRef)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')

      const participant = getParticipant(participantId)

      expect(participant).toBeTruthy()
      expect(participant?.id).toBe(participantId)
      expect(participant?.uri).toBe('sip:alice@example.com')
    })

    it('should return null for nonexistent participant', async () => {
      const { createConference, getParticipant } = useConference(sipClientRef)

      await createConference()

      const participant = getParticipant('nonexistent')

      expect(participant).toBeNull()
    })

    it('should return null when no conference', () => {
      const { getParticipant } = useConference(sipClientRef)

      const participant = getParticipant('any-id')

      expect(participant).toBeNull()
    })
  })

  // ============================================================================
  // onConferenceEvent() method
  // ============================================================================

  describe('onConferenceEvent() method', () => {
    it('should register event listener', async () => {
      const { createConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => events.push(event))

      await createConference()

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe('created')
    })

    it('should return unsubscribe function', async () => {
      const { createConference, lockConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      const unsubscribe = onConferenceEvent((event) => events.push(event))

      await createConference()
      const beforeUnsubscribe = events.length

      unsubscribe()

      await lockConference()

      expect(events).toHaveLength(beforeUnsubscribe) // No new events after unsubscribe
    })

    it('should handle multiple listeners', async () => {
      const { createConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events1: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events2: any[] = []

      onConferenceEvent((event) => events1.push(event))
      onConferenceEvent((event) => events2.push(event))

      await createConference()

      expect(events1).toHaveLength(events2.length)
      expect(events1[0]).toStrictEqual(events2[0])
    })

    it('should handle listener errors gracefully', async () => {
      const { createConference, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent(() => {
        throw new Error('Listener error')
      })
      onConferenceEvent((event) => events.push(event))

      await createConference()

      expect(events).toHaveLength(1) // Second listener still works
    })
  })

  // ============================================================================
  // Audio Level Monitoring
  // ============================================================================

  describe('Audio Level Monitoring', () => {
    it('should start audio level monitoring on conference creation', async () => {
      const { createConference } = useConference(sipClientRef)

      await createConference()

      // Audio monitoring starts with interval
      expect(mockSipClient.getConferenceAudioLevels).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      expect(mockSipClient.getConferenceAudioLevels).toHaveBeenCalled()
    })

    it('should update participant audio levels', async () => {
      const { createConference, addParticipant, participants } = useConference(sipClientRef)

      await createConference()
      await addParticipant('sip:alice@example.com', 'Alice')

      const audioLevels = new Map([['sip:alice@example.com', 0.75]])
      mockSipClient.getConferenceAudioLevels.mockReturnValue(audioLevels)

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      const alice = participants.value.find((p) => p.uri === 'sip:alice@example.com')
      expect(alice?.audioLevel).toBe(0.75)
    })

    it('should emit audio:level events', async () => {
      const { createConference, addParticipant, onConferenceEvent } = useConference(sipClientRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      onConferenceEvent((event) => {
        if (event.type === 'audio:level') events.push(event)
      })

      await createConference()
      await addParticipant('sip:alice@example.com')

      const audioLevels = new Map([['sip:alice@example.com', 0.5]])
      mockSipClient.getConferenceAudioLevels.mockReturnValue(audioLevels)

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('audio:level')
      expect(events[0].levels).toStrictEqual(audioLevels)
    })

    it('should stop audio level monitoring on endConference', async () => {
      const { createConference, endConference } = useConference(sipClientRef)

      await createConference()
      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      expect(mockSipClient.getConferenceAudioLevels).toHaveBeenCalledTimes(1)

      await endConference()
      mockSipClient.getConferenceAudioLevels.mockClear()

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL * 10)

      expect(mockSipClient.getConferenceAudioLevels).not.toHaveBeenCalled()
    })

    it('should handle missing getConferenceAudioLevels method gracefully', async () => {
      // Remove the method to simulate older SIP client
      delete mockSipClient.getConferenceAudioLevels

      const { createConference, participants } = useConference(ref(mockSipClient))

      await createConference()

      // Should not throw when advancing time
      await expect(
        vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)
      ).resolves.not.toThrow()

      // Participants should exist without audio levels
      expect(participants.value).toHaveLength(1)
    })

    it('should handle null audio levels gracefully', async () => {
      mockSipClient.getConferenceAudioLevels.mockReturnValue(null)

      const { createConference, addParticipant, participants } = useConference(sipClientRef)

      await createConference()
      await addParticipant('sip:alice@example.com')

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      // Participants should not have audio levels
      const alice = participants.value.find((p) => p.uri === 'sip:alice@example.com')
      expect(alice?.audioLevel).toBeUndefined()
    })
  })

  // ============================================================================
  // Computed Properties
  // ============================================================================

  describe('Computed Properties', () => {
    it('should compute state correctly', async () => {
      const { createConference, endConference, state } = useConference(sipClientRef)

      expect(state.value).toBe(ConferenceState.Idle)

      await createConference()
      expect(state.value).toBe(ConferenceState.Active)

      await endConference()
      expect(state.value).toBe(ConferenceState.Ended)
    })

    it('should compute participants array from Map', async () => {
      const { createConference, addParticipant, participants } = useConference(sipClientRef)

      await createConference()
      expect(participants.value).toHaveLength(1)

      await addParticipant('sip:alice@example.com')
      expect(participants.value).toHaveLength(2)

      await addParticipant('sip:bob@example.com')
      expect(participants.value).toHaveLength(3)
    })

    it('should compute participantCount correctly', async () => {
      const { createConference, addParticipant, participantCount } = useConference(sipClientRef)

      expect(participantCount.value).toBe(0)

      await createConference()
      expect(participantCount.value).toBe(1)

      await addParticipant('sip:alice@example.com')
      expect(participantCount.value).toBe(2)
    })

    it('should compute isActive correctly', async () => {
      const { createConference, endConference, isActive } = useConference(sipClientRef)

      expect(isActive.value).toBe(false)

      await createConference()
      expect(isActive.value).toBe(true)

      await endConference()
      expect(isActive.value).toBe(false)
    })

    it('should compute isLocked correctly', async () => {
      const { createConference, lockConference, unlockConference, isLocked } =
        useConference(sipClientRef)

      expect(isLocked.value).toBe(false)

      await createConference()
      expect(isLocked.value).toBe(false)

      await lockConference()
      expect(isLocked.value).toBe(true)

      await unlockConference()
      expect(isLocked.value).toBe(false)
    })

    it('should compute isRecording correctly', async () => {
      const { createConference, startRecording, stopRecording, isRecording } =
        useConference(sipClientRef)

      expect(isRecording.value).toBe(false)

      await createConference()
      expect(isRecording.value).toBe(false)

      await startRecording()
      expect(isRecording.value).toBe(true)

      await stopRecording()
      expect(isRecording.value).toBe(false)
    })
  })
})
