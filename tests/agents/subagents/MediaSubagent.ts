/**
 * Media Subagent
 *
 * Handles media devices and streams for the agent
 */

import { BaseSubagent } from './BaseSubagent'
import type { SipTestAgent } from '../SipTestAgent'

export interface MediaDeviceInfo {
  deviceId: string
  kind: 'audioinput' | 'audiooutput' | 'videoinput'
  label: string
  groupId: string
}

export interface MediaState {
  audioEnabled: boolean
  videoEnabled: boolean
  selectedAudioInput: string | null
  selectedAudioOutput: string | null
  selectedVideoInput: string | null
  availableDevices: MediaDeviceInfo[]
  streamActive: boolean
}

/**
 * Media subagent
 */
export class MediaSubagent extends BaseSubagent {
  private state: MediaState = {
    audioEnabled: true,
    videoEnabled: false,
    selectedAudioInput: null,
    selectedAudioOutput: null,
    selectedVideoInput: null,
    availableDevices: [],
    streamActive: false,
  }

  private mockStream: MediaStream | null = null

  constructor(agent: SipTestAgent) {
    super(agent, 'media')
  }

  /**
   * Initialize media handlers
   */
  protected async onInitialize(): Promise<void> {
    // Enumerate media devices
    await this.enumerateDevices()
  }

  /**
   * Cleanup media resources
   */
  protected async onCleanup(): Promise<void> {
    if (this.mockStream) {
      this.stopStream()
    }
  }

  /**
   * Enumerate available media devices
   */
  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    // In a mock environment, we'll simulate some devices
    this.state.availableDevices = [
      {
        deviceId: 'default-mic',
        kind: 'audioinput',
        label: 'Default Microphone',
        groupId: 'group1',
      },
      {
        deviceId: 'external-mic',
        kind: 'audioinput',
        label: 'External Microphone',
        groupId: 'group2',
      },
      {
        deviceId: 'default-speaker',
        kind: 'audiooutput',
        label: 'Default Speaker',
        groupId: 'group1',
      },
      {
        deviceId: 'external-speaker',
        kind: 'audiooutput',
        label: 'External Speaker',
        groupId: 'group2',
      },
      {
        deviceId: 'default-camera',
        kind: 'videoinput',
        label: 'Default Camera',
        groupId: 'group3',
      },
    ]

    // Set defaults
    if (!this.state.selectedAudioInput) {
      this.state.selectedAudioInput = 'default-mic'
    }
    if (!this.state.selectedAudioOutput) {
      this.state.selectedAudioOutput = 'default-speaker'
    }
    if (!this.state.selectedVideoInput) {
      this.state.selectedVideoInput = 'default-camera'
    }

    return this.state.availableDevices
  }

  /**
   * Get user media stream
   */
  async getUserMedia(constraints: MediaStreamConstraints = {}): Promise<MediaStream> {
    const defaultConstraints: MediaStreamConstraints = {
      audio: this.state.audioEnabled,
      video: this.state.videoEnabled,
      ...constraints,
    }

    // Create a mock stream
    this.mockStream = {
      id: `stream-${this.agentId}`,
      active: true,
      getTracks: () => [],
      getAudioTracks: () => (defaultConstraints.audio ? [this.createMockAudioTrack()] : []),
      getVideoTracks: () => (defaultConstraints.video ? [this.createMockVideoTrack()] : []),
      addTrack: () => {},
      removeTrack: () => {},
      clone: () => this.mockStream!,
      getTrackById: () => null,
    } as unknown as MediaStream

    this.state.streamActive = true

    this.emit('media:stream-started', {
      agentId: this.agentId,
      streamId: this.mockStream.id,
    })

    return this.mockStream
  }

  /**
   * Stop media stream
   */
  stopStream(): void {
    if (this.mockStream) {
      this.mockStream.getTracks().forEach(track => {
        if ('stop' in track && typeof track.stop === 'function') {
          track.stop()
        }
      })
      this.mockStream = null
      this.state.streamActive = false

      this.emit('media:stream-stopped', {
        agentId: this.agentId,
      })
    }
  }

  /**
   * Enable/disable audio
   */
  setAudioEnabled(enabled: boolean): void {
    this.state.audioEnabled = enabled

    this.emit('media:audio-changed', {
      agentId: this.agentId,
      enabled,
    })
  }

  /**
   * Enable/disable video
   */
  setVideoEnabled(enabled: boolean): void {
    this.state.videoEnabled = enabled

    this.emit('media:video-changed', {
      agentId: this.agentId,
      enabled,
    })
  }

  /**
   * Select audio input device
   */
  selectAudioInput(deviceId: string): void {
    const device = this.state.availableDevices.find(
      d => d.deviceId === deviceId && d.kind === 'audioinput'
    )

    if (!device) {
      throw new Error(`Audio input device ${deviceId} not found`)
    }

    this.state.selectedAudioInput = deviceId

    this.emit('media:audio-input-changed', {
      agentId: this.agentId,
      deviceId,
      label: device.label,
    })
  }

  /**
   * Select audio output device
   */
  selectAudioOutput(deviceId: string): void {
    const device = this.state.availableDevices.find(
      d => d.deviceId === deviceId && d.kind === 'audiooutput'
    )

    if (!device) {
      throw new Error(`Audio output device ${deviceId} not found`)
    }

    this.state.selectedAudioOutput = deviceId

    this.emit('media:audio-output-changed', {
      agentId: this.agentId,
      deviceId,
      label: device.label,
    })
  }

  /**
   * Select video input device
   */
  selectVideoInput(deviceId: string): void {
    const device = this.state.availableDevices.find(
      d => d.deviceId === deviceId && d.kind === 'videoinput'
    )

    if (!device) {
      throw new Error(`Video input device ${deviceId} not found`)
    }

    this.state.selectedVideoInput = deviceId

    this.emit('media:video-input-changed', {
      agentId: this.agentId,
      deviceId,
      label: device.label,
    })
  }

  /**
   * Get available devices by kind
   */
  getDevicesByKind(kind: 'audioinput' | 'audiooutput' | 'videoinput'): MediaDeviceInfo[] {
    return this.state.availableDevices.filter(d => d.kind === kind)
  }

  /**
   * Is audio enabled
   */
  isAudioEnabled(): boolean {
    return this.state.audioEnabled
  }

  /**
   * Is video enabled
   */
  isVideoEnabled(): boolean {
    return this.state.videoEnabled
  }

  /**
   * Get media state
   */
  getState(): MediaState {
    return { ...this.state, availableDevices: [...this.state.availableDevices] }
  }

  /**
   * Create a mock audio track
   */
  private createMockAudioTrack(): MediaStreamTrack {
    return {
      kind: 'audio',
      id: `audio-${this.agentId}`,
      label: 'Mock Audio Track',
      enabled: this.state.audioEnabled,
      muted: false,
      readyState: 'live',
      stop: () => {},
      getSettings: () => ({
        deviceId: this.state.selectedAudioInput || 'default-mic',
      }),
    } as unknown as MediaStreamTrack
  }

  /**
   * Create a mock video track
   */
  private createMockVideoTrack(): MediaStreamTrack {
    return {
      kind: 'video',
      id: `video-${this.agentId}`,
      label: 'Mock Video Track',
      enabled: this.state.videoEnabled,
      muted: false,
      readyState: 'live',
      stop: () => {},
      getSettings: () => ({
        deviceId: this.state.selectedVideoInput || 'default-camera',
      }),
    } as unknown as MediaStreamTrack
  }
}
