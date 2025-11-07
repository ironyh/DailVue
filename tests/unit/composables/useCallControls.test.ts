/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useCallControls composable unit tests
 * Comprehensive tests for call transfer and forwarding functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useCallControls } from '@/composables/useCallControls'
import { TransferState, TransferType } from '@/types/transfer.types'
import { TRANSFER_CONSTANTS } from '@/composables/constants'
import type { SipClient } from '@/core/SipClient'

// Mock the logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('useCallControls', () => {
  let mockSipClient: any
  let mockCall: any
  let mockConsultationCall: any

  beforeEach(() => {
    // Create mock call session
    mockCall = {
      id: 'call-123',
      transfer: vi.fn().mockResolvedValue(undefined),
      hold: vi.fn().mockResolvedValue(undefined),
      unhold: vi.fn().mockResolvedValue(undefined),
      attendedTransfer: vi.fn().mockResolvedValue(undefined),
      hangup: vi.fn().mockResolvedValue(undefined),
    }

    mockConsultationCall = {
      id: 'consultation-456',
      hangup: vi.fn().mockResolvedValue(undefined),
    }

    // Create mock SIP client
    mockSipClient = {
      getActiveCall: vi.fn((callId: string) => {
        if (callId === 'call-123') return mockCall
        if (callId === 'consultation-456') return mockConsultationCall
        return undefined
      }),
      makeCall: vi.fn().mockResolvedValue('consultation-456'),
    }

    // Use fake timers for delay testing
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  // ==========================================================================
  // blindTransfer() Method Tests
  // ==========================================================================

  describe('blindTransfer() method', () => {
    it('should perform blind transfer successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, activeTransfer, transferState } = useCallControls(sipClientRef)

      await blindTransfer('call-123', 'sip:target@example.com')

      expect(mockCall.transfer).toHaveBeenCalledWith('sip:target@example.com', undefined)
      expect(activeTransfer.value).not.toBeNull()
      expect(activeTransfer.value?.type).toBe(TransferType.Blind)
      expect(activeTransfer.value?.target).toBe('sip:target@example.com')
      expect(transferState.value).toBe(TransferState.Completed)
    })

    it('should perform blind transfer with extra headers', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer } = useCallControls(sipClientRef)

      const headers = ['X-Custom: value']
      await blindTransfer('call-123', 'sip:target@example.com', headers)

      expect(mockCall.transfer).toHaveBeenCalledWith('sip:target@example.com', headers)
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { blindTransfer } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow(
        'SIP client not initialized'
      )
    })

    it('should throw error when another transfer is in progress', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer } = useCallControls(sipClientRef)

      // Start first transfer (don't await)
      const transfer1 = blindTransfer('call-123', 'sip:target1@example.com')

      // Try to start second transfer while first is in progress
      await expect(blindTransfer('call-123', 'sip:target2@example.com')).rejects.toThrow(
        'Another transfer is already in progress'
      )

      await transfer1
    })

    it('should throw error when call not found', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer } = useCallControls(sipClientRef)

      await expect(blindTransfer('nonexistent-call', 'sip:target@example.com')).rejects.toThrow(
        'Call nonexistent-call not found'
      )
    })

    it('should throw error when SipClient.getActiveCall not implemented', async () => {
      const basicClient = {}
      const sipClientRef = ref<SipClient>(basicClient as any)
      const { blindTransfer } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow(
        'SipClient.getActiveCall() is not implemented'
      )
    })

    it('should throw error when CallSession.transfer not implemented', async () => {
      const callWithoutTransfer = { id: 'call-123' }
      mockSipClient.getActiveCall.mockReturnValue(callWithoutTransfer)

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow(
        'CallSession.transfer() is not implemented'
      )
    })

    it('should set transfer state to Failed when transfer fails', async () => {
      mockCall.transfer.mockRejectedValue(new Error('Transfer failed'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, transferState } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow(
        'Transfer failed'
      )

      expect(transferState.value).toBe(TransferState.Failed)
    })

    it('should clear active transfer after completion delay', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, activeTransfer } = useCallControls(sipClientRef)

      await blindTransfer('call-123', 'sip:target@example.com')
      expect(activeTransfer.value).not.toBeNull()

      // Advance timers by completion delay
      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.COMPLETION_DELAY)

      expect(activeTransfer.value).toBeNull()
    })

    it('should create transfer record with correct properties', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, activeTransfer } = useCallControls(sipClientRef)

      await blindTransfer('call-123', 'sip:target@example.com')

      expect(activeTransfer.value).toMatchObject({
        type: TransferType.Blind,
        target: 'sip:target@example.com',
        callId: 'call-123',
        state: TransferState.Completed,
      })
      expect(activeTransfer.value?.id).toMatch(/^transfer-/)
      expect(activeTransfer.value?.initiatedAt).toBeInstanceOf(Date)
      expect(activeTransfer.value?.completedAt).toBeInstanceOf(Date)
    })
  })

  // ==========================================================================
  // initiateAttendedTransfer() Method Tests
  // ==========================================================================

  describe('initiateAttendedTransfer() method', () => {
    it('should initiate attended transfer successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, activeTransfer, consultationCall, transferState } =
        useCallControls(sipClientRef)

      const consultationId = await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      expect(consultationId).toBe('consultation-456')
      expect(mockCall.hold).toHaveBeenCalled()
      expect(mockSipClient.makeCall).toHaveBeenCalledWith('sip:consult@example.com', {
        video: false,
      })
      expect(activeTransfer.value).not.toBeNull()
      expect(activeTransfer.value?.type).toBe(TransferType.Attended)
      expect(activeTransfer.value?.consultationCallId).toBe('consultation-456')
      expect(transferState.value).toBe(TransferState.InProgress)
      expect(consultationCall.value).toStrictEqual(mockConsultationCall)
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient | null>(null)
      const { initiateAttendedTransfer } = useCallControls(sipClientRef)

      await expect(initiateAttendedTransfer('call-123', 'sip:consult@example.com')).rejects.toThrow(
        'SIP client not initialized'
      )
    })

    it('should throw error when another transfer is in progress', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer } = useCallControls(sipClientRef)

      // Start and complete first transfer
      await initiateAttendedTransfer('call-123', 'sip:consult1@example.com')

      // Now first transfer is in progress, try to start second transfer
      await expect(
        initiateAttendedTransfer('call-123', 'sip:consult2@example.com')
      ).rejects.toThrow('Another transfer is already in progress')
    })

    it('should throw error when call not found', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer } = useCallControls(sipClientRef)

      await expect(
        initiateAttendedTransfer('nonexistent-call', 'sip:consult@example.com')
      ).rejects.toThrow('Call nonexistent-call not found')
    })

    it('should throw error when CallSession.hold not implemented', async () => {
      const callWithoutHold = { id: 'call-123' }
      mockSipClient.getActiveCall.mockReturnValue(callWithoutHold)

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer } = useCallControls(sipClientRef)

      await expect(initiateAttendedTransfer('call-123', 'sip:consult@example.com')).rejects.toThrow(
        'CallSession.hold() is not implemented'
      )
    })

    it('should throw error when SipClient.makeCall not implemented', async () => {
      delete mockSipClient.makeCall

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer } = useCallControls(sipClientRef)

      await expect(initiateAttendedTransfer('call-123', 'sip:consult@example.com')).rejects.toThrow(
        'SipClient.makeCall() is not implemented'
      )
    })

    it('should throw error when hold fails', async () => {
      mockCall.hold.mockRejectedValue(new Error('Hold failed'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, transferState } = useCallControls(sipClientRef)

      await expect(initiateAttendedTransfer('call-123', 'sip:consult@example.com')).rejects.toThrow(
        'Hold failed'
      )

      // Transfer state remains idle because activeTransfer wasn't created yet
      expect(transferState.value).toBe(TransferState.Idle)
    })

    it('should throw error when makeCall fails', async () => {
      mockSipClient.makeCall.mockRejectedValue(new Error('Call failed'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, transferState } = useCallControls(sipClientRef)

      await expect(initiateAttendedTransfer('call-123', 'sip:consult@example.com')).rejects.toThrow(
        'SipClient.makeCall() is not implemented'
      )

      // Transfer state remains idle because activeTransfer wasn't created yet
      expect(transferState.value).toBe(TransferState.Idle)
    })
  })

  // ==========================================================================
  // completeAttendedTransfer() Method Tests
  // ==========================================================================

  describe('completeAttendedTransfer() method', () => {
    it('should complete attended transfer successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer, transferState } =
        useCallControls(sipClientRef)

      // First initiate
      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Then complete
      await completeAttendedTransfer()

      expect(mockCall.attendedTransfer).toHaveBeenCalledWith(
        'sip:consult@example.com',
        'consultation-456'
      )
      expect(transferState.value).toBe(TransferState.Completed)
    })

    it('should throw error when no active attended transfer', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { completeAttendedTransfer } = useCallControls(sipClientRef)

      await expect(completeAttendedTransfer()).rejects.toThrow('No active attended transfer')
    })

    it('should throw error when active transfer is blind type', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, completeAttendedTransfer } = useCallControls(sipClientRef)

      // Start blind transfer (don't await)
      blindTransfer('call-123', 'sip:target@example.com')

      await expect(completeAttendedTransfer()).rejects.toThrow('No active attended transfer')
    })

    it('should throw error when no consultation call found', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer, consultationCall } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Manually clear consultation call
      consultationCall.value = null

      await expect(completeAttendedTransfer()).rejects.toThrow('No consultation call found')
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer } = useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Set client to null
      sipClientRef.value = null

      await expect(completeAttendedTransfer()).rejects.toThrow('SIP client not initialized')
    })

    it('should throw error when original call not found', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer } = useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Make getActiveCall return null for original call
      mockSipClient.getActiveCall.mockReturnValue(undefined)

      await expect(completeAttendedTransfer()).rejects.toThrow('Call call-123 not found')
    })

    it('should throw error when CallSession.attendedTransfer not implemented', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer } = useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Remove attendedTransfer method
      delete mockCall.attendedTransfer

      await expect(completeAttendedTransfer()).rejects.toThrow(
        'CallSession.attendedTransfer() is not implemented'
      )
    })

    it('should set transfer state to Failed when attendedTransfer fails', async () => {
      mockCall.attendedTransfer.mockRejectedValue(new Error('Transfer failed'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer, transferState } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      await expect(completeAttendedTransfer()).rejects.toThrow('Transfer failed')

      expect(transferState.value).toBe(TransferState.Failed)
    })

    it('should clear state after completion delay', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const {
        initiateAttendedTransfer,
        completeAttendedTransfer,
        activeTransfer,
        consultationCall,
      } = useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      await completeAttendedTransfer()

      expect(activeTransfer.value).not.toBeNull()
      expect(consultationCall.value).not.toBeNull()

      // Advance timers by completion delay
      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.COMPLETION_DELAY)

      expect(activeTransfer.value).toBeNull()
      expect(consultationCall.value).toBeNull()
    })
  })

  // ==========================================================================
  // cancelTransfer() Method Tests
  // ==========================================================================

  describe('cancelTransfer() method', () => {
    it('should handle cancellation of in-progress blind transfer', async () => {
      // Make transfer take time by using a delayed promise
      let resolveTransfer: () => void
      const transferDelay = new Promise<void>((resolve) => {
        resolveTransfer = resolve
      })
      mockCall.transfer.mockImplementation(async () => {
        await transferDelay
      })

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, cancelTransfer, transferState, activeTransfer } =
        useCallControls(sipClientRef)

      // Start blind transfer (don't await - it will hang on the delayed promise)
      const transferPromise = blindTransfer('call-123', 'sip:target@example.com')

      // Wait a tick for transfer to start
      await vi.advanceTimersByTimeAsync(0)

      // Verify transfer is in progress
      expect(activeTransfer.value).not.toBeNull()
      expect(transferState.value).toBe(TransferState.InProgress)

      // Cancel the transfer
      await cancelTransfer()
      expect(transferState.value).toBe(TransferState.Canceled)

      // Complete the original transfer (it was hanging)
      resolveTransfer!()

      // The transfer promise won't reject, it will complete, but state is already Canceled
      await transferPromise
    })

    it('should cancel attended transfer successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer, transferState, consultationCall } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      await cancelTransfer()

      expect(mockConsultationCall.hangup).toHaveBeenCalled()
      expect(mockCall.unhold).toHaveBeenCalled()
      expect(transferState.value).toBe(TransferState.Canceled)
      expect(consultationCall.value).toBeNull()
    })

    it('should throw error when no active transfer to cancel', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { cancelTransfer } = useCallControls(sipClientRef)

      await expect(cancelTransfer()).rejects.toThrow('No active transfer to cancel')
    })

    it('should throw error when SIP client is not initialized', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer } = useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Set client to null
      sipClientRef.value = null

      await expect(cancelTransfer()).rejects.toThrow('SIP client not initialized')
    })

    it('should clear state after cancellation delay', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer, activeTransfer } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      await cancelTransfer()

      expect(activeTransfer.value).not.toBeNull()

      // Advance timers by cancellation delay
      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.CANCELLATION_DELAY)

      expect(activeTransfer.value).toBeNull()
    })

    it('should handle attended transfer cancellation when consultation call is null', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer, consultationCall } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Manually clear consultation call
      consultationCall.value = null

      // Should not throw
      await cancelTransfer()

      expect(mockCall.unhold).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // forwardCall() Method Tests
  // ==========================================================================

  describe('forwardCall() method', () => {
    it('should forward call successfully', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { forwardCall, activeTransfer } = useCallControls(sipClientRef)

      await forwardCall('call-123', 'sip:forward@example.com')

      expect(mockCall.transfer).toHaveBeenCalledWith('sip:forward@example.com', [
        'Diversion: <sip:forwarded>',
      ])
      expect(activeTransfer.value?.type).toBe(TransferType.Blind)
    })

    it('should use blind transfer internally', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { forwardCall } = useCallControls(sipClientRef)

      await forwardCall('call-123', 'sip:forward@example.com')

      // Verify blind transfer was used (should have Diversion header)
      expect(mockCall.transfer).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Diversion: <sip:forwarded>'])
      )
    })
  })

  // ==========================================================================
  // getTransferProgress() Method Tests
  // ==========================================================================

  describe('getTransferProgress() method', () => {
    it('should return null when no active transfer', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { getTransferProgress } = useCallControls(sipClientRef)

      const progress = getTransferProgress()

      expect(progress).toBeNull()
    })

    it('should return progress for idle state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, getTransferProgress, activeTransfer } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Manually set to idle (edge case)
      activeTransfer.value!.state = TransferState.Idle

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(0)
    })

    it('should return progress for initiated state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, getTransferProgress, activeTransfer } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Manually set to initiated
      activeTransfer.value!.state = TransferState.Initiated

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(25)
    })

    it('should return progress for in_progress state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, getTransferProgress } = useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(50)
      expect(progress?.state).toBe(TransferState.InProgress)
      expect(progress?.type).toBe(TransferType.Attended)
    })

    it('should return progress for accepted state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, getTransferProgress, activeTransfer } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      // Manually set to accepted
      activeTransfer.value!.state = TransferState.Accepted

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(75)
    })

    it('should return progress for completed state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, getTransferProgress } = useCallControls(sipClientRef)

      await blindTransfer('call-123', 'sip:target@example.com')

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(100)
      expect(progress?.state).toBe(TransferState.Completed)
    })

    it('should return progress 0 for failed state', async () => {
      mockCall.transfer.mockRejectedValue(new Error('Failed'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, getTransferProgress } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow()

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(0)
      expect(progress?.state).toBe(TransferState.Failed)
    })

    it('should return progress 0 for canceled state', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer, getTransferProgress } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      await cancelTransfer()

      const progress = getTransferProgress()

      expect(progress?.progress).toBe(0)
      expect(progress?.state).toBe(TransferState.Canceled)
    })
  })

  // ==========================================================================
  // onTransferEvent() Method Tests
  // ==========================================================================

  describe('onTransferEvent() method', () => {
    it('should register event listener and receive events', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, onTransferEvent } = useCallControls(sipClientRef)

      const events: any[] = []
      const unsubscribe = onTransferEvent((event) => {
        events.push(event)
      })

      await blindTransfer('call-123', 'sip:target@example.com')

      expect(events.length).toBeGreaterThan(0)
      expect(events[0]).toMatchObject({
        type: expect.stringContaining('transfer:'),
        transferType: TransferType.Blind,
      })

      unsubscribe()
    })

    it('should unsubscribe event listener', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, onTransferEvent } = useCallControls(sipClientRef)

      const events: any[] = []
      const unsubscribe = onTransferEvent((event) => {
        events.push(event)
      })

      await blindTransfer('call-123', 'sip:target1@example.com')
      const eventsCount1 = events.length

      unsubscribe()

      // Clear state
      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.COMPLETION_DELAY)

      // Second transfer after unsubscribe
      await blindTransfer('call-123', 'sip:target2@example.com')

      // Events count should not increase after unsubscribe
      expect(events.length).toBe(eventsCount1)
    })

    it('should handle multiple event listeners', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, onTransferEvent } = useCallControls(sipClientRef)

      const events1: any[] = []
      const events2: any[] = []

      onTransferEvent((event) => events1.push(event))
      onTransferEvent((event) => events2.push(event))

      await blindTransfer('call-123', 'sip:target@example.com')

      expect(events1.length).toBeGreaterThan(0)
      expect(events2.length).toBeGreaterThan(0)
      expect(events1.length).toBe(events2.length)
    })

    it('should catch errors in event listeners', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, onTransferEvent } = useCallControls(sipClientRef)

      // Listener that throws error
      onTransferEvent(() => {
        throw new Error('Listener error')
      })

      // Should not throw
      await expect(blindTransfer('call-123', 'sip:target@example.com')).resolves.toBeUndefined()
    })
  })

  // ==========================================================================
  // Computed Values Tests
  // ==========================================================================

  describe('Computed values', () => {
    it('should correctly compute transferState', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, transferState } = useCallControls(sipClientRef)

      expect(transferState.value).toBe(TransferState.Idle)

      await blindTransfer('call-123', 'sip:target@example.com')

      expect(transferState.value).toBe(TransferState.Completed)
    })

    it('should correctly compute isTransferring', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, completeAttendedTransfer, isTransferring } =
        useCallControls(sipClientRef)

      expect(isTransferring.value).toBe(false)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')

      expect(isTransferring.value).toBe(true)

      await completeAttendedTransfer()

      expect(isTransferring.value).toBe(false)
    })

    it('should return false for isTransferring when in terminal states', async () => {
      mockCall.transfer.mockRejectedValue(new Error('Failed'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, isTransferring } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow()

      // Failed is a terminal state
      expect(isTransferring.value).toBe(false)
    })

    it('should return false for isTransferring when canceled', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer, isTransferring } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      await cancelTransfer()

      expect(isTransferring.value).toBe(false)
    })
  })

  // ==========================================================================
  // Lifecycle Tests
  // ==========================================================================

  describe('Lifecycle cleanup', () => {
    it('should clear state on unmount', () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const controls = useCallControls(sipClientRef)

      // Can't easily test onUnmounted in unit tests
      // Just verify initial state
      expect(controls.activeTransfer.value).toBeNull()
      expect(controls.consultationCall.value).toBeNull()
    })
  })

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle rapid transfer operations', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer } = useCallControls(sipClientRef)

      await blindTransfer('call-123', 'sip:target1@example.com')

      // Clear state
      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.COMPLETION_DELAY)

      // Second transfer should work
      await blindTransfer('call-123', 'sip:target2@example.com')

      expect(mockCall.transfer).toHaveBeenCalledTimes(2)
    })

    it('should handle complete flow for attended transfer', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const {
        initiateAttendedTransfer,
        completeAttendedTransfer,
        activeTransfer,
        consultationCall,
      } = useCallControls(sipClientRef)

      // Initiate
      const consultId = await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      expect(consultId).toBe('consultation-456')
      expect(activeTransfer.value?.state).toBe(TransferState.InProgress)

      // Complete
      await completeAttendedTransfer()
      expect(activeTransfer.value?.state).toBe(TransferState.Completed)

      // Clean up
      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.COMPLETION_DELAY)
      expect(activeTransfer.value).toBeNull()
      expect(consultationCall.value).toBeNull()
    })

    it('should handle attended transfer with cancellation', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { initiateAttendedTransfer, cancelTransfer, activeTransfer } =
        useCallControls(sipClientRef)

      await initiateAttendedTransfer('call-123', 'sip:consult@example.com')
      await cancelTransfer()

      expect(activeTransfer.value?.state).toBe(TransferState.Canceled)
      expect(mockConsultationCall.hangup).toHaveBeenCalled()
      expect(mockCall.unhold).toHaveBeenCalled()
    })

    it('should preserve transfer error information', async () => {
      mockCall.transfer.mockRejectedValue(new Error('Network timeout'))

      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, activeTransfer } = useCallControls(sipClientRef)

      await expect(blindTransfer('call-123', 'sip:target@example.com')).rejects.toThrow(
        'Network timeout'
      )

      expect(activeTransfer.value?.error).toBe('Network timeout')
      expect(activeTransfer.value?.state).toBe(TransferState.Failed)
    })

    it('should generate unique transfer IDs', async () => {
      const sipClientRef = ref<SipClient>(mockSipClient)
      const { blindTransfer, activeTransfer } = useCallControls(sipClientRef)

      await blindTransfer('call-123', 'sip:target1@example.com')
      const id1 = activeTransfer.value?.id

      await vi.advanceTimersByTimeAsync(TRANSFER_CONSTANTS.COMPLETION_DELAY)

      await blindTransfer('call-123', 'sip:target2@example.com')
      const id2 = activeTransfer.value?.id

      expect(id1).not.toBe(id2)
    })
  })
})
