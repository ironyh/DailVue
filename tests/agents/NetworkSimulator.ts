/**
 * Network Simulator
 *
 * Simulates various network conditions for testing:
 * - Latency
 * - Packet loss
 * - Bandwidth throttling
 * - Connection interruptions
 * - Jitter
 */

import type { NetworkProfile, NetworkInterruption } from './types'

/**
 * Predefined network profiles for common scenarios
 */
export const NETWORK_PROFILES: Record<string, NetworkProfile> = {
  PERFECT: {
    name: 'Perfect Connection',
    latency: 0,
    packetLoss: 0,
    bandwidth: 100000, // 100 Mbps
    jitter: 0,
  },
  WIFI_GOOD: {
    name: 'Good WiFi',
    latency: 10,
    packetLoss: 0.1,
    bandwidth: 50000, // 50 Mbps
    jitter: 2,
  },
  WIFI_POOR: {
    name: 'Poor WiFi',
    latency: 50,
    packetLoss: 2,
    bandwidth: 5000, // 5 Mbps
    jitter: 10,
  },
  MOBILE_4G: {
    name: '4G Mobile',
    latency: 30,
    packetLoss: 0.5,
    bandwidth: 20000, // 20 Mbps
    jitter: 5,
  },
  MOBILE_3G: {
    name: '3G Mobile',
    latency: 100,
    packetLoss: 1,
    bandwidth: 3000, // 3 Mbps
    jitter: 15,
  },
  MOBILE_2G: {
    name: '2G Mobile',
    latency: 300,
    packetLoss: 3,
    bandwidth: 200, // 200 Kbps
    jitter: 50,
  },
  SATELLITE: {
    name: 'Satellite',
    latency: 600,
    packetLoss: 2,
    bandwidth: 2000, // 2 Mbps
    jitter: 100,
  },
  CONGESTED: {
    name: 'Congested Network',
    latency: 200,
    packetLoss: 5,
    bandwidth: 1000, // 1 Mbps
    jitter: 80,
  },
}

/**
 * Network event for tracking
 */
interface NetworkEvent {
  timestamp: number
  type: 'latency' | 'packet-loss' | 'bandwidth' | 'interrupt'
  details: string
}

/**
 * Network Simulator class
 */
export class NetworkSimulator {
  private currentProfile: NetworkProfile
  private interruptions: NetworkInterruption[] = []
  private events: NetworkEvent[] = []
  private isInterrupted = false
  private interruptionTimer: NodeJS.Timeout | null = null

  constructor(profile: NetworkProfile = NETWORK_PROFILES.PERFECT) {
    this.currentProfile = profile
  }

  /**
   * Set network profile
   */
  setProfile(profile: NetworkProfile): void {
    this.currentProfile = profile
    this.logEvent('latency', `Profile changed to: ${profile.name}`)
  }

  /**
   * Get current profile
   */
  getProfile(): NetworkProfile {
    return { ...this.currentProfile }
  }

  /**
   * Apply latency to a promise
   */
  async applyLatency<T>(promise: Promise<T> | T): Promise<T> {
    const baseLatency = this.currentProfile.latency
    const jitter = this.currentProfile.jitter

    // Calculate actual latency with jitter
    const actualLatency = baseLatency + (Math.random() * jitter * 2 - jitter)

    if (actualLatency > 0) {
      await this.delay(actualLatency)
    }

    return promise instanceof Promise ? promise : Promise.resolve(promise)
  }

  /**
   * Simulate packet loss
   * @returns true if packet should be dropped
   */
  shouldDropPacket(): boolean {
    if (this.isInterrupted) {
      return true
    }

    const random = Math.random() * 100
    const dropped = random < this.currentProfile.packetLoss

    if (dropped) {
      this.logEvent('packet-loss', 'Packet dropped')
    }

    return dropped
  }

  /**
   * Calculate bandwidth delay for data size
   */
  calculateBandwidthDelay(dataSize: number): number {
    // dataSize in bytes, bandwidth in kbps
    const bandwidthBps = this.currentProfile.bandwidth * 1024 / 8 // Convert to bytes per second
    const delay = (dataSize / bandwidthBps) * 1000 // Convert to milliseconds
    return delay
  }

  /**
   * Apply bandwidth throttling
   */
  async applyBandwidthThrottling(dataSize: number): Promise<void> {
    const delay = this.calculateBandwidthDelay(dataSize)
    if (delay > 0) {
      await this.delay(delay)
      this.logEvent('bandwidth', `Throttled for ${delay.toFixed(2)}ms (${dataSize} bytes)`)
    }
  }

  /**
   * Schedule a network interruption
   */
  scheduleInterruption(interruption: NetworkInterruption): void {
    this.interruptions.push(interruption)

    const delay = interruption.delay || 0

    setTimeout(() => {
      this.startInterruption(interruption)
    }, delay)
  }

  /**
   * Start a network interruption
   */
  private startInterruption(interruption: NetworkInterruption): void {
    this.isInterrupted = true
    this.logEvent('interrupt', `Started: ${interruption.type} for ${interruption.duration}ms`)

    this.interruptionTimer = setTimeout(() => {
      this.endInterruption()
    }, interruption.duration)
  }

  /**
   * End current interruption
   */
  private endInterruption(): void {
    this.isInterrupted = false
    this.logEvent('interrupt', 'Ended')

    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer)
      this.interruptionTimer = null
    }
  }

  /**
   * Check if network is currently interrupted
   */
  isNetworkInterrupted(): boolean {
    return this.isInterrupted
  }

  /**
   * Simulate network operation with all conditions applied
   */
  async simulateNetworkOperation<T>(
    operation: () => Promise<T>,
    dataSize = 1024
  ): Promise<T> {
    // Check for interruption
    if (this.isInterrupted) {
      throw new Error('Network interrupted')
    }

    // Check packet loss
    if (this.shouldDropPacket()) {
      throw new Error('Packet dropped')
    }

    // Apply latency
    await this.applyLatency(Promise.resolve())

    // Apply bandwidth throttling
    await this.applyBandwidthThrottling(dataSize)

    // Execute operation
    return operation()
  }

  /**
   * Get network statistics
   */
  getStatistics(): {
    profile: NetworkProfile
    events: NetworkEvent[]
    totalPacketsDropped: number
    totalLatencyEvents: number
    averageLatency: number
  } {
    const latencyEvents = this.events.filter(e => e.type === 'latency')
    const packetLossEvents = this.events.filter(e => e.type === 'packet-loss')

    return {
      profile: this.currentProfile,
      events: [...this.events],
      totalPacketsDropped: packetLossEvents.length,
      totalLatencyEvents: latencyEvents.length,
      averageLatency: this.currentProfile.latency,
    }
  }

  /**
   * Clear all events and interruptions
   */
  reset(): void {
    this.events = []
    this.interruptions = []
    this.isInterrupted = false

    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer)
      this.interruptionTimer = null
    }
  }

  /**
   * Log a network event
   */
  private logEvent(type: NetworkEvent['type'], details: string): void {
    this.events.push({
      timestamp: Date.now(),
      type,
      details,
    })
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.reset()
  }
}

/**
 * Create a network simulator with a specific profile
 */
export function createNetworkSimulator(
  profileName: keyof typeof NETWORK_PROFILES = 'PERFECT'
): NetworkSimulator {
  return new NetworkSimulator(NETWORK_PROFILES[profileName])
}
