/**
 * Store Persistence Configuration
 *
 * Configures and initializes persistence for all stores.
 * Provides methods to enable/disable persistence and manage storage.
 *
 * @module stores/persistence
 */

import { LocalStorageAdapter } from '../storage/LocalStorageAdapter'
import { IndexedDBAdapter } from '../storage/IndexedDBAdapter'
import { createPersistence, type PersistenceManager } from '../storage/persistence'
import { STORAGE_KEYS, type StorageConfig } from '../types/storage.types'
import { configStore } from './configStore'
import { deviceStore } from './deviceStore'
import { callStore } from './callStore'
import { registrationStore } from './registrationStore'
import { createLogger } from '../utils/logger'

const logger = createLogger('stores:persistence')

/**
 * Persistence configuration options
 */
export interface PersistenceConfig {
  /** Storage configuration (prefix, version, encryption) */
  storage?: StorageConfig
  /** Encryption password for sensitive data */
  encryptionPassword?: string
  /** Enable persistence (default: true) */
  enabled?: boolean
  /** Auto-load state on initialization (default: true) */
  autoLoad?: boolean
  /** Debounce delay for saves in ms (default: 300) */
  debounce?: number
}

/**
 * Store persistence manager
 */
class StorePersistenceManager {
  private localStorage: LocalStorageAdapter | null = null
  private indexedDB: IndexedDBAdapter | null = null
  private managers: Map<string, PersistenceManager<unknown>> = new Map()
  private config: PersistenceConfig = {}

  /**
   * Initialize persistence for all stores
   *
   * @param config - Persistence configuration
   */
  async initialize(config: PersistenceConfig = {}): Promise<void> {
    this.config = config

    if (config.enabled === false) {
      logger.info('Persistence disabled')
      return
    }

    const errors: Array<{ store: string; error: Error }> = []

    // Initialize storage adapters
    try {
      this.localStorage = new LocalStorageAdapter(config.storage, config.encryptionPassword)
    } catch (error) {
      errors.push({ store: 'localStorage', error: error as Error })
      logger.error('Failed to initialize localStorage adapter:', error)
    }

    try {
      this.indexedDB = new IndexedDBAdapter(config.storage)
      await this.indexedDB.initialize()
    } catch (error) {
      errors.push({ store: 'indexedDB', error: error as Error })
      logger.error('Failed to initialize IndexedDB adapter:', error)
    }

    // Setup persistence for each store (with error recovery)
    try {
      await this.setupConfigStore()
    } catch (error) {
      errors.push({ store: 'configStore', error: error as Error })
      logger.error('Failed to setup config store persistence:', error)
    }

    try {
      await this.setupDeviceStore()
    } catch (error) {
      errors.push({ store: 'deviceStore', error: error as Error })
      logger.error('Failed to setup device store persistence:', error)
    }

    try {
      await this.setupCallStore()
    } catch (error) {
      errors.push({ store: 'callStore', error: error as Error })
      logger.error('Failed to setup call store persistence:', error)
    }

    try {
      await this.setupRegistrationStore()
    } catch (error) {
      errors.push({ store: 'registrationStore', error: error as Error })
      logger.error('Failed to setup registration store persistence:', error)
    }

    if (errors.length > 0) {
      logger.warn(
        `Store persistence initialized with ${errors.length} error(s):`,
        errors.map((e) => `${e.store}: ${e.error.message}`)
      )
    } else {
      logger.info('Store persistence initialized successfully')
    }
  }

  /**
   * Setup persistence for config store
   */
  private async setupConfigStore(): Promise<void> {
    if (!this.localStorage) return

    // Persist SIP config (encrypted)
    const sipConfigPersistence = createPersistence({
      adapter: this.localStorage,
      key: STORAGE_KEYS.SIP_CONFIG,
      getState: () => configStore.sipConfig,
      setState: (config) => {
        if (config) {
          configStore.setSipConfig(config, false) // Don't validate on load
        }
      },
      watchSource: () => configStore.sipConfig,
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('config:sip', sipConfigPersistence)

    // Persist media config
    const mediaConfigPersistence = createPersistence({
      adapter: this.localStorage,
      key: STORAGE_KEYS.MEDIA_CONFIG,
      getState: () => configStore.mediaConfig,
      setState: (config) => {
        if (config) {
          configStore.setMediaConfig(config, false)
        }
      },
      watchSource: () => configStore.mediaConfig,
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('config:media', mediaConfigPersistence)

    // Persist user preferences
    const preferencesPersistence = createPersistence({
      adapter: this.localStorage,
      key: STORAGE_KEYS.USER_PREFERENCES,
      getState: () => configStore.userPreferences,
      setState: (prefs) => {
        if (prefs) {
          configStore.setUserPreferences(prefs)
        }
      },
      watchSource: () => configStore.userPreferences,
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('config:preferences', preferencesPersistence)

    logger.debug('Config store persistence configured')
  }

  /**
   * Setup persistence for device store
   */
  private async setupDeviceStore(): Promise<void> {
    if (!this.localStorage) return

    // Persist selected devices
    const deviceSelectionPersistence = createPersistence({
      adapter: this.localStorage,
      key: 'device:selection',
      getState: () => ({
        audioInput: deviceStore.selectedAudioInput?.deviceId,
        audioOutput: deviceStore.selectedAudioOutput?.deviceId,
        videoInput: deviceStore.selectedVideoInput?.deviceId,
      }),
      setState: (selection) => {
        // Device restoration happens after enumeration
        // Store the selection for later restoration
        if (selection.audioInput) {
          const device = deviceStore.findDeviceById(selection.audioInput)
          if (device) deviceStore.selectAudioInput(device)
        }
        if (selection.audioOutput) {
          const device = deviceStore.findDeviceById(selection.audioOutput)
          if (device) deviceStore.selectAudioOutput(device)
        }
        if (selection.videoInput) {
          const device = deviceStore.findDeviceById(selection.videoInput)
          if (device) deviceStore.selectVideoInput(device)
        }
      },
      watchSource: () => ({
        audioInput: deviceStore.selectedAudioInput?.deviceId,
        audioOutput: deviceStore.selectedAudioOutput?.deviceId,
        videoInput: deviceStore.selectedVideoInput?.deviceId,
      }),
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('device:selection', deviceSelectionPersistence)

    // Persist device permissions
    const permissionsPersistence = createPersistence({
      adapter: this.localStorage,
      key: STORAGE_KEYS.DEVICE_PERMISSIONS,
      getState: () => ({
        microphone: deviceStore.microphonePermission,
        camera: deviceStore.cameraPermission,
        speaker: deviceStore.speakerPermission,
        lastUpdated: Date.now(),
      }),
      setState: (permissions) => {
        deviceStore.updatePermissions(
          permissions.microphone,
          permissions.camera,
          permissions.speaker
        )
      },
      watchSource: () => ({
        microphone: deviceStore.microphonePermission,
        camera: deviceStore.cameraPermission,
        speaker: deviceStore.speakerPermission,
      }),
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('device:permissions', permissionsPersistence)

    logger.debug('Device store persistence configured')
  }

  /**
   * Setup persistence for call store (call history only)
   */
  private async setupCallStore(): Promise<void> {
    if (!this.indexedDB) return

    // Persist call history to IndexedDB
    const historyPersistence = createPersistence({
      adapter: this.indexedDB,
      key: STORAGE_KEYS.CALL_HISTORY,
      getState: () => callStore.history,
      setState: (history) => {
        // Restore call history
        history.forEach((entry) => {
          callStore.addToHistory(entry)
        })
      },
      watchSource: () => callStore.history,
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('call:history', historyPersistence)

    logger.debug('Call store persistence configured')
  }

  /**
   * Setup persistence for registration store
   */
  private async setupRegistrationStore(): Promise<void> {
    if (!this.localStorage) return

    // Persist registration state
    const registrationPersistence = createPersistence({
      adapter: this.localStorage,
      key: STORAGE_KEYS.REGISTRATION_STATE,
      getState: () => ({
        state: registrationStore.state,
        registeredUri: registrationStore.registeredUri,
        expiryTime: registrationStore.expiryTime,
        retryCount: registrationStore.retryCount,
      }),
      setState: (data) => {
        // Registration state is restored but not automatically re-registered
        // The app should handle re-registration on startup
        if (data.registeredUri && data.expiryTime) {
          registrationStore.markRegistered(data.registeredUri, data.expiryTime, data.retryCount)
        }
      },
      watchSource: () => ({
        state: registrationStore.state,
        registeredUri: registrationStore.registeredUri,
        expiryTime: registrationStore.expiryTime,
        retryCount: registrationStore.retryCount,
      }),
      autoLoad: this.config.autoLoad,
      debounce: this.config.debounce,
    })
    this.managers.set('registration:state', registrationPersistence)

    logger.debug('Registration store persistence configured')
  }

  /**
   * Manually save all store states
   */
  async saveAll(): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [key, manager] of this.managers) {
      promises.push(
        manager.save().catch((error) => {
          logger.error(`Failed to save ${key}:`, error)
        })
      )
    }

    await Promise.all(promises)
    logger.info('All store states saved')
  }

  /**
   * Manually load all store states
   */
  async loadAll(): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [key, manager] of this.managers) {
      promises.push(
        manager.load().catch((error) => {
          logger.error(`Failed to load ${key}:`, error)
        })
      )
    }

    await Promise.all(promises)
    logger.info('All store states loaded')
  }

  /**
   * Clear all persisted data
   */
  async clearAll(): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [key, manager] of this.managers) {
      promises.push(
        manager.clear().catch((error) => {
          logger.error(`Failed to clear ${key}:`, error)
        })
      )
    }

    await Promise.all(promises)
    logger.info('All persisted data cleared')
  }

  /**
   * Destroy all persistence managers
   */
  destroy(): void {
    for (const manager of this.managers.values()) {
      manager.destroy()
    }
    this.managers.clear()

    if (this.indexedDB) {
      this.indexedDB.close()
      this.indexedDB = null
    }

    this.localStorage = null
    logger.info('Store persistence destroyed')
  }

  /**
   * Get statistics about persistence
   */
  getStatistics() {
    return {
      enabled: this.config.enabled !== false,
      managersCount: this.managers.size,
      managers: Array.from(this.managers.keys()),
      hasLocalStorage: this.localStorage !== null,
      hasIndexedDB: this.indexedDB !== null,
    }
  }
}

// Export singleton instance
export const storePersistence = new StorePersistenceManager()

/**
 * Initialize store persistence
 *
 * @param config - Persistence configuration
 *
 * @example
 * ```typescript
 * // Initialize with default settings
 * await initializeStorePersistence()
 *
 * // Initialize with custom settings
 * await initializeStorePersistence({
 *   storage: { prefix: 'myapp', version: '2' },
 *   encryptionPassword: 'secure-password',
 *   debounce: 500
 * })
 * ```
 */
export async function initializeStorePersistence(config?: PersistenceConfig): Promise<void> {
  return storePersistence.initialize(config)
}

/**
 * Save all store states manually
 */
export async function saveAllStores(): Promise<void> {
  return storePersistence.saveAll()
}

/**
 * Load all store states manually
 */
export async function loadAllStores(): Promise<void> {
  return storePersistence.loadAll()
}

/**
 * Clear all persisted store data
 */
export async function clearAllStores(): Promise<void> {
  return storePersistence.clearAll()
}

/**
 * Destroy store persistence
 */
export function destroyStorePersistence(): void {
  storePersistence.destroy()
}
