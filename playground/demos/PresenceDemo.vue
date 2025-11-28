<template>
  <div class="presence-demo">
    <!-- Configuration Panel -->
    <div v-if="!isConnected" class="config-panel">
      <h3>SIP Server Configuration</h3>
      <p class="info-text">
        Configure your SIP server details to test SIP Presence (SUBSCRIBE/NOTIFY) functionality.
        You'll be able to set your status and watch other users' presence.
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
        <strong>💡 Tip:</strong> Presence (SUBSCRIBE/NOTIFY) functionality requires server
        support. Make sure your SIP server has presence features enabled.
      </div>
    </div>

    <!-- Connected Interface -->
    <div v-else class="connected-interface">
      <!-- Status Bar -->
      <div class="status-bar">
        <div class="status-item">
          <span class="status-dot connected"></span>
          <span>Connected</span>
        </div>
        <div class="status-item">
          <span class="status-dot" :class="{ connected: isRegistered }"></span>
          <span>{{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
        </div>
        <button class="btn btn-sm btn-secondary" @click="handleDisconnect">
          Disconnect
        </button>
      </div>

      <!-- Presence Controls -->
      <div class="presence-panel">
        <!-- Own Status Section -->
        <div class="status-section">
          <h3>Your Presence Status</h3>
          <div class="status-display">
            <span class="status-icon" :class="`status-${currentState}`">
              {{ getStatusIcon(currentState) }}
            </span>
            <span class="status-text">{{ formatStatus(currentState) }}</span>
            <span v-if="currentStatus?.statusMessage" class="status-message">
              - {{ currentStatus.statusMessage }}
            </span>
          </div>

          <div class="status-buttons">
            <button
              class="btn btn-status"
              :class="{ active: currentState === 'available' }"
              @click="handleSetStatus('available')"
              :disabled="!isRegistered"
            >
              🟢 Available
            </button>
            <button
              class="btn btn-status"
              :class="{ active: currentState === 'away' }"
              @click="handleSetStatus('away')"
              :disabled="!isRegistered"
            >
              🟡 Away
            </button>
            <button
              class="btn btn-status"
              :class="{ active: currentState === 'busy' }"
              @click="handleSetStatus('busy')"
              :disabled="!isRegistered"
            >
              🔴 Busy
            </button>
            <button
              class="btn btn-status"
              :class="{ active: currentState === 'offline' }"
              @click="handleSetStatus('offline')"
              :disabled="!isRegistered"
            >
              ⚫ Offline
            </button>
          </div>

          <div class="form-group">
            <label for="status-message">Status Message (Optional)</label>
            <input
              id="status-message"
              v-model="statusMessage"
              type="text"
              placeholder="e.g., In a meeting"
              :disabled="!isRegistered"
            />
          </div>
        </div>

        <!-- Watch Users Section -->
        <div class="watch-section">
          <h3>Watch User Presence</h3>
          <p class="info-text">
            Subscribe to another user's presence to see when their status changes.
          </p>

          <div class="watch-form">
            <input
              v-model="targetUser"
              type="text"
              placeholder="sip:user@example.com"
              class="watch-input"
              :disabled="!isRegistered"
              @keyup.enter="handleWatchUser"
            />
            <button
              class="btn btn-primary"
              :disabled="!targetUser.trim() || !isRegistered || isWatching"
              @click="handleWatchUser"
            >
              {{ isWatching ? 'Subscribing...' : '👁️ Watch User' }}
            </button>
          </div>

          <div v-if="watchError" class="error-message">
            {{ watchError }}
          </div>
        </div>

        <!-- Watched Users List -->
        <div v-if="watchedUsers.size > 0" class="watched-list">
          <h3>Watched Users ({{ watchedUsers.size }})</h3>
          <div class="watched-users">
            <div
              v-for="[uri, status] in Array.from(watchedUsers.entries())"
              :key="uri"
              class="watched-user"
            >
              <div class="user-info">
                <span class="status-icon" :class="`status-${status.state}`">
                  {{ getStatusIcon(status.state) }}
                </span>
                <div class="user-details">
                  <div class="user-uri">{{ uri }}</div>
                  <div class="user-status">
                    {{ formatStatus(status.state) }}
                    <span v-if="status.statusMessage" class="status-message">
                      - {{ status.statusMessage }}
                    </span>
                  </div>
                  <div v-if="status.lastUpdate" class="last-update">
                    Updated: {{ formatTime(status.lastUpdate) }}
                  </div>
                </div>
              </div>
              <button
                class="btn btn-sm btn-danger"
                @click="handleUnwatch(uri)"
                title="Stop watching this user"
              >
                ✕ Unwatch
              </button>
            </div>
          </div>

          <button
            v-if="watchedUsers.size > 1"
            class="btn btn-secondary"
            @click="handleUnwatchAll"
          >
            Unwatch All
          </button>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <p>👁️ No users being watched</p>
          <p class="info-text">Enter a SIP URI above to start watching a user's presence.</p>
        </div>

        <!-- Presence Events Log -->
        <div v-if="presenceEvents.length > 0" class="events-log">
          <h3>Recent Events ({{ presenceEvents.length }})</h3>
          <div class="events-list">
            <div
              v-for="(event, index) in presenceEvents.slice(-10).reverse()"
              :key="index"
              class="event-item"
            >
              <span class="event-time">{{ formatTime(event.timestamp) }}</span>
              <span class="event-type">{{ event.type }}</span>
              <span class="event-details">{{ formatEvent(event) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient, usePresence } from '../../src'
import { PresenceState, type PresenceEvent } from '../../src/types/presence.types'

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
const statusMessage = ref('')
const targetUser = ref('')
const isWatching = ref(false)
const watchError = ref('')
const presenceEvents = ref<PresenceEvent[]>([])

// SIP Client
const { connect, disconnect, isConnected, isRegistered, error: sipError, updateConfig, getClient } = useSipClient()

// Presence
const sipClientRef = computed(() => getClient())
const {
  currentStatus,
  currentState,
  watchedUsers,
  subscriptionCount,
  setStatus,
  subscribe,
  unsubscribe,
  unsubscribeAll,
  onPresenceEvent,
} = usePresence(sipClientRef)

// Listen to presence events
onPresenceEvent((event) => {
  presenceEvents.value.push(event)
  // Keep only last 50 events
  if (presenceEvents.value.length > 50) {
    presenceEvents.value = presenceEvents.value.slice(-50)
  }
})

// Validation
const isConfigValid = computed(() => {
  return !!(
    config.value.uri &&
    config.value.sipUri &&
    config.value.password &&
    config.value.uri.startsWith('ws')
  )
})

// Connection Handlers
async function handleConnect() {
  connecting.value = true
  connectionError.value = ''

  try {
    updateConfig({
      uri: config.value.uri,
      sipUri: config.value.sipUri,
      password: config.value.password,
      displayName: config.value.displayName || undefined,
    })

    await connect()
  } catch (error) {
    connectionError.value = error instanceof Error ? error.message : 'Connection failed'
  } finally {
    connecting.value = false
  }
}

async function handleDisconnect() {
  try {
    await disconnect()
    presenceEvents.value = []
  } catch (error) {
    console.error('Disconnect error:', error)
  }
}

// Status Handlers
async function handleSetStatus(state: string) {
  if (!isRegistered.value) return

  try {
    await setStatus(state as PresenceState, {
      statusMessage: statusMessage.value || undefined,
    })
  } catch (error) {
    console.error('Set status error:', error)
    connectionError.value = error instanceof Error ? error.message : 'Failed to set status'
  }
}

// Watch Handlers
async function handleWatchUser() {
  if (!targetUser.value.trim() || !isRegistered.value) return

  isWatching.value = true
  watchError.value = ''

  try {
    await subscribe(targetUser.value.trim())
    targetUser.value = '' // Clear input on success
  } catch (error) {
    watchError.value = error instanceof Error ? error.message : 'Failed to watch user'
  } finally {
    isWatching.value = false
  }
}

async function handleUnwatch(uri: string) {
  try {
    await unsubscribe(uri)
  } catch (error) {
    console.error('Unwatch error:', error)
  }
}

async function handleUnwatchAll() {
  try {
    await unsubscribeAll()
  } catch (error) {
    console.error('Unwatch all error:', error)
  }
}

// Utility Functions
function getStatusIcon(state: string): string {
  const icons: Record<string, string> = {
    available: '🟢',
    away: '🟡',
    busy: '🔴',
    offline: '⚫',
    custom: '🔵',
  }
  return icons[state] || '⚪'
}

function formatStatus(state: string): string {
  const labels: Record<string, string> = {
    available: 'Available',
    away: 'Away',
    busy: 'Busy',
    offline: 'Offline',
    custom: 'Custom',
  }
  return labels[state] || state.charAt(0).toUpperCase() + state.slice(1)
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString()
}

function formatEvent(event: PresenceEvent): string {
  switch (event.type) {
    case 'updated':
      return `${event.uri} is now ${formatStatus(event.status.state)}`
    case 'subscribed':
      return `Subscribed to ${event.uri}`
    case 'unsubscribed':
      return `Unsubscribed from ${event.uri}`
    case 'published':
      return `Published status: ${formatStatus(event.status.state)}`
    default:
      return JSON.stringify(event)
  }
}
</script>

<style scoped>
.presence-demo {
  max-width: 800px;
  margin: 0 auto;
}

/* Config Panel */
.config-panel {
  padding: 2rem;
}

.config-panel h3 {
  margin-bottom: 1rem;
  color: #333;
}

.info-text {
  margin-bottom: 1.5rem;
  color: #666;
  font-size: 0.875rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.form-group input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
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

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #991b1b;
  font-size: 0.875rem;
}

.demo-tip {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f0f9ff;
  border-left: 4px solid #3b82f6;
  border-radius: 4px;
  font-size: 0.875rem;
}

/* Connected Interface */
.connected-interface {
  padding: 2rem;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-dot.connected {
  background: #10b981;
}

/* Presence Panel */
.presence-panel {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.status-section,
.watch-section,
.watched-list,
.events-log {
  padding: 1.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.status-section h3,
.watch-section h3,
.watched-list h3,
.events-log h3 {
  margin-bottom: 1rem;
  color: #111827;
}

.status-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.status-icon {
  font-size: 1.5rem;
}

.status-text {
  font-weight: 500;
  color: #111827;
}

.status-message {
  color: #6b7280;
  font-style: italic;
}

.status-buttons {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.btn-status {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  background: #f3f4f6;
  color: #374151;
  border: 2px solid #e5e7eb;
}

.btn-status:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-status.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

/* Watch Section */
.watch-form {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.watch-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

/* Watched Users */
.watched-users {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.watched-user {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.user-info {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.user-details {
  flex: 1;
}

.user-uri {
  font-weight: 500;
  color: #111827;
  margin-bottom: 0.25rem;
}

.user-status {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.last-update {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* Empty State */
.empty-state {
  padding: 2rem;
  text-align: center;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  color: #6b7280;
}

.empty-state p:first-child {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

/* Events Log */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 4px;
  font-size: 0.875rem;
}

.event-time {
  color: #9ca3af;
  font-size: 0.75rem;
  white-space: nowrap;
}

.event-type {
  color: #667eea;
  font-weight: 500;
  min-width: 100px;
}

.event-details {
  color: #374151;
  flex: 1;
}

/* Status Colors */
.status-available {
  color: #10b981;
}

.status-away {
  color: #f59e0b;
}

.status-busy {
  color: #ef4444;
}

.status-offline {
  color: #6b7280;
}

/* Responsive */
@media (max-width: 768px) {
  .status-buttons {
    flex-direction: column;
  }

  .btn-status {
    width: 100%;
  }

  .watch-form {
    flex-direction: column;
  }

  .watched-user {
    flex-direction: column;
    gap: 1rem;
  }

  .status-bar {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
