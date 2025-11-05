<template>
  <div class="call-controls">
    <div v-if="incomingCall" class="incoming-call">
      <h3>Incoming Call</h3>
      <p>{{ incomingCall.remoteIdentity }}</p>
      <div class="call-actions">
        <button class="btn btn-success" @click="$emit('answer')">
          <i class="pi pi-phone"></i> Answer
        </button>
        <button class="btn btn-danger" @click="$emit('reject')">
          <i class="pi pi-times"></i> Reject
        </button>
      </div>
    </div>

    <div v-else-if="currentCall" class="active-call">
      <h3>Active Call</h3>
      <p>{{ currentCall.remoteIdentity }}</p>
      <p class="call-duration">{{ formatDuration(currentCall) }}</p>
      <div class="call-actions">
        <button class="btn btn-danger" @click="$emit('end')">
          <i class="pi pi-phone"></i> End Call
        </button>
      </div>
    </div>

    <div v-else-if="isCalling" class="calling">
      <h3>Calling...</h3>
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CallSession } from '../types'

defineProps<{
  currentCall: CallSession | null
  incomingCall: CallSession | null
  isCalling: boolean
}>()

defineEmits<{
  answer: []
  reject: []
  end: []
}>()

const formatDuration = (call: CallSession): string => {
  if (!call.answerTime) return '00:00'

  const now = new Date()
  const diff = Math.floor((now.getTime() - call.answerTime.getTime()) / 1000)
  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
</script>

<style scoped>
.call-controls {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.incoming-call,
.active-call,
.calling {
  text-align: center;
}

h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

p {
  margin: 0.25rem 0;
  color: #666;
}

.call-duration {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 1rem 0;
}

.call-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover {
  background: #059669;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1rem auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
