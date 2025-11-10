/**
 * Test Setup
 *
 * Global setup for Vitest tests
 */

import { vi } from 'vitest'

// Mock JsSIP globally
vi.mock('jssip', () => {
  const mockUA = {
    start: vi.fn(),
    stop: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    call: vi.fn(),
    sendMessage: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isRegistered: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  }

  return {
    default: {
      UA: vi.fn(function () {
        return mockUA
      }),
      WebSocketInterface: vi.fn(),
      debug: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
    },
  }
})

// Mock WebRTC APIs
if (typeof global.RTCPeerConnection === 'undefined') {
  ;(global as any).RTCPeerConnection = vi.fn().mockImplementation(() => ({
    localDescription: null,
    remoteDescription: null,
    signalingState: 'stable',
    iceConnectionState: 'new',
    connectionState: 'new',
    getSenders: vi.fn().mockReturnValue([]),
    getReceivers: vi.fn().mockReturnValue([]),
    getTransceivers: vi.fn().mockReturnValue([]),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addTransceiver: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({}),
    createAnswer: vi.fn().mockResolvedValue({}),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

if (typeof global.RTCSessionDescription === 'undefined') {
  ;(global as any).RTCSessionDescription = vi.fn().mockImplementation((init: any) => init)
}

if (typeof global.RTCIceCandidate === 'undefined') {
  ;(global as any).RTCIceCandidate = vi.fn().mockImplementation((init: any) => init)
}

// Mock MediaStream
if (typeof global.MediaStream === 'undefined') {
  ;(global as any).MediaStream = vi.fn().mockImplementation(() => ({
    id: 'mock-stream',
    active: true,
    getTracks: vi.fn().mockReturnValue([]),
    getAudioTracks: vi.fn().mockReturnValue([]),
    getVideoTracks: vi.fn().mockReturnValue([]),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Mock navigator.mediaDevices
if (!global.navigator.mediaDevices) {
  ;(global.navigator as any).mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([]),
      getAudioTracks: vi.fn().mockReturnValue([]),
      getVideoTracks: vi.fn().mockReturnValue([]),
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getSupportedConstraints: vi.fn().mockReturnValue({}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof global.URL.createObjectURL === 'undefined') {
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
}

if (typeof global.URL.revokeObjectURL === 'undefined') {
  global.URL.revokeObjectURL = vi.fn()
}

// Mock fetch for analytics tests
if (typeof global.fetch === 'undefined') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({}),
  })
}

// Suppress console output in tests (optional)
// You can comment these out if you want to see console output during tests
if (process.env.VITEST_SILENT !== 'false') {
  global.console.log = vi.fn()
  global.console.debug = vi.fn()
  // Keep warn and error for debugging
  // global.console.warn = vi.fn()
  // global.console.error = vi.fn()
}
