/**
 * Formatting utilities for DailVue
 * @packageDocumentation
 */

/**
 * Format a duration in seconds to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (typeof seconds !== 'number' || seconds < 0) {
    return '00:00:00'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const pad = (num: number): string => String(num).padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

/**
 * Format a duration in seconds to a compact format (e.g., "1h 23m", "45m 12s", "23s")
 */
export function formatDurationCompact(seconds: number): string {
  if (typeof seconds !== 'number' || seconds < 0) {
    return '0s'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`)
  }
  if (secs > 0 || (hours === 0 && minutes === 0)) {
    parts.push(`${secs}s`)
  }

  return parts.join(' ')
}

/**
 * Parse a SIP URI and extract its components
 */
export interface ParsedSipUri {
  scheme: 'sip' | 'sips'
  user: string
  host: string
  port?: number
  displayName?: string
  parameters?: Record<string, string>
}

/**
 * Parse a SIP URI string into its components
 */
export function parseSipUri(uri: string): ParsedSipUri | null {
  if (!uri || typeof uri !== 'string') {
    return null
  }

  const trimmedUri = uri.trim()

  // Extract display name if present (e.g., "John Doe" <sip:john@example.com>)
  let displayName: string | undefined
  let sipUri = trimmedUri

  const displayNameMatch = trimmedUri.match(/^"?([^"<]+)"?\s*<(.+)>$/)
  if (displayNameMatch) {
    displayName = displayNameMatch[1]?.trim()
    sipUri = displayNameMatch[2]?.trim() || ''
  }

  // Extract scheme
  const schemeMatch = sipUri.match(/^(sips?):/i)
  if (!schemeMatch) {
    return null
  }

  const scheme = schemeMatch[1]?.toLowerCase() as 'sip' | 'sips'
  const withoutScheme = sipUri.substring(scheme.length + 1)

  // Split by @ to get user and host parts
  const atIndex = withoutScheme.indexOf('@')
  if (atIndex === -1) {
    return null
  }

  const user = withoutScheme.substring(0, atIndex)
  const hostPart = withoutScheme.substring(atIndex + 1)

  // Split parameters
  const semicolonIndex = hostPart.indexOf(';')
  const hostPortPart = semicolonIndex >= 0 ? hostPart.substring(0, semicolonIndex) : hostPart
  const paramsPart = semicolonIndex >= 0 ? hostPart.substring(semicolonIndex + 1) : ''

  // Parse host and port
  const colonIndex = hostPortPart.indexOf(':')
  const host = colonIndex >= 0 ? hostPortPart.substring(0, colonIndex) : hostPortPart
  const port = colonIndex >= 0 ? parseInt(hostPortPart.substring(colonIndex + 1), 10) : undefined

  // Parse parameters
  const parameters: Record<string, string> = {}
  if (paramsPart) {
    const paramPairs = paramsPart.split(';')
    for (const pair of paramPairs) {
      const [key, value] = pair.split('=')
      if (key) {
        parameters[key.trim()] = value?.trim() || ''
      }
    }
  }

  return {
    scheme,
    user,
    host,
    port: port && !isNaN(port) ? port : undefined,
    displayName,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
  }
}

/**
 * Format a SIP URI with optional display name
 */
export function formatSipUri(options: {
  user: string
  host: string
  port?: number
  displayName?: string
  secure?: boolean
}): string {
  const { user, host, port, displayName, secure = false } = options

  const scheme = secure ? 'sips' : 'sip'
  let uri = `${scheme}:${user}@${host}`

  if (port) {
    uri += `:${port}`
  }

  if (displayName) {
    return `"${displayName}" <${uri}>`
  }

  return uri
}

/**
 * Extract user from SIP URI
 */
export function extractUserFromSipUri(uri: string): string | null {
  const parsed = parseSipUri(uri)
  return parsed?.user || null
}

/**
 * Extract display name from SIP URI
 */
export function extractDisplayNameFromSipUri(uri: string): string | null {
  const parsed = parseSipUri(uri)
  return parsed?.displayName || null
}

/**
 * Format a phone number to E.164 format
 */
export function formatPhoneNumberE164(phoneNumber: string, defaultCountryCode = '1'): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '')

  // If already starts with +, return as is
  if (phoneNumber.startsWith('+')) {
    return `+${digits}`
  }

  // Add + and country code if not present
  if (digits.length >= 10) {
    return `+${defaultCountryCode}${digits}`
  }

  return `+${digits}`
}

/**
 * Format a phone number for display (e.g., +1 (555) 123-4567)
 */
export function formatPhoneNumberDisplay(phoneNumber: string): string {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '')

  // Extract parts
  const hasPlus = cleaned.startsWith('+')
  const digits = cleaned.replace('+', '')

  if (digits.length === 0) {
    return phoneNumber
  }

  // Format based on length
  if (digits.length === 11) {
    // US format: +1 (555) 123-4567
    const countryCode = digits.substring(0, 1)
    const areaCode = digits.substring(1, 4)
    const firstPart = digits.substring(4, 7)
    const secondPart = digits.substring(7, 11)
    return `${hasPlus ? '+' : ''}${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
  } else if (digits.length === 10) {
    // US format without country code: (555) 123-4567
    const areaCode = digits.substring(0, 3)
    const firstPart = digits.substring(3, 6)
    const secondPart = digits.substring(6, 10)
    return `(${areaCode}) ${firstPart}-${secondPart}`
  }

  // Default: just add + if it was there
  return hasPlus ? `+${digits}` : digits
}

/**
 * Format a timestamp to a readable date/time string
 */
export function formatDateTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }

  return date.toLocaleString(undefined, defaultOptions)
}

/**
 * Format a date to a readable date string
 */
export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }

  return date.toLocaleDateString(undefined, defaultOptions)
}

/**
 * Format a time to a readable time string
 */
export function formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }

  return date.toLocaleTimeString(undefined, defaultOptions)
}

/**
 * Format a relative time (e.g., "2 minutes ago", "in 5 hours")
 */
export function formatRelativeTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  const absDiff = Math.abs(diffInSeconds)

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (absDiff < 60) {
    return rtf.format(-diffInSeconds, 'second')
  } else if (absDiff < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute')
  } else if (absDiff < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour')
  } else if (absDiff < 604800) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day')
  } else if (absDiff < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 604800), 'week')
  } else if (absDiff < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month')
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year')
  }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  if (typeof bytes !== 'number' || bytes < 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Format bitrate to human-readable format
 */
export function formatBitrate(bitsPerSecond: number, decimals = 2): string {
  if (bitsPerSecond === 0) return '0 bps'
  if (typeof bitsPerSecond !== 'number' || bitsPerSecond < 0) return '0 bps'

  const k = 1000 // Using 1000 for network speeds (not 1024)
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps']

  const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k))

  return `${parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
