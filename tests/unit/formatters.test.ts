/**
 * Unit tests for formatters
 */

import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  formatDurationShort,
  formatSipUri,
  parseSipUri,
  extractDisplayName,
  formatPhoneNumber,
  formatCallTime,
  formatDateTime,
  formatIsoTimestamp,
  formatBytes,
  formatBitrate,
  truncate,
  formatCallStatus,
  formatCallDirection,
} from '../../src/utils/formatters'

describe('formatters', () => {
  describe('formatDuration', () => {
    it('should format 0 seconds', () => {
      expect(formatDuration(0)).toBe('00:00:00')
    })

    it('should format seconds only', () => {
      expect(formatDuration(30)).toBe('00:00:30')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(65)).toBe('00:01:05')
    })

    it('should format hours, minutes, and seconds', () => {
      expect(formatDuration(3665)).toBe('01:01:05')
    })

    it('should pad with zeros', () => {
      expect(formatDuration(3)).toBe('00:00:03')
      expect(formatDuration(63)).toBe('00:01:03')
    })

    it('should handle large durations', () => {
      expect(formatDuration(86399)).toBe('23:59:59')
    })

    it('should handle negative numbers', () => {
      expect(formatDuration(-10)).toBe('00:00:00')
    })

    it('should handle non-finite numbers', () => {
      expect(formatDuration(NaN)).toBe('00:00:00')
      expect(formatDuration(Infinity)).toBe('00:00:00')
    })
  })

  describe('formatDurationShort', () => {
    it('should format 0 seconds', () => {
      expect(formatDurationShort(0)).toBe('0s')
    })

    it('should format seconds only', () => {
      expect(formatDurationShort(30)).toBe('30s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDurationShort(65)).toBe('1m 5s')
    })

    it('should format hours and minutes (omit seconds)', () => {
      expect(formatDurationShort(3665)).toBe('1h 1m')
    })

    it('should format hours only', () => {
      expect(formatDurationShort(3600)).toBe('1h')
    })

    it('should handle negative numbers', () => {
      expect(formatDurationShort(-10)).toBe('0s')
    })
  })

  describe('formatSipUri', () => {
    it('should format SIP URI without scheme', () => {
      expect(formatSipUri('sip:alice@example.com')).toBe('alice@example.com')
    })

    it('should format SIP URI with scheme', () => {
      expect(formatSipUri('sip:alice@example.com', true)).toBe('sip:alice@example.com')
    })

    it('should format SIPS URI', () => {
      expect(formatSipUri('sips:alice@example.com', true)).toBe('sips:alice@example.com')
    })

    it('should omit port when not including scheme', () => {
      expect(formatSipUri('sip:alice@example.com:5060')).toBe('alice@example.com')
    })

    it('should include port when including scheme', () => {
      expect(formatSipUri('sip:alice@example.com:5060', true)).toBe('sip:alice@example.com:5060')
    })

    it('should return empty string for invalid input', () => {
      expect(formatSipUri('')).toBe('')
      // @ts-expect-error - Testing invalid input
      expect(formatSipUri(null)).toBe('')
    })

    it('should return original string for non-SIP URI', () => {
      expect(formatSipUri('not-a-sip-uri')).toBe('not-a-sip-uri')
    })
  })

  describe('parseSipUri', () => {
    it('should parse SIP URI', () => {
      const result = parseSipUri('sip:alice@example.com')
      expect(result).toEqual({
        scheme: 'sip',
        user: 'alice',
        host: 'example.com',
        port: undefined,
      })
    })

    it('should parse SIPS URI', () => {
      const result = parseSipUri('sips:bob@example.com')
      expect(result?.scheme).toBe('sips')
    })

    it('should parse URI with port', () => {
      const result = parseSipUri('sip:alice@example.com:5060')
      expect(result?.port).toBe(5060)
    })

    it('should return null for invalid URI', () => {
      expect(parseSipUri('invalid-uri')).toBeNull()
      expect(parseSipUri('')).toBeNull()
      // @ts-expect-error - Testing invalid input
      expect(parseSipUri(null)).toBeNull()
    })
  })

  describe('extractDisplayName', () => {
    it('should extract quoted display name', () => {
      expect(extractDisplayName('"Alice Smith" <sip:alice@example.com>')).toBe('Alice Smith')
    })

    it('should extract unquoted display name', () => {
      expect(extractDisplayName('Bob Jones <sip:bob@example.com>')).toBe('Bob Jones')
    })

    it('should return null for URI without display name', () => {
      expect(extractDisplayName('sip:alice@example.com')).toBeNull()
    })

    it('should return null for invalid input', () => {
      expect(extractDisplayName('')).toBeNull()
      // @ts-expect-error - Testing invalid input
      expect(extractDisplayName(null)).toBeNull()
    })
  })

  describe('formatPhoneNumber', () => {
    it('should format US/Canada number', () => {
      expect(formatPhoneNumber('+14155551234')).toBe('+1 (415) 555-1234')
    })

    it('should format UK number', () => {
      const result = formatPhoneNumber('+442071234567')
      expect(result).toContain('+44')
      expect(result).toContain('20')
    })

    it('should handle non-E.164 format', () => {
      expect(formatPhoneNumber('555-1234')).toBe('555-1234')
    })

    it('should return empty string for invalid input', () => {
      expect(formatPhoneNumber('')).toBe('')
      // @ts-expect-error - Testing invalid input
      expect(formatPhoneNumber(null)).toBe('')
    })
  })

  describe('formatCallTime', () => {
    it('should format "Just now" for recent time', () => {
      const now = new Date()
      const recent = new Date(now.getTime() - 30000) // 30 seconds ago
      expect(formatCallTime(recent, now)).toBe('Just now')
    })

    it('should format minutes ago', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 300000) // 5 minutes ago
      expect(formatCallTime(past, now)).toBe('5 minutes ago')
    })

    it('should format single minute', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 60000) // 1 minute ago
      expect(formatCallTime(past, now)).toBe('1 minute ago')
    })

    it('should format hours ago', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 7200000) // 2 hours ago
      expect(formatCallTime(past, now)).toBe('2 hours ago')
    })

    it('should format days ago', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 172800000) // 2 days ago
      expect(formatCallTime(past, now)).toBe('2 days ago')
    })

    it('should format absolute date for old calls', () => {
      const now = new Date('2024-02-01T12:00:00')
      const past = new Date('2024-01-15T10:00:00') // More than 7 days ago
      const result = formatCallTime(past, now)
      expect(result).toContain('Jan')
      expect(result).toContain('15')
    })

    it('should handle invalid date', () => {
      expect(formatCallTime(new Date('invalid'))).toBe('Invalid date')
    })
  })

  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const date = new Date('2024-01-15T14:30:00')
      const result = formatDateTime(date)
      expect(result).toContain('Jan')
      expect(result).toContain('15')
      expect(result).toContain('2024')
      expect(result).toContain('at')
    })

    it('should handle invalid date', () => {
      expect(formatDateTime(new Date('invalid'))).toBe('Invalid date')
    })
  })

  describe('formatIsoTimestamp', () => {
    it('should format ISO timestamp', () => {
      const date = new Date('2024-01-15T14:30:00.000Z')
      expect(formatIsoTimestamp(date)).toBe('2024-01-15T14:30:00.000Z')
    })

    it('should handle invalid date', () => {
      expect(formatIsoTimestamp(new Date('invalid'))).toBe('')
    })
  })

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
    })

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB')
    })

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB')
    })

    it('should handle decimals parameter', () => {
      expect(formatBytes(1536, 2)).toBe('1.5 KB')
      expect(formatBytes(1536, 0)).toBe('2 KB')
    })

    it('should handle negative numbers', () => {
      expect(formatBytes(-100)).toBe('0 B')
    })

    it('should handle non-finite numbers', () => {
      expect(formatBytes(NaN)).toBe('0 B')
      expect(formatBytes(Infinity)).toBe('0 B')
    })
  })

  describe('formatBitrate', () => {
    it('should format 0 bps', () => {
      expect(formatBitrate(0)).toBe('0 bps')
    })

    it('should format bits per second', () => {
      expect(formatBitrate(500)).toBe('500 bps')
    })

    it('should format kilobits per second', () => {
      expect(formatBitrate(128000)).toBe('128 kbps')
    })

    it('should format megabits per second', () => {
      expect(formatBitrate(1536000)).toBe('1.5 Mbps')
    })

    it('should handle decimals parameter', () => {
      expect(formatBitrate(1536000, 2)).toBe('1.54 Mbps')
      expect(formatBitrate(1536000, 0)).toBe('2 Mbps')
    })

    it('should handle negative numbers', () => {
      expect(formatBitrate(-1000)).toBe('0 bps')
    })
  })

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello')
    })

    it('should truncate long strings', () => {
      expect(truncate('This is a long string', 10)).toBe('This is...')
    })

    it('should use custom ellipsis', () => {
      expect(truncate('This is a long string', 10, '…')).toBe('This is a…')
    })

    it('should handle exact length', () => {
      expect(truncate('1234567890', 10)).toBe('1234567890')
    })

    it('should return empty string for invalid input', () => {
      expect(truncate('', 10)).toBe('')
      // @ts-expect-error - Testing invalid input
      expect(truncate(null, 10)).toBe('')
    })
  })

  describe('formatCallStatus', () => {
    it('should format completed status', () => {
      expect(formatCallStatus('completed')).toBe('Completed')
    })

    it('should format missed status', () => {
      expect(formatCallStatus('missed')).toBe('Missed')
    })

    it('should format cancelled status', () => {
      expect(formatCallStatus('cancelled')).toBe('Cancelled')
    })

    it('should format failed status', () => {
      expect(formatCallStatus('failed')).toBe('Failed')
    })

    it('should format busy status', () => {
      expect(formatCallStatus('busy')).toBe('Busy')
    })

    it('should handle unknown status', () => {
      expect(formatCallStatus('unknown')).toBe('unknown')
    })

    it('should handle case insensitivity', () => {
      expect(formatCallStatus('COMPLETED')).toBe('Completed')
    })
  })

  describe('formatCallDirection', () => {
    it('should format incoming', () => {
      expect(formatCallDirection('incoming')).toBe('Incoming')
    })

    it('should format outgoing', () => {
      expect(formatCallDirection('outgoing')).toBe('Outgoing')
    })

    it('should handle unknown direction', () => {
      expect(formatCallDirection('unknown')).toBe('unknown')
    })

    it('should handle case insensitivity', () => {
      expect(formatCallDirection('INCOMING')).toBe('Incoming')
    })
  })
})
