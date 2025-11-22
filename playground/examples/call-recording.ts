import type { ExampleDefinition } from './types'
import CallRecordingDemo from '../demos/CallRecordingDemo.vue'

export const callRecordingExample: ExampleDefinition = {
  id: 'call-recording',
  icon: '📹',
  title: 'Call Recording',
  description: 'Record and playback call audio',
  tags: ['Advanced', 'Recording', 'Media'],
  component: CallRecordingDemo,
  setupGuide: '<p>Record call audio using the MediaRecorder API. Save recordings to disk or play them back later. Recordings are stored temporarily in memory.</p>',
  codeSnippets: [
    {
      title: 'Recording Setup',
      description: 'Start recording call audio',
      code: `import { ref } from 'vue'
import { useCallSession } from 'vuesip'

const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])

const { session } = useCallSession(sipClient)

const startRecording = async () => {
  if (!session.value?.remoteStream) return

  const stream = session.value.remoteStream
  mediaRecorder.value = new MediaRecorder(stream, {
    mimeType: 'audio/webm'
  })

  recordedChunks.value = []

  mediaRecorder.value.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.value.push(event.data)
    }
  }

  mediaRecorder.value.start()
}

const stopRecording = () => {
  if (mediaRecorder.value) {
    mediaRecorder.value.stop()

    // Create blob from chunks
    const blob = new Blob(recordedChunks.value, {
      type: 'audio/webm'
    })

    // Download or save
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'recording.webm'
    a.click()
  }
}`,
    },
  ],
}
