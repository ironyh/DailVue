/**
 * Conference Performance Benchmarks
 *
 * Benchmarks for conference operations including add/remove participants,
 * conference creation, and multi-party call management.
 */

import { bench, describe, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { useConference } from '@/composables/useConference'
import type { SipClient } from '@/core/SipClient'
import { createEventBus } from '@/core/EventBus'
import type { EventBus } from '@/core/EventBus'
import { PERFORMANCE } from '@/utils/constants'

// Mock SIP Client
const createMockSipClient = (): SipClient => {
  const mockClient = {
    makeCall: vi.fn().mockResolvedValue({
      id: 'call-id',
      remoteUri: 'sip:conference@example.com',
      state: 'active',
    }),
    hangup: vi.fn().mockResolvedValue(undefined),
    hold: vi.fn().mockResolvedValue(undefined),
    unhold: vi.fn().mockResolvedValue(undefined),
    mute: vi.fn(),
    unmute: vi.fn(),
    isConnected: true,
    isRegistered: true,
  } as unknown as SipClient

  return mockClient
}

describe('Conference Performance Benchmarks', () => {
  let eventBus: EventBus
  let mockSipClient: SipClient

  beforeEach(() => {
    eventBus = createEventBus()
    mockSipClient = createMockSipClient()
  })

  afterEach(() => {
    eventBus.destroy()
  })

  describe('Conference Creation', () => {
    bench('create conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference } = useConference(sipClientRef, eventBus)

      await createConference()
    })

    bench('create conference with options', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference } = useConference(sipClientRef, eventBus)

      await createConference({
        maxParticipants: 10,
        recordingEnabled: true,
        moderatorUri: 'sip:moderator@example.com',
      })
    })

    bench('join existing conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { joinConference } = useConference(sipClientRef, eventBus)

      await joinConference('sip:conference123@example.com')
    })
  })

  describe('Participant Management', () => {
    bench('add single participant', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference()
      await addParticipant('sip:alice@example.com', 'Alice')
    })

    bench('add multiple participants sequentially', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference()

      for (let i = 0; i < 5; i++) {
        await addParticipant(`sip:user${i}@example.com`, `User ${i}`)
      }
    })

    bench('add multiple participants concurrently', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference()

      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(addParticipant(`sip:user${i}@example.com`, `User ${i}`))
      }

      await Promise.all(promises)
    })

    bench('remove participant', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, removeParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')
      await removeParticipant(participantId)
    })

    bench('add and remove cycle', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, removeParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()

      // Add participant
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')

      // Remove participant
      await removeParticipant(participantId)

      // Add another
      await addParticipant('sip:bob@example.com', 'Bob')
    })
  })

  describe('Participant Controls', () => {
    bench('mute participant', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, muteParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')
      await muteParticipant(participantId)
    })

    bench('unmute participant', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, muteParticipant, unmuteParticipant } =
        useConference(sipClientRef, eventBus)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')
      await muteParticipant(participantId)
      await unmuteParticipant(participantId)
    })

    bench('mute all participants', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, muteParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()

      // Add multiple participants
      const participantIds = await Promise.all([
        addParticipant('sip:alice@example.com', 'Alice'),
        addParticipant('sip:bob@example.com', 'Bob'),
        addParticipant('sip:charlie@example.com', 'Charlie'),
      ])

      // Mute all
      await Promise.all(participantIds.map((id) => muteParticipant(id)))
    })

    bench('unmute all participants', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, muteParticipant, unmuteParticipant } =
        useConference(sipClientRef, eventBus)

      await createConference()

      // Add and mute multiple participants
      const participantIds = await Promise.all([
        addParticipant('sip:alice@example.com', 'Alice'),
        addParticipant('sip:bob@example.com', 'Bob'),
        addParticipant('sip:charlie@example.com', 'Charlie'),
      ])

      await Promise.all(participantIds.map((id) => muteParticipant(id)))

      // Unmute all
      await Promise.all(participantIds.map((id) => unmuteParticipant(id)))
    })
  })

  describe('Conference Controls', () => {
    bench('lock conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, lockConference } = useConference(sipClientRef, eventBus)

      await createConference()
      await lockConference()
    })

    bench('unlock conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, lockConference, unlockConference } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()
      await lockConference()
      await unlockConference()
    })

    bench('start recording', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, startRecording } = useConference(sipClientRef, eventBus)

      await createConference()
      await startRecording()
    })

    bench('stop recording', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, startRecording, stopRecording } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()
      await startRecording()
      await stopRecording()
    })

    bench('end conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, endConference } = useConference(sipClientRef, eventBus)

      await createConference()
      await endConference()
    })
  })

  describe('State Management', () => {
    bench('get conference state', () => {
      const sipClientRef = ref(mockSipClient)
      const { state, participants, participantCount, isActive, isLocked, isRecording } =
        useConference(sipClientRef, eventBus)

      // Access all computed properties
      const _currentState = state.value
      const _currentParticipants = participants.value
      const _currentCount = participantCount.value
      const _activeStatus = isActive.value
      const _lockedStatus = isLocked.value
      const _recordingStatus = isRecording.value
    })

    bench('state updates with event emission', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      let stateChangeCount = 0
      eventBus.on('conference:state_changed', () => stateChangeCount++)

      const startTime = performance.now()

      await createConference()
      await addParticipant('sip:alice@example.com', 'Alice')

      const endTime = performance.now()
      const latency = endTime - startTime

      if (latency > PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 2) {
        console.warn(
          `Conference state updates exceeded budget: ${latency}ms > ${PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 2}ms`
        )
      }
    })
  })

  describe('Event Handling', () => {
    bench('emit participant joined event', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      let _eventReceived = false
      eventBus.on('conference:participant_joined', () => {
        _eventReceived = true
      })

      await createConference()

      const startTime = performance.now()
      await addParticipant('sip:alice@example.com', 'Alice')
      const endTime = performance.now()

      const propagationTime = endTime - startTime
      if (propagationTime > PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 5) {
        console.warn(
          `Event propagation exceeded budget: ${propagationTime}ms > ${PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 5}ms`
        )
      }
    })

    bench('emit participant left event', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, removeParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      let _eventReceived = false
      eventBus.on('conference:participant_left', () => {
        _eventReceived = true
      })

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')

      const startTime = performance.now()
      await removeParticipant(participantId)
      const endTime = performance.now()

      const propagationTime = endTime - startTime
      if (propagationTime > PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 5) {
        console.warn(
          `Event propagation exceeded budget: ${propagationTime}ms > ${PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 5}ms`
        )
      }
    })

    bench('handle multiple concurrent events', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      let joinedCount = 0
      let updatedCount = 0

      eventBus.on('conference:participant_joined', () => joinedCount++)
      eventBus.on('conference:participant_updated', () => updatedCount++)

      await createConference()

      const startTime = performance.now()

      // Add multiple participants concurrently
      await Promise.all([
        addParticipant('sip:alice@example.com', 'Alice'),
        addParticipant('sip:bob@example.com', 'Bob'),
        addParticipant('sip:charlie@example.com', 'Charlie'),
      ])

      const endTime = performance.now()
      const totalTime = endTime - startTime

      const budget = PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 15 // 3 participants * 5x budget
      if (totalTime > budget) {
        console.warn(`Concurrent event handling exceeded budget: ${totalTime}ms > ${budget}ms`)
      }
    })
  })

  describe('Performance Budget Compliance', () => {
    bench('conference creation latency check', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference } = useConference(sipClientRef, eventBus)

      const startTime = performance.now()
      await createConference()
      const endTime = performance.now()

      const latency = endTime - startTime
      if (latency > PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 2) {
        console.warn(
          `Conference creation exceeded budget: ${latency}ms > ${PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 2}ms`
        )
      }
    })

    bench('participant addition latency check', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference()

      const startTime = performance.now()
      await addParticipant('sip:alice@example.com', 'Alice')
      const endTime = performance.now()

      const latency = endTime - startTime
      if (latency > PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 2) {
        console.warn(
          `Participant addition exceeded budget: ${latency}ms > ${PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 2}ms`
        )
      }
    })
  })

  describe('Large Conference Scenarios', () => {
    bench('manage 10-participant conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference({ maxParticipants: 10 })

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(addParticipant(`sip:user${i}@example.com`, `User ${i}`))
      }

      await Promise.all(promises)
    })

    bench('manage 20-participant conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference({ maxParticipants: 20 })

      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(addParticipant(`sip:user${i}@example.com`, `User ${i}`))
      }

      await Promise.all(promises)
    })

    bench('participant churn (add/remove)', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, removeParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()

      // Simulate churn: add and remove participants
      for (let i = 0; i < 5; i++) {
        await addParticipant(`sip:user${i}@example.com`, `User ${i}`)
        if (i > 0) {
          // Remove previous participant
          await removeParticipant(`participant-${i - 1}`)
        }
      }
    })
  })

  describe('Memory Management', () => {
    bench('cleanup on end conference', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, endConference } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()

      // Add some participants
      await Promise.all([
        addParticipant('sip:alice@example.com', 'Alice'),
        addParticipant('sip:bob@example.com', 'Bob'),
      ])

      // End conference
      await endConference()
    })

    bench('multiple conference creation and cleanup', async () => {
      const sipClientRef = ref(mockSipClient)

      // Create and cleanup multiple conferences
      for (let i = 0; i < 3; i++) {
        const { createConference, endConference } = useConference(sipClientRef, eventBus)
        await createConference()
        await endConference()
      }
    })
  })

  describe('Audio Level Monitoring', () => {
    bench('update participant audio levels', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant } = useConference(sipClientRef, eventBus)

      await createConference()

      // Add participants
      const participantIds = await Promise.all([
        addParticipant('sip:alice@example.com', 'Alice'),
        addParticipant('sip:bob@example.com', 'Bob'),
        addParticipant('sip:charlie@example.com', 'Charlie'),
      ])

      // Simulate audio level updates
      const startTime = performance.now()

      participantIds.forEach((id) => {
        eventBus.emit('conference:audio_level', {
          participantId: id,
          level: Math.random(),
          timestamp: Date.now(),
        })
      })

      const endTime = performance.now()
      const latency = endTime - startTime

      if (latency > PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 3) {
        console.warn(
          `Audio level updates exceeded budget: ${latency}ms > ${PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 3}ms`
        )
      }
    })
  })

  describe('Concurrent Operations', () => {
    bench('concurrent add and mute operations', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, muteParticipant } = useConference(
        sipClientRef,
        eventBus
      )

      await createConference()

      // Add first participant
      const id1 = await addParticipant('sip:alice@example.com', 'Alice')

      // Concurrently add second participant and mute first
      await Promise.all([addParticipant('sip:bob@example.com', 'Bob'), muteParticipant(id1)])
    })

    bench('concurrent control operations', async () => {
      const sipClientRef = ref(mockSipClient)
      const { createConference, addParticipant, lockConference, startRecording, muteParticipant } =
        useConference(sipClientRef, eventBus)

      await createConference()
      const participantId = await addParticipant('sip:alice@example.com', 'Alice')

      // Execute multiple control operations concurrently
      await Promise.all([lockConference(), startRecording(), muteParticipant(participantId)])
    })
  })
})
