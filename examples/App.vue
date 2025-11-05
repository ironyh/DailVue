<template>
  <div id="app">
    <div class="container">
      <h1>DailVue - SIP Interface</h1>

      <!-- Connection Status -->
      <div class="status-bar">
        <div class="status-item">
          <span class="status-label">Connection:</span>
          <span :class="['status-indicator', { connected: isConnected }]">
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Registration:</span>
          <span :class="['status-indicator', { connected: isRegistered }]">
            {{ isRegistered ? 'Registered' : 'Not Registered' }}
          </span>
        </div>
      </div>

      <!-- Connection Form -->
      <div v-if="!isConnected" class="connection-form">
        <h2>Connect to SIP Server</h2>
        <div class="form-group">
          <label>Server:</label>
          <input v-model="config.server" type="text" placeholder="sip.example.com" />
        </div>
        <div class="form-group">
          <label>Username:</label>
          <input v-model="config.username" type="text" placeholder="1000" />
        </div>
        <div class="form-group">
          <label>Password:</label>
          <input v-model="config.password" type="password" placeholder="password" />
        </div>
        <div class="form-group">
          <label>Display Name:</label>
          <input v-model="config.displayName" type="text" placeholder="John Doe" />
        </div>
        <button :disabled="isConnecting" class="btn btn-primary" @click="handleConnect">
          {{ isConnecting ? 'Connecting...' : 'Connect' }}
        </button>
      </div>

      <!-- Main Interface -->
      <div v-else class="main-interface">
        <div class="row">
          <!-- Call Controls -->
          <div class="col">
            <CallControls
              :current-call="currentCall"
              :incoming-call="incomingCall"
              :is-calling="isCalling"
              @answer="handleAnswer"
              @reject="handleReject"
              @end="handleEnd"
            />
          </div>

          <!-- Dialpad -->
          <div class="col">
            <Dialpad :is-calling="isCalling" @digit="handleDtmf" @call="handleMakeCall" />
          </div>
        </div>

        <!-- Audio Devices -->
        <div class="audio-devices">
          <h3>Audio Settings</h3>
          <div class="form-group">
            <label>Microphone:</label>
            <select v-model="selectedInputDevice" @change="handleInputChange">
              <option
                v-for="device in audioInputDevices"
                :key="device.deviceId"
                :value="device.deviceId"
              >
                {{ device.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Speaker:</label>
            <select v-model="selectedOutputDevice" @change="handleOutputChange">
              <option
                v-for="device in audioOutputDevices"
                :key="device.deviceId"
                :value="device.deviceId"
              >
                {{ device.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Disconnect Button -->
        <button class="btn btn-danger" @click="handleDisconnect">Disconnect</button>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-message">
        {{ error.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSipConnection, useSipCall, useSipDtmf, useAudioDevices } from '../src'
import type { SipConfig } from '../src'
import Dialpad from '../src/components/Dialpad.vue'
import CallControls from '../src/components/CallControls.vue'

// Configuration
const config = ref<SipConfig>({
  server: 'sip.example.com',
  username: '1000',
  password: '',
  displayName: 'DailVue User',
  autoRegister: true,
})

// SIP Connection
const { isConnected, isRegistered, isConnecting, error, connect, disconnect } = useSipConnection(
  config.value
)

// SIP Call
const userAgentRef = ref(null)
const {
  currentCall,
  incomingCall,
  isCalling,
  isInCall,
  makeCall,
  answerCall,
  endCall,
  rejectCall,
} = useSipCall(userAgentRef)

// DTMF
const currentSessionRef = ref(null)
const { sendDtmf } = useSipDtmf(currentSessionRef)

// Audio Devices
const {
  audioInputDevices,
  audioOutputDevices,
  selectedInputDevice,
  selectedOutputDevice,
  setInputDevice,
  setOutputDevice,
} = useAudioDevices()

// Handlers
const handleConnect = async () => {
  try {
    await connect()
  } catch (err) {
    console.error('Connection failed:', err)
  }
}

const handleDisconnect = async () => {
  try {
    await disconnect()
  } catch (err) {
    console.error('Disconnect failed:', err)
  }
}

const handleMakeCall = async (number: string) => {
  try {
    await makeCall(number)
  } catch (err) {
    console.error('Call failed:', err)
  }
}

const handleAnswer = async () => {
  try {
    await answerCall()
  } catch (err) {
    console.error('Answer failed:', err)
  }
}

const handleReject = async () => {
  try {
    await rejectCall()
  } catch (err) {
    console.error('Reject failed:', err)
  }
}

const handleEnd = async () => {
  try {
    await endCall()
  } catch (err) {
    console.error('End call failed:', err)
  }
}

const handleDtmf = async (digit: string) => {
  if (isInCall.value) {
    try {
      await sendDtmf(digit)
    } catch (err) {
      console.error('DTMF failed:', err)
    }
  }
}

const handleInputChange = () => {
  if (selectedInputDevice.value) {
    setInputDevice(selectedInputDevice.value)
  }
}

const handleOutputChange = () => {
  if (selectedOutputDevice.value) {
    setOutputDevice(selectedOutputDevice.value)
  }
}
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

#app {
  padding: 2rem;
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

h2 {
  margin-bottom: 1rem;
  color: #374151;
}

h3 {
  margin-bottom: 1rem;
  color: #4b5563;
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

.connection-form {
  max-width: 500px;
  margin: 0 auto;
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

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
  margin-top: 2rem;
}

.btn-danger:hover {
  background: #dc2626;
}

.main-interface {
  margin-top: 2rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .row {
    grid-template-columns: 1fr;
  }
}

.audio-devices {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.error-message {
  padding: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 6px;
  margin-top: 1rem;
  text-align: center;
}
</style>
