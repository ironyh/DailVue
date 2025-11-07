/**
 * VueSip Validators
 *
 * Validation functions for SIP URIs, phone numbers, configurations, and other inputs.
 * All validators return a consistent ValidationResult structure.
 *
 * @module utils/validators
 */

import type { SipClientConfig, MediaConfiguration, ValidationResult } from '../types/config.types'
import { SIP_URI_REGEX, E164_PHONE_REGEX, WEBSOCKET_URL_REGEX } from './constants'

/**
 * Result of a simple validation operation (for helper validators)
 * @internal
 */
export interface SimpleValidationResult {
  /** Whether the input is valid */
  valid: boolean
  /** Alias for valid (backward compatibility) */
  isValid?: boolean
  /** Error message if validation failed */
  error: string | null
  /** Errors array (backward compatibility - same as error but in array form) */
  errors?: string[]
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
export function validateSipUri(uri: string): SimpleValidationResult {
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
export function validatePhoneNumber(number: string): SimpleValidationResult {
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
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:alice@example.com',
 *   password: 'secret'
 * }
 * const result = validateSipConfig(config)
 * ```
 */
export function validateSipConfig(config: Partial<SipClientConfig>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: ['Configuration must be an object'],
    }
  }

  // Check required fields
  if (!config.uri) {
    errors.push('WebSocket server URI (uri) is required')
  } else {
    // Validate WebSocket URL format
    const wsUrlResult = validateWebSocketUrl(config.uri)
    if (!wsUrlResult.valid) {
      errors.push(`Invalid WebSocket URL: ${wsUrlResult.error}`)
    } else {
      // Warn about insecure WebSocket in production
      if (config.uri.startsWith('ws://') && process.env.NODE_ENV === 'production') {
        warnings.push(
          'Using insecure WebSocket (ws://) in production. Use wss:// for secure connections.'
        )
      }
    }
  }

  if (!config.sipUri) {
    errors.push('SIP user URI (sipUri) is required')
  } else {
    // Validate SIP URI format
    const sipUriResult = validateSipUri(config.sipUri)
    if (!sipUriResult.valid) {
      errors.push(`Invalid SIP URI: ${sipUriResult.error}`)
    }
  }

  if (!config.password && !config.ha1) {
    errors.push('Either password or ha1 is required for authentication')
  }

  // Validate nested registration options
  if (config.registrationOptions) {
    if (config.registrationOptions.expires !== undefined) {
      if (
        typeof config.registrationOptions.expires !== 'number' ||
        config.registrationOptions.expires < 60
      ) {
        errors.push('registrationOptions.expires must be a number >= 60 seconds')
      }
    }

    if (config.registrationOptions.autoRegister !== undefined) {
      if (typeof config.registrationOptions.autoRegister !== 'boolean') {
        errors.push('registrationOptions.autoRegister must be a boolean')
      }
    }
  }

  // Validate nested session options
  if (config.sessionOptions) {
    if (config.sessionOptions.sessionTimers !== undefined) {
      if (typeof config.sessionOptions.sessionTimers !== 'boolean') {
        errors.push('sessionOptions.sessionTimers must be a boolean')
      }
    }

    if (config.sessionOptions.callTimeout !== undefined) {
      if (
        typeof config.sessionOptions.callTimeout !== 'number' ||
        config.sessionOptions.callTimeout < 10000
      ) {
        errors.push('sessionOptions.callTimeout must be a number >= 10000 milliseconds')
      }
    }

    if (config.sessionOptions.maxConcurrentCalls !== undefined) {
      if (
        typeof config.sessionOptions.maxConcurrentCalls !== 'number' ||
        config.sessionOptions.maxConcurrentCalls < 1
      ) {
        errors.push('sessionOptions.maxConcurrentCalls must be a number >= 1')
      }
    }
  }

  // Validate nested RTC configuration
  if (config.rtcConfiguration) {
    if (config.rtcConfiguration.iceTransportPolicy !== undefined) {
      if (
        config.rtcConfiguration.iceTransportPolicy !== 'all' &&
        config.rtcConfiguration.iceTransportPolicy !== 'relay'
      ) {
        errors.push('rtcConfiguration.iceTransportPolicy must be "all" or "relay"')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
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
 *   audio: true,
 *   video: false,
 *   echoCancellation: true,
 *   noiseSuppression: true
 * }
 * const result = validateMediaConfig(config)
 * ```
 */
export function validateMediaConfig(config: Partial<MediaConfiguration>): ValidationResult {
  const errors: string[] = []

  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: ['Media configuration must be an object'],
    }
  }

  // Validate audio - can be boolean or MediaTrackConstraints
  if (config.audio !== undefined) {
    if (typeof config.audio !== 'boolean' && typeof config.audio !== 'object') {
      errors.push('audio must be a boolean or MediaTrackConstraints object')
    }
  }

  // Validate video - can be boolean or MediaTrackConstraints
  if (config.video !== undefined) {
    if (typeof config.video !== 'boolean' && typeof config.video !== 'object') {
      errors.push('video must be a boolean or MediaTrackConstraints object')
    }
  }

  // Validate top-level boolean properties
  if (config.echoCancellation !== undefined && typeof config.echoCancellation !== 'boolean') {
    errors.push('echoCancellation must be a boolean')
  }

  if (config.noiseSuppression !== undefined && typeof config.noiseSuppression !== 'boolean') {
    errors.push('noiseSuppression must be a boolean')
  }

  if (config.autoGainControl !== undefined && typeof config.autoGainControl !== 'boolean') {
    errors.push('autoGainControl must be a boolean')
  }

  // Validate codec properties
  if (config.audioCodec !== undefined) {
    const validAudioCodecs = ['opus', 'pcmu', 'pcma', 'g722']
    if (!validAudioCodecs.includes(config.audioCodec)) {
      errors.push(`audioCodec must be one of: ${validAudioCodecs.join(', ')}`)
    }
  }

  if (config.videoCodec !== undefined) {
    const validVideoCodecs = ['vp8', 'vp9', 'h264']
    if (!validVideoCodecs.includes(config.videoCodec)) {
      errors.push(`videoCodec must be one of: ${validVideoCodecs.join(', ')}`)
    }
  }

  // Validate dataChannel
  if (config.dataChannel !== undefined && typeof config.dataChannel !== 'boolean') {
    errors.push('dataChannel must be a boolean')
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
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
export function validateWebSocketUrl(url: string): SimpleValidationResult {
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
export function validateDtmfTone(tone: string): SimpleValidationResult {
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
export function validateDtmfSequence(sequence: string): SimpleValidationResult {
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
    if (!tone) continue
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
