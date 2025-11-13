<template>
  <div class="screen-sharing-demo">
    <h2>🖥️ Screen Sharing</h2>
    <p class="description">
      Share your screen, application windows, or browser tabs during video calls.
    </p>

    <!-- Connection Status -->
    <div class="status-section">
      <div :class="['status-badge', connectionState]">
        {{ connectionState.toUpperCase() }}
      </div>
      <div class="sharing-status" v-if="isSharingScreen">
        <span class="indicator active"></span>
        <span>Screen Sharing Active</span>
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
      <h3>Video Call</h3>
      <div class="form-group">
        <label>Target SIP URI</label>
        <input
          v-model="targetUri"
          type="text"
          placeholder="sip:target@example.com"
          @keyup.enter="makeVideoCall"
        />
      </div>
      <button @click="makeVideoCall" :disabled="hasActiveCall">📹 Make Video Call</button>
    </div>

    <!-- Active Call with Screen Sharing -->
    <div v-if="hasActiveCall" class="active-call-section">
      <h3>Active Video Call</h3>

      <div class="call-info">
        <div class="info-item">
          <span class="label">Remote URI:</span>
          <span class="value">{{ currentCall?.remoteUri || 'Unknown' }}</span>
        </div>
        <div class="info-item">
          <span class="label">Call Duration:</span>
          <span class="value">{{ callDuration }}</span>
        </div>
        <div class="info-item">
          <span class="label">Video Status:</span>
          <span class="value">{{ hasLocalVideo ? 'Enabled' : 'Disabled' }}</span>
        </div>
      </div>

      <!-- Video Display -->
      <div class="video-container">
        <div class="video-wrapper">
          <video
            ref="remoteVideo"
            autoplay
            playsinline
            class="remote-video"
            :class="{ 'screen-share': isSharingScreen }"
          ></video>
          <div class="video-label remote">Remote</div>
        </div>

        <div class="video-wrapper local">
          <video ref="localVideo" autoplay playsinline muted class="local-video"></video>
          <div class="video-label local">You</div>
        </div>
      </div>

      <!-- Screen Sharing Controls -->
      <div class="screen-share-controls">
        <h4>Screen Sharing</h4>

        <div v-if="!isSharingScreen" class="share-options">
          <p class="info-text">Choose what to share with the other participant:</p>

          <div class="share-buttons">
            <button @click="shareScreen('screen')" class="share-btn screen">
              🖥️ Share Entire Screen
            </button>
            <button @click="shareScreen('window')" class="share-btn window">🪟 Share Window</button>
            <button @click="shareScreen('tab')" class="share-btn tab">🌐 Share Browser Tab</button>
          </div>

          <div class="share-settings">
            <h5>Options</h5>
            <label>
              <input type="checkbox" v-model="shareAudio" />
              Share system audio
            </label>
            <label>
              <input type="checkbox" v-model="highQuality" />
              High quality (higher bandwidth)
            </label>
          </div>
        </div>

        <div v-else class="sharing-active">
          <div class="sharing-info">
            <div class="sharing-icon">🔴</div>
            <div class="sharing-text">
              <div class="primary">You are sharing your {{ sharingType }}</div>
              <div class="secondary">{{ sharingDuration }}</div>
            </div>
          </div>

          <div class="sharing-stats">
            <div class="stat">
              <span class="stat-label">Resolution:</span>
              <span class="stat-value">{{ shareResolution }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Frame Rate:</span>
              <span class="stat-value">{{ shareFrameRate }} fps</span>
            </div>
            <div class="stat">
              <span class="stat-label">Bandwidth:</span>
              <span class="stat-value">{{ shareBandwidth }} kbps</span>
            </div>
          </div>

          <button @click="stopScreenShare" class="stop-share-btn">⏹️ Stop Sharing</button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h4>Quick Actions</h4>
        <div class="button-grid">
          <button @click="toggleCamera" :class="['action-btn', { active: hasLocalVideo }]">
            {{ hasLocalVideo ? '📹' : '📹' }} Camera
          </button>
          <button @click="toggleMicrophone" :class="['action-btn', { active: !isMuted }]">
            {{ isMuted ? '🔇' : '🔊' }} Mic
          </button>
          <button @click="switchCamera" :disabled="!hasLocalVideo" class="action-btn">
            🔄 Switch Camera
          </button>
          <button @click="takeScreenshot" :disabled="!isSharingScreen" class="action-btn">
            📸 Screenshot
          </button>
        </div>
      </div>

      <!-- Sharing History -->
      <div v-if="sharingHistory.length > 0" class="sharing-history">
        <h4>Sharing History</h4>
        <div class="history-list">
          <div v-for="(entry, index) in sharingHistory" :key="index" class="history-item">
            <div class="history-icon">{{ getShareTypeIcon(entry.type) }}</div>
            <div class="history-info">
              <div class="history-type">{{ entry.type }}</div>
              <div class="history-duration">Duration: {{ entry.duration }}</div>
            </div>
            <div class="history-timestamp">{{ entry.timestamp }}</div>
          </div>
        </div>
      </div>

      <!-- Call Controls -->
      <div class="button-group">
        <button @click="answer" v-if="callState === 'incoming'">✅ Answer</button>
        <button @click="hangup" class="danger">📞 Hang Up</button>
      </div>
    </div>

    <!-- Browser Compatibility -->
    <div class="compatibility-section">
      <h3>Browser Compatibility</h3>
      <div class="compat-grid">
        <div :class="['compat-item', { supported: supportsScreenShare }]">
          <span class="compat-icon">{{ supportsScreenShare ? '✅' : '❌' }}</span>
          <span class="compat-label">Screen Sharing</span>
        </div>
        <div :class="['compat-item', { supported: supportsAudioShare }]">
          <span class="compat-icon">{{ supportsAudioShare ? '✅' : '❌' }}</span>
          <span class="compat-label">Audio Sharing</span>
        </div>
      </div>
      <p v-if="!supportsScreenShare" class="compat-warning">
        Screen sharing is not supported in your browser. Please use a modern browser like Chrome,
        Firefox, or Edge.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useSipClient } from '../../src/composables/useSipClient'
import { useCallSession } from '../../src/composables/useCallSession'

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
  isMuted,
} = useCallSession(sipClient.getClient())

// Video Elements
const localVideo = ref<HTMLVideoElement | null>(null)
const remoteVideo = ref<HTMLVideoElement | null>(null)

// Screen Sharing State
const isSharingScreen = ref(false)
const sharingType = ref<'screen' | 'window' | 'tab'>('screen')
const shareAudio = ref(false)
const highQuality = ref(false)
const screenStream = ref<MediaStream | null>(null)
const originalStream = ref<MediaStream | null>(null)
const hasLocalVideo = ref(true)

// Sharing Statistics
const shareResolution = ref('1920x1080')
const shareFrameRate = ref(30)
const shareBandwidth = ref(2500)

// Sharing Duration
const sharingStartTime = ref<number>(0)
const sharingDuration = ref('00:00')
const sharingTimer = ref<number | null>(null)

// Sharing History
interface SharingHistoryEntry {
  type: string
  duration: string
  timestamp: string
}

const sharingHistory = ref<SharingHistoryEntry[]>([])

// Call Timer
const callStartTime = ref<number>(0)
const callDuration = ref('00:00')
const callTimer = ref<number | null>(null)

// Browser Compatibility
const supportsScreenShare = ref(false)
const supportsAudioShare = ref(false)

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

// Make Video Call
const makeVideoCall = async () => {
  if (!targetUri.value) return

  try {
    await makeCallFn(targetUri.value, {
      video: true,
      audio: true,
    })
  } catch (error) {
    console.error('Failed to make video call:', error)
  }
}

// Screen Sharing
const shareScreen = async (type: 'screen' | 'window' | 'tab') => {
  if (!currentCall.value) return

  try {
    // Build constraints based on type and settings
    const constraints: any = {
      video: {
        cursor: 'always',
      },
      audio: shareAudio.value,
    }

    // Add quality settings
    if (highQuality.value) {
      constraints.video.width = { ideal: 1920 }
      constraints.video.height = { ideal: 1080 }
      constraints.video.frameRate = { ideal: 30 }
    } else {
      constraints.video.width = { ideal: 1280 }
      constraints.video.height = { ideal: 720 }
      constraints.video.frameRate = { ideal: 15 }
    }

    // Get display media
    screenStream.value = await navigator.mediaDevices.getDisplayMedia(constraints)

    // Store original stream before replacing
    if (currentCall.value.localStream) {
      originalStream.value = currentCall.value.localStream
    }

    // Replace video track in the call
    // Note: This is a simplified version. Real implementation would use replaceTrack on RTCRtpSender
    const videoTrack = screenStream.value.getVideoTracks()[0]

    // Update local video display
    if (localVideo.value) {
      localVideo.value.srcObject = screenStream.value
    }

    isSharingScreen.value = true
    sharingType.value = type
    sharingStartTime.value = Date.now()

    // Start sharing timer
    startSharingTimer()

    // Listen for screen share stop (when user clicks browser's stop button)
    videoTrack.onended = () => {
      stopScreenShare()
    }

    console.log('Screen sharing started:', type)
  } catch (error) {
    console.error('Failed to start screen sharing:', error)
    alert('Failed to start screen sharing. Please grant permission and try again.')
  }
}

const stopScreenShare = async () => {
  if (!isSharingScreen.value) return

  try {
    // Stop all tracks in screen stream
    if (screenStream.value) {
      screenStream.value.getTracks().forEach((track) => track.stop())
    }

    // Restore original camera stream
    if (originalStream.value && currentCall.value) {
      // In real implementation, use replaceTrack to restore original video
      if (localVideo.value) {
        localVideo.value.srcObject = originalStream.value
      }
    }

    // Calculate duration
    const duration = Math.floor((Date.now() - sharingStartTime.value) / 1000)
    const durationStr = formatTime(duration)

    // Add to history
    sharingHistory.value.unshift({
      type: sharingType.value,
      duration: durationStr,
      timestamp: new Date().toLocaleTimeString(),
    })

    // Keep only last 5 entries
    if (sharingHistory.value.length > 5) {
      sharingHistory.value = sharingHistory.value.slice(0, 5)
    }

    stopSharingTimer()

    isSharingScreen.value = false
    screenStream.value = null

    console.log('Screen sharing stopped')
  } catch (error) {
    console.error('Failed to stop screen sharing:', error)
  }
}

// Video Controls
const toggleCamera = async () => {
  hasLocalVideo.value = !hasLocalVideo.value

  if (currentCall.value?.localStream) {
    const videoTracks = currentCall.value.localStream.getVideoTracks()
    videoTracks.forEach((track) => {
      track.enabled = hasLocalVideo.value
    })
  }
}

const toggleMicrophone = async () => {
  if (isMuted.value) {
    await unmute()
  } else {
    await mute()
  }
}

const switchCamera = async () => {
  console.log('Switching camera...')
  // In real implementation, this would cycle through available cameras
  alert('Camera switching is not implemented in this demo')
}

const takeScreenshot = () => {
  if (!localVideo.value || !isSharingScreen.value) return

  try {
    const canvas = document.createElement('canvas')
    canvas.width = localVideo.value.videoWidth
    canvas.height = localVideo.value.videoHeight

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(localVideo.value, 0, 0)

      // Download screenshot
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `screenshot-${Date.now()}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      })
    }
  } catch (error) {
    console.error('Failed to take screenshot:', error)
  }
}

// Timers
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

const startSharingTimer = () => {
  sharingTimer.value = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - sharingStartTime.value) / 1000)
    sharingDuration.value = formatTime(elapsed)

    // Simulate changing stats
    shareFrameRate.value = Math.floor(Math.random() * 10 + 25)
    shareBandwidth.value = Math.floor(Math.random() * 500 + 2000)
  }, 1000)
}

const stopSharingTimer = () => {
  if (sharingTimer.value) {
    clearInterval(sharingTimer.value)
    sharingTimer.value = null
  }
  sharingDuration.value = '00:00'
}

// Helpers
const getShareTypeIcon = (type: string): string => {
  switch (type) {
    case 'screen':
      return '🖥️'
    case 'window':
      return '🪟'
    case 'tab':
      return '🌐'
    default:
      return '📺'
  }
}

// Check browser compatibility
const checkCompatibility = () => {
  supportsScreenShare.value = 'getDisplayMedia' in navigator.mediaDevices
  // Audio sharing support varies by browser
  supportsAudioShare.value = supportsScreenShare.value
}

// Watch call state
watch(callState, (newState, oldState) => {
  if (newState === 'active' && oldState !== 'active') {
    // Call became active
    startCallTimer()

    // Set up video streams
    if (currentCall.value) {
      if (remoteVideo.value && currentCall.value.remoteStream) {
        remoteVideo.value.srcObject = currentCall.value.remoteStream
      }
      if (localVideo.value && currentCall.value.localStream) {
        localVideo.value.srcObject = currentCall.value.localStream
      }
    }
  } else if (newState === 'terminated' || newState === 'disconnected') {
    // Call ended
    stopCallTimer()

    // Stop screen sharing if active
    if (isSharingScreen.value) {
      stopScreenShare()
    }

    // Clear video streams
    if (remoteVideo.value) {
      remoteVideo.value.srcObject = null
    }
    if (localVideo.value) {
      localVideo.value.srcObject = null
    }
  }
})

// Lifecycle
onMounted(() => {
  checkCompatibility()
})

onUnmounted(() => {
  stopCallTimer()
  stopSharingTimer()

  if (isSharingScreen.value) {
    stopScreenShare()
  }
})
</script>

<style scoped>
.screen-sharing-demo {
  max-width: 1200px;
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

.sharing-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #ef4444;
}

.indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6b7280;
}

.indicator.active {
  background: #ef4444;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.config-section,
.call-section,
.active-call-section,
.compatibility-section {
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
  margin-top: 0;
  margin-bottom: 0.5rem;
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

.video-container {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  aspect-ratio: 16 / 9;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-wrapper.local {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 200px;
  height: auto;
  aspect-ratio: 4 / 3;
  border: 2px solid white;
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
}

.remote-video,
.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remote-video.screen-share {
  object-fit: contain;
}

.video-label {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.screen-share-controls {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.share-options .info-text {
  margin-bottom: 1rem;
  color: #6b7280;
}

.share-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.share-btn {
  padding: 1rem;
  font-size: 1rem;
}

.share-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.share-settings input[type='checkbox'] {
  width: auto;
}

.sharing-active {
  text-align: center;
}

.sharing-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  background: #fef2f2;
  border: 2px solid #ef4444;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.sharing-icon {
  font-size: 2rem;
  animation: pulse 1.5s ease-in-out infinite;
}

.sharing-text .primary {
  font-size: 1.125rem;
  font-weight: 700;
  color: #991b1b;
  margin-bottom: 0.25rem;
}

.sharing-text .secondary {
  font-size: 0.875rem;
  color: #6b7280;
}

.sharing-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 6px;
}

.stat {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.stop-share-btn {
  width: 100%;
  background-color: #ef4444;
}

.stop-share-btn:hover {
  background-color: #dc2626;
}

.quick-actions {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.action-btn {
  padding: 0.75rem;
  background: #f3f4f6;
  color: #374151;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.action-btn.active {
  background: #3b82f6;
  color: white;
}

.sharing-history {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
}

.history-icon {
  font-size: 1.5rem;
}

.history-info {
  flex: 1;
}

.history-type {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.history-duration {
  font-size: 0.75rem;
  color: #6b7280;
}

.history-timestamp {
  font-size: 0.75rem;
  color: #9ca3af;
}

.button-group {
  display: flex;
  gap: 0.75rem;
}

.compat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.compat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.compat-item.supported {
  background: #ecfdf5;
  border-color: #10b981;
}

.compat-icon {
  font-size: 1.5rem;
}

.compat-label {
  font-weight: 500;
}

.compat-warning {
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  color: #92400e;
  font-size: 0.875rem;
}
</style>
