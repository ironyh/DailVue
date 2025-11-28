/**
 * AmiClient unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AmiClient, createAmiClient, AmiError, AmiErrorCode } from '@/core/AmiClient'
import { AmiConnectionState, AmiMessageType } from '@/types/ami.types'
import type { AmiConfig, AmiMessage, AmiResponseData, AmiEventData } from '@/types/ami.types'

// Mock WebSocket - Store instance for test access
let mockWsInstance: any = null
let wsConstructorCalls = 0

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    mockWsInstance = this
    wsConstructorCalls++
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason } as CloseEvent)
  }

  simulateError(): void {
    this.onerror?.(new Event('error'))
  }

  simulateMessage(data: AmiMessage<any>): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

// Replace global WebSocket with our mock class
vi.stubGlobal('WebSocket', MockWebSocket)

describe('AmiClient', () => {
  let client: AmiClient
  let config: AmiConfig

  beforeEach(() => {
    vi.clearAllMocks()
    // Don't use fake timers globally - they interfere with WebSocket mocks
    // Use vi.useFakeTimers() in specific tests that need them
    mockWsInstance = null
    wsConstructorCalls = 0

    config = {
      url: 'ws://localhost:8080',
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 3,
    }
  })

  afterEach(async () => {
    // Only try to disconnect if client exists and has a ws connection
    try {
      if (client && client.getState() !== AmiConnectionState.Disconnected) {
        client.disconnect()
      }
    } catch {
      // Ignore errors during cleanup
    }
    // Allow any pending promises to settle (e.g., rejected pending actions)
    await new Promise(resolve => setTimeout(resolve, 0))
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create client with default config values', () => {
      client = new AmiClient({ url: 'ws://test.com' })
      expect(client.getState()).toBe(AmiConnectionState.Disconnected)
      expect(client.isConnected).toBe(false)
    })

    it('should accept custom config options', () => {
      client = new AmiClient(config)
      expect(client.getState()).toBe(AmiConnectionState.Disconnected)
    })
  })

  describe('createAmiClient factory', () => {
    it('should create AmiClient instance', () => {
      client = createAmiClient(config)
      expect(client).toBeInstanceOf(AmiClient)
    })
  })

  describe('connect', () => {
    beforeEach(() => {
      client = new AmiClient(config)
    })

    it('should connect to WebSocket', async () => {
      const connectPromise = client.connect()

      // Simulate successful connection
      mockWsInstance?.simulateOpen()

      await connectPromise

      expect(client.isConnected).toBe(true)
      expect(client.getState()).toBe(AmiConnectionState.Connected)
    })

    it('should emit connected event', async () => {
      const connectedHandler = vi.fn()
      client.on('connected', connectedHandler)

      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise

      expect(connectedHandler).toHaveBeenCalled()
    })

    it('should reject on connection error', async () => {
      const connectPromise = client.connect()

      mockWsInstance?.simulateError()

      await expect(connectPromise).rejects.toThrow('WebSocket error during connection')
    })

    it('should not connect if already connected', async () => {
      const connectPromise1 = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise1

      // Try to connect again
      await client.connect()

      // Should only have created one WebSocket
      expect(wsConstructorCalls).toBe(1)
    })

    it('should set state to Connecting during connection', () => {
      client.connect()
      expect(client.getState()).toBe(AmiConnectionState.Connecting)
    })
  })

  describe('disconnect', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should disconnect from WebSocket', () => {
      client.disconnect()

      expect(client.isConnected).toBe(false)
      expect(client.getState()).toBe(AmiConnectionState.Disconnected)
    })

    it('should emit disconnected event', () => {
      const disconnectedHandler = vi.fn()
      client.on('disconnected', disconnectedHandler)

      client.disconnect()

      expect(disconnectedHandler).toHaveBeenCalledWith('Manual disconnect')
    })

    it('should cancel pending actions', async () => {
      // Start an action
      const actionPromise = client.sendAction({ Action: 'Ping' })

      // Disconnect before response
      client.disconnect()

      await expect(actionPromise).rejects.toThrow('Disconnected from AMI')
      try {
        await actionPromise
      } catch (error) {
        expect(error).toBeInstanceOf(AmiError)
        expect((error as AmiError).code).toBe(AmiErrorCode.DISCONNECTED)
      }
    })

    it('should cancel reconnect timer', async () => {
      // This test needs fake timers to verify no reconnect happens
      vi.useFakeTimers()

      const callsBeforeDisconnect = wsConstructorCalls

      // Manual disconnect should not trigger reconnect
      client.disconnect()

      // No reconnect should be scheduled after manual disconnect
      vi.advanceTimersByTime(config.reconnectDelay! + 1000)

      expect(wsConstructorCalls).toBe(callsBeforeDisconnect) // No new connections

      vi.useRealTimers()
    })
  })

  describe('sendAction', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should send action and receive response', async () => {
      const actionPromise = client.sendAction({ Action: 'Ping' })

      // Get the sent message to extract ActionID
      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      // Simulate response
      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
          Ping: 'Pong',
        },
      })

      const response = await actionPromise

      expect(response.data.Response).toBe('Success')
    })

    it('should throw if not connected', async () => {
      client.disconnect()

      await expect(client.sendAction({ Action: 'Ping' })).rejects.toThrow('Not connected to AMI')
      try {
        await client.sendAction({ Action: 'Ping' })
      } catch (error) {
        expect(error).toBeInstanceOf(AmiError)
        expect((error as AmiError).code).toBe(AmiErrorCode.NOT_CONNECTED)
      }
    })

    it('should timeout if no response', async () => {
      // Use a very short real timeout (50ms) instead of fake timers
      const actionPromise = client.sendAction({ Action: 'SlowAction' }, 50)

      // Don't send a response - let it timeout naturally
      await expect(actionPromise).rejects.toThrow('AMI action timeout: SlowAction')

      // Test error type
      try {
        await client.sendAction({ Action: 'SlowAction2' }, 50)
      } catch (error) {
        expect(error).toBeInstanceOf(AmiError)
        expect((error as AmiError).code).toBe(AmiErrorCode.ACTION_TIMEOUT)
      }
    }, 10000)

    it('should use provided ActionID', async () => {
      // Start the action but catch rejection when disconnect happens in afterEach
      const actionPromise = client.sendAction({ Action: 'Test', ActionID: 'custom-id' }).catch(() => {})

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      expect(sentMessage.ActionID).toBe('custom-id')

      // Clean up: respond to the action so we don't have unhandled rejection
      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: { Response: 'Success', ActionID: 'custom-id' },
      })
      await actionPromise
    })

    it('should generate ActionID if not provided', async () => {
      // Start the action but catch rejection when disconnect happens in afterEach
      const actionPromise = client.sendAction({ Action: 'Test' }).catch(() => {})

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      expect(sentMessage.ActionID).toMatch(/^vuesip-\d+-\d+$/)

      // Clean up: respond to the action so we don't have unhandled rejection
      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: { Response: 'Success', ActionID: sentMessage.ActionID },
      })
      await actionPromise
    })
  })

  describe('getPresenceState', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should query presence state', async () => {
      const presencePromise = client.getPresenceState('1000')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
          State: 'AVAILABLE',
          Subtype: 'online',
          Message: 'In office',
        },
      })

      const result = await presencePromise

      expect(result.state).toBe('available')
      expect(result.subtype).toBe('online')
      expect(result.message).toBe('In office')
    })

    it('should throw on error response', async () => {
      const presencePromise = client.getPresenceState('9999')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Error',
          ActionID: actionId,
          Message: 'Extension not found',
        },
      })

      await expect(presencePromise).rejects.toThrow('Extension not found')
    })
  })

  describe('setPresenceState', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should set presence state', async () => {
      const setPromise = client.setPresenceState('1000', 'away', { message: 'BRB' })

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('PresenceStateChange')
      expect(sentMessage.State).toBe('AWAY')
      expect(sentMessage.Message).toBe('BRB')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await setPromise
    })
  })

  describe('event handling', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should emit message event for all messages', () => {
      const messageHandler = vi.fn()
      client.on('message', messageHandler)

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Event,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Event: 'TestEvent',
        },
      })

      expect(messageHandler).toHaveBeenCalled()
    })

    it('should emit event for AMI events', () => {
      const eventHandler = vi.fn()
      client.on('event', eventHandler)

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Event,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Event: 'PeerStatus',
          Peer: 'SIP/1000',
          PeerStatus: 'Registered',
        },
      })

      expect(eventHandler).toHaveBeenCalled()
    })

    it('should emit presenceChange for PresenceStateChange events', () => {
      const presenceHandler = vi.fn()
      client.on('presenceChange', presenceHandler)

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Event,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Event: 'PresenceStateChange',
          Presentity: 'CustomPresence:1000',
          State: 'AWAY',
          Message: 'In a meeting',
        },
      })

      expect(presenceHandler).toHaveBeenCalled()
      const event = presenceHandler.mock.calls[0][0]
      expect(event.data.Presentity).toBe('CustomPresence:1000')
      expect(event.data.State).toBe('AWAY')
    })

    it('should allow removing event listeners', () => {
      const handler = vi.fn()
      client.on('event', handler)
      client.off('event', handler)

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Event,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Event: 'TestEvent',
        },
      })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('auto-reconnection', () => {
    // These tests need special cleanup handling to avoid unhandled rejections
    // during the reconnection process. Using dedicated afterEach.
    afterEach(() => {
      // Clear all timers to prevent reconnection attempts
      vi.clearAllTimers()
      // Force state to disconnected to prevent cleanup issues
      if (client) {
        try {
          // Set onclose to null to prevent reconnection triggers
          if (mockWsInstance) {
            mockWsInstance.onclose = null
          }
          client.disconnect()
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    it('should set state to Reconnecting on unexpected disconnect', async () => {
      client = new AmiClient({ ...config, autoReconnect: true, maxReconnectAttempts: 3 })

      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise

      // Simulate unexpected disconnect
      mockWsInstance?.simulateClose(1006, 'Connection lost')

      expect(client.getState()).toBe(AmiConnectionState.Reconnecting)
    })

    it('should not set Reconnecting state when autoReconnect is false', async () => {
      client = new AmiClient({ ...config, autoReconnect: false })

      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise

      mockWsInstance?.simulateClose()

      // Should go directly to Disconnected, not Reconnecting
      expect(client.getState()).toBe(AmiConnectionState.Disconnected)
    })
  })

  describe('queue operations', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should add member to queue', async () => {
      const addPromise = client.queueAdd('support', 'SIP/1001', {
        memberName: 'Agent 1',
        penalty: 0,
        paused: false,
      })

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('QueueAdd')
      expect(sentMessage.Queue).toBe('support')
      expect(sentMessage.Interface).toBe('SIP/1001')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await addPromise
    })

    it('should remove member from queue', async () => {
      const removePromise = client.queueRemove('support', 'SIP/1001')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('QueueRemove')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await removePromise
    })

    it('should pause queue member', async () => {
      const pausePromise = client.queuePause('support', 'SIP/1001', true, 'Break')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('QueuePause')
      expect(sentMessage.Paused).toBe('true')
      expect(sentMessage.Reason).toBe('Break')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await pausePromise
    })
  })

  describe('channel operations', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should originate call', async () => {
      const originatePromise = client.originate({
        channel: 'PJSIP/1001',
        exten: '1002',
        context: 'from-internal',
        callerId: 'Test <1001>',
      })

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('Originate')
      expect(sentMessage.Channel).toBe('PJSIP/1001')
      expect(sentMessage.Exten).toBe('1002')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
          Channel: 'PJSIP/1001-00000001',
          Uniqueid: '1234567890.1',
        },
      })

      const result = await originatePromise

      expect(result.success).toBe(true)
      expect(result.channel).toBe('PJSIP/1001-00000001')
    })

    it('should hangup channel', async () => {
      const hangupPromise = client.hangupChannel('PJSIP/1001-00000001')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('Hangup')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await hangupPromise
    })
  })

  describe('database operations', () => {
    beforeEach(async () => {
      client = new AmiClient(config)
      const connectPromise = client.connect()
      mockWsInstance?.simulateOpen()
      await connectPromise
    })

    it('should get database value', async () => {
      const getPromise = client.dbGet('contacts', 'user1')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('DBGet')
      expect(sentMessage.Family).toBe('contacts')
      expect(sentMessage.Key).toBe('user1')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
          Val: 'John Doe',
        },
      })

      const result = await getPromise
      expect(result).toBe('John Doe')
    })

    it('should put database value', async () => {
      const putPromise = client.dbPut('contacts', 'user1', 'Jane Doe')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('DBPut')
      expect(sentMessage.Val).toBe('Jane Doe')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await putPromise
    })

    it('should delete database value', async () => {
      const delPromise = client.dbDel('contacts', 'user1')

      const sentMessage = JSON.parse(mockWsInstance!.sentMessages[0])
      const actionId = sentMessage.ActionID

      expect(sentMessage.Action).toBe('DBDel')

      mockWsInstance?.simulateMessage({
        type: AmiMessageType.Response,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Response: 'Success',
          ActionID: actionId,
        },
      })

      await delPromise
    })
  })
})
