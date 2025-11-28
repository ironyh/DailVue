import type { ExampleDefinition } from './types'
import CustomRingtonesDemo from '../demos/CustomRingtonesDemo.vue'

export const customRingtonesExample: ExampleDefinition = {
  id: 'custom-ringtones',
  icon: '🔔',
  title: 'Custom Ringtones',
  description: 'Play custom audio for incoming calls',
  tags: ['Audio', 'Customization', 'UI'],
  component: CustomRingtonesDemo,
  setupGuide: '<p>Customize the incoming call experience with different ringtones. Select from built-in tones or use custom audio files with volume control.</p>',
  codeSnippets: [
    {
      title: 'Ringtone Playback',
      description: 'Play audio on incoming calls',
      code: `import { ref, watch } from 'vue'
import { useCallSession } from 'vuesip'

const ringtone = ref<HTMLAudioElement | null>(null)

// Initialize ringtone
const initRingtone = () => {
  ringtone.value = new Audio('/ringtones/default.mp3')
  ringtone.value.loop = true
  ringtone.value.volume = 0.8
}

const { state } = useCallSession(sipClient)

watch(state, (newState, oldState) => {
  if (newState === 'incoming') {
    // Start ringing
    ringtone.value?.play()

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([500, 250, 500])
    }
  } else if (oldState === 'incoming') {
    // Stop ringing
    ringtone.value?.pause()
    if (ringtone.value) ringtone.value.currentTime = 0
  }
})`,
    },
  ],
}
