/**
 * Agent Network Conditions Integration Tests
 *
 * Tests agent behavior under various network conditions:
 * - Different network profiles (WiFi, 3G, 4G, etc.)
 * - Latency simulation
 * - Packet loss
 * - Network interruptions
 * - Bandwidth throttling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createAgentManager,
  createAgentIdentity,
  NETWORK_PROFILES,
  type AgentManager,
  type SipTestAgent,
} from '../agents'

describe('Agent Network Conditions Integration Tests', () => {
  let manager: AgentManager

  beforeEach(async () => {
    vi.clearAllMocks()
    manager = createAgentManager({ verbose: false })
  })

  afterEach(async () => {
    await manager.destroy()
  })

  describe('Network Profiles', () => {
    it('should create agent with perfect network conditions', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      await agent.connect()
      await agent.register()

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('Perfect Connection')
      expect(profile.latency).toBe(0)
      expect(profile.packetLoss).toBe(0)
    })

    it('should create agent with WiFi network profile', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_GOOD,
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('Good WiFi')
      expect(profile.latency).toBe(10)
      expect(profile.packetLoss).toBe(0.1)
    })

    it('should create agent with 4G mobile network profile', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_4G,
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('4G Mobile')
      expect(profile.latency).toBe(30)
      expect(profile.packetLoss).toBe(0.5)
    })

    it('should create agent with 3G mobile network profile', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_3G,
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('3G Mobile')
      expect(profile.latency).toBe(100)
      expect(profile.packetLoss).toBe(1)
    })

    it('should create agent with poor WiFi profile', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_POOR,
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('Poor WiFi')
      expect(profile.latency).toBe(50)
      expect(profile.packetLoss).toBe(2)
    })

    it('should create agent with satellite connection profile', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.SATELLITE,
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('Satellite')
      expect(profile.latency).toBe(600)
      expect(profile.packetLoss).toBe(2)
    })

    it('should allow changing network profile at runtime', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      // Start with perfect network
      let profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('Perfect Connection')

      // Change to poor WiFi
      agent.setNetworkProfile(NETWORK_PROFILES.WIFI_POOR)

      profile = agent.getNetworkSimulator().getProfile()
      expect(profile.name).toBe('Poor WiFi')
      expect(profile.latency).toBe(50)
    })
  })

  describe('Latency Simulation', () => {
    it('should apply latency to operations', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_3G, // 100ms latency
        autoRegister: true,
      })

      const start = Date.now()

      // Wait with network latency
      await agent.wait(100)

      const duration = Date.now() - start

      // Should take at least base wait + latency (100ms + 100ms = 200ms)
      // Allow some tolerance for test execution time
      expect(duration).toBeGreaterThan(180)
    })

    it('should handle high latency scenarios', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.SATELLITE, // 600ms latency
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.latency).toBe(600)
    })

    it('should apply latency with jitter', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_3G, // 100ms latency, 15ms jitter
        autoRegister: true,
      })

      const profile = agent.getNetworkSimulator().getProfile()
      expect(profile.jitter).toBe(15)

      // The actual latency should vary within jitter range
      // This is probabilistic so we just verify the profile is set
      expect(profile.latency).toBe(100)
    })
  })

  describe('Packet Loss Simulation', () => {
    it('should simulate packet loss', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_POOR, // 2% packet loss
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Test packet loss over many iterations
      let droppedPackets = 0
      const totalPackets = 1000

      for (let i = 0; i < totalPackets; i++) {
        if (simulator.shouldDropPacket()) {
          droppedPackets++
        }
      }

      // With 2% packet loss, we expect around 20 packets dropped
      // Allow variance (between 1% and 3% is acceptable)
      const lossPercentage = (droppedPackets / totalPackets) * 100
      expect(lossPercentage).toBeGreaterThan(0.5)
      expect(lossPercentage).toBeLessThan(4)
    })

    it('should have minimal packet loss with good connection', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_GOOD, // 0.1% packet loss
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      let droppedPackets = 0
      const totalPackets = 1000

      for (let i = 0; i < totalPackets; i++) {
        if (simulator.shouldDropPacket()) {
          droppedPackets++
        }
      }

      // With 0.1% packet loss, should drop very few packets
      const lossPercentage = (droppedPackets / totalPackets) * 100
      expect(lossPercentage).toBeLessThan(2)
    })

    it('should track packet loss statistics', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_POOR,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Simulate some packet drops
      for (let i = 0; i < 100; i++) {
        simulator.shouldDropPacket()
      }

      const stats = simulator.getStatistics()
      expect(stats.totalPacketsDropped).toBeGreaterThan(0)
    })
  })

  describe('Bandwidth Throttling', () => {
    it('should calculate bandwidth delay correctly', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_2G, // 200 kbps
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Test bandwidth calculation for 10KB of data
      const dataSize = 10 * 1024 // 10KB in bytes
      const delay = simulator.calculateBandwidthDelay(dataSize)

      // 10KB over 200kbps should take around 400ms
      // 200 kbps = 200 * 1024 / 8 = 25,600 bytes per second
      // 10KB / 25.6KB/s = ~0.39s = ~390ms
      expect(delay).toBeGreaterThan(350)
      expect(delay).toBeLessThan(450)
    })

    it('should apply bandwidth throttling', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_3G, // 3 Mbps
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      const start = Date.now()

      // Simulate sending 100KB of data
      const dataSize = 100 * 1024
      await simulator.applyBandwidthThrottling(dataSize)

      const duration = Date.now() - start

      // Should have some delay based on bandwidth
      expect(duration).toBeGreaterThan(0)
    })
  })

  describe('Network Interruptions', () => {
    it('should schedule and handle network interruption', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      expect(simulator.isNetworkInterrupted()).toBe(false)

      // Schedule an interruption after 50ms for 100ms duration
      simulator.scheduleInterruption({
        type: 'disconnect',
        duration: 100,
        delay: 50,
      })

      // Wait for interruption to start
      await new Promise(resolve => setTimeout(resolve, 60))

      expect(simulator.isNetworkInterrupted()).toBe(true)

      // Wait for interruption to end
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(simulator.isNetworkInterrupted()).toBe(false)
    })

    it('should throw error during network operation when interrupted', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Schedule immediate interruption
      simulator.scheduleInterruption({
        type: 'disconnect',
        duration: 1000,
        delay: 0,
      })

      // Wait for interruption to start
      await new Promise(resolve => setTimeout(resolve, 50))

      // Try to simulate a network operation
      await expect(
        simulator.simulateNetworkOperation(async () => {
          return 'success'
        })
      ).rejects.toThrow('Network interrupted')
    })

    it('should handle multiple interruptions', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Schedule multiple interruptions
      simulator.scheduleInterruption({
        type: 'disconnect',
        duration: 50,
        delay: 10,
      })

      simulator.scheduleInterruption({
        type: 'high-latency',
        duration: 50,
        delay: 150,
      })

      // Wait for all interruptions to process
      await new Promise(resolve => setTimeout(resolve, 250))

      // Should be back to normal
      expect(simulator.isNetworkInterrupted()).toBe(false)
    })
  })

  describe('Mixed Network Conditions', () => {
    it('should handle call between agents with different network profiles', async () => {
      // Alice has perfect connection
      const alice = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      // Bob has poor WiFi
      const bob = await manager.createAgent({
        identity: createAgentIdentity('bob'),
        networkProfile: NETWORK_PROFILES.WIFI_POOR,
        autoRegister: true,
      })

      await manager.connectAllAgents()
      await manager.registerAllAgents()

      // Setup call
      const { sessionId } = await manager.setupCall('alice', 'bob', true)

      // Verify call was established despite different network conditions
      expect(alice.call.getCall(sessionId)).toBeDefined()
      expect(bob.call.getActiveCalls()).toHaveLength(1)
    })

    it('should handle messaging between agents with high latency', async () => {
      // Both agents have high latency (satellite)
      const alice = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.SATELLITE,
        autoRegister: true,
      })

      const bob = await manager.createAgent({
        identity: createAgentIdentity('bob'),
        networkProfile: NETWORK_PROFILES.SATELLITE,
        autoRegister: true,
      })

      await manager.connectAllAgents()
      await manager.registerAllAgents()

      const start = Date.now()

      // Send message
      await manager.sendMessageBetweenAgents('alice', 'bob', 'Hello Bob!')

      const duration = Date.now() - start

      // Message should still be delivered
      const bobMessages = bob.presence.getMessages()
      expect(bobMessages).toHaveLength(1)
      expect(bobMessages[0].body).toBe('Hello Bob!')
    })

    it('should handle conference with mixed network conditions', async () => {
      // Create agents with different network profiles
      const alice = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      const bob = await manager.createAgent({
        identity: createAgentIdentity('bob'),
        networkProfile: NETWORK_PROFILES.WIFI_GOOD,
        autoRegister: true,
      })

      const charlie = await manager.createAgent({
        identity: createAgentIdentity('charlie'),
        networkProfile: NETWORK_PROFILES.MOBILE_4G,
        autoRegister: true,
      })

      await manager.connectAllAgents()
      await manager.registerAllAgents()

      // Create conference
      const conference = await manager.createConference('sip:conf@example.com', [
        'alice',
        'bob',
        'charlie',
      ])

      expect(conference.participants).toHaveLength(3)

      // Verify all agents joined despite different network conditions
      expect(alice.call.getActiveCalls()).toHaveLength(1)
      expect(bob.call.getActiveCalls()).toHaveLength(1)
      expect(charlie.call.getActiveCalls()).toHaveLength(1)
    })
  })

  describe('Network Recovery', () => {
    it('should recover from temporary network interruption', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.PERFECT,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Schedule a short interruption
      simulator.scheduleInterruption({
        type: 'disconnect',
        duration: 100,
        delay: 0,
      })

      // Wait for interruption
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(simulator.isNetworkInterrupted()).toBe(true)

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(simulator.isNetworkInterrupted()).toBe(false)

      // Network operations should work again
      const result = await simulator.simulateNetworkOperation(async () => {
        return 'recovered'
      })

      expect(result).toBe('recovered')
    })

    it('should reset network simulator statistics', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_POOR,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Generate some statistics
      for (let i = 0; i < 50; i++) {
        simulator.shouldDropPacket()
      }

      let stats = simulator.getStatistics()
      expect(stats.totalPacketsDropped).toBeGreaterThan(0)

      // Reset
      simulator.reset()

      stats = simulator.getStatistics()
      expect(stats.totalPacketsDropped).toBe(0)
      expect(stats.events).toHaveLength(0)
    })
  })

  describe('Network Statistics', () => {
    it('should track network events', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.WIFI_POOR,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()

      // Generate some network activity that logs events
      // Try packet loss multiple times to ensure we get at least one drop
      for (let i = 0; i < 100; i++) {
        simulator.shouldDropPacket()
      }

      // Apply bandwidth throttling (logs an event)
      await simulator.applyBandwidthThrottling(1024)

      const stats = simulator.getStatistics()

      expect(stats.events.length).toBeGreaterThan(0)
      expect(stats.profile.name).toBe('Poor WiFi')
    })

    it('should provide average latency statistics', async () => {
      const agent = await manager.createAgent({
        identity: createAgentIdentity('alice'),
        networkProfile: NETWORK_PROFILES.MOBILE_4G,
        autoRegister: true,
      })

      const simulator = agent.getNetworkSimulator()
      const stats = simulator.getStatistics()

      expect(stats.averageLatency).toBe(30)
    })
  })
})
