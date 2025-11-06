/**
 * VueSip - A headless Vue.js component library for SIP/VoIP applications
 * @packageDocumentation
 */

// ============================================================================
// Composables
// ============================================================================

// Basic composables
export { useSipConnection } from './composables/useSipConnection'
export type { UseSipConnectionReturn } from './composables/useSipConnection'

export { useSipCall } from './composables/useSipCall'
export type { UseSipCallReturn } from './composables/useSipCall'

export { useSipDtmf } from './composables/useSipDtmf'
export type { UseSipDtmfReturn } from './composables/useSipDtmf'

export { useAudioDevices } from './composables/useAudioDevices'
export type { UseAudioDevicesReturn } from './composables/useAudioDevices'

// Advanced composables (Phase 6 - Improved)
export { useSipRegistration } from './composables/useSipRegistration'
export type { UseSipRegistrationReturn, RegistrationOptions, RegistrationStatistics } from './composables/useSipRegistration'

export { useCallHistory } from './composables/useCallHistory'
export type { UseCallHistoryReturn } from './composables/useCallHistory'

export { useCallControls } from './composables/useCallControls'
export type { UseCallControlsReturn, ActiveTransfer } from './composables/useCallControls'

export { usePresence } from './composables/usePresence'
export type { UsePresenceReturn } from './composables/usePresence'

export { useMessaging } from './composables/useMessaging'
export type { UseMessagingReturn, Conversation } from './composables/useMessaging'

export { useConference } from './composables/useConference'
export type { UseConferenceReturn } from './composables/useConference'

// Composable utilities
export type { ExtendedSipClient, ExtendedCallSession } from './composables/types'
export { hasSipClientMethod, hasCallSessionMethod } from './composables/types'

// ============================================================================
// Types
// ============================================================================

export type {
  SipConfig,
  CallSession,
  CallState,
  AudioDevice,
  SipError
} from './types'
// ============================================================================
// Version
// ============================================================================

export const version = '1.0.0'

// Library initialization
export interface VueSipOptions {
  // Global configuration options will be defined here
}

export function createVueSip(options?: VueSipOptions) {
  // Vue plugin install method will be implemented here
  return {
    install: () => {
      // Plugin installation logic
      console.log('VueSip initialized', options)
    },
  }
}
