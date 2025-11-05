/**
 * MediaManager Unit Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MediaManager } from '@/core/MediaManager'
import { EventBus } from '@/core/EventBus'
import type { ExtendedRTCConfiguration, MediaConfiguration } from '@/types/config.types'
import { PermissionStatus, MediaDeviceKind } from '@/types/media.types'

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  onicecandidate: ((event: any) => void) | null = null
  oniceconnectionstatechange: (() => void) | null = null
  onicegatheringstatechange: (() => void) | null = null
  ontrack: ((event: any) => void) | null = null
  onsignalingstatechange: (() => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  onnegotiationneeded: (() => void) | null = null

  iceConnectionState: RTCIceConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'new'
  signalingState: RTCSignalingState = 'stable'
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescription | null = null
  remoteDescription: RTCSessionDescription | null = null

  private senders: RTCRtpSender[] = []

  constructor(public config?: RTCConfiguration) {}

  async createOffer(_options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    return {
      type: 'offer',
      sdp: 'mock-sdp-offer',
    }
  }

  async createAnswer(_options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    return {
      type: 'answer',
      sdp: 'mock-sdp-answer',
    }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription
  }

  async addIceCandidate(_candidate: RTCIceCandidateInit): Promise<void> {
    // Mock implementation
  }

  addTrack(track: MediaStreamTrack, _stream: MediaStream): RTCRtpSender {
    const sender = {
      track,
      dtmf: track.kind === 'audio' ? new MockRTCDTMFSender() : null,
    } as any
    this.senders.push(sender)
    return sender
  }

  removeTrack(sender: RTCRtpSender): void {
    const index = this.senders.indexOf(sender)
    if (index !== -1) {
      this.senders.splice(index, 1)
    }
  }

  getSenders(): RTCRtpSender[] {
    return this.senders
  }

  async getStats(): Promise<RTCStatsReport> {
    const stats = new Map()

    // Add mock audio inbound stats
    stats.set('inbound-audio', {
      type: 'inbound-rtp',
      kind: 'audio',
      bytesReceived: 10000,
      packetsReceived: 100,
      packetsLost: 2,
      jitter: 0.01,
      codecId: 'codec-opus',
    })

    // Add mock audio outbound stats
    stats.set('outbound-audio', {
      type: 'outbound-rtp',
      kind: 'audio',
      bytesSent: 8000,
      packetsSent: 80,
    })

    // Add mock candidate pair stats
    stats.set('candidate-pair', {
      type: 'candidate-pair',
      state: 'succeeded',
      currentRoundTripTime: 0.05,
      availableOutgoingBitrate: 1000000,
      availableIncomingBitrate: 1000000,
    })

    return stats as RTCStatsReport
  }

  close(): void {
    this.connectionState = 'closed'
    this.senders = []
  }
}

// Mock RTCDTMFSender
class MockRTCDTMFSender {
  canInsertDTMF = true
  toneBuffer = ''

  insertDTMF(tones: string, _duration?: number, _interToneGap?: number): void {
    this.toneBuffer = tones
  }
}

// Mock MediaStreamTrack
class MockMediaStreamTrack {
  kind: string
  id: string
  label: string
  enabled = true
  readyState: MediaStreamTrackState = 'live'

  constructor(kind: string, id: string, label: string) {
    this.kind = kind
    this.id = id
    this.label = label
  }

  stop(): void {
    this.readyState = 'ended'
  }

  getSettings(): MediaTrackSettings {
    return {}
  }

  getCapabilities(): MediaTrackCapabilities {
    return {}
  }

  getConstraints(): MediaTrackConstraints {
    return {}
  }

  applyConstraints(_constraints?: MediaTrackConstraints): Promise<void> {
    return Promise.resolve()
  }

  clone(): MediaStreamTrack {
    return new MockMediaStreamTrack(this.kind, this.id + '-clone', this.label) as any
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true
  }
}

// Mock MediaStream
class MockMediaStream {
  id: string
  active = true
  private tracks: MediaStreamTrack[] = []

  constructor(tracks?: MediaStreamTrack[]) {
    this.id = 'stream-' + Math.random().toString(36).substring(7)
    if (tracks) {
      this.tracks = tracks
    }
  }

  getTracks(): MediaStreamTrack[] {
    return this.tracks
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio')
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video')
  }

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track)
  }

  removeTrack(track: MediaStreamTrack): void {
    const index = this.tracks.indexOf(track)
    if (index !== -1) {
      this.tracks.splice(index, 1)
    }
  }

  getTrackById(id: string): MediaStreamTrack | null {
    return this.tracks.find((t) => t.id === id) || null
  }

  clone(): MediaStream {
    return new MockMediaStream(this.tracks.map((t) => t.clone())) as any
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true
  }
}

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn(),
  enumerateDevices: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

describe('MediaManager', () => {
  let mediaManager: MediaManager
  let eventBus: EventBus

  beforeEach(() => {
    // Setup mocks
    global.RTCPeerConnection = MockRTCPeerConnection as any
    global.navigator = {
      mediaDevices: mockMediaDevices,
    } as any

    // Reset mocks
    vi.clearAllMocks()
    mockMediaDevices.getUserMedia.mockReset()
    mockMediaDevices.enumerateDevices.mockReset()

    // Create event bus
    eventBus = new EventBus()

    // Create media manager
    mediaManager = new MediaManager({ eventBus })
  })

  afterEach(() => {
    mediaManager.destroy()
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(mediaManager).toBeDefined()
    })

    it('should accept custom RTC configuration', () => {
      const config: ExtendedRTCConfiguration = {
        stunServers: ['stun:custom.stun.server:3478'],
        turnServers: [
          {
            urls: 'turn:turn.server:3478',
            username: 'user',
            credential: 'pass',
          },
        ],
      }

      const manager = new MediaManager({ eventBus, rtcConfiguration: config })
      expect(manager).toBeDefined()
      manager.destroy()
    })

    it('should accept media configuration', () => {
      const mediaConfig: MediaConfiguration = {
        audio: true,
        video: true,
        echoCancellation: true,
      }

      const manager = new MediaManager({
        eventBus,
        mediaConfiguration: mediaConfig,
      })
      expect(manager).toBeDefined()
      manager.destroy()
    })

    it('should enable auto quality adjustment if specified', () => {
      const manager = new MediaManager({
        eventBus,
        autoQualityAdjustment: true,
      })
      expect(manager).toBeDefined()
      manager.destroy()
    })
  })

  describe('RTCPeerConnection Lifecycle', () => {
    it('should create peer connection', () => {
      const pc = mediaManager.createPeerConnection()
      expect(pc).toBeDefined()
      expect(pc).toBeInstanceOf(MockRTCPeerConnection)
    })

    it('should get existing peer connection', () => {
      const pc1 = mediaManager.getPeerConnection()
      const pc2 = mediaManager.getPeerConnection()
      expect(pc1).toBe(pc2)
    })

    it('should close existing peer connection when creating new one', () => {
      const pc1 = mediaManager.createPeerConnection()
      const closeSpy = vi.spyOn(pc1, 'close')

      const pc2 = mediaManager.createPeerConnection()
      expect(closeSpy).toHaveBeenCalled()
      expect(pc2).not.toBe(pc1)
    })

    it('should close peer connection', () => {
      const pc = mediaManager.createPeerConnection()
      const closeSpy = vi.spyOn(pc, 'close')

      mediaManager.closePeerConnection()
      expect(closeSpy).toHaveBeenCalled()
    })

    it('should setup peer connection event handlers', () => {
      const pc = mediaManager.createPeerConnection() as MockRTCPeerConnection
      expect(pc.onicecandidate).toBeDefined()
      expect(pc.oniceconnectionstatechange).toBeDefined()
      expect(pc.onicegatheringstatechange).toBeDefined()
      expect(pc.ontrack).toBeDefined()
      expect(pc.onsignalingstatechange).toBeDefined()
      expect(pc.onconnectionstatechange).toBeDefined()
      expect(pc.onnegotiationneeded).toBeDefined()
    })

    it('should emit ICE candidate event', (done) => {
      const pc = mediaManager.createPeerConnection() as MockRTCPeerConnection

      eventBus.on('media:ice:candidate', (event) => {
        expect(event.payload.candidate).toBeDefined()
        done()
      })

      const mockCandidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      }

      pc.onicecandidate?.({ candidate: mockCandidate } as any)
    })

    it('should emit ICE gathering complete event on null candidate', (done) => {
      const pc = mediaManager.createPeerConnection() as MockRTCPeerConnection

      eventBus.on('media:ice:gathering:complete', () => {
        done()
      })

      pc.onicecandidate?.({ candidate: null } as any)
    })

    it('should emit ICE connection state change event', (done) => {
      const pc = mediaManager.createPeerConnection() as MockRTCPeerConnection

      eventBus.on('media:ice:connection:state', (event) => {
        expect(event.payload.state).toBe('connected')
        done()
      })

      pc.iceConnectionState = 'connected'
      pc.oniceconnectionstatechange?.()
    })

    it('should handle connection failure', (done) => {
      const pc = mediaManager.createPeerConnection() as MockRTCPeerConnection

      eventBus.on('media:connection:failed', (event) => {
        expect(event.payload.state).toBe('failed')
        done()
      })

      pc.iceConnectionState = 'failed'
      pc.oniceconnectionstatechange?.()
    })

    it('should emit track added event', (done) => {
      const pc = mediaManager.createPeerConnection() as MockRTCPeerConnection

      eventBus.on('media:track:added', (event) => {
        expect(event.payload.track).toBeDefined()
        done()
      })

      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Audio') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      pc.ontrack?.({ track: mockTrack, streams: [mockStream] } as any)
    })
  })

  describe('SDP Negotiation', () => {
    beforeEach(() => {
      mediaManager.createPeerConnection()
    })

    it('should create offer', async () => {
      const offer = await mediaManager.createOffer()
      expect(offer).toBeDefined()
      expect(offer.type).toBe('offer')
      expect(offer.sdp).toBeDefined()
    })

    it('should create answer', async () => {
      const answer = await mediaManager.createAnswer()
      expect(answer).toBeDefined()
      expect(answer.type).toBe('answer')
      expect(answer.sdp).toBeDefined()
    })

    it('should set local description', async () => {
      const offer = await mediaManager.createOffer()
      await mediaManager.setLocalDescription(offer)

      const pc = mediaManager.getPeerConnection()
      expect(pc.localDescription).toBeDefined()
      expect(pc.localDescription?.type).toBe('offer')
    })

    it('should set remote description', async () => {
      const answer = { type: 'answer' as RTCSdpType, sdp: 'mock-sdp' }
      await mediaManager.setRemoteDescription(answer)

      const pc = mediaManager.getPeerConnection()
      expect(pc.remoteDescription).toBeDefined()
      expect(pc.remoteDescription?.type).toBe('answer')
    })

    it('should add ICE candidate', async () => {
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      }

      await expect(mediaManager.addIceCandidate(candidate)).resolves.toBeUndefined()
    })

    it('should wait for ICE gathering', async () => {
      const pc = mediaManager.getPeerConnection() as MockRTCPeerConnection

      // Start gathering
      const waitPromise = mediaManager.waitForIceGathering()

      // Simulate gathering complete
      setTimeout(() => {
        pc.iceGatheringState = 'complete'
        pc.onicegatheringstatechange?.()
        pc.onicecandidate?.({ candidate: null } as any)
      }, 100)

      await waitPromise
    })
  })

  describe('Media Stream Management', () => {
    beforeEach(() => {
      mediaManager.createPeerConnection()
    })

    it('should get user media', async () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream)

      const stream = await mediaManager.getUserMedia({ audio: true })
      expect(stream).toBeDefined()
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled()
    })

    it('should update permissions on getUserMedia success', async () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream)

      await mediaManager.getUserMedia({ audio: true })

      const permissions = mediaManager.getPermissions()
      expect(permissions.audio).toBe(PermissionStatus.Granted)
    })

    it('should update permissions on getUserMedia failure', async () => {
      const error = new Error('Permission denied')
      error.name = 'NotAllowedError'
      mockMediaDevices.getUserMedia.mockRejectedValue(error)

      await expect(mediaManager.getUserMedia({ audio: true })).rejects.toThrow()

      const permissions = mediaManager.getPermissions()
      expect(permissions.audio).toBe(PermissionStatus.Denied)
    })

    it('should add local stream to peer connection', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      const senders = mediaManager.addLocalStream(mockStream)
      expect(senders).toHaveLength(1)
    })

    it('should setup DTMF sender for audio tracks', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mediaManager.addLocalStream(mockStream)
      expect(mediaManager.isDTMFAvailable()).toBe(true)
    })

    it('should remove local stream from peer connection', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mediaManager.addLocalStream(mockStream)
      mediaManager.removeLocalStream()

      const pc = mediaManager.getPeerConnection()
      expect(pc.getSenders()).toHaveLength(0)
    })

    it('should stop local stream', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mediaManager.addLocalStream(mockStream)

      const stopSpy = vi.spyOn(mockTrack, 'stop')
      mediaManager.stopLocalStream()

      expect(stopSpy).toHaveBeenCalled()
    })

    it('should get local stream', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mediaManager.addLocalStream(mockStream)

      const stream = mediaManager.getLocalStream()
      expect(stream).toBe(mockStream)
    })

    it('should get remote stream', () => {
      const stream = mediaManager.getRemoteStream()
      expect(stream).toBeUndefined()
    })
  })

  describe('DTMF Tone Generation', () => {
    beforeEach(() => {
      mediaManager.createPeerConnection()

      // Add audio track to enable DTMF
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any
      mediaManager.addLocalStream(mockStream)
    })

    it('should send DTMF tone', () => {
      expect(() => mediaManager.sendDTMF('1')).not.toThrow()
    })

    it('should send DTMF tone with duration and gap', () => {
      expect(() => mediaManager.sendDTMF('123', 100, 70)).not.toThrow()
    })

    it('should throw error if DTMF sender not available', () => {
      mediaManager.closePeerConnection()
      mediaManager.createPeerConnection()

      expect(() => mediaManager.sendDTMF('1')).toThrow('DTMF sender not available')
    })

    it('should check if DTMF is available', () => {
      expect(mediaManager.isDTMFAvailable()).toBe(true)
    })
  })

  describe('Media Device Management', () => {
    it('should enumerate devices', async () => {
      const mockDevices = [
        {
          deviceId: 'device-1',
          kind: 'audioinput' as MediaDeviceKind,
          label: 'Microphone',
          groupId: 'group-1',
        },
        {
          deviceId: 'device-2',
          kind: 'audiooutput' as MediaDeviceKind,
          label: 'Speakers',
          groupId: 'group-1',
        },
        {
          deviceId: 'device-3',
          kind: 'videoinput' as MediaDeviceKind,
          label: 'Camera',
          groupId: 'group-2',
        },
      ]

      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices)

      const devices = await mediaManager.enumerateDevices()
      expect(devices).toHaveLength(3)
      expect(mockMediaDevices.enumerateDevices).toHaveBeenCalled()
    })

    it('should get audio input devices', async () => {
      const mockDevices = [
        {
          deviceId: 'device-1',
          kind: 'audioinput' as MediaDeviceKind,
          label: 'Microphone',
          groupId: 'group-1',
        },
        {
          deviceId: 'device-2',
          kind: 'audiooutput' as MediaDeviceKind,
          label: 'Speakers',
          groupId: 'group-1',
        },
      ]

      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices)
      await mediaManager.enumerateDevices()

      const audioInputs = mediaManager.getAudioInputDevices()
      expect(audioInputs).toHaveLength(1)
      expect(audioInputs[0].kind).toBe('audioinput')
    })

    it('should get audio output devices', async () => {
      const mockDevices = [
        {
          deviceId: 'device-1',
          kind: 'audioinput' as MediaDeviceKind,
          label: 'Microphone',
          groupId: 'group-1',
        },
        {
          deviceId: 'device-2',
          kind: 'audiooutput' as MediaDeviceKind,
          label: 'Speakers',
          groupId: 'group-1',
        },
      ]

      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices)
      await mediaManager.enumerateDevices()

      const audioOutputs = mediaManager.getAudioOutputDevices()
      expect(audioOutputs).toHaveLength(1)
      expect(audioOutputs[0].kind).toBe('audiooutput')
    })

    it('should get video input devices', async () => {
      const mockDevices = [
        {
          deviceId: 'device-3',
          kind: 'videoinput' as MediaDeviceKind,
          label: 'Camera',
          groupId: 'group-2',
        },
      ]

      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices)
      await mediaManager.enumerateDevices()

      const videoInputs = mediaManager.getVideoInputDevices()
      expect(videoInputs).toHaveLength(1)
      expect(videoInputs[0].kind).toBe('videoinput')
    })

    it('should select audio input device', () => {
      mediaManager.selectAudioInput('device-1')
      expect(mediaManager.getSelectedAudioInput()).toBe('device-1')
    })

    it('should select audio output device', () => {
      mediaManager.selectAudioOutput('device-2')
      expect(mediaManager.getSelectedAudioOutput()).toBe('device-2')
    })

    it('should select video input device', () => {
      mediaManager.selectVideoInput('device-3')
      expect(mediaManager.getSelectedVideoInput()).toBe('device-3')
    })

    it('should request permissions', async () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream)
      mockMediaDevices.enumerateDevices.mockResolvedValue([])

      const permissions = await mediaManager.requestPermissions(true, false)
      expect(permissions.audio).toBe(PermissionStatus.Granted)
      expect(permissions.video).toBe(PermissionStatus.NotRequested)
    })

    it('should handle permission denial', async () => {
      const error = new Error('Permission denied')
      error.name = 'NotAllowedError'
      mockMediaDevices.getUserMedia.mockRejectedValue(error)

      const permissions = await mediaManager.requestPermissions(true, false)
      expect(permissions.audio).toBe(PermissionStatus.Denied)
    })

    it('should get current permissions', () => {
      const permissions = mediaManager.getPermissions()
      expect(permissions).toBeDefined()
      expect(permissions.audio).toBe(PermissionStatus.NotRequested)
      expect(permissions.video).toBe(PermissionStatus.NotRequested)
    })

    it('should start device change monitoring', () => {
      mediaManager.startDeviceChangeMonitoring()
      expect(mockMediaDevices.addEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      )
    })

    it('should stop device change monitoring', () => {
      mediaManager.startDeviceChangeMonitoring()
      mediaManager.stopDeviceChangeMonitoring()
      expect(mockMediaDevices.removeEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      )
    })

    it('should test audio input device', async () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream)

      const result = await mediaManager.testAudioInput('device-1')
      expect(result.success).toBe(true)
      expect(result.deviceId).toBe('device-1')
    })

    it('should handle audio input test failure', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Device not found'))

      const result = await mediaManager.testAudioInput('invalid-device')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should test video input device', async () => {
      const mockTrack = new MockMediaStreamTrack('video', 'track-1', 'Camera') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream)

      const result = await mediaManager.testVideoInput('device-3')
      expect(result.success).toBe(true)
      expect(result.deviceId).toBe('device-3')
    })

    it('should handle video input test failure', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Device not found'))

      const result = await mediaManager.testVideoInput('invalid-device')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Statistics Collection', () => {
    beforeEach(() => {
      mediaManager.createPeerConnection()
    })

    it('should get statistics', async () => {
      const stats = await mediaManager.getStatistics()
      expect(stats).toBeDefined()
      expect(stats.timestamp).toBeInstanceOf(Date)
      expect(stats.audio).toBeDefined()
      expect(stats.network).toBeDefined()
    })

    it('should include audio statistics', async () => {
      const stats = await mediaManager.getStatistics()
      expect(stats.audio).toBeDefined()
      expect(stats.audio?.bytesReceived).toBe(10000)
      expect(stats.audio?.packetsReceived).toBe(100)
      expect(stats.audio?.packetsLost).toBe(2)
    })

    it('should calculate packet loss percentage', async () => {
      const stats = await mediaManager.getStatistics()
      expect(stats.audio?.packetLossPercentage).toBeCloseTo(1.96, 1)
    })

    it('should include network statistics', async () => {
      const stats = await mediaManager.getStatistics()
      expect(stats.network).toBeDefined()
      expect(stats.network?.currentRoundTripTime).toBe(0.05)
    })

    it('should throw error if peer connection not available', async () => {
      mediaManager.closePeerConnection()
      await expect(mediaManager.getStatistics()).rejects.toThrow('Peer connection not available')
    })
  })

  describe('Cleanup', () => {
    it('should destroy media manager', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'track-1', 'Microphone') as any
      const mockStream = new MockMediaStream([mockTrack]) as any

      mediaManager.createPeerConnection()
      mediaManager.addLocalStream(mockStream)
      mediaManager.startDeviceChangeMonitoring()

      const stopSpy = vi.spyOn(mockTrack, 'stop')

      mediaManager.destroy()

      expect(stopSpy).toHaveBeenCalled()
      expect(mockMediaDevices.removeEventListener).toHaveBeenCalled()
    })

    it('should close peer connection on destroy', () => {
      const pc = mediaManager.createPeerConnection()
      const closeSpy = vi.spyOn(pc, 'close')

      mediaManager.destroy()

      expect(closeSpy).toHaveBeenCalled()
    })
  })
})
