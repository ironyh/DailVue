/**
 * Validation utilities for DailVue
 * @packageDocumentation
 */

import type { SipClientConfig, MediaConfiguration, ValidationResult } from '@/types'

/**
 * Regular expression for validating SIP URIs
 * Supports sip: and sips: schemes
 */
const SIP_URI_REGEX = /^sips?:([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:[0-9]{1,3}\.){3}[0-9]{1,3})(:[0-9]{1,5})?$/

/**
 * Regular expression for validating phone numbers
 * Supports international format with optional + prefix and country code
 */
const PHONE_NUMBER_REGEX = /^\+?[1-9]\d{0,3}[-.\s]?(\d{1,4}[-.\s]?){1,5}\d{1,4}$/

/**
 * Regular expression for validating WebSocket URIs
 */
const WS_URI_REGEX = /^wss?:\/\/([a-zA-Z0-9.-]+)(:[0-9]{1,5})?(\/.*)?$/

/**
 * Validate a SIP URI
 * @param uri - The SIP URI to validate
 * @returns Validation result
 */
export function validateSipUri(uri: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if URI is provided
  if (!uri || uri.trim() === '') {
    errors.push('SIP URI is required')
    return { valid: false, errors }
  }

  // Trim whitespace
  const trimmedUri = uri.trim()

  // Check format
  if (!SIP_URI_REGEX.test(trimmedUri)) {
    errors.push('Invalid SIP URI format. Expected format: sip:user@domain or sips:user@domain')
    return { valid: false, errors }
  }

  // Check for sips (secure) usage
  if (trimmedUri.startsWith('sip:') && !trimmedUri.startsWith('sips:')) {
    warnings.push('Using unsecure SIP URI. Consider using sips: for encrypted connections')
  }

  return {
    valid: true,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate a phone number
 * @param phoneNumber - The phone number to validate
 * @param allowShort - Allow short phone numbers (< 7 digits)
 * @returns Validation result
 */
export function validatePhoneNumber(
  phoneNumber: string,
  allowShort = false
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if phone number is provided
  if (!phoneNumber || phoneNumber.trim() === '') {
    errors.push('Phone number is required')
    return { valid: false, errors }
  }

  // Remove common formatting characters
  const digits = phoneNumber.replace(/[-.\s()]/g, '')

  // Check if it contains only valid characters
  if (!/^[+0-9]+$/.test(digits)) {
    errors.push('Phone number contains invalid characters')
    return { valid: false, errors }
  }

  // Check minimum length
  const digitCount = digits.replace(/\+/g, '').length
  if (!allowShort && digitCount < 7) {
    errors.push('Phone number must be at least 7 digits')
    return { valid: false, errors }
  }

  // Check format
  if (!PHONE_NUMBER_REGEX.test(phoneNumber)) {
    errors.push('Invalid phone number format')
    return { valid: false, errors }
  }

  // Warning for numbers without country code
  if (!digits.startsWith('+')) {
    warnings.push('Phone number does not include country code. International calls may fail')
  }

  return {
    valid: true,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate SIP client configuration
 * @param config - The SIP client configuration to validate
 * @returns Validation result
 */
export function validateSipConfig(config: Partial<SipClientConfig>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!config.uri || config.uri.trim() === '') {
    errors.push('WebSocket server URI is required')
  } else if (!WS_URI_REGEX.test(config.uri)) {
    errors.push('Invalid WebSocket URI format. Expected format: ws://host:port or wss://host:port')
  } else if (config.uri.startsWith('ws:') && !config.uri.startsWith('wss:')) {
    warnings.push('Using unsecure WebSocket connection. Use wss:// for production')
  }

  if (!config.sipUri || config.sipUri.trim() === '') {
    errors.push('SIP URI is required')
  } else {
    const sipUriResult = validateSipUri(config.sipUri)
    if (!sipUriResult.valid) {
      errors.push(...(sipUriResult.errors || []))
    }
    if (sipUriResult.warnings) {
      warnings.push(...sipUriResult.warnings)
    }
  }

  if (!config.password || config.password.trim() === '') {
    if (!config.ha1 || config.ha1.trim() === '') {
      errors.push('Either password or HA1 hash is required')
    }
  }

  // Validate password strength
  if (config.password && config.password.length < 8) {
    warnings.push('Password is weak. Consider using at least 8 characters')
  }

  // Validate optional fields
  if (config.wsOptions) {
    if (config.wsOptions.connectionTimeout !== undefined) {
      if (config.wsOptions.connectionTimeout < 1000) {
        warnings.push('Connection timeout is very short. May cause connection issues')
      } else if (config.wsOptions.connectionTimeout > 60000) {
        warnings.push('Connection timeout is very long. Users may experience delays')
      }
    }

    if (config.wsOptions.maxReconnectionAttempts !== undefined) {
      if (config.wsOptions.maxReconnectionAttempts < 1) {
        errors.push('maxReconnectionAttempts must be at least 1')
      } else if (config.wsOptions.maxReconnectionAttempts > 10) {
        warnings.push('Many reconnection attempts may delay failure detection')
      }
    }

    if (config.wsOptions.reconnectionDelay !== undefined) {
      if (config.wsOptions.reconnectionDelay < 100) {
        warnings.push('Reconnection delay is very short. May overwhelm server')
      }
    }
  }

  if (config.registrationOptions) {
    if (config.registrationOptions.expires !== undefined) {
      if (config.registrationOptions.expires < 60) {
        warnings.push('Registration expires time is very short. May cause frequent re-registrations')
      } else if (config.registrationOptions.expires > 3600) {
        warnings.push('Registration expires time is very long. May delay failure detection')
      }
    }
  }

  if (config.sessionOptions) {
    if (config.sessionOptions.maxConcurrentCalls !== undefined) {
      if (config.sessionOptions.maxConcurrentCalls < 1) {
        errors.push('maxConcurrentCalls must be at least 1')
      } else if (config.sessionOptions.maxConcurrentCalls > 10) {
        warnings.push('High number of concurrent calls may impact performance')
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
 * Validate media configuration
 * @param config - The media configuration to validate
 * @returns Validation result
 */
export function validateMediaConfig(config: Partial<MediaConfiguration>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Both audio and video cannot be false
  if (config.audio === false && config.video === false) {
    errors.push('At least one of audio or video must be enabled')
  }

  // Validate audio codec
  if (config.audioCodec) {
    const validAudioCodecs = ['opus', 'pcmu', 'pcma', 'g722']
    if (!validAudioCodecs.includes(config.audioCodec)) {
      errors.push(`Invalid audio codec. Supported codecs: ${validAudioCodecs.join(', ')}`)
    }
  }

  // Validate video codec
  if (config.videoCodec) {
    const validVideoCodecs = ['vp8', 'vp9', 'h264']
    if (!validVideoCodecs.includes(config.videoCodec)) {
      errors.push(`Invalid video codec. Supported codecs: ${validVideoCodecs.join(', ')}`)
    }
  }

  // Validate constraints
  if (typeof config.audio === 'object' && config.audio) {
    if ('sampleRate' in config.audio) {
      const sampleRate = (config.audio as any).sampleRate
      if (typeof sampleRate === 'number' && sampleRate < 8000) {
        warnings.push('Audio sample rate is very low. May result in poor audio quality')
      }
    }

    if ('channelCount' in config.audio) {
      const channelCount = (config.audio as any).channelCount
      if (typeof channelCount === 'number' && channelCount > 2) {
        warnings.push('Audio channel count > 2 is uncommon for VoIP')
      }
    }
  }

  if (typeof config.video === 'object' && config.video) {
    if ('width' in config.video || 'height' in config.video) {
      const width = (config.video as any).width
      const height = (config.video as any).height

      if (typeof width === 'number' && width > 1920) {
        warnings.push('Video width > 1920px may impact performance')
      }
      if (typeof height === 'number' && height > 1080) {
        warnings.push('Video height > 1080px may impact performance')
      }
    }

    if ('frameRate' in config.video) {
      const frameRate = (config.video as any).frameRate
      if (typeof frameRate === 'number' && frameRate > 30) {
        warnings.push('High frame rate may impact performance and bandwidth')
      }
    }
  }

  // Audio processing features
  if (config.echoCancellation === false) {
    warnings.push('Echo cancellation is disabled. May cause echo issues')
  }

  if (config.noiseSuppression === false) {
    warnings.push('Noise suppression is disabled. Background noise may be audible')
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate a hostname or IP address
 * @param host - The hostname or IP to validate
 * @returns Validation result
 */
export function validateHost(host: string): ValidationResult {
  const errors: string[] = []

  if (!host || host.trim() === '') {
    errors.push('Host is required')
    return { valid: false, errors }
  }

  const trimmedHost = host.trim()

  // Check for valid hostname or IP
  const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/

  if (!hostnameRegex.test(trimmedHost) && !ipv4Regex.test(trimmedHost) && !ipv6Regex.test(trimmedHost)) {
    errors.push('Invalid hostname or IP address')
    return { valid: false, errors }
  }

  // Validate IPv4 octets if it's an IP
  if (ipv4Regex.test(trimmedHost)) {
    const octets = trimmedHost.split('.').map(Number)
    if (octets.some(octet => octet < 0 || octet > 255)) {
      errors.push('Invalid IPv4 address. Octets must be between 0 and 255')
      return { valid: false, errors }
    }
  }

  return { valid: true }
}

/**
 * Validate a port number
 * @param port - The port number to validate
 * @returns Validation result
 */
export function validatePort(port: number): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Number.isInteger(port)) {
    errors.push('Port must be an integer')
    return { valid: false, errors }
  }

  if (port < 1 || port > 65535) {
    errors.push('Port must be between 1 and 65535')
    return { valid: false, errors }
  }

  // Common well-known ports
  if (port < 1024) {
    warnings.push('Using well-known port (< 1024). May require elevated privileges')
  }

  return {
    valid: true,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
