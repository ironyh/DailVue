/**
 * SIP Client Provider Component
 *
 * Vue component that provides comprehensive SIP client functionality to its children
 * using Vue's provide/inject pattern. Handles SIP connection lifecycle, registration,
 * event bus management, and automatic cleanup.
 *
 * @module providers/SipClientProvider
 *
 * @remarks
 * The SipClientProvider manages the complete lifecycle of a SIP client in your application:
 *
 * **SIP Connection Lifecycle:**
 * 1. Client initialization with configuration validation
 * 2. WebSocket connection to SIP server (automatic or manual based on `autoConnect`)
 * 3. SIP registration with server (automatic or manual based on `autoRegister`)
 * 4. Ready state when connected and optionally registered
 * 5. Event monitoring and state updates
 * 6. Graceful cleanup and disconnection on unmount
 *
 * **Connection States:**
 * The provider tracks two distinct state machines:
 * - **ConnectionState**: WebSocket connection status (Disconnected → Connecting → Connected)
 * - **RegistrationState**: SIP registration status (Unregistered → Registering → Registered)
 *
 * A client is considered "ready" when:
 * - With autoRegister=true: Connected AND Registered
 * - With autoRegister=false: Connected only
 *
 * **Event Bus Pattern:**
 * The provider creates a centralized EventBus for all SIP events. Child components can
 * subscribe to events like incoming calls, messages, registration changes, etc. All event
 * listeners are automatically cleaned up to prevent memory leaks.
 *
 * **Automatic vs Manual Control:**
 * - `autoConnect=true`: Connects immediately on mount (default)
 * - `autoConnect=false`: Wait for user action, use `connect()` method
 * - `autoRegister=true`: Registers immediately after connection (default)
 * - `autoRegister=false`: Manual registration control
 *
 * **Configuration Reactivity:**
 * By default, configuration changes are ignored after initialization. Enable `watchConfig`
 * to automatically reconnect when config changes (useful for dynamic server switching).
 *
 * **SIP Protocol Overview:**
 * - **WebSocket Transport**: Uses WSS (WebSocket Secure) for SIP signaling
 * - **Registration**: Announces presence to SIP server to receive calls
 * - **User Agent**: Full SIP user agent with call, message, and presence support
 * - **Standards**: Based on RFC 3261 (SIP), RFC 7118 (WebSocket Transport)
 *
 * **Browser Compatibility:**
 * - Chrome 23+: Full WebSocket and WebRTC support
 * - Firefox 18+: Full support for WebSocket and WebRTC
 * - Safari 11+: WebSocket and WebRTC supported (desktop and iOS)
 * - Edge 79+: Full support (Chromium-based)
 * - Mobile browsers: Chrome Android, Safari iOS have full WebRTC support
 * - Requirements: WebSocket API, WebRTC (RTCPeerConnection), Promises, ES6+
 *
 * **Security Requirements:**
 * - **WSS Required**: Production deployments must use secure WebSocket (wss://)
 * - **HTTPS Context**: WebRTC requires secure origin (https:// or localhost)
 * - **Credential Security**: Never hardcode credentials; use environment variables or secure storage
 * - **CORS**: SIP server must allow WebSocket connections from your origin
 * - **Authentication**: Supports SIP digest authentication (RFC 2617)
 *
 * **Type Definitions:**
 *
 * ```typescript
 * // SIP client configuration (see ../types/config.types.ts)
 * interface SipClientConfig {
 *   uri: string                    // WebSocket server URI (wss://host:port)
 *   sipUri: string                 // SIP URI (sip:user@domain)
 *   password: string               // SIP authentication password
 *   displayName?: string           // Display name for caller ID
 *   userAgentString?: string       // Custom User-Agent header
 *   transportOptions?: object      // WebSocket transport options
 *   sessionDescriptionHandlerFactoryOptions?: object  // Media options
 *   contactParams?: object         // Contact header parameters
 *   instanceId?: string            // Unique instance identifier for multiple registrations
 * }
 *
 * // Connection state enumeration
 * enum ConnectionState {
 *   Disconnected = 'disconnected',  // No WebSocket connection
 *   Connecting = 'connecting',      // WebSocket connection in progress
 *   Connected = 'connected'         // WebSocket connected to server
 * }
 *
 * // Registration state enumeration
 * enum RegistrationState {
 *   Unregistered = 'unregistered',    // Not registered with SIP server
 *   Registering = 'registering',      // Registration request in progress
 *   Registered = 'registered'          // Successfully registered, can receive calls
 * }
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API MDN: WebSocket API}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API MDN: WebRTC API}
 * @see {@link https://tools.ietf.org/html/rfc3261 RFC 3261: SIP Protocol}
 * @see {@link https://tools.ietf.org/html/rfc7118 RFC 7118: SIP over WebSocket}
 *
 * @example
 * **Basic setup with auto-connect:**
 * ```vue
 * <template>
 *   <SipClientProvider
 *     :config="sipConfig"
 *     :auto-connect="true"
 *     :auto-register="true"
 *     @ready="onSipReady"
 *   >
 *     <CallInterface />
 *   </SipClientProvider>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider } from 'vuesip'
 * import { ref } from 'vue'
 *
 * // Store credentials securely (environment variables in production)
 * const sipConfig = {
 *   uri: import.meta.env.VITE_SIP_SERVER_URI || 'wss://sip.example.com:7443',
 *   sipUri: `sip:${import.meta.env.VITE_SIP_USERNAME}@example.com`,
 *   password: import.meta.env.VITE_SIP_PASSWORD,
 *   displayName: 'Alice Smith'
 * }
 *
 * const onSipReady = () => {
 *   console.log('SIP client is connected and registered!')
 *   // Safe to make/receive calls
 * }
 * </script>
 * ```
 *
 * @example
 * **Manual connection control (autoConnect: false):**
 * ```vue
 * <template>
 *   <SipClientProvider
 *     :config="sipConfig"
 *     :auto-connect="false"
 *     :auto-register="false"
 *   >
 *     <div>
 *       <div v-if="!isConnected">
 *         <button @click="connectToServer" :disabled="connecting">
 *           {{ connecting ? 'Connecting...' : 'Connect to SIP Server' }}
 *         </button>
 *       </div>
 *       <div v-else-if="!isRegistered">
 *         <button @click="registerWithServer" :disabled="registering">
 *           {{ registering ? 'Registering...' : 'Register' }}
 *         </button>
 *       </div>
 *       <div v-else>
 *         <p>Connected and registered!</p>
 *         <button @click="disconnectFromServer">Disconnect</button>
 *       </div>
 *     </div>
 *   </SipClientProvider>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider, useSipClientProvider } from 'vuesip'
 * import { computed } from 'vue'
 *
 * const sipConfig = {
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:user@example.com',
 *   password: 'password123'
 * }
 *
 * // In child component
 * const { connectionState, registrationState, connect, disconnect, client } =
 *   useSipClientProvider()
 *
 * const isConnected = computed(() => connectionState.value === 'connected')
 * const isRegistered = computed(() => registrationState.value === 'registered')
 * const connecting = computed(() => connectionState.value === 'connecting')
 * const registering = computed(() => registrationState.value === 'registering')
 *
 * const connectToServer = async () => {
 *   try {
 *     await connect()
 *   } catch (error) {
 *     console.error('Connection failed:', error)
 *   }
 * }
 *
 * const registerWithServer = async () => {
 *   if (client.value) {
 *     try {
 *       await client.value.register()
 *     } catch (error) {
 *       console.error('Registration failed:', error)
 *     }
 *   }
 * }
 *
 * const disconnectFromServer = async () => {
 *   try {
 *     await disconnect()
 *   } catch (error) {
 *     console.error('Disconnect failed:', error)
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Event handling and monitoring:**
 * ```vue
 * <template>
 *   <SipClientProvider
 *     :config="sipConfig"
 *     @ready="onReady"
 *     @connected="onConnected"
 *     @disconnected="onDisconnected"
 *     @registered="onRegistered"
 *     @unregistered="onUnregistered"
 *     @error="onError"
 *   >
 *     <div>
 *       <StatusIndicator
 *         :connection-state="connectionState"
 *         :registration-state="registrationState"
 *       />
 *       <EventLog :events="events" />
 *     </div>
 *   </SipClientProvider>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider, useSipClientProvider } from 'vuesip'
 * import { ref, onMounted } from 'vue'
 *
 * const sipConfig = { uri: 'wss://sip.example.com', sipUri: 'sip:user@example.com', password: 'secret' }
 * const events = ref([])
 *
 * const { eventBus, connectionState, registrationState } = useSipClientProvider()
 *
 * // Provider-level event handlers
 * const onReady = () => {
 *   events.value.push({ type: 'ready', time: new Date() })
 * }
 *
 * const onConnected = () => {
 *   events.value.push({ type: 'connected', time: new Date() })
 * }
 *
 * const onDisconnected = (error) => {
 *   events.value.push({
 *     type: 'disconnected',
 *     time: new Date(),
 *     error: error?.message
 *   })
 * }
 *
 * const onRegistered = (uri) => {
 *   events.value.push({ type: 'registered', time: new Date(), uri })
 * }
 *
 * const onUnregistered = () => {
 *   events.value.push({ type: 'unregistered', time: new Date() })
 * }
 *
 * const onError = (error) => {
 *   console.error('SIP Error:', error)
 *   events.value.push({ type: 'error', time: new Date(), message: error.message })
 * }
 *
 * // Subscribe to additional SIP events via EventBus
 * onMounted(() => {
 *   // Listen for incoming calls
 *   eventBus.value.on('sip:invite', (data) => {
 *     console.log('Incoming call from:', data.remoteIdentity)
 *     events.value.push({
 *       type: 'incoming_call',
 *       time: new Date(),
 *       from: data.remoteIdentity
 *     })
 *   })
 *
 *   // Listen for messages
 *   eventBus.value.on('sip:message', (data) => {
 *     console.log('Message received:', data.body)
 *     events.value.push({
 *       type: 'message',
 *       time: new Date(),
 *       from: data.from,
 *       body: data.body
 *     })
 *   })
 * })
 * </script>
 * ```
 *
 * @example
 * **Error recovery patterns:**
 * ```vue
 * <template>
 *   <SipClientProvider
 *     :config="sipConfig"
 *     @error="handleError"
 *     @disconnected="handleDisconnect"
 *   >
 *     <div>
 *       <div v-if="lastError" class="error-banner">
 *         {{ errorMessage }}
 *         <button v-if="canRetry" @click="retry">Retry</button>
 *       </div>
 *       <CallInterface v-if="isReady" />
 *     </div>
 *   </SipClientProvider>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider, useSipClientProvider } from 'vuesip'
 * import { ref, computed } from 'vue'
 *
 * const sipConfig = { uri: 'wss://sip.example.com', sipUri: 'sip:user@example.com', password: 'secret' }
 *
 * const { error, isReady, connect, connectionState } = useSipClientProvider()
 * const lastError = ref(null)
 * const retryCount = ref(0)
 * const maxRetries = 3
 *
 * const errorMessage = computed(() => {
 *   if (!lastError.value) return ''
 *
 *   // Provide user-friendly error messages
 *   if (lastError.value.message.includes('WebSocket')) {
 *     return 'Unable to connect to server. Please check your internet connection.'
 *   }
 *   if (lastError.value.message.includes('authentication')) {
 *     return 'Authentication failed. Please check your credentials.'
 *   }
 *   if (lastError.value.message.includes('timeout')) {
 *     return 'Connection timed out. The server may be unavailable.'
 *   }
 *   return `Connection error: ${lastError.value.message}`
 * })
 *
 * const canRetry = computed(() => {
 *   return retryCount.value < maxRetries &&
 *          connectionState.value === 'disconnected'
 * })
 *
 * const handleError = (error) => {
 *   console.error('SIP error occurred:', error)
 *   lastError.value = error
 *
 *   // Log to error tracking service
 *   if (window.Sentry) {
 *     window.Sentry.captureException(error)
 *   }
 * }
 *
 * const handleDisconnect = (error) => {
 *   if (error) {
 *     console.error('Disconnected due to error:', error)
 *     // Implement exponential backoff
 *     if (retryCount.value < maxRetries) {
 *       const delay = Math.pow(2, retryCount.value) * 1000 // 1s, 2s, 4s
 *       console.log(`Retrying in ${delay}ms...`)
 *       setTimeout(() => retry(), delay)
 *     }
 *   }
 * }
 *
 * const retry = async () => {
 *   retryCount.value++
 *   lastError.value = null
 *
 *   try {
 *     await connect()
 *     retryCount.value = 0 // Reset on success
 *   } catch (error) {
 *     console.error('Retry failed:', error)
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Integration with Vue Router and state management:**
 * ```vue
 * <template>
 *   <SipClientProvider
 *     :config="sipConfig"
 *     :auto-connect="shouldAutoConnect"
 *     @ready="onSipReady"
 *     @disconnected="onDisconnected"
 *   >
 *     <RouterView />
 *   </SipClientProvider>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider, useSipClientProvider } from 'vuesip'
 * import { useRouter, useRoute } from 'vue-router'
 * import { useSipStore } from '@/stores/sipStore' // Pinia store
 * import { computed, watch } from 'vue'
 *
 * const router = useRouter()
 * const route = useRoute()
 * const sipStore = useSipStore()
 *
 * // Load config from store or localStorage
 * const sipConfig = computed(() => sipStore.config || {
 *   uri: localStorage.getItem('sip_uri') || 'wss://sip.example.com:7443',
 *   sipUri: localStorage.getItem('sip_user_uri') || 'sip:user@example.com',
 *   password: localStorage.getItem('sip_password') || ''
 * })
 *
 * // Only auto-connect when user is authenticated and on specific routes
 * const shouldAutoConnect = computed(() => {
 *   return sipStore.isAuthenticated &&
 *          (route.name === 'calls' || route.name === 'contacts')
 * })
 *
 * const { connectionState, registrationState, isReady } = useSipClientProvider()
 *
 * // Sync SIP state to Pinia store
 * watch([connectionState, registrationState, isReady], () => {
 *   sipStore.updateState({
 *     connectionState: connectionState.value,
 *     registrationState: registrationState.value,
 *     isReady: isReady.value
 *   })
 * })
 *
 * const onSipReady = () => {
 *   console.log('SIP ready, user can make calls')
 *   sipStore.setReady(true)
 *
 *   // Redirect to calls page if coming from login
 *   if (route.query.redirect === 'true') {
 *     router.push('/calls')
 *   }
 * }
 *
 * const onDisconnected = (error) => {
 *   sipStore.setReady(false)
 *
 *   if (error) {
 *     // Redirect to error page for critical errors
 *     router.push({
 *       name: 'error',
 *       query: { message: error.message }
 *     })
 *   }
 * }
 *
 * // Disconnect when navigating away from call pages
 * watch(() => route.name, (newRoute) => {
 *   if (newRoute !== 'calls' && newRoute !== 'contacts') {
 *     const { disconnect } = useSipClientProvider()
 *     disconnect()
 *   }
 * })
 * </script>
 * ```
 *
 * @example
 * **Advanced configuration with watchConfig:**
 * ```vue
 * <template>
 *   <div>
 *     <ServerSelector v-model="selectedServer" />
 *     <SipClientProvider
 *       :config="currentSipConfig"
 *       :watch-config="true"
 *       @ready="onReady"
 *     >
 *       <CallInterface />
 *     </SipClientProvider>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { SipClientProvider } from 'vuesip'
 * import { ref, computed, watch } from 'vue'
 *
 * const selectedServer = ref('production')
 *
 * const servers = {
 *   production: {
 *     uri: 'wss://sip.example.com:7443',
 *     sipUri: 'sip:user@example.com',
 *     password: 'prod_password'
 *   },
 *   staging: {
 *     uri: 'wss://sip-staging.example.com:7443',
 *     sipUri: 'sip:user@staging.example.com',
 *     password: 'staging_password'
 *   },
 *   development: {
 *     uri: 'ws://localhost:5060',
 *     sipUri: 'sip:user@localhost',
 *     password: 'dev_password'
 *   }
 * }
 *
 * const currentSipConfig = computed(() => servers[selectedServer.value])
 *
 * // With watchConfig=true, changing the config will:
 * // 1. Disconnect from current server
 * // 2. Reinitialize client with new config
 * // 3. Auto-connect to new server (if autoConnect is true)
 *
 * watch(selectedServer, (newServer) => {
 *   console.log(`Switching to ${newServer} server...`)
 * })
 *
 * const onReady = () => {
 *   console.log(`Connected to ${selectedServer.value} server`)
 * }
 * </script>
 * ```
 *
 * **Common Pitfalls:**
 *
 * **1. Hardcoding Credentials**
 * Problem: Storing SIP passwords directly in source code.
 * ```typescript
 * // ❌ BAD - credentials in source
 * const config = {
 *   uri: 'wss://sip.example.com:7443',
 *   sipUri: 'sip:user@example.com',
 *   password: 'hardcoded-password'  // Never do this!
 * }
 * ```
 * Solution: Use environment variables or secure storage.
 * ```typescript
 * // ✅ GOOD - credentials from environment
 * const config = {
 *   uri: import.meta.env.VITE_SIP_SERVER_URI,
 *   sipUri: import.meta.env.VITE_SIP_USER_URI,
 *   password: import.meta.env.VITE_SIP_PASSWORD
 * }
 * ```
 *
 * **2. Not Handling Disconnections**
 * Problem: Assuming connection stays active forever.
 * Solution: Implement reconnection logic and handle disconnection events.
 * ```typescript
 * // Listen for disconnections and implement auto-reconnect
 * <SipClientProvider @disconnected="handleDisconnect">
 *
 * const handleDisconnect = (error) => {
 *   if (error) {
 *     // Unexpected disconnection - retry
 *     setTimeout(() => reconnect(), 2000)
 *   }
 * }
 * ```
 *
 * **3. Forgetting Event Listener Cleanup**
 * Problem: Adding event listeners without removing them causes memory leaks.
 * ```typescript
 * // ❌ BAD - no cleanup
 * onMounted(() => {
 *   eventBus.value.on('sip:invite', handleInvite)
 * })
 * ```
 * Solution: Always clean up event listeners in onBeforeUnmount.
 * ```typescript
 * // ✅ GOOD - proper cleanup
 * const listenerIds = []
 *
 * onMounted(() => {
 *   const id = eventBus.value.on('sip:invite', handleInvite)
 *   listenerIds.push(id)
 * })
 *
 * onBeforeUnmount(() => {
 *   listenerIds.forEach(id => eventBus.value.removeById(id))
 * })
 * ```
 *
 * **4. Using HTTP Instead of HTTPS**
 * Problem: WebRTC requires secure context (HTTPS).
 * Solution: Always use HTTPS in production and WSS for SIP server.
 * ```typescript
 * // ❌ BAD - insecure in production
 * const config = {
 *   uri: 'ws://sip.example.com:5060'  // No TLS!
 * }
 *
 * // ✅ GOOD - secure connection
 * const config = {
 *   uri: 'wss://sip.example.com:7443'  // Encrypted
 * }
 * ```
 * Note: localhost is exempt from this requirement for development.
 *
 * **5. Not Checking isReady Before Making Calls**
 * Problem: Attempting to use client before it's fully initialized.
 * ```typescript
 * // ❌ BAD - no ready check
 * const makeCall = () => {
 *   client.value.makeCall(target)  // Might be null or not registered
 * }
 * ```
 * Solution: Always check isReady or client availability.
 * ```typescript
 * // ✅ GOOD - check before use
 * const makeCall = () => {
 *   if (!isReady.value || !client.value) {
 *     console.error('Client not ready')
 *     return
 *   }
 *   client.value.makeCall(target)
 * }
 * ```
 *
 * **6. Enabling watchConfig Without Understanding Impact**
 * Problem: Config changes disconnect all calls.
 * Solution: Only enable if you need dynamic server switching and handle active calls.
 * ```typescript
 * // Check for active calls before changing config
 * const switchServer = (newConfig) => {
 *   if (client.value?.hasActiveCalls()) {
 *     const confirm = confirm('This will end active calls. Continue?')
 *     if (!confirm) return
 *   }
 *   sipConfig.value = newConfig  // Will trigger reinitialization
 * }
 * ```
 *
 * **Performance Considerations:**
 *
 * **Connection Management:**
 * - WebSocket connections are lightweight (~1-2KB overhead)
 * - SIP keep-alives sent every 30 seconds (minimal bandwidth)
 * - Connection establishment: 100-500ms depending on network
 * - Registration: Additional 50-200ms after connection
 * - Impact on page load: Negligible if autoConnect is used wisely
 *
 * **Event Listener Overhead:**
 * - Each event listener has minimal memory footprint (~100 bytes)
 * - The provider tracks all listener IDs for cleanup
 * - Automatically removes listeners on unmount
 * - Best practice: Limit to necessary events only
 *
 * **State Updates:**
 * - All state is reactive (Vue refs)
 * - State changes trigger re-renders of dependent components
 * - Use computed values to avoid unnecessary calculations
 * - Destructure only needed properties from context
 *
 * **Re-registration:**
 * - Automatic re-registration happens every 600 seconds (10 minutes)
 * - Minimal overhead (~100ms, ~1KB network traffic)
 * - Does not affect calls in progress
 * - Does not trigger component re-renders (except state update)
 *
 * **Multiple Provider Instances:**
 * - Avoid creating multiple SipClientProvider instances
 * - Each instance creates separate WebSocket connection
 * - Use single provider at app root level
 * - Share context across components via inject
 *
 * **Best Practices:**
 * ```typescript
 * // ✅ GOOD - Single provider at root
 * <SipClientProvider :config="sipConfig">
 *   <RouterView />
 * </SipClientProvider>
 *
 * // ❌ BAD - Multiple providers
 * <SipClientProvider :config="config1">
 *   <Component1 />
 * </SipClientProvider>
 * <SipClientProvider :config="config2">
 *   <Component2 />
 * </SipClientProvider>
 * ```
 *
 * **Security Considerations:**
 *
 * **Credential Management:**
 * - Never commit credentials to version control
 * - Use environment variables for configuration
 * - Consider secure storage (browser encrypted storage, key vaults)
 * - Rotate credentials regularly
 * - Use strong, unique passwords (12+ characters)
 *
 * **Transport Security:**
 * - Always use WSS (WebSocket Secure) in production
 * - Requires valid TLS/SSL certificate on SIP server
 * - HTTPS required for WebRTC (browser security policy)
 * - localhost exempted for development only
 *
 * **Authentication:**
 * - SIP uses digest authentication (RFC 2617)
 * - Credentials never sent in plaintext
 * - Challenge-response mechanism prevents replay attacks
 * - Server validates credentials on each registration
 *
 * **CORS and WebSocket:**
 * - SIP server must allow WebSocket connections from your origin
 * - Configure CORS headers on server if needed
 * - WebSocket upgrade happens during initial HTTP request
 * - No cookies or credentials sent in WebSocket frames
 *
 * **Session Security:**
 * - Implement proper session timeout
 * - Disconnect on user logout
 * - Clear sensitive data from memory on cleanup
 * - Monitor for suspicious connection attempts
 *
 * **Configuration Validation:**
 * - The provider validates configuration on initialization
 * - Invalid configurations emit error events
 * - Validation prevents malformed SIP messages
 * - Check console logs for validation details
 *
 * **Example Secure Configuration:**
 * ```typescript
 * // Load from environment variables
 * const sipConfig = {
 *   uri: import.meta.env.VITE_SIP_SERVER_URI || 'wss://sip.example.com:7443',
 *   sipUri: `sip:${import.meta.env.VITE_SIP_USERNAME}@${import.meta.env.VITE_SIP_DOMAIN}`,
 *   password: import.meta.env.VITE_SIP_PASSWORD,
 *   displayName: import.meta.env.VITE_USER_DISPLAY_NAME,
 *   // Additional security options
 *   transportOptions: {
 *     wsServers: [
 *       'wss://sip-primary.example.com:7443',
 *       'wss://sip-backup.example.com:7443'
 *     ],
 *     maxReconnectionAttempts: 3,
 *     reconnectionTimeout: 4
 *   }
 * }
 * ```
 *
 * **Accessibility Considerations:**
 *
 * **Screen Reader Announcements:**
 * Provide status updates for connection state changes so screen reader users
 * are informed of system status.
 * ```vue
 * <template>
 *   <div>
 *     <!-- Live region for screen readers -->
 *     <div role="status" aria-live="polite" class="sr-only">
 *       {{ statusMessage }}
 *     </div>
 *
 *     <!-- Visual status indicator -->
 *     <div :class="statusClass">
 *       {{ statusLabel }}
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 * import { computed, watch } from 'vue'
 *
 * const { connectionState, registrationState, isReady } = useSipClientProvider()
 * const statusMessage = ref('')
 *
 * watch(connectionState, (state) => {
 *   switch (state) {
 *     case 'connecting':
 *       statusMessage.value = 'Connecting to phone system'
 *       break
 *     case 'connected':
 *       statusMessage.value = 'Connected to phone system'
 *       break
 *     case 'disconnected':
 *       statusMessage.value = 'Disconnected from phone system'
 *       break
 *   }
 * })
 *
 * watch(isReady, (ready) => {
 *   if (ready) {
 *     statusMessage.value = 'Phone system ready. You can now make and receive calls.'
 *   }
 * })
 * </script>
 *
 * <style>
 * .sr-only {
 *   position: absolute;
 *   width: 1px;
 *   height: 1px;
 *   padding: 0;
 *   margin: -1px;
 *   overflow: hidden;
 *   clip: rect(0, 0, 0, 0);
 *   white-space: nowrap;
 *   border-width: 0;
 * }
 * </style>
 * ```
 *
 * **Keyboard Navigation:**
 * Ensure all connection controls are keyboard accessible.
 * ```vue
 * <button
 *   @click="toggleConnection"
 *   @keypress.enter="toggleConnection"
 *   @keypress.space="toggleConnection"
 *   :aria-label="isReady ? 'Disconnect from phone system' : 'Connect to phone system'"
 * >
 *   {{ isReady ? 'Disconnect' : 'Connect' }}
 * </button>
 * ```
 *
 * **Error Messages:**
 * Provide clear, actionable error messages.
 * ```vue
 * <div v-if="error" role="alert" aria-live="assertive">
 *   <h3>Connection Error</h3>
 *   <p>{{ userFriendlyErrorMessage }}</p>
 *   <button @click="retry">Try Again</button>
 * </div>
 * ```
 *
 * **SIP Protocol Notes:**
 *
 * **What is SIP?**
 * Session Initiation Protocol (SIP) is a signaling protocol for initiating,
 * maintaining, and terminating real-time communication sessions. It's the
 * standard for VoIP calls, video conferences, and instant messaging.
 *
 * **SIP vs WebRTC:**
 * - SIP: Signaling layer (call setup, teardown, transfer)
 * - WebRTC: Media layer (audio/video transport)
 * - This library uses SIP.js which combines both
 * - WebSocket used as transport instead of UDP/TCP
 *
 * **Registration Explained:**
 * When you "register" with a SIP server, you're telling it:
 * - "I'm available at this address (WebSocket connection)"
 * - "Route calls for my SIP URI to this connection"
 * - "Keep this registration active for X seconds"
 *
 * The server then knows where to send incoming calls for your SIP URI.
 * Without registration, you can make outbound calls but won't receive incoming calls.
 *
 * **Connection vs Registration States:**
 * ```
 * Connection (Transport Layer):
 * - Disconnected: No WebSocket
 * - Connecting: WebSocket handshake in progress
 * - Connected: WebSocket established
 *
 * Registration (Application Layer):
 * - Unregistered: Not announced to server
 * - Registering: REGISTER request sent
 * - Registered: Server acknowledged, ready for calls
 * ```
 *
 * **SIP Messages:**
 * - REGISTER: Announce presence, request registration
 * - INVITE: Initiate a call
 * - ACK: Acknowledge call setup
 * - BYE: Terminate a call
 * - CANCEL: Cancel pending call
 * - OPTIONS: Query capabilities
 *
 * **Call Flow Example:**
 * ```
 * 1. Alice → INVITE → SIP Server → Bob
 * 2. Bob → 180 Ringing → Server → Alice
 * 3. Bob → 200 OK → Server → Alice
 * 4. Alice → ACK → Server → Bob
 * 5. [Media (WebRTC) flows directly between Alice and Bob]
 * 6. Alice → BYE → Server → Bob
 * 7. Bob → 200 OK → Server → Alice
 * ```
 *
 * **Authentication Flow:**
 * ```
 * 1. Client → REGISTER → Server
 * 2. Server → 401 Unauthorized (with challenge) → Client
 * 3. Client → REGISTER (with digest response) → Server
 * 4. Server → 200 OK → Client
 * ```
 *
 * @packageDocumentation
 */

import {
  defineComponent,
  provide,
  inject,
  onMounted,
  onBeforeUnmount,
  watch,
  readonly,
  ref,
  h,
  type InjectionKey,
  type Ref,
  type PropType,
} from 'vue'
import { SipClient } from '@/core/SipClient'
import { EventBus } from '@/core/EventBus'
import type { SipClientConfig } from '@/types/config.types'
import { ConnectionState, RegistrationState } from '@/types/sip.types'
import { createLogger } from '@/utils/logger'
import { validateSipConfig } from '@/utils/validators'

const logger = createLogger('SipClientProvider')

/**
 * Injection key for SIP client instance
 */
export const SipClientKey: InjectionKey<Ref<SipClient | null>> = Symbol('sip-client')

/**
 * Injection key for event bus instance
 */
export const EventBusKey: InjectionKey<Ref<EventBus>> = Symbol('event-bus')

/**
 * Injection key for connection state
 */
export const ConnectionStateKey: InjectionKey<Ref<ConnectionState>> = Symbol('connection-state')

/**
 * Injection key for registration state
 */
export const RegistrationStateKey: InjectionKey<Ref<RegistrationState>> =
  Symbol('registration-state')

/**
 * SIP Client Provider Context Interface
 *
 * @remarks
 * Complete context object provided to child components via Vue's provide/inject system.
 * Access this context using the `useSipClientProvider()` composable in any child component.
 *
 * **Context Overview:**
 * This interface defines all state and methods available to child components. It provides
 * reactive state for monitoring SIP connection status and methods for controlling the client.
 *
 * **Reactive State Properties:**
 * All state properties are reactive Vue refs that will trigger component re-renders when
 * their values change. You can use them directly in templates or watch them in composition API.
 *
 * **Read-Only State:**
 * State properties are read-only (wrapped in readonly()). To change state, use the provided
 * methods (connect, disconnect) or interact with the client directly.
 *
 * @example
 * **Accessing context in child components:**
 * ```vue
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 * import { watch } from 'vue'
 *
 * const sipContext = useSipClientProvider()
 *
 * // Access reactive state
 * console.log('Is ready:', sipContext.isReady.value)
 * console.log('Connection state:', sipContext.connectionState.value)
 *
 * // Use methods
 * await sipContext.connect()
 *
 * // Watch state changes
 * watch(() => sipContext.isReady.value, (ready) => {
 *   if (ready) {
 *     console.log('SIP client is ready!')
 *   }
 * })
 * </script>
 * ```
 *
 * @see {@link useSipClientProvider} For the inject helper function
 * @see {@link SipClient} For client instance methods
 * @see {@link EventBus} For event subscription
 */
export interface SipClientProviderContext {
  /**
   * SIP client instance
   *
   * @remarks
   * The core SipClient instance for making calls, sending messages, and managing sessions.
   * This is `null` during initialization and until the client is successfully created.
   *
   * **When Available:**
   * - After component mount and client initialization
   * - Before connection is established (can be non-null but not connected)
   * - Check `isReady` to ensure client is fully operational
   *
   * **Usage:**
   * Use this to access client methods like `makeCall()`, `sendMessage()`, `register()`, etc.
   * Always check for null before accessing methods.
   *
   * **Lifecycle:**
   * - Initially `null`
   * - Set during `initializeClient()`
   * - Remains non-null even when disconnected (can reconnect)
   * - Reset to `null` on cleanup
   *
   * @example
   * ```typescript
   * const { client } = useSipClientProvider()
   *
   * if (client.value) {
   *   await client.value.makeCall('sip:bob@example.com')
   * }
   * ```
   *
   * @see {@link SipClient} For available client methods
   */
  client: Ref<SipClient | null>

  /**
   * Event bus instance for subscribing to SIP events
   *
   * @remarks
   * Centralized event bus for all SIP-related events. Subscribe to events like
   * incoming calls, messages, call state changes, etc.
   *
   * **Available Events:**
   * - `sip:connected` - WebSocket connected
   * - `sip:disconnected` - WebSocket disconnected
   * - `sip:registered` - Successfully registered
   * - `sip:unregistered` - Unregistered
   * - `sip:registering` - Registration in progress
   * - `sip:registration_failed` - Registration failed
   * - `sip:invite` - Incoming call (INVITE received)
   * - `sip:message` - Incoming SIP MESSAGE
   * - `call:*` - Various call-related events (see EventBus documentation)
   *
   * **Event Listener Cleanup:**
   * The provider automatically removes event listeners on unmount to prevent memory leaks.
   * However, if you add listeners in child components, remove them in `onBeforeUnmount`.
   *
   * **Event Subscription Pattern:**
   * Use `eventBus.on(event, handler)` to subscribe. The method returns a listener ID
   * that can be used for removal with `eventBus.removeById(id)`.
   *
   * @example
   * ```vue
   * <script setup>
   * import { useSipClientProvider } from 'vuesip'
   * import { onMounted, onBeforeUnmount } from 'vue'
   *
   * const { eventBus } = useSipClientProvider()
   * const listenerIds = []
   *
   * onMounted(() => {
   *   // Listen for incoming calls
   *   const inviteId = eventBus.value.on('sip:invite', (data) => {
   *     console.log('Incoming call from:', data.remoteIdentity)
   *     showIncomingCallNotification(data)
   *   })
   *   listenerIds.push(inviteId)
   *
   *   // Listen for messages
   *   const messageId = eventBus.value.on('sip:message', (data) => {
   *     console.log('Message from:', data.from, data.body)
   *     showMessageNotification(data)
   *   })
   *   listenerIds.push(messageId)
   * })
   *
   * onBeforeUnmount(() => {
   *   // Clean up listeners
   *   listenerIds.forEach(id => eventBus.value.removeById(id))
   * })
   * </script>
   * ```
   *
   * @see {@link EventBus} For complete event bus API
   */
  eventBus: Ref<EventBus>

  /**
   * Current WebSocket connection state
   *
   * @remarks
   * Tracks the WebSocket connection status to the SIP server. This is transport-level state,
   * distinct from registration state.
   *
   * **Possible Values:**
   * - `'disconnected'`: No connection to server
   * - `'connecting'`: Connection attempt in progress
   * - `'connected'`: WebSocket established
   *
   * **State Transitions:**
   * ```
   * disconnected → connecting → connected
   *       ↑                          ↓
   *       └──────────────────────────┘
   * ```
   *
   * **Connection vs Registration:**
   * - Connection is required before registration
   * - Can be connected without being registered
   * - Disconnection automatically unregisters
   *
   * @example
   * ```vue
   * <template>
   *   <div :class="connectionClass">
   *     {{ connectionLabel }}
   *   </div>
   * </template>
   *
   * <script setup>
   * import { computed } from 'vue'
   * import { useSipClientProvider } from 'vuesip'
   * import { ConnectionState } from 'vuesip'
   *
   * const { connectionState } = useSipClientProvider()
   *
   * const connectionClass = computed(() => ({
   *   'status-disconnected': connectionState.value === ConnectionState.Disconnected,
   *   'status-connecting': connectionState.value === ConnectionState.Connecting,
   *   'status-connected': connectionState.value === ConnectionState.Connected
   * }))
   *
   * const connectionLabel = computed(() => {
   *   switch (connectionState.value) {
   *     case ConnectionState.Disconnected: return 'Offline'
   *     case ConnectionState.Connecting: return 'Connecting...'
   *     case ConnectionState.Connected: return 'Connected'
   *     default: return 'Unknown'
   *   }
   * })
   * </script>
   * ```
   *
   * @see {@link ConnectionState} For enum values
   * @see {@link connect} For connection method
   * @see {@link disconnect} For disconnection method
   */
  connectionState: Ref<ConnectionState>

  /**
   * Current SIP registration state
   *
   * @remarks
   * Tracks SIP registration status with the server. Registration is required to receive
   * incoming calls and announce your presence.
   *
   * **Possible Values:**
   * - `'unregistered'`: Not registered with server
   * - `'registering'`: Registration request in progress
   * - `'registered'`: Successfully registered, can receive calls
   *
   * **State Transitions:**
   * ```
   * unregistered → registering → registered
   *       ↑                          ↓
   *       └──────────────────────────┘
   * ```
   *
   * **Registration Lifecycle:**
   * - Requires active connection (must be connected first)
   * - Registrations expire and are auto-renewed
   * - Re-registrations don't change ready state
   *
   * **Registration vs Ready:**
   * - `registered`: SIP-level registration complete
   * - `isReady`: Overall readiness (connection + registration)
   *
   * @example
   * ```vue
   * <template>
   *   <div>
   *     <span class="status-indicator" :class="registrationClass"></span>
   *     {{ registrationLabel }}
   *   </div>
   * </template>
   *
   * <script setup>
   * import { computed } from 'vue'
   * import { useSipClientProvider } from 'vuesip'
   * import { RegistrationState } from 'vuesip'
   *
   * const { registrationState } = useSipClientProvider()
   *
   * const registrationClass = computed(() => ({
   *   'status-offline': registrationState.value === RegistrationState.Unregistered,
   *   'status-pending': registrationState.value === RegistrationState.Registering,
   *   'status-online': registrationState.value === RegistrationState.Registered
   * }))
   *
   * const registrationLabel = computed(() => {
   *   switch (registrationState.value) {
   *     case RegistrationState.Unregistered: return 'Offline'
   *     case RegistrationState.Registering: return 'Going online...'
   *     case RegistrationState.Registered: return 'Available'
   *     default: return 'Unknown'
   *   }
   * })
   * </script>
   * ```
   *
   * @see {@link RegistrationState} For enum values
   * @see {@link client} For manual registration via client.register()
   */
  registrationState: Ref<RegistrationState>

  /**
   * Whether the SIP client is fully ready for operation
   *
   * @remarks
   * Indicates whether the client is in a fully operational state and ready to make
   * and receive calls. This is a high-level status indicator.
   *
   * **Ready State Determination:**
   * - With `autoRegister=true`: Ready when connected AND registered
   * - With `autoRegister=false`: Ready when connected only
   *
   * **When to Check isReady:**
   * - Before enabling call UI elements
   * - Before making outbound calls
   * - To show/hide features that require SIP connectivity
   * - To gate SIP-dependent operations
   *
   * **State Lifecycle:**
   * - Initially `false`
   * - Becomes `true` after successful connection (and registration if enabled)
   * - Emits 'ready' event when transitioning to true
   * - Resets to `false` on disconnection
   * - Does NOT become true again on reconnection (use 'connected'/'registered' events)
   *
   * **Best Practice:**
   * Use this for high-level feature gating. For granular control, check
   * `connectionState` and `registrationState` directly.
   *
   * @example
   * ```vue
   * <template>
   *   <div>
   *     <div v-if="!isReady" class="loading">
   *       <spinner />
   *       <p>Connecting to phone system...</p>
   *     </div>
   *
   *     <div v-else>
   *       <button @click="makeCall" :disabled="!isReady">
   *         Make Call
   *       </button>
   *       <CallHistory v-if="isReady" />
   *     </div>
   *   </div>
   * </template>
   *
   * <script setup>
   * import { useSipClientProvider } from 'vuesip'
   *
   * const { isReady, client } = useSipClientProvider()
   *
   * const makeCall = () => {
   *   if (isReady.value && client.value) {
   *     client.value.makeCall('sip:bob@example.com')
   *   }
   * }
   * </script>
   * ```
   *
   * @see {@link connectionState} For connection details
   * @see {@link registrationState} For registration details
   */
  isReady: Ref<boolean>

  /**
   * Current error state (null if no error)
   *
   * @remarks
   * Contains the most recent error that occurred during SIP operations.
   * Useful for displaying error messages and implementing error recovery.
   *
   * **Error Sources:**
   * - Configuration validation failures
   * - Connection errors
   * - Registration failures
   * - Authentication errors
   * - Protocol errors
   *
   * **Error Lifecycle:**
   * - Set when an error occurs
   * - Cleared on successful reconnection
   * - Cleared on component cleanup
   * - Not automatically cleared (persists until next operation)
   *
   * **Error Handling Pattern:**
   * Check this ref to display error UI and provide recovery options to users.
   * Listen to the 'error' event for immediate notification of new errors.
   *
   * @example
   * ```vue
   * <template>
   *   <div>
   *     <div v-if="error" class="error-banner">
   *       <span class="error-icon">⚠️</span>
   *       <span>{{ error.message }}</span>
   *       <button @click="clearError">Dismiss</button>
   *       <button @click="retry">Retry</button>
   *     </div>
   *   </div>
   * </template>
   *
   * <script setup>
   * import { useSipClientProvider } from 'vuesip'
   *
   * const { error, connect } = useSipClientProvider()
   *
   * const clearError = () => {
   *   error.value = null
   * }
   *
   * const retry = async () => {
   *   error.value = null
   *   try {
   *     await connect()
   *   } catch (e) {
   *     // Error will be set automatically
   *   }
   * }
   * </script>
   * ```
   *
   * @see {@link error} For error event documentation
   */
  error: Ref<Error | null>

  /**
   * Programmatically connect to the SIP server
   *
   * @returns Promise that resolves when connection is established
   * @throws {Error} If client is not initialized or connection fails
   *
   * @remarks
   * Initiates a WebSocket connection to the SIP server. This method is typically
   * called automatically if `autoConnect` is true, but can be used for manual
   * connection control.
   *
   * **When to Use:**
   * - When `autoConnect` is false and you need manual connection control
   * - To reconnect after disconnection
   * - To retry failed connections
   *
   * **Connection Process:**
   * 1. Validates that client is initialized
   * 2. Initiates WebSocket connection
   * 3. Updates `connectionState` to 'connecting'
   * 4. Waits for connection to establish
   * 5. Updates `connectionState` to 'connected'
   * 6. If `autoRegister` is true, automatically begins registration
   *
   * **Error Handling:**
   * - Throws error if client is not initialized
   * - Throws error if connection fails
   * - Emits 'error' event on failure
   * - Sets `error` ref with error details
   *
   * **Best Practices:**
   * - Check `connectionState` before calling to avoid duplicate attempts
   * - Implement exponential backoff for retries
   * - Limit retry attempts to prevent infinite loops
   * - Notify user during connection attempts
   *
   * @example
   * ```typescript
   * const { connect, connectionState } = useSipClientProvider()
   *
   * const handleConnect = async () => {
   *   // Avoid duplicate connections
   *   if (connectionState.value === 'connecting' || connectionState.value === 'connected') {
   *     console.log('Already connected or connecting')
   *     return
   *   }
   *
   *   try {
   *     await connect()
   *     console.log('Connected successfully!')
   *   } catch (error) {
   *     console.error('Connection failed:', error)
   *     // Implement retry logic
   *   }
   * }
   * ```
   *
   * @example
   * **With retry logic:**
   * ```typescript
   * const connectWithRetry = async (maxAttempts = 3) => {
   *   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
   *     try {
   *       console.log(`Connection attempt ${attempt}/${maxAttempts}`)
   *       await connect()
   *       console.log('Connected!')
   *       return
   *     } catch (error) {
   *       console.error(`Attempt ${attempt} failed:`, error)
   *
   *       if (attempt < maxAttempts) {
   *         const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
   *         console.log(`Retrying in ${delay}ms...`)
   *         await new Promise(resolve => setTimeout(resolve, delay))
   *       }
   *     }
   *   }
   *   throw new Error('Failed to connect after maximum attempts')
   * }
   * ```
   *
   * @see {@link disconnect} For disconnection
   * @see {@link connectionState} For connection status
   */
  connect: () => Promise<void>

  /**
   * Programmatically disconnect from the SIP server
   *
   * @returns Promise that resolves when disconnection is complete
   * @throws {Error} If disconnection fails
   *
   * @remarks
   * Gracefully disconnects from the SIP server, unregisters, and closes the
   * WebSocket connection. This is typically called automatically on component
   * unmount if `autoCleanup` is true.
   *
   * **When to Use:**
   * - User-initiated logout or going offline
   * - Before switching to a different SIP server
   * - To implement "Do Not Disturb" mode
   * - Manual cleanup when `autoCleanup` is false
   *
   * **Disconnection Process:**
   * 1. Checks if client exists
   * 2. Sends SIP UNREGISTER (if registered)
   * 3. Closes WebSocket connection
   * 4. Updates `connectionState` to 'disconnected'
   * 5. Updates `registrationState` to 'unregistered'
   * 6. Sets `isReady` to false
   * 7. Terminates all active calls
   * 8. Emits 'disconnected' event
   *
   * **Error Handling:**
   * - Returns silently if client is not initialized
   * - Throws error if disconnection fails
   * - Emits 'error' event on failure
   * - Sets `error` ref with error details
   *
   * **Important Notes:**
   * - All active calls are terminated
   * - Event listeners remain registered (removed on component unmount)
   * - Client instance persists (can reconnect without recreation)
   * - Graceful disconnect (allows proper SIP signaling)
   *
   * @example
   * ```typescript
   * const { disconnect, isReady, client } = useSipClientProvider()
   *
   * const handleLogout = async () => {
   *   // Check for active calls first
   *   if (client.value?.hasActiveCalls()) {
   *     const confirmed = confirm('You have active calls. Disconnect anyway?')
   *     if (!confirmed) return
   *   }
   *
   *   try {
   *     await disconnect()
   *     console.log('Disconnected successfully')
   *     router.push('/login')
   *   } catch (error) {
   *     console.error('Disconnection failed:', error)
   *   }
   * }
   * ```
   *
   * @example
   * **Implementing Do Not Disturb:**
   * ```typescript
   * const { disconnect, connect, registrationState } = useSipClientProvider()
   * const doNotDisturb = ref(false)
   *
   * const toggleDoNotDisturb = async () => {
   *   try {
   *     if (doNotDisturb.value) {
   *       // Turning off DND - reconnect
   *       await connect()
   *       doNotDisturb.value = false
   *     } else {
   *       // Turning on DND - disconnect
   *       await disconnect()
   *       doNotDisturb.value = true
   *     }
   *   } catch (error) {
   *     console.error('Failed to toggle DND:', error)
   *   }
   * }
   * ```
   *
   * @see {@link connect} For reconnection
   * @see {@link connectionState} For connection status
   */
  disconnect: () => Promise<void>
}

/**
 * Injection key for complete provider context
 */
export const SipClientProviderKey: InjectionKey<SipClientProviderContext> =
  Symbol('sip-client-provider')

/**
 * SipClientProvider component
 *
 * Provides SIP client functionality to all child components via
 * Vue's dependency injection system.
 *
 * @example
 * ```ts
 * import { useSipClientProvider } from 'vuesip'
 *
 * // In child component
 * const { client, eventBus, isReady } = useSipClientProvider()
 *
 * watchEffect(() => {
 *   if (isReady.value) {
 *     console.log('SIP client is ready!')
 *   }
 * })
 * ```
 */
export const SipClientProvider = defineComponent({
  name: 'SipClientProvider',

  props: {
    /**
     * SIP client configuration object
     *
     * @remarks
     * Defines all connection parameters for the SIP client including server URI,
     * authentication credentials, and optional media settings.
     *
     * **Required Fields:**
     * - `uri`: WebSocket server URI (e.g., 'wss://sip.example.com:7443')
     * - `sipUri`: Your SIP address (e.g., 'sip:alice@example.com')
     * - `password`: SIP authentication password
     *
     * **Optional Fields:**
     * - `displayName`: Name shown to other users (caller ID)
     * - `userAgentString`: Custom User-Agent header for SIP messages
     * - `transportOptions`: WebSocket transport configuration
     * - `sessionDescriptionHandlerFactoryOptions`: Media constraints and codecs
     * - `contactParams`: Additional Contact header parameters
     * - `instanceId`: Unique ID for this registration (for multiple devices)
     *
     * **Security Best Practices:**
     * - Never hardcode credentials in source code
     * - Use environment variables for configuration
     * - Store passwords securely (encrypted storage, key vaults)
     * - Always use WSS (secure WebSocket) in production
     * - Implement proper session management and token rotation
     *
     * **Configuration Validation:**
     * The provider validates configuration on initialization and will emit an
     * 'error' event if validation fails. Check console logs for validation details.
     *
     * **Dynamic Configuration:**
     * By default, config is only used at initialization. To enable dynamic
     * reconfiguration, set `watchConfig` to true. This will reinitialize
     * the client whenever config changes.
     *
     * @example
     * **Basic configuration:**
     * ```typescript
     * const config = {
     *   uri: 'wss://sip.example.com:7443',
     *   sipUri: 'sip:alice@example.com',
     *   password: 'secret123',
     *   displayName: 'Alice Smith'
     * }
     * ```
     *
     * @example
     * **Using environment variables (recommended):**
     * ```typescript
     * const config = {
     *   uri: import.meta.env.VITE_SIP_SERVER_URI,
     *   sipUri: `sip:${import.meta.env.VITE_SIP_USERNAME}@${import.meta.env.VITE_SIP_DOMAIN}`,
     *   password: import.meta.env.VITE_SIP_PASSWORD,
     *   displayName: import.meta.env.VITE_USER_DISPLAY_NAME
     * }
     * ```
     *
     * @example
     * **Advanced configuration with media options:**
     * ```typescript
     * const config = {
     *   uri: 'wss://sip.example.com:7443',
     *   sipUri: 'sip:alice@example.com',
     *   password: 'secret123',
     *   displayName: 'Alice Smith',
     *   userAgentString: 'MyApp/1.0.0',
     *   sessionDescriptionHandlerFactoryOptions: {
     *     constraints: {
     *       audio: {
     *         echoCancellation: true,
     *         noiseSuppression: true,
     *         autoGainControl: true
     *       },
     *       video: false
     *     }
     *   },
     *   transportOptions: {
     *     wsServers: ['wss://sip.example.com:7443', 'wss://sip-backup.example.com:7443'],
     *     maxReconnectionAttempts: 5,
     *     reconnectionTimeout: 4
     *   }
     * }
     * ```
     *
     * @see {@link SipClientConfig} For complete type definition
     * @see {@link validateSipConfig} For validation rules
     */
    config: {
      type: Object as PropType<SipClientConfig>,
      required: true,
    },

    /**
     * Whether to automatically connect to SIP server on component mount
     *
     * @default true
     *
     * @remarks
     * When enabled, the provider will establish a WebSocket connection to the
     * SIP server immediately after component initialization. The connection
     * process is asynchronous and status updates are tracked via `connectionState`.
     *
     * **When to Use Auto-Connect (default true):**
     * - Single-page applications where SIP is core functionality
     * - After user completes login/authentication flow
     * - When user should always be available to receive calls
     * - In embedded call widgets that are always active
     *
     * **When to Disable (set to false):**
     * - Multi-step onboarding where user sets preferences first
     * - Applications where SIP is optional/on-demand feature
     * - When you need user confirmation before connecting
     * - When connection should wait for other resources
     * - During testing/development for more control
     *
     * **Manual Connection:**
     * When disabled, use the injected `connect()` method to establish
     * connection programmatically:
     *
     * ```typescript
     * const { connect } = useSipClientProvider()
     * await connect() // Initiate connection
     * ```
     *
     * **Connection Lifecycle:**
     * 1. Component mounts → `autoConnect=true` → Immediate connection attempt
     * 2. ConnectionState transitions: Disconnected → Connecting → Connected
     * 3. Events emitted: 'connected' on success, 'error' on failure
     * 4. If `autoRegister=true`, registration follows automatically
     *
     * **Error Handling:**
     * Connection failures emit the 'error' event. Implement error handling
     * to manage network issues, authentication failures, or server unavailability.
     *
     * **Performance Notes:**
     * - Connection is async and non-blocking
     * - Typical connection time: 100-500ms (depends on network)
     * - WebSocket keepalive maintains connection after establishment
     * - No impact on initial page load if connection is fast
     *
     * @example
     * **Manual connection after user action:**
     * ```vue
     * <template>
     *   <SipClientProvider :config="config" :auto-connect="false">
     *     <button v-if="!connected" @click="handleConnect">
     *       Connect to Phone System
     *     </button>
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { useSipClientProvider } from 'vuesip'
     *
     * const { connect, connectionState } = useSipClientProvider()
     * const connected = computed(() => connectionState.value === 'connected')
     *
     * const handleConnect = async () => {
     *   try {
     *     await connect()
     *     console.log('Connected successfully!')
     *   } catch (error) {
     *     console.error('Connection failed:', error)
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link autoRegister} For registration behavior after connection
     * @see {@link ConnectionState} For connection state values
     */
    autoConnect: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically register with SIP server after connection
     *
     * @default true
     *
     * @remarks
     * SIP registration announces your presence to the server and enables
     * you to receive incoming calls. Registration must be renewed periodically
     * (handled automatically by the client).
     *
     * **Registration vs Connection:**
     * - **Connection**: WebSocket link to server (transport layer)
     * - **Registration**: SIP-level announcement that you're available (application layer)
     * - You must be connected before you can register
     * - Registration is required to receive incoming calls
     *
     * **When to Use Auto-Register (default true):**
     * - Standard phone/call applications
     * - When user should receive calls immediately
     * - Single-user, single-device scenarios
     * - Most production use cases
     *
     * **When to Disable (set to false):**
     * - Manual registration timing control needed
     * - Multi-device scenarios (register with different instance IDs)
     * - When registration should wait for additional setup
     * - Testing scenarios where you control registration
     * - Apps that only make outbound calls (registration not required)
     *
     * **Manual Registration:**
     * When disabled, use the client's register() method:
     *
     * ```typescript
     * const { client } = useSipClientProvider()
     * await client.value?.register()
     * ```
     *
     * **Registration Lifecycle:**
     * 1. Connection established → autoRegister=true → Immediate registration
     * 2. RegistrationState: Unregistered → Registering → Registered
     * 3. Events: 'registered' on success, 'error' on failure
     * 4. Provider sets `isReady=true` when registered
     * 5. Automatic re-registration handles expiration
     *
     * **isReady Behavior:**
     * - With autoRegister=true: isReady when connected AND registered
     * - With autoRegister=false: isReady when connected only
     *
     * **Common Issues:**
     * - Authentication failures: Check credentials in config
     * - Registration timeouts: Verify server is reachable
     * - 403 Forbidden: Credentials invalid or account disabled
     * - Multiple registrations: May need unique instanceId for each device
     *
     * @example
     * **Manual registration with retry logic:**
     * ```vue
     * <script setup>
     * import { useSipClientProvider } from 'vuesip'
     * import { ref } from 'vue'
     *
     * const { client, registrationState } = useSipClientProvider()
     * const registrationError = ref(null)
     *
     * const registerWithRetry = async (maxAttempts = 3) => {
     *   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
     *     try {
     *       await client.value?.register()
     *       registrationError.value = null
     *       console.log('Registration successful')
     *       return
     *     } catch (error) {
     *       console.error(`Registration attempt ${attempt} failed:`, error)
     *       registrationError.value = error
     *
     *       if (attempt < maxAttempts) {
     *         const delay = Math.pow(2, attempt) * 1000
     *         await new Promise(resolve => setTimeout(resolve, delay))
     *       }
     *     }
     *   }
     *   throw new Error('Registration failed after maximum attempts')
     * }
     * </script>
     * ```
     *
     * @see {@link RegistrationState} For registration state values
     * @see {@link isReady} For ready state determination
     */
    autoRegister: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to automatically cleanup resources on component unmount
     *
     * @default true
     *
     * @remarks
     * When enabled, the provider will gracefully disconnect and cleanup all
     * resources when the component is unmounted. This prevents memory leaks
     * and ensures proper SIP unregistration.
     *
     * **Cleanup Process:**
     * 1. Remove all event listeners from EventBus
     * 2. Unregister from SIP server (sends REGISTER with Expires: 0)
     * 3. Close WebSocket connection
     * 4. Clear client references
     * 5. Reset state to initial values
     *
     * **When to Keep Enabled (default true):**
     * - Most applications (recommended default)
     * - When provider is mounted/unmounted dynamically
     * - During route changes that unmount the provider
     * - To prevent memory leaks and resource exhaustion
     *
     * **When to Disable (set to false):**
     * - Advanced scenarios with manual lifecycle management
     * - When you need to preserve connection across component recreations
     * - Hot module replacement during development (may interfere)
     * - Testing scenarios where you manage cleanup manually
     *
     * **Manual Cleanup:**
     * If disabled, you must manually disconnect to avoid resource leaks:
     *
     * ```typescript
     * const { disconnect } = useSipClientProvider()
     *
     * onBeforeUnmount(async () => {
     *   await disconnect()
     * })
     * ```
     *
     * **Memory Leak Prevention:**
     * The provider tracks all event listener IDs internally and removes them
     * during cleanup. This is critical for long-running applications.
     *
     * **Graceful vs Forced Cleanup:**
     * - Cleanup is synchronous (Vue lifecycle requirement)
     * - Disconnect is triggered but may not complete before unmount
     * - Server will detect disconnection via WebSocket close
     * - Registration will expire on server after TTL (typically 600s)
     *
     * **Performance Notes:**
     * - Cleanup is fast (<50ms typically)
     * - No blocking of UI during cleanup
     * - Errors during cleanup are logged but don't throw
     *
     * @example
     * **Disabling auto-cleanup with manual control:**
     * ```vue
     * <script setup>
     * import { SipClientProvider, useSipClientProvider } from 'vuesip'
     * import { onBeforeUnmount } from 'vue'
     *
     * // In provider setup
     * const { disconnect, client } = useSipClientProvider()
     *
     * // Manual cleanup with custom logic
     * onBeforeUnmount(async () => {
     *   console.log('Performing custom cleanup...')
     *
     *   // Save state before disconnecting
     *   const currentState = {
     *     wasRegistered: client.value?.isRegistered(),
     *     lastCallId: client.value?.getActiveCallId()
     *   }
     *   localStorage.setItem('sipState', JSON.stringify(currentState))
     *
     *   // Now disconnect
     *   await disconnect()
     *   console.log('Cleanup complete')
     * })
     * </script>
     * ```
     *
     * @see {@link disconnect} For manual disconnect method
     */
    autoCleanup: {
      type: Boolean,
      default: true,
    },

    /**
     * Whether to watch config changes and automatically reinitialize client
     *
     * @default false
     *
     * @remarks
     * When enabled, the provider monitors the `config` prop for changes and
     * automatically disconnects, reinitializes, and reconnects when changes
     * are detected. This is a powerful but potentially disruptive feature.
     *
     * **WARNING: Disruptive Behavior**
     * - Triggers full disconnect and reconnect cycle
     * - Drops all active calls and sessions
     * - Resets all state to initial values
     * - May cause brief service interruption
     *
     * **Reinitialization Flow:**
     * 1. Config change detected (deep comparison)
     * 2. Remove all event listeners
     * 3. Stop and disconnect current client
     * 4. Reset all state (connection, registration, ready)
     * 5. Initialize new client with new config
     * 6. Auto-connect if `autoConnect` is true
     * 7. Re-register if `autoRegister` is true
     *
     * **When to Enable:**
     * - Multi-server/multi-tenant applications
     * - Server failover scenarios
     * - Development environment with hot config reload
     * - User can switch between SIP accounts
     * - Admin panels with live server switching
     *
     * **When to Keep Disabled (default):**
     * - Production apps with static config
     * - When config rarely changes
     * - To prevent accidental disconnections
     * - When stability is critical
     * - Most standard use cases
     *
     * **Change Detection:**
     * Uses deep object comparison (JSON.stringify). Changes to any nested
     * property will trigger reinitialization. Be careful with object references.
     *
     * **Performance Implications:**
     * - Deep watch has minimal overhead for small configs
     * - Reinitialization takes 1-3 seconds typically
     * - Network latency affects reconnection time
     * - User may experience brief unavailability
     *
     * **Best Practices:**
     * - Notify users before changing config
     * - Check for active calls before switching
     * - Implement UI loading states during switch
     * - Log config changes for debugging
     * - Use stable object references (computed/ref)
     *
     * @example
     * **Dynamic server switching with user confirmation:**
     * ```vue
     * <template>
     *   <div>
     *     <select v-model="selectedServer" @change="confirmServerSwitch">
     *       <option value="us-east">US East</option>
     *       <option value="eu-west">EU West</option>
     *       <option value="ap-south">Asia Pacific</option>
     *     </select>
     *
     *     <SipClientProvider
     *       :config="currentConfig"
     *       :watch-config="true"
     *       @ready="onReconnected"
     *     >
     *       <div v-if="switching" class="switching-overlay">
     *         Switching servers...
     *       </div>
     *       <CallInterface v-else />
     *     </SipClientProvider>
     *   </div>
     * </template>
     *
     * <script setup>
     * import { ref, computed } from 'vue'
     * import { SipClientProvider, useSipClientProvider } from 'vuesip'
     *
     * const selectedServer = ref('us-east')
     * const switching = ref(false)
     *
     * const servers = {
     *   'us-east': {
     *     uri: 'wss://us-east-sip.example.com:7443',
     *     sipUri: 'sip:user@us-east.example.com',
     *     password: 'password'
     *   },
     *   'eu-west': {
     *     uri: 'wss://eu-west-sip.example.com:7443',
     *     sipUri: 'sip:user@eu-west.example.com',
     *     password: 'password'
     *   },
     *   'ap-south': {
     *     uri: 'wss://ap-south-sip.example.com:7443',
     *     sipUri: 'sip:user@ap-south.example.com',
     *     password: 'password'
     *   }
     * }
     *
     * const currentConfig = computed(() => servers[selectedServer.value])
     *
     * const { client } = useSipClientProvider()
     *
     * const confirmServerSwitch = async () => {
     *   // Check for active calls
     *   if (client.value?.hasActiveCalls()) {
     *     const confirmed = confirm(
     *       'You have active calls. Switching servers will disconnect them. Continue?'
     *     )
     *     if (!confirmed) {
     *       // Revert selection
     *       selectedServer.value = currentServer.value
     *       return
     *     }
     *   }
     *
     *   switching.value = true
     *   // Config change will trigger automatic reinitialization
     * }
     *
     * const onReconnected = () => {
     *   switching.value = false
     *   console.log(`Connected to ${selectedServer.value} server`)
     * }
     * </script>
     * ```
     *
     * @example
     * **Reactive config from Pinia store:**
     * ```vue
     * <script setup>
     * import { computed } from 'vue'
     * import { useSipStore } from '@/stores/sipStore'
     *
     * const sipStore = useSipStore()
     *
     * // Config automatically updates when store changes
     * const sipConfig = computed(() => sipStore.currentServerConfig)
     *
     * // Any change to sipStore.currentServerConfig will trigger reinitialization
     * </script>
     *
     * <template>
     *   <SipClientProvider :config="sipConfig" :watch-config="true">
     *     <YourApp />
     *   </SipClientProvider>
     * </template>
     * ```
     *
     * @see {@link config} For configuration structure
     */
    watchConfig: {
      type: Boolean,
      default: false,
    },
  },

  emits: {
    /**
     * Emitted when the SIP client is fully ready to make and receive calls
     *
     * @remarks
     * **When Emitted:**
     * - After successful connection AND registration (if `autoRegister` is true)
     * - After successful connection only (if `autoRegister` is false)
     * - This is the signal that the client is fully operational
     *
     * **Ready State Determination:**
     * - With `autoRegister=true`: Emitted after both connection and registration succeed
     * - With `autoRegister=false`: Emitted after connection succeeds (no registration needed)
     *
     * **Use Cases:**
     * - Enable call buttons and UI elements
     * - Start presence monitoring
     * - Load call history or contacts
     * - Update user status to "Available"
     * - Initialize call-dependent features
     *
     * **Lifecycle Position:**
     * This is typically the last initialization event, signaling that all SIP
     * operations are available:
     * 1. Component mounts
     * 2. Client initializes
     * 3. 'connected' event fires
     * 4. (If autoRegister) 'registered' event fires
     * 5. 'ready' event fires ← You are here
     *
     * **Important Notes:**
     * - Only emitted once per successful initialization
     * - Not emitted again on reconnection (use 'connected'/'registered' for that)
     * - Check `isReady` ref for current ready state at any time
     * - Ready state is reset to false on disconnection
     *
     * @example
     * ```vue
     * <template>
     *   <SipClientProvider :config="sipConfig" @ready="onSipReady">
     *     <div v-if="!ready" class="loading">
     *       Connecting to phone system...
     *     </div>
     *     <div v-else>
     *       <CallInterface />
     *       <button @click="makeCall">Make Call</button>
     *     </div>
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { ref } from 'vue'
     *
     * const ready = ref(false)
     *
     * const onSipReady = () => {
     *   ready.value = true
     *   console.log('SIP client ready for calls!')
     *   // Initialize call-dependent features
     *   loadCallHistory()
     *   updateUserStatus('available')
     * }
     * </script>
     * ```
     *
     * @see {@link isReady} For reactive ready state
     * @see {@link connected} For connection event
     * @see {@link registered} For registration event
     */
    ready: () => true,

    /**
     * Emitted when WebSocket connection to SIP server is established
     *
     * @remarks
     * **When Emitted:**
     * - After successful WebSocket connection to the SIP server
     * - Before registration (if `autoRegister` is enabled)
     * - After manual `connect()` call succeeds
     *
     * **Connection Process:**
     * 1. WebSocket handshake initiated
     * 2. TLS/SSL negotiation (for WSS)
     * 3. WebSocket connection established
     * 4. 'connected' event emitted
     * 5. (If autoRegister) Automatic registration begins
     *
     * **State Transitions:**
     * - `connectionState` changes from 'connecting' to 'connected'
     * - Client is now connected but may not be registered yet
     * - Can send SIP messages but can't receive incoming calls yet (until registered)
     *
     * **Use Cases:**
     * - Update UI connection status indicator
     * - Log connection telemetry
     * - Start connection-dependent operations
     * - Display "Connected" status to user
     * - Begin health monitoring
     *
     * **Connection vs Ready:**
     * - **connected**: WebSocket established, can send SIP messages
     * - **ready**: Fully operational, can make AND receive calls
     * - Connection is a prerequisite for registration
     *
     * **Auto-Registration:**
     * If `autoRegister` is true, registration will automatically begin after
     * this event. Watch for the 'registered' and 'ready' events to follow.
     *
     * @example
     * ```vue
     * <template>
     *   <SipClientProvider
     *     :config="sipConfig"
     *     @connected="onConnected"
     *     @registered="onRegistered"
     *     @ready="onReady"
     *   >
     *     <StatusIndicator
     *       :connected="connected"
     *       :registered="registered"
     *       :ready="ready"
     *     />
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { ref } from 'vue'
     *
     * const connected = ref(false)
     * const registered = ref(false)
     * const ready = ref(false)
     *
     * const onConnected = () => {
     *   connected.value = true
     *   console.log('WebSocket connected to SIP server')
     *   // Update status indicator to "Connecting..." or "Registering..."
     * }
     *
     * const onRegistered = (uri) => {
     *   registered.value = true
     *   console.log('Registered as:', uri)
     * }
     *
     * const onReady = () => {
     *   ready.value = true
     *   console.log('Fully ready for calls')
     * }
     * </script>
     * ```
     *
     * @see {@link connectionState} For reactive connection state
     * @see {@link registered} For registration event
     * @see {@link ConnectionState} For state enumeration
     */
    connected: () => true,

    /**
     * Emitted when WebSocket connection to SIP server is closed
     *
     * @param error - Optional Error object if disconnection was due to an error
     *
     * @remarks
     * **When Emitted:**
     * - WebSocket connection is closed or lost
     * - After manual `disconnect()` call
     * - Network interruption or server unavailability
     * - Authentication failure (after connected)
     * - Server-initiated disconnect
     *
     * **Event Payload:**
     * - `error`: Present if disconnection was unexpected or due to error
     * - `undefined`: Clean disconnect (user-initiated or normal shutdown)
     *
     * **State Transitions:**
     * - `connectionState` changes to 'disconnected'
     * - `registrationState` changes to 'unregistered'
     * - `isReady` changes to false
     * - All active calls are terminated
     *
     * **Disconnection Scenarios:**
     *
     * **Clean Disconnect (no error):**
     * - User called `disconnect()` method
     * - Component unmounted with `autoCleanup=true`
     * - Manual unregistration before disconnect
     *
     * **Error Disconnect (with error):**
     * - Network connectivity lost
     * - Server crashed or became unavailable
     * - WebSocket timeout
     * - Server rejected connection (authentication issues)
     *
     * **Reconnection Strategies:**
     * This event is a good place to implement auto-reconnection logic:
     * - Check if disconnection was unexpected (error present)
     * - Implement exponential backoff
     * - Limit retry attempts
     * - Notify user of connection loss
     *
     * **Important Notes:**
     * - Active calls are automatically terminated
     * - Event listeners remain registered (use EventBus for call cleanup)
     * - Client instance persists (can reconnect without recreation)
     * - User may need to be notified of connection loss
     *
     * @example
     * ```vue
     * <template>
     *   <SipClientProvider
     *     :config="sipConfig"
     *     @disconnected="onDisconnected"
     *   >
     *     <div v-if="disconnectedError" class="error-banner">
     *       Connection lost: {{ disconnectedError.message }}
     *       <button @click="reconnect">Reconnect</button>
     *     </div>
     *     <CallInterface />
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { ref } from 'vue'
     * import { useSipClientProvider } from 'vuesip'
     *
     * const { connect } = useSipClientProvider()
     * const disconnectedError = ref(null)
     * const retryCount = ref(0)
     * const maxRetries = 3
     *
     * const onDisconnected = (error) => {
     *   if (error) {
     *     // Unexpected disconnection
     *     console.error('Disconnected due to error:', error)
     *     disconnectedError.value = error
     *
     *     // Implement auto-reconnect with exponential backoff
     *     if (retryCount.value < maxRetries) {
     *       const delay = Math.pow(2, retryCount.value) * 1000 // 1s, 2s, 4s
     *       console.log(`Auto-reconnecting in ${delay}ms...`)
     *       setTimeout(reconnect, delay)
     *     } else {
     *       console.error('Max reconnection attempts reached')
     *       // Notify user to manually reconnect
     *     }
     *   } else {
     *     // Clean disconnect (user-initiated)
     *     console.log('Disconnected successfully')
     *     disconnectedError.value = null
     *     retryCount.value = 0
     *   }
     * }
     *
     * const reconnect = async () => {
     *   retryCount.value++
     *   try {
     *     await connect()
     *     disconnectedError.value = null
     *     retryCount.value = 0 // Reset on success
     *     console.log('Reconnected successfully')
     *   } catch (error) {
     *     console.error('Reconnection failed:', error)
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link connectionState} For reactive connection state
     * @see {@link connect} For reconnection method
     * @see {@link error} For error event
     */
    disconnected: (_error?: Error) => true,

    /**
     * Emitted when successfully registered with the SIP server
     *
     * @param uri - The SIP URI that was registered (e.g., 'sip:alice@example.com')
     *
     * @remarks
     * **When Emitted:**
     * - After successful SIP REGISTER request/response
     * - After manual `client.register()` call succeeds
     * - After auto-registration (if `autoRegister` is true)
     * - After re-registration (automatic, happens periodically)
     *
     * **Event Payload:**
     * - `uri`: The SIP address that is now registered
     * - This is your "phone number" on the SIP network
     * - Incoming calls to this URI will now be received
     *
     * **Registration Details:**
     * - Registration announces your presence to the SIP server
     * - Server knows where to route incoming calls for your URI
     * - Registrations expire and must be renewed (handled automatically)
     * - Default registration TTL is typically 600 seconds (10 minutes)
     *
     * **State Transitions:**
     * - `registrationState` changes from 'registering' to 'registered'
     * - `isReady` changes to true (if this is initial registration)
     * - Can now receive incoming calls
     *
     * **Use Cases:**
     * - Update UI to show "Available" or "Online" status
     * - Enable incoming call notifications
     * - Display the registered SIP URI to user
     * - Log successful registration for diagnostics
     * - Update user presence information
     *
     * **Registration vs Ready:**
     * - 'registered' event: SIP registration complete
     * - 'ready' event: Fires immediately after initial registration
     * - Re-registrations emit 'registered' but not 'ready'
     *
     * **Automatic Re-registration:**
     * The client automatically renews registration before expiration.
     * This event will fire multiple times during a session:
     * 1. Initial registration after connection
     * 2. Periodic re-registrations (before expiration)
     * 3. After temporary registration loss and recovery
     *
     * @example
     * ```vue
     * <template>
     *   <SipClientProvider
     *     :config="sipConfig"
     *     @registered="onRegistered"
     *     @unregistered="onUnregistered"
     *   >
     *     <div class="status">
     *       <span :class="statusClass">{{ statusText }}</span>
     *       <span v-if="registeredUri">{{ registeredUri }}</span>
     *     </div>
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { ref, computed } from 'vue'
     *
     * const registeredUri = ref(null)
     * const isRegistered = ref(false)
     *
     * const statusClass = computed(() => ({
     *   'status-online': isRegistered.value,
     *   'status-offline': !isRegistered.value
     * }))
     *
     * const statusText = computed(() =>
     *   isRegistered.value ? 'Available' : 'Offline'
     * )
     *
     * const onRegistered = (uri) => {
     *   isRegistered.value = true
     *   registeredUri.value = uri
     *   console.log('Successfully registered as:', uri)
     *
     *   // Update user presence
     *   updatePresenceStatus('available')
     *
     *   // Enable incoming call notifications
     *   enableCallNotifications()
     *
     *   // Log for diagnostics
     *   logEvent('sip_registered', { uri, timestamp: Date.now() })
     * }
     *
     * const onUnregistered = () => {
     *   isRegistered.value = false
     *   registeredUri.value = null
     *   console.log('Unregistered from SIP server')
     *
     *   updatePresenceStatus('offline')
     *   disableCallNotifications()
     * }
     * </script>
     * ```
     *
     * @example
     * **Tracking registration history:**
     * ```vue
     * <script setup>
     * import { ref } from 'vue'
     *
     * const registrationHistory = ref([])
     *
     * const onRegistered = (uri) => {
     *   const event = {
     *     uri,
     *     timestamp: new Date(),
     *     type: registrationHistory.value.length === 0 ? 'initial' : 're-registration'
     *   }
     *
     *   registrationHistory.value.push(event)
     *
     *   console.log('Registration event:', event)
     *
     *   // Keep only last 50 events
     *   if (registrationHistory.value.length > 50) {
     *     registrationHistory.value.shift()
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link registrationState} For reactive registration state
     * @see {@link unregistered} For unregistration event
     * @see {@link RegistrationState} For state enumeration
     */
    registered: (_uri: string) => true,

    /**
     * Emitted when unregistered from the SIP server
     *
     * @remarks
     * **When Emitted:**
     * - After manual unregistration (calling `client.unregister()`)
     * - When disconnecting from server
     * - When registration expires and renewal fails
     * - During component unmount with `autoCleanup` enabled
     * - Before switching servers (with `watchConfig` enabled)
     *
     * **State Transitions:**
     * - `registrationState` changes to 'unregistered'
     * - `isReady` changes to false (unless `autoRegister` is false)
     * - Can no longer receive incoming calls
     * - Outgoing calls may still work (depends on server configuration)
     *
     * **Unregistration Process:**
     * 1. Client sends REGISTER with Expires: 0 (SIP unregister message)
     * 2. Server acknowledges and removes registration
     * 3. 'unregistered' event emitted
     * 4. Server will no longer route calls to this client
     *
     * **Use Cases:**
     * - Update UI to show "Offline" or "Unavailable" status
     * - Disable incoming call features
     * - Log unregistration for diagnostics
     * - Clear call-related state
     * - Update user presence to "Away" or "Offline"
     *
     * **Unregistration vs Disconnection:**
     * - Unregistration: SIP-level action, can be temporary
     * - Disconnection: Transport-level, closes WebSocket
     * - Disconnection always triggers unregistration
     * - Unregistration doesn't necessarily mean disconnection
     *
     * **Common Scenarios:**
     *
     * **Intentional Unregistration:**
     * - User logs out or goes offline
     * - User pauses call availability
     * - Application shutdown
     *
     * **Unexpected Unregistration:**
     * - Registration renewal failed (server error)
     * - Network issues prevented renewal
     * - Server rejected re-registration
     *
     * **Auto-Reregistration:**
     * The client will attempt to re-register if the unregistration was
     * unexpected (e.g., temporary network issue). Watch for 'registered'
     * event to know when registration is restored.
     *
     * @example
     * ```vue
     * <template>
     *   <SipClientProvider
     *     :config="sipConfig"
     *     @registered="onRegistered"
     *     @unregistered="onUnregistered"
     *   >
     *     <div>
     *       <div v-if="!isRegistered" class="warning">
     *         You are offline and cannot receive calls
     *       </div>
     *       <button
     *         @click="toggleRegistration"
     *         :disabled="!connected"
     *       >
     *         {{ isRegistered ? 'Go Offline' : 'Go Online' }}
     *       </button>
     *     </div>
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { ref } from 'vue'
     * import { useSipClientProvider } from 'vuesip'
     *
     * const { client, connectionState } = useSipClientProvider()
     * const isRegistered = ref(false)
     * const connected = computed(() => connectionState.value === 'connected')
     *
     * const onRegistered = (uri) => {
     *   isRegistered.value = true
     *   console.log('Now available for calls')
     *   showNotification('You are now online', 'success')
     * }
     *
     * const onUnregistered = () => {
     *   isRegistered.value = false
     *   console.log('No longer receiving calls')
     *   showNotification('You are now offline', 'info')
     *
     *   // Clear any pending call notifications
     *   clearCallNotifications()
     * }
     *
     * const toggleRegistration = async () => {
     *   if (!client.value) return
     *
     *   try {
     *     if (isRegistered.value) {
     *       await client.value.unregister()
     *     } else {
     *       await client.value.register()
     *     }
     *   } catch (error) {
     *     console.error('Failed to toggle registration:', error)
     *     showNotification('Failed to change status', 'error')
     *   }
     * }
     * </script>
     * ```
     *
     * @see {@link registrationState} For reactive registration state
     * @see {@link registered} For registration event
     * @see {@link disconnected} For disconnection event
     */
    unregistered: () => true,

    /**
     * Emitted when an error occurs during SIP operations
     *
     * @param error - Error object containing details about what went wrong
     *
     * @remarks
     * **When Emitted:**
     * - Configuration validation fails
     * - Connection to SIP server fails
     * - Registration fails or is rejected
     * - Authentication errors
     * - Network errors during operation
     * - Protocol errors (malformed SIP messages)
     *
     * **Error Categories:**
     *
     * **Configuration Errors:**
     * - Invalid SIP URI format
     * - Missing required fields
     * - Invalid server URI
     * - Message: "Invalid SIP configuration: ..."
     *
     * **Connection Errors:**
     * - WebSocket connection failed
     * - DNS resolution failed
     * - Server unreachable
     * - Timeout during connection
     * - Message: "Connection failed...", "WebSocket error..."
     *
     * **Authentication Errors:**
     * - Invalid credentials
     * - Password incorrect
     * - Account disabled or suspended
     * - Authorization failed
     * - Message: "Authentication failed...", "403 Forbidden"
     *
     * **Registration Errors:**
     * - Registration request timeout
     * - Server rejected registration
     * - Maximum registrations exceeded
     * - Message: "Registration failed: ..."
     *
     * **Network Errors:**
     * - Connection lost during operation
     * - DNS lookup failed
     * - Firewall blocking connection
     * - Message: Network-related error messages
     *
     * **Error Handling Strategy:**
     * 1. Check `error.message` for user-friendly description
     * 2. Determine if error is recoverable
     * 3. Implement appropriate retry logic
     * 4. Notify user with actionable information
     * 5. Log error for debugging and monitoring
     *
     * **Recoverable vs Non-Recoverable:**
     *
     * **Recoverable (retry possible):**
     * - Network timeouts
     * - Temporary server unavailability
     * - Transient network issues
     *
     * **Non-Recoverable (user action needed):**
     * - Invalid credentials
     * - Malformed configuration
     * - Account disabled
     * - Unsupported server
     *
     * **Error Event vs Specific Events:**
     * - Configuration errors: Emit 'error' only
     * - Connection failures: May emit 'error' AND 'disconnected'
     * - Registration failures: Emit 'error' but connection remains
     *
     * @example
     * ```vue
     * <template>
     *   <SipClientProvider :config="sipConfig" @error="onError">
     *     <div v-if="currentError" class="error-notification">
     *       <strong>{{ errorTitle }}</strong>
     *       <p>{{ errorMessage }}</p>
     *       <button v-if="errorAction" @click="errorAction.handler">
     *         {{ errorAction.label }}
     *       </button>
     *     </div>
     *   </SipClientProvider>
     * </template>
     *
     * <script setup>
     * import { ref, computed } from 'vue'
     * import { useSipClientProvider } from 'vuesip'
     *
     * const { connect, client } = useSipClientProvider()
     * const currentError = ref(null)
     *
     * const errorTitle = computed(() => {
     *   if (!currentError.value) return ''
     *
     *   const msg = currentError.value.message
     *   if (msg.includes('authentication')) return 'Authentication Failed'
     *   if (msg.includes('configuration')) return 'Configuration Error'
     *   if (msg.includes('WebSocket') || msg.includes('connection')) {
     *     return 'Connection Failed'
     *   }
     *   if (msg.includes('Registration')) return 'Registration Failed'
     *   return 'Error Occurred'
     * })
     *
     * const errorMessage = computed(() => {
     *   if (!currentError.value) return ''
     *
     *   const msg = currentError.value.message
     *
     *   // Provide user-friendly messages
     *   if (msg.includes('authentication')) {
     *     return 'Your username or password is incorrect. Please check your credentials.'
     *   }
     *   if (msg.includes('configuration')) {
     *     return 'The SIP configuration is invalid. Please contact support.'
     *   }
     *   if (msg.includes('WebSocket')) {
     *     return 'Unable to connect to the server. Please check your internet connection.'
     *   }
     *   if (msg.includes('Registration failed: 403')) {
     *     return 'Access denied. Your account may be disabled or credentials are invalid.'
     *   }
     *   if (msg.includes('timeout')) {
     *     return 'Connection timed out. The server may be unavailable.'
     *   }
     *
     *   // Fallback to original message
     *   return msg
     * })
     *
     * const errorAction = computed(() => {
     *   if (!currentError.value) return null
     *
     *   const msg = currentError.value.message
     *
     *   if (msg.includes('authentication')) {
     *     return {
     *       label: 'Update Credentials',
     *       handler: () => router.push('/settings/credentials')
     *     }
     *   }
     *
     *   if (msg.includes('WebSocket') || msg.includes('timeout')) {
     *     return {
     *       label: 'Retry Connection',
     *       handler: async () => {
     *         currentError.value = null
     *         try {
     *           await connect()
     *         } catch (e) {
     *           // Error will be caught by onError again
     *         }
     *       }
     *     }
     *   }
     *
     *   if (msg.includes('configuration')) {
     *     return {
     *       label: 'Contact Support',
     *       handler: () => window.open('https://support.example.com', '_blank')
     *     }
     *   }
     *
     *   return null
     * })
     *
     * const onError = (error) => {
     *   console.error('SIP Error:', error)
     *   currentError.value = error
     *
     *   // Log to error tracking service
     *   if (window.Sentry) {
     *     window.Sentry.captureException(error, {
     *       tags: { component: 'SipClientProvider' },
     *       extra: { message: error.message }
     *     })
     *   }
     *
     *   // Analytics tracking
     *   trackEvent('sip_error', {
     *     error_type: errorTitle.value,
     *     error_message: error.message
     *   })
     * }
     * </script>
     * ```
     *
     * @see {@link disconnected} For disconnection events
     * @see {@link error} For reactive error state
     */
    error: (_error: Error) => true,
  },

  setup(props, { emit, slots }) {
    // Create event bus instance (shared across provider)
    const eventBus = ref<EventBus>(new EventBus())

    // SIP client instance
    const client = ref<SipClient | null>(null)

    // Reactive state
    const connectionState = ref<ConnectionState>(ConnectionState.Disconnected)
    const registrationState = ref<RegistrationState>(RegistrationState.Unregistered)
    const isReady = ref(false)
    const error = ref<Error | null>(null)

    // Track event listener IDs for cleanup
    const eventListenerIds = ref<string[]>([])

    /**
     * Initialize SIP client with configuration
     */
    const initializeClient = (): void => {
      try {
        // Validate configuration
        const validation = validateSipConfig(props.config)
        if (!validation.valid) {
          const err = new Error(`Invalid SIP configuration: ${validation.errors?.join(', ')}`)
          logger.error('Configuration validation failed', { validation })
          error.value = err
          emit('error', err)
          return
        }

        logger.info('Initializing SIP client', {
          uri: props.config.uri,
          sipUri: props.config.sipUri,
        })

        // Create SIP client instance
        client.value = new SipClient(props.config, eventBus.value as EventBus)

        // Setup event listeners
        setupEventListeners()

        logger.debug('SIP client initialized successfully')
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to initialize SIP client', err)
        error.value = errorObj
        emit('error', errorObj)
      }
    }

    /**
     * Setup event listeners for SIP client events
     * Tracks listener IDs for proper cleanup
     */
    const setupEventListeners = (): void => {
      if (!client.value) return

      // Connection events
      const connectedId = eventBus.value.on('sip:connected', () => {
        logger.info('SIP client connected')
        connectionState.value = ConnectionState.Connected
        emit('connected')

        // Auto-register if enabled
        if (props.autoRegister && client.value) {
          client.value.register().catch((err) => {
            logger.error('Auto-registration failed', err)
            const errorObj = err instanceof Error ? err : new Error(String(err))
            error.value = errorObj
            emit('error', errorObj)
          })
        } else if (!props.autoRegister) {
          // If not auto-registering, client is ready once connected
          isReady.value = true
          emit('ready')
        }
      })
      eventListenerIds.value.push(connectedId)

      const disconnectedId = eventBus.value.on(
        'sip:disconnected',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data?: any) => {
          logger.info('SIP client disconnected', data)
          connectionState.value = ConnectionState.Disconnected
          registrationState.value = RegistrationState.Unregistered
          isReady.value = false

          const errorObj = data?.error ? new Error(data.error) : undefined
          emit('disconnected', errorObj)
        }
      )
      eventListenerIds.value.push(disconnectedId)

      const connectingId = eventBus.value.on('sip:connecting', () => {
        logger.debug('SIP client connecting')
        connectionState.value = ConnectionState.Connecting
      })
      eventListenerIds.value.push(connectingId)

      // Registration events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registeredId = eventBus.value.on('sip:registered', (data: any) => {
        logger.info('SIP client registered', data)
        registrationState.value = RegistrationState.Registered
        isReady.value = true
        emit('registered', data.uri)
        emit('ready')
      })
      eventListenerIds.value.push(registeredId)

      const unregisteredId = eventBus.value.on('sip:unregistered', () => {
        logger.info('SIP client unregistered')
        registrationState.value = RegistrationState.Unregistered
        emit('unregistered')
      })
      eventListenerIds.value.push(unregisteredId)

      const registeringId = eventBus.value.on('sip:registering', () => {
        logger.debug('SIP client registering')
        registrationState.value = RegistrationState.Registering
      })
      eventListenerIds.value.push(registeringId)

      const registrationFailedId = eventBus.value.on(
        'sip:registration_failed',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any) => {
          logger.error('SIP registration failed', data)
          registrationState.value = RegistrationState.Unregistered
          const errorObj = new Error(`Registration failed: ${data.cause}`)
          error.value = errorObj
          emit('error', errorObj)
        }
      )
      eventListenerIds.value.push(registrationFailedId)

      logger.debug(`Registered ${eventListenerIds.value.length} event listeners`)
    }

    /**
     * Remove all event listeners to prevent memory leaks
     */
    const removeEventListeners = (): void => {
      logger.debug(`Removing ${eventListenerIds.value.length} event listeners`)
      eventListenerIds.value.forEach((id) => {
        eventBus.value.removeById(id)
      })
      eventListenerIds.value = []
    }

    /**
     * Connect to SIP server
     */
    const connect = async (): Promise<void> => {
      if (!client.value) {
        const err = new Error('SIP client not initialized')
        logger.error(err.message)
        error.value = err
        emit('error', err)
        throw err
      }

      try {
        logger.info('Connecting to SIP server')
        await client.value.start()
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to connect', err)
        error.value = errorObj
        emit('error', errorObj)
        throw errorObj
      }
    }

    /**
     * Disconnect from SIP server and cleanup
     */
    const disconnect = async (): Promise<void> => {
      if (!client.value) {
        logger.debug('No client to disconnect')
        return
      }

      try {
        logger.info('Disconnecting from SIP server')
        await client.value.stop()
        isReady.value = false
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to disconnect', err)
        error.value = errorObj
        emit('error', errorObj)
        throw errorObj
      }
    }

    /**
     * Cleanup resources
     * Note: This is intentionally synchronous to work properly with Vue lifecycle
     */
    const cleanup = (): void => {
      logger.debug('Cleaning up SIP client provider')

      // Remove event listeners first to prevent further updates
      removeEventListeners()

      // Stop client if connected (synchronously - fire and forget)
      if (client.value) {
        client.value.stop().catch((err) => {
          logger.warn('Error stopping client during cleanup', err)
        })
      }

      // Clear references
      client.value = null
      isReady.value = false
      error.value = null
      connectionState.value = ConnectionState.Disconnected
      registrationState.value = RegistrationState.Unregistered
    }

    /**
     * Reinitialize client with new config
     * Used when config changes (if watchConfig is enabled)
     */
    const reinitializeClient = async (): Promise<void> => {
      logger.info('Config changed, reinitializing client')

      // Cleanup existing client
      removeEventListeners()
      if (client.value) {
        try {
          await client.value.stop()
        } catch (err) {
          logger.warn('Error stopping client during reinitialization', err)
        }
      }

      // Reset state
      connectionState.value = ConnectionState.Disconnected
      registrationState.value = RegistrationState.Unregistered
      isReady.value = false
      error.value = null

      // Reinitialize
      initializeClient()

      // Auto-connect if enabled
      if (props.autoConnect && client.value) {
        try {
          await connect()
        } catch (err) {
          logger.error('Auto-connect failed during reinitialization', err)
        }
      }
    }

    // Watch config changes (if enabled)
    if (props.watchConfig) {
      watch(
        () => props.config,
        async (newConfig, oldConfig) => {
          // Only reinitialize if config actually changed
          if (JSON.stringify(newConfig) !== JSON.stringify(oldConfig)) {
            await reinitializeClient()
          }
        },
        { deep: true }
      )
    }

    // Lifecycle hooks
    onMounted(async () => {
      logger.debug('SipClientProvider mounted')

      // Initialize client
      initializeClient()

      // Auto-connect if enabled
      if (props.autoConnect && client.value) {
        try {
          await connect()
        } catch (err) {
          logger.error('Auto-connect failed', err)
          // Error already emitted in connect()
        }
      }
    })

    onBeforeUnmount(() => {
      logger.debug('SipClientProvider unmounting')

      if (props.autoCleanup) {
        cleanup()
      }
    })

    // Create provider context
    const providerContext: SipClientProviderContext = {
      client: readonly(client) as Ref<SipClient | null>,
      eventBus: readonly(eventBus) as Ref<EventBus>,
      connectionState: readonly(connectionState) as Ref<ConnectionState>,
      registrationState: readonly(registrationState) as Ref<RegistrationState>,
      isReady: readonly(isReady) as Ref<boolean>,
      error: readonly(error) as Ref<Error | null>,
      connect,
      disconnect,
    }

    // Provide context to children
    provide(SipClientProviderKey, providerContext)
    provide(SipClientKey, readonly(client) as Ref<SipClient | null>)
    provide(EventBusKey, readonly(eventBus) as Ref<EventBus>)
    provide(ConnectionStateKey, readonly(connectionState) as Ref<ConnectionState>)
    provide(RegistrationStateKey, readonly(registrationState) as Ref<RegistrationState>)

    // Render default slot
    return () => {
      if (slots.default) {
        return h('div', { class: 'sip-client-provider' }, slots.default())
      }
      return null
    }
  },
})

/**
 * Composable for accessing SIP Client Provider context
 *
 * @returns {SipClientProviderContext} Complete SIP client context with state and methods
 * @throws {Error} If called outside of a SipClientProvider component tree
 *
 * @remarks
 * Type-safe composable for accessing SIP client functionality in child components.
 * Must be called inside a component that is a descendant of `<SipClientProvider>`.
 *
 * **What You Get:**
 * - Reactive state (client, connectionState, registrationState, isReady, error)
 * - Event bus for subscribing to SIP events
 * - Control methods (connect, disconnect)
 * - All state is reactive and will trigger re-renders when changed
 *
 * **When to Use:**
 * - In any child component that needs SIP functionality
 * - To display connection status
 * - To make or receive calls
 * - To handle SIP events
 * - To control connection lifecycle
 *
 * **Best Practices:**
 * - Call at the top level of your setup function
 * - Destructure only the properties you need
 * - Use `.value` to access reactive values
 * - Watch state changes for reactive updates
 * - Clean up event listeners in onBeforeUnmount
 *
 * **Common Patterns:**
 *
 * **1. Connection Status Display:**
 * Monitor connection and registration states to show user their current status.
 *
 * **2. Call Controls:**
 * Access client instance to make calls, check for active calls, etc.
 *
 * **3. Event Handling:**
 * Subscribe to incoming calls, messages, and other SIP events via event bus.
 *
 * **4. Connection Management:**
 * Use connect/disconnect methods for manual connection control.
 *
 * @example
 * **Basic usage in a call component:**
 * ```vue
 * <template>
 *   <div>
 *     <div v-if="!isReady" class="status-offline">
 *       Connecting...
 *     </div>
 *     <div v-else class="status-online">
 *       Connected as {{ sipUri }}
 *     </div>
 *
 *     <button
 *       @click="makeCall"
 *       :disabled="!isReady || calling"
 *     >
 *       {{ calling ? 'Calling...' : 'Call Bob' }}
 *     </button>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 * import { ref, computed } from 'vue'
 *
 * const { client, isReady } = useSipClientProvider()
 * const calling = ref(false)
 *
 * const sipUri = computed(() => {
 *   // Extract display name or URI from client config
 *   return client.value?.getConfig().displayName || 'User'
 * })
 *
 * const makeCall = async () => {
 *   if (!client.value || !isReady.value) {
 *     console.error('Client not ready')
 *     return
 *   }
 *
 *   calling.value = true
 *   try {
 *     await client.value.makeCall('sip:bob@example.com')
 *     console.log('Call initiated')
 *   } catch (error) {
 *     console.error('Call failed:', error)
 *   } finally {
 *     calling.value = false
 *   }
 * }
 * </script>
 * ```
 *
 * @example
 * **Watching connection state changes:**
 * ```vue
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 * import { watch, ref } from 'vue'
 * import { ConnectionState, RegistrationState } from 'vuesip'
 *
 * const { connectionState, registrationState, isReady } = useSipClientProvider()
 * const statusHistory = ref([])
 *
 * // Watch connection state changes
 * watch(connectionState, (newState, oldState) => {
 *   console.log(`Connection: ${oldState} → ${newState}`)
 *
 *   const event = {
 *     timestamp: new Date(),
 *     type: 'connection',
 *     from: oldState,
 *     to: newState
 *   }
 *   statusHistory.value.push(event)
 *
 *   // Update UI based on state
 *   if (newState === ConnectionState.Connected) {
 *     showNotification('Connected to server', 'success')
 *   } else if (newState === ConnectionState.Disconnected) {
 *     showNotification('Disconnected from server', 'warning')
 *   }
 * })
 *
 * // Watch registration state changes
 * watch(registrationState, (newState, oldState) => {
 *   console.log(`Registration: ${oldState} → ${newState}`)
 *
 *   const event = {
 *     timestamp: new Date(),
 *     type: 'registration',
 *     from: oldState,
 *     to: newState
 *   }
 *   statusHistory.value.push(event)
 *
 *   if (newState === RegistrationState.Registered) {
 *     showNotification('You are now available', 'success')
 *   } else if (newState === RegistrationState.Unregistered && oldState === RegistrationState.Registered) {
 *     showNotification('You are now offline', 'info')
 *   }
 * })
 *
 * // Watch ready state
 * watch(isReady, (ready) => {
 *   if (ready) {
 *     console.log('SIP client fully ready!')
 *     // Initialize call-dependent features
 *     loadCallHistory()
 *     enableCallNotifications()
 *   }
 * })
 * </script>
 * ```
 *
 * @example
 * **Handling errors with retry logic:**
 * ```vue
 * <template>
 *   <div>
 *     <div v-if="error" class="error-alert">
 *       <strong>Error:</strong> {{ errorMessage }}
 *       <button @click="retry" :disabled="retrying">
 *         {{ retrying ? 'Retrying...' : 'Retry' }}
 *       </button>
 *       <button @click="clearError">Dismiss</button>
 *     </div>
 *
 *     <div v-if="retryCount > 0" class="info">
 *       Retry attempts: {{ retryCount }}/{{ maxRetries }}
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 * import { ref, computed, watch } from 'vue'
 *
 * const { error, connect, connectionState } = useSipClientProvider()
 *
 * const retrying = ref(false)
 * const retryCount = ref(0)
 * const maxRetries = 3
 *
 * const errorMessage = computed(() => {
 *   if (!error.value) return ''
 *
 *   // Provide user-friendly error messages
 *   const msg = error.value.message
 *   if (msg.includes('WebSocket')) {
 *     return 'Unable to connect to server. Please check your internet connection.'
 *   }
 *   if (msg.includes('authentication')) {
 *     return 'Login failed. Please check your credentials.'
 *   }
 *   if (msg.includes('timeout')) {
 *     return 'Connection timed out. The server may be unavailable.'
 *   }
 *   return msg
 * })
 *
 * const retry = async () => {
 *   if (retryCount.value >= maxRetries) {
 *     console.error('Maximum retry attempts reached')
 *     alert('Unable to connect after multiple attempts. Please try again later.')
 *     return
 *   }
 *
 *   retrying.value = true
 *   retryCount.value++
 *
 *   // Exponential backoff
 *   const delay = Math.pow(2, retryCount.value) * 1000
 *   console.log(`Retrying in ${delay}ms (attempt ${retryCount.value}/${maxRetries})`)
 *   await new Promise(resolve => setTimeout(resolve, delay))
 *
 *   try {
 *     await connect()
 *     // Success - reset retry count
 *     retryCount.value = 0
 *   } catch (err) {
 *     console.error('Retry failed:', err)
 *   } finally {
 *     retrying.value = false
 *   }
 * }
 *
 * const clearError = () => {
 *   error.value = null
 *   retryCount.value = 0
 * }
 *
 * // Auto-retry on connection errors
 * watch(error, (newError) => {
 *   if (newError && retryCount.value < maxRetries) {
 *     console.log('Auto-retrying connection...')
 *     setTimeout(() => retry(), 2000)
 *   }
 * })
 *
 * // Reset retry count on successful connection
 * watch(connectionState, (state) => {
 *   if (state === 'connected') {
 *     retryCount.value = 0
 *   }
 * })
 * </script>
 * ```
 *
 * @example
 * **Making and receiving calls with event bus:**
 * ```vue
 * <template>
 *   <div>
 *     <!-- Outgoing call UI -->
 *     <div class="outgoing-call">
 *       <input v-model="callTarget" placeholder="sip:user@example.com" />
 *       <button @click="makeCall" :disabled="!isReady">
 *         Call
 *       </button>
 *     </div>
 *
 *     <!-- Incoming call notification -->
 *     <div v-if="incomingCall" class="incoming-call-modal">
 *       <h3>Incoming Call</h3>
 *       <p>From: {{ incomingCall.remoteIdentity }}</p>
 *       <button @click="acceptCall">Accept</button>
 *       <button @click="rejectCall">Reject</button>
 *     </div>
 *
 *     <!-- Active call UI -->
 *     <div v-if="activeCall" class="active-call">
 *       <p>Call in progress with {{ activeCall.remoteIdentity }}</p>
 *       <button @click="endCall">End Call</button>
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useSipClientProvider } from 'vuesip'
 * import { ref, onMounted, onBeforeUnmount } from 'vue'
 *
 * const { client, eventBus, isReady } = useSipClientProvider()
 *
 * const callTarget = ref('')
 * const incomingCall = ref(null)
 * const activeCall = ref(null)
 * const eventListenerIds = []
 *
 * const makeCall = async () => {
 *   if (!client.value || !callTarget.value) return
 *
 *   try {
 *     const session = await client.value.makeCall(callTarget.value)
 *     activeCall.value = {
 *       session,
 *       remoteIdentity: callTarget.value
 *     }
 *     console.log('Call initiated')
 *   } catch (error) {
 *     console.error('Failed to make call:', error)
 *     alert(`Call failed: ${error.message}`)
 *   }
 * }
 *
 * const acceptCall = async () => {
 *   if (!incomingCall.value) return
 *
 *   try {
 *     await incomingCall.value.session.accept()
 *     activeCall.value = incomingCall.value
 *     incomingCall.value = null
 *     console.log('Call accepted')
 *   } catch (error) {
 *     console.error('Failed to accept call:', error)
 *   }
 * }
 *
 * const rejectCall = () => {
 *   if (!incomingCall.value) return
 *
 *   try {
 *     incomingCall.value.session.reject()
 *     incomingCall.value = null
 *     console.log('Call rejected')
 *   } catch (error) {
 *     console.error('Failed to reject call:', error)
 *   }
 * }
 *
 * const endCall = () => {
 *   if (!activeCall.value) return
 *
 *   try {
 *     activeCall.value.session.terminate()
 *     activeCall.value = null
 *     console.log('Call ended')
 *   } catch (error) {
 *     console.error('Failed to end call:', error)
 *   }
 * }
 *
 * onMounted(() => {
 *   // Listen for incoming calls
 *   const inviteId = eventBus.value.on('sip:invite', (data) => {
 *     console.log('Incoming call from:', data.remoteIdentity)
 *     incomingCall.value = {
 *       session: data.session,
 *       remoteIdentity: data.remoteIdentity
 *     }
 *
 *     // Play ringtone
 *     playRingtone()
 *   })
 *   eventListenerIds.push(inviteId)
 *
 *   // Listen for call termination
 *   const terminatedId = eventBus.value.on('call:terminated', (data) => {
 *     console.log('Call terminated:', data.reason)
 *     activeCall.value = null
 *     incomingCall.value = null
 *
 *     // Stop ringtone
 *     stopRingtone()
 *   })
 *   eventListenerIds.push(terminatedId)
 *
 *   // Listen for call accepted
 *   const acceptedId = eventBus.value.on('call:accepted', (data) => {
 *     console.log('Call accepted')
 *     stopRingtone()
 *   })
 *   eventListenerIds.push(acceptedId)
 * })
 *
 * onBeforeUnmount(() => {
 *   // Clean up event listeners
 *   eventListenerIds.forEach(id => {
 *     eventBus.value.removeById(id)
 *   })
 *
 *   // End active call if any
 *   if (activeCall.value) {
 *     activeCall.value.session.terminate()
 *   }
 *
 *   // Reject incoming call if any
 *   if (incomingCall.value) {
 *     incomingCall.value.session.reject()
 *   }
 * })
 * </script>
 * ```
 *
 * @see {@link SipClientProvider} For the provider component
 * @see {@link SipClientProviderContext} For complete context type definition
 * @see {@link SipClient} For client instance methods
 * @see {@link EventBus} For event bus API
 */
export function useSipClientProvider(): SipClientProviderContext {
  const context = inject(SipClientProviderKey)

  if (!context) {
    throw new Error(
      'useSipClientProvider() must be called inside a component that is a child of <SipClientProvider>'
    )
  }

  return context
}
