/**
 * AMI Peers Composable
 *
 * Vue composable for Asterisk peer/endpoint status via AMI.
 * Provides reactive state for SIP peers and PJSIP endpoints.
 *
 * @module composables/useAmiPeers
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { AmiClient } from '@/core/AmiClient'
import type {
  PeerInfo,
  PeerStatus,
  UseAmiPeersOptions,
  AmiMessage,
  AmiPeerStatusEvent,
} from '@/types/ami.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useAmiPeers')

/**
 * Peer status summary
 */
export interface PeerStatusSummary {
  /** Total number of peers */
  total: number
  /** Number of online/OK peers */
  online: number
  /** Number of offline/unreachable peers */
  offline: number
  /** Number of peers in unknown state */
  unknown: number
}

/**
 * Return type for useAmiPeers composable
 */
export interface UseAmiPeersReturn {
  // State
  /** Map of peers by object name */
  peers: Ref<Map<string, PeerInfo>>
  /** Loading state */
  loading: Ref<boolean>
  /** Error message */
  error: Ref<string | null>
  /** Last refresh timestamp */
  lastRefresh: Ref<Date | null>

  // Computed
  /** List of all peers */
  peerList: ComputedRef<PeerInfo[]>
  /** SIP peers only */
  sipPeers: ComputedRef<PeerInfo[]>
  /** PJSIP peers only */
  pjsipPeers: ComputedRef<PeerInfo[]>
  /** Online peers */
  onlinePeers: ComputedRef<PeerInfo[]>
  /** Offline peers */
  offlinePeers: ComputedRef<PeerInfo[]>
  /** Status summary */
  statusSummary: ComputedRef<PeerStatusSummary>

  // Methods
  /** Refresh all peer data */
  refresh: () => Promise<void>
  /** Refresh SIP peers only */
  refreshSipPeers: () => Promise<void>
  /** Refresh PJSIP endpoints only */
  refreshPjsipPeers: () => Promise<void>
  /** Get peer by name */
  getPeer: (name: string) => PeerInfo | undefined
  /** Check if peer is online */
  isOnline: (nameOrPeer: string | PeerInfo) => boolean
}

/**
 * Default status patterns for online detection
 */
const DEFAULT_ONLINE_PATTERNS = ['OK', 'Registered', 'Reachable', 'Not in use']

/**
 * AMI Peers Composable
 *
 * Provides reactive peer/endpoint status for Vue components.
 * Supports both legacy chan_sip and modern chan_pjsip.
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
 *   peers,
 *   peerList,
 *   onlinePeers,
 *   statusSummary,
 *   refresh,
 *   isOnline,
 * } = useAmiPeers(ami.getClient()!, {
 *   useEvents: true,
 *   includeSip: true,
 *   includePjsip: true,
 *   peerFilter: (peer) => !peer.objectName.startsWith('trunk-'),
 *   onPeerUpdate: (peer) => console.log('Peer updated:', peer.objectName, peer.status),
 * })
 *
 * // Initial load
 * await refresh()
 *
 * // Check if specific peer is online
 * if (isOnline('1000')) {
 *   console.log('Extension 1000 is online')
 * }
 * ```
 */
export function useAmiPeers(
  client: AmiClient | null,
  options: UseAmiPeersOptions = {}
): UseAmiPeersReturn {
  // ============================================================================
  // Configuration with defaults
  // ============================================================================

  const config = {
    pollInterval: options.pollInterval ?? 0,
    useEvents: options.useEvents ?? true,
    includeSip: options.includeSip ?? true,
    includePjsip: options.includePjsip ?? true,
    peerFilter: options.peerFilter,
    onlineStatusPatterns: options.onlineStatusPatterns ?? DEFAULT_ONLINE_PATTERNS,
    onPeerUpdate: options.onPeerUpdate,
    transformPeer: options.transformPeer,
  }

  // ============================================================================
  // State
  // ============================================================================

  const peers = ref<Map<string, PeerInfo>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastRefresh = ref<Date | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  const eventCleanups: Array<() => void> = []

  // ============================================================================
  // Computed
  // ============================================================================

  const peerList = computed(() => {
    let list = Array.from(peers.value.values())
    if (config.peerFilter) {
      list = list.filter(config.peerFilter)
    }
    return list
  })

  const sipPeers = computed(() =>
    peerList.value.filter((p) => p.channelType === 'SIP')
  )

  const pjsipPeers = computed(() =>
    peerList.value.filter((p) => p.channelType === 'PJSIP')
  )

  const onlinePeers = computed(() =>
    peerList.value.filter((p) => isPeerOnline(p))
  )

  const offlinePeers = computed(() =>
    peerList.value.filter((p) => !isPeerOnline(p))
  )

  const statusSummary = computed<PeerStatusSummary>(() => {
    const list = peerList.value
    let online = 0
    let offline = 0
    let unknown = 0

    for (const peer of list) {
      if (isPeerOnline(peer)) {
        online++
      } else if (peer.status === 'UNKNOWN' || !peer.status) {
        unknown++
      } else {
        offline++
      }
    }

    return {
      total: list.length,
      online,
      offline,
      unknown,
    }
  })

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Check if peer is online based on status patterns
   */
  const isPeerOnline = (peer: PeerInfo): boolean => {
    if (!peer.status) return false
    const status = peer.status.toLowerCase()
    return config.onlineStatusPatterns.some(
      (pattern: string) => status.includes(pattern.toLowerCase())
    )
  }

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Refresh all peer data
   */
  const refresh = async (): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    loading.value = true
    error.value = null

    try {
      const results = await Promise.allSettled([
        config.includeSip ? client.getSipPeers() : Promise.resolve([]),
        config.includePjsip ? client.getPjsipEndpoints() : Promise.resolve([]),
      ])

      peers.value.clear()

      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (let peer of result.value) {
            // Apply filter
            if (config.peerFilter && !config.peerFilter(peer)) {
              continue
            }

            // Apply transformation
            if (config.transformPeer) {
              peer = config.transformPeer(peer)
            }

            peers.value.set(peer.objectName, peer)
          }
        }
      }

      lastRefresh.value = new Date()
      logger.debug('Peer data refreshed', { count: peers.value.size })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh peers'
      logger.error('Failed to refresh peers', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Refresh SIP peers only
   */
  const refreshSipPeers = async (): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    try {
      const sipData = await client.getSipPeers()

      for (let peer of sipData) {
        // Apply filter
        if (config.peerFilter && !config.peerFilter(peer)) {
          continue
        }

        // Apply transformation
        if (config.transformPeer) {
          peer = config.transformPeer(peer)
        }

        peers.value.set(peer.objectName, peer)
        config.onPeerUpdate?.(peer)
      }
    } catch (err) {
      logger.error('Failed to refresh SIP peers', err)
    }
  }

  /**
   * Refresh PJSIP endpoints only
   */
  const refreshPjsipPeers = async (): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    try {
      const pjsipData = await client.getPjsipEndpoints()

      for (let peer of pjsipData) {
        // Apply filter
        if (config.peerFilter && !config.peerFilter(peer)) {
          continue
        }

        // Apply transformation
        if (config.transformPeer) {
          peer = config.transformPeer(peer)
        }

        peers.value.set(peer.objectName, peer)
        config.onPeerUpdate?.(peer)
      }
    } catch (err) {
      logger.error('Failed to refresh PJSIP endpoints', err)
    }
  }

  /**
   * Get peer by name
   */
  const getPeer = (name: string): PeerInfo | undefined => {
    return peers.value.get(name)
  }

  /**
   * Check if peer is online
   */
  const isOnline = (nameOrPeer: string | PeerInfo): boolean => {
    const peer = typeof nameOrPeer === 'string'
      ? peers.value.get(nameOrPeer)
      : nameOrPeer
    return peer ? isPeerOnline(peer) : false
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Parse peer status string to typed PeerStatus
   */
  const parsePeerStatus = (status: string | undefined): PeerStatus => {
    if (!status) return 'UNKNOWN'
    if (status === 'OK' || status.startsWith('OK')) return 'OK'
    if (status === 'LAGGED' || status.includes('LAGGED')) return 'LAGGED'
    if (status === 'UNREACHABLE') return 'UNREACHABLE'
    if (status === 'Unmonitored') return 'Unmonitored'
    return 'UNKNOWN'
  }

  const handlePeerStatus = (event: AmiMessage<AmiPeerStatusEvent>): void => {
    const data = event.data

    // Extract peer name from Peer field (e.g., "SIP/1000" -> "1000")
    const peerField = data.Peer || ''
    const parts = peerField.includes('/') ? peerField.split('/') : ['SIP', peerField]
    const channelType: 'SIP' | 'PJSIP' = parts[0] === 'PJSIP' ? 'PJSIP' : 'SIP'
    const objectName = parts[1] || ''

    if (!objectName) return

    const existingPeer = peers.value.get(objectName)

    if (existingPeer) {
      // Update existing peer
      existingPeer.status = parsePeerStatus(data.PeerStatus) ?? existingPeer.status
      existingPeer.ipAddress = data.Address?.split(':')[0] || existingPeer.ipAddress
      existingPeer.port = data.Address?.includes(':')
        ? parseInt(data.Address.split(':')[1] || '0', 10)
        : existingPeer.port

      config.onPeerUpdate?.(existingPeer)
    } else {
      // Create new peer entry
      let peer: PeerInfo = {
        objectName,
        channelType,
        ipAddress: data.Address?.split(':')[0] || '',
        port: data.Address?.includes(':')
          ? parseInt(data.Address.split(':')[1] || '0', 10)
          : 0,
        status: parsePeerStatus(data.PeerStatus),
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
      }

      // Apply filter
      if (config.peerFilter && !config.peerFilter(peer)) {
        return
      }

      // Apply transformation
      if (config.transformPeer) {
        peer = config.transformPeer(peer)
      }

      peers.value.set(objectName, peer)
      config.onPeerUpdate?.(peer)
    }
  }

  // ============================================================================
  // Setup Event Listeners
  // ============================================================================

  const setupEventListeners = (): void => {
    if (!client || !config.useEvents) return

    client.on('peerStatus', handlePeerStatus)

    eventCleanups.push(() => {
      client.off('peerStatus', handlePeerStatus)
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
    peers,
    loading,
    error,
    lastRefresh,

    // Computed
    peerList,
    sipPeers,
    pjsipPeers,
    onlinePeers,
    offlinePeers,
    statusSummary,

    // Methods
    refresh,
    refreshSipPeers,
    refreshPjsipPeers,
    getPeer,
    isOnline,
  }
}
