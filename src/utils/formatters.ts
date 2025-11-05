/**
 * Formatting utilities for DailVue
 * @packageDocumentation
 */

/**
 * Format options for SIP URI
 */
export interface SipUriFormatOptions {
  /** Include display name */
  includeDisplayName?: boolean
  /** Include URI parameters */
  includeParameters?: boolean
  /** Use full format (with angle brackets) */
  fullFormat?: boolean
}

/**
 * Format a SIP URI
 * @param uri - The SIP URI string
 * @param displayName - Optional display name
 * @param options - Formatting options
 * @returns Formatted SIP URI
 */
export function formatSipUri(
  uri: string,
  displayName?: string,
  options: SipUriFormatOptions = {}
): string {
  const { includeDisplayName = true, fullFormat = true } = options

  // Clean the URI
  let cleanUri = uri.trim()

  // Extract components if URI has display name already
  const match = cleanUri.match(/^"?([^"<]*)"?\s*<(.+)>$/)
  if (match) {
    displayName = displayName || match[1]?.trim()
    cleanUri = match[2]
  }

  // Format with display name if provided
  if (includeDisplayName && displayName && displayName.trim() !== '') {
    if (fullFormat) {
      // Check if display name needs quotes
      const needsQuotes = /[^\w\s]/.test(displayName) || displayName.includes(',')
      if (needsQuotes) {
        return `"${displayName}" <${cleanUri}>`
      }
      return `${displayName} <${cleanUri}>`
    }
    return `${displayName} <${cleanUri}>`
  }

  return cleanUri
}

/**
 * Extract username from SIP URI
 * @param uri - The SIP URI
 * @returns Username portion of the URI
 */
export function extractSipUsername(uri: string): string {
  const match = uri.match(/sips?:([^@]+)@/)
  return match ? match[1] : uri
}

/**
 * Extract domain from SIP URI
 * @param uri - The SIP URI
 * @returns Domain portion of the URI
 */
export function extractSipDomain(uri: string): string {
  const match = uri.match(/@([^;>]+)/)
  return match ? match[1] : ''
}

/**
 * Format duration in seconds to HH:MM:SS
 * @param seconds - Duration in seconds
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export function formatDuration(
  seconds: number,
  options: {
    /** Always show hours even if 0 */
    alwaysShowHours?: boolean
    /** Show milliseconds */
    showMilliseconds?: boolean
  } = {}
): string {
  const { alwaysShowHours = false, showMilliseconds = false } = options

  if (seconds < 0) {
    return '00:00'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  const parts: string[] = []

  if (hours > 0 || alwaysShowHours) {
    parts.push(String(hours).padStart(2, '0'))
  }

  parts.push(String(minutes).padStart(2, '0'))
  parts.push(String(secs).padStart(2, '0'))

  let result = parts.join(':')

  if (showMilliseconds) {
    result += `.${String(ms).padStart(3, '0')}`
  }

  return result
}

/**
 * Format duration in a human-readable way
 * @param seconds - Duration in seconds
 * @returns Human-readable duration (e.g., "2h 15m", "45s")
 */
export function formatHumanDuration(seconds: number): string {
  if (seconds < 0) {
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

  return parts.join(' ')
}

/**
 * Format phone number for display
 * @param phoneNumber - Raw phone number
 * @param format - Format style
 * @returns Formatted phone number
 */
export function formatPhoneNumber(
  phoneNumber: string,
  format: 'international' | 'national' | 'e164' = 'international'
): string {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '')

  if (format === 'e164') {
    // E.164 format: +[country code][number]
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  }

  // Extract country code if present
  const hasCountryCode = cleaned.startsWith('+')
  let number = hasCountryCode ? cleaned.substring(1) : cleaned

  // For international format
  if (format === 'international' && number.length >= 10) {
    // Assume country code is 1-3 digits
    let countryCode = ''
    if (hasCountryCode) {
      if (number.startsWith('1') && number.length === 11) {
        // North America
        countryCode = '1'
        number = number.substring(1)
      } else if (number.length > 10) {
        // Other countries - take first 1-3 digits as country code
        countryCode = number.substring(0, number.length - 10)
        number = number.substring(number.length - 10)
      }
    }

    // Format the number
    if (number.length === 10) {
      const formatted = `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`
      return countryCode ? `+${countryCode} ${formatted}` : formatted
    }
  }

  // For national format or fallback
  if (number.length === 10) {
    return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`
  } else if (number.length === 7) {
    return `${number.substring(0, 3)}-${number.substring(3)}`
  }

  // Return as-is if we can't format it
  return phoneNumber
}

/**
 * Format date for call history
 * @param date - The date to format
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatCallDate(
  date: Date,
  options: {
    /** Include time */
    includeTime?: boolean
    /** Use relative format (e.g., "Today", "Yesterday") */
    relative?: boolean
    /** Use 24-hour time format */
    use24Hour?: boolean
  } = {}
): string {
  const { includeTime = true, relative = true, use24Hour = false } = options

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  let dateStr = ''

  if (relative) {
    if (dateOnly.getTime() === today.getTime()) {
      dateStr = 'Today'
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      dateStr = 'Yesterday'
    } else if (now.getTime() - dateOnly.getTime() < 7 * 24 * 60 * 60 * 1000) {
      // Within last week - show day name
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      dateStr = dayNames[date.getDay()]
    } else {
      // Show full date
      dateStr = formatDate(date, 'short')
    }
  } else {
    dateStr = formatDate(date, 'short')
  }

  if (includeTime) {
    const timeStr = formatTime(date, use24Hour)
    return `${dateStr} ${timeStr}`
  }

  return dateStr
}

/**
 * Format time
 * @param date - The date to extract time from
 * @param use24Hour - Use 24-hour format
 * @returns Formatted time string
 */
export function formatTime(date: Date, use24Hour = false): string {
  let hours = date.getHours()
  const minutes = date.getMinutes()

  if (use24Hour) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Format date
 * @param date - The date to format
 * @param format - Format style
 * @returns Formatted date string
 */
export function formatDate(date: Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()

  switch (format) {
    case 'short':
      return `${month}/${day}/${year}`
    case 'medium':
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[date.getMonth()]} ${day}, ${year}`
    case 'long':
      const monthNamesLong = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]
      return `${monthNamesLong[date.getMonth()]} ${day}, ${year}`
    default:
      return date.toLocaleDateString()
  }
}

/**
 * Format bytes to human-readable size
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted size string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Format bitrate
 * @param bitsPerSecond - Bitrate in bits per second
 * @returns Formatted bitrate string
 */
export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond === 0) return '0 bps'

  const k = 1000
  const sizes = ['bps', 'kbps', 'Mbps', 'Gbps']

  const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k))

  return `${parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param position - Where to place ellipsis
 * @returns Truncated string
 */
export function truncate(
  str: string,
  maxLength: number,
  position: 'end' | 'middle' = 'end'
): string {
  if (str.length <= maxLength) {
    return str
  }

  if (position === 'middle') {
    const halfLength = Math.floor((maxLength - 3) / 2)
    return `${str.substring(0, halfLength)}...${str.substring(str.length - halfLength)}`
  }

  return `${str.substring(0, maxLength - 3)}...`
}
