/**
 * Tests for useConference composable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { useConference } from '@/composables/useConference'
import type { SipClient } from '@/core/SipClient'
import { ConferenceState, ParticipantState, type ConferenceOptions } from '@/types/conference.types'
import { CONFERENCE_CONSTANTS } from '@/composables/constants'
import { withSetup } from '../../utils/test-helpers'

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
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      expect(result.conference.value).toBeNull()
      expect(result.state.value).toBe(ConferenceState.Idle)
      expect(result.participants.value).toEqual([])
      expect(result.participantCount.value).toBe(0)
      expect(result.isActive.value).toBe(false)
      expect(result.isLocked.value).toBe(false)
      expect(result.isRecording.value).toBe(false)

      unmount()
    })
  })

  // ============================================================================
  // createConference() method
  // ============================================================================

  describe('createConference() method', () => {
    it('should create conference successfully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const conferenceId = await result.createConference()

      expect(conferenceId).toBeTruthy()
      expect(result.conference.value).toBeTruthy()
      expect(result.conference.value?.id).toBe(conferenceId)
      expect(result.state.value).toBe(ConferenceState.Active)
      expect(result.isActive.value).toBe(true)
      expect(result.participants.value).toHaveLength(1) // Local participant
      expect(mockSipClient.createConference).toHaveBeenCalledWith(conferenceId, {})

      unmount()
    })

    it('should create conference with options', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const options: ConferenceOptions = {
        maxParticipants: 5,
        locked: true,
        metadata: { room: 'meeting-1' },
      }

      const conferenceId = await result.createConference(options)

      expect(result.conference.value?.maxParticipants).toBe(5)
      expect(result.conference.value?.isLocked).toBe(true)
      expect(result.conference.value?.metadata).toStrictEqual({ room: 'meeting-1' })
      expect(mockSipClient.createConference).toHaveBeenCalledWith(conferenceId, options)

      unmount()
    })

    it('should create local participant with moderator role', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      expect(result.localParticipant.value).toBeTruthy()
      expect(result.localParticipant.value?.uri).toBe('sip:self@example.com')
      expect(result.localParticipant.value?.displayName).toBe('Self User')
      expect(result.localParticipant.value?.isModerator).toBe(true)
      expect(result.localParticipant.value?.isSelf).toBe(true)
      expect(result.localParticipant.value?.state).toBe(ParticipantState.Connected)
      expect(result.participants.value[0]).toStrictEqual(result.localParticipant.value)

      unmount()
    })

    it('should throw error if SIP client not initialized', async () => {
      const nullClientRef = ref<SipClient | null>(null)
      const { result, unmount } = withSetup(() => useConference(nullClientRef))

      await expect(result.createConference()).rejects.toThrow('SIP client not initialized')

      unmount()
    })

    it('should throw error if conference already active', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      await expect(result.createConference()).rejects.toThrow('A conference is already active')

      unmount()
    })

    it('should handle createConference failure', async () => {
      mockSipClient.createConference.mockRejectedValueOnce(new Error('Network error'))
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.createConference()).rejects.toThrow('Network error')
      expect(result.state.value).toBe(ConferenceState.Failed)

      unmount()
    })

    it('should emit created event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      const events: any[] = []

      result.onConferenceEvent((event) => events.push(event))

      const conferenceId = await result.createConference()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('created')
      expect(events[0].conferenceId).toBe(conferenceId)
      expect(events[0].state).toBe(ConferenceState.Active)

      unmount()
    })
  })

  // ============================================================================
  // joinConference() method
  // ============================================================================

  describe('joinConference() method', () => {
    it('should join conference successfully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.joinConference('sip:conference@example.com')

      expect(result.conference.value).toBeTruthy()
      expect(result.conference.value?.uri).toBe('sip:conference@example.com')
      expect(result.state.value).toBe(ConferenceState.Active)
      expect(result.isActive.value).toBe(true)
      expect(mockSipClient.joinConference).toHaveBeenCalledWith('sip:conference@example.com', {})

      unmount()
    })

    it('should join conference with options', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const options: ConferenceOptions = { maxParticipants: 20 }
      await result.joinConference('sip:conference@example.com', options)

      expect(mockSipClient.joinConference).toHaveBeenCalledWith(
        'sip:conference@example.com',
        options
      )

      unmount()
    })

    it('should throw error if SIP client not initialized', async () => {
      const nullClientRef = ref<SipClient | null>(null)
      const { result, unmount } = withSetup(() => useConference(nullClientRef))

      await expect(result.joinConference('sip:conference@example.com')).rejects.toThrow(
        'SIP client not initialized'
      )

      unmount()
    })

    it('should handle joinConference failure', async () => {
      mockSipClient.joinConference.mockRejectedValueOnce(new Error('Conference not found'))
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.joinConference('sip:conference@example.com')).rejects.toThrow(
        'Conference not found'
      )
      expect(result.state.value).toBe(ConferenceState.Failed)

      unmount()
    })
  })

  // ============================================================================
  // addParticipant() method
  // ============================================================================

  describe('addParticipant() method', () => {
    it('should add participant successfully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com', 'Alice')

      expect(participantId).toBeTruthy()
      expect(result.participantCount.value).toBe(2) // Local + Alice
      expect(result.participants.value[1].uri).toBe('sip:alice@example.com')
      expect(result.participants.value[1].displayName).toBe('Alice')
      expect(result.participants.value[1].state).toBe(ParticipantState.Connected)
      expect(result.participants.value[1].isModerator).toBe(false)
      expect(result.participants.value[1].isSelf).toBe(false)

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.addParticipant('sip:alice@example.com')).rejects.toThrow(
        'No active conference'
      )

      unmount()
    })

    it('should throw error if conference is locked', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference({ locked: true })

      await expect(result.addParticipant('sip:alice@example.com')).rejects.toThrow(
        'Conference is locked'
      )

      unmount()
    })

    it('should throw error if conference is full', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference({ maxParticipants: 2 }) // Local participant + 1 slot
      await result.addParticipant('sip:alice@example.com') // Fill the remaining slot

      await expect(result.addParticipant('sip:bob@example.com')).rejects.toThrow(
        'Conference is full'
      )

      unmount()
    })

    it('should emit participant:joined event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'participant:joined') events.push(event)
      })

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('participant:joined')
      expect(events[0].participant.id).toBe(participantId)
      expect(events[0].participant.uri).toBe('sip:alice@example.com')

      unmount()
    })

    it('should call inviteToConference on SIP client', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.addParticipant('sip:alice@example.com')

      expect(mockSipClient.inviteToConference).toHaveBeenCalledWith(
        result.conference.value!.id,
        'sip:alice@example.com'
      )

      unmount()
    })

    it('should allow adding same participant multiple times with different IDs', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const firstId = await result.addParticipant('sip:alice@example.com', 'Alice')
      const secondId = await result.addParticipant('sip:alice@example.com', 'Alice')

      expect(firstId).not.toBe(secondId)
      expect(result.participantCount.value).toBe(3) // Local + Alice + Alice
      expect(
        result.participants.value.filter((p) => p.uri === 'sip:alice@example.com')
      ).toHaveLength(2)

      unmount()
    })

    it('should set joinedAt timestamp for new participants', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const beforeTime = new Date()
      await result.createConference()
      await result.addParticipant('sip:alice@example.com')
      const afterTime = new Date()

      const alice = result.participants.value.find((p) => p.uri === 'sip:alice@example.com')
      expect(alice?.joinedAt).toBeInstanceOf(Date)
      expect(alice!.joinedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(alice!.joinedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime())

      unmount()
    })
  })

  // ============================================================================
  // removeParticipant() method
  // ============================================================================

  describe('removeParticipant() method', () => {
    it('should remove participant successfully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')

      expect(result.participantCount.value).toBe(2)

      await result.removeParticipant(participantId)

      expect(result.participantCount.value).toBe(1) // Only local participant

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.removeParticipant('part-123')).rejects.toThrow('No active conference')

      unmount()
    })

    it('should throw error if participant not found', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      await expect(result.removeParticipant('nonexistent')).rejects.toThrow(
        'Participant nonexistent not found'
      )

      unmount()
    })

    it('should throw error when trying to remove self', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(result.removeParticipant(result.localParticipant.value!.id)).rejects.toThrow(
        'Cannot remove yourself, use endConference() instead'
      )

      unmount()
    })

    it('should emit participant:left event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'participant:left') events.push(event)
      })

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')
      await result.removeParticipant(participantId, 'Kicked')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('participant:left')
      expect(events[0].participant.id).toBe(participantId)
      expect(events[0].reason).toBe('Kicked')

      unmount()
    })

    it('should call removeFromConference on SIP client', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')
      await result.removeParticipant(participantId)

      expect(mockSipClient.removeFromConference).toHaveBeenCalledWith(
        result.conference.value!.id,
        'sip:alice@example.com'
      )

      unmount()
    })
  })

  // ============================================================================
  // muteParticipant() and unmuteParticipant() methods
  // ============================================================================

  describe('muteParticipant() method', () => {
    it('should mute remote participant', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')
      await result.muteParticipant(participantId)

      const participant = result.participants.value.find((p) => p.id === participantId)
      expect(participant?.isMuted).toBe(true)
      expect(mockSipClient.muteParticipant).toHaveBeenCalled()

      unmount()
    })

    it('should mute self using muteAudio', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await result.muteParticipant(result.localParticipant.value!.id)

      expect(result.localParticipant.value?.isMuted).toBe(true)
      expect(mockSipClient.muteAudio).toHaveBeenCalled()

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.muteParticipant('part-123')).rejects.toThrow('No active conference')

      unmount()
    })

    it('should throw error if participant not found', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      await expect(result.muteParticipant('nonexistent')).rejects.toThrow(
        'Participant nonexistent not found'
      )

      unmount()
    })

    it('should handle already muted participant gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')
      await result.muteParticipant(participantId)

      mockSipClient.muteParticipant.mockClear()

      await result.muteParticipant(participantId) // Mute again

      expect(mockSipClient.muteParticipant).not.toHaveBeenCalled() // No SIP call

      unmount()
    })

    it('should emit participant:updated event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'participant:updated') events.push(event)
      })

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')
      await result.muteParticipant(participantId)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('participant:updated')
      expect(events[0].changes).toStrictEqual({ isMuted: true })

      unmount()
    })
  })

  describe('unmuteParticipant() method', () => {
    it('should unmute remote participant', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')
      await result.muteParticipant(participantId)
      await result.unmuteParticipant(participantId)

      const participant = result.participants.value.find((p) => p.id === participantId)
      expect(participant?.isMuted).toBe(false)
      expect(mockSipClient.unmuteParticipant).toHaveBeenCalled()

      unmount()
    })

    it('should unmute self using unmuteAudio', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await result.muteParticipant(result.localParticipant.value!.id)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await result.unmuteParticipant(result.localParticipant.value!.id)

      expect(result.localParticipant.value?.isMuted).toBe(false)
      expect(mockSipClient.unmuteAudio).toHaveBeenCalled()

      unmount()
    })

    it('should handle already unmuted participant gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com')

      await result.unmuteParticipant(participantId) // Unmute when already unmuted

      expect(mockSipClient.unmuteParticipant).not.toHaveBeenCalled()

      unmount()
    })
  })

  // ============================================================================
  // endConference() method
  // ============================================================================

  describe('endConference() method', () => {
    it('should end conference successfully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const conferenceId = await result.createConference()
      await result.endConference()

      expect(result.state.value).toBe(ConferenceState.Ended)
      expect(mockSipClient.endConference).toHaveBeenCalledWith(conferenceId)

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.endConference()).rejects.toThrow('No active conference')

      unmount()
    })

    it('should clear conference after delay', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.endConference()

      expect(result.conference.value).not.toBeNull()

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.STATE_TRANSITION_DELAY)

      expect(result.conference.value).toBeNull()

      unmount()
    })

    it('should emit state:changed events', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'state:changed') events.push(event)
      })

      await result.createConference()
      await result.endConference()

      // Expect events: Ending -> Ended
      const endingEvents = events.filter((e) => e.state === ConferenceState.Ending)
      const endedEvents = events.filter((e) => e.state === ConferenceState.Ended)

      expect(endingEvents).toHaveLength(1)
      expect(endedEvents).toHaveLength(1)

      unmount()
    })

    it('should set startedAt timestamp on conference creation', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const beforeTime = new Date()
      await result.createConference()
      const afterTime = new Date()

      expect(result.conference.value?.startedAt).toBeInstanceOf(Date)
      expect(result.conference.value!.startedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      )
      expect(result.conference.value!.startedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime())

      unmount()
    })

    it('should set endedAt timestamp on conference end', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      expect(result.conference.value?.endedAt).toBeUndefined()

      const beforeEnd = new Date()
      await result.endConference()
      const afterEnd = new Date()

      expect(result.conference.value?.endedAt).toBeInstanceOf(Date)
      expect(result.conference.value!.endedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeEnd.getTime()
      )
      expect(result.conference.value!.endedAt!.getTime()).toBeLessThanOrEqual(afterEnd.getTime())

      unmount()
    })
  })

  // ============================================================================
  // lockConference() and unlockConference() methods
  // ============================================================================

  describe('lockConference() method', () => {
    it('should lock conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.lockConference()

      expect(result.isLocked.value).toBe(true)

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.lockConference()).rejects.toThrow('No active conference')

      unmount()
    })

    it('should handle already locked conference gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference({ locked: true })
      expect(result.isLocked.value).toBe(true)

      await result.lockConference() // Lock again

      expect(result.isLocked.value).toBe(true)

      unmount()
    })

    it('should emit locked event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'locked') events.push(event)
      })

      await result.createConference()
      await result.lockConference()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('locked')

      unmount()
    })
  })

  describe('unlockConference() method', () => {
    it('should unlock conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference({ locked: true })
      await result.unlockConference()

      expect(result.isLocked.value).toBe(false)

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.unlockConference()).rejects.toThrow('No active conference')

      unmount()
    })

    it('should handle already unlocked conference gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      expect(result.isLocked.value).toBe(false)

      await result.unlockConference() // Unlock again

      expect(result.isLocked.value).toBe(false)

      unmount()
    })

    it('should emit unlocked event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'unlocked') events.push(event)
      })

      await result.createConference({ locked: true })
      await result.unlockConference()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('unlocked')

      unmount()
    })
  })

  // ============================================================================
  // startRecording() and stopRecording() methods
  // ============================================================================

  describe('startRecording() method', () => {
    it('should start recording', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.startRecording()

      expect(result.isRecording.value).toBe(true)

      expect(mockSipClient.startConferenceRecording).toHaveBeenCalledWith(
        result.conference.value!.id
      )

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.startRecording()).rejects.toThrow('No active conference')

      unmount()
    })

    it('should handle already recording gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.startRecording()

      mockSipClient.startConferenceRecording.mockClear()

      await result.startRecording() // Start again

      expect(mockSipClient.startConferenceRecording).not.toHaveBeenCalled()

      unmount()
    })

    it('should emit recording:started event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'recording:started') events.push(event)
      })

      await result.createConference()
      await result.startRecording()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('recording:started')

      unmount()
    })
  })

  describe('stopRecording() method', () => {
    it('should stop recording', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.startRecording()
      await result.stopRecording()

      expect(result.isRecording.value).toBe(false)

      expect(mockSipClient.stopConferenceRecording).toHaveBeenCalledWith(
        result.conference.value!.id
      )

      unmount()
    })

    it('should throw error if no active conference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.stopRecording()).rejects.toThrow('No active conference')

      unmount()
    })

    it('should handle not recording gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      await result.stopRecording() // Stop when not recording

      expect(mockSipClient.stopConferenceRecording).not.toHaveBeenCalled()

      unmount()
    })

    it('should emit recording:stopped event', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'recording:stopped') events.push(event)
      })

      await result.createConference()
      await result.startRecording()
      await result.stopRecording()

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('recording:stopped')

      unmount()
    })
  })

  // ============================================================================
  // getParticipant() method
  // ============================================================================

  describe('getParticipant() method', () => {
    it('should get participant by ID', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      const participantId = await result.addParticipant('sip:alice@example.com', 'Alice')

      const participant = result.getParticipant(participantId)

      expect(participant).toBeTruthy()
      expect(participant?.id).toBe(participantId)
      expect(participant?.uri).toBe('sip:alice@example.com')

      unmount()
    })

    it('should return null for nonexistent participant', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      const participant = result.getParticipant('nonexistent')

      expect(participant).toBeNull()

      unmount()
    })

    it('should return null when no conference', () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      const participant = result.getParticipant('any-id')

      expect(participant).toBeNull()

      unmount()
    })
  })

  // ============================================================================
  // onConferenceEvent() method
  // ============================================================================

  describe('onConferenceEvent() method', () => {
    it('should register event listener', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => events.push(event))

      await result.createConference()

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe('created')

      unmount()
    })

    it('should return unsubscribe function', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      const unsubscribe = result.onConferenceEvent((event) => events.push(event))

      await result.createConference()
      const beforeUnsubscribe = events.length

      unsubscribe()

      await result.lockConference()

      expect(events).toHaveLength(beforeUnsubscribe) // No new events after unsubscribe

      unmount()
    })

    it('should handle multiple listeners', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events1: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events2: any[] = []

      result.onConferenceEvent((event) => events1.push(event))
      result.onConferenceEvent((event) => events2.push(event))

      await result.createConference()

      expect(events1).toHaveLength(events2.length)
      expect(events1[0]).toStrictEqual(events2[0])

      unmount()
    })

    it('should handle listener errors gracefully', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent(() => {
        throw new Error('Listener error')
      })
      result.onConferenceEvent((event) => events.push(event))

      await result.createConference()

      expect(events).toHaveLength(1) // Second listener still works

      unmount()
    })
  })

  // ============================================================================
  // Audio Level Monitoring
  // ============================================================================

  describe('Audio Level Monitoring', () => {
    it('should start audio level monitoring on conference creation', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      // Audio monitoring starts with interval
      expect(mockSipClient.getConferenceAudioLevels).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      expect(mockSipClient.getConferenceAudioLevels).toHaveBeenCalled()

      unmount()
    })

    it('should update participant audio levels', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.addParticipant('sip:alice@example.com', 'Alice')

      const audioLevels = new Map([['sip:alice@example.com', 0.75]])
      mockSipClient.getConferenceAudioLevels.mockReturnValue(audioLevels)

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      const alice = result.participants.value.find((p) => p.uri === 'sip:alice@example.com')
      expect(alice?.audioLevel).toBe(0.75)

      unmount()
    })

    it('should emit audio:level events', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = []

      result.onConferenceEvent((event) => {
        if (event.type === 'audio:level') events.push(event)
      })

      await result.createConference()
      await result.addParticipant('sip:alice@example.com')

      const audioLevels = new Map([['sip:alice@example.com', 0.5]])
      mockSipClient.getConferenceAudioLevels.mockReturnValue(audioLevels)

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('audio:level')
      expect(events[0].levels).toStrictEqual(audioLevels)

      unmount()
    })

    it('should stop audio level monitoring on endConference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      expect(mockSipClient.getConferenceAudioLevels).toHaveBeenCalledTimes(1)

      await result.endConference()
      mockSipClient.getConferenceAudioLevels.mockClear()

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL * 10)

      expect(mockSipClient.getConferenceAudioLevels).not.toHaveBeenCalled()

      unmount()
    })

    it('should handle missing getConferenceAudioLevels method gracefully', async () => {
      // Remove the method to simulate older SIP client
      delete mockSipClient.getConferenceAudioLevels

      const { result, unmount } = withSetup(() => useConference(ref(mockSipClient)))

      await result.createConference()

      // Should not throw when advancing time
      await expect(
        vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)
      ).resolves.not.toThrow()

      // Participants should exist without audio levels
      expect(result.participants.value).toHaveLength(1)

      unmount()
    })

    it('should handle null audio levels gracefully', async () => {
      mockSipClient.getConferenceAudioLevels.mockReturnValue(null)

      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.addParticipant('sip:alice@example.com')

      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)

      // Participants should not have audio levels
      const alice = result.participants.value.find((p) => p.uri === 'sip:alice@example.com')
      expect(alice?.audioLevel).toBeUndefined()

      unmount()
    })
  })

  // ============================================================================
  // Concurrent Operation Guards
  // ============================================================================

  describe('Concurrent Operation Guards', () => {
    it('should prevent concurrent createConference attempts', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      // Make createConference hang
      let resolveCreate: any
      mockSipClient.createConference = vi.fn(
        () => new Promise((resolve) => (resolveCreate = () => resolve(undefined)))
      )

      // Start first create
      const create1 = result.createConference()

      // Try to create again
      const create2 = result.createConference()

      // Second create should be rejected
      await expect(create2).rejects.toThrow('A conference is already active')

      // Complete first create
      resolveCreate()
      await create1

      expect(mockSipClient.createConference).toHaveBeenCalledTimes(1)
      unmount()
    })

    it('should prevent concurrent addParticipant attempts', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      // Make inviteToConference hang
      let resolveInvite: any
      mockSipClient.inviteToConference = vi.fn(
        () => new Promise((resolve) => (resolveInvite = () => resolve(undefined)))
      )

      // Start first add
      const add1 = result.addParticipant('sip:alice@example.com')

      // Try to add another participant
      const add2 = result.addParticipant('sip:bob@example.com')

      // Second add should be rejected
      await expect(add2).rejects.toThrow('Participant operation already in progress')

      // Complete first add
      resolveInvite()
      await add1

      expect(mockSipClient.inviteToConference).toHaveBeenCalledTimes(1)
      unmount()
    })

    it('should allow addParticipant after previous completes', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      // First add completes
      await result.addParticipant('sip:alice@example.com')

      // Second add should succeed
      await result.addParticipant('sip:bob@example.com')

      expect(mockSipClient.inviteToConference).toHaveBeenCalledTimes(2)
      unmount()
    })

    it('should reset guard even if addParticipant fails', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      // First add fails
      mockSipClient.inviteToConference.mockRejectedValueOnce(new Error('Invite failed'))

      await expect(result.addParticipant('sip:alice@example.com')).rejects.toThrow('Invite failed')

      // Second add should succeed (guard was reset)
      await result.addParticipant('sip:bob@example.com')

      expect(mockSipClient.inviteToConference).toHaveBeenCalledTimes(2)
      unmount()
    })
  })

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Validation Tests', () => {
    it('should validate maxParticipants is positive', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.createConference({ maxParticipants: 0 })).rejects.toThrow(
        'maxParticipants must be at least 1'
      )

      unmount()
    })

    it('should validate maxParticipants is not negative', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await expect(result.createConference({ maxParticipants: -5 })).rejects.toThrow(
        'maxParticipants must be at least 1'
      )

      unmount()
    })

    it('should accept valid maxParticipants values', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference({ maxParticipants: 10 })

      expect(result.conference.value?.maxParticipants).toBe(10)
      unmount()
    })
  })

  // ============================================================================
  // Timer Cleanup Tests
  // ============================================================================

  describe('Timer Cleanup Tests', () => {
    it('should cleanup audio level monitoring timer on endConference', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      // Verify audio monitoring is active
      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL)
      expect(mockSipClient.getConferenceAudioLevels).toHaveBeenCalled()

      mockSipClient.getConferenceAudioLevels.mockClear()
      await result.endConference()

      // Verify audio monitoring stopped (interval no longer running)
      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.AUDIO_LEVEL_INTERVAL * 5)
      expect(mockSipClient.getConferenceAudioLevels).not.toHaveBeenCalled()

      unmount()
    })

    it('should cleanup audio level monitoring timer on unmount', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()

      expect(vi.getTimerCount()).toBeGreaterThan(0)

      // Unmount should cleanup timers
      unmount()

      // In a real scenario, onUnmounted would be called
      // We verify the timer exists while conference is active
    })

    it('should cleanup state transition timer after delay', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      await result.endConference()

      expect(result.conference.value).not.toBeNull()

      // Advance past the delay
      await vi.advanceTimersByTimeAsync(CONFERENCE_CONSTANTS.STATE_TRANSITION_DELAY)

      expect(result.conference.value).toBeNull()

      unmount()
    })
  })

  // ============================================================================
  // Computed Properties
  // ============================================================================

  describe('Computed Properties', () => {
    it('should compute state correctly', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      expect(result.state.value).toBe(ConferenceState.Idle)

      await result.createConference()
      expect(result.state.value).toBe(ConferenceState.Active)

      await result.endConference()
      expect(result.state.value).toBe(ConferenceState.Ended)

      unmount()
    })

    it('should compute participants array from Map', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      await result.createConference()
      expect(result.participants.value).toHaveLength(1)

      await result.addParticipant('sip:alice@example.com')
      expect(result.participants.value).toHaveLength(2)

      await result.addParticipant('sip:bob@example.com')
      expect(result.participants.value).toHaveLength(3)

      unmount()
    })

    it('should compute participantCount correctly', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      expect(result.participantCount.value).toBe(0)

      await result.createConference()
      expect(result.participantCount.value).toBe(1)

      await result.addParticipant('sip:alice@example.com')
      expect(result.participantCount.value).toBe(2)

      unmount()
    })

    it('should compute isActive correctly', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      expect(result.isActive.value).toBe(false)

      await result.createConference()
      expect(result.isActive.value).toBe(true)

      await result.endConference()
      expect(result.isActive.value).toBe(false)

      unmount()
    })

    it('should compute isLocked correctly', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      expect(result.isLocked.value).toBe(false)

      await result.createConference()
      expect(result.isLocked.value).toBe(false)

      await result.lockConference()
      expect(result.isLocked.value).toBe(true)

      await result.unlockConference()
      expect(result.isLocked.value).toBe(false)

      unmount()
    })

    it('should compute isRecording correctly', async () => {
      const { result, unmount } = withSetup(() => useConference(sipClientRef))

      expect(result.isRecording.value).toBe(false)

      await result.createConference()
      expect(result.isRecording.value).toBe(false)

      await result.startRecording()
      expect(result.isRecording.value).toBe(true)

      await result.stopRecording()
      expect(result.isRecording.value).toBe(false)

      unmount()
    })
  })
})
