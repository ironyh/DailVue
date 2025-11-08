/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useMediaDevices composable unit tests
 * Comprehensive tests for device management, permissions, testing, and monitoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useMediaDevices } from '@/composables/useMediaDevices'
import { MediaDeviceKind, PermissionStatus } from '@/types/media.types'
import type { MediaDevice } from '@/types/media.types'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock device store
vi.mock('@/stores/deviceStore', () => ({
  deviceStore: {
    setSelectedAudioInput: vi.fn(),
    setSelectedAudioOutput: vi.fn(),
    setSelectedVideoInput: vi.fn(),
    setAudioPermission: vi.fn(),
    setVideoPermission: vi.fn(),
    selectAudioInput: vi.fn(),
    selectAudioOutput: vi.fn(),
    selectVideoInput: vi.fn(),
    setDevices: vi.fn(),
    setDeviceChangeListenerAttached: vi.fn(),
    setDeviceChangeListenerDetached: vi.fn(),
    selectedAudioInputId: null,
    selectedAudioOutputId: null,
    selectedVideoInputId: null,
    audioInputDevices: [],
    audioOutputDevices: [],
    videoInputDevices: [],
    audioPermission: 'prompt' as any,
    videoPermission: 'prompt' as any,
  },
}))

describe('useMediaDevices - Comprehensive Tests', () => {
  let mockMediaManager: any
  let mockGetUserMedia: any
  let mockEnumerateDevices: any
  let mockDeviceStore: any

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Import mock after mocks are set up
    const deviceStoreModule = await import('@/stores/deviceStore')
    mockDeviceStore = deviceStoreModule.deviceStore

    // Reset store state
    mockDeviceStore.selectedAudioInputId = null
    mockDeviceStore.selectedAudioOutputId = null
    mockDeviceStore.selectedVideoInputId = null
    mockDeviceStore.audioInputDevices = []
    mockDeviceStore.audioOutputDevices = []
    mockDeviceStore.videoInputDevices = []
    mockDeviceStore.audioPermission = 'prompt'
    mockDeviceStore.videoPermission = 'prompt'

    // Mock MediaManager
    mockMediaManager = {
      enumerateDevices: vi.fn(),
      testDevice: vi.fn(),
    }

    // Mock navigator.mediaDevices
    mockGetUserMedia = vi.fn()
    mockEnumerateDevices = vi.fn()

    global.navigator = {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: mockEnumerateDevices,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    } as any

    // Mock AudioContext
    global.AudioContext = vi.fn().mockImplementation(() => ({
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
      })),
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        frequencyBinCount: 1024,
        getByteFrequencyData: vi.fn(),
      })),
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { value: 0 },
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 0 },
      })),
      destination: {},
      close: vi.fn().mockResolvedValue(undefined),
    })) as any
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('enumerateDevices() method', () => {
    it('should enumerate devices using MediaManager', async () => {
      const devices: MediaDevice[] = [
        { deviceId: 'audio-in-1', kind: MediaDeviceKind.AudioInput, label: 'Mic 1', groupId: 'g1' },
        {
          deviceId: 'audio-out-1',
          kind: MediaDeviceKind.AudioOutput,
          label: 'Speaker 1',
          groupId: 'g2',
        },
      ]

      mockMediaManager.enumerateDevices.mockResolvedValue(devices)
      const mediaManagerRef = ref(mockMediaManager)

      const { enumerateDevices } = useMediaDevices(mediaManagerRef, { autoEnumerate: false })

      const result = await enumerateDevices()

      expect(mockMediaManager.enumerateDevices).toHaveBeenCalled()
      expect(mockDeviceStore.setDevices).toHaveBeenCalledWith(devices)
      expect(result).toEqual(devices)
    })

    it('should enumerate devices using fallback API', async () => {
      const mockDevices = [
        { deviceId: 'audio-in-1', kind: 'audioinput', label: 'Mic 1', groupId: 'g1' },
        { deviceId: 'video-in-1', kind: 'videoinput', label: 'Camera 1', groupId: 'g2' },
      ]

      mockEnumerateDevices.mockResolvedValue(mockDevices)

      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await enumerateDevices()

      expect(mockEnumerateDevices).toHaveBeenCalled()
      expect(mockDeviceStore.setDevices).toHaveBeenCalled()
      expect(result.length).toBe(2)
    })

    it('should not enumerate if already in progress', async () => {
      mockMediaManager.enumerateDevices.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      )

      const mediaManagerRef = ref(mockMediaManager)
      const { enumerateDevices } = useMediaDevices(mediaManagerRef, {
        autoEnumerate: false,
      })

      const promise1 = enumerateDevices()
      const promise2 = enumerateDevices()

      await promise1
      await promise2

      // Should only call once
      expect(mockMediaManager.enumerateDevices).toHaveBeenCalledTimes(1)
    })

    it('should set isEnumerating flag during enumeration', async () => {
      mockMediaManager.enumerateDevices.mockResolvedValue([])
      const mediaManagerRef = ref(mockMediaManager)

      const { enumerateDevices, isEnumerating } = useMediaDevices(mediaManagerRef, {
        autoEnumerate: false,
      })

      expect(isEnumerating.value).toBe(false)

      const promise = enumerateDevices()
      await nextTick()

      expect(isEnumerating.value).toBe(true)

      await promise

      expect(isEnumerating.value).toBe(false)
    })

    it('should handle enumeration errors', async () => {
      const error = new Error('Enumeration failed')
      mockEnumerateDevices.mockRejectedValue(error)

      const { enumerateDevices, lastError } = useMediaDevices(ref(null), { autoEnumerate: false })

      await expect(enumerateDevices()).rejects.toThrow('Enumeration failed')
      expect(lastError.value).toEqual(error)
    })

    it('should reset isEnumerating on error', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Failed'))

      const { enumerateDevices, isEnumerating } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      await expect(enumerateDevices()).rejects.toThrow()

      expect(isEnumerating.value).toBe(false)
    })
  })

  describe('Permission Management', () => {
    it('should request audio permission successfully', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'audio' }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)

      const { requestAudioPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await requestAudioPermission()

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(result).toBe(true)
      expect(mockDeviceStore.setAudioPermission).toHaveBeenCalledWith(PermissionStatus.Granted)
    })

    it('should handle audio permission denial', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

      const { requestAudioPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await requestAudioPermission()

      expect(result).toBe(false)
      expect(mockDeviceStore.setAudioPermission).toHaveBeenCalledWith(PermissionStatus.Denied)
    })

    it('should request video permission successfully', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'video' }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)

      const { requestVideoPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await requestVideoPermission()

      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true })
      expect(result).toBe(true)
      expect(mockDeviceStore.setVideoPermission).toHaveBeenCalledWith(PermissionStatus.Granted)
    })

    it('should handle video permission denial', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

      const { requestVideoPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await requestVideoPermission()

      expect(result).toBe(false)
      expect(mockDeviceStore.setVideoPermission).toHaveBeenCalledWith(PermissionStatus.Denied)
    })

    it('should request both permissions together', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [
          { stop: vi.fn(), kind: 'audio' },
          { stop: vi.fn(), kind: 'video' },
        ]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)
      mockEnumerateDevices.mockResolvedValue([])

      const { requestPermissions } = useMediaDevices(ref(null), { autoEnumerate: false })

      await requestPermissions(true, true)

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true, video: true })
      expect(mockDeviceStore.setAudioPermission).toHaveBeenCalledWith(PermissionStatus.Granted)
      expect(mockDeviceStore.setVideoPermission).toHaveBeenCalledWith(PermissionStatus.Granted)
    })

    it('should request only audio permission by default', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)
      mockEnumerateDevices.mockResolvedValue([])

      const { requestPermissions } = useMediaDevices(ref(null), { autoEnumerate: false })

      await requestPermissions()

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    })

    it('should re-enumerate after granting permissions', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)
      mockEnumerateDevices.mockResolvedValue([])

      const { requestPermissions } = useMediaDevices(ref(null), { autoEnumerate: false })

      await requestPermissions(true, false)

      expect(mockEnumerateDevices).toHaveBeenCalled()
    })

    it('should stop tracks after permission check', async () => {
      const stopFn = vi.fn()
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopFn, kind: 'audio' }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)

      const { requestAudioPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      await requestAudioPermission()

      expect(stopFn).toHaveBeenCalled()
    })

    it('should throw error if permission request fails', async () => {
      const error = new Error('Permission denied')
      mockGetUserMedia.mockRejectedValue(error)

      const { requestPermissions } = useMediaDevices(ref(null), { autoEnumerate: false })

      await expect(requestPermissions(true, true)).rejects.toThrow('Permission denied')
      expect(mockDeviceStore.setAudioPermission).toHaveBeenCalledWith(PermissionStatus.Denied)
      expect(mockDeviceStore.setVideoPermission).toHaveBeenCalledWith(PermissionStatus.Denied)
    })
  })

  describe('Device Selection', () => {
    beforeEach(() => {
      mockDeviceStore.audioInputDevices = [
        { deviceId: 'audio-in-1', kind: MediaDeviceKind.AudioInput, label: 'Mic 1', groupId: '' },
      ]
      mockDeviceStore.audioOutputDevices = [
        {
          deviceId: 'audio-out-1',
          kind: MediaDeviceKind.AudioOutput,
          label: 'Speaker 1',
          groupId: '',
        },
      ]
      mockDeviceStore.videoInputDevices = [
        {
          deviceId: 'video-in-1',
          kind: MediaDeviceKind.VideoInput,
          label: 'Camera 1',
          groupId: '',
        },
      ]
    })

    it('should select audio input device', () => {
      const { selectAudioInput, selectedAudioInputId } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectAudioInput('audio-in-1')

      expect(selectedAudioInputId.value).toBe('audio-in-1')
      expect(mockDeviceStore.selectAudioInput).toHaveBeenCalledWith('audio-in-1')
    })

    it('should select audio output device', () => {
      const { selectAudioOutput, selectedAudioOutputId } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectAudioOutput('audio-out-1')

      expect(selectedAudioOutputId.value).toBe('audio-out-1')
      expect(mockDeviceStore.selectAudioOutput).toHaveBeenCalledWith('audio-out-1')
    })

    it('should select video input device', () => {
      const { selectVideoInput, selectedVideoInputId } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectVideoInput('video-in-1')

      expect(selectedVideoInputId.value).toBe('video-in-1')
      expect(mockDeviceStore.selectVideoInput).toHaveBeenCalledWith('video-in-1')
    })

    it('should warn when selecting unknown audio input device', () => {
      const { selectAudioInput, selectedAudioInputId } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      // Should still set the value even if device not found
      selectAudioInput('unknown-device')

      expect(selectedAudioInputId.value).toBe('unknown-device')
    })

    it('should warn when selecting unknown audio output device', () => {
      const { selectAudioOutput, selectedAudioOutputId } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectAudioOutput('unknown-device')

      expect(selectedAudioOutputId.value).toBe('unknown-device')
    })

    it('should warn when selecting unknown video input device', () => {
      const { selectVideoInput, selectedVideoInputId } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectVideoInput('unknown-device')

      expect(selectedVideoInputId.value).toBe('unknown-device')
    })
  })

  describe('Device Testing', () => {
    it('should test audio input using MediaManager', async () => {
      mockMediaManager.testDevice.mockResolvedValue({ success: true, audioLevel: 0.5 })

      const mediaManagerRef = ref(mockMediaManager)
      const { testAudioInput, selectAudioInput } = useMediaDevices(mediaManagerRef, {
        autoEnumerate: false,
      })

      selectAudioInput('audio-in-1')

      const result = await testAudioInput()

      expect(mockMediaManager.testDevice).toHaveBeenCalledWith('audio-in-1')
      expect(result).toBe(true)
    })

    it('should test audio input using fallback when no MediaManager', async () => {
      vi.useFakeTimers()

      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'audio' }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)

      const { testAudioInput } = useMediaDevices(ref(null), { autoEnumerate: false })

      const promise = testAudioInput('audio-in-1')

      // Fast-forward the test duration
      await vi.advanceTimersByTimeAsync(2000)

      const result = await promise

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: { deviceId: { exact: 'audio-in-1' } },
      })
      expect(result).toBeDefined()

      vi.useRealTimers()
    })

    it('should throw error if no audio device selected', async () => {
      const { testAudioInput } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await testAudioInput()

      expect(result).toBe(false)
    })

    it('should test audio input with custom options', async () => {
      vi.useFakeTimers()

      mockMediaManager.testDevice.mockResolvedValue({ success: true, audioLevel: 0.05 })

      const mediaManagerRef = ref(mockMediaManager)
      const { testAudioInput } = useMediaDevices(mediaManagerRef, { autoEnumerate: false })

      const promise = testAudioInput('audio-in-1', {
        duration: 1000,
        audioLevelThreshold: 0.02,
      })

      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result).toBe(true)

      vi.useRealTimers()
    })

    it('should test audio output device', async () => {
      const { testAudioOutput } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await testAudioOutput('audio-out-1')

      expect(result).toBeDefined()
    })

    it('should throw error if no audio output device selected', async () => {
      const { testAudioOutput } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await testAudioOutput()

      expect(result).toBe(false)
    })

    it('should handle audio output test errors', async () => {
      // Mock AudioContext to throw error
      global.AudioContext = vi.fn().mockImplementation(() => {
        throw new Error('AudioContext failed')
      }) as any

      const { testAudioOutput } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await testAudioOutput('audio-out-1')

      expect(result).toBe(false)
    })

    it('should cleanup resources after audio input test', async () => {
      vi.useFakeTimers()

      const stopFn = vi.fn()
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopFn, kind: 'audio' }]),
      }
      mockGetUserMedia.mockResolvedValue(mockStream)

      const { testAudioInput } = useMediaDevices(ref(null), { autoEnumerate: false })

      const promise = testAudioInput('audio-in-1')
      await vi.advanceTimersByTimeAsync(2000)
      await promise

      expect(stopFn).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Device Utilities', () => {
    beforeEach(() => {
      mockDeviceStore.audioInputDevices = [
        { deviceId: 'audio-in-1', kind: MediaDeviceKind.AudioInput, label: 'Mic 1', groupId: '' },
      ]
      mockDeviceStore.audioOutputDevices = [
        {
          deviceId: 'audio-out-1',
          kind: MediaDeviceKind.AudioOutput,
          label: 'Speaker 1',
          groupId: '',
        },
      ]
      mockDeviceStore.videoInputDevices = [
        {
          deviceId: 'video-in-1',
          kind: MediaDeviceKind.VideoInput,
          label: 'Camera 1',
          groupId: '',
        },
      ]
    })

    it('should get device by ID', () => {
      const { getDeviceById } = useMediaDevices(ref(null), { autoEnumerate: false })

      const device = getDeviceById('audio-in-1')

      expect(device).toBeDefined()
      expect(device?.deviceId).toBe('audio-in-1')
    })

    it('should return undefined for unknown device ID', () => {
      const { getDeviceById } = useMediaDevices(ref(null), { autoEnumerate: false })

      const device = getDeviceById('unknown')

      expect(device).toBeUndefined()
    })

    it('should get devices by kind - audio input', () => {
      const { getDevicesByKind } = useMediaDevices(ref(null), { autoEnumerate: false })

      const devices = getDevicesByKind(MediaDeviceKind.AudioInput)

      expect(devices.length).toBe(1)
      expect(devices[0].kind).toBe(MediaDeviceKind.AudioInput)
    })

    it('should get devices by kind - audio output', () => {
      const { getDevicesByKind } = useMediaDevices(ref(null), { autoEnumerate: false })

      const devices = getDevicesByKind(MediaDeviceKind.AudioOutput)

      expect(devices.length).toBe(1)
      expect(devices[0].kind).toBe(MediaDeviceKind.AudioOutput)
    })

    it('should get devices by kind - video input', () => {
      const { getDevicesByKind } = useMediaDevices(ref(null), { autoEnumerate: false })

      const devices = getDevicesByKind(MediaDeviceKind.VideoInput)

      expect(devices.length).toBe(1)
      expect(devices[0].kind).toBe(MediaDeviceKind.VideoInput)
    })

    it('should return empty array for invalid kind', () => {
      const { getDevicesByKind } = useMediaDevices(ref(null), { autoEnumerate: false })

      const devices = getDevicesByKind('invalid' as any)

      expect(devices.length).toBe(0)
    })
  })

  describe('Device Change Monitoring', () => {
    it('should start device change monitoring', () => {
      const { startDeviceChangeMonitoring } = useMediaDevices(ref(null), {
        autoEnumerate: false,
        autoMonitor: false,
      })

      startDeviceChangeMonitoring()

      expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      )
      expect(mockDeviceStore.setDeviceChangeListenerAttached).toHaveBeenCalled()
    })

    it('should not start monitoring if already started', () => {
      const { startDeviceChangeMonitoring } = useMediaDevices(ref(null), {
        autoEnumerate: false,
        autoMonitor: false,
      })

      startDeviceChangeMonitoring()
      startDeviceChangeMonitoring()

      // Should only be called once
      expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledTimes(1)
    })

    it('should stop device change monitoring', () => {
      const { startDeviceChangeMonitoring, stopDeviceChangeMonitoring } = useMediaDevices(
        ref(null),
        {
          autoEnumerate: false,
          autoMonitor: false,
        }
      )

      startDeviceChangeMonitoring()
      stopDeviceChangeMonitoring()

      expect(navigator.mediaDevices.removeEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      )
      expect(mockDeviceStore.setDeviceChangeListenerDetached).toHaveBeenCalled()
    })

    it('should not stop monitoring if not started', () => {
      const { stopDeviceChangeMonitoring } = useMediaDevices(ref(null), {
        autoEnumerate: false,
        autoMonitor: false,
      })

      stopDeviceChangeMonitoring()

      // Should not throw or call removeEventListener
      expect(navigator.mediaDevices.removeEventListener).not.toHaveBeenCalled()
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      mockDeviceStore.audioInputDevices = [
        { deviceId: 'audio-in-1', kind: MediaDeviceKind.AudioInput, label: 'Mic 1', groupId: '' },
      ]
      mockDeviceStore.audioOutputDevices = [
        {
          deviceId: 'audio-out-1',
          kind: MediaDeviceKind.AudioOutput,
          label: 'Speaker 1',
          groupId: '',
        },
      ]
      mockDeviceStore.videoInputDevices = [
        {
          deviceId: 'video-in-1',
          kind: MediaDeviceKind.VideoInput,
          label: 'Camera 1',
          groupId: '',
        },
      ]
      mockDeviceStore.audioPermission = 'granted'
      mockDeviceStore.videoPermission = 'denied'
    })

    it('should expose audioInputDevices', () => {
      const { audioInputDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(audioInputDevices.value.length).toBe(1)
      expect(audioInputDevices.value[0].kind).toBe(MediaDeviceKind.AudioInput)
    })

    it('should expose audioOutputDevices', () => {
      const { audioOutputDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(audioOutputDevices.value.length).toBe(1)
      expect(audioOutputDevices.value[0].kind).toBe(MediaDeviceKind.AudioOutput)
    })

    it('should expose videoInputDevices', () => {
      const { videoInputDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(videoInputDevices.value.length).toBe(1)
      expect(videoInputDevices.value[0].kind).toBe(MediaDeviceKind.VideoInput)
    })

    it('should expose allDevices', () => {
      const { allDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(allDevices.value.length).toBe(3)
    })

    it('should expose totalDevices', () => {
      const { totalDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(totalDevices.value).toBe(3)
    })

    it('should expose selectedAudioInputDevice', () => {
      const { selectAudioInput, selectedAudioInputDevice } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectAudioInput('audio-in-1')

      expect(selectedAudioInputDevice.value?.deviceId).toBe('audio-in-1')
    })

    it('should expose selectedAudioOutputDevice', () => {
      const { selectAudioOutput, selectedAudioOutputDevice } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectAudioOutput('audio-out-1')

      expect(selectedAudioOutputDevice.value?.deviceId).toBe('audio-out-1')
    })

    it('should expose selectedVideoInputDevice', () => {
      const { selectVideoInput, selectedVideoInputDevice } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      selectVideoInput('video-in-1')

      expect(selectedVideoInputDevice.value?.deviceId).toBe('video-in-1')
    })

    it('should expose audioPermission', () => {
      const { audioPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(audioPermission.value).toBe(PermissionStatus.Granted)
    })

    it('should expose videoPermission', () => {
      const { videoPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(videoPermission.value).toBe(PermissionStatus.Denied)
    })

    it('should expose hasAudioPermission', () => {
      const { hasAudioPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(hasAudioPermission.value).toBe(true)
    })

    it('should expose hasVideoPermission', () => {
      const { hasVideoPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(hasVideoPermission.value).toBe(false)
    })

    it('should expose hasAudioInputDevices', () => {
      const { hasAudioInputDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(hasAudioInputDevices.value).toBe(true)
    })

    it('should expose hasAudioOutputDevices', () => {
      const { hasAudioOutputDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(hasAudioOutputDevices.value).toBe(true)
    })

    it('should expose hasVideoInputDevices', () => {
      const { hasVideoInputDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(hasVideoInputDevices.value).toBe(true)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle missing MediaManager gracefully', async () => {
      mockEnumerateDevices.mockResolvedValue([])

      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      await expect(enumerateDevices()).resolves.not.toThrow()
    })

    it('should handle getUserMedia errors gracefully', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Device error'))

      const { requestAudioPermission } = useMediaDevices(ref(null), { autoEnumerate: false })

      const result = await requestAudioPermission()

      expect(result).toBe(false)
    })

    it('should handle empty device list', () => {
      mockDeviceStore.audioInputDevices = []
      mockDeviceStore.audioOutputDevices = []
      mockDeviceStore.videoInputDevices = []

      const {
        allDevices,
        hasAudioInputDevices,
        hasAudioOutputDevices,
        hasVideoInputDevices,
        totalDevices,
      } = useMediaDevices(ref(null), { autoEnumerate: false })

      expect(allDevices.value.length).toBe(0)
      expect(hasAudioInputDevices.value).toBe(false)
      expect(hasAudioOutputDevices.value).toBe(false)
      expect(hasVideoInputDevices.value).toBe(false)
      expect(totalDevices.value).toBe(0)
    })

    it('should handle device labels without permission', async () => {
      const mockDevices = [{ deviceId: 'audio-in-1', kind: 'audioinput', label: '', groupId: '' }]
      mockEnumerateDevices.mockResolvedValue(mockDevices)

      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      const devices = await enumerateDevices()

      // Should create a label
      expect(devices[0].label).toBeTruthy()
    })

    it('should clear error on successful enumeration', async () => {
      mockEnumerateDevices.mockRejectedValueOnce(new Error('First error'))
      mockEnumerateDevices.mockResolvedValueOnce([])

      const { enumerateDevices, lastError } = useMediaDevices(ref(null), { autoEnumerate: false })

      await expect(enumerateDevices()).rejects.toThrow()
      expect(lastError.value).not.toBeNull()

      await enumerateDevices()
      expect(lastError.value).toBeNull()
    })
  })

  describe('Concurrent Operation Protection', () => {
    it('should prevent concurrent enumerateDevices calls', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { deviceId: 'audio-in-1', kind: 'audioinput', label: 'Mic', groupId: 'group-1' },
      ])

      const { enumerateDevices, isEnumerating } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      // Start first enumeration
      const call1 = enumerateDevices()
      expect(isEnumerating.value).toBe(true)

      // Try second concurrent enumeration
      const call2 = enumerateDevices()

      // Both should complete
      const [result1, result2] = await Promise.all([call1, call2])

      // Second call should return cached results without re-enumerating
      expect(mockEnumerateDevices).toHaveBeenCalledTimes(1)
      expect(result1).toBe(result2) // Same reference
    })

    it('should set isEnumerating flag during enumeration', async () => {
      mockEnumerateDevices.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 50)
          })
      )

      const { enumerateDevices, isEnumerating } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      expect(isEnumerating.value).toBe(false)

      const promise = enumerateDevices()
      expect(isEnumerating.value).toBe(true)

      await promise
      expect(isEnumerating.value).toBe(false)
    })

    it('should reset isEnumerating flag on error', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Enumeration failed'))

      const { enumerateDevices, isEnumerating } = useMediaDevices(ref(null), {
        autoEnumerate: false,
      })

      expect(isEnumerating.value).toBe(false)

      await expect(enumerateDevices()).rejects.toThrow('Enumeration failed')
      expect(isEnumerating.value).toBe(false)
    })
  })

  describe('AbortController Integration', () => {
    it('should abort enumerateDevices when AbortSignal is triggered before enumeration', async () => {
      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      const controller = new AbortController()
      controller.abort() // Abort immediately

      await expect(enumerateDevices(controller.signal)).rejects.toThrow('AbortError')
      expect(mockEnumerateDevices).not.toHaveBeenCalled()
    })

    it('should abort enumerateDevices when AbortSignal is triggered during enumeration', async () => {
      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      const controller = new AbortController()

      // Simulate slow enumeration
      mockEnumerateDevices.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return []
      })

      // Start enumeration
      const promise = enumerateDevices(controller.signal)

      // Abort after a short delay
      setTimeout(() => controller.abort(), 10)

      await expect(promise).rejects.toThrow('AbortError')
    })

    it('should abort when using MediaManager', async () => {
      mockMediaManager.enumerateDevices = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return []
      })

      const { enumerateDevices } = useMediaDevices(ref(mockMediaManager), {
        autoEnumerate: false,
      })

      const controller = new AbortController()

      // Start enumeration with MediaManager
      const promise = enumerateDevices(controller.signal)

      // Abort after a short delay
      setTimeout(() => controller.abort(), 10)

      await expect(promise).rejects.toThrow('AbortError')
    })

    it('should work without AbortSignal (backward compatibility)', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { deviceId: 'audio-in-1', kind: 'audioinput', label: 'Mic', groupId: 'group-1' },
      ])

      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      // Call without signal parameter
      const devices = await enumerateDevices()

      expect(devices.length).toBe(1)
      expect(mockEnumerateDevices).toHaveBeenCalled()
    })

    it('should not abort on regular errors', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Device error'))

      const { enumerateDevices } = useMediaDevices(ref(null), { autoEnumerate: false })

      const controller = new AbortController()

      await expect(enumerateDevices(controller.signal)).rejects.toThrow('Device error')
      expect(mockEnumerateDevices).toHaveBeenCalled()
    })
  })
})
