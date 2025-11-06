/**
 * VueSip Provider Components
 *
 * Vue components that use provide/inject to share functionality with child components.
 *
 * @module providers
 */

export {
  SipClientProvider,
  useSipClientProvider,
  SipClientProviderKey,
  type SipClientProviderContext,
} from './SipClientProvider'
export { ConfigProvider, useConfigProvider, CONFIG_PROVIDER_KEY } from './ConfigProvider'
export { MediaProvider, useMediaProvider, MEDIA_PROVIDER_KEY } from './MediaProvider'
export type {
  ConfigProviderContext,
  ConfigProviderProps,
  MediaProviderContext,
  MediaProviderProps,
} from '../types/provider.types'
