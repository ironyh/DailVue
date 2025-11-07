/**
 * Test Utilities and Helpers
 *
 * Common utilities for testing VueSip components
 */

import { vi } from 'vitest'
import type { SipClientConfig } from '../../src/types/config.types'
import type { EventBus } from '../../src/core/EventBus'

/**
 * Create a mock SIP client configuration for testing
 */
export function createMockSipConfig(overrides?: Partial<SipClientConfig>): SipClientConfig {
  return {
    uri: 'wss://sip.example.com:7443',
    sipUri: 'sip:testuser@example.com',
    password: 'testpassword',
    displayName: 'Test User',
    authorizationUsername: 'testuser',
    realm: 'example.com',
    userAgent: 'VueSip Test Client',
    debug: false,
    registrationOptions: {
      expires: 600,
      autoRegister: false,
    },
    wsOptions: {
      connectionTimeout: 5000,
      maxReconnectionAttempts: 3,
      reconnectionDelay: 1000,
    },
    ...overrides,
  }
}

/**
 * Create a mock MediaStream for testing
 */
export function createMockMediaStream(options?: {
  audio?: boolean
  video?: boolean
}): MediaStream {
  const tracks: any[] = []

  if (options?.audio !== false) {
    tracks.push({
      kind: 'audio',
      id: 'audio-track-1',
      enabled: true,
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  }

  if (options?.video) {
    tracks.push({
      kind: 'video',
      id: 'video-track-1',
      enabled: true,
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  }

  return {
    id: 'mock-stream-1',
    active: true,
    getTracks: vi.fn().mockReturnValue(tracks),
    getAudioTracks: vi.fn().mockReturnValue(tracks.filter((t) => t.kind === 'audio')),
    getVideoTracks: vi.fn().mockReturnValue(tracks.filter((t) => t.kind === 'video')),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as any
}

/**
 * Create a mock RTCPeerConnection for testing
 */
export function createMockRTCPeerConnection(): RTCPeerConnection {
  return {
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
  } as any
}

/**
 * Create a mock JsSIP User Agent
 */
export function createMockUA() {
  return {
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
    get: vi.fn(),
    set: vi.fn(),
  }
}

/**
 * Create a mock JsSIP RTC Session
 */
export function createMockRTCSession(id: string = 'session-123') {
  return {
    id,
    connection: createMockRTCPeerConnection(),
    localHold: false,
    remoteHold: false,
    direction: 'outgoing',
    local_identity: { uri: { user: 'local', host: 'example.com' } },
    remote_identity: { uri: { user: 'remote', host: 'example.com' } },
    start_time: new Date(),
    end_time: null,
    isInProgress: vi.fn().mockReturnValue(false),
    isEstablished: vi.fn().mockReturnValue(false),
    isEnded: vi.fn().mockReturnValue(false),
    answer: vi.fn(),
    terminate: vi.fn(),
    hold: vi.fn(),
    unhold: vi.fn(),
    renegotiate: vi.fn(),
    refer: vi.fn(),
    sendDTMF: vi.fn(),
    sendInfo: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  }
}

/**
 * Create a mock Plugin Context
 */
export function createMockPluginContext(eventBus: EventBus, overrides?: any) {
  return {
    eventBus,
    version: '1.0.0',
    hooks: {
      register: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  }
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for an event to be emitted
 */
export function waitForEvent(
  eventBus: EventBus,
  eventName: string,
  timeout: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    let timerId: ReturnType<typeof setTimeout> | null = null
    let handler: ((data: any) => void) | null = null

    // Define handler first
    handler = (data: any) => {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      if (handler !== null) {
        eventBus.off(eventName, handler)
        handler = null
      }
      resolve(data)
    }

    // Set up timeout
    timerId = setTimeout(() => {
      timerId = null
      if (handler !== null) {
        eventBus.off(eventName, handler)
        handler = null
      }
      reject(new Error(`Timeout waiting for event: ${eventName}`))
    }, timeout)

    // Register event listener
    eventBus.once(eventName, handler)
  })
}

/**
 * Create a mock event for testing
 */
export function createMockEvent<T = any>(type: string, data?: T) {
  return {
    type,
    data,
    timestamp: new Date(),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
}

/**
 * Setup MediaDevices mock
 */
export function setupMediaDevicesMock(options?: {
  getUserMediaSuccess?: boolean
  enumerateDevicesSuccess?: boolean
  devices?: MediaDeviceInfo[]
}) {
  const mockStream = createMockMediaStream()

  const mockDevices: MediaDeviceInfo[] = options?.devices || [
    {
      deviceId: 'audio-input-1',
      kind: 'audioinput',
      label: 'Default Microphone',
      groupId: 'group-1',
      toJSON: vi.fn(),
    } as any,
    {
      deviceId: 'audio-output-1',
      kind: 'audiooutput',
      label: 'Default Speaker',
      groupId: 'group-1',
      toJSON: vi.fn(),
    } as any,
  ]

  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockImplementation(() => {
      if (options?.getUserMediaSuccess === false) {
        return Promise.reject(new Error('Permission denied'))
      }
      return Promise.resolve(mockStream)
    }),
    enumerateDevices: vi.fn().mockImplementation(() => {
      if (options?.enumerateDevicesSuccess === false) {
        return Promise.reject(new Error('Failed to enumerate devices'))
      }
      return Promise.resolve(mockDevices)
    }),
    getSupportedConstraints: vi.fn().mockReturnValue({
      audio: true,
      video: true,
      echoCancellation: true,
      noiseSuppression: true,
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as any

  return { mockStream, mockDevices }
}

/**
 * Simulate a successful SIP connection
 */
export function simulateSipConnection(mockUA: any, delay: number = 10) {
  mockUA.once.mockImplementation((event: string, handler: Function) => {
    if (event === 'connected') {
      setTimeout(() => handler({ socket: { url: 'wss://test.com' } }), delay)
    }
  })
  mockUA.isConnected.mockReturnValue(true)
}

/**
 * Simulate a successful SIP registration
 */
export function simulateSipRegistration(mockUA: any, delay: number = 10) {
  mockUA.once.mockImplementation((event: string, handler: Function) => {
    if (event === 'registered') {
      setTimeout(() => handler({ response: { getHeader: () => '600' } }), delay)
    }
  })
  mockUA.isRegistered.mockReturnValue(true)
}

/**
 * Simulate a SIP connection failure
 */
export function simulateSipConnectionFailure(mockUA: any, delay: number = 10) {
  mockUA.once.mockImplementation((event: string, handler: Function) => {
    if (event === 'disconnected') {
      setTimeout(() => handler({ code: 1006, reason: 'Connection failed' }), delay)
    }
  })
  mockUA.isConnected.mockReturnValue(false)
}

/**
 * Simulate a SIP registration failure
 */
export function simulateSipRegistrationFailure(mockUA: any, delay: number = 10) {
  mockUA.once.mockImplementation((event: string, handler: Function) => {
    if (event === 'registrationFailed') {
      setTimeout(() => handler({ cause: 'Authentication failed' }), delay)
    }
  })
  mockUA.isRegistered.mockReturnValue(false)
}

/**
 * Simulate an incoming call
 */
export function simulateIncomingCall(mockUA: any, sessionId: string = 'session-123') {
  const mockSession = createMockRTCSession(sessionId)

  let newRTCSessionHandler: Function | null = null

  mockUA.on.mockImplementation((event: string, handler: Function) => {
    if (event === 'newRTCSession') {
      newRTCSessionHandler = handler
    }
  })

  // Trigger the event
  if (newRTCSessionHandler) {
    newRTCSessionHandler({
      session: mockSession,
      originator: 'remote',
      request: {
        from: { uri: { user: 'caller', host: 'example.com' } },
        to: { uri: { user: 'callee', host: 'example.com' } },
      },
    })
  }

  return mockSession
}

/**
 * Simulate call progress states
 */
export function simulateCallProgress(mockSession: any, state: 'progress' | 'accepted' | 'confirmed' | 'ended') {
  const handlers: Record<string, Function> = {}

  mockSession.on.mockImplementation((event: string, handler: Function) => {
    handlers[event] = handler
  })

  // Trigger the appropriate event
  switch (state) {
    case 'progress':
      mockSession.isInProgress.mockReturnValue(true)
      if (handlers['progress']) {
        handlers['progress']({ originator: 'remote' })
      }
      break
    case 'accepted':
      mockSession.isEstablished.mockReturnValue(true)
      if (handlers['accepted']) {
        handlers['accepted']({ originator: 'remote' })
      }
      break
    case 'confirmed':
      mockSession.isEstablished.mockReturnValue(true)
      if (handlers['confirmed']) {
        handlers['confirmed']()
      }
      break
    case 'ended':
      mockSession.isEnded.mockReturnValue(true)
      if (handlers['ended']) {
        handlers['ended']({ originator: 'local', cause: 'Bye' })
      }
      break
  }
}

/**
 * Create a spy for console methods
 */
export function spyOnConsole() {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    restore() {
      this.log.mockRestore()
      this.warn.mockRestore()
      this.error.mockRestore()
      this.info.mockRestore()
      this.debug.mockRestore()
    },
  }
}

/**
 * Assert that an event was emitted
 */
export function assertEventEmitted(
  eventBus: EventBus,
  eventName: string,
  timeoutMs: number = 1000
): Promise<void> {
  return waitForEvent(eventBus, eventName, timeoutMs).then(() => undefined)
}

/**
 * Mock IndexedDB for testing
 */
export function setupIndexedDBMock() {
  class MockIDBDatabase {
    objectStoreNames = {
      contains: vi.fn().mockReturnValue(false),
    }

    transaction = vi.fn((storeNames: string[], mode: string) => ({
      objectStore: vi.fn((name: string) => ({
        add: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
        }),
        get: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          result: null,
        }),
        getAll: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          result: [],
        }),
        count: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          result: 0,
        }),
        delete: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
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

  global.indexedDB = mockIndexedDB as any

  return mockIndexedDB
}

/**
 * Memory leak detection helper
 * Detects potential memory leaks by monitoring heap size
 *
 * @param fn - Function to test for memory leaks
 * @param options - Detection options
 * @returns Promise with memory usage information
 */
export async function detectMemoryLeaks(
  fn: () => Promise<void> | void,
  options: {
    iterations?: number
    threshold?: number // MB
    gcBetweenIterations?: boolean
  } = {}
): Promise<{
  leaked: boolean
  heapBefore: number
  heapAfter: number
  heapDelta: number
  iterations: number
}> {
  const {
    iterations = 100,
    threshold = 10, // 10MB
    gcBetweenIterations = true,
  } = options

  // Force garbage collection if available
  const gc = () => {
    if (global.gc) {
      global.gc()
    }
  }

  // Initial GC
  gc()

  const heapBefore = performance.memory?.usedJSHeapSize || 0

  // Run function multiple times
  for (let i = 0; i < iterations; i++) {
    await fn()
    if (gcBetweenIterations) {
      gc()
    }
  }

  // Final GC
  gc()

  const heapAfter = performance.memory?.usedJSHeapSize || 0
  const heapDelta = heapAfter - heapBefore
  const heapDeltaMB = heapDelta / (1024 * 1024)

  return {
    leaked: heapDeltaMB > threshold,
    heapBefore,
    heapAfter,
    heapDelta,
    iterations,
  }
}

/**
 * Check event bus for listener leaks
 *
 * @param eventBus - Event bus to check
 * @param eventName - Event name to check (optional)
 * @returns Listener count
 */
export function checkEventBusListeners(eventBus: EventBus, eventName?: string): number {
  if (eventName) {
    return eventBus.listenerCount(eventName)
  }
  // Return total listener count across all events
  const allEvents = (eventBus as any)._events || {}
  return Object.keys(allEvents).reduce((total, event) => {
    return total + eventBus.listenerCount(event)
  }, 0)
}

