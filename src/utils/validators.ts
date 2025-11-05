/**
 * VueSip Validators
 *
 * Validation functions for SIP URIs, phone numbers, configurations, and other inputs.
 * All validators return a consistent ValidationResult structure.
 *
 * @module utils/validators
 */

import type { SipClientConfig, MediaConfiguration } from '../types/config.types'
import { SIP_URI_REGEX, E164_PHONE_REGEX, WEBSOCKET_URL_REGEX } from './constants'

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the input is valid */
  valid: boolean
  /** Error message if validation failed */
  error: string | null
  /** Normalized/cleaned version of the input if valid */
  normalized: string | null
}

/**
 * Validates a SIP URI
 *
 * Checks if the URI follows the format: sip:user@domain or sips:user@domain
 * Optionally includes port, parameters, and headers.
 *
 * @param uri - The SIP URI to validate
 * @returns Validation result with normalized URI
 *
 * @example
 * ```typescript
 * const result = validateSipUri('sip:alice@example.com')
 * if (result.valid) {
 *   console.log('Normalized URI:', result.normalized)
 * }
 * ```
 */
export function validateSipUri(uri: string): ValidationResult {
  if (!uri || typeof uri !== 'string') {
    return {
      valid: false,
      error: 'SIP URI must be a non-empty string',
      normalized: null,
    }
  }

  const trimmed = uri.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: 'SIP URI cannot be empty',
      normalized: null,
    }
  }

  // Check basic format
  const match = SIP_URI_REGEX.exec(trimmed)
  if (!match) {
    return {
      valid: false,
      error: 'Invalid SIP URI format. Expected: sip:user@domain or sips:user@domain',
      normalized: null,
    }
  }

  const [, user, domain, port] = match

  // Validate user part
  if (!user || user.length === 0) {
    return {
      valid: false,
      error: 'SIP URI must include a user part',
      normalized: null,
    }
  }

  // Validate domain part
  if (!domain || domain.length === 0) {
    return {
      valid: false,
      error: 'SIP URI must include a domain',
      normalized: null,
    }
  }

  // Validate port if present
  if (port) {
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return {
        valid: false,
        error: 'Invalid port number. Must be between 1 and 65535',
        normalized: null,
      }
    }
  }

  // Normalize: lowercase scheme and domain
  const scheme = trimmed.startsWith('sips:') ? 'sips' : 'sip'
  const normalized = `${scheme}:${user}@${domain.toLowerCase()}${port ? `:${port}` : ''}`

  return {
    valid: true,
    error: null,
    normalized,
  }
}

/**
 * Validates a phone number
 *
 * Checks if the number is in E.164 format: +[country code][number]
 * E.164 format: + followed by country code and subscriber number (max 15 digits)
 *
 * @param number - The phone number to validate
 * @returns Validation result with normalized number
 *
 * @example
 * ```typescript
 * const result = validatePhoneNumber('+14155551234')
 * if (result.valid) {
 *   console.log('Valid E.164 number:', result.normalized)
 * }
 * ```
 */
export function validatePhoneNumber(number: string): ValidationResult {
  if (!number || typeof number !== 'string') {
    return {
      valid: false,
      error: 'Phone number must be a non-empty string',
      normalized: null,
    }
  }

  const trimmed = number.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: 'Phone number cannot be empty',
      normalized: null,
    }
  }

  // Check E.164 format
  if (!E164_PHONE_REGEX.test(trimmed)) {
    return {
      valid: false,
      error:
        'Invalid phone number format. Expected E.164 format: +[country code][number] (max 15 digits)',
      normalized: null,
    }
  }

  return {
    valid: true,
    error: null,
    normalized: trimmed,
  }
}

/**
 * Validates a SIP client configuration
 *
 * Checks all required fields and validates their formats.
 *
 * @param config - The SIP client configuration to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const config: SipClientConfig = {
 *   uri: 'sip:alice@example.com',
 *   password: 'secret',
 *   websocketServer: 'wss://sip.example.com:7443'
 * }
 * const result = validateSipConfig(config)
 * ```
 */
export function validateSipConfig(config: Partial<SipClientConfig>): ValidationResult {
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      error: 'Configuration must be an object',
      normalized: null,
    }
  }

  // Check required fields
  if (!config.uri) {
    return {
      valid: false,
      error: 'SIP URI is required',
      normalized: null,
    }
  }

  if (!config.password) {
    return {
      valid: false,
      error: 'Password is required',
      normalized: null,
    }
  }

  if (!config.websocketServer) {
    return {
      valid: false,
      error: 'WebSocket server URL is required',
      normalized: null,
    }
  }

  // Validate URI format
  const uriResult = validateSipUri(config.uri)
  if (!uriResult.valid) {
    return {
      valid: false,
      error: `Invalid SIP URI: ${uriResult.error}`,
      normalized: null,
    }
  }

  // Validate WebSocket URL
  const wsUrlResult = validateWebSocketUrl(config.websocketServer)
  if (!wsUrlResult.valid) {
    return {
      valid: false,
      error: `Invalid WebSocket URL: ${wsUrlResult.error}`,
      normalized: null,
    }
  }

  // Warn about insecure WebSocket in production (but don't fail validation)
  if (config.websocketServer.startsWith('ws://') && process.env.NODE_ENV === 'production') {
    console.warn(
      'Warning: Using insecure WebSocket (ws://) in production. Use wss:// for secure connections.'
    )
  }

  // Validate optional registerExpires
  if (config.registerExpires !== undefined) {
    if (typeof config.registerExpires !== 'number' || config.registerExpires < 60) {
      return {
        valid: false,
        error: 'registerExpires must be a number >= 60 seconds',
        normalized: null,
      }
    }
  }

  // Validate optional sessionTimers
  if (config.sessionTimers !== undefined) {
    if (typeof config.sessionTimers !== 'boolean') {
      return {
        valid: false,
        error: 'sessionTimers must be a boolean',
        normalized: null,
      }
    }
  }

  // Validate optional noAnswerTimeout
  if (config.noAnswerTimeout !== undefined) {
    if (typeof config.noAnswerTimeout !== 'number' || config.noAnswerTimeout < 10) {
      return {
        valid: false,
        error: 'noAnswerTimeout must be a number >= 10 seconds',
        normalized: null,
      }
    }
  }

  // Validate optional iceTransportPolicy
  if (config.iceTransportPolicy !== undefined) {
    if (config.iceTransportPolicy !== 'all' && config.iceTransportPolicy !== 'relay') {
      return {
        valid: false,
        error: 'iceTransportPolicy must be "all" or "relay"',
        normalized: null,
      }
    }
  }

  return {
    valid: true,
    error: null,
    normalized: null,
  }
}

/**
 * Validates a media configuration
 *
 * Checks media constraints and device settings.
 *
 * @param config - The media configuration to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const config: MediaConfiguration = {
 *   audio: { enabled: true, echoCancellation: true },
 *   video: { enabled: false }
 * }
 * const result = validateMediaConfig(config)
 * ```
 */
export function validateMediaConfig(config: Partial<MediaConfiguration>): ValidationResult {
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      error: 'Media configuration must be an object',
      normalized: null,
    }
  }

  // Validate audio configuration if present
  if (config.audio) {
    if (typeof config.audio !== 'object') {
      return {
        valid: false,
        error: 'Audio configuration must be an object',
        normalized: null,
      }
    }

    if (config.audio.enabled !== undefined && typeof config.audio.enabled !== 'boolean') {
      return {
        valid: false,
        error: 'audio.enabled must be a boolean',
        normalized: null,
      }
    }

    if (
      config.audio.echoCancellation !== undefined &&
      typeof config.audio.echoCancellation !== 'boolean'
    ) {
      return {
        valid: false,
        error: 'audio.echoCancellation must be a boolean',
        normalized: null,
      }
    }

    if (
      config.audio.noiseSuppression !== undefined &&
      typeof config.audio.noiseSuppression !== 'boolean'
    ) {
      return {
        valid: false,
        error: 'audio.noiseSuppression must be a boolean',
        normalized: null,
      }
    }

    if (
      config.audio.autoGainControl !== undefined &&
      typeof config.audio.autoGainControl !== 'boolean'
    ) {
      return {
        valid: false,
        error: 'audio.autoGainControl must be a boolean',
        normalized: null,
      }
    }

    if (config.audio.deviceId !== undefined && config.audio.deviceId !== null) {
      if (typeof config.audio.deviceId !== 'string') {
        return {
          valid: false,
          error: 'audio.deviceId must be a string',
          normalized: null,
        }
      }
    }
  }

  // Validate video configuration if present
  if (config.video) {
    if (typeof config.video !== 'object') {
      return {
        valid: false,
        error: 'Video configuration must be an object',
        normalized: null,
      }
    }

    if (config.video.enabled !== undefined && typeof config.video.enabled !== 'boolean') {
      return {
        valid: false,
        error: 'video.enabled must be a boolean',
        normalized: null,
      }
    }

    if (config.video.width !== undefined && typeof config.video.width !== 'number') {
      return {
        valid: false,
        error: 'video.width must be a number',
        normalized: null,
      }
    }

    if (config.video.height !== undefined && typeof config.video.height !== 'number') {
      return {
        valid: false,
        error: 'video.height must be a number',
        normalized: null,
      }
    }

    if (config.video.frameRate !== undefined && typeof config.video.frameRate !== 'number') {
      return {
        valid: false,
        error: 'video.frameRate must be a number',
        normalized: null,
      }
    }

    if (config.video.facingMode !== undefined) {
      if (config.video.facingMode !== 'user' && config.video.facingMode !== 'environment') {
        return {
          valid: false,
          error: 'video.facingMode must be "user" or "environment"',
          normalized: null,
        }
      }
    }

    if (config.video.deviceId !== undefined && config.video.deviceId !== null) {
      if (typeof config.video.deviceId !== 'string') {
        return {
          valid: false,
          error: 'video.deviceId must be a string',
          normalized: null,
        }
      }
    }
  }

  return {
    valid: true,
    error: null,
    normalized: null,
  }
}

/**
 * Validates a WebSocket URL
 *
 * Checks if the URL is a valid WebSocket URL (ws:// or wss://)
 *
 * @param url - The WebSocket URL to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateWebSocketUrl('wss://sip.example.com:7443')
 * ```
 */
export function validateWebSocketUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'WebSocket URL must be a non-empty string',
      normalized: null,
    }
  }

  const trimmed = url.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: 'WebSocket URL cannot be empty',
      normalized: null,
    }
  }

  if (!WEBSOCKET_URL_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid WebSocket URL format. Expected: ws:// or wss://',
      normalized: null,
    }
  }

  // Try to parse as URL to validate structure
  try {
    const parsedUrl = new URL(trimmed)

    if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') {
      return {
        valid: false,
        error: 'WebSocket URL must use ws:// or wss:// protocol',
        normalized: null,
      }
    }

    if (!parsedUrl.hostname) {
      return {
        valid: false,
        error: 'WebSocket URL must include a hostname',
        normalized: null,
      }
    }

    return {
      valid: true,
      error: null,
      normalized: trimmed,
    }
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      normalized: null,
    }
  }
}

/**
 * Validates a DTMF tone
 *
 * Checks if the tone is a valid DTMF character (0-9, *, #, A-D)
 *
 * @param tone - The DTMF tone to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateDtmfTone('1')
 * ```
 */
export function validateDtmfTone(tone: string): ValidationResult {
  if (!tone || typeof tone !== 'string') {
    return {
      valid: false,
      error: 'DTMF tone must be a non-empty string',
      normalized: null,
    }
  }

  if (tone.length !== 1) {
    return {
      valid: false,
      error: 'DTMF tone must be a single character',
      normalized: null,
    }
  }

  const validTones = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '*',
    '#',
    'A',
    'B',
    'C',
    'D',
  ]
  const upperTone = tone.toUpperCase()

  if (!validTones.includes(upperTone)) {
    return {
      valid: false,
      error: 'Invalid DTMF tone. Valid tones: 0-9, *, #, A-D',
      normalized: null,
    }
  }

  return {
    valid: true,
    error: null,
    normalized: upperTone,
  }
}

/**
 * Validates a DTMF tone sequence
 *
 * Checks if all tones in the sequence are valid
 *
 * @param sequence - The DTMF sequence to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateDtmfSequence('1234*#')
 * ```
 */
export function validateDtmfSequence(sequence: string): ValidationResult {
  if (!sequence || typeof sequence !== 'string') {
    return {
      valid: false,
      error: 'DTMF sequence must be a non-empty string',
      normalized: null,
    }
  }

  if (sequence.length === 0) {
    return {
      valid: false,
      error: 'DTMF sequence cannot be empty',
      normalized: null,
    }
  }

  const normalized: string[] = []

  for (let i = 0; i < sequence.length; i++) {
    const tone = sequence[i]
    const result = validateDtmfTone(tone)

    if (!result.valid) {
      return {
        valid: false,
        error: `Invalid tone at position ${i + 1}: ${result.error}`,
        normalized: null,
      }
    }

    if (result.normalized) {
      normalized.push(result.normalized)
    }
  }

  return {
    valid: true,
    error: null,
    normalized: normalized.join(''),
  }
}
