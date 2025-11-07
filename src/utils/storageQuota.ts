/**
 * Storage Quota Utilities
 *
 * Utilities for checking and managing storage quota across different storage APIs.
 * Helps prevent quota exceeded errors and provides usage information.
 *
 * @module utils/storageQuota
 */

import { createLogger } from './logger'
import { formatBytes } from './formatters'

const logger = createLogger('utils:storageQuota')

/**
 * Storage quota information
 */
export interface StorageQuotaInfo {
  /** Total quota in bytes (0 if unavailable) */
  quota: number
  /** Current usage in bytes (0 if unavailable) */
  usage: number
  /** Available space in bytes */
  available: number
  /** Usage percentage (0-100) */
  usagePercent: number
  /** Whether quota API is supported */
  supported: boolean
}

/**
 * Storage type
 */
export type StorageType = 'localStorage' | 'sessionStorage' | 'indexedDB'

/**
 * Get storage quota information
 *
 * Uses the Storage API's estimate() method when available.
 * Falls back to approximations for browsers that don't support it.
 *
 * @returns Promise resolving to storage quota information
 *
 * @example
 * ```typescript
 * const quota = await getStorageQuota()
 * console.log(`Using ${quota.usagePercent}% of available storage`)
 * console.log(`${formatBytes(quota.available)} remaining`)
 * ```
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo> {
  // Check if Storage API is available (modern browsers)
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate()
      const quota = estimate.quota || 0
      const usage = estimate.usage || 0
      const available = quota - usage
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0

      logger.debug('Storage quota retrieved', {
        quota,
        usage,
        available,
        usagePercent: usagePercent.toFixed(2),
      })

      return {
        quota,
        usage,
        available,
        usagePercent,
        supported: true,
      }
    } catch (error) {
      logger.error('Failed to get storage quota:', error)
    }
  }

  // Fallback for browsers without Storage API
  logger.warn('Storage API not supported, returning default values')
  return {
    quota: 0,
    usage: 0,
    available: 0,
    usagePercent: 0,
    supported: false,
  }
}

/**
 * Check if storage is available
 *
 * @param storageType - Type of storage to check
 * @returns True if storage is available and writable
 */
export function isStorageAvailable(storageType: StorageType): boolean {
  try {
    const storage =
      storageType === 'localStorage'
        ? localStorage
        : storageType === 'sessionStorage'
          ? sessionStorage
          : null

    if (!storage && storageType !== 'indexedDB') {
      return false
    }

    if (storageType === 'indexedDB') {
      return typeof indexedDB !== 'undefined'
    }

    // Test write capability
    const testKey = '__vuesip_test__'
    storage!.setItem(testKey, testKey)
    storage!.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Estimate localStorage usage
 *
 * Approximates current localStorage usage by calculating size of all stored data.
 *
 * @returns Estimated size in bytes
 */
export function estimateLocalStorageUsage(): number {
  if (!isStorageAvailable('localStorage')) {
    return 0
  }

  let totalSize = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const value = localStorage.getItem(key) || ''
      // Each character is typically 2 bytes (UTF-16)
      totalSize += (key.length + value.length) * 2
    }
  }

  return totalSize
}

/**
 * Check if there's enough storage space
 *
 * @param requiredBytes - Required space in bytes
 * @param buffer - Safety buffer percentage (default: 0.1 = 10%)
 * @returns Promise resolving to true if enough space is available
 *
 * @example
 * ```typescript
 * const canStore = await hasEnoughSpace(1024 * 1024) // 1MB
 * if (!canStore) {
 *   console.warn('Not enough storage space')
 * }
 * ```
 */
export async function hasEnoughSpace(requiredBytes: number, buffer = 0.1): Promise<boolean> {
  const quota = await getStorageQuota()

  if (!quota.supported) {
    // If quota API not supported, assume we have space
    // Will fail gracefully when actual quota is exceeded
    return true
  }

  const requiredWithBuffer = requiredBytes * (1 + buffer)
  return quota.available >= requiredWithBuffer
}

/**
 * Storage quota exceeded error
 */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly quotaInfo: StorageQuotaInfo
  ) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

/**
 * Check and warn if storage usage is high
 *
 * @param threshold - Warning threshold percentage (default: 80)
 * @returns Promise resolving to true if usage is above threshold
 */
export async function checkStorageUsageWarning(threshold = 80): Promise<boolean> {
  const quota = await getStorageQuota()

  if (!quota.supported) {
    return false
  }

  if (quota.usagePercent >= threshold) {
    logger.warn(
      `Storage usage is at ${quota.usagePercent.toFixed(1)}% (${formatBytes(quota.usage)} of ${formatBytes(quota.quota)})`
    )
    return true
  }

  return false
}

/**
 * Clear old data based on LRU (Least Recently Used) strategy
 *
 * This is a utility function that can be used by stores to implement
 * automatic cleanup when quota is running low.
 *
 * @param getData - Function to get all data with timestamps
 * @param removeData - Function to remove specific items
 * @param targetReduction - Target reduction in percentage (default: 20)
 * @returns Promise resolving to number of items removed
 *
 * @example
 * ```typescript
 * await clearOldDataLRU(
 *   () => callStore.history.map(h => ({ id: h.id, timestamp: h.startTime })),
 *   (ids) => ids.forEach(id => callStore.removeFromHistory(id)),
 *   20 // Remove oldest 20% of entries
 * )
 * ```
 */
export async function clearOldDataLRU<T extends { id: string; timestamp: Date | number }>(
  getData: () => T[],
  removeData: (ids: string[]) => void | Promise<void>,
  targetReduction = 20
): Promise<number> {
  const data = getData()

  if (data.length === 0) {
    return 0
  }

  // Sort by timestamp (oldest first)
  const sorted = [...data].sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : a.timestamp
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : b.timestamp
    return timeA - timeB
  })

  // Calculate how many to remove
  const removeCount = Math.ceil((data.length * targetReduction) / 100)
  const toRemove = sorted.slice(0, removeCount)
  const idsToRemove = toRemove.map((item) => item.id)

  logger.info(`Removing ${removeCount} oldest items (${targetReduction}% of ${data.length})`)

  await removeData(idsToRemove)

  return removeCount
}

/**
 * Get storage usage summary
 *
 * Provides a comprehensive summary of storage usage across all storage types.
 *
 * @returns Promise resolving to storage usage summary
 */
export async function getStorageUsageSummary(): Promise<{
  overall: StorageQuotaInfo
  localStorage: { available: boolean; estimatedUsage: number }
  sessionStorage: { available: boolean }
  indexedDB: { available: boolean }
}> {
  const overall = await getStorageQuota()

  return {
    overall,
    localStorage: {
      available: isStorageAvailable('localStorage'),
      estimatedUsage: estimateLocalStorageUsage(),
    },
    sessionStorage: {
      available: isStorageAvailable('sessionStorage'),
    },
    indexedDB: {
      available: isStorageAvailable('indexedDB'),
    },
  }
}
