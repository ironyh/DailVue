/**
 * Recording Plugin
 *
 * Records audio/video from calls using the MediaRecorder API.
 * Supports auto-recording, IndexedDB storage, and recording management.
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
 * Recording Plugin
 *
 * Handles call recording with MediaRecorder API.
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

  /**
   * Install the plugin
   *
   * @param context - Plugin context
   * @param config - Plugin configuration
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
   * Uninstall the plugin
   *
   * @param _context - Plugin context
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
   * Update configuration
   *
   * @param _context - Plugin context
   * @param config - New configuration
   */
  async updateConfig(_context: PluginContext, config: RecordingPluginConfig): Promise<void> {
    this.config = { ...this.config, ...config }
    logger.info('Recording plugin configuration updated')
  }

  /**
   * Initialize IndexedDB
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
   * Register event listeners
   *
   * @param context - Plugin context
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
   * Start recording a call
   *
   * @param callId - Call ID
   * @param stream - Media stream to record
   * @param options - Recording options (overrides config)
   * @returns Recording ID
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

    const recordingId = `recording-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

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
    recorder.start(recordingOptions.timeSlice)

    this.activeRecordings.set(callId, recorder)

    return recordingId
  }

  /**
   * Stop recording a call
   *
   * @param callId - Call ID
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
   * Pause recording
   *
   * @param callId - Call ID
   */
  pauseRecording(callId: string): void {
    const recorder = this.activeRecordings.get(callId)
    if (!recorder) {
      throw new Error(`No active recording for call ${callId}`)
    }

    if (recorder.state === 'recording') {
      recorder.pause()
      logger.debug(`Recording paused: ${callId}`)
    }
  }

  /**
   * Resume recording
   *
   * @param callId - Call ID
   */
  resumeRecording(callId: string): void {
    const recorder = this.activeRecordings.get(callId)
    if (!recorder) {
      throw new Error(`No active recording for call ${callId}`)
    }

    if (recorder.state === 'paused') {
      recorder.resume()
      logger.debug(`Recording resumed: ${callId}`)
    }
  }

  /**
   * Get recording data
   *
   * @param recordingId - Recording ID
   * @returns Recording data or undefined
   */
  getRecording(recordingId: string): RecordingData | undefined {
    return this.recordings.get(recordingId)
  }

  /**
   * Get all recordings
   *
   * @returns Array of recording data
   */
  getAllRecordings(): RecordingData[] {
    return Array.from(this.recordings.values())
  }

  /**
   * Clear recording blob from memory
   *
   * Should be called after saving to IndexedDB to prevent memory leaks.
   * The recording metadata remains but the blob is cleared.
   *
   * @param recordingId - Recording ID
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
   * Get memory usage estimate for recordings
   *
   * @returns Estimated memory usage in bytes
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
   * Clear old recordings from memory (not IndexedDB)
   *
   * @param maxAge - Maximum age in milliseconds
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
   * Save recording to IndexedDB
   *
   * @param recording - Recording data
   */
  private async saveRecording(recording: RecordingData): Promise<void> {
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')

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
          reject(new Error(`Failed to save recording to IndexedDB: ${error?.message || 'Unknown error'}`))
        }
      }
    })
  }

  /**
   * Delete old recordings if max limit exceeded
   */
  private async deleteOldRecordings(): Promise<void> {
    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')
      const index = store.index('startTime')

      const countRequest = store.count()

      countRequest.onsuccess = () => {
        const count = countRequest.result

        if (count <= this.config.maxRecordings) {
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
            resolve()
          }
        }

        request.onerror = () => {
          reject(new Error('Failed to delete old recordings'))
        }
      }

      countRequest.onerror = () => {
        reject(new Error('Failed to count recordings'))
      }
    })
  }

  /**
   * Get supported MIME type
   *
   * @param preferred - Preferred MIME type
   * @returns Supported MIME type or null
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
   * Download a recording
   *
   * @param recordingId - Recording ID
   * @param filename - Optional filename
   */
  downloadRecording(recordingId: string, filename?: string): void {
    const recording = this.recordings.get(recordingId)
    if (!recording || !recording.blob) {
      throw new Error(`Recording not found or has no blob: ${recordingId}`)
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
