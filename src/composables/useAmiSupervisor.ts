/**
 * AMI Supervisor Composable
 *
 * Vue composable for Asterisk supervisor features via AMI.
 * Provides monitor (silent listen), whisper (coach), and barge (join call) functionality.
 *
 * @module composables/useAmiSupervisor
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { AmiClient } from '@/core/AmiClient'
import type {
  UseAmiSupervisorOptions,
  OriginateResult,
} from '@/types/ami.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useAmiSupervisor')

/**
 * Supervision mode
 */
export type SupervisionMode = 'monitor' | 'whisper' | 'barge'

/**
 * Active supervision session
 */
export interface SupervisionSession {
  /** Unique session ID */
  id: string
  /** Supervisor channel */
  supervisorChannel: string
  /** Target channel being supervised */
  targetChannel: string
  /** Supervision mode */
  mode: SupervisionMode
  /** Start time */
  startTime: Date
  /** Server ID for multi-server setups */
  serverId?: number
}

/**
 * Return type for useAmiSupervisor composable
 */
export interface UseAmiSupervisorReturn {
  // State
  /** Active supervision sessions */
  sessions: Ref<Map<string, SupervisionSession>>
  /** Loading state */
  loading: Ref<boolean>
  /** Error message */
  error: Ref<string | null>

  // Methods
  /** Start silent monitoring */
  monitor: (supervisorExtension: string, targetChannel: string) => Promise<SupervisionSession>
  /** Start whisper (coach agent) */
  whisper: (supervisorExtension: string, targetChannel: string) => Promise<SupervisionSession>
  /** Start barge (join call) */
  barge: (supervisorExtension: string, targetChannel: string) => Promise<SupervisionSession>
  /** End a supervision session */
  endSession: (sessionId: string) => Promise<void>
  /** End all supervision sessions */
  endAllSessions: () => Promise<void>
  /** Check if supervising a channel */
  isSupervising: (targetChannel: string) => boolean
  /** Get session for target channel */
  getSessionForChannel: (targetChannel: string) => SupervisionSession | undefined
  /** Switch supervision mode for an existing session */
  switchMode: (sessionId: string, newMode: SupervisionMode) => Promise<SupervisionSession>
  /** Get active session count */
  activeSessionCount: ComputedRef<number>
}

/**
 * ChanSpy options for different modes
 */
const CHANSPY_OPTIONS: Record<SupervisionMode, string> = {
  // Silent monitor: q = quiet, no beep
  monitor: 'q',
  // Whisper: w = whisper mode (speak to agent only), q = quiet
  whisper: 'wq',
  // Barge: B = barge mode (speak to both parties), q = quiet
  barge: 'Bq',
}

/**
 * AMI Supervisor Composable
 *
 * Provides supervisor functionality for call center monitoring.
 * Uses ChanSpy application for monitoring/whisper/barge.
 *
 * @param client - AMI client instance (from useAmi().getClient())
 * @param options - Configuration options with sensible defaults
 *
 * @example
 * ```typescript
 * const ami = useAmi()
 * await ami.connect({ url: 'ws://pbx.example.com:8080' })
 *
 * const {
 *   sessions,
 *   monitor,
 *   whisper,
 *   barge,
 *   endSession,
 * } = useAmiSupervisor(ami.getClient()!, {
 *   supervisorContext: 'from-internal',
 *   onSessionStart: (session) => console.log('Supervision started:', session.mode),
 *   onSessionEnd: (session) => console.log('Supervision ended:', session.id),
 * })
 *
 * // Silent monitor an agent's call
 * const session = await monitor('SIP/supervisor', 'SIP/agent-call')
 *
 * // Whisper to agent (coach mode)
 * await whisper('SIP/supervisor', 'SIP/agent-call')
 *
 * // Barge into call
 * await barge('SIP/supervisor', 'SIP/agent-call')
 *
 * // End supervision
 * await endSession(session.id)
 * ```
 */
export function useAmiSupervisor(
  client: AmiClient | null,
  options: UseAmiSupervisorOptions = {}
): UseAmiSupervisorReturn {
  // ============================================================================
  // Configuration with defaults
  // ============================================================================

  const config = {
    supervisorContext: options.supervisorContext ?? 'from-internal',
    dialTimeout: options.dialTimeout ?? 30000,
    chanspyOptions: { ...CHANSPY_OPTIONS, ...options.chanspyOptions },
    onSessionStart: options.onSessionStart,
    onSessionEnd: options.onSessionEnd,
  }

  // ============================================================================
  // State
  // ============================================================================

  const sessions = ref<Map<string, SupervisionSession>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============================================================================
  // Computed
  // ============================================================================

  const activeSessionCount = computed(() => sessions.value.size)

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Generate session ID
   */
  const generateSessionId = (): string => {
    return `sup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Extract channel name for ChanSpy
   * ChanSpy(SIP/1000) will spy on SIP/1000-xxxxx
   */
  const extractChannelBase = (channel: string): string => {
    // Remove the unique identifier (e.g., SIP/1000-00000001 -> SIP/1000)
    return channel.replace(/-[a-f0-9]+$/i, '')
  }

  /**
   * Start supervision with specified mode
   */
  const startSupervision = async (
    supervisorChannel: string,
    targetChannel: string,
    mode: SupervisionMode
  ): Promise<SupervisionSession> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    loading.value = true
    error.value = null

    try {
      const sessionId = generateSessionId()
      const channelBase = extractChannelBase(targetChannel)
      const spyOptions = config.chanspyOptions[mode]

      // Build ChanSpy application data
      // Format: ChanSpy(channel[,options])
      const applicationData = `${channelBase},${spyOptions}`

      logger.info('Starting supervision', {
        sessionId,
        mode,
        supervisor: supervisorChannel,
        target: targetChannel,
        spyOptions,
      })

      // Originate call to supervisor, connecting them to ChanSpy
      const result: OriginateResult = await client.originate({
        channel: supervisorChannel,
        application: 'ChanSpy',
        data: applicationData,
        callerId: `Supervisor <${mode}>`,
        timeout: config.dialTimeout,
        async: true,
      })

      if (!result.success) {
        throw new Error(result.message || 'Failed to start supervision')
      }

      // Create session
      const session: SupervisionSession = {
        id: sessionId,
        supervisorChannel: result.channel || supervisorChannel,
        targetChannel,
        mode,
        startTime: new Date(),
      }

      // Store session
      sessions.value.set(sessionId, session)

      // Trigger callback
      config.onSessionStart?.(session)

      logger.info('Supervision started', { sessionId, mode })
      return session
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start supervision'
      logger.error('Failed to start supervision', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Start silent monitoring (listen only)
   */
  const monitor = async (
    supervisorExtension: string,
    targetChannel: string
  ): Promise<SupervisionSession> => {
    return startSupervision(supervisorExtension, targetChannel, 'monitor')
  }

  /**
   * Start whisper mode (speak to agent only)
   */
  const whisper = async (
    supervisorExtension: string,
    targetChannel: string
  ): Promise<SupervisionSession> => {
    return startSupervision(supervisorExtension, targetChannel, 'whisper')
  }

  /**
   * Start barge mode (speak to both parties)
   */
  const barge = async (
    supervisorExtension: string,
    targetChannel: string
  ): Promise<SupervisionSession> => {
    return startSupervision(supervisorExtension, targetChannel, 'barge')
  }

  /**
   * End a supervision session
   */
  const endSession = async (sessionId: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const session = sessions.value.get(sessionId)
    if (!session) {
      logger.warn('Session not found', { sessionId })
      return
    }

    try {
      // Hangup the supervisor's channel
      await client.hangupChannel(session.supervisorChannel)

      // Remove session
      sessions.value.delete(sessionId)

      // Trigger callback
      config.onSessionEnd?.(session)

      logger.info('Supervision ended', { sessionId })
    } catch (err) {
      logger.error('Failed to end supervision session', err)
      // Still remove from local state
      sessions.value.delete(sessionId)
      throw err
    }
  }

  /**
   * End all supervision sessions
   */
  const endAllSessions = async (): Promise<void> => {
    const sessionIds = Array.from(sessions.value.keys())

    for (const sessionId of sessionIds) {
      try {
        await endSession(sessionId)
      } catch (err) {
        logger.error('Failed to end session', { sessionId, err })
      }
    }
  }

  /**
   * Check if supervising a channel
   */
  const isSupervising = (targetChannel: string): boolean => {
    const channelBase = extractChannelBase(targetChannel)
    for (const session of sessions.value.values()) {
      if (extractChannelBase(session.targetChannel) === channelBase) {
        return true
      }
    }
    return false
  }

  /**
   * Get session for target channel
   */
  const getSessionForChannel = (targetChannel: string): SupervisionSession | undefined => {
    const channelBase = extractChannelBase(targetChannel)
    for (const session of sessions.value.values()) {
      if (extractChannelBase(session.targetChannel) === channelBase) {
        return session
      }
    }
    return undefined
  }

  /**
   * Switch supervision mode for an existing session
   * This ends the current session and starts a new one with the new mode
   */
  const switchMode = async (
    sessionId: string,
    newMode: SupervisionMode
  ): Promise<SupervisionSession> => {
    const session = sessions.value.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    if (session.mode === newMode) {
      return session // Already in this mode
    }

    // End current session and start new one
    await endSession(sessionId)
    return startSupervision(session.supervisorChannel, session.targetChannel, newMode)
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(async () => {
    // End all sessions when component unmounts
    try {
      await endAllSessions()
    } catch (err) {
      logger.warn('Failed to cleanup supervision sessions', err)
    }
  })

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    sessions,
    loading,
    error,

    // Computed
    activeSessionCount,

    // Methods
    monitor,
    whisper,
    barge,
    endSession,
    endAllSessions,
    isSupervising,
    getSessionForChannel,
    switchMode,
  }
}
