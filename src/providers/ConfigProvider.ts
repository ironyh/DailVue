/**
 * Configuration Provider Component
 *
 * Vue component that provides centralized configuration management to its children
 * using Vue's provide/inject pattern. Handles SIP, media, and user preference configuration
 * with validation, merging strategies, and reactive updates.
 *
 * @module providers/ConfigProvider
 *
 * @remarks
 * The ConfigProvider manages all application configuration in a centralized, type-safe manner:
 *
 * **Configuration Types:**
 * 1. **SIP Configuration**: WebSocket URI, credentials, user agent settings
 * 2. **Media Configuration**: Audio/video constraints, device preferences, codec settings
 * 3. **User Preferences**: UI settings, notification preferences, call behavior
 *
 * **Configuration Lifecycle:**
 * 1. Initial configuration from props (during component setup)
 * 2. Optional validation on mount (validates required fields and formats)
 * 3. Reactive prop watching (updates configuration when props change)
 * 4. Merge or replace strategies (controlled by `autoMerge` prop)
 * 5. Runtime updates via injected methods
 * 6. Automatic cleanup on unmount
 *
 * **Configuration Hierarchy and Merging:**
 * - **Replace Mode** (`autoMerge=false`, default): Props completely replace existing configuration
 * - **Merge Mode** (`autoMerge=true`): Props are deep-merged with existing configuration
 * - Runtime updates via methods: Always merge with existing configuration
 * - Precedence: Runtime updates > Prop updates > Initial prop values > Store defaults
 *
 * **Validation Approach:**
 * - **On Mount**: Validates if `validateOnMount=true` (default)
 * - **On Updates**: Validates when using set/update methods with `validate=true`
 * - **Manual**: Call `validateAll()` method anytime
 * - **Validation Rules**:
 *   - SIP URI format: Must be valid WebSocket URI (ws:// or wss://)
 *   - SIP User URI format: Must be valid SIP URI (sip: or sips:)
 *   - Required fields: URI, sipUri, and password are required for SIP config
 *   - Media constraints: Validates against MediaStreamConstraints API format
 *
 * **Configuration Storage:**
 * Configuration is stored in a reactive Pinia store (`configStore`), enabling:
 * - Persistence across component remounts
 * - Sharing configuration between multiple provider instances
 * - Access from outside Vue components (if needed)
 * - State debugging via Vue DevTools
 *
 * **Reactivity Model:**
 * All configuration is reactive via Vue refs/computed:
 * - Changes to props trigger watchers that update the store
 * - Store updates trigger computed refs that child components observe
 * - Child components get live configuration updates automatically
 * - Use `watch()` in child components to react to configuration changes
 *
 * **Type Safety:**
 * Full TypeScript support with strict typing:
 * - `SipClientConfig`: Type-safe SIP configuration interface
 * - `MediaConfiguration`: Type-safe media constraints interface
 * - `UserPreferences`: Type-safe user settings interface
 * - `ConfigProviderContext`: Type-safe provider context for inject
 * - Validation results include typed error objects
 *
 * **Environment-Specific Configuration:**
 * Best practices for managing configuration across environments:
 * - Use environment variables (Vite: `import.meta.env`, CRA: `process.env`)
 * - Never commit credentials to version control
 * - Use `.env.local` for local development secrets
 * - Use separate config objects for dev/staging/production
 * - Validate environment variables on application startup
 *
 * **Security Considerations:**
 * - **Credentials**: Never hardcode passwords; use environment variables or secure storage
 * - **WSS Required**: Production must use secure WebSocket (wss://, not ws://)
 * - **HTTPS Context**: SIP over WebSocket requires secure origin
 * - **Secrets Management**: Use secrets managers (Vault, AWS Secrets Manager, etc.)
 * - **Client Storage**: Avoid storing credentials in localStorage (use session storage or memory)
 * - **Configuration Logging**: Be careful not to log sensitive configuration values
 *
 * **Type Definitions:**
 *
 * ```typescript
 * // SIP client configuration (see ../types/config.types.ts)
 * interface SipClientConfig {
 *   uri: string                    // WebSocket server URI (wss://host:port or ws://host:port)
 *   sipUri: string                 // SIP address (sip:username@domain or sips:username@domain)
 *   password: string               // SIP authentication password
 *   displayName?: string           // Display name for caller ID (optional)
 *   userAgentString?: string       // Custom User-Agent header (optional)
 *   transportOptions?: {           // WebSocket transport options (optional)
 *     server?: string              // Override server from URI
 *     connectionTimeout?: number   // Connection timeout in seconds
 *     keepAliveInterval?: number   // Keep-alive ping interval in seconds
 *     keepAliveDebounce?: number   // Keep-alive debounce in seconds
 *     traceSip?: boolean           // Enable SIP message tracing
 *   }
 *   sessionDescriptionHandlerFactoryOptions?: {  // Media session options
 *     constraints?: MediaStreamConstraints       // getUserMedia constraints
 *     peerConnectionOptions?: RTCConfiguration   // RTCPeerConnection options
 *     iceGatheringTimeout?: number               // ICE gathering timeout (ms)
 *   }
 *   contactParams?: {              // Contact header parameters (optional)
 *     transport?: string           // Transport protocol (ws, wss)
 *     expires?: number             // Registration expiration (seconds)
 *   }
 *   instanceId?: string            // Unique instance ID for multiple registrations
 *   hackIpInContact?: boolean      // Workaround for some SIP servers
 *   hackWssInTransport?: boolean   // Workaround for WebSocket transport issues
 *   registerOptions?: {            // Registration options
 *     expires?: number             // Registration lifetime (seconds)
 *     extraContactHeaderParams?: string[]  // Extra Contact header params
 *   }
 * }
 *
 * // Media configuration for device constraints
 * interface MediaConfiguration {
 *   audio?: MediaTrackConstraints | boolean  // Audio constraints or boolean
 *   video?: MediaTrackConstraints | boolean  // Video constraints or boolean
 * }
 *
 * // MediaTrackConstraints structure (from MediaStream API)
 * interface MediaTrackConstraints {
 *   deviceId?: string | { ideal?: string, exact?: string }
 *   echoCancellation?: boolean | { ideal?: boolean, exact?: boolean }
 *   noiseSuppression?: boolean | { ideal?: boolean, exact?: boolean }
 *   autoGainControl?: boolean | { ideal?: boolean, exact?: boolean }
 *   sampleRate?: number | { min?: number, ideal?: number, max?: number }
 *   sampleSize?: number | { min?: number, ideal?: number, max?: number }
 *   channelCount?: number | { min?: number, ideal?: number, max?: number }
 *   latency?: number | { min?: number, ideal?: number, max?: number }
 *   // Video-specific
 *   width?: number | { min?: number, ideal?: number, max?: number }
 *   height?: number | { min?: number, ideal?: number, max?: number }
 *   aspectRatio?: number | { min?: number, ideal?: number, max?: number }
 *   frameRate?: number | { min?: number, ideal?: number, max?: number }
 *   facingMode?: 'user' | 'environment' | { ideal?: string, exact?: string }
 * }
 *
 * // User preferences configuration
 * interface UserPreferences {
 *   [key: string]: any  // Flexible structure for application-specific preferences
 * }
 *
 * // Validation result structure
 * interface ValidationResult {
 *   valid: boolean                    // Overall validation status
 *   errors: Array<{                   // Array of validation errors
 *     field: string                   // Field that failed validation
 *     message: string                 // Human-readable error message
 *     value?: any                     // Invalid value (for debugging)
 *   }>
 *   timestamp: number                 // Validation timestamp (Date.now())
 * }
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints MDN: MediaStreamConstraints}
 * @see {@link https://tools.ietf.org/html/rfc3261 RFC 3261: SIP Protocol}
 * @see {@link https://vitejs.dev/guide/env-and-mode.html Vite: Environment Variables}
 *
 * @example
 * **Basic setup with SIP configuration:**
 * ```vue
 * <template>
 *   <ConfigProvider :sip-config="sipConfig">
 *     <SipClientProvider>
 *       <CallInterface />
 *     </SipClientProvider>
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider } from 'vuesip'
 *
 * // Load from environment variables (recommended for production)
 * const sipConfig = {
 *   uri: import.meta.env.VITE_SIP_URI,                    // wss://sip.example.com:7443
 *   sipUri: import.meta.env.VITE_SIP_USER_URI,            // sip:alice@example.com
 *   password: import.meta.env.VITE_SIP_PASSWORD,          // Secure password
 *   displayName: 'Alice Smith'
 * }
 * </script>
 * ```
 *
 * @example
 * **Configuration merging with autoMerge:**
 * ```vue
 * <template>
 *   <ConfigProvider
 *     :sip-config="baseSipConfig"
 *     :auto-merge="true"
 *     :validate-on-mount="true"
 *   >
 *     <!-- Child provider can override specific settings -->
 *     <ConfigProvider :sip-config="overrideConfig" :auto-merge="true">
 *       <SipClientProvider>
 *         <CallInterface />
 *       </SipClientProvider>
 *     </ConfigProvider>
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider, useConfigProvider } from 'vuesip'
 *
 * // Base configuration with defaults
 * const baseSipConfig = {
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:user@example.com',
 *   password: 'password123',
 *   displayName: 'Default User',
 *   userAgentString: 'VueSip/1.0.0',
 *   transportOptions: {
 *     connectionTimeout: 30,
 *     keepAliveInterval: 30,
 *     traceSip: false
 *   }
 * }
 *
 * // Override specific settings (will be merged with base)
 * const overrideConfig = {
 *   displayName: 'Production User',
 *   transportOptions: {
 *     traceSip: true  // Enable tracing in production for debugging
 *   }
 * }
 *
 * // Result after merge:
 * // {
 * //   uri: 'wss://sip.example.com:7443',  // from base
 * //   sipUri: 'sip:user@example.com',     // from base
 * //   password: 'password123',             // from base
 * //   displayName: 'Production User',      // overridden
 * //   userAgentString: 'VueSip/1.0.0',    // from base
 * //   transportOptions: {
 * //     connectionTimeout: 30,              // from base
 * //     keepAliveInterval: 30,              // from base
 * //     traceSip: true                      // overridden
 * //   }
 * // }
 *
 * // In child component, access merged config:
 * const config = useConfigProvider()
 * console.log(config.sipConfig) // Shows merged result
 * </script>
 * ```
 *
 * @example
 * **Environment-specific configurations:**
 * ```vue
 * <template>
 *   <ConfigProvider
 *     :sip-config="currentConfig"
 *     :media-config="mediaConfig"
 *     :validate-on-mount="true"
 *     @config-validated="onConfigValidated"
 *   >
 *     <MediaProvider>
 *       <SipClientProvider>
 *         <YourApp />
 *       </SipClientProvider>
 *     </MediaProvider>
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider } from 'vuesip'
 * import { computed } from 'vue'
 *
 * // Define configurations for each environment
 * const configs = {
 *   development: {
 *     uri: 'ws://localhost:5060',              // Non-secure for local testing
 *     sipUri: 'sip:dev@localhost',
 *     password: 'dev123',
 *     displayName: 'Dev User',
 *     transportOptions: {
 *       traceSip: true,                        // Enable tracing in dev
 *       connectionTimeout: 60                  // Longer timeout for debugging
 *     }
 *   },
 *   staging: {
 *     uri: 'wss://sip-staging.example.com:7443',
 *     sipUri: 'sip:staging@example.com',
 *     password: import.meta.env.VITE_STAGING_SIP_PASSWORD,
 *     displayName: 'Staging User',
 *     transportOptions: {
 *       traceSip: true,
 *       connectionTimeout: 30
 *     }
 *   },
 *   production: {
 *     uri: 'wss://sip.example.com:7443',       // Secure WebSocket required
 *     sipUri: 'sip:prod@example.com',
 *     password: import.meta.env.VITE_PROD_SIP_PASSWORD,
 *     displayName: 'Production User',
 *     transportOptions: {
 *       traceSip: false,                       // Disable tracing in prod
 *       connectionTimeout: 30,
 *       keepAliveInterval: 25
 *     }
 *   }
 * }
 *
 * // Select configuration based on environment
 * const environment = import.meta.env.MODE || 'development'
 * const currentConfig = computed(() => configs[environment])
 *
 * // Media configuration (same across environments)
 * const mediaConfig = {
 *   audio: {
 *     echoCancellation: true,
 *     noiseSuppression: true,
 *     autoGainControl: true,
 *     sampleRate: { ideal: 48000 }
 *   },
 *   video: {
 *     width: { ideal: 1280, max: 1920 },
 *     height: { ideal: 720, max: 1080 },
 *     frameRate: { ideal: 30, max: 60 }
 *   }
 * }
 *
 * const onConfigValidated = (result) => {
 *   if (!result.valid) {
 *     console.error('Configuration validation failed:', result.errors)
 *     // Handle validation errors (show UI message, prevent app start, etc.)
 *   } else {
 *     console.log('Configuration validated successfully')
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Reactive configuration updates:**
 * ```vue
 * <template>
 *   <div>
 *     <ConfigProvider :sip-config="sipConfig" :media-config="mediaConfig">
 *       <div>
 *         <h3>Configuration Settings</h3>
 *         <label>
 *           Display Name:
 *           <input v-model="displayName" @blur="updateDisplayName" />
 *         </label>
 *         <label>
 *           Server:
 *           <select v-model="selectedServer" @change="switchServer">
 *             <option value="primary">Primary Server</option>
 *             <option value="backup">Backup Server</option>
 *           </select>
 *         </label>
 *         <label>
 *           <input type="checkbox" v-model="enableEchoCancellation" />
 *           Echo Cancellation
 *         </label>
 *         <button @click="saveConfig">Save Configuration</button>
 *       </div>
 *       <CallInterface />
 *     </ConfigProvider>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider, useConfigProvider } from 'vuesip'
 * import { ref, watch } from 'vue'
 *
 * const displayName = ref('Alice')
 * const selectedServer = ref('primary')
 * const enableEchoCancellation = ref(true)
 *
 * const servers = {
 *   primary: 'wss://sip.example.com:7443',
 *   backup: 'wss://sip-backup.example.com:7443'
 * }
 *
 * const sipConfig = ref({
 *   uri: servers.primary,
 *   sipUri: 'sip:alice@example.com',
 *   password: 'secret',
 *   displayName: displayName.value
 * })
 *
 * const mediaConfig = ref({
 *   audio: {
 *     echoCancellation: enableEchoCancellation.value,
 *     noiseSuppression: true,
 *     autoGainControl: true
 *   }
 * })
 *
 * // In child component, access configuration
 * const config = useConfigProvider()
 *
 * // Update display name when input changes
 * const updateDisplayName = () => {
 *   config.updateSipConfig({ displayName: displayName.value })
 *   console.log('Display name updated:', displayName.value)
 * }
 *
 * // Switch servers dynamically
 * const switchServer = () => {
 *   const newUri = servers[selectedServer.value]
 *   config.updateSipConfig({ uri: newUri })
 *   console.log('Switched to server:', newUri)
 *   // Note: SipClientProvider needs to reconnect for this to take effect
 * }
 *
 * // Update media config reactively
 * watch(enableEchoCancellation, (newValue) => {
 *   config.updateMediaConfig({
 *     audio: {
 *       echoCancellation: newValue
 *     }
 *   })
 * })
 *
 * // Save configuration to localStorage
 * const saveConfig = () => {
 *   const currentConfig = {
 *     sip: config.sipConfig,
 *     media: config.mediaConfig,
 *     preferences: config.userPreferences
 *   }
 *   localStorage.setItem('vueSipConfig', JSON.stringify(currentConfig))
 *   console.log('Configuration saved')
 * }
 * </script>
 * ```
 *
 * @example
 * **Configuration validation patterns:**
 * ```vue
 * <template>
 *   <ConfigProvider
 *     :sip-config="sipConfig"
 *     :validate-on-mount="true"
 *   >
 *     <div v-if="showConfigForm">
 *       <h3>SIP Configuration</h3>
 *       <form @submit.prevent="validateAndSave">
 *         <div>
 *           <label>WebSocket URI:</label>
 *           <input v-model="formData.uri" type="text" required />
 *           <span v-if="errors.uri" class="error">{{ errors.uri }}</span>
 *         </div>
 *         <div>
 *           <label>SIP URI:</label>
 *           <input v-model="formData.sipUri" type="text" required />
 *           <span v-if="errors.sipUri" class="error">{{ errors.sipUri }}</span>
 *         </div>
 *         <div>
 *           <label>Password:</label>
 *           <input v-model="formData.password" type="password" required />
 *           <span v-if="errors.password" class="error">{{ errors.password }}</span>
 *         </div>
 *         <button type="submit" :disabled="validating">
 *           {{ validating ? 'Validating...' : 'Save & Connect' }}
 *         </button>
 *       </form>
 *     </div>
 *     <CallInterface v-else />
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider, useConfigProvider } from 'vuesip'
 * import { ref, reactive } from 'vue'
 *
 * const showConfigForm = ref(true)
 * const validating = ref(false)
 *
 * const formData = reactive({
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:user@example.com',
 *   password: ''
 * })
 *
 * const errors = reactive({
 *   uri: '',
 *   sipUri: '',
 *   password: ''
 * })
 *
 * const sipConfig = ref({
 *   uri: '',
 *   sipUri: '',
 *   password: ''
 * })
 *
 * const config = useConfigProvider()
 *
 * // Custom validation logic
 * const validateForm = () => {
 *   let isValid = true
 *   errors.uri = ''
 *   errors.sipUri = ''
 *   errors.password = ''
 *
 *   // Validate WebSocket URI format
 *   if (!formData.uri.startsWith('ws://') && !formData.uri.startsWith('wss://')) {
 *     errors.uri = 'URI must start with ws:// or wss://'
 *     isValid = false
 *   }
 *
 *   // Production should use secure WebSocket
 *   if (import.meta.env.MODE === 'production' && formData.uri.startsWith('ws://')) {
 *     errors.uri = 'Production requires secure WebSocket (wss://)'
 *     isValid = false
 *   }
 *
 *   // Validate SIP URI format
 *   if (!formData.sipUri.startsWith('sip:') && !formData.sipUri.startsWith('sips:')) {
 *     errors.sipUri = 'SIP URI must start with sip: or sips:'
 *     isValid = false
 *   }
 *
 *   // Check for @ symbol in SIP URI
 *   if (!formData.sipUri.includes('@')) {
 *     errors.sipUri = 'SIP URI must include domain (user@domain)'
 *     isValid = false
 *   }
 *
 *   // Validate password strength
 *   if (formData.password.length < 8) {
 *     errors.password = 'Password must be at least 8 characters'
 *     isValid = false
 *   }
 *
 *   return isValid
 * }
 *
 * const validateAndSave = async () => {
 *   // Client-side validation
 *   if (!validateForm()) {
 *     return
 *   }
 *
 *   validating.value = true
 *
 *   try {
 *     // Update configuration
 *     config.setSipConfig({
 *       uri: formData.uri,
 *       sipUri: formData.sipUri,
 *       password: formData.password
 *     }, true) // validate = true
 *
 *     // Check validation result
 *     const validationResult = config.validateAll()
 *
 *     if (validationResult.valid) {
 *       console.log('Configuration validated successfully')
 *       showConfigForm.value = false
 *
 *       // Save to secure storage
 *       sessionStorage.setItem('sipConfig', JSON.stringify(config.sipConfig))
 *     } else {
 *       // Display validation errors
 *       validationResult.errors.forEach(error => {
 *         if (errors[error.field] !== undefined) {
 *           errors[error.field] = error.message
 *         }
 *       })
 *       console.error('Validation failed:', validationResult.errors)
 *     }
 *   } catch (error) {
 *     console.error('Configuration error:', error)
 *     errors.uri = 'Failed to validate configuration'
 *   } finally {
 *     validating.value = false
 *   }
 * }
 * </script>
 *
 * <style scoped>
 * .error {
 *   color: red;
 *   font-size: 0.875rem;
 *   display: block;
 *   margin-top: 0.25rem;
 * }
 * </style>
 * ```
 *
 * @example
 * **Integration with multiple providers:**
 * ```vue
 * <template>
 *   <!-- ConfigProvider at the top level provides config to all descendants -->
 *   <ConfigProvider
 *     :sip-config="sipConfig"
 *     :media-config="mediaConfig"
 *     :user-preferences="userPrefs"
 *     :validate-on-mount="true"
 *     :auto-merge="false"
 *   >
 *     <!-- MediaProvider can read mediaConfig from ConfigProvider -->
 *     <MediaProvider
 *       :auto-enumerate="true"
 *       :auto-request-permissions="false"
 *       :auto-select-defaults="true"
 *     >
 *       <!-- SipClientProvider can read sipConfig from ConfigProvider -->
 *       <SipClientProvider
 *         :auto-connect="true"
 *         :auto-register="true"
 *       >
 *         <!-- All child components have access to config, media, and SIP client -->
 *         <CallInterface />
 *       </SipClientProvider>
 *     </MediaProvider>
 *   </ConfigProvider>
 * </template>
 *
 * <script setup>
 * import { ConfigProvider, MediaProvider, SipClientProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * // SIP configuration from environment
 * const sipConfig = {
 *   uri: import.meta.env.VITE_SIP_URI,
 *   sipUri: import.meta.env.VITE_SIP_USER_URI,
 *   password: import.meta.env.VITE_SIP_PASSWORD,
 *   displayName: 'Alice Smith',
 *   userAgentString: 'VueSip/1.0.0',
 *   transportOptions: {
 *     traceSip: import.meta.env.DEV, // Enable tracing in development
 *     connectionTimeout: 30,
 *     keepAliveInterval: 25
 *   }
 * }
 *
 * // Media configuration with optimal settings
 * const mediaConfig = {
 *   audio: {
 *     echoCancellation: true,
 *     noiseSuppression: true,
 *     autoGainControl: true,
 *     sampleRate: { ideal: 48000 },
 *     channelCount: { ideal: 1 }
 *   },
 *   video: {
 *     width: { min: 640, ideal: 1280, max: 1920 },
 *     height: { min: 480, ideal: 720, max: 1080 },
 *     aspectRatio: { ideal: 16/9 },
 *     frameRate: { min: 15, ideal: 30, max: 60 },
 *     facingMode: { ideal: 'user' }
 *   }
 * }
 *
 * // User preferences
 * const userPrefs = ref({
 *   enableNotifications: true,
 *   autoAnswer: false,
 *   ringtoneVolume: 0.7,
 *   theme: 'light',
 *   language: 'en'
 * })
 *
 * // In CallInterface.vue or any child component:
 * // import { useConfigProvider, useMediaProvider, useSipClientProvider } from 'vuesip'
 * //
 * // const config = useConfigProvider()
 * // const media = useMediaProvider()
 * // const sip = useSipClientProvider()
 * //
 * // // Access all configurations
 * // console.log(config.sipConfig)
 * // console.log(config.mediaConfig)
 * // console.log(config.userPreferences)
 * //
 * // // Use media devices
 * // media.enumerateDevices()
 * //
 * // // Make SIP calls
 * // sip.connect()
 * </script>
 * ```
 *
 * @example
 * **Common Pitfalls & Troubleshooting:**
 * ```vue
 * <script setup>
 * import { ConfigProvider, useConfigProvider } from 'vuesip'
 * import { ref, watch, onMounted } from 'vue'
 *
 * // PITFALL 1: Hardcoding credentials
 * // Problem: Credentials committed to version control, security risk
 * // ❌ Bad:
 * const badConfig = {
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:alice@example.com',
 *   password: 'MyPassword123'  // Never do this!
 * }
 *
 * // ✅ Good: Use environment variables
 * const goodConfig = {
 *   uri: import.meta.env.VITE_SIP_URI,
 *   sipUri: import.meta.env.VITE_SIP_USER_URI,
 *   password: import.meta.env.VITE_SIP_PASSWORD
 * }
 *
 * // PITFALL 2: Using non-secure WebSocket in production
 * // Problem: ws:// doesn't work with HTTPS, causes mixed content errors
 * // ❌ Bad:
 * const insecureConfig = {
 *   uri: 'ws://sip.example.com:5060',  // Won't work on HTTPS site!
 *   // ...
 * }
 *
 * // ✅ Good: Always use wss:// in production
 * const secureConfig = {
 *   uri: import.meta.env.MODE === 'production'
 *     ? 'wss://sip.example.com:7443'
 *     : 'ws://localhost:5060'
 * }
 *
 * // PITFALL 3: Not validating configuration
 * // Problem: Invalid config causes runtime errors
 * // ❌ Bad:
 * const invalidConfig = {
 *   uri: 'sip.example.com',  // Missing ws:// or wss://
 *   sipUri: 'alice@example.com',  // Missing sip: or sips:
 *   password: ''  // Empty password
 * }
 *
 * // ✅ Good: Validate configuration
 * const config = useConfigProvider()
 * const validateBeforeUse = () => {
 *   const result = config.validateAll()
 *   if (!result.valid) {
 *     console.error('Configuration errors:', result.errors)
 *     // Show error UI to user
 *     result.errors.forEach(error => {
 *       console.error(`Field: ${error.field}, Message: ${error.message}`)
 *     })
 *     return false
 *   }
 *   return true
 * }
 *
 * // PITFALL 4: Forgetting to handle merge vs replace
 * // Problem: autoMerge behavior not understood, unexpected config state
 * // Context: With autoMerge=false (default), new config replaces old entirely
 * const config1 = {
 *   uri: 'wss://server1.example.com',
 *   sipUri: 'sip:user@example.com',
 *   password: 'pass',
 *   displayName: 'Alice',
 *   transportOptions: { traceSip: true }
 * }
 *
 * // Later, update with autoMerge=false (default)
 * config.setSipConfig({
 *   uri: 'wss://server2.example.com'
 * })
 * // Result: Only uri is set, other fields are lost!
 * // sipUri, password, displayName, transportOptions are now undefined
 *
 * // ✅ Good: Use update method or enable autoMerge
 * config.updateSipConfig({
 *   uri: 'wss://server2.example.com'
 * })
 * // Result: uri is updated, other fields are preserved
 *
 * // PITFALL 5: Not watching for configuration changes
 * // Problem: Component doesn't react to config updates
 * // ❌ Bad: Reading config once
 * const uri = config.sipConfig.uri  // Won't update if config changes
 *
 * // ✅ Good: Use computed or watch
 * const uri = computed(() => config.sipConfig?.uri)
 *
 * // Or watch for changes:
 * watch(
 *   () => config.sipConfig,
 *   (newConfig, oldConfig) => {
 *     console.log('Config changed from:', oldConfig)
 *     console.log('Config changed to:', newConfig)
 *     // React to changes (e.g., reconnect SIP client)
 *   },
 *   { deep: true }
 * )
 *
 * // PITFALL 6: Storing sensitive data in localStorage
 * // Problem: localStorage is not secure, credentials can be extracted
 * // ❌ Bad:
 * localStorage.setItem('sipPassword', config.sipConfig.password)
 *
 * // ✅ Good: Use sessionStorage (cleared on tab close) or keep in memory
 * sessionStorage.setItem('sipPassword', config.sipConfig.password)
 * // Or better: Don't store at all, require login each session
 *
 * // PITFALL 7: Not handling undefined config
 * // Problem: Accessing config before it's set causes errors
 * // ❌ Bad:
 * const displayName = config.sipConfig.displayName  // Error if sipConfig is null
 *
 * // ✅ Good: Use optional chaining and provide defaults
 * const displayName = config.sipConfig?.displayName ?? 'Unknown User'
 *
 * // Or check existence first:
 * if (config.hasSipConfig) {
 *   const displayName = config.sipConfig.displayName
 * }
 *
 * // PITFALL 8: Mutating config directly
 * // Problem: Direct mutation bypasses validation and reactivity
 * // ❌ Bad:
 * config.sipConfig.password = 'newPassword'  // Doesn't work, sipConfig is readonly
 *
 * // ✅ Good: Use update methods
 * config.updateSipConfig({ password: 'newPassword' }, true)  // validate = true
 * </script>
 * ```
 *
 * **Performance Considerations:**
 *
 * - **Configuration Store**: Uses a singleton Pinia store for efficient state management.
 *   Multiple ConfigProvider instances share the same store, avoiding duplication.
 *
 * - **Reactive Overhead**: All configuration is reactive via Vue refs. For large configuration
 *   objects, be mindful of deep watchers which can impact performance. Use `{ deep: true }`
 *   sparingly and only when necessary.
 *
 * - **Validation Cost**: Validation is synchronous but relatively fast. However, avoid calling
 *   `validateAll()` on every render or in tight loops. Validate only when config changes or
 *   on user actions.
 *
 * - **Prop Watching**: Deep watchers are attached to all props. If you have large media
 *   configurations that change frequently, consider using `watchConfig=false` and manual
 *   updates to reduce reactivity overhead.
 *
 * - **Memory Usage**: Configuration is stored in memory until explicitly reset or page reload.
 *   For long-running applications, consider periodically cleaning up unused configuration
 *   via `config.reset()` when switching contexts (e.g., user logout).
 *
 * @see {@link useConfigProvider} For injecting config context in child components
 * @see {@link ConfigProviderContext} For the complete context type definition
 * @see {@link SipClientProvider} For SIP functionality using this configuration
 * @see {@link MediaProvider} For media device management using this configuration
 *
 * @packageDocumentation
 */

import { defineComponent, provide, computed, watch, inject, type PropType } from 'vue'
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
     * Initial SIP client configuration
     *
     * @remarks
     * Provides the SIP configuration object that defines how to connect to your SIP server.
     * This configuration is required for SipClientProvider to function.
     *
     * **Required Fields:**
     * - `uri`: WebSocket server URI (e.g., 'wss://sip.example.com:7443')
     * - `sipUri`: SIP address URI (e.g., 'sip:alice@example.com')
     * - `password`: SIP authentication password
     *
     * **Optional Fields:**
     * - `displayName`: Caller ID display name
     * - `userAgentString`: Custom User-Agent header
     * - `transportOptions`: WebSocket transport settings
     * - `sessionDescriptionHandlerFactoryOptions`: Media session options
     * - And more (see type definition)
     *
     * **When to Use:**
     * - Loading configuration from environment variables
     * - Initializing application with user credentials
     * - Switching between multiple SIP accounts
     * - Testing with different SIP servers
     *
     * **Best Practices:**
     * - Load from environment variables (never hardcode credentials)
     * - Use wss:// (secure WebSocket) in production
     * - Validate configuration before passing to provider
     * - Store credentials securely (avoid localStorage for passwords)
     *
     * **Merging Behavior:**
     * - With `autoMerge=false` (default): Completely replaces existing SIP config
     * - With `autoMerge=true`: Deep merges with existing SIP config
     * - Runtime updates via `setSipConfig`: Always replaces
     * - Runtime updates via `updateSipConfig`: Always merges
     *
     * @default undefined
     *
     * @example
     * **Loading from environment variables:**
     * ```vue
     * <ConfigProvider :sip-config="sipConfig">
     *   <SipClientProvider />
     * </ConfigProvider>
     *
     * <script setup>
     * const sipConfig = {
     *   uri: import.meta.env.VITE_SIP_URI,
     *   sipUri: import.meta.env.VITE_SIP_USER_URI,
     *   password: import.meta.env.VITE_SIP_PASSWORD,
     *   displayName: 'Alice Smith'
     * }
     * </script>
     * ```
     *
     * @example
     * **Advanced configuration with transport options:**
     * ```vue
     * <script setup>
     * const sipConfig = {
     *   uri: 'wss://sip.example.com:7443',
     *   sipUri: 'sip:alice@example.com',
     *   password: 'securePassword',
     *   displayName: 'Alice Smith',
     *   userAgentString: 'MyApp/1.0.0',
     *   transportOptions: {
     *     traceSip: true,              // Enable SIP message logging
     *     connectionTimeout: 30,       // Connection timeout (seconds)
     *     keepAliveInterval: 25        // Keep-alive interval (seconds)
     *   },
     *   sessionDescriptionHandlerFactoryOptions: {
     *     peerConnectionOptions: {
     *       iceServers: [
     *         { urls: 'stun:stun.l.google.com:19302' }
     *       ]
     *     }
     *   }
     * }
     * </script>
     * ```
     */
    sipConfig: {
      type: Object as PropType<SipClientConfig>,
      default: undefined,
    },

    /**
     * Initial media configuration for audio/video constraints
     *
     * @remarks
     * Defines the media constraints to use when acquiring audio and video streams.
     * These constraints follow the MediaStreamConstraints Web API format.
     *
     * **Configuration Structure:**
     * - `audio`: Audio track constraints (boolean or MediaTrackConstraints object)
     * - `video`: Video track constraints (boolean or MediaTrackConstraints object)
     *
     * **Common Audio Constraints:**
     * - `echoCancellation`: Enable/disable echo cancellation
     * - `noiseSuppression`: Enable/disable noise suppression
     * - `autoGainControl`: Enable/disable automatic gain control
     * - `sampleRate`: Sample rate (Hz), e.g., 48000 for high quality
     * - `channelCount`: Number of audio channels (1 for mono, 2 for stereo)
     *
     * **Common Video Constraints:**
     * - `width`: Video width (pixels) with min/ideal/max
     * - `height`: Video height (pixels) with min/ideal/max
     * - `frameRate`: Frames per second with min/ideal/max
     * - `facingMode`: 'user' (front camera) or 'environment' (back camera)
     * - `aspectRatio`: Aspect ratio like 16/9 or 4/3
     *
     * **When to Use:**
     * - Setting optimal audio quality for calls
     * - Defining video resolution requirements
     * - Configuring noise cancellation and echo control
     * - Optimizing for bandwidth constraints
     * - Mobile vs desktop different constraints
     *
     * **Best Practices:**
     * - Use `ideal` values for flexibility (browser picks closest match)
     * - Avoid `exact` unless absolutely required (may fail constraint matching)
     * - Enable echo cancellation for VoIP applications
     * - Balance quality with bandwidth and CPU usage
     * - Test constraints on target devices before deployment
     *
     * **Merging Behavior:**
     * - With `autoMerge=false` (default): Completely replaces existing media config
     * - With `autoMerge=true`: Deep merges with existing media config
     * - Runtime updates via `setMediaConfig`: Always replaces
     * - Runtime updates via `updateMediaConfig`: Always merges
     *
     * @default undefined
     *
     * @example
     * **Basic audio-only configuration:**
     * ```vue
     * <ConfigProvider :media-config="mediaConfig">
     *   <MediaProvider />
     * </ConfigProvider>
     *
     * <script setup>
     * const mediaConfig = {
     *   audio: {
     *     echoCancellation: true,
     *     noiseSuppression: true,
     *     autoGainControl: true
     *   },
     *   video: false  // Disable video
     * }
     * </script>
     * ```
     *
     * @example
     * **High-quality audio/video configuration:**
     * ```vue
     * <script setup>
     * const mediaConfig = {
     *   audio: {
     *     echoCancellation: true,
     *     noiseSuppression: true,
     *     autoGainControl: true,
     *     sampleRate: { ideal: 48000 },    // CD quality
     *     channelCount: { ideal: 2 }       // Stereo
     *   },
     *   video: {
     *     width: { min: 640, ideal: 1280, max: 1920 },
     *     height: { min: 480, ideal: 720, max: 1080 },
     *     aspectRatio: { ideal: 16/9 },
     *     frameRate: { min: 15, ideal: 30, max: 60 },
     *     facingMode: { ideal: 'user' }
     *   }
     * }
     * </script>
     * ```
     *
     * @example
     * **Mobile-optimized configuration (lower bandwidth):**
     * ```vue
     * <script setup>
     * const mediaConfig = {
     *   audio: {
     *     echoCancellation: true,
     *     noiseSuppression: true,
     *     autoGainControl: true,
     *     sampleRate: { ideal: 16000 }     // Lower rate for mobile
     *   },
     *   video: {
     *     width: { ideal: 640, max: 1280 },
     *     height: { ideal: 480, max: 720 },
     *     frameRate: { ideal: 15, max: 30 }  // Lower framerate
     *   }
     * }
     * </script>
     * ```
     */
    mediaConfig: {
      type: Object as PropType<MediaConfiguration>,
      default: undefined,
    },

    /**
     * Initial user preferences for application behavior
     *
     * @remarks
     * Flexible configuration object for application-specific user settings and preferences.
     * Unlike SIP and media config, this has no fixed structure - define fields as needed
     * for your application.
     *
     * **Common Use Cases:**
     * - UI theme preferences (light/dark mode)
     * - Notification settings (enable/disable, sound volume)
     * - Call behavior preferences (auto-answer, call waiting)
     * - Language and localization settings
     * - Accessibility options
     * - Feature flags and toggles
     *
     * **When to Use:**
     * - Storing user UI preferences
     * - Persisting application settings
     * - Feature toggles and A/B testing flags
     * - Accessibility configuration
     * - Custom application behavior settings
     *
     * **Best Practices:**
     * - Define a clear TypeScript interface for your preferences
     * - Provide sensible defaults for all fields
     * - Persist to localStorage for user convenience
     * - Sync with backend for cross-device consistency
     * - Version your preferences structure for migrations
     *
     * **Merging Behavior:**
     * - With `autoMerge=false` (default): Completely replaces existing preferences
     * - With `autoMerge=true`: Deep merges with existing preferences
     * - Runtime updates via `setUserPreferences`: Always replaces
     * - Runtime updates via `updateUserPreferences`: Always merges
     *
     * @default undefined
     *
     * @example
     * **Basic user preferences:**
     * ```vue
     * <ConfigProvider :user-preferences="userPrefs">
     *   <YourApp />
     * </ConfigProvider>
     *
     * <script setup>
     * import { ref } from 'vue'
     *
     * const userPrefs = ref({
     *   theme: 'dark',
     *   language: 'en',
     *   enableNotifications: true,
     *   notificationVolume: 0.7
     * })
     * </script>
     * ```
     *
     * @example
     * **VoIP application preferences:**
     * ```vue
     * <script setup>
     * import { ref } from 'vue'
     *
     * // Define preferences type for type safety
     * interface VoIPPreferences {
     *   autoAnswer: boolean
     *   callWaiting: boolean
     *   ringtoneVolume: number
     *   microphoneVolume: number
     *   speakerVolume: number
     *   videoEnabled: boolean
     *   recordCalls: boolean
     *   showCallHistory: boolean
     *   compactView: boolean
     * }
     *
     * const userPrefs = ref<VoIPPreferences>({
     *   autoAnswer: false,
     *   callWaiting: true,
     *   ringtoneVolume: 0.8,
     *   microphoneVolume: 1.0,
     *   speakerVolume: 0.9,
     *   videoEnabled: true,
     *   recordCalls: false,
     *   showCallHistory: true,
     *   compactView: false
     * })
     * </script>
     * ```
     *
     * @example
     * **Loading preferences from localStorage:**
     * ```vue
     * <script setup>
     * import { ref, onMounted, watch } from 'vue'
     *
     * const DEFAULT_PREFS = {
     *   theme: 'light',
     *   language: 'en',
     *   enableNotifications: true
     * }
     *
     * // Load from localStorage or use defaults
     * const loadPreferences = () => {
     *   const stored = localStorage.getItem('userPreferences')
     *   if (stored) {
     *     try {
     *       return { ...DEFAULT_PREFS, ...JSON.parse(stored) }
     *     } catch (error) {
     *       console.error('Failed to parse preferences:', error)
     *       return DEFAULT_PREFS
     *     }
     *   }
     *   return DEFAULT_PREFS
     * }
     *
     * const userPrefs = ref(loadPreferences())
     *
     * // Save to localStorage when preferences change
     * watch(userPrefs, (newPrefs) => {
     *   localStorage.setItem('userPreferences', JSON.stringify(newPrefs))
     * }, { deep: true })
     * </script>
     * ```
     */
    userPreferences: {
      type: Object as PropType<UserPreferences>,
      default: undefined,
    },

    /**
     * Whether to validate configuration on component mount
     *
     * @remarks
     * When enabled, all provided configurations are validated immediately when the
     * component mounts. Validation checks for:
     * - Required fields (SIP URI, password, WebSocket URI)
     * - URI format correctness (ws:// or wss://, sip: or sips:)
     * - Field types and value constraints
     *
     * **Validation Timing:**
     * - Runs immediately during component setup (synchronous)
     * - Validates all configs: SIP, media, and user preferences
     * - Results available via `lastValidation` in provider context
     * - Validation errors are logged but don't prevent rendering
     *
     * **When to Enable (true, default):**
     * - Production deployments (catch config errors early)
     * - Loading configuration from external sources
     * - Dynamic configuration from user input
     * - When SIP connection must work immediately
     *
     * **When to Disable (false):**
     * - Development with incomplete/test configurations
     * - Configurations loaded asynchronously after mount
     * - When manual validation is performed elsewhere
     * - Unit/integration testing with mock configs
     *
     * **Best Practices:**
     * - Keep enabled in production for early error detection
     * - Check `config.isConfigValid` and `config.lastValidation` after mount
     * - Display validation errors to users in UI
     * - Use with environment variables to validate on app start
     *
     * **Note on Performance:**
     * Validation is synchronous and fast (< 1ms typically). Safe to keep enabled
     * in most scenarios. For extremely large configuration objects, consider
     * disabling and validating manually at strategic points.
     *
     * @default true
     *
     * @example
     * **With validation enabled (recommended):**
     * ```vue
     * <template>
     *   <ConfigProvider
     *     :sip-config="sipConfig"
     *     :validate-on-mount="true"
     *   >
     *     <div v-if="!config.isConfigValid">
     *       <ErrorMessage :errors="config.lastValidation?.errors" />
     *     </div>
     *     <YourApp v-else />
     *   </ConfigProvider>
     * </template>
     *
     * <script setup>
     * import { useConfigProvider } from 'vuesip'
     * const config = useConfigProvider()
     * </script>
     * ```
     *
     * @example
     * **Handling validation errors:**
     * ```vue
     * <script setup>
     * import { useConfigProvider } from 'vuesip'
     * import { onMounted, ref } from 'vue'
     *
     * const config = useConfigProvider()
     * const validationErrors = ref([])
     *
     * onMounted(() => {
     *   const result = config.lastValidation
     *   if (result && !result.valid) {
     *     validationErrors.value = result.errors
     *     console.error('Configuration validation failed:', result.errors)
     *
     *     // Display user-friendly error messages
     *     result.errors.forEach(error => {
     *       alert(`Configuration error in ${error.field}: ${error.message}`)
     *     })
     *   }
     * })
     * </script>
     * ```
     */
    validateOnMount: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically merge configuration with existing values
     *
     * @remarks
     * Controls how configuration updates are handled when props change or when
     * ConfigProvider is nested within another ConfigProvider.
     *
     * **Replace Mode** (`autoMerge=false`, default):
     * - New configuration completely replaces existing configuration
     * - Any fields not in the new config are lost/cleared
     * - Predictable behavior, no hidden state
     * - Use when you want full control over configuration state
     *
     * **Merge Mode** (`autoMerge=true`):
     * - New configuration is deep-merged with existing configuration
     * - Preserves fields not specified in the new config
     * - Useful for partial updates without losing existing settings
     * - Enables nested ConfigProvider overrides
     *
     * **Common Use Cases:**
     *
     * *Replace Mode (autoMerge=false):*
     * - Initial application setup with complete config
     * - User switching between completely different profiles/accounts
     * - Testing with known, fixed configurations
     * - When you want explicit, predictable configuration state
     *
     * *Merge Mode (autoMerge=true):*
     * - Nested ConfigProviders for context-specific overrides
     * - Partial configuration updates (e.g., just changing display name)
     * - Progressive configuration loading
     * - Environment-specific overrides on top of base config
     *
     * **Best Practices:**
     * - Use replace mode (default) for simplicity and predictability
     * - Use merge mode for nested providers or partial updates
     * - Be explicit: use `setSipConfig` (replace) vs `updateSipConfig` (merge)
     * - Document which mode your application uses
     *
     * **Precedence with Nested Providers:**
     * When using nested ConfigProviders with autoMerge=true:
     * 1. Outermost provider sets base configuration
     * 2. Inner providers merge their configs on top
     * 3. Innermost provider wins for conflicting fields
     * 4. All providers share the same underlying store
     *
     * @default false
     *
     * @example
     * **Replace mode (default behavior):**
     * ```vue
     * <ConfigProvider :sip-config="config1" :auto-merge="false">
     *   <!-- config1 completely replaces any existing config -->
     * </ConfigProvider>
     *
     * <script setup>
     * // Initial config with all fields
     * const config1 = {
     *   uri: 'wss://server.example.com',
     *   sipUri: 'sip:user@example.com',
     *   password: 'pass',
     *   displayName: 'Alice'
     * }
     *
     * // Later update (via prop change)
     * config1.value = {
     *   uri: 'wss://server2.example.com'
     * }
     * // Result: Only uri is set, other fields are lost!
     * </script>
     * ```
     *
     * @example
     * **Merge mode for partial updates:**
     * ```vue
     * <ConfigProvider :sip-config="baseConfig" :auto-merge="true">
     *   <ConfigProvider :sip-config="override" :auto-merge="true">
     *     <!-- Results in merged configuration -->
     *   </ConfigProvider>
     * </ConfigProvider>
     *
     * <script setup>
     * const baseConfig = {
     *   uri: 'wss://sip.example.com:7443',
     *   sipUri: 'sip:user@example.com',
     *   password: 'password123',
     *   displayName: 'Base User',
     *   transportOptions: {
     *     connectionTimeout: 30,
     *     traceSip: false
     *   }
     * }
     *
     * const override = {
     *   displayName: 'Override User',  // Overrides base
     *   transportOptions: {
     *     traceSip: true  // Merges with base transportOptions
     *   }
     *   // uri, sipUri, password inherited from base
     * }
     *
     * // Resulting merged config:
     * // {
     * //   uri: 'wss://sip.example.com:7443',    // from base
     * //   sipUri: 'sip:user@example.com',       // from base
     * //   password: 'password123',               // from base
     * //   displayName: 'Override User',          // from override
     * //   transportOptions: {
     * //     connectionTimeout: 30,               // from base
     * //     traceSip: true                       // from override
     * //   }
     * // }
     * </script>
     * ```
     *
     * @example
     * **Environment-specific overrides with merge:**
     * ```vue
     * <ConfigProvider :sip-config="baseConfig" :auto-merge="false">
     *   <!-- Production-specific overrides -->
     *   <ConfigProvider
     *     v-if="isProd"
     *     :sip-config="prodOverrides"
     *     :auto-merge="true"
     *   >
     *     <YourApp />
     *   </ConfigProvider>
     *
     *   <!-- Development-specific overrides -->
     *   <ConfigProvider
     *     v-else
     *     :sip-config="devOverrides"
     *     :auto-merge="true"
     *   >
     *     <YourApp />
     *   </ConfigProvider>
     * </ConfigProvider>
     *
     * <script setup>
     * const isProd = import.meta.env.MODE === 'production'
     *
     * // Base config shared across all environments
     * const baseConfig = {
     *   sipUri: 'sip:user@example.com',
     *   password: import.meta.env.VITE_SIP_PASSWORD,
     *   displayName: 'User'
     * }
     *
     * // Production overrides
     * const prodOverrides = {
     *   uri: 'wss://sip.example.com:7443',
     *   transportOptions: { traceSip: false }
     * }
     *
     * // Development overrides
     * const devOverrides = {
     *   uri: 'ws://localhost:5060',
     *   transportOptions: { traceSip: true }
     * }
     * </script>
     * ```
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
     * Configuration provider context injected to child components
     *
     * @remarks
     * This object is provided to all child components via Vue's provide/inject API.
     * Child components access it using the `useConfigProvider()` composable.
     *
     * **Available State (Reactive):**
     *
     * *Configuration Objects (readonly):*
     * - `sipConfig` - Complete SIP client configuration (SipClientConfig | null)
     * - `mediaConfig` - Media constraints configuration (MediaConfiguration | null)
     * - `userPreferences` - User preferences object (UserPreferences | null)
     *
     * **Null Semantics:**
     * All configuration objects may be `null` if not yet provided. Always check for
     * null or use optional chaining when accessing properties.
     *
     * *Configuration Status (readonly boolean):*
     * - `hasSipConfig` - `true` if SIP configuration has been set (non-null)
     * - `isConfigValid` - `true` if last validation passed (based on validateAll())
     *
     * *Validation Results (readonly):*
     * - `lastValidation` - Last validation result object (ValidationResult | null)
     *   Contains: `{ valid: boolean, errors: Array<{field, message, value}>, timestamp: number }`
     *
     * **Available Methods:**
     *
     * *SIP Configuration Methods:*
     * - `setSipConfig(config: Partial<SipClientConfig>, validate?: boolean): void`
     *   Completely replaces existing SIP configuration with new configuration.
     *   Clears any fields not present in the new config.
     *   Optional validation (default: true).
     *
     * - `updateSipConfig(updates: Partial<SipClientConfig>, validate?: boolean): void`
     *   Deep merges updates into existing SIP configuration.
     *   Preserves fields not mentioned in updates.
     *   Optional validation (default: true).
     *
     * *Media Configuration Methods:*
     * - `setMediaConfig(config: MediaConfiguration, validate?: boolean): void`
     *   Completely replaces existing media configuration.
     *   Optional validation (default: true).
     *
     * - `updateMediaConfig(updates: Partial<MediaConfiguration>, validate?: boolean): void`
     *   Deep merges updates into existing media configuration.
     *   Preserves fields not mentioned in updates.
     *   Optional validation (default: true).
     *
     * *User Preferences Methods:*
     * - `setUserPreferences(preferences: UserPreferences): void`
     *   Completely replaces existing user preferences.
     *   No validation performed (preferences are application-specific).
     *
     * - `updateUserPreferences(updates: Partial<UserPreferences>): void`
     *   Deep merges updates into existing user preferences.
     *   Preserves fields not mentioned in updates.
     *   No validation performed.
     *
     * *Validation Methods:*
     * - `validateAll(): ValidationResult`
     *   Validates all configurations (SIP, media, preferences).
     *   Returns result with `valid` flag and array of `errors`.
     *   Synchronous operation.
     *
     * *Reset Method:*
     * - `reset(): void`
     *   Clears all configuration (SIP, media, preferences).
     *   Resets validation state.
     *   Useful when user logs out or switches contexts.
     *
     * **Method Behavior Differences:**
     *
     * | Method | Behavior | Preserves Unmentioned Fields | Validation |
     * |--------|----------|------------------------------|------------|
     * | `setSipConfig` | Replace entire config | No (clears them) | Optional (default: true) |
     * | `updateSipConfig` | Merge updates | Yes (deep merge) | Optional (default: true) |
     * | `setMediaConfig` | Replace entire config | No (clears them) | Optional (default: true) |
     * | `updateMediaConfig` | Merge updates | Yes (deep merge) | Optional (default: true) |
     * | `setUserPreferences` | Replace entire prefs | No (clears them) | None |
     * | `updateUserPreferences` | Merge updates | Yes (deep merge) | None |
     *
     * **Reactivity:**
     * All configuration getters return reactive values. When you access `sipConfig`,
     * `mediaConfig`, or `userPreferences`, you get a value that will automatically
     * trigger re-renders when it changes. Use with Vue's reactivity system (watch,
     * computed, etc.) for optimal results.
     *
     * @example
     * **Basic configuration access:**
     * ```vue
     * <script setup>
     * import { useConfigProvider } from 'vuesip'
     * import { computed } from 'vue'
     *
     * const config = useConfigProvider()
     *
     * // Access configuration with null safety
     * const serverUri = computed(() => config.sipConfig?.uri ?? 'Not configured')
     * const displayName = computed(() => config.sipConfig?.displayName ?? 'Unknown')
     *
     * // Check if configuration exists
     * if (config.hasSipConfig) {
     *   console.log('SIP configured:', config.sipConfig.uri)
     * }
     *
     * // Check validation status
     * if (!config.isConfigValid) {
     *   console.error('Configuration invalid:', config.lastValidation?.errors)
     * }
     * </script>
     * ```
     *
     * @example
     * **Updating configuration:**
     * ```vue
     * <script setup>
     * import { useConfigProvider } from 'vuesip'
     *
     * const config = useConfigProvider()
     *
     * // Replace entire SIP config
     * const resetConfig = () => {
     *   config.setSipConfig({
     *     uri: 'wss://sip.example.com',
     *     sipUri: 'sip:user@example.com',
     *     password: 'newPassword'
     *   }, true) // validate = true
     * }
     *
     * // Update specific SIP config fields (merges with existing)
     * const updateDisplayName = (newName: string) => {
     *   config.updateSipConfig({
     *     displayName: newName
     *   }, true) // Other fields preserved
     * }
     *
     * // Update media config
     * const toggleEchoCancellation = (enabled: boolean) => {
     *   config.updateMediaConfig({
     *     audio: {
     *       echoCancellation: enabled
     *     }
     *   })
     * }
     *
     * // Update user preferences
     * const updateTheme = (theme: string) => {
     *   config.updateUserPreferences({
     *     theme
     *   })
     * }
     * </script>
     * ```
     *
     * @example
     * **Validation handling:**
     * ```vue
     * <script setup>
     * import { useConfigProvider } from 'vuesip'
     * import { ref, watch } from 'vue'
     *
     * const config = useConfigProvider()
     * const validationErrors = ref([])
     *
     * // Validate all configurations
     * const validateConfig = () => {
     *   const result = config.validateAll()
     *
     *   if (result.valid) {
     *     console.log('All configurations are valid')
     *     validationErrors.value = []
     *     return true
     *   } else {
     *     console.error('Validation failed:', result.errors)
     *     validationErrors.value = result.errors
     *
     *     // Display errors to user
     *     result.errors.forEach(error => {
     *       console.error(`${error.field}: ${error.message}`)
     *     })
     *     return false
     *   }
     * }
     *
     * // Watch for configuration changes and re-validate
     * watch(
     *   () => config.sipConfig,
     *   () => {
     *     validateConfig()
     *   },
     *   { deep: true }
     * )
     * </script>
     * ```
     *
     * @example
     * **Reactive configuration display:**
     * ```vue
     * <template>
     *   <div>
     *     <h3>Current Configuration</h3>
     *     <div v-if="config.hasSipConfig">
     *       <p>Server: {{ config.sipConfig.uri }}</p>
     *       <p>User: {{ config.sipConfig.sipUri }}</p>
     *       <p>Display Name: {{ config.sipConfig.displayName || 'Not set' }}</p>
     *       <p>Status: {{ config.isConfigValid ? 'Valid' : 'Invalid' }}</p>
     *     </div>
     *     <div v-else>
     *       <p>No SIP configuration</p>
     *     </div>
     *
     *     <div v-if="config.mediaConfig">
     *       <h4>Media Settings</h4>
     *       <p>Echo Cancellation: {{ config.mediaConfig.audio?.echoCancellation ? 'On' : 'Off' }}</p>
     *       <p>Video: {{ config.mediaConfig.video ? 'Enabled' : 'Disabled' }}</p>
     *     </div>
     *
     *     <div v-if="config.userPreferences">
     *       <h4>User Preferences</h4>
     *       <p>Theme: {{ config.userPreferences.theme }}</p>
     *       <p>Notifications: {{ config.userPreferences.enableNotifications ? 'On' : 'Off' }}</p>
     *     </div>
     *   </div>
     * </template>
     *
     * <script setup>
     * import { useConfigProvider } from 'vuesip'
     * const config = useConfigProvider()
     * </script>
     * ```
     *
     * @see {@link ConfigProviderContext} For the complete type definition
     * @see {@link useConfigProvider} For the inject helper function
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
 * Type-safe inject helper for ConfigProvider context
 *
 * @remarks
 * Use this composable in any child component of ConfigProvider to access
 * configuration management functionality. All returned state is reactive and will
 * update automatically when configuration changes.
 *
 * **Common Use Cases:**
 *
 * 1. **Accessing Configuration:**
 *    Read SIP, media, or user preference configuration in child components
 *
 * 2. **Updating Configuration:**
 *    Modify configuration at runtime based on user actions or app logic
 *
 * 3. **Validating Configuration:**
 *    Check configuration validity and handle validation errors
 *
 * 4. **Configuration Forms:**
 *    Build UI for users to edit SIP settings, media preferences, etc.
 *
 * 5. **Multi-Provider Integration:**
 *    Share configuration between SipClientProvider, MediaProvider, and your app
 *
 * **Important Notes:**
 * - Must be called inside a component that is a child of `<ConfigProvider>`
 * - All state is reactive - use with Vue's reactivity system (watch, computed, etc.)
 * - Configuration may be `null` until explicitly set - always use optional chaining
 * - Methods support both replace (set*) and merge (update*) operations
 * - Validation can be performed automatically or manually
 *
 * @returns {ConfigProviderContext} The complete configuration provider context with state and methods
 *
 * @throws {Error} If called outside of a ConfigProvider component tree
 *
 * @example
 * **Basic configuration access:**
 * ```vue
 * <template>
 *   <div>
 *     <p v-if="config.hasSipConfig">
 *       Connected to: {{ config.sipConfig.uri }}
 *     </p>
 *     <p v-else>
 *       No SIP configuration available
 *     </p>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { computed } from 'vue'
 *
 * const config = useConfigProvider()
 *
 * // Safe access with optional chaining and defaults
 * const serverName = computed(() => {
 *   const uri = config.sipConfig?.uri
 *   return uri ? new URL(uri).hostname : 'Not configured'
 * })
 *
 * // Check validation status
 * const isReady = computed(() => {
 *   return config.hasSipConfig && config.isConfigValid
 * })
 * </script>
 * ```
 *
 * @example
 * **Watching configuration changes:**
 * ```vue
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { watch, ref } from 'vue'
 *
 * const config = useConfigProvider()
 * const statusMessage = ref('')
 *
 * // Watch for SIP configuration changes
 * watch(
 *   () => config.sipConfig,
 *   (newConfig, oldConfig) => {
 *     if (newConfig && oldConfig) {
 *       if (newConfig.uri !== oldConfig.uri) {
 *         statusMessage.value = `Server changed to ${newConfig.uri}`
 *         console.log('Reconnection may be required')
 *       }
 *       if (newConfig.displayName !== oldConfig.displayName) {
 *         statusMessage.value = `Display name changed to ${newConfig.displayName}`
 *       }
 *     } else if (newConfig && !oldConfig) {
 *       statusMessage.value = 'Configuration loaded'
 *     } else if (!newConfig && oldConfig) {
 *       statusMessage.value = 'Configuration cleared'
 *     }
 *   },
 *   { deep: true }
 * )
 *
 * // Watch for validation changes
 * watch(
 *   () => config.isConfigValid,
 *   (isValid) => {
 *     if (!isValid && config.lastValidation) {
 *       console.error('Configuration validation failed:', config.lastValidation.errors)
 *     }
 *   }
 * )
 * </script>
 * ```
 *
 * @example
 * **Using configuration in child components:**
 * ```vue
 * <!-- In parent component: App.vue -->
 * <template>
 *   <ConfigProvider :sip-config="sipConfig">
 *     <SettingsPanel />
 *     <CallInterface />
 *   </ConfigProvider>
 * </template>
 *
 * <!-- In child component: SettingsPanel.vue -->
 * <template>
 *   <div>
 *     <h3>SIP Settings</h3>
 *     <form @submit.prevent="saveSettings">
 *       <input
 *         v-model="localDisplayName"
 *         type="text"
 *         placeholder="Display Name"
 *       />
 *       <button type="submit">Save</button>
 *     </form>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { ref, watch } from 'vue'
 *
 * const config = useConfigProvider()
 *
 * // Local state for form
 * const localDisplayName = ref(config.sipConfig?.displayName ?? '')
 *
 * // Update form when config changes
 * watch(
 *   () => config.sipConfig?.displayName,
 *   (newName) => {
 *     if (newName) {
 *       localDisplayName.value = newName
 *     }
 *   }
 * )
 *
 * const saveSettings = () => {
 *   config.updateSipConfig({
 *     displayName: localDisplayName.value
 *   }, true) // validate = true
 *
 *   console.log('Settings saved')
 * }
 * </script>
 *
 * <!-- In another child component: CallInterface.vue -->
 * <template>
 *   <div>
 *     <p>Calling as: {{ displayName }}</p>
 *     <!-- Call UI here -->
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { computed } from 'vue'
 *
 * const config = useConfigProvider()
 *
 * // Automatically updates when settings change
 * const displayName = computed(() => {
 *   return config.sipConfig?.displayName ?? 'Anonymous'
 * })
 * </script>
 * ```
 *
 * @example
 * **Conditional logic based on configuration:**
 * ```vue
 * <template>
 *   <div>
 *     <!-- Show different UI based on configuration -->
 *     <ConfigurationWizard v-if="!config.hasSipConfig" />
 *     <MainApp v-else-if="config.isConfigValid" />
 *     <ValidationErrors v-else :errors="config.lastValidation?.errors" />
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { computed, onMounted } from 'vue'
 *
 * const config = useConfigProvider()
 *
 * // Computed flags for UI state
 * const needsConfiguration = computed(() => !config.hasSipConfig)
 * const hasValidConfig = computed(() => config.hasSipConfig && config.isConfigValid)
 * const hasInvalidConfig = computed(() => config.hasSipConfig && !config.isConfigValid)
 *
 * // Check configuration on mount
 * onMounted(() => {
 *   if (config.hasSipConfig) {
 *     const result = config.validateAll()
 *     if (!result.valid) {
 *       console.warn('Configuration needs attention:', result.errors)
 *     }
 *   }
 * })
 *
 * // Helper to determine if we can make calls
 * const canMakeCalls = computed(() => {
 *   return config.hasSipConfig &&
 *          config.isConfigValid &&
 *          config.sipConfig?.uri &&
 *          config.sipConfig?.sipUri &&
 *          config.sipConfig?.password
 * })
 * </script>
 * ```
 *
 * @example
 * **Advanced: Dynamic configuration with multiple servers:**
 * ```vue
 * <template>
 *   <div>
 *     <select v-model="selectedServer" @change="switchServer">
 *       <option value="primary">Primary Server</option>
 *       <option value="backup">Backup Server</option>
 *       <option value="local">Local Development</option>
 *     </select>
 *
 *     <div v-if="isSwitching">
 *       Switching servers...
 *     </div>
 *     <div v-else>
 *       Connected to: {{ currentServerName }}
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { ref, computed } from 'vue'
 *
 * const config = useConfigProvider()
 * const selectedServer = ref('primary')
 * const isSwitching = ref(false)
 *
 * const serverConfigs = {
 *   primary: {
 *     uri: 'wss://sip.example.com:7443',
 *     sipUri: 'sip:user@example.com',
 *     password: import.meta.env.VITE_PRIMARY_PASSWORD,
 *     displayName: 'User (Primary)'
 *   },
 *   backup: {
 *     uri: 'wss://sip-backup.example.com:7443',
 *     sipUri: 'sip:user@example.com',
 *     password: import.meta.env.VITE_BACKUP_PASSWORD,
 *     displayName: 'User (Backup)'
 *   },
 *   local: {
 *     uri: 'ws://localhost:5060',
 *     sipUri: 'sip:dev@localhost',
 *     password: 'dev123',
 *     displayName: 'Developer'
 *   }
 * }
 *
 * const currentServerName = computed(() => {
 *   const uri = config.sipConfig?.uri
 *   if (!uri) return 'None'
 *   try {
 *     return new URL(uri).hostname
 *   } catch {
 *     return uri
 *   }
 * })
 *
 * const switchServer = async () => {
 *   isSwitching.value = true
 *
 *   try {
 *     // Get new server configuration
 *     const newConfig = serverConfigs[selectedServer.value]
 *
 *     // Replace entire configuration
 *     config.setSipConfig(newConfig, true)
 *
 *     // Validate new configuration
 *     const result = config.validateAll()
 *     if (!result.valid) {
 *       console.error('New configuration invalid:', result.errors)
 *       throw new Error('Invalid server configuration')
 *     }
 *
 *     console.log(`Switched to ${selectedServer.value} server`)
 *
 *     // Note: SipClientProvider would need to reconnect here
 *     // You might emit an event or call a reconnect method
 *
 *   } catch (error) {
 *     console.error('Failed to switch servers:', error)
 *     alert('Failed to switch servers. Please try again.')
 *   } finally {
 *     isSwitching.value = false
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Advanced: Persisting and loading configuration:**
 * ```vue
 * <script setup>
 * import { useConfigProvider } from 'vuesip'
 * import { onMounted, watch } from 'vue'
 *
 * const config = useConfigProvider()
 *
 * // Load configuration from storage on mount
 * onMounted(() => {
 *   loadConfigFromStorage()
 * })
 *
 * // Load configuration from sessionStorage
 * const loadConfigFromStorage = () => {
 *   try {
 *     const stored = sessionStorage.getItem('vueSipConfig')
 *     if (stored) {
 *       const parsed = JSON.parse(stored)
 *
 *       // Restore SIP config
 *       if (parsed.sip) {
 *         config.setSipConfig(parsed.sip, true)
 *       }
 *
 *       // Restore media config
 *       if (parsed.media) {
 *         config.setMediaConfig(parsed.media)
 *       }
 *
 *       // Restore user preferences
 *       if (parsed.preferences) {
 *         config.setUserPreferences(parsed.preferences)
 *       }
 *
 *       console.log('Configuration loaded from storage')
 *     }
 *   } catch (error) {
 *     console.error('Failed to load configuration:', error)
 *     // Fall back to defaults or prompt user
 *   }
 * }
 *
 * // Save configuration to storage when it changes
 * // Use debounce to avoid excessive writes
 * let saveTimeout: ReturnType<typeof setTimeout>
 * const debouncedSave = () => {
 *   clearTimeout(saveTimeout)
 *   saveTimeout = setTimeout(() => {
 *     saveConfigToStorage()
 *   }, 500) // Wait 500ms after last change
 * }
 *
 * watch(
 *   () => ({
 *     sip: config.sipConfig,
 *     media: config.mediaConfig,
 *     preferences: config.userPreferences
 *   }),
 *   () => {
 *     debouncedSave()
 *   },
 *   { deep: true }
 * )
 *
 * const saveConfigToStorage = () => {
 *   try {
 *     const toSave = {
 *       sip: config.sipConfig,
 *       media: config.mediaConfig,
 *       preferences: config.userPreferences
 *     }
 *
 *     // Remove sensitive data before saving
 *     if (toSave.sip) {
 *       const { password, ...safeConfig } = toSave.sip
 *       toSave.sip = safeConfig // Don't store password
 *     }
 *
 *     sessionStorage.setItem('vueSipConfig', JSON.stringify(toSave))
 *     console.log('Configuration saved to storage')
 *   } catch (error) {
 *     console.error('Failed to save configuration:', error)
 *   }
 * }
 *
 * // Clear configuration on logout
 * const logout = () => {
 *   config.reset()
 *   sessionStorage.removeItem('vueSipConfig')
 *   console.log('Configuration cleared')
 * }
 * </script>
 * ```
 *
 * @see {@link ConfigProvider} For the provider component
 * @see {@link ConfigProviderContext} For complete context type definition
 * @see {@link SipClientProvider} For using SIP configuration
 * @see {@link MediaProvider} For using media configuration
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
