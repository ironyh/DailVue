<template>
  <div class="conference-call-demo">
    <h2>👥 Conference Call Management</h2>
    <p class="description">Manage multiple simultaneous calls and create conference sessions.</p>

    <!-- Connection Status -->
    <div class="status-section">
      <div :class="['status-badge', connectionState]">
        {{ connectionState.toUpperCase() }}
      </div>
      <div class="stats">
        <span>Active Calls: {{ activeCalls.length }}</span>
        <span>Conference: {{ isConferenceActive ? 'Active' : 'Inactive' }}</span>
      </div>
    </div>

    <!-- SIP Configuration -->
    <div class="config-section">
      <h3>SIP Configuration</h3>
      <div class="form-group">
        <label>SIP Server URI</label>
        <input v-model="sipServerUri" type="text" placeholder="sip:example.com" />
      </div>
      <div class="form-group">
        <label>Username</label>
        <input v-model="username" type="text" placeholder="user123" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input v-model="password" type="password" placeholder="password" />
      </div>
      <button @click="toggleConnection" :disabled="isConnecting">
        {{ isConnected ? 'Disconnect' : isConnecting ? 'Connecting...' : 'Connect' }}
      </button>
    </div>

    <!-- Add Participant -->
    <div v-if="isConnected" class="add-participant-section">
      <h3>Add Participant</h3>
      <div class="form-group">
        <label>Participant SIP URI</label>
        <input
          v-model="newParticipantUri"
          type="text"
          placeholder="sip:participant@example.com"
          @keyup.enter="addParticipant"
        />
      </div>
      <button @click="addParticipant" :disabled="activeCalls.length >= 5">
        ➕ Add to Conference
      </button>
      <div v-if="activeCalls.length >= 5" class="warning">
        Maximum 5 participants reached
      </div>
    </div>

    <!-- Active Calls List -->
    <div v-if="activeCalls.length > 0" class="active-calls-section">
      <h3>Conference Participants ({{ activeCalls.length }})</h3>

      <div class="calls-list">
        <div
          v-for="call in activeCalls"
          :key="call.id"
          :class="['call-card', { held: call.isHeld, selected: selectedCalls.includes(call.id) }]"
        >
          <div class="call-header">
            <input
              type="checkbox"
              :checked="selectedCalls.includes(call.id)"
              @change="toggleCallSelection(call.id)"
            />
            <div class="call-info">
              <div class="participant-name">{{ call.displayName }}</div>
              <div class="call-meta">
                <span :class="['state-badge', call.state]">{{ call.state }}</span>
                <span class="duration">{{ call.duration }}</span>
              </div>
            </div>
          </div>

          <div class="call-controls">
            <button
              @click="toggleHold(call)"
              :disabled="call.state !== 'active' && !call.isHeld"
              class="btn-small"
            >
              {{ call.isHeld ? '▶️ Resume' : '⏸️ Hold' }}
            </button>
            <button
              @click="toggleMute(call)"
              :disabled="call.state !== 'active'"
              class="btn-small"
            >
              {{ call.isMuted ? '🔊 Unmute' : '🔇 Mute' }}
            </button>
            <button
              @click="hangupCall(call.id)"
              class="btn-small danger"
            >
              ❌ End
            </button>
          </div>

          <!-- Audio Level Indicator -->
          <div class="audio-level">
            <div class="level-bar" :style="{ width: call.audioLevel + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Conference Controls -->
      <div class="conference-controls">
        <h4>Conference Actions</h4>
        <div class="button-group">
          <button
            @click="startConference"
            :disabled="activeCalls.length < 2 || isConferenceActive"
          >
            🎤 Start Conference
          </button>
          <button
            @click="stopConference"
            :disabled="!isConferenceActive"
          >
            ⏹️ Stop Conference
          </button>
          <button
            @click="holdAll"
            :disabled="activeCalls.length === 0"
          >
            ⏸️ Hold All
          </button>
          <button
            @click="resumeAll"
            :disabled="activeCalls.length === 0"
          >
            ▶️ Resume All
          </button>
          <button
            @click="muteAll"
            :disabled="activeCalls.length === 0"
          >
            🔇 Mute All
          </button>
          <button
            @click="hangupAll"
            :disabled="activeCalls.length === 0"
            class="danger"
          >
            📞 End All
          </button>
        </div>
      </div>

      <!-- Selected Calls Actions -->
      <div v-if="selectedCalls.length > 0" class="selected-actions">
        <h4>Selected Calls ({{ selectedCalls.length }})</h4>
        <div class="button-group">
          <button @click="mergeSelected" :disabled="selectedCalls.length < 2">
            🔗 Merge Selected
          </button>
          <button @click="transferSelected" :disabled="selectedCalls.length !== 2">
            🔀 Transfer Selected
          </button>
          <button @click="clearSelection">
            Clear Selection
          </button>
        </div>
      </div>

      <!-- Conference Info -->
      <div v-if="isConferenceActive" class="conference-info">
        <h4>Conference Active</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Participants:</span>
            <span class="value">{{ activeCalls.filter(c => !c.isHeld).length }}</span>
          </div>
          <div class="info-item">
            <span class="label">Duration:</span>
            <span class="value">{{ conferenceDuration }}</span>
          </div>
          <div class="info-item">
            <span class="label">On Hold:</span>
            <span class="value">{{ activeCalls.filter(c => c.isHeld).length }}</span>
          </div>
          <div class="info-item">
            <span class="label">Muted:</span>
            <span class="value">{{ activeCalls.filter(c => c.isMuted).length }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div v-if="isConnected" class="quick-actions">
      <h3>Quick Scenarios</h3>
      <div class="button-group">
        <button @click="simulateIncoming">
          📞 Simulate Incoming Call
        </button>
        <button @click="addMultipleParticipants">
          👥 Add 3 Participants
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useSipClient } from '../../src/composables/useSipClient'

// SIP Configuration
const sipServerUri = ref('sip:example.com')
const username = ref('')
const password = ref('')
const newParticipantUri = ref('sip:1000@example.com')

// SIP Client
const { sipClient, connectionState, isConnected, isConnecting, connect, disconnect } =
  useSipClient()

// Conference State
interface ConferenceCall {
  id: string
  remoteUri: string
  displayName: string
  state: 'connecting' | 'ringing' | 'active' | 'held'
  isHeld: boolean
  isMuted: boolean
  duration: string
  audioLevel: number
  startTime: Date
}

const activeCalls = ref<ConferenceCall[]>([])
const selectedCalls = ref<string[]>([])
const isConferenceActive = ref(false)
const conferenceStartTime = ref<Date | null>(null)
const conferenceDuration = ref('00:00')

// Timers
const callTimers = new Map<string, number>()
const conferenceTimer = ref<number | null>(null)

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Connection Toggle
const toggleConnection = async () => {
  if (isConnected.value) {
    await disconnect()
    hangupAll()
  } else {
    await connect({
      uri: sipServerUri.value,
      username: username.value,
      password: password.value,
    })
  }
}

// Add Participant
const addParticipant = async () => {
  if (!newParticipantUri.value || activeCalls.value.length >= 5) return

  const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const displayName = newParticipantUri.value.split('@')[0].replace('sip:', '')

  const newCall: ConferenceCall = {
    id: callId,
    remoteUri: newParticipantUri.value,
    displayName,
    state: 'connecting',
    isHeld: false,
    isMuted: false,
    duration: '00:00',
    audioLevel: 0,
    startTime: new Date(),
  }

  activeCalls.value.push(newCall)

  // Simulate call progression
  setTimeout(() => {
    const call = activeCalls.value.find(c => c.id === callId)
    if (call) {
      call.state = 'ringing'
    }
  }, 500)

  setTimeout(() => {
    const call = activeCalls.value.find(c => c.id === callId)
    if (call) {
      call.state = 'active'
      startCallTimer(callId)
      startAudioLevelSimulation(callId)
    }
  }, 2000)

  // Clear input
  newParticipantUri.value = ''

  console.log('Added participant:', displayName)
}

// Start Call Timer
const startCallTimer = (callId: string) => {
  const timer = window.setInterval(() => {
    const call = activeCalls.value.find(c => c.id === callId)
    if (call) {
      const elapsed = Math.floor((Date.now() - call.startTime.getTime()) / 1000)
      call.duration = formatTime(elapsed)
    }
  }, 1000)
  callTimers.set(callId, timer)
}

// Stop Call Timer
const stopCallTimer = (callId: string) => {
  const timer = callTimers.get(callId)
  if (timer) {
    clearInterval(timer)
    callTimers.delete(callId)
  }
}

// Simulate Audio Level
const startAudioLevelSimulation = (callId: string) => {
  const interval = setInterval(() => {
    const call = activeCalls.value.find(c => c.id === callId)
    if (!call || call.state !== 'active' || call.isMuted) {
      call && (call.audioLevel = 0)
      return
    }
    // Random audio level between 20-80%
    call.audioLevel = Math.floor(Math.random() * 60 + 20)
  }, 200)

  // Store interval for cleanup
  setTimeout(() => clearInterval(interval), 60000) // Clean up after 1 minute
}

// Toggle Hold
const toggleHold = (call: ConferenceCall) => {
  call.isHeld = !call.isHeld
  call.state = call.isHeld ? 'held' : 'active'
  console.log(`${call.displayName} ${call.isHeld ? 'held' : 'resumed'}`)
}

// Toggle Mute
const toggleMute = (call: ConferenceCall) => {
  call.isMuted = !call.isMuted
  console.log(`${call.displayName} ${call.isMuted ? 'muted' : 'unmuted'}`)
}

// Hangup Call
const hangupCall = (callId: string) => {
  const index = activeCalls.value.findIndex(c => c.id === callId)
  if (index !== -1) {
    stopCallTimer(callId)
    activeCalls.value.splice(index, 1)

    // Remove from selection
    const selIndex = selectedCalls.value.indexOf(callId)
    if (selIndex !== -1) {
      selectedCalls.value.splice(selIndex, 1)
    }
  }

  // Stop conference if only 1 or 0 calls left
  if (activeCalls.value.length < 2 && isConferenceActive.value) {
    stopConference()
  }
}

// Conference Controls
const startConference = () => {
  if (activeCalls.value.length < 2) return

  isConferenceActive.value = true
  conferenceStartTime.value = new Date()

  // Resume all calls
  activeCalls.value.forEach(call => {
    if (call.isHeld) {
      call.isHeld = false
      call.state = 'active'
    }
  })

  // Start conference timer
  conferenceTimer.value = window.setInterval(() => {
    if (conferenceStartTime.value) {
      const elapsed = Math.floor((Date.now() - conferenceStartTime.value.getTime()) / 1000)
      conferenceDuration.value = formatTime(elapsed)
    }
  }, 1000)

  console.log('Conference started with', activeCalls.value.length, 'participants')
}

const stopConference = () => {
  isConferenceActive.value = false
  conferenceStartTime.value = null
  conferenceDuration.value = '00:00'

  if (conferenceTimer.value) {
    clearInterval(conferenceTimer.value)
    conferenceTimer.value = null
  }

  console.log('Conference stopped')
}

const holdAll = () => {
  activeCalls.value.forEach(call => {
    if (!call.isHeld) {
      call.isHeld = true
      call.state = 'held'
    }
  })
  console.log('All calls held')
}

const resumeAll = () => {
  activeCalls.value.forEach(call => {
    if (call.isHeld) {
      call.isHeld = false
      call.state = 'active'
    }
  })
  console.log('All calls resumed')
}

const muteAll = () => {
  activeCalls.value.forEach(call => {
    call.isMuted = true
  })
  console.log('All calls muted')
}

const hangupAll = () => {
  activeCalls.value.forEach(call => {
    stopCallTimer(call.id)
  })
  activeCalls.value = []
  selectedCalls.value = []

  if (isConferenceActive.value) {
    stopConference()
  }

  console.log('All calls ended')
}

// Selection
const toggleCallSelection = (callId: string) => {
  const index = selectedCalls.value.indexOf(callId)
  if (index !== -1) {
    selectedCalls.value.splice(index, 1)
  } else {
    selectedCalls.value.push(callId)
  }
}

const clearSelection = () => {
  selectedCalls.value = []
}

// Advanced Actions
const mergeSelected = () => {
  if (selectedCalls.value.length < 2) return
  console.log('Merging selected calls:', selectedCalls.value)
  // In a real implementation, this would merge the selected calls
  alert(`Merging ${selectedCalls.value.length} calls into conference`)
  clearSelection()
}

const transferSelected = () => {
  if (selectedCalls.value.length !== 2) return
  const [call1, call2] = selectedCalls.value
  console.log('Transferring call', call1, 'to', call2)
  // In a real implementation, this would perform an attended transfer
  alert('Transferring calls (attended transfer)')
  clearSelection()
}

// Quick Actions
const simulateIncoming = () => {
  const incomingUri = `sip:incoming-${Math.floor(Math.random() * 9000 + 1000)}@example.com`
  newParticipantUri.value = incomingUri
  addParticipant()
}

const addMultipleParticipants = async () => {
  const uris = [
    'sip:alice@example.com',
    'sip:bob@example.com',
    'sip:charlie@example.com',
  ]

  for (const uri of uris) {
    if (activeCalls.value.length >= 5) break
    newParticipantUri.value = uri
    await addParticipant()
    await new Promise(resolve => setTimeout(resolve, 300))
  }
}

// Cleanup
onUnmounted(() => {
  hangupAll()
  callTimers.forEach(timer => clearInterval(timer))
  callTimers.clear()
  if (conferenceTimer.value) {
    clearInterval(conferenceTimer.value)
  }
})
</script>

<style scoped>
.conference-call-demo {
  max-width: 900px;
  margin: 0 auto;
}

.description {
  color: #666;
  margin-bottom: 2rem;
}

.status-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.status-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.875rem;
}

.status-badge.connected {
  background-color: #10b981;
  color: white;
}

.status-badge.disconnected {
  background-color: #6b7280;
  color: white;
}

.status-badge.connecting {
  background-color: #f59e0b;
  color: white;
}

.stats {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.config-section,
.add-participant-section,
.active-calls-section,
.quick-actions {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.125rem;
}

h4 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

button {
  padding: 0.625rem 1.25rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #2563eb;
}

button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

button.danger {
  background-color: #ef4444;
}

button.danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.warning {
  margin-top: 0.5rem;
  color: #f59e0b;
  font-size: 0.875rem;
}

.calls-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.call-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.call-card.held {
  opacity: 0.6;
  background: #f3f4f6;
}

.call-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.call-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.call-header input[type="checkbox"] {
  margin-top: 0.25rem;
}

.call-info {
  flex: 1;
}

.participant-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.call-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.state-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-weight: 500;
}

.state-badge.connecting {
  background: #fef3c7;
  color: #92400e;
}

.state-badge.ringing {
  background: #dbeafe;
  color: #1e40af;
}

.state-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.state-badge.held {
  background: #f3f4f6;
  color: #374151;
}

.duration {
  color: #6b7280;
}

.call-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.audio-level {
  margin-top: 0.75rem;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.level-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #3b82f6);
  transition: width 0.2s;
}

.conference-controls,
.selected-actions {
  background: white;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.conference-info {
  background: #ecfdf5;
  border: 1px solid #10b981;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
}

.info-item .label {
  font-weight: 500;
  color: #065f46;
}

.info-item .value {
  color: #064e3b;
  font-weight: 600;
}
</style>
