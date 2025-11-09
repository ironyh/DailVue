/**
 * Agent-to-Agent Integration Tests
 *
 * Tests basic agent-to-agent interactions:
 * - Call scenarios
 * - Messaging
 * - Call controls (hold, mute, transfer)
 * - Multi-agent scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createAgentManager,
  createAgentIdentity,
  type AgentManager,
  type SipTestAgent,
} from '../agents'

describe('Agent-to-Agent Integration Tests', () => {
  let manager: AgentManager
  let alice: SipTestAgent
  let bob: SipTestAgent
  let charlie: SipTestAgent

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create agent manager
    manager = createAgentManager({ verbose: false })

    // Create agents
    alice = await manager.createAgent({
      identity: createAgentIdentity('alice', 'alice'),
      autoRegister: true,
    })

    bob = await manager.createAgent({
      identity: createAgentIdentity('bob', 'bob'),
      autoRegister: true,
    })

    charlie = await manager.createAgent({
      identity: createAgentIdentity('charlie', 'charlie'),
      autoRegister: true,
    })

    // Connect and register all agents
    await manager.connectAllAgents()
    await manager.registerAllAgents()
  })

  afterEach(async () => {
    await manager.destroy()
  })

  describe('Basic Call Scenarios', () => {
    it('should establish a call between two agents', async () => {
      // Setup call
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Verify call state
      expect(alice.call.getActiveCalls()).toHaveLength(1)
      expect(bob.call.getActiveCalls()).toHaveLength(1)

      const aliceCall = alice.call.getCall(sessionId)
      expect(aliceCall).toBeDefined()
      expect(aliceCall?.id).toBe(sessionId)

      // Verify metrics
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.callsMade).toBe(1)

      const bobMetrics = bob.getMetrics()
      expect(bobMetrics.callsReceived).toBe(1)
    })

    it('should allow agent to answer incoming call', async () => {
      // Alice calls Bob (without auto-answer)
      const session = await alice.call.makeCall(bob.getIdentity().uri)

      // Simulate incoming call to Bob
      const bobSession = bob.getMockServer().simulateIncomingCall(
        alice.getIdentity().uri,
        bob.getIdentity().uri
      )

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100))

      // Bob answers
      await bob.call.answerCall(bobSession.id)

      // Verify Bob accepted the call
      const bobMetrics = bob.getMetrics()
      expect(bobMetrics.callsAccepted).toBe(1)
    })

    it('should allow agent to reject incoming call', async () => {
      // Alice calls Bob
      const session = await alice.call.makeCall(bob.getIdentity().uri)

      // Simulate incoming call to Bob
      const bobSession = bob.getMockServer().simulateIncomingCall(
        alice.getIdentity().uri,
        bob.getIdentity().uri
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Bob rejects
      await bob.call.rejectCall(bobSession.id)

      // Verify Bob rejected the call
      const bobMetrics = bob.getMetrics()
      expect(bobMetrics.callsRejected).toBe(1)
    })

    it('should allow either party to terminate a call', async () => {
      // Setup call
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Alice terminates
      await alice.call.terminateCall(sessionId)

      // Simulate call ended
      const aliceSession = alice.call.getCall(sessionId)
      if (aliceSession) {
        alice.getMockServer().simulateCallEnded(aliceSession, 'local')
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify call ended
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.callsEnded).toBeGreaterThan(0)
    })

    it('should handle multiple sequential calls', async () => {
      // First call
      const call1 = await manager.setupCall('alice', 'bob', true)
      await alice.call.terminateCall(call1.sessionId)

      await new Promise(resolve => setTimeout(resolve, 200))

      // Second call
      const call2 = await manager.setupCall('alice', 'bob', true)

      // Verify metrics
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.callsMade).toBe(2)
    })

    it('should handle simultaneous calls to different agents', async () => {
      // Alice calls both Bob and Charlie
      const call1 = await manager.setupCall('alice', 'bob', true)
      const call2 = await manager.setupCall('alice', 'charlie', true)

      // Verify Alice has two active calls
      expect(alice.call.getActiveCalls()).toHaveLength(2)

      // Verify metrics
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.callsMade).toBe(2)
    })
  })

  describe('Call Controls', () => {
    it('should allow agent to hold and unhold a call', async () => {
      // Setup call
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Alice holds the call
      await alice.call.holdCall(sessionId)

      // Simulate hold event
      const aliceSession = alice.call.getCall(sessionId)
      if (aliceSession) {
        alice.getMockServer().simulateHold(aliceSession, 'local')
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      // Alice unholds the call
      await alice.call.unholdCall(sessionId)

      // Simulate unhold event
      if (aliceSession) {
        alice.getMockServer().simulateUnhold(aliceSession, 'local')
      }

      // Verify session still exists
      expect(alice.call.getCall(sessionId)).toBeDefined()
    })

    it('should allow agent to transfer a call', async () => {
      // Setup call between Alice and Bob
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Alice transfers Bob to Charlie
      await alice.call.transferCall(sessionId, charlie.getIdentity().uri)

      // Verify transfer was initiated
      expect(alice.call.getCall(sessionId)).toBeDefined()
    })

    it('should allow agent to send DTMF tones', async () => {
      // Setup call
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Alice sends DTMF tones
      await alice.call.sendDTMF(sessionId, '1')
      await alice.call.sendDTMF(sessionId, '2')
      await alice.call.sendDTMF(sessionId, '3')

      // Verify session still exists
      expect(alice.call.getCall(sessionId)).toBeDefined()
    })
  })

  describe('Messaging', () => {
    it('should allow agents to exchange messages', async () => {
      // Alice sends message to Bob
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Hello Bob!')

      // Verify message sent
      const aliceMessages = alice.presence.getMessages()
      expect(aliceMessages).toHaveLength(1)
      expect(aliceMessages[0].body).toBe('Hello Bob!')
      expect(aliceMessages[0].direction).toBe('outgoing')

      // Verify message received
      const bobMessages = bob.presence.getMessages()
      expect(bobMessages).toHaveLength(1)
      expect(bobMessages[0].body).toBe('Hello Bob!')
      expect(bobMessages[0].direction).toBe('incoming')

      // Verify metrics
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.messagesSent).toBe(1)

      const bobMetrics = bob.getMetrics()
      expect(bobMetrics.messagesReceived).toBe(1)
    })

    it('should handle multiple messages between agents', async () => {
      // Exchange multiple messages
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Message 1')
      await manager.sendMessageBetweenAgents('bob', 'alice', 'Reply 1')
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Message 2')

      // Verify message counts
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.messagesSent).toBe(2)
      expect(aliceMetrics.messagesReceived).toBe(1)

      const bobMetrics = bob.getMetrics()
      expect(bobMetrics.messagesSent).toBe(1)
      expect(bobMetrics.messagesReceived).toBe(2)
    })

    it('should allow agents to exchange messages with multiple parties', async () => {
      // Alice messages Bob and Charlie
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Hello Bob!')
      await manager.sendMessageBetweenAgents('alice', 'charlie', 'Hello Charlie!')

      // Verify Alice sent 2 messages
      const aliceMetrics = alice.getMetrics()
      expect(aliceMetrics.messagesSent).toBe(2)

      // Verify Bob and Charlie each received 1 message
      const bobMetrics = bob.getMetrics()
      expect(bobMetrics.messagesReceived).toBe(1)

      const charlieMetrics = charlie.getMetrics()
      expect(charlieMetrics.messagesReceived).toBe(1)
    })
  })

  describe('Media Management', () => {
    it('should allow agents to enable/disable audio', async () => {
      // Setup call
      await manager.setupCall('alice', 'bob', true)

      // Alice disables audio
      alice.media.setAudioEnabled(false)
      expect(alice.media.isAudioEnabled()).toBe(false)

      // Alice enables audio
      alice.media.setAudioEnabled(true)
      expect(alice.media.isAudioEnabled()).toBe(true)
    })

    it('should allow agents to enable/disable video', async () => {
      // Setup call
      await manager.setupCall('alice', 'bob', true)

      // Alice enables video
      alice.media.setVideoEnabled(true)
      expect(alice.media.isVideoEnabled()).toBe(true)

      // Alice disables video
      alice.media.setVideoEnabled(false)
      expect(alice.media.isVideoEnabled()).toBe(false)
    })

    it('should allow agents to select audio devices', async () => {
      // Enumerate devices
      const devices = await alice.media.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')

      expect(audioInputs.length).toBeGreaterThan(0)

      // Select a different audio input
      alice.media.selectAudioInput(audioInputs[0].deviceId)

      // Verify selection
      const state = alice.media.getState()
      expect(state.selectedAudioInput).toBe(audioInputs[0].deviceId)
    })
  })

  describe('Presence Management', () => {
    it('should allow agents to change presence status', () => {
      // Alice changes status to busy
      alice.presence.setStatus('busy', 'In a meeting')

      expect(alice.presence.getStatus()).toBe('busy')
      expect(alice.presence.getStatusMessage()).toBe('In a meeting')

      // Alice changes status to online
      alice.presence.setStatus('online')

      expect(alice.presence.getStatus()).toBe('online')
    })

    it('should emit events when presence status changes', async () => {
      const statusChanges: any[] = []

      manager.on('presence:status-changed', (data: any) => {
        statusChanges.push(data)
      })

      // Change status
      alice.presence.setStatus('away', 'Be back soon')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(statusChanges).toHaveLength(1)
      expect(statusChanges[0].agentId).toBe('alice')
      expect(statusChanges[0].newStatus).toBe('away')
    })
  })

  describe('Agent Statistics', () => {
    it('should track agent metrics accurately', async () => {
      // Make some calls and send messages
      await manager.setupCall('alice', 'bob', true)
      await manager.setupCall('bob', 'charlie', true)
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Hello')

      // Get statistics
      const stats = manager.getStatistics()

      expect(stats.totalAgents).toBe(3)
      expect(stats.connectedAgents).toBe(3)
      expect(stats.registeredAgents).toBe(3)
      expect(stats.totalCallsMade).toBe(2)
      expect(stats.totalMessagesExchanged).toBe(2) // 1 sent + 1 received
    })

    it('should track individual agent state', () => {
      const aliceState = alice.getState()

      expect(aliceState.connected).toBe(true)
      expect(aliceState.registered).toBe(true)
      expect(aliceState.presenceStatus).toBe('online')
    })
  })

  describe('Agent Lifecycle', () => {
    it('should cleanup agent resources properly', async () => {
      // Setup call
      await manager.setupCall('alice', 'bob', true)

      // Cleanup Alice
      await alice.cleanup()

      // Verify Alice is cleaned up
      expect(alice.isInitialized()).toBe(false)
      expect(alice.call.getActiveCalls()).toHaveLength(0)
    })

    it('should allow removing agents from manager', async () => {
      const initialCount = manager.getAllAgents().length

      // Remove Bob
      await manager.removeAgent('bob')

      const finalCount = manager.getAllAgents().length
      expect(finalCount).toBe(initialCount - 1)
      expect(manager.getAgent('bob')).toBeUndefined()
    })
  })
})
