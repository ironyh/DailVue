import type { ExampleDefinition } from './types'
import BasicCallDemo from '../demos/BasicCallDemo.vue'

export const basicCallExample: ExampleDefinition = {
  id: 'basic-call',
  icon: '📞',
  title: 'Basic Audio Call',
  description: 'Simple one-to-one audio calling',
  tags: ['Beginner', 'Audio', 'Core'],
  component: BasicCallDemo,
  setupGuide: '<p>This example demonstrates basic SIP calling functionality. Configure your SIP server details in the connection panel to get started.</p>',
  codeSnippets: [
    {
      title: 'Basic Call Setup',
      description: 'Initialize SIP client and make a call',
      code: `import { useSipClient, useCallSession } from 'vuesip'

const { connect, isConnected } = useSipClient()
const { makeCall, hangup, callState } = useCallSession()

// Connect to SIP server
await connect()

// Make a call
await makeCall('sip:user@example.com')

// End the call
await hangup()`,
    },
    {
      title: 'Handling Incoming Calls',
      description: 'Answer or reject incoming calls',
      code: `const { answer, reject, callState, remoteUri } = useCallSession()

// Watch for incoming calls
watch(callState, (state) => {
  if (state === 'incoming') {
    console.log('Incoming call from:', remoteUri.value)
  }
})

// Answer the call
await answer({ audio: true, video: false })

// Or reject it
await reject(486) // Busy Here`,
    },
  ],
}
