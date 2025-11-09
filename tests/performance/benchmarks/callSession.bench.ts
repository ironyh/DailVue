/**
 * CallSession Performance Benchmarks
 *
 * Benchmarks for call session operations including accept, reject, terminate,
 * hold, resume, and other common call control operations.
 */

import { bench, describe } from 'vitest'
import { CallSession } from '@/core/CallSession'
import { EventBus } from '@/core/EventBus'
import { CallDirection } from '@/types/call.types'
import { PERFORMANCE } from '@/utils/constants'

// Mock RTCSession
class MockRTCSession {
  id = 'bench-session-id'
  remote_identity = {
    uri: { toString: () => 'sip:alice@example.com' },
    display_name: 'Alice',
  }
  connection: any = null
  private listeners: Map<string, ((...args: any[]) => void)[]> = new Map()

  on(event: string, handler: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)?.push(handler)
  }

  once(event: string, handler: (...args: any[]) => void) {
    const wrapper = (...args: any[]) => {
      handler(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  off(event: string, handler: (...args: any[]) => void) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  removeAllListeners() {
    this.listeners.clear()
  }

  emit(event: string, data?: any) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }

  answer = () => Promise.resolve()
  terminate = () => {}
  hold = () => Promise.resolve()
  unhold = () => Promise.resolve()
  mute = () => {}
  unmute = () => {}
  sendDTMF = () => {}
}

describe('CallSession Performance Benchmarks', () => {
  describe('Session Creation', () => {
    bench(
      'create incoming call session',
      () => {
        const eventBus = new EventBus()
        const mockRtcSession = new MockRTCSession()

        const session = new CallSession({
          id: 'bench-call-1',
          direction: 'incoming' as CallDirection,
          localUri: 'sip:bob@example.com',
          remoteUri: 'sip:alice@example.com',
          remoteDisplayName: 'Alice',
          rtcSession: mockRtcSession,
          eventBus,
        })

        session.destroy()
        eventBus.destroy()
      },
      {
        time: 1000,
      }
    )

    bench(
      'create outgoing call session',
      () => {
        const eventBus = new EventBus()
        const mockRtcSession = new MockRTCSession()

        const session = new CallSession({
          id: 'bench-call-2',
          direction: 'outgoing' as CallDirection,
          localUri: 'sip:bob@example.com',
          remoteUri: 'sip:alice@example.com',
          rtcSession: mockRtcSession,
          eventBus,
        })

        session.destroy()
        eventBus.destroy()
      },
      {
        time: 1000,
      }
    )
  })

  describe('Answer Operations', () => {
    bench('answer incoming call (fast path)', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'incoming' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      // Set to ringing state
      ;(session as any)._state = 'ringing'

      await session.answer()

      session.destroy()
      eventBus.destroy()
    })

    bench('answer with custom media constraints (slow path)', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'incoming' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'ringing'

      await session.answer({
        mediaConstraints: {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        },
        extraHeaders: ['X-Custom-Header: value'],
      })

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('Call Termination', () => {
    bench('hangup active call', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      await session.hangup()

      session.destroy()
      eventBus.destroy()
    })

    bench('reject incoming call', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'incoming' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'ringing'

      await session.hangup()

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('Hold/Resume Operations', () => {
    bench('hold active call', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      await session.hold()

      session.destroy()
      eventBus.destroy()
    })

    bench('resume held call', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'
      ;(session as any)._isOnHold = true

      await session.unhold()

      session.destroy()
      eventBus.destroy()
    })

    bench('hold/resume cycle', async () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      await session.hold()
      ;(session as any)._isOnHold = true
      ;(session as any)._state = 'active'
      await session.unhold()

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('Mute/Unmute Operations', () => {
    bench('mute call', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      session.mute()

      session.destroy()
      eventBus.destroy()
    })

    bench('unmute call', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'
      ;(session as any)._isMuted = true

      session.unmute()

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('DTMF Operations', () => {
    bench('send single DTMF tone', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      session.sendDTMF('1')

      session.destroy()
      eventBus.destroy()
    })

    bench('send DTMF with custom duration', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      session.sendDTMF('5', {
        duration: 200,
        interToneGap: 100,
      })

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('State Transitions', () => {
    bench('call flow: ringing -> active', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      // Simulate state transitions
      mockRtcSession.emit('progress', {
        response: { status_code: 180, reason_phrase: 'Ringing' },
      })
      mockRtcSession.emit('confirmed', {})

      session.destroy()
      eventBus.destroy()
    })

    bench('call flow: active -> terminated', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      mockRtcSession.emit('ended', {
        cause: 'BYE',
        originator: 'remote',
      })

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('Event Propagation', () => {
    bench('event propagation speed', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      let _eventReceived = false
      eventBus.on('call:confirmed', () => {
        _eventReceived = true
      })

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      const startTime = performance.now()
      mockRtcSession.emit('confirmed', {})
      const endTime = performance.now()

      // Verify event was received within performance budget
      const propagationTime = endTime - startTime
      if (propagationTime > PERFORMANCE.MAX_EVENT_PROPAGATION_TIME) {
        console.warn(
          `Event propagation exceeded budget: ${propagationTime}ms > ${PERFORMANCE.MAX_EVENT_PROPAGATION_TIME}ms`
        )
      }

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('toInterface Serialization', () => {
    bench('serialize call session to interface', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        remoteDisplayName: 'Alice',
        rtcSession: mockRtcSession,
        eventBus,
      })

      const _iface = session.toInterface()

      session.destroy()
      eventBus.destroy()
    })
  })

  describe('Memory Management', () => {
    bench('cleanup on destroy', () => {
      const eventBus = new EventBus()
      const mockRtcSession = new MockRTCSession()

      const session = new CallSession({
        id: 'bench-call-1',
        direction: 'outgoing' as CallDirection,
        localUri: 'sip:bob@example.com',
        remoteUri: 'sip:alice@example.com',
        rtcSession: mockRtcSession,
        eventBus,
      })

      ;(session as any)._state = 'active'

      session.destroy()
      eventBus.destroy()
    })

    bench('concurrent session creation and cleanup', () => {
      const eventBus = new EventBus()
      const sessions: CallSession[] = []

      // Create 5 concurrent sessions
      for (let i = 0; i < 5; i++) {
        const mockRtcSession = new MockRTCSession()
        const session = new CallSession({
          id: `bench-call-${i}`,
          direction: 'outgoing' as CallDirection,
          localUri: 'sip:bob@example.com',
          remoteUri: `sip:user${i}@example.com`,
          rtcSession: mockRtcSession,
          eventBus,
        })
        sessions.push(session)
      }

      // Cleanup all sessions
      sessions.forEach((s) => s.destroy())
      eventBus.destroy()
    })
  })
})
