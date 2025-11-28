import type { ExampleDefinition } from './types'
import SpeedDialDemo from '../demos/SpeedDialDemo.vue'

export const speedDialExample: ExampleDefinition = {
  id: 'speed-dial',
  icon: '⭐',
  title: 'Speed Dial',
  description: 'Quick-dial saved contacts',
  tags: ['UI', 'Contacts', 'Practical'],
  component: SpeedDialDemo,
  setupGuide: '<p>Save frequently called contacts for one-click dialing. Contacts are stored in localStorage and persist across sessions.</p>',
  codeSnippets: [
    {
      title: 'Speed Dial Management',
      description: 'Save and dial favorite contacts',
      code: `import { ref } from 'vuesip'

interface Contact {
  name: string
  number: string
}

const speedDial = ref<Contact[]>([])

// Load from localStorage
const loadSpeedDial = () => {
  const saved = localStorage.getItem('speed-dial')
  if (saved) speedDial.value = JSON.parse(saved)
}

// Add contact
const addContact = (contact: Contact) => {
  speedDial.value.push(contact)
  localStorage.setItem('speed-dial', JSON.stringify(speedDial.value))
}

// Quick dial
const quickDial = async (contact: Contact) => {
  await makeCall(contact.number)
}`,
    },
  ],
}
