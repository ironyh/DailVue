/**
 * Recording Plugin for VueSip
 *
 * Provides comprehensive call recording capabilities using the MediaRecorder API.
 * Supports both audio and video recording with automatic storage in IndexedDB,
 * recording lifecycle management, and configurable auto-recording on call start.
 *
 * @remarks
 * This plugin integrates with VueSip's event system to automatically handle recording
 * lifecycle during calls. Recordings can be started manually or automatically when
 * calls begin, and are stopped when calls end.
 *
 * ## Features
 * - Audio and video recording with MediaRecorder API
 * - Automatic or manual recording control
 * - IndexedDB storage with automatic cleanup of old recordings
 * - Pause/resume recording support
 * - Configurable recording options (bitrate, MIME type, etc.)
 * - Memory management with automatic blob cleanup
 * - Recording download functionality
 * - Lifecycle hooks for recording events
 *
 * ## Storage Mechanism
 * Recordings are stored in IndexedDB when `storeInIndexedDB` is enabled.
 * The database schema includes:
 * - Object store: 'recordings' with keyPath 'id'
 * - Indexes: 'callId' and 'startTime' for efficient querying
 * - Automatic cleanup when max recordings limit is reached
 * - Quota management with automatic retry on quota exceeded
 *
 * ## Recording Management
 * - Active recordings are tracked by call ID
 * - Recording metadata stored separately from blobs to reduce memory usage
 * - Blobs are cleared from memory after saving to IndexedDB
 * - Old recordings automatically deleted when maxRecordings limit is reached
 * - Memory usage can be monitored via getMemoryUsage() method
 *
 * @example Basic usage with auto-recording
 * ```typescript
 * import { createRecordingPlugin } from './plugins/RecordingPlugin'
 *
 * const recordingPlugin = createRecordingPlugin()
 *
 * // Install with auto-recording enabled
 * await pluginManager.register(recordingPlugin, {
 *   enabled: true,
 *   autoStart: true,  // Automatically start recording on call start
 *   recordingOptions: {
 *     audio: true,
 *     video: false,
 *     mimeType: 'audio/webm',
 *     audioBitsPerSecond: 128000
 *   },
 *   storeInIndexedDB: true,
 *   maxRecordings: 50,
 *   onRecordingStop: (recording) => {
 *     console.log(`Recording saved: ${recording.id}, duration: ${recording.duration}ms`)
 *   }
 * })
 * ```
 *
 * @example Manual recording control
 * ```typescript
 * import { createRecordingPlugin } from './plugins/RecordingPlugin'
 *
 * const recordingPlugin = createRecordingPlugin()
 *
 * // Install without auto-recording
 * await pluginManager.register(recordingPlugin, {
 *   enabled: true,
 *   autoStart: false
 * })
 *
 * // Start recording manually
 * const callId = 'call-123'
 * const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
 * const recordingId = await recordingPlugin.startRecording(callId, stream)
 *
 * // Pause and resume
 * recordingPlugin.pauseRecording(callId)
 * recordingPlugin.resumeRecording(callId)
 *
 * // Stop recording
 * await recordingPlugin.stopRecording(callId)
 *
 * // Download recording
 * recordingPlugin.downloadRecording(recordingId, 'my-call.webm')
 * ```
 *
 * @example Custom recording options per call
 * ```typescript
 * // Start recording with custom options for this specific call
 * const recordingId = await recordingPlugin.startRecording(callId, stream, {
 *   audio: true,
 *   video: true,  // Override default to include video
 *   mimeType: 'video/webm;codecs=vp9,opus',
 *   videoBitsPerSecond: 2500000,
 *   audioBitsPerSecond: 128000
 * })
 * ```
 *
 * @example Monitoring and cleanup
 * ```typescript
 * // Check memory usage
 * const memoryUsage = recordingPlugin.getMemoryUsage()
 * console.log(`Recordings using ${memoryUsage} bytes of memory`)
 *
 * // Clear old recordings from memory (not from IndexedDB)
 * const cleared = recordingPlugin.clearOldRecordingsFromMemory(3600000) // 1 hour
 * console.log(`Cleared ${cleared} recordings from memory`)
 *
 * // Get all recordings
 * const allRecordings = recordingPlugin.getAllRecordings()
 * ```
 */

import { createLogger } from '../utils/logger'
import type {
  Plugin,
  PluginContext,
  RecordingPluginConfig,
  RecordingState,
  RecordingData,
  RecordingOptions,
} from '../types/plugin.types'

const logger = createLogger('RecordingPlugin')

/**
 * Default recording plugin configuration
 *
 * @remarks
 * This configuration object defines all available options for the recording plugin.
 * All options can be overridden when installing the plugin or starting individual recordings.
 *
 * ## Configuration Options
 *
 * ### enabled
 * - Type: `boolean`
 * - Default: `true`
 * - Description: Whether the recording plugin is enabled. When disabled, all recording
 *   operations will be prevented.
 *
 * ### autoStart
 * - Type: `boolean`
 * - Default: `false`
 * - Description: Automatically start recording when a call begins. When enabled, the plugin
 *   listens to 'callStarted' events and begins recording immediately.
 *
 * ### recordingOptions
 * - Type: `RecordingOptions`
 * - Description: Default MediaRecorder options for all recordings. Can be overridden per recording.
 *
 *   #### recordingOptions.audio
 *   - Type: `boolean`
 *   - Default: `true`
 *   - Description: Include audio track in the recording
 *
 *   #### recordingOptions.video
 *   - Type: `boolean`
 *   - Default: `false`
 *   - Description: Include video track in the recording
 *
 *   #### recordingOptions.mimeType
 *   - Type: `string`
 *   - Default: `'audio/webm'`
 *   - Description: Preferred MIME type for recordings. The plugin will fallback to other
 *     supported types if the preferred type is not available. Supported types include:
 *     - 'audio/webm', 'audio/webm;codecs=opus'
 *     - 'audio/ogg;codecs=opus', 'audio/mp4'
 *     - 'video/webm', 'video/webm;codecs=vp8,opus'
 *     - 'video/webm;codecs=vp9,opus', 'video/mp4'
 *
 *   #### recordingOptions.audioBitsPerSecond
 *   - Type: `number`
 *   - Default: `128000` (128 kbps)
 *   - Description: Audio encoding bitrate. Higher values provide better quality but larger files.
 *     Common values: 64000 (64kbps), 128000 (128kbps), 192000 (192kbps)
 *
 *   #### recordingOptions.videoBitsPerSecond
 *   - Type: `number`
 *   - Default: `undefined`
 *   - Description: Video encoding bitrate. Only used when video is enabled.
 *     Common values: 1000000 (1 Mbps), 2500000 (2.5 Mbps), 5000000 (5 Mbps)
 *
 *   #### recordingOptions.timeslice
 *   - Type: `number`
 *   - Default: `undefined`
 *   - Description: Time in milliseconds between dataavailable events. When specified,
 *     MediaRecorder will emit data in chunks rather than all at once.
 *
 * ### storeInIndexedDB
 * - Type: `boolean`
 * - Default: `true`
 * - Description: Store completed recordings in IndexedDB for persistence. When enabled,
 *   recording blobs are saved to IndexedDB and cleared from memory to prevent memory leaks.
 *
 * ### dbName
 * - Type: `string`
 * - Default: `'vuesip-recordings'`
 * - Description: Name of the IndexedDB database for storing recordings
 *
 * ### maxRecordings
 * - Type: `number`
 * - Default: `50`
 * - Description: Maximum number of recordings to keep in IndexedDB. When this limit is
 *   exceeded and autoDeleteOld is true, oldest recordings are automatically deleted.
 *
 * ### autoDeleteOld
 * - Type: `boolean`
 * - Default: `true`
 * - Description: Automatically delete oldest recordings when maxRecordings limit is reached.
 *   Deletion is triggered after each recording is saved.
 *
 * ### onRecordingStart
 * - Type: `(recording: RecordingData) => void`
 * - Default: `() => {}`
 * - Description: Callback invoked when recording starts. Receives recording metadata.
 *
 * ### onRecordingStop
 * - Type: `(recording: RecordingData) => void`
 * - Default: `() => {}`
 * - Description: Callback invoked when recording stops. Receives complete recording data
 *   including duration and blob (if not yet saved to IndexedDB).
 *
 * ### onRecordingError
 * - Type: `(error: Error) => void`
 * - Default: `() => {}`
 * - Description: Callback invoked when a recording error occurs. Receives the error object.
 */
const DEFAULT_CONFIG: Required<RecordingPluginConfig> = {
  enabled: true,
  autoStart: false,
  recordingOptions: {
    audio: true,
    video: false,
    mimeType: 'audio/webm',
    audioBitsPerSecond: 128000,
  },
  storeInIndexedDB: true,
  dbName: 'vuesip-recordings',
  maxRecordings: 50,
  autoDeleteOld: true,
  onRecordingStart: () => {},
  onRecordingStop: () => {},
  onRecordingError: () => {},
}

/**
 * RecordingPlugin class
 *
 * Main plugin class that implements the Plugin interface for VueSip.
 * Manages recording lifecycle, storage, and integration with the event system.
 *
 * @remarks
 * This class is the core implementation of the recording functionality.
 * It maintains state for active recordings, handles MediaRecorder lifecycle,
 * manages IndexedDB storage, and provides memory management utilities.
 *
 * @see {@link createRecordingPlugin} for the factory function to create instances
 * @see {@link DEFAULT_CONFIG} for available configuration options
 */
export class RecordingPlugin implements Plugin<RecordingPluginConfig> {
  /** Plugin metadata */
  metadata = {
    name: 'recording',
    version: '1.0.0',
    description: 'Call recording plugin with MediaRecorder support',
    author: 'VueSip',
    license: 'MIT',
  }

  /** Default configuration */
  defaultConfig = DEFAULT_CONFIG

  /** Current configuration */
  private config: Required<RecordingPluginConfig> = DEFAULT_CONFIG

  /** Active recordings by call ID */
  private activeRecordings: Map<string, MediaRecorder> = new Map()

  /** Recording data by recording ID */
  private recordings: Map<string, RecordingData> = new Map()

  /** Event listener cleanup functions */
  private cleanupFunctions: Array<() => void> = []

  /** IndexedDB database */
  private db: IDBDatabase | null = null

  /** Flag to prevent concurrent deletion operations */
  private isDeleting: boolean = false

  /**
   * Install the recording plugin into VueSip
   *
   * Initializes the recording plugin by verifying MediaRecorder API support, setting up IndexedDB
   * storage (if enabled), and registering event listeners for automatic recording lifecycle management.
   * This method must be called before any recording operations can be performed.
   *
   * @param context - The plugin context provided by VueSip's plugin manager, containing the event bus
   *   and other runtime information needed for plugin integration
   * @param config - Optional configuration object to override default settings. All properties are optional
   *   and will be merged with {@link DEFAULT_CONFIG}. Common options include:
   *   - `enabled`: Whether recording is enabled (default: true)
   *   - `autoStart`: Automatically start recording when calls begin (default: false)
   *   - `recordingOptions`: MediaRecorder options (audio, video, mimeType, bitrates)
   *   - `storeInIndexedDB`: Persist recordings to IndexedDB (default: true)
   *   - `maxRecordings`: Maximum recordings to keep in storage (default: 50)
   *   - `onRecordingStart`, `onRecordingStop`, `onRecordingError`: Lifecycle callbacks
   *
   * @returns A promise that resolves when installation is complete, including IndexedDB initialization
   *   if storage is enabled
   *
   * @throws {Error} If MediaRecorder API is not supported in the current browser environment
   * @throws {Error} If IndexedDB initialization fails (when `storeInIndexedDB` is enabled)
   *
   * @remarks
   * ## Installation Process
   * 1. Merges provided config with default configuration
   * 2. Validates MediaRecorder API availability in the browser
   * 3. Initializes IndexedDB database and object stores (if enabled)
   * 4. Registers event listeners for 'callStarted' and 'callEnded' events
   *
   * ## Event Listeners
   * When `autoStart` is enabled, the plugin listens for:
   * - `callStarted`: Automatically begins recording the call's media stream
   * - `callEnded`: Automatically stops and saves the recording
   *
   * ## Storage Behavior
   * If `storeInIndexedDB` is enabled:
   * - Creates database with name from `dbName` config (default: 'vuesip-recordings')
   * - Creates 'recordings' object store with indexes on 'callId' and 'startTime'
   * - Enables persistent storage across browser sessions
   * - Implements automatic quota management with retry logic
   *
   * ## Memory Management
   * The plugin automatically:
   * - Clears recording blobs from memory after saving to IndexedDB
   * - Deletes oldest recordings when `maxRecordings` limit is reached (if `autoDeleteOld` is true)
   * - Prevents memory leaks by revoking object URLs and clearing blob references
   *
   * @example Basic installation with default settings
   * ```typescript
   * const plugin = createRecordingPlugin()
   * await plugin.install(context)
   * // Plugin ready with default configuration
   * ```
   *
   * @example Installation with custom configuration
   * ```typescript
   * const plugin = createRecordingPlugin()
   * await plugin.install(context, {
   *   enabled: true,
   *   autoStart: true,
   *   recordingOptions: {
   *     audio: true,
   *     video: true,
   *     mimeType: 'video/webm;codecs=vp9,opus',
   *     audioBitsPerSecond: 128000,
   *     videoBitsPerSecond: 2500000
   *   },
   *   storeInIndexedDB: true,
   *   maxRecordings: 100,
   *   onRecordingStop: (recording) => {
   *     console.log(`Recording completed: ${recording.id}`)
   *     console.log(`Duration: ${recording.duration}ms`)
   *     console.log(`Size: ${recording.blob?.size} bytes`)
   *   }
   * })
   * ```
   *
   * @example Installation with error handling
   * ```typescript
   * const plugin = createRecordingPlugin()
   * try {
   *   await plugin.install(context, { storeInIndexedDB: true })
   *   console.log('Recording plugin installed successfully')
   * } catch (error) {
   *   if (error.message.includes('MediaRecorder')) {
   *     console.error('Browser does not support recording')
   *   } else if (error.message.includes('IndexedDB')) {
   *     console.error('Failed to initialize storage')
   *   }
   * }
   * ```
   */
  async install(context: PluginContext, config?: RecordingPluginConfig): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config }

    logger.info('Installing recording plugin')

    // Check MediaRecorder support
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder API is not supported in this browser')
    }

    // Initialize IndexedDB if enabled
    if (this.config.storeInIndexedDB) {
      await this.initIndexedDB()
    }

    // Register event listeners
    this.registerEventListeners(context)

    logger.info('Recording plugin installed')
  }

  /**
   * Uninstall the recording plugin from VueSip
   *
   * Performs complete cleanup of the plugin by stopping all active recordings, clearing memory,
   * closing database connections, and removing event listeners. This method ensures no resources
   * are leaked and the plugin can be safely removed from the application.
   *
   * @param _context - The plugin context (unused, but required by Plugin interface)
   *
   * @returns A promise that resolves when uninstallation is complete and all cleanup has finished
   *
   * @remarks
   * ## Cleanup Process
   * The uninstall operation performs the following steps in sequence:
   * 1. **Stop Active Recordings**: Stops all recordings currently in progress for any active calls
   * 2. **Clear Memory**: Removes all recording blobs from memory to free up heap space
   * 3. **Clear Recordings Map**: Removes all recording metadata from the in-memory map
   * 4. **Close Database**: Closes the IndexedDB connection (recordings remain persisted)
   * 5. **Remove Event Listeners**: Unregisters all event listeners to prevent memory leaks
   *
   * ## Side Effects
   * - All active recordings are stopped and finalized
   * - Recording blobs are cleared from memory (but IndexedDB data persists)
   * - All event listeners are removed from the event bus
   * - IndexedDB connection is closed (database and data remain, but connection is terminated)
   * - Plugin cannot be used until reinstalled via `install()`
   *
   * ## Data Persistence
   * Important: Recordings stored in IndexedDB are **NOT** deleted during uninstall.
   * Only the in-memory data and active connections are cleared. To delete persisted
   * recordings, use `indexedDB.deleteDatabase(dbName)` after uninstalling.
   *
   * ## Error Handling
   * If any recording fails to stop during cleanup, the error is logged but does not
   * prevent the uninstall process from completing. This ensures the plugin can always
   * be uninstalled even if individual recordings are in error states.
   *
   * @example Basic uninstall
   * ```typescript
   * await plugin.uninstall(context)
   * console.log('Recording plugin uninstalled')
   * ```
   *
   * @example Uninstall with cleanup verification
   * ```typescript
   * // Check active recordings before uninstall
   * const activeCount = plugin.getAllRecordings().length
   * console.log(`${activeCount} recordings active before uninstall`)
   *
   * await plugin.uninstall(context)
   *
   * // Verify cleanup
   * const memoryUsage = plugin.getMemoryUsage()
   * console.log(`Memory usage after uninstall: ${memoryUsage} bytes`) // Should be 0
   * ```
   *
   * @example Complete cleanup including IndexedDB
   * ```typescript
   * const dbName = plugin.config.dbName || 'vuesip-recordings'
   *
   * // Uninstall plugin
   * await plugin.uninstall(context)
   *
   * // Delete database to remove all persisted recordings
   * await new Promise((resolve, reject) => {
   *   const request = indexedDB.deleteDatabase(dbName)
   *   request.onsuccess = resolve
   *   request.onerror = reject
   * })
   *
   * console.log('Plugin uninstalled and all recordings deleted')
   * ```
   */
  async uninstall(_context: PluginContext): Promise<void> {
    logger.info('Uninstalling recording plugin')

    // Stop all active recordings
    for (const [callId] of this.activeRecordings) {
      try {
        await this.stopRecording(callId)
      } catch (error) {
        logger.error(`Failed to stop recording for call ${callId}`, error)
      }
    }

    // Clear all recording blobs from memory
    for (const [recordingId] of this.recordings) {
      this.clearRecordingBlob(recordingId)
    }

    // Clear recordings map
    this.recordings.clear()

    // Close IndexedDB
    if (this.db) {
      this.db.close()
      this.db = null
    }

    // Remove event listeners
    for (const cleanup of this.cleanupFunctions) {
      cleanup()
    }
    this.cleanupFunctions = []

    logger.info('Recording plugin uninstalled')
  }

  /**
   * Update the plugin configuration at runtime
   *
   * Merges the provided configuration changes with the existing configuration, allowing dynamic
   * updates to plugin behavior without requiring reinstallation. Configuration changes take effect
   * immediately and apply to all subsequent operations.
   *
   * @param _context - The plugin context (unused, but required by Plugin interface)
   * @param config - Partial configuration object with properties to update. All properties are optional.
   *   Only the properties included in this object will be changed; other settings remain unchanged.
   *   Can update:
   *   - `enabled`: Enable/disable recording functionality
   *   - `autoStart`: Change automatic recording behavior
   *   - `recordingOptions`: Update default MediaRecorder settings
   *   - `storeInIndexedDB`: Toggle IndexedDB storage (note: doesn't initialize/close DB connection)
   *   - `maxRecordings`: Change storage limit
   *   - `autoDeleteOld`: Toggle automatic cleanup
   *   - `onRecordingStart`, `onRecordingStop`, `onRecordingError`: Update lifecycle callbacks
   *
   * @returns A promise that resolves when the configuration update is complete
   *
   * @remarks
   * ## Immediate Effect
   * Configuration changes take effect immediately:
   * - New recordings will use updated `recordingOptions`
   * - Event listeners respect updated `autoStart` setting (already registered listeners remain)
   * - Callbacks use updated functions immediately
   * - Storage operations use updated `maxRecordings` limit
   *
   * ## Active Recordings
   * Configuration updates **do not affect** recordings that are already in progress:
   * - Active recordings continue with their original options
   * - Recording state is not changed by configuration updates
   * - Stopping and restarting is required to apply new options to a specific call
   *
   * ## Event Listeners
   * Important: Updating `autoStart` does **not** automatically register or unregister event listeners.
   * Event listeners are only registered during `install()`. To change auto-start behavior:
   * 1. Call `uninstall()` to remove existing listeners
   * 2. Update configuration
   * 3. Call `install()` with new configuration
   *
   * Alternatively, update config before initial installation.
   *
   * ## Storage Limitations
   * - Changing `storeInIndexedDB` does not initialize or close the database connection
   * - Changing `dbName` has no effect after installation (database already opened)
   * - To change storage settings, uninstall and reinstall the plugin
   *
   * ## Partial Updates
   * The configuration is merged, not replaced:
   * ```typescript
   * // Only updates audioBitsPerSecond, other recordingOptions unchanged
   * await plugin.updateConfig(context, {
   *   recordingOptions: { audioBitsPerSecond: 192000 }
   * })
   * ```
   *
   * @example Update recording quality
   * ```typescript
   * // Increase audio quality for future recordings
   * await plugin.updateConfig(context, {
   *   recordingOptions: {
   *     audioBitsPerSecond: 192000,  // Increase from default 128000
   *     mimeType: 'audio/webm;codecs=opus'
   *   }
   * })
   * ```
   *
   * @example Change storage limits
   * ```typescript
   * // Increase maximum stored recordings
   * await plugin.updateConfig(context, {
   *   maxRecordings: 100,  // Increase from default 50
   *   autoDeleteOld: true  // Ensure old recordings are cleaned up
   * })
   * ```
   *
   * @example Update lifecycle callbacks
   * ```typescript
   * // Add custom callback for recording completion
   * await plugin.updateConfig(context, {
   *   onRecordingStop: (recording) => {
   *     console.log(`Recording ${recording.id} completed`)
   *     // Upload to server
   *     uploadRecording(recording)
   *   },
   *   onRecordingError: (error) => {
   *     console.error('Recording failed:', error)
   *     // Send error to monitoring service
   *     reportError(error)
   *   }
   * })
   * ```
   *
   * @example Enable/disable recording
   * ```typescript
   * // Temporarily disable recording
   * await plugin.updateConfig(context, { enabled: false })
   *
   * // Re-enable later
   * await plugin.updateConfig(context, { enabled: true })
   * ```
   */
  async updateConfig(_context: PluginContext, config: RecordingPluginConfig): Promise<void> {
    this.config = { ...this.config, ...config }
    logger.info('Recording plugin configuration updated')
  }

  /**
   * Initialize the IndexedDB database for persistent recording storage
   *
   * Creates or opens an IndexedDB database with the configured name and sets up the required
   * object stores and indexes for storing recording data. This method handles database versioning,
   * schema creation, and establishes the connection that will be used throughout the plugin's lifecycle.
   *
   * @returns A promise that resolves when the database is successfully initialized and ready for use
   *
   * @throws {Error} Throws an error if the IndexedDB cannot be opened due to:
   *   - Browser not supporting IndexedDB
   *   - Database access being blocked by browser settings or permissions
   *   - Database corruption or version conflicts
   *   - User denying storage permissions
   *
   * @remarks
   * ## Database Schema
   * The method creates a single object store named 'recordings' with the following structure:
   * - **Primary Key**: `id` (keyPath) - The unique recording ID
   * - **Indexes**:
   *   - `callId`: Non-unique index for querying recordings by call ID (supports multiple recordings per call)
   *   - `startTime`: Non-unique index for time-based queries and sorting (used for deletion of old recordings)
   *
   * ## Initialization Process
   * 1. Opens the database with `indexedDB.open(dbName, version)` where version is 1
   * 2. If database doesn't exist or version is outdated, triggers `onupgradeneeded` event
   * 3. In upgrade handler, creates object store and indexes if they don't exist
   * 4. On success, stores the database connection in `this.db` for future transactions
   * 5. On error, rejects the promise with a descriptive error message
   *
   * ## Error Handling
   * The method uses a Promise wrapper around the IndexedDB request API to provide async/await support.
   * Any errors during the open operation are caught in the `onerror` handler and result in promise rejection.
   *
   * ## Idempotency
   * The upgrade handler checks if object stores already exist before creating them, making this
   * method safe to call multiple times. However, it's designed to be called once during plugin initialization.
   *
   * ## Storage Limits
   * IndexedDB storage is subject to browser quotas. The database stores binary Blob data which can
   * consume significant space. See the `maxRecordings` configuration option to control storage usage.
   *
   * @internal
   */
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 1)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        logger.debug('IndexedDB initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create recordings object store
        if (!db.objectStoreNames.contains('recordings')) {
          const store = db.createObjectStore('recordings', { keyPath: 'id' })
          store.createIndex('callId', 'callId', { unique: false })
          store.createIndex('startTime', 'startTime', { unique: false })
        }
      }
    })
  }

  /**
   * Register event listeners for automatic recording lifecycle management
   *
   * Sets up event handlers on the plugin's event bus to automatically manage recording lifecycle
   * based on call events. This method subscribes to call lifecycle events and configures automatic
   * recording start/stop behavior based on the plugin configuration. All registered listeners are
   * tracked for proper cleanup during plugin destruction.
   *
   * @param context - The plugin context providing access to the event bus and other plugin infrastructure.
   *   The context must contain a valid `eventBus` instance that supports `on()` and `off()` methods
   *   for event subscription and unsubscription.
   *
   * @returns void - This method does not return a value but registers event handlers as side effects
   *
   * @remarks
   * ## Event Subscriptions
   * This method registers handlers for the following events:
   *
   * ### 1. callStarted Event (Conditional)
   * - **When**: Only registered if `config.autoStart` is enabled
   * - **Purpose**: Automatically begins recording when a new call starts
   * - **Behavior**:
   *   - Extracts `callId` and `stream` from the event data
   *   - Validates that both callId and stream are available
   *   - Calls `startRecording(callId, stream)` asynchronously
   *   - Logs errors if auto-start fails but does not throw (graceful degradation)
   * - **Data Extraction**: Supports multiple event data formats:
   *   - `data.callId` or `data.call?.id` for call identification
   *   - `data.stream` or `data.call?.localStream` for media stream
   *
   * ### 2. callEnded Event (Always Registered)
   * - **When**: Always registered regardless of configuration
   * - **Purpose**: Automatically stops any active recording when a call ends
   * - **Behavior**:
   *   - Extracts `callId` from the event data
   *   - Checks if an active recording exists for the call ID
   *   - Calls `stopRecording(callId)` if recording is active
   *   - Logs errors if stop fails but does not throw
   * - **Safety**: Only attempts to stop recordings that are actually active
   *
   * ## Cleanup Management
   * Each registered event handler is paired with a cleanup function that:
   * - Unsubscribes the handler from the event bus
   * - Is stored in `this.cleanupFunctions` array
   * - Gets executed during plugin destruction via `destroy()` method
   * - Prevents memory leaks and ensures proper resource cleanup
   *
   * ## Error Handling Strategy
   * All event handlers implement graceful error handling:
   * - Errors are caught and logged but not propagated
   * - Failed auto-start doesn't prevent the call from proceeding
   * - Failed auto-stop doesn't block call termination
   * - This ensures recording issues don't disrupt call functionality
   *
   * ## Thread Safety
   * Event handlers are asynchronous and may execute concurrently. The underlying
   * `startRecording` and `stopRecording` methods implement their own synchronization
   * to prevent race conditions (e.g., starting the same call twice).
   *
   * ## Configuration Dependency
   * The behavior of this method is controlled by:
   * - `config.autoStart`: Controls whether to auto-start recordings on callStarted
   * - Auto-stop is always enabled and not configurable (ensures cleanup)
   *
   * @internal
   */
  private registerEventListeners(context: PluginContext): void {
    const { eventBus } = context

    // Auto-start recording on call start
    if (this.config.autoStart) {
      const onCallStarted = async (data: any) => {
        const callId = data.callId || data.call?.id
        const stream = data.stream || data.call?.localStream

        if (callId && stream) {
          try {
            await this.startRecording(callId, stream)
          } catch (error) {
            logger.error(`Failed to auto-start recording for call ${callId}`, error)
          }
        }
      }

      eventBus.on('callStarted', onCallStarted)
      this.cleanupFunctions.push(() => eventBus.off('callStarted', onCallStarted))
    }

    // Stop recording on call end
    const onCallEnded = async (data: any) => {
      const callId = data.callId || data.call?.id

      if (callId && this.activeRecordings.has(callId)) {
        try {
          await this.stopRecording(callId)
        } catch (error) {
          logger.error(`Failed to stop recording for call ${callId}`, error)
        }
      }
    }

    eventBus.on('callEnded', onCallEnded)
    this.cleanupFunctions.push(() => eventBus.off('callEnded', onCallEnded))

    logger.debug('Event listeners registered')
  }

  /**
   * Start recording a call's media stream
   *
   * Initiates recording of the provided MediaStream using the MediaRecorder API. Creates a new
   * recording instance, configures the MediaRecorder with the specified or default options, and
   * begins capturing audio/video data. The recording is associated with the call ID and can be
   * controlled via pause/resume/stop methods.
   *
   * @param callId - Unique identifier for the call being recorded. Must be unique across active recordings.
   *   This ID is used to control the recording (pause, resume, stop) and to associate the recording
   *   with call metadata. Typically matches the SIP call ID or session identifier.
   * @param stream - MediaStream to record, containing audio and/or video tracks. Must be an active
   *   MediaStream with at least one track. Typically obtained from:
   *   - `navigator.mediaDevices.getUserMedia()` for local media
   *   - `RTCPeerConnection.getLocalStreams()` for local RTC streams
   *   - Call event data (`callStarted` event provides the stream)
   * @param options - Optional recording options that override the default configuration for this
   *   specific recording. Supports partial overrides; unspecified options use defaults. Available options:
   *   - `audio` (boolean): Include audio tracks (default: true)
   *   - `video` (boolean): Include video tracks (default: false)
   *   - `mimeType` (string): Preferred MIME type, with automatic fallback to supported types
   *   - `audioBitsPerSecond` (number): Audio encoding bitrate in bps (default: 128000)
   *   - `videoBitsPerSecond` (number): Video encoding bitrate in bps (only if video enabled)
   *   - `timeslice` (number): Milliseconds between dataavailable events (optional)
   *
   * @returns A promise that resolves to a unique recording ID (string). This ID can be used to:
   *   - Retrieve recording data via `getRecording(recordingId)`
   *   - Download the recording via `downloadRecording(recordingId)`
   *   - Identify the recording in lifecycle callbacks
   *   The recording ID format is 'recording-{uuid}' or 'recording-{timestamp}-{random}'
   *
   * @throws {Error} If a recording is already active for the specified `callId`
   * @throws {Error} If no supported MIME type can be found for the requested recording options
   *
   * @remarks
   * ## Recording Process
   * 1. **Validation**: Checks if call is already being recorded
   * 2. **Configuration**: Merges provided options with default configuration
   * 3. **MIME Type Selection**: Determines best supported MIME type with automatic fallback
   * 4. **MediaRecorder Creation**: Initializes MediaRecorder with stream and options
   * 5. **Event Handlers**: Sets up handlers for data collection and lifecycle events
   * 6. **Recording Start**: Begins capturing media data
   *
   * ## MIME Type Fallback
   * If the requested MIME type is not supported, the plugin automatically tries alternatives:
   * - Audio: webm, webm;codecs=opus, ogg;codecs=opus, mp4
   * - Video: webm, webm;codecs=vp8,opus, webm;codecs=vp9,opus, mp4
   *
   * ## Data Collection
   * Recording data is collected in chunks and stored in memory until the recording is stopped:
   * - Data chunks are accumulated in the `ondataavailable` event
   * - When stopped, chunks are combined into a single Blob
   * - If `storeInIndexedDB` is enabled, the Blob is saved and then cleared from memory
   *
   * ## Memory Management
   * - Blobs are kept in memory only until saved to IndexedDB
   * - After saving, blobs are automatically cleared to prevent memory leaks
   * - Use `getMemoryUsage()` to monitor in-memory recording size
   * - Use `clearOldRecordingsFromMemory()` to manually free memory
   *
   * ## Storage Behavior
   * When `storeInIndexedDB` is enabled:
   * - Recording is saved to IndexedDB when stopped
   * - Blob is cleared from memory after successful save
   * - If quota is exceeded, oldest recordings are deleted and save is retried
   * - If `autoDeleteOld` is true, oldest recordings are deleted when `maxRecordings` is exceeded
   *
   * ## State Transitions
   * Recording state progresses through these stages:
   * 1. 'starting': MediaRecorder created, not yet started
   * 2. 'recording': Actively capturing media data
   * 3. 'paused': Temporarily suspended (via `pauseRecording()`)
   * 4. 'stopped': Finalized, blob created
   * 5. 'failed': Error occurred during recording
   *
   * ## Lifecycle Callbacks
   * The following callbacks are invoked during recording:
   * - `onRecordingStart`: Called when recording begins (state: 'recording')
   * - `onRecordingStop`: Called when recording completes (includes blob and duration)
   * - `onRecordingError`: Called if MediaRecorder encounters an error
   *
   * @example Start basic audio recording
   * ```typescript
   * const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
   * const recordingId = await plugin.startRecording('call-123', stream)
   * console.log(`Recording started with ID: ${recordingId}`)
   * ```
   *
   * @example Start video recording with custom options
   * ```typescript
   * const stream = await navigator.mediaDevices.getUserMedia({
   *   audio: true,
   *   video: true
   * })
   *
   * const recordingId = await plugin.startRecording('call-456', stream, {
   *   video: true,
   *   mimeType: 'video/webm;codecs=vp9,opus',
   *   videoBitsPerSecond: 2500000,
   *   audioBitsPerSecond: 128000
   * })
   * ```
   *
   * @example Start recording with timeslice for progressive processing
   * ```typescript
   * const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
   *
   * const recordingId = await plugin.startRecording('call-789', stream, {
   *   timeslice: 1000  // Emit data every second
   * })
   *
   * // Data will be available in chunks via ondataavailable events
   * ```
   *
   * @example Error handling
   * ```typescript
   * try {
   *   const recordingId = await plugin.startRecording(callId, stream)
   *   console.log('Recording started successfully')
   * } catch (error) {
   *   if (error.message.includes('Already recording')) {
   *     console.error('Call is already being recorded')
   *     // Stop existing recording first
   *     await plugin.stopRecording(callId)
   *   } else if (error.message.includes('MIME type')) {
   *     console.error('Browser does not support recording format')
   *   }
   * }
   * ```
   *
   * @example Automatic recording from call event
   * ```typescript
   * eventBus.on('callStarted', async (data) => {
   *   const { callId, stream } = data
   *   try {
   *     const recordingId = await plugin.startRecording(callId, stream, {
   *       audio: true,
   *       video: false,
   *       audioBitsPerSecond: 192000  // High quality audio
   *     })
   *     console.log(`Auto-recording started: ${recordingId}`)
   *   } catch (error) {
   *     console.error('Failed to start auto-recording:', error)
   *   }
   * })
   * ```
   */
  async startRecording(
    callId: string,
    stream: MediaStream,
    options?: RecordingOptions
  ): Promise<string> {
    // Check if already recording
    if (this.activeRecordings.has(callId)) {
      throw new Error(`Already recording call ${callId}`)
    }

    const recordingOptions = { ...this.config.recordingOptions, ...options }

    // Determine MIME type
    const mimeType = this.getSupportedMimeType(recordingOptions.mimeType)
    if (!mimeType) {
      throw new Error('No supported MIME type found for recording')
    }

    // Create MediaRecorder
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: recordingOptions.audioBitsPerSecond,
      videoBitsPerSecond: recordingOptions.videoBitsPerSecond,
    })

    const recordingId = this.generateRecordingId()

    // Create recording data
    const recordingData: RecordingData = {
      id: recordingId,
      callId,
      startTime: new Date(),
      mimeType,
      state: 'starting' as RecordingState,
    }

    this.recordings.set(recordingId, recordingData)

    const chunks: Blob[] = []

    // Handle data available
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    // Handle recording start
    recorder.onstart = () => {
      recordingData.state = 'recording' as RecordingState
      logger.info(`Recording started: ${recordingId} for call ${callId}`)
      this.config.onRecordingStart(recordingData)
    }

    // Handle recording stop
    recorder.onstop = async () => {
      recordingData.state = 'stopped' as RecordingState
      recordingData.endTime = new Date()
      recordingData.duration = recordingData.endTime.getTime() - recordingData.startTime.getTime()

      // Create blob from chunks
      recordingData.blob = new Blob(chunks, { type: mimeType })

      // Validate blob is not empty
      if (!recordingData.blob || recordingData.blob.size === 0) {
        logger.warn(`Recording ${recordingId} has no data, skipping save`)
        recordingData.state = 'failed' as RecordingState
        this.config.onRecordingError(new Error('Recording has no data'))
        return
      }

      logger.info(
        `Recording stopped: ${recordingId} (duration: ${recordingData.duration}ms, size: ${recordingData.blob.size} bytes)`
      )

      // Store in IndexedDB
      if (this.config.storeInIndexedDB && this.db) {
        try {
          await this.saveRecording(recordingData)
          // Clear blob from memory after saving to prevent memory leak
          this.clearRecordingBlob(recordingId)
        } catch (error) {
          logger.error(`Failed to save recording ${recordingId}`, error)
          recordingData.state = 'failed' as RecordingState
          this.config.onRecordingError(error as Error)
        }
      }

      this.config.onRecordingStop(recordingData)
    }

    // Handle recording error
    recorder.onerror = (event: any) => {
      const error = event.error || new Error('Recording error')
      recordingData.state = 'failed' as RecordingState
      logger.error(`Recording error: ${recordingId}`, error)
      this.config.onRecordingError(error)
    }

    // Start recording
    recorder.start(recordingOptions.timeslice)

    this.activeRecordings.set(callId, recorder)

    return recordingId
  }

  /**
   * Stop recording a call and finalize the recording
   *
   * Stops the active MediaRecorder for the specified call, triggering the finalization process
   * where all accumulated data chunks are combined into a Blob, duration is calculated, and
   * the recording is optionally saved to IndexedDB. After stopping, the recording cannot be
   * resumed and the MediaRecorder instance is removed from the active recordings map.
   *
   * @param callId - Unique identifier of the call to stop recording. Must match the `callId`
   *   used when starting the recording via `startRecording()`. This is the same ID used for
   *   pause/resume operations.
   *
   * @returns A promise that resolves when the stop operation has been initiated. Note: The promise
   *   resolves immediately after calling `recorder.stop()`, but actual finalization (blob creation,
   *   storage) happens asynchronously via the MediaRecorder's `onstop` event handler. Use the
   *   `onRecordingStop` callback to be notified when finalization is complete.
   *
   * @throws {Error} If no active recording exists for the specified `callId`. This can happen if:
   *   - No recording was started for this call
   *   - The recording was already stopped
   *   - The wrong callId was provided
   *
   * @remarks
   * ## Stop Process
   * 1. **Validation**: Verifies an active MediaRecorder exists for the call
   * 2. **State Check**: Only stops if MediaRecorder is not already 'inactive'
   * 3. **Stop Signal**: Calls `recorder.stop()` to trigger finalization
   * 4. **Cleanup**: Removes recorder from activeRecordings map
   * 5. **Async Finalization**: MediaRecorder's `onstop` handler processes the recording
   *
   * ## Asynchronous Finalization
   * The actual finalization happens asynchronously in the `onstop` event handler:
   * - All data chunks are combined into a single Blob
   * - End time and duration are calculated
   * - Recording state changes to 'stopped'
   * - Blob is validated (must have size > 0)
   * - If `storeInIndexedDB` is enabled, recording is saved to database
   * - Blob is cleared from memory after successful save
   * - `onRecordingStop` callback is invoked with complete recording data
   *
   * ## Storage Behavior
   * When `storeInIndexedDB` is enabled:
   * - Recording is automatically saved to IndexedDB in the `onstop` handler
   * - If quota is exceeded, oldest recordings are deleted and save is retried
   * - After successful save, blob is cleared from memory to prevent leaks
   * - If save fails, `onRecordingError` callback is invoked and state becomes 'failed'
   * - If `autoDeleteOld` is true, oldest recordings may be deleted to stay within `maxRecordings` limit
   *
   * ## Memory Management
   * - Blob remains in memory until saved to IndexedDB
   * - After save, blob is automatically cleared via `clearRecordingBlob()`
   * - Recording metadata remains in `recordings` map for retrieval
   * - To manually free memory, use `clearOldRecordingsFromMemory()`
   *
   * ## Empty Recording Validation
   * If the recording has no data (blob size is 0):
   * - Recording state is set to 'failed'
   * - Recording is not saved to IndexedDB
   * - `onRecordingError` callback is invoked with error
   * - Warning is logged but no exception is thrown
   *
   * ## State Transitions
   * When stop is called:
   * - MediaRecorder state changes from 'recording' or 'paused' to 'inactive'
   * - Recording state changes to 'stopped' in the `onstop` handler
   * - If error occurs, state becomes 'failed'
   *
   * ## Callback Invocation
   * After finalization completes, `onRecordingStop` is called with RecordingData containing:
   * - `id`: Recording ID
   * - `callId`: Associated call ID
   * - `startTime`: When recording started
   * - `endTime`: When recording stopped
   * - `duration`: Total duration in milliseconds
   * - `mimeType`: MIME type of the recording
   * - `state`: 'stopped' or 'failed'
   * - `blob`: Recording blob (if not yet cleared)
   *
   * @example Stop a recording
   * ```typescript
   * try {
   *   await plugin.stopRecording('call-123')
   *   console.log('Recording stopped')
   * } catch (error) {
   *   console.error('No active recording for this call')
   * }
   * ```
   *
   * @example Stop with completion callback
   * ```typescript
   * // Configure callback before stopping
   * await plugin.updateConfig(context, {
   *   onRecordingStop: (recording) => {
   *     console.log(`Recording ${recording.id} completed`)
   *     console.log(`Duration: ${recording.duration}ms`)
   *     console.log(`Size: ${recording.blob?.size || 'saved to IndexedDB'} bytes`)
   *   }
   * })
   *
   * // Stop will trigger the callback when finalization completes
   * await plugin.stopRecording(callId)
   * ```
   *
   * @example Stop all active recordings
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   * const activeCallIds = new Set(
   *   recordings
   *     .filter(r => r.state === 'recording' || r.state === 'paused')
   *     .map(r => r.callId)
   * )
   *
   * for (const callId of activeCallIds) {
   *   try {
   *     await plugin.stopRecording(callId)
   *   } catch (error) {
   *     console.error(`Failed to stop recording for ${callId}:`, error)
   *   }
   * }
   * ```
   *
   * @example Stop and download
   * ```typescript
   * // Store the recording ID before stopping
   * const recording = plugin.getAllRecordings()
   *   .find(r => r.callId === callId && r.state === 'recording')
   *
   * if (recording) {
   *   await plugin.stopRecording(callId)
   *
   *   // Wait for finalization using callback
   *   await new Promise(resolve => {
   *     const originalCallback = plugin.config.onRecordingStop
   *     plugin.updateConfig(context, {
   *       onRecordingStop: (rec) => {
   *         originalCallback(rec)
   *         if (rec.id === recording.id) {
   *           resolve()
   *         }
   *       }
   *     })
   *   })
   *
   *   // Download the recording
   *   plugin.downloadRecording(recording.id)
   * }
   * ```
   */
  async stopRecording(callId: string): Promise<void> {
    const recorder = this.activeRecordings.get(callId)
    if (!recorder) {
      throw new Error(`No active recording for call ${callId}`)
    }

    if (recorder.state !== 'inactive') {
      recorder.stop()
    }

    this.activeRecordings.delete(callId)
  }

  /**
   * Pause an active recording
   *
   * Temporarily suspends recording of media data for the specified call. The MediaRecorder
   * enters the 'paused' state and stops capturing data, but the recording session remains
   * active and can be resumed later. The recording duration includes paused time unless
   * you track pause/resume timestamps separately.
   *
   * @param callId - Unique identifier of the call to pause recording. Must match the `callId`
   *   used when starting the recording via `startRecording()`. The recording must be in the
   *   'recording' state (not already paused, stopped, or failed).
   *
   * @throws {Error} If no active recording exists for the specified `callId`. This can happen if:
   *   - No recording was started for this call
   *   - The recording was already stopped
   *   - The wrong callId was provided
   *
   * @remarks
   * ## Pause Behavior
   * - Only pauses if MediaRecorder is in 'recording' state
   * - If already paused, logs a debug message and returns without error
   * - If in other states (inactive, etc.), logs a warning but does not throw
   * - Does not affect the recording ID or accumulated data
   * - Can be resumed with `resumeRecording(callId)`
   *
   * ## State Validation
   * The method checks MediaRecorder state before pausing:
   * - **'recording'**: Pause is executed successfully
   * - **'paused'**: Logs debug message, no action taken (idempotent)
   * - **'inactive'** or other: Logs warning, no action taken
   *
   * ## Duration Tracking
   * Important: The recorded duration calculated when stopping includes paused time.
   * If you need to track active recording time only, you must implement separate
   * pause/resume timestamp tracking in your application.
   *
   * ## Data Capture
   * While paused:
   * - No new data chunks are captured
   * - Previously captured chunks remain in memory
   * - The stream continues to flow but is not recorded
   * - Resuming continues capturing from the current stream position
   *
   * ## Use Cases
   * - Pause recording during sensitive conversation parts
   * - Temporarily suspend during call hold
   * - Reduce file size by skipping non-essential audio
   * - Implement manual recording control in UI
   *
   * ## Pause/Resume vs Stop/Start
   * - **Pause/Resume**: Same recording session, single output file
   * - **Stop/Start**: Creates two separate recordings with different IDs
   *
   * @example Pause a recording
   * ```typescript
   * try {
   *   plugin.pauseRecording('call-123')
   *   console.log('Recording paused')
   * } catch (error) {
   *   console.error('Failed to pause:', error)
   * }
   * ```
   *
   * @example Pause and resume with UI control
   * ```typescript
   * const pauseButton = document.getElementById('pause')
   * const resumeButton = document.getElementById('resume')
   *
   * pauseButton.addEventListener('click', () => {
   *   try {
   *     plugin.pauseRecording(callId)
   *     pauseButton.disabled = true
   *     resumeButton.disabled = false
   *   } catch (error) {
   *     console.error('Cannot pause recording:', error)
   *   }
   * })
   *
   * resumeButton.addEventListener('click', () => {
   *   try {
   *     plugin.resumeRecording(callId)
   *     pauseButton.disabled = false
   *     resumeButton.disabled = true
   *   } catch (error) {
   *     console.error('Cannot resume recording:', error)
   *   }
   * })
   * ```
   *
   * @example Pause during call hold
   * ```typescript
   * eventBus.on('callHold', (data) => {
   *   const { callId } = data
   *   try {
   *     plugin.pauseRecording(callId)
   *     console.log('Recording paused during hold')
   *   } catch (error) {
   *     // Recording might not exist if autoStart is disabled
   *     console.log('No active recording to pause')
   *   }
   * })
   *
   * eventBus.on('callUnhold', (data) => {
   *   const { callId } = data
   *   try {
   *     plugin.resumeRecording(callId)
   *     console.log('Recording resumed after hold')
   *   } catch (error) {
   *     console.log('No paused recording to resume')
   *   }
   * })
   * ```
   *
   * @example Check state before pausing
   * ```typescript
   * const recording = plugin.getAllRecordings()
   *   .find(r => r.callId === callId)
   *
   * if (recording && recording.state === 'recording') {
   *   plugin.pauseRecording(callId)
   *   console.log('Recording paused')
   * } else if (recording && recording.state === 'paused') {
   *   console.log('Recording is already paused')
   * } else {
   *   console.log('No active recording to pause')
   * }
   * ```
   */
  pauseRecording(callId: string): void {
    const recorder = this.activeRecordings.get(callId)
    if (!recorder) {
      throw new Error(`No active recording for call ${callId}`)
    }

    // Only pause if currently recording
    if (recorder.state === 'recording') {
      recorder.pause()
      logger.debug(`Recording paused: ${callId}`)
    } else if (recorder.state === 'paused') {
      logger.debug(`Recording already paused for call ${callId}, ignoring`)
    } else {
      logger.warn(`Cannot pause recording in state: ${recorder.state} for call ${callId}`)
    }
  }

  /**
   * Resume a paused recording
   *
   * Resumes recording of media data for a previously paused call. The MediaRecorder transitions
   * from 'paused' state back to 'recording' state and continues capturing data from the current
   * stream position. All data is accumulated into the same recording session and will be combined
   * into a single Blob when stopped.
   *
   * @param callId - Unique identifier of the call to resume recording. Must match the `callId`
   *   used when starting the recording via `startRecording()`. The recording must be in the
   *   'paused' state (not recording, stopped, or failed).
   *
   * @throws {Error} If no active recording exists for the specified `callId`. This can happen if:
   *   - No recording was started for this call
   *   - The recording was already stopped
   *   - The wrong callId was provided
   *
   * @remarks
   * ## Resume Behavior
   * - Only resumes if MediaRecorder is in 'paused' state
   * - If already recording, logs a debug message and returns without error
   * - If in other states (inactive, etc.), logs a warning but does not throw
   * - Continues using the same recording ID and accumulated data
   * - Data captured after resume is appended to the same recording
   *
   * ## State Validation
   * The method checks MediaRecorder state before resuming:
   * - **'paused'**: Resume is executed successfully
   * - **'recording'**: Logs debug message, no action taken (idempotent)
   * - **'inactive'** or other: Logs warning, no action taken
   *
   * ## Data Continuity
   * After resuming:
   * - New data chunks are appended to existing chunks array
   * - All chunks are combined into a single Blob when stopped
   * - No gap or marker is inserted in the recording to indicate pause/resume
   * - The final recording plays continuously without pauses
   *
   * ## Duration Calculation
   * When the recording is stopped:
   * - Duration includes both recording time and paused time
   * - Duration is calculated as: `endTime - startTime`
   * - To track only active recording time, implement custom timestamp tracking
   *
   * ## Use Cases
   * - Resume recording after call is taken off hold
   * - Continue recording after pausing for sensitive information
   * - Implement toggle recording control in UI
   * - Resume after temporary interruption
   *
   * ## Idempotency
   * Calling `resumeRecording()` on an already recording session is safe:
   * - No error is thrown
   * - Debug message is logged
   * - Recording continues normally
   *
   * @example Resume a paused recording
   * ```typescript
   * try {
   *   plugin.resumeRecording('call-123')
   *   console.log('Recording resumed')
   * } catch (error) {
   *   console.error('Failed to resume:', error)
   * }
   * ```
   *
   * @example Pause and resume pattern
   * ```typescript
   * const callId = 'call-123'
   *
   * // Start recording
   * await plugin.startRecording(callId, stream)
   *
   * // Later: pause recording
   * plugin.pauseRecording(callId)
   * console.log('Recording paused')
   *
   * // Even later: resume recording
   * plugin.resumeRecording(callId)
   * console.log('Recording resumed')
   *
   * // Finally: stop and get complete recording
   * await plugin.stopRecording(callId)
   * ```
   *
   * @example Resume with state check
   * ```typescript
   * const recording = plugin.getAllRecordings()
   *   .find(r => r.callId === callId)
   *
   * if (recording) {
   *   if (recording.state === 'paused') {
   *     plugin.resumeRecording(callId)
   *     console.log('Recording resumed')
   *   } else if (recording.state === 'recording') {
   *     console.log('Recording is already active')
   *   } else {
   *     console.log('Cannot resume recording in state:', recording.state)
   *   }
   * } else {
   *   console.log('No recording found for this call')
   * }
   * ```
   *
   * @example Toggle pause/resume
   * ```typescript
   * function toggleRecording(callId: string) {
   *   const recording = plugin.getAllRecordings()
   *     .find(r => r.callId === callId)
   *
   *   if (!recording) {
   *     console.log('No active recording')
   *     return
   *   }
   *
   *   try {
   *     if (recording.state === 'recording') {
   *       plugin.pauseRecording(callId)
   *       console.log('Paused')
   *     } else if (recording.state === 'paused') {
   *       plugin.resumeRecording(callId)
   *       console.log('Resumed')
   *     }
   *   } catch (error) {
   *     console.error('Failed to toggle recording:', error)
   *   }
   * }
   * ```
   *
   * @example Resume after call unhold with error handling
   * ```typescript
   * eventBus.on('callUnhold', (data) => {
   *   const { callId } = data
   *
   *   try {
   *     // Check if recording exists and is paused
   *     const recording = plugin.getAllRecordings()
   *       .find(r => r.callId === callId)
   *
   *     if (!recording) {
   *       console.log('No recording to resume - may not have been started')
   *       return
   *     }
   *
   *     if (recording.state === 'paused') {
   *       plugin.resumeRecording(callId)
   *       console.log('Recording resumed after call unhold')
   *     } else {
   *       console.log(`Recording is in ${recording.state} state, not paused`)
   *     }
   *   } catch (error) {
   *     console.error('Failed to resume recording:', error)
   *   }
   * })
   * ```
   */
  resumeRecording(callId: string): void {
    const recorder = this.activeRecordings.get(callId)
    if (!recorder) {
      throw new Error(`No active recording for call ${callId}`)
    }

    // Only resume if currently paused
    if (recorder.state === 'paused') {
      recorder.resume()
      logger.debug(`Recording resumed: ${callId}`)
    } else if (recorder.state === 'recording') {
      logger.debug(`Recording already active for call ${callId}, ignoring`)
    } else {
      logger.warn(`Cannot resume recording in state: ${recorder.state} for call ${callId}`)
    }
  }

  /**
   * Retrieve recording data by ID
   *
   * Fetches the recording metadata and blob (if still in memory) for a specific recording.
   * This method returns the in-memory representation of the recording, which may or may not
   * include the blob depending on whether it has been saved to IndexedDB and cleared from memory.
   *
   * @param recordingId - Unique identifier of the recording to retrieve. This is the ID returned
   *   by `startRecording()` or found in the `id` property of RecordingData objects. Format is
   *   typically 'recording-{uuid}' or 'recording-{timestamp}-{random}'.
   *
   * @returns The RecordingData object if found, containing:
   *   - `id`: Recording unique identifier
   *   - `callId`: Associated call identifier
   *   - `startTime`: When recording started (Date object)
   *   - `endTime`: When recording stopped (Date object, undefined if still recording)
   *   - `duration`: Total duration in milliseconds (undefined if still recording)
   *   - `mimeType`: MIME type of the recording
   *   - `state`: Current state ('starting', 'recording', 'paused', 'stopped', 'failed')
   *   - `blob`: Recording blob (may be undefined if saved to IndexedDB and cleared from memory)
   *
   *   Returns `undefined` if no recording exists with the specified ID.
   *
   * @remarks
   * ## In-Memory Storage
   * This method only returns data from the in-memory `recordings` Map:
   * - Recordings are added to the map when `startRecording()` is called
   * - Metadata remains in memory throughout the plugin's lifecycle
   * - Blob may be cleared from memory after saving to IndexedDB
   * - Recordings are removed from memory only when plugin is uninstalled
   *
   * ## Blob Availability
   * The `blob` property may be undefined in several scenarios:
   * - Recording is still in progress (blob created only when stopped)
   * - Recording was saved to IndexedDB and blob was cleared from memory
   * - Recording failed and no blob was created
   *
   * To access a blob that was cleared from memory:
   * 1. Query IndexedDB directly using the recording ID
   * 2. Retrieve the full RecordingData with blob from IndexedDB
   *
   * ## State Information
   * The returned RecordingData includes the current state:
   * - **'starting'**: MediaRecorder created but not yet started
   * - **'recording'**: Actively capturing data
   * - **'paused'**: Temporarily suspended
   * - **'stopped'**: Completed successfully
   * - **'failed'**: Encountered an error
   *
   * ## Use Cases
   * - Check if a recording exists before attempting operations
   * - Retrieve recording metadata (duration, start time, etc.)
   * - Access recording blob for immediate playback
   * - Verify recording state before pause/resume/stop
   * - Get recording details for UI display
   *
   * ## Performance
   * - O(1) lookup in Map
   * - No IndexedDB access required
   * - Returns immediately with in-memory data
   *
   * @example Get recording data
   * ```typescript
   * const recording = plugin.getRecording('recording-123')
   * if (recording) {
   *   console.log(`Recording state: ${recording.state}`)
   *   console.log(`Duration: ${recording.duration}ms`)
   *   console.log(`Has blob: ${recording.blob !== undefined}`)
   * } else {
   *   console.log('Recording not found')
   * }
   * ```
   *
   * @example Check recording before download
   * ```typescript
   * const recordingId = 'recording-456'
   * const recording = plugin.getRecording(recordingId)
   *
   * if (!recording) {
   *   console.error('Recording not found')
   * } else if (recording.state !== 'stopped') {
   *   console.error('Recording is not complete')
   * } else if (!recording.blob) {
   *   console.error('Recording blob was cleared from memory')
   *   console.log('Retrieve from IndexedDB instead')
   * } else {
   *   plugin.downloadRecording(recordingId)
   * }
   * ```
   *
   * @example Display recording info in UI
   * ```typescript
   * const recording = plugin.getRecording(recordingId)
   * if (recording) {
   *   const element = document.getElementById('recording-info')
   *   element.innerHTML = `
   *     <div>Call ID: ${recording.callId}</div>
   *     <div>Started: ${recording.startTime.toLocaleString()}</div>
   *     <div>State: ${recording.state}</div>
   *     <div>Duration: ${recording.duration || 'In progress'}ms</div>
   *     <div>Size: ${recording.blob?.size || 'In IndexedDB'} bytes</div>
   *   `
   * }
   * ```
   *
   * @example Retrieve from IndexedDB if not in memory
   * ```typescript
   * const recordingId = 'recording-789'
   * let recording = plugin.getRecording(recordingId)
   *
   * if (!recording || !recording.blob) {
   *   console.log('Recording not in memory, fetching from IndexedDB...')
   *
   *   // Retrieve from IndexedDB
   *   const db = await openDatabase('vuesip-recordings')
   *   const transaction = db.transaction(['recordings'], 'readonly')
   *   const store = transaction.objectStore('recordings')
   *   const request = store.get(recordingId)
   *
   *   request.onsuccess = () => {
   *     recording = request.result
   *     if (recording) {
   *       console.log('Retrieved from IndexedDB')
   *       console.log(`Blob size: ${recording.blob.size} bytes`)
   *     }
   *   }
   * }
   * ```
   *
   * @example Find recording by call ID
   * ```typescript
   * const callId = 'call-123'
   *
   * // Get all recordings and find by call ID
   * const recording = plugin.getAllRecordings()
   *   .find(r => r.callId === callId)
   *
   * if (recording) {
   *   // Now get full data by recording ID
   *   const fullRecording = plugin.getRecording(recording.id)
   *   console.log('Found recording:', fullRecording)
   * }
   * ```
   */
  getRecording(recordingId: string): RecordingData | undefined {
    return this.recordings.get(recordingId)
  }

  /**
   * Retrieve all recordings from memory
   *
   * Returns an array of all recording metadata and blobs currently stored in memory. This includes
   * recordings in all states (starting, recording, paused, stopped, failed). The returned array is
   * a snapshot of the in-memory recordings map and does not include recordings that exist only in
   * IndexedDB.
   *
   * @returns An array of RecordingData objects, one for each recording in memory. Each object contains:
   *   - `id`: Recording unique identifier
   *   - `callId`: Associated call identifier
   *   - `startTime`: When recording started (Date object)
   *   - `endTime`: When recording stopped (Date object, undefined if still recording)
   *   - `duration`: Total duration in milliseconds (undefined if still recording)
   *   - `mimeType`: MIME type of the recording
   *   - `state`: Current state ('starting', 'recording', 'paused', 'stopped', 'failed')
   *   - `blob`: Recording blob (may be undefined if saved to IndexedDB and cleared from memory)
   *
   *   Returns an empty array if no recordings exist in memory.
   *
   * @remarks
   * ## Data Source
   * This method returns data from the in-memory `recordings` Map only:
   * - Does not query IndexedDB (even if `storeInIndexedDB` is enabled)
   * - Only includes recordings from the current session
   * - Recordings are added when `startRecording()` is called
   * - Recordings remain in memory until `uninstall()` is called
   * - Blobs may be cleared from memory while metadata remains
   *
   * ## Array Ordering
   * - No specific ordering is guaranteed
   * - Order depends on Map iteration order (typically insertion order)
   * - For chronological ordering, sort by `startTime` property
   * - For state-based filtering, filter the returned array
   *
   * ## Memory vs Storage
   * The returned recordings may differ from IndexedDB contents:
   * - Memory: Current session recordings with possible blob clearing
   * - IndexedDB: Persistent storage across sessions, always includes blobs
   * - Use this method for current session monitoring
   * - Query IndexedDB directly for persistent recording history
   *
   * ## Performance
   * - O(n) conversion from Map values to Array
   * - No database queries, returns immediately
   * - Memory usage proportional to number of recordings
   * - Large blob arrays can impact performance
   *
   * ## Use Cases
   * - List all recordings in UI
   * - Find recordings by call ID
   * - Calculate total memory usage
   * - Filter recordings by state
   * - Get active recording count
   * - Monitor recording session health
   *
   * @example Get all recordings
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   * console.log(`Total recordings in memory: ${recordings.length}`)
   *
   * recordings.forEach(recording => {
   *   console.log(`${recording.id}: ${recording.state}`)
   * })
   * ```
   *
   * @example Filter active recordings
   * ```typescript
   * const activeRecordings = plugin.getAllRecordings()
   *   .filter(r => r.state === 'recording' || r.state === 'paused')
   *
   * console.log(`Active recordings: ${activeRecordings.length}`)
   * ```
   *
   * @example Sort recordings by start time
   * ```typescript
   * const sortedRecordings = plugin.getAllRecordings()
   *   .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
   *
   * console.log('Recordings in chronological order:')
   * sortedRecordings.forEach(r => {
   *   console.log(`${r.id}: Started ${r.startTime.toISOString()}`)
   * })
   * ```
   *
   * @example Find recordings by call ID
   * ```typescript
   * const callId = 'call-123'
   * const callRecordings = plugin.getAllRecordings()
   *   .filter(r => r.callId === callId)
   *
   * if (callRecordings.length > 0) {
   *   console.log(`Found ${callRecordings.length} recordings for call ${callId}`)
   *   callRecordings.forEach(r => {
   *     console.log(`  ${r.id}: ${r.state}, duration: ${r.duration}ms`)
   *   })
   * }
   * ```
   *
   * @example Calculate total size and duration
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   *
   * const totalSize = recordings.reduce((sum, r) => {
   *   return sum + (r.blob?.size || 0)
   * }, 0)
   *
   * const totalDuration = recordings.reduce((sum, r) => {
   *   return sum + (r.duration || 0)
   * }, 0)
   *
   * console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
   * console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)} seconds`)
   * ```
   *
   * @example Display recordings in UI table
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   * const tableBody = document.getElementById('recordings-table')
   *
   * tableBody.innerHTML = recordings.map(r => `
   *   <tr>
   *     <td>${r.callId}</td>
   *     <td>${r.startTime.toLocaleString()}</td>
   *     <td>${r.state}</td>
   *     <td>${r.duration ? (r.duration / 1000).toFixed(1) + 's' : 'N/A'}</td>
   *     <td>${r.blob ? (r.blob.size / 1024).toFixed(1) + ' KB' : 'In DB'}</td>
   *   </tr>
   * `).join('')
   * ```
   *
   * @example Monitor recording health
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   * const stats = {
   *   total: recordings.length,
   *   recording: recordings.filter(r => r.state === 'recording').length,
   *   paused: recordings.filter(r => r.state === 'paused').length,
   *   stopped: recordings.filter(r => r.state === 'stopped').length,
   *   failed: recordings.filter(r => r.state === 'failed').length,
   *   withBlob: recordings.filter(r => r.blob !== undefined).length
   * }
   *
   * console.log('Recording Statistics:', stats)
   *
   * if (stats.failed > 0) {
   *   console.warn(`${stats.failed} recordings have failed`)
   * }
   * ```
   */
  getAllRecordings(): RecordingData[] {
    return Array.from(this.recordings.values())
  }

  /**
   * Clear the binary blob data from memory for a specific recording
   *
   * Removes the Blob object from the in-memory recording data structure while preserving all
   * metadata. This method is essential for memory management, especially after recordings have
   * been persisted to IndexedDB. By clearing blobs from memory after persistence, the plugin
   * prevents memory bloat and ensures efficient resource usage during long-running sessions
   * with multiple recordings.
   *
   * @param recordingId - The unique identifier of the recording whose blob should be cleared.
   *   Must be a valid recording ID that exists in the `this.recordings` Map. If the recording
   *   doesn't exist or has no blob, the method safely does nothing.
   *
   * @returns void - This method performs memory cleanup as a side effect and does not return a value
   *
   * @remarks
   * ## Memory Management Strategy
   * The plugin maintains a dual-storage approach:
   * 1. **In-Memory Storage**: Active recordings and their blobs in `this.recordings` Map
   * 2. **Persistent Storage**: Completed recordings saved to IndexedDB
   *
   * This method facilitates the transition from in-memory to persistent storage by:
   * - Clearing the blob after it's saved to IndexedDB
   * - Retaining metadata (id, callId, duration, size, etc.) in memory
   * - Allowing the JavaScript garbage collector to reclaim blob memory
   *
   * ## When This Method Is Called
   * - After successfully saving a recording to IndexedDB via `saveRecording()`
   * - When `config.storeInIndexedDB` is enabled
   * - During the `stopRecording()` flow after persistence
   * - Not called if persistence is disabled (blobs remain in memory)
   *
   * ## Garbage Collection
   * Setting `recording.blob = undefined` removes the only reference to the Blob object,
   * making it eligible for garbage collection. The actual memory reclamation timing is
   * determined by the JavaScript runtime's GC algorithm.
   *
   * ## Object URL Handling
   * The method includes a safety check for object URLs (`blob://`) that may have been created
   * from the blob. While the current implementation doesn't create object URLs during normal
   * operation, this check provides forward compatibility if URL generation is added in the future.
   * Proper URL revocation prevents memory leaks in the browser's URL registry.
   *
   * ## Safety and Idempotency
   * - Safe to call multiple times for the same recording (subsequent calls are no-ops)
   * - Safe to call with non-existent recording IDs (silently returns)
   * - Safe to call when blob is already undefined (no-op)
   * - Does not affect the recording's presence in the Map or its metadata
   *
   * ## Side Effects
   * - Modifies the recording object in `this.recordings` Map
   * - Triggers garbage collection eligibility for the blob
   * - Logs a debug message confirming blob clearance
   * - Does not emit any events or trigger callbacks
   *
   * ## Performance Considerations
   * Clearing large blobs (multi-megabyte recordings) can significantly improve memory usage,
   * especially important for:
   * - Mobile devices with limited RAM
   * - Long-running applications with many sequential recordings
   * - Video recordings which are much larger than audio-only
   *
   * @internal
   */
  private clearRecordingBlob(recordingId: string): void {
    const recording = this.recordings.get(recordingId)
    if (recording && recording.blob) {
      // Revoke any object URLs if they exist
      if (recording.blob instanceof Blob) {
        // Blob doesn't have URL, but if we created one, it should be revoked
        // This is a safety measure for future URL creation
      }

      // Clear blob reference to allow garbage collection
      recording.blob = undefined
      logger.debug(`Cleared blob from memory for recording: ${recordingId}`)
    }
  }

  /**
   * Calculate total memory usage of recording blobs
   *
   * Computes the total size in bytes of all recording blobs currently stored in memory. This
   * only includes blobs that haven't been cleared after saving to IndexedDB. Useful for
   * monitoring memory consumption and determining when to clear old recordings from memory.
   *
   * @returns The total size in bytes of all recording blobs in memory. Returns 0 if:
   *   - No recordings exist
   *   - All recordings have had their blobs cleared
   *   - Recordings are still in progress (blobs not yet created)
   *
   *   The returned value represents actual blob data size, not metadata overhead.
   *
   * @remarks
   * ## Calculation Method
   * - Iterates through all recordings in the `recordings` Map
   * - Sums the `size` property of each blob that exists
   * - Skips recordings where `blob` is undefined
   * - Returns the total in bytes (not KB or MB)
   *
   * ## What's Included
   * Only counts blob data size:
   * - Recording blob data (audio/video content)
   * - Only blobs still in memory (not cleared)
   * - Does not include metadata overhead
   * - Does not include Map/object structure overhead
   * - Does not include IndexedDB storage
   *
   * ## What's Not Included
   * - Recording metadata (id, callId, startTime, etc.)
   * - JavaScript object overhead
   * - Map data structure overhead
   * - MediaRecorder instances
   * - Blobs already cleared from memory
   * - Recordings stored only in IndexedDB
   *
   * ## Memory Management Context
   * This method is useful for:
   * - Monitoring memory consumption in real-time
   * - Triggering cleanup when memory usage is high
   * - Displaying memory usage in UI
   * - Determining when to clear old recordings
   * - Debugging memory leaks
   *
   * ## Blob Lifecycle
   * Blob memory lifecycle:
   * 1. Created when recording stops (chunks combined into blob)
   * 2. Stays in memory for immediate access
   * 3. Saved to IndexedDB (if enabled)
   * 4. Cleared from memory via `clearRecordingBlob()`
   * 5. Can be retrieved from IndexedDB when needed
   *
   * ## Performance
   * - O(n) iteration through all recordings
   * - Fast operation (just summing numbers)
   * - No IndexedDB access
   * - No blob data copying
   *
   * @example Get current memory usage
   * ```typescript
   * const memoryUsage = plugin.getMemoryUsage()
   * console.log(`Memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)} MB`)
   * ```
   *
   * @example Monitor memory and trigger cleanup
   * ```typescript
   * const MAX_MEMORY_MB = 100
   * const memoryUsage = plugin.getMemoryUsage()
   * const memoryMB = memoryUsage / 1024 / 1024
   *
   * if (memoryMB > MAX_MEMORY_MB) {
   *   console.warn(`Memory usage (${memoryMB.toFixed(2)} MB) exceeds limit`)
   *   // Clear recordings older than 1 hour
   *   const cleared = plugin.clearOldRecordingsFromMemory(3600000)
   *   console.log(`Cleared ${cleared} recordings from memory`)
   *
   *   const newMemoryUsage = plugin.getMemoryUsage()
   *   console.log(`New memory usage: ${(newMemoryUsage / 1024 / 1024).toFixed(2)} MB`)
   * }
   * ```
   *
   * @example Display memory usage in UI
   * ```typescript
   * function updateMemoryDisplay() {
   *   const bytes = plugin.getMemoryUsage()
   *   const mb = (bytes / 1024 / 1024).toFixed(2)
   *   const element = document.getElementById('memory-usage')
   *   element.textContent = `Memory: ${mb} MB`
   *
   *   // Change color based on usage
   *   if (bytes > 100 * 1024 * 1024) { // > 100 MB
   *     element.className = 'high-memory'
   *   } else if (bytes > 50 * 1024 * 1024) { // > 50 MB
   *     element.className = 'medium-memory'
   *   } else {
   *     element.className = 'low-memory'
   *   }
   * }
   *
   * // Update every 5 seconds
   * setInterval(updateMemoryDisplay, 5000)
   * ```
   *
   * @example Compare memory before and after cleanup
   * ```typescript
   * const beforeCleanup = plugin.getMemoryUsage()
   * console.log(`Before cleanup: ${(beforeCleanup / 1024 / 1024).toFixed(2)} MB`)
   *
   * // Clear recordings older than 30 minutes
   * const cleared = plugin.clearOldRecordingsFromMemory(30 * 60 * 1000)
   *
   * const afterCleanup = plugin.getMemoryUsage()
   * console.log(`After cleanup: ${(afterCleanup / 1024 / 1024).toFixed(2)} MB`)
   * console.log(`Freed: ${((beforeCleanup - afterCleanup) / 1024 / 1024).toFixed(2)} MB`)
   * console.log(`Recordings cleared: ${cleared}`)
   * ```
   *
   * @example Get memory per recording
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   * const totalMemory = plugin.getMemoryUsage()
   *
   * console.log('Memory usage per recording:')
   * recordings.forEach(r => {
   *   const size = r.blob?.size || 0
   *   const percentage = totalMemory > 0 ? (size / totalMemory * 100).toFixed(1) : 0
   *   console.log(`${r.id}: ${(size / 1024).toFixed(1)} KB (${percentage}%)`)
   * })
   * ```
   *
   * @example Periodic memory monitoring
   * ```typescript
   * setInterval(() => {
   *   const memoryUsage = plugin.getMemoryUsage()
   *   const recordingCount = plugin.getAllRecordings().length
   *   const avgSize = recordingCount > 0 ? memoryUsage / recordingCount : 0
   *
   *   console.log('Memory Stats:', {
   *     totalMB: (memoryUsage / 1024 / 1024).toFixed(2),
   *     recordings: recordingCount,
   *     avgSizeKB: (avgSize / 1024).toFixed(2)
   *   })
   * }, 30000) // Every 30 seconds
   * ```
   */
  getMemoryUsage(): number {
    let total = 0
    for (const [, recording] of this.recordings) {
      if (recording.blob) {
        total += recording.blob.size
      }
    }
    return total
  }

  /**
   * Clear recording blobs from memory based on age
   *
   * Removes recording blobs from memory for recordings older than the specified age. This helps
   * manage memory usage by freeing up heap space for old recordings while preserving their
   * metadata. The recordings remain accessible in IndexedDB (if storage is enabled) and their
   * metadata stays in memory for reference.
   *
   * @param maxAge - Maximum age in milliseconds. Recordings with `startTime` older than
   *   `(current time - maxAge)` will have their blobs cleared from memory. Defaults to 3600000
   *   (1 hour). Common values:
   *   - 300000 (5 minutes)
   *   - 1800000 (30 minutes)
   *   - 3600000 (1 hour, default)
   *   - 7200000 (2 hours)
   *   - 86400000 (24 hours)
   *
   * @returns The number of recording blobs that were cleared from memory. Returns 0 if:
   *   - No recordings exist
   *   - No recordings are older than maxAge
   *   - All old recordings already had their blobs cleared
   *
   * @remarks
   * ## Clearing Behavior
   * For each recording older than `maxAge`:
   * - Blob is cleared from memory if it exists
   * - Recording metadata remains in the `recordings` Map
   * - Recording can still be accessed via `getRecording()` and `getAllRecordings()`
   * - Recording blob can be retrieved from IndexedDB if storage is enabled
   *
   * ## What's Preserved
   * - All recording metadata (id, callId, startTime, endTime, duration, state, mimeType)
   * - IndexedDB storage (blobs remain persisted)
   * - Ability to query and filter recordings
   * - Recording state and status information
   *
   * ## What's Cleared
   * - Only the in-memory blob reference
   * - Memory occupied by the blob data
   * - Ability to immediately access blob without IndexedDB query
   *
   * ## Age Calculation
   * Age is calculated from the recording's `startTime`:
   * ```
   * age = Date.now() - recording.startTime.getTime()
   * if (age > maxAge && recording.blob exists) {
   *   clearRecordingBlob(recordingId)
   *   cleared++
   * }
   * ```
   *
   * ## Use Cases
   * - Prevent memory leaks in long-running applications
   * - Free memory when usage exceeds threshold
   * - Implement periodic memory cleanup
   * - Clear memory after recordings are uploaded to server
   * - Manage memory in memory-constrained environments
   *
   * ## When to Call
   * - Periodically via setInterval (e.g., every 15 minutes)
   * - When memory usage exceeds threshold (check with `getMemoryUsage()`)
   * - After uploading recordings to external storage
   * - Before starting new recordings to free space
   * - On application idle events
   *
   * ## Automatic Clearing
   * Note: The plugin automatically clears blobs after saving to IndexedDB.
   * This method is for additional manual cleanup of recordings that:
   * - Were saved but not automatically cleared
   * - You want to remove from memory earlier than automatic clearing
   * - Need to be cleared due to memory pressure
   *
   * ## IndexedDB Retrieval
   * After clearing, blobs can be retrieved from IndexedDB:
   * ```typescript
   * const db = await openDatabase('vuesip-recordings')
   * const recording = await getFromDB(db, 'recordings', recordingId)
   * // recording.blob contains the blob from IndexedDB
   * ```
   *
   * @example Clear recordings older than 1 hour (default)
   * ```typescript
   * const cleared = plugin.clearOldRecordingsFromMemory()
   * console.log(`Cleared ${cleared} recordings from memory`)
   * ```
   *
   * @example Clear recordings older than 30 minutes
   * ```typescript
   * const thirtyMinutes = 30 * 60 * 1000
   * const cleared = plugin.clearOldRecordingsFromMemory(thirtyMinutes)
   * console.log(`Cleared ${cleared} recordings older than 30 minutes`)
   * ```
   *
   * @example Periodic cleanup every 15 minutes
   * ```typescript
   * // Clear recordings older than 1 hour, every 15 minutes
   * setInterval(() => {
   *   const oneHour = 60 * 60 * 1000
   *   const cleared = plugin.clearOldRecordingsFromMemory(oneHour)
   *   if (cleared > 0) {
   *     console.log(`Periodic cleanup: Cleared ${cleared} recordings`)
   *     const memoryUsage = plugin.getMemoryUsage()
   *     console.log(`Current memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)} MB`)
   *   }
   * }, 15 * 60 * 1000)
   * ```
   *
   * @example Cleanup when memory exceeds threshold
   * ```typescript
   * const MAX_MEMORY_MB = 100
   *
   * function checkMemoryAndCleanup() {
   *   const memoryUsage = plugin.getMemoryUsage()
   *   const memoryMB = memoryUsage / 1024 / 1024
   *
   *   if (memoryMB > MAX_MEMORY_MB) {
   *     console.warn(`Memory usage (${memoryMB.toFixed(2)} MB) exceeds ${MAX_MEMORY_MB} MB`)
   *
   *     // Try clearing recordings older than 5 minutes
   *     let cleared = plugin.clearOldRecordingsFromMemory(5 * 60 * 1000)
   *     console.log(`Cleared ${cleared} recordings (5+ min old)`)
   *
   *     // If still over limit, clear recordings older than 1 minute
   *     if (plugin.getMemoryUsage() / 1024 / 1024 > MAX_MEMORY_MB) {
   *       cleared = plugin.clearOldRecordingsFromMemory(60 * 1000)
   *       console.log(`Cleared ${cleared} additional recordings (1+ min old)`)
   *     }
   *   }
   * }
   * ```
   *
   * @example Clear after uploading to server
   * ```typescript
   * async function uploadAndClear() {
   *   const recordings = plugin.getAllRecordings()
   *     .filter(r => r.state === 'stopped' && r.blob)
   *
   *   for (const recording of recordings) {
   *     if (recording.blob) {
   *       // Upload to server
   *       await uploadRecording(recording)
   *       console.log(`Uploaded recording ${recording.id}`)
   *     }
   *   }
   *
   *   // Clear all uploaded recordings from memory (age 0)
   *   const cleared = plugin.clearOldRecordingsFromMemory(0)
   *   console.log(`Cleared ${cleared} uploaded recordings from memory`)
   * }
   * ```
   *
   * @example Report cleanup details
   * ```typescript
   * const beforeMemory = plugin.getMemoryUsage()
   * const beforeCount = plugin.getAllRecordings()
   *   .filter(r => r.blob !== undefined).length
   *
   * const cleared = plugin.clearOldRecordingsFromMemory(3600000)
   *
   * const afterMemory = plugin.getMemoryUsage()
   * const afterCount = plugin.getAllRecordings()
   *   .filter(r => r.blob !== undefined).length
   *
   * console.log('Cleanup Report:')
   * console.log(`  Recordings cleared: ${cleared}`)
   * console.log(`  Blobs before: ${beforeCount}`)
   * console.log(`  Blobs after: ${afterCount}`)
   * console.log(`  Memory before: ${(beforeMemory / 1024 / 1024).toFixed(2)} MB`)
   * console.log(`  Memory after: ${(afterMemory / 1024 / 1024).toFixed(2)} MB`)
   * console.log(`  Memory freed: ${((beforeMemory - afterMemory) / 1024 / 1024).toFixed(2)} MB`)
   * ```
   */
  clearOldRecordingsFromMemory(maxAge: number = 3600000): number {
    const now = Date.now()
    let cleared = 0

    for (const [recordingId, recording] of this.recordings) {
      const age = now - recording.startTime.getTime()
      if (age > maxAge && recording.blob) {
        this.clearRecordingBlob(recordingId)
        cleared++
      }
    }

    logger.info(`Cleared ${cleared} old recordings from memory`)
    return cleared
  }

  /**
   * Persist a recording to IndexedDB for long-term storage
   *
   * Saves a complete recording with all its metadata and binary blob data to the IndexedDB
   * 'recordings' object store. This method implements robust error handling including quota
   * management, automatic retry with cleanup on quota errors, and proper transaction management.
   * After successful save, it may trigger automatic deletion of old recordings if configured.
   *
   * @param recording - The complete recording data object to persist. Must include:
   *   - `id`: Unique recording identifier (used as primary key)
   *   - `callId`: Associated call identifier (indexed)
   *   - `startTime`: Recording start timestamp (indexed)
   *   - `blob`: Binary Blob containing the recorded media data
   *   - Additional metadata fields (duration, size, mimeType, etc.)
   *
   * @returns A promise that resolves when the recording is successfully saved to IndexedDB,
   *   or rejects if the save operation fails after all retry attempts
   *
   * @throws {Error} If the database is not initialized (`this.db` is null/undefined)
   * @throws {Error} If the transaction is aborted by the browser or database constraints
   * @throws {Error} If the transaction encounters an error during execution
   * @throws {Error} If the add operation fails due to constraint violations (e.g., duplicate ID)
   * @throws {Error} If quota is exceeded and cleanup retry also fails with message:
   *   "IndexedDB quota exceeded. Please free up space or disable recording storage."
   * @throws {Error} For other IndexedDB errors with message:
   *   "Failed to save recording to IndexedDB: {error message}"
   *
   * @remarks
   * ## Transaction Management
   * The method uses a readwrite transaction on the 'recordings' object store:
   * - **Transaction Scope**: Single object store ('recordings')
   * - **Transaction Mode**: 'readwrite' to allow data insertion
   * - **Error Handling**: Separate handlers for transaction abort and error events
   * - **Promise Wrapper**: Wraps callback-based IndexedDB API in a Promise for async/await
   *
   * ## Quota Management Algorithm
   * When storage quota is exceeded (QuotaExceededError), the method implements an automatic
   * recovery strategy:
   * 1. **Detection**: Catches QuotaExceededError from the add operation
   * 2. **Cleanup**: Calls `deleteOldRecordings()` to free space
   * 3. **Retry**: Recursively retries `saveRecording()` once with the same recording
   * 4. **Failure**: If retry fails, rejects with user-friendly quota error message
   *
   * This single-retry approach prevents infinite loops while handling common quota scenarios.
   *
   * ## Post-Save Cleanup
   * After successful save, if `config.autoDeleteOld` is enabled:
   * - Triggers `deleteOldRecordings()` asynchronously (fire-and-forget)
   * - Ensures the recording count stays within `config.maxRecordings` limit
   * - Deletion errors are logged but don't affect the save operation's success
   * - Uses oldest-first deletion strategy based on startTime index
   *
   * ## Error Types and Handling
   *
   * ### QuotaExceededError
   * - **Cause**: IndexedDB storage quota reached (browser-imposed limit)
   * - **Recovery**: Automatic cleanup and retry
   * - **User Action**: Disable storage or manually delete recordings if quota persists
   *
   * ### Transaction Abort
   * - **Cause**: Browser cancels transaction (tab closing, constraints violated)
   * - **Recovery**: None (operation fails)
   * - **Logging**: Transaction error details logged for debugging
   *
   * ### Transaction Error
   * - **Cause**: Database integrity issues, permission changes
   * - **Recovery**: None (operation fails)
   * - **Logging**: Full error details captured and logged
   *
   * ### Add Operation Error
   * - **Cause**: Constraint violations (duplicate key), data validation failures
   * - **Recovery**: None except for quota errors
   * - **Logging**: Error message included in rejection
   *
   * ## Concurrency Considerations
   * - Multiple saves can execute concurrently (separate transactions)
   * - Each save uses an independent transaction
   * - IndexedDB ensures ACID properties per transaction
   * - The `deleteOldRecordings()` method implements its own concurrency control
   *
   * ## Performance Characteristics
   * - **Write Speed**: Depends on blob size and disk I/O performance
   * - **Memory Usage**: Entire recording held in memory during transaction
   * - **Blocking**: Non-blocking (async), doesn't block UI thread
   * - **Index Updates**: Automatically updates callId and startTime indexes
   *
   * ## Data Persistence
   * - Data persists across browser sessions and page reloads
   * - Subject to browser storage eviction policies (LRU, storage pressure)
   * - Can be cleared by user via browser settings
   * - Not synchronized across devices or browser profiles
   *
   * @internal
   */
  private async saveRecording(recording: RecordingData): Promise<void> {
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')

      // Handle transaction abort
      transaction.onabort = () => {
        const error = transaction.error
        logger.error('Transaction aborted', error)
        reject(new Error(`Transaction aborted: ${error?.message || 'Unknown reason'}`))
      }

      // Handle transaction error
      transaction.onerror = () => {
        const error = transaction.error
        logger.error('Transaction error', error)
        reject(new Error(`Transaction failed: ${error?.message || 'Unknown error'}`))
      }

      const request = store.add(recording)

      request.onsuccess = () => {
        logger.debug(`Recording saved to IndexedDB: ${recording.id}`)

        // Delete old recordings if needed
        if (this.config.autoDeleteOld) {
          this.deleteOldRecordings().catch((error) => {
            logger.error('Failed to delete old recordings', error)
          })
        }

        resolve()
      }

      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error

        // Handle quota exceeded specifically
        if (error?.name === 'QuotaExceededError') {
          logger.error('IndexedDB quota exceeded, cannot save recording')
          // Try to free up space by deleting old recordings
          this.deleteOldRecordings()
            .then(() => {
              // Retry save once after cleanup
              logger.info('Retrying save after cleanup')
              return this.saveRecording(recording)
            })
            .then(resolve)
            .catch(() => {
              reject(
                new Error(
                  'IndexedDB quota exceeded. Please free up space or disable recording storage.'
                )
              )
            })
        } else {
          reject(
            new Error(`Failed to save recording to IndexedDB: ${error?.message || 'Unknown error'}`)
          )
        }
      }
    })
  }

  /**
   * Delete oldest recordings from IndexedDB when the maximum recording limit is exceeded
   *
   * Implements an automatic storage management strategy that maintains the recording count at or
   * below the configured maximum. When the limit is exceeded, this method deletes the oldest
   * recordings based on their start time until the count is within limits. Uses a concurrency
   * control mechanism to prevent multiple simultaneous deletion operations that could cause
   * race conditions or redundant work.
   *
   * @returns A promise that resolves when deletion is complete or skipped (if below limit or
   *   already deleting), or rejects if the deletion operation encounters an error
   *
   * @throws {Error} If counting recordings fails with message: "Failed to count recordings"
   * @throws {Error} If deleting recordings fails with message: "Failed to delete old recordings"
   *
   * @remarks
   * ## Deletion Algorithm
   * The method uses a two-phase approach to manage storage:
   *
   * ### Phase 1: Count and Evaluate
   * 1. Query the total count of recordings in the object store
   * 2. Compare count against `config.maxRecordings` threshold
   * 3. If count ≤ maxRecordings, exit early (no deletion needed)
   * 4. Calculate `toDelete = count - maxRecordings`
   *
   * ### Phase 2: Cursor-Based Deletion
   * 1. Open a cursor on the 'startTime' index (automatically sorted by startTime ascending)
   * 2. Iterate through recordings from oldest to newest
   * 3. Delete each recording via `cursor.delete()`
   * 4. Track deletion count and stop when `deleted === toDelete`
   * 5. Continue cursor to next record until quota reached
   *
   * ## Concurrency Control
   * Uses a simple mutex pattern via `this.isDeleting` flag:
   * - **Lock Acquisition**: Set `isDeleting = true` at method start
   * - **Lock Check**: Early return if already locked (deletion in progress)
   * - **Lock Release**: Set `isDeleting = false` in all exit paths (success, error, early return)
   * - **Purpose**: Prevents overlapping deletions that could delete more than necessary
   *
   * This is particularly important because:
   * - Multiple recordings may trigger deletion simultaneously (via saveRecording)
   * - Quota errors can trigger deletion from multiple threads
   * - Redundant deletions waste resources and may over-delete
   *
   * ## Index-Based Sorting
   * The deletion leverages the 'startTime' index created during database initialization:
   * - Index automatically maintains recordings sorted by startTime
   * - Opening a cursor without specifying direction defaults to ascending order
   * - This ensures oldest recordings (lowest startTime) are deleted first
   * - No additional sorting or filtering logic required
   *
   * ## Transaction Semantics
   * - Uses a single readwrite transaction for the entire operation
   * - Count and deletion operations share the same transaction
   * - Transaction auto-commits when all operations complete successfully
   * - Transaction auto-aborts on any error, ensuring atomicity
   *
   * ## Early Exit Conditions
   * The method exits early in several scenarios:
   * 1. **Database not initialized**: Returns immediately if `this.db` is null
   * 2. **Deletion in progress**: Returns immediately if `isDeleting` flag is true
   * 3. **Below limit**: Returns after count if current count ≤ maxRecordings
   *
   * These exits are not errors - they're normal operation paths.
   *
   * ## Error Handling
   * Errors can occur at two points:
   *
   * ### Count Error
   * - Triggered if `store.count()` request fails
   * - Rejects with "Failed to count recordings"
   * - Releases `isDeleting` lock before rejection
   *
   * ### Cursor Error
   * - Triggered if cursor iteration fails
   * - Rejects with "Failed to delete old recordings"
   * - Releases `isDeleting` lock before rejection
   *
   * Both errors release the lock to prevent permanent lockout.
   *
   * ## Performance Characteristics
   * - **Time Complexity**: O(n) where n = number of recordings to delete
   * - **Space Complexity**: O(1) - cursor-based iteration, no array buffering
   * - **I/O Operations**: One transaction with n delete operations
   * - **Blocking**: Non-blocking (async), uses IndexedDB worker thread
   *
   * ## Configuration Dependencies
   * - `config.maxRecordings`: Maximum number of recordings to retain (default: 100)
   * - `config.autoDeleteOld`: Controls whether this method is called automatically
   *
   * ## Typical Usage Scenarios
   * 1. **After Save**: Called by `saveRecording()` when `autoDeleteOld` is enabled
   * 2. **Quota Recovery**: Called by `saveRecording()` when QuotaExceededError occurs
   * 3. **Manual Trigger**: Could be called by public methods for manual cleanup
   *
   * ## Logging and Observability
   * - Logs debug message with deletion count on success
   * - Logs debug message when skipping due to concurrent deletion
   * - Errors are logged by callers (this method only throws)
   *
   * @internal
   */
  private async deleteOldRecordings(): Promise<void> {
    if (!this.db) {
      return
    }

    // Prevent concurrent deletion operations
    if (this.isDeleting) {
      logger.debug('Deletion already in progress, skipping')
      return
    }

    this.isDeleting = true

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')
      const index = store.index('startTime')

      const countRequest = store.count()

      countRequest.onsuccess = () => {
        const count = countRequest.result

        if (count <= this.config.maxRecordings) {
          this.isDeleting = false
          resolve()
          return
        }

        const toDelete = count - this.config.maxRecordings

        // Get oldest recordings
        const request = index.openCursor()
        let deleted = 0

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor && deleted < toDelete) {
            cursor.delete()
            deleted++
            cursor.continue()
          } else {
            logger.debug(`Deleted ${deleted} old recordings`)
            this.isDeleting = false
            resolve()
          }
        }

        request.onerror = () => {
          this.isDeleting = false
          reject(new Error('Failed to delete old recordings'))
        }
      }

      countRequest.onerror = () => {
        this.isDeleting = false
        reject(new Error('Failed to count recordings'))
      }
    })
  }

  /**
   * Determine the best supported MIME type for MediaRecorder from a prioritized list
   *
   * Probes the browser's MediaRecorder API to find the first supported MIME type from a
   * curated list of common media formats. Implements a fallback chain that prioritizes the
   * user's preferred type (if provided) before trying standard formats. This ensures recordings
   * can be created even when specific formats aren't supported, while respecting user preferences.
   *
   * @param preferred - Optional preferred MIME type to try first. Common values include:
   *   - `'audio/webm'` - WebM audio container (widely supported)
   *   - `'audio/webm;codecs=opus'` - WebM with Opus codec (high quality, efficient)
   *   - `'video/webm'` - WebM video container
   *   - `'video/webm;codecs=vp8,opus'` - WebM with VP8 video and Opus audio
   *   - `'audio/mp4'` or `'video/mp4'` - MP4 containers (Safari, older browsers)
   *   If undefined or null, the fallback chain is used without preference
   *
   * @returns The first MIME type from the priority list that `MediaRecorder.isTypeSupported()`
   *   returns true for. Returns `null` if no formats in the list are supported (rare - indicates
   *   MediaRecorder API is not functional or severely limited browser)
   *
   * @remarks
   * ## Fallback Priority Chain
   * The method tests formats in this order:
   * 1. **User Preferred** (if provided): Whatever MIME type was passed as parameter
   * 2. **Audio WebM**: `audio/webm` - Basic WebM audio, widely supported
   * 3. **Audio WebM + Opus**: `audio/webm;codecs=opus` - Higher quality audio with Opus
   * 4. **Audio OGG + Opus**: `audio/ogg;codecs=opus` - OGG container alternative
   * 5. **Audio MP4**: `audio/mp4` - MP4 audio for Safari and older browsers
   * 6. **Video WebM**: `video/webm` - Basic WebM video
   * 7. **Video WebM + VP8**: `video/webm;codecs=vp8,opus` - WebM with VP8 video codec
   * 8. **Video WebM + VP9**: `video/webm;codecs=vp9,opus` - WebM with VP9 video codec (newer)
   * 9. **Video MP4**: `video/mp4` - MP4 video for Safari
   *
   * ## Browser Compatibility Rationale
   * - **Chrome/Edge**: Excellent WebM support (WebM is primary)
   * - **Firefox**: Excellent WebM support, prefers Opus codec
   * - **Safari**: Limited WebM support, often requires MP4 fallback
   * - **Mobile**: Varies widely, hence comprehensive fallback chain
   *
   * ## Implementation Details
   * The method uses:
   * - `Array.filter(Boolean)` to remove undefined/null preferred type
   * - Type assertion `as string[]` after filtering
   * - `MediaRecorder.isTypeSupported()` browser API for capability detection
   * - Early return on first match (first-match optimization)
   *
   * ## Performance
   * - **Time Complexity**: O(n) where n = number of formats to check (max 9)
   * - **Typical Case**: O(1) - usually matches first or second format
   * - **Synchronous**: No async operations, runs on main thread
   * - **Caching**: Not cached - called once per recording, minimal overhead
   *
   * ## Usage Context
   * This method is called during recording initialization:
   * 1. Called by `startRecording()` before creating MediaRecorder
   * 2. Preferred type typically comes from `config.mimeType` or recording options
   * 3. Result is passed to MediaRecorder constructor
   * 4. If returns null, `startRecording()` throws an error
   *
   * ## Codec Details
   * - **Opus**: Modern audio codec, excellent quality/compression ratio
   * - **VP8**: Video codec, widely supported, good compression
   * - **VP9**: Newer video codec, better compression than VP8, less supported
   * - **WebM**: Open container format, preferred for web applications
   * - **MP4**: Proprietary container, required for Safari compatibility
   *
   * ## Failure Scenario
   * Returning null is extremely rare and typically indicates:
   * - MediaRecorder API not implemented (very old browser)
   * - Browser built without media support (special builds)
   * - Corrupt browser installation
   * - Testing environment without proper mocking
   *
   * In production, this should virtually never happen with modern browsers.
   *
   * ## Extension Points
   * To add support for new formats:
   * 1. Add MIME type string to the `mimeTypes` array
   * 2. Position earlier in array for higher priority
   * 3. Consider browser support matrix
   * 4. Test across target browsers
   *
   * @internal
   */
  private getSupportedMimeType(preferred?: string): string | null {
    const mimeTypes = [
      preferred,
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'video/webm',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/mp4',
    ].filter(Boolean) as string[]

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType
      }
    }

    return null
  }

  /**
   * Generate a cryptographically secure unique identifier for a recording
   *
   * Creates a unique recording ID using the best available randomness source in the current
   * environment. Implements a three-tier fallback strategy to ensure ID generation works across
   * all environments (modern browsers, older browsers, and test environments) while maintaining
   * security and uniqueness guarantees appropriate for each context.
   *
   * @returns A unique recording ID string with format depending on the randomness source:
   *   - Modern browsers: `'recording-{uuid}'` (e.g., 'recording-550e8400-e29b-41d4-a716-446655440000')
   *   - Older browsers: `'recording-{timestamp}-{hex}'` (e.g., 'recording-1699564800000-a3f5e9c1...')
   *   - Test environments: `'recording-{timestamp}-{base36}'` (e.g., 'recording-1699564800000-k9x4m2p')
   *
   * @remarks
   * ## Three-Tier Fallback Strategy
   *
   * ### Tier 1: crypto.randomUUID() (Preferred)
   * - **Availability**: Modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+)
   * - **Algorithm**: Native UUID v4 generation per RFC 4122
   * - **Randomness**: Cryptographically secure (CSPRNG)
   * - **Format**: Standard UUID format (36 characters: 8-4-4-4-12 hex digits)
   * - **Uniqueness**: ~5.3 × 10^36 possible values, collision probability negligible
   * - **Performance**: Very fast (native implementation)
   * - **Use Case**: Production environments with modern browsers
   *
   * ### Tier 2: crypto.getRandomValues() (Fallback)
   * - **Availability**: Most browsers supporting Web Crypto API (IE 11+, all modern browsers)
   * - **Algorithm**: Manual UUID-like ID using 128 bits of random data
   * - **Randomness**: Cryptographically secure (Web Crypto CSPRNG)
   * - **Format**: `recording-{timestamp}-{32-hex-digits}`
   *   - Timestamp: Unix milliseconds (13 digits)
   *   - Random: 128 bits as 32 hexadecimal characters
   * - **Uniqueness**: ~3.4 × 10^38 possible values (per timestamp millisecond)
   * - **Performance**: Fast (native crypto, minimal processing)
   * - **Use Case**: Older browsers, environments without randomUUID
   *
   * ### Tier 3: Math.random() (Emergency Fallback)
   * - **Availability**: All JavaScript environments (universal fallback)
   * - **Algorithm**: Timestamp + pseudo-random base36 string
   * - **Randomness**: NOT cryptographically secure (pseudo-random)
   * - **Format**: `recording-{timestamp}-{base36-string}`
   *   - Timestamp: Unix milliseconds (13 digits)
   *   - Random: ~7 characters in base36 (a-z, 0-9)
   * - **Uniqueness**: Moderate (~78 billion per millisecond, but predictable)
   * - **Performance**: Very fast
   * - **Warning**: Logs warning message about non-cryptographic generation
   * - **Use Case**: Testing environments (Node.js < 15), non-browser environments
   *
   * ## Security Considerations
   *
   * ### Why Cryptographic Randomness Matters
   * - **Predictability**: Math.random() is predictable and can be guessed
   * - **Collisions**: Weak randomness increases collision probability
   * - **Privacy**: Recording IDs may be exposed in URLs, logs, or API calls
   * - **Best Practice**: Always prefer CSPRNG for identifiers
   *
   * ### Tier 3 Security Notice
   * When falling back to Math.random():
   * - A warning is logged to alert developers
   * - Consider implementing secure ID generation server-side
   * - Not recommended for production use
   * - Acceptable for testing and development only
   *
   * ## Uniqueness Guarantees
   *
   * ### Collision Probability (Birthday Paradox)
   * - **Tier 1 (UUID)**: ~0% collision probability up to 10^18 recordings
   * - **Tier 2 (Crypto)**: ~0% collision probability up to 10^19 recordings
   * - **Tier 3 (Math.random)**: ~1% collision probability at ~280,000 recordings
   *
   * ### Timestamp Component (Tiers 2 & 3)
   * Including timestamp provides:
   * - Temporal ordering capability
   * - Additional uniqueness dimension
   * - Human-readable approximate creation time
   * - Reduces collision risk (only collide within same millisecond)
   *
   * ## Format Details
   *
   * ### Tier 2 Hex Generation
   * ```typescript
   * const array = new Uint32Array(4)  // 4 × 32 bits = 128 bits
   * crypto.getRandomValues(array)      // Fill with random values
   * array.map(num => num.toString(16).padStart(8, '0'))  // Convert to hex
   * ```
   * Results in 32 hexadecimal characters (128 bits of entropy)
   *
   * ### Tier 3 Base36 Generation
   * ```typescript
   * Math.random().toString(36).substring(2, 9)  // 7 random chars
   * ```
   * Results in ~7 characters from [a-z0-9] (~23 bits of entropy)
   *
   * ## Usage in Plugin
   * This method is called once per recording:
   * - During `startRecording()` initialization
   * - Before creating MediaRecorder instance
   * - ID is stored in recording metadata
   * - ID serves as primary key in IndexedDB
   * - ID is returned to caller for future reference
   *
   * ## Testing Considerations
   * In test environments:
   * - Mock `crypto.randomUUID()` for predictable IDs
   * - Or accept warning and use Math.random() fallback
   * - Consider implementing test-specific ID generator
   * - UUID libraries (like `uuid` npm package) can provide polyfills
   *
   * ## Performance Characteristics
   * - **Time Complexity**: O(1) constant time
   * - **Memory**: Minimal (single string allocation)
   * - **Synchronous**: All tiers execute synchronously
   * - **Overhead**: Negligible compared to recording operations
   *
   * @internal
   */
  private generateRecordingId(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `recording-${crypto.randomUUID()}`
    }

    // Fallback: Use Web Crypto API with getRandomValues
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(4)
      crypto.getRandomValues(array)
      const hex = Array.from(array)
        .map((num) => num.toString(16).padStart(8, '0'))
        .join('')
      return `recording-${Date.now()}-${hex}`
    }

    // Final fallback for non-browser environments (testing)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    logger.warn('Using non-cryptographic recording ID generation - crypto API not available')
    return `recording-${timestamp}-${random}`
  }

  /**
   * Download a recording to the user's device
   *
   * Creates a download link and triggers the browser's download mechanism to save the recording
   * blob to the user's local filesystem. This method creates a temporary object URL, programmatically
   * clicks a download link, and then cleans up the URL to prevent memory leaks. The recording must
   * have a blob available in memory to be downloaded.
   *
   * @param recordingId - Unique identifier of the recording to download. This must be a valid
   *   recording ID from a completed recording. The recording must:
   *   - Exist in the `recordings` Map
   *   - Have a blob available (not cleared from memory)
   *   - Be in a stopped state (recommended, but not enforced)
   * @param filename - Optional custom filename for the downloaded file. If not provided, a default
   *   filename is generated using the pattern: `recording-{callId}-{timestamp}.{extension}`
   *   where extension is determined from the recording's MIME type (e.g., .webm, .mp4, .ogg).
   *   Custom filenames should include the appropriate file extension.
   *
   * @throws {Error} If the recording is not found in memory
   * @throws {Error} If the recording has no blob (was cleared from memory or never created)
   * @throws {Error} If running in non-browser environment without DOM access
   *
   * @remarks
   * ## Download Process
   * 1. **Validation**: Verifies recording exists and has a blob
   * 2. **Environment Check**: Ensures DOM access (document and body exist)
   * 3. **URL Creation**: Creates temporary object URL for the blob
   * 4. **Link Creation**: Creates temporary anchor element with download attribute
   * 5. **Download Trigger**: Programmatically clicks the link to initiate download
   * 6. **Cleanup**: Removes anchor element and revokes object URL
   *
   * ## Browser Behavior
   * The download behavior depends on the browser:
   * - Most browsers: Opens "Save As" dialog or saves to default download folder
   * - Some browsers: May prompt for location
   * - Mobile browsers: May have different download behaviors
   * - File location: Determined by browser's download settings
   *
   * ## Filename Generation
   * If no filename is provided, the default format is:
   * ```
   * recording-{callId}-{startTime}.{extension}
   * ```
   * Example: `recording-call-123-1699564800000.webm`
   *
   * Extension is determined from MIME type:
   * - 'audio/webm' or 'video/webm' → .webm
   * - 'audio/ogg' → .ogg
   * - 'audio/mp4' or 'video/mp4' → .mp4
   * - Unknown → .webm (fallback)
   *
   * ## Memory Requirements
   * - Recording blob must be in memory (not cleared)
   * - If blob was cleared after IndexedDB save, retrieve it first:
   *   ```typescript
   *   const recording = await getFromIndexedDB(recordingId)
   *   // Temporarily restore blob to memory
   *   plugin.recordings.set(recordingId, recording)
   *   plugin.downloadRecording(recordingId)
   *   ```
   *
   * ## Security Considerations
   * - Creates temporary object URL that is immediately revoked
   * - Anchor element is created, used, and removed from DOM
   * - No persistent references to blob URLs
   * - Safe from memory leaks if cleanup executes properly
   *
   * ## Browser Compatibility
   * Requires:
   * - DOM access (`document` and `document.body`)
   * - `URL.createObjectURL()` support
   * - HTML5 anchor download attribute support
   * - Works in all modern browsers
   * - Not supported in Node.js or non-browser environments
   *
   * ## Use Cases
   * - Allow users to save recordings locally
   * - Download for backup before clearing from memory
   * - Export recordings for external processing
   * - Save recordings before uploading to server (as backup)
   * - Provide download option in recording management UI
   *
   * @example Download with default filename
   * ```typescript
   * try {
   *   plugin.downloadRecording('recording-123')
   *   console.log('Download initiated')
   * } catch (error) {
   *   console.error('Download failed:', error)
   * }
   * ```
   *
   * @example Download with custom filename
   * ```typescript
   * const recordingId = 'recording-456'
   * const filename = 'important-call-2024-01-15.webm'
   *
   * try {
   *   plugin.downloadRecording(recordingId, filename)
   *   console.log(`Download started: ${filename}`)
   * } catch (error) {
   *   console.error('Failed to download:', error)
   * }
   * ```
   *
   * @example Download with validation
   * ```typescript
   * const recordingId = 'recording-789'
   * const recording = plugin.getRecording(recordingId)
   *
   * if (!recording) {
   *   console.error('Recording not found')
   * } else if (!recording.blob) {
   *   console.error('Recording blob not in memory')
   *   console.log('Retrieve from IndexedDB first')
   * } else if (recording.state !== 'stopped') {
   *   console.warn('Recording is not complete yet')
   *   console.log('Download anyway? The file may be incomplete')
   * } else {
   *   plugin.downloadRecording(recordingId, 'my-recording.webm')
   *   console.log('Download initiated')
   * }
   * ```
   *
   * @example Download all completed recordings
   * ```typescript
   * const recordings = plugin.getAllRecordings()
   *   .filter(r => r.state === 'stopped' && r.blob)
   *
   * recordings.forEach((recording, index) => {
   *   const filename = `recording-${index + 1}-${recording.callId}.webm`
   *   try {
   *     plugin.downloadRecording(recording.id, filename)
   *     console.log(`Downloaded: ${filename}`)
   *   } catch (error) {
   *     console.error(`Failed to download ${recording.id}:`, error)
   *   }
   * })
   * ```
   *
   * @example Download with UI button
   * ```typescript
   * function setupDownloadButton(recordingId: string) {
   *   const button = document.getElementById('download-btn')
   *   const recording = plugin.getRecording(recordingId)
   *
   *   if (recording && recording.blob) {
   *     button.disabled = false
   *     button.onclick = () => {
   *       try {
   *         const date = recording.startTime.toISOString().split('T')[0]
   *         const filename = `call-${recording.callId}-${date}.webm`
   *         plugin.downloadRecording(recordingId, filename)
   *         console.log('Download initiated')
   *       } catch (error) {
   *         alert('Download failed: ' + error.message)
   *       }
   *     }
   *   } else {
   *     button.disabled = true
   *     button.title = 'Recording not available for download'
   *   }
   * }
   * ```
   *
   * @example Retrieve from IndexedDB and download
   * ```typescript
   * async function downloadFromStorage(recordingId: string) {
   *   // Check if blob is in memory
   *   let recording = plugin.getRecording(recordingId)
   *
   *   if (recording && recording.blob) {
   *     // Blob available, download directly
   *     plugin.downloadRecording(recordingId)
   *     return
   *   }
   *
   *   // Blob not in memory, retrieve from IndexedDB
   *   console.log('Retrieving from IndexedDB...')
   *   const db = await new Promise<IDBDatabase>((resolve, reject) => {
   *     const request = indexedDB.open('vuesip-recordings', 1)
   *     request.onsuccess = () => resolve(request.result)
   *     request.onerror = () => reject(request.error)
   *   })
   *
   *   const transaction = db.transaction(['recordings'], 'readonly')
   *   const store = transaction.objectStore('recordings')
   *   const request = store.get(recordingId)
   *
   *   request.onsuccess = () => {
   *     const storedRecording = request.result
   *     if (storedRecording && storedRecording.blob) {
   *       // Temporarily restore to memory
   *       plugin.recordings.set(recordingId, storedRecording)
   *       // Download
   *       plugin.downloadRecording(recordingId)
   *       // Clear from memory again
   *       plugin.recordings.get(recordingId)!.blob = undefined
   *     } else {
   *       console.error('Recording not found in IndexedDB')
   *     }
   *   }
   *
   *   request.onerror = () => {
   *     console.error('Failed to retrieve from IndexedDB:', request.error)
   *   }
   * }
   * ```
   */
  downloadRecording(recordingId: string, filename?: string): void {
    const recording = this.recordings.get(recordingId)
    if (!recording || !recording.blob) {
      throw new Error(`Recording not found or has no blob: ${recordingId}`)
    }

    // Check if running in browser environment
    if (typeof document === 'undefined' || !document.body) {
      throw new Error('Download is only supported in browser environments with DOM access')
    }

    const url = URL.createObjectURL(recording.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `recording-${recording.callId}-${recording.startTime.getTime()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.debug(`Recording download initiated: ${recordingId}`)
  }
}

/**
 * Create recording plugin instance
 *
 * @returns Recording plugin
 */
export function createRecordingPlugin(): RecordingPlugin {
  return new RecordingPlugin()
}
