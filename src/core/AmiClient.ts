/**
 * AMI WebSocket Client
 * Connects to Asterisk via amiws proxy for AMI operations
 * @packageDocumentation
 */

import { createLogger } from '@/utils/logger'
import type {
  AmiConfig,
  AmiAction,
  AmiMessage,
  AmiResponseData,
  AmiEventData,
  AmiPresenceStateResponse,
  AmiPresenceStateChangeEvent,
  AmiClientEvents,
  QueueInfo,
  QueueMember,
  QueueEntry,
  QueueSummary,
  ChannelInfo,
  OriginateOptions,
  OriginateResult,
  PeerInfo,
  PeerStatus,
  AmiQueueParamsEvent,
  AmiQueueMemberEvent,
  AmiQueueEntryEvent,
  AmiQueueMemberStatusEvent,
  AmiQueueCallerJoinEvent,
  AmiQueueCallerLeaveEvent,
  AmiQueueCallerAbandonEvent,
  AmiNewChannelEvent,
  AmiHangupEvent,
  AmiNewStateEvent,
  AmiCoreShowChannelEvent,
  AmiPeerEntryEvent,
  AmiPeerStatusEvent,
} from '@/types/ami.types'

/**
 * AMI Error codes for categorizing errors
 */
export enum AmiErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  DISCONNECTED = 'DISCONNECTED',
  ACTION_TIMEOUT = 'ACTION_TIMEOUT',
  ACTION_FAILED = 'ACTION_FAILED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  NOT_CONNECTED = 'NOT_CONNECTED',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
}

/**
 * Custom AMI Error class with error code
 */
export class AmiError extends Error {
  code: AmiErrorCode
  details?: Record<string, unknown>

  constructor(message: string, code: AmiErrorCode, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AmiError'
    this.code = code
    this.details = details
  }
}
import {
  AmiMessageType,
  AmiConnectionState,
  QueueMemberStatus,
  DEFAULT_QUEUE_MEMBER_STATUS_LABELS,
  ChannelState,
} from '@/types/ami.types'

const logger = createLogger('AmiClient')

/**
 * AMI WebSocket Client
 *
 * Connects to Asterisk Manager Interface via amiws WebSocket proxy.
 * Enables querying presence states, extension status, and receiving real-time events.
 *
 * @example
 * ```typescript
 * const ami = new AmiClient({ url: 'ws://pbx.example.com:8080' })
 * await ami.connect()
 *
 * // Query presence state
 * const state = await ami.getPresenceState('1000')
 * console.log(state) // { state: 'available', message: 'In office' }
 *
 * // Listen for presence changes
 * ami.on('presenceChange', (event) => {
 *   console.log(`${event.data.Presentity} is now ${event.data.State}`)
 * })
 * ```
 */
export class AmiClient {
  private config: Required<AmiConfig>
  private ws: WebSocket | null = null
  private state: AmiConnectionState = AmiConnectionState.Disconnected
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private pendingActions = new Map<string, {
    resolve: (response: AmiMessage<AmiResponseData>) => void
    reject: (error: Error) => void
    timeout: number
  }>()
  private eventListeners = new Map<keyof AmiClientEvents, Set<Function>>()
  private actionIdCounter = 0

  constructor(config: AmiConfig) {
    this.config = {
      url: config.url,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      connectionTimeout: config.connectionTimeout ?? 10000,
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to amiws WebSocket proxy
   */
  async connect(): Promise<void> {
    if (this.state === AmiConnectionState.Connected) {
      logger.warn('Already connected to AMI')
      return
    }

    this.state = AmiConnectionState.Connecting
    logger.info('Connecting to AMI WebSocket', { url: this.config.url })

    return new Promise((resolve, reject) => {
      let connectionTimeoutId: number | null = null
      let isResolved = false

      const cleanup = () => {
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId)
          connectionTimeoutId = null
        }
      }

      const handleReject = (error: Error) => {
        if (isResolved) return
        isResolved = true
        cleanup()
        this.state = AmiConnectionState.Failed
        reject(error)
      }

      const handleResolve = () => {
        if (isResolved) return
        isResolved = true
        cleanup()
        resolve()
      }

      try {
        // Set connection timeout
        connectionTimeoutId = window.setTimeout(() => {
          if (this.ws) {
            this.ws.onopen = null
            this.ws.onclose = null
            this.ws.onerror = null
            this.ws.close()
            this.ws = null
          }
          handleReject(new AmiError(
            `Connection timeout after ${this.config.connectionTimeout}ms`,
            AmiErrorCode.CONNECTION_TIMEOUT,
            { url: this.config.url, timeout: this.config.connectionTimeout }
          ))
        }, this.config.connectionTimeout)

        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          logger.info('Connected to AMI WebSocket')
          this.state = AmiConnectionState.Connected
          this.reconnectAttempts = 0
          this.emit('connected')
          handleResolve()
        }

        this.ws.onclose = (event) => {
          logger.info('AMI WebSocket closed', { code: event.code, reason: event.reason })
          if (!isResolved) {
            handleReject(new AmiError(
              `WebSocket closed during connection: ${event.reason || 'No reason'}`,
              AmiErrorCode.CONNECTION_FAILED,
              { code: event.code, reason: event.reason }
            ))
          } else {
            this.handleDisconnect(event.reason)
          }
        }

        this.ws.onerror = (error) => {
          logger.error('AMI WebSocket error', error)
          const amiError = new AmiError(
            'WebSocket error during connection',
            AmiErrorCode.WEBSOCKET_ERROR,
            { url: this.config.url }
          )
          this.emit('error', amiError)
          if (this.state === AmiConnectionState.Connecting) {
            handleReject(amiError)
          }
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (error) {
        logger.error('Failed to create WebSocket', error)
        const amiError = new AmiError(
          `Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`,
          AmiErrorCode.CONNECTION_FAILED,
          { url: this.config.url, originalError: error }
        )
        handleReject(amiError)
      }
    })
  }

  /**
   * Disconnect from amiws
   */
  disconnect(): void {
    logger.info('Disconnecting from AMI WebSocket')

    // Cancel reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Clear pending actions
    this.pendingActions.forEach(({ reject, timeout }) => {
      clearTimeout(timeout)
      reject(new AmiError(
        'Disconnected from AMI',
        AmiErrorCode.DISCONNECTED,
        { reason: 'Manual disconnect' }
      ))
    })
    this.pendingActions.clear()

    // Close WebSocket
    if (this.ws) {
      this.ws.onclose = null // Prevent reconnect
      this.ws.close()
      this.ws = null
    }

    this.state = AmiConnectionState.Disconnected
    this.emit('disconnected', 'Manual disconnect')
  }

  /**
   * Get current connection state
   */
  getState(): AmiConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.state === AmiConnectionState.Connected && this.ws?.readyState === WebSocket.OPEN
  }

  // ============================================================================
  // AMI Actions
  // ============================================================================

  /**
   * Send an AMI action and wait for response
   */
  async sendAction<T extends AmiResponseData = AmiResponseData>(
    action: AmiAction,
    timeout = 10000
  ): Promise<AmiMessage<T>> {
    if (!this.isConnected) {
      throw new AmiError(
        'Not connected to AMI',
        AmiErrorCode.NOT_CONNECTED,
        { action: action.Action }
      )
    }

    // Generate action ID if not provided
    const actionId = action.ActionID || this.generateActionId()
    const actionWithId = { ...action, ActionID: actionId }

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = window.setTimeout(() => {
        this.pendingActions.delete(actionId)
        reject(new AmiError(
          `AMI action timeout: ${action.Action}`,
          AmiErrorCode.ACTION_TIMEOUT,
          { action: action.Action, actionId, timeout }
        ))
      }, timeout)

      // Store pending action
      this.pendingActions.set(actionId, {
        resolve: resolve as (response: AmiMessage<AmiResponseData>) => void,
        reject,
        timeout: timeoutId,
      })

      // Send action
      const message = JSON.stringify(actionWithId)
      logger.debug('Sending AMI action', actionWithId)
      this.ws!.send(message)
    })
  }

  /**
   * Get presence state for an extension
   *
   * @param extension - Extension number (e.g., '1000')
   * @param provider - Presence provider (default: 'CustomPresence')
   * @returns Presence state info
   */
  async getPresenceState(
    extension: string,
    provider = 'CustomPresence'
  ): Promise<{ state: string; subtype?: string; message?: string }> {
    const response = await this.sendAction<AmiPresenceStateResponse>({
      Action: 'PresenceState',
      Provider: `${provider}:${extension}`,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to get presence state')
    }

    return {
      state: response.data.State?.toLowerCase() || 'unknown',
      subtype: response.data.Subtype,
      message: response.data.Message,
    }
  }

  /**
   * Set presence state for an extension (requires appropriate AMI permissions)
   *
   * @param extension - Extension number
   * @param state - New presence state
   * @param options - Additional options (subtype, message)
   */
  async setPresenceState(
    extension: string,
    state: string,
    options?: { subtype?: string; message?: string }
  ): Promise<void> {
    const response = await this.sendAction({
      Action: 'PresenceStateChange',
      Provider: `CustomPresence:${extension}`,
      State: state.toUpperCase(),
      Subtype: options?.subtype,
      Message: options?.message,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to set presence state')
    }
  }

  /**
   * Get extension status (device state)
   *
   * @param extension - Extension number
   * @param context - Dialplan context (default: 'ext-local')
   */
  async getExtensionStatus(
    extension: string,
    context = 'ext-local'
  ): Promise<{ status: number; statusText: string }> {
    const response = await this.sendAction({
      Action: 'ExtensionState',
      Exten: extension,
      Context: context,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to get extension status')
    }

    return {
      status: parseInt(response.data.Status || '-1', 10),
      statusText: response.data.StatusText || 'Unknown',
    }
  }

  /**
   * Subscribe to presence state changes for an extension
   * Note: Requires the extension to have a presence hint configured
   *
   * @param extension - Extension number
   */
  async subscribePresence(extension: string): Promise<void> {
    // In Asterisk, presence subscriptions are typically handled via SIP SUBSCRIBE
    // AMI can receive PresenceStateChange events but doesn't have a direct subscribe action
    // This method is a placeholder - events will be received if hints are configured
    logger.info('Presence subscription via AMI - events will be received for configured hints', {
      extension,
    })
  }

  /**
   * Send a raw AMI command (for advanced usage)
   */
  async rawCommand(command: string): Promise<AmiMessage<AmiResponseData>> {
    // Parse command string into action object
    const lines = command.trim().split('\n')
    const action: AmiAction = { Action: '' }

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':')
      const value = valueParts.join(':').trim()
      if (key && value) {
        action[key.trim()] = value
      }
    }

    if (!action.Action) {
      throw new Error('Invalid AMI command - missing Action')
    }

    return this.sendAction(action)
  }

  // ============================================================================
  // Queue Methods
  // ============================================================================

  /**
   * Get queue status with members and entries
   * Returns multiple events aggregated into QueueInfo objects
   *
   * @param queue - Optional queue name to filter (undefined = all queues)
   * @param timeout - Timeout in ms (default: 30000)
   */
  async getQueueStatus(queue?: string, timeout = 30000): Promise<QueueInfo[]> {
    const actionId = this.generateActionId()
    const queues = new Map<string, QueueInfo>()

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('event', handler)
        reject(new Error('QueueStatus timeout'))
      }, timeout)

      const handler = (event: AmiMessage<AmiEventData>) => {
        if (event.data.ActionID !== actionId) return

        switch (event.data.Event) {
          case 'QueueParams': {
            const data = event.data as unknown as AmiQueueParamsEvent
            queues.set(data.Queue, {
              name: data.Queue,
              strategy: data.Strategy || '',
              calls: parseInt(data.Calls || '0', 10),
              holdtime: parseInt(data.Holdtime || '0', 10),
              talktime: parseInt(data.TalkTime || '0', 10),
              completed: parseInt(data.Completed || '0', 10),
              abandoned: parseInt(data.Abandoned || '0', 10),
              serviceLevelPerf: parseFloat(data.ServiceLevelPerf || '0'),
              serviceLevelPerf2: parseFloat(data.ServiceLevelPerf2 || '0'),
              weight: parseInt(data.Weight || '0', 10),
              members: [],
              entries: [],
              serverId: event.server_id,
              lastUpdated: new Date(),
            })
            break
          }
          case 'QueueMember': {
            const data = event.data as unknown as AmiQueueMemberEvent
            const queueInfo = queues.get(data.Queue)
            if (queueInfo) {
              queueInfo.members.push(this.parseQueueMember(data, event.server_id))
            }
            break
          }
          case 'QueueEntry': {
            const data = event.data as unknown as AmiQueueEntryEvent
            const queueInfo = queues.get(data.Queue)
            if (queueInfo) {
              queueInfo.entries.push(this.parseQueueEntry(data, event.server_id))
            }
            break
          }
          case 'QueueStatusComplete': {
            clearTimeout(timeoutId)
            this.off('event', handler)
            resolve(Array.from(queues.values()))
            break
          }
        }
      }

      this.on('event', handler)

      const action: AmiAction = { Action: 'QueueStatus', ActionID: actionId }
      if (queue) {
        action.Queue = queue
      }

      this.sendAction(action).catch((err) => {
        clearTimeout(timeoutId)
        this.off('event', handler)
        reject(err)
      })
    })
  }

  /**
   * Get queue summary (quick overview)
   *
   * @param queue - Optional queue name
   */
  async getQueueSummary(queue?: string, timeout = 10000): Promise<QueueSummary[]> {
    const actionId = this.generateActionId()
    const summaries: QueueSummary[] = []

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('event', handler)
        reject(new Error('QueueSummary timeout'))
      }, timeout)

      const handler = (event: AmiMessage<AmiEventData>) => {
        if (event.data.ActionID !== actionId) return

        if (event.data.Event === 'QueueSummary') {
          summaries.push({
            queue: event.data.Queue || '',
            loggedIn: parseInt(event.data.LoggedIn || '0', 10),
            available: parseInt(event.data.Available || '0', 10),
            callers: parseInt(event.data.Callers || '0', 10),
            holdtime: parseInt(event.data.Holdtime || '0', 10),
            talktime: parseInt(event.data.TalkTime || '0', 10),
            longestHoldTime: parseInt(event.data.LongestHoldTime || '0', 10),
          })
        } else if (event.data.Event === 'QueueSummaryComplete') {
          clearTimeout(timeoutId)
          this.off('event', handler)
          resolve(summaries)
        }
      }

      this.on('event', handler)

      const action: AmiAction = { Action: 'QueueSummary', ActionID: actionId }
      if (queue) {
        action.Queue = queue
      }

      this.sendAction(action).catch((err) => {
        clearTimeout(timeoutId)
        this.off('event', handler)
        reject(err)
      })
    })
  }

  /**
   * Add a member to a queue
   */
  async queueAdd(
    queue: string,
    iface: string,
    options?: {
      memberName?: string
      penalty?: number
      paused?: boolean
      stateInterface?: string
    }
  ): Promise<void> {
    const response = await this.sendAction({
      Action: 'QueueAdd',
      Queue: queue,
      Interface: iface,
      MemberName: options?.memberName,
      Penalty: options?.penalty?.toString(),
      Paused: options?.paused ? 'true' : 'false',
      StateInterface: options?.stateInterface,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to add queue member')
    }
  }

  /**
   * Remove a member from a queue
   */
  async queueRemove(queue: string, iface: string): Promise<void> {
    const response = await this.sendAction({
      Action: 'QueueRemove',
      Queue: queue,
      Interface: iface,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to remove queue member')
    }
  }

  /**
   * Pause/unpause a queue member
   */
  async queuePause(
    queue: string,
    iface: string,
    paused: boolean,
    reason?: string
  ): Promise<void> {
    const response = await this.sendAction({
      Action: 'QueuePause',
      Queue: queue,
      Interface: iface,
      Paused: paused ? 'true' : 'false',
      Reason: reason,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to pause/unpause queue member')
    }
  }

  /**
   * Set penalty for queue member
   */
  async queuePenalty(queue: string, iface: string, penalty: number): Promise<void> {
    const response = await this.sendAction({
      Action: 'QueuePenalty',
      Queue: queue,
      Interface: iface,
      Penalty: penalty.toString(),
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to set queue penalty')
    }
  }

  // ============================================================================
  // Channel/Call Methods
  // ============================================================================

  /**
   * Get all active channels
   */
  async getChannels(timeout = 30000): Promise<ChannelInfo[]> {
    const actionId = this.generateActionId()
    const channels: ChannelInfo[] = []

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('event', handler)
        reject(new Error('CoreShowChannels timeout'))
      }, timeout)

      const handler = (event: AmiMessage<AmiEventData>) => {
        if (event.data.ActionID !== actionId) return

        if (event.data.Event === 'CoreShowChannel') {
          const data = event.data as unknown as AmiCoreShowChannelEvent
          channels.push(this.parseChannel(data, event.server_id))
        } else if (event.data.Event === 'CoreShowChannelsComplete') {
          clearTimeout(timeoutId)
          this.off('event', handler)
          resolve(channels)
        }
      }

      this.on('event', handler)

      this.sendAction({ Action: 'CoreShowChannels', ActionID: actionId }).catch((err) => {
        clearTimeout(timeoutId)
        this.off('event', handler)
        reject(err)
      })
    })
  }

  /**
   * Originate a call
   *
   * @param options - Originate options
   */
  async originate(options: OriginateOptions): Promise<OriginateResult> {
    const action: AmiAction = {
      Action: 'Originate',
      Channel: options.channel,
      Async: options.async !== false ? 'true' : 'false',
    }

    if (options.exten) {
      action.Exten = options.exten
      action.Context = options.context || 'from-internal'
      action.Priority = (options.priority || 1).toString()
    } else if (options.application) {
      action.Application = options.application
      action.Data = options.data
    }

    if (options.callerId) {
      action.CallerID = options.callerId
    }
    if (options.timeout) {
      action.Timeout = options.timeout.toString()
    }
    if (options.account) {
      action.Account = options.account
    }
    if (options.codecs) {
      action.Codecs = options.codecs
    }
    if (options.earlyMedia) {
      action.EarlyMedia = 'true'
    }
    if (options.variables) {
      // Format: var1=val1,var2=val2
      action.Variable = Object.entries(options.variables)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    }

    const response = await this.sendAction(action, options.timeout || 30000)

    return {
      success: response.data.Response === 'Success',
      channel: response.data.Channel,
      uniqueId: response.data.Uniqueid,
      message: response.data.Message,
      response: response.data.Response,
    }
  }

  /**
   * Hangup a channel
   */
  async hangupChannel(channel: string, cause?: number): Promise<void> {
    const response = await this.sendAction({
      Action: 'Hangup',
      Channel: channel,
      Cause: cause?.toString(),
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to hangup channel')
    }
  }

  /**
   * Redirect a channel (transfer)
   */
  async redirectChannel(
    channel: string,
    context: string,
    exten: string,
    priority = 1
  ): Promise<void> {
    const response = await this.sendAction({
      Action: 'Redirect',
      Channel: channel,
      Context: context,
      Exten: exten,
      Priority: priority.toString(),
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to redirect channel')
    }
  }

  // ============================================================================
  // Peer Methods
  // ============================================================================

  /**
   * Get SIP peers
   */
  async getSipPeers(timeout = 30000): Promise<PeerInfo[]> {
    const actionId = this.generateActionId()
    const peers: PeerInfo[] = []

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('event', handler)
        reject(new Error('SIPpeers timeout'))
      }, timeout)

      const handler = (event: AmiMessage<AmiEventData>) => {
        if (event.data.ActionID !== actionId) return

        if (event.data.Event === 'PeerEntry') {
          const data = event.data as unknown as AmiPeerEntryEvent
          peers.push(this.parsePeer(data, 'SIP', event.server_id))
        } else if (event.data.Event === 'PeerlistComplete') {
          clearTimeout(timeoutId)
          this.off('event', handler)
          resolve(peers)
        }
      }

      this.on('event', handler)

      this.sendAction({ Action: 'SIPpeers', ActionID: actionId }).catch((err) => {
        clearTimeout(timeoutId)
        this.off('event', handler)
        reject(err)
      })
    })
  }

  /**
   * Get PJSIP endpoints
   */
  async getPjsipEndpoints(timeout = 30000): Promise<PeerInfo[]> {
    const actionId = this.generateActionId()
    const peers: PeerInfo[] = []

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('event', handler)
        reject(new Error('PJSIPShowEndpoints timeout'))
      }, timeout)

      const handler = (event: AmiMessage<AmiEventData>) => {
        if (event.data.ActionID !== actionId) return

        if (event.data.Event === 'EndpointList') {
          peers.push({
            objectName: event.data.ObjectName || '',
            channelType: 'PJSIP',
            ipAddress: '',
            port: 0,
            status: event.data.DeviceState === 'Not in use' ? 'OK' : 'UNKNOWN',
            dynamic: false,
            forceRPort: false,
            comedia: false,
            acl: false,
            autoForcerPort: false,
            autoComedia: false,
            videoSupport: false,
            textSupport: false,
            realtimeDevice: false,
            serverId: event.server_id,
          })
        } else if (event.data.Event === 'EndpointListComplete') {
          clearTimeout(timeoutId)
          this.off('event', handler)
          resolve(peers)
        }
      }

      this.on('event', handler)

      this.sendAction({ Action: 'PJSIPShowEndpoints', ActionID: actionId }).catch((err) => {
        clearTimeout(timeoutId)
        this.off('event', handler)
        reject(err)
      })
    })
  }

  /**
   * Get all peers (both SIP and PJSIP)
   */
  async getAllPeers(): Promise<PeerInfo[]> {
    const [sipPeers, pjsipPeers] = await Promise.allSettled([
      this.getSipPeers(),
      this.getPjsipEndpoints(),
    ])

    const peers: PeerInfo[] = []
    if (sipPeers.status === 'fulfilled') {
      peers.push(...sipPeers.value)
    }
    if (pjsipPeers.status === 'fulfilled') {
      peers.push(...pjsipPeers.value)
    }
    return peers
  }

  // ============================================================================
  // Database Methods (AstDB)
  // ============================================================================

  /**
   * Get a value from AstDB
   */
  async dbGet(family: string, key: string): Promise<string | null> {
    try {
      const response = await this.sendAction({
        Action: 'DBGet',
        Family: family,
        Key: key,
      })

      if (response.data.Response === 'Success') {
        return response.data.Val || null
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Put a value into AstDB
   */
  async dbPut(family: string, key: string, value: string): Promise<void> {
    const response = await this.sendAction({
      Action: 'DBPut',
      Family: family,
      Key: key,
      Val: value,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to put DB value')
    }
  }

  /**
   * Delete a value from AstDB
   */
  async dbDel(family: string, key: string): Promise<void> {
    const response = await this.sendAction({
      Action: 'DBDel',
      Family: family,
      Key: key,
    })

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to delete DB value')
    }
  }

  /**
   * Delete a tree from AstDB
   */
  async dbDelTree(family: string, key?: string): Promise<void> {
    const action: AmiAction = {
      Action: 'DBDelTree',
      Family: family,
    }
    if (key) {
      action.Key = key
    }

    const response = await this.sendAction(action)

    if (response.data.Response !== 'Success') {
      throw new Error(response.data.Message || 'Failed to delete DB tree')
    }
  }

  /**
   * Get all keys under a family (requires custom parsing)
   * Note: This is done by sending DBGet and checking for specific keys
   * For listing, consider using dbGetTree if available on your Asterisk version
   */
  async dbGetKeys(_family: string, _prefix = ''): Promise<string[]> {
    // This is a workaround - AMI doesn't have a native "list keys" action
    // Some versions support DBGetTree, but it's not universal
    // For now, return empty array - users should implement their own key tracking
    logger.warn('dbGetKeys requires custom implementation - AMI has no native list action')
    return []
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Register event listener
   */
  on<K extends keyof AmiClientEvents>(event: K, listener: AmiClientEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * Remove event listener
   */
  off<K extends keyof AmiClientEvents>(event: K, listener: AmiClientEvents[K]): void {
    this.eventListeners.get(event)?.delete(listener)
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof AmiClientEvents>(
    event: K,
    ...args: Parameters<AmiClientEvents[K]>
  ): void {
    this.eventListeners.get(event)?.forEach((listener) => {
      try {
        (listener as Function)(...args)
      } catch (error) {
        logger.error(`Error in ${event} listener`, error)
      }
    })
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message: AmiMessage = JSON.parse(data)
      logger.debug('AMI message received', { type: message.type, server: message.server_name })

      // Emit generic message event
      this.emit('message', message)

      switch (message.type) {
        case AmiMessageType.Response:
          this.handleResponse(message as AmiMessage<AmiResponseData>)
          break

        case AmiMessageType.Event:
          this.handleEvent(message as AmiMessage<AmiEventData>)
          break

        case AmiMessageType.Disconnect:
          logger.warn('AMI server disconnected', { server: message.server_name })
          break

        default:
          logger.debug('Unhandled AMI message type', { type: message.type })
      }
    } catch (error) {
      logger.error('Failed to parse AMI message', error)
    }
  }

  /**
   * Handle AMI response
   */
  private handleResponse(message: AmiMessage<AmiResponseData>): void {
    const actionId = message.data.ActionID
    if (actionId && this.pendingActions.has(actionId)) {
      const pending = this.pendingActions.get(actionId)!
      this.pendingActions.delete(actionId)
      clearTimeout(pending.timeout)
      pending.resolve(message)
    }

    this.emit('response', message)
  }

  /**
   * Handle AMI event
   */
  private handleEvent(message: AmiMessage<AmiEventData>): void {
    this.emit('event', message)

    // Handle specific event types
    switch (message.data.Event) {
      case 'PresenceStateChange':
        this.emit('presenceChange', message as AmiMessage<AmiPresenceStateChangeEvent>)
        break
      case 'QueueMemberStatus':
        this.emit('queueMemberStatus', message as AmiMessage<AmiQueueMemberStatusEvent>)
        break
      case 'QueueCallerJoin':
        this.emit('queueCallerJoin', message as AmiMessage<AmiQueueCallerJoinEvent>)
        break
      case 'QueueCallerLeave':
        this.emit('queueCallerLeave', message as AmiMessage<AmiQueueCallerLeaveEvent>)
        break
      case 'QueueCallerAbandon':
        this.emit('queueCallerAbandon', message as AmiMessage<AmiQueueCallerAbandonEvent>)
        break
      case 'Newchannel':
        this.emit('newChannel', message as AmiMessage<AmiNewChannelEvent>)
        break
      case 'Hangup':
        this.emit('hangup', message as AmiMessage<AmiHangupEvent>)
        break
      case 'Newstate':
        this.emit('newState', message as AmiMessage<AmiNewStateEvent>)
        break
      case 'PeerStatus':
        this.emit('peerStatus', message as AmiMessage<AmiPeerStatusEvent>)
        break
    }
  }

  /**
   * Handle disconnect and optionally reconnect
   */
  private handleDisconnect(reason?: string): void {
    this.state = AmiConnectionState.Disconnected
    this.ws = null
    this.emit('disconnected', reason)

    // Attempt reconnect if enabled
    if (this.config.autoReconnect) {
      const maxAttempts = this.config.maxReconnectAttempts
      if (maxAttempts === 0 || this.reconnectAttempts < maxAttempts) {
        this.scheduleReconnect()
      } else {
        logger.error('Max reconnect attempts reached')
        this.state = AmiConnectionState.Failed
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.state = AmiConnectionState.Reconnecting
    this.reconnectAttempts++

    logger.info('Scheduling AMI reconnect', {
      attempt: this.reconnectAttempts,
      delay: this.config.reconnectDelay,
    })

    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        logger.error('Reconnect failed', error)
      }
    }, this.config.reconnectDelay)
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `vuesip-${Date.now()}-${++this.actionIdCounter}`
  }

  // ============================================================================
  // Parser Helpers
  // ============================================================================

  /**
   * Parse queue member from AMI event data
   */
  private parseQueueMember(data: AmiQueueMemberEvent, serverId?: number): QueueMember {
    return {
      queue: data.Queue,
      name: data.MemberName || data.Name || '',
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
      statusLabel: DEFAULT_QUEUE_MEMBER_STATUS_LABELS[parseInt(data.Status || '0', 10) as QueueMemberStatus] || 'Unknown',
      paused: data.Paused === '1',
      pausedReason: data.PausedReason || '',
      wrapupTime: parseInt(data.WrapupTime || '0', 10),
      ringinuse: data.Ringinuse === '1',
      serverId,
    }
  }

  /**
   * Parse queue entry (waiting caller) from AMI event data
   */
  private parseQueueEntry(data: AmiQueueEntryEvent, serverId?: number): QueueEntry {
    return {
      queue: data.Queue,
      position: parseInt(data.Position || '0', 10),
      channel: data.Channel || '',
      uniqueId: data.Uniqueid || '',
      callerIdNum: data.CallerIDNum || '',
      callerIdName: data.CallerIDName || '',
      connectedLineNum: data.ConnectedLineNum || '',
      connectedLineName: data.ConnectedLineName || '',
      wait: parseInt(data.Wait || '0', 10),
      priority: parseInt(data.Priority || '0', 10),
      serverId,
    }
  }

  /**
   * Parse channel from AMI CoreShowChannel event
   */
  private parseChannel(data: AmiCoreShowChannelEvent, serverId?: number): ChannelInfo {
    const state = parseInt(data.ChannelState || '0', 10) as ChannelState
    const stateDesc = data.ChannelStateDesc || ''
    return {
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
      application: data.Application || '',
      applicationData: data.ApplicationData || '',
      duration: data.Duration || '00:00:00',
      bridgeId: data.BridgeId || '',
      serverId,
      createdAt: new Date(),
    }
  }

  /**
   * Parse peer from AMI PeerEntry event
   */
  private parsePeer(data: AmiPeerEntryEvent, channelType: 'SIP' | 'PJSIP', serverId?: number): PeerInfo {
    // Map status string to PeerStatus type
    const rawStatus = data.Status || 'UNKNOWN'
    let status: PeerStatus = 'UNKNOWN'
    if (rawStatus === 'OK' || rawStatus.startsWith('OK')) status = 'OK'
    else if (rawStatus === 'LAGGED' || rawStatus.includes('LAGGED')) status = 'LAGGED'
    else if (rawStatus === 'UNREACHABLE') status = 'UNREACHABLE'
    else if (rawStatus === 'Unmonitored') status = 'Unmonitored'

    return {
      objectName: data.ObjectName || '',
      channelType,
      ipAddress: data.IPaddress || '',
      port: parseInt(data.IPport || '0', 10),
      status,
      dynamic: data.Dynamic === 'yes',
      forceRPort: data.Forcerport === 'yes',
      comedia: data.Comedia === 'yes',
      acl: data.ACL === 'yes',
      autoForcerPort: data.AutoForcerport === 'yes',
      autoComedia: data.AutoComedia === 'yes',
      videoSupport: data.VideoSupport === 'yes',
      textSupport: data.TextSupport === 'yes',
      realtimeDevice: data.RealtimeDevice === 'yes',
      description: data.Description,
      serverId,
    }
  }
}

/**
 * Create AMI client instance
 */
export function createAmiClient(config: AmiConfig): AmiClient {
  return new AmiClient(config)
}
