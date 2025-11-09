/**
 * Agent Complex Scenarios Integration Tests
 *
 * Tests advanced and complex SIP scenarios:
 * - Call transfers (blind and attended)
 * - Call forwarding
 * - Simultaneous calls
 * - Call queuing
 * - Multi-step scenarios
 * - Error recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createAgentManager,
  createAgentIdentity,
  NETWORK_PROFILES,
  type AgentManager,
  type SipTestAgent,
} from '../agents'

describe('Agent Complex Scenarios Integration Tests', () => {
  let manager: AgentManager
  let alice: SipTestAgent
  let bob: SipTestAgent
  let charlie: SipTestAgent
  let david: SipTestAgent

  beforeEach(async () => {
    vi.clearAllMocks()

    manager = createAgentManager({ verbose: false })

    // Create agents
    alice = await manager.createAgent({
      identity: createAgentIdentity('alice'),
      autoRegister: true,
    })

    bob = await manager.createAgent({
      identity: createAgentIdentity('bob'),
      autoRegister: true,
    })

    charlie = await manager.createAgent({
      identity: createAgentIdentity('charlie'),
      autoRegister: true,
    })

    david = await manager.createAgent({
      identity: createAgentIdentity('david'),
      autoRegister: true,
    })

    // Connect and register all
    await manager.connectAllAgents()
    await manager.registerAllAgents()
  })

  afterEach(async () => {
    await manager.destroy()
  })

  describe('Call Transfer Scenarios', () => {
    it('should handle blind call transfer', async () => {
      // Setup: Alice calls Bob
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Bob transfers the call to Charlie (blind transfer)
      const bobCalls = bob.call.getActiveCalls()
      await bob.call.transferCall(bobCalls[0].id, charlie.getIdentity().uri)

      // Verify transfer was initiated
      expect(bobCalls[0].refer).toHaveBeenCalledWith(charlie.getIdentity().uri)
    })

    it('should handle attended call transfer', async () => {
      // Step 1: Alice calls Bob
      const call1 = await manager.setupCall('alice', 'bob', true)

      // Step 2: Bob holds Alice and calls Charlie
      const bobCallWithAlice = bob.call.getActiveCalls()[0]
      await bob.call.holdCall(bobCallWithAlice.id)

      const bobCallWithCharlie = await bob.call.makeCall(charlie.getIdentity().uri)

      // Step 3: Charlie answers
      charlie.getMockServer().simulateIncomingCall(
        bob.getIdentity().uri,
        charlie.getIdentity().uri
      )

      // Bob now has 2 active calls
      expect(bob.call.getActiveCalls()).toHaveLength(2)

      // Step 4: Bob transfers Alice to Charlie
      await bob.call.transferCall(bobCallWithAlice.id, charlie.getIdentity().uri)

      // Verify transfer
      expect(bobCallWithAlice.refer).toHaveBeenCalled()
    })

    it('should handle call transfer chain (A->B->C->D)', async () => {
      // Alice calls Bob
      await manager.setupCall('alice', 'bob', true)

      // Bob transfers to Charlie
      const bobCalls = bob.call.getActiveCalls()
      await bob.call.transferCall(bobCalls[0].id, charlie.getIdentity().uri)

      // Simulate Charlie receiving the transferred call
      charlie.getMockServer().simulateIncomingCall(
        alice.getIdentity().uri,
        charlie.getIdentity().uri
      )

      // Charlie transfers to David
      const charlieCalls = charlie.call.getActiveCalls()
      if (charlieCalls.length > 0) {
        await charlie.call.transferCall(charlieCalls[0].id, david.getIdentity().uri)
      }

      // Verify transfer chain
      expect(bobCalls[0].refer).toHaveBeenCalled()
    })
  })

  describe('Simultaneous Calls', () => {
    it('should handle agent making multiple simultaneous calls', async () => {
      // Alice calls Bob and Charlie simultaneously
      const callToBob = await alice.call.makeCall(bob.getIdentity().uri)
      const callToCharlie = await alice.call.makeCall(charlie.getIdentity().uri)

      // Verify Alice has 2 active calls
      expect(alice.call.getActiveCalls()).toHaveLength(2)

      const metrics = alice.getMetrics()
      expect(metrics.callsMade).toBe(2)
    })

    it('should handle agent receiving multiple simultaneous calls', async () => {
      // Bob receives calls from Alice and Charlie
      const aliceCallSession = alice.getMockServer().createSession()
      bob.getMockServer().simulateIncomingCall(
        alice.getIdentity().uri,
        bob.getIdentity().uri
      )

      const charlieCallSession = charlie.getMockServer().createSession()
      bob.getMockServer().simulateIncomingCall(
        charlie.getIdentity().uri,
        bob.getIdentity().uri
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Bob should have 2 incoming calls
      expect(bob.call.getActiveCalls()).toHaveLength(2)
    })

    it('should handle answering multiple calls sequentially', async () => {
      // Bob receives 2 calls
      bob.getMockServer().simulateIncomingCall(
        alice.getIdentity().uri,
        bob.getIdentity().uri
      )

      bob.getMockServer().simulateIncomingCall(
        charlie.getIdentity().uri,
        bob.getIdentity().uri
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      const calls = bob.call.getActiveCalls()
      expect(calls.length).toBeGreaterThan(0)

      // Answer first call
      if (calls[0]) {
        await bob.call.answerCall(calls[0].id)
      }

      // Answer second call
      if (calls[1]) {
        await bob.call.answerCall(calls[1].id)
      }

      const metrics = bob.getMetrics()
      expect(metrics.callsAccepted).toBe(2)
    })

    it('should handle rejecting one call while accepting another', async () => {
      // Bob receives 2 calls
      const call1 = bob.getMockServer().simulateIncomingCall(
        alice.getIdentity().uri,
        bob.getIdentity().uri
      )

      const call2 = bob.getMockServer().simulateIncomingCall(
        charlie.getIdentity().uri,
        bob.getIdentity().uri
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Answer first, reject second
      await bob.call.answerCall(call1.id)
      await bob.call.rejectCall(call2.id)

      const metrics = bob.getMetrics()
      expect(metrics.callsAccepted).toBe(1)
      expect(metrics.callsRejected).toBe(1)
    })
  })

  describe('Call Hold and Resume Scenarios', () => {
    it('should handle call hold and resume', async () => {
      // Alice calls Bob
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Bob holds the call
      const bobCall = bob.call.getActiveCalls()[0]
      await bob.call.holdCall(bobCall.id)

      // Simulate hold event
      bob.getMockServer().simulateHold(bobCall, 'local')

      await new Promise(resolve => setTimeout(resolve, 100))

      // Bob resumes the call
      await bob.call.unholdCall(bobCall.id)

      // Simulate unhold event
      bob.getMockServer().simulateUnhold(bobCall, 'local')

      // Verify call is still active
      expect(bob.call.getCall(bobCall.id)).toBeDefined()
    })

    it('should handle multiple holds and resumes', async () => {
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      const bobCall = bob.call.getActiveCalls()[0]

      // Hold and unhold multiple times
      for (let i = 0; i < 3; i++) {
        await bob.call.holdCall(bobCall.id)
        bob.getMockServer().simulateHold(bobCall, 'local')
        await new Promise(resolve => setTimeout(resolve, 50))

        await bob.call.unholdCall(bobCall.id)
        bob.getMockServer().simulateUnhold(bobCall, 'local')
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Call should still be active
      expect(bob.call.getCall(bobCall.id)).toBeDefined()
    })

    it('should handle holding one call while talking on another', async () => {
      // Alice calls Bob
      await manager.setupCall('alice', 'bob', true)

      const bobCallWithAlice = bob.call.getActiveCalls()[0]

      // Bob holds Alice
      await bob.call.holdCall(bobCallWithAlice.id)
      bob.getMockServer().simulateHold(bobCallWithAlice, 'local')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Bob receives call from Charlie
      bob.getMockServer().simulateIncomingCall(
        charlie.getIdentity().uri,
        bob.getIdentity().uri
      )

      await new Promise(resolve => setTimeout(resolve, 50))

      // Bob answers Charlie
      const bobCallWithCharlie = bob.call.getActiveCalls()[1]
      if (bobCallWithCharlie) {
        await bob.call.answerCall(bobCallWithCharlie.id)
      }

      // Bob has 2 active calls, one on hold
      expect(bob.call.getActiveCalls()).toHaveLength(2)
    })
  })

  describe('DTMF Scenarios', () => {
    it('should send DTMF sequence for PIN entry', async () => {
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      const aliceCall = alice.call.getActiveCalls()[0]

      // Enter PIN: 1234#
      await alice.call.sendDTMF(aliceCall.id, '1')
      await alice.call.sendDTMF(aliceCall.id, '2')
      await alice.call.sendDTMF(aliceCall.id, '3')
      await alice.call.sendDTMF(aliceCall.id, '4')
      await alice.call.sendDTMF(aliceCall.id, '#')

      // Verify DTMF was sent
      expect(aliceCall.sendDTMF).toHaveBeenCalledTimes(5)
    })

    it('should send DTMF for menu navigation', async () => {
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      const aliceCall = alice.call.getActiveCalls()[0]

      // Navigate menu: press 1, then 2, then 3
      const menuSequence = ['1', '2', '3']

      for (const digit of menuSequence) {
        await alice.call.sendDTMF(aliceCall.id, digit)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      expect(aliceCall.sendDTMF).toHaveBeenCalledTimes(3)
    })

    it('should handle rapid DTMF input', async () => {
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      const aliceCall = alice.call.getActiveCalls()[0]

      // Rapid DTMF: 1234567890
      const digits = '1234567890'

      for (const digit of digits) {
        await alice.call.sendDTMF(aliceCall.id, digit)
      }

      expect(aliceCall.sendDTMF).toHaveBeenCalledTimes(10)
    })
  })

  describe('Multi-Step Scenarios', () => {
    it('should handle complete call workflow with all features', async () => {
      // Step 1: Alice calls Bob
      await manager.setupCall('alice', 'bob', true)
      const aliceCall = alice.call.getActiveCalls()[0]
      const bobCall = bob.call.getActiveCalls()[0]

      // Step 2: Bob mutes audio
      bob.media.setAudioEnabled(false)
      await new Promise(resolve => setTimeout(resolve, 50))

      // Step 3: Alice sends DTMF
      await alice.call.sendDTMF(aliceCall.id, '123')

      // Step 4: Bob enables video
      bob.media.setVideoEnabled(true)

      // Step 5: Bob holds the call
      await bob.call.holdCall(bobCall.id)
      bob.getMockServer().simulateHold(bobCall, 'local')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Step 6: Bob resumes
      await bob.call.unholdCall(bobCall.id)
      bob.getMockServer().simulateUnhold(bobCall, 'local')

      // Step 7: Send message
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Thanks for the call!')

      // Step 8: End call
      await alice.call.terminateCall(aliceCall.id)

      // Verify workflow completed
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.callsMade).toBe(1)
      expect(aliceMetrics.messagesSent).toBe(1)
    })

    it('should handle call escalation (voice to video)', async () => {
      // Start with voice-only call
      await manager.setupCall('alice', 'bob', true)

      expect(alice.media.isVideoEnabled()).toBe(false)
      expect(bob.media.isVideoEnabled()).toBe(false)

      // Escalate to video
      alice.media.setVideoEnabled(true)
      bob.media.setVideoEnabled(true)

      expect(alice.media.isVideoEnabled()).toBe(true)
      expect(bob.media.isVideoEnabled()).toBe(true)
    })

    it('should handle call de-escalation (video to voice)', async () => {
      // Start with video enabled
      alice.media.setVideoEnabled(true)
      bob.media.setVideoEnabled(true)

      await manager.setupCall('alice', 'bob', true)

      // De-escalate to voice only
      alice.media.setVideoEnabled(false)
      bob.media.setVideoEnabled(false)

      expect(alice.media.isVideoEnabled()).toBe(false)
      expect(bob.media.isVideoEnabled()).toBe(false)
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle call failure and retry', async () => {
      // First attempt fails
      const session1 = await alice.call.makeCall(bob.getIdentity().uri)

      // Simulate call failure
      alice.getMockServer().simulateCallEnded(session1, 'local', 'Failed')

      await new Promise(resolve => setTimeout(resolve, 100))

      // Retry
      const session2 = await alice.call.makeCall(bob.getIdentity().uri)

      expect(session2).toBeDefined()
      expect(session2.id).not.toBe(session1.id)
    })

    it('should handle network interruption during call', async () => {
      // Use agent with network simulator
      const aliceWithNetwork = await manager.createAgent({
        identity: createAgentIdentity('alice2', 'alice2'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      await aliceWithNetwork.connect()
      await aliceWithNetwork.register()

      // Start call
      const session = await aliceWithNetwork.call.makeCall(bob.getIdentity().uri)

      // Simulate network interruption
      const simulator = aliceWithNetwork.getNetworkSimulator()
      simulator.scheduleInterruption({
        type: 'disconnect',
        duration: 100,
        delay: 0,
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Network is interrupted
      expect(simulator.isNetworkInterrupted()).toBe(true)

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(simulator.isNetworkInterrupted()).toBe(false)
    })

    it('should handle agent reconnection after disconnect', async () => {
      // Disconnect Alice
      await alice.disconnect()

      const state1 = alice.getState()
      expect(state1.connected).toBe(false)

      // Reconnect
      await alice.connect()
      await alice.register()

      const state2 = alice.getState()
      expect(state2.connected).toBe(true)
      expect(state2.registered).toBe(true)
    })
  })

  describe('Load and Stress Scenarios', () => {
    it('should handle rapid sequential calls', async () => {
      // Make 10 rapid sequential calls
      for (let i = 0; i < 10; i++) {
        const session = await alice.call.makeCall(bob.getIdentity().uri)
        await alice.call.terminateCall(session.id)
        alice.getMockServer().simulateCallEnded(session, 'local')
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const metrics = alice.getMetrics()
      expect(metrics.callsMade).toBe(10)
    })

    it('should handle many messages in quick succession', async () => {
      // Send 20 messages rapidly
      for (let i = 0; i < 20; i++) {
        await manager.sendMessageBetweenAgents('alice', 'bob', `Message ${i}`)
      }

      const aliceMetrics = alice.getMetrics()
      const bobMetrics = bob.getMetrics()

      expect(aliceMetrics.messagesSent).toBe(20)
      expect(bobMetrics.messagesReceived).toBe(20)
    })

    it('should handle agent managing many simultaneous operations', async () => {
      // Alice makes calls to multiple agents
      const callToBob = await alice.call.makeCall(bob.getIdentity().uri)
      const callToCharlie = await alice.call.makeCall(charlie.getIdentity().uri)
      const callToDavid = await alice.call.makeCall(david.getIdentity().uri)

      // Send messages while on calls
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Hello!')
      await manager.sendMessageBetweenAgents('alice', 'charlie', 'Hi there!')

      // Change media settings
      alice.media.setVideoEnabled(true)
      alice.media.setAudioEnabled(false)

      // Hold one call
      await alice.call.holdCall(callToBob.id)

      // Verify Alice is handling all operations
      expect(alice.call.getActiveCalls()).toHaveLength(3)

      const metrics = alice.getMetrics()
      expect(metrics.callsMade).toBe(3)
      expect(metrics.messagesSent).toBe(2)
    })
  })

  describe('Presence and Status Scenarios', () => {
    it('should handle status changes during calls', async () => {
      // Alice is online
      expect(alice.presence.getStatus()).toBe('online')

      // Alice makes a call
      await manager.setupCall('alice', 'bob', true)

      // Alice sets status to busy
      alice.presence.setStatus('busy', 'On a call')

      expect(alice.presence.getStatus()).toBe('busy')
      expect(alice.presence.getStatusMessage()).toBe('On a call')

      // Call ends, status back to online
      const aliceCall = alice.call.getActiveCalls()[0]
      await alice.call.terminateCall(aliceCall.id)

      alice.presence.setStatus('online')
      expect(alice.presence.getStatus()).toBe('online')
    })

    it('should handle message exchange based on presence', async () => {
      // Check Bob is online before messaging
      expect(bob.presence.getStatus()).toBe('online')

      // Send message
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Are you available?')

      // Bob is busy
      bob.presence.setStatus('busy')

      // Alice waits for Bob to be available
      expect(bob.presence.getStatus()).toBe('busy')

      // Bob becomes available
      bob.presence.setStatus('online')

      // Continue conversation
      await manager.sendMessageBetweenAgents('bob', 'alice', 'Yes, I am now!')

      const messages = alice.presence.getMessages()
      expect(messages.length).toBeGreaterThan(0)
    })
  })
})
