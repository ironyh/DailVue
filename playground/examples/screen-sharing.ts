import type { ExampleDefinition } from './types'
import ScreenSharingDemo from '../demos/ScreenSharingDemo.vue'

export const screenSharingExample: ExampleDefinition = {
  id: 'screen-sharing',
  icon: '🖥️',
  title: 'Screen Sharing',
  description: 'Share screen during video calls',
  tags: ['Video', 'Advanced', 'Screen'],
  component: ScreenSharingDemo,
  setupGuide: '<p>Share your screen, application windows, or browser tabs during video calls. Requires WebRTC screen capture API support.</p>',
  codeSnippets: [
    {
      title: 'Start Screen Sharing',
      description: 'Request screen capture permission',
      code: `import { ref } from 'vue'
import { useCallSession } from 'vuesip'

const screenStream = ref<MediaStream | null>(null)
const { session } = useCallSession(sipClient)

const startScreenShare = async () => {
  try {
    // Request screen capture
    screenStream.value = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always'
      },
      audio: false
    })

    // Replace video track in call
    const videoTrack = screenStream.value.getVideoTracks()[0]

    const sender = session.value.connection
      .getSenders()
      .find(s => s.track?.kind === 'video')

    if (sender) {
      await sender.replaceTrack(videoTrack)
    }

    // Listen for stop sharing
    videoTrack.onended = () => {
      stopScreenShare()
    }
  } catch (error) {
    console.error('Screen sharing failed:', error)
  }
}

const stopScreenShare = async () => {
  if (screenStream.value) {
    screenStream.value.getTracks().forEach(track => track.stop())
    screenStream.value = null
  }

  // Restore camera stream
  // ... restore original video track
}`,
    },
    {
      title: 'Screen Share Options',
      description: 'Configure capture settings',
      code: `const shareScreen = async (options: {
  type: 'screen' | 'window' | 'tab'
  audio: boolean
  highQuality: boolean
}) => {
  const constraints: any = {
    video: {
      cursor: 'always',
      displaySurface: options.type
    },
    audio: options.audio
  }

  if (options.highQuality) {
    constraints.video.width = { ideal: 1920 }
    constraints.video.height = { ideal: 1080 }
    constraints.video.frameRate = { ideal: 30 }
  } else {
    constraints.video.width = { ideal: 1280 }
    constraints.video.height = { ideal: 720 }
    constraints.video.frameRate = { ideal: 15 }
  }

  const stream = await navigator.mediaDevices
    .getDisplayMedia(constraints)

  return stream
}`,
    },
  ],
}
