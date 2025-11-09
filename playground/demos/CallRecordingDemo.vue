<template>
  <div class="call-recording-demo">
    <h2>📹 Call Recording</h2>
    <p class="description">Record and playback call audio with duration tracking and file management.</p>

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

    <!-- Active Call with Recording -->
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

      <!-- Recording Controls -->
      <div class="recording-controls">
        <h4>Recording</h4>

        <div v-if="!isRecording && !recordedBlob" class="recording-status">
          <span class="indicator idle">⚪</span>
          <span>Ready to record</span>
        </div>

        <div v-if="isRecording" class="recording-status recording">
          <span class="indicator pulse">🔴</span>
          <span>Recording: {{ recordingDuration }}</span>
        </div>

        <div v-if="recordedBlob && !isRecording" class="recording-status">
          <span class="indicator">✅</span>
          <span>Recording saved ({{ recordingSize }})</span>
        </div>

        <div class="button-group">
          <button
            v-if="!isRecording"
            @click="startRecording"
            :disabled="!canRecord"
            class="record-btn"
          >
            🎙️ Start Recording
          </button>
          <button
            v-if="isRecording"
            @click="stopRecording"
            class="stop-btn"
          >
            ⏹️ Stop Recording
          </button>
        </div>

        <!-- Recording Options -->
        <div class="recording-options">
          <label>
            <input type="checkbox" v-model="autoRecord" />
            Auto-record calls
          </label>
          <label>
            <input type="checkbox" v-model="recordRemoteOnly" />
            Record remote audio only
          </label>
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

    <!-- Recordings List -->
    <div v-if="recordings.length > 0" class="recordings-section">
      <h3>Saved Recordings ({{ recordings.length }})</h3>

      <div class="recordings-list">
        <div
          v-for="recording in recordings"
          :key="recording.id"
          class="recording-item"
        >
          <div class="recording-info">
            <div class="recording-name">{{ recording.name }}</div>
            <div class="recording-meta">
              <span>{{ recording.duration }}</span>
              <span>{{ recording.size }}</span>
              <span>{{ recording.timestamp }}</span>
            </div>
          </div>

          <div class="recording-controls">
            <button
              @click="playRecording(recording)"
              :disabled="currentlyPlaying === recording.id"
              class="play-btn"
            >
              {{ currentlyPlaying === recording.id ? '⏸️ Playing' : '▶️ Play' }}
            </button>
            <button
              @click="downloadRecording(recording)"
              class="download-btn"
            >
              💾 Download
            </button>
            <button
              @click="deleteRecording(recording.id)"
              class="delete-btn"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div class="recordings-actions">
        <button @click="clearAllRecordings" class="danger">
          Clear All Recordings
        </button>
      </div>
    </div>

    <!-- Audio Player (hidden) -->
    <audio ref="audioPlayer" @ended="onPlaybackEnded"></audio>
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
  currentCall,
  callState,
  hasActiveCall,
} = useSipCall(sipClient)

// Recording State
const isRecording = ref(false)
const recordedBlob = ref<Blob | null>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordingStartTime = ref<number>(0)
const recordingDuration = ref('00:00')
const recordingTimer = ref<number | null>(null)
const audioChunks = ref<Blob[]>([])

// Recording Options
const autoRecord = ref(false)
const recordRemoteOnly = ref(false)

// Recordings Storage
interface SavedRecording {
  id: string
  name: string
  blob: Blob
  duration: string
  size: string
  timestamp: string
  date: Date
}

const recordings = ref<SavedRecording[]>([])
const currentlyPlaying = ref<string | null>(null)
const audioPlayer = ref<HTMLAudioElement | null>(null)

// Call Duration Timer
const callStartTime = ref<number>(0)
const callDuration = ref('00:00')
const callTimer = ref<number | null>(null)

// Computed
const canRecord = computed(() => {
  return hasActiveCall.value && callState.value === 'active' && !isRecording.value
})

const recordingSize = computed(() => {
  if (!recordedBlob.value) return '0 KB'
  const kb = Math.round(recordedBlob.value.size / 1024)
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(2)} MB`
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

// Start Call Duration Timer
const startCallTimer = () => {
  callStartTime.value = Date.now()
  callTimer.value = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime.value) / 1000)
    callDuration.value = formatTime(elapsed)
  }, 1000)
}

// Stop Call Duration Timer
const stopCallTimer = () => {
  if (callTimer.value) {
    clearInterval(callTimer.value)
    callTimer.value = null
  }
  callDuration.value = '00:00'
}

// Start Recording Duration Timer
const startRecordingTimer = () => {
  recordingStartTime.value = Date.now()
  recordingTimer.value = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime.value) / 1000)
    recordingDuration.value = formatTime(elapsed)
  }, 1000)
}

// Stop Recording Duration Timer
const stopRecordingTimer = () => {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
}

// Start Recording
const startRecording = async () => {
  if (!currentCall.value) return

  try {
    // Get the remote stream from the call
    const remoteStream = currentCall.value.remoteStream
    if (!remoteStream) {
      console.error('No remote stream available')
      return
    }

    // Create a MediaStream to record
    let streamToRecord: MediaStream

    if (recordRemoteOnly.value) {
      // Record only remote audio
      streamToRecord = remoteStream
    } else {
      // Record both local and remote audio (mixed)
      const localStream = currentCall.value.localStream
      if (!localStream) {
        streamToRecord = remoteStream
      } else {
        // Mix both streams
        const audioContext = new AudioContext()
        const destination = audioContext.createMediaStreamDestination()

        const remoteSource = audioContext.createMediaStreamSource(remoteStream)
        remoteSource.connect(destination)

        const localSource = audioContext.createMediaStreamSource(localStream)
        localSource.connect(destination)

        streamToRecord = destination.stream
      }
    }

    // Create MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    mediaRecorder.value = new MediaRecorder(streamToRecord, {
      mimeType,
    })

    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = () => {
      const blob = new Blob(audioChunks.value, { type: mimeType })
      recordedBlob.value = blob
      saveRecording(blob)
    }

    mediaRecorder.value.start()
    isRecording.value = true
    startRecordingTimer()

    console.log('Recording started')
  } catch (error) {
    console.error('Failed to start recording:', error)
  }
}

// Stop Recording
const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    stopRecordingTimer()
    console.log('Recording stopped')
  }
}

// Save Recording
const saveRecording = (blob: Blob) => {
  const recording: SavedRecording = {
    id: `recording-${Date.now()}`,
    name: `Call Recording ${new Date().toLocaleString()}`,
    blob,
    duration: recordingDuration.value,
    size: recordingSize.value,
    timestamp: new Date().toLocaleTimeString(),
    date: new Date(),
  }

  recordings.value.unshift(recording)

  // Limit to 10 recordings
  if (recordings.value.length > 10) {
    recordings.value = recordings.value.slice(0, 10)
  }

  console.log('Recording saved:', recording.name)
}

// Play Recording
const playRecording = (recording: SavedRecording) => {
  if (!audioPlayer.value) return

  if (currentlyPlaying.value === recording.id) {
    // Stop playback
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
    currentlyPlaying.value = null
  } else {
    // Start playback
    const url = URL.createObjectURL(recording.blob)
    audioPlayer.value.src = url
    audioPlayer.value.play()
    currentlyPlaying.value = recording.id
  }
}

// Playback Ended
const onPlaybackEnded = () => {
  currentlyPlaying.value = null
}

// Download Recording
const downloadRecording = (recording: SavedRecording) => {
  const url = URL.createObjectURL(recording.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${recording.name}.webm`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Delete Recording
const deleteRecording = (id: string) => {
  const index = recordings.value.findIndex((r) => r.id === id)
  if (index !== -1) {
    recordings.value.splice(index, 1)
  }
}

// Clear All Recordings
const clearAllRecordings = () => {
  if (confirm('Are you sure you want to delete all recordings?')) {
    recordings.value = []
  }
}

// Watch call state
watch(callState, (newState, oldState) => {
  if (newState === 'active' && oldState !== 'active') {
    // Call became active
    startCallTimer()

    // Auto-record if enabled
    if (autoRecord.value) {
      setTimeout(() => {
        startRecording()
      }, 500) // Small delay to ensure streams are ready
    }
  } else if (newState === 'terminated' || newState === 'disconnected') {
    // Call ended
    stopCallTimer()

    // Stop recording if active
    if (isRecording.value) {
      stopRecording()
    }
  }
})

// Cleanup
onUnmounted(() => {
  stopCallTimer()
  stopRecordingTimer()
  if (isRecording.value) {
    stopRecording()
  }
})
</script>

<style scoped>
.call-recording-demo {
  max-width: 800px;
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
.active-call-section,
.recordings-section {
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

.recording-controls {
  background: white;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.recording-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f3f4f6;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.recording-status.recording {
  background: #fef2f2;
  color: #991b1b;
}

.indicator {
  font-size: 1.25rem;
}

.indicator.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.recording-options {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recording-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.recording-options input[type="checkbox"] {
  width: auto;
}

.button-group {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.record-btn {
  background-color: #dc2626;
}

.record-btn:hover:not(:disabled) {
  background-color: #b91c1c;
}

.stop-btn {
  background-color: #6b7280;
}

.stop-btn:hover:not(:disabled) {
  background-color: #4b5563;
}

.recordings-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.recording-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border-radius: 6px;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.recording-info {
  flex: 1;
}

.recording-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.recording-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.recording-controls {
  display: flex;
  gap: 0.5rem;
}

.recording-controls button {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.play-btn {
  background-color: #10b981;
}

.play-btn:hover:not(:disabled) {
  background-color: #059669;
}

.download-btn {
  background-color: #3b82f6;
}

.download-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.delete-btn {
  background-color: #ef4444;
}

.delete-btn:hover:not(:disabled) {
  background-color: #dc2626;
}

.recordings-actions {
  margin-top: 1rem;
}
</style>
