/**
 * RecordingPlugin Lifecycle Tests
 *
 * Tests for recording lifecycle management:
 * - Pause and resume operations
 * - State transitions
 * - Edge case handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecordingPlugin } from '../../../src/plugins/RecordingPlugin'
import * as loggerModule from '../../../src/utils/logger'

describe('RecordingPlugin - Lifecycle', () => {
  describe('Pause/Resume Edge Cases', () => {
    let plugin: RecordingPlugin

    beforeEach(() => {
      plugin = new RecordingPlugin()
    })

    it('should ignore pause when already paused', () => {
      const mockRecorder = {
        state: 'paused',
        pause: vi.fn(),
        resume: vi.fn(),
      }

      ;(plugin as any).activeRecordings.set('test-call', mockRecorder)

      // Should not throw
      plugin.pauseRecording('test-call')

      // pause() should not be called
      expect(mockRecorder.pause).not.toHaveBeenCalled()
    })

    it('should ignore resume when already recording', () => {
      const mockRecorder = {
        state: 'recording',
        pause: vi.fn(),
        resume: vi.fn(),
      }

      ;(plugin as any).activeRecordings.set('test-call', mockRecorder)

      // Should not throw
      plugin.resumeRecording('test-call')

      // resume() should not be called
      expect(mockRecorder.resume).not.toHaveBeenCalled()
    })

    it('should handle rapid pause/resume/pause calls gracefully', () => {
      const mockRecorder = {
        state: 'recording',
        pause: vi.fn().mockImplementation(function (this: any) {
          this.state = 'paused'
        }),
        resume: vi.fn().mockImplementation(function (this: any) {
          this.state = 'recording'
        }),
      }

      ;(plugin as any).activeRecordings.set('test-call', mockRecorder)

      // Rapid calls
      plugin.pauseRecording('test-call')
      plugin.resumeRecording('test-call')
      plugin.pauseRecording('test-call')

      // Should have been called correct number of times
      expect(mockRecorder.pause).toHaveBeenCalledTimes(2)
      expect(mockRecorder.resume).toHaveBeenCalledTimes(1)
      expect(mockRecorder.state).toBe('paused')
    })

    it('should warn when pausing in invalid state', () => {
      loggerModule.configureLogger({ enabled: true, handler: undefined })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockRecorder = {
        state: 'inactive',
        pause: vi.fn(),
        resume: vi.fn(),
      }

      ;(plugin as any).activeRecordings.set('test-call', mockRecorder)

      plugin.pauseRecording('test-call')

      expect(consoleSpy).toHaveBeenCalled()
      expect(mockRecorder.pause).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
      loggerModule.configureLogger({ enabled: false, handler: undefined })
    })
  })
})
