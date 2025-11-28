import type { ExampleDefinition } from './types'
import ConferenceCallDemo from '../demos/ConferenceCallDemo.vue'

export const conferenceCallExample: ExampleDefinition = {
  id: 'conference-call',
  icon: '👥',
  title: 'Conference Call',
  description: 'Manage multiple simultaneous calls',
  tags: ['Advanced', 'Multi-party', 'Complex'],
  component: ConferenceCallDemo,
  setupGuide: '<p>Manage conference calls with multiple participants. Hold, mute, and control individual participants. Merge calls together.</p>',
  codeSnippets: [
    {
      title: 'Managing Multiple Calls',
      description: 'Handle multiple simultaneous calls',
      code: `import { ref } from 'vue'
import { useSipClient } from 'vuesip'

const activeCalls = ref<Call[]>([])

const { makeCall, sessions } = useSipClient()

// Add participant to conference
const addParticipant = async (uri: string) => {
  const callId = await makeCall(uri)

  activeCalls.value.push({
    id: callId,
    uri,
    state: 'connecting'
  })
}

// Hold/Resume specific call
const toggleCallHold = async (callId: string) => {
  const call = sessions.value.get(callId)
  if (!call) return

  if (call.isOnHold) {
    await call.unhold()
  } else {
    await call.hold()
  }
}

// Mute specific call
const muteCall = async (callId: string) => {
  const call = sessions.value.get(callId)
  await call?.mute()
}

// End specific call
const endCall = async (callId: string) => {
  const call = sessions.value.get(callId)
  await call?.hangup()

  const index = activeCalls.value.findIndex(c => c.id === callId)
  if (index !== -1) {
    activeCalls.value.splice(index, 1)
  }
}`,
    },
  ],
}
