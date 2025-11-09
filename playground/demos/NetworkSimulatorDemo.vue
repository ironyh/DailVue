<template>
  <div class="network-simulator-demo">
    <h2>📡 Network Condition Simulator</h2>
    <p class="description">Simulate various network conditions to test call quality and resilience.</p>

    <!-- Connection Status -->
    <div class="status-section">
      <div :class="['status-badge', connectionState]">
        {{ connectionState.toUpperCase() }}
      </div>
      <div class="network-status">
        <span class="indicator" :style="{ backgroundColor: networkQualityColor }"></span>
        <span>{{ activeProfile }}</span>
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

    <!-- Network Profiles -->
    <div class="profiles-section">
      <h3>Network Profiles</h3>
      <div class="profiles-grid">
        <div
          v-for="profile in networkProfiles"
          :key="profile.name"
          :class="['profile-card', { active: activeProfile === profile.name }]"
          @click="applyProfile(profile)"
        >
          <div class="profile-icon">{{ profile.icon }}</div>
          <div class="profile-name">{{ profile.name }}</div>
          <div class="profile-stats">
            <div class="stat">
              <span class="stat-label">Latency:</span>
              <span class="stat-value">{{ profile.latency }}ms</span>
            </div>
            <div class="stat">
              <span class="stat-label">Packet Loss:</span>
              <span class="stat-value">{{ profile.packetLoss }}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">Jitter:</span>
              <span class="stat-value">{{ profile.jitter }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Network Settings -->
    <div class="custom-settings-section">
      <h3>Custom Network Settings</h3>
      <div class="settings-grid">
        <div class="setting-group">
          <label>Latency (ms)</label>
          <input type="range" v-model.number="customLatency" min="0" max="1000" step="10" />
          <span class="value">{{ customLatency }}ms</span>
          <div class="indicator-bar">
            <div
              class="indicator-fill latency"
              :style="{ width: (customLatency / 1000) * 100 + '%' }"
            ></div>
          </div>
        </div>

        <div class="setting-group">
          <label>Packet Loss (%)</label>
          <input type="range" v-model.number="customPacketLoss" min="0" max="50" step="1" />
          <span class="value">{{ customPacketLoss }}%</span>
          <div class="indicator-bar">
            <div
              class="indicator-fill packet-loss"
              :style="{ width: (customPacketLoss / 50) * 100 + '%' }"
            ></div>
          </div>
        </div>

        <div class="setting-group">
          <label>Jitter (ms)</label>
          <input type="range" v-model.number="customJitter" min="0" max="200" step="5" />
          <span class="value">{{ customJitter }}ms</span>
          <div class="indicator-bar">
            <div
              class="indicator-fill jitter"
              :style="{ width: (customJitter / 200) * 100 + '%' }"
            ></div>
          </div>
        </div>

        <div class="setting-group">
          <label>Bandwidth (kbps)</label>
          <input type="range" v-model.number="customBandwidth" min="16" max="10000" step="16" />
          <span class="value">{{ customBandwidth }}kbps</span>
          <div class="indicator-bar">
            <div
              class="indicator-fill bandwidth"
              :style="{ width: (customBandwidth / 10000) * 100 + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <button @click="applyCustomSettings" class="apply-btn">
        Apply Custom Settings
      </button>
    </div>

    <!-- Call Section -->
    <div v-if="isConnected" class="call-section">
      <h3>Test Call</h3>
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
        📞 Make Test Call
      </button>
    </div>

    <!-- Active Call with Network Stats -->
    <div v-if="hasActiveCall" class="active-call-section">
      <h3>Active Call</h3>

      <!-- Real-time Network Metrics -->
      <div class="metrics-section">
        <h4>Real-time Network Metrics</h4>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">⏱️</div>
            <div class="metric-value">{{ currentMetrics.latency }}ms</div>
            <div class="metric-label">Current Latency</div>
            <div :class="['quality-indicator', getQualityClass(currentMetrics.latency, 'latency')]">
              {{ getQualityLabel(currentMetrics.latency, 'latency') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">📉</div>
            <div class="metric-value">{{ currentMetrics.packetLoss.toFixed(1) }}%</div>
            <div class="metric-label">Packet Loss</div>
            <div
              :class="['quality-indicator', getQualityClass(currentMetrics.packetLoss, 'packetLoss')]"
            >
              {{ getQualityLabel(currentMetrics.packetLoss, 'packetLoss') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">📊</div>
            <div class="metric-value">{{ currentMetrics.jitter }}ms</div>
            <div class="metric-label">Jitter</div>
            <div :class="['quality-indicator', getQualityClass(currentMetrics.jitter, 'jitter')]">
              {{ getQualityLabel(currentMetrics.jitter, 'jitter') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">🎯</div>
            <div class="metric-value">{{ currentMetrics.quality }}</div>
            <div class="metric-label">Overall Quality</div>
            <div :class="['quality-score', currentMetrics.quality.toLowerCase()]">
              {{ currentMetrics.quality }}
            </div>
          </div>
        </div>
      </div>

      <!-- Historical Chart -->
      <div class="chart-section">
        <h4>Metrics History</h4>
        <div class="chart">
          <div
            v-for="(point, index) in metricsHistory"
            :key="index"
            class="chart-bar"
            :style="{
              height: (point.latency / 500) * 100 + '%',
              backgroundColor: getLatencyColor(point.latency),
            }"
          ></div>
        </div>
        <div class="chart-legend">
          <span>Latency over time (last {{ metricsHistory.length }} measurements)</span>
        </div>
      </div>

      <!-- Network Events Log -->
      <div class="events-section">
        <h4>Network Events</h4>
        <div class="events-list">
          <div
            v-for="(event, index) in networkEvents"
            :key="index"
            :class="['event-item', event.severity]"
          >
            <span class="event-time">{{ event.time }}</span>
            <span class="event-message">{{ event.message }}</span>
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

    <!-- Recommendations -->
    <div v-if="recommendations.length > 0" class="recommendations-section">
      <h3>💡 Recommendations</h3>
      <ul>
        <li v-for="(rec, index) in recommendations" :key="index">
          {{ rec }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
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

// Network Profiles
interface NetworkProfile {
  name: string
  icon: string
  latency: number
  packetLoss: number
  jitter: number
  bandwidth: number
}

const networkProfiles: NetworkProfile[] = [
  {
    name: 'Excellent',
    icon: '🟢',
    latency: 20,
    packetLoss: 0,
    jitter: 5,
    bandwidth: 10000,
  },
  {
    name: 'Good',
    icon: '🟡',
    latency: 80,
    packetLoss: 1,
    jitter: 15,
    bandwidth: 1000,
  },
  {
    name: '4G Mobile',
    icon: '📱',
    latency: 100,
    packetLoss: 2,
    jitter: 25,
    bandwidth: 500,
  },
  {
    name: '3G Mobile',
    icon: '📶',
    latency: 200,
    packetLoss: 5,
    jitter: 50,
    bandwidth: 128,
  },
  {
    name: 'Poor WiFi',
    icon: '📡',
    latency: 300,
    packetLoss: 10,
    jitter: 100,
    bandwidth: 256,
  },
  {
    name: 'Congested',
    icon: '🔴',
    latency: 500,
    packetLoss: 20,
    jitter: 150,
    bandwidth: 64,
  },
]

const activeProfile = ref('Excellent')
const customLatency = ref(20)
const customPacketLoss = ref(0)
const customJitter = ref(5)
const customBandwidth = ref(10000)

// Current Metrics
interface Metrics {
  latency: number
  packetLoss: number
  jitter: number
  quality: string
}

const currentMetrics = ref<Metrics>({
  latency: 20,
  packetLoss: 0,
  jitter: 5,
  quality: 'Excellent',
})

const metricsHistory = ref<Array<{ latency: number; timestamp: number }>>([])
const networkEvents = ref<Array<{ time: string; message: string; severity: string }>>([])

// Timers
const metricsTimer = ref<number | null>(null)

// Computed
const networkQualityColor = computed(() => {
  const quality = currentMetrics.value.quality.toLowerCase()
  if (quality === 'excellent') return '#10b981'
  if (quality === 'good') return '#84cc16'
  if (quality === 'fair') return '#f59e0b'
  if (quality === 'poor') return '#ef4444'
  return '#6b7280'
})

const recommendations = computed(() => {
  const recs: string[] = []

  if (currentMetrics.value.latency > 200) {
    recs.push('High latency detected. Consider using a wired connection or moving closer to your router.')
  }

  if (currentMetrics.value.packetLoss > 5) {
    recs.push('Significant packet loss. Check your network connection and reduce other network usage.')
  }

  if (currentMetrics.value.jitter > 50) {
    recs.push('High jitter detected. This may cause audio quality issues. Close bandwidth-intensive applications.')
  }

  if (customBandwidth.value < 100) {
    recs.push('Low bandwidth. Consider disabling video or reducing quality settings.')
  }

  return recs
})

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

// Apply Network Profile
const applyProfile = (profile: NetworkProfile) => {
  activeProfile.value = profile.name
  customLatency.value = profile.latency
  customPacketLoss.value = profile.packetLoss
  customJitter.value = profile.jitter
  customBandwidth.value = profile.bandwidth

  updateMetrics()

  logEvent(`Network profile changed to ${profile.name}`, 'info')
}

// Apply Custom Settings
const applyCustomSettings = () => {
  activeProfile.value = 'Custom'
  updateMetrics()
  logEvent('Custom network settings applied', 'info')
}

// Update Metrics
const updateMetrics = () => {
  // Add some variance to simulate real network conditions
  const latencyVariance = Math.random() * 20 - 10
  const packetLossVariance = Math.random() * 2 - 1
  const jitterVariance = Math.random() * 10 - 5

  const latency = Math.max(0, customLatency.value + latencyVariance)
  const packetLoss = Math.max(0, Math.min(100, customPacketLoss.value + packetLossVariance))
  const jitter = Math.max(0, customJitter.value + jitterVariance)

  currentMetrics.value = {
    latency: Math.round(latency),
    packetLoss: Math.round(packetLoss * 10) / 10,
    jitter: Math.round(jitter),
    quality: calculateQuality(latency, packetLoss, jitter),
  }

  // Add to history
  metricsHistory.value.push({
    latency: currentMetrics.value.latency,
    timestamp: Date.now(),
  })

  // Keep only last 50 measurements
  if (metricsHistory.value.length > 50) {
    metricsHistory.value.shift()
  }

  // Log quality changes
  if (currentMetrics.value.quality === 'Poor') {
    logEvent('Poor network quality detected', 'warning')
  }
}

// Calculate Quality
const calculateQuality = (latency: number, packetLoss: number, jitter: number): string => {
  let score = 100

  // Penalize for latency
  if (latency > 400) score -= 50
  else if (latency > 200) score -= 30
  else if (latency > 100) score -= 15

  // Penalize for packet loss
  if (packetLoss > 10) score -= 40
  else if (packetLoss > 5) score -= 25
  else if (packetLoss > 2) score -= 10

  // Penalize for jitter
  if (jitter > 100) score -= 30
  else if (jitter > 50) score -= 15
  else if (jitter > 25) score -= 5

  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor'
}

// Quality Helpers
const getQualityClass = (value: number, type: string): string => {
  if (type === 'latency') {
    if (value < 100) return 'good'
    if (value < 200) return 'fair'
    return 'poor'
  } else if (type === 'packetLoss') {
    if (value < 2) return 'good'
    if (value < 5) return 'fair'
    return 'poor'
  } else if (type === 'jitter') {
    if (value < 25) return 'good'
    if (value < 50) return 'fair'
    return 'poor'
  }
  return 'good'
}

const getQualityLabel = (value: number, type: string): string => {
  const qualityClass = getQualityClass(value, type)
  if (qualityClass === 'good') return 'Good'
  if (qualityClass === 'fair') return 'Fair'
  return 'Poor'
}

const getLatencyColor = (latency: number): string => {
  if (latency < 100) return '#10b981'
  if (latency < 200) return '#84cc16'
  if (latency < 300) return '#f59e0b'
  return '#ef4444'
}

// Log Event
const logEvent = (message: string, severity: 'info' | 'warning' | 'error') => {
  const time = new Date().toLocaleTimeString()
  networkEvents.value.unshift({ time, message, severity })

  // Keep only last 10 events
  if (networkEvents.value.length > 10) {
    networkEvents.value.pop()
  }
}

// Start Metrics Monitoring
const startMetricsMonitoring = () => {
  metricsTimer.value = window.setInterval(() => {
    if (hasActiveCall.value) {
      updateMetrics()
    }
  }, 1000)
}

const stopMetricsMonitoring = () => {
  if (metricsTimer.value) {
    clearInterval(metricsTimer.value)
    metricsTimer.value = null
  }
}

// Watch call state
watch(callState, (newState, oldState) => {
  if (newState === 'active' && oldState !== 'active') {
    // Call became active
    startMetricsMonitoring()
    logEvent('Call connected', 'info')
  } else if (newState === 'terminated' || newState === 'disconnected') {
    // Call ended
    stopMetricsMonitoring()
    logEvent('Call ended', 'info')
  }
})

// Cleanup
onUnmounted(() => {
  stopMetricsMonitoring()
})
</script>

<style scoped>
.network-simulator-demo {
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

.network-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.config-section,
.profiles-section,
.custom-settings-section,
.call-section,
.active-call-section,
.recommendations-section {
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

.profiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.profile-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.profile-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.profile-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.profile-name {
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.profile-stats {
  font-size: 0.75rem;
  color: #6b7280;
}

.stat {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-weight: 500;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.setting-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.setting-group input[type="range"] {
  width: 100%;
  margin-bottom: 0.25rem;
}

.setting-group .value {
  display: inline-block;
  font-weight: 600;
  color: #3b82f6;
}

.indicator-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.indicator-fill {
  height: 100%;
  transition: width 0.3s;
}

.indicator-fill.latency {
  background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444);
}

.indicator-fill.packet-loss {
  background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444);
}

.indicator-fill.jitter {
  background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444);
}

.indicator-fill.bandwidth {
  background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981);
}

.apply-btn {
  width: 100%;
}

.metrics-section {
  margin-bottom: 1.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.metric-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.metric-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.quality-indicator {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.quality-indicator.good {
  background: #d1fae5;
  color: #065f46;
}

.quality-indicator.fair {
  background: #fef3c7;
  color: #92400e;
}

.quality-indicator.poor {
  background: #fee2e2;
  color: #991b1b;
}

.quality-score {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.quality-score.excellent {
  background: #d1fae5;
  color: #065f46;
}

.quality-score.good {
  background: #d9f99d;
  color: #365314;
}

.quality-score.fair {
  background: #fef3c7;
  color: #92400e;
}

.quality-score.poor {
  background: #fee2e2;
  color: #991b1b;
}

.chart-section {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100px;
  background: #f9fafb;
  border-radius: 4px;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}

.chart-bar {
  flex: 1;
  min-height: 2px;
  border-radius: 2px;
  transition: height 0.3s, background-color 0.3s;
}

.chart-legend {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

.events-section {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.events-list {
  max-height: 200px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  border-left: 3px solid transparent;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.event-item.info {
  border-color: #3b82f6;
  background: #eff6ff;
}

.event-item.warning {
  border-color: #f59e0b;
  background: #fef3c7;
}

.event-item.error {
  border-color: #ef4444;
  background: #fee2e2;
}

.event-time {
  font-weight: 600;
  white-space: nowrap;
}

.button-group {
  display: flex;
  gap: 0.75rem;
}

.recommendations-section ul {
  margin: 0;
  padding-left: 1.5rem;
}

.recommendations-section li {
  margin-bottom: 0.5rem;
  color: #4b5563;
}
</style>
