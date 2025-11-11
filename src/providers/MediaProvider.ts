/**
 * Media Provider Component
 *
 * Vue component that provides media device management to its children
 * using Vue's provide/inject pattern.
 *
 * @module providers/MediaProvider
 *
 * @example
 * ```vue
 * <template>
 *   <MediaProvider :auto-enumerate="true" @ready="onDevicesReady">
 *     <YourApp />
 *   </MediaProvider>
 * </template>
 *
 * <script setup>
 * import { MediaProvider } from 'vuesip'
 *
 * const onDevicesReady = () => {
 *   console.log('Devices enumerated and ready!')
 * }
 * </script>
 * ```
 */

import { defineComponent, provide, watch, onMounted, onUnmounted, type PropType } from 'vue'
import { useMediaDevices, type DeviceTestOptions } from '../composables/useMediaDevices'
import { deviceStore } from '../stores/deviceStore'
import { createLogger } from '../utils/logger'
import type { MediaConfiguration } from '../types/config.types'
import type { MediaDevice } from '../types/media.types'
import type { MediaProviderContext } from '../types/provider.types'
import { MEDIA_PROVIDER_KEY } from '../types/provider.types'

const logger = createLogger('MediaProvider')

/**
 * MediaProvider Component
 *
 * Provides media device management functionality to all child components
 * through Vue's provide/inject API.
 */
export const MediaProvider = defineComponent({
  name: 'MediaProvider',

  props: {
    /**
     * Initial media configuration
     */
    mediaConfig: {
      type: Object as PropType<MediaConfiguration>,
      default: undefined,
    },

    /**
     * Whether to automatically enumerate devices on mount
     * @default true
     */
    autoEnumerate: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically request permissions on mount
     * @default false
     */
    autoRequestPermissions: {
      type: Boolean,
      default: false,
    },

    /**
     * Request audio permission on mount (only if autoRequestPermissions is true)
     * @default true
     */
    requestAudio: {
      type: Boolean,
      default: true,
    },

    /**
     * Request video permission on mount (only if autoRequestPermissions is true)
     * @default false
     */
    requestVideo: {
      type: Boolean,
      default: false,
    },

    /**
     * Whether to automatically monitor device changes
     * @default true
     */
    watchDeviceChanges: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically select default devices after enumeration
     * @default true
     */
    autoSelectDefaults: {
      type: Boolean,
      default: true,
    },
  },

  emits: {
    /**
     * Emitted when devices have been enumerated and are ready
     */
    ready: () => true,

    /**
     * Emitted when device list changes
     */
    devicesChanged: (_devices: MediaDevice[]) => true,

    /**
     * Emitted when permissions are granted
     */
    permissionsGranted: (_audio: boolean, _video: boolean) => true,

    /**
     * Emitted when permissions are denied
     */
    permissionsDenied: (_audio: boolean, _video: boolean) => true,

    /**
     * Emitted when an error occurs
     */
    error: (_error: Error) => true,
  },

  setup(props, { slots, emit }) {
    logger.info('MediaProvider initializing')

    // ============================================================================
    // Media Devices Composable
    // ============================================================================

    // Disable auto-enumeration and auto-monitoring in composable
    // MediaProvider controls these explicitly via initialize() and watchDeviceChanges prop
    const mediaDevices = useMediaDevices(undefined, { autoEnumerate: false, autoMonitor: false })

    // ============================================================================
    // Initialization
    // ============================================================================

    /**
     * Initialize media devices
     */
    const initialize = async () => {
      logger.debug('Initializing media provider')

      try {
        // Request permissions if needed
        if (props.autoRequestPermissions) {
          logger.debug('Requesting permissions', {
            audio: props.requestAudio,
            video: props.requestVideo,
          })

          try {
            await mediaDevices.requestPermissions(props.requestAudio, props.requestVideo)

            emit('permissionsGranted', props.requestAudio, props.requestVideo)
            logger.info('Permissions granted', {
              audio: props.requestAudio,
              video: props.requestVideo,
            })
          } catch (error) {
            logger.warn('Permission request failed', error)
            emit('permissionsDenied', props.requestAudio, props.requestVideo)
          }
        }

        // Enumerate devices if requested
        if (props.autoEnumerate) {
          logger.debug('Enumerating devices')

          const devices = await mediaDevices.enumerateDevices()
          logger.info('Devices enumerated', { count: devices.length })

          // Auto-select defaults if requested
          if (props.autoSelectDefaults && devices.length > 0) {
            logger.debug('Auto-selecting default devices')
            autoSelectDefaultDevices()
          }

          emit('ready')
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.error('Media provider initialization failed', err)
        emit('error', err)
      }
    }

    /**
     * Auto-select default devices
     */
    const autoSelectDefaultDevices = () => {
      // Select default audio input if available and none selected
      if (
        !mediaDevices.selectedAudioInputId.value &&
        mediaDevices.audioInputDevices.value.length > 0
      ) {
        const defaultDevice =
          mediaDevices.audioInputDevices.value.find((d) => d.isDefault) ||
          mediaDevices.audioInputDevices.value[0]
        if (defaultDevice) {
          logger.debug('Auto-selecting default audio input', { deviceId: defaultDevice.deviceId })
          mediaDevices.selectAudioInput(defaultDevice.deviceId)
        }
      }

      // Select default audio output if available and none selected
      if (
        !mediaDevices.selectedAudioOutputId.value &&
        mediaDevices.audioOutputDevices.value.length > 0
      ) {
        const defaultDevice =
          mediaDevices.audioOutputDevices.value.find((d) => d.isDefault) ||
          mediaDevices.audioOutputDevices.value[0]
        if (defaultDevice) {
          logger.debug('Auto-selecting default audio output', { deviceId: defaultDevice.deviceId })
          mediaDevices.selectAudioOutput(defaultDevice.deviceId)
        }
      }

      // Select default video input if available and none selected
      if (
        !mediaDevices.selectedVideoInputId.value &&
        mediaDevices.videoInputDevices.value.length > 0
      ) {
        const defaultDevice =
          mediaDevices.videoInputDevices.value.find((d) => d.isDefault) ||
          mediaDevices.videoInputDevices.value[0]
        if (defaultDevice) {
          logger.debug('Auto-selecting default video input', { deviceId: defaultDevice.deviceId })
          mediaDevices.selectVideoInput(defaultDevice.deviceId)
        }
      }
    }

    // ============================================================================
    // Device Change Monitoring
    // ============================================================================

    /**
     * Device change handler
     */
    const handleDeviceChange = async () => {
      logger.debug('Device change detected')

      try {
        const devices = await mediaDevices.enumerateDevices()
        logger.info('Devices re-enumerated after change', { count: devices.length })

        emit('devicesChanged', devices)

        // Re-select defaults if needed
        if (props.autoSelectDefaults) {
          autoSelectDefaultDevices()
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.error('Device change handling failed', err)
        emit('error', err)
      }
    }

    // Setup device change listener if requested
    if (props.watchDeviceChanges && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
      deviceStore.setDeviceChangeListenerAttached()
      logger.debug('Device change listener attached')
    }

    // ============================================================================
    // Lifecycle
    // ============================================================================

    onMounted(() => {
      logger.debug('MediaProvider mounted')
      initialize()
    })

    onUnmounted(() => {
      logger.debug('MediaProvider unmounting')

      // Remove device change listener
      if (props.watchDeviceChanges && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
        deviceStore.setDeviceChangeListenerDetached()
        logger.debug('Device change listener removed')
      }
    })

    // ============================================================================
    // Watch for media config changes
    // ============================================================================

    watch(
      () => props.mediaConfig,
      (newConfig) => {
        if (newConfig) {
          logger.debug('Media config prop changed', newConfig)
          // Media config changes can be handled by child components
          // that inject the provider context
        }
      },
      { deep: true }
    )

    // ============================================================================
    // Provider Context
    // ============================================================================

    /**
     * Media provider context
     * This is what child components will receive via inject
     */
    const providerContext: MediaProviderContext = {
      // Readonly state - devices
      get audioInputDevices() {
        return mediaDevices.audioInputDevices.value
      },
      get audioOutputDevices() {
        return mediaDevices.audioOutputDevices.value
      },
      get videoInputDevices() {
        return mediaDevices.videoInputDevices.value
      },
      get allDevices() {
        return mediaDevices.allDevices.value
      },

      // Readonly state - selected devices
      get selectedAudioInputId() {
        return mediaDevices.selectedAudioInputId.value
      },
      get selectedAudioOutputId() {
        return mediaDevices.selectedAudioOutputId.value
      },
      get selectedVideoInputId() {
        return mediaDevices.selectedVideoInputId.value
      },
      get selectedAudioInputDevice() {
        return mediaDevices.selectedAudioInputDevice.value
      },
      get selectedAudioOutputDevice() {
        return mediaDevices.selectedAudioOutputDevice.value
      },
      get selectedVideoInputDevice() {
        return mediaDevices.selectedVideoInputDevice.value
      },

      // Readonly state - permissions
      get audioPermission() {
        return mediaDevices.audioPermission.value
      },
      get videoPermission() {
        return mediaDevices.videoPermission.value
      },
      get hasAudioPermission() {
        return mediaDevices.hasAudioPermission.value
      },
      get hasVideoPermission() {
        return mediaDevices.hasVideoPermission.value
      },

      // Readonly state - counts
      get hasAudioInputDevices() {
        return mediaDevices.hasAudioInputDevices.value
      },
      get hasAudioOutputDevices() {
        return mediaDevices.hasAudioOutputDevices.value
      },
      get hasVideoInputDevices() {
        return mediaDevices.hasVideoInputDevices.value
      },
      get totalDevices() {
        return mediaDevices.totalDevices.value
      },

      // Readonly state - operation status
      get isEnumerating() {
        return mediaDevices.isEnumerating.value
      },
      get lastError() {
        return mediaDevices.lastError.value
      },

      // Methods - device management
      enumerateDevices: () => {
        logger.debug('enumerateDevices called via provider context')
        return mediaDevices.enumerateDevices()
      },

      getDeviceById: (deviceId: string) => {
        return mediaDevices.getDeviceById(deviceId)
      },

      // Methods - device selection
      selectAudioInput: (deviceId: string) => {
        logger.debug('selectAudioInput called via provider context', { deviceId })
        mediaDevices.selectAudioInput(deviceId)
      },

      selectAudioOutput: (deviceId: string) => {
        logger.debug('selectAudioOutput called via provider context', { deviceId })
        mediaDevices.selectAudioOutput(deviceId)
      },

      selectVideoInput: (deviceId: string) => {
        logger.debug('selectVideoInput called via provider context', { deviceId })
        mediaDevices.selectVideoInput(deviceId)
      },

      // Methods - permissions
      requestAudioPermission: () => {
        logger.debug('requestAudioPermission called via provider context')
        return mediaDevices.requestAudioPermission()
      },

      requestVideoPermission: () => {
        logger.debug('requestVideoPermission called via provider context')
        return mediaDevices.requestVideoPermission()
      },

      requestPermissions: (audio?: boolean, video?: boolean) => {
        logger.debug('requestPermissions called via provider context', { audio, video })
        return mediaDevices.requestPermissions(audio, video)
      },

      // Methods - device testing
      testAudioInput: (deviceId?: string, options?: DeviceTestOptions) => {
        logger.debug('testAudioInput called via provider context', { deviceId })
        return mediaDevices.testAudioInput(deviceId, options)
      },

      testAudioOutput: (deviceId?: string) => {
        logger.debug('testAudioOutput called via provider context', { deviceId })
        return mediaDevices.testAudioOutput(deviceId)
      },
    }

    // Provide context to children
    provide(MEDIA_PROVIDER_KEY, providerContext)

    logger.info('MediaProvider initialized successfully')

    // ============================================================================
    // Render
    // ============================================================================

    return () => {
      // Render default slot content
      return slots.default?.()
    }
  },
})

/**
 * Type-safe inject helper for MediaProvider
 *
 * @throws {Error} If used outside of MediaProvider
 *
 * @example
 * ```ts
 * import { useMediaProvider } from 'vuesip'
 *
 * const media = useMediaProvider()
 * console.log(media.audioInputDevices)
 * ```
 */
export function useMediaProvider(): MediaProviderContext {
  const context = inject(MEDIA_PROVIDER_KEY)

  if (!context) {
    const error = 'useMediaProvider must be used within a MediaProvider component'
    logger.error(error)
    throw new Error(error)
  }

  return context
}

// Named export for convenience
export { MEDIA_PROVIDER_KEY }

// Import inject after the component definition
import { inject } from 'vue'
