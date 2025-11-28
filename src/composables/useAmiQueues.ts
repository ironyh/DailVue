/**
 * AMI Queues Composable
 *
 * Vue composable for Asterisk queue management via AMI.
 * Provides reactive state for queues, members, and callers with real-time event handling.
 *
 * @module composables/useAmiQueues
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { AmiClient } from '@/core/AmiClient'
import type {
  QueueInfo,
  QueueMember,
  QueueEntry,
  QueueSummary,
  UseAmiQueuesOptions,
  AmiMessage,
  AmiQueueMemberStatusEvent,
  AmiQueueCallerJoinEvent,
  AmiQueueCallerLeaveEvent,
  AmiQueueCallerAbandonEvent,
} from '@/types/ami.types'
import {
  QueueMemberStatus,
  DEFAULT_QUEUE_MEMBER_STATUS_LABELS,
  DEFAULT_PAUSE_REASONS,
} from '@/types/ami.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useAmiQueues')

/**
 * Return type for useAmiQueues composable
 */
export interface UseAmiQueuesReturn {
  // State
  /** Map of queue name to queue info */
  queues: Ref<Map<string, QueueInfo>>
  /** Queue summaries (quick stats) */
  summaries: Ref<QueueSummary[]>
  /** Loading state */
  loading: Ref<boolean>
  /** Error message */
  error: Ref<string | null>
  /** Last refresh timestamp */
  lastRefresh: Ref<Date | null>

  // Computed
  /** List of all queues */
  queueList: ComputedRef<QueueInfo[]>
  /** Total callers waiting across all queues */
  totalCallers: ComputedRef<number>
  /** Total available agents across all queues */
  totalAvailable: ComputedRef<number>
  /** Total paused agents across all queues */
  totalPaused: ComputedRef<number>
  /** Queue with longest wait time */
  longestWait: ComputedRef<{ queue: string; wait: number } | null>
  /** Overall service level across all queues */
  overallServiceLevel: ComputedRef<number>

  // Methods
  /** Refresh all queue data */
  refresh: () => Promise<void>
  /** Refresh specific queue */
  refreshQueue: (queueName: string) => Promise<void>
  /** Get queue summary (quick stats) */
  getSummary: () => Promise<QueueSummary[]>
  /** Pause a queue member */
  pauseMember: (queue: string, iface: string, reason?: string) => Promise<void>
  /** Unpause a queue member */
  unpauseMember: (queue: string, iface: string) => Promise<void>
  /** Add member to queue */
  addMember: (queue: string, iface: string, options?: { memberName?: string; penalty?: number }) => Promise<void>
  /** Remove member from queue */
  removeMember: (queue: string, iface: string) => Promise<void>
  /** Set member penalty */
  setPenalty: (queue: string, iface: string, penalty: number) => Promise<void>
  /** Get configured pause reasons */
  getPauseReasons: () => string[]
  /** Get status label for a member status */
  getStatusLabel: (status: QueueMemberStatus) => string
}

/**
 * AMI Queues Composable
 *
 * Provides reactive queue management functionality for Vue components.
 * Supports real-time updates via AMI events or polling.
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
 *   queues,
 *   queueList,
 *   refresh,
 *   pauseMember,
 *   getPauseReasons,
 * } = useAmiQueues(ami.getClient()!, {
 *   useEvents: true,
 *   queueFilter: (q) => q.name.startsWith('sales-'),
 *   pauseReasons: ['Break', 'Lunch', 'Training', 'Meeting'],
 *   onQueueUpdate: (queue) => console.log('Queue updated:', queue.name),
 * })
 *
 * // Initial load
 * await refresh()
 *
 * // Pause an agent
 * await pauseMember('sales-queue', 'SIP/1000', 'Lunch')
 * ```
 */
export function useAmiQueues(
  client: AmiClient | null,
  options: UseAmiQueuesOptions = {}
): UseAmiQueuesReturn {
  // ============================================================================
  // Configuration with defaults
  // ============================================================================

  const config = {
    pollInterval: options.pollInterval ?? 0, // 0 = no polling (events only)
    useEvents: options.useEvents ?? true,
    queueFilter: options.queueFilter,
    memberFilter: options.memberFilter,
    pauseReasons: options.pauseReasons ?? DEFAULT_PAUSE_REASONS,
    statusLabels: { ...DEFAULT_QUEUE_MEMBER_STATUS_LABELS, ...options.statusLabels },
    onQueueUpdate: options.onQueueUpdate,
    onMemberUpdate: options.onMemberUpdate,
    onCallerJoin: options.onCallerJoin,
    onCallerLeave: options.onCallerLeave,
    onCallerAbandon: options.onCallerAbandon,
    transformQueue: options.transformQueue,
    transformMember: options.transformMember,
  }

  // ============================================================================
  // State
  // ============================================================================

  const queues = ref<Map<string, QueueInfo>>(new Map())
  const summaries = ref<QueueSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastRefresh = ref<Date | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  const eventCleanups: Array<() => void> = []

  // ============================================================================
  // Computed
  // ============================================================================

  const queueList = computed(() => {
    let list = Array.from(queues.value.values())
    if (config.queueFilter) {
      list = list.filter(config.queueFilter)
    }
    return list
  })

  const totalCallers = computed(() =>
    queueList.value.reduce((sum, q) => sum + q.calls, 0)
  )

  const totalAvailable = computed(() =>
    queueList.value.reduce((sum, q) => {
      const available = q.members.filter(
        (m) => !m.paused && m.status === QueueMemberStatus.NotInUse
      ).length
      return sum + available
    }, 0)
  )

  const totalPaused = computed(() =>
    queueList.value.reduce((sum, q) => {
      const paused = q.members.filter((m) => m.paused).length
      return sum + paused
    }, 0)
  )

  const longestWait = computed(() => {
    let longest: { queue: string; wait: number } | null = null
    for (const q of queueList.value) {
      for (const entry of q.entries) {
        if (!longest || entry.wait > longest.wait) {
          longest = { queue: q.name, wait: entry.wait }
        }
      }
    }
    return longest
  })

  const overallServiceLevel = computed(() => {
    const queuesWithSL = queueList.value.filter((q) => q.serviceLevelPerf > 0)
    if (queuesWithSL.length === 0) return 0
    const total = queuesWithSL.reduce((sum, q) => sum + q.serviceLevelPerf, 0)
    return Math.round(total / queuesWithSL.length)
  })

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Refresh all queue data
   */
  const refresh = async (): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    loading.value = true
    error.value = null

    try {
      const queueData = await client.getQueueStatus()

      queues.value.clear()
      for (let queue of queueData) {
        // Apply member filter
        if (config.memberFilter) {
          queue = { ...queue, members: queue.members.filter(config.memberFilter) }
        }

        // Apply queue filter
        if (config.queueFilter && !config.queueFilter(queue)) {
          continue
        }

        // Apply transformation
        if (config.transformQueue) {
          queue = config.transformQueue(queue)
        }

        queues.value.set(queue.name, queue)

        // Trigger callback
        config.onQueueUpdate?.(queue)
      }

      lastRefresh.value = new Date()
      logger.debug('Queue data refreshed', { count: queues.value.size })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh queues'
      logger.error('Failed to refresh queues', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Refresh specific queue
   */
  const refreshQueue = async (queueName: string): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    try {
      const queueData = await client.getQueueStatus(queueName)
      if (queueData.length > 0) {
        const rawQueue = queueData[0]
        if (!rawQueue) return

        // Apply member filter
        let queue: QueueInfo = config.memberFilter
          ? { ...rawQueue, members: rawQueue.members.filter(config.memberFilter) }
          : rawQueue

        // Apply transformation
        if (config.transformQueue) {
          queue = config.transformQueue(queue)
        }

        queues.value.set(queue.name, queue)
        config.onQueueUpdate?.(queue)
      }
    } catch (err) {
      logger.error(`Failed to refresh queue ${queueName}`, err)
    }
  }

  /**
   * Get queue summaries (quick stats)
   */
  const getSummary = async (): Promise<QueueSummary[]> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const data = await client.getQueueSummary()
    summaries.value = data
    return data
  }

  /**
   * Pause a queue member
   */
  const pauseMember = async (
    queue: string,
    iface: string,
    reason?: string
  ): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    await client.queuePause(queue, iface, true, reason)

    // Update local state
    const queueInfo = queues.value.get(queue)
    if (queueInfo) {
      const member = queueInfo.members.find((m) => m.interface === iface)
      if (member) {
        member.paused = true
        member.pausedReason = reason || ''
        config.onMemberUpdate?.(member, queue)
      }
    }
  }

  /**
   * Unpause a queue member
   */
  const unpauseMember = async (queue: string, iface: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    await client.queuePause(queue, iface, false)

    // Update local state
    const queueInfo = queues.value.get(queue)
    if (queueInfo) {
      const member = queueInfo.members.find((m) => m.interface === iface)
      if (member) {
        member.paused = false
        member.pausedReason = ''
        config.onMemberUpdate?.(member, queue)
      }
    }
  }

  /**
   * Add member to queue
   */
  const addMember = async (
    queue: string,
    iface: string,
    memberOptions?: { memberName?: string; penalty?: number }
  ): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    await client.queueAdd(queue, iface, memberOptions)

    // Refresh the queue to get updated member list
    await refreshQueue(queue)
  }

  /**
   * Remove member from queue
   */
  const removeMember = async (queue: string, iface: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    await client.queueRemove(queue, iface)

    // Update local state
    const queueInfo = queues.value.get(queue)
    if (queueInfo) {
      queueInfo.members = queueInfo.members.filter((m) => m.interface !== iface)
    }
  }

  /**
   * Set member penalty
   */
  const setPenalty = async (
    queue: string,
    iface: string,
    penalty: number
  ): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    await client.queuePenalty(queue, iface, penalty)

    // Update local state
    const queueInfo = queues.value.get(queue)
    if (queueInfo) {
      const member = queueInfo.members.find((m) => m.interface === iface)
      if (member) {
        member.penalty = penalty
        config.onMemberUpdate?.(member, queue)
      }
    }
  }

  /**
   * Get configured pause reasons
   */
  const getPauseReasons = (): string[] => config.pauseReasons

  /**
   * Get status label for a member status
   */
  const getStatusLabel = (status: QueueMemberStatus): string =>
    config.statusLabels[status] || 'Unknown'

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleMemberStatus = (event: AmiMessage<AmiQueueMemberStatusEvent>): void => {
    const data = event.data
    const queueInfo = queues.value.get(data.Queue)
    if (!queueInfo) return

    const memberIndex = queueInfo.members.findIndex(
      (m) => m.interface === data.Interface
    )

    let member: QueueMember = {
      queue: data.Queue,
      name: data.MemberName || '',
      interface: data.Interface || '',
      stateInterface: data.StateInterface || '',
      membership: (data.Membership || 'static') as 'static' | 'dynamic' | 'realtime',
      penalty: parseInt(data.Penalty || '0', 10),
      callsTaken: parseInt(data.CallsTaken || '0', 10),
      lastCall: parseInt(data.LastCall || '0', 10),
      lastPause: parseInt(data.LastPause || '0', 10),
      loginTime: parseInt(data.LoginTime || '0', 10),
      inCall: data.InCall === '1',
      status: parseInt(data.Status || '0', 10) as QueueMemberStatus,
      statusLabel: config.statusLabels[parseInt(data.Status || '0', 10) as QueueMemberStatus] || 'Unknown',
      paused: data.Paused === '1',
      pausedReason: data.PausedReason || '',
      wrapupTime: parseInt(data.WrapupTime || '0', 10),
      ringinuse: data.Ringinuse === '1',
      serverId: event.server_id,
    }

    // Apply transformation
    if (config.transformMember) {
      member = config.transformMember(member)
    }

    // Apply filter
    if (config.memberFilter && !config.memberFilter(member)) {
      return
    }

    if (memberIndex >= 0) {
      queueInfo.members[memberIndex] = member
    } else {
      queueInfo.members.push(member)
    }

    queueInfo.lastUpdated = new Date()
    config.onMemberUpdate?.(member, data.Queue)
    config.onQueueUpdate?.(queueInfo)
  }

  const handleCallerJoin = (event: AmiMessage<AmiQueueCallerJoinEvent>): void => {
    const data = event.data
    const queueInfo = queues.value.get(data.Queue)
    if (!queueInfo) return

    const entry: QueueEntry = {
      queue: data.Queue,
      position: parseInt(data.Position || '0', 10),
      channel: data.Channel || '',
      uniqueId: data.Uniqueid || '',
      callerIdNum: data.CallerIDNum || '',
      callerIdName: data.CallerIDName || '',
      connectedLineNum: data.ConnectedLineNum || '',
      connectedLineName: data.ConnectedLineName || '',
      wait: 0,
      priority: 0,
      serverId: event.server_id,
    }

    queueInfo.entries.push(entry)
    queueInfo.calls = queueInfo.entries.length
    queueInfo.lastUpdated = new Date()

    config.onCallerJoin?.(entry, data.Queue)
    config.onQueueUpdate?.(queueInfo)
  }

  const handleCallerLeave = (event: AmiMessage<AmiQueueCallerLeaveEvent>): void => {
    const data = event.data
    const queueInfo = queues.value.get(data.Queue)
    if (!queueInfo) return

    const entry = queueInfo.entries.find((e) => e.uniqueId === data.Uniqueid)
    queueInfo.entries = queueInfo.entries.filter((e) => e.uniqueId !== data.Uniqueid)
    queueInfo.calls = queueInfo.entries.length
    queueInfo.lastUpdated = new Date()

    if (entry) {
      config.onCallerLeave?.(entry, data.Queue)
    }
    config.onQueueUpdate?.(queueInfo)
  }

  const handleCallerAbandon = (event: AmiMessage<AmiQueueCallerAbandonEvent>): void => {
    const data = event.data
    const queueInfo = queues.value.get(data.Queue)
    if (!queueInfo) return

    const entry = queueInfo.entries.find((e) => e.uniqueId === data.Uniqueid)
    queueInfo.entries = queueInfo.entries.filter((e) => e.uniqueId !== data.Uniqueid)
    queueInfo.calls = queueInfo.entries.length
    queueInfo.abandoned++
    queueInfo.lastUpdated = new Date()

    if (entry) {
      config.onCallerAbandon?.(entry, data.Queue)
    }
    config.onQueueUpdate?.(queueInfo)
  }

  // ============================================================================
  // Setup Event Listeners
  // ============================================================================

  const setupEventListeners = (): void => {
    if (!client || !config.useEvents) return

    client.on('queueMemberStatus', handleMemberStatus)
    client.on('queueCallerJoin', handleCallerJoin)
    client.on('queueCallerLeave', handleCallerLeave)
    client.on('queueCallerAbandon', handleCallerAbandon)

    eventCleanups.push(() => {
      client.off('queueMemberStatus', handleMemberStatus)
      client.off('queueCallerJoin', handleCallerJoin)
      client.off('queueCallerLeave', handleCallerLeave)
      client.off('queueCallerAbandon', handleCallerAbandon)
    })
  }

  // ============================================================================
  // Setup Polling
  // ============================================================================

  const setupPolling = (): void => {
    if (config.pollInterval > 0) {
      pollTimer = setInterval(refresh, config.pollInterval)
    }
  }

  // ============================================================================
  // Initialize
  // ============================================================================

  if (client) {
    setupEventListeners()
    setupPolling()
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    eventCleanups.forEach((cleanup) => cleanup())
  })

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    queues,
    summaries,
    loading,
    error,
    lastRefresh,

    // Computed
    queueList,
    totalCallers,
    totalAvailable,
    totalPaused,
    longestWait,
    overallServiceLevel,

    // Methods
    refresh,
    refreshQueue,
    getSummary,
    pauseMember,
    unpauseMember,
    addMember,
    removeMember,
    setPenalty,
    getPauseReasons,
    getStatusLabel,
  }
}
