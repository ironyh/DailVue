import type { ExampleDefinition } from './types'
import DoNotDisturbDemo from '../demos/DoNotDisturbDemo.vue'

export const doNotDisturbExample: ExampleDefinition = {
  id: 'do-not-disturb',
  icon: '🔕',
  title: 'Do Not Disturb',
  description: 'Auto-reject incoming calls',
  tags: ['Feature', 'Auto-Action', 'Simple'],
  component: DoNotDisturbDemo,
  setupGuide: '<p>Enable Do Not Disturb mode to automatically reject all incoming calls. Perfect for focus time or meetings.</p>',
  codeSnippets: [
    {
      title: 'DND Implementation',
      description: 'Auto-reject calls when DND is enabled',
      code: `import { ref, watch } from 'vue'
import { useCallSession } from 'vuesip'

const dndEnabled = ref(false)

const { state, reject } = useCallSession(sipClient)

// Auto-reject incoming calls
watch(state, async (newState) => {
  if (newState === 'incoming' && dndEnabled.value) {
    console.log('Auto-rejecting due to DND')
    await reject(486) // 486 Busy Here
  }
})

// Save DND state
watch(dndEnabled, (enabled) => {
  localStorage.setItem('dnd-enabled', String(enabled))
})`,
    },
  ],
}
