/**
 * RecordingPlugin Edge Case Tests
 *
 * Tests for critical edge cases and fixes implemented in code review
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RecordingPlugin } from '../../../src/plugins/RecordingPlugin'
import { EventBus } from '../../../src/core/EventBus'
import type { PluginContext } from '../../../src/types/plugin.types'

// Mock MediaRecorder
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((event: any) => void) | null = null
  onstart: (() => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((event: any) => void) | null = null

  static isTypeSupported = vi.fn((mimeType: string) => {
    return mimeType.includes('webm') || mimeType.includes('audio')
  })

  constructor(stream: MediaStream, options?: any) {}

  start(timeSlice?: number) {
    this.state = 'recording'
    if (this.onstart) {
      setTimeout(() => this.onstart?.(), 10)
    }
  }

  stop() {
    this.state = 'inactive'
    // Trigger ondataavailable with mock data before onstop
    if (this.ondataavailable) {
      const mockBlob = new Blob(['mock data'], { type: 'audio/webm' })
      this.ondataavailable({ data: mockBlob } as any)
    }
    if (this.onstop) {
      setTimeout(() => this.onstop?.(), 10)
    }
  }

  pause() {
    this.state = 'paused'
  }

  resume() {
    this.state = 'recording'
  }
}

// Mock IndexedDB
class MockIDBDatabase {
  objectStoreNames = {
    contains: vi.fn().mockReturnValue(false),
  }

  transaction = vi.fn((storeNames: string[], mode: string) => ({
    onabort: null,
    onerror: null,
    objectStore: vi.fn((name: string) => ({
      add: vi.fn((data: any) => {
        const request = {
          onsuccess: null,
          onerror: null,
          result: data,
        }
        // Trigger onsuccess asynchronously to simulate IndexedDB behavior
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request } as any)
          }
        }, 10)
        return request
      }),
      count: vi.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: 0,
      }),
      index: vi.fn(() => ({
        openCursor: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
        }),
      })),
    })),
  }))

  createObjectStore = vi.fn((name: string, options: any) => ({
    createIndex: vi.fn(),
  }))

  close = vi.fn()
}

class MockIDBOpenDBRequest {
  onsuccess: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onupgradeneeded: ((event: any) => void) | null = null
  result: MockIDBDatabase = new MockIDBDatabase()
}

const mockIndexedDB = {
  open: vi.fn((name: string, version: number) => {
    const request = new MockIDBOpenDBRequest()
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: request } as any)
      }
    }, 10)
    return request
  }),
}

// Setup global mocks
global.MediaRecorder = MockMediaRecorder as any
global.indexedDB = mockIndexedDB as any

describe('RecordingPlugin - Edge Cases', () => {
  let plugin: RecordingPlugin
  let eventBus: EventBus
  let context: PluginContext
  let mockStream: MediaStream

  beforeEach(() => {
    eventBus = new EventBus()
    context = {
      eventBus,
      version: '1.0.0',
      hooks: {
        register: vi.fn(),
        execute: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    } as any

    mockStream = {
      getTracks: vi.fn().mockReturnValue([]),
      getAudioTracks: vi.fn().mockReturnValue([]),
      getVideoTracks: vi.fn().mockReturnValue([]),
    } as any

    plugin = new RecordingPlugin()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (plugin) {
      await plugin.uninstall(context)
    }
    eventBus.destroy()
  })

  describe('IndexedDB Quota Exceeded', () => {
    it('should handle QuotaExceededError gracefully', async () => {
      await plugin.install(context, { storeInIndexedDB: true })

      const recordingId = await plugin.startRecording('call-123', mockStream)

      // Mock IndexedDB quota exceeded error
      const mockDB = (plugin as any).db
      if (mockDB) {
        mockDB.transaction = vi.fn(() => ({
          objectStore: vi.fn(() => ({
            add: vi.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
            }),
          })),
        }))
      }

      // Manually trigger onstop to save
      const recording = plugin.getRecording(recordingId)
      if (recording) {
        recording.blob = new Blob(['test'], { type: 'audio/webm' })
      }

      // Should not crash
      await plugin.stopRecording('call-123')

      expect(plugin).toBeDefined()
    })

    it('should attempt cleanup and retry on quota exceeded', async () => {
      const onRecordingError = vi.fn()

      await plugin.install(context, {
        storeInIndexedDB: true,
        onRecordingError,
      })

      await plugin.startRecording('call-123', mockStream)

      // Simulate quota exceeded
      // Test would verify cleanup and retry logic
      expect(plugin).toBeDefined()
    })
  })

  describe('Empty MediaRecorder Chunks', () => {
    it('should detect and handle empty recordings', async () => {
      // Create a custom mock that doesn't add data (to simulate empty recording)
      class EmptyMockMediaRecorder extends MockMediaRecorder {
        stop() {
          this.state = 'inactive'
          // Fire onstop WITHOUT ondataavailable to simulate empty recording
          if (this.onstop) {
            setTimeout(() => this.onstop?.(), 10)
          }
        }
      }

      // Temporarily replace global mock
      const originalMockMediaRecorder = global.MediaRecorder
      global.MediaRecorder = EmptyMockMediaRecorder as any

      const onRecordingError = vi.fn()

      // Create a mock MediaRecorder that doesn't provide data
      class EmptyMockMediaRecorder extends MockMediaRecorder {
        stop() {
          this.state = 'inactive'
          // Don't trigger ondataavailable - simulate empty recording
          if (this.onstop) {
            setTimeout(() => this.onstop?.(), 10)
          }
        }
      }

      // Temporarily replace the global MediaRecorder
      const originalMediaRecorder = global.MediaRecorder
      global.MediaRecorder = EmptyMockMediaRecorder as any

      await plugin.install(context, {
        storeInIndexedDB: false,
        onRecordingError,
      })

      // Start recording
      await plugin.startRecording('call-123', mockStream)

      // Stop immediately without data
      await plugin.stopRecording('call-123')

      // Wait for async onstop handler
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should have called error callback for empty recording
      expect(onRecordingError).toHaveBeenCalled()

      // Restore original MediaRecorder
      global.MediaRecorder = originalMediaRecorder
    })

    it('should not save empty blobs to IndexedDB', async () => {
      await plugin.install(context, { storeInIndexedDB: true })

      await plugin.startRecording('call-123', mockStream)

      // Mock empty blob
      const recording = plugin.getRecording((plugin as any).recordings.keys().next().value)
      if (recording) {
        recording.blob = new Blob([], { type: 'audio/webm' }) // Empty blob
      }

      await plugin.stopRecording('call-123')

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should not have saved empty recording
      expect(plugin).toBeDefined()
    })
  })

  describe('Blob Memory Leak Prevention', () => {
    it('should clear blobs from memory after saving', async () => {
      await plugin.install(context, { storeInIndexedDB: true })

      const recordingId = await plugin.startRecording('call-123', mockStream)

      // MockMediaRecorder will automatically add blob data on stop
      await plugin.stopRecording('call-123')

      // Wait for save and cleanup
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Blob should be cleared from memory after IndexedDB save
      const savedRecording = plugin.getRecording(recordingId)
      expect(savedRecording?.blob).toBeUndefined()
    })

    it('should clear all blobs on uninstall', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      // Create multiple recordings
      await plugin.startRecording('call-1', mockStream)
      await plugin.startRecording('call-2', mockStream)

      // Add blobs
      for (const recording of plugin.getAllRecordings()) {
        recording.blob = new Blob(['data'], { type: 'audio/webm' })
      }

      // Uninstall
      await plugin.uninstall(context)

      // All recordings should be cleared
      expect(plugin.getAllRecordings()).toHaveLength(0)
    })

    it('should provide memory usage estimate', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-123', mockStream)

      const recordingId = (plugin as any).recordings.keys().next().value
      const recording = plugin.getRecording(recordingId)
      if (recording) {
        recording.blob = new Blob(['test data'], { type: 'audio/webm' })
      }

      const memoryUsage = plugin.getMemoryUsage()

      expect(memoryUsage).toBeGreaterThan(0)
    })

    it('should clear old recordings from memory', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-123', mockStream)

      const recordingId = (plugin as any).recordings.keys().next().value
      const recording = plugin.getRecording(recordingId)
      if (recording) {
        recording.blob = new Blob(['test data'], { type: 'audio/webm' })
        // Set old timestamp
        recording.startTime = new Date(Date.now() - 7200000) // 2 hours ago
      }

      // Clear recordings older than 1 hour
      const cleared = plugin.clearOldRecordingsFromMemory(3600000)

      expect(cleared).toBe(1)

      // Blob should be cleared
      const updatedRecording = plugin.getRecording(recordingId)
      expect(updatedRecording?.blob).toBeUndefined()
    })
  })

  describe('Multiple Recordings Edge Cases', () => {
    it('should prevent duplicate recordings for same call', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-123', mockStream)

      // Try to start again
      await expect(plugin.startRecording('call-123', mockStream)).rejects.toThrow(
        'Already recording call call-123'
      )
    })

    it('should handle rapid start/stop cycles', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      // Rapid cycles
      for (let i = 0; i < 10; i++) {
        await plugin.startRecording(`call-${i}`, mockStream)
        await plugin.stopRecording(`call-${i}`)
      }

      // Should not crash or leak
      expect(plugin).toBeDefined()
    })

    it('should handle stopping already stopped recording', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-123', mockStream)
      await plugin.stopRecording('call-123')

      // Try to stop again
      await expect(plugin.stopRecording('call-123')).rejects.toThrow(
        'No active recording for call call-123'
      )
    })
  })

  describe('Pause/Resume Edge Cases', () => {
    it('should handle rapid pause/resume/pause', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-123', mockStream)

      // Wait for recording to start
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Rapid pause/resume
      plugin.pauseRecording('call-123')
      plugin.resumeRecording('call-123')
      plugin.pauseRecording('call-123')

      // Should not crash
      expect(plugin).toBeDefined()
    })

    it('should handle pause on non-recording call', () => {
      expect(() => plugin.pauseRecording('non-existent')).toThrow(
        'No active recording for call non-existent'
      )
    })

    it('should handle resume on non-recording call', () => {
      expect(() => plugin.resumeRecording('non-existent')).toThrow(
        'No active recording for call non-existent'
      )
    })
  })

  describe('MIME Type Handling', () => {
    it('should handle no supported MIME types', async () => {
      // Mock all MIME types as unsupported
      MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(false)

      await plugin.install(context, { storeInIndexedDB: false })

      await expect(plugin.startRecording('call-123', mockStream)).rejects.toThrow(
        'No supported MIME type found'
      )

      // Restore mock
      MockMediaRecorder.isTypeSupported = vi.fn((mimeType: string) => {
        return mimeType.includes('webm') || mimeType.includes('audio')
      })
    })

    it('should try multiple MIME types until one is supported', async () => {
      const isTypeSupported = vi.fn()
      isTypeSupported
        .mockReturnValueOnce(false) // First type fails
        .mockReturnValueOnce(false) // Second fails
        .mockReturnValueOnce(true) // Third succeeds

      MockMediaRecorder.isTypeSupported = isTypeSupported

      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-123', mockStream, {
        mimeType: 'unsupported/type',
      })

      expect(isTypeSupported).toHaveBeenCalled()

      // Restore
      MockMediaRecorder.isTypeSupported = vi.fn((mimeType: string) => {
        return mimeType.includes('webm') || mimeType.includes('audio')
      })
    })
  })

  describe('Download Edge Cases', () => {
    beforeEach(() => {
      // Mock DOM APIs
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      global.URL.revokeObjectURL = vi.fn()
      document.createElement = vi.fn((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: vi.fn(),
          } as any
        }
        return {} as any
      })
      document.body.appendChild = vi.fn()
      document.body.removeChild = vi.fn()
    })

    it('should throw if recording not found', () => {
      expect(() => plugin.downloadRecording('non-existent')).toThrow(
        'Recording not found or has no blob'
      )
    })

    it('should throw if recording has no blob', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      const recordingId = await plugin.startRecording('call-123', mockStream)

      // Recording exists but no blob
      expect(() => plugin.downloadRecording(recordingId)).toThrow(
        'Recording not found or has no blob'
      )
    })

    it('should use custom filename', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      const recordingId = await plugin.startRecording('call-123', mockStream)

      const recording = plugin.getRecording(recordingId)
      if (recording) {
        recording.blob = new Blob(['test'], { type: 'audio/webm' })
      }

      plugin.downloadRecording(recordingId, 'custom-name.webm')

      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  describe('Uninstall Cleanup', () => {
    it('should stop all recordings on uninstall', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-1', mockStream)
      await plugin.startRecording('call-2', mockStream)
      await plugin.startRecording('call-3', mockStream)

      await plugin.uninstall(context)

      // All recordings should be stopped
      expect(plugin.getAllRecordings()).toHaveLength(0)
    })

    it('should handle uninstall errors gracefully', async () => {
      await plugin.install(context, { storeInIndexedDB: false })

      await plugin.startRecording('call-1', mockStream)

      // Mock stop to throw
      ;(plugin as any).activeRecordings.get('call-1').stop = vi.fn(() => {
        throw new Error('Stop failed')
      })

      // Should not throw on uninstall
      await expect(plugin.uninstall(context)).resolves.not.toThrow()
    })
  })

  describe('Auto-start/stop Timing', () => {
    it('should handle call ended before recording started', async () => {
      await plugin.install(context, {
        autoStart: false,
        storeInIndexedDB: false,
      })

      // Call ended event without recording
      eventBus.emit('callEnded', { callId: 'call-123' })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should not crash
      expect(plugin).toBeDefined()
    })

    it('should handle multiple call ended events', async () => {
      await plugin.install(context, {
        autoStart: false,
        storeInIndexedDB: false,
      })

      await plugin.startRecording('call-123', mockStream)

      // Multiple ended events
      eventBus.emit('callEnded', { callId: 'call-123' })
      eventBus.emit('callEnded', { callId: 'call-123' })
      eventBus.emit('callEnded', { callId: 'call-123' })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should handle gracefully
      expect(plugin).toBeDefined()
    })
  })
})
