/**
 * Agent Testing Framework
 *
 * Main exports for the multi-agent SIP testing framework
 */

// Core agent classes
export { SipTestAgent, createSipTestAgent, type SipTestAgentConfig } from './SipTestAgent'
export {
  AgentManager,
  createAgentManager,
  createAgentIdentity,
} from './AgentManager'

// Network simulation
export {
  NetworkSimulator,
  createNetworkSimulator,
  NETWORK_PROFILES,
} from './NetworkSimulator'

// Subagents
export type { ISubagent } from './types'
export {
  BaseSubagent,
  RegistrationSubagent,
  CallSubagent,
  MediaSubagent,
  PresenceSubagent,
  type RegistrationState,
  type CallState,
  type MediaState,
  type MediaDeviceInfo,
  type PresenceState,
  type Message,
} from './subagents'

// Types
export type {
  AgentIdentity,
  AgentState,
  AgentError,
  CallOptions,
  NetworkProfile,
  NetworkInterruption,
  AgentEvent,
  AgentMetrics,
  AgentManagerConfig,
  ConferenceParticipant,
  ConferenceInfo,
  PresenceStatus,
} from './types'
