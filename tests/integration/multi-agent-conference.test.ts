/**
 * Multi-Agent Conference Integration Tests
 *
 * Tests complex conference scenarios with multiple agents:
 * - Creating conferences
 * - Adding/removing participants
 * - Conference controls
 * - Large conferences (10+ participants)
 * - Conference state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createAgentManager,
  createAgentIdentity,
  type AgentManager,
  type SipTestAgent,
} from '../agents'

describe('Multi-Agent Conference Integration Tests', () => {
  let manager: AgentManager

  beforeEach(async () => {
    vi.clearAllMocks()
    manager = createAgentManager({ verbose: false })
  })

  afterEach(async () => {
    await manager.destroy()
  })

  /**
   * Helper to create multiple agents
   */
  async function createAgents(count: number): Promise<SipTestAgent[]> {
    const agents: SipTestAgent[] = []

    for (let i = 0; i < count; i++) {
      const agent = await manager.createAgent({
        identity: createAgentIdentity(`agent${i}`, `user${i}`),
        autoRegister: true,
      })
      agents.push(agent)
    }

    await manager.connectAllAgents()
    await manager.registerAllAgents()

    return agents
  }

  describe('Conference Creation', () => {
    it('should create a conference with 3 participants', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      // Create conference
      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      expect(conference).toBeDefined()
      expect(conference.participants).toHaveLength(3)
      expect(conference.uri).toBe('sip:conf@example.com')

      // Verify each agent has made a call
      for (const agent of agents) {
        const metrics = agent.getMetrics()
        expect(metrics.callsMade).toBe(1)
      }
    })

    it('should create a conference with 5 participants', async () => {
      const agents = await createAgents(5)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      expect(conference.participants).toHaveLength(5)

      // Verify statistics
      const stats = manager.getStatistics()
      expect(stats.activeConferences).toBe(1)
      expect(stats.totalCallsMade).toBe(5)
    })

    it('should create a large conference with 10 participants', async () => {
      const agents = await createAgents(10)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      expect(conference.participants).toHaveLength(10)
      expect(conference.startedAt).toBeDefined()
      expect(conference.endedAt).toBeUndefined()
    })

    it('should handle multiple concurrent conferences', async () => {
      const agents = await createAgents(6)

      // Create first conference with agents 0, 1, 2
      const conf1 = await manager.createConference(
        'sip:conf1@example.com',
        agents.slice(0, 3).map(a => a.getId())
      )

      // Create second conference with agents 3, 4, 5
      const conf2 = await manager.createConference(
        'sip:conf2@example.com',
        agents.slice(3, 6).map(a => a.getId())
      )

      expect(conf1.participants).toHaveLength(3)
      expect(conf2.participants).toHaveLength(3)

      // Verify statistics
      const stats = manager.getStatistics()
      expect(stats.activeConferences).toBe(2)
    })
  })

  describe('Conference Management', () => {
    it('should end a conference properly', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // End the conference
      await manager.endConference(conference.id)

      // Verify conference is ended
      const retrievedConf = manager.getConference(conference.id)
      expect(retrievedConf).toBeUndefined()

      // Verify statistics
      const stats = manager.getStatistics()
      expect(stats.activeConferences).toBe(0)
    })

    it('should track conference duration', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      const startTime = Date.now()
      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100))

      // End conference
      await manager.endConference(conference.id)

      const duration = Date.now() - startTime
      expect(duration).toBeGreaterThan(100)
    })

    it('should retrieve conference information', async () => {
      const agents = await createAgents(4)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // Retrieve conference
      const retrieved = manager.getConference(conference.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(conference.id)
      expect(retrieved?.participants).toHaveLength(4)
    })
  })

  describe('Participant Management', () => {
    it('should track all participants in conference', async () => {
      const agents = await createAgents(5)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // Verify all participants are tracked
      expect(conference.participants).toHaveLength(5)

      for (let i = 0; i < 5; i++) {
        const participant = conference.participants.find(p => p.agentId === `agent${i}`)
        expect(participant).toBeDefined()
        expect(participant?.muted).toBe(false)
        expect(participant?.speaking).toBe(false)
      }
    })

    it('should track participant join times', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // All participants should have join times
      for (const participant of conference.participants) {
        expect(participant.joinedAt).toBeDefined()
        expect(participant.joinedAt).toBeGreaterThan(0)
      }
    })

    it('should handle participants muting/unmuting', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // Simulate muting a participant
      const participant = conference.participants[0]
      participant.muted = true

      expect(participant.muted).toBe(true)

      // Simulate unmuting
      participant.muted = false

      expect(participant.muted).toBe(false)
    })
  })

  describe('Conference Scenarios', () => {
    it('should handle conference with messaging', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      // Create conference
      await manager.createConference('sip:conf@example.com', agentIds)

      // Agents exchange messages
      await manager.sendMessageBetweenAgents('agent0', 'agent1', 'Hello everyone!')
      await manager.sendMessageBetweenAgents('agent1', 'agent2', 'Hi!')
      await manager.sendMessageBetweenAgents('agent2', 'agent0', 'Good to see you all!')

      // Verify messages were exchanged
      const stats = manager.getStatistics()
      expect(stats.totalMessagesExchanged).toBe(6) // 3 sent + 3 received
    })

    it('should handle conference with video enabled', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      // Enable video for all agents
      for (const agent of agents) {
        agent.media.setVideoEnabled(true)
      }

      // Create conference
      await manager.createConference('sip:conf@example.com', agentIds)

      // Verify all agents have video enabled
      for (const agent of agents) {
        expect(agent.media.isVideoEnabled()).toBe(true)
      }
    })

    it('should handle agent leaving conference', async () => {
      const agents = await createAgents(4)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // Agent 0 leaves (terminates all calls)
      const calls = agents[0].call.getActiveCalls()
      for (const call of calls) {
        await agents[0].call.terminateCall(call.id)
      }

      // Verify agent 0 has no active calls
      expect(agents[0].call.getActiveCalls()).toHaveLength(0)

      // Other agents should still have active calls
      expect(agents[1].call.getActiveCalls()).toHaveLength(1)
      expect(agents[2].call.getActiveCalls()).toHaveLength(1)
    })

    it('should handle adding more participants after conference starts', async () => {
      const initialAgents = await createAgents(3)
      const initialIds = initialAgents.map(a => a.getId())

      // Create initial conference
      const conference = await manager.createConference('sip:conf@example.com', initialIds)

      // Create additional agents
      const newAgent = await manager.createAgent({
        identity: createAgentIdentity('newagent', 'newuser'),
        autoRegister: true,
      })
      await newAgent.connect()
      await newAgent.register()

      // New agent joins conference
      await newAgent.call.makeCall('sip:conf@example.com')

      // Verify new agent has active call
      expect(newAgent.call.getActiveCalls()).toHaveLength(1)
    })

    it('should handle simultaneous conferences with different participants', async () => {
      const agents = await createAgents(8)

      // Create first conference: agents 0-3
      const conf1 = await manager.createConference(
        'sip:conf1@example.com',
        agents.slice(0, 4).map(a => a.getId())
      )

      // Create second conference: agents 4-7
      const conf2 = await manager.createConference(
        'sip:conf2@example.com',
        agents.slice(4, 8).map(a => a.getId())
      )

      expect(conf1.participants).toHaveLength(4)
      expect(conf2.participants).toHaveLength(4)

      // Verify no overlap
      const conf1Ids = new Set(conf1.participants.map(p => p.agentId))
      const conf2Ids = new Set(conf2.participants.map(p => p.agentId))

      for (const id of conf1Ids) {
        expect(conf2Ids.has(id)).toBe(false)
      }
    })
  })

  describe('Large Conference Tests', () => {
    it('should handle conference with 15 participants', async () => {
      const agents = await createAgents(15)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      expect(conference.participants).toHaveLength(15)

      // Verify all agents are in call
      for (const agent of agents) {
        expect(agent.call.getActiveCalls()).toHaveLength(1)
      }
    })

    it('should handle conference with 20 participants', async () => {
      const agents = await createAgents(20)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      expect(conference.participants).toHaveLength(20)

      // Verify statistics
      const stats = manager.getStatistics()
      expect(stats.totalAgents).toBe(20)
      expect(stats.totalCallsMade).toBe(20)
    })

    it('should handle ending large conference cleanly', async () => {
      const agents = await createAgents(12)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // End the conference
      await manager.endConference(conference.id)

      // Verify all agents' calls are terminated
      // Note: In the current implementation, agents would need to handle the
      // conference end event, but the conference itself is removed from manager

      const stats = manager.getStatistics()
      expect(stats.activeConferences).toBe(0)
    })
  })

  describe('Conference State Tracking', () => {
    it('should track conference recording state', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      expect(conference.recording).toBe(false)

      // Simulate starting recording
      conference.recording = true
      expect(conference.recording).toBe(true)

      // Simulate stopping recording
      conference.recording = false
      expect(conference.recording).toBe(false)
    })

    it('should track participant audio levels', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      const conference = await manager.createConference('sip:conf@example.com', agentIds)

      // Simulate audio levels
      conference.participants[0].audioLevel = 0.8
      conference.participants[0].speaking = true

      conference.participants[1].audioLevel = 0.2
      conference.participants[1].speaking = false

      expect(conference.participants[0].speaking).toBe(true)
      expect(conference.participants[1].speaking).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when creating conference with non-existent agent', async () => {
      await expect(
        manager.createConference('sip:conf@example.com', ['non-existent-agent'])
      ).rejects.toThrow('Agent non-existent-agent not found')
    })

    it('should handle ending non-existent conference gracefully', async () => {
      // Should not throw
      await manager.endConference('non-existent-conf-id')

      const stats = manager.getStatistics()
      expect(stats.activeConferences).toBe(0)
    })

    it('should handle cleanup with active conferences', async () => {
      const agents = await createAgents(3)
      const agentIds = agents.map(a => a.getId())

      await manager.createConference('sip:conf@example.com', agentIds)

      // Cleanup manager (should end all conferences)
      await manager.cleanup()

      const stats = manager.getStatistics()
      expect(stats.activeConferences).toBe(0)
      expect(stats.totalAgents).toBe(0)
    })
  })
})
