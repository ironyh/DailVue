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
 * **Browser Compatibility:**
 * - Chrome 49+ / Edge 79+: Full support including audio output device selection
 * - Firefox 63+: Full support (audio output selection added in v116, August 2023)
 * - Safari 11+: Partial support (no audio output device selection API in production builds)
 *   - Note: Safari has experimental setSinkId support in Develop > Experimental Features
 *   - Must enable "Allow Speaker Device Selection" for testing
 * - Mobile browsers: Chrome Android has enumeration support but limited setSinkId; iOS Safari lacks setSinkId support
 *
 * **Security Requirements:**
 * - HTTPS required: getUserMedia() only works on secure origins (https:// or localhost)
 * - Permissions API: User must explicitly grant microphone/camera access
 * - Permission persistence: Granted permissions are remembered per-origin
 * - Feature Policy: Ensure your application has proper permissions policies set
 *
 * **Type Definitions:**
 *
 * ```typescript
 * // Media device information (from MediaDeviceInfo API)
 * // See: ../types/media.types.ts for complete MediaDevice type definition
 * interface MediaDevice {
 *   deviceId: string        // Unique device identifier (persistent across sessions)
 *   kind: 'audioinput' | 'audiooutput' | 'videoinput'  // Device type
 *   label: string          // Human-readable device name (requires permissions)
 *   groupId: string        // Devices with same groupId belong to same physical device
 *   isDefault?: boolean    // Whether this is the system default device
 * }
 *
 * // Audio test result structure
 * interface AudioTestResult {
 *   hasAudio: boolean        // Whether audio was detected during test
 *   averageVolume: number    // Average volume level (0.0 to 1.0, where 1.0 is maximum)
 *   peakVolume: number       // Peak volume level (0.0 to 1.0, where 1.0 is maximum)
 * }
 *
 * // Device testing configuration options
 * interface DeviceTestOptions {
 *   duration?: number              // Test duration in milliseconds (default: 2000)
 *   audioLevelThreshold?: number   // Minimum volume to consider as "has audio" (default: 0.01)
 * }
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices MDN: MediaDevices}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia MDN: getUserMedia}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices MDN: enumerateDevices}
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
 *   <!-- ConfigProvider makes config available to all descendants via provide/inject -->
 *   <ConfigProvider :media-config="mediaConfig">
 *     <!-- MediaProvider can also accept config directly for explicit configuration -->
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
 * @example
 * **Common Pitfalls & Troubleshooting:**
 * ```vue
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { watch, onMounted } from 'vue'
 *
 * const media = useMediaProvider()
 *
 * // PITFALL 1: Empty device labels without permissions
 * // Problem: Devices show as "Unknown Device" or blank labels
 * // Solution: Request permissions before expecting device labels
 * onMounted(async () => {
 *   // First enumerate to see if we have permissions
 *   const devices = await media.enumerateDevices()
 *
 *   if (devices.some(d => !d.label)) {
 *     console.log('Device labels unavailable - requesting permissions')
 *     try {
 *       await media.requestPermissions(true, false)
 *       // Re-enumerate to get proper labels
 *       await media.enumerateDevices()
 *     } catch (error) {
 *       console.error('Permissions denied:', error)
 *       // Show UI guidance to user about enabling permissions in browser settings
 *     }
 *   }
 * })
 *
 * // PITFALL 2: Selected device no longer available
 * // Problem: User unplugged selected microphone, app still tries to use it
 * // Solution: Watch for device changes and handle gracefully
 * watch(
 *   () => media.audioInputDevices,
 *   (currentDevices) => {
 *     const selectedId = media.selectedAudioInputId
 *     if (selectedId) {
 *       const stillExists = currentDevices.some(d => d.deviceId === selectedId)
 *       if (!stillExists) {
 *         console.warn('Selected device removed, falling back to default')
 *         // MediaProvider with autoSelectDefaults will handle this automatically
 *         // Otherwise, manually select a fallback device:
 *         if (currentDevices.length > 0) {
 *           media.selectAudioInput(currentDevices[0].deviceId)
 *         }
 *       }
 *     }
 *   },
 *   { deep: true }
 * )
 *
 * // PITFALL 3: Permission denied permanently
 * // Problem: User denied permission, browser won't prompt again
 * // Solution: Detect and guide user to browser settings
 * const handlePermissionDenied = () => {
 *   // Check if permission was explicitly denied
 *   if (media.audioPermission === 'denied') {
 *     // Show user-friendly message with instructions
 *     const instructions = getBrowserPermissionInstructions()
 *     console.log('Permission denied. User must enable in browser settings:', instructions)
 *     // Display modal or notification with browser-specific instructions
 *   }
 * }
 *
 * // Note: User agent detection is fragile and should be used cautiously
 * // Consider using a dedicated library like 'bowser' or 'platform.js' for production
 * const getBrowserPermissionInstructions = () => {
 *   const isChrome = /Chrome/.test(navigator.userAgent)
 *   const isFirefox = /Firefox/.test(navigator.userAgent)
 *   const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
 *
 *   if (isChrome) {
 *     return 'Click the camera icon in the address bar and select "Always allow"'
 *   } else if (isFirefox) {
 *     return 'Click the microphone icon in the address bar and remove the block'
 *   } else if (isSafari) {
 *     return 'Go to Safari > Settings > Websites > Camera/Microphone'
 *   }
 *   return 'Check your browser settings to enable microphone/camera access'
 * }
 *
 * // PITFALL 4: Device changes not detected
 * // Problem: Plugging in headphones doesn't update device list
 * // Solution: Ensure watchDeviceChanges is enabled and handle the event
 * // Note: MediaProvider with watchDeviceChanges=true handles this automatically
 *
 * // PITFALL 5: Testing devices before permissions granted
 * // Problem: testAudioInput() fails because no permission
 * // Solution: Always check/request permissions before testing
 * const testDeviceSafely = async () => {
 *   if (!media.hasAudioPermission) {
 *     try {
 *       await media.requestAudioPermission()
 *     } catch (error) {
 *       console.error('Cannot test device without permission:', error)
 *       return
 *     }
 *   }
 *
 *   const result = await media.testAudioInput()
 *   if (!result.hasAudio) {
 *     console.warn('No audio detected - microphone may be muted or not working')
 *   }
 * }
 *
 * // PITFALL 6: Memory leaks from event listeners
 * // Problem: Creating MediaProvider multiple times without cleanup
 * // Solution: MediaProvider automatically cleans up on unmount
 * // Just ensure you don't create multiple instances unnecessarily
 * </script>
 * ```
 *
 * @example
 * **Advanced: Persisting User Device Preferences:**
 * ```vue
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { watch, onMounted } from 'vue'
 *
 * const media = useMediaProvider()
 *
 * // Load saved preferences on mount
 * onMounted(async () => {
 *   await media.enumerateDevices()
 *
 *   // Load from localStorage
 *   const savedPreferences = localStorage.getItem('mediaDevicePreferences')
 *   if (savedPreferences) {
 *     try {
 *       const prefs = JSON.parse(savedPreferences)
 *
 *       // Verify saved devices still exist before selecting
 *       if (prefs.audioInputId && media.getDeviceById(prefs.audioInputId)) {
 *         media.selectAudioInput(prefs.audioInputId)
 *       }
 *       if (prefs.audioOutputId && media.getDeviceById(prefs.audioOutputId)) {
 *         media.selectAudioOutput(prefs.audioOutputId)
 *       }
 *       if (prefs.videoInputId && media.getDeviceById(prefs.videoInputId)) {
 *         media.selectVideoInput(prefs.videoInputId)
 *       }
 *     } catch (error) {
 *       console.error('Failed to load device preferences:', error)
 *     }
 *   }
 * })
 *
 * // Save preferences when user changes devices
 * watch(
 *   () => ({
 *     audioInputId: media.selectedAudioInputId,
 *     audioOutputId: media.selectedAudioOutputId,
 *     videoInputId: media.selectedVideoInputId,
 *   }),
 *   (preferences) => {
 *     // Only save if at least one device is selected
 *     if (preferences.audioInputId || preferences.audioOutputId || preferences.videoInputId) {
 *       localStorage.setItem('mediaDevicePreferences', JSON.stringify(preferences))
 *     }
 *   },
 *   { deep: true }
 * )
 * </script>
 * ```
 *
 * @example
 * **Advanced: Integration with State Management (Pinia):**
 * ```typescript
 * // stores/mediaStore.ts
 * import { defineStore } from 'pinia'
 * import { ref, computed } from 'vue'
 * import type { MediaDevice } from 'vuesip'
 *
 * export const useMediaStore = defineStore('media', () => {
 *   const devices = ref<MediaDevice[]>([])
 *   const selectedDevices = ref({
 *     audioInput: null as string | null,
 *     audioOutput: null as string | null,
 *     videoInput: null as string | null,
 *   })
 *   const permissionStatus = ref({
 *     audio: 'prompt' as const,
 *     video: 'prompt' as const,
 *   })
 *
 *   const hasAudioPermission = computed(() => permissionStatus.value.audio === 'granted')
 *   const hasVideoPermission = computed(() => permissionStatus.value.video === 'granted')
 *
 *   function updateDevices(newDevices: MediaDevice[]) {
 *     devices.value = newDevices
 *   }
 *
 *   function updatePermissions(audio: string, video: string) {
 *     permissionStatus.value = {
 *       audio: audio as any,
 *       video: video as any,
 *     }
 *   }
 *
 *   return {
 *     devices,
 *     selectedDevices,
 *     permissionStatus,
 *     hasAudioPermission,
 *     hasVideoPermission,
 *     updateDevices,
 *     updatePermissions,
 *   }
 * })
 *
 * // In your component:
 * import { useMediaProvider } from 'vuesip'
 * import { useMediaStore } from '@/stores/mediaStore'
 * import { watchEffect } from 'vue'
 *
 * const media = useMediaProvider()
 * const mediaStore = useMediaStore()
 *
 * // Sync MediaProvider state to Pinia store
 * watchEffect(() => {
 *   mediaStore.updateDevices(media.allDevices)
 *   mediaStore.updatePermissions(media.audioPermission, media.videoPermission)
 *   mediaStore.selectedDevices.audioInput = media.selectedAudioInputId
 *   mediaStore.selectedDevices.audioOutput = media.selectedAudioOutputId
 *   mediaStore.selectedDevices.videoInput = media.selectedVideoInputId
 * })
 * ```
 *
 * @example
 * **Advanced: Handling Concurrent Permission Requests:**
 * ```vue
 * <template>
 *   <MediaProvider @error="handleError">
 *     <div>
 *       <button @click="requestWithQueue('audio')" :disabled="isRequesting">
 *         Request Microphone
 *       </button>
 *       <button @click="requestWithQueue('video')" :disabled="isRequesting">
 *         Request Camera
 *       </button>
 *       <button @click="requestWithQueue('both')" :disabled="isRequesting">
 *         Request Both
 *       </button>
 *
 *       <div v-if="isRequesting" role="status">
 *         Requesting permissions...
 *       </div>
 *     </div>
 *   </MediaProvider>
 * </template>
 *
 * <script setup lang="ts">
 * import { useMediaProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * const media = useMediaProvider()
 * const isRequesting = ref(false)
 * const requestQueue = ref<Array<'audio' | 'video' | 'both'>>([])
 * const processingQueue = ref(false)
 *
 * /**
 *  * Queue-based permission requests to prevent concurrent browser prompts
 *  * Browser can only show one permission prompt at a time, so we queue requests
 */
 * const requestWithQueue = (type: 'audio' | 'video' | 'both') => {
 *   requestQueue.value.push(type)
 *   processQueue()
 * }
 *
 * const processQueue = async () => {
 *   // Prevent concurrent processing
 *   if (processingQueue.value || requestQueue.value.length === 0) {
 *     return
 *   }
 *
 *   processingQueue.value = true
 *   isRequesting.value = true
 *
 *   while (requestQueue.value.length > 0) {
 *     const type = requestQueue.value.shift()
 *
 *     try {
 *       switch (type) {
 *         case 'audio':
 *           await media.requestAudioPermission()
 *           console.log('Audio permission granted')
 *           break
 *         case 'video':
 *           await media.requestVideoPermission()
 *           console.log('Video permission granted')
 *           break
 *         case 'both':
 *           // Request both in sequence (browser limitation)
 *           await media.requestPermissions(true, true)
 *           console.log('Both permissions granted')
 *           break
 *       }
 *     } catch (error) {
 *       console.error(`Permission request failed for ${type}:`, error)
 *       // Continue processing queue even if one fails
 *     }
 *
 *     // Small delay between requests for better UX
 *     await new Promise(resolve => setTimeout(resolve, 100))
 *   }
 *
 *   isRequesting.value = false
 *   processingQueue.value = false
 * }
 *
 * const handleError = (error) => {
 *   console.error('Media error:', error)
 *   isRequesting.value = false
 *   processingQueue.value = false
 *   requestQueue.value = [] // Clear queue on error
 * }
 * </script>
 * ```
 *
 * @example
 * **Advanced: Detecting and Recovering from Device Errors:**
 * ```vue
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { ref, watch, onMounted, onUnmounted } from 'vue'
 *
 * const media = useMediaProvider()
 * const deviceHealth = ref({
 *   audio: 'unknown',
 *   video: 'unknown'
 * })
 *
 * // Periodically check device health
 * const checkDeviceHealth = async () => {
 *   // Check audio input
 *   if (media.hasAudioPermission && media.selectedAudioInputId) {
 *     try {
 *       const result = await media.testAudioInput(
 *         media.selectedAudioInputId,
 *         { duration: 1000, audioLevelThreshold: 0 }
 *       )
 *       deviceHealth.value.audio = result.hasAudio ? 'healthy' : 'silent'
 *     } catch (error) {
 *       deviceHealth.value.audio = 'error'
 *       console.error('Audio device error:', error)
 *
 *       // Attempt recovery
 *       if (error.name === 'NotReadableError') {
 *         // Device is in use, try another device
 *         const otherDevices = media.audioInputDevices.filter(
 *           d => d.deviceId !== media.selectedAudioInputId
 *         )
 *         if (otherDevices.length > 0) {
 *           console.log('Switching to alternative audio device')
 *           media.selectAudioInput(otherDevices[0].deviceId)
 *         }
 *       }
 *     }
 *   }
 *
 *   // Check video input (if applicable)
 *   if (media.hasVideoPermission && media.selectedVideoInputId) {
 *     try {
 *       // Implement video device test logic
 *       deviceHealth.value.video = 'healthy'
 *     } catch (error) {
 *       deviceHealth.value.video = 'error'
 *       console.error('Video device error:', error)
 *     }
 *   }
 * }
 *
 * // Check health on device changes
 * watch(
 *   () => ({
 *     audioId: media.selectedAudioInputId,
 *     videoId: media.selectedVideoInputId,
 *   }),
 *   async () => {
 *     await checkDeviceHealth()
 *   },
 *   { immediate: true }
 * )
 *
 * // Periodic health checks every 30 seconds
 * let healthCheckInterval
 * onMounted(() => {
 *   healthCheckInterval = setInterval(checkDeviceHealth, 30000)
 * })
 * onUnmounted(() => {
 *   clearInterval(healthCheckInterval)
 * })
 * </script>
 * ```
 *
 * @example
 * **Accessibility Considerations:**
 * ```vue
 * <template>
 *   <div>
 *     <!-- Provide visual feedback during permission requests -->
 *     <div
 *       v-if="isRequestingPermission"
 *       role="status"
 *       aria-live="polite"
 *       class="permission-request-overlay"
 *     >
 *       <p>Requesting microphone access. Please allow when prompted by your browser.</p>
 *       <span class="loading-spinner" aria-hidden="true"></span>
 *     </div>
 *
 *     <!-- Accessible device selection -->
 *     <div role="group" aria-labelledby="audio-input-label">
 *       <label id="audio-input-label" for="audio-input-select">
 *         Microphone
 *         <span v-if="!media.hasAudioPermission" class="permission-warning">
 *           (Permission required)
 *         </span>
 *       </label>
 *       <select
 *         id="audio-input-select"
 *         v-model="selectedMicrophone"
 *         @change="changeMicrophone"
 *         :disabled="!media.hasAudioPermission"
 *         :aria-describedby="!media.hasAudioPermission ? 'permission-help' : undefined"
 *       >
 *         <option v-if="!media.hasAudioPermission" value="">
 *           Grant permission to see devices
 *         </option>
 *         <option
 *           v-for="device in media.audioInputDevices"
 *           :key="device.deviceId"
 *           :value="device.deviceId"
 *         >
 *           {{ device.label || 'Unknown Device' }}
 *           {{ device.isDefault ? '(Default)' : '' }}
 *         </option>
 *       </select>
 *       <p
 *         v-if="!media.hasAudioPermission"
 *         id="permission-help"
 *         class="help-text"
 *       >
 *         Click the button below to grant microphone access
 *       </p>
 *     </div>
 *
 *     <!-- Accessible permission button -->
 *     <button
 *       v-if="!media.hasAudioPermission"
 *       @click="requestPermissionWithFeedback"
 *       :disabled="isRequestingPermission"
 *       aria-describedby="permission-button-help"
 *     >
 *       {{ isRequestingPermission ? 'Requesting...' : 'Grant Microphone Access' }}
 *     </button>
 *     <p id="permission-button-help" class="visually-hidden">
 *       Your browser will prompt you to allow microphone access.
 *       This is required for voice and video calls.
 *     </p>
 *
 *     <!-- Status announcements for screen readers -->
 *     <div role="status" aria-live="polite" class="visually-hidden">
 *       {{ statusMessage }}
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useMediaProvider } from 'vuesip'
 * import { ref, watch } from 'vue'
 *
 * const media = useMediaProvider()
 * const selectedMicrophone = ref(media.selectedAudioInputId)
 * const isRequestingPermission = ref(false)
 * const statusMessage = ref('')
 *
 * const changeMicrophone = () => {
 *   media.selectAudioInput(selectedMicrophone.value)
 *   statusMessage.value = `Microphone changed to ${
 *     media.selectedAudioInputDevice?.label || 'selected device'
 *   }`
 * }
 *
 * const requestPermissionWithFeedback = async () => {
 *   isRequestingPermission.value = true
 *   statusMessage.value = 'Requesting microphone permission...'
 *
 *   try {
 *     await media.requestAudioPermission()
 *     await media.enumerateDevices()
 *     statusMessage.value = 'Microphone access granted. Devices loaded.'
 *   } catch (error) {
 *     statusMessage.value = 'Microphone access denied. Please enable in browser settings.'
 *   } finally {
 *     isRequestingPermission.value = false
 *   }
 * }
 *
 * // Announce device changes to screen readers
 * watch(
 *   () => media.audioInputDevices.length,
 *   (newCount, oldCount) => {
 *     if (oldCount !== undefined && newCount !== oldCount) {
 *       statusMessage.value = `Device list updated. ${newCount} microphone${newCount !== 1 ? 's' : ''} available.`
 *     }
 *   }
 * )
 * </script>
 *
 * <style>
 * .visually-hidden {
 *   position: absolute;
 *   width: 1px;
 *   height: 1px;
 *   padding: 0;
 *   margin: -1px;
 *   overflow: hidden;
 *   clip: rect(0, 0, 0, 0);
 *   white-space: nowrap;
 *   border-width: 0;
 * }
 * </style>
 * ```
 *
 * **Performance Considerations:**
 *
 * - **Memory Usage**: Each MediaProvider instance maintains its own device list and event listeners.
 *   Only create one MediaProvider per application to avoid memory overhead.
 *
 * - **Event Listener Cleanup**: The provider automatically removes the `devicechange` event listener
 *   on unmount. No manual cleanup required in most cases.
 *
 * - **Re-enumeration Frequency**: Device enumeration is relatively expensive. The provider only
 *   re-enumerates when:
 *   - Component mounts (if `autoEnumerate` is true)
 *   - `devicechange` event fires (if `watchDeviceChanges` is true)
 *   - `enumerateDevices()` is called manually
 *   Avoid calling `enumerateDevices()` in loops or on every render.
 *
 * - **Permission Request Throttling**: Browsers may throttle or block repeated permission requests.
 *   Only request permissions in response to user actions (button clicks, etc.)
 *
 * - **State Reactivity**: All device lists and state are reactive Vue refs. Accessing them in templates
 *   or computed properties will automatically track dependencies. Be mindful of watchers on large
 *   device lists - use `deep: true` sparingly.
 *
 * @see {@link useMediaProvider} For injecting media context in child components
 * @see {@link useMediaDevices} For the underlying composable used by this provider
 * @see {@link ConfigProvider} For managing media configuration
 * @see {@link SipClientProvider} For SIP functionality with media integration
 *
 * @packageDocumentation
 */

import { defineComponent, provide, watch, onMounted, onUnmounted, inject, type PropType } from 'vue'
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
     * **Basic configuration:**
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
     *
     * @example
     * **Advanced configuration with constraints:**
     * ```js
     * {
     *   audio: {
     *     deviceId: 'specific-device-id',  // Use specific device
     *     echoCancellation: { exact: true },
     *     noiseSuppression: { ideal: true },
     *     autoGainControl: { ideal: true },
     *     sampleRate: { ideal: 48000 },
     *     channelCount: { ideal: 2 }
     *   },
     *   video: {
     *     deviceId: 'specific-camera-id',
     *     width: { min: 640, ideal: 1280, max: 1920 },
     *     height: { min: 480, ideal: 720, max: 1080 },
     *     aspectRatio: { ideal: 16/9 },
     *     frameRate: { min: 15, ideal: 30, max: 60 },
     *     facingMode: { ideal: 'user' }  // 'user' | 'environment'
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
     *
     * **Browser Behavior Without Permissions:**
     * - Chrome/Edge: Returns device IDs but labels are empty strings
     * - Firefox: Returns device IDs with generic labels like "Microphone 1"
     * - Safari: Similar to Chrome, returns IDs without labels
     * - All browsers: Full device information available after permissions granted
     *
     * **Common Pattern:**
     * ```typescript
     * // Enumerate first to check if permissions exist
     * // If labels are empty, request permissions
     * // Then re-enumerate to get labels
     * ```
     *
     * **Performance Note:**
     * Enumeration is synchronous and fast, but triggers browser's device detection.
     * Safe to enable for most use cases.
     *
     * **When to Disable (set to false):**
     * - To reduce initial page load overhead in performance-critical applications
     * - When device selection UI is hidden by default or in a settings modal
     * - To delay enumeration until user explicitly opens device settings
     * - In applications where media functionality is optional/secondary
     *
     * **When to Keep Enabled (default true):**
     * - For call/video applications where device info is needed immediately
     * - When showing device status or counts in the initial UI
     * - To enable quick device selection without additional loading states
     *
     * @see {@link autoRequestPermissions} For automatically requesting permissions
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices MDN: enumerateDevices}
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
     *
     * **Browser Behavior:**
     * - Chrome/Edge: May block auto-requests if user hasn't interacted with page
     * - Firefox: More permissive with auto-requests
     * - Safari: Requires user gesture (click/tap) for permission requests
     * - Mobile browsers: Generally require user interaction first
     *
     * **Security Notes:**
     * - Only works on HTTPS (or localhost for development)
     * - Browsers may throttle or block repeated permission requests
     * - User can permanently deny permissions (requires manual re-enable)
     *
     * @see {@link requestAudio} For controlling audio permission request
     * @see {@link requestVideo} For controlling video permission request
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#security MDN: getUserMedia Security}
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
     *
     * **Browser Support:**
     * - Chrome/Edge 57+: Full support, reliable detection
     * - Firefox 52+: Full support
     * - Safari 11+: Supported but may have delayed detection
     * - Mobile browsers: Limited or unreliable support
     *
     * **Common Device Change Scenarios:**
     * - USB devices: Plugging/unplugging USB microphones, webcams, speakers
     * - Bluetooth: Pairing/unpairing wireless headsets, speakers
     * - Wired: Plugging/unplugging 3.5mm headphones
     * - System changes: Changing default device in OS settings
     * - Availability: Apps releasing device access (camera/mic freed up)
     *
     * **Performance Impact:**
     * - Event listener has minimal overhead
     * - Re-enumeration on change is relatively fast
     * - Provider automatically cleans up listener on unmount
     *
     * **Best Practices:**
     * - Keep enabled for better UX (users can hot-swap devices)
     * - Handle devicesChanged event to notify users
     * - Test with physical device connection/disconnection
     *
     * @see {@link autoSelectDefaults} For automatic device re-selection
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event MDN: devicechange event}
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
     * Emitted when devices have been enumerated and are ready for use
     *
     * @remarks
     * **When Emitted:**
     * - After successful device enumeration on component mount (if `autoEnumerate` is true)
     * - After permissions are granted and enumeration completes
     * - Only emitted once during initialization, not on subsequent re-enumerations
     *
     * **Use Cases:**
     * - Initialize UI with available devices
     * - Enable device selection controls
     * - Start media streams once devices are known
     * - Display device count or availability status
     *
     * **Lifecycle Position:**
     * This is typically the first event you'll receive, signaling that the MediaProvider
     * has completed its initialization and devices are available for selection.
     *
     * @example
     * ```vue
     * <template>
     *   <MediaProvider @ready="onDevicesReady">
     *     <DeviceSelector v-if="isReady" />
     *     <LoadingSpinner v-else />
     *   </MediaProvider>
     * </template>
     *
     * <script setup>
     * import { ref } from 'vue'
     *
     * const isReady = ref(false)
     *
     * const onDevicesReady = () => {
     *   isReady.value = true
     *   console.log('Media devices ready for use')
     *   // Safe to display device selectors, start calls, etc.
     * }
     * </script>
     * ```
     *
     * @see {@link devicesChanged} For ongoing device list updates after initialization
     */
    ready: () => true,

    /**
     * Emitted when the device list changes due to devices being connected/disconnected
     *
     * @param devices - The complete updated list of all media devices
     *
     * @remarks
     * **When Emitted:**
     * - When a USB device is plugged in or unplugged
     * - When Bluetooth devices connect or disconnect
     * - When headphones are plugged into or removed from device
     * - When system default device changes
     * - When camera/microphone becomes available or unavailable (e.g., released by another app)
     *
     * **Event Payload:**
     * The `devices` parameter contains the complete updated list of all devices
     * (audio inputs, audio outputs, and video inputs combined). Use the injected
     * device-specific arrays for filtered lists.
     *
     * **Auto-Recovery:**
     * If `autoSelectDefaults` is enabled, the provider will automatically attempt to
     * re-select devices if the currently selected device is no longer available.
     *
     * **Performance Note:**
     * This event triggers device re-enumeration, which is relatively expensive.
     * Avoid performing heavy operations in the handler.
     *
     * @example
     * ```vue
     * <template>
     *   <MediaProvider @devices-changed="handleDeviceChange">
     *     <DeviceList />
     *   </MediaProvider>
     * </template>
     *
     * <script setup>
     * import { useMediaProvider } from 'vuesip'
     * import { ref } from 'vue'
     *
     * const media = useMediaProvider()
     * const deviceChangeNotification = ref('')
     *
     * const handleDeviceChange = (devices) => {
     *   console.log('Devices changed:', {
     *     total: devices.length,
     *     audioInputs: media.audioInputDevices.length,
     *     audioOutputs: media.audioOutputDevices.length,
     *     videoInputs: media.videoInputDevices.length
     *   })
     *
     *   // Notify user of device changes
     *   deviceChangeNotification.value = 'Device list updated. Please verify your selection.'
     *
     *   // Check if selected device is still available
     *   if (media.selectedAudioInputId) {
     *     const stillAvailable = devices.some(
     *       d => d.deviceId === media.selectedAudioInputId && d.kind === 'audioinput'
     *     )
     *     if (!stillAvailable) {
     *       console.warn('Previously selected microphone is no longer available')
     *       deviceChangeNotification.value = 'Your microphone was disconnected. A new one has been selected.'
     *     }
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event MDN: devicechange event}
     */
    devicesChanged: (_devices: MediaDevice[]) => true,

    /**
     * Emitted when media permissions are successfully granted by the user
     *
     * @param audio - Whether audio (microphone) permission was granted
     * @param video - Whether video (camera) permission was granted
     *
     * @remarks
     * **When Emitted:**
     * - After user clicks "Allow" on browser's permission prompt
     * - When `autoRequestPermissions` is enabled and permissions are granted on mount
     * - After manual permission request via `requestPermissions()` succeeds
     *
     * **Event Payload:**
     * - `audio`: `true` if microphone access was requested and granted
     * - `video`: `true` if camera access was requested and granted
     *
     * **Next Steps:**
     * After this event, device enumeration will typically follow, revealing full
     * device labels and information. If `autoEnumerate` is enabled, the `ready`
     * event will fire next.
     *
     * **Browser Behavior:**
     * - Permissions are remembered per-origin (domain)
     * - User can revoke permissions at any time through browser settings
     * - Some browsers may auto-grant if previously granted
     *
     * @example
     * ```vue
     * <template>
     *   <MediaProvider
     *     :auto-request-permissions="true"
     *     :request-audio="true"
     *     :request-video="false"
     *     @permissions-granted="handlePermissionsGranted"
     *     @permissions-denied="handlePermissionsDenied"
     *   >
     *     <DeviceSettings />
     *   </MediaProvider>
     * </template>
     *
     * <script setup>
     * import { ref } from 'vue'
     *
     * const permissionState = ref({
     *   audio: 'pending',
     *   video: 'pending'
     * })
     *
     * const handlePermissionsGranted = (audio, video) => {
     *   console.log('Permissions granted:', { audio, video })
     *
     *   if (audio) {
     *     permissionState.value.audio = 'granted'
     *     // Safe to enumerate devices and get labels
     *     // Safe to start audio capture
     *   }
     *
     *   if (video) {
     *     permissionState.value.video = 'granted'
     *     // Safe to start video capture
     *   }
     *
     *   // Show success notification
     *   showNotification('Microphone access granted!', 'success')
     * }
     *
     * const handlePermissionsDenied = (audio, video) => {
     *   console.warn('Permissions denied:', { audio, video })
     *
     *   if (audio) {
     *     permissionState.value.audio = 'denied'
     *   }
     *   if (video) {
     *     permissionState.value.video = 'denied'
     *   }
     *
     *   // Show instructions to enable in browser settings
     *   showPermissionInstructions()
     * }
     * </script>
     * ```
     *
     * @see {@link permissionsDenied} For handling permission denial
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia MDN: getUserMedia}
     */
    permissionsGranted: (_audio: boolean, _video: boolean) => true,

    /**
     * Emitted when media permissions are denied by the user
     *
     * @param audio - Whether audio (microphone) permission was requested and denied
     * @param video - Whether video (camera) permission was requested and denied
     *
     * @remarks
     * **When Emitted:**
     * - After user clicks "Block" or "Deny" on browser's permission prompt
     * - When `autoRequestPermissions` is enabled and user denies on mount
     * - After manual permission request via `requestPermissions()` fails
     *
     * **Event Payload:**
     * - `audio`: `true` if microphone access was requested but denied
     * - `video`: `true` if camera access was requested but denied
     *
     * **Critical Information:**
     * Once permissions are denied, the browser will NOT prompt again for the same
     * origin. Users must manually enable permissions through browser settings.
     *
     * **Recovery Options:**
     * 1. Display clear instructions for enabling permissions in browser settings
     * 2. Provide browser-specific guidance (Chrome, Firefox, Safari differ)
     * 3. Offer alternative features that don't require permissions
     * 4. Test on localhost (some browsers are more permissive)
     *
     * **Partial Grants:**
     * It's possible for only one permission to be denied. For example, if requesting
     * both audio and video, user might grant audio but deny video.
     *
     * @example
     * ```vue
     * <template>
     *   <MediaProvider
     *     @permissions-denied="handlePermissionsDenied"
     *   >
     *     <div v-if="showPermissionHelp" class="permission-denied-help">
     *       <h3>Microphone Access Required</h3>
     *       <p>Please enable microphone access in your browser settings:</p>
     *       <ol>
     *         <li v-for="step in permissionSteps" :key="step">{{ step }}</li>
     *       </ol>
     *     </div>
     *     <YourApp v-else />
     *   </MediaProvider>
     * </template>
     *
     * <script setup>
     * import { ref, computed } from 'vue'
     *
     * const showPermissionHelp = ref(false)
     *
     * const permissionSteps = computed(() => {
     *   // Detect browser and return appropriate steps
     *   if (/Chrome/.test(navigator.userAgent)) {
     *     return [
     *       'Click the camera icon in the address bar',
     *       'Select "Always allow" for microphone',
     *       'Refresh this page'
     *     ]
     *   } else if (/Firefox/.test(navigator.userAgent)) {
     *     return [
     *       'Click the microphone icon in the address bar',
     *       'Remove the block for this website',
     *       'Refresh this page'
     *     ]
     *   }
     *   return [
     *     'Open your browser settings',
     *     'Find privacy or permissions section',
     *     'Enable microphone access for this website'
     *   ]
     * })
     *
     * const handlePermissionsDenied = (audio, video) => {
     *   console.error('Permissions denied:', { audio, video })
     *
     *   // Track in analytics
     *   analytics.track('permission_denied', { audio, video })
     *
     *   if (audio) {
     *     showPermissionHelp.value = true
     *
     *     // Optionally continue with limited functionality
     *     // Device IDs will be available but labels will be blank
     *   }
     *
     *   if (video) {
     *     // Handle video permission denial
     *     // Could offer audio-only mode
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link permissionsGranted} For successful permission grants
     * @see {@link error} For other error conditions
     */
    permissionsDenied: (_audio: boolean, _video: boolean) => true,

    /**
     * Emitted when an error occurs during device management operations
     *
     * @param error - The Error object containing details about what went wrong
     *
     * @remarks
     * **When Emitted:**
     * - Device enumeration fails
     * - Permission request throws an exception
     * - Device re-enumeration fails after device change
     * - Invalid device ID is selected
     * - Browser API calls fail unexpectedly
     *
     * **Common Error Types:**
     *
     * - `NotAllowedError`: User denied permission (also triggers `permissionsDenied` event)
     * - `NotFoundError`: No devices found or specific device not available
     * - `NotReadableError`: Device is in use by another application
     * - `OverconstrainedError`: Constraints cannot be satisfied by available devices
     * - `TypeError`: Invalid parameters or configuration
     * - `SecurityError`: Access denied due to security policy (e.g., not HTTPS)
     *
     * **Error Handling Strategy:**
     * 1. Check `error.name` to determine error type
     * 2. Provide user-friendly error messages
     * 3. Offer recovery options when possible
     * 4. Log errors for debugging and monitoring
     *
     * **Note on Permission Errors:**
     * Permission denials emit both `error` and `permissionsDenied` events.
     * Handle permission-specific logic in `permissionsDenied` to avoid duplication.
     *
     * @example
     * ```vue
     * <template>
     *   <MediaProvider @error="handleMediaError">
     *     <div v-if="errorMessage" class="error-banner">
     *       {{ errorMessage }}
     *       <button v-if="errorRecovery" @click="errorRecovery">
     *         {{ errorRecoveryText }}
     *       </button>
     *     </div>
     *     <YourApp />
     *   </MediaProvider>
     * </template>
     *
     * <script setup>
     * import { useMediaProvider } from 'vuesip'
     * import { ref } from 'vue'
     *
     * const media = useMediaProvider()
     * const errorMessage = ref('')
     * const errorRecovery = ref(null)
     * const errorRecoveryText = ref('')
     *
     * const handleMediaError = (error) => {
     *   console.error('Media error:', error)
     *
     *   // Handle different error types
     *   switch (error.name) {
     *     case 'NotAllowedError':
     *       errorMessage.value = 'Microphone access denied. Please grant permission to continue.'
     *       errorRecoveryText.value = 'Request Permission'
     *       errorRecovery.value = async () => {
     *         try {
     *           await media.requestAudioPermission()
     *           errorMessage.value = ''
     *           errorRecovery.value = null
     *         } catch (e) {
     *           errorMessage.value = 'Permission denied. Please enable in browser settings.'
     *           errorRecovery.value = null
     *         }
     *       }
     *       break
     *
     *     case 'NotFoundError':
     *       errorMessage.value = 'No microphone found. Please connect a microphone and try again.'
     *       errorRecoveryText.value = 'Retry'
     *       errorRecovery.value = async () => {
     *         await media.enumerateDevices()
     *         if (media.audioInputDevices.length > 0) {
     *           errorMessage.value = ''
     *           errorRecovery.value = null
     *         }
     *       }
     *       break
     *
     *     case 'NotReadableError':
     *       errorMessage.value = 'Microphone is in use by another application. Please close other apps and try again.'
     *       errorRecoveryText.value = 'Retry'
     *       errorRecovery.value = async () => {
     *         try {
     *           await media.testAudioInput()
     *           errorMessage.value = ''
     *           errorRecovery.value = null
     *         } catch (e) {
     *           // Still in use
     *         }
     *       }
     *       break
     *
     *     case 'SecurityError':
     *       errorMessage.value = 'Microphone access requires HTTPS. Please use a secure connection.'
     *       errorRecovery.value = null
     *       break
     *
     *     case 'OverconstrainedError':
     *       errorMessage.value = 'Your device does not meet the required specifications.'
     *       errorRecovery.value = null
     *       break
     *
     *     default:
     *       errorMessage.value = `An error occurred: ${error.message}`
     *       errorRecoveryText.value = 'Retry'
     *       errorRecovery.value = async () => {
     *         await media.enumerateDevices()
     *         errorMessage.value = ''
     *         errorRecovery.value = null
     *       }
     *   }
     *
     *   // Log to error tracking service
     *   if (window.Sentry) {
     *     window.Sentry.captureException(error)
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#exceptions MDN: getUserMedia Exceptions}
     * @see {@link permissionsDenied} For permission-specific handling
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
     * *Device Lists (readonly MediaDevice[]):*
     * - `audioInputDevices` - Array of microphone devices
     * - `audioOutputDevices` - Array of speaker/headphone devices
     * - `videoInputDevices` - Array of camera devices
     * - `allDevices` - Combined array of all devices
     *
     * **Array Guarantee:** All device arrays are guaranteed to always be arrays, never null or undefined.
     * Empty arrays (`[]`) are returned when no devices are available. This means you can safely use
     * `.length`, `.map()`, `.filter()` etc. without null checks.
     *
     * *Selected Device IDs (string | null):*
     * - `selectedAudioInputId` - Current microphone device ID (null if none selected)
     * - `selectedAudioOutputId` - Current speaker device ID (null if none selected)
     * - `selectedVideoInputId` - Current camera device ID (null if none selected)
     *
     * *Selected Device Objects (MediaDevice | undefined):*
     * - `selectedAudioInputDevice` - Full microphone device object (undefined if none selected)
     * - `selectedAudioOutputDevice` - Full speaker device object (undefined if none selected)
     * - `selectedVideoInputDevice` - Full camera device object (undefined if none selected)
     *
     * **Type Note:** Different null semantics for IDs vs objects:
     * - Device IDs use `null` when none is selected (explicit nullable type)
     * - Device objects use `undefined` when not found (follows array.find() semantics)
     * - This distinction is intentional for TypeScript type safety and API consistency
     *
     * *Permission States (PermissionStatus):*
     * - `audioPermission` - Audio permission state enum value
     *   - Type: `'granted' | 'denied' | 'prompt' | 'not_requested'`
     *   - `'granted'`: User granted microphone access
     *   - `'denied'`: User denied or permission blocked
     *   - `'prompt'`: Browser will prompt when requested
     *   - `'not_requested'`: Not yet requested
     * - `videoPermission` - Video permission state (same enum as above)
     *
     * *Permission Helpers (boolean):*
     * - `hasAudioPermission` - `true` only if audioPermission === 'granted'
     * - `hasVideoPermission` - `true` only if videoPermission === 'granted'
     *
     * *Device Availability (boolean):*
     * - `hasAudioInputDevices` - `true` if audioInputDevices.length > 0
     * - `hasAudioOutputDevices` - `true` if audioOutputDevices.length > 0
     * - `hasVideoInputDevices` - `true` if videoInputDevices.length > 0
     * - `totalDevices` - Total count of all devices (number, never null)
     *
     * *Operation Status:*
     * - `isEnumerating` - Boolean indicating enumeration in progress
     * - `lastError` - Last error that occurred (Error | null, null means no error)
     *
     * **Available Methods:**
     *
     * *Device Management:*
     * - `enumerateDevices(): Promise<MediaDevice[]>`
     *   Manually trigger device enumeration. Returns promise with device array.
     *   Always resolves to an array (empty if no devices). Rejects on errors.
     *
     * - `getDeviceById(deviceId: string): MediaDevice | undefined`
     *   Get specific device by ID. Returns undefined if not found.
     *   Type-safe alternative to array.find().
     *
     * *Device Selection (void methods):*
     * - `selectAudioInput(deviceId: string): void`
     *   Select microphone by device ID. No return value.
     *   Updates selectedAudioInputId and selectedAudioInputDevice.
     *
     * - `selectAudioOutput(deviceId: string): void`
     *   Select speaker by device ID. No return value.
     *   Note: Not supported in Safari (will log warning).
     *
     * - `selectVideoInput(deviceId: string): void`
     *   Select camera by device ID. No return value.
     *   Updates selectedVideoInputId and selectedVideoInputDevice.
     *
     * *Permission Management (async methods):*
     * - `requestAudioPermission(): Promise<boolean>`
     *   Request microphone access. Returns true if granted, false otherwise.
     *   May throw NotAllowedError if denied.
     *
     * - `requestVideoPermission(): Promise<boolean>`
     *   Request camera access. Returns true if granted, false otherwise.
     *   May throw NotAllowedError if denied.
     *
     * - `requestPermissions(audio?: boolean, video?: boolean): Promise<void>`
     *   Request both permissions. Defaults to audio=true, video=false.
     *   Throws on denial. Use for requesting both at once.
     *
     * *Device Testing (async methods):*
     * - `testAudioInput(deviceId?: string, options?: DeviceTestOptions): Promise<AudioTestResult>`
     *   Test microphone with volume analysis. Returns result object with:
     *   - hasAudio: boolean - Whether audio was detected
     *   - averageVolume: number - Average volume level (0-1)
     *   - peakVolume: number - Peak volume level (0-1)
     *   Options: { duration?: number, audioLevelThreshold?: number }
     *
     * - `testAudioOutput(deviceId?: string): Promise<void>`
     *   Test speaker with tone playback. Resolves when test completes.
     *   May reject if device not available or not supported.
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
