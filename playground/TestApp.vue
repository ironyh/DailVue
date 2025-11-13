<template>
  <div data-testid="sip-client">
    <div class="container">
      <header>
        <h1>VueSip - E2E Test Application</h1>
      </header>

      <main>
        <!-- Initialization Error -->
        <div v-if="initializationError" data-testid="initialization-error" class="error-message">
          <strong>Initialization Error:</strong> {{ initializationError }}
        </div>

        <!-- Connection Status -->
      <div class="status-bar">
        <div class="status-item">
          <span class="status-label">Connection:</span>
          <span
            data-testid="connection-status"
            :class="['status-indicator', { connected: isConnected }]"
          >
            {{ connectionState }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Registration:</span>
          <span
            data-testid="registration-status"
            :class="['status-indicator', { connected: isRegistered }]"
          >
            {{ isRegistered ? 'Registered' : 'Unregistered' }}
          </span>
        </div>
      </div>

      <!-- Settings Panel -->
      <div v-if="showSettings" data-testid="settings-panel" class="settings-panel">
        <h2>SIP Settings</h2>
        <div class="form-group">
          <label>SIP URI:</label>
          <input
            v-model="tempConfig.sipUri"
            data-testid="sip-uri-input"
            type="text"
            placeholder="sip:user@example.com"
          />
        </div>
        <div class="form-group">
          <label>Password:</label>
          <input
            v-model="tempConfig.password"
            data-testid="password-input"
            type="password"
            placeholder="password"
          />
        </div>
        <div class="form-group">
          <label>Server URI:</label>
          <input
            v-model="tempConfig.uri"
            data-testid="server-uri-input"
            type="text"
            placeholder="wss://sip.example.com:7443"
          />
        </div>
        <button class="btn btn-primary" data-testid="save-settings-button" @click="saveSettings">
          Save Settings
        </button>
        <div v-if="settingsSaved" data-testid="settings-saved-message" class="success-message">
          Settings saved successfully!
        </div>
        <div v-if="validationError" data-testid="validation-error" class="error-message">
          {{ validationError }}
        </div>
      </div>

      <!-- Main Interface -->
      <div v-if="!showSettings" class="main-interface">
        <!-- Connection Controls -->
        <div class="connection-controls">
          <button
            v-if="!isConnected"
            class="btn btn-primary"
            data-testid="connect-button"
            :disabled="isConnecting"
            @click="handleConnect"
          >
            {{ isConnecting ? 'Connecting...' : 'Connect' }}
          </button>
          <button
            v-else
            class="btn btn-danger"
            data-testid="disconnect-button"
            :disabled="isDisconnecting"
            @click="handleDisconnect"
          >
            {{ isDisconnecting ? 'Disconnecting...' : 'Disconnect' }}
          </button>
        </div>

        <!-- Dialpad and Call Controls -->
        <div class="row">
          <div class="col">
            <div class="dialpad-section">
              <h2>Dialpad</h2>
              <input
                v-model="dialNumber"
                data-testid="dialpad-input"
                type="text"
                class="dialpad-input"
                placeholder="Enter number or SIP URI"
              />
              <button
                class="btn btn-success"
                data-testid="call-button"
                :disabled="!dialNumber || !isConnected || isMakingCall"
                @click="handleMakeCall"
              >
                <i class="pi pi-phone"></i> {{ isMakingCall ? 'Calling...' : 'Call' }}
              </button>
            </div>

            <!-- DTMF Pad (during call) -->
            <div v-if="callState !== 'idle'" class="dtmf-section">
              <button data-testid="dialpad-toggle" class="btn btn-secondary" @click="toggleDTMF">
                {{ showDTMF ? 'Hide' : 'Show' }} DTMF Pad
              </button>
              <div v-if="showDTMF" class="dtmf-pad">
                <button
                  v-for="digit in dtmfDigits"
                  :key="digit"
                  :data-testid="`dtmf-${digit}`"
                  class="dtmf-button"
                  @click="sendDTMF(digit)"
                >
                  {{ digit }}
                </button>
              </div>
              <div v-if="dtmfFeedback" data-testid="dtmf-feedback" class="dtmf-feedback">
                Sent: {{ dtmfFeedback }}
              </div>
            </div>
          </div>

          <div class="col">
            <!-- Active Call Display -->
            <div v-if="callState !== 'idle'" class="active-call-panel" data-testid="active-call">
              <h2>Active Call</h2>
              <div data-testid="call-status" class="call-status">
                {{ callState }}
              </div>
              <div class="call-info">
                <div>Direction: {{ direction }}</div>
                <div>Remote: {{ remoteUri }}</div>
                <div v-if="answerTime">Duration: {{ formatDuration() }}</div>
              </div>

              <!-- Call Control Buttons -->
              <div class="call-controls">
                <button
                  v-if="callState === 'ringing' && direction === 'incoming'"
                  class="btn btn-success"
                  data-testid="answer-button"
                  :disabled="isAnswering"
                  @click="handleAnswer"
                >
                  {{ isAnswering ? 'Answering...' : 'Answer' }}
                </button>
                <button
                  v-if="callState === 'ringing'"
                  class="btn btn-danger"
                  data-testid="reject-button"
                  @click="handleReject"
                >
                  Reject
                </button>
                <button
                  v-if="callState === 'active'"
                  class="btn btn-secondary"
                  :data-testid="isLocalHeld ? 'unhold-button' : 'hold-button'"
                  @click="handleToggleHold"
                >
                  {{ isLocalHeld ? 'Unhold' : 'Hold' }}
                </button>
                <button
                  v-if="callState === 'active'"
                  class="btn btn-secondary"
                  data-testid="mute-audio-button"
                  @click="handleToggleMute"
                >
                  {{ isMuted ? 'Unmute' : 'Mute' }}
                </button>
                <button
                  v-if="callState === 'active'"
                  class="btn btn-secondary"
                  data-testid="toggle-video-button"
                  @click="handleToggleVideo"
                >
                  {{ videoEnabled ? 'Disable Video' : 'Enable Video' }}
                </button>
                <button
                  class="btn btn-danger"
                  data-testid="hangup-button"
                  :disabled="isHangingUp"
                  @click="handleHangup"
                >
                  {{ isHangingUp ? 'Hanging up...' : 'Hangup' }}
                </button>
              </div>

              <!-- Audio/Video Status -->
              <div class="media-status">
                <div data-testid="audio-status">Audio: {{ isMuted ? 'Muted' : 'Unmuted' }}</div>
                <div data-testid="video-status">
                  Video: {{ videoEnabled ? 'Enabled' : 'Disabled' }}
                </div>
              </div>

              <!-- Transfer Controls -->
              <div class="transfer-section">
                <button
                  class="btn btn-secondary"
                  data-testid="transfer-button"
                  @click="showTransfer = !showTransfer"
                >
                  Transfer Call
                </button>
                <div v-if="showTransfer" class="transfer-controls">
                  <input
                    v-model="transferTarget"
                    data-testid="transfer-input"
                    type="text"
                    placeholder="sip:transfer@example.com"
                  />
                  <button
                    class="btn btn-primary"
                    data-testid="confirm-transfer-button"
                    @click="handleTransfer"
                  >
                    Confirm Transfer
                  </button>
                  <div v-if="transferStatus" data-testid="transfer-status">
                    {{ transferStatus }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Incoming Call Notification -->
            <div
              v-if="direction === 'incoming' && callState === 'ringing'"
              class="incoming-notification"
              data-testid="incoming-call-notification"
            >
              <h2>Incoming Call</h2>
              <p>From: {{ remoteUri }}</p>
            </div>
          </div>
        </div>

        <!-- Call History -->
        <div class="call-history-section">
          <button
            class="btn btn-secondary"
            data-testid="call-history-button"
            @click="showHistory = !showHistory"
          >
            {{ showHistory ? 'Hide' : 'Show' }} Call History
          </button>
          <div v-if="showHistory" data-testid="call-history-panel" class="history-panel">
            <h2>Call History</h2>
            <div
              v-for="(entry, index) in history"
              :key="index"
              data-testid="history-entry"
              class="history-entry"
            >
              <div>{{ entry.remoteUri }}</div>
              <div>{{ entry.direction }} - {{ entry.startTime }}</div>
            </div>
          </div>
        </div>

        <!-- Device Settings -->
        <div class="device-settings-section">
          <button
            class="btn btn-secondary"
            data-testid="device-settings-button"
            @click="showDevices = !showDevices"
          >
            {{ showDevices ? 'Hide' : 'Show' }} Device Settings
          </button>
          <div v-if="showDevices" class="device-panel">
            <h2>Audio Devices</h2>
            <div class="form-group" data-testid="audio-input-devices">
              <label>Audio Input:</label>
              <select
                v-model="selectedAudioInputId"
                data-testid="audio-input-select"
                @change="handleInputChange"
              >
                <option
                  v-for="device in audioInputDevices"
                  :key="device.deviceId"
                  :value="device.deviceId"
                >
                  {{ device.label || 'Unknown Device' }}
                </option>
              </select>
            </div>
            <div class="form-group" data-testid="audio-output-devices">
              <label>Audio Output:</label>
              <select
                v-model="selectedAudioOutputId"
                data-testid="audio-output-select"
                @change="handleOutputChange"
              >
                <option
                  v-for="device in audioOutputDevices"
                  :key="device.deviceId"
                  :value="device.deviceId"
                >
                  {{ device.label || 'Unknown Device' }}
                </option>
              </select>
            </div>
            <div v-if="deviceChanged" data-testid="device-changed-message" class="success-message">
              Device changed successfully!
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Button -->
      <button
        class="btn btn-secondary settings-btn"
        data-testid="settings-button"
        @click="showSettings = !showSettings"
      >
        <i class="pi pi-cog"></i> {{ showSettings ? 'Close' : 'Settings' }}
      </button>

        <!-- Error Display -->
        <div v-if="lastError" data-testid="error-message" class="error-message">
          {{ lastError }}
        </div>
        <div v-if="registrationError" data-testid="registration-error" class="error-message">
          {{ registrationError }}
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  useSipClient,
  useCallSession,
  useDTMF,
  useMediaDevices,
  useCallHistory,
  useCallControls,
  validateSipUri,
  validateWebSocketUrl,
  type SipClientConfig,
} from '../src'

// Configuration
const tempConfig = ref<Partial<SipClientConfig>>({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:testuser@example.com',
  password: 'testpassword',
})

const showSettings = ref(false)
const settingsSaved = ref(false)
const showHistory = ref(false)
const showDevices = ref(false)
const showDTMF = ref(false)
const showTransfer = ref(false)
const transferTarget = ref('')
const transferStatus = ref('')
const dialNumber = ref('')
const deviceChanged = ref(false)
const dtmfFeedback = ref('')
const videoEnabled = ref(false)
const registrationError = ref('')
const validationError = ref('')
const initializationError = ref('')

// Loading states
const isConnecting = ref(false)
const isDisconnecting = ref(false)
const isMakingCall = ref(false)
const isAnswering = ref(false)
const isHangingUp = ref(false)

// Store timeout IDs for cleanup
const timeouts = ref<number[]>([])

// Initialize composables with error handling
let sipClient: ReturnType<typeof useSipClient>
let callSession: ReturnType<typeof useCallSession>
let dtmf: ReturnType<typeof useDTMF>
let mediaDevices: ReturnType<typeof useMediaDevices>
let callHistory: ReturnType<typeof useCallHistory>
let callControls: ReturnType<typeof useCallControls>

// Composable return values - Initialize with default values for reactivity
let isConnected: any = ref(false)
let isRegistered: any = ref(false)
let connectionState: any = ref('disconnected')
let lastError: any = ref(null)
let connect: any = () => Promise.resolve()
let disconnect: any = () => Promise.resolve()
let updateConfig: any = () => ({ valid: false })
let callState: any = ref('idle')
let direction: any = ref(null)
let remoteUri: any = ref('')
let isLocalHeld: any = ref(false)
let isMuted: any = ref(false)
let answerTime: any = ref(null)
let makeCall: any = () => Promise.resolve()
let answer: any = () => Promise.resolve()
let reject: any = () => Promise.resolve()
let hangup: any = () => Promise.resolve()
let hold: any = () => Promise.resolve()
let unhold: any = () => Promise.resolve()
let mute: any = () => Promise.resolve()
let unmute: any = () => Promise.resolve()
let audioInputDevices: any = ref([])
let audioOutputDevices: any = ref([])
let selectedAudioInputId: any = ref(null)
let selectedAudioOutputId: any = ref(null)
let selectAudioInput: any = () => {}
let selectAudioOutput: any = () => {}
let history: any = ref([])

try {
  // Temporarily disable composables to test if basic app mounts
  console.log('TestApp: Starting composable initialization...')

  // SIP Client - pass undefined for initialConfig, options as second parameter
  console.log('TestApp: Initializing useSipClient...')
  sipClient = useSipClient(undefined, {
    autoConnect: false,
    autoCleanup: true,
  })
  console.log('TestApp: useSipClient initialized')
  // useSipClient returns 'error' not 'lastError', so we alias it during destructuring
  ;({
    isConnected,
    isRegistered,
    connectionState,
    error: lastError,
    connect,
    disconnect,
    updateConfig,
  } = sipClient)

  // Create a computed ref for the SipClient instance
  const sipClientRef = computed(() => sipClient?.getClient() ?? null)

  // Call Session
  console.log('TestApp: Initializing useCallSession...')
  callSession = useCallSession(sipClientRef)
  console.log('TestApp: useCallSession initialized')
  ;({
    callState,
    direction,
    remoteUri,
    isLocalHeld,
    isMuted,
    answerTime,
    makeCall,
    answer,
    reject,
    hangup,
    hold,
    unhold,
    mute,
    unmute,
  } = callSession)

  // DTMF
  console.log('TestApp: Initializing useDTMF...')
  dtmf = useDTMF(callSession)
  console.log('TestApp: useDTMF initialized')

  // Media Devices - disable auto-enumerate to prevent browser crashes in E2E tests
  console.log('TestApp: Initializing useMediaDevices...')
  mediaDevices = useMediaDevices(undefined, {
    autoEnumerate: false,
    autoMonitor: false,
  })
  console.log('TestApp: useMediaDevices initialized')
  ;({
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectAudioInput,
    selectAudioOutput,
  } = mediaDevices)

  // Call History
  console.log('TestApp: Initializing useCallHistory...')
  callHistory = useCallHistory()
  console.log('TestApp: useCallHistory initialized')
  ;({ history } = callHistory)

  // Call Controls
  console.log('TestApp: Initializing useCallControls...')
  callControls = useCallControls(callSession)
  console.log('TestApp: useCallControls initialized')

  console.log('TestApp: All composables initialized successfully')

  // Watch for connection errors - must be inside try block after lastError is assigned
  watch(lastError, (error) => {
    if (error) {
      console.error('SIP Error:', error)
    }
  })
} catch (error: any) {
  initializationError.value = `Failed to initialize: ${error.message || 'Unknown error'}`
  console.error('Composable initialization error:', error)
}

const dtmfDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

// Methods
const saveSettings = () => {
  validationError.value = ''
  settingsSaved.value = false

  // Validate all required fields are present
  if (!tempConfig.value.uri || !tempConfig.value.sipUri || !tempConfig.value.password) {
    validationError.value = 'All fields are required'
    return
  }

  // Validate WebSocket URI format
  const uriValidation = validateWebSocketUrl(tempConfig.value.uri)
  if (!uriValidation.isValid) {
    validationError.value = `Invalid Server URI: ${uriValidation.error}`
    return
  }

  // Validate SIP URI format
  const sipUriValidation = validateSipUri(tempConfig.value.sipUri)
  if (!sipUriValidation.isValid) {
    validationError.value = `Invalid SIP URI: ${sipUriValidation.error}`
    return
  }

  // Validation passed - save configuration
  updateConfig(tempConfig.value as SipClientConfig)
  settingsSaved.value = true

  // Clear success message after 3 seconds
  const timeoutId = window.setTimeout(() => {
    settingsSaved.value = false
  }, 3000)
  timeouts.value.push(timeoutId)
}

const handleConnect = async () => {
  if (isConnecting.value) return
  isConnecting.value = true
  try {
    registrationError.value = ''
    await connect()
  } catch (err: any) {
    registrationError.value = err.message || 'Connection failed'
  } finally {
    isConnecting.value = false
  }
}

const handleDisconnect = async () => {
  if (isDisconnecting.value) return
  isDisconnecting.value = true
  try {
    await disconnect()
  } catch (err) {
    console.error('Disconnect error:', err)
  } finally {
    isDisconnecting.value = false
  }
}

const handleMakeCall = async () => {
  if (!dialNumber.value || isMakingCall.value) return
  isMakingCall.value = true
  try {
    await makeCall(dialNumber.value)
  } catch (err) {
    console.error('Call error:', err)
  } finally {
    isMakingCall.value = false
  }
}

const handleAnswer = async () => {
  if (isAnswering.value) return
  isAnswering.value = true
  try {
    await answer()
  } catch (err) {
    console.error('Answer error:', err)
  } finally {
    isAnswering.value = false
  }
}

const handleReject = async () => {
  try {
    await reject()
  } catch (err) {
    console.error('Reject error:', err)
  }
}

const handleHangup = async () => {
  if (isHangingUp.value) return
  isHangingUp.value = true
  try {
    await hangup()
  } catch (err) {
    console.error('Hangup error:', err)
  } finally {
    isHangingUp.value = false
  }
}

const handleToggleHold = async () => {
  try {
    if (isLocalHeld.value) {
      await unhold()
    } else {
      await hold()
    }
  } catch (err) {
    console.error('Hold/Unhold error:', err)
  }
}

const handleToggleMute = async () => {
  try {
    if (isMuted.value) {
      await unmute()
    } else {
      await mute()
    }
  } catch (err) {
    console.error('Mute/Unmute error:', err)
  }
}

const handleToggleVideo = () => {
  videoEnabled.value = !videoEnabled.value
}

const toggleDTMF = () => {
  showDTMF.value = !showDTMF.value
}

const sendDTMF = async (digit: string) => {
  try {
    await dtmf.sendTone(digit)
    dtmfFeedback.value = (dtmfFeedback.value + digit).slice(-10)
    const timeoutId = window.setTimeout(() => {
      if (dtmfFeedback.value.endsWith(digit)) {
        dtmfFeedback.value = ''
      }
    }, 3000)
    timeouts.value.push(timeoutId)
  } catch (err) {
    console.error('DTMF error:', err)
  }
}

const handleTransfer = async () => {
  if (!transferTarget.value) return
  try {
    transferStatus.value = 'Transferring...'
    await callControls.blindTransfer(transferTarget.value)
    transferStatus.value = 'Transfer initiated'
  } catch (err: any) {
    transferStatus.value = `Transfer failed: ${err.message}`
  }
}

const handleInputChange = () => {
  if (selectedAudioInputId.value) {
    selectAudioInput(selectedAudioInputId.value)
    deviceChanged.value = true
    const timeoutId = window.setTimeout(() => {
      deviceChanged.value = false
    }, 3000)
    timeouts.value.push(timeoutId)
  }
}

const handleOutputChange = () => {
  if (selectedAudioOutputId.value) {
    selectAudioOutput(selectedAudioOutputId.value)
    deviceChanged.value = true
    const timeoutId = window.setTimeout(() => {
      deviceChanged.value = false
    }, 3000)
    timeouts.value.push(timeoutId)
  }
}

const formatDuration = () => {
  if (!answerTime.value) return '00:00'
  const now = Date.now()
  const diff = Math.floor((now - answerTime.value.getTime()) / 1000)
  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Cleanup on component unmount
onUnmounted(() => {
  // Clear all pending timeouts to prevent memory leaks
  timeouts.value.forEach((timeoutId) => clearTimeout(timeoutId))
  timeouts.value = []
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f3f4f6;
  color: #1f2937;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
  color: #111827;
}

h2,
h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.status-bar {
  display: flex;
  gap: 2rem;
  justify-content: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-label {
  font-weight: 500;
}

.status-indicator {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.875rem;
}

.status-indicator.connected {
  background: #d1fae5;
  color: #065f46;
}

.settings-panel {
  max-width: 500px;
  margin: 0 auto 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb; /* Darker blue for WCAG AA contrast (4.5:1) */
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-danger {
  background: #dc2626; /* Darker red for WCAG AA contrast (4.5:1) */
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.connection-controls {
  text-align: center;
  margin-bottom: 2rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.dialpad-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.dialpad-input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.dtmf-section {
  margin-top: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.dtmf-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-top: 1rem;
}

.dtmf-button {
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 1.25rem;
  font-weight: bold;
}

.dtmf-button:hover {
  background: #f3f4f6;
}

.dtmf-feedback {
  margin-top: 1rem;
  padding: 0.5rem;
  background: #dbeafe;
  border-radius: 4px;
  text-align: center;
}

.active-call-panel {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.call-status {
  font-size: 1.25rem;
  font-weight: bold;
  color: #3b82f6;
  margin-bottom: 1rem;
  text-transform: capitalize;
}

.call-info {
  margin-bottom: 1rem;
}

.call-info > div {
  margin-bottom: 0.5rem;
}

.call-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.call-controls .btn {
  flex: 1;
  min-width: 120px;
}

.media-status {
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.transfer-section {
  margin-top: 1rem;
}

.transfer-controls {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
}

.transfer-controls input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.incoming-notification {
  padding: 1rem;
  background: #dbeafe;
  border-radius: 8px;
  text-align: center;
}

.call-history-section,
.device-settings-section {
  margin-bottom: 1rem;
}

.history-panel,
.device-panel {
  margin-top: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.history-entry {
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.settings-btn {
  margin-top: 2rem;
}

.success-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #d1fae5;
  color: #065f46;
  border-radius: 6px;
  text-align: center;
}

.error-message {
  padding: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 6px;
  margin-top: 1rem;
  text-align: center;
}

@media (max-width: 768px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
