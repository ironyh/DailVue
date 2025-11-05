/**
 * Device Store
 *
 * Reactive store for managing media devices (audio/video input/output),
 * device permissions, and device selection.
 *
 * @module stores/deviceStore
 */

import { reactive, computed, readonly } from 'vue'
import type { MediaDevice } from '../types/media.types'
import { MediaDeviceKind, PermissionStatus } from '../types/media.types'
import { createLogger } from '../utils/logger'

const log = createLogger('DeviceStore')

/**
 * Device store state interface
 */
interface DeviceStoreState {
  /** Available audio input devices */
  audioInputDevices: MediaDevice[]
  /** Available audio output devices */
  audioOutputDevices: MediaDevice[]
  /** Available video input devices */
  videoInputDevices: MediaDevice[]
  /** Selected audio input device ID */
  selectedAudioInputId: string | null
  /** Selected audio output device ID */
  selectedAudioOutputId: string | null
  /** Selected video input device ID */
  selectedVideoInputId: string | null
  /** Audio permission status */
  audioPermission: PermissionStatus
  /** Video permission status */
  videoPermission: PermissionStatus
  /** Last device enumeration time */
  lastEnumerationTime: Date | null
  /** Device change listener attached */
  hasDeviceChangeListener: boolean
}

/**
 * Internal reactive state
 */
const state = reactive<DeviceStoreState>({
  audioInputDevices: [],
  audioOutputDevices: [],
  videoInputDevices: [],
  selectedAudioInputId: null,
  selectedAudioOutputId: null,
  selectedVideoInputId: null,
  audioPermission: PermissionStatus.NotRequested,
  videoPermission: PermissionStatus.NotRequested,
  lastEnumerationTime: null,
  hasDeviceChangeListener: false,
})

/**
 * Computed values
 */
const computed_values = {
  /** Total number of available devices */
  totalDevices: computed(
    () =>
      state.audioInputDevices.length +
      state.audioOutputDevices.length +
      state.videoInputDevices.length
  ),

  /** Has audio input devices */
  hasAudioInputDevices: computed(() => state.audioInputDevices.length > 0),

  /** Has audio output devices */
  hasAudioOutputDevices: computed(() => state.audioOutputDevices.length > 0),

  /** Has video input devices */
  hasVideoInputDevices: computed(() => state.videoInputDevices.length > 0),

  /** Currently selected audio input device */
  selectedAudioInputDevice: computed(() =>
    state.audioInputDevices.find((d) => d.deviceId === state.selectedAudioInputId)
  ),

  /** Currently selected audio output device */
  selectedAudioOutputDevice: computed(() =>
    state.audioOutputDevices.find((d) => d.deviceId === state.selectedAudioOutputId)
  ),

  /** Currently selected video input device */
  selectedVideoInputDevice: computed(() =>
    state.videoInputDevices.find((d) => d.deviceId === state.selectedVideoInputId)
  ),

  /** Has audio permission granted */
  hasAudioPermission: computed(() => state.audioPermission === PermissionStatus.Granted),

  /** Has video permission granted */
  hasVideoPermission: computed(() => state.videoPermission === PermissionStatus.Granted),

  /** Has any media permission granted */
  hasAnyPermission: computed(
    () => computed_values.hasAudioPermission.value || computed_values.hasVideoPermission.value
  ),

  /** Audio permission denied */
  isAudioPermissionDenied: computed(() => state.audioPermission === PermissionStatus.Denied),

  /** Video permission denied */
  isVideoPermissionDenied: computed(() => state.videoPermission === PermissionStatus.Denied),
}

/**
 * Device Store
 *
 * Manages media devices with reactive state and device change handling.
 */
export const deviceStore = {
  // ============================================================================
  // State Access (readonly to prevent direct mutation)
  // ============================================================================

  /**
   * Get audio input devices
   */
  get audioInputDevices() {
    return readonly(state.audioInputDevices)
  },

  /**
   * Get audio output devices
   */
  get audioOutputDevices() {
    return readonly(state.audioOutputDevices)
  },

  /**
   * Get video input devices
   */
  get videoInputDevices() {
    return readonly(state.videoInputDevices)
  },

  /**
   * Get selected audio input device ID
   */
  get selectedAudioInputId() {
    return state.selectedAudioInputId
  },

  /**
   * Get selected audio output device ID
   */
  get selectedAudioOutputId() {
    return state.selectedAudioOutputId
  },

  /**
   * Get selected video input device ID
   */
  get selectedVideoInputId() {
    return state.selectedVideoInputId
  },

  /**
   * Get selected audio input device
   */
  get selectedAudioInputDevice() {
    return computed_values.selectedAudioInputDevice.value
  },

  /**
   * Get selected audio output device
   */
  get selectedAudioOutputDevice() {
    return computed_values.selectedAudioOutputDevice.value
  },

  /**
   * Get selected video input device
   */
  get selectedVideoInputDevice() {
    return computed_values.selectedVideoInputDevice.value
  },

  /**
   * Get audio permission status
   */
  get audioPermission() {
    return state.audioPermission
  },

  /**
   * Get video permission status
   */
  get videoPermission() {
    return state.videoPermission
  },

  /**
   * Check if has audio permission
   */
  get hasAudioPermission() {
    return computed_values.hasAudioPermission.value
  },

  /**
   * Check if has video permission
   */
  get hasVideoPermission() {
    return computed_values.hasVideoPermission.value
  },

  /**
   * Check if has any permission
   */
  get hasAnyPermission() {
    return computed_values.hasAnyPermission.value
  },

  /**
   * Check if audio permission denied
   */
  get isAudioPermissionDenied() {
    return computed_values.isAudioPermissionDenied.value
  },

  /**
   * Check if video permission denied
   */
  get isVideoPermissionDenied() {
    return computed_values.isVideoPermissionDenied.value
  },

  /**
   * Get last enumeration time
   */
  get lastEnumerationTime() {
    return state.lastEnumerationTime
  },

  /**
   * Check if has audio input devices
   */
  get hasAudioInputDevices() {
    return computed_values.hasAudioInputDevices.value
  },

  /**
   * Check if has audio output devices
   */
  get hasAudioOutputDevices() {
    return computed_values.hasAudioOutputDevices.value
  },

  /**
   * Check if has video input devices
   */
  get hasVideoInputDevices() {
    return computed_values.hasVideoInputDevices.value
  },

  /**
   * Get total device count
   */
  get totalDevices() {
    return computed_values.totalDevices.value
  },

  // ============================================================================
  // Device Management
  // ============================================================================

  /**
   * Set audio input devices
   *
   * @param devices - Array of audio input devices
   */
  setAudioInputDevices(devices: MediaDevice[]): void {
    state.audioInputDevices = devices
    state.lastEnumerationTime = new Date()
    log.debug(`Set ${devices.length} audio input devices`)

    // Auto-select first device if none selected
    if (!state.selectedAudioInputId && devices.length > 0) {
      // Try to find default device first
      const defaultDevice = devices.find((d) => d.isDefault)
      const deviceId = defaultDevice ? defaultDevice.deviceId : devices[0]!.deviceId
      this.selectAudioInput(deviceId)
    }
  },

  /**
   * Set audio output devices
   *
   * @param devices - Array of audio output devices
   */
  setAudioOutputDevices(devices: MediaDevice[]): void {
    state.audioOutputDevices = devices
    state.lastEnumerationTime = new Date()
    log.debug(`Set ${devices.length} audio output devices`)

    // Auto-select first device if none selected
    if (!state.selectedAudioOutputId && devices.length > 0) {
      // Try to find default device first
      const defaultDevice = devices.find((d) => d.isDefault)
      const deviceId = defaultDevice ? defaultDevice.deviceId : devices[0]!.deviceId
      this.selectAudioOutput(deviceId)
    }
  },

  /**
   * Set video input devices
   *
   * @param devices - Array of video input devices
   */
  setVideoInputDevices(devices: MediaDevice[]): void {
    state.videoInputDevices = devices
    state.lastEnumerationTime = new Date()
    log.debug(`Set ${devices.length} video input devices`)

    // Auto-select first device if none selected
    if (!state.selectedVideoInputId && devices.length > 0) {
      // Try to find default device first
      const defaultDevice = devices.find((d) => d.isDefault)
      const deviceId = defaultDevice ? defaultDevice.deviceId : devices[0]!.deviceId
      this.selectVideoInput(deviceId)
    }
  },

  /**
   * Update all devices from MediaDeviceInfo array
   *
   * @param devices - Array of MediaDeviceInfo from navigator.mediaDevices.enumerateDevices()
   */
  updateDevices(devices: MediaDeviceInfo[]): void {
    const audioInputs: MediaDevice[] = []
    const audioOutputs: MediaDevice[] = []
    const videoInputs: MediaDevice[] = []

    for (const device of devices) {
      const mediaDevice: MediaDevice = {
        deviceId: device.deviceId,
        kind: device.kind as MediaDeviceKind,
        label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
        groupId: device.groupId,
        isDefault: device.deviceId === 'default',
      }

      switch (device.kind) {
        case 'audioinput':
          audioInputs.push(mediaDevice)
          break
        case 'audiooutput':
          audioOutputs.push(mediaDevice)
          break
        case 'videoinput':
          videoInputs.push(mediaDevice)
          break
      }
    }

    this.setAudioInputDevices(audioInputs)
    this.setAudioOutputDevices(audioOutputs)
    this.setVideoInputDevices(videoInputs)

    log.info(
      `Updated devices: ${audioInputs.length} audio inputs, ${audioOutputs.length} audio outputs, ${videoInputs.length} video inputs`
    )
  },

  // ============================================================================
  // Device Selection
  // ============================================================================

  /**
   * Select audio input device
   *
   * @param deviceId - Device ID to select
   * @returns True if device exists and was selected
   */
  selectAudioInput(deviceId: string): boolean {
    const device = state.audioInputDevices.find((d) => d.deviceId === deviceId)
    if (!device) {
      log.warn(`Audio input device ${deviceId} not found`)
      return false
    }

    state.selectedAudioInputId = deviceId
    log.info(`Selected audio input: ${device.label} (${deviceId})`)
    return true
  },

  /**
   * Select audio output device
   *
   * @param deviceId - Device ID to select
   * @returns True if device exists and was selected
   */
  selectAudioOutput(deviceId: string): boolean {
    const device = state.audioOutputDevices.find((d) => d.deviceId === deviceId)
    if (!device) {
      log.warn(`Audio output device ${deviceId} not found`)
      return false
    }

    state.selectedAudioOutputId = deviceId
    log.info(`Selected audio output: ${device.label} (${deviceId})`)
    return true
  },

  /**
   * Select video input device
   *
   * @param deviceId - Device ID to select
   * @returns True if device exists and was selected
   */
  selectVideoInput(deviceId: string): boolean {
    const device = state.videoInputDevices.find((d) => d.deviceId === deviceId)
    if (!device) {
      log.warn(`Video input device ${deviceId} not found`)
      return false
    }

    state.selectedVideoInputId = deviceId
    log.info(`Selected video input: ${device.label} (${deviceId})`)
    return true
  },

  /**
   * Clear audio input selection
   */
  clearAudioInputSelection(): void {
    state.selectedAudioInputId = null
    log.debug('Cleared audio input selection')
  },

  /**
   * Clear audio output selection
   */
  clearAudioOutputSelection(): void {
    state.selectedAudioOutputId = null
    log.debug('Cleared audio output selection')
  },

  /**
   * Clear video input selection
   */
  clearVideoInputSelection(): void {
    state.selectedVideoInputId = null
    log.debug('Cleared video input selection')
  },

  // ============================================================================
  // Permission Management
  // ============================================================================

  /**
   * Set audio permission status
   *
   * @param status - Permission status
   */
  setAudioPermission(status: PermissionStatus): void {
    state.audioPermission = status
    log.debug(`Audio permission: ${status}`)
  },

  /**
   * Set video permission status
   *
   * @param status - Permission status
   */
  setVideoPermission(status: PermissionStatus): void {
    state.videoPermission = status
    log.debug(`Video permission: ${status}`)
  },

  /**
   * Update permissions based on getUserMedia result
   *
   * @param audio - Audio permission granted
   * @param video - Video permission granted
   */
  updatePermissions(audio: boolean, video: boolean): void {
    if (audio) {
      this.setAudioPermission(PermissionStatus.Granted)
    }
    if (video) {
      this.setVideoPermission(PermissionStatus.Granted)
    }
    log.info(`Permissions updated: audio=${audio}, video=${video}`)
  },

  /**
   * Mark audio permission as denied
   */
  denyAudioPermission(): void {
    this.setAudioPermission(PermissionStatus.Denied)
    log.warn('Audio permission denied by user')
  },

  /**
   * Mark video permission as denied
   */
  denyVideoPermission(): void {
    this.setVideoPermission(PermissionStatus.Denied)
    log.warn('Video permission denied by user')
  },

  // ============================================================================
  // Device Change Handling
  // ============================================================================

  /**
   * Mark that device change listener is attached
   */
  setDeviceChangeListenerAttached(): void {
    state.hasDeviceChangeListener = true
    log.debug('Device change listener attached')
  },

  /**
   * Mark that device change listener is detached
   */
  setDeviceChangeListenerDetached(): void {
    state.hasDeviceChangeListener = false
    log.debug('Device change listener detached')
  },

  /**
   * Check if device change listener is attached
   */
  hasDeviceChangeListener(): boolean {
    return state.hasDeviceChangeListener
  },

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Find a device by ID across all device types
   *
   * @param deviceId - Device ID to find
   * @returns The device, or undefined if not found
   */
  findDeviceById(deviceId: string): MediaDevice | undefined {
    return (
      state.audioInputDevices.find((d) => d.deviceId === deviceId) ||
      state.audioOutputDevices.find((d) => d.deviceId === deviceId) ||
      state.videoInputDevices.find((d) => d.deviceId === deviceId)
    )
  },

  /**
   * Check if a device is currently selected
   *
   * @param deviceId - Device ID to check
   * @returns True if device is selected
   */
  isDeviceSelected(deviceId: string): boolean {
    return (
      state.selectedAudioInputId === deviceId ||
      state.selectedAudioOutputId === deviceId ||
      state.selectedVideoInputId === deviceId
    )
  },

  /**
   * Reset the store to initial state
   */
  reset(): void {
    state.audioInputDevices = []
    state.audioOutputDevices = []
    state.videoInputDevices = []
    state.selectedAudioInputId = null
    state.selectedAudioOutputId = null
    state.selectedVideoInputId = null
    state.audioPermission = PermissionStatus.NotRequested
    state.videoPermission = PermissionStatus.NotRequested
    state.lastEnumerationTime = null
    state.hasDeviceChangeListener = false
    log.info('Device store reset to initial state')
  },

  /**
   * Get store statistics
   *
   * @returns Object with store statistics
   */
  getStatistics() {
    return {
      audioInputDevices: state.audioInputDevices.length,
      audioOutputDevices: state.audioOutputDevices.length,
      videoInputDevices: state.videoInputDevices.length,
      totalDevices: computed_values.totalDevices.value,
      hasAudioPermission: computed_values.hasAudioPermission.value,
      hasVideoPermission: computed_values.hasVideoPermission.value,
      selectedDevices: {
        audioInput: state.selectedAudioInputId,
        audioOutput: state.selectedAudioOutputId,
        videoInput: state.selectedVideoInputId,
      },
      lastEnumerationTime: state.lastEnumerationTime,
      hasDeviceChangeListener: state.hasDeviceChangeListener,
    }
  },
}
