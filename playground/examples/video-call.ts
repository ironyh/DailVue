import type { ExampleDefinition } from './types'
import VideoCallDemo from '../demos/VideoCallDemo.vue'

export const videoCallExample: ExampleDefinition = {
  id: 'video-call',
  icon: '📹',
  title: 'Video Calling',
  description: 'Make video calls with camera',
  tags: ['Video', 'WebRTC', 'Advanced'],
  component: VideoCallDemo,
  setupGuide: '<p>Enable video calling with camera support. Grant camera and microphone permissions to use video features. Select different cameras and toggle video during calls.</p>',
  codeSnippets: [
    {
      title: 'Making Video Calls',
      description: 'Start a call with video enabled',
      code: `import { useCallSession } from 'vuesip'

const {
  makeCall,
  answer,
  localStream,
  remoteStream
} = useCallSession(sipClient)

// Make video call
await makeCall('sip:friend@example.com', {
  audio: true,
  video: true
})

// Answer with video
await answer({
  audio: true,
  video: true
})`,
    },
    {
      title: 'Video Controls',
      description: 'Toggle video during calls',
      code: `const {
  enableVideo,
  disableVideo,
  hasLocalVideo
} = useCallSession(sipClient)

// Toggle video
if (hasLocalVideo.value) {
  await disableVideo()
} else {
  await enableVideo()
}

// Display video streams
watch(remoteStream, (stream) => {
  videoElement.srcObject = stream
})`,
    },
  ],
}
