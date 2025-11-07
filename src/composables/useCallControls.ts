/**
 * Call Controls Composable
 *
 * Provides advanced call control features including blind/attended transfers,
 * call forwarding, and basic conference management.
 *
 * @module composables/useCallControls
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { CallSession } from '../types/call.types'
import type { SipClient } from '../core/SipClient'
import {
  TransferState,
  TransferType,
  type TransferEvent,
  type TransferProgress,
} from '../types/transfer.types'
import { createLogger } from '../utils/logger'
import { TRANSFER_CONSTANTS } from './constants'
import { type ExtendedCallSession } from './types'

const log = createLogger('useCallControls')

/**
 * Active transfer information
 */
export interface ActiveTransfer {
  /** Transfer ID */
  id: string
  /** Transfer state */
  state: TransferState
  /** Transfer type */
  type: TransferType
  /** Target URI */
  target: string
  /** Call being transferred */
  callId: string
  /** Consultation call ID (for attended transfer) */
  consultationCallId?: string
  /** Initiated timestamp */
  initiatedAt: Date
  /** Completed timestamp */
  completedAt?: Date
  /** Error message (if failed) */
  error?: string
}

/**
 * Return type for useCallControls composable
 */
export interface UseCallControlsReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Active transfer (if any) */
  activeTransfer: Ref<ActiveTransfer | null>
  /** Transfer state */
  transferState: ComputedRef<TransferState>
  /** Whether a transfer is in progress */
  isTransferring: ComputedRef<boolean>
  /** Consultation call for attended transfer */
  consultationCall: Ref<CallSession | null>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Perform blind transfer */
  blindTransfer: (callId: string, targetUri: string, extraHeaders?: string[]) => Promise<void>
  /** Initiate attended transfer (creates consultation call) */
  initiateAttendedTransfer: (callId: string, targetUri: string) => Promise<string>
  /** Complete attended transfer (connect call to consultation call) */
  completeAttendedTransfer: () => Promise<void>
  /** Cancel active transfer */
  cancelTransfer: () => Promise<void>
  /** Forward call to target URI */
  forwardCall: (callId: string, targetUri: string) => Promise<void>
  /** Get transfer progress */
  getTransferProgress: () => TransferProgress | null
  /** Listen for transfer events */
  onTransferEvent: (callback: (event: TransferEvent) => void) => () => void
}

/**
 * Call Controls Composable
 *
 * Provides advanced call control features for SIP calls including blind transfer,
 * attended transfer (with consultation), and call forwarding.
 *
 * @param sipClient - SIP client instance
 * @returns Call control state and methods
 *
 * @example
 * ```typescript
 * const {
 *   blindTransfer,
 *   initiateAttendedTransfer,
 *   completeAttendedTransfer,
 *   isTransferring
 * } = useCallControls(sipClient)
 *
 * // Blind transfer
 * await blindTransfer('call-123', 'sip:transfer-target@domain.com')
 *
 * // Attended transfer
 * const consultationCallId = await initiateAttendedTransfer('call-123', 'sip:consult@domain.com')
 * // ... talk to consultation target ...
 * await completeAttendedTransfer()
 * ```
 */
export function useCallControls(sipClient: Ref<SipClient | null>): UseCallControlsReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  const activeTransfer = ref<ActiveTransfer | null>(null)
  const consultationCall = ref<CallSession | null>(null)
  const transferEventListeners = ref<Array<(event: TransferEvent) => void>>([])

  // ============================================================================
  // Computed Values
  // ============================================================================

  const transferState = computed(() => activeTransfer.value?.state || TransferState.Idle)

  const isTransferring = computed(
    () =>
      transferState.value !== TransferState.Idle &&
      transferState.value !== TransferState.Completed &&
      transferState.value !== TransferState.Failed &&
      transferState.value !== TransferState.Canceled
  )

  // ============================================================================
  // Transfer Event Handling
  // ============================================================================

  /**
   * Emit transfer event
   */
  const emitTransferEvent = (event: TransferEvent): void => {
    log.debug('Transfer event:', event)
    transferEventListeners.value.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        log.error('Error in transfer event listener:', error)
      }
    })
  }

  /**
   * Update transfer state
   */
  const updateTransferState = (state: TransferState, error?: string): void => {
    if (!activeTransfer.value) return

    activeTransfer.value.state = state
    if (error) {
      activeTransfer.value.error = error
    }
    if (
      state === TransferState.Completed ||
      state === TransferState.Failed ||
      state === TransferState.Canceled
    ) {
      activeTransfer.value.completedAt = new Date()
    }

    // Emit event
    emitTransferEvent({
      type: `transfer:${state}`,
      transferId: activeTransfer.value.id,
      state,
      transferType: activeTransfer.value.type,
      target: activeTransfer.value.target,
      callId: activeTransfer.value.callId,
      consultationCallId: activeTransfer.value.consultationCallId,
      timestamp: new Date(),
      error,
    })
  }

  // ============================================================================
  // Blind Transfer
  // ============================================================================

  /**
   * Perform blind transfer
   *
   * Transfers an active call to a target URI without consultation.
   * The call is immediately transferred and the original call is terminated.
   *
   * @param callId - ID of the call to transfer
   * @param targetUri - SIP URI to transfer to
   * @param extraHeaders - Optional custom SIP headers
   * @throws Error if SIP client not initialized or transfer fails
   */
  const blindTransfer = async (
    callId: string,
    targetUri: string,
    extraHeaders?: string[]
  ): Promise<void> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    if (isTransferring.value) {
      throw new Error('Another transfer is already in progress')
    }

    try {
      log.info(`Starting blind transfer of call ${callId} to ${targetUri}`)

      // Create transfer record
      const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      activeTransfer.value = {
        id: transferId,
        state: TransferState.Initiated,
        type: TransferType.Blind,
        target: targetUri,
        callId,
        initiatedAt: new Date(),
      }

      updateTransferState(TransferState.InProgress)

      // Perform blind transfer via SIP client
      // Note: This requires CallSession to have a transfer method
      const call = sipClient.value.getActiveCall(callId) as ExtendedCallSession | undefined
      if (!call) {
        throw new Error(`Call ${callId} not found`)
      }

      // Perform blind transfer
      await call.transfer(targetUri, extraHeaders)

      updateTransferState(TransferState.Completed)
      log.info(`Blind transfer completed successfully`)

      // Clear active transfer after a delay
      setTimeout(() => {
        activeTransfer.value = null
      }, TRANSFER_CONSTANTS.COMPLETION_DELAY)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Blind transfer failed'
      log.error('Blind transfer failed:', errorMessage)
      updateTransferState(TransferState.Failed, errorMessage)
      throw error
    }
  }

  // ============================================================================
  // Attended Transfer
  // ============================================================================

  /**
   * Initiate attended transfer
   *
   * Places the original call on hold and creates a consultation call to the target.
   * Once the consultation is complete, call completeAttendedTransfer() to connect
   * the original call to the consultation target.
   *
   * @param callId - ID of the call to transfer
   * @param targetUri - SIP URI to consult with
   * @returns Consultation call ID
   * @throws Error if SIP client not initialized or transfer fails
   */
  const initiateAttendedTransfer = async (callId: string, targetUri: string): Promise<string> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    if (isTransferring.value) {
      throw new Error('Another transfer is already in progress')
    }

    try {
      log.info(`Starting attended transfer of call ${callId} to ${targetUri}`)

      // Create transfer record
      const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Get original call
      const call = sipClient.value.getActiveCall(callId) as ExtendedCallSession | undefined
      if (!call) {
        throw new Error(`Call ${callId} not found`)
      }

      // Hold the original call
      log.debug('Putting original call on hold')
      await call.hold()

      // Create consultation call
      log.debug('Creating consultation call')
      const consultationCallId = await sipClient.value.makeCall(targetUri, {
        video: false,
      })

      // Get consultation call session
      consultationCall.value =
        (sipClient.value.getActiveCall(consultationCallId) as ExtendedCallSession) || null

      activeTransfer.value = {
        id: transferId,
        state: TransferState.Initiated,
        type: TransferType.Attended,
        target: targetUri,
        callId,
        consultationCallId,
        initiatedAt: new Date(),
      }

      updateTransferState(TransferState.InProgress)

      log.info(`Attended transfer initiated, consultation call: ${consultationCallId}`)
      return consultationCallId
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Attended transfer initiation failed'
      log.error('Attended transfer initiation failed:', errorMessage)

      if (activeTransfer.value) {
        updateTransferState(TransferState.Failed, errorMessage)
      }

      throw error
    }
  }

  /**
   * Complete attended transfer
   *
   * Connects the original call to the consultation call and removes yourself
   * from the conversation.
   *
   * @throws Error if no active attended transfer or completion fails
   */
  const completeAttendedTransfer = async (): Promise<void> => {
    if (!activeTransfer.value || activeTransfer.value.type !== TransferType.Attended) {
      throw new Error('No active attended transfer')
    }

    if (!consultationCall.value) {
      throw new Error('No consultation call found')
    }

    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    try {
      log.info('Completing attended transfer')

      const call = sipClient.value.getActiveCall(activeTransfer.value.callId) as
        | ExtendedCallSession
        | undefined
      if (!call) {
        throw new Error(`Call ${activeTransfer.value.callId} not found`)
      }

      // Perform attended transfer (REFER with Replaces header)
      await call.attendedTransfer(activeTransfer.value.target, consultationCall.value.id)

      updateTransferState(TransferState.Completed)
      log.info('Attended transfer completed successfully')

      // Clear state after a delay
      setTimeout(() => {
        activeTransfer.value = null
        consultationCall.value = null
      }, TRANSFER_CONSTANTS.COMPLETION_DELAY)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Attended transfer completion failed'
      log.error('Attended transfer completion failed:', errorMessage)
      updateTransferState(TransferState.Failed, errorMessage)
      throw error
    }
  }

  /**
   * Cancel active transfer
   *
   * Cancels the current transfer, unholds the original call, and terminates
   * any consultation call.
   *
   * @throws Error if no active transfer
   */
  const cancelTransfer = async (): Promise<void> => {
    if (!activeTransfer.value) {
      throw new Error('No active transfer to cancel')
    }

    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    try {
      log.info('Canceling transfer')

      // If attended transfer, hang up consultation call and unhold original
      if (activeTransfer.value.type === TransferType.Attended) {
        if (consultationCall.value) {
          log.debug('Ending consultation call')
          await consultationCall.value.hangup()
          consultationCall.value = null
        }

        // Unhold original call
        const call = sipClient.value.getActiveCall(activeTransfer.value.callId) as
          | ExtendedCallSession
          | undefined
        if (call) {
          log.debug('Unholding original call')
          await call.unhold()
        }
      }

      updateTransferState(TransferState.Canceled)
      log.info('Transfer canceled')

      // Clear state
      setTimeout(() => {
        activeTransfer.value = null
      }, TRANSFER_CONSTANTS.CANCELLATION_DELAY)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transfer cancellation failed'
      log.error('Transfer cancellation failed:', errorMessage)
      throw error
    }
  }

  // ============================================================================
  // Call Forwarding
  // ============================================================================

  /**
   * Forward call to target URI
   *
   * Similar to blind transfer but typically used for forwarding incoming calls
   * before answering.
   *
   * @param callId - ID of the call to forward
   * @param targetUri - SIP URI to forward to
   * @throws Error if SIP client not initialized or forwarding fails
   */
  const forwardCall = async (callId: string, targetUri: string): Promise<void> => {
    log.info(`Forwarding call ${callId} to ${targetUri}`)

    // Forwarding is essentially a blind transfer
    await blindTransfer(callId, targetUri, ['Diversion: <sip:forwarded>'])
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get transfer progress
   */
  const getTransferProgress = (): TransferProgress | null => {
    if (!activeTransfer.value) {
      return null
    }

    // Calculate progress percentage based on state
    let progress = 0
    switch (activeTransfer.value.state) {
      case TransferState.Idle:
        progress = 0
        break
      case TransferState.Initiated:
        progress = 25
        break
      case TransferState.InProgress:
        progress = 50
        break
      case TransferState.Accepted:
        progress = 75
        break
      case TransferState.Completed:
        progress = 100
        break
      case TransferState.Failed:
      case TransferState.Canceled:
        progress = 0
        break
    }

    return {
      id: activeTransfer.value.id,
      state: activeTransfer.value.state,
      type: activeTransfer.value.type,
      target: activeTransfer.value.target,
      progress,
    }
  }

  /**
   * Listen for transfer events
   */
  const onTransferEvent = (callback: (event: TransferEvent) => void): (() => void) => {
    transferEventListeners.value.push(callback)

    // Return unsubscribe function
    return () => {
      const index = transferEventListeners.value.indexOf(callback)
      if (index !== -1) {
        transferEventListeners.value.splice(index, 1)
      }
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(() => {
    log.debug('Composable unmounting, clearing transfer state')
    activeTransfer.value = null
    consultationCall.value = null
    transferEventListeners.value = []
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    activeTransfer,
    transferState,
    isTransferring,
    consultationCall,

    // Methods
    blindTransfer,
    initiateAttendedTransfer,
    completeAttendedTransfer,
    cancelTransfer,
    forwardCall,
    getTransferProgress,
    onTransferEvent,
  }
}
