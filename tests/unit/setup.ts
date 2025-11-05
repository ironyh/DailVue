/**
 * Test setup for Vitest unit tests
 */

import { vi } from 'vitest'

// Mock browser APIs that might not be available in the test environment
global.MediaStream = vi.fn() as any
global.RTCPeerConnection = vi.fn() as any
global.RTCSessionDescription = vi.fn() as any
global.RTCIceCandidate = vi.fn() as any

// Setup before all tests
beforeAll(() => {
  // Add any global test setup here
})

// Cleanup after all tests
afterAll(() => {
  // Add any global test cleanup here
})
