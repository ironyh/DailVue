/**
 * VueSip Formatters
 *
 * Formatting functions for SIP URIs, durations, phone numbers, and dates.
 * These utilities help display data in user-friendly formats.
 *
 * @module utils/formatters
 */

import type { SipUri } from '../types/sip.types'
import { SIP_URI_REGEX } from './constants'

/**
 * Formats a duration in seconds to HH:MM:SS format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(65) // "00:01:05"
 * formatDuration(3665) // "01:01:05"
 * ```
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00:00'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const pad = (num: number): string => num.toString().padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

/**
 * Formats a duration in seconds to a short human-readable format
 *
 * @param seconds - Duration in seconds
 * @returns Short formatted duration (e.g., "5m 30s", "1h 5m")
 *
 * @example
 * ```typescript
 * formatDurationShort(65) // "1m 5s"
 * formatDurationShort(3665) // "1h 1m"
 * formatDurationShort(30) // "30s"
 * ```
 */
export function formatDurationShort(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0s'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`)
  }

  return parts.slice(0, 2).join(' ') // Show max 2 units
}

/**
 * Formats a SIP URI for display
 *
 * Extracts and formats the display name and user@domain from a SIP URI
 *
 * @param uri - SIP URI to format
 * @param includeScheme - Whether to include sip: or sips: prefix
 * @returns Formatted SIP URI
 *
 * @example
 * ```typescript
 * formatSipUri('sip:alice@example.com') // "alice@example.com"
 * formatSipUri('sip:alice@example.com', true) // "sip:alice@example.com"
 * formatSipUri('sips:bob@example.com:5061') // "bob@example.com"
 * ```
 */
export function formatSipUri(uri: string, includeScheme = false): string {
  if (!uri || typeof uri !== 'string') {
    return ''
  }

  const match = SIP_URI_REGEX.exec(uri)
  if (!match) {
    return uri // Return as-is if not a valid SIP URI
  }

  const [, user, domain, port] = match
  const scheme = uri.startsWith('sips:') ? 'sips' : 'sip'

  if (includeScheme) {
    return `${scheme}:${user}@${domain}${port ? `:${port}` : ''}`
  }

  return `${user}@${domain}`
}

/**
 * Parses a SIP URI into its components
 *
 * @param uri - SIP URI to parse
 * @returns Parsed SIP URI object or null if invalid
 *
 * @example
 * ```typescript
 * const parsed = parseSipUri('sips:alice@example.com:5061')
 * // {
 * //   scheme: 'sips',
 * //   user: 'alice',
 * //   host: 'example.com',
 * //   port: 5061
 * // }
 * ```
 */
export function parseSipUri(uri: string): Partial<SipUri> | null {
  if (!uri || typeof uri !== 'string') {
    return null
  }

  const match = SIP_URI_REGEX.exec(uri)
  if (!match) {
    return null
  }

  const [, user, host, port] = match
  const scheme = uri.startsWith('sips:') ? 'sips' : 'sip'

  return {
    scheme: scheme as 'sip' | 'sips',
    user,
    host,
    port: port ? parseInt(port, 10) : undefined,
  }
}

/**
 * Extracts the display name from a SIP URI
 *
 * SIP URIs can have a display name before the URI:
 * "Alice Smith" <sip:alice@example.com>
 *
 * @param uri - SIP URI with optional display name
 * @returns Display name or null if not present
 *
 * @example
 * ```typescript
 * extractDisplayName('"Alice Smith" <sip:alice@example.com>') // "Alice Smith"
 * extractDisplayName('sip:alice@example.com') // null
 * ```
 */
export function extractDisplayName(uri: string): string | null | undefined {
  if (!uri || typeof uri !== 'string') {
    return null
  }

  // Match quoted display name: "Name" <sip:...>
  const quotedMatch = /^"([^"]+)"\s*</.exec(uri)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  // Match unquoted display name: Name <sip:...>
  const unquotedMatch = /^([^<]+)\s*</.exec(uri)
  if (unquotedMatch?.[1]) {
    return unquotedMatch[1].trim()
  }

  return null
}

/**
 * Formats a phone number for display
 *
 * Takes an E.164 phone number and formats it for display
 *
 * @param number - E.164 phone number (+country code + number)
 * @returns Formatted phone number
 *
 * @example
 * ```typescript
 * formatPhoneNumber('+14155551234') // "+1 (415) 555-1234"
 * formatPhoneNumber('+442071234567') // "+44 20 7123 4567"
 * ```
 */
export function formatPhoneNumber(number: string): string {
  if (!number || typeof number !== 'string') {
    return ''
  }

  // Remove all non-digit characters except leading +
  const cleaned = number.replace(/[^\d+]/g, '')

  if (!cleaned.startsWith('+')) {
    return number // Return as-is if not E.164 format
  }

  // Format based on country code
  // US/Canada: +1 (XXX) XXX-XXXX
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`
  }

  // UK: +44 XX XXXX XXXX
  if (cleaned.startsWith('+44') && cleaned.length >= 12) {
    return `+44 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9)}`
  }

  // Generic format: +XX XXX XXX XXXX
  if (cleaned.length > 4) {
    const countryCode = cleaned.slice(0, cleaned.length - 10)
    const rest = cleaned.slice(cleaned.length - 10)
    return `${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`
  }

  return cleaned
}

/**
 * Formats a date for call history display
 *
 * Shows relative time for recent calls, absolute date for older calls
 *
 * @param date - Date to format
 * @param now - Current date (for testing)
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * formatCallTime(new Date()) // "Just now"
 * formatCallTime(new Date(Date.now() - 60000)) // "1 minute ago"
 * formatCallTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatCallTime(new Date('2024-01-01')) // "Jan 1, 2024"
 * ```
 */
export function formatCallTime(date: Date, now: Date = new Date()): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date'
  }

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Just now (< 60 seconds)
  if (seconds < 60) {
    return 'Just now'
  }

  // Minutes ago (< 60 minutes)
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  // Hours ago (< 24 hours)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  // Days ago (< 7 days)
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`
  }

  // Absolute date for older calls
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }

  return date.toLocaleDateString('en-US', options)
}

/**
 * Formats a date and time for detailed call history
 *
 * @param date - Date to format
 * @returns Formatted date and time string
 *
 * @example
 * ```typescript
 * formatDateTime(new Date('2024-01-15T14:30:00'))
 * // "Jan 15, 2024 at 2:30 PM"
 * ```
 */
export function formatDateTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date'
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }

  const datePart = date.toLocaleDateString('en-US', dateOptions)
  const timePart = date.toLocaleTimeString('en-US', timeOptions)

  return `${datePart} at ${timePart}`
}

/**
 * Formats a timestamp to ISO 8601 format
 *
 * @param date - Date to format
 * @returns ISO 8601 formatted string
 *
 * @example
 * ```typescript
 * formatIsoTimestamp(new Date('2024-01-15T14:30:00'))
 * // "2024-01-15T14:30:00.000Z"
 * ```
 */
export function formatIsoTimestamp(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString()
}

/**
 * Formats bytes to human-readable size
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted size string
 *
 * @example
 * ```typescript
 * formatBytes(1024) // "1 KB"
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(1048576) // "1 MB"
 * ```
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B'
  }

  if (bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Formats a bitrate to human-readable format
 *
 * @param bitsPerSecond - Bitrate in bits per second
 * @param decimals - Number of decimal places
 * @returns Formatted bitrate string
 *
 * @example
 * ```typescript
 * formatBitrate(128000) // "128 kbps"
 * formatBitrate(1536000) // "1.5 Mbps"
 * ```
 */
export function formatBitrate(bitsPerSecond: number, decimals = 1): string {
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond < 0) {
    return '0 bps'
  }

  if (bitsPerSecond === 0) {
    return '0 bps'
  }

  const k = 1000
  const sizes = ['bps', 'kbps', 'Mbps', 'Gbps']
  const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k))

  return `${parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Truncates a string to a maximum length with ellipsis
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - Ellipsis string to append
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncate('This is a long string', 10) // "This is a..."
 * truncate('Short', 10) // "Short"
 * ```
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (!str || typeof str !== 'string') {
    return ''
  }

  if (str.length <= maxLength) {
    return str
  }

  return str.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * Formats a call status for display
 *
 * @param status - Call status
 * @returns Human-readable status
 *
 * @example
 * ```typescript
 * formatCallStatus('completed') // "Completed"
 * formatCallStatus('missed') // "Missed"
 * ```
 */
export function formatCallStatus(status: string): string {
  const statusMap: Record<string, string> = {
    completed: 'Completed',
    missed: 'Missed',
    cancelled: 'Cancelled',
    failed: 'Failed',
    busy: 'Busy',
    rejected: 'Rejected',
  }

  return statusMap[status.toLowerCase()] || status
}

/**
 * Formats a call direction for display
 *
 * @param direction - Call direction
 * @returns Human-readable direction
 *
 * @example
 * ```typescript
 * formatCallDirection('incoming') // "Incoming"
 * formatCallDirection('outgoing') // "Outgoing"
 * ```
 */
export function formatCallDirection(direction: string): string {
  const directionMap: Record<string, string> = {
    incoming: 'Incoming',
    outgoing: 'Outgoing',
  }

  return directionMap[direction.toLowerCase()] || direction
}
