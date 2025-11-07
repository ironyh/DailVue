/**
 * Media Provider Component
 *
 * Vue component that provides comprehensive media device management to its children
 * using Vue's provide/inject pattern. Handles device enumeration, permission requests,
 * device selection, and automatic device change monitoring.
 *
 * @module providers/MediaProvider
 *
 * @remarks
 * The MediaProvider manages the complete lifecycle of media devices in your application:
 *
 * **Device Management Lifecycle:**
 * 1. Initial enumeration (automatic or manual based on `autoEnumerate` prop)
 * 2. Permission requests (automatic if `autoRequestPermissions` is true)
 * 3. Default device selection (automatic if `autoSelectDefaults` is true)
 * 4. Device change monitoring (automatic if `watchDeviceChanges` is true)
 * 5. Re-enumeration and re-selection on device changes
 *
 * **Permission Handling:**
 * - Without permissions: Device IDs and labels are unavailable (browser limitation)
 * - With permissions: Full device information including labels and capabilities
 * - Auto-request: Set `autoRequestPermissions` to request permissions on mount
 * - Manual request: Use injected methods to request permissions when needed
 *
 * **Auto-Selection Logic:**
 * When `autoSelectDefaults` is enabled, the provider automatically selects:
 * 1. System default device (if marked as default)
 * 2. First available device (if no default is marked)
 * 3. Re-selects on device changes if current device is no longer available
 *
 * @example
 * **Basic usage with auto-enumeration:**
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
 *
 * @example
 * **Manual permission requests and device selection:**
 * ```vue
 * <template>
 *   <MediaProvider :auto-enumerate="false" :auto-request-permissions="false">
 *     <DeviceSettings />
 *   </MediaProvider>
 * </template>
 *
 * <script setup>
 * import { MediaProvider, useMediaProvider } from 'vuesip'
 *
 * // In child component (DeviceSettings.vue)
 * const media = useMediaProvider()
 *
 * const requestDeviceAccess = async () => {
 *   try {
 *     // Request both audio and video permissions
 *     await media.requestPermissions(true, true)
 *
 *     // Enumerate devices after permission granted
 *     const devices = await media.enumerateDevices()
 *     console.log(`Found ${devices.length} devices`)
 *
 *     // Manually select specific device
 *     if (media.audioInputDevices.length > 0) {
 *       media.selectAudioInput(media.audioInputDevices[0].deviceId)
 *     }
 *   } catch (error) {
 *     console.error('Permission denied or error:', error)
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Handling device changes:**
 * ```vue
 * <template>
 *   <MediaProvider
 *     :watch-device-changes="true"
 *     @devices-changed="onDevicesChanged"
 *     @error="onError"
 *   >
 *     <CallInterface />
 *   </MediaProvider>
 * </template>
 *
 * <script setup>
 * import { MediaProvider } from 'vuesip'
 *
 * const onDevicesChanged = (devices) => {
 *   console.log('Device list updated:', devices)
 *   // Update UI to reflect new device list
 *   // MediaProvider automatically re-selects defaults if enabled
 * }
 *
 * const onError = (error) => {
 *   console.error('Media error:', error)
 *   // Show error notification to user
 * }
 * </script>
 * ```
 *
 * @example
 * **Testing devices before making a call:**
 * ```vue
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * const media = useMediaProvider()
 * const testResult = ref(null)
 *
 * const testMicrophone = async () => {
 *   try {
 *     const result = await media.testAudioInput(
 *       media.selectedAudioInputId,
 *       { duration: 3000 }
 *     )
 *
 *     testResult.value = result
 *     console.log('Microphone test:', {
 *       hasAudio: result.hasAudio,
 *       averageVolume: result.averageVolume,
 *       peakVolume: result.peakVolume
 *     })
 *   } catch (error) {
 *     console.error('Microphone test failed:', error)
 *   }
 * }
 *
 * const testSpeakers = async () => {
 *   try {
 *     await media.testAudioOutput(media.selectedAudioOutputId)
 *     console.log('Playing test tone through selected speakers')
 *   } catch (error) {
 *     console.error('Speaker test failed:', error)
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Error handling with permission denials:**
 * ```vue
 * <template>
 *   <MediaProvider
 *     :auto-request-permissions="true"
 *     :request-audio="true"
 *     :request-video="true"
 *     @permissions-granted="onPermissionsGranted"
 *     @permissions-denied="onPermissionsDenied"
 *     @error="onError"
 *   >
 *     <YourApp />
 *   </MediaProvider>
 * </template>
 *
 * <script setup>
 * import { MediaProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * const permissionStatus = ref('pending')
 *
 * const onPermissionsGranted = (audio, video) => {
 *   permissionStatus.value = 'granted'
 *   console.log(`Permissions granted - Audio: ${audio}, Video: ${video}`)
 * }
 *
 * const onPermissionsDenied = (audio, video) => {
 *   permissionStatus.value = 'denied'
 *   console.warn(`Permissions denied - Audio: ${audio}, Video: ${video}`)
 *   // Show UI guidance to manually grant permissions in browser settings
 * }
 *
 * const onError = (error) => {
 *   console.error('Media provider error:', error)
 *   // Handle NotAllowedError, NotFoundError, etc.
 * }
 * </script>
 * ```
 *
 * @example
 * **Advanced: Combining with ConfigProvider:**
 * ```vue
 * <template>
 *   <ConfigProvider :media-config="mediaConfig">
 *     <MediaProvider
 *       :media-config="mediaConfig"
 *       :auto-enumerate="true"
 *       :auto-select-defaults="true"
 *     >
 *       <SipClientProvider :config="sipConfig">
 *         <CallInterface />
 *       </SipClientProvider>
 *     </MediaProvider>
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider, MediaProvider, SipClientProvider } from 'vuesip'
 *
 * const mediaConfig = {
 *   audio: {
 *     echoCancellation: true,
 *     noiseSuppression: true,
 *     autoGainControl: true
 *   },
 *   video: {
 *     width: { ideal: 1280 },
 *     height: { ideal: 720 }
 *   }
 * }
 *
 * const sipConfig = {
 *   uri: 'wss://sip.example.com',
 *   sipUri: 'sip:user@example.com',
 *   password: 'secret'
 * }
 * </script>
 * ```
 *
 * @see {@link useMediaProvider} For injecting media context in child components
 * @see {@link useMediaDevices} For the underlying composable used by this provider
 * @see {@link ConfigProvider} For managing media configuration
 * @see {@link SipClientProvider} For SIP functionality with media integration
 *
 * @packageDocumentation
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
 * through Vue's provide/inject API. Automatically handles device lifecycle,
 * permissions, and change monitoring based on configuration props.
 *
 * @remarks
 * This component serves as a centralized media device manager for your application.
 * It wraps the `useMediaDevices` composable and exposes its functionality through
 * Vue's provide/inject system, making it available to all child components.
 *
 * **Key Features:**
 * - Automatic device enumeration on mount
 * - Optional automatic permission requests
 * - Device change monitoring and re-enumeration
 * - Automatic default device selection
 * - Reactive device lists and state
 * - Device testing capabilities
 *
 * @example
 * ```vue
 * <template>
 *   <MediaProvider :auto-enumerate="true">
 *     <!-- Child components can use useMediaProvider() -->
 *     <DeviceList />
 *   </MediaProvider>
 * </template>
 * ```
 */
export const MediaProvider = defineComponent({
  name: 'MediaProvider',

  props: {
    /**
     * Initial media configuration for audio/video constraints
     *
     * @remarks
     * Defines audio and video constraints to use when acquiring media streams.
     * This configuration can be used by child components when requesting
     * user media streams.
     *
     * @example
     * ```js
     * {
     *   audio: {
     *     echoCancellation: true,
     *     noiseSuppression: true,
     *     autoGainControl: true
     *   },
     *   video: {
     *     width: { ideal: 1280 },
     *     height: { ideal: 720 }
     *   }
     * }
     * ```
     */
    mediaConfig: {
      type: Object as PropType<MediaConfiguration>,
      default: undefined,
    },

    /**
     * Whether to automatically enumerate devices on mount
     *
     * @default true
     *
     * @remarks
     * When enabled, devices will be enumerated immediately after the component mounts.
     * Without permissions, device labels may not be available (browser security).
     * Consider enabling `autoRequestPermissions` if you need device labels immediately.
     *
     * Set to `false` if you want to control enumeration timing manually via
     * the injected `enumerateDevices()` method.
     */
    autoEnumerate: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically request permissions on mount
     *
     * @default false
     *
     * @remarks
     * When enabled, the provider will request media permissions immediately on mount.
     * Use in combination with `requestAudio` and `requestVideo` to specify which
     * permissions to request.
     *
     * **Important:** Automatic permission requests should only be used in contexts
     * where the user expects it (e.g., after clicking a "Start Call" button).
     * Unexpected permission prompts can negatively impact user experience.
     *
     * For better UX, consider manual permission requests triggered by user actions.
     */
    autoRequestPermissions: {
      type: Boolean,
      default: false,
    },

    /**
     * Request audio permission on mount (only if autoRequestPermissions is true)
     *
     * @default true
     *
     * @remarks
     * Only takes effect when `autoRequestPermissions` is enabled.
     * Requests microphone access from the browser.
     */
    requestAudio: {
      type: Boolean,
      default: true,
    },

    /**
     * Request video permission on mount (only if autoRequestPermissions is true)
     *
     * @default false
     *
     * @remarks
     * Only takes effect when `autoRequestPermissions` is enabled.
     * Requests camera access from the browser.
     *
     * Note: Requesting video permission typically also grants audio permission
     * in most browsers.
     */
    requestVideo: {
      type: Boolean,
      default: false,
    },

    /**
     * Whether to automatically monitor device changes
     *
     * @default true
     *
     * @remarks
     * When enabled, listens to the browser's `devicechange` event and automatically
     * re-enumerates devices when changes are detected (e.g., headphones plugged in,
     * USB microphone connected/disconnected).
     *
     * The provider emits a `devicesChanged` event when changes occur, allowing
     * you to update your UI accordingly.
     *
     * If `autoSelectDefaults` is also enabled, the provider will attempt to
     * re-select appropriate devices after changes.
     */
    watchDeviceChanges: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically select default devices after enumeration
     *
     * @default true
     *
     * @remarks
     * When enabled, automatically selects default devices using this priority:
     * 1. System default device (if available and marked as default)
     * 2. First available device in the list
     *
     * This applies to:
     * - Audio input devices (microphones)
     * - Audio output devices (speakers/headphones)
     * - Video input devices (cameras)
     *
     * Only selects a device if none is currently selected. Won't override
     * user selections.
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

    const mediaDevices = useMediaDevices()

    // ============================================================================
    // Initialization
    // ============================================================================

    /**
     * Initialize media devices with permissions and enumeration
     *
     * @remarks
     * This function orchestrates the complete initialization flow:
     * 1. Request permissions if `autoRequestPermissions` is enabled
     * 2. Enumerate devices if `autoEnumerate` is enabled
     * 3. Auto-select default devices if `autoSelectDefaults` is enabled
     * 4. Emit appropriate events based on success/failure
     *
     * Called automatically on component mount, but can also be invoked manually
     * if needed for re-initialization scenarios.
     *
     * **Permission Request Behavior:**
     * - Success: Emits `permissionsGranted` and continues with enumeration
     * - Failure: Emits `permissionsDenied` but continues (devices will have limited info)
     *
     * **Enumeration Behavior:**
     * - Without permissions: Device IDs available but labels may be blank
     * - With permissions: Full device information including labels
     * - Emits `ready` event when complete
     *
     * @throws {Error} If enumeration fails (emits 'error' event)
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
            // Note: We continue with enumeration even if permissions denied
            // This allows showing device list (with limited info) to the user
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
     * Auto-select default devices based on system preferences or availability
     *
     * @remarks
     * Implements smart default device selection with the following logic:
     *
     * **Selection Priority:**
     * 1. System-marked default device (device.isDefault === true)
     * 2. First available device in the enumerated list
     *
     * **Selection Rules:**
     * - Only selects if no device is currently selected (preserves user choices)
     * - Checks availability before selection
     * - Applies to all three device categories: audio input, audio output, video input
     * - Logs selection decisions for debugging
     *
     * **Use Cases:**
     * - Initial app load: Automatically picks reasonable defaults
     * - Device changes: Re-selects if current device is removed
     * - Post-permission: Updates selections with proper device labels
     *
     * This function is called:
     * - After successful device enumeration (if `autoSelectDefaults` is true)
     * - After device change events (if `autoSelectDefaults` is true)
     * - Never overrides existing user selections
     *
     * @see {@link initialize} For when this is called during initialization
     * @see {@link handleDeviceChange} For when this is called on device changes
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
     * Handle device change events from the browser
     *
     * @remarks
     * This handler is called automatically when the browser detects device changes,
     * such as:
     * - USB devices being connected or disconnected
     * - Bluetooth devices pairing or disconnecting
     * - Headphones being plugged in or unplugged
     * - System default device changes
     * - Device availability changes (e.g., camera in use by another app)
     *
     * **Behavior:**
     * 1. Re-enumerates all devices to get updated list
     * 2. Emits `devicesChanged` event with new device list
     * 3. Attempts to re-select defaults if `autoSelectDefaults` is enabled
     * 4. Emits `error` event if re-enumeration fails
     *
     * **Smart Re-selection:**
     * - If the currently selected device is still available, keeps it selected
     * - If the currently selected device is removed, selects a new default
     * - Preserves user's device selections when possible
     *
     * This ensures the application stays in sync with the system's actual
     * device state and handles hot-plugging gracefully.
     *
     * @throws {Error} If device re-enumeration fails (emits 'error' event)
     *
     * @see {@link autoSelectDefaultDevices} For the re-selection logic
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event
     */
    const handleDeviceChange = async () => {
      logger.debug('Device change detected')

      try {
        const devices = await mediaDevices.enumerateDevices()
        logger.info('Devices re-enumerated after change', { count: devices.length })

        emit('devicesChanged', devices)

        // Re-select defaults if needed
        // Note: This won't override existing selections unless the selected device is no longer available
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
    // This listens to the browser's native devicechange event to detect when
    // devices are connected, disconnected, or changed. Only one listener is
    // attached per MediaProvider instance to avoid duplicate event handling.
    if (props.watchDeviceChanges && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
      deviceStore.setDeviceChangeListenerAttached()
      logger.debug('Device change listener attached')
    }

    // ============================================================================
    // Lifecycle
    // ============================================================================

    /**
     * Component mounted lifecycle hook
     *
     * Triggers the initialization flow which handles:
     * - Permission requests (if autoRequestPermissions is enabled)
     * - Device enumeration (if autoEnumerate is enabled)
     * - Default device selection (if autoSelectDefaults is enabled)
     */
    onMounted(() => {
      logger.debug('MediaProvider mounted')
      initialize()
    })

    /**
     * Component unmount lifecycle hook
     *
     * Performs cleanup to prevent memory leaks:
     * - Removes devicechange event listener from browser API
     * - Updates device store to reflect listener removal
     *
     * Note: We don't need to stop any active media streams here because
     * those are managed by individual components using the streams.
     */
    onUnmounted(() => {
      logger.debug('MediaProvider unmounting')

      // Remove device change listener to prevent memory leaks
      if (props.watchDeviceChanges && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
        deviceStore.setDeviceChangeListenerDetached()
        logger.debug('Device change listener removed')
      }
    })

    // ============================================================================
    // Watch for media config changes
    // ============================================================================

    /**
     * Watch for media configuration changes
     *
     * @remarks
     * When the `mediaConfig` prop changes, this watcher logs the change.
     * The actual media configuration is not used directly by the provider,
     * but is made available to child components through the provider context.
     *
     * Child components can watch this configuration and apply it when
     * acquiring media streams via getUserMedia().
     *
     * The deep watch ensures nested property changes are detected.
     */
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
     * Media provider context injected to child components
     *
     * @remarks
     * This object is provided to all child components via Vue's provide/inject API.
     * Child components access it using the `useMediaProvider()` composable.
     *
     * **Available State (Reactive):**
     *
     * *Device Lists:*
     * - `audioInputDevices` - Array of microphone devices
     * - `audioOutputDevices` - Array of speaker/headphone devices
     * - `videoInputDevices` - Array of camera devices
     * - `allDevices` - Combined array of all devices
     *
     * *Selected Devices:*
     * - `selectedAudioInputId` - Current microphone device ID
     * - `selectedAudioOutputId` - Current speaker device ID
     * - `selectedVideoInputId` - Current camera device ID
     * - `selectedAudioInputDevice` - Full microphone device object
     * - `selectedAudioOutputDevice` - Full speaker device object
     * - `selectedVideoInputDevice` - Full camera device object
     *
     * *Permissions:*
     * - `audioPermission` - Audio permission state ('granted' | 'denied' | 'prompt')
     * - `videoPermission` - Video permission state ('granted' | 'denied' | 'prompt')
     * - `hasAudioPermission` - Boolean for audio permission granted
     * - `hasVideoPermission` - Boolean for video permission granted
     *
     * *Device Availability:*
     * - `hasAudioInputDevices` - Boolean for microphone availability
     * - `hasAudioOutputDevices` - Boolean for speaker availability
     * - `hasVideoInputDevices` - Boolean for camera availability
     * - `totalDevices` - Total count of all devices
     *
     * *Operation Status:*
     * - `isEnumerating` - Boolean indicating enumeration in progress
     * - `lastError` - Last error that occurred (null if none)
     *
     * **Available Methods:**
     *
     * *Device Management:*
     * - `enumerateDevices()` - Manually enumerate devices
     * - `getDeviceById(deviceId)` - Get specific device by ID
     *
     * *Device Selection:*
     * - `selectAudioInput(deviceId)` - Select microphone
     * - `selectAudioOutput(deviceId)` - Select speaker
     * - `selectVideoInput(deviceId)` - Select camera
     *
     * *Permission Management:*
     * - `requestAudioPermission()` - Request microphone access
     * - `requestVideoPermission()` - Request camera access
     * - `requestPermissions(audio?, video?)` - Request both permissions
     *
     * *Device Testing:*
     * - `testAudioInput(deviceId?, options?)` - Test microphone with volume analysis
     * - `testAudioOutput(deviceId?)` - Test speaker with tone playback
     *
     * @example
     * ```vue
     * <script setup>
     * import { useMediaProvider } from 'vuesip'
     * import { watchEffect } from 'vue'
     *
     * const media = useMediaProvider()
     *
     * // React to device list changes
     * watchEffect(() => {
     *   console.log('Available microphones:', media.audioInputDevices)
     *   console.log('Selected microphone:', media.selectedAudioInputDevice)
     *   console.log('Has audio permission:', media.hasAudioPermission)
     * })
     *
     * // Select a device
     * const selectDevice = (deviceId: string) => {
     *   media.selectAudioInput(deviceId)
     * }
     *
     * // Request permissions
     * const requestAccess = async () => {
     *   try {
     *     await media.requestPermissions(true, false) // audio only
     *     await media.enumerateDevices()
     *   } catch (error) {
     *     console.error('Access denied:', error)
     *   }
     * }
     *
     * // Test microphone
     * const testMic = async () => {
     *   const result = await media.testAudioInput()
     *   if (result.hasAudio) {
     *     console.log('Microphone working! Volume:', result.averageVolume)
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link MediaProviderContext} For the complete type definition
     * @see {@link useMediaProvider} For the inject helper function
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
 * Type-safe inject helper for MediaProvider context
 *
 * @remarks
 * Use this composable in any child component of MediaProvider to access
 * device management functionality. All returned state is reactive and will
 * update automatically when devices change.
 *
 * **Common Use Cases:**
 *
 * 1. **Building device selection UI:**
 *    Display lists of available devices and allow users to select preferred devices
 *
 * 2. **Checking permissions:**
 *    Determine if media permissions are granted before attempting to use devices
 *
 * 3. **Testing devices:**
 *    Let users test their microphone and speakers before joining a call
 *
 * 4. **Responding to device changes:**
 *    Update UI when devices are plugged/unplugged or availability changes
 *
 * 5. **Manual device control:**
 *    Programmatically select devices based on user preferences or app logic
 *
 * **Important Notes:**
 * - Must be called inside a component that is a child of `<MediaProvider>`
 * - All state is reactive - use with Vue's reactivity system (watch, computed, etc.)
 * - Device IDs are persistent across sessions (stored in browser)
 * - Device labels require permissions to be readable
 *
 * @returns {MediaProviderContext} The complete media provider context with state and methods
 *
 * @throws {Error} If called outside of a MediaProvider component tree
 *
 * @example
 * **Basic device list display:**
 * ```vue
 * <template>
 *   <div>
 *     <h3>Microphones</h3>
 *     <select v-model="selectedMic" @change="changeMicrophone">
 *       <option
 *         v-for="device in media.audioInputDevices"
 *         :key="device.deviceId"
 *         :value="device.deviceId"
 *       >
 *         {{ device.label || 'Unknown Device' }}
 *       </option>
 *     </select>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * const media = useMediaProvider()
 * const selectedMic = ref(media.selectedAudioInputId)
 *
 * const changeMicrophone = () => {
 *   media.selectAudioInput(selectedMic.value)
 * }
 * </script>
 * ```
 *
 * @example
 * **Permission handling:**
 * ```vue
 * <template>
 *   <div>
 *     <div v-if="!media.hasAudioPermission">
 *       <p>Microphone access required</p>
 *       <button @click="requestPermission">Grant Permission</button>
 *     </div>
 *     <div v-else>
 *       <p>Microphone access granted!</p>
 *       <p>Available devices: {{ media.audioInputDevices.length }}</p>
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 *
 * const media = useMediaProvider()
 *
 * const requestPermission = async () => {
 *   try {
 *     await media.requestAudioPermission()
 *     await media.enumerateDevices()
 *     console.log('Permission granted!')
 *   } catch (error) {
 *     console.error('Permission denied:', error)
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Device testing:**
 * ```vue
 * <template>
 *   <div>
 *     <button @click="testMicrophone" :disabled="testing">
 *       {{ testing ? 'Testing...' : 'Test Microphone' }}
 *     </button>
 *     <div v-if="testResult">
 *       <p>Audio detected: {{ testResult.hasAudio ? 'Yes' : 'No' }}</p>
 *       <p v-if="testResult.hasAudio">
 *         Volume: {{ Math.round(testResult.averageVolume * 100) }}%
 *       </p>
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * const media = useMediaProvider()
 * const testing = ref(false)
 * const testResult = ref(null)
 *
 * const testMicrophone = async () => {
 *   testing.value = true
 *   try {
 *     testResult.value = await media.testAudioInput(
 *       media.selectedAudioInputId,
 *       { duration: 3000 }
 *     )
 *   } catch (error) {
 *     console.error('Test failed:', error)
 *   } finally {
 *     testing.value = false
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Reacting to device changes:**
 * ```vue
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { watch } from 'vue'
 *
 * const media = useMediaProvider()
 *
 * // Watch for device list changes
 * watch(
 *   () => media.audioInputDevices,
 *   (newDevices, oldDevices) => {
 *     console.log('Devices changed:', {
 *       before: oldDevices?.length,
 *       after: newDevices?.length
 *     })
 *
 *     // Check if currently selected device is still available
 *     const currentStillAvailable = newDevices.some(
 *       d => d.deviceId === media.selectedAudioInputId
 *     )
 *
 *     if (!currentStillAvailable && newDevices.length > 0) {
 *       console.warn('Current device removed, selecting new default')
 *       // MediaProvider handles this automatically if autoSelectDefaults is enabled
 *     }
 *   },
 *   { deep: true }
 * )
 * </script>
 * ```
 *
 * @see {@link MediaProvider} For the provider component
 * @see {@link MediaProviderContext} For complete context type definition
 * @see {@link useMediaDevices} For the underlying composable (direct usage)
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
