import type { ExampleDefinition } from './types'
import CallWaitingDemo from '../demos/CallWaitingDemo.vue'

export const callWaitingExample: ExampleDefinition = {
  id: 'call-waiting',
  icon: '📱',
  title: 'Call Waiting & Switching',
  description: 'Handle multiple calls and switch between them',
  tags: ['Advanced', 'Multi-Call', 'Practical'],
  component: CallWaitingDemo,
  setupGuide: '<p>Handle multiple simultaneous calls with call waiting. Switch between active calls, hold/resume calls, and manage incoming calls while on another call.</p>',
  codeSnippets: [
    {
      title: 'Managing Multiple Calls',
      description: 'Track and switch between calls',
      code: `import { ref } from 'vue'
import { useSipClient } from 'vuesip'

interface Call {
  id: string
  remoteUri: string
  state: 'active' | 'held' | 'incoming'
  isHeld: boolean
}

const calls = ref<Call[]>([])
const activeCallId = ref<string | null>(null)

// Answer incoming call and hold current
const answerAndHoldActive = async (callId: string) => {
  // Hold current active call
  if (activeCallId.value) {
    const current = calls.value.find(c => c.id === activeCallId.value)
    if (current) {
      await holdCall(current.id)
    }
  }

  // Answer new call
  const call = calls.value.find(c => c.id === callId)
  if (call) {
    await answerCall(callId)
    activeCallId.value = callId
  }
}

// Switch between calls
const switchToCall = async (callId: string) => {
  // Hold current
  if (activeCallId.value) {
    await holdCall(activeCallId.value)
  }

  // Resume target
  await resumeCall(callId)
  activeCallId.value = callId
}`,
    },
    {
      title: 'Call Waiting Settings',
      description: 'Configure call waiting behavior',
      code: `const callWaitingEnabled = ref(true)
const autoAnswerWaiting = ref(false)
const maxSimultaneousCalls = ref(3)

// Handle incoming call with call waiting
watch(incomingCall, async (call) => {
  if (!call) return

  if (!callWaitingEnabled.value && calls.value.length > 0) {
    // Reject if call waiting disabled
    await rejectCall(call.id, 486) // Busy Here
    return
  }

  if (calls.value.length >= maxSimultaneousCalls.value) {
    // Reject if max calls reached
    await rejectCall(call.id, 486)
    return
  }

  // Play call waiting tone
  playCallWaitingTone()

  if (autoAnswerWaiting.value) {
    // Auto-answer and hold current
    await answerAndHoldActive(call.id)
  }
})`,
    },
    {
      title: 'Swap and Merge Calls',
      description: 'Advanced multi-call operations',
      code: `// Swap active and held calls
const swapCalls = () => {
  const activeCall = calls.value.find(c => c.id === activeCallId.value)
  const heldCall = calls.value.find(c => c.isHeld)

  if (activeCall && heldCall) {
    // Hold active
    activeCall.isHeld = true

    // Resume held
    heldCall.isHeld = false
    activeCallId.value = heldCall.id
  }
}

// Merge all calls into conference
const mergeAllCalls = async () => {
  // Resume all held calls
  calls.value.forEach(call => {
    call.isHeld = false
  })

  console.log(\`Merged \${calls.value.length} calls into conference\`)
}`,
    },
  ],
}
