/**
 * Validation utilities for DailVue
 * @packageDocumentation
 */

import type { ValidationResult, SipClientConfig, MediaConfiguration } from '@/types'

/**
 * SIP URI regex pattern
 * Matches: sip:user@host or sips:user@host with optional parameters
 */
const SIP_URI_REGEX =
  /^(sip|sips):([a-zA-Z0-9\-_.!~*'()&=+$,;?/])+@([a-zA-Z0-9\-_.]+\.)*[a-zA-Z0-9\-_.]+(:[\d]+)?(;[^\s]*)?$/

/**
 * WebSocket URI regex pattern
 * Matches: ws://host or wss://host with optional port and path
 */
const WS_URI_REGEX = /^(ws|wss):\/\/([a-zA-Z0-9\-_.]+\.)*[a-zA-Z0-9\-_.]+(:[\d]+)?(\/[^\s]*)?$/

/**
 * Phone number regex pattern (E.164 format)
 * Matches: +[country code][number] with 7-15 digits
 */
const PHONE_NUMBER_REGEX = /^\+?[1-9]\d{6,14}$/

/**
 * Validate a SIP URI
 */
export function validateSipUri(uri: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!uri || typeof uri !== 'string') {
    errors.push('SIP URI is required and must be a string')
    return { valid: false, errors }
  }

  const trimmedUri = uri.trim()

  if (trimmedUri.length === 0) {
    errors.push('SIP URI cannot be empty')
    return { valid: false, errors }
  }

  if (!SIP_URI_REGEX.test(trimmedUri)) {
    errors.push(
      'Invalid SIP URI format. Expected format: sip:user@host or sips:user@host'
    )
    return { valid: false, errors }
  }

  // Check if using secure transport
  if (!trimmedUri.startsWith('sips:')) {
    warnings.push('Consider using SIPS (sips:) for secure communication')
  }

  // Extract and validate parts
  const schemeEnd = trimmedUri.indexOf(':')
  const atIndex = trimmedUri.indexOf('@')

  if (atIndex === -1) {
    errors.push('SIP URI must contain @ symbol')
    return { valid: false, errors }
  }

  const user = trimmedUri.substring(schemeEnd + 1, atIndex)
  if (user.length === 0) {
    errors.push('SIP URI user part cannot be empty')
    return { valid: false, errors }
  }

  const hostPart = trimmedUri.substring(atIndex + 1).split(';')[0] || ''
  const host = hostPart.split(':')[0] || ''

  if (host.length === 0) {
    errors.push('SIP URI host part cannot be empty')
    return { valid: false, errors }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate a WebSocket URI
 */
export function validateWebSocketUri(uri: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!uri || typeof uri !== 'string') {
    errors.push('WebSocket URI is required and must be a string')
    return { valid: false, errors }
  }

  const trimmedUri = uri.trim()

  if (trimmedUri.length === 0) {
    errors.push('WebSocket URI cannot be empty')
    return { valid: false, errors }
  }

  if (!WS_URI_REGEX.test(trimmedUri)) {
    errors.push('Invalid WebSocket URI format. Expected format: ws://host or wss://host')
    return { valid: false, errors }
  }

  // Check if using secure WebSocket
  if (!trimmedUri.startsWith('wss:')) {
    warnings.push('Consider using WSS (wss://) for secure communication')
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate a phone number
 */
export function validatePhoneNumber(phoneNumber: string): ValidationResult {
  const errors: string[] = []

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    errors.push('Phone number is required and must be a string')
    return { valid: false, errors }
  }

  // Remove common formatting characters
  const cleaned = phoneNumber.replace(/[\s\-()]/g, '')

  if (cleaned.length === 0) {
    errors.push('Phone number cannot be empty')
    return { valid: false, errors }
  }

  if (!PHONE_NUMBER_REGEX.test(cleaned)) {
    errors.push(
      'Invalid phone number format. Expected E.164 format: +[country code][number]'
    )
    return { valid: false, errors }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate SIP client configuration
 */
export function validateSipConfig(config: SipClientConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate required fields
  if (!config) {
    errors.push('SIP configuration is required')
    return { valid: false, errors }
  }

  // Validate WebSocket URI
  if (!config.uri) {
    errors.push('WebSocket URI is required')
  } else {
    const uriResult = validateWebSocketUri(config.uri)
    if (!uriResult.valid) {
      errors.push(...(uriResult.errors || []))
    }
    if (uriResult.warnings) {
      warnings.push(...uriResult.warnings)
    }
  }

  // Validate SIP URI
  if (!config.sipUri) {
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

  // Validate authentication
  if (!config.password && !config.ha1) {
    errors.push('Either password or HA1 hash is required for authentication')
  }

  if (config.password && config.ha1) {
    warnings.push('Both password and HA1 are provided. HA1 will take precedence')
  }

  // Validate display name
  if (config.displayName && typeof config.displayName !== 'string') {
    errors.push('Display name must be a string')
  }

  // Validate WebSocket options
  if (config.wsOptions) {
    if (
      config.wsOptions.connectionTimeout !== undefined &&
      (typeof config.wsOptions.connectionTimeout !== 'number' ||
        config.wsOptions.connectionTimeout <= 0)
    ) {
      errors.push('Connection timeout must be a positive number')
    }

    if (
      config.wsOptions.maxReconnectionAttempts !== undefined &&
      (typeof config.wsOptions.maxReconnectionAttempts !== 'number' ||
        config.wsOptions.maxReconnectionAttempts < 0)
    ) {
      errors.push('Max reconnection attempts must be a non-negative number')
    }

    if (
      config.wsOptions.reconnectionDelay !== undefined &&
      (typeof config.wsOptions.reconnectionDelay !== 'number' ||
        config.wsOptions.reconnectionDelay < 0)
    ) {
      errors.push('Reconnection delay must be a non-negative number')
    }
  }

  // Validate registration options
  if (config.registrationOptions) {
    if (
      config.registrationOptions.expires !== undefined &&
      (typeof config.registrationOptions.expires !== 'number' ||
        config.registrationOptions.expires <= 0)
    ) {
      errors.push('Registration expires must be a positive number')
    }

    if (
      config.registrationOptions.registrationRetryInterval !== undefined &&
      (typeof config.registrationOptions.registrationRetryInterval !== 'number' ||
        config.registrationOptions.registrationRetryInterval < 0)
    ) {
      errors.push('Registration retry interval must be a non-negative number')
    }
  }

  // Validate session options
  if (config.sessionOptions) {
    if (
      config.sessionOptions.maxConcurrentCalls !== undefined &&
      (typeof config.sessionOptions.maxConcurrentCalls !== 'number' ||
        config.sessionOptions.maxConcurrentCalls <= 0)
    ) {
      errors.push('Max concurrent calls must be a positive number')
    }

    if (
      config.sessionOptions.callTimeout !== undefined &&
      (typeof config.sessionOptions.callTimeout !== 'number' ||
        config.sessionOptions.callTimeout <= 0)
    ) {
      errors.push('Call timeout must be a positive number')
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
 */
export function validateMediaConfig(config: MediaConfiguration): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config) {
    errors.push('Media configuration is required')
    return { valid: false, errors }
  }

  // Validate audio codec
  if (config.audioCodec) {
    const validAudioCodecs = ['opus', 'pcmu', 'pcma', 'g722']
    if (!validAudioCodecs.includes(config.audioCodec)) {
      errors.push(
        `Invalid audio codec: ${config.audioCodec}. Valid options: ${validAudioCodecs.join(', ')}`
      )
    }
  }

  // Validate video codec
  if (config.videoCodec) {
    const validVideoCodecs = ['vp8', 'vp9', 'h264']
    if (!validVideoCodecs.includes(config.videoCodec)) {
      errors.push(
        `Invalid video codec: ${config.videoCodec}. Valid options: ${validVideoCodecs.join(', ')}`
      )
    }
  }

  // Validate boolean flags
  const booleanFields = [
    'echoCancellation',
    'noiseSuppression',
    'autoGainControl',
    'dataChannel',
  ] as const

  for (const field of booleanFields) {
    if (config[field] !== undefined && typeof config[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`)
    }
  }

  // Provide recommendations
  if (config.echoCancellation === false) {
    warnings.push('Disabling echo cancellation may result in poor audio quality')
  }

  if (config.noiseSuppression === false) {
    warnings.push('Disabling noise suppression may result in poor audio quality')
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate a port number
 */
export function validatePort(port: number): ValidationResult {
  const errors: string[] = []

  if (typeof port !== 'number') {
    errors.push('Port must be a number')
    return { valid: false, errors }
  }

  if (!Number.isInteger(port)) {
    errors.push('Port must be an integer')
    return { valid: false, errors }
  }

  if (port < 1 || port > 65535) {
    errors.push('Port must be between 1 and 65535')
    return { valid: false, errors }
  }

  return { valid: true }
}

/**
 * Validate an email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = []

  if (!email || typeof email !== 'string') {
    errors.push('Email is required and must be a string')
    return { valid: false, errors }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    errors.push('Invalid email format')
    return { valid: false, errors }
  }

  return { valid: true }
}
