/**
 * AMI Calls Composable
 *
 * Vue composable for Asterisk call management via AMI.
 * Provides click-to-call, channel monitoring, and call control functionality.
 *
 * @module composables/useAmiCalls
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { AmiClient } from '@/core/AmiClient'
import type {
  ChannelInfo,
  OriginateOptions,
  OriginateResult,
  UseAmiCallsOptions,
  AmiMessage,
  AmiNewChannelEvent,
  AmiHangupEvent,
  AmiNewStateEvent,
  ActiveCall,
} from '@/types/ami.types'
import { ChannelState, CHANNEL_STATE_LABELS } from '@/types/ami.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useAmiCalls')

// Re-export ActiveCall from types for convenience
export type { ActiveCall }

/**
 * Return type for useAmiCalls composable
 */
export interface UseAmiCallsReturn {
  // State
  /** Map of active calls by unique ID */
  calls: Ref<Map<string, ActiveCall>>
  /** Raw channel list */
  channels: Ref<ChannelInfo[]>
  /** Loading state */
  loading: Ref<boolean>
  /** Error message */
  error: Ref<string | null>
  /** Last refresh timestamp */
  lastRefresh: Ref<Date | null>

  // Computed
  /** List of active calls */
  callList: ComputedRef<ActiveCall[]>
  /** Number of active calls */
  callCount: ComputedRef<number>
  /** Calls in ringing state */
  ringingCalls: ComputedRef<ActiveCall[]>
  /** Calls in connected/up state */
  connectedCalls: ComputedRef<ActiveCall[]>
  /** Calls in dialing state */
  dialingCalls: ComputedRef<ActiveCall[]>
  /** Total call duration across all calls */
  totalDuration: ComputedRef<number>

  // Methods
  /** Refresh channel list */
  refresh: () => Promise<void>
  /** Make a click-to-call (agent-first) */
  clickToCall: (agentChannel: string, destination: string, options?: ClickToCallOptions) => Promise<OriginateResult>
  /** Originate a call (raw) */
  originate: (options: OriginateOptions) => Promise<OriginateResult>
  /** Hangup a call */
  hangup: (channelOrUniqueId: string) => Promise<void>
  /** Transfer a call */
  transfer: (channelOrUniqueId: string, destination: string, context?: string) => Promise<void>
  /** Get state label */
  getStateLabel: (state: ChannelState) => string
}

/**
 * Options for click-to-call
 */
export interface ClickToCallOptions {
  /** Context for dial-out (default from config) */
  context?: string
  /** Caller ID to present */
  callerId?: string
  /** Timeout in ms for agent to answer */
  timeout?: number
  /** Variables to set on the channel */
  variables?: Record<string, string>
  /** Account code */
  accountCode?: string
}

/**
 * AMI Calls Composable
 *
 * Provides reactive call management functionality for Vue components.
 * Supports click-to-call, real-time call monitoring, and call control.
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
 *   calls,
 *   callList,
 *   clickToCall,
 *   hangup,
 * } = useAmiCalls(ami.getClient()!, {
 *   useEvents: true,
 *   defaultContext: 'from-internal',
 *   agentFirst: true,
 *   onCallStart: (call) => console.log('Call started:', call.callerIdNum),
 *   onCallEnd: (call) => console.log('Call ended:', call.uniqueId),
 * })
 *
 * // Click-to-call: rings agent first, then dials destination
 * const result = await clickToCall('SIP/1000', '18005551234', {
 *   callerId: 'Sales <1000>',
 * })
 *
 * // Watch active calls
 * watch(callList, (activeCalls) => {
 *   console.log('Active calls:', activeCalls.length)
 * })
 * ```
 */
export function useAmiCalls(
  client: AmiClient | null,
  options: UseAmiCallsOptions = {}
): UseAmiCallsReturn {
  // ============================================================================
  // Configuration with defaults
  // ============================================================================

  const config = {
    pollInterval: options.pollInterval ?? 0,
    useEvents: options.useEvents ?? true,
    defaultContext: options.defaultContext ?? 'from-internal',
    agentFirst: options.agentFirst ?? true,
    dialTimeout: options.dialTimeout ?? 30000,
    channelFilter: options.channelFilter,
    stateLabels: { ...CHANNEL_STATE_LABELS, ...options.stateLabels },
    onCallStart: options.onCallStart,
    onCallEnd: options.onCallEnd,
    onCallStateChange: options.onCallStateChange,
    transformChannel: options.transformChannel,
  }

  // ============================================================================
  // State
  // ============================================================================

  const calls = ref<Map<string, ActiveCall>>(new Map())
  const channels = ref<ChannelInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastRefresh = ref<Date | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  const eventCleanups: Array<() => void> = []

  // ============================================================================
  // Computed
  // ============================================================================

  const callList = computed(() => Array.from(calls.value.values()))

  const callCount = computed(() => calls.value.size)

  const ringingCalls = computed(() =>
    callList.value.filter(
      (c) => c.state === ChannelState.Ringing || c.state === ChannelState.Ring
    )
  )

  const connectedCalls = computed(() =>
    callList.value.filter((c) => c.state === ChannelState.Up)
  )

  const dialingCalls = computed(() =>
    callList.value.filter(
      (c) => c.state === ChannelState.Dialing || c.state === ChannelState.DialingOffHook
    )
  )

  const totalDuration = computed(() =>
    callList.value.reduce((sum, c) => sum + c.duration, 0)
  )

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Refresh channel list
   */
  const refresh = async (): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    loading.value = true
    error.value = null

    try {
      let channelData = await client.getChannels()

      // Apply filter
      if (config.channelFilter) {
        channelData = channelData.filter(config.channelFilter)
      }

      // Apply transformation
      if (config.transformChannel) {
        channelData = channelData.map(config.transformChannel)
      }

      channels.value = channelData

      // Update calls map
      calls.value.clear()
      for (const channel of channelData) {
        const call = channelToCall(channel)
        calls.value.set(call.uniqueId, call)
      }

      lastRefresh.value = new Date()
      logger.debug('Channel data refreshed', { count: channels.value.length })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh channels'
      logger.error('Failed to refresh channels', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Convert channel info to active call
   */
  const channelToCall = (channel: ChannelInfo): ActiveCall => {
    let duration: number
    if (typeof channel.duration === 'string') {
      const durationParts = channel.duration.split(':')
      duration =
        parseInt(durationParts[0] || '0', 10) * 3600 +
        parseInt(durationParts[1] || '0', 10) * 60 +
        parseInt(durationParts[2] || '0', 10)
    } else {
      duration = channel.duration || 0
    }

    return {
      uniqueId: channel.uniqueId,
      channel: channel.channel,
      linkedId: channel.linkedId,
      callerIdNum: channel.callerIdNum,
      callerIdName: channel.callerIdName,
      connectedLineNum: channel.connectedLineNum,
      connectedLineName: channel.connectedLineName,
      state: channel.channelState ?? channel.state,
      stateDesc: channel.channelStateDesc ?? channel.stateDesc,
      startTime: new Date(Date.now() - duration * 1000),
      duration,
      application: channel.application,
      serverId: channel.serverId,
    }
  }

  /**
   * Click-to-call (agent-first flow)
   */
  const clickToCall = async (
    agentChannel: string,
    destination: string,
    clickOptions: ClickToCallOptions = {}
  ): Promise<OriginateResult> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const context = clickOptions.context ?? config.defaultContext
    const timeout = clickOptions.timeout ?? config.dialTimeout

    if (config.agentFirst) {
      // Agent-first: Ring agent, then connect to destination
      // Use Application=Dial to call destination after agent answers
      const result = await client.originate({
        channel: agentChannel,
        application: 'Dial',
        data: `${destination},${Math.floor(timeout / 1000)}`,
        callerId: clickOptions.callerId,
        timeout,
        account: clickOptions.accountCode,
        variables: clickOptions.variables,
        async: true,
      })

      return result
    } else {
      // Destination-first: Call destination, connect to agent when answered
      const result = await client.originate({
        channel: destination,
        exten: agentChannel.replace(/^(SIP|PJSIP|IAX2)\//, ''),
        context,
        priority: 1,
        callerId: clickOptions.callerId,
        timeout,
        account: clickOptions.accountCode,
        variables: clickOptions.variables,
        async: true,
      })

      return result
    }
  }

  /**
   * Raw originate call
   */
  const originate = async (originateOptions: OriginateOptions): Promise<OriginateResult> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    return client.originate(originateOptions)
  }

  /**
   * Hangup a call
   */
  const hangup = async (channelOrUniqueId: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    // Check if it's a uniqueId (find channel) or channel name
    const call = calls.value.get(channelOrUniqueId)
    const channelName = call?.channel ?? channelOrUniqueId

    await client.hangupChannel(channelName)

    // Remove from local state
    if (call) {
      calls.value.delete(channelOrUniqueId)
      config.onCallEnd?.(call)
    }
  }

  /**
   * Transfer a call
   */
  const transfer = async (
    channelOrUniqueId: string,
    destination: string,
    context?: string
  ): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const call = calls.value.get(channelOrUniqueId)
    const channelName = call?.channel ?? channelOrUniqueId

    await client.redirectChannel(
      channelName,
      context ?? config.defaultContext,
      destination,
      1
    )
  }

  /**
   * Get state label
   */
  const getStateLabel = (state: ChannelState): string =>
    config.stateLabels[state] || 'Unknown'

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleNewChannel = (event: AmiMessage<AmiNewChannelEvent>): void => {
    const data = event.data

    // Apply filter
    if (config.channelFilter) {
      const state = parseInt(data.ChannelState || '0', 10) as ChannelState
      const stateDesc = data.ChannelStateDesc || ''
      const channelInfo: ChannelInfo = {
        channel: data.Channel || '',
        state,
        channelState: state,
        stateDesc,
        channelStateDesc: stateDesc,
        callerIdNum: data.CallerIDNum || '',
        callerIdName: data.CallerIDName || '',
        connectedLineNum: data.ConnectedLineNum || '',
        connectedLineName: data.ConnectedLineName || '',
        accountCode: data.AccountCode || '',
        context: data.Context || '',
        exten: data.Exten || '',
        priority: parseInt(data.Priority || '0', 10),
        uniqueId: data.Uniqueid || '',
        linkedId: data.Linkedid || '',
        application: '',
        applicationData: '',
        duration: '00:00:00',
        bridgeId: '',
        serverId: event.server_id,
        createdAt: new Date(),
      }
      if (!config.channelFilter(channelInfo)) return
    }

    const call: ActiveCall = {
      uniqueId: data.Uniqueid || '',
      channel: data.Channel || '',
      linkedId: data.Linkedid || '',
      callerIdNum: data.CallerIDNum || '',
      callerIdName: data.CallerIDName || '',
      connectedLineNum: data.ConnectedLineNum || '',
      connectedLineName: data.ConnectedLineName || '',
      state: parseInt(data.ChannelState || '0', 10) as ChannelState,
      stateDesc: data.ChannelStateDesc || '',
      startTime: new Date(),
      duration: 0,
      serverId: event.server_id,
    }

    calls.value.set(call.uniqueId, call)
    config.onCallStart?.(call)
  }

  const handleHangup = (event: AmiMessage<AmiHangupEvent>): void => {
    const data = event.data
    const call = calls.value.get(data.Uniqueid || '')

    if (call) {
      calls.value.delete(data.Uniqueid || '')
      config.onCallEnd?.(call)
    }
  }

  const handleNewState = (event: AmiMessage<AmiNewStateEvent>): void => {
    const data = event.data
    const call = calls.value.get(data.Uniqueid || '')

    if (call) {
      const oldState = call.state
      call.state = parseInt(data.ChannelState || '0', 10) as ChannelState
      call.stateDesc = data.ChannelStateDesc || ''
      call.connectedLineNum = data.ConnectedLineNum || call.connectedLineNum
      call.connectedLineName = data.ConnectedLineName || call.connectedLineName

      if (oldState !== call.state) {
        config.onCallStateChange?.(call, oldState)
      }
    }
  }

  // ============================================================================
  // Setup Event Listeners
  // ============================================================================

  const setupEventListeners = (): void => {
    if (!client || !config.useEvents) return

    client.on('newChannel', handleNewChannel)
    client.on('hangup', handleHangup)
    client.on('newState', handleNewState)

    eventCleanups.push(() => {
      client.off('newChannel', handleNewChannel)
      client.off('hangup', handleHangup)
      client.off('newState', handleNewState)
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
    calls,
    channels,
    loading,
    error,
    lastRefresh,

    // Computed
    callList,
    callCount,
    ringingCalls,
    connectedCalls,
    dialingCalls,
    totalDuration,

    // Methods
    refresh,
    clickToCall,
    originate,
    hangup,
    transfer,
    getStateLabel,
  }
}
