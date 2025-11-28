<template>
  <div class="basic-call-demo">
    <!-- Configuration Panel -->
    <div v-if="!isConnected" class="config-panel">
      <h3>SIP Server Configuration</h3>
      <p class="info-text">
        Configure your SIP server details to get started. You'll need access to a SIP server
        (like Asterisk, FreeSWITCH, or a hosted SIP service).
      </p>

      <div class="form-group">
        <label for="server-uri">Server URI (WebSocket)</label>
        <input
          id="server-uri"
          v-model="config.uri"
          type="text"
          placeholder="wss://sip.example.com:7443"
          :disabled="connecting"
        />
        <small>Example: wss://sip.yourdomain.com:7443</small>
      </div>

      <div class="form-group">
        <label for="sip-uri">SIP URI</label>
        <input
          id="sip-uri"
          v-model="config.sipUri"
          type="text"
          placeholder="sip:username@example.com"
          :disabled="connecting"
        />
        <small>Example: sip:1000@yourdomain.com</small>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="config.password"
          type="password"
          placeholder="Enter your SIP password"
          :disabled="connecting"
        />
      </div>

      <div class="form-group">
        <label for="display-name">Display Name (Optional)</label>
        <input
          id="display-name"
          v-model="config.displayName"
          type="text"
          placeholder="Your Name"
          :disabled="connecting"
        />
      </div>

      <!-- Remember Me Section -->
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="rememberMe" />
          <span>Remember me (persist credentials across sessions)</span>
        </label>
      </div>

      <!-- Save Password Section (conditional) -->
      <div v-if="rememberMe" class="form-group nested">
        <label class="checkbox-label">
          <input type="checkbox" v-model="savePassword" />
          <span>Save password</span>
        </label>
        <div class="security-warning">
          <p>
            ⚠️ <strong>Security Warning:</strong> Saving your password in browser
            localStorage is not secure. Only use this on trusted devices.
          </p>
        </div>
      </div>

      <!-- Clear Credentials Button (conditional) -->
      <div v-if="rememberMe" class="form-actions">
        <button type="button" class="btn btn-secondary btn-sm" @click="clearCredentials">
          Clear Saved Credentials
        </button>
      </div>

      <button
        class="btn btn-primary"
        :disabled="!isConfigValid || connecting"
        @click="handleConnect"
      >
        {{ connecting ? 'Connecting...' : 'Connect to Server' }}
      </button>

      <div v-if="connectionError" class="error-message">
        {{ connectionError }}
      </div>

      <div class="demo-tip">
        <strong>💡 Tip:</strong> Don't have a SIP server? You can use a free SIP service like
        <a href="https://www.antisip.com/" target="_blank">Antisip</a> or set up a local
        Asterisk server for testing.
      </div>
    </div>

    <!-- Connected Interface -->
    <div v-else class="connected-interface">
      <!-- Call Interface -->
      <div v-if="callState === 'idle'" class="call-panel">
        <h3>Make a Call</h3>
        <div class="dial-section">
          <input
            v-model="dialNumber"
            type="text"
            placeholder="Enter SIP URI or number (e.g., sip:2000@example.com)"
            class="dial-input"
            @keyup.enter="handleMakeCall"
          />
          <button
            class="btn btn-success"
            :disabled="!dialNumber.trim() || !isRegistered"
            @click="handleMakeCall"
          >
            📞 Call
          </button>
        </div>
      </div>

      <!-- Active Call -->
      <div v-else class="active-call">
        <div class="call-status">
          <div class="call-state">{{ callStateDisplay }}</div>
          <div v-if="remoteUri" class="remote-info">
            <div class="remote-name">
              {{ remoteDisplayName || 'Unknown' }}
            </div>
            <div class="remote-uri">{{ remoteUri }}</div>
          </div>
          <div v-if="callState === 'active' && duration" class="call-duration">
            {{ formatDuration(duration) }}
          </div>
        </div>

        <!-- Call Controls -->
        <div class="call-controls">
          <button
            v-if="callState === 'incoming'"
            class="btn btn-success"
            @click="handleAnswer"
          >
            ✓ Answer
          </button>

          <button
            v-if="callState === 'incoming'"
            class="btn btn-danger"
            @click="handleReject"
          >
            ✕ Reject
          </button>

          <button
            v-if="callState === 'active'"
            class="btn btn-secondary"
            @click="handleToggleMute"
          >
            {{ isMuted ? '🔊 Unmute' : '🔇 Mute' }}
          </button>

          <button
            v-if="callState === 'active'"
            class="btn btn-secondary"
            @click="handleToggleHold"
          >
            {{ isOnHold ? '▶️ Resume' : '⏸️ Hold' }}
          </button>

          <button
            v-if="callState !== 'idle'"
            class="btn btn-danger"
            @click="handleHangup"
          >
            📞 Hang Up
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useCallSession } from '../../src'
import { playgroundSipClient } from '../sipClient'

// localStorage keys
const CREDENTIALS_STORAGE_KEY = 'vuesip-credentials'
const CREDENTIALS_OPTIONS_KEY = 'vuesip-credentials-options'

interface StoredCredentials {
  uri: string
  sipUri: string
  password?: string
  displayName: string
  timestamp: string
}

interface CredentialsOptions {
  rememberMe: boolean
  savePassword: boolean
}

// Configuration
const config = ref({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:testuser@example.com',
  password: '',
  displayName: '',
})

// State
const connecting = ref(false)
const connectionError = ref('')
const dialNumber = ref('')
const rememberMe = ref(false)
const savePassword = ref(false)

// Use shared SIP Client instance
const { connect, disconnect, isConnected, isRegistered, error: sipError, updateConfig, getClient } = playgroundSipClient

// Call Session
const sipClientRef = computed(() => getClient())
const {
  state: callState,
  remoteUri,
  remoteDisplayName,
  isOnHold,
  isMuted,
  duration,
  makeCall,
  answer,
  reject,
  hangup,
  hold,
  unhold,
  mute,
  unmute,
} = useCallSession(sipClientRef)

// Computed
const isConfigValid = computed(() => {
  return config.value.uri && config.value.sipUri && config.value.password
})

const callStateDisplay = computed(() => {
  const states: Record<string, string> = {
    idle: 'Idle',
    calling: 'Calling...',
    incoming: 'Incoming Call',
    ringing: 'Ringing...',
    active: 'In Call',
    ended: 'Call Ended',
  }
  return states[callState.value] || callState.value
})

// Credential Persistence
const loadCredentials = (): boolean => {
  const saved = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
  const options = localStorage.getItem(CREDENTIALS_OPTIONS_KEY)

  if (saved && options) {
    try {
      const credentials: StoredCredentials = JSON.parse(saved)
      const opts: CredentialsOptions = JSON.parse(options)

      if (opts.rememberMe) {
        config.value.uri = credentials.uri || ''
        config.value.sipUri = credentials.sipUri || ''
        config.value.displayName = credentials.displayName || ''

        if (opts.savePassword && credentials.password) {
          config.value.password = credentials.password
        }

        rememberMe.value = opts.rememberMe
        savePassword.value = opts.savePassword

        return true // Credentials loaded successfully
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    }
  }

  return false // No valid credentials found
}

const saveCredentials = () => {
  if (rememberMe.value) {
    const credentials: StoredCredentials = {
      uri: config.value.uri,
      sipUri: config.value.sipUri,
      displayName: config.value.displayName,
      timestamp: new Date().toISOString(),
    }

    if (savePassword.value) {
      credentials.password = config.value.password
    }

    const options: CredentialsOptions = {
      rememberMe: rememberMe.value,
      savePassword: savePassword.value,
    }

    // Debug: Log what we're saving
    console.log('💾 BasicCallDemo: Saving credentials:', {
      uri: credentials.uri,
      sipUri: credentials.sipUri,
      displayName: credentials.displayName,
      hasPassword: !!credentials.password,
      passwordLength: credentials.password?.length,
      passwordValue: credentials.password,
      passwordChars: credentials.password ? Array.from(credentials.password).map(c => c.charCodeAt(0)) : [],
      savePassword: savePassword.value
    })

    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials))
    localStorage.setItem(CREDENTIALS_OPTIONS_KEY, JSON.stringify(options))
  } else {
    clearCredentials()
  }
}

const clearCredentials = () => {
  localStorage.removeItem(CREDENTIALS_STORAGE_KEY)
  localStorage.removeItem(CREDENTIALS_OPTIONS_KEY)
  rememberMe.value = false
  savePassword.value = false
}

// Methods
const handleConnect = async () => {
  try {
    connecting.value = true
    connectionError.value = ''

    const validationResult = updateConfig({
      uri: config.value.uri,
      sipUri: config.value.sipUri,
      password: config.value.password,
      displayName: config.value.displayName,
      autoRegister: true,
      connectionTimeout: 10000,
      registerExpires: 600,
    })

    if (!validationResult.valid) {
      throw new Error(`Invalid configuration: ${validationResult.errors?.join(', ')}`)
    }

    await connect()
  } catch (error) {
    connectionError.value = error instanceof Error ? error.message : 'Connection failed'
    console.error('Connection error:', error)
  } finally {
    connecting.value = false
  }
}

const handleDisconnect = async () => {
  try {
    if (callState.value !== 'idle') {
      await hangup()
    }
    await disconnect()
  } catch (error) {
    console.error('Disconnect error:', error)
  }
}

const handleMakeCall = async () => {
  if (!dialNumber.value.trim()) return
  try {
    await makeCall(dialNumber.value, { audio: true, video: false })
  } catch (error) {
    console.error('Make call error:', error)
    alert(`Failed to make call: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const handleAnswer = async () => {
  try {
    await answer({ audio: true, video: false })
  } catch (error) {
    console.error('Answer error:', error)
    alert(`Failed to answer: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const handleReject = async () => {
  try {
    await reject(486) // Busy Here
  } catch (error) {
    console.error('Reject error:', error)
  }
}

const handleHangup = async () => {
  try {
    await hangup()
  } catch (error) {
    console.error('Hangup error:', error)
  }
}

const handleToggleMute = async () => {
  try {
    if (isMuted.value) {
      await unmute()
    } else {
      await mute()
    }
  } catch (error) {
    console.error('Toggle mute error:', error)
  }
}

const handleToggleHold = async () => {
  try {
    if (isOnHold.value) {
      await unhold()
    } else {
      await hold()
    }
  } catch (error) {
    console.error('Toggle hold error:', error)
  }
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Load credentials and auto-connect on mount
onMounted(async () => {
  const hasCredentials = loadCredentials()

  // Note: PlaygroundApp.vue handles global auto-connect
  // This demo just loads credentials into the form
  if (hasCredentials) {
    console.log('📋 BasicCallDemo: Credentials loaded into form')

    // Only auto-connect if PlaygroundApp didn't already connect
    if (rememberMe.value && !isConnected.value) {
      console.log('🔄 BasicCallDemo: Attempting auto-connect...')

      try {
        await handleConnect()
        console.log('✅ BasicCallDemo: Auto-connected using saved credentials')
      } catch (error) {
        console.error('❌ BasicCallDemo: Auto-connect failed:', error)
        // Form remains populated for manual retry
      }
    } else if (isConnected.value) {
      console.log('✅ BasicCallDemo: Already connected via PlaygroundApp')
    }
  }
})

// Watch rememberMe checkbox
watch(rememberMe, (newValue) => {
  if (newValue) {
    saveCredentials()
  } else {
    clearCredentials()
  }
})

// Watch savePassword checkbox
watch(savePassword, () => {
  if (rememberMe.value) {
    saveCredentials()
  }
})

// Watch config changes (auto-save when rememberMe is true)
watch(
  config,
  () => {
    if (rememberMe.value) {
      saveCredentials()
    }
  },
  { deep: true }
)
</script>

<style scoped>
.basic-call-demo {
  max-width: 600px;
  margin: 0 auto;
}

.config-panel,
.connected-interface {
  padding: 1.5rem;
}

.config-panel h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.info-text {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.75rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 6px;
  font-size: 0.875rem;
}

.demo-tip {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #eff6ff;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.6;
}

.demo-tip a {
  color: #667eea;
  text-decoration: underline;
}

.call-panel h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.dial-section {
  display: flex;
  gap: 0.5rem;
}

.dial-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.dial-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.active-call {
  text-align: center;
}

.call-status {
  margin-bottom: 2rem;
}

.call-state {
  font-size: 1.5rem;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 1rem;
}

.remote-info {
  margin-bottom: 0.5rem;
}

.remote-name {
  font-size: 1.25rem;
  font-weight: 500;
  color: #333;
}

.remote-uri {
  font-size: 0.875rem;
  color: #666;
}

.call-duration {
  font-size: 2rem;
  font-weight: 300;
  color: #333;
  margin-top: 1rem;
  font-variant-numeric: tabular-nums;
}

.call-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.call-controls .btn {
  min-width: 120px;
}

/* Credential Persistence Styles */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #333;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-group.nested {
  margin-left: 1.5rem;
  background: #f9fafb;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.security-warning {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.security-warning p {
  margin: 0;
  font-size: 0.8125rem;
  color: #92400e;
  line-height: 1.5;
}

.form-actions {
  margin-bottom: 1rem;
  text-align: center;
}
</style>
