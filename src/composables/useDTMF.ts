/**
 * DTMF Composable
 *
 * Provides DTMF (Dual-Tone Multi-Frequency) tone sending functionality for
 * active call sessions with support for tone sequences and queue management.
 *
 * @module composables/useDTMF
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { CallSession } from '../core/CallSession'
import type { DTMFOptions } from '../types/call.types'
import { createLogger } from '../utils/logger'
import { DTMF_CONSTANTS } from './constants'

const log = createLogger('useDTMF')

/**
 * DTMF sequence options
 */
export interface DTMFSequenceOptions extends DTMFOptions {
  /** Inter-tone gap in milliseconds (default: 70ms) */
  interToneGap?: number
  /** Callback for each tone sent */
  onToneSent?: (tone: string) => void
  /** Callback when sequence completes */
  onComplete?: () => void
  /** Callback on error */
  onError?: (error: Error, tone: string) => void
}

/**
 * DTMF send result
 */
export interface DTMFSendResult {
  /** Success status */
  success: boolean
  /** Tone that was sent */
  tone: string
  /** Error if failed */
  error?: Error
  /** Timestamp */
  timestamp: Date
}

/**
 * Return type for useDTMF composable
 */
export interface UseDTMFReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** Is currently sending DTMF */
  isSending: Ref<boolean>
  /** Queued tones */
  queuedTones: Ref<string[]>
  /** Last sent tone */
  lastSentTone: Ref<string | null>
  /** Last send result */
  lastResult: Ref<DTMFSendResult | null>
  /** Total tones sent */
  tonesSentCount: Ref<number>
  /** Queue size */
  queueSize: ComputedRef<number>
  /** Is queue empty */
  isQueueEmpty: ComputedRef<boolean>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Send a single DTMF tone */
  sendTone: (tone: string, options?: DTMFOptions) => Promise<void>
  /** Send a sequence of DTMF tones */
  sendToneSequence: (tones: string, options?: DTMFSequenceOptions) => Promise<void>
  /** Queue a tone for sending */
  queueTone: (tone: string) => void
  /** Queue multiple tones for sending */
  queueToneSequence: (tones: string) => void
  /** Process the tone queue */
  processQueue: (options?: DTMFSequenceOptions) => Promise<void>
  /** Clear the tone queue */
  clearQueue: () => void
  /** Stop sending (clear queue and cancel current) */
  stopSending: () => void
  /** Reset statistics */
  resetStats: () => void
}

/**
 * DTMF Composable
 *
 * Manages DTMF tone sending for active call sessions with queue management,
 * tone sequences, and flexible configuration.
 *
 * @param session - Call session instance
 * @returns DTMF state and methods
 *
 * @example
 * ```typescript
 * const {
 *   sendTone,
 *   sendToneSequence,
 *   isSending,
 *   queuedTones
 * } = useDTMF(session)
 *
 * // Send single tone
 * await sendTone('1')
 *
 * // Send sequence
 * await sendToneSequence('1234#', {
 *   duration: 100,
 *   interToneGap: 70,
 *   onToneSent: (tone) => console.log(`Sent: ${tone}`)
 * })
 *
 * // Queue tones
 * queueToneSequence('5678')
 * await processQueue()
 * ```
 */
export function useDTMF(session: Ref<CallSession | null>): UseDTMFReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  const isSending = ref(false)
  const queuedTones = ref<string[]>([])
  const lastSentTone = ref<string | null>(null)
  const lastResult = ref<DTMFSendResult | null>(null)
  const tonesSentCount = ref(0)

  // Cancellation flag
  let isCancelled = false

  // ============================================================================
  // Computed Values
  // ============================================================================

  const queueSize = computed(() => queuedTones.value.length)
  const isQueueEmpty = computed(() => queuedTones.value.length === 0)

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate DTMF tone
   *
   * @param tone - Tone to validate
   * @throws Error if tone is invalid
   */
  const validateTone = (tone: string): void => {
    if (!/^[0-9*#A-D]$/i.test(tone)) {
      throw new Error(`Invalid DTMF tone: ${tone}. Valid tones are 0-9, *, #, A-D`)
    }
  }

  /**
   * Validate tone sequence
   *
   * @param tones - Tones to validate
   * @throws Error if any tone is invalid
   */
  const validateToneSequence = (tones: string): void => {
    for (const tone of tones) {
      validateTone(tone)
    }
  }

  // ============================================================================
  // DTMF Methods
  // ============================================================================

  /**
   * Send a single DTMF tone
   *
   * @param tone - DTMF tone (0-9, *, #, A-D)
   * @param options - DTMF options
   * @throws Error if no active session or tone is invalid
   */
  const sendTone = async (tone: string, options?: DTMFOptions): Promise<void> => {
    if (!session.value) {
      const error = 'No active call session'
      log.error(error)
      throw new Error(error)
    }

    // Validate tone
    validateTone(tone)

    try {
      log.debug(`Sending DTMF tone: ${tone}`)

      isSending.value = true

      // Send via call session
      await session.value.sendDTMF(tone, options)

      // Update state
      lastSentTone.value = tone
      lastResult.value = {
        success: true,
        tone,
        timestamp: new Date(),
      }
      tonesSentCount.value++

      log.debug(`DTMF tone sent: ${tone}`)
    } catch (error) {
      const err = error instanceof Error ? error : new Error('DTMF send failed')
      log.error(`Failed to send DTMF tone ${tone}:`, err)

      lastResult.value = {
        success: false,
        tone,
        error: err,
        timestamp: new Date(),
      }

      throw err
    } finally {
      isSending.value = false
    }
  }

  /**
   * Send a sequence of DTMF tones
   *
   * @param tones - Sequence of tones (e.g., '1234#')
   * @param options - Sequence options
   * @throws Error if no active session or invalid tones
   */
  const sendToneSequence = async (
    tones: string,
    options: DTMFSequenceOptions = {}
  ): Promise<void> => {
    if (!session.value) {
      const error = 'No active call session'
      log.error(error)
      throw new Error(error)
    }

    // Validate all tones
    validateToneSequence(tones)

    const {
      duration = DTMF_CONSTANTS.DEFAULT_DURATION,
      interToneGap = DTMF_CONSTANTS.DEFAULT_INTER_TONE_GAP,
      transport,
      onToneSent,
      onComplete,
      onError,
    } = options

    try {
      log.info(`Sending DTMF sequence: ${tones} (${tones.length} tones)`)

      isSending.value = true
      isCancelled = false

      for (let i = 0; i < tones.length; i++) {
        // Check for cancellation
        if (isCancelled) {
          log.info('DTMF sequence cancelled')
          break
        }

        const tone = tones[i]

        try {
          // Send tone
          await sendTone(tone, { duration, transport })

          // Callback
          if (onToneSent) {
            onToneSent(tone)
          }

          // Wait inter-tone gap (except after last tone)
          if (i < tones.length - 1 && interToneGap > 0) {
            await new Promise((resolve) => setTimeout(resolve, interToneGap))
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Tone send failed')
          log.error(`Failed to send tone ${tone} in sequence:`, err)

          // Callback
          if (onError) {
            onError(err, tone)
          }

          // Re-throw to stop sequence
          throw err
        }
      }

      log.info(`DTMF sequence completed: ${tones}`)

      // Callback
      if (onComplete && !isCancelled) {
        onComplete()
      }
    } catch (error) {
      log.error('DTMF sequence failed:', error)
      throw error
    } finally {
      isSending.value = false
      isCancelled = false
    }
  }

  /**
   * Queue a tone for sending
   *
   * @param tone - DTMF tone
   */
  const queueTone = (tone: string): void => {
    // Validate tone
    validateTone(tone)

    // Enforce queue size limit to prevent unbounded memory growth
    if (queuedTones.value.length >= DTMF_CONSTANTS.MAX_QUEUE_SIZE) {
      log.warn(`DTMF queue full (${DTMF_CONSTANTS.MAX_QUEUE_SIZE} tones), dropping oldest tone`)
      queuedTones.value.shift() // Remove oldest tone
    }

    queuedTones.value.push(tone)
    log.debug(`Queued DTMF tone: ${tone} (queue size: ${queuedTones.value.length})`)
  }

  /**
   * Queue multiple tones for sending
   *
   * @param tones - Sequence of tones
   */
  const queueToneSequence = (tones: string): void => {
    // Validate all tones
    validateToneSequence(tones)

    let newTones = tones.split('')

    // If new sequence itself is longer than max, only keep the last MAX_QUEUE_SIZE tones
    if (newTones.length > DTMF_CONSTANTS.MAX_QUEUE_SIZE) {
      log.warn(
        `DTMF sequence length (${newTones.length}) exceeds limit (${DTMF_CONSTANTS.MAX_QUEUE_SIZE}), ` +
          `keeping only last ${DTMF_CONSTANTS.MAX_QUEUE_SIZE} tones`
      )
      newTones = newTones.slice(-DTMF_CONSTANTS.MAX_QUEUE_SIZE)
    }

    // Enforce queue size limit - drop oldest tones if needed
    const totalAfterAdd = queuedTones.value.length + newTones.length
    if (totalAfterAdd > DTMF_CONSTANTS.MAX_QUEUE_SIZE) {
      const toDrop = totalAfterAdd - DTMF_CONSTANTS.MAX_QUEUE_SIZE
      log.warn(
        `DTMF queue would exceed limit (${DTMF_CONSTANTS.MAX_QUEUE_SIZE}), ` +
          `dropping ${toDrop} oldest tone(s)`
      )
      queuedTones.value.splice(0, toDrop)
    }

    queuedTones.value.push(...newTones)
    log.debug(`Queued DTMF sequence: ${tones} (queue size: ${queuedTones.value.length})`)
  }

  /**
   * Process the tone queue
   *
   * Sends all queued tones in sequence.
   *
   * @param options - Sequence options
   * @throws Error if sending fails
   */
  const processQueue = async (options?: DTMFSequenceOptions): Promise<void> => {
    if (isQueueEmpty.value) {
      log.debug('DTMF queue is empty, nothing to process')
      return
    }

    const tones = queuedTones.value.join('')
    log.info(`Processing DTMF queue: ${tones}`)

    // Clear queue
    queuedTones.value = []

    // Send sequence
    await sendToneSequence(tones, options)
  }

  /**
   * Clear the tone queue
   */
  const clearQueue = (): void => {
    const size = queuedTones.value.length
    queuedTones.value = []
    log.debug(`Cleared DTMF queue (${size} tones removed)`)
  }

  /**
   * Stop sending
   *
   * Cancels current sequence and clears queue.
   */
  const stopSending = (): void => {
    log.info('Stopping DTMF sending')

    // Set cancellation flag
    isCancelled = true

    // Clear queue
    clearQueue()

    // Reset state
    isSending.value = false
  }

  /**
   * Reset statistics
   */
  const resetStats = (): void => {
    tonesSentCount.value = 0
    lastSentTone.value = null
    lastResult.value = null
    log.debug('Reset DTMF statistics')
  }

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    isSending,
    queuedTones,
    lastSentTone,
    lastResult,
    tonesSentCount,
    queueSize,
    isQueueEmpty,

    // Methods
    sendTone,
    sendToneSequence,
    queueTone,
    queueToneSequence,
    processQueue,
    clearQueue,
    stopSending,
    resetStats,
  }
}
