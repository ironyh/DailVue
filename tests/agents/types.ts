/**
 * Agent Testing Framework Types
 *
 * Type definitions for the multi-agent SIP testing framework
 */

import type { MockUA, MockRTCSession } from '../helpers/MockSipServer'

/**
 * Agent identity and credentials
 */
export interface AgentIdentity {
  /** Unique agent identifier */
  id: string
  /** SIP URI (e.g., 'sip:alice@example.com') */
  uri: string
  /** Username for authentication */
  username: string
  /** Password for authentication */
  password: string
  /** Display name */
  displayName: string
  /** WebSocket server URI */
  wsServer: string
}

/**
 * Agent state
 */
export interface AgentState {
  /** Is agent connected to SIP server */
  connected: boolean
  /** Is agent registered */
  registered: boolean
  /** Active call sessions */
  activeSessions: MockRTCSession[]
  /** Current presence status */
  presenceStatus: PresenceStatus
  /** Agent errors */
  errors: AgentError[]
  /** Last activity timestamp */
  lastActivity: number
}

/**
 * Presence status
 */
export type PresenceStatus = 'online' | 'offline' | 'busy' | 'away' | 'dnd'

/**
 * Agent error
 */
export interface AgentError {
  timestamp: number
  code: string
  message: string
  source: 'registration' | 'call' | 'media' | 'presence' | 'network'
}

/**
 * Call options for making calls
 */
export interface CallOptions {
  /** Enable video */
  video?: boolean
  /** Enable audio */
  audio?: boolean
  /** Extra headers */
  extraHeaders?: string[]
  /** Anonymous call */
  anonymous?: boolean
  /** Custom options */
  custom?: Record<string, unknown>
}

/**
 * Network condition profile
 */
export interface NetworkProfile {
  /** Profile name */
  name: string
  /** Latency in milliseconds */
  latency: number
  /** Packet loss percentage (0-100) */
  packetLoss: number
  /** Bandwidth in kbps */
  bandwidth: number
  /** Jitter in milliseconds */
  jitter: number
}

/**
 * Network interruption
 */
export interface NetworkInterruption {
  /** Duration in milliseconds */
  duration: number
  /** Delay before interruption starts */
  delay?: number
  /** Type of interruption */
  type: 'disconnect' | 'high-latency' | 'packet-loss'
}

/**
 * Agent communication event
 */
export interface AgentEvent<T = unknown> {
  /** Event type */
  type: string
  /** Source agent ID */
  from: string
  /** Target agent ID (optional) */
  to?: string
  /** Event timestamp */
  timestamp: number
  /** Event data */
  data: T
}

/**
 * Agent metrics
 */
export interface AgentMetrics {
  /** Total calls made */
  callsMade: number
  /** Total calls received */
  callsReceived: number
  /** Total calls accepted */
  callsAccepted: number
  /** Total calls rejected */
  callsRejected: number
  /** Total calls ended */
  callsEnded: number
  /** Total messages sent */
  messagesSent: number
  /** Total messages received */
  messagesReceived: number
  /** Average call duration in seconds */
  avgCallDuration: number
  /** Registration attempts */
  registrationAttempts: number
  /** Failed registrations */
  registrationFailures: number
  /** Network errors */
  networkErrors: number
}

/**
 * Subagent interface
 */
export interface ISubagent {
  /** Subagent name */
  name: string
  /** Initialize subagent */
  initialize(): Promise<void>
  /** Cleanup subagent */
  cleanup(): Promise<void>
  /** Get subagent state */
  getState(): Record<string, unknown>
}

/**
 * Agent manager configuration
 */
export interface AgentManagerConfig {
  /** Auto-cleanup on test end */
  autoCleanup?: boolean
  /** Enable detailed logging */
  verbose?: boolean
  /** Default network profile */
  defaultNetworkProfile?: NetworkProfile
}

/**
 * Conference participant info
 */
export interface ConferenceParticipant {
  /** Agent ID */
  agentId: string
  /** Join timestamp */
  joinedAt: number
  /** Is muted */
  muted: boolean
  /** Is speaking */
  speaking: boolean
  /** Audio level (0-1) */
  audioLevel: number
}

/**
 * Conference state
 */
export interface ConferenceInfo {
  /** Conference ID */
  id: string
  /** Conference URI */
  uri: string
  /** Participants */
  participants: ConferenceParticipant[]
  /** Conference start time */
  startedAt: number
  /** Conference end time */
  endedAt?: number
  /** Is recording */
  recording: boolean
}
