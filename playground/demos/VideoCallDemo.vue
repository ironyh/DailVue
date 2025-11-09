<template>
  <div class="video-call-demo">
    <div class="info-section">
      <p>
        VueSip supports video calling with full camera and screen sharing capabilities. Enable
        video during calls to have face-to-face conversations.
      </p>
      <p class="note">
        <strong>Note:</strong> Your browser will request camera and microphone permissions. Grant
        access to enable video calling features.
      </p>
    </div>

    <!-- Connection Status -->
    <div v-if="!isConnected" class="status-message info">
      Connect to a SIP server to use video features (use the Basic Call demo to connect)
    </div>

    <!-- Video Call Interface -->
    <div v-else class="video-interface">
      <!-- Video Display -->
      <div class="video-display">
        <!-- Remote Video (Main Display) -->
        <div class="remote-video-container">
          <video
            ref="remoteVideoEl"
            class="remote-video"
            autoplay
            playsinline
          ></video>
          <div v-if="!remoteStream" class="video-placeholder remote">
            <div class="placeholder-content">
              <span class="icon">📹</span>
              <span class="text">
                {{ callState === 'active' ? 'Waiting for remote video...' : 'No active video call' }}
              </span>
            </div>
          </div>
          <div v-if="remoteUri && callState === 'active'" class="video-overlay">
            <span class="remote-name">{{ remoteDisplayName || remoteUri }}</span>
          </div>
        </div>

        <!-- Local Video (Picture-in-Picture) -->
        <div class="local-video-container" v-if="localStream">
          <video
            ref="localVideoEl"
            class="local-video"
            autoplay
            playsinline
            muted
          ></video>
          <div class="local-video-label">You</div>
        </div>
      </div>

      <!-- Call Controls -->
      <div class="call-controls">
        <!-- When idle -->
        <div v-if="callState === 'idle'" class="dial-section">
          <input
            v-model="dialNumber"
            type="text"
            placeholder="Enter SIP URI (e.g., sip:user@example.com)"
            @keyup.enter="handleMakeCall"
          />
          <button
            class="btn btn-success"
            :disabled="!dialNumber.trim() || !isRegistered"
            @click="handleMakeCall"
          >
            📹 Start Video Call
          </button>
        </div>

        <!-- When in call -->
        <div v-else class="active-call-controls">
          <div class="call-status">
            <span class="status-dot"></span>
            <span class="status-text">{{ callStateDisplay }}</span>
            <span v-if="duration && callState === 'active'" class="duration">
              {{ formatDuration(duration) }}
            </span>
          </div>

          <div class="control-buttons">
            <button
              v-if="callState === 'incoming'"
              class="btn btn-success"
              @click="handleAnswer"
            >
              ✓ Answer
            </button>

            <button
              class="btn btn-control"
              :class="{ active: !isMuted }"
              :title="isMuted ? 'Unmute' : 'Mute'"
              @click="handleToggleMute"
            >
              {{ isMuted ? '🔇' : '🎤' }}
            </button>

            <button
              class="btn btn-control"
              :class="{ active: hasLocalVideo }"
              :title="hasLocalVideo ? 'Stop Video' : 'Start Video'"
              @click="handleToggleVideo"
            >
              {{ hasLocalVideo ? '📹' : '📷' }}
            </button>

            <button
              class="btn btn-danger"
              @click="handleHangup"
            >
              📞 End Call
            </button>
          </div>
        </div>
      </div>

      <!-- Camera Selection -->
      <div v-if="videoInputDevices.length > 0" class="device-selection">
        <h4>Camera Settings</h4>
        <div class="device-selector">
          <label for="camera-select">Select Camera:</label>
          <select
            id="camera-select"
            v-model="selectedVideoInputId"
            @change="handleCameraChange"
          >
            <option
              v-for="device in videoInputDevices"
              :key="device.deviceId"
              :value="device.deviceId"
            >
              {{ device.label || `Camera ${device.deviceId.slice(0, 8)}` }}
            </option>
          </select>
        </div>
      </div>

      <!-- Video Statistics (Debug Info) -->
      <div v-if="callState === 'active' && session" class="video-stats">
        <h4>Video Information</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Local Video:</span>
            <span class="stat-value">{{ hasLocalVideo ? 'Enabled' : 'Disabled' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Remote Video:</span>
            <span class="stat-value">{{ remoteStream ? 'Receiving' : 'Not receiving' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Audio:</span>
            <span class="stat-value">{{ isMuted ? 'Muted' : 'Active' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Code Example -->
    <div class="code-example">
      <h4>Code Example</h4>
      <pre><code>import { useSipClient, useCallSession, useMediaDevices } from 'vuesip'

const sipClient = useSipClient()
const {
  makeCall,
  answer,
  hangup,
  localStream,
  remoteStream,
  hasLocalVideo,
  enableVideo,
  disableVideo
} = useCallSession(sipClient)

const {
  videoInputDevices,
  selectedVideoInputId,
  selectVideoInput,
  enumerateDevices
} = useMediaDevices()

// Make a video call
await makeCall('sip:friend@example.com', {
  audio: true,
  video: true // Enable video
})

// Answer with video
await answer({
  audio: true,
  video: true
})

// Toggle video during call
if (hasLocalVideo.value) {
  await disableVideo()
} else {
  await enableVideo()
}

// Change camera
selectVideoInput(deviceId)

// Display video streams
const remoteVideoEl = ref<HTMLVideoElement>()
const localVideoEl = ref<HTMLVideoElement>()

watch(remoteStream, (stream) => {
  if (remoteVideoEl.value && stream) {
    remoteVideoEl.value.srcObject = stream
  }
})

watch(localStream, (stream) => {
  if (localVideoEl.value && stream) {
    localVideoEl.value.srcObject = stream
  }
})</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useSipClient, useCallSession, useMediaDevices } from '../../src'

// SIP Client
const { isConnected, isRegistered, getClient } = useSipClient()

// Call Session
const sipClientRef = computed(() => getClient())
const {
  state: callState,
  remoteUri,
  remoteDisplayName,
  isMuted,
  duration,
  localStream,
  remoteStream,
  session,
  makeCall,
  answer,
  hangup,
  mute,
  unmute,
  enableVideo,
  disableVideo,
} = useCallSession(sipClientRef)

// Media Devices
const {
  videoInputDevices,
  selectedVideoInputId,
  selectVideoInput,
  enumerateDevices,
} = useMediaDevices()

// State
const dialNumber = ref('')
const remoteVideoEl = ref<HTMLVideoElement>()
const localVideoEl = ref<HTMLVideoElement>()

// Computed
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

const hasLocalVideo = computed(() => {
  if (!localStream.value) return false
  const videoTracks = localStream.value.getVideoTracks()
  return videoTracks.length > 0 && videoTracks[0].enabled
})

// Methods
const handleMakeCall = async () => {
  if (!dialNumber.value.trim()) return

  try {
    await makeCall(dialNumber.value, {
      audio: true,
      video: true,
    })
  } catch (error) {
    console.error('Make call error:', error)
    alert(`Failed to make call: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const handleAnswer = async () => {
  try {
    await answer({
      audio: true,
      video: true,
    })
  } catch (error) {
    console.error('Answer error:', error)
    alert(`Failed to answer: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

const handleToggleVideo = async () => {
  try {
    if (hasLocalVideo.value) {
      await disableVideo()
    } else {
      await enableVideo()
    }
  } catch (error) {
    console.error('Toggle video error:', error)
    alert(`Failed to toggle video: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const handleCameraChange = () => {
  if (selectedVideoInputId.value) {
    selectVideoInput(selectedVideoInputId.value)
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Watch for stream changes and update video elements
watch(remoteStream, (stream) => {
  if (remoteVideoEl.value) {
    remoteVideoEl.value.srcObject = stream
  }
})

watch(localStream, (stream) => {
  if (localVideoEl.value) {
    localVideoEl.value.srcObject = stream
  }
})

// Request permissions and enumerate devices on mount
onMounted(async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    await enumerateDevices()
  } catch (error) {
    console.warn('Could not get media permissions:', error)
  }
})
</script>

<style scoped>
.video-call-demo {
  max-width: 900px;
  margin: 0 auto;
}

.info-section {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-section p {
  margin: 0 0 1rem 0;
  color: #666;
  line-height: 1.6;
}

.info-section p:last-child {
  margin-bottom: 0;
}

.note {
  padding: 1rem;
  background: #eff6ff;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  font-size: 0.875rem;
}

.status-message {
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
  font-size: 0.875rem;
}

.status-message.info {
  background: #eff6ff;
  color: #1e40af;
}

.video-interface {
  padding: 1.5rem;
}

.video-display {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  aspect-ratio: 16 / 9;
}

.remote-video-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.video-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #9ca3af;
}

.placeholder-content .icon {
  font-size: 4rem;
  opacity: 0.5;
}

.placeholder-content .text {
  font-size: 1rem;
}

.video-overlay {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.local-video-container {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 200px;
  aspect-ratio: 4 / 3;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* Mirror effect */
}

.local-video-label {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.call-controls {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.dial-section {
  display: flex;
  gap: 0.75rem;
}

.dial-section input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.dial-section input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.active-call-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.call-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 6px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.duration {
  font-family: monospace;
  font-size: 1.125rem;
  font-weight: 600;
  color: #667eea;
}

.control-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
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

.btn-control {
  background: #6b7280;
  color: white;
  min-width: 60px;
}

.btn-control:hover:not(:disabled) {
  background: #4b5563;
}

.btn-control.active {
  background: #667eea;
}

.btn-control.active:hover:not(:disabled) {
  background: #5568d3;
}

.device-selection {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.device-selection h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.device-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.device-selector label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
}

.device-selector select {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
}

.device-selector select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.video-stats {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.video-stats h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
}

.stat-value {
  font-size: 0.875rem;
  color: #333;
  font-weight: 600;
}

.code-example {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.code-example h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.code-example pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0;
}

.code-example code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .local-video-container {
    width: 120px;
  }

  .control-buttons {
    flex-wrap: wrap;
  }

  .device-selector {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
