/**
 * DTMF (Dual-Tone Multi-Frequency) composable for sending DTMF tones during calls
 *
 * Note: This uses JsSIP's RTCSession type internally. Since JsSIP doesn't export
 * proper TypeScript types, we use 'any' for the session parameter.
 *
 * @module composables/useSipDtmf
 */
import type { Ref } from 'vue'
import type {
  SessionDescriptionHandler,
  RTCRtpSenderWithDTMF,
} from '@/types/media.types'
import { abortableSleep, throwIfAborted } from '@/utils/abortController'

export interface UseSipDtmfReturn {
  sendDtmf: (digit: string) => Promise<void>
  sendDtmfSequence: (digits: string, interval?: number, signal?: AbortSignal) => Promise<void>
}

/**
 * Composable for sending DTMF tones during an active call
 * @param currentSession - Reference to the current JsSIP RTCSession (typed as any due to lack of JsSIP types)
 * @returns Object with sendDtmf and sendDtmfSequence methods
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSipDtmf(currentSession: Ref<any | null>): UseSipDtmfReturn {
  const sendDtmf = async (digit: string) => {
    if (!currentSession.value) {
      throw new Error('No active session')
    }

    // Validate DTMF digit
    if (!/^[0-9*#A-D]$/.test(digit)) {
      throw new Error('Invalid DTMF digit')
    }

    try {
      // Send DTMF via RTP if available
      const sdh = currentSession.value.sessionDescriptionHandler as SessionDescriptionHandler
      const pc = sdh?.peerConnection
      if (pc) {
        const senders = pc.getSenders()
        const audioSender = senders.find((sender: RTCRtpSender) => sender.track?.kind === 'audio')

        if (audioSender && 'dtmf' in audioSender) {
          const dtmfSender = (audioSender as RTCRtpSenderWithDTMF).dtmf
          if (dtmfSender) {
            dtmfSender.insertDTMF(digit, 160, 70)
          }
        }
      }
    } catch (err) {
      throw new Error(`Failed to send DTMF: ${err}`)
    }
  }

  /**
   * Send a sequence of DTMF tones with configurable interval
   * @param digits - String of digits to send (0-9, A-D, *, #)
   * @param interval - Milliseconds between tones (default: 160)
   * @param signal - Optional AbortSignal to cancel the sequence
   * @throws DOMException with name 'AbortError' if aborted
   *
   * @example
   * ```typescript
   * // Basic usage (backward compatible)
   * await sendDtmfSequence('123')
   *
   * // With custom interval
   * await sendDtmfSequence('*789#', 200)
   *
   * // With abort support
   * const controller = new AbortController()
   * const promise = sendDtmfSequence('1234567890', 160, controller.signal)
   * // Later: controller.abort()
   * ```
   */
  const sendDtmfSequence = async (
    digits: string,
    interval = 160,
    signal?: AbortSignal
  ): Promise<void> => {
    // Check if already aborted before starting
    throwIfAborted(signal)

    for (let i = 0; i < digits.length; i++) {
      const digit = digits[i]

      // Send the tone
      await sendDtmf(digit)

      // Wait between tones (except after the last one)
      if (i < digits.length - 1) {
        await abortableSleep(interval, signal)
      }
    }
  }

  return {
    sendDtmf,
    sendDtmfSequence,
  }
}
