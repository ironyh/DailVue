<template>
  <div class="dialpad">
    <div class="dialpad-display">
      <input
        v-model="number"
        type="text"
        readonly
        class="dialpad-input"
        placeholder="Enter number"
      />
    </div>
    <div class="dialpad-buttons">
      <button
        v-for="button in buttons"
        :key="button.digit"
        class="dialpad-button"
        @click="handleDigit(button.digit)"
      >
        <span class="digit">{{ button.digit }}</span>
        <span class="letters">{{ button.letters }}</span>
      </button>
      <button
        class="dialpad-button call-button"
        :disabled="!number || isCalling"
        @click="handleCall"
      >
        <i class="pi pi-phone"></i>
      </button>
      <button class="dialpad-button" @click="handleBackspace">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  digit: [digit: string]
  call: [number: string]
}>()

defineProps<{
  isCalling?: boolean
}>()

const number = ref('')

const buttons = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
]

const handleDigit = (digit: string) => {
  number.value += digit
  emit('digit', digit)
}

const handleCall = () => {
  if (number.value) {
    emit('call', number.value)
  }
}

const handleBackspace = () => {
  number.value = number.value.slice(0, -1)
}
</script>

<style scoped>
.dialpad {
  max-width: 320px;
  margin: 0 auto;
  padding: 1rem;
}

.dialpad-display {
  margin-bottom: 1rem;
}

.dialpad-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.5rem;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.dialpad-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.dialpad-button {
  aspect-ratio: 1;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.dialpad-button:hover {
  background: #f5f5f5;
}

.dialpad-button:active {
  transform: scale(0.95);
}

.dialpad-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.digit {
  font-size: 1.5rem;
  font-weight: bold;
}

.letters {
  font-size: 0.75rem;
  color: #666;
}

.call-button {
  background: #10b981;
  color: white;
  border: none;
}

.call-button:hover {
  background: #059669;
}
</style>
