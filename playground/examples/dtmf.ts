import type { ExampleDefinition } from './types'
import DtmfDemo from '../demos/DtmfDemo.vue'

export const dtmfExample: ExampleDefinition = {
  id: 'dtmf',
  icon: '🔢',
  title: 'DTMF Tones',
  description: 'Send dialpad tones during calls',
  tags: ['Audio', 'DTMF', 'Interactive'],
  component: DtmfDemo,
  setupGuide: '<p>DTMF (Dual-Tone Multi-Frequency) allows you to send dialpad tones during an active call, useful for IVR systems and menu navigation.</p>',
  codeSnippets: [
    {
      title: 'Sending DTMF Tones',
      description: 'Send individual digits or sequences',
      code: `import { useDTMF } from 'vuesip'

const { sendTone, canSendDTMF } = useDTMF(sessionRef)

// Send a single digit
await sendTone('1')

// Send a sequence with delay between tones
for (const digit of '1234') {
  await sendTone(digit)
  await new Promise(resolve => setTimeout(resolve, 100))
}`,
    },
  ],
}
