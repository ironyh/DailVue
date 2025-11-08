/**
 * Media Devices Composable
 *
 * Provides reactive media device management with device enumeration, selection,
 * permission handling, and device testing capabilities.
 *
 * @module composables/useMediaDevices
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { MediaManager } from '../core/MediaManager'
import { deviceStore } from '../stores/deviceStore'
import type { MediaDevice } from '../types/media.types'
import { MediaDeviceKind, PermissionStatus } from '../types/media.types'
import { createLogger } from '../utils/logger'
import { throwIfAborted } from '../utils/abortController'
import {
  ErrorSeverity,
  logErrorWithContext,
  createOperationTimer,
} from '../utils/errorContext'

const log = createLogger('useMediaDevices')

/**
 * Device test options
 */
export interface DeviceTestOptions {
  /** Test duration in milliseconds (default: 2000) */
  duration?: number
  /** Audio level threshold for success (0-1, default: 0.01) */
  audioLevelThreshold?: number
}

/**
 * Return type for useMediaDevices composable
 */
export interface UseMediaDevicesReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Audio input devices */
  audioInputDevices: ComputedRef<readonly MediaDevice[]>
  /** Audio output devices */
  audioOutputDevices: ComputedRef<readonly MediaDevice[]>
  /** Video input devices */
  videoInputDevices: ComputedRef<readonly MediaDevice[]>
  /** All devices */
  allDevices: ComputedRef<readonly MediaDevice[]>
  /** Selected audio input device ID */
  selectedAudioInputId: Ref<string | null>
  /** Selected audio output device ID */
  selectedAudioOutputId: Ref<string | null>
  /** Selected video input device ID */
  selectedVideoInputId: Ref<string | null>
  /** Selected audio input device */
  selectedAudioInputDevice: ComputedRef<MediaDevice | undefined>
  /** Selected audio output device */
  selectedAudioOutputDevice: ComputedRef<MediaDevice | undefined>
  /** Selected video input device */
  selectedVideoInputDevice: ComputedRef<MediaDevice | undefined>
  /** Audio permission status */
  audioPermission: ComputedRef<PermissionStatus>
  /** Video permission status */
  videoPermission: ComputedRef<PermissionStatus>
  /** Has audio permission */
  hasAudioPermission: ComputedRef<boolean>
  /** Has video permission */
  hasVideoPermission: ComputedRef<boolean>
  /** Has audio input devices */
  hasAudioInputDevices: ComputedRef<boolean>
  /** Has audio output devices */
  hasAudioOutputDevices: ComputedRef<boolean>
  /** Has video input devices */
  hasVideoInputDevices: ComputedRef<boolean>
  /** Total device count */
  totalDevices: ComputedRef<number>
  /** Is enumerating devices */
  isEnumerating: Ref<boolean>
  /** Last error */
  lastError: Ref<Error | null>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Enumerate devices with optional abort signal */
  enumerateDevices: (signal?: AbortSignal) => Promise<MediaDevice[]>
  /** Request audio permission */
  requestAudioPermission: () => Promise<boolean>
  /** Request video permission */
  requestVideoPermission: () => Promise<boolean>
  /** Request permissions */
  requestPermissions: (audio?: boolean, video?: boolean) => Promise<void>
  /** Select audio input device */
  selectAudioInput: (deviceId: string) => void
  /** Select audio output device */
  selectAudioOutput: (deviceId: string) => void
  /** Select video input device */
  selectVideoInput: (deviceId: string) => void
  /** Test audio input device */
  testAudioInput: (deviceId?: string, options?: DeviceTestOptions) => Promise<boolean>
  /** Test audio output device */
  testAudioOutput: (deviceId?: string) => Promise<boolean>
  /** Get device by ID */
  getDeviceById: (deviceId: string) => MediaDevice | undefined
  /** Get devices by kind */
  getDevicesByKind: (kind: MediaDeviceKind) => readonly MediaDevice[]
  /** Start device change monitoring */
  startDeviceChangeMonitoring: () => void
  /** Stop device change monitoring */
  stopDeviceChangeMonitoring: () => void
}

/**
 * Media Devices Composable
 *
 * Manages media devices with reactive state, device enumeration, selection,
 * permission handling, and testing. Integrates with MediaManager and deviceStore.
 *
 * @param mediaManager - Media manager instance (optional)
 * @param options - Options
 * @returns Media devices state and methods
 *
 * @example
 * ```typescript
 * const {
 *   audioInputDevices,
 *   selectedAudioInputId,
 *   enumerateDevices,
 *   requestPermissions,
 *   selectAudioInput,
 *   testAudioInput
 * } = useMediaDevices(mediaManager)
 *
 * // Request permissions
 * await requestPermissions(true, false)
 *
 * // Enumerate devices
 * await enumerateDevices()
 *
 * // Select device
 * if (audioInputDevices.value.length > 0) {
 *   selectAudioInput(audioInputDevices.value[0].deviceId)
 * }
 *
 * // Test device
 * const success = await testAudioInput()
 * ```
 */
export function useMediaDevices(
  mediaManager?: Ref<MediaManager | null>,
  options: {
    /** Auto-enumerate on mount (default: true) */
    autoEnumerate?: boolean
    /** Auto-monitor device changes (default: true) */
    autoMonitor?: boolean
  } = {}
): UseMediaDevicesReturn {
  const { autoEnumerate = true, autoMonitor = true } = options

  // ============================================================================
  // Reactive State
  // ============================================================================

  const isEnumerating = ref(false)
  const lastError = ref<Error | null>(null)

  // Internal AbortController for automatic cleanup on unmount
  const internalAbortController = ref(new AbortController())

  // Critical fix: Sync flag to prevent infinite loops in bidirectional sync
  const isUpdatingFromStore = ref(false)

  // Sync store state with local refs for reactivity
  const selectedAudioInputId = ref<string | null>(deviceStore.selectedAudioInputId)
  const selectedAudioOutputId = ref<string | null>(deviceStore.selectedAudioOutputId)
  const selectedVideoInputId = ref<string | null>(deviceStore.selectedVideoInputId)

  // ============================================================================
  // Computed Values
  // ============================================================================

  const audioInputDevices = computed(() => deviceStore.audioInputDevices)
  const audioOutputDevices = computed(() => deviceStore.audioOutputDevices)
  const videoInputDevices = computed(() => deviceStore.videoInputDevices)

  const allDevices = computed(() => [
    ...deviceStore.audioInputDevices,
    ...deviceStore.audioOutputDevices,
    ...deviceStore.videoInputDevices,
  ])

  const selectedAudioInputDevice = computed(() =>
    audioInputDevices.value.find((d) => d.deviceId === selectedAudioInputId.value)
  )

  const selectedAudioOutputDevice = computed(() =>
    audioOutputDevices.value.find((d) => d.deviceId === selectedAudioOutputId.value)
  )

  const selectedVideoInputDevice = computed(() =>
    videoInputDevices.value.find((d) => d.deviceId === selectedVideoInputId.value)
  )

  const audioPermission = computed(() => deviceStore.audioPermission)
  const videoPermission = computed(() => deviceStore.videoPermission)

  const hasAudioPermission = computed(() => audioPermission.value === PermissionStatus.Granted)
  const hasVideoPermission = computed(() => videoPermission.value === PermissionStatus.Granted)

  const hasAudioInputDevices = computed(() => audioInputDevices.value.length > 0)
  const hasAudioOutputDevices = computed(() => audioOutputDevices.value.length > 0)
  const hasVideoInputDevices = computed(() => videoInputDevices.value.length > 0)

  const totalDevices = computed(() => allDevices.value.length)

  // ============================================================================
  // Store Synchronization (Critical Fix: Prevent race conditions)
  // ============================================================================

  // Watch store changes and sync local state
  // Critical fix: Use flag to prevent infinite loops
  watch(
    () => ({
      audioInputId: deviceStore.selectedAudioInputId,
      audioOutputId: deviceStore.selectedAudioOutputId,
      videoInputId: deviceStore.selectedVideoInputId,
    }),
    (newState) => {
      if (!isUpdatingFromStore.value) {
        isUpdatingFromStore.value = true
        selectedAudioInputId.value = newState.audioInputId
        selectedAudioOutputId.value = newState.audioOutputId
        selectedVideoInputId.value = newState.videoInputId
        // Reset flag in next tick to allow updates
        Promise.resolve().then(() => {
          isUpdatingFromStore.value = false
        })
      }
    }
  )

  // Watch local selections and update store
  // Critical fix: Allow null values and prevent loops
  watch(
    selectedAudioInputId,
    (newId) => {
      if (!isUpdatingFromStore.value && newId !== null) {
        deviceStore.selectAudioInput(newId)
      }
    },
    { flush: 'sync' }
  )

  watch(
    selectedAudioOutputId,
    (newId) => {
      if (!isUpdatingFromStore.value && newId !== null) {
        deviceStore.selectAudioOutput(newId)
      }
    },
    { flush: 'sync' }
  )

  watch(
    selectedVideoInputId,
    (newId) => {
      if (!isUpdatingFromStore.value && newId !== null) {
        deviceStore.selectVideoInput(newId)
      }
    },
    { flush: 'sync' }
  )

  // ============================================================================
  // Device Enumeration
  // ============================================================================

  /**
   * Enumerate devices
   *
   * @param signal - Optional AbortSignal to cancel enumeration
   * @returns Array of media devices
   * @throws Error if enumeration fails
   * @throws DOMException with name 'AbortError' if aborted
   *
   * @example
   * ```typescript
   * // Basic usage (backward compatible)
   * const devices = await enumerateDevices()
   *
   * // With abort support
   * const controller = new AbortController()
   * const promise = enumerateDevices(controller.signal)
   * // Later: controller.abort()
   * ```
   */
  const enumerateDevices = async (signal?: AbortSignal): Promise<MediaDevice[]> => {
    // Use internal abort signal if none provided (auto-cleanup on unmount)
    const effectiveSignal = signal ?? internalAbortController.value.signal

    if (isEnumerating.value) {
      log.debug('Device enumeration already in progress')
      return allDevices.value
    }

    const timer = createOperationTimer()

    try {
      isEnumerating.value = true
      lastError.value = null

      // Check if aborted before starting
      throwIfAborted(effectiveSignal)

      log.info('Enumerating devices')

      let devices: MediaDevice[]
      let rawDevices: MediaDeviceInfo[]

      if (mediaManager?.value) {
        // Use MediaManager if available
        devices = await mediaManager.value.enumerateDevices()

        // Check signal after first async operation
        throwIfAborted(effectiveSignal)

        rawDevices = await navigator.mediaDevices.enumerateDevices()
      } else {
        // Fallback to direct API
        rawDevices = await navigator.mediaDevices.enumerateDevices()

        // Check signal after enumeration
        throwIfAborted(effectiveSignal)

        devices = rawDevices.map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} ${device.deviceId.slice(0, 5)}`,
          kind: device.kind as MediaDeviceKind,
          groupId: device.groupId,
        }))
      }

      // Update store with raw browser MediaDeviceInfo[]
      deviceStore.setDevices(rawDevices)

      log.info(`Enumerated ${devices.length} devices`)
      return devices
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Device enumeration failed')
      lastError.value = err

      logErrorWithContext(
        log,
        'Failed to enumerate devices',
        err,
        'enumerateDevices',
        'useMediaDevices',
        ErrorSeverity.MEDIUM,
        {
          context: {
            hasMediaManager: !!mediaManager?.value,
          },
          state: {
            isEnumerating: isEnumerating.value,
            currentDeviceCount: allDevices.value.length,
            audioInputs: audioInputDevices.value.length,
            audioOutputs: audioOutputDevices.value.length,
            videoInputs: videoInputDevices.value.length,
          },
          duration: timer.elapsed(),
        }
      )
      throw err
    } finally {
      isEnumerating.value = false
    }
  }

  // ============================================================================
  // Permission Management
  // ============================================================================

  /**
   * Request audio permission
   *
   * @returns true if granted, false otherwise
   */
  const requestAudioPermission = async (): Promise<boolean> => {
    try {
      log.info('Requesting audio permission')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Stop tracks immediately
      stream.getTracks().forEach((track) => track.stop())

      // Update store
      deviceStore.setAudioPermission(PermissionStatus.Granted)

      log.info('Audio permission granted')
      return true
    } catch (error) {
      log.error('Audio permission denied:', error)
      deviceStore.setAudioPermission(PermissionStatus.Denied)
      return false
    }
  }

  /**
   * Request video permission
   *
   * @returns true if granted, false otherwise
   */
  const requestVideoPermission = async (): Promise<boolean> => {
    try {
      log.info('Requesting video permission')

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })

      // Stop tracks immediately
      stream.getTracks().forEach((track) => track.stop())

      // Update store
      deviceStore.setVideoPermission(PermissionStatus.Granted)

      log.info('Video permission granted')
      return true
    } catch (error) {
      log.error('Video permission denied:', error)
      deviceStore.setVideoPermission(PermissionStatus.Denied)
      return false
    }
  }

  /**
   * Request permissions
   *
   * @param audio - Request audio permission (default: true)
   * @param video - Request video permission (default: false)
   * @throws Error if permission request fails
   */
  const requestPermissions = async (audio = true, video = false): Promise<void> => {
    try {
      log.info(`Requesting permissions (audio: ${audio}, video: ${video})`)

      const constraints: MediaStreamConstraints = {}
      if (audio) constraints.audio = true
      if (video) constraints.video = true

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Stop tracks immediately
      stream.getTracks().forEach((track) => track.stop())

      // Update store
      if (audio) deviceStore.setAudioPermission(PermissionStatus.Granted)
      if (video) deviceStore.setVideoPermission(PermissionStatus.Granted)

      // Re-enumerate to get device labels
      await enumerateDevices()

      log.info('Permissions granted')
    } catch (error) {
      log.error('Permission request failed:', error)
      if (audio) deviceStore.setAudioPermission(PermissionStatus.Denied)
      if (video) deviceStore.setVideoPermission(PermissionStatus.Denied)
      throw error
    }
  }

  // ============================================================================
  // Device Selection
  // ============================================================================

  /**
   * Select audio input device
   *
   * @param deviceId - Device ID
   * @remarks Logs a warning if device is not found, but still sets the value
   */
  const selectAudioInput = (deviceId: string): void => {
    // Validate device exists in available devices
    const device = audioInputDevices.value.find((d) => d.deviceId === deviceId)
    if (!device) {
      log.warn(`Audio input device ${deviceId} not found in available devices`, {
        availableDevices: audioInputDevices.value.map((d) => d.deviceId),
      })
      // Still set it - device might become available later
    }

    log.debug(`Selecting audio input: ${deviceId}`)
    selectedAudioInputId.value = deviceId
    deviceStore.selectAudioInput(deviceId)
  }

  /**
   * Select audio output device
   *
   * @param deviceId - Device ID
   * @remarks Logs a warning if device is not found, but still sets the value
   */
  const selectAudioOutput = (deviceId: string): void => {
    // Validate device exists in available devices
    const device = audioOutputDevices.value.find((d) => d.deviceId === deviceId)
    if (!device) {
      log.warn(`Audio output device ${deviceId} not found in available devices`, {
        availableDevices: audioOutputDevices.value.map((d) => d.deviceId),
      })
      // Still set it - device might become available later
    }

    log.debug(`Selecting audio output: ${deviceId}`)
    selectedAudioOutputId.value = deviceId
    deviceStore.selectAudioOutput(deviceId)
  }

  /**
   * Select video input device
   *
   * @param deviceId - Device ID
   * @remarks Logs a warning if device is not found, but still sets the value
   */
  const selectVideoInput = (deviceId: string): void => {
    // Validate device exists in available devices
    const device = videoInputDevices.value.find((d) => d.deviceId === deviceId)
    if (!device) {
      log.warn(`Video input device ${deviceId} not found in available devices`, {
        availableDevices: videoInputDevices.value.map((d) => d.deviceId),
      })
      // Still set it - device might become available later
    }

    log.debug(`Selecting video input: ${deviceId}`)
    selectedVideoInputId.value = deviceId
    deviceStore.selectVideoInput(deviceId)
  }

  // ============================================================================
  // Device Testing
  // ============================================================================

  /**
   * Test audio input device
   *
   * @param deviceId - Device ID (uses selected device if not provided)
   * @param options - Test options
   * @returns Promise resolving to true if test passed, false otherwise
   * @throws {Error} If no audio input device is selected and deviceId not provided
   * @remarks Returns false on errors instead of throwing, cleanup is always performed
   */
  const testAudioInput = async (
    deviceId?: string,
    options: DeviceTestOptions = {}
  ): Promise<boolean> => {
    const { duration = 2000, audioLevelThreshold = 0.01 } = options

    try {
      const targetDeviceId = deviceId || selectedAudioInputId.value
      if (!targetDeviceId) {
        throw new Error('No audio input device selected')
      }

      log.info(`Testing audio input device: ${targetDeviceId}`)

      if (mediaManager?.value) {
        // Use MediaManager if available
        const result = await mediaManager.value.testDevice(targetDeviceId)
        return result.success && (result.audioLevel ?? 0) > audioLevelThreshold
      } else {
        // Fallback to basic test with proper cleanup
        let stream: MediaStream | null = null
        let audioContext: AudioContext | null = null
        let intervalId: number | undefined

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: targetDeviceId } },
          })

          // Create audio context to measure levels
          audioContext = new AudioContext()
          const source = audioContext.createMediaStreamSource(stream)
          const analyser = audioContext.createAnalyser()
          source.connect(analyser)

          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          return await new Promise<boolean>((resolve, reject) => {
            let maxLevel = 0

            const checkLevel = () => {
              try {
                analyser.getByteFrequencyData(dataArray)
                const level = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length / 255
                maxLevel = Math.max(maxLevel, level)
              } catch (error) {
                // Error during level check - cleanup and reject
                clearInterval(intervalId)
                reject(error)
              }
            }

            intervalId = window.setInterval(checkLevel, 100)

            setTimeout(() => {
              clearInterval(intervalId)

              const success = maxLevel > audioLevelThreshold
              log.info(`Audio input test ${success ? 'passed' : 'failed'} (level: ${maxLevel})`)
              resolve(success)
            }, duration)
          })
        } finally {
          // Always cleanup resources, even on error
          if (intervalId !== undefined) {
            clearInterval(intervalId)
          }
          if (stream) {
            stream.getTracks().forEach((track) => {
              track.stop()
              log.debug(`Stopped audio input test track: ${track.kind}`)
            })
          }
          if (audioContext) {
            await audioContext.close().catch((err) => {
              log.debug('Error closing audio context:', err)
            })
          }
        }
      }
    } catch (error) {
      log.error('Audio input test failed:', error)
      return false
    }
  }

  /**
   * Test audio output device
   *
   * @param deviceId - Device ID (uses selected device if not provided)
   * @returns Promise resolving to true if test passed, false otherwise
   * @throws {Error} If no audio output device is selected and deviceId not provided
   * @remarks Returns false on errors instead of throwing, cleanup is always performed
   */
  const testAudioOutput = async (deviceId?: string): Promise<boolean> => {
    let audioContext: AudioContext | null = null
    let oscillator: OscillatorNode | null = null

    try {
      const targetDeviceId = deviceId || selectedAudioOutputId.value
      if (!targetDeviceId) {
        throw new Error('No audio output device selected')
      }

      log.info(`Testing audio output device: ${targetDeviceId}`)

      // Create test tone
      audioContext = new AudioContext()
      oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Set up test tone (1 kHz, 0.3 volume)
      oscillator.frequency.value = 1000
      gainNode.gain.value = 0.3

      // Play for 500ms
      oscillator.start()
      await new Promise((resolve) => setTimeout(resolve, 500))
      oscillator.stop()

      log.info('Audio output test completed')
      return true
    } catch (error) {
      log.error('Audio output test failed:', error)
      return false
    } finally {
      // Always cleanup resources, even on error
      if (oscillator) {
        try {
          oscillator.stop()
        } catch (err) {
          // Oscillator may already be stopped
          log.debug('Oscillator already stopped:', err)
        }
      }
      if (audioContext) {
        await audioContext.close().catch((err) => {
          log.debug('Error closing audio context:', err)
        })
      }
    }
  }

  // ============================================================================
  // Device Utilities
  // ============================================================================

  /**
   * Get device by ID
   *
   * @param deviceId - Device ID
   * @returns Device or undefined if not found
   */
  const getDeviceById = (deviceId: string): MediaDevice | undefined => {
    return allDevices.value.find((d) => d.deviceId === deviceId)
  }

  /**
   * Get devices by kind
   *
   * @param kind - Device kind
   * @returns Array of devices
   */
  const getDevicesByKind = (kind: MediaDeviceKind): readonly MediaDevice[] => {
    switch (kind) {
      case MediaDeviceKind.AudioInput:
        return audioInputDevices.value
      case MediaDeviceKind.AudioOutput:
        return audioOutputDevices.value
      case MediaDeviceKind.VideoInput:
        return videoInputDevices.value
      default:
        return []
    }
  }

  // ============================================================================
  // Device Change Monitoring
  // ============================================================================

  let deviceChangeListener: (() => void) | null = null

  /**
   * Start device change monitoring
   */
  const startDeviceChangeMonitoring = (): void => {
    if (deviceChangeListener) {
      log.debug('Device change monitoring already started')
      return
    }

    log.info('Starting device change monitoring')

    deviceChangeListener = () => {
      log.info('Device change detected, re-enumerating')
      enumerateDevices().catch((error) => {
        log.error('Failed to re-enumerate devices after change:', error)
      })
    }

    navigator.mediaDevices.addEventListener('devicechange', deviceChangeListener)
    deviceStore.setDeviceChangeListenerAttached()
  }

  /**
   * Stop device change monitoring
   */
  const stopDeviceChangeMonitoring = (): void => {
    if (!deviceChangeListener) {
      log.debug('Device change monitoring not started')
      return
    }

    log.info('Stopping device change monitoring')

    navigator.mediaDevices.removeEventListener('devicechange', deviceChangeListener)
    deviceChangeListener = null
    deviceStore.setDeviceChangeListenerDetached()
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // Initialize on mount
  onMounted(async () => {
    log.debug('Composable mounted')

    // Auto-enumerate if enabled
    if (autoEnumerate) {
      try {
        await enumerateDevices()
      } catch (error) {
        log.error('Auto-enumeration failed:', error)
      }
    }

    // Auto-monitor if enabled
    if (autoMonitor) {
      startDeviceChangeMonitoring()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    log.debug('Composable unmounting, cleaning up')
    stopDeviceChangeMonitoring()

    // Abort any pending async operations
    if (!internalAbortController.value.signal.aborted) {
      log.info('Aborting pending operations on unmount')
      internalAbortController.value.abort()
    }
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    allDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    selectedAudioInputDevice,
    selectedAudioOutputDevice,
    selectedVideoInputDevice,
    audioPermission,
    videoPermission,
    hasAudioPermission,
    hasVideoPermission,
    hasAudioInputDevices,
    hasAudioOutputDevices,
    hasVideoInputDevices,
    totalDevices,
    isEnumerating,
    lastError,

    // Methods
    enumerateDevices,
    requestAudioPermission,
    requestVideoPermission,
    requestPermissions,
    selectAudioInput,
    selectAudioOutput,
    selectVideoInput,
    testAudioInput,
    testAudioOutput,
    getDeviceById,
    getDevicesByKind,
    startDeviceChangeMonitoring,
    stopDeviceChangeMonitoring,
  }
}
