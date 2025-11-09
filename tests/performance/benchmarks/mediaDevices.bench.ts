/**
 * MediaDevices Performance Benchmarks
 *
 * Benchmarks for media device operations including enumerate, switch,
 * mute/unmute, and device management.
 */

import { bench, describe, beforeEach, afterEach, vi } from 'vitest'
import { MediaManager } from '@/core/MediaManager'
import { createEventBus } from '@/core/EventBus'
import type { EventBus } from '@/core/EventBus'
import { PERFORMANCE } from '@/utils/constants'
import { MediaDeviceKind } from '@/types/media.types'

// Mock MediaDevices API
const createMockMediaDevices = () => {
  const devices = [
    {
      deviceId: 'default',
      groupId: 'group1',
      kind: 'audioinput' as MediaDeviceKind,
      label: 'Default Microphone',
      toJSON: () => ({}),
    },
    {
      deviceId: 'audio-input-1',
      groupId: 'group1',
      kind: 'audioinput' as MediaDeviceKind,
      label: 'External Microphone',
      toJSON: () => ({}),
    },
    {
      deviceId: 'audio-output-1',
      groupId: 'group2',
      kind: 'audiooutput' as MediaDeviceKind,
      label: 'Speakers',
      toJSON: () => ({}),
    },
    {
      deviceId: 'video-input-1',
      groupId: 'group3',
      kind: 'videoinput' as MediaDeviceKind,
      label: 'Webcam',
      toJSON: () => ({}),
    },
  ]

  return {
    enumerateDevices: vi.fn().mockResolvedValue(devices),
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          kind: 'audio',
          enabled: true,
          stop: vi.fn(),
          getSettings: () => ({ deviceId: 'default' }),
        },
      ],
      getAudioTracks: () => [
        {
          kind: 'audio',
          enabled: true,
          stop: vi.fn(),
          getSettings: () => ({ deviceId: 'default' }),
        },
      ],
      getVideoTracks: () => [],
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
    }),
    getSupportedConstraints: vi.fn().mockReturnValue({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }),
  }
}

describe('MediaDevices Performance Benchmarks', () => {
  let eventBus: EventBus
  let mediaManager: MediaManager

  beforeEach(() => {
    // Mock navigator.mediaDevices
    const mockMediaDevices = createMockMediaDevices()
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: mockMediaDevices,
      writable: true,
      configurable: true,
    })

    eventBus = createEventBus()
    mediaManager = new MediaManager({ eventBus })
  })

  afterEach(() => {
    mediaManager.destroy()
    eventBus.destroy()
  })

  describe('Device Enumeration', () => {
    bench('enumerate devices (fast path)', async () => {
      await mediaManager.enumerateDevices()
    })

    bench('enumerate devices with filtering', async () => {
      const devices = await mediaManager.enumerateDevices()

      // Filter audio input devices
      const _audioInputs = devices.filter((d) => d.kind === MediaDeviceKind.AudioInput)

      // Filter audio output devices
      const _audioOutputs = devices.filter((d) => d.kind === MediaDeviceKind.AudioOutput)

      // Filter video input devices
      const _videoInputs = devices.filter((d) => d.kind === MediaDeviceKind.VideoInput)
    })

    bench('repeated device enumeration', async () => {
      // Simulate multiple enumerations (caching scenario)
      await mediaManager.enumerateDevices()
      await mediaManager.enumerateDevices()
      await mediaManager.enumerateDevices()
    })
  })

  describe('Get User Media', () => {
    bench('get audio stream (fast path)', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })
    })

    bench('get audio stream with constraints', async () => {
      await mediaManager.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      })
    })

    bench('get audio+video stream', async () => {
      await mediaManager.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      })
    })

    bench('get stream with specific device', async () => {
      await mediaManager.getUserMedia({
        audio: {
          deviceId: { exact: 'audio-input-1' },
        },
        video: false,
      })
    })
  })

  describe('Device Switching', () => {
    bench('switch audio input device', async () => {
      // Get initial stream
      await mediaManager.getUserMedia({ audio: true, video: false })

      // Switch to different device
      await mediaManager.switchAudioInput('audio-input-1')
    })

    bench('switch audio output device', async () => {
      await mediaManager.switchAudioOutput('audio-output-1')
    })

    bench('switch video input device', async () => {
      // Get initial stream with video
      await mediaManager.getUserMedia({ audio: true, video: true })

      // Switch to different device
      await mediaManager.switchVideoInput('video-input-1')
    })

    bench('multiple device switches', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      // Switch audio input multiple times
      await mediaManager.switchAudioInput('audio-input-1')
      await mediaManager.switchAudioInput('default')
      await mediaManager.switchAudioInput('audio-input-1')
    })
  })

  describe('Mute/Unmute Operations', () => {
    bench('mute audio track', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = false
        }
      }
    })

    bench('unmute audio track', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = false
          audioTrack.enabled = true
        }
      }
    })

    bench('mute/unmute cycle', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          // Perform multiple mute/unmute cycles
          audioTrack.enabled = false
          audioTrack.enabled = true
          audioTrack.enabled = false
          audioTrack.enabled = true
        }
      }
    })

    bench('mute video track', async () => {
      await mediaManager.getUserMedia({ audio: true, video: true })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = false
        }
      }
    })
  })

  describe('Track Management', () => {
    bench('add track to stream', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const newTrack = {
          kind: 'video',
          enabled: true,
          stop: vi.fn(),
          getSettings: () => ({ deviceId: 'video-input-1' }),
        }
        localStream.addTrack(newTrack as any)
      }
    })

    bench('remove track from stream', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          localStream.removeTrack(audioTrack)
        }
      }
    })

    bench('replace track in stream', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        const oldTrack = localStream.getAudioTracks()[0]
        if (oldTrack) {
          const newTrack = {
            kind: 'audio',
            enabled: true,
            stop: vi.fn(),
            getSettings: () => ({ deviceId: 'audio-input-1' }),
          }

          localStream.removeTrack(oldTrack)
          localStream.addTrack(newTrack as any)
          oldTrack.stop()
        }
      }
    })
  })

  describe('Device Change Detection', () => {
    bench('handle device change event', async () => {
      await mediaManager.enumerateDevices()

      // Simulate device change
      const deviceChangeEvent = new Event('devicechange')
      const startTime = performance.now()

      navigator.mediaDevices.dispatchEvent(deviceChangeEvent)

      const endTime = performance.now()
      const latency = endTime - startTime

      if (latency > PERFORMANCE.MAX_EVENT_PROPAGATION_TIME) {
        console.warn(
          `Device change handling exceeded budget: ${latency}ms > ${PERFORMANCE.MAX_EVENT_PROPAGATION_TIME}ms`
        )
      }
    })
  })

  describe('Permission Management', () => {
    bench('request audio permission', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      // Check permission status (if available)
      const _hasAudio = (mediaManager as { permissions?: { audio?: boolean } }).permissions?.audio
    })

    bench('request audio+video permission', async () => {
      await mediaManager.getUserMedia({ audio: true, video: true })

      // Check permission status
      const _hasAudio = (mediaManager as { permissions?: { audio?: boolean; video?: boolean } })
        .permissions?.audio
      const _hasVideo = (mediaManager as { permissions?: { audio?: boolean; video?: boolean } })
        .permissions?.video
    })
  })

  describe('Stream Cleanup', () => {
    bench('stop single stream', async () => {
      await mediaManager.getUserMedia({ audio: true, video: false })

      const localStream = (mediaManager as any).localStream
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop())
      }
    })

    bench('stop multiple streams', async () => {
      // Create multiple streams
      const stream1 = await mediaManager.getUserMedia({ audio: true, video: false })
      const stream2 = await mediaManager.getUserMedia({ audio: true, video: true })

      // Stop all tracks
      ;[stream1, stream2].forEach((stream) => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop())
        }
      })
    })

    bench('cleanup on destroy', async () => {
      await mediaManager.getUserMedia({ audio: true, video: true })

      mediaManager.destroy()

      // Reinitialize for next benchmark
      mediaManager = new MediaManager({ eventBus })
    })
  })

  describe('Performance Budget Compliance', () => {
    bench('device enumeration latency check', async () => {
      const startTime = performance.now()

      await mediaManager.enumerateDevices()

      const endTime = performance.now()
      const latency = endTime - startTime

      if (latency > PERFORMANCE.MAX_STATE_UPDATE_LATENCY) {
        console.warn(
          `Device enumeration exceeded budget: ${latency}ms > ${PERFORMANCE.MAX_STATE_UPDATE_LATENCY}ms`
        )
      }
    })

    bench('getUserMedia latency check', async () => {
      const startTime = performance.now()

      await mediaManager.getUserMedia({ audio: true, video: false })

      const endTime = performance.now()
      const latency = endTime - startTime

      // getUserMedia can be slower, use a more lenient budget
      const budget = PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 5
      if (latency > budget) {
        console.warn(`getUserMedia exceeded budget: ${latency}ms > ${budget}ms`)
      }
    })
  })

  describe('Concurrent Operations', () => {
    bench('concurrent device enumeration and stream acquisition', async () => {
      // Run operations concurrently
      await Promise.all([
        mediaManager.enumerateDevices(),
        mediaManager.getUserMedia({ audio: true, video: false }),
      ])
    })

    bench('concurrent multiple getUserMedia calls', async () => {
      // This tests handling of rapid successive calls
      const promises = [
        mediaManager.getUserMedia({ audio: true, video: false }),
        mediaManager.getUserMedia({ audio: true, video: false }),
        mediaManager.getUserMedia({ audio: true, video: false }),
      ]

      await Promise.all(promises)
    })
  })

  describe('Memory Management', () => {
    bench('create and cleanup multiple media managers', () => {
      const managers: MediaManager[] = []

      // Create multiple managers
      for (let i = 0; i < 5; i++) {
        const manager = new MediaManager({ eventBus })
        managers.push(manager)
      }

      // Cleanup all
      managers.forEach((m) => m.destroy())
    })
  })
})
