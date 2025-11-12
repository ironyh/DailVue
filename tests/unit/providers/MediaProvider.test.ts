/**
 * Media Provider Unit Tests
 */

/* eslint-disable vue/one-component-per-file */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { MediaProvider, useMediaProvider } from '../../../src/providers/MediaProvider'
import { deviceStore } from '../../../src/stores/deviceStore'
import { MediaDeviceKind, PermissionStatus } from '../../../src/types/media.types'
import type { MediaDevice } from '../../../src/types/media.types'

describe('MediaProvider', () => {
  // Mock navigator.mediaDevices
  const mockEnumerateDevices = vi.fn()
  const mockGetUserMedia = vi.fn()
  const mockDeviceChangeListeners: ((event: Event) => void)[] = []

  beforeEach(() => {
    // Reset device store
    deviceStore.reset()

    // Mock navigator.mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        enumerateDevices: mockEnumerateDevices,
        getUserMedia: mockGetUserMedia,
        addEventListener: vi.fn((event: string, handler: (event: Event) => void) => {
          if (event === 'devicechange') {
            mockDeviceChangeListeners.push(handler)
          }
        }),
        removeEventListener: vi.fn((event: string, handler: (event: Event) => void) => {
          const index = mockDeviceChangeListeners.indexOf(handler)
          if (index > -1) {
            mockDeviceChangeListeners.splice(index, 1)
          }
        }),
      },
    })

    // Default mock implementations
    mockEnumerateDevices.mockResolvedValue([
      createMockDevice('audio-input-1', 'Default Microphone', 'audioinput', true),
      createMockDevice('audio-output-1', 'Default Speaker', 'audiooutput', true),
      createMockDevice('video-input-1', 'Default Camera', 'videoinput', true),
    ])

    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [
        {
          kind: 'audio',
          stop: vi.fn(),
        },
      ],
      getAudioTracks: () => [
        {
          kind: 'audio',
          stop: vi.fn(),
        },
      ],
      getVideoTracks: () => [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockDeviceChangeListeners.length = 0
  })

  // Helper to create mock device
  const createMockDevice = (
    deviceId: string,
    label: string,
    kind: MediaDeviceKind,
    isDefault: boolean = false
  ): MediaDevice => ({
    deviceId,
    label,
    kind,
    groupId: 'group-1',
    isDefault,
  })

  // Helper component that uses the provider
  const createConsumerComponent = () =>
    defineComponent({
      name: 'MediaConsumer',
      setup() {
        const media = useMediaProvider()
        return { media }
      },
      render() {
        return h('div', 'Consumer')
      },
    })

  describe('Provider Initialization', () => {
    it('should render without crashing', async () => {
      const wrapper = mount(MediaProvider, {
        props: {
          autoEnumerate: false, // Disable auto-enumeration for this test
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toBe('Child')
    })

    it('should auto-enumerate devices on mount by default', async () => {
      const readyEmitted = vi.fn()

      mount(MediaProvider, {
        slots: {
          default: () => h('div', 'Child'),
        },
        attrs: {
          onReady: readyEmitted,
        },
      })

      // Wait for ready event to be emitted after enumeration
      await vi.waitFor(() => {
        expect(readyEmitted).toHaveBeenCalled()
      })
    })

    it('should skip enumeration when autoEnumerate is false', async () => {
      mockEnumerateDevices.mockClear()

      mount(MediaProvider, {
        props: {
          autoEnumerate: false,
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await nextTick()

      expect(mockEnumerateDevices).not.toHaveBeenCalled()
    })

    it('should request permissions when autoRequestPermissions is true', async () => {
      mount(MediaProvider, {
        props: {
          autoRequestPermissions: true,
          requestAudio: true,
          requestVideo: false,
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await nextTick()

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    })

    it('should emit ready event after enumeration', async () => {
      let readyEmitted = false

      const wrapper = mount(MediaProvider, {
        props: {
          onReady: () => { readyEmitted = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await nextTick()

      expect(readyEmitted).toBe(true)
    })
  })

  describe('Device Management', () => {
    it('should provide device lists to children', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      expect(consumer.vm.media).toBeDefined()
      expect(consumer.vm.media.audioInputDevices.length).toBeGreaterThan(0)
    })

    it('should auto-select default devices when autoSelectDefaults is true', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoSelectDefaults: true,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      expect(consumer.vm.media.selectedAudioInputId).toBe('audio-input-1')
      expect(consumer.vm.media.selectedAudioOutputId).toBe('audio-output-1')
      expect(consumer.vm.media.selectedVideoInputId).toBe('video-input-1')
    })

    it('should not auto-select devices when autoSelectDefaults is false', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoSelectDefaults: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      expect(consumer.vm.media.selectedAudioInputId).toBeNull()
      expect(consumer.vm.media.selectedAudioOutputId).toBeNull()
      expect(consumer.vm.media.selectedVideoInputId).toBeNull()
    })
  })

  describe('Provider Context Methods', () => {
    it('should allow enumerating devices via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoEnumerate: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      const devices = await consumer.vm.media.enumerateDevices()

      expect(devices.length).toBe(3)
      expect(mockEnumerateDevices).toHaveBeenCalled()
    })

    it('should allow selecting audio input via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoSelectDefaults: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      consumer.vm.media.selectAudioInput('audio-input-1')

      await nextTick()

      expect(consumer.vm.media.selectedAudioInputId).toBe('audio-input-1')
    })

    it('should allow selecting audio output via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoSelectDefaults: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      consumer.vm.media.selectAudioOutput('audio-output-1')

      await nextTick()

      expect(consumer.vm.media.selectedAudioOutputId).toBe('audio-output-1')
    })

    it('should allow selecting video input via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoSelectDefaults: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      consumer.vm.media.selectVideoInput('video-input-1')

      await nextTick()

      expect(consumer.vm.media.selectedVideoInputId).toBe('video-input-1')
    })

    it('should allow requesting audio permission via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoEnumerate: false,
          autoRequestPermissions: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      const granted = await consumer.vm.media.requestAudioPermission()

      expect(granted).toBe(true)
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    })

    it('should allow requesting video permission via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoEnumerate: false,
          autoRequestPermissions: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()

      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [
          {
            kind: 'video',
            stop: vi.fn(),
          },
        ],
        getAudioTracks: () => [],
        getVideoTracks: () => [
          {
            kind: 'video',
            stop: vi.fn(),
          },
        ],
      })

      const consumer = wrapper.findComponent(ConsumerComponent)
      const granted = await consumer.vm.media.requestVideoPermission()

      expect(granted).toBe(true)
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true })
    })

    it('should allow getting device by ID via context', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      const device = consumer.vm.media.getDeviceById('audio-input-1')

      expect(device).toBeDefined()
      expect(device?.deviceId).toBe('audio-input-1')
    })
  })

  describe('Device Change Monitoring', () => {
    it('should attach device change listener when watchDeviceChanges is true', async () => {
      mount(MediaProvider, {
        props: {
          watchDeviceChanges: true,
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()

      expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      )
      expect(deviceStore.hasDeviceChangeListener()).toBe(true)
    })

    it('should not attach device change listener when watchDeviceChanges is false', async () => {
      const addEventListenerSpy = vi.spyOn(navigator.mediaDevices, 'addEventListener')

      mount(MediaProvider, {
        props: {
          watchDeviceChanges: false,
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should emit devicesChanged event when devices change', async () => {
      let devicesChanged = false

      const wrapper = mount(MediaProvider, {
        props: {
          watchDeviceChanges: true,
          onDevicesChanged: () => { devicesChanged = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await nextTick()

      // Simulate device change
      mockEnumerateDevices.mockResolvedValue([
        createMockDevice('audio-input-2', 'New Microphone', 'audioinput', false),
      ])

      // Trigger device change event
      const deviceChangeEvent = new Event('devicechange')
      mockDeviceChangeListeners.forEach((listener) => listener(deviceChangeEvent))

      await nextTick()
      await nextTick()

      expect(devicesChanged).toBe(true)
    })

    it('should remove device change listener on unmount', async () => {
      const wrapper = mount(MediaProvider, {
        props: {
          watchDeviceChanges: true,
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()

      const removeEventListenerSpy = vi.spyOn(navigator.mediaDevices, 'removeEventListener')

      wrapper.unmount()

      await nextTick()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('devicechange', expect.any(Function))
    })
  })

  describe('Event Emissions', () => {
    it('should emit permissionsGranted when permissions are granted', async () => {
      let permissionsGrantedArgs: any[] = []

      const wrapper = mount(MediaProvider, {
        props: {
          autoRequestPermissions: true,
          requestAudio: true,
          requestVideo: false,
          onPermissionsGranted: (...args: any[]) => { permissionsGrantedArgs = args }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await flushPromises()

      expect(permissionsGrantedArgs.length).toBeGreaterThan(0)
      expect(permissionsGrantedArgs).toEqual([true, false])
    })

    it('should emit permissionsDenied when permissions are denied', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

      let permissionsDenied = false

      const wrapper = mount(MediaProvider, {
        props: {
          autoRequestPermissions: true,
          requestAudio: true,
          requestVideo: false,
          onPermissionsDenied: () => { permissionsDenied = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await flushPromises()

      expect(permissionsDenied).toBe(true)
    })

    it('should emit error when initialization fails', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Enumeration failed'))

      let errorEmitted = false

      const wrapper = mount(MediaProvider, {
        props: {
          onError: () => { errorEmitted = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await flushPromises()

      expect(errorEmitted).toBe(true)
    })
  })

  describe('useMediaProvider Hook', () => {
    it('should return media context when used within provider', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)
      expect(consumer.vm.media).toBeDefined()
      expect(typeof consumer.vm.media.enumerateDevices).toBe('function')
    })

    it('should throw error when used outside provider', () => {
      const ComponentWithoutProvider = defineComponent({
        setup() {
          expect(() => useMediaProvider()).toThrow(
            'useMediaProvider must be used within a MediaProvider component'
          )
          return () => h('div', 'Test')
        },
      })

      mount(ComponentWithoutProvider)
    })
  })

  describe('Reactive State', () => {
    it('should expose reactive device lists', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)

      expect(consumer.vm.media.audioInputDevices).toBeDefined()
      expect(consumer.vm.media.audioOutputDevices).toBeDefined()
      expect(consumer.vm.media.videoInputDevices).toBeDefined()
      expect(consumer.vm.media.totalDevices).toBe(3)
    })

    it('should expose reactive permission status', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        props: {
          autoEnumerate: false,
          autoRequestPermissions: false,
        },
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)

      expect(consumer.vm.media.audioPermission).toBe(PermissionStatus.NotRequested)
      expect(consumer.vm.media.hasAudioPermission).toBe(false)
    })

    it('should update reactive state when devices change', async () => {
      const ConsumerComponent = createConsumerComponent()

      const wrapper = mount(MediaProvider, {
        slots: {
          default: () => h(ConsumerComponent),
        },
      })

      await nextTick()
      await nextTick()

      const consumer = wrapper.findComponent(ConsumerComponent)

      // Initial device count
      expect(consumer.vm.media.totalDevices).toBe(3)

      // Change mock devices
      mockEnumerateDevices.mockResolvedValue([
        createMockDevice('audio-input-1', 'Microphone 1', 'audioinput', true),
        createMockDevice('audio-input-2', 'Microphone 2', 'audioinput', false),
      ])

      // Re-enumerate
      await consumer.vm.media.enumerateDevices()

      await nextTick()

      // Device count should update
      expect(consumer.vm.media.totalDevices).toBe(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle no available devices gracefully', async () => {
      mockEnumerateDevices.mockResolvedValue([])

      let readyEmitted = false

      const wrapper = mount(MediaProvider, {
        props: {
          onReady: () => { readyEmitted = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await nextTick()

      expect(readyEmitted).toBe(true)
    })

    it('should handle enumeration errors gracefully', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Device enumeration failed'))

      let errorEmitted = false

      const wrapper = mount(MediaProvider, {
        props: {
          onError: () => { errorEmitted = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await flushPromises()

      expect(errorEmitted).toBe(true)
    })

    it('should handle permission request errors gracefully', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied by user'))

      let permissionsDenied = false

      const wrapper = mount(MediaProvider, {
        props: {
          autoRequestPermissions: true,
          onPermissionsDenied: () => { permissionsDenied = true }
        },
        slots: {
          default: () => h('div', 'Child'),
        },
      })

      await nextTick()
      await nextTick()

      expect(permissionsDenied).toBe(true)
    })
  })
})
