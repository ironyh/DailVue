/**
 * Composable Type Extensions
 *
 * Defines extended interfaces for CallSession with optional methods for advanced features.
 * These represent features that may not be fully implemented yet.
 *
 * @module composables/types
 */

import type { CallSession } from '../types/call.types'

/**
 * Extended CallSession interface with transfer capabilities
 *
 * Note: These methods may not be implemented yet in the actual CallSession class.
 * Composables should check for method existence before calling.
 */
export interface ExtendedCallSession extends CallSession {
  /**
   * Perform blind transfer (REFER without consultation)
   * @param targetUri - URI to transfer to
   * @param extraHeaders - Optional SIP headers
   */
  transfer?(targetUri: string, extraHeaders?: string[]): Promise<void>

  /**
   * Perform attended transfer (REFER with Replaces header)
   * @param targetUri - URI to transfer to
   * @param consultationCallId - ID of the consultation call
   */
  attendedTransfer?(targetUri: string, consultationCallId: string): Promise<void>

  /**
   * Put call on hold
   */
  hold?(): Promise<void>

  /**
   * Resume call from hold
   */
  unhold?(): Promise<void>

  /**
   * Hang up the call
   */
  hangup?(): Promise<void>
}

/**
 * Type guard to check if CallSession has a specific method
 */
export function hasCallSessionMethod<K extends keyof ExtendedCallSession>(
  session: any,
  method: K
): session is ExtendedCallSession & Required<Pick<ExtendedCallSession, K>> {
  return session && typeof session[method] === 'function'
}
