import type { ExampleDefinition } from './types'
import PresenceDemo from '../demos/PresenceDemo.vue'

export const presenceExample: ExampleDefinition = {
  id: 'presence',
  icon: '👁️',
  title: 'Presence & Status',
  description: 'Track user presence and availability',
  tags: ['Presence', 'Status', 'SUBSCRIBE'],
  component: PresenceDemo,
  setupGuide: '<p>Demonstrate SIP presence functionality (SUBSCRIBE/NOTIFY). Track your own status and watch other users\' availability.</p>',
  codeSnippets: [
    {
      title: 'Setting Own Presence',
      description: 'Publish your presence status',
      code: `import { usePresence } from 'vuesip'

const { setStatus, currentStatus } = usePresence(sipClientRef)

// Set status to available
await setStatus('available')

// Set status with note
await setStatus('busy', { note: 'In a meeting' })`,
    },
    {
      title: 'Watching User Presence',
      description: 'Subscribe to another user\'s presence',
      code: `const { subscribe, watchedUsers, unsubscribe } = usePresence(sipClientRef)

// Watch a user
await subscribe('sip:colleague@example.com')

// Access their status
const status = watchedUsers.value.get('sip:colleague@example.com')
console.log(status.state) // 'available', 'away', 'busy', 'offline'

// Stop watching
await unsubscribe('sip:colleague@example.com')`,
    },
  ],
}
