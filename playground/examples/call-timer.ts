import type { ExampleDefinition } from './types'
import CallTimerDemo from '../demos/CallTimerDemo.vue'

export const callTimerExample: ExampleDefinition = {
  id: 'call-timer',
  icon: '⏱️',
  title: 'Call Timer',
  description: 'Display call duration in various formats',
  tags: ['UI', 'Formatting', 'Simple'],
  component: CallTimerDemo,
  setupGuide: '<p>Learn how to display call duration in different formats. Shows MM:SS, HH:MM:SS, human-readable, and compact formats.</p>',
  codeSnippets: [
    {
      title: 'Duration Formatting',
      description: 'Format call duration in different styles',
      code: `import { useCallSession } from 'vuesip'

const { duration } = useCallSession(sipClient)

// Format as MM:SS
const formatMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return \`\${mins}:\${secs.toString().padStart(2, '0')}\`
}

// Format as HH:MM:SS
const formatHHMMSS = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return \`\${hours}:\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`
}

// Human readable
const formatHuman = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []
  if (hours > 0) parts.push(\`\${hours}h\`)
  if (mins > 0) parts.push(\`\${mins}m\`)
  if (secs > 0) parts.push(\`\${secs}s\`)
  return parts.join(' ')
}`,
    },
  ],
}
