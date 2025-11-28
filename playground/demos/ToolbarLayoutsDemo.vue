<template>
  <div class="toolbar-layouts-demo">
    <div class="demo-header">
      <h3>Interactive Toolbar Layouts</h3>
      <p>Explore different toolbar positions with live VueSIP functionality</p>
    </div>

    <!-- Layout Selector -->
    <div class="layout-selector">
      <button
        v-for="layout in layouts"
        :key="layout.id"
        :class="['layout-btn', { active: currentLayout === layout.id }]"
        @click="currentLayout = layout.id"
      >
        {{ layout.icon }} {{ layout.name }}
      </button>
    </div>

    <!-- Layout Display -->
    <div class="layout-container">
      <div class="layout-description">
        <h4>{{ activeLayout.name }}</h4>
        <p>{{ activeLayout.description }}</p>
        <div class="use-cases">
          <strong>Best For:</strong>
          <ul>
            <li v-for="useCase in activeLayout.useCases" :key="useCase">{{ useCase }}</li>
          </ul>
        </div>
        <div class="live-indicator">
          <span class="pulse-dot"></span>
          <span>Live VueSIP Integration</span>
        </div>
      </div>

      <!-- Top Horizontal Toolbar -->
      <div v-if="currentLayout === 'top'" class="demo-layout demo-layout-top">
        <div class="demo-toolbar toolbar-top">
          <!-- Status Section -->
          <div class="toolbar-section">
            <div class="status-group">
              <span
                class="status-dot"
                :class="{ connected: isConnected }"
                :title="isConnected ? 'Connected' : 'Disconnected'"
              ></span>
              <span class="status-label">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
            </div>
            <div class="status-group">
              <span
                class="status-dot"
                :class="{ connected: isRegistered }"
                :title="isRegistered ? 'Registered' : 'Not Registered'"
              ></span>
              <span class="status-label">{{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
            </div>
          </div>

          <!-- Call Info Section -->
          <div v-if="hasActiveCall" class="toolbar-section toolbar-section-center">
            <div class="call-info-display">
              <span class="call-state-badge">{{ callStateDisplay }}</span>
              <span class="caller-id">{{ callerDisplay }}</span>
              <span class="call-duration">{{ formattedDuration }}</span>
            </div>
          </div>
          <div v-else class="toolbar-section toolbar-section-center">
            <span class="no-call-text">No active call</span>
          </div>

          <!-- Action Buttons Section -->
          <div class="toolbar-section">
            <button
              v-if="showAnswerButton"
              class="toolbar-btn toolbar-btn-success"
              @click="handleAnswer"
            >
              📞 Answer
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn toolbar-btn-secondary"
              :class="{ active: isMuted }"
              @click="handleMuteToggle"
            >
              {{ isMuted ? '🔇' : '🔊' }} {{ isMuted ? 'Unmute' : 'Mute' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn toolbar-btn-secondary"
              :class="{ active: isOnHold }"
              @click="handleHoldToggle"
            >
              {{ isOnHold ? '▶️' : '⏸️' }} {{ isOnHold ? 'Resume' : 'Hold' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn toolbar-btn-danger"
              @click="handleHangup"
            >
              ❌ Hangup
            </button>
          </div>
        </div>

        <div class="demo-content">
          <p class="demo-placeholder">Main content area below toolbar</p>
          <p class="demo-hint">Make a call from Basic Call Demo to see live toolbar updates</p>
        </div>
      </div>

      <!-- Left Vertical Sidebar -->
      <div v-if="currentLayout === 'left'" class="demo-layout demo-layout-left">
        <div class="demo-toolbar toolbar-left">
          <!-- Status Section -->
          <div class="toolbar-section-vertical">
            <div class="section-title">Status</div>
            <div class="status-group-vertical">
              <span class="status-dot" :class="{ connected: isConnected }"></span>
              <span class="status-label-small">{{
                isConnected ? 'Connected' : 'Disconnected'
              }}</span>
            </div>
            <div class="status-group-vertical">
              <span class="status-dot" :class="{ connected: isRegistered }"></span>
              <span class="status-label-small">{{
                isRegistered ? 'Registered' : 'Not Registered'
              }}</span>
            </div>
          </div>

          <!-- Call Info Section -->
          <div v-if="hasActiveCall" class="toolbar-section-vertical">
            <div class="section-title">Active Call</div>
            <div class="call-info-vertical">
              <div class="info-item">
                <span class="info-label">State:</span>
                <span class="call-state-badge-small">{{ callStateDisplay }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">From:</span>
                <span class="info-value">{{ remoteDisplayName || 'Unknown' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Duration:</span>
                <span class="info-value">{{ formattedDuration }}</span>
              </div>
            </div>
          </div>
          <div v-else class="toolbar-section-vertical">
            <div class="section-title">Call Status</div>
            <p class="no-call-text-small">No active call</p>
          </div>

          <!-- Action Buttons Section -->
          <div v-if="hasActiveCall" class="toolbar-section-vertical">
            <div class="section-title">Controls</div>
            <button
              v-if="showAnswerButton"
              class="toolbar-btn-vertical toolbar-btn-success"
              @click="handleAnswer"
            >
              📞 Answer
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn-vertical toolbar-btn-secondary"
              :class="{ active: isMuted }"
              @click="handleMuteToggle"
            >
              {{ isMuted ? '🔇 Unmute' : '🔊 Mute' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn-vertical toolbar-btn-secondary"
              :class="{ active: isOnHold }"
              @click="handleHoldToggle"
            >
              {{ isOnHold ? '▶️ Resume' : '⏸️ Hold' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn-vertical toolbar-btn-danger"
              @click="handleHangup"
            >
              ❌ Hangup
            </button>
          </div>
        </div>

        <div class="demo-content">
          <p class="demo-placeholder">Main content area to the right of sidebar</p>
          <p class="demo-hint">Status and controls update in real-time</p>
        </div>
      </div>

      <!-- Right Vertical Sidebar -->
      <div v-if="currentLayout === 'right'" class="demo-layout demo-layout-right">
        <div class="demo-content">
          <p class="demo-placeholder">Main content area to the left of sidebar</p>
          <p class="demo-hint">Right sidebar is great for call details panels</p>
        </div>

        <div class="demo-toolbar toolbar-right">
          <!-- Status Section -->
          <div class="toolbar-section-vertical">
            <div class="section-title">Status</div>
            <div class="status-group-vertical">
              <span class="status-dot" :class="{ connected: isConnected }"></span>
              <span class="status-label-small">{{
                isConnected ? 'Connected' : 'Disconnected'
              }}</span>
            </div>
            <div class="status-group-vertical">
              <span class="status-dot" :class="{ connected: isRegistered }"></span>
              <span class="status-label-small">{{
                isRegistered ? 'Registered' : 'Not Registered'
              }}</span>
            </div>
          </div>

          <!-- Call Info Section -->
          <div v-if="hasActiveCall" class="toolbar-section-vertical">
            <div class="section-title">Call Details</div>
            <div class="call-info-vertical">
              <div class="info-item">
                <span class="info-label">State:</span>
                <span class="call-state-badge-small">{{ callStateDisplay }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Caller:</span>
                <span class="info-value">{{
                  remoteDisplayName || remoteUri || 'Unknown'
                }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Time:</span>
                <span class="info-value">{{ formattedDuration }}</span>
              </div>
            </div>
          </div>
          <div v-else class="toolbar-section-vertical">
            <div class="section-title">No Call</div>
            <p class="no-call-text-small">Idle</p>
          </div>

          <!-- Quick Actions -->
          <div v-if="hasActiveCall" class="toolbar-section-vertical">
            <div class="section-title">Actions</div>
            <button
              v-if="showAnswerButton"
              class="toolbar-btn-icon toolbar-btn-success"
              @click="handleAnswer"
              title="Answer"
            >
              📞
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn-icon"
              :class="{ active: isMuted }"
              @click="handleMuteToggle"
              :title="isMuted ? 'Unmute' : 'Mute'"
            >
              {{ isMuted ? '🔇' : '🔊' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn-icon"
              :class="{ active: isOnHold }"
              @click="handleHoldToggle"
              :title="isOnHold ? 'Resume' : 'Hold'"
            >
              {{ isOnHold ? '▶️' : '⏸️' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn-icon toolbar-btn-danger"
              @click="handleHangup"
              title="Hangup"
            >
              ❌
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom Toolbar -->
      <div v-if="currentLayout === 'bottom'" class="demo-layout demo-layout-bottom">
        <div class="demo-content">
          <p class="demo-placeholder">Main content area above toolbar</p>
          <p class="demo-hint">Bottom toolbars are perfect for mobile interfaces</p>
        </div>

        <div class="demo-toolbar toolbar-bottom">
          <!-- Status Section -->
          <div class="toolbar-section">
            <div class="status-group">
              <span class="status-dot" :class="{ connected: isConnected }"></span>
              <span class="status-label">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
            </div>
            <div class="status-group">
              <span class="status-dot" :class="{ connected: isRegistered }"></span>
              <span class="status-label">{{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
            </div>
          </div>

          <!-- Call Info Section -->
          <div v-if="hasActiveCall" class="toolbar-section toolbar-section-center">
            <div class="call-info-compact">
              <span class="call-state-badge">{{ callStateDisplay }}</span>
              <span class="caller-id-compact">{{ remoteDisplayName || remoteUri || 'Unknown' }}</span>
              <span class="call-duration">{{ formattedDuration }}</span>
            </div>
          </div>
          <div v-else class="toolbar-section toolbar-section-center">
            <span class="no-call-text">Idle</span>
          </div>

          <!-- Action Buttons Section -->
          <div class="toolbar-section">
            <button
              v-if="showAnswerButton"
              class="toolbar-btn toolbar-btn-success"
              @click="handleAnswer"
              title="Answer"
            >
              📞
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn toolbar-btn-secondary"
              :class="{ active: isMuted }"
              @click="handleMuteToggle"
              :title="isMuted ? 'Unmute' : 'Mute'"
            >
              {{ isMuted ? '🔇' : '🔊' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn toolbar-btn-secondary"
              :class="{ active: isOnHold }"
              @click="handleHoldToggle"
              :title="isOnHold ? 'Resume' : 'Hold'"
            >
              {{ isOnHold ? '▶️' : '⏸️' }}
            </button>
            <button
              v-if="isActive"
              class="toolbar-btn toolbar-btn-danger"
              @click="handleHangup"
              title="Hangup"
            >
              ❌
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Component Types Info -->
    <div class="component-types-info">
      <h4>Live Toolbar Component Types</h4>
      <div class="component-grid">
        <div class="component-card">
          <div class="component-icon">🔘</div>
          <h5>Status Indicators</h5>
          <p>
            Real-time indicators for connection state and registration status from
            <code>useSipClient()</code>
          </p>
          <ul class="component-examples">
            <li>isConnected - Green/red status dots</li>
            <li>isRegistered - Registration badges</li>
            <li>Updates automatically on state changes</li>
          </ul>
        </div>

        <div class="component-card">
          <div class="component-icon">🎛️</div>
          <h5>Action Buttons</h5>
          <p>Interactive controls with real button state and hover effects</p>
          <ul class="component-examples">
            <li>Primary/secondary styling</li>
            <li>Icon-only compact variants</li>
            <li>Active state for toggles (mute/hold)</li>
          </ul>
        </div>

        <div class="component-card">
          <div class="component-icon">📞</div>
          <h5>Call Controls</h5>
          <p>Live VueSIP controls from <code>useCallSession()</code></p>
          <ul class="component-examples">
            <li>answer() - Answer incoming calls</li>
            <li>hangup() - End active calls</li>
            <li>mute/unmute - Toggle audio</li>
            <li>hold/unhold - Pause/resume calls</li>
          </ul>
        </div>

        <div class="component-card">
          <div class="component-icon">ℹ️</div>
          <h5>Information Display</h5>
          <p>Real-time call data with live duration counter</p>
          <ul class="component-examples">
            <li>remoteUri / remoteDisplayName</li>
            <li>Live call duration (updates every second)</li>
            <li>Call state (Ringing, Active, Hold, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient } from '../../src'
import { useCallSession } from '../../src'

interface LayoutOption {
  id: string
  icon: string
  name: string
  description: string
  useCases: string[]
}

const layouts: LayoutOption[] = [
  {
    id: 'top',
    icon: '⬛',
    name: 'Top Horizontal Toolbar',
    description:
      'Full-width toolbar positioned at the top of the application. Best for global actions and status.',
    useCases: [
      'Global navigation and status display',
      'Application-wide call controls',
      'Persistent connection indicators',
      'Primary action buttons accessible from anywhere',
    ],
  },
  {
    id: 'left',
    icon: '◧',
    name: 'Left Vertical Sidebar',
    description:
      'Vertical sidebar on the left side. Ideal for navigation and collapsible menu items.',
    useCases: [
      'Navigation between different sections',
      'Contextual call information',
      'Expandable/collapsible sections',
      'Traditional desktop application layout',
    ],
  },
  {
    id: 'right',
    icon: '◨',
    name: 'Right Vertical Sidebar',
    description:
      'Vertical sidebar on the right side. Common for settings, notifications, and details panels.',
    useCases: [
      'Call details and statistics',
      'Settings and preferences',
      'Notifications and alerts',
      'Supplementary information display',
    ],
  },
  {
    id: 'bottom',
    icon: '⬜',
    name: 'Bottom Toolbar',
    description: 'Fixed toolbar at the bottom. Popular in mobile interfaces and media players.',
    useCases: [
      'Mobile-first applications',
      'Media player controls',
      'Always-accessible quick actions',
      'Thumb-friendly mobile layouts',
    ],
  },
]

const currentLayout = ref<string>('top')

const activeLayout = computed(() => {
  return layouts.find((l) => l.id === currentLayout.value) || layouts[0]
})

// VueSIP Integration
const { isConnected, isRegistered } = useSipClient()

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
} = useCallSession()

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
</script>

<style scoped>
.toolbar-layouts-demo {
  padding: 1.5rem;
}

.demo-header {
  margin-bottom: 2rem;
  text-align: center;
}

.demo-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  color: var(--text-primary);
}

.demo-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 1rem;
}

/* Layout Selector */
.layout-selector {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.layout-btn {
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  font-size: 0.9375rem;
}

.layout-btn:hover {
  border-color: var(--primary);
  background: var(--bg-secondary);
}

.layout-btn.active {
  border-color: var(--primary);
  background: var(--primary);
  color: white;
}

/* Layout Container */
.layout-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.layout-description {
  margin-bottom: 2rem;
}

.layout-description h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.layout-description p {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
}

.use-cases {
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: 6px;
  border-left: 3px solid var(--primary);
  margin-bottom: 1rem;
}

.use-cases strong {
  color: var(--text-primary);
  display: block;
  margin-bottom: 0.5rem;
}

.use-cases ul {
  margin: 0;
  padding-left: 1.5rem;
}

.use-cases li {
  margin-bottom: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

/* Live Indicator */
.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

/* Demo Layout Base */
.demo-layout {
  background: #f8f9fa;
  border: 2px dashed #cbd5e0;
  border-radius: 8px;
  min-height: 400px;
  position: relative;
  overflow: hidden;
}

:global(.dark-mode) .demo-layout {
  background: #1a202c;
  border-color: #4a5568;
}

.demo-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 2rem;
  gap: 1rem;
}

.demo-placeholder {
  color: #a0aec0;
  font-size: 1.125rem;
  font-style: italic;
  text-align: center;
  margin: 0;
}

.demo-hint {
  color: #718096;
  font-size: 0.875rem;
  text-align: center;
  margin: 0;
}

/* Toolbar Base Styles */
.demo-toolbar {
  background: linear-gradient(120deg, #667eea 0%, #764ba2 50%, #4f46e5 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Top Horizontal Toolbar */
.demo-layout-top {
  display: flex;
  flex-direction: column;
}

.toolbar-top {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem 1.5rem;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toolbar-section-center {
  flex: 1;
  justify-content: center;
}

/* Status Components */
.status-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  transition: background 0.3s;
}

.status-dot.connected {
  background: #10b981;
}

.status-label {
  font-weight: 500;
}

/* Call Info Components */
.call-info-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.call-state-badge {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.3);
  text-transform: capitalize;
}

.caller-id {
  font-size: 0.9375rem;
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
  font-size: 0.875rem;
  opacity: 0.8;
  font-style: italic;
}

/* Action Buttons */
.toolbar-btn {
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
}

.toolbar-btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.toolbar-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.toolbar-btn-secondary.active {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.5);
}

.toolbar-btn-success {
  background: #10b981;
  color: white;
}

.toolbar-btn-success:hover {
  background: #059669;
}

.toolbar-btn-danger {
  background: #ef4444;
  color: white;
}

.toolbar-btn-danger:hover {
  background: #dc2626;
}

/* Vertical Sidebar Layouts */
.demo-layout-left,
.demo-layout-right {
  display: flex;
  flex-direction: row;
}

.toolbar-left,
.toolbar-right {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 1rem;
}

.toolbar-section-vertical {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.9;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.status-group-vertical {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.status-label-small {
  font-weight: 500;
  font-size: 0.8125rem;
}

.no-call-text-small {
  font-size: 0.8125rem;
  opacity: 0.7;
  font-style: italic;
  margin: 0;
}

/* Vertical Call Info */
.call-info-vertical {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  word-break: break-word;
}

.call-state-badge-small {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 0.125rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.3);
  display: inline-block;
  text-transform: capitalize;
}

/* Vertical Buttons */
.toolbar-btn-vertical {
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.toolbar-btn-icon {
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn-icon:hover {
  background: rgba(255, 255, 255, 0.3);
}

.toolbar-btn-icon.active {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.5);
}

/* Bottom Toolbar */
.demo-layout-bottom {
  display: flex;
  flex-direction: column;
}

.toolbar-bottom {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.875rem 1.5rem;
}

.call-info-compact {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.caller-id-compact {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Component Types Info */
.component-types-info {
  margin-top: 3rem;
}

.component-types-info h4 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  color: var(--text-primary);
  text-align: center;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.component-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.component-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--primary);
}

.component-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.component-card h5 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  color: var(--text-primary);
}

.component-card p {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.component-card code {
  background: var(--bg-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.875rem;
  color: var(--primary);
}

.component-examples {
  margin: 0;
  padding-left: 1.25rem;
  list-style-type: disc;
}

.component-examples li {
  margin-bottom: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .layout-selector {
    flex-direction: column;
  }

  .layout-btn {
    width: 100%;
  }

  .toolbar-top,
  .toolbar-bottom {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .toolbar-section-center {
    flex: 1 1 100%;
  }

  .demo-layout-left,
  .demo-layout-right {
    flex-direction: column;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
  }
}
</style>
