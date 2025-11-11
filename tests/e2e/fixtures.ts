/**
 * E2E Test Fixtures
 *
 * Provides utilities and mocks for E2E testing
 */

import { test as base, Page } from '@playwright/test'

export const APP_URL = '/?test=true' as const

/**
 * Mock SIP server configuration
 */
export interface MockSipServerConfig {
  uri: string
  username: string
  password: string
  autoRegister?: boolean
}

/**
 * Mock media device
 */
export interface MockMediaDevice {
  deviceId: string
  kind: 'audioinput' | 'audiooutput' | 'videoinput'
  label: string
  groupId: string
}

/**
 * Extended test fixtures
 */
export interface TestFixtures {
  /**
   * Configure mock SIP server responses
   */
  mockSipServer: (config?: Partial<MockSipServerConfig>) => Promise<void>

  /**
   * Configure mock media devices
   */
  mockMediaDevices: (devices?: MockMediaDevice[]) => Promise<void>

  /**
   * Simulate incoming call
   */
  simulateIncomingCall: (remoteUri: string) => Promise<void>

  /**
   * Configure SIP settings in the app
   */
  configureSip: (config: MockSipServerConfig) => Promise<void>

  /**
   * Wait for connection state
   */
  waitForConnectionState: (state: 'connected' | 'disconnected') => Promise<void>

  /**
   * Wait for registration state
   */
  waitForRegistrationState: (state: 'registered' | 'unregistered') => Promise<void>
}

/**
 * Default mock media devices
 */
const defaultMockDevices: MockMediaDevice[] = [
  {
    deviceId: 'default-mic',
    kind: 'audioinput',
    label: 'Default Microphone',
    groupId: 'group1',
  },
  {
    deviceId: 'mic-2',
    kind: 'audioinput',
    label: 'External Microphone',
    groupId: 'group2',
  },
  {
    deviceId: 'default-speaker',
    kind: 'audiooutput',
    label: 'Default Speaker',
    groupId: 'group1',
  },
  {
    deviceId: 'speaker-2',
    kind: 'audiooutput',
    label: 'External Speaker',
    groupId: 'group2',
  },
  {
    deviceId: 'default-camera',
    kind: 'videoinput',
    label: 'Default Camera',
    groupId: 'group3',
  },
]

/**
 * SIP response delays (in milliseconds)
 */
const SIP_DELAYS = {
  CONNECTION: 50,
  REGISTER_200: 80,
  INVITE_100: 50,
  INVITE_180: 100,
  INVITE_200: 150,
  BYE_200: 50,
  CANCEL_200: 50,
  ACK_PROCESS: 10,
  OPTIONS_200: 50,
}

/**
 * Parse SIP method from request (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _parseSipMethod(data: string): string | null {
  const lines = data.split('\r\n')
  if (lines.length === 0) return null
  const firstLine = lines[0]
  const parts = firstLine.split(' ')
  return parts.length > 0 ? parts[0] : null
}

/**
 * Extract Call-ID from SIP message (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractCallId(data: string): string {
  const match = data.match(/Call-ID:\s*(.+)/i)
  return match ? match[1].trim() : 'default-call-id'
}

/**
 * Extract CSeq number from SIP message (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractCSeq(data: string): string {
  const match = data.match(/CSeq:\s*(\d+)/i)
  return match ? match[1] : '1'
}

/**
 * Extract branch from Via header (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractBranch(data: string): string {
  const match = data.match(/branch=([^;\s]+)/i)
  return match ? match[1] : 'z9hG4bK123'
}

/**
 * Extract From tag (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractFromTag(data: string): string {
  const match = data.match(/From:.*tag=([^;\s]+)/i)
  return match ? match[1] : '123'
}

/**
 * Extract To URI (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractToUri(data: string): string {
  const match = data.match(/To:\s*<([^>]+)>/i)
  return match ? match[1] : 'sip:destination@example.com'
}

/**
 * Extract From URI (used in injected mock script)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractFromUri(data: string): string {
  const match = data.match(/From:\s*<([^>]+)>/i)
  return match ? match[1] : 'sip:testuser@example.com'
}

/**
 * Mock WebSocket responses with comprehensive SIP support
 */
function mockWebSocketResponses(page: Page) {
  return page.addInitScript(
    ({ delays }: { delays: typeof SIP_DELAYS }) => {
      // Helper functions (injected into page context)
      const parseSipMethod = (data: string): string | null => {
        const lines = data.split('\r\n')
        if (lines.length === 0) return null
        const parts = lines[0].split(' ')
        return parts.length > 0 ? parts[0] : null
      }

      const extractCallId = (data: string): string => {
        const match = data.match(/Call-ID:\s*(.+)/i)
        return match ? match[1].trim() : 'default-call-id'
      }

      const extractCSeq = (data: string): string => {
        const match = data.match(/CSeq:\s*(\d+)/i)
        return match ? match[1] : '1'
      }

      const extractBranch = (data: string): string => {
        const match = data.match(/branch=([^;\s]+)/i)
        return match ? match[1] : 'z9hG4bK123'
      }

      const extractFromTag = (data: string): string => {
        const match = data.match(/From:.*tag=([^;\s]+)/i)
        return match ? match[1] : '123'
      }

      const extractToUri = (data: string): string => {
        const match = data.match(/To:\s*<([^>]+)>/i)
        return match ? match[1] : 'sip:destination@example.com'
      }

      const extractFromUri = (data: string): string => {
        const match = data.match(/From:\s*<([^>]+)>/i)
        return match ? match[1] : 'sip:testuser@example.com'
      }

      // Mock WebSocket implementation
      class MockWebSocket extends EventTarget {
        url: string
        readyState = 0 // CONNECTING
        static CONNECTING = 0
        static OPEN = 1
        static CLOSING = 2
        static CLOSED = 3

        // Track active calls
        private activeCalls = new Map<string, any>()

        constructor(url: string) {
          super()
          this.url = url

          // Simulate connection
          setTimeout(() => {
            this.readyState = 1 // OPEN
            this.dispatchEvent(new Event('open'))
          }, delays.CONNECTION)

          // Store instance globally for incoming call simulation
          ;(window as any).__mockWebSocket = this
        }

        /**
         * Simulate an incoming INVITE from remote party
         */
        simulateIncomingInvite(fromUri: string, toUri: string) {
          if (this.readyState !== 1) return

          const callId = `incoming-call-${Date.now()}`
          const fromTag = `from-${Date.now()}`
          const branch = `z9hG4bK-incoming-${Date.now()}`

          const invite =
            `INVITE ${toUri} SIP/2.0\r\n` +
            `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
            `From: <${fromUri}>;tag=${fromTag}\r\n` +
            `To: <${toUri}>\r\n` +
            `Call-ID: ${callId}\r\n` +
            `CSeq: 1 INVITE\r\n` +
            `Contact: <${fromUri}>\r\n` +
            `Content-Type: application/sdp\r\n` +
            `Content-Length: 200\r\n\r\n` +
            `v=0\r\n` +
            `o=- 123456 654321 IN IP4 192.168.1.1\r\n` +
            `s=Incoming Call\r\n` +
            `c=IN IP4 192.168.1.1\r\n` +
            `t=0 0\r\n` +
            `m=audio 50000 RTP/AVP 0 8 101\r\n` +
            `a=rtpmap:0 PCMU/8000\r\n` +
            `a=rtpmap:8 PCMA/8000\r\n` +
            `a=rtpmap:101 telephone-event/8000\r\n`

          this.dispatchEvent(new MessageEvent('message', { data: invite }))
        }

        send(data: string) {
          if (this.readyState !== 1) return

          const method = parseSipMethod(data)
          const callId = extractCallId(data)
          const cseq = extractCSeq(data)
          const branch = extractBranch(data)
          const fromTag = extractFromTag(data)

          // Handle different SIP methods
          switch (method) {
            case 'REGISTER':
              this.handleRegister(data, callId, cseq, branch, fromTag)
              break
            case 'INVITE':
              this.handleInvite(data, callId, cseq, branch, fromTag)
              break
            case 'BYE':
              this.handleBye(data, callId, cseq, branch)
              break
            case 'CANCEL':
              this.handleCancel(data, callId, cseq, branch)
              break
            case 'ACK':
              this.handleAck(data, callId)
              break
            case 'OPTIONS':
              this.handleOptions(data, callId, cseq, branch)
              break
            case 'UPDATE':
              this.handleUpdate(data, callId, cseq, branch)
              break
            case 'INFO':
              this.handleInfo(data, callId, cseq, branch)
              break
            default:
              console.log('Mock WS: Unhandled SIP method:', method)
          }
        }

        private handleRegister(
          data: string,
          callId: string,
          cseq: string,
          branch: string,
          fromTag: string
        ) {
          setTimeout(() => {
            const fromUri = extractFromUri(data)
            const response =
              `SIP/2.0 200 OK\r\n` +
              `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
              `From: <${fromUri}>;tag=${fromTag}\r\n` +
              `To: <${fromUri}>;tag=server-${Date.now()}\r\n` +
              `Call-ID: ${callId}\r\n` +
              `CSeq: ${cseq} REGISTER\r\n` +
              `Contact: <${fromUri}>;expires=600\r\n` +
              `Content-Length: 0\r\n\r\n`

            this.dispatchEvent(new MessageEvent('message', { data: response }))
          }, delays.REGISTER_200)
        }

        private handleInvite(
          data: string,
          callId: string,
          cseq: string,
          branch: string,
          fromTag: string
        ) {
          const fromUri = extractFromUri(data)
          const toUri = extractToUri(data)
          const toTag = `to-${Date.now()}`

          // Store call info
          this.activeCalls.set(callId, { fromUri, toUri, fromTag, toTag })

          // Send 100 Trying
          setTimeout(() => {
            const trying =
              `SIP/2.0 100 Trying\r\n` +
              `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
              `From: <${fromUri}>;tag=${fromTag}\r\n` +
              `To: <${toUri}>\r\n` +
              `Call-ID: ${callId}\r\n` +
              `CSeq: ${cseq} INVITE\r\n` +
              `Content-Length: 0\r\n\r\n`

            this.dispatchEvent(new MessageEvent('message', { data: trying }))

            // Send 180 Ringing
            setTimeout(() => {
              const ringing =
                `SIP/2.0 180 Ringing\r\n` +
                `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
                `From: <${fromUri}>;tag=${fromTag}\r\n` +
                `To: <${toUri}>;tag=${toTag}\r\n` +
                `Call-ID: ${callId}\r\n` +
                `CSeq: ${cseq} INVITE\r\n` +
                `Content-Length: 0\r\n\r\n`

              this.dispatchEvent(new MessageEvent('message', { data: ringing }))

              // Auto-answer after ringing (optional - can be disabled)
              // Uncomment to auto-answer:
              // setTimeout(() => {
              //   const ok =
              //     `SIP/2.0 200 OK\r\n` +
              //     `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
              //     `From: <${fromUri}>;tag=${fromTag}\r\n` +
              //     `To: <${toUri}>;tag=${toTag}\r\n` +
              //     `Call-ID: ${callId}\r\n` +
              //     `CSeq: ${cseq} INVITE\r\n` +
              //     `Contact: <${toUri}>\r\n` +
              //     `Content-Type: application/sdp\r\n` +
              //     `Content-Length: 0\r\n\r\n`

              //   this.dispatchEvent(new MessageEvent('message', { data: ok }))
              // }, delays.INVITE_200)
            }, delays.INVITE_180 - delays.INVITE_100)
          }, delays.INVITE_100)
        }

        private handleBye(data: string, callId: string, cseq: string, branch: string) {
          setTimeout(() => {
            const callInfo = this.activeCalls.get(callId)
            if (callInfo) {
              const response =
                `SIP/2.0 200 OK\r\n` +
                `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
                `From: <${callInfo.fromUri}>;tag=${callInfo.fromTag}\r\n` +
                `To: <${callInfo.toUri}>;tag=${callInfo.toTag}\r\n` +
                `Call-ID: ${callId}\r\n` +
                `CSeq: ${cseq} BYE\r\n` +
                `Content-Length: 0\r\n\r\n`

              this.dispatchEvent(new MessageEvent('message', { data: response }))
              this.activeCalls.delete(callId)
            }
          }, delays.BYE_200)
        }

        private handleCancel(data: string, callId: string, cseq: string, branch: string) {
          setTimeout(() => {
            const callInfo = this.activeCalls.get(callId)
            if (callInfo) {
              // Send 200 OK for CANCEL
              const cancelOk =
                `SIP/2.0 200 OK\r\n` +
                `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
                `From: <${callInfo.fromUri}>;tag=${callInfo.fromTag}\r\n` +
                `To: <${callInfo.toUri}>\r\n` +
                `Call-ID: ${callId}\r\n` +
                `CSeq: ${cseq} CANCEL\r\n` +
                `Content-Length: 0\r\n\r\n`

              this.dispatchEvent(new MessageEvent('message', { data: cancelOk }))

              // Send 487 Request Terminated for original INVITE
              const inviteCseq = extractCSeq(data)
              const terminated =
                `SIP/2.0 487 Request Terminated\r\n` +
                `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
                `From: <${callInfo.fromUri}>;tag=${callInfo.fromTag}\r\n` +
                `To: <${callInfo.toUri}>;tag=${callInfo.toTag}\r\n` +
                `Call-ID: ${callId}\r\n` +
                `CSeq: ${inviteCseq} INVITE\r\n` +
                `Content-Length: 0\r\n\r\n`

              setTimeout(() => {
                this.dispatchEvent(new MessageEvent('message', { data: terminated }))
                this.activeCalls.delete(callId)
              }, 20)
            }
          }, delays.CANCEL_200)
        }

        private handleAck(data: string, callId: string) {
          // ACK doesn't get a response, just process it
          setTimeout(() => {
            console.log('Mock WS: ACK processed for', callId)
          }, delays.ACK_PROCESS)
        }

        private handleOptions(data: string, callId: string, cseq: string, branch: string) {
          setTimeout(() => {
            const fromUri = extractFromUri(data)
            const toUri = extractToUri(data)
            const fromTag = extractFromTag(data)

            const response =
              `SIP/2.0 200 OK\r\n` +
              `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
              `From: <${fromUri}>;tag=${fromTag}\r\n` +
              `To: <${toUri}>;tag=options-${Date.now()}\r\n` +
              `Call-ID: ${callId}\r\n` +
              `CSeq: ${cseq} OPTIONS\r\n` +
              `Allow: INVITE, ACK, CANCEL, BYE, OPTIONS, INFO, UPDATE\r\n` +
              `Accept: application/sdp\r\n` +
              `Content-Length: 0\r\n\r\n`

            this.dispatchEvent(new MessageEvent('message', { data: response }))
          }, delays.OPTIONS_200)
        }

        private handleUpdate(data: string, callId: string, cseq: string, branch: string) {
          setTimeout(() => {
            const callInfo = this.activeCalls.get(callId)
            if (callInfo) {
              const response =
                `SIP/2.0 200 OK\r\n` +
                `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
                `From: <${callInfo.fromUri}>;tag=${callInfo.fromTag}\r\n` +
                `To: <${callInfo.toUri}>;tag=${callInfo.toTag}\r\n` +
                `Call-ID: ${callId}\r\n` +
                `CSeq: ${cseq} UPDATE\r\n` +
                `Content-Length: 0\r\n\r\n`

              this.dispatchEvent(new MessageEvent('message', { data: response }))
            }
          }, delays.OPTIONS_200)
        }

        private handleInfo(data: string, callId: string, cseq: string, branch: string) {
          setTimeout(() => {
            const callInfo = this.activeCalls.get(callId)
            if (callInfo) {
              const response =
                `SIP/2.0 200 OK\r\n` +
                `Via: SIP/2.0/WS fake;branch=${branch}\r\n` +
                `From: <${callInfo.fromUri}>;tag=${callInfo.fromTag}\r\n` +
                `To: <${callInfo.toUri}>;tag=${callInfo.toTag}\r\n` +
                `Call-ID: ${callId}\r\n` +
                `CSeq: ${cseq} INFO\r\n` +
                `Content-Length: 0\r\n\r\n`

              this.dispatchEvent(new MessageEvent('message', { data: response }))
            }
          }, delays.OPTIONS_200)
        }

        close() {
          this.readyState = 3 // CLOSED
          this.activeCalls.clear()
          this.dispatchEvent(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }))
        }
      }

      // Replace global WebSocket
      ;(window as any).WebSocket = MockWebSocket
    },
    { delays: SIP_DELAYS }
  )
}

/**
 * Mock getUserMedia
 */
function mockGetUserMedia(page: Page, devices: MockMediaDevice[]) {
  return page.addInitScript((devicesJson: string) => {
    const devices = JSON.parse(devicesJson)

    // Mock getUserMedia
    navigator.mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
      console.log('Mock getUserMedia called with:', constraints)

      // Create mock media stream
      const stream = new MediaStream()

      // Add mock audio track if requested
      if (constraints.audio) {
        const audioTrack = {
          id: 'mock-audio-track',
          kind: 'audio' as const,
          label: 'Mock Audio Track',
          enabled: true,
          muted: false,
          readyState: 'live' as const,
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          getSettings: () => ({}),
          getCapabilities: () => ({}),
          getConstraints: () => ({}),
          applyConstraints: async () => {},
          clone: function () {
            return this
          },
          onended: null,
          onmute: null,
          onunmute: null,
          contentHint: '',
        } as any

        stream.addTrack(audioTrack)
      }

      // Add mock video track if requested
      if (constraints.video) {
        const videoTrack = {
          id: 'mock-video-track',
          kind: 'video' as const,
          label: 'Mock Video Track',
          enabled: true,
          muted: false,
          readyState: 'live' as const,
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          getSettings: () => ({}),
          getCapabilities: () => ({}),
          getConstraints: () => ({}),
          applyConstraints: async () => {},
          clone: function () {
            return this
          },
          onended: null,
          onmute: null,
          onunmute: null,
          contentHint: '',
        } as any

        stream.addTrack(videoTrack)
      }

      return stream
    }

    // Mock enumerateDevices
    navigator.mediaDevices.enumerateDevices = async () => {
      return devices.map(
        (d: MockMediaDevice) =>
          ({
            deviceId: d.deviceId,
            kind: d.kind,
            label: d.label,
            groupId: d.groupId,
            toJSON: () => d,
          }) as MediaDeviceInfo
      )
    }
  }, JSON.stringify(devices))
}

/**
 * Mock RTCPeerConnection
 */
function mockRTCPeerConnection(page: Page) {
  return page.addInitScript(() => {
    // Store original RTCPeerConnection
    const _OriginalRTCPeerConnection = window.RTCPeerConnection

    class MockRTCPeerConnection extends EventTarget {
      localDescription: RTCSessionDescription | null = null
      remoteDescription: RTCSessionDescription | null = null
      signalingState: RTCSignalingState = 'stable'
      iceConnectionState: RTCIceConnectionState = 'new'
      connectionState: RTCPeerConnectionState = 'new'
      iceGatheringState: RTCIceGatheringState = 'new'

      constructor(_configuration?: RTCConfiguration) {
        super()
        console.log('Mock RTCPeerConnection created with config:', _configuration)

        // Simulate ICE gathering
        setTimeout(() => {
          this.iceGatheringState = 'complete'
          const event = new Event('icegatheringstatechange')
          this.dispatchEvent(event)
        }, 100)

        // Simulate connection
        setTimeout(() => {
          this.iceConnectionState = 'connected'
          this.connectionState = 'connected'
          this.dispatchEvent(new Event('iceconnectionstatechange'))
          this.dispatchEvent(new Event('connectionstatechange'))
        }, 200)
      }

      async createOffer(_options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
        return {
          type: 'offer',
          sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE audio\r\n',
        }
      }

      async createAnswer(_options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
        return {
          type: 'answer',
          sdp: 'v=0\r\no=- 789 012 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE audio\r\n',
        }
      }

      async setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void> {
        this.localDescription = description as RTCSessionDescription
        this.signalingState = description?.type === 'offer' ? 'have-local-offer' : 'stable'
      }

      async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
        this.remoteDescription = description as RTCSessionDescription
        this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'
      }

      addTrack(_track: MediaStreamTrack, ..._streams: MediaStream[]): RTCRtpSender {
        return {} as RTCRtpSender
      }

      addIceCandidate(_candidate?: RTCIceCandidateInit): Promise<void> {
        return Promise.resolve()
      }

      close(): void {
        this.connectionState = 'closed'
        this.iceConnectionState = 'closed'
      }

      getStats(): Promise<RTCStatsReport> {
        return Promise.resolve(new Map() as RTCStatsReport)
      }

      getSenders(): RTCRtpSender[] {
        return []
      }

      getReceivers(): RTCRtpReceiver[] {
        return []
      }

      getTransceivers(): RTCRtpTransceiver[] {
        return []
      }
    }

    // Replace global RTCPeerConnection
    ;(window as any).RTCPeerConnection = MockRTCPeerConnection
  })
}

/**
 * Extended test with fixtures
 */
export const test = base.extend<TestFixtures>({
  mockSipServer: async ({ page }, use) => {
    await use(async (_config?: Partial<MockSipServerConfig>) => {
      await mockWebSocketResponses(page)
      await mockRTCPeerConnection(page)
    })
  },

  mockMediaDevices: async ({ page }, use) => {
    await use(async (devices?: MockMediaDevice[]) => {
      await mockGetUserMedia(page, devices || defaultMockDevices)
    })
  },

  simulateIncomingCall: async ({ page }, use) => {
    await use(async (remoteUri: string) => {
      // Trigger an incoming INVITE through the mock WebSocket
      await page.evaluate(
        ({ from, to }: { from: string; to: string }) => {
          const mockWs = (window as any).__mockWebSocket
          if (mockWs && typeof mockWs.simulateIncomingInvite === 'function') {
            mockWs.simulateIncomingInvite(from, to)
          } else {
            console.error('Mock WebSocket not found or simulateIncomingInvite not available')
          }
        },
        { from: remoteUri, to: 'sip:testuser@example.com' }
      )
      // Wait a bit for the call to be processed
      await page.waitForTimeout(100)
    })
  },

  configureSip: async ({ page }, use) => {
    await use(async (config: MockSipServerConfig) => {
      // Fill in SIP configuration
      await page.click('[data-testid="settings-button"]')
      await page.fill('[data-testid="sip-uri-input"]', config.username)
      await page.fill('[data-testid="password-input"]', config.password)
      await page.fill('[data-testid="server-uri-input"]', config.uri)
      await page.click('[data-testid="save-settings-button"]')
      await page.click('[data-testid="settings-button"]') // Close settings
    })
  },

  waitForConnectionState: async ({ page }, use) => {
    await use(async (state: 'connected' | 'disconnected') => {
      // Wait for the connection status element to contain the expected text (case-insensitive)
      await page.waitForFunction(
        (expectedState) => {
          const statusElement = document.querySelector('[data-testid="connection-status"]')
          if (!statusElement) return false
          const text = statusElement.textContent || ''
          return text.toLowerCase().includes(expectedState.toLowerCase())
        },
        state,
        { timeout: 10000 }
      )
    })
  },

  waitForRegistrationState: async ({ page }, use) => {
    await use(async (state: 'registered' | 'unregistered') => {
      // Wait for the registration status element to contain the expected text (case-insensitive)
      await page.waitForFunction(
        (expectedState) => {
          const statusElement = document.querySelector('[data-testid="registration-status"]')
          if (!statusElement) return false
          const text = statusElement.textContent || ''
          return text.toLowerCase().includes(expectedState.toLowerCase())
        },
        state,
        { timeout: 10000 }
      )
    })
  },
})

export { expect } from '@playwright/test'
