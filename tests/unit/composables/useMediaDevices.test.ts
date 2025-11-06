/**
 * useMediaDevices composable unit tests
 * Tests for Phase 6.11 improvements: device validation
 */

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMediaDevices } from '@/composables/useMediaDevices'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock device store
vi.mock('@/stores/deviceStore', () => ({
  deviceStore: {
    setSelectedAudioInput: vi.fn(),
    setSelectedAudioOutput: vi.fn(),
    setSelectedVideoInput: vi.fn(),
    setAudioPermission: vi.fn(),
    setVideoPermission: vi.fn(),
    selectedAudioInputId: null,
    selectedAudioOutputId: null,
    selectedVideoInputId: null,
  },
}))

describe('useMediaDevices - Phase 6.11 Device Validation', () => {
  it('should enumerate devices successfully', async () => {
    const mockMediaManager = {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: 'audio-input-1', kind: 'audioinput', label: 'Microphone 1' },
          { deviceId: 'audio-output-1', kind: 'audiooutput', label: 'Speaker 1' },
        ]),
        getUserMedia: vi.fn(),
        getLocalStream: vi.fn(),
      },
    }

    const mediaManagerRef = ref(mockMediaManager.value)
    const { enumerateDevices, audioInputDevices, audioOutputDevices } =
      useMediaDevices(mediaManagerRef)

    await enumerateDevices()

    expect(audioInputDevices.value.length).toBe(1)
    expect(audioOutputDevices.value.length).toBe(1)
  })

  it('should handle device selection without throwing', () => {
    const mockMediaManager = {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn(),
        getLocalStream: vi.fn(),
      },
    }

    const mediaManagerRef = ref(mockMediaManager.value)
    const { selectAudioInput, selectAudioOutput, selectVideoInput } =
      useMediaDevices(mediaManagerRef)

    // Should not throw for any device selection
    expect(() => selectAudioInput('test-device')).not.toThrow()
    expect(() => selectAudioOutput('test-device')).not.toThrow()
    expect(() => selectVideoInput('test-device')).not.toThrow()
  })
})
