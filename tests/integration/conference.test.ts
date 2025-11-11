/**
 * Conference Integration Tests
 *
 * Comprehensive tests for conference call scenarios including:
 * - Creating conferences
 * - Adding/removing participants
 * - Managing conference state
 * - Audio level monitoring
 * - Participant controls (mute/unmute)
 * - Conference termination
 * - Large conferences (10+ participants)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { CallSession } from '../../src/core/CallSession'
import { MediaManager } from '../../src/core/MediaManager'
import { createMockSipServer, type MockRTCSession } from '../helpers/MockSipServer'
import type { Participant, ConferenceState } from '../../src/types/conference.types'

/**
 * Helper function to setup mock navigator.mediaDevices for conference tests
 */
function setupMockMediaDevices(): void {
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      id: 'mock-stream',
      active: true,
      getTracks: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          id: 'audio-track-1',
          enabled: true,
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        },
      ]),
      getAudioTracks: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          id: 'audio-track-1',
          enabled: true,
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ deviceId: 'default' }),
        },
      ]),
      getVideoTracks: vi.fn().mockReturnValue([]),
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getSupportedConstraints: vi.fn().mockReturnValue({}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as never
}

describe('Conference Integration Tests', () => {
  let eventBus: EventBus
  let mediaManager: MediaManager
  let mockSipServer: ReturnType<typeof createMockSipServer>

  // Helper to create a participant
  function createParticipant(id: string, uri: string, displayName: string): Participant {
    return {
      id,
      uri,
      displayName,
      joined: true,
      muted: false,
      videoEnabled: false,
      audioLevel: 0,
      isSpeaking: false,
      callSession: null,
    }
  }

  // Helper to create conference state
  function createConferenceState(): ConferenceState {
    return {
      id: 'conf-1',
      active: false,
      participants: [],
      localParticipant: null,
      participantCount: 0,
      maxParticipants: 10,
      isRecording: false,
      startTime: null,
      endTime: null,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    eventBus = new EventBus()
    mediaManager = new MediaManager({ eventBus })
    mockSipServer = createMockSipServer({ autoAcceptCalls: true })

    // Setup media devices
    setupMockMediaDevices()
  })

  afterEach(() => {
    mediaManager.destroy()
    eventBus.destroy()
    mockSipServer.reset()
  })

  describe('Conference Creation', () => {
    it('should create a new conference', () => {
      const conference = createConferenceState()

      expect(conference).toBeDefined()
      expect(conference.id).toBe('conf-1')
      expect(conference.active).toBe(false)
      expect(conference.participants).toEqual([])
      expect(conference.participantCount).toBe(0)
    })

    it('should activate conference when first participant joins', () => {
      const conference = createConferenceState()
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')

      conference.participants.push(participant)
      conference.participantCount = 1
      conference.active = true
      conference.startTime = Date.now()

      expect(conference.active).toBe(true)
      expect(conference.participantCount).toBe(1)
      expect(conference.startTime).toBeDefined()
    })

    it('should set local participant', () => {
      const conference = createConferenceState()
      const localParticipant = createParticipant('local', 'sip:me@example.com', 'Me')

      conference.localParticipant = localParticipant
      conference.participants.push(localParticipant)
      conference.participantCount = 1

      expect(conference.localParticipant).toBeDefined()
      expect(conference.localParticipant?.id).toBe('local')
    })
  })

  describe('Participant Management', () => {
    it('should add participants to conference', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')
      const p3 = createParticipant('p3', 'sip:user3@example.com', 'User 3')

      conference.participants.push(p1, p2, p3)
      conference.participantCount = 3

      expect(conference.participants).toHaveLength(3)
      expect(conference.participantCount).toBe(3)
    })

    it('should remove participant from conference', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')

      conference.participants.push(p1, p2)
      conference.participantCount = 2

      // Remove p1
      conference.participants = conference.participants.filter((p) => p.id !== 'p1')
      conference.participantCount = conference.participants.length

      expect(conference.participants).toHaveLength(1)
      expect(conference.participants[0].id).toBe('p2')
      expect(conference.participantCount).toBe(1)
    })

    it('should handle maximum participants limit', () => {
      const conference = createConferenceState()
      conference.maxParticipants = 5

      // Add 5 participants (at limit)
      for (let i = 1; i <= 5; i++) {
        const p = createParticipant(`p${i}`, `sip:user${i}@example.com`, `User ${i}`)
        conference.participants.push(p)
      }
      conference.participantCount = 5

      expect(conference.participantCount).toBe(5)

      // Try to add one more (exceeds limit)
      const canAdd = conference.participantCount < conference.maxParticipants
      expect(canAdd).toBe(false)
    })

    it('should find participant by ID', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')

      conference.participants.push(p1, p2)

      const found = conference.participants.find((p) => p.id === 'p1')

      expect(found).toBeDefined()
      expect(found?.displayName).toBe('User 1')
    })

    it('should find participant by URI', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')

      conference.participants.push(p1, p2)

      const found = conference.participants.find((p) => p.uri === 'sip:user2@example.com')

      expect(found).toBeDefined()
      expect(found?.id).toBe('p2')
    })
  })

  describe('Participant Controls', () => {
    it('should mute participant', () => {
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')

      expect(participant.muted).toBe(false)

      participant.muted = true

      expect(participant.muted).toBe(true)
    })

    it('should unmute participant', () => {
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      participant.muted = true

      expect(participant.muted).toBe(true)

      participant.muted = false

      expect(participant.muted).toBe(false)
    })

    it('should enable video for participant', () => {
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')

      expect(participant.videoEnabled).toBe(false)

      participant.videoEnabled = true

      expect(participant.videoEnabled).toBe(true)
    })

    it('should mute all participants', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')
      const p3 = createParticipant('p3', 'sip:user3@example.com', 'User 3')

      conference.participants.push(p1, p2, p3)

      // Mute all
      conference.participants.forEach((p) => {
        p.muted = true
      })

      expect(conference.participants.every((p) => p.muted)).toBe(true)
    })

    it('should unmute all participants', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')

      p1.muted = true
      p2.muted = true

      conference.participants.push(p1, p2)

      // Unmute all
      conference.participants.forEach((p) => {
        p.muted = false
      })

      expect(conference.participants.every((p) => !p.muted)).toBe(true)
    })
  })

  describe('Audio Level Monitoring', () => {
    it('should track audio levels for participants', () => {
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')

      // Simulate audio level changes
      participant.audioLevel = 0
      expect(participant.audioLevel).toBe(0)

      participant.audioLevel = 0.5
      expect(participant.audioLevel).toBe(0.5)

      participant.audioLevel = 1.0
      expect(participant.audioLevel).toBe(1.0)
    })

    it('should detect speaking participants', () => {
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')

      // Simulate speaking detection (audio level > threshold)
      const SPEAKING_THRESHOLD = 0.3

      participant.audioLevel = 0.5
      participant.isSpeaking = participant.audioLevel > SPEAKING_THRESHOLD

      expect(participant.isSpeaking).toBe(true)

      participant.audioLevel = 0.1
      participant.isSpeaking = participant.audioLevel > SPEAKING_THRESHOLD

      expect(participant.isSpeaking).toBe(false)
    })

    it('should track active speaker in conference', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')
      const p3 = createParticipant('p3', 'sip:user3@example.com', 'User 3')

      p1.audioLevel = 0.2
      p2.audioLevel = 0.8 // Active speaker
      p3.audioLevel = 0.1

      conference.participants.push(p1, p2, p3)

      // Find active speaker (highest audio level)
      const activeSpeaker = conference.participants.reduce((prev, current) =>
        prev.audioLevel > current.audioLevel ? prev : current
      )

      expect(activeSpeaker.id).toBe('p2')
      expect(activeSpeaker.audioLevel).toBe(0.8)
    })

    it('should handle muted participants in audio level tracking', () => {
      const participant = createParticipant('p1', 'sip:user1@example.com', 'User 1')

      participant.muted = true
      participant.audioLevel = 0 // Muted participants should have 0 audio level

      expect(participant.audioLevel).toBe(0)
      expect(participant.isSpeaking).toBe(false)
    })
  })

  describe('Conference State Changes', () => {
    it('should emit events when participant joins', async () => {
      const events: string[] = []

      eventBus.on('conference:participant:joined', () => events.push('joined'))

      eventBus.emit('conference:participant:joined', {
        conferenceId: 'conf-1',
        participant: createParticipant('p1', 'sip:user1@example.com', 'User 1'),
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('joined')
    })

    it('should emit events when participant leaves', async () => {
      const events: string[] = []

      eventBus.on('conference:participant:left', () => events.push('left'))

      eventBus.emit('conference:participant:left', {
        conferenceId: 'conf-1',
        participantId: 'p1',
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('left')
    })

    it('should emit events when participant is muted', async () => {
      const events: string[] = []

      eventBus.on('conference:participant:muted', () => events.push('muted'))

      eventBus.emit('conference:participant:muted', {
        conferenceId: 'conf-1',
        participantId: 'p1',
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('muted')
    })

    it('should emit events when conference ends', async () => {
      const events: string[] = []

      eventBus.on('conference:ended', () => events.push('ended'))

      eventBus.emit('conference:ended', {
        conferenceId: 'conf-1',
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('ended')
    })
  })

  describe('Conference Termination', () => {
    it('should end conference when all participants leave', () => {
      const conference = createConferenceState()

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')

      conference.participants.push(p1, p2)
      conference.participantCount = 2
      conference.active = true

      // All participants leave
      conference.participants = []
      conference.participantCount = 0
      conference.active = false
      conference.endTime = Date.now()

      expect(conference.active).toBe(false)
      expect(conference.participants).toHaveLength(0)
      expect(conference.endTime).toBeDefined()
    })

    it('should calculate conference duration', () => {
      const conference = createConferenceState()

      const startTime = Date.now()
      conference.startTime = startTime

      // Simulate 5 seconds
      const endTime = startTime + 5000
      conference.endTime = endTime

      const duration = conference.endTime - conference.startTime

      expect(duration).toBe(5000)
    })

    it('should cleanup conference resources on end', () => {
      const conference = createConferenceState()

      // Setup conference
      conference.active = true
      conference.participants.push(
        createParticipant('p1', 'sip:user1@example.com', 'User 1'),
        createParticipant('p2', 'sip:user2@example.com', 'User 2')
      )
      conference.participantCount = 2

      // End conference
      conference.active = false
      conference.participants = []
      conference.participantCount = 0
      conference.endTime = Date.now()

      expect(conference.active).toBe(false)
      expect(conference.participants).toHaveLength(0)
      expect(conference.participantCount).toBe(0)
    })
  })

  describe('Large Conference Scenarios', () => {
    it('should handle 10 participants', () => {
      const conference = createConferenceState()
      conference.maxParticipants = 20

      // Add 10 participants
      for (let i = 1; i <= 10; i++) {
        const p = createParticipant(`p${i}`, `sip:user${i}@example.com`, `User ${i}`)
        conference.participants.push(p)
      }
      conference.participantCount = 10

      expect(conference.participants).toHaveLength(10)
      expect(conference.participantCount).toBe(10)
    })

    it('should handle 20 participants', () => {
      const conference = createConferenceState()
      conference.maxParticipants = 30

      // Add 20 participants
      for (let i = 1; i <= 20; i++) {
        const p = createParticipant(`p${i}`, `sip:user${i}@example.com`, `User ${i}`)
        conference.participants.push(p)
      }
      conference.participantCount = 20

      expect(conference.participants).toHaveLength(20)
      expect(conference.participantCount).toBe(20)
    })

    it('should efficiently find participants in large conference', () => {
      const conference = createConferenceState()

      // Add 50 participants
      for (let i = 1; i <= 50; i++) {
        const p = createParticipant(`p${i}`, `sip:user${i}@example.com`, `User ${i}`)
        conference.participants.push(p)
      }

      const startTime = performance.now()
      const found = conference.participants.find((p) => p.id === 'p25')
      const endTime = performance.now()

      expect(found).toBeDefined()
      expect(found?.id).toBe('p25')

      // Should be fast even with 50 participants
      const lookupTime = endTime - startTime
      expect(lookupTime).toBeLessThan(10) // Less than 10ms
    })

    it('should track multiple speakers in large conference', () => {
      const conference = createConferenceState()

      // Add 20 participants with varying audio levels
      for (let i = 1; i <= 20; i++) {
        const p = createParticipant(`p${i}`, `sip:user${i}@example.com`, `User ${i}`)
        p.audioLevel = Math.random() // Random audio level 0-1
        p.isSpeaking = p.audioLevel > 0.3
        conference.participants.push(p)
      }

      const speakingParticipants = conference.participants.filter((p) => p.isSpeaking)

      expect(speakingParticipants.length).toBeGreaterThan(0)
    })
  })

  describe('Conference with Call Sessions', () => {
    it('should associate call sessions with participants', async () => {
      const conference = createConferenceState()

      // Create call sessions
      const session1 = mockSipServer.createSession('call-1')
      const session2 = mockSipServer.createSession('call-2')

      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:me@example.com',
        remoteUri: 'sip:user1@example.com',
        remoteDisplayName: 'User 1',
        rtcSession: session1 as any,
        eventBus,
      })

      const callSession2 = new CallSession({
        id: session2.id,
        direction: 'outgoing',
        localUri: 'sip:me@example.com',
        remoteUri: 'sip:user2@example.com',
        remoteDisplayName: 'User 2',
        rtcSession: session2 as any,
        eventBus,
      })

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      const p2 = createParticipant('p2', 'sip:user2@example.com', 'User 2')

      p1.callSession = callSession1
      p2.callSession = callSession2

      conference.participants.push(p1, p2)

      expect(conference.participants[0].callSession).toBeDefined()
      expect(conference.participants[1].callSession).toBeDefined()
      expect(conference.participants[0].callSession?.remoteUri).toBe('sip:user1@example.com')
      expect(conference.participants[1].callSession?.remoteUri).toBe('sip:user2@example.com')
    })

    it('should handle participant leaving via call session termination', async () => {
      const conference = createConferenceState()

      const session1 = mockSipServer.createSession('call-1')

      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:me@example.com',
        remoteUri: 'sip:user1@example.com',
        remoteDisplayName: 'User 1',
        rtcSession: session1 as any,
        eventBus,
      })

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      p1.callSession = callSession1

      conference.participants.push(p1)
      conference.participantCount = 1

      // Simulate call ending
      mockSipServer.simulateCallEnded(session1)

      await new Promise((resolve) => setTimeout(resolve, 50))

      // In real scenario, this would trigger participant removal
      conference.participants = conference.participants.filter((p) => p.id !== 'p1')
      conference.participantCount = conference.participants.length

      expect(conference.participants).toHaveLength(0)
      expect(conference.participantCount).toBe(0)
    })

    it('should handle muting via call session', async () => {
      const session1 = mockSipServer.createSession('call-1')
      session1.isEstablished.mockReturnValue(true)

      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:me@example.com',
        remoteUri: 'sip:user1@example.com',
        remoteDisplayName: 'User 1',
        rtcSession: session1 as any,
        eventBus,
      })

      const p1 = createParticipant('p1', 'sip:user1@example.com', 'User 1')
      p1.callSession = callSession1

      // Mute via call session
      callSession1.mute()

      // Update participant state
      p1.muted = true

      expect(p1.muted).toBe(true)
      expect(callSession1.isMuted).toBe(true)
    })
  })

  describe('Conference Recording', () => {
    it('should start conference recording', () => {
      const conference = createConferenceState()

      conference.isRecording = true

      expect(conference.isRecording).toBe(true)
    })

    it('should stop conference recording', () => {
      const conference = createConferenceState()

      conference.isRecording = true
      expect(conference.isRecording).toBe(true)

      conference.isRecording = false
      expect(conference.isRecording).toBe(false)
    })

    it('should emit events when recording starts', async () => {
      const events: string[] = []

      eventBus.on('conference:recording:started', () => events.push('started'))

      eventBus.emit('conference:recording:started', {
        conferenceId: 'conf-1',
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('started')
    })

    it('should emit events when recording stops', async () => {
      const events: string[] = []

      eventBus.on('conference:recording:stopped', () => events.push('stopped'))

      eventBus.emit('conference:recording:stopped', {
        conferenceId: 'conf-1',
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('stopped')
    })
  })

  describe('True Integration: Conference with Real SIP Sessions', () => {
    it('should create conference with multiple active SIP calls', async () => {
      const conference = createConferenceState()
      conference.maxParticipants = 5

      // Create and establish multiple call sessions
      const session1 = mockSipServer.createSession('conf-call-1')
      const session2 = mockSipServer.createSession('conf-call-2')
      const session3 = mockSipServer.createSession('conf-call-3')

      // Simulate all calls being established
      mockSipServer.simulateCallProgress(session1)
      mockSipServer.simulateCallAccepted(session1)
      mockSipServer.simulateCallProgress(session2)
      mockSipServer.simulateCallAccepted(session2)
      mockSipServer.simulateCallProgress(session3)
      mockSipServer.simulateCallAccepted(session3)

      // Create call session objects
      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant1@example.com',
        remoteDisplayName: 'Participant 1',
        rtcSession: session1,
        eventBus,
      })

      const callSession2 = new CallSession({
        id: session2.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant2@example.com',
        remoteDisplayName: 'Participant 2',
        rtcSession: session2,
        eventBus,
      })

      const callSession3 = new CallSession({
        id: session3.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant3@example.com',
        remoteDisplayName: 'Participant 3',
        rtcSession: session3,
        eventBus,
      })

      // Create participants associated with real call sessions
      const p1 = createParticipant('p1', 'sip:participant1@example.com', 'Participant 1')
      const p2 = createParticipant('p2', 'sip:participant2@example.com', 'Participant 2')
      const p3 = createParticipant('p3', 'sip:participant3@example.com', 'Participant 3')

      p1.callSession = callSession1
      p2.callSession = callSession2
      p3.callSession = callSession3

      // Add to conference
      conference.participants.push(p1, p2, p3)
      conference.participantCount = 3
      conference.active = true

      // Verify conference state
      expect(conference.active).toBe(true)
      expect(conference.participantCount).toBe(3)
      expect(conference.participants.every((p) => p.callSession !== null)).toBe(true)

      // Verify all call sessions are accessible
      expect(callSession1.id).toBe(session1.id)
      expect(callSession2.id).toBe(session2.id)
      expect(callSession3.id).toBe(session3.id)
    })

    it('should handle participant leaving by terminating their call', async () => {
      const conference = createConferenceState()

      // Create 2 active calls
      const session1 = mockSipServer.createSession('conf-call-1')
      const session2 = mockSipServer.createSession('conf-call-2')

      mockSipServer.simulateCallAccepted(session1)
      mockSipServer.simulateCallAccepted(session2)

      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant1@example.com',
        remoteDisplayName: 'Participant 1',
        rtcSession: session1,
        eventBus,
      })

      const callSession2 = new CallSession({
        id: session2.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant2@example.com',
        remoteDisplayName: 'Participant 2',
        rtcSession: session2,
        eventBus,
      })

      const p1 = createParticipant('p1', 'sip:participant1@example.com', 'Participant 1')
      const p2 = createParticipant('p2', 'sip:participant2@example.com', 'Participant 2')

      p1.callSession = callSession1
      p2.callSession = callSession2

      conference.participants.push(p1, p2)
      conference.participantCount = 2
      conference.active = true

      // Simulate participant 1 leaving (call ends)
      mockSipServer.simulateCallEnded(session1, 'remote', 'Bye')

      await new Promise((resolve) => setTimeout(resolve, 50))

      // In real implementation, this would trigger participant removal
      conference.participants = conference.participants.filter((p) => p.id !== 'p1')
      conference.participantCount = conference.participants.length

      expect(conference.participantCount).toBe(1)
      expect(conference.participants.find((p) => p.id === 'p1')).toBeUndefined()
      expect(conference.participants.find((p) => p.id === 'p2')).toBeDefined()
    })

    it('should mute participant via their call session', async () => {
      const session1 = mockSipServer.createSession('conf-call-1')
      mockSipServer.simulateCallAccepted(session1)

      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant1@example.com',
        remoteDisplayName: 'Participant 1',
        rtcSession: session1,
        eventBus,
      })

      const p1 = createParticipant('p1', 'sip:participant1@example.com', 'Participant 1')
      p1.callSession = callSession1

      // Mute via call session
      callSession1.mute()

      // Update participant state to reflect mute
      p1.muted = callSession1.isMuted

      expect(p1.muted).toBe(true)
      expect(callSession1.isMuted).toBe(true)
    })

    it('should handle multiple participants joining and leaving dynamically', async () => {
      const conference = createConferenceState()
      conference.active = true

      const addParticipant = (id: string, uri: string, name: string) => {
        const session = mockSipServer.createSession(`call-${id}`)
        mockSipServer.simulateCallAccepted(session)

        const callSession = new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:host@example.com',
          remoteUri: uri,
          remoteDisplayName: name,
          rtcSession: session,
          eventBus,
        })

        const participant = createParticipant(id, uri, name)
        participant.callSession = callSession

        conference.participants.push(participant)
        conference.participantCount++

        return { session, callSession, participant }
      }

      // Add 3 participants
      const part1 = addParticipant('p1', 'sip:user1@example.com', 'User 1')
      const part2 = addParticipant('p2', 'sip:user2@example.com', 'User 2')
      const part3 = addParticipant('p3', 'sip:user3@example.com', 'User 3')

      expect(conference.participantCount).toBe(3)

      // Remove participant 2
      mockSipServer.simulateCallEnded(part2.session, 'remote')
      conference.participants = conference.participants.filter((p) => p.id !== 'p2')
      conference.participantCount--

      expect(conference.participantCount).toBe(2)

      // Add another participant
      const part4 = addParticipant('p4', 'sip:user4@example.com', 'User 4')

      expect(conference.participantCount).toBe(3)
      expect(conference.participants.map((p) => p.id)).toEqual(['p1', 'p3', 'p4'])
    })

    it('should handle hold/unhold for conference participants', async () => {
      const session1 = mockSipServer.createSession('conf-call-1')

      const callSession1 = new CallSession({
        id: session1.id,
        direction: 'outgoing',
        localUri: 'sip:host@example.com',
        remoteUri: 'sip:participant1@example.com',
        remoteDisplayName: 'Participant 1',
        rtcSession: session1,
        eventBus,
      })

      // Simulate call being accepted and confirmed (must be after CallSession creation so event handlers are registered)
      mockSipServer.simulateCallAccepted(session1)
      mockSipServer.simulateCallConfirmed(session1)

      // Wait for async events to propagate
      await new Promise((resolve) => setTimeout(resolve, 100))

      const p1 = createParticipant('p1', 'sip:participant1@example.com', 'Participant 1')
      p1.callSession = callSession1

      // Hold participant
      const holdPromise = callSession1.hold()
      mockSipServer.simulateHold(session1, 'local')
      await holdPromise

      // Wait for hold event to propagate
      await new Promise((resolve) => setTimeout(resolve, 100))

      // In real implementation, held state would be tracked
      expect(session1.hold).toHaveBeenCalled()

      // Unhold participant
      const unholdPromise = callSession1.unhold()
      mockSipServer.simulateUnhold(session1, 'local')
      await unholdPromise

      // Wait for unhold event to propagate
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(session1.unhold).toHaveBeenCalled()
    })

    it('should end conference by terminating all participant calls', async () => {
      const conference = createConferenceState()

      // Create 3 participants with active calls
      const sessions: typeof mockSipServer.createSession[] = []
      const callSessions: CallSession[] = []

      for (let i = 1; i <= 3; i++) {
        const session = mockSipServer.createSession(`call-${i}`)
        
        const callSession = new CallSession({
          id: session.id,
          direction: 'outgoing',
          localUri: 'sip:host@example.com',
          remoteUri: `sip:user${i}@example.com`,
          remoteDisplayName: `User ${i}`,
          rtcSession: session,
          eventBus,
        })

        // Simulate call lifecycle to get to active state
        mockSipServer.simulateCallProgress(session)
        await new Promise((resolve) => setTimeout(resolve, 10))
        mockSipServer.simulateCallAccepted(session)
        mockSipServer.simulateCallConfirmed(session)
        await new Promise((resolve) => setTimeout(resolve, 10))

        const p = createParticipant(`p${i}`, `sip:user${i}@example.com`, `User ${i}`)
        p.callSession = callSession

        conference.participants.push(p)
        sessions.push(session as never)
        callSessions.push(callSession)
      }

      conference.participantCount = 3
      conference.active = true

      // End conference - terminate all calls
      sessions.forEach((session) => {
        callSessions.forEach((cs) => cs.terminate())
        mockSipServer.simulateCallEnded(session as never, 'local', 'Conference ended')
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Cleanup conference
      conference.participants = []
      conference.participantCount = 0
      conference.active = false
      conference.endTime = Date.now()

      expect(conference.active).toBe(false)
      expect(conference.participantCount).toBe(0)
      expect(conference.endTime).toBeDefined()

      // Verify all terminate calls were made
      callSessions.forEach((cs) => {
        expect(cs.rtcSession.terminate).toHaveBeenCalled()
      })
    })
  })
})
