// Export all composables
export { useSipConnection } from './composables/useSipConnection'
export type { UseSipConnectionReturn } from './composables/useSipConnection'

export { useSipCall } from './composables/useSipCall'
export type { UseSipCallReturn } from './composables/useSipCall'

export { useSipDtmf } from './composables/useSipDtmf'
export type { UseSipDtmfReturn } from './composables/useSipDtmf'

export { useAudioDevices } from './composables/useAudioDevices'
export type { UseAudioDevicesReturn } from './composables/useAudioDevices'

// Export types
export type { 
  SipConfig, 
  CallSession, 
  CallState, 
  AudioDevice, 
  SipError 
} from './types'
/**
 * DailVue - A headless Vue.js component library for SIP/VoIP applications
 * @packageDocumentation
 */

// Core exports
// export * from './core'

// Composables
// export * from './composables'

// Types
// export * from './types'

// Providers
// export * from './providers'

// Plugins
// export * from './plugins'

// Utils
// export * from './utils'

// Version
export const version = '1.0.0'

// Library initialization
export interface DailVueOptions {
  // Global configuration options will be defined here
}

export function createDailVue(options?: DailVueOptions) {
  // Vue plugin install method will be implemented here
  return {
    install: () => {
      // Plugin installation logic
      console.log('DailVue initialized', options)
    },
  }
}
