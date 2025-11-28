/**
 * useAmi composable unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useAmi } from '@/composables/useAmi'
import { AmiConnectionState, AmiMessageType } from '@/types/ami.types'
import type { AmiConfig, AmiMessage, AmiEventData, AmiPresenceStateChangeEvent } from '@/types/ami.types'

// Mock AmiClient
const mockAmiClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getState: vi.fn().mockReturnValue(AmiConnectionState.Disconnected),
  isConnected: false,
  getPresenceState: vi.fn(),
  setPresenceState: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}

// Store event handlers for simulation
const eventHandlers: Record<string, Function[]> = {}

vi.mock('@/core/AmiClient', () => ({
  createAmiClient: vi.fn(() => {
    // Reset handlers on new client creation
    Object.keys(eventHandlers).forEach(key => delete eventHandlers[key])

    return {
      ...mockAmiClient,
      on: vi.fn((event: string, handler: Function) => {
        if (!eventHandlers[event]) eventHandlers[event] = []
        eventHandlers[event].push(handler)
      }),
      off: vi.fn((event: string, handler: Function) => {
        if (eventHandlers[event]) {
          eventHandlers[event] = eventHandlers[event].filter(h => h !== handler)
        }
      }),
    }
  }),
  AmiClient: vi.fn(),
}))

// Helper to trigger client events
function triggerClientEvent(event: string, ...args: any[]) {
  eventHandlers[event]?.forEach(handler => handler(...args))
}

describe('useAmi', () => {
  let config: AmiConfig

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(eventHandlers).forEach(key => delete eventHandlers[key])

    config = {
      url: 'ws://localhost:8080',
      autoReconnect: true,
    }

    // Reset mock implementations
    mockAmiClient.connect.mockResolvedValue(undefined)
    mockAmiClient.getPresenceState.mockResolvedValue({
      state: 'available',
      subtype: undefined,
      message: undefined,
    })
    mockAmiClient.setPresenceState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have disconnected state initially', () => {
      const { connectionState, isConnected } = useAmi()

      expect(connectionState.value).toBe(AmiConnectionState.Disconnected)
      expect(isConnected.value).toBe(false)
    })

    it('should have empty presence states initially', () => {
      const { presenceStates } = useAmi()

      expect(presenceStates.value.size).toBe(0)
    })

    it('should have default discovered states', () => {
      const { discoveredStates } = useAmi()

      expect(discoveredStates.value.has('available')).toBe(true)
      expect(discoveredStates.value.has('away')).toBe(true)
      expect(discoveredStates.value.has('dnd')).toBe(true)
      expect(discoveredStates.value.has('busy')).toBe(true)
    })

    it('should have no error initially', () => {
      const { error } = useAmi()

      expect(error.value).toBeNull()
    })
  })

  describe('connect', () => {
    it('should connect to AMI', async () => {
      const { connect, connectionState } = useAmi()

      const connectPromise = connect(config)

      // Simulate connection success
      triggerClientEvent('connected')

      await connectPromise
      await nextTick()

      expect(connectionState.value).toBe(AmiConnectionState.Connected)
    })

    it('should set state to Connecting during connection', async () => {
      const { connect, connectionState } = useAmi()

      // Don't await - check intermediate state
      const connectPromise = connect(config)

      expect(connectionState.value).toBe(AmiConnectionState.Connecting)

      // Clean up
      triggerClientEvent('connected')
      await connectPromise
    })

    it('should handle connection errors', async () => {
      const { connect, connectionState, error } = useAmi()

      mockAmiClient.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(connect(config)).rejects.toThrow('Connection failed')

      expect(connectionState.value).toBe(AmiConnectionState.Failed)
      expect(error.value).toBe('Connection failed')
    })

    it('should disconnect existing client before reconnecting', async () => {
      const { connect } = useAmi()

      // First connection
      const connectPromise1 = connect(config)
      triggerClientEvent('connected')
      await connectPromise1

      // Second connection should disconnect first
      const connectPromise2 = connect(config)
      triggerClientEvent('connected')
      await connectPromise2

      expect(mockAmiClient.disconnect).toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('should disconnect from AMI', async () => {
      const { connect, disconnect, connectionState } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      disconnect()

      expect(connectionState.value).toBe(AmiConnectionState.Disconnected)
    })

    it('should clear presence states on disconnect', async () => {
      const { connect, disconnect, presenceStates, getPresenceState } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      // Add a presence state
      await getPresenceState('1000')
      expect(presenceStates.value.size).toBe(1)

      disconnect()

      expect(presenceStates.value.size).toBe(0)
    })
  })

  describe('getPresenceState', () => {
    it('should query presence state', async () => {
      const { connect, getPresenceState, presenceStates } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      mockAmiClient.getPresenceState.mockResolvedValue({
        state: 'available',
        subtype: 'online',
        message: 'In office',
      })

      const state = await getPresenceState('1000')

      expect(state.extension).toBe('1000')
      expect(state.state).toBe('available')
      expect(state.subtype).toBe('online')
      expect(state.message).toBe('In office')
      expect(presenceStates.value.get('1000')).toEqual(state)
    })

    it('should throw if not connected', async () => {
      const { getPresenceState } = useAmi()

      await expect(getPresenceState('1000')).rejects.toThrow('Not connected to AMI')
    })

    it('should discover new states', async () => {
      const { connect, getPresenceState, discoveredStates } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      mockAmiClient.getPresenceState.mockResolvedValue({
        state: 'custom_state',
      })

      await getPresenceState('1000')

      expect(discoveredStates.value.has('custom_state')).toBe(true)
    })
  })

  describe('setPresenceState', () => {
    it('should set presence state', async () => {
      const { connect, setPresenceState, presenceStates } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      await setPresenceState('1000', 'away', 'In a meeting')

      expect(mockAmiClient.setPresenceState).toHaveBeenCalledWith(
        '1000',
        'away',
        { message: 'In a meeting' }
      )

      // Should update local cache
      const cached = presenceStates.value.get('1000')
      expect(cached?.state).toBe('away')
      expect(cached?.message).toBe('In a meeting')
    })

    it('should throw if not connected', async () => {
      const { setPresenceState } = useAmi()

      await expect(setPresenceState('1000', 'away')).rejects.toThrow('Not connected to AMI')
    })
  })

  describe('queryExtensions', () => {
    it('should query multiple extensions', async () => {
      const { connect, queryExtensions } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      mockAmiClient.getPresenceState
        .mockResolvedValueOnce({ state: 'available' })
        .mockResolvedValueOnce({ state: 'away' })
        .mockResolvedValueOnce({ state: 'dnd' })

      const results = await queryExtensions(['1000', '1001', '1002'])

      expect(results.size).toBe(3)
      expect(results.get('1000')?.state).toBe('available')
      expect(results.get('1001')?.state).toBe('away')
      expect(results.get('1002')?.state).toBe('dnd')
    })

    it('should handle partial failures gracefully', async () => {
      const { connect, queryExtensions } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      mockAmiClient.getPresenceState
        .mockResolvedValueOnce({ state: 'available' })
        .mockRejectedValueOnce(new Error('Extension not found'))
        .mockResolvedValueOnce({ state: 'dnd' })

      const results = await queryExtensions(['1000', '9999', '1002'])

      // Should have 2 successful results
      expect(results.size).toBe(2)
      expect(results.get('1000')?.state).toBe('available')
      expect(results.get('1002')?.state).toBe('dnd')
      expect(results.has('9999')).toBe(false)
    })
  })

  describe('event listeners', () => {
    it('should allow registering event listeners', async () => {
      const { connect, onEvent } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      const handler = vi.fn()
      const unsubscribe = onEvent(handler)

      // Simulate an event
      const event: AmiMessage<AmiEventData> = {
        type: AmiMessageType.Event,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: { Event: 'TestEvent' },
      }
      triggerClientEvent('event', event)

      expect(handler).toHaveBeenCalledWith(event)

      // Unsubscribe should work
      unsubscribe()
    })

    it('should allow registering presence change listeners', async () => {
      const { connect, onPresenceChange, presenceStates } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      const handler = vi.fn()
      onPresenceChange(handler)

      // Simulate a presence change event
      const event: AmiMessage<AmiPresenceStateChangeEvent> = {
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
      }
      triggerClientEvent('presenceChange', event)

      expect(handler).toHaveBeenCalled()
      const [ext, state] = handler.mock.calls[0]
      expect(ext).toBe('1000')
      expect(state.state).toBe('away')

      // Should also update presence states
      expect(presenceStates.value.get('1000')?.state).toBe('away')
    })

    it('should discover new states from events', async () => {
      const { connect, onPresenceChange, discoveredStates } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      onPresenceChange(() => {})

      const event: AmiMessage<AmiPresenceStateChangeEvent> = {
        type: AmiMessageType.Event,
        server_id: 1,
        server_name: 'test',
        ssl: false,
        data: {
          Event: 'PresenceStateChange',
          Presentity: 'CustomPresence:1000',
          State: 'CUSTOM_NEW_STATE',
        },
      }
      triggerClientEvent('presenceChange', event)

      expect(discoveredStates.value.has('custom_new_state')).toBe(true)
    })
  })

  describe('getClient', () => {
    it('should return null when not connected', () => {
      const { getClient } = useAmi()

      expect(getClient()).toBeNull()
    })

    it('should return client after connection', async () => {
      const { connect, getClient } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      expect(getClient()).not.toBeNull()
    })
  })

  describe('connection state events', () => {
    it('should update state on disconnected event', async () => {
      const { connect, connectionState } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      expect(connectionState.value).toBe(AmiConnectionState.Connected)

      triggerClientEvent('disconnected', 'Connection lost')

      expect(connectionState.value).toBe(AmiConnectionState.Disconnected)
    })

    it('should update error on error event', async () => {
      const { connect, error } = useAmi()

      const connectPromise = connect(config)
      triggerClientEvent('connected')
      await connectPromise

      triggerClientEvent('error', new Error('Network error'))

      expect(error.value).toBe('Network error')
    })
  })
})
