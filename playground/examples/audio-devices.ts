import type { ExampleDefinition } from './types'
import AudioDevicesDemo from '../demos/AudioDevicesDemo.vue'

export const audioDevicesExample: ExampleDefinition = {
  id: 'audio-devices',
  icon: '🎤',
  title: 'Audio Devices',
  description: 'Manage microphones and speakers',
  tags: ['Audio', 'Devices', 'Settings'],
  component: AudioDevicesDemo,
  setupGuide: '<p>Manage audio input and output devices for your SIP calls. Users can select their preferred microphone and speaker.</p>',
  codeSnippets: [
    {
      title: 'Audio Device Management',
      description: 'List and select audio devices',
      code: `import { useMediaDevices } from 'vuesip'

const {
  audioInputDevices,
  audioOutputDevices,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectAudioInput,
  selectAudioOutput,
  enumerateDevices
} = useMediaDevices()

// Enumerate available devices
await enumerateDevices()

// Select a specific microphone
selectAudioInput(deviceId)

// Select a specific speaker
selectAudioOutput(deviceId)`,
    },
  ],
}
