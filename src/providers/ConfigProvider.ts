/**
 * Configuration Provider Component
 *
 * Vue component that provides configuration management to its children
 * using Vue's provide/inject pattern.
 *
 * @module providers/ConfigProvider
 *
 * @example
 * ```vue
 * <template>
 *   <ConfigProvider :sip-config="sipConfig">
 *     <YourApp />
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider } from 'vuesip'
 *
 * const sipConfig = {
 *   uri: 'wss://sip.example.com',
 *   sipUri: 'sip:user@example.com',
 *   password: 'secret'
 * }
 * </script>
 * ```
 */

import { defineComponent, provide, computed, watch, type PropType } from 'vue'
import { configStore } from '../stores/configStore'
import { createLogger } from '../utils/logger'
import type { SipClientConfig, MediaConfiguration, UserPreferences } from '../types/config.types'
import type { ConfigProviderContext } from '../types/provider.types'
import { CONFIG_PROVIDER_KEY } from '../types/provider.types'

const logger = createLogger('ConfigProvider')

/**
 * ConfigProvider Component
 *
 * Provides configuration management functionality to all child components
 * through Vue's provide/inject API.
 */
export const ConfigProvider = defineComponent({
  name: 'ConfigProvider',

  props: {
    /**
     * Initial SIP configuration
     */
    sipConfig: {
      type: Object as PropType<SipClientConfig>,
      default: undefined,
    },

    /**
     * Initial media configuration
     */
    mediaConfig: {
      type: Object as PropType<MediaConfiguration>,
      default: undefined,
    },

    /**
     * Initial user preferences
     */
    userPreferences: {
      type: Object as PropType<UserPreferences>,
      default: undefined,
    },

    /**
     * Whether to validate configuration on mount
     * @default true
     */
    validateOnMount: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically merge configuration with existing
     * If true, provided configs will be merged with existing store values
     * If false, provided configs will replace existing values
     * @default false
     */
    autoMerge: {
      type: Boolean,
      default: false,
    },
  },

  setup(props, { slots }) {
    logger.info('ConfigProvider initializing')

    // ============================================================================
    // Initialization
    // ============================================================================

    /**
     * Initialize configuration from props
     */
    const initializeConfig = () => {
      logger.debug('Initializing configuration from props')

      // Handle SIP config
      if (props.sipConfig) {
        if (props.autoMerge && configStore.hasSipConfig) {
          logger.debug('Merging SIP config with existing')
          configStore.updateSipConfig(props.sipConfig, props.validateOnMount)
        } else {
          logger.debug('Setting SIP config')
          configStore.setSipConfig(props.sipConfig, props.validateOnMount)
        }
      }

      // Handle media config
      if (props.mediaConfig) {
        if (props.autoMerge) {
          logger.debug('Merging media config with existing')
          configStore.updateMediaConfig(props.mediaConfig, props.validateOnMount)
        } else {
          logger.debug('Setting media config')
          configStore.setMediaConfig(props.mediaConfig, props.validateOnMount)
        }
      }

      // Handle user preferences
      if (props.userPreferences) {
        if (props.autoMerge) {
          logger.debug('Merging user preferences with existing')
          configStore.updateUserPreferences(props.userPreferences)
        } else {
          logger.debug('Setting user preferences')
          configStore.setUserPreferences(props.userPreferences)
        }
      }

      // Validate all on mount if requested and no individual validations were done
      if (props.validateOnMount && !(props.sipConfig || props.mediaConfig)) {
        const validationResult = configStore.validateAll()
        if (!validationResult.valid) {
          logger.warn('Configuration validation failed on mount', validationResult.errors)
        }
      }
    }

    // Initialize immediately during setup (not in onMounted)
    // This ensures the configuration is available synchronously for tests and consumers
    initializeConfig()

    // ============================================================================
    // Reactive State
    // ============================================================================

    // Create computed refs for reactive state
    const sipConfig = computed(() => configStore.sipConfig)
    const mediaConfig = computed(() => configStore.mediaConfig)
    const userPreferences = computed(() => configStore.userPreferences)
    const hasSipConfig = computed(() => configStore.hasSipConfig)
    const isConfigValid = computed(() => configStore.isConfigValid)
    const lastValidation = computed(() => configStore.lastValidation)

    // ============================================================================
    // Watch for prop changes
    // ============================================================================

    // Watch for SIP config changes
    watch(
      () => props.sipConfig,
      (newConfig) => {
        if (newConfig) {
          logger.debug('SIP config prop changed, updating store')
          if (props.autoMerge && configStore.hasSipConfig) {
            configStore.updateSipConfig(newConfig, props.validateOnMount)
          } else {
            configStore.setSipConfig(newConfig, props.validateOnMount)
          }
        }
      },
      { deep: true }
    )

    // Watch for media config changes
    watch(
      () => props.mediaConfig,
      (newConfig) => {
        if (newConfig) {
          logger.debug('Media config prop changed, updating store')
          if (props.autoMerge) {
            configStore.updateMediaConfig(newConfig, props.validateOnMount)
          } else {
            configStore.setMediaConfig(newConfig, props.validateOnMount)
          }
        }
      },
      { deep: true }
    )

    // Watch for user preferences changes
    watch(
      () => props.userPreferences,
      (newPrefs) => {
        if (newPrefs) {
          logger.debug('User preferences prop changed, updating store')
          if (props.autoMerge) {
            configStore.updateUserPreferences(newPrefs)
          } else {
            configStore.setUserPreferences(newPrefs)
          }
        }
      },
      { deep: true }
    )

    // ============================================================================
    // Provider Context
    // ============================================================================

    /**
     * Configuration provider context
     * This is what child components will receive via inject
     */
    const providerContext: ConfigProviderContext = {
      // Readonly state
      get sipConfig() {
        // Cast away readonly wrapper from Vue reactivity system
        return sipConfig.value as any
      },
      get mediaConfig() {
        return mediaConfig.value
      },
      get userPreferences() {
        return userPreferences.value
      },
      get hasSipConfig() {
        return hasSipConfig.value
      },
      get isConfigValid() {
        return isConfigValid.value
      },
      get lastValidation() {
        return lastValidation.value
      },

      // Methods
      setSipConfig: (config, validate = true) => {
        logger.debug('setSipConfig called via provider context')
        return configStore.setSipConfig(config, validate)
      },

      updateSipConfig: (updates, validate = true) => {
        logger.debug('updateSipConfig called via provider context')
        return configStore.updateSipConfig(updates, validate)
      },

      setMediaConfig: (config, validate = true) => {
        logger.debug('setMediaConfig called via provider context')
        return configStore.setMediaConfig(config, validate)
      },

      updateMediaConfig: (updates, validate = true) => {
        logger.debug('updateMediaConfig called via provider context')
        return configStore.updateMediaConfig(updates, validate)
      },

      setUserPreferences: (preferences) => {
        logger.debug('setUserPreferences called via provider context')
        configStore.setUserPreferences(preferences)
      },

      updateUserPreferences: (updates) => {
        logger.debug('updateUserPreferences called via provider context')
        configStore.updateUserPreferences(updates)
      },

      validateAll: () => {
        logger.debug('validateAll called via provider context')
        return configStore.validateAll()
      },

      reset: () => {
        logger.debug('reset called via provider context')
        configStore.reset()
      },
    }

    // Provide context to children
    provide(CONFIG_PROVIDER_KEY, providerContext)

    logger.info('ConfigProvider initialized successfully')

    // ============================================================================
    // Render
    // ============================================================================

    return () => {
      // Render default slot content
      return slots.default?.()
    }
  },
})

/**
 * Type-safe inject helper for ConfigProvider
 *
 * @throws {Error} If used outside of ConfigProvider
 *
 * @example
 * ```ts
 * import { useConfigProvider } from 'vuesip'
 *
 * const config = useConfigProvider()
 * console.log(config.sipConfig)
 * ```
 */
export function useConfigProvider(): ConfigProviderContext {
  const context = inject(CONFIG_PROVIDER_KEY)

  if (!context) {
    const error = 'useConfigProvider must be used within a ConfigProvider component'
    logger.error(error)
    throw new Error(error)
  }

  return context
}

// Named export for convenience
export { CONFIG_PROVIDER_KEY }

// Import inject after the component definition
import { inject } from 'vue'
