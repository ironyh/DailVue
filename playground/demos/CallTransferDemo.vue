<template>
  <div class="call-transfer-demo">
    <div class="info-section">
      <p>
        Call Transfer allows you to redirect an active call to another destination. VueSip supports
        both blind transfer (immediate) and attended transfer (with consultation).
      </p>
      <div class="transfer-types">
        <div class="type-card">
          <h4>🔀 Blind Transfer</h4>
          <p>
            Instantly transfer the call to another number without talking to them first. The call
            is immediately connected to the transfer target.
          </p>
        </div>
        <div class="type-card">
          <h4>👥 Attended Transfer</h4>
          <p>
            Consult with the transfer target before completing the transfer. You can talk to both
            parties before connecting them.
          </p>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div v-if="!isConnected" class="status-message info">
      Connect to a SIP server to use transfer features (use the Basic Call demo to connect)
    </div>

    <div v-else-if="callState !== 'active'" class="status-message warning">
      You need an active call to perform transfers
    </div>

    <!-- Transfer Interface -->
    <div v-else class="transfer-interface">
      <!-- Current Call Info -->
      <div class="current-call-info">
        <h3>Current Call</h3>
        <div class="call-details">
          <div class="detail-row">
            <span class="label">Connected to:</span>
            <span class="value">{{ remoteUri || 'Unknown' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">{{ isOnHold ? 'On Hold' : 'Active' }}</span>
          </div>
        </div>
      </div>

      <!-- Transfer Type Selection -->
      <div v-if="!isTransferring && !activeTransfer" class="transfer-type-selection">
        <h3>Choose Transfer Type</h3>
        <div class="transfer-buttons">
          <button class="transfer-type-btn blind" @click="startBlindTransfer">
            <span class="icon">🔀</span>
            <span class="title">Blind Transfer</span>
            <span class="desc">Direct transfer</span>
          </button>
          <button class="transfer-type-btn attended" @click="startAttendedTransfer">
            <span class="icon">👥</span>
            <span class="title">Attended Transfer</span>
            <span class="desc">With consultation</span>
          </button>
        </div>
      </div>

      <!-- Blind Transfer Form -->
      <div v-if="showBlindTransferForm" class="transfer-form">
        <h3>Blind Transfer</h3>
        <p class="form-description">
          Enter the SIP URI or number to transfer this call to. The call will be immediately
          redirected.
        </p>
        <div class="form-group">
          <label for="blind-target">Transfer To:</label>
          <input
            id="blind-target"
            v-model="blindTransferTarget"
            type="text"
            placeholder="sip:target@example.com or 1234"
            @keyup.enter="executeBlindTransfer"
          />
        </div>
        <div class="form-actions">
          <button
            class="btn btn-primary"
            :disabled="!blindTransferTarget.trim() || executing"
            @click="executeBlindTransfer"
          >
            {{ executing ? 'Transferring...' : '🔀 Transfer Call' }}
          </button>
          <button class="btn btn-secondary" @click="cancelTransferForm">
            Cancel
          </button>
        </div>
      </div>

      <!-- Attended Transfer Form -->
      <div v-if="showAttendedTransferForm" class="transfer-form">
        <h3>Attended Transfer</h3>

        <!-- Step 1: Initiate Consultation -->
        <div v-if="!consultationCall" class="consultation-step">
          <p class="form-description">
            First, create a consultation call to the transfer target. You can talk to them before
            completing the transfer.
          </p>
          <div class="form-group">
            <label for="attended-target">Consultation Target:</label>
            <input
              id="attended-target"
              v-model="attendedTransferTarget"
              type="text"
              placeholder="sip:target@example.com or 1234"
              @keyup.enter="initiateConsultation"
            />
          </div>
          <div class="form-actions">
            <button
              class="btn btn-primary"
              :disabled="!attendedTransferTarget.trim() || executing"
              @click="initiateConsultation"
            >
              {{ executing ? 'Calling...' : '📞 Start Consultation' }}
            </button>
            <button class="btn btn-secondary" @click="cancelTransferForm">
              Cancel
            </button>
          </div>
        </div>

        <!-- Step 2: Complete Transfer -->
        <div v-else class="consultation-active">
          <div class="consultation-status">
            <div class="status-badge">Consultation in Progress</div>
            <p>
              You're now consulting with the transfer target. You can complete the transfer to
              connect both parties, or cancel to return to the original call.
            </p>
          </div>

          <div class="consultation-info">
            <div class="info-item">
              <strong>Original Call:</strong> {{ remoteUri }} (On Hold)
            </div>
            <div class="info-item">
              <strong>Consultation:</strong> {{ attendedTransferTarget }}
            </div>
          </div>

          <div class="form-actions">
            <button
              class="btn btn-success"
              :disabled="executing"
              @click="completeTransfer"
            >
              {{ executing ? 'Completing...' : '✓ Complete Transfer' }}
            </button>
            <button
              class="btn btn-danger"
              :disabled="executing"
              @click="cancelAttendedTransfer"
            >
              ✕ Cancel Transfer
            </button>
          </div>
        </div>
      </div>

      <!-- Transfer Status -->
      <div v-if="activeTransfer" class="transfer-status">
        <div class="status-card" :class="transferState">
          <div class="status-header">
            <span class="status-icon">
              {{ getStatusIcon(transferState) }}
            </span>
            <span class="status-text">{{ getStatusText(transferState) }}</span>
          </div>
          <div v-if="activeTransfer.error" class="status-error">
            {{ activeTransfer.error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Code Example -->
    <div class="code-example">
      <h4>Code Example</h4>
      <pre><code>import { useSipClient, useCallSession, useCallControls } from 'vuesip'

const sipClient = useSipClient()
const { callState, session } = useCallSession(sipClient)
const {
  blindTransfer,
  initiateAttendedTransfer,
  completeAttendedTransfer,
  cancelTransfer,
  isTransferring,
  consultationCall
} = useCallControls(sipClient)

// Blind Transfer
await blindTransfer('call-id-123', 'sip:target@example.com')

// Attended Transfer (2 steps)
// 1. Initiate consultation
const consultCallId = await initiateAttendedTransfer(
  'call-id-123',
  'sip:consult@example.com'
)

// ... talk to consultation target ...

// 2. Complete the transfer
await completeAttendedTransfer()

// Or cancel the transfer
await cancelTransfer()</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient, useCallSession, useCallControls } from '../../src'

// Get SIP client and call session
const { isConnected, getClient } = useSipClient()
const sipClientRef = computed(() => getClient())
const { state: callState, remoteUri, isOnHold, session } = useCallSession(sipClientRef)

// Call Controls
const {
  blindTransfer,
  initiateAttendedTransfer,
  completeAttendedTransfer,
  cancelTransfer,
  isTransferring,
  activeTransfer,
  transferState,
  consultationCall,
} = useCallControls(sipClientRef)

// State
const showBlindTransferForm = ref(false)
const showAttendedTransferForm = ref(false)
const blindTransferTarget = ref('')
const attendedTransferTarget = ref('')
const executing = ref(false)

// Methods
const startBlindTransfer = () => {
  showBlindTransferForm.value = true
  showAttendedTransferForm.value = false
  blindTransferTarget.value = ''
}

const startAttendedTransfer = () => {
  showAttendedTransferForm.value = true
  showBlindTransferForm.value = false
  attendedTransferTarget.value = ''
}

const executeBlindTransfer = async () => {
  if (!blindTransferTarget.value.trim() || !session.value) return

  executing.value = true
  try {
    await blindTransfer(session.value.id, blindTransferTarget.value)
    showBlindTransferForm.value = false
    blindTransferTarget.value = ''
  } catch (error) {
    console.error('Blind transfer failed:', error)
    alert(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    executing.value = false
  }
}

const initiateConsultation = async () => {
  if (!attendedTransferTarget.value.trim() || !session.value) return

  executing.value = true
  try {
    await initiateAttendedTransfer(session.value.id, attendedTransferTarget.value)
  } catch (error) {
    console.error('Consultation failed:', error)
    alert(`Consultation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    executing.value = false
  }
}

const completeTransfer = async () => {
  executing.value = true
  try {
    await completeAttendedTransfer()
    showAttendedTransferForm.value = false
    attendedTransferTarget.value = ''
  } catch (error) {
    console.error('Complete transfer failed:', error)
    alert(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    executing.value = false
  }
}

const cancelAttendedTransfer = async () => {
  executing.value = true
  try {
    await cancelTransfer()
    showAttendedTransferForm.value = false
    attendedTransferTarget.value = ''
  } catch (error) {
    console.error('Cancel transfer failed:', error)
    alert(`Cancel failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    executing.value = false
  }
}

const cancelTransferForm = () => {
  showBlindTransferForm.value = false
  showAttendedTransferForm.value = false
  blindTransferTarget.value = ''
  attendedTransferTarget.value = ''
}

const getStatusIcon = (state: string): string => {
  const icons: Record<string, string> = {
    initiated: '⏳',
    in_progress: '🔄',
    accepted: '✓',
    completed: '✅',
    failed: '❌',
    canceled: '⚠️',
  }
  return icons[state] || '⏳'
}

const getStatusText = (state: string): string => {
  const texts: Record<string, string> = {
    initiated: 'Transfer Initiated',
    in_progress: 'Transfer in Progress',
    accepted: 'Transfer Accepted',
    completed: 'Transfer Completed',
    failed: 'Transfer Failed',
    canceled: 'Transfer Canceled',
  }
  return texts[state] || state
}
</script>

<style scoped>
.call-transfer-demo {
  max-width: 700px;
  margin: 0 auto;
}

.info-section {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-section > p {
  margin: 0 0 1.5rem 0;
  color: #666;
  line-height: 1.6;
}

.transfer-types {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.type-card {
  background: white;
  padding: 1.25rem;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
}

.type-card h4 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1rem;
}

.type-card p {
  margin: 0;
  font-size: 0.875rem;
  color: #666;
  line-height: 1.5;
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

.status-message.warning {
  background: #fef3c7;
  color: #92400e;
}

.transfer-interface {
  padding: 1.5rem;
}

.current-call-info {
  background: #d1fae5;
  padding: 1.25rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.current-call-info h3 {
  margin: 0 0 1rem 0;
  color: #065f46;
  font-size: 1rem;
}

.call-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.detail-row .label {
  color: #047857;
  font-weight: 500;
}

.detail-row .value {
  color: #065f46;
  font-weight: 600;
}

.transfer-type-selection h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
  text-align: center;
}

.transfer-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.transfer-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.transfer-type-btn:hover {
  border-color: #667eea;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.transfer-type-btn .icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.transfer-type-btn .title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
}

.transfer-type-btn .desc {
  font-size: 0.875rem;
  color: #666;
}

.transfer-form {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid #667eea;
}

.transfer-form h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.form-description {
  margin: 0 0 1.5rem 0;
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
  color: #333;
  font-size: 0.875rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-actions {
  display: flex;
  gap: 0.75rem;
}

.form-actions .btn {
  flex: 1;
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

.consultation-step {
  /* Inherits transfer-form styles */
}

.consultation-active {
  /* Inherits transfer-form styles */
}

.consultation-status {
  margin-bottom: 1.5rem;
}

.status-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.consultation-status p {
  margin: 0;
  color: #666;
  font-size: 0.875rem;
  line-height: 1.5;
}

.consultation-info {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.info-item {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item strong {
  color: #333;
}

.transfer-status {
  margin-top: 1.5rem;
}

.status-card {
  padding: 1.25rem;
  border-radius: 8px;
  border: 2px solid;
}

.status-card.completed {
  background: #d1fae5;
  border-color: #10b981;
}

.status-card.failed {
  background: #fee2e2;
  border-color: #ef4444;
}

.status-card.canceled {
  background: #fef3c7;
  border-color: #f59e0b;
}

.status-card.in_progress {
  background: #dbeafe;
  border-color: #3b82f6;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-icon {
  font-size: 1.5rem;
}

.status-text {
  font-weight: 600;
  color: #333;
}

.status-error {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  font-size: 0.875rem;
  color: #991b1b;
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
</style>
