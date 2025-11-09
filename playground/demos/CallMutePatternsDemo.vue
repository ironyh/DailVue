<template>
  <div class="call-mute-demo">
    <h2>🔇 Call Mute Patterns</h2>
    <p class="description">Advanced mute/unmute patterns with push-to-talk, auto-mute, and visual indicators.</p>

    <!-- Connection Status -->
    <div class="status-section">
      <div :class="['status-badge', connectionState]">
        {{ connectionState.toUpperCase() }}
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

    <!-- Call Control -->
    <div v-if="isConnected" class="call-section">
      <h3>Make a Call</h3>
      <div class="form-group">
        <label>Target SIP URI</label>
        <input
          v-model="targetUri"
          type="text"
          placeholder="sip:target@example.com"
          @keyup.enter="makeCall"
        />
      </div>
      <button @click="makeCall" :disabled="hasActiveCall">
        📞 Make Call
      </button>
    </div>

    <!-- Active Call with Mute Patterns -->
    <div v-if="hasActiveCall" class="active-call-section">
      <h3>Active Call: {{ callState }}</h3>

      <div class="call-info">
        <div class="info-item">
          <span class="label">Remote URI:</span>
          <span class="value">{{ currentCall?.remoteUri || 'Unknown' }}</span>
        </div>
        <div class="info-item">
          <span class="label">Call Duration:</span>
          <span class="value">{{ callDuration }}</span>
        </div>
      </div>

      <!-- Mute Status Indicator -->
      <div :class="['mute-status', { muted: isMuted, 'push-to-talk': isPushToTalkActive }]">
        <div class="status-icon">
          {{ isMuted ? '🔇' : '🔊' }}
        </div>
        <div class="status-text">
          <div class="primary">
            {{ isMuted ? 'MICROPHONE MUTED' : 'MICROPHONE ACTIVE' }}
          </div>
          <div class="secondary" v-if="activeMutePattern">
            Mode: {{ activeMutePattern }}
          </div>
        </div>
      </div>

      <!-- Mute Patterns -->
      <div class="mute-patterns">
        <h4>Mute Patterns</h4>

        <!-- Standard Toggle -->
        <div class="pattern-card">
          <div class="pattern-header">
            <h5>Standard Toggle</h5>
            <label class="switch">
              <input
                type="checkbox"
                :checked="muteMode === 'standard'"
                @change="setMuteMode('standard')"
              />
              <span class="slider"></span>
            </label>
          </div>
          <p class="pattern-description">Click to toggle mute on/off</p>
          <button
            @click="toggleMute"
            :disabled="muteMode !== 'standard'"
            class="mute-btn"
          >
            {{ isMuted ? '🔊 Unmute' : '🔇 Mute' }}
          </button>
        </div>

        <!-- Push to Talk -->
        <div class="pattern-card">
          <div class="pattern-header">
            <h5>Push to Talk</h5>
            <label class="switch">
              <input
                type="checkbox"
                :checked="muteMode === 'push-to-talk'"
                @change="setMuteMode('push-to-talk')"
              />
              <span class="slider"></span>
            </label>
          </div>
          <p class="pattern-description">Hold Space or click button to talk</p>
          <button
            @mousedown="startPushToTalk"
            @mouseup="stopPushToTalk"
            @mouseleave="stopPushToTalk"
            :disabled="muteMode !== 'push-to-talk'"
            :class="['ptt-btn', { active: isPushToTalkActive }]"
          >
            {{ isPushToTalkActive ? '🎤 TALKING' : '🔇 HOLD TO TALK' }}
          </button>
          <div class="keyboard-hint">
            Keyboard: Hold <kbd>Space</kbd> to talk
          </div>
        </div>

        <!-- Auto Mute on Silence -->
        <div class="pattern-card">
          <div class="pattern-header">
            <h5>Auto Mute on Silence</h5>
            <label class="switch">
              <input
                type="checkbox"
                :checked="muteMode === 'auto-silence'"
                @change="setMuteMode('auto-silence')"
              />
              <span class="slider"></span>
            </label>
          </div>
          <p class="pattern-description">
            Auto-mutes after {{ autoMuteDelay / 1000 }}s of silence
          </p>
          <div class="audio-level-display">
            <div class="level-label">Audio Level:</div>
            <div class="level-bar-container">
              <div class="level-bar" :style="{ width: audioLevel + '%' }"></div>
            </div>
            <div class="level-value">{{ audioLevel }}%</div>
          </div>
          <div class="form-group">
            <label>Auto-mute Delay (seconds)</label>
            <input
              type="range"
              v-model="autoMuteDelay"
              min="1000"
              max="10000"
              step="1000"
              :disabled="muteMode !== 'auto-silence'"
            />
            <span>{{ autoMuteDelay / 1000 }}s</span>
          </div>
        </div>

        <!-- Scheduled Mute -->
        <div class="pattern-card">
          <div class="pattern-header">
            <h5>Scheduled Mute</h5>
            <label class="switch">
              <input
                type="checkbox"
                :checked="muteMode === 'scheduled'"
                @change="setMuteMode('scheduled')"
              />
              <span class="slider"></span>
            </label>
          </div>
          <p class="pattern-description">Alternate between mute/unmute on schedule</p>
          <div class="schedule-controls">
            <div class="form-group">
              <label>Talk Duration (seconds)</label>
              <input
                type="number"
                v-model.number="talkDuration"
                min="1"
                max="60"
                :disabled="muteMode !== 'scheduled'"
              />
            </div>
            <div class="form-group">
              <label>Mute Duration (seconds)</label>
              <input
                type="number"
                v-model.number="muteDuration"
                min="1"
                max="60"
                :disabled="muteMode !== 'scheduled'"
              />
            </div>
          </div>
          <div v-if="muteMode === 'scheduled'" class="schedule-status">
            Next toggle in: {{ scheduleCountdown }}s
          </div>
        </div>
      </div>

      <!-- Mute Statistics -->
      <div class="mute-stats">
        <h4>Session Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ muteToggleCount }}</div>
            <div class="stat-label">Mute Toggles</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatTime(totalMutedTime) }}</div>
            <div class="stat-label">Time Muted</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatTime(totalUnmutedTime) }}</div>
            <div class="stat-label">Time Unmuted</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ mutePercentage }}%</div>
            <div class="stat-label">Muted %</div>
          </div>
        </div>
      </div>

      <!-- Call Controls -->
      <div class="button-group">
        <button @click="answer" v-if="callState === 'incoming'">
          ✅ Answer
        </button>
        <button @click="hangup" class="danger">
          📞 Hang Up
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSipClient } from '../../src/composables/useSipClient'
import { useSipCall } from '../../src/composables/useSipCall'

// SIP Configuration
const sipServerUri = ref('sip:example.com')
const username = ref('')
const password = ref('')
const targetUri = ref('sip:1000@example.com')

// SIP Client
const { sipClient, connectionState, isConnected, isConnecting, connect, disconnect } =
  useSipClient()

// Call Management
const {
  makeCall: makeCallFn,
  answer,
  hangup,
  mute,
  unmute,
  currentCall,
  callState,
  hasActiveCall,
  isMuted: isCallMuted,
} = useSipCall(sipClient)

// Mute State
const isMuted = ref(false)
const muteMode = ref<'standard' | 'push-to-talk' | 'auto-silence' | 'scheduled'>('standard')
const isPushToTalkActive = ref(false)
const audioLevel = ref(0)
const autoMuteDelay = ref(3000)
const talkDuration = ref(5)
const muteDuration = ref(3)
const scheduleCountdown = ref(0)

// Statistics
const muteToggleCount = ref(0)
const totalMutedTime = ref(0)
const totalUnmutedTime = ref(0)
const lastStateChangeTime = ref<number>(Date.now())

// Timers
const callStartTime = ref<number>(0)
const callDuration = ref('00:00')
const callTimer = ref<number | null>(null)
const autoMuteTimer = ref<number | null>(null)
const scheduleTimer = ref<number | null>(null)
const statsTimer = ref<number | null>(null)
const audioLevelTimer = ref<number | null>(null)

// Computed
const activeMutePattern = computed(() => {
  if (muteMode.value === 'push-to-talk' && isPushToTalkActive.value) {
    return 'Push to Talk (Active)'
  }
  switch (muteMode.value) {
    case 'standard':
      return 'Standard Toggle'
    case 'push-to-talk':
      return 'Push to Talk'
    case 'auto-silence':
      return 'Auto Mute on Silence'
    case 'scheduled':
      return 'Scheduled Mute'
    default:
      return null
  }
})

const mutePercentage = computed(() => {
  const total = totalMutedTime.value + totalUnmutedTime.value
  if (total === 0) return 0
  return Math.round((totalMutedTime.value / total) * 100)
})

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
  } else {
    await connect({
      uri: sipServerUri.value,
      username: username.value,
      password: password.value,
    })
  }
}

// Make Call
const makeCall = async () => {
  if (!targetUri.value) return
  await makeCallFn(targetUri.value)
}

// Mute Control
const setMuted = async (muted: boolean) => {
  if (isMuted.value === muted) return

  // Update statistics
  const now = Date.now()
  const elapsed = Math.floor((now - lastStateChangeTime.value) / 1000)

  if (isMuted.value) {
    totalMutedTime.value += elapsed
  } else {
    totalUnmutedTime.value += elapsed
  }

  lastStateChangeTime.value = now
  muteToggleCount.value++

  isMuted.value = muted

  // Apply to call
  if (muted) {
    await mute()
  } else {
    await unmute()
  }
}

const toggleMute = async () => {
  await setMuted(!isMuted.value)
}

// Mute Mode Management
const setMuteMode = (mode: typeof muteMode.value) => {
  // Clean up previous mode
  if (autoMuteTimer.value) {
    clearTimeout(autoMuteTimer.value)
    autoMuteTimer.value = null
  }
  if (scheduleTimer.value) {
    clearInterval(scheduleTimer.value)
    scheduleTimer.value = null
  }

  muteMode.value = mode

  // Initialize new mode
  switch (mode) {
    case 'standard':
      // Nothing special needed
      break

    case 'push-to-talk':
      // Start muted in push-to-talk mode
      setMuted(true)
      break

    case 'auto-silence':
      // Start audio level monitoring
      startAudioLevelMonitoring()
      break

    case 'scheduled':
      // Start schedule
      startScheduledMute()
      break
  }
}

// Push to Talk
const startPushToTalk = async () => {
  if (muteMode.value !== 'push-to-talk') return
  isPushToTalkActive.value = true
  await setMuted(false)
}

const stopPushToTalk = async () => {
  if (muteMode.value !== 'push-to-talk') return
  isPushToTalkActive.value = false
  await setMuted(true)
}

// Keyboard Handler for Push to Talk
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code === 'Space' && muteMode.value === 'push-to-talk' && hasActiveCall.value) {
    event.preventDefault()
    if (!isPushToTalkActive.value) {
      startPushToTalk()
    }
  }
}

const handleKeyUp = (event: KeyboardEvent) => {
  if (event.code === 'Space' && muteMode.value === 'push-to-talk' && hasActiveCall.value) {
    event.preventDefault()
    stopPushToTalk()
  }
}

// Auto Mute on Silence
const startAudioLevelMonitoring = () => {
  // Simulate audio level changes
  audioLevelTimer.value = window.setInterval(() => {
    if (muteMode.value !== 'auto-silence' || !hasActiveCall.value) return

    // Simulate random audio level
    const randomLevel = Math.random() * 100

    audioLevel.value = Math.floor(randomLevel)

    // If audio level is low, start auto-mute timer
    if (randomLevel < 10 && !isMuted.value) {
      if (!autoMuteTimer.value) {
        autoMuteTimer.value = window.setTimeout(() => {
          setMuted(true)
        }, autoMuteDelay.value)
      }
    } else if (randomLevel >= 10) {
      // Cancel auto-mute timer if audio detected
      if (autoMuteTimer.value) {
        clearTimeout(autoMuteTimer.value)
        autoMuteTimer.value = null
      }
      // Unmute if currently muted
      if (isMuted.value) {
        setMuted(false)
      }
    }
  }, 100)
}

// Scheduled Mute
const startScheduledMute = () => {
  scheduleCountdown.value = talkDuration.value
  let isInTalkPhase = true

  scheduleTimer.value = window.setInterval(() => {
    scheduleCountdown.value--

    if (scheduleCountdown.value <= 0) {
      // Toggle phase
      isInTalkPhase = !isInTalkPhase
      setMuted(!isInTalkPhase)

      // Reset countdown
      scheduleCountdown.value = isInTalkPhase ? talkDuration.value : muteDuration.value
    }
  }, 1000)
}

// Call Timer
const startCallTimer = () => {
  callStartTime.value = Date.now()
  callTimer.value = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime.value) / 1000)
    callDuration.value = formatTime(elapsed)
  }, 1000)
}

const stopCallTimer = () => {
  if (callTimer.value) {
    clearInterval(callTimer.value)
    callTimer.value = null
  }
  callDuration.value = '00:00'
}

// Statistics Timer
const startStatsTimer = () => {
  statsTimer.value = window.setInterval(() => {
    if (!hasActiveCall.value) return

    const now = Date.now()
    const elapsed = Math.floor((now - lastStateChangeTime.value) / 1000)

    if (isMuted.value) {
      // Already counted in totalMutedTime, but update for live display
    } else {
      // Already counted in totalUnmutedTime, but update for live display
    }
  }, 1000)
}

const stopStatsTimer = () => {
  if (statsTimer.value) {
    clearInterval(statsTimer.value)
    statsTimer.value = null
  }
}

// Watch call state
watch(callState, (newState, oldState) => {
  if (newState === 'active' && oldState !== 'active') {
    // Call became active
    startCallTimer()
    startStatsTimer()
    lastStateChangeTime.value = Date.now()

    // Initialize mute mode
    setMuteMode(muteMode.value)
  } else if (newState === 'terminated' || newState === 'disconnected') {
    // Call ended
    stopCallTimer()
    stopStatsTimer()

    // Clean up
    if (autoMuteTimer.value) {
      clearTimeout(autoMuteTimer.value)
      autoMuteTimer.value = null
    }
    if (scheduleTimer.value) {
      clearInterval(scheduleTimer.value)
      scheduleTimer.value = null
    }
    if (audioLevelTimer.value) {
      clearInterval(audioLevelTimer.value)
      audioLevelTimer.value = null
    }
  }
})

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  stopCallTimer()
  stopStatsTimer()

  if (autoMuteTimer.value) clearTimeout(autoMuteTimer.value)
  if (scheduleTimer.value) clearInterval(scheduleTimer.value)
  if (audioLevelTimer.value) clearInterval(audioLevelTimer.value)
})
</script>

<style scoped>
.call-mute-demo {
  max-width: 900px;
  margin: 0 auto;
}

.description {
  color: #666;
  margin-bottom: 2rem;
}

.status-section {
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

.config-section,
.call-section,
.active-call-section {
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
  margin-bottom: 1rem;
  font-size: 1rem;
}

h5 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
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

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.form-group input[type="range"] {
  width: calc(100% - 3rem);
  margin-right: 0.5rem;
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

.call-info {
  background: white;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  font-weight: 500;
  color: #6b7280;
}

.info-item .value {
  color: #111827;
}

.mute-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: #d1fae5;
  border: 2px solid #10b981;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  transition: all 0.3s;
}

.mute-status.muted {
  background: #fee2e2;
  border-color: #ef4444;
}

.mute-status.push-to-talk {
  background: #dbeafe;
  border-color: #3b82f6;
}

.status-icon {
  font-size: 3rem;
}

.status-text .primary {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.status-text .secondary {
  font-size: 0.875rem;
  color: #6b7280;
}

.mute-patterns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.pattern-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}

.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.pattern-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.mute-btn,
.ptt-btn {
  width: 100%;
}

.ptt-btn.active {
  background-color: #10b981;
  transform: scale(1.05);
}

.keyboard-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

kbd {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  padding: 0.125rem 0.375rem;
  font-family: monospace;
  font-size: 0.75rem;
}

.audio-level-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.level-label {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.level-bar-container {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.level-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #3b82f6);
  transition: width 0.1s;
}

.level-value {
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 3rem;
  text-align: right;
}

.schedule-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.schedule-status {
  padding: 0.75rem;
  background: #fef3c7;
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  color: #92400e;
}

.mute-stats {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.button-group {
  display: flex;
  gap: 0.75rem;
}
</style>
