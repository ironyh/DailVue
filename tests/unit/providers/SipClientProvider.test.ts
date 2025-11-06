/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SipClientProvider unit tests
 * Tests for Phase 7.1: Provider component implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { SipClientProvider, useSipClientProvider } from '@/providers/SipClientProvider'
import type { SipClientConfig } from '@/types/config.types'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock SipClient
vi.mock('@/core/SipClient', () => ({
  SipClient: vi.fn().mockImplementation((config, eventBus) => ({
    config,
    eventBus,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    unregister: vi.fn().mockResolvedValue(undefined),
    connectionState: 'disconnected',
    registrationState: 'unregistered',
  })),
}))

// Mock EventBus
vi.mock('@/core/EventBus', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}))

// Mock validators
vi.mock('@/utils/validators', () => ({
  validateSipConfig: vi.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
}))

// Mock stores
vi.mock('@/stores/configStore', () => ({
  configStore: {
    setConfig: vi.fn(),
    config: null,
  },
}))

vi.mock('@/stores/registrationStore', () => ({
  registrationStore: {
    setState: vi.fn(),
    setRegisteredUri: vi.fn(),
    setExpiry: vi.fn(),
  },
}))

describe('SipClientProvider - Phase 7.1 Implementation', () => {
  let mockConfig: SipClientConfig

  beforeEach(() => {
    mockConfig = {
      uri: 'wss://sip.example.com:7443',
      sipUri: 'sip:alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Provider Injection', () => {
    it('should provide SIP client context to children', async () => {
      const ChildComponent = defineComponent({
        setup() {
          const context = useSipClientProvider()
          expect(context).toBeDefined()
          expect(context.client).toBeDefined()
          expect(context.eventBus).toBeDefined()
          expect(context.connectionState).toBeDefined()
          expect(context.registrationState).toBeDefined()
          expect(context.isReady).toBeDefined()
          return () => h('div', 'child')
        },
      })

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h(ChildComponent),
        },
      })

      await flushPromises()
    })

    it('should throw error when useSipClientProvider is used outside provider', () => {
      const ChildComponent = defineComponent({
        setup() {
          expect(() => {
            useSipClientProvider()
          }).toThrow('useSipClientProvider() must be called inside a component')
          return () => h('div', 'child')
        },
      })

      mount(ChildComponent)
    })

    it('should provide readonly refs to children', async () => {
      const ChildComponent = defineComponent({
        setup() {
          const context = useSipClientProvider()

          // These should be readonly refs
          expect(context.client).toBeDefined()
          expect(context.connectionState).toBeDefined()

          return () => h('div', 'child')
        },
      })

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h(ChildComponent),
        },
      })

      await flushPromises()
    })
  })

  describe('Configuration Passing', () => {
    it('should initialize SIP client with provided config', async () => {
      const { SipClient } = await import('@/core/SipClient')

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()

      expect(SipClient).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: 'wss://sip.example.com:7443',
          sipUri: 'sip:alice@example.com',
        }),
        expect.anything()
      )
    })

    it('should validate configuration before initializing', async () => {
      const { validateSipConfig } = await import('@/utils/validators')

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()

      expect(validateSipConfig).toHaveBeenCalledWith(mockConfig)
    })

    it('should handle invalid configuration gracefully', async () => {
      const { validateSipConfig } = await import('@/utils/validators')
      vi.mocked(validateSipConfig).mockReturnValueOnce({
        valid: false,
        errors: ['Invalid SIP URI'],
        warnings: [],
      })

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()

      // Should emit error event
      expect(wrapper.emitted('error')).toBeDefined()
      expect(wrapper.emitted('error')?.[0]?.[0]).toBeInstanceOf(Error)
    })
  })

  describe('Lifecycle Management', () => {
    it('should not auto-connect when autoConnect is false', async () => {
      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()

      // Should not emit connected event
      expect(wrapper.emitted('connected')).toBeUndefined()
    })

    it('should auto-connect when autoConnect is true', async () => {
      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: true,
        },
      })

      await flushPromises()

      const { SipClient } = await import('@/core/SipClient')
      const mockInstance = vi.mocked(SipClient).mock.results[0]?.value

      // Should call start()
      expect(mockInstance?.start).toHaveBeenCalled()
    })

    it('should emit error if auto-connect fails', async () => {
      const { SipClient } = await import('@/core/SipClient')

      // Make start() reject
      const mockStart = vi.fn().mockRejectedValue(new Error('Connection failed'))
      vi.mocked(SipClient).mockImplementationOnce((config, eventBus) => ({
        config,
        eventBus,
        start: mockStart,
        stop: vi.fn().mockResolvedValue(undefined),
        register: vi.fn().mockResolvedValue(undefined),
        unregister: vi.fn().mockResolvedValue(undefined),
        connectionState: 'disconnected',
        registrationState: 'unregistered',
      }))

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: true,
        },
      })

      await flushPromises()

      // Should emit error event
      expect(wrapper.emitted('error')).toBeDefined()
    })
  })

  describe('Cleanup', () => {
    it('should cleanup when autoCleanup is true on unmount', async () => {
      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
          autoCleanup: true,
        },
      })

      await flushPromises()

      const { SipClient } = await import('@/core/SipClient')
      const mockInstance = vi.mocked(SipClient).mock.results[0]?.value

      // Unmount
      wrapper.unmount()

      await flushPromises()

      // Should call stop()
      expect(mockInstance?.stop).toHaveBeenCalled()
    })

    it('should not cleanup when autoCleanup is false on unmount', async () => {
      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
          autoCleanup: false,
        },
      })

      await flushPromises()

      const { SipClient } = await import('@/core/SipClient')
      const mockInstance = vi.mocked(SipClient).mock.results[0]?.value

      // Unmount
      wrapper.unmount()

      await flushPromises()

      // Should NOT call stop()
      expect(mockInstance?.stop).not.toHaveBeenCalled()
    })

    it('should handle cleanup errors gracefully', async () => {
      const { SipClient } = await import('@/core/SipClient')

      // Make stop() reject
      const mockStop = vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      vi.mocked(SipClient).mockImplementationOnce((config, eventBus) => ({
        config,
        eventBus,
        start: vi.fn().mockResolvedValue(undefined),
        stop: mockStop,
        register: vi.fn().mockResolvedValue(undefined),
        unregister: vi.fn().mockResolvedValue(undefined),
        connectionState: 'disconnected',
        registrationState: 'unregistered',
      }))

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
          autoCleanup: true,
        },
      })

      await flushPromises()

      // Should not throw on unmount
      expect(() => {
        wrapper.unmount()
      }).not.toThrow()
    })
  })

  describe('Auto-register Behavior', () => {
    it('should auto-register after connecting when autoRegister is true', async () => {
      const mockEventBus = {
        on: vi.fn((event: string, handler: any) => {
          // Simulate connected event
          if (event === 'sip:connected') {
            setTimeout(() => handler(), 0)
          }
        }),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }

      const mockClient = {
        config: mockConfig,
        eventBus: mockEventBus,
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        register: vi.fn().mockResolvedValue(undefined),
        unregister: vi.fn().mockResolvedValue(undefined),
        connectionState: 'disconnected',
        registrationState: 'unregistered',
      }

      const { SipClient } = await import('@/core/SipClient')
      const { EventBus } = await import('@/core/EventBus')

      vi.mocked(EventBus).mockImplementationOnce(() => mockEventBus as any)
      vi.mocked(SipClient).mockImplementationOnce(() => mockClient as any)

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: true,
          autoRegister: true,
        },
      })

      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should call register after connection
      expect(mockClient.register).toHaveBeenCalled()
    })

    it('should not auto-register when autoRegister is false', async () => {
      const mockEventBus = {
        on: vi.fn((event: string, handler: any) => {
          // Simulate connected event
          if (event === 'sip:connected') {
            setTimeout(() => handler(), 0)
          }
        }),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }

      const mockClient = {
        config: mockConfig,
        eventBus: mockEventBus,
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        register: vi.fn().mockResolvedValue(undefined),
        unregister: vi.fn().mockResolvedValue(undefined),
        connectionState: 'disconnected',
        registrationState: 'unregistered',
      }

      const { SipClient } = await import('@/core/SipClient')
      const { EventBus } = await import('@/core/EventBus')

      vi.mocked(EventBus).mockImplementationOnce(() => mockEventBus as any)
      vi.mocked(SipClient).mockImplementationOnce(() => mockClient as any)

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: true,
          autoRegister: false,
        },
      })

      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should NOT call register
      expect(mockClient.register).not.toHaveBeenCalled()

      // Should emit ready immediately after connection (without waiting for registration)
      expect(wrapper.emitted('ready')).toBeDefined()
    })
  })

  describe('Event Handling', () => {
    it('should emit connected event when client connects', async () => {
      const mockEventBus = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'sip:connected') {
            setTimeout(() => handler(), 0)
          }
        }),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }

      const { EventBus } = await import('@/core/EventBus')
      vi.mocked(EventBus).mockImplementationOnce(() => mockEventBus as any)

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(wrapper.emitted('connected')).toBeDefined()
    })

    it('should emit registered event when client registers', async () => {
      const mockEventBus = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'sip:registered') {
            setTimeout(() => handler({ uri: 'sip:alice@example.com' }), 0)
          }
        }),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }

      const { EventBus } = await import('@/core/EventBus')
      vi.mocked(EventBus).mockImplementationOnce(() => mockEventBus as any)

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(wrapper.emitted('registered')).toBeDefined()
      expect(wrapper.emitted('registered')?.[0]?.[0]).toBe('sip:alice@example.com')
    })

    it('should emit ready event when fully initialized', async () => {
      const mockEventBus = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'sip:registered') {
            setTimeout(() => handler({ uri: 'sip:alice@example.com' }), 0)
          }
        }),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }

      const { EventBus } = await import('@/core/EventBus')
      vi.mocked(EventBus).mockImplementationOnce(() => mockEventBus as any)

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(wrapper.emitted('ready')).toBeDefined()
    })

    it('should emit error event on registration failure', async () => {
      const mockEventBus = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'sip:registration_failed') {
            setTimeout(() => handler({ cause: 'Authentication failed' }), 0)
          }
        }),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      }

      const { EventBus } = await import('@/core/EventBus')
      vi.mocked(EventBus).mockImplementationOnce(() => mockEventBus as any)

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(wrapper.emitted('error')).toBeDefined()
      const errorEvent = wrapper.emitted('error')?.[0]?.[0] as Error
      expect(errorEvent?.message).toContain('Authentication failed')
    })
  })

  describe('Render Behavior', () => {
    it('should render child components', () => {
      const ChildComponent = defineComponent({
        setup() {
          return () => h('div', { class: 'test-child' }, 'Child content')
        },
      })

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h(ChildComponent),
        },
      })

      expect(wrapper.find('.test-child').exists()).toBe(true)
      expect(wrapper.text()).toContain('Child content')
    })

    it('should render nothing when no children provided', () => {
      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
      })

      expect(wrapper.element).toBeDefined()
    })

    it('should wrap children in provider container', () => {
      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h('div', 'content'),
        },
      })

      expect(wrapper.find('.sip-client-provider').exists()).toBe(true)
    })
  })

  describe('Provider Improvements - Error and Method Exposure', () => {
    it('should expose error state in provider context', async () => {
      const { validateSipConfig } = await import('@/utils/validators')
      vi.mocked(validateSipConfig).mockReturnValueOnce({
        valid: false,
        errors: ['Test error'],
        warnings: [],
      })

      const ChildComponent = defineComponent({
        setup() {
          const context = useSipClientProvider()
          expect(context.error).toBeDefined()
          return () => h('div', 'child')
        },
      })

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h(ChildComponent),
        },
      })

      await flushPromises()
    })

    it('should expose connect method in provider context', async () => {
      const ChildComponent = defineComponent({
        setup() {
          const context = useSipClientProvider()
          expect(context.connect).toBeDefined()
          expect(typeof context.connect).toBe('function')
          return () => h('div', 'child')
        },
      })

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h(ChildComponent),
        },
      })

      await flushPromises()
    })

    it('should expose disconnect method in provider context', async () => {
      const ChildComponent = defineComponent({
        setup() {
          const context = useSipClientProvider()
          expect(context.disconnect).toBeDefined()
          expect(typeof context.disconnect).toBe('function')
          return () => h('div', 'child')
        },
      })

      mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
        },
        slots: {
          default: () => h(ChildComponent),
        },
      })

      await flushPromises()
    })
  })

  describe('Event Listener Cleanup', () => {
    it('should track and remove event listeners on unmount', async () => {
      const { EventBus } = await import('@/core/EventBus')
      let mockEventBus: any

      vi.mocked(EventBus).mockImplementationOnce(() => {
        mockEventBus = {
          on: vi.fn().mockReturnValue('listener-id-1'),
          off: vi.fn(),
        }
        return mockEventBus
      })

      const wrapper = mount(SipClientProvider, {
        props: {
          config: mockConfig,
          autoConnect: false,
          autoCleanup: true,
        },
      })

      await flushPromises()

      // Should have registered event listeners
      expect(mockEventBus.on).toHaveBeenCalled()

      // Unmount
      wrapper.unmount()
      await flushPromises()

      // Should have removed all event listeners
      expect(mockEventBus.off).toHaveBeenCalled()
    })
  })
})
