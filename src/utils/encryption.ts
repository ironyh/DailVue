/**
 * Encryption Utilities
 *
 * Provides encryption/decryption utilities using Web Crypto API
 * for securing sensitive data in storage (e.g., SIP credentials).
 *
 * Uses AES-GCM encryption with PBKDF2 key derivation.
 *
 * @module utils/encryption
 */

import type { EncryptedData, EncryptionOptions } from '../types/storage.types'
import { createLogger } from './logger'

const logger = createLogger('utils:encryption')

/**
 * Default encryption options
 */
const DEFAULT_ENCRYPTION_OPTIONS: Required<EncryptionOptions> = {
  enabled: true,
  algorithm: 'AES-GCM',
  iterations: 100000,
  salt: '',
}

/**
 * Check if Web Crypto API is available
 * @returns True if crypto is available
 */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

/**
 * Generate a random salt
 * @param length - Salt length in bytes (default: 16)
 * @returns Salt as Uint8Array
 */
function generateSalt(length = 16): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Generate a random IV (Initialization Vector)
 * @param length - IV length in bytes (default: 12 for GCM)
 * @returns IV as Uint8Array
 */
function generateIV(length = 12): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Convert ArrayBuffer to base64 string
 * @param buffer - ArrayBuffer to convert
 * @returns Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const len = bytes.byteLength

  // Process in chunks for better performance with large buffers
  const chunkSize = 8192 // 8KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

/**
 * Convert base64 string to ArrayBuffer
 * @param base64 - Base64 string to convert
 * @returns ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)

  // Process in chunks for better performance
  const chunkSize = 8192 // 8KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len)
    for (let j = i; j < end; j++) {
      bytes[j] = binary.charCodeAt(j)
    }
  }

  return bytes.buffer
}

/**
 * Derive encryption key from password using PBKDF2
 * @param password - Password to derive key from
 * @param salt - Salt for key derivation
 * @param iterations - Number of iterations (default: 100000)
 * @returns CryptoKey for encryption/decryption
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<CryptoKey> {
  // Import password as key material
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive AES key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data using AES-GCM
 * @param data - Data to encrypt (will be JSON.stringified)
 * @param password - Password for encryption
 * @param options - Encryption options
 * @returns Encrypted data structure
 * @throws Error if encryption fails or crypto is not available
 */
export async function encrypt<T = unknown>(
  data: T,
  password: string,
  options: Partial<EncryptionOptions> = {}
): Promise<EncryptedData> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available')
  }

  const opts = { ...DEFAULT_ENCRYPTION_OPTIONS, ...options }

  try {
    // Generate salt and IV
    const salt = generateSalt()
    const iv = generateIV()

    // Derive encryption key
    const key = await deriveKey(password, salt, opts.iterations)

    // Encrypt data
    const encoder = new TextEncoder()
    const dataStr = JSON.stringify(data)
    const encrypted = await crypto.subtle.encrypt(
      { name: opts.algorithm, iv },
      key,
      encoder.encode(dataStr)
    )

    const result: EncryptedData = {
      data: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      algorithm: opts.algorithm,
      iterations: opts.iterations,
      version: 1,
    }

    logger.debug('Data encrypted successfully', {
      algorithm: opts.algorithm,
      dataLength: dataStr.length,
      encryptedLength: result.data.length,
    })

    return result
  } catch (error) {
    logger.error('Encryption failed:', error)
    throw new Error(`Encryption failed: ${(error as Error).message}`)
  }
}

/**
 * Decrypt data using AES-GCM
 * @param encryptedData - Encrypted data structure
 * @param password - Password for decryption
 * @returns Decrypted data
 * @throws Error if decryption fails or crypto is not available
 */
export async function decrypt<T = unknown>(
  encryptedData: EncryptedData,
  password: string
): Promise<T> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available')
  }

  try {
    // Convert base64 strings back to ArrayBuffers
    const salt = new Uint8Array(base64ToArrayBuffer(encryptedData.salt))
    const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv))
    const data = base64ToArrayBuffer(encryptedData.data)

    // Derive decryption key (using iterations from encrypted data)
    const iterations = encryptedData.iterations || 100000 // fallback for old data
    const key = await deriveKey(password, salt, iterations)

    // Decrypt data
    const decrypted = await crypto.subtle.decrypt({ name: encryptedData.algorithm, iv }, key, data)

    // Decode and parse
    const decoder = new TextDecoder()
    const dataStr = decoder.decode(decrypted)
    const result = JSON.parse(dataStr) as T

    logger.debug('Data decrypted successfully', {
      algorithm: encryptedData.algorithm,
      encryptedLength: encryptedData.data.length,
      decryptedLength: dataStr.length,
    })

    return result
  } catch (error) {
    logger.error('Decryption failed:', error)
    throw new Error(`Decryption failed: ${(error as Error).message}`)
  }
}

/**
 * Generate a random encryption key
 * This can be used as a password for encryption/decryption.
 * Store this securely (e.g., in memory or secure storage).
 *
 * @param length - Key length in bytes (default: 32)
 * @returns Random key as base64 string
 * @throws Error if crypto is not available
 */
export function generateEncryptionKey(length = 32): string {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available')
  }

  const key = crypto.getRandomValues(new Uint8Array(length))
  return arrayBufferToBase64(key)
}

/**
 * Hash a password using SHA-256
 * Useful for creating consistent encryption keys from user passwords.
 *
 * @param password - Password to hash
 * @returns Hashed password as hex string
 * @throws Error if crypto is not available
 */
export async function hashPassword(password: string): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available')
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
