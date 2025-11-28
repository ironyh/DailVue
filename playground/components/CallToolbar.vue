<template>
  <div class="call-toolbar">
    <div class="container">
      <div class="toolbar-content">
        <!-- Left: Connection Status -->
        <div class="status-section">
          <div class="status-item">
            <span
              class="status-dot"
              :class="{ connected: isConnected }"
              :aria-label="`Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`"
            ></span>
            <span class="status-label">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
          </div>

          <div class="status-item">
            <span
              class="status-dot"
              :class="{ connected: isRegistered }"
              :aria-label="`Registration status: ${isRegistered ? 'Registered' : 'Not Registered'}`"
            ></span>
            <span class="status-label">{{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
          </div>
        </div>

        <!-- Center: Call Information -->
        <div v-if="hasActiveCall" class="call-info" role="status" aria-live="polite">
          <span class="call-state">{{ callStateDisplay }}</span>
          <span class="caller-id">{{ callerDisplay }}</span>
          <span class="call-duration">{{ formattedDuration }}</span>
        </div>
        <div v-else class="call-info">
          <span class="no-call-text">No active call</span>
        </div>

        <!-- Right: Call Controls -->
        <div class="call-controls">
          <button
            v-if="showAnswerButton"
            class="btn btn-success btn-sm"
            @click="handleAnswer"
            aria-label="Answer call"
          >
            📞 Answer
          </button>

          <button
            v-if="isActive"
            class="btn btn-secondary btn-sm"
            :class="{ active: isMuted }"
            @click="handleMuteToggle"
            :aria-label="isMuted ? 'Unmute audio' : 'Mute audio'"
            :aria-pressed="isMuted"
          >
            {{ isMuted ? '🔇' : '🔊' }} {{ isMuted ? 'Unmute' : 'Mute' }}
          </button>

          <button
            v-if="isActive"
            class="btn btn-secondary btn-sm"
            :class="{ active: isOnHold }"
            @click="handleHoldToggle"
            :aria-label="isOnHold ? 'Resume call' : 'Hold call'"
            :aria-pressed="isOnHold"
          >
            {{ isOnHold ? '▶️' : '⏸️' }} {{ isOnHold ? 'Resume' : 'Hold' }}
          </button>

          <button
            v-if="isActive"
            class="btn btn-danger btn-sm"
            @click="handleHangup"
            aria-label="Hangup call"
          >
            ❌ Hangup
          </button>

          <!-- Disconnect button when connected but no active call -->
          <button
            v-if="isConnected && !isActive"
            class="btn btn-warning btn-sm"
            @click="handleDisconnect"
            aria-label="Disconnect from SIP server"
          >
            🔌 Disconnect
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCallSession } from '../../src'
import { playgroundSipClient } from '../sipClient'

// Use shared SIP client instance
const { isConnected, isRegistered, getClient, disconnect } = playgroundSipClient

// Get client reference for composables
const sipClientRef = computed(() => getClient())

// Get call session state and methods
const {
  session,
  state,
  direction,
  remoteUri,
  remoteDisplayName,
  duration,
  isActive,
  isMuted,
  isOnHold,
  answer,
  hangup,
  mute,
  unmute,
  hold,
  unhold,
} = useCallSession(sipClientRef)

// Computed properties
const hasActiveCall = computed(() => session.value !== null)

const showAnswerButton = computed(() => state.value === 'ringing' && direction.value === 'incoming')

const callerDisplay = computed(() => remoteDisplayName.value || remoteUri.value || 'Unknown')

const callStateDisplay = computed(() => {
  const stateStr = state.value || 'idle'
  return stateStr.charAt(0).toUpperCase() + stateStr.slice(1)
})

const formattedDuration = computed(() => {
  const mins = Math.floor(duration.value / 60)
  const secs = duration.value % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

// Methods
const handleAnswer = async () => {
  try {
    await answer()
  } catch (error) {
    console.error('Failed to answer call:', error)
  }
}

const handleHangup = async () => {
  try {
    await hangup()
  } catch (error) {
    console.error('Failed to hangup call:', error)
  }
}

const handleMuteToggle = async () => {
  try {
    if (isMuted.value) {
      await unmute()
    } else {
      await mute()
    }
  } catch (error) {
    console.error('Failed to toggle mute:', error)
  }
}

const handleHoldToggle = async () => {
  try {
    if (isOnHold.value) {
      await unhold()
    } else {
      await hold()
    }
  } catch (error) {
    console.error('Failed to toggle hold:', error)
  }
}

const handleDisconnect = async () => {
  try {
    // Hangup any active call first
    if (isActive.value) {
      await hangup()
    }
    await disconnect()
  } catch (error) {
    console.error('Failed to disconnect:', error)
  }
}
</script>

<style scoped>
.call-toolbar {
  background: linear-gradient(120deg, #667eea 0%, #764ba2 50%, #4f46e5 100%) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  border-radius: 0;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
}

.toolbar-content {
  display: flex;
  align-items: center;
  gap: 2rem;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Status Section */
.status-section {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  transition: background 0.3s;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
}

.status-dot.connected {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.status-label {
  white-space: nowrap;
}

/* Call Info Section */
.call-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  justify-content: center;
}

.call-state {
  font-weight: 600;
  text-transform: capitalize;
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.caller-id {
  font-size: 1rem;
  font-weight: 500;
}

.call-duration {
  font-family: monospace;
  font-size: 1rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
}

.no-call-text {
  font-size: 0.9375rem;
  opacity: 0.85;
  font-style: italic;
  font-weight: 500;
}

/* Call Controls */
.call-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-secondary.active {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.5);
}

.btn:active {
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 1024px) {
  .toolbar-content {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .status-section {
    flex: 1 1 100%;
    justify-content: center;
  }

  .call-info {
    flex: 1 1 auto;
    border-left: none;
    border-right: none;
    padding: 0;
  }

  .call-controls {
    flex: 1 1 100%;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .toolbar-content {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .status-section {
    justify-content: space-around;
  }

  .call-info {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .call-controls {
    flex-wrap: wrap;
  }

  .btn-sm {
    flex: 1;
    min-width: 100px;
    justify-content: center;
  }
}
</style>
