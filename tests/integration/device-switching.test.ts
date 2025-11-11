/**
 * Device Switching Integration Tests
 *
 * Tests device switching scenarios during active calls including:
 * - Audio input device switching
 * - Audio output device switching
 * - Video device switching
 * - Device hot-plugging
 * - Device failure recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MediaManager } from '../../src/core/MediaManager'
import { CallSession } from '../../src/core/CallSession'
import { EventBus } from '../../src/core/EventBus'
import { createMockSipServer, type MockRTCSession } from '../helpers/MockSipServer'
import { MediaDeviceKind, type ExtendedMediaStreamConstraints } from '../../src/types/media.types'

/**
 * Helper function to create mock media devices
 */
function createMockDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
  groupId: string
): MediaDeviceInfo {
  return {
    deviceId,
    kind,
    label,
    groupId,
    toJSON: () => ({}),
  } as MediaDeviceInfo
}

// Global call counter for getUserMedia
let getUserMediaCallCount = 0

/**
 * Helper function to setup mock navigator.mediaDevices
 */
function setupMockMediaDevices(devices: MediaDeviceInfo[]): void {
  const deviceList = [...devices]
  let streamCounter = 1
  let trackCounter = 1

  const createTrack = (kind: 'audio' | 'video', deviceId?: string) => ({
    kind,
    id: `${kind}-track-${trackCounter++}`,
    enabled: true,
    stop: vi.fn(),
    getSettings: vi.fn().mockReturnValue(deviceId ? { deviceId } : {}),
  })

  const getDefaultDeviceId = (kind: MediaDeviceKind) => {
    const device = deviceList.find((d) => d.kind === kind)
    return device?.deviceId
  }

  const extractDeviceId = (
    constraint: boolean | MediaTrackConstraints | undefined,
    fallback?: string
  ): string | undefined => {
    if (!constraint) return fallback
    if (constraint === true) return fallback

    const deviceConstraint = constraint.deviceId
    if (!deviceConstraint) return fallback

    if (typeof deviceConstraint === 'string') {
      return deviceConstraint
    }

    if (Array.isArray(deviceConstraint)) {
      return deviceConstraint[0]
    }

    if (typeof deviceConstraint === 'object') {
      if (Array.isArray(deviceConstraint.exact)) {
        return deviceConstraint.exact[0]
      }
      if (deviceConstraint.exact) {
        return deviceConstraint.exact as string
      }
      if (Array.isArray(deviceConstraint.ideal)) {
        return deviceConstraint.ideal[0]
      }
      if (deviceConstraint.ideal) {
        return deviceConstraint.ideal as string
      }
    }

    return fallback
  }

  const createStream = (constraints?: ExtendedMediaStreamConstraints) => {
    const streamId = `mock-stream-${streamCounter++}`

    const audioDeviceId = extractDeviceId(
      constraints?.audio,
      getDefaultDeviceId(MediaDeviceKind.AudioInput)
    )
    const videoDeviceId = extractDeviceId(
      constraints?.video,
      getDefaultDeviceId(MediaDeviceKind.VideoInput)
    )

    const tracks = [
      ...(constraints?.audio ? [createTrack('audio', audioDeviceId)] : []),
      ...(constraints?.video ? [createTrack('video', videoDeviceId)] : []),
    ]

    // If neither audio nor video explicitly requested, default to audio track
    if (!constraints?.audio && !constraints?.video) {
      tracks.push(createTrack('audio', audioDeviceId))
    }

    return {
      id: streamId,
      active: true,
      getTracks: () => tracks,
      getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
      getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    }
  }

  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockImplementation(async (constraints) => createStream(constraints)),
    enumerateDevices: vi.fn().mockImplementation(async () =>
      deviceList.map((device) => ({
        ...device,
        toJSON: device.toJSON ?? (() => ({})),
      }))
    ),
    getSupportedConstraints: vi.fn().mockReturnValue({
      deviceId: true,
      echoCancellation: true,
      noiseSuppression: true,
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as never

  ;(global.navigator.mediaDevices as any).__deviceList = deviceList
}

describe('Device Switching Integration Tests', () => {
  let eventBus: EventBus
  let mediaManager: MediaManager
  let mockSipServer: ReturnType<typeof createMockSipServer>

  // Mock media devices
  const mockAudioInputDevice1 = createMockDevice('audioinput1', 'audioinput', 'Microphone 1', 'group1')
  const mockAudioInputDevice2 = createMockDevice('audioinput2', 'audioinput', 'Microphone 2', 'group2')
  const mockAudioOutputDevice1 = createMockDevice('audiooutput1', 'audiooutput', 'Speaker 1', 'group1')
  const mockAudioOutputDevice2 = createMockDevice('audiooutput2', 'audiooutput', 'Speaker 2', 'group2')
  const mockVideoDevice1 = createMockDevice('videoinput1', 'videoinput', 'Camera 1', 'group1')
  const mockVideoDevice2 = createMockDevice('videoinput2', 'videoinput', 'Camera 2', 'group2')

  beforeEach(() => {
    vi.clearAllMocks()

    eventBus = new EventBus()
    mediaManager = new MediaManager({ eventBus })
    mockSipServer = createMockSipServer({ autoAcceptCalls: true })

    // Setup navigator.mediaDevices with multiple devices
    // Note: setupMockMediaDevices will be called per test if needed
    setupMockMediaDevices([
      mockAudioInputDevice1,
      mockAudioInputDevice2,
      mockAudioOutputDevice1,
      mockAudioOutputDevice2,
      mockVideoDevice1,
      mockVideoDevice2,
    ])
  })

  afterEach(() => {
    mediaManager.destroy()
    eventBus.destroy()
    mockSipServer.reset()
  })

  describe('Audio Input Device Switching', () => {
    it('should switch audio input device during active call', async () => {
      // Start with device 1
      const stream1 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: false,
      })

      expect(stream1).toBeDefined()
      expect(mediaManager.getLocalStream()).toBeDefined()

      // Create mock session for call and set it to active state
      const mockSession = mockSipServer.createSession('test-call')
      
      // Create call session
      const callSession = new CallSession({
        id: mockSession.id,
        direction: 'outgoing',
        localUri: 'sip:user@example.com',
        remoteUri: 'sip:remote@example.com',
        remoteDisplayName: 'Remote User',
        rtcSession: mockSession,
        eventBus,
      })

      // Simulate call lifecycle to get to active state
      mockSipServer.simulateCallProgress(mockSession)
      await new Promise((resolve) => setTimeout(resolve, 10))
      mockSipServer.simulateCallAccepted(mockSession)
      mockSipServer.simulateCallConfirmed(mockSession)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callSession).toBeDefined()

      // Get tracks from stream1 before switching
      const stream1Tracks = stream1.getTracks()

      // Switch to device 2
      const stream2 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput2' } },
        video: false,
      })

      expect(stream2).toBeDefined()
      expect(stream2.id).not.toBe(stream1.id)

      // Verify old stream tracks were stopped
      stream1Tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalled()
      })

      // Verify new stream has active tracks
      const stream2Tracks = stream2.getTracks()
      expect(stream2Tracks.length).toBeGreaterThan(0)
    })

    it('should handle audio input device failure during call', async () => {
      // Start with working device
      const stream = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: false,
      })

      expect(stream).toBeDefined()
      const originalStream = (mediaManager as any).localStream
      expect(originalStream).toBeDefined()

      // Simulate device failure when trying to switch
      // Modify the existing mock to reject on the next call
      const getUserMediaMock = global.navigator.mediaDevices.getUserMedia as any
      
      // Override the next call to reject
      getUserMediaMock.mockRejectedValueOnce(new Error('Device not available'))

      // Attempt to switch should fail
      await expect(
        mediaManager.getUserMedia({
          audio: { deviceId: { exact: 'audioinput2' } },
          video: false,
        })
      ).rejects.toThrow('Device not available')

      // Original stream should still be active
      expect(mediaManager.getLocalStream()).toBeDefined()
    })

    it('should emit device change events during switch', async () => {
      const events: string[] = []

      eventBus.on('media:stream:added', () => events.push('added'))
      eventBus.on('media:stream:removed', () => events.push('removed'))

      const stream1 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      mediaManager.stopLocalStream()

      const stream2 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput2' } },
        video: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(events).toContain('added')
    })
  })

  describe('Audio Output Device Switching', () => {
    it('should enumerate audio output devices', async () => {
      const devices = await mediaManager.enumerateDevices()

      const audioOutputDevices = devices.filter((d) => d.kind === 'audiooutput')

      expect(audioOutputDevices).toHaveLength(2)
      expect(audioOutputDevices[0].deviceId).toBe('audiooutput1')
      expect(audioOutputDevices[1].deviceId).toBe('audiooutput2')
    })

    it('should track selected audio output device', async () => {
      // Note: Audio output device selection is typically done via HTMLMediaElement.setSinkId()
      // which is not available in the test environment, but we can test the device enumeration

      const devices = await mediaManager.enumerateDevices()
      const outputDevices = devices.filter((d) => d.kind === 'audiooutput')

      expect(outputDevices.length).toBeGreaterThan(0)
      expect(outputDevices[0].label).toBe('Speaker 1')
      expect(outputDevices[1].label).toBe('Speaker 2')
    })
  })

  describe('Video Device Switching', () => {
    it('should switch video input device during video call', async () => {
      // Start video with camera 1
      ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
        id: 'video-stream-1',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([]),
        getVideoTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
      })

      const stream1 = await mediaManager.getUserMedia({
        audio: false,
        video: { deviceId: { exact: 'videoinput1' } },
      })

      expect(stream1).toBeDefined()
      expect(stream1.getVideoTracks().length).toBeGreaterThan(0)

      // Switch to camera 2
      ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
        id: 'video-stream-2',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track-2',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput2' }),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([]),
        getVideoTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track-2',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput2' }),
          },
        ]),
      })

      const stream2 = await mediaManager.getUserMedia({
        audio: false,
        video: { deviceId: { exact: 'videoinput2' } },
      })

      expect(stream2).toBeDefined()
      expect(stream2.id).not.toBe(stream1.id)
      expect(stream2.getVideoTracks()[0].getSettings().deviceId).toBe('videoinput2')
    })

    it('should handle video device failure gracefully', async () => {
      ;(global.navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(
        new Error('Camera not accessible')
      )

      await expect(
        mediaManager.getUserMedia({
          audio: false,
          video: { deviceId: { exact: 'videoinput1' } },
        })
      ).rejects.toThrow('Camera not accessible')
    })
  })

  describe('Device Hot-Plugging', () => {
    it('should detect new device when plugged in', async () => {
      // Initial device list
      let devices = await mediaManager.enumerateDevices()
      const initialCount = devices.length

      // Simulate device hot-plug by updating enumerateDevices
      const newDevice = {
        deviceId: 'audioinput3',
        kind: 'audioinput' as MediaDeviceKind,
        label: 'Microphone 3 (USB)',
        groupId: 'group3',
        toJSON: () => ({}),
      }

      const deviceList = (global.navigator.mediaDevices as any).__deviceList as MediaDeviceInfo[]
      deviceList.push(newDevice as MediaDeviceInfo)

      // Trigger devicechange event
      const deviceChangeHandlers: Function[] = []
      ;(global.navigator.mediaDevices.addEventListener as any).mockImplementation(
        (event: string, handler: Function) => {
          if (event === 'devicechange') {
            deviceChangeHandlers.push(handler)
          }
        }
      )

      // Start monitoring
      mediaManager.startDeviceChangeMonitoring()

      // Simulate device change
      deviceChangeHandlers.forEach((handler) => handler(new Event('devicechange')))

      // Re-enumerate
      devices = await mediaManager.enumerateDevices()

      expect(devices.length).toBeGreaterThan(initialCount)
    })

    it('should detect device removal', async () => {
      const devices = await mediaManager.enumerateDevices()
      const initialCount = devices.length

      // Simulate device removal
      const deviceList = (global.navigator.mediaDevices as any).__deviceList as MediaDeviceInfo[]
      const index = deviceList.findIndex((device) => device.deviceId === mockAudioInputDevice2.deviceId)
      if (index !== -1) {
        deviceList.splice(index, 1)
      }

      const newDevices = await mediaManager.enumerateDevices()

      expect(newDevices.length).toBeLessThan(initialCount)
    })

    it('should handle active device being unplugged', async () => {
      // Start stream with device
      const stream = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: false,
      })

      expect(stream).toBeDefined()

      // Simulate device being unplugged
      ;(global.navigator.mediaDevices.enumerateDevices as any).mockResolvedValueOnce([
        // Removed: mockAudioInputDevice1
        mockAudioInputDevice2,
        mockAudioOutputDevice1,
        mockAudioOutputDevice2,
        mockVideoDevice1,
        mockVideoDevice2,
      ])

      const devices = await mediaManager.enumerateDevices()

      // Device 1 should no longer be in the list
      const device1 = devices.find((d) => d.deviceId === 'audioinput1')
      expect(device1).toBeUndefined()

      // Stream would typically emit 'ended' event on tracks
      // In real scenario, application should handle this and switch to another device
    })
  })

  describe('Multi-Device Audio/Video Calls', () => {
    it('should handle audio + video with different devices', async () => {
      // Mock getUserMedia to return both audio and video
      ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
        id: 'av-stream',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'audioinput1' }),
          },
          {
            kind: 'video',
            id: 'video-track',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'audioinput1' }),
          },
        ]),
        getVideoTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
      })

      const stream = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: { deviceId: { exact: 'videoinput1' } },
      })

      expect(stream).toBeDefined()
      expect(stream.getAudioTracks().length).toBe(1)
      expect(stream.getVideoTracks().length).toBe(1)
      expect(stream.getAudioTracks()[0].getSettings().deviceId).toBe('audioinput1')
      expect(stream.getVideoTracks()[0].getSettings().deviceId).toBe('videoinput1')
    })

    it('should switch only audio device in A/V call', async () => {
      // Initial A/V stream
      ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
        id: 'av-stream-1',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'audioinput1' }),
          },
          {
            kind: 'video',
            id: 'video-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'audioinput1' }),
          },
        ]),
        getVideoTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
      })

      const stream1 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: { deviceId: { exact: 'videoinput1' } },
      })

      expect(stream1.getAudioTracks()[0].getSettings().deviceId).toBe('audioinput1')

      // Switch only audio
      ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
        id: 'av-stream-2',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track-2',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'audioinput2' }),
          },
          {
            kind: 'video',
            id: 'video-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track-2',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'audioinput2' }),
          },
        ]),
        getVideoTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track-1',
            enabled: true,
            stop: vi.fn(),
            getSettings: vi.fn().mockReturnValue({ deviceId: 'videoinput1' }),
          },
        ]),
      })

      const stream2 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput2' } },
        video: { deviceId: { exact: 'videoinput1' } },
      })

      expect(stream2.getAudioTracks()[0].getSettings().deviceId).toBe('audioinput2')
      expect(stream2.getVideoTracks()[0].getSettings().deviceId).toBe('videoinput1')
    })
  })

  describe('Device Permissions During Switch', () => {
    it('should handle permission denial when switching devices', async () => {
      // Initial device works
      const stream1 = await mediaManager.getUserMedia({
        audio: { deviceId: { exact: 'audioinput1' } },
        video: false,
      })

      expect(stream1).toBeDefined()

      // Permission denied for new device
      ;(global.navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(
        new Error('Permission denied')
      )

      await expect(
        mediaManager.getUserMedia({
          audio: { deviceId: { exact: 'audioinput2' } },
          video: false,
        })
      ).rejects.toThrow('Permission denied')

      // Original stream should still be valid
      expect(stream1.getTracks().length).toBeGreaterThan(0)
    })

    it('should request permission for new device type', async () => {
      // Start with audio only
      const audioStream = await mediaManager.getUserMedia({
        audio: true,
        video: false,
      })

      expect(audioStream.getAudioTracks().length).toBeGreaterThan(0)
      expect(audioStream.getVideoTracks().length).toBe(0)

      // Add video (requires new permission)
      ;(global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
        id: 'av-stream',
        active: true,
        getTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track',
            enabled: true,
            stop: vi.fn(),
          },
          {
            kind: 'video',
            id: 'video-track',
            enabled: true,
            stop: vi.fn(),
          },
        ]),
        getAudioTracks: vi.fn().mockReturnValue([
          {
            kind: 'audio',
            id: 'audio-track',
            enabled: true,
            stop: vi.fn(),
          },
        ]),
        getVideoTracks: vi.fn().mockReturnValue([
          {
            kind: 'video',
            id: 'video-track',
            enabled: true,
            stop: vi.fn(),
          },
        ]),
      })

      const avStream = await mediaManager.getUserMedia({
        audio: true,
        video: true,
      })

      expect(avStream.getAudioTracks().length).toBeGreaterThan(0)
      expect(avStream.getVideoTracks().length).toBeGreaterThan(0)
    })
  })
})
