/**
 * MediaManager - Manages WebRTC media streams and devices
 * Handles RTCPeerConnection lifecycle, media devices, and statistics
 * @packageDocumentation
 */

import type { EventBus } from './EventBus'
import type {
  MediaDevice,
  MediaPermissions,
  ExtendedMediaStreamConstraints,
  MediaStatistics,
  AudioStatistics,
  VideoStatistics,
  NetworkStatistics,
  MediaDeviceChangeEvent,
} from '@/types/media.types'
import { MediaDeviceKind, PermissionStatus } from '@/types/media.types'
import type { ExtendedRTCConfiguration, MediaConfiguration } from '@/types/config.types'
import {
  DEFAULT_AUDIO_CONSTRAINTS,
  DEFAULT_VIDEO_CONSTRAINTS,
  ICE_GATHERING_TIMEOUT,
  STATS_COLLECTION_INTERVAL,
} from '@/utils/constants'
import { createLogger } from '@/utils/logger'
import { EventNames } from '@/types/events.types'

const logger = createLogger('MediaManager')

/**
 * ICE connection state
 */
export type IceConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'disconnected'
  | 'closed'

/**
 * ICE gathering state
 */
export type IceGatheringState = 'new' | 'gathering' | 'complete'

/**
 * Media manager options
 */
export interface MediaManagerOptions {
  /** Event bus for emitting events */
  eventBus: EventBus
  /** RTC configuration */
  rtcConfiguration?: ExtendedRTCConfiguration
  /** Media configuration */
  mediaConfiguration?: MediaConfiguration
  /** Enable auto-quality adjustment */
  autoQualityAdjustment?: boolean
}

/**
 * Device test result
 */
export interface DeviceTestResult {
  /** Device ID */
  deviceId: string
  /** Success status */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Audio level (0-1) if applicable */
  audioLevel?: number
}

/**
 * MediaManager manages WebRTC media streams and devices
 *
 * Features:
 * - RTCPeerConnection lifecycle management
 * - ICE candidate gathering and handling
 * - SDP offer/answer negotiation
 * - Local and remote media stream management
 * - Media device enumeration and selection
 * - Device permission handling
 * - DTMF tone generation
 * - WebRTC statistics collection
 * - Automatic quality adjustment
 * - Event-driven architecture
 *
 * @example
 * ```ts
 * const mediaManager = new MediaManager({ eventBus })
 * await mediaManager.enumerateDevices()
 * const stream = await mediaManager.getUserMedia({ audio: true, video: false })
 * ```
 */
export class MediaManager {
  private readonly eventBus: EventBus
  private readonly rtcConfiguration: ExtendedRTCConfiguration
  private readonly mediaConfiguration: MediaConfiguration
  private readonly autoQualityAdjustment: boolean

  // RTCPeerConnection
  private peerConnection?: RTCPeerConnection
  private iceGatheringComplete = false
  private iceGatheringTimeout?: NodeJS.Timeout

  // Media streams
  private localStream?: MediaStream
  private remoteStream?: MediaStream
  private isGettingUserMedia = false

  // DTMF sender
  private dtmfSender?: RTCDTMFSender

  // Devices
  private devices: MediaDevice[] = []
  private selectedAudioInputId?: string
  private selectedAudioOutputId?: string
  private selectedVideoInputId?: string

  // Permissions
  private permissions: MediaPermissions = {
    audio: PermissionStatus.NotRequested,
    video: PermissionStatus.NotRequested,
  }

  // Device monitoring
  private deviceChangeListener?: () => void

  // Statistics
  private statsInterval?: NodeJS.Timeout

  // Quality adjustment
  private qualityAdjustmentInterval?: NodeJS.Timeout

  constructor(options: MediaManagerOptions) {
    this.eventBus = options.eventBus
    this.rtcConfiguration = this.buildRTCConfiguration(options.rtcConfiguration)
    this.mediaConfiguration = options.mediaConfiguration || {}
    this.autoQualityAdjustment = options.autoQualityAdjustment ?? false

    logger.info('MediaManager initialized', {
      rtcConfig: this.rtcConfiguration,
      mediaConfig: this.mediaConfiguration,
      autoQuality: this.autoQualityAdjustment,
    })
  }

  // ============================================================================
  // RTCPeerConnection Lifecycle
  // ============================================================================

  /**
   * Create RTCPeerConnection
   */
  createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      logger.warn('PeerConnection already exists, closing existing one')
      this.closePeerConnection()
    }

    logger.info('Creating RTCPeerConnection', {
      config: this.rtcConfiguration,
    })

    this.peerConnection = new RTCPeerConnection(this.rtcConfiguration)
    this.iceGatheringComplete = false

    // Setup event handlers
    this.setupPeerConnectionHandlers()

    return this.peerConnection
  }

  /**
   * Get existing peer connection or create new one
   */
  getPeerConnection(): RTCPeerConnection {
    if (!this.peerConnection) {
      return this.createPeerConnection()
    }
    return this.peerConnection
  }

  /**
   * Close peer connection
   */
  closePeerConnection(): void {
    if (!this.peerConnection) return

    logger.info('Closing RTCPeerConnection')

    // Clear intervals
    this.stopStatsCollection()
    this.stopQualityAdjustment()

    // Clear ICE gathering timeout
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout)
      this.iceGatheringTimeout = undefined
    }

    // Close connection
    this.peerConnection.close()
    this.peerConnection = undefined
    this.iceGatheringComplete = false
    this.dtmfSender = undefined
  }

  /**
   * Setup peer connection event handlers
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return

    const pc = this.peerConnection

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        logger.debug('ICE candidate generated', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        })
        ;(this.eventBus as any).emitSync('media:ice:candidate', {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          candidate: event.candidate,
        })
      } else {
        logger.debug('ICE gathering complete (null candidate)')
        this.iceGatheringComplete = true
        ;(this.eventBus as any).emitSync('media:ice:gathering:complete', {}) // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }

    // ICE connection state change
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState as IceConnectionState
      logger.info('ICE connection state changed', { state })
      ;(this.eventBus as any).emitSync('media:ice:connection:state', { state }) // eslint-disable-line @typescript-eslint/no-explicit-any

      // Handle connection failures
      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure(state)
      } else if (state === 'connected' || state === 'completed') {
        this.handleConnectionSuccess()
      }
    }

    // ICE gathering state change
    pc.onicegatheringstatechange = () => {
      const state = pc.iceGatheringState as IceGatheringState
      logger.info('ICE gathering state changed', { state })
      ;(this.eventBus as any).emitSync('media:ice:gathering:state', { state }) // eslint-disable-line @typescript-eslint/no-explicit-any

      if (state === 'complete') {
        this.iceGatheringComplete = true
      }
    }

    // Track added (remote stream)
    pc.ontrack = (event) => {
      logger.info('Remote track added', {
        kind: event.track.kind,
        id: event.track.id,
        streamIds: event.streams.map((s) => s.id),
      })

      // Set remote stream (take first stream)
      if (event.streams.length > 0) {
        this.remoteStream = event.streams[0]
        ;(this.eventBus as any).emitSync(EventNames.MEDIA_STREAM_ADDED, {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          stream: this.remoteStream,
          track: event.track,
          direction: 'remote',
        })
      }

      ;(this.eventBus as any).emitSync(EventNames.MEDIA_TRACK_ADDED, {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        track: event.track,
        streams: event.streams,
        direction: 'remote',
      })
    }

    // Signaling state change
    pc.onsignalingstatechange = () => {
      logger.debug('Signaling state changed', {
        state: pc.signalingState,
      })
    }

    // Connection state change
    pc.onconnectionstatechange = () => {
      logger.info('Connection state changed', {
        state: pc.connectionState,
      })

      if (pc.connectionState === 'failed') {
        this.handleConnectionFailure('failed')
      }
    }

    // Negotiation needed
    pc.onnegotiationneeded = () => {
      logger.debug('Negotiation needed')
      ;(this.eventBus as any).emitSync('media:negotiation:needed', {}) // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  }

  /**
   * Handle connection success
   */
  private handleConnectionSuccess(): void {
    logger.info('Connection established successfully')

    // Start statistics collection
    if (!this.statsInterval) {
      this.startStatsCollection()
    }

    // Start quality adjustment if enabled
    if (this.autoQualityAdjustment && !this.qualityAdjustmentInterval) {
      this.startQualityAdjustment()
    }
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(state: IceConnectionState | string): void {
    logger.error('Connection failure', { state })
    ;(this.eventBus as any).emitSync('media:connection:failed', {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      state,
      reason: 'ICE connection failed',
    })

    // Stop intervals
    this.stopStatsCollection()
    this.stopQualityAdjustment()
  }

  // ============================================================================
  // SDP Negotiation
  // ============================================================================

  /**
   * Create SDP offer
   */
  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    const pc = this.getPeerConnection()

    logger.info('Creating SDP offer', { options })

    try {
      const offer = await pc.createOffer(options)
      logger.debug('SDP offer created', {
        type: offer.type,
        sdp: offer.sdp?.substring(0, 100) + '...',
      })
      return offer
    } catch (error) {
      logger.error('Failed to create offer', { error })
      throw error
    }
  }

  /**
   * Create SDP answer
   */
  async createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    const pc = this.getPeerConnection()

    logger.info('Creating SDP answer', { options })

    try {
      const answer = await pc.createAnswer(options)
      logger.debug('SDP answer created', {
        type: answer.type,
        sdp: answer.sdp?.substring(0, 100) + '...',
      })
      return answer
    } catch (error) {
      logger.error('Failed to create answer', { error })
      throw error
    }
  }

  /**
   * Set local description
   */
  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection()

    logger.info('Setting local description', { type: description.type })

    try {
      await pc.setLocalDescription(description)
      logger.debug('Local description set', {
        type: pc.localDescription?.type,
      })

      // Start ICE gathering timeout
      this.startIceGatheringTimeout()
    } catch (error) {
      logger.error('Failed to set local description', { error })
      throw error
    }
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection()

    logger.info('Setting remote description', { type: description.type })

    try {
      await pc.setRemoteDescription(description)
      logger.debug('Remote description set', {
        type: pc.remoteDescription?.type,
      })
    } catch (error) {
      logger.error('Failed to set remote description', { error })
      throw error
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.getPeerConnection()

    logger.debug('Adding ICE candidate', {
      candidate: candidate.candidate,
    })

    try {
      await pc.addIceCandidate(candidate)
      logger.debug('ICE candidate added')
    } catch (error) {
      logger.error('Failed to add ICE candidate', { error })
      throw error
    }
  }

  /**
   * Start ICE gathering timeout
   */
  private startIceGatheringTimeout(): void {
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout)
    }

    this.iceGatheringTimeout = setTimeout(() => {
      if (!this.iceGatheringComplete) {
        logger.warn('ICE gathering timeout, proceeding anyway')
        this.iceGatheringComplete = true
        ;(this.eventBus as any).emitSync('media:ice:gathering:timeout', {}) // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }, ICE_GATHERING_TIMEOUT)
  }

  /**
   * Wait for ICE gathering to complete
   */
  async waitForIceGathering(): Promise<void> {
    if (this.iceGatheringComplete) {
      return
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.iceGatheringComplete) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      // Also resolve on timeout
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve()
      }, ICE_GATHERING_TIMEOUT)
    })
  }

  // ============================================================================
  // Media Stream Management
  // ============================================================================

  /**
   * Get user media (local stream)
   */
  async getUserMedia(constraints?: ExtendedMediaStreamConstraints): Promise<MediaStream> {
    // Prevent concurrent calls
    if (this.isGettingUserMedia) {
      throw new Error('getUserMedia operation already in progress')
    }

    logger.info('Getting user media', { constraints })

    this.isGettingUserMedia = true

    try {
      // Build constraints
      const finalConstraints = this.buildMediaConstraints(constraints)

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)

      logger.info('User media acquired', {
        id: stream.id,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      })

      // Update permissions
      if (finalConstraints.audio) {
        this.permissions.audio = PermissionStatus.Granted
      }
      if (finalConstraints.video) {
        this.permissions.video = PermissionStatus.Granted
      }

      // Store local stream
      const previousStream = this.localStream
      this.localStream = stream

      if (previousStream) {
        logger.debug('Cleaning up previous local stream after acquiring new one', {
          oldStreamId: previousStream.id,
        })

        previousStream.getTracks().forEach((track) => {
          logger.debug('Stopping old track', { kind: track.kind, id: track.id })
          track.stop()
        })

        ;(this.eventBus as any).emitSync(EventNames.MEDIA_STREAM_REMOVED, {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          stream: previousStream,
          direction: 'local',
        })
      }

      // Emit event
      ;(this.eventBus as any).emitSync(EventNames.MEDIA_STREAM_ADDED, {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        stream,
        direction: 'local',
      })

      return stream
    } catch (error: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      logger.error('Failed to get user media', { error })

      // Update permissions on error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        if (constraints?.audio) {
          this.permissions.audio = PermissionStatus.Denied
        }
        if (constraints?.video) {
          this.permissions.video = PermissionStatus.Denied
        }
      }

      throw error
    } finally {
      // Always reset the flag
      this.isGettingUserMedia = false
    }
  }

  /**
   * Add local stream to peer connection
   */
  addLocalStream(stream: MediaStream): RTCRtpSender[] {
    const pc = this.getPeerConnection()
    const senders: RTCRtpSender[] = []

    logger.info('Adding local stream to peer connection', {
      streamId: stream.id,
      tracks: stream.getTracks().length,
    })

    // Add tracks to peer connection
    stream.getTracks().forEach((track) => {
      logger.debug('Adding track', {
        kind: track.kind,
        id: track.id,
        label: track.label,
      })

      const sender = pc.addTrack(track, stream)
      senders.push(sender)

      // Setup DTMF sender for audio tracks
      if (track.kind === 'audio' && !this.dtmfSender && sender.dtmf) {
        this.dtmfSender = sender.dtmf
        logger.debug('DTMF sender initialized')
      }
    })

    this.localStream = stream

    return senders
  }

  /**
   * Remove local stream from peer connection
   */
  removeLocalStream(): void {
    if (!this.peerConnection) return

    logger.info('Removing local stream from peer connection')

    const senders = this.peerConnection.getSenders()
    senders.forEach((sender) => {
      if (sender.track) {
        logger.debug('Removing sender', {
          kind: sender.track.kind,
          id: sender.track.id,
        })
        this.peerConnection?.removeTrack(sender)
      }
    })

    this.stopLocalStream()
  }

  /**
   * Stop local stream
   */
  stopLocalStream(): void {
    if (!this.localStream) return

    logger.info('Stopping local stream', { id: this.localStream.id })

    this.localStream.getTracks().forEach((track) => {
      logger.debug('Stopping track', { kind: track.kind, id: track.id })
      track.stop()
    })
    ;(this.eventBus as any).emitSync(EventNames.MEDIA_STREAM_REMOVED, {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      stream: this.localStream,
      direction: 'local',
    })

    this.localStream = undefined
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | undefined {
    return this.localStream
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | undefined {
    return this.remoteStream
  }

  // ============================================================================
  // DTMF Tone Generation
  // ============================================================================

  /**
   * Send DTMF tone
   */
  sendDTMF(tone: string, duration?: number, gap?: number): void {
    if (!this.dtmfSender) {
      logger.warn('DTMF sender not available')
      throw new Error('DTMF sender not available')
    }

    logger.info('Sending DTMF tone', { tone, duration, gap })

    try {
      this.dtmfSender.insertDTMF(tone, duration, gap)
    } catch (error) {
      logger.error('Failed to send DTMF tone', { error })
      throw error
    }
  }

  /**
   * Check if DTMF is available
   */
  isDTMFAvailable(): boolean {
    return !!this.dtmfSender && this.dtmfSender.canInsertDTMF
  }

  // ============================================================================
  // Media Device Management
  // ============================================================================

  /**
   * Enumerate media devices
   */
  async enumerateDevices(): Promise<MediaDevice[]> {
    logger.info('Enumerating media devices')

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      this.devices = devices.map((device) => ({
        deviceId: device.deviceId,
        kind: device.kind as MediaDeviceKind,
        label: device.label || `${device.kind} (${device.deviceId})`,
        groupId: device.groupId,
        isDefault: device.deviceId === 'default',
      }))

      logger.info('Devices enumerated', {
        total: this.devices.length,
        audio: this.devices.filter((d) => d.kind === MediaDeviceKind.AudioInput).length,
        video: this.devices.filter((d) => d.kind === MediaDeviceKind.VideoInput).length,
      })

      return this.devices
    } catch (error) {
      logger.error('Failed to enumerate devices', { error })
      throw error
    }
  }

  /**
   * Get devices by kind
   */
  getDevicesByKind(kind: MediaDeviceKind): MediaDevice[] {
    return this.devices.filter((device) => device.kind === kind)
  }

  /**
   * Get audio input devices
   */
  getAudioInputDevices(): MediaDevice[] {
    return this.getDevicesByKind(MediaDeviceKind.AudioInput)
  }

  /**
   * Get audio output devices
   */
  getAudioOutputDevices(): MediaDevice[] {
    return this.getDevicesByKind(MediaDeviceKind.AudioOutput)
  }

  /**
   * Get video input devices
   */
  getVideoInputDevices(): MediaDevice[] {
    return this.getDevicesByKind(MediaDeviceKind.VideoInput)
  }

  /**
   * Select audio input device
   */
  selectAudioInput(deviceId: string): void {
    logger.info('Selecting audio input device', { deviceId })
    this.selectedAudioInputId = deviceId
  }

  /**
   * Select audio output device
   */
  selectAudioOutput(deviceId: string): void {
    logger.info('Selecting audio output device', { deviceId })
    this.selectedAudioOutputId = deviceId
  }

  /**
   * Select video input device
   */
  selectVideoInput(deviceId: string): void {
    logger.info('Selecting video input device', { deviceId })
    this.selectedVideoInputId = deviceId
  }

  /**
   * Get selected audio input device
   */
  getSelectedAudioInput(): string | undefined {
    return this.selectedAudioInputId
  }

  /**
   * Get selected audio output device
   */
  getSelectedAudioOutput(): string | undefined {
    return this.selectedAudioOutputId
  }

  /**
   * Get selected video input device
   */
  getSelectedVideoInput(): string | undefined {
    return this.selectedVideoInputId
  }

  /**
   * Request media permissions
   */
  async requestPermissions(audio = true, video = false): Promise<MediaPermissions> {
    logger.info('Requesting media permissions', { audio, video })

    try {
      // Request a temporary stream to get permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video,
      })

      // Update permissions
      if (audio) {
        this.permissions.audio = PermissionStatus.Granted
      }
      if (video) {
        this.permissions.video = PermissionStatus.Granted
      }

      // Stop the temporary stream
      stream.getTracks().forEach((track) => track.stop())

      // Re-enumerate devices (labels will now be available)
      await this.enumerateDevices()

      logger.info('Permissions granted', this.permissions)
      return this.permissions
    } catch (error: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      logger.error('Permission request failed', { error })

      // Update permissions on error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        if (audio) {
          this.permissions.audio = PermissionStatus.Denied
        }
        if (video) {
          this.permissions.video = PermissionStatus.Denied
        }
      }

      return this.permissions
    }
  }

  /**
   * Get current permissions
   */
  getPermissions(): MediaPermissions {
    return { ...this.permissions }
  }

  /**
   * Start monitoring device changes
   */
  startDeviceChangeMonitoring(): void {
    if (this.deviceChangeListener) {
      logger.warn('Device change monitoring already active')
      return
    }

    logger.info('Starting device change monitoring')

    this.deviceChangeListener = async () => {
      logger.info('Device change detected')

      const previousDevices = [...this.devices]
      await this.enumerateDevices()

      // Detect added and removed devices
      const addedDevices = this.devices.filter(
        (d) => !previousDevices.some((pd) => pd.deviceId === d.deviceId)
      )
      const removedDevices = previousDevices.filter(
        (pd) => !this.devices.some((d) => d.deviceId === pd.deviceId)
      )

      logger.info('Device changes', {
        added: addedDevices.length,
        removed: removedDevices.length,
      })

      // Emit event
      const event: MediaDeviceChangeEvent = {
        type: 'devicechange',
        addedDevices,
        removedDevices,
        currentDevices: this.devices,
        timestamp: new Date(),
      }

      this.eventBus.emitSync(EventNames.MEDIA_DEVICE_CHANGED, event)
    }

    navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener)
  }

  /**
   * Stop monitoring device changes
   */
  stopDeviceChangeMonitoring(): void {
    if (!this.deviceChangeListener) return

    logger.info('Stopping device change monitoring')

    navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener)
    this.deviceChangeListener = undefined
  }

  /**
   * Test audio input device
   */
  async testAudioInput(deviceId: string): Promise<DeviceTestResult> {
    logger.info('Testing audio input device', { deviceId })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      })

      // Stop stream after test
      stream.getTracks().forEach((track) => track.stop())

      return {
        deviceId,
        success: true,
      }
    } catch (error: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      logger.error('Audio input test failed', { error })
      return {
        deviceId,
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Test video input device
   */
  async testVideoInput(deviceId: string): Promise<DeviceTestResult> {
    logger.info('Testing video input device', { deviceId })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      })

      // Stop stream after test
      stream.getTracks().forEach((track) => track.stop())

      return {
        deviceId,
        success: true,
      }
    } catch (error: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      logger.error('Video input test failed', { error })
      return {
        deviceId,
        success: false,
        error: error.message,
      }
    }
  }

  // ============================================================================
  // Statistics Collection
  // ============================================================================

  /**
   * Start statistics collection
   */
  private startStatsCollection(): void {
    if (this.statsInterval) {
      return
    }

    logger.info('Starting statistics collection')

    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getStatistics()
        ;(this.eventBus as any).emitSync('media:statistics', stats) // eslint-disable-line @typescript-eslint/no-explicit-any
      } catch (error) {
        logger.error('Failed to collect statistics', { error })
      }
    }, STATS_COLLECTION_INTERVAL)
  }

  /**
   * Stop statistics collection
   */
  private stopStatsCollection(): void {
    if (!this.statsInterval) return

    logger.info('Stopping statistics collection')
    clearInterval(this.statsInterval)
    this.statsInterval = undefined
  }

  /**
   * Get WebRTC statistics
   */
  async getStatistics(): Promise<MediaStatistics> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not available')
    }

    const stats = await this.peerConnection.getStats()
    const audioStats: AudioStatistics = {}
    const videoStats: VideoStatistics = {}
    const networkStats: NetworkStatistics = {}

    stats.forEach((report) => {
      // Audio stats
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        audioStats.bytesReceived = report.bytesReceived
        audioStats.packetsReceived = report.packetsReceived
        audioStats.packetsLost = report.packetsLost
        audioStats.jitter = report.jitter
        audioStats.codec = report.codecId

        if (report.packetsReceived && report.packetsLost) {
          const total = report.packetsReceived + report.packetsLost
          audioStats.packetLossPercentage = (report.packetsLost / total) * 100
        }
      }

      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        audioStats.bytesSent = report.bytesSent
        audioStats.packetsSent = report.packetsSent
      }

      // Video stats
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        videoStats.bytesReceived = report.bytesReceived
        videoStats.packetsReceived = report.packetsReceived
        videoStats.packetsLost = report.packetsLost
        videoStats.framesReceived = report.framesReceived
        videoStats.framesDropped = report.framesDropped
        videoStats.frameWidth = report.frameWidth
        videoStats.frameHeight = report.frameHeight

        if (report.packetsReceived && report.packetsLost) {
          const total = report.packetsReceived + report.packetsLost
          videoStats.packetLossPercentage = (report.packetsLost / total) * 100
        }
      }

      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        videoStats.bytesSent = report.bytesSent
        videoStats.packetsSent = report.packetsSent
        videoStats.framesSent = report.framesSent
      }

      // Network stats
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        networkStats.currentRoundTripTime = report.currentRoundTripTime
        networkStats.availableOutgoingBitrate = report.availableOutgoingBitrate
        networkStats.availableIncomingBitrate = report.availableIncomingBitrate
      }

      if (report.type === 'transport') {
        networkStats.totalBytesSent = report.bytesSent
        networkStats.totalBytesReceived = report.bytesReceived
      }

      if (report.type === 'local-candidate') {
        networkStats.localCandidateType = report.candidateType
      }

      if (report.type === 'remote-candidate') {
        networkStats.remoteCandidateType = report.candidateType
      }
    })

    return {
      audio: Object.keys(audioStats).length > 0 ? audioStats : undefined,
      video: Object.keys(videoStats).length > 0 ? videoStats : undefined,
      network: Object.keys(networkStats).length > 0 ? networkStats : undefined,
      timestamp: new Date(),
    }
  }

  // ============================================================================
  // Quality Adjustment
  // ============================================================================

  /**
   * Start automatic quality adjustment
   */
  private startQualityAdjustment(): void {
    if (this.qualityAdjustmentInterval) {
      return
    }

    logger.info('Starting quality adjustment')

    this.qualityAdjustmentInterval = setInterval(async () => {
      try {
        await this.adjustQuality()
      } catch (error) {
        logger.error('Failed to adjust quality', { error })
      }
    }, 5000) // Check every 5 seconds
  }

  /**
   * Stop automatic quality adjustment
   */
  private stopQualityAdjustment(): void {
    if (!this.qualityAdjustmentInterval) return

    logger.info('Stopping quality adjustment')
    clearInterval(this.qualityAdjustmentInterval)
    this.qualityAdjustmentInterval = undefined
  }

  /**
   * Adjust media quality based on network conditions
   */
  private async adjustQuality(): Promise<void> {
    if (!this.peerConnection) return

    const stats = await this.getStatistics()

    // Check audio packet loss
    if (stats.audio?.packetLossPercentage) {
      const loss = stats.audio.packetLossPercentage

      if (loss > 5) {
        logger.warn('High audio packet loss detected', {
          loss: loss.toFixed(2) + '%',
        })
        // Could reduce bitrate here
      }
    }

    // Check video packet loss
    if (stats.video?.packetLossPercentage) {
      const loss = stats.video.packetLossPercentage

      if (loss > 5) {
        logger.warn('High video packet loss detected', {
          loss: loss.toFixed(2) + '%',
        })
        // Could reduce video bitrate or resolution here
      }
    }

    // Check RTT
    if (stats.network?.currentRoundTripTime) {
      const rtt = stats.network.currentRoundTripTime * 1000 // Convert to ms

      if (rtt > 300) {
        logger.warn('High round trip time detected', {
          rtt: rtt.toFixed(0) + 'ms',
        })
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Build RTC configuration with STUN/TURN servers
   */
  private buildRTCConfiguration(config?: ExtendedRTCConfiguration): ExtendedRTCConfiguration {
    const iceServers: RTCIceServer[] = []

    // Add STUN servers
    if (config?.stunServers && config.stunServers.length > 0) {
      iceServers.push({
        urls: [...config.stunServers],
      })
    } else {
      // Default STUN servers
      iceServers.push({
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
      })
    }

    // Add TURN servers
    if (config?.turnServers && config.turnServers.length > 0) {
      config.turnServers.forEach((turn) => {
        const server: RTCIceServer = {
          urls: typeof turn.urls === 'string' ? turn.urls : [...turn.urls],
          username: turn.username,
          credential: turn.credential,
        }
        // Only add credentialType if it's provided (not all browsers support it)
        if (turn.credentialType) {
          ;(server as any).credentialType = turn.credentialType // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        iceServers.push(server)
      })
    }

    return {
      iceServers,
      iceTransportPolicy: config?.iceTransportPolicy || 'all',
      bundlePolicy: config?.bundlePolicy || 'balanced',
      rtcpMuxPolicy: config?.rtcpMuxPolicy || 'require',
      iceCandidatePoolSize: config?.iceCandidatePoolSize || 0,
    }
  }

  /**
   * Build media constraints
   */
  private buildMediaConstraints(
    constraints?: ExtendedMediaStreamConstraints
  ): MediaStreamConstraints {
    const finalConstraints: MediaStreamConstraints = {}

    // Audio constraints
    if (constraints?.audio !== false) {
      const audioConstraints = {
        ...DEFAULT_AUDIO_CONSTRAINTS,
        ...(typeof constraints?.audio === 'object' ? constraints.audio : {}),
      }

      // Add device ID if selected
      if (this.selectedAudioInputId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(audioConstraints as any).deviceId = {
          exact: this.selectedAudioInputId,
        }
      }

      // Override with extended constraints
      if (constraints?.echoCancellation !== undefined) {
        audioConstraints.echoCancellation = constraints.echoCancellation
      }
      if (constraints?.noiseSuppression !== undefined) {
        audioConstraints.noiseSuppression = constraints.noiseSuppression
      }
      if (constraints?.autoGainControl !== undefined) {
        audioConstraints.autoGainControl = constraints.autoGainControl
      }

      finalConstraints.audio = audioConstraints
    } else {
      finalConstraints.audio = false
    }

    // Video constraints
    if (constraints?.video === true) {
      const videoConstraints = {
        ...DEFAULT_VIDEO_CONSTRAINTS,
      }

      // Add device ID if selected
      if (this.selectedVideoInputId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(videoConstraints as any).deviceId = {
          exact: this.selectedVideoInputId,
        }
      }

      finalConstraints.video = videoConstraints
    } else if (typeof constraints?.video === 'object') {
      finalConstraints.video = {
        ...DEFAULT_VIDEO_CONSTRAINTS,
        ...constraints.video,
      }

      // Add device ID if selected
      if (this.selectedVideoInputId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(finalConstraints.video as any).deviceId = {
          exact: this.selectedVideoInputId,
        }
      }
    } else {
      finalConstraints.video = false
    }

    return finalConstraints
  }

  /**
   * Cleanup and release resources
   */
  destroy(): void {
    logger.info('Destroying MediaManager')

    // Stop intervals
    this.stopStatsCollection()
    this.stopQualityAdjustment()
    this.stopDeviceChangeMonitoring()

    // Close peer connection
    this.closePeerConnection()

    // Stop local stream
    this.stopLocalStream()

    // Clear state
    this.devices = []
    this.remoteStream = undefined
  }

  /**
   * Set available devices (manually update device list)
   * @param devices - Devices to set
   */
  setDevices(devices: MediaDeviceInfo[]): void {
    logger.info('Setting devices manually', { count: devices.length })

    this.devices = devices.map((device) => ({
      deviceId: device.deviceId,
      kind: device.kind as MediaDeviceKind,
      label: device.label || `${device.kind} (${device.deviceId})`,
      groupId: device.groupId,
      isDefault: device.deviceId === 'default',
    }))

    logger.info('Devices set', {
      total: this.devices.length,
      audio: this.devices.filter((d) => d.kind === MediaDeviceKind.AudioInput).length,
      video: this.devices.filter((d) => d.kind === MediaDeviceKind.VideoInput).length,
    })

    // Emit device change event
    const event: MediaDeviceChangeEvent = {
      type: 'devicechange',
      addedDevices: [],
      removedDevices: [],
      currentDevices: this.devices,
      timestamp: new Date(),
    }

    this.eventBus.emitSync(EventNames.MEDIA_DEVICE_CHANGED, event)
  }

  /**
   * Test a specific device (audio or video)
   * @param deviceId - Device ID to test
   */
  async testDevice(deviceId: string): Promise<{ success: boolean; audioLevel?: number }> {
    logger.info('Testing device', { deviceId })

    // Find the device
    const device = this.devices.find((d) => d.deviceId === deviceId)
    if (!device) {
      logger.error('Device not found', { deviceId })
      return { success: false }
    }

    // Test based on device kind
    switch (device.kind) {
      case MediaDeviceKind.AudioInput:
        return await this.testAudioInputWithLevel(deviceId)

      case MediaDeviceKind.VideoInput:
        const videoResult = await this.testVideoInput(deviceId)
        return { success: videoResult.success }

      case MediaDeviceKind.AudioOutput:
        // Audio output can't be tested directly in browser
        logger.warn('Audio output testing not supported in browser')
        return { success: true }

      default:
        logger.warn('Unknown device kind', { kind: device.kind })
        return { success: false }
    }
  }

  /**
   * Test audio input device with audio level measurement
   */
  private async testAudioInputWithLevel(deviceId: string): Promise<{ success: boolean; audioLevel?: number }> {
    logger.info('Testing audio input device with level', { deviceId })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      })

      // Create audio context to measure level
      let audioLevel: number | undefined

      try {
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        const analyzer = audioContext.createAnalyser()
        analyzer.fftSize = 256

        source.connect(analyzer)

        const bufferLength = analyzer.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        // Measure audio level for a short period
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            analyzer.getByteFrequencyData(dataArray)

            // Calculate average level
            const sum = dataArray.reduce((a, b) => a + b, 0)
            audioLevel = sum / bufferLength / 255 // Normalize to 0-1

            // Cleanup
            source.disconnect()
            audioContext.close()
            resolve()
          }, 250) // Sample for 250ms for more accurate measurement
        })
      } catch (audioContextError) {
        logger.warn('Failed to measure audio level:', audioContextError)
        // Continue without audio level
      }

      // Stop stream after test
      stream.getTracks().forEach((track) => track.stop())

      return {
        success: true,
        audioLevel,
      }
    } catch (error: any) {
      logger.error('Audio input test with level failed', { error })
      return {
        success: false,
        audioLevel: undefined,
      }
    }
  }
}
