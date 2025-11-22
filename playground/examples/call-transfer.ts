import type { ExampleDefinition } from './types'
import CallTransferDemo from '../demos/CallTransferDemo.vue'

export const callTransferExample: ExampleDefinition = {
  id: 'call-transfer',
  icon: '🔀',
  title: 'Call Transfer',
  description: 'Transfer calls to other numbers',
  tags: ['Advanced', 'Transfer', 'Call Control'],
  component: CallTransferDemo,
  setupGuide: '<p>Transfer active calls using blind transfer (immediate) or attended transfer (with consultation). Requires an active call to use.</p>',
  codeSnippets: [
    {
      title: 'Blind Transfer',
      description: 'Immediately transfer a call',
      code: `import { useCallControls } from 'vuesip'

const {
  blindTransfer,
  isTransferring
} = useCallControls(sipClient)

// Transfer call to another number
await blindTransfer(
  'call-id-123',
  'sip:transfer@example.com'
)`,
    },
    {
      title: 'Attended Transfer',
      description: 'Consult before transferring',
      code: `const {
  initiateAttendedTransfer,
  completeAttendedTransfer,
  consultationCall
} = useCallControls(sipClient)

// Start consultation
const consultId = await initiateAttendedTransfer(
  'call-id-123',
  'sip:consult@example.com'
)

// Talk to consultation target...

// Complete the transfer
await completeAttendedTransfer()`,
    },
  ],
}
