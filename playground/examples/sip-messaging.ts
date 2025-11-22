import type { ExampleDefinition } from './types'
import SipMessagingDemo from '../demos/SipMessagingDemo.vue'

export const sipMessagingExample: ExampleDefinition = {
  id: 'sip-messaging',
  icon: '📨',
  title: 'SIP Instant Messaging',
  description: 'Send and receive instant messages',
  tags: ['Messaging', 'Chat', 'Advanced'],
  component: SipMessagingDemo,
  setupGuide: '<p>Send and receive instant messages over SIP using the MESSAGE method (RFC 3428). Perfect for text-based communication alongside voice calls.</p>',
  codeSnippets: [
    {
      title: 'Sending Messages',
      description: 'Send SIP MESSAGE requests',
      code: `import { useSipClient } from 'vuesip'

const { sipClient } = useSipClient()

const sendMessage = async (
  toUri: string,
  message: string
) => {
  try {
    // Create MESSAGE request
    const request = sipClient.value.createMessage(
      toUri,
      message,
      'text/plain'
    )

    // Send message
    await request.send()

    console.log('Message sent:', message)
    return true
  } catch (error) {
    console.error('Failed to send message:', error)
    return false
  }
}

// Usage
await sendMessage(
  'sip:friend@example.com',
  'Hello! How are you?'
)`,
    },
    {
      title: 'Receiving Messages',
      description: 'Handle incoming MESSAGE requests',
      code: `import { watch } from 'vue'

// Listen for incoming messages
sipClient.value.on('message', (request) => {
  const from = request.from.uri.toString()
  const body = request.body

  console.log('Message from:', from)
  console.log('Content:', body)

  // Send 200 OK response
  request.accept()

  // Process message
  handleIncomingMessage(from, body)
})

const handleIncomingMessage = (
  fromUri: string,
  content: string
) => {
  // Find or create conversation
  let conversation = conversations.value
    .find(c => c.uri === fromUri)

  if (!conversation) {
    conversation = createConversation(fromUri)
  }

  // Add message
  conversation.messages.push({
    id: Date.now().toString(),
    content,
    direction: 'inbound',
    timestamp: new Date()
  })

  // Show notification
  showNotification(conversation.name, content)
}`,
    },
    {
      title: 'Typing Indicators',
      description: 'Send typing notifications',
      code: `const sendTypingIndicator = async (
  toUri: string,
  isTyping: boolean
) => {
  const contentType = 'application/im-iscomposing+xml'

  const body = \`<?xml version="1.0" encoding="UTF-8"?>
<isComposing>
  <state>\${isTyping ? 'active' : 'idle'}</state>
  <contenttype>text/plain</contenttype>
</isComposing>\`

  await sipClient.value.createMessage(
    toUri,
    body,
    contentType
  ).send()
}

// Send when user types
let typingTimer: number | null = null

const handleTyping = (toUri: string) => {
  // Clear existing timer
  if (typingTimer) clearTimeout(typingTimer)

  // Send "typing" indicator
  sendTypingIndicator(toUri, true)

  // Auto-stop after 2 seconds
  typingTimer = setTimeout(() => {
    sendTypingIndicator(toUri, false)
  }, 2000)
}`,
    },
    {
      title: 'Message Delivery Status',
      description: 'Track message delivery',
      code: `interface Message {
  id: string
  content: string
  status: 'sending' | 'sent' | 'delivered' | 'failed'
}

const sendMessageWithStatus = async (
  toUri: string,
  content: string
): Promise<Message> => {
  const message: Message = {
    id: Date.now().toString(),
    content,
    status: 'sending'
  }

  try {
    const request = sipClient.value.createMessage(
      toUri,
      content,
      'text/plain'
    )

    // Send message
    await request.send()

    message.status = 'sent'

    // Wait for response
    request.on('response', (response) => {
      if (response.statusCode === 200) {
        message.status = 'delivered'
      } else {
        message.status = 'failed'
      }
    })

  } catch (error) {
    message.status = 'failed'
  }

  return message
}`,
    },
  ],
}
