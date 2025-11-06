/**
 * Composable Type Extensions
 *
 * Defines extended interfaces for SipClient and CallSession that composables expect.
 * These represent the ideal API surface that should eventually be implemented in core classes.
 *
 * @module composables/types
 */

import type { CallSession, CallOptions } from '../types/call.types'
import type { SipClientConfig } from '../types/config.types'
import type { PresenceState, PresencePublishOptions, PresenceSubscriptionOptions } from '../types/presence.types'
import type { MessageContentType } from '../types/messaging.types'
import type { ConferenceOptions } from '../types/conference.types'

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
 * Extended SipClient interface with expected methods
 *
 * Note: These methods may not be implemented yet in the actual SipClient class.
 * Composables should check for method existence and provide graceful degradation.
 */
export interface ExtendedSipClient {
  /**
   * Get the current SIP client configuration
   */
  getConfig?(): SipClientConfig

  /**
   * Get an active call session by ID
   * @param callId - Call ID to retrieve
   */
  getActiveCall?(callId: string): ExtendedCallSession | undefined

  /**
   * Make an outgoing call
   * @param target - Target SIP URI
   * @param options - Call options
   * @returns Call ID
   */
  makeCall?(target: string, options?: CallOptions): Promise<string>

  /**
   * Register with SIP server with options
   * @param options - Registration options
   */
  register?(options?: { expires?: number; userAgent?: string }): Promise<void>

  /**
   * Unregister from SIP server
   */
  unregister?(): Promise<void>

  /**
   * Publish presence status
   * @param options - Presence publish options
   */
  publishPresence?(options: {
    state: PresenceState
    statusMessage?: string
    expires?: number
    extraHeaders?: string[]
  }): Promise<void>

  /**
   * Subscribe to another user's presence
   * @param uri - Target URI to subscribe to
   * @param options - Subscription options
   */
  subscribePresence?(
    uri: string,
    options: PresenceSubscriptionOptions & {
      onNotify?: (status: any) => void
    }
  ): Promise<void>

  /**
   * Unsubscribe from user's presence
   * @param uri - Target URI to unsubscribe from
   */
  unsubscribePresence?(uri: string): Promise<void>

  /**
   * Send SIP MESSAGE
   * @param target - Target URI
   * @param content - Message content
   * @param options - Message options
   */
  sendMessage?(
    target: string,
    content: string,
    options?: {
      contentType?: MessageContentType
      extraHeaders?: string[]
    }
  ): Promise<void>

  /**
   * Register incoming message handler
   * @param callback - Handler for incoming messages
   */
  onIncomingMessage?(callback: (from: string, content: string, contentType?: string) => void): void

  /**
   * Register composing indicator handler
   * @param callback - Handler for composing indicators
   */
  onComposingIndicator?(callback: (from: string, isComposing: boolean) => void): void

  /**
   * Create a conference
   * @param conferenceId - Conference ID
   * @param options - Conference options
   */
  createConference?(conferenceId: string, options?: ConferenceOptions): Promise<void>

  /**
   * Join an existing conference
   * @param conferenceUri - Conference URI
   * @param options - Conference options
   */
  joinConference?(conferenceUri: string, options?: ConferenceOptions): Promise<void>

  /**
   * Invite participant to conference
   * @param conferenceId - Conference ID
   * @param uri - Participant URI
   */
  inviteToConference?(conferenceId: string, uri: string): Promise<void>

  /**
   * Remove participant from conference
   * @param conferenceId - Conference ID
   * @param uri - Participant URI
   */
  removeFromConference?(conferenceId: string, uri: string): Promise<void>

  /**
   * Mute participant in conference
   * @param conferenceId - Conference ID
   * @param uri - Participant URI
   */
  muteParticipant?(conferenceId: string, uri: string): Promise<void>

  /**
   * Unmute participant in conference
   * @param conferenceId - Conference ID
   * @param uri - Participant URI
   */
  unmuteParticipant?(conferenceId: string, uri: string): Promise<void>

  /**
   * End conference
   * @param conferenceId - Conference ID
   */
  endConference?(conferenceId: string): Promise<void>

  /**
   * Start conference recording
   * @param conferenceId - Conference ID
   */
  startConferenceRecording?(conferenceId: string): Promise<void>

  /**
   * Stop conference recording
   * @param conferenceId - Conference ID
   */
  stopConferenceRecording?(conferenceId: string): Promise<void>

  /**
   * Get audio levels for conference participants
   * @param conferenceId - Conference ID
   */
  getConferenceAudioLevels?(conferenceId: string): Map<string, number> | undefined

  /**
   * Mute local audio
   */
  muteAudio?(): Promise<void>

  /**
   * Unmute local audio
   */
  unmuteAudio?(): Promise<void>
}

/**
 * Type guard to check if SipClient has a specific method
 */
export function hasSipClientMethod<K extends keyof ExtendedSipClient>(
  client: any,
  method: K
): client is ExtendedSipClient & Required<Pick<ExtendedSipClient, K>> {
  return client && typeof client[method] === 'function'
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

/**
 * Safely call a SipClient method with fallback
 */
export async function safeSipClientCall<K extends keyof ExtendedSipClient>(
  client: any,
  method: K,
  args: any[],
  fallback?: () => Promise<any>
): Promise<any> {
  if (hasSipClientMethod(client, method)) {
    return await (client[method] as any)(...args)
  }

  if (fallback) {
    return await fallback()
  }

  throw new Error(
    `SipClient method '${String(method)}' is not implemented. ` +
      `This feature requires SipClient API updates.`
  )
}

/**
 * Safely call a CallSession method with fallback
 */
export async function safeCallSessionCall<K extends keyof ExtendedCallSession>(
  session: any,
  method: K,
  args: any[],
  fallback?: () => Promise<any>
): Promise<any> {
  if (hasCallSessionMethod(session, method)) {
    return await (session[method] as any)(...args)
  }

  if (fallback) {
    return await fallback()
  }

  throw new Error(
    `CallSession method '${String(method)}' is not implemented. ` +
      `This feature requires CallSession API updates.`
  )
}
