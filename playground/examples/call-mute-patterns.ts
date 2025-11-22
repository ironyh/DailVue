import type { ExampleDefinition } from './types'
import CallMutePatternsDemo from '../demos/CallMutePatternsDemo.vue'

export const callMutePatternsExample: ExampleDefinition = {
  id: 'call-mute-patterns',
  icon: '🔇',
  title: 'Call Mute Patterns',
  description: 'Advanced mute controls and patterns',
  tags: ['Advanced', 'Audio', 'Patterns'],
  component: CallMutePatternsDemo,
  setupGuide: '<p>Explore different mute patterns including push-to-talk, auto-mute on silence, and scheduled mute/unmute. Perfect for different use cases like meetings and presentations.</p>',
  codeSnippets: [
    {
      title: 'Push-to-Talk Implementation',
      description: 'Hold key to unmute temporarily',
      code: `import { ref, onMounted, onUnmounted } from 'vue'
import { useCallSession } from 'vuesip'

const { mute, unmute, isMuted } = useCallSession(sipClient)
const isPushToTalkActive = ref(false)

const handleKeyDown = async (event: KeyboardEvent) => {
  if (event.code === 'Space' && !isPushToTalkActive.value) {
    isPushToTalkActive.value = true
    await unmute()
  }
}

const handleKeyUp = async (event: KeyboardEvent) => {
  if (event.code === 'Space' && isPushToTalkActive.value) {
    isPushToTalkActive.value = false
    await mute()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  // Start muted for push-to-talk
  mute()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})`,
    },
    {
      title: 'Auto-Mute on Silence',
      description: 'Automatically mute when no audio detected',
      code: `const autoMuteDelay = ref(3000) // 3 seconds
let silenceTimer: number | null = null

// Monitor audio level
const checkAudioLevel = (level: number) => {
  if (level < 10) {
    // Low audio, start silence timer
    if (!silenceTimer) {
      silenceTimer = window.setTimeout(async () => {
        await mute()
      }, autoMuteDelay.value)
    }
  } else {
    // Audio detected, cancel timer and unmute
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    if (isMuted.value) {
      await unmute()
    }
  }
}`,
    },
  ],
}
