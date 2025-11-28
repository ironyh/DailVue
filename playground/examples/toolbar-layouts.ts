import type { ExampleDefinition } from './types'
import ToolbarLayoutsDemo from '../demos/ToolbarLayoutsDemo.vue'

export const toolbarLayoutsExample: ExampleDefinition = {
  id: 'toolbar-layouts',
  icon: '🎛️',
  title: 'Toolbar Layout Patterns',
  description: 'Interactive demos of different toolbar positions and component arrangements',
  tags: ['UI', 'Layout', 'Patterns', 'Advanced'],
  component: ToolbarLayoutsDemo,
  setupGuide: `
<p>This demo showcases different toolbar layout patterns for VueSIP applications, with live integration of <code>useSipClient</code> and <code>useCallSession</code> composables.</p>

<h4>Key Concepts</h4>
<ul>
  <li><strong>Top Horizontal:</strong> Global navigation and status, always visible</li>
  <li><strong>Left Sidebar:</strong> Traditional navigation, good for desktop apps</li>
  <li><strong>Right Sidebar:</strong> Details panels, settings, notifications</li>
  <strong>Bottom Toolbar:</strong> Mobile-first, thumb-friendly controls</li>
</ul>

<h4>Component Types</h4>
<ul>
  <li><strong>Status Indicators:</strong> Real-time connection and registration state</li>
  <li><strong>Action Buttons:</strong> Interactive controls with hover and active states</li>
  <li><strong>Call Controls:</strong> VueSIP-specific controls (answer, hangup, mute, hold)</li>
  <li><strong>Information Display:</strong> Live call data with duration counter</li>
</ul>

<p><strong>Try it:</strong> Connect from Basic Call Demo, make a call, and switch between layouts to see how the toolbar adapts!</p>
  `,
  codeSnippets: [
    {
      title: 'Top Horizontal Toolbar',
      description: 'Full-width toolbar at the top of the application',
      code: `<template>
  <div class="app">
    <!-- Top Toolbar -->
    <header class="toolbar-top">
      <!-- Status -->
      <div class="status-section">
        <div class="status-item">
          <span class="dot" :class="{ connected: isConnected }"></span>
          <span>{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
        </div>
        <div class="status-item">
          <span class="dot" :class="{ connected: isRegistered }"></span>
          <span>{{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
        </div>
      </div>

      <!-- Call Info -->
      <div v-if="session" class="call-info">
        <span class="badge">{{ state }}</span>
        <span>{{ remoteDisplayName || remoteUri }}</span>
        <span class="duration">{{ formattedDuration }}</span>
      </div>

      <!-- Controls -->
      <div class="controls">
        <button v-if="showAnswer" @click="answer()">📞 Answer</button>
        <button v-if="isActive" @click="toggleMute()">
          {{ isMuted ? '🔇' : '🔊' }}
        </button>
        <button v-if="isActive" @click="hangup()">❌ Hangup</button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="content">
      <!-- Your app content here -->
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSipClient, useCallSession } from 'vuesip'

const { isConnected, isRegistered } = useSipClient()
const {
  session,
  state,
  remoteUri,
  remoteDisplayName,
  duration,
  isActive,
  isMuted,
  answer,
  hangup,
  mute,
  unmute
} = useCallSession()

const showAnswer = computed(() =>
  state.value === 'ringing' && direction.value === 'incoming'
)

const formattedDuration = computed(() => {
  const mins = Math.floor(duration.value / 60)
  const secs = duration.value % 60
  return \`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`
})

const toggleMute = () => isMuted.value ? unmute() : mute()
</script>

<style scoped>
.toolbar-top {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(120deg, #667eea, #764ba2);
  color: white;
}

.status-section {
  display: flex;
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
}

.dot.connected {
  background: #10b981;
}

.call-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: center;
}

.controls {
  display: flex;
  gap: 0.5rem;
}
</style>`,
    },
    {
      title: 'Left Vertical Sidebar',
      description: 'Vertical sidebar for navigation and status',
      code: `<template>
  <div class="app-layout">
    <!-- Left Sidebar -->
    <aside class="sidebar-left">
      <!-- Status Section -->
      <div class="sidebar-section">
        <h4>Status</h4>
        <div class="status-item">
          <span class="dot" :class="{ connected: isConnected }"></span>
          <span>{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
        </div>
        <div class="status-item">
          <span class="dot" :class="{ connected: isRegistered }"></span>
          <span>{{ isRegistered ? 'Registered' : 'Not Registered' }}</span>
        </div>
      </div>

      <!-- Call Info Section -->
      <div v-if="session" class="sidebar-section">
        <h4>Active Call</h4>
        <div class="info-row">
          <span class="label">State:</span>
          <span class="value">{{ state }}</span>
        </div>
        <div class="info-row">
          <span class="label">From:</span>
          <span class="value">{{ remoteDisplayName || 'Unknown' }}</span>
        </div>
        <div class="info-row">
          <span class="label">Duration:</span>
          <span class="value">{{ formattedDuration }}</span>
        </div>
      </div>

      <!-- Controls Section -->
      <div v-if="session" class="sidebar-section">
        <h4>Controls</h4>
        <button v-if="showAnswer" @click="answer()" class="btn-block">
          📞 Answer
        </button>
        <button v-if="isActive" @click="toggleMute()" class="btn-block">
          {{ isMuted ? '🔇 Unmute' : '🔊 Mute' }}
        </button>
        <button v-if="isActive" @click="hangup()" class="btn-block btn-danger">
          ❌ Hangup
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="content">
      <!-- Your app content here -->
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSipClient, useCallSession } from 'vuesip'

const { isConnected, isRegistered } = useSipClient()
const {
  session,
  state,
  direction,
  remoteDisplayName,
  duration,
  isActive,
  isMuted,
  answer,
  hangup,
  mute,
  unmute
} = useCallSession()

const showAnswer = computed(() =>
  state.value === 'ringing' && direction.value === 'incoming'
)

const formattedDuration = computed(() => {
  const mins = Math.floor(duration.value / 60)
  const secs = duration.value % 60
  return \`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`
})

const toggleMute = () => isMuted.value ? unmute() : mute()
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}

.sidebar-left {
  width: 240px;
  background: linear-gradient(180deg, #667eea, #764ba2);
  color: white;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar-section h4 {
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.9;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  opacity: 0.8;
}

.value {
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-block {
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  font-weight: 600;
  text-align: left;
}

.btn-danger {
  background: #ef4444;
}

.content {
  flex: 1;
  overflow: auto;
}
</style>`,
    },
    {
      title: 'Right Sidebar for Details',
      description: 'Right-side panel for call details and settings',
      code: `<template>
  <div class="app-layout">
    <!-- Main Content -->
    <main class="content">
      <!-- Your app content here -->
    </main>

    <!-- Right Sidebar -->
    <aside v-if="session" class="sidebar-right">
      <!-- Call Details -->
      <div class="details-section">
        <h4>Call Details</h4>

        <div class="detail-card">
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value status-badge">{{ state }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Caller</span>
            <span class="detail-value">{{ remoteDisplayName || remoteUri }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Duration</span>
            <span class="detail-value mono">{{ formattedDuration }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Direction</span>
            <span class="detail-value">{{ direction }}</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="actions-section">
        <h4>Quick Actions</h4>
        <div class="action-buttons">
          <button
            @click="toggleMute()"
            class="action-btn"
            :class="{ active: isMuted }"
            :title="isMuted ? 'Unmute' : 'Mute'"
          >
            {{ isMuted ? '🔇' : '🔊' }}
          </button>

          <button
            @click="toggleHold()"
            class="action-btn"
            :class="{ active: isOnHold }"
            :title="isOnHold ? 'Resume' : 'Hold'"
          >
            {{ isOnHold ? '▶️' : '⏸️' }}
          </button>

          <button
            @click="hangup()"
            class="action-btn danger"
            title="Hangup"
          >
            ❌
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCallSession } from 'vuesip'

const {
  session,
  state,
  direction,
  remoteUri,
  remoteDisplayName,
  duration,
  isMuted,
  isOnHold,
  hangup,
  mute,
  unmute,
  hold,
  unhold
} = useCallSession()

const formattedDuration = computed(() => {
  const mins = Math.floor(duration.value / 60)
  const secs = duration.value % 60
  return \`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`
})

const toggleMute = () => isMuted.value ? unmute() : mute()
const toggleHold = () => isOnHold.value ? unhold() : hold()
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}

.content {
  flex: 1;
  overflow: auto;
}

.sidebar-right {
  width: 280px;
  background: linear-gradient(180deg, #667eea, #764ba2);
  color: white;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.details-section h4,
.actions-section h4 {
  font-size: 0.75rem;
  text-transform: uppercase;
  margin: 0 0 1rem 0;
  opacity: 0.9;
}

.detail-card {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 0.125rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  border: 1px solid rgba(16, 185, 129, 0.3);
  text-transform: capitalize;
}

.mono {
  font-family: monospace;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 60px;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.action-btn.active {
  background: rgba(255, 255, 255, 0.4);
}

.action-btn.danger {
  background: #ef4444;
}
</style>`,
    },
    {
      title: 'Bottom Toolbar (Mobile-First)',
      description: 'Fixed bottom toolbar for mobile-friendly layouts',
      code: `<template>
  <div class="app-mobile">
    <!-- Main Content -->
    <main class="content">
      <!-- Your app content here -->
    </main>

    <!-- Bottom Toolbar -->
    <footer class="toolbar-bottom">
      <!-- Status -->
      <div class="status-compact">
        <span class="dot" :class="{ connected: isConnected }"></span>
        <span class="dot" :class="{ connected: isRegistered }"></span>
      </div>

      <!-- Call Info -->
      <div v-if="session" class="call-info-compact">
        <span class="badge-compact">{{ state }}</span>
        <span class="caller-compact">{{ remoteDisplayName || 'Unknown' }}</span>
        <span class="duration-compact">{{ formattedDuration }}</span>
      </div>
      <div v-else class="call-info-compact">
        <span class="idle-text">No active call</span>
      </div>

      <!-- Controls -->
      <div class="controls-compact">
        <button v-if="showAnswer" @click="answer()" class="btn-icon">
          📞
        </button>
        <button v-if="isActive" @click="toggleMute()" class="btn-icon">
          {{ isMuted ? '🔇' : '🔊' }}
        </button>
        <button v-if="isActive" @click="hangup()" class="btn-icon btn-danger">
          ❌
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSipClient, useCallSession } from 'vuesip'

const { isConnected, isRegistered } = useSipClient()
const {
  session,
  state,
  direction,
  remoteDisplayName,
  duration,
  isActive,
  isMuted,
  answer,
  hangup,
  mute,
  unmute
} = useCallSession()

const showAnswer = computed(() =>
  state.value === 'ringing' && direction.value === 'incoming'
)

const formattedDuration = computed(() => {
  const mins = Math.floor(duration.value / 60)
  const secs = duration.value % 60
  return \`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`
})

const toggleMute = () => isMuted.value ? unmute() : mute()
</script>

<style scoped>
.app-mobile {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.content {
  flex: 1;
  overflow: auto;
  padding-bottom: 70px; /* Space for fixed toolbar */
}

.toolbar-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(120deg, #667eea, #764ba2);
  color: white;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
}

.status-compact {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
}

.dot.connected {
  background: #10b981;
}

.call-info-compact {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
}

.badge-compact {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  border: 1px solid rgba(16, 185, 129, 0.3);
  text-transform: capitalize;
}

.caller-compact {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.duration-compact {
  font-family: monospace;
  font-size: 0.875rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
}

.idle-text {
  font-size: 0.875rem;
  opacity: 0.8;
  font-style: italic;
}

.controls-compact {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.625rem 0.875rem;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  min-width: 44px; /* Touch-friendly */
  min-height: 44px;
}

.btn-danger {
  background: #ef4444;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .toolbar-bottom {
    padding: 0.75rem 1rem;
    gap: 0.75rem;
  }

  .caller-compact {
    max-width: 100px;
  }
}
</style>`,
    },
  ],
}
