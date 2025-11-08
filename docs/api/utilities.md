# Utilities API Reference

This document provides a comprehensive reference for all utility functions available in VueSip. These utilities handle validation, formatting, encryption, logging, storage management, and provide essential constants used throughout the library.

## Table of Contents

- [Overview](#overview)
- [Validation Utilities](#validation-utilities)
  - [validateSipUri](#validatesipuri)
  - [validatePhoneNumber](#validatephonenumber)
  - [validateSipConfig](#validatesipconfig)
  - [validateMediaConfig](#validatemediaconfig)
  - [validateWebSocketUrl](#validatewebsocketurl)
  - [validateDtmfTone](#validatedtmftone)
  - [validateDtmfSequence](#validatedtmfsequence)
- [Formatting Utilities](#formatting-utilities)
  - [formatDuration](#formatduration)
  - [formatDurationShort](#formatdurationshort)
  - [formatSipUri](#formatsipuri)
  - [parseSipUri](#parsesipuri)
  - [extractDisplayName](#extractdisplayname)
  - [formatPhoneNumber](#formatphonenumber)
  - [formatCallTime](#formatcalltime)
  - [formatDateTime](#formatdatetime)
  - [formatIsoTimestamp](#formatisotimestamp)
  - [formatBytes](#formatbytes)
  - [formatBitrate](#formatbitrate)
  - [truncate](#truncate)
  - [formatCallStatus](#formatcallstatus)
  - [formatCallDirection](#formatcalldirection)
- [Encryption Utilities](#encryption-utilities)
  - [isCryptoAvailable](#iscryptoavailable)
  - [encrypt](#encrypt)
  - [decrypt](#decrypt)
  - [generateEncryptionKey](#generateencryptionkey)
  - [hashPassword](#hashpassword)
- [Storage Management Utilities](#storage-management-utilities)
  - [getStorageQuota](#getstoragequota)
  - [isStorageAvailable](#isstorageavailable)
  - [estimateLocalStorageUsage](#estimatelocalstorageusage)
  - [hasEnoughSpace](#hasenoughspace)
  - [checkStorageUsageWarning](#checkstorageusagewarning)
  - [clearOldDataLRU](#clearolddatalru)
  - [getStorageUsageSummary](#getstorageusagesummary)
  - [QuotaExceededError](#quotaexceedederror)
- [Logging Utilities](#logging-utilities)
  - [Logger Class](#logger-class)
  - [createLogger](#createlogger)
  - [configureLogger](#configurelogger)
  - [getLoggerConfig](#getloggerconfig)
  - [enableLogging](#enablelogging)
  - [disableLogging](#disablelogging)
  - [setLogLevel](#setloglevel)
  - [getLogLevel](#getloglevel)
  - [setLogHandler](#setloghandler)
- [Constants](#constants)
  - [Library Information](#library-information)
  - [SIP Configuration Defaults](#sip-configuration-defaults)
  - [Media Configuration Defaults](#media-configuration-defaults)
  - [Timeout Values](#timeout-values)
  - [Supported Codecs](#supported-codecs)
  - [SIP Status Codes](#sip-status-codes)
  - [Event Names](#event-names)
  - [Storage Keys](#storage-keys)
  - [Performance Targets](#performance-targets)
  - [Regular Expressions](#regular-expressions)
  - [Type Guards](#type-guards)

---

## Overview

VueSip provides a comprehensive set of utilities to help you work with SIP communications, validate inputs, format data for display, manage encryption, handle logging, and manage storage. All utilities are fully typed with TypeScript and include detailed documentation and examples.

**Import Path:**

```typescript
import {
  // Validators
  validateSipUri,
  validatePhoneNumber,
  validateSipConfig,

  // Formatters
  formatDuration,
  formatSipUri,
  formatBytes,

  // Encryption
  encrypt,
  decrypt,

  // Logger
  createLogger,

  // Storage
  getStorageQuota,

  // Constants
  SIP_STATUS_CODES,
  EVENTS,
} from 'vuesip/utils'
```

---

## Validation Utilities

All validation functions return a consistent result structure with validation status, error messages, and normalized values.

**Source:** [src/utils/validators.ts](../../src/utils/validators.ts)

### validateSipUri

Validates a SIP URI format and returns a normalized version.

**Signature:**

```typescript
function validateSipUri(uri: string): SimpleValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uri` | `string` | The SIP URI to validate (e.g., "sip:user@domain") |

**Returns:** `SimpleValidationResult`

```typescript
interface SimpleValidationResult {
  valid: boolean              // Whether the input is valid
  error: string | null        // Error message if validation failed
  normalized: string | null   // Normalized/cleaned version if valid
}
```

**Example:**

```typescript
const result = validateSipUri('sip:alice@example.com')
if (result.valid) {
  console.log('Normalized URI:', result.normalized)
  // Output: "sip:alice@example.com"
}

// Invalid URI
const invalid = validateSipUri('not-a-sip-uri')
console.log(invalid.error)
// Output: "Invalid SIP URI format. Expected: sip:user@domain or sips:user@domain"
```

**Validation Rules:**

- Must start with `sip:` or `sips:`
- Must contain user part (before @)
- Must contain domain part (after @)
- Optional port number (1-65535)
- Normalizes scheme and domain to lowercase

---

### validatePhoneNumber

Validates a phone number in E.164 format.

**Signature:**

```typescript
function validatePhoneNumber(number: string): SimpleValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `number` | `string` | Phone number in E.164 format (e.g., "+14155551234") |

**Returns:** `SimpleValidationResult`

**Example:**

```typescript
const result = validatePhoneNumber('+14155551234')
if (result.valid) {
  console.log('Valid E.164 number:', result.normalized)
}

// Invalid number
const invalid = validatePhoneNumber('555-1234')
console.log(invalid.error)
// Output: "Invalid phone number format. Expected E.164 format: +[country code][number] (max 15 digits)"
```

**E.164 Format:**
- Must start with `+`
- Followed by country code (1-3 digits)
- Followed by subscriber number
- Total length: 1-15 digits (excluding +)

---

### validateSipConfig

Validates a complete SIP client configuration.

**Signature:**

```typescript
function validateSipConfig(config: Partial<SipClientConfig>): ValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `Partial<SipClientConfig>` | SIP client configuration object |

**Returns:** `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean              // Whether the configuration is valid
  errors?: string[]          // List of validation errors
  warnings?: string[]        // List of validation warnings
}
```

**Example:**

```typescript
const config: SipClientConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:alice@example.com',
  password: 'secret123'
}

const result = validateSipConfig(config)
if (result.valid) {
  console.log('Configuration is valid')
} else {
  console.error('Validation errors:', result.errors)
}
```

**Validates:**
- Required fields: `uri`, `sipUri`, `password` or `ha1`
- WebSocket URL format
- SIP URI format
- Nested registration options
- Nested session options
- RTC configuration

---

### validateMediaConfig

Validates media configuration for audio/video settings.

**Signature:**

```typescript
function validateMediaConfig(config: Partial<MediaConfiguration>): ValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `Partial<MediaConfiguration>` | Media configuration object |

**Returns:** `ValidationResult`

**Example:**

```typescript
const config: MediaConfiguration = {
  audio: true,
  video: false,
  echoCancellation: true,
  noiseSuppression: true,
  audioCodec: 'opus'
}

const result = validateMediaConfig(config)
if (!result.valid) {
  console.error('Invalid media config:', result.errors)
}
```

**Validates:**
- Audio constraints (boolean or object)
- Video constraints (boolean or object)
- Echo cancellation, noise suppression, auto gain control
- Audio codec (opus, pcmu, pcma, g722)
- Video codec (vp8, vp9, h264)
- Data channel support

---

### validateWebSocketUrl

Validates a WebSocket URL format.

**Signature:**

```typescript
function validateWebSocketUrl(url: string): SimpleValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | WebSocket URL to validate |

**Returns:** `SimpleValidationResult`

**Example:**

```typescript
const result = validateWebSocketUrl('wss://sip.example.com:7443')
if (result.valid) {
  console.log('Valid WebSocket URL')
}

// Invalid URL
const invalid = validateWebSocketUrl('http://example.com')
console.log(invalid.error)
// Output: "Invalid WebSocket URL format. Expected: ws:// or wss://"
```

**Validation Rules:**
- Must start with `ws://` or `wss://`
- Must have valid URL structure
- Must include hostname

---

### validateDtmfTone

Validates a single DTMF tone character.

**Signature:**

```typescript
function validateDtmfTone(tone: string): SimpleValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tone` | `string` | DTMF tone character (0-9, *, #, A-D) |

**Returns:** `SimpleValidationResult`

**Example:**

```typescript
const result = validateDtmfTone('5')
if (result.valid) {
  console.log('Valid DTMF tone:', result.normalized)
}

// Invalid tone
const invalid = validateDtmfTone('X')
console.log(invalid.error)
// Output: "Invalid DTMF tone. Valid tones: 0-9, *, #, A-D"
```

**Valid DTMF Tones:**
- Digits: 0-9
- Symbols: *, #
- Letters: A, B, C, D (case-insensitive, normalized to uppercase)

---

### validateDtmfSequence

Validates a sequence of DTMF tones.

**Signature:**

```typescript
function validateDtmfSequence(sequence: string): SimpleValidationResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sequence` | `string` | String of DTMF tones (e.g., "1234*#") |

**Returns:** `SimpleValidationResult`

**Example:**

```typescript
const result = validateDtmfSequence('1234*#')
if (result.valid) {
  console.log('Valid sequence:', result.normalized)
  // Output: "1234*#"
}

// Invalid sequence
const invalid = validateDtmfSequence('123X')
console.log(invalid.error)
// Output: "Invalid tone at position 4: Invalid DTMF tone. Valid tones: 0-9, *, #, A-D"
```

---

## Formatting Utilities

Format data for user-friendly display in your UI.

**Source:** [src/utils/formatters.ts](../../src/utils/formatters.ts)

### formatDuration

Formats a duration in seconds to HH:MM:SS format.

**Signature:**

```typescript
function formatDuration(seconds: number): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `seconds` | `number` | Duration in seconds |

**Returns:** `string` - Formatted duration (HH:MM:SS)

**Example:**

```typescript
formatDuration(65)    // "00:01:05"
formatDuration(3665)  // "01:01:05"
formatDuration(0)     // "00:00:00"
```

---

### formatDurationShort

Formats a duration to a short human-readable format.

**Signature:**

```typescript
function formatDurationShort(seconds: number): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `seconds` | `number` | Duration in seconds |

**Returns:** `string` - Short formatted duration (e.g., "5m 30s")

**Example:**

```typescript
formatDurationShort(65)    // "1m 5s"
formatDurationShort(3665)  // "1h 1m"
formatDurationShort(30)    // "30s"
formatDurationShort(7200)  // "2h"
```

---

### formatSipUri

Formats a SIP URI for display.

**Signature:**

```typescript
function formatSipUri(uri: string, includeScheme?: boolean): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `uri` | `string` | - | SIP URI to format |
| `includeScheme` | `boolean` | `false` | Whether to include sip: or sips: prefix |

**Returns:** `string` - Formatted SIP URI

**Example:**

```typescript
formatSipUri('sip:alice@example.com')           // "alice@example.com"
formatSipUri('sip:alice@example.com', true)     // "sip:alice@example.com"
formatSipUri('sips:bob@example.com:5061')       // "bob@example.com"
formatSipUri('sips:bob@example.com:5061', true) // "sips:bob@example.com:5061"
```

---

### parseSipUri

Parses a SIP URI into its components.

**Signature:**

```typescript
function parseSipUri(uri: string): Partial<SipUri> | null
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uri` | `string` | SIP URI to parse |

**Returns:** `Partial<SipUri> | null` - Parsed URI components or null if invalid

**Return Type:**

```typescript
interface SipUri {
  scheme: 'sip' | 'sips'
  user: string
  host: string
  port?: number
}
```

**Example:**

```typescript
const parsed = parseSipUri('sips:alice@example.com:5061')
console.log(parsed)
// {
//   scheme: 'sips',
//   user: 'alice',
//   host: 'example.com',
//   port: 5061
// }

parseSipUri('invalid-uri')  // null
```

---

### extractDisplayName

Extracts the display name from a SIP URI with format: "Name" &lt;sip:user@domain&gt;

**Signature:**

```typescript
function extractDisplayName(uri: string): string | null | undefined
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uri` | `string` | SIP URI with optional display name |

**Returns:** `string | null | undefined` - Display name or null if not present

**Example:**

```typescript
extractDisplayName('"Alice Smith" <sip:alice@example.com>')  // "Alice Smith"
extractDisplayName('Alice <sip:alice@example.com>')          // "Alice"
extractDisplayName('sip:alice@example.com')                  // null
```

---

### formatPhoneNumber

Formats a phone number for display (E.164 to readable format).

**Signature:**

```typescript
function formatPhoneNumber(number: string): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `number` | `string` | E.164 phone number |

**Returns:** `string` - Formatted phone number

**Example:**

```typescript
formatPhoneNumber('+14155551234')    // "+1 (415) 555-1234"
formatPhoneNumber('+442071234567')   // "+44 20 7123 4567"
formatPhoneNumber('+33123456789')    // "+33 123 456 789"
```

---

### formatCallTime

Formats a date for call history display with relative time for recent calls.

**Signature:**

```typescript
function formatCallTime(date: Date, now?: Date): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | `Date` | - | Date to format |
| `now` | `Date` | `new Date()` | Current date (for testing) |

**Returns:** `string` - Formatted time string

**Example:**

```typescript
formatCallTime(new Date())                         // "Just now"
formatCallTime(new Date(Date.now() - 60000))       // "1 minute ago"
formatCallTime(new Date(Date.now() - 3600000))     // "1 hour ago"
formatCallTime(new Date(Date.now() - 86400000))    // "1 day ago"
formatCallTime(new Date('2024-01-01'))             // "Jan 1, 2024"
```

**Time Ranges:**
- < 60 seconds: "Just now"
- < 60 minutes: "X minute(s) ago"
- < 24 hours: "X hour(s) ago"
- < 7 days: "X day(s) ago"
- Older: Absolute date (e.g., "Jan 1, 2024")

---

### formatDateTime

Formats a date and time for detailed call history.

**Signature:**

```typescript
function formatDateTime(date: Date): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date` | Date to format |

**Returns:** `string` - Formatted date and time

**Example:**

```typescript
formatDateTime(new Date('2024-01-15T14:30:00'))
// "Jan 15, 2024 at 2:30 PM"
```

---

### formatIsoTimestamp

Formats a timestamp to ISO 8601 format.

**Signature:**

```typescript
function formatIsoTimestamp(date: Date): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date` | Date to format |

**Returns:** `string` - ISO 8601 formatted string

**Example:**

```typescript
formatIsoTimestamp(new Date('2024-01-15T14:30:00'))
// "2024-01-15T14:30:00.000Z"
```

---

### formatBytes

Formats bytes to human-readable size.

**Signature:**

```typescript
function formatBytes(bytes: number, decimals?: number): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bytes` | `number` | - | Number of bytes |
| `decimals` | `number` | `1` | Number of decimal places |

**Returns:** `string` - Formatted size string

**Example:**

```typescript
formatBytes(1024)        // "1 KB"
formatBytes(1536)        // "1.5 KB"
formatBytes(1048576)     // "1 MB"
formatBytes(1536, 2)     // "1.50 KB"
```

---

### formatBitrate

Formats a bitrate to human-readable format.

**Signature:**

```typescript
function formatBitrate(bitsPerSecond: number, decimals?: number): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bitsPerSecond` | `number` | - | Bitrate in bits per second |
| `decimals` | `number` | `1` | Number of decimal places |

**Returns:** `string` - Formatted bitrate string

**Example:**

```typescript
formatBitrate(128000)     // "128 kbps"
formatBitrate(1536000)    // "1.5 Mbps"
formatBitrate(64000)      // "64 kbps"
```

---

### truncate

Truncates a string to a maximum length with ellipsis.

**Signature:**

```typescript
function truncate(str: string, maxLength: number, ellipsis?: string): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `str` | `string` | - | String to truncate |
| `maxLength` | `number` | - | Maximum length |
| `ellipsis` | `string` | `'...'` | Ellipsis string to append |

**Returns:** `string` - Truncated string

**Example:**

```typescript
truncate('This is a long string', 10)              // "This is a..."
truncate('Short', 10)                              // "Short"
truncate('This is a long string', 10, '…')         // "This is a…"
```

---

### formatCallStatus

Formats a call status for display.

**Signature:**

```typescript
function formatCallStatus(status: string): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | `string` | Call status |

**Returns:** `string` - Human-readable status

**Example:**

```typescript
formatCallStatus('completed')   // "Completed"
formatCallStatus('missed')      // "Missed"
formatCallStatus('busy')        // "Busy"
```

**Supported Statuses:**
- completed, missed, cancelled, failed, busy, rejected

---

### formatCallDirection

Formats a call direction for display.

**Signature:**

```typescript
function formatCallDirection(direction: string): string
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `direction` | `string` | Call direction |

**Returns:** `string` - Human-readable direction

**Example:**

```typescript
formatCallDirection('incoming')   // "Incoming"
formatCallDirection('outgoing')   // "Outgoing"
```

---

## Encryption Utilities

Secure encryption/decryption using the Web Crypto API for protecting sensitive data.

**Source:** [src/utils/encryption.ts](../../src/utils/encryption.ts)

### isCryptoAvailable

Checks if the Web Crypto API is available.

**Signature:**

```typescript
function isCryptoAvailable(): boolean
```

**Returns:** `boolean` - True if crypto is available

**Example:**

```typescript
if (isCryptoAvailable()) {
  // Use encryption features
} else {
  console.warn('Web Crypto API not available')
}
```

---

### encrypt

Encrypts data using AES-GCM encryption.

**Signature:**

```typescript
async function encrypt<T = unknown>(
  data: T,
  password: string,
  options?: Partial<EncryptionOptions>
): Promise<EncryptedData>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `T` | Data to encrypt (will be JSON.stringified) |
| `password` | `string` | Password for encryption |
| `options` | `Partial<EncryptionOptions>` | Optional encryption options |

**Options:**

```typescript
interface EncryptionOptions {
  enabled: boolean       // Whether encryption is enabled
  algorithm: string      // Algorithm (default: 'AES-GCM')
  iterations: number     // PBKDF2 iterations (default: 100000)
  salt: string          // Custom salt (auto-generated if not provided)
}
```

**Returns:** `Promise<EncryptedData>`

```typescript
interface EncryptedData {
  data: string         // Encrypted data (base64)
  iv: string          // Initialization vector (base64)
  salt: string        // Salt for key derivation (base64)
  algorithm: string   // Encryption algorithm
  iterations: number  // PBKDF2 iterations
  version: number     // Format version
}
```

**Example:**

```typescript
const credentials = {
  username: 'alice',
  password: 'secret123'
}

const encrypted = await encrypt(credentials, 'masterPassword')
// Store encrypted.data, encrypted.iv, encrypted.salt securely
```

**Features:**
- AES-GCM 256-bit encryption
- PBKDF2 key derivation with configurable iterations
- Automatic salt and IV generation
- Data is JSON.stringified before encryption

**Throws:** `Error` if encryption fails or crypto is not available

---

### decrypt

Decrypts data encrypted with `encrypt()`.

**Signature:**

```typescript
async function decrypt<T = unknown>(
  encryptedData: EncryptedData,
  password: string
): Promise<T>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `encryptedData` | `EncryptedData` | Encrypted data structure |
| `password` | `string` | Password for decryption |

**Returns:** `Promise<T>` - Decrypted and parsed data

**Example:**

```typescript
const decrypted = await decrypt<Credentials>(encryptedData, 'masterPassword')
console.log(decrypted.username) // "alice"
```

**Throws:** `Error` if decryption fails, password is wrong, or crypto is not available

---

### generateEncryptionKey

Generates a random encryption key that can be used as a password.

**Signature:**

```typescript
function generateEncryptionKey(length?: number): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `length` | `number` | `32` | Key length in bytes |

**Returns:** `string` - Random key as base64 string

**Example:**

```typescript
const key = generateEncryptionKey()
// Use this key as a password for encrypt/decrypt
const encrypted = await encrypt(data, key)
```

**Important:** Store the generated key securely (e.g., in memory or secure storage)

**Throws:** `Error` if crypto is not available

---

### hashPassword

Hashes a password using SHA-256.

**Signature:**

```typescript
async function hashPassword(password: string): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `password` | `string` | Password to hash |

**Returns:** `Promise<string>` - Hashed password as hex string

**Example:**

```typescript
const hashed = await hashPassword('myPassword123')
console.log(hashed)
// "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
```

**Use Cases:**
- Creating consistent encryption keys from user passwords
- Password verification (compare hashes)
- Generating deterministic keys

**Throws:** `Error` if crypto is not available

---

## Storage Management Utilities

Utilities for managing storage quota and preventing quota exceeded errors.

**Source:** [src/utils/storageQuota.ts](../../src/utils/storageQuota.ts)

### getStorageQuota

Gets storage quota and usage information.

**Signature:**

```typescript
async function getStorageQuota(): Promise<StorageQuotaInfo>
```

**Returns:** `Promise<StorageQuotaInfo>`

```typescript
interface StorageQuotaInfo {
  quota: number         // Total quota in bytes (0 if unavailable)
  usage: number         // Current usage in bytes
  available: number     // Available space in bytes
  usagePercent: number  // Usage percentage (0-100)
  supported: boolean    // Whether quota API is supported
}
```

**Example:**

```typescript
const quota = await getStorageQuota()
console.log(`Using ${quota.usagePercent.toFixed(1)}% of available storage`)
console.log(`${formatBytes(quota.available)} remaining`)

if (quota.usagePercent > 80) {
  console.warn('Storage usage is high')
}
```

**Browser Compatibility:**
- Modern browsers: Uses Storage API's `estimate()` method
- Older browsers: Returns default values with `supported: false`

---

### isStorageAvailable

Checks if a specific storage type is available and writable.

**Signature:**

```typescript
function isStorageAvailable(storageType: StorageType): boolean
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `storageType` | `'localStorage' \| 'sessionStorage' \| 'indexedDB'` | Storage type to check |

**Returns:** `boolean` - True if storage is available

**Example:**

```typescript
if (isStorageAvailable('localStorage')) {
  localStorage.setItem('key', 'value')
}

if (isStorageAvailable('indexedDB')) {
  // Use IndexedDB
}
```

**Features:**
- Tests actual write capability (not just presence)
- Handles private browsing mode gracefully
- Cleans up test data

---

### estimateLocalStorageUsage

Estimates current localStorage usage by calculating size of stored data.

**Signature:**

```typescript
function estimateLocalStorageUsage(): number
```

**Returns:** `number` - Estimated size in bytes

**Example:**

```typescript
const usage = estimateLocalStorageUsage()
console.log(`localStorage is using approximately ${formatBytes(usage)}`)
```

**Note:** This is an approximation based on string length (UTF-16, 2 bytes per character)

---

### hasEnoughSpace

Checks if there's enough storage space for a given requirement.

**Signature:**

```typescript
async function hasEnoughSpace(
  requiredBytes: number,
  buffer?: number
): Promise<boolean>
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `requiredBytes` | `number` | - | Required space in bytes |
| `buffer` | `number` | `0.1` | Safety buffer percentage (0.1 = 10%) |

**Returns:** `Promise<boolean>` - True if enough space is available

**Example:**

```typescript
const canStore = await hasEnoughSpace(1024 * 1024) // 1MB
if (!canStore) {
  console.warn('Not enough storage space')
  // Cleanup old data or notify user
}
```

**Buffer:** Adds safety margin to account for overhead and other storage needs

---

### checkStorageUsageWarning

Checks if storage usage exceeds a threshold and logs a warning.

**Signature:**

```typescript
async function checkStorageUsageWarning(threshold?: number): Promise<boolean>
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | `number` | `80` | Warning threshold percentage |

**Returns:** `Promise<boolean>` - True if usage is above threshold

**Example:**

```typescript
const isHigh = await checkStorageUsageWarning(80)
if (isHigh) {
  // Prompt user to clear old data
}
```

---

### clearOldDataLRU

Clears old data using LRU (Least Recently Used) strategy.

**Signature:**

```typescript
async function clearOldDataLRU<T extends { id: string; timestamp: Date | number }>(
  getData: () => T[],
  removeData: (ids: string[]) => void | Promise<void>,
  targetReduction?: number
): Promise<number>
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `getData` | `() => T[]` | - | Function to get all data with timestamps |
| `removeData` | `(ids: string[]) => void \| Promise<void>` | - | Function to remove specific items |
| `targetReduction` | `number` | `20` | Target reduction percentage |

**Returns:** `Promise<number>` - Number of items removed

**Example:**

```typescript
await clearOldDataLRU(
  () => callStore.history.map(h => ({
    id: h.id,
    timestamp: h.startTime
  })),
  (ids) => ids.forEach(id => callStore.removeFromHistory(id)),
  20 // Remove oldest 20% of entries
)
```

**Strategy:**
- Sorts items by timestamp (oldest first)
- Removes specified percentage of oldest items
- Returns count of removed items

---

### getStorageUsageSummary

Gets a comprehensive summary of storage usage across all storage types.

**Signature:**

```typescript
async function getStorageUsageSummary(): Promise<{
  overall: StorageQuotaInfo
  localStorage: { available: boolean; estimatedUsage: number }
  sessionStorage: { available: boolean }
  indexedDB: { available: boolean }
}>
```

**Returns:** `Promise<StorageUsageSummary>` - Complete storage summary

**Example:**

```typescript
const summary = await getStorageUsageSummary()

console.log('Overall:', formatBytes(summary.overall.usage))
console.log('localStorage:', {
  available: summary.localStorage.available,
  usage: formatBytes(summary.localStorage.estimatedUsage)
})
console.log('sessionStorage available:', summary.sessionStorage.available)
console.log('indexedDB available:', summary.indexedDB.available)
```

---

### QuotaExceededError

Custom error class for quota exceeded situations.

**Signature:**

```typescript
class QuotaExceededError extends Error {
  constructor(message: string, quotaInfo: StorageQuotaInfo)
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `quotaInfo` | `StorageQuotaInfo` | Storage quota information at time of error |

**Example:**

```typescript
try {
  // Store large amount of data
  if (!await hasEnoughSpace(dataSize)) {
    const quotaInfo = await getStorageQuota()
    throw new QuotaExceededError('Not enough storage space', quotaInfo)
  }
} catch (error) {
  if (error instanceof QuotaExceededError) {
    console.error('Storage quota exceeded:', error.quotaInfo)
  }
}
```

---

## Logging Utilities

Configurable logging system with namespace support and log levels.

**Source:** [src/utils/logger.ts](../../src/utils/logger.ts)

### Logger Class

Main logger class with namespace support.

**Constructor:**

```typescript
new Logger(namespace: string)
```

**Methods:**

#### debug

```typescript
debug(message: string, ...args: unknown[]): void
```

Logs a debug message.

**Example:**

```typescript
const logger = new Logger('MyComponent')
logger.debug('Debug info', { data: 'value' })
```

#### info

```typescript
info(message: string, ...args: unknown[]): void
```

Logs an info message.

**Example:**

```typescript
logger.info('User connected', { userId: '123' })
```

#### warn

```typescript
warn(message: string, ...args: unknown[]): void
```

Logs a warning message.

**Example:**

```typescript
logger.warn('Connection slow', { latency: 500 })
```

#### error

```typescript
error(message: string, ...args: unknown[]): void
```

Logs an error message.

**Example:**

```typescript
logger.error('Connection failed', new Error('Network error'))
```

#### child

```typescript
child(childNamespace: string): Logger
```

Creates a child logger with extended namespace.

**Example:**

```typescript
const logger = new Logger('SipClient')
const callLogger = logger.child('Call')
// callLogger namespace: 'SipClient:Call'

callLogger.info('Call started')
// Output: [SipClient:Call] Call started
```

---

### createLogger

Creates a new logger instance (recommended over using `new Logger()`).

**Signature:**

```typescript
function createLogger(namespace: string): Logger
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | `string` | Logger namespace |

**Returns:** `Logger` - Logger instance

**Example:**

```typescript
import { createLogger } from 'vuesip/utils'

const logger = createLogger('MyComponent')
logger.info('Component initialized')
```

---

### configureLogger

Configures the global logger settings.

**Signature:**

```typescript
function configureLogger(config: Partial<LoggerConfig>): void
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `Partial<LoggerConfig>` | Logger configuration |

**Configuration Options:**

```typescript
interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'  // Minimum log level
  enabled: boolean                             // Enable/disable logging
  showTimestamp: boolean                       // Show timestamps
  handler?: LogHandler                         // Custom log handler
}
```

**Example:**

```typescript
import { configureLogger } from 'vuesip/utils'

configureLogger({
  level: 'debug',
  enabled: true,
  showTimestamp: true
})
```

---

### getLoggerConfig

Gets the current logger configuration.

**Signature:**

```typescript
function getLoggerConfig(): Readonly<LoggerConfig>
```

**Returns:** `Readonly<LoggerConfig>` - Current configuration

**Example:**

```typescript
const config = getLoggerConfig()
console.log('Current log level:', config.level)
```

---

### enableLogging

Enables logging globally.

**Signature:**

```typescript
function enableLogging(): void
```

**Example:**

```typescript
enableLogging()
```

---

### disableLogging

Disables logging globally.

**Signature:**

```typescript
function disableLogging(): void
```

**Example:**

```typescript
disableLogging()
```

---

### setLogLevel

Sets the minimum log level.

**Signature:**

```typescript
function setLogLevel(level: LogLevel): void
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | `'debug' \| 'info' \| 'warn' \| 'error'` | Minimum log level |

**Example:**

```typescript
setLogLevel('debug')  // Show all logs
setLogLevel('error')  // Show only errors
```

**Log Level Priorities:**
- `debug` (0) - Lowest priority, most verbose
- `info` (1)
- `warn` (2)
- `error` (3) - Highest priority, least verbose

---

### getLogLevel

Gets the current log level.

**Signature:**

```typescript
function getLogLevel(): LogLevel
```

**Returns:** `LogLevel` - Current log level

**Example:**

```typescript
const level = getLogLevel()
console.log('Current log level:', level)
```

---

### setLogHandler

Sets a custom log handler for testing or custom output.

**Signature:**

```typescript
function setLogHandler(handler: LogHandler | undefined): void
```

**Handler Type:**

```typescript
type LogHandler = (
  level: LogLevel,
  namespace: string,
  message: string,
  ...args: unknown[]
) => void
```

**Example:**

```typescript
// Send logs to server
setLogHandler((level, namespace, message, ...args) => {
  fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify({ level, namespace, message, args })
  })
})

// Reset to default console logging
setLogHandler(undefined)
```

---

## Constants

VueSip provides numerous constants for SIP configuration, media settings, and more.

**Source:** [src/utils/constants.ts](../../src/utils/constants.ts)

### Library Information

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `VERSION` | `string` | `'1.0.0'` | Library version |
| `USER_AGENT` | `string` | `'VueSip/1.0.0'` | Default User-Agent string |

**Example:**

```typescript
import { VERSION, USER_AGENT } from 'vuesip/utils'

console.log(`Using VueSip version ${VERSION}`)
```

---

### SIP Configuration Defaults

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `DEFAULT_REGISTER_EXPIRES` | `number` | `600` | Registration expiration (seconds) |
| `DEFAULT_SESSION_TIMERS` | `number` | `90` | Session timer expiration (seconds) |
| `DEFAULT_NO_ANSWER_TIMEOUT` | `number` | `60` | No answer timeout (seconds) |
| `DEFAULT_PING_INTERVAL` | `number` | `30000` | WebSocket keep-alive interval (ms) |
| `DEFAULT_MAX_FORWARDS` | `number` | `70` | Maximum forwards header value |

**Example:**

```typescript
import { DEFAULT_REGISTER_EXPIRES } from 'vuesip/utils'

const config = {
  registrationOptions: {
    expires: DEFAULT_REGISTER_EXPIRES
  }
}
```

---

### Media Configuration Defaults

| Constant | Type | Description |
|----------|------|-------------|
| `DEFAULT_AUDIO_CONSTRAINTS` | `object` | Default audio constraints for getUserMedia |
| `DEFAULT_VIDEO_CONSTRAINTS` | `object` | Default video constraints for getUserMedia |
| `DEFAULT_MEDIA_CONSTRAINTS` | `object` | Default media stream constraints |

**DEFAULT_AUDIO_CONSTRAINTS:**

```typescript
{
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1  // Mono for VoIP
}
```

**DEFAULT_VIDEO_CONSTRAINTS:**

```typescript
{
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30 },
  facingMode: 'user'
}
```

**Example:**

```typescript
import { DEFAULT_AUDIO_CONSTRAINTS } from 'vuesip/utils'

const stream = await navigator.mediaDevices.getUserMedia({
  audio: DEFAULT_AUDIO_CONSTRAINTS,
  video: false
})
```

---

### Timeout Values

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `RECONNECTION_DELAYS` | `number[]` | `[2000, 4000, 8000, 16000, 32000]` | Exponential backoff delays (ms) |
| `MAX_RETRY_ATTEMPTS` | `number` | `5` | Maximum reconnection attempts |
| `ICE_GATHERING_TIMEOUT` | `number` | `5000` | ICE gathering timeout (ms) |
| `DEFAULT_DTMF_DURATION` | `number` | `100` | DTMF tone duration (ms) |
| `DEFAULT_DTMF_INTER_TONE_GAP` | `number` | `70` | Inter-tone gap (ms) |
| `STATS_COLLECTION_INTERVAL` | `number` | `1000` | Stats collection interval (ms) |
| `AUDIO_LEVEL_INTERVAL` | `number` | `100` | Audio level update interval (ms) |

**Example:**

```typescript
import { RECONNECTION_DELAYS, MAX_RETRY_ATTEMPTS } from 'vuesip/utils'

for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
  const delay = RECONNECTION_DELAYS[attempt] || RECONNECTION_DELAYS[RECONNECTION_DELAYS.length - 1]
  await sleep(delay)
  // Retry connection
}
```

---

### Supported Codecs

| Constant | Type | Description |
|----------|------|-------------|
| `AUDIO_CODECS` | `string[]` | Supported audio codecs (in order of preference) |
| `VIDEO_CODECS` | `string[]` | Supported video codecs (in order of preference) |

**AUDIO_CODECS:**

```typescript
['opus', 'G722', 'PCMU', 'PCMA']
```

**VIDEO_CODECS:**

```typescript
['VP8', 'VP9', 'H264']
```

**Example:**

```typescript
import { AUDIO_CODECS } from 'vuesip/utils'

const preferredCodec = AUDIO_CODECS[0] // 'opus'
```

---

### SIP Status Codes

| Category | Codes |
|----------|-------|
| **Provisional (1xx)** | TRYING (100), RINGING (180), SESSION_PROGRESS (183) |
| **Success (2xx)** | OK (200), ACCEPTED (202) |
| **Redirection (3xx)** | MULTIPLE_CHOICES (300), MOVED_PERMANENTLY (301), MOVED_TEMPORARILY (302) |
| **Client Error (4xx)** | BAD_REQUEST (400), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), etc. |
| **Server Error (5xx)** | SERVER_INTERNAL_ERROR (500), NOT_IMPLEMENTED (501), BAD_GATEWAY (502), etc. |
| **Global Failure (6xx)** | BUSY_EVERYWHERE (600), DECLINE (603), DOES_NOT_EXIST_ANYWHERE (604), etc. |

**Example:**

```typescript
import { SIP_STATUS_CODES } from 'vuesip/utils'

if (response.statusCode === SIP_STATUS_CODES.RINGING) {
  console.log('Call is ringing')
}

if (response.statusCode === SIP_STATUS_CODES.BUSY_HERE) {
  console.log('Recipient is busy')
}
```

---

### Event Names

Standardized event names used throughout the library.

**Categories:**
- Connection events: `CONNECTION_*`
- Registration events: `REGISTRATION_*`
- Call events: `CALL_*`
- Media events: `MEDIA_*`
- Transfer events: `TRANSFER_*`
- DTMF events: `DTMF_*`
- Error events: `ERROR`

**Example:**

```typescript
import { EVENTS } from 'vuesip/utils'

client.on(EVENTS.CALL_INCOMING, (call) => {
  console.log('Incoming call from:', call.remoteIdentity)
})

client.on(EVENTS.REGISTRATION_REGISTERED, () => {
  console.log('Successfully registered')
})
```

**Full Event List:**

```typescript
const EVENTS = {
  // Connection events
  CONNECTION_CONNECTING: 'connection:connecting',
  CONNECTION_CONNECTED: 'connection:connected',
  CONNECTION_DISCONNECTED: 'connection:disconnected',
  CONNECTION_FAILED: 'connection:failed',
  CONNECTION_RECONNECTING: 'connection:reconnecting',

  // Registration events
  REGISTRATION_REGISTERING: 'registration:registering',
  REGISTRATION_REGISTERED: 'registration:registered',
  REGISTRATION_UNREGISTERED: 'registration:unregistered',
  REGISTRATION_FAILED: 'registration:failed',
  REGISTRATION_EXPIRING: 'registration:expiring',

  // Call events
  CALL_INCOMING: 'call:incoming',
  CALL_OUTGOING: 'call:outgoing',
  CALL_RINGING: 'call:ringing',
  CALL_PROGRESS: 'call:progress',
  CALL_ACCEPTED: 'call:accepted',
  CALL_ANSWERED: 'call:answered',
  CALL_HELD: 'call:held',
  CALL_UNHELD: 'call:unheld',
  CALL_MUTED: 'call:muted',
  CALL_UNMUTED: 'call:unmuted',
  CALL_TERMINATED: 'call:terminated',
  CALL_FAILED: 'call:failed',

  // Media events
  MEDIA_DEVICE_CHANGED: 'media:deviceChanged',
  MEDIA_DEVICE_ADDED: 'media:deviceAdded',
  MEDIA_DEVICE_REMOVED: 'media:deviceRemoved',
  MEDIA_STREAM_ADDED: 'media:streamAdded',
  MEDIA_STREAM_REMOVED: 'media:streamRemoved',
  MEDIA_TRACK_ADDED: 'media:trackAdded',
  MEDIA_TRACK_REMOVED: 'media:trackRemoved',

  // Transfer events
  TRANSFER_INITIATED: 'transfer:initiated',
  TRANSFER_ACCEPTED: 'transfer:accepted',
  TRANSFER_REJECTED: 'transfer:rejected',
  TRANSFER_COMPLETED: 'transfer:completed',
  TRANSFER_FAILED: 'transfer:failed',

  // DTMF events
  DTMF_TONE_SENT: 'dtmf:toneSent',
  DTMF_SEQUENCE_STARTED: 'dtmf:sequenceStarted',
  DTMF_SEQUENCE_COMPLETED: 'dtmf:sequenceCompleted',
  DTMF_FAILED: 'dtmf:failed',

  // Error events
  ERROR: 'error',
}
```

---

### Storage Keys

LocalStorage keys with namespace prefix.

| Constant | Value | Description |
|----------|-------|-------------|
| `STORAGE_PREFIX` | `'vuesip:'` | Key prefix for namespacing |
| `STORAGE_VERSION` | `'v1'` | Storage format version |
| `STORAGE_KEYS.CONFIG` | `'vuesip:v1:config'` | Config storage key |
| `STORAGE_KEYS.CREDENTIALS` | `'vuesip:v1:credentials'` | Credentials storage key |
| `STORAGE_KEYS.DEVICE_PREFERENCES` | `'vuesip:v1:devices'` | Device preferences key |
| `STORAGE_KEYS.USER_PREFERENCES` | `'vuesip:v1:preferences'` | User preferences key |
| `STORAGE_KEYS.CALL_HISTORY` | `'vuesip:v1:history'` | Call history key |

**Example:**

```typescript
import { STORAGE_KEYS } from 'vuesip/utils'

localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs))
```

---

### Performance Targets

Performance targets and limits.

| Constant | Value | Description |
|----------|-------|-------------|
| `PERFORMANCE.MAX_BUNDLE_SIZE` | `153600` | Max bundle size (150 KB) |
| `PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED` | `51200` | Max gzipped size (50 KB) |
| `PERFORMANCE.TARGET_CALL_SETUP_TIME` | `2000` | Target call setup (2 seconds) |
| `PERFORMANCE.MAX_STATE_UPDATE_LATENCY` | `50` | Max state update (50ms) |
| `PERFORMANCE.MAX_EVENT_PROPAGATION_TIME` | `10` | Max event propagation (10ms) |
| `PERFORMANCE.MAX_MEMORY_PER_CALL` | `52428800` | Max memory per call (50 MB) |
| `PERFORMANCE.TARGET_CPU_USAGE` | `15` | Target CPU usage (15%) |
| `PERFORMANCE.DEFAULT_MAX_CONCURRENT_CALLS` | `5` | Max concurrent calls |
| `PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES` | `1000` | Max history entries |

**Example:**

```typescript
import { PERFORMANCE } from 'vuesip/utils'

if (callHistory.length > PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES) {
  // Cleanup old entries
}
```

---

### Regular Expressions

| Constant | Pattern | Description |
|----------|---------|-------------|
| `SIP_URI_REGEX` | `/^sips?:([a-zA-Z0-9._+-]+)@([a-zA-Z0-9.-]+)(?::(\d+))?/` | SIP URI validation |
| `E164_PHONE_REGEX` | `/^\+[1-9]\d{1,14}$/` | E.164 phone number |
| `WEBSOCKET_URL_REGEX` | `/^wss?:\/\/.+/` | WebSocket URL validation |

**Example:**

```typescript
import { SIP_URI_REGEX } from 'vuesip/utils'

if (SIP_URI_REGEX.test(uri)) {
  console.log('Valid SIP URI')
}
```

---

### Type Guards

Arrays of valid values for type guards.

| Constant | Values | Description |
|----------|--------|-------------|
| `DTMF_TONES` | `['0'-'9', '*', '#', 'A'-'D']` | Valid DTMF tones |
| `LOG_LEVELS` | `['debug', 'info', 'warn', 'error']` | Valid log levels |
| `CALL_STATES` | `['idle', 'calling', 'ringing', ...]` | Valid call states |
| `CONNECTION_STATES` | `['disconnected', 'connecting', ...]` | Valid connection states |
| `REGISTRATION_STATES` | `['unregistered', 'registering', ...]` | Valid registration states |

**Example:**

```typescript
import { LOG_LEVELS } from 'vuesip/utils'

function isValidLogLevel(level: string): level is LogLevel {
  return LOG_LEVELS.includes(level as LogLevel)
}
```

---

## Related Documentation

- [Core API Reference](./core.md) - Main VueSip API
- [Types Reference](./types.md) - TypeScript type definitions
- [Plugin System](./plugins.md) - Plugin development guide

---

## Summary

VueSip provides **38+ utility functions** organized into 6 categories:

| Category | Functions | Purpose |
|----------|-----------|---------|
| **Validation** | 7 functions | Validate SIP URIs, phone numbers, configs, DTMF tones |
| **Formatting** | 14 functions | Format durations, URIs, dates, bytes, bitrates for display |
| **Encryption** | 5 functions | Secure data encryption using Web Crypto API |
| **Storage** | 8 functions | Manage storage quota and prevent quota errors |
| **Logging** | 10+ functions | Configurable logging with namespaces and levels |
| **Constants** | 100+ constants | SIP codes, events, defaults, regex patterns |

All utilities are:
- Fully typed with TypeScript
- Well-documented with examples
- Tested and production-ready
- Tree-shakeable for optimal bundle size

---

**Generated:** 2025-11-08
**VueSip Version:** 1.0.0
