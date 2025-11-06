/**
 * Provider type definitions for VueSip
 * @packageDocumentation
 */

import type { InjectionKey } from 'vue'
import type {
  SipClientConfig,
  MediaConfiguration,
  UserPreferences,
  ValidationResult,
} from './config.types'

/**
 * Configuration Provider Context
 *
 * Provides configuration management functionality to child components
 */
export interface ConfigProviderContext {
  /** Current SIP configuration (readonly) */
  readonly sipConfig: SipClientConfig | null

  /** Current media configuration (readonly) */
  readonly mediaConfig: MediaConfiguration

  /** Current user preferences (readonly) */
  readonly userPreferences: UserPreferences

  /** Whether SIP configuration is set */
  readonly hasSipConfig: boolean

  /** Whether configuration is valid */
  readonly isConfigValid: boolean

  /** Last validation result */
  readonly lastValidation: ValidationResult | null

  /**
   * Set SIP configuration
   * @param config - SIP client configuration
   * @param validate - Whether to validate configuration (default: true)
   * @returns Validation result
   */
  setSipConfig(config: SipClientConfig, validate?: boolean): ValidationResult

  /**
   * Update SIP configuration (partial update)
   * @param updates - Partial SIP configuration updates
   * @param validate - Whether to validate after update (default: true)
   * @returns Validation result
   */
  updateSipConfig(updates: Partial<SipClientConfig>, validate?: boolean): ValidationResult

  /**
   * Set media configuration
   * @param config - Media configuration
   * @param validate - Whether to validate configuration (default: true)
   * @returns Validation result
   */
  setMediaConfig(config: MediaConfiguration, validate?: boolean): ValidationResult

  /**
   * Update media configuration (partial update)
   * @param updates - Partial media configuration updates
   * @param validate - Whether to validate after update (default: true)
   * @returns Validation result
   */
  updateMediaConfig(updates: Partial<MediaConfiguration>, validate?: boolean): ValidationResult

  /**
   * Set user preferences
   * @param preferences - User preferences
   */
  setUserPreferences(preferences: UserPreferences): void

  /**
   * Update user preferences (partial update)
   * @param updates - Partial user preferences updates
   */
  updateUserPreferences(updates: Partial<UserPreferences>): void

  /**
   * Validate all configurations
   * @returns Combined validation result
   */
  validateAll(): ValidationResult

  /**
   * Reset configuration to initial state
   */
  reset(): void
}

/**
 * Injection key for ConfigProvider
 */
export const CONFIG_PROVIDER_KEY: InjectionKey<ConfigProviderContext> =
  Symbol('vuesip:config-provider')

/**
 * Configuration Provider Props
 */
export interface ConfigProviderProps {
  /** Initial SIP configuration */
  sipConfig?: SipClientConfig

  /** Initial media configuration */
  mediaConfig?: MediaConfiguration

  /** Initial user preferences */
  userPreferences?: UserPreferences

  /** Whether to validate configuration on mount (default: true) */
  validateOnMount?: boolean

  /** Whether to automatically merge configuration with existing (default: false) */
  autoMerge?: boolean
}

// ============================================================================
// Media Provider Types
// ============================================================================

import type { MediaDevice, PermissionStatus } from './media.types'

/**
 * Media Provider Context
 *
 * Provides media device management functionality to child components
 */
export interface MediaProviderContext {
  // Readonly state - devices
  /** Available audio input devices */
  readonly audioInputDevices: MediaDevice[]

  /** Available audio output devices */
  readonly audioOutputDevices: MediaDevice[]

  /** Available video input devices */
  readonly videoInputDevices: MediaDevice[]

  /** All available devices */
  readonly allDevices: MediaDevice[]

  // Readonly state - selected devices
  /** Selected audio input device ID */
  readonly selectedAudioInputId: string | null

  /** Selected audio output device ID */
  readonly selectedAudioOutputId: string | null

  /** Selected video input device ID */
  readonly selectedVideoInputId: string | null

  /** Selected audio input device */
  readonly selectedAudioInputDevice: MediaDevice | undefined

  /** Selected audio output device */
  readonly selectedAudioOutputDevice: MediaDevice | undefined

  /** Selected video input device */
  readonly selectedVideoInputDevice: MediaDevice | undefined

  // Readonly state - permissions
  /** Audio permission status */
  readonly audioPermission: PermissionStatus

  /** Video permission status */
  readonly videoPermission: PermissionStatus

  /** Whether audio permission is granted */
  readonly hasAudioPermission: boolean

  /** Whether video permission is granted */
  readonly hasVideoPermission: boolean

  // Readonly state - counts
  /** Whether audio input devices are available */
  readonly hasAudioInputDevices: boolean

  /** Whether audio output devices are available */
  readonly hasAudioOutputDevices: boolean

  /** Whether video input devices are available */
  readonly hasVideoInputDevices: boolean

  /** Total number of devices */
  readonly totalDevices: number

  // Readonly state - operation status
  /** Whether devices are being enumerated */
  readonly isEnumerating: boolean

  /** Last error that occurred */
  readonly lastError: Error | null

  // Methods - device management
  /**
   * Enumerate available media devices
   * @returns Promise resolving to array of devices
   */
  enumerateDevices(): Promise<MediaDevice[]>

  /**
   * Get device by ID
   * @param deviceId - Device ID to find
   * @returns Device if found, undefined otherwise
   */
  getDeviceById(deviceId: string): MediaDevice | undefined

  // Methods - device selection
  /**
   * Select audio input device
   * @param deviceId - Device ID to select
   */
  selectAudioInput(deviceId: string): void

  /**
   * Select audio output device
   * @param deviceId - Device ID to select
   */
  selectAudioOutput(deviceId: string): void

  /**
   * Select video input device
   * @param deviceId - Device ID to select
   */
  selectVideoInput(deviceId: string): void

  // Methods - permissions
  /**
   * Request audio permission
   * @returns Promise resolving to true if granted, false otherwise
   */
  requestAudioPermission(): Promise<boolean>

  /**
   * Request video permission
   * @returns Promise resolving to true if granted, false otherwise
   */
  requestVideoPermission(): Promise<boolean>

  /**
   * Request permissions for audio and/or video
   * @param audio - Whether to request audio permission (default: true)
   * @param video - Whether to request video permission (default: false)
   */
  requestPermissions(audio?: boolean, video?: boolean): Promise<void>

  // Methods - device testing
  /**
   * Test audio input device
   * @param deviceId - Optional device ID to test (defaults to selected device)
   * @param options - Test options (duration, audioLevelThreshold)
   * @returns Promise resolving to true if test passed
   */
  testAudioInput(
    deviceId?: string,
    options?: { duration?: number; audioLevelThreshold?: number }
  ): Promise<boolean>

  /**
   * Test audio output device
   * @param deviceId - Optional device ID to test (defaults to selected device)
   * @returns Promise resolving to true if test passed
   */
  testAudioOutput(deviceId?: string): Promise<boolean>
}

/**
 * Injection key for MediaProvider
 */
export const MEDIA_PROVIDER_KEY: InjectionKey<MediaProviderContext> =
  Symbol('vuesip:media-provider')

/**
 * Media Provider Props
 */
export interface MediaProviderProps {
  /** Initial media configuration */
  mediaConfig?: MediaConfiguration

  /** Whether to automatically enumerate devices on mount (default: true) */
  autoEnumerate?: boolean

  /** Whether to automatically request permissions on mount (default: false) */
  autoRequestPermissions?: boolean

  /** Request audio permission on mount (only if autoRequestPermissions is true, default: true) */
  requestAudio?: boolean

  /** Request video permission on mount (only if autoRequestPermissions is true, default: false) */
  requestVideo?: boolean

  /** Whether to automatically monitor device changes (default: true) */
  watchDeviceChanges?: boolean

  /** Whether to automatically select default devices after enumeration (default: true) */
  autoSelectDefaults?: boolean
}
