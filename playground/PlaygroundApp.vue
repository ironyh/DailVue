<template>
  <div class="playground" data-testid="sip-client">
    <!-- Header -->
    <header class="playground-header">
      <div class="container">
        <h1>🎮 VueSip Interactive Playground</h1>
        <p class="subtitle">
          Explore and experiment with VueSip composables for building SIP/VoIP applications
        </p>
      </div>
    </header>

    <!-- Main Content -->
    <div class="playground-content">
      <!-- Sidebar Navigation -->
      <aside class="playground-sidebar">
        <nav>
          <h2>Examples</h2>
          <ul class="example-list">
            <li
              v-for="example in examples"
              :key="example.id"
              :class="{ active: currentExample === example.id }"
              @click="selectExample(example.id)"
            >
              <span class="example-icon">{{ example.icon }}</span>
              <div class="example-info">
                <h3>{{ example.title }}</h3>
                <p>{{ example.description }}</p>
              </div>
            </li>
          </ul>
        </nav>

        <!-- Quick Links -->
        <div class="quick-links">
          <h3>Resources</h3>
          <ul>
            <li>
              <a href="/docs" target="_blank">📚 Documentation</a>
            </li>
            <li>
              <a href="https://github.com/ironyh/VueSip" target="_blank">💻 GitHub Repository</a>
            </li>
            <li>
              <a href="https://www.npmjs.com/package/vuesip" target="_blank">📦 NPM Package</a>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Main Area -->
      <main class="playground-main">
        <!-- Example Header -->
        <div class="example-header">
          <h2>{{ activeExample.title }}</h2>
          <p>{{ activeExample.description }}</p>
          <div class="example-tags">
            <span v-for="tag in activeExample.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            :class="{ active: activeTab === 'demo' }"
            @click="activeTab = 'demo'"
          >
            🎯 Live Demo
          </button>
          <button
            :class="{ active: activeTab === 'code' }"
            @click="activeTab = 'code'"
          >
            💻 Code Examples
          </button>
          <button
            :class="{ active: activeTab === 'setup' }"
            @click="activeTab = 'setup'"
          >
            ⚙️ Setup Guide
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Live Demo Tab -->
          <div v-if="activeTab === 'demo'" class="demo-container">
            <component :is="activeExample.component" />
          </div>

          <!-- Code Examples Tab -->
          <div v-if="activeTab === 'code'" class="code-container">
            <div v-for="(snippet, index) in activeExample.codeSnippets" :key="index" class="code-snippet">
              <h3>{{ snippet.title }}</h3>
              <p v-if="snippet.description" class="snippet-description">
                {{ snippet.description }}
              </p>
              <pre><code>{{ snippet.code }}</code></pre>
            </div>
          </div>

          <!-- Setup Guide Tab -->
          <div v-if="activeTab === 'setup'" class="setup-container">
            <div class="setup-content">
              <h3>Prerequisites</h3>
              <ul>
                <li>Vue 3.4.0 or higher</li>
                <li>A SIP server (Asterisk, FreeSWITCH, etc.)</li>
                <li>WebRTC-enabled browser (Chrome 90+, Firefox 88+, Safari 14+)</li>
              </ul>

              <h3>Installation</h3>
              <pre><code># npm
npm install vuesip

# pnpm
pnpm add vuesip

# yarn
yarn add vuesip</code></pre>

              <h3>Quick Start</h3>
              <pre><code>import { useSipClient, useCallSession } from 'vuesip'

// In your component
const { connect, isConnected } = useSipClient()
const { makeCall, answer, hangup } = useCallSession()</code></pre>

              <h3>{{ activeExample.title }} Specific Setup</h3>
              <div v-html="activeExample.setupGuide"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import BasicCallDemo from './demos/BasicCallDemo.vue'
import DtmfDemo from './demos/DtmfDemo.vue'
import AudioDevicesDemo from './demos/AudioDevicesDemo.vue'
import CallHistoryDemo from './demos/CallHistoryDemo.vue'
import CallTransferDemo from './demos/CallTransferDemo.vue'
import VideoCallDemo from './demos/VideoCallDemo.vue'
import CallTimerDemo from './demos/CallTimerDemo.vue'
import SpeedDialDemo from './demos/SpeedDialDemo.vue'
import DoNotDisturbDemo from './demos/DoNotDisturbDemo.vue'
import CallQualityDemo from './demos/CallQualityDemo.vue'
import CustomRingtonesDemo from './demos/CustomRingtonesDemo.vue'
import CallRecordingDemo from './demos/CallRecordingDemo.vue'
import ConferenceCallDemo from './demos/ConferenceCallDemo.vue'
import CallMutePatternsDemo from './demos/CallMutePatternsDemo.vue'
import NetworkSimulatorDemo from './demos/NetworkSimulatorDemo.vue'
import ScreenSharingDemo from './demos/ScreenSharingDemo.vue'
import CallWaitingDemo from './demos/CallWaitingDemo.vue'
import SipMessagingDemo from './demos/SipMessagingDemo.vue'

// Example definitions
const examples = [
  {
    id: 'basic-call',
    icon: '📞',
    title: 'Basic Audio Call',
    description: 'Simple one-to-one audio calling',
    tags: ['Beginner', 'Audio', 'Core'],
    component: BasicCallDemo,
    setupGuide: '<p>This example demonstrates basic SIP calling functionality. Configure your SIP server details in the connection panel to get started.</p>',
    codeSnippets: [
      {
        title: 'Basic Call Setup',
        description: 'Initialize SIP client and make a call',
        code: `import { useSipClient, useCallSession } from 'vuesip'

const { connect, isConnected } = useSipClient()
const { makeCall, hangup, callState } = useCallSession()

// Connect to SIP server
await connect()

// Make a call
await makeCall('sip:user@example.com')

// End the call
await hangup()`,
      },
      {
        title: 'Handling Incoming Calls',
        description: 'Answer or reject incoming calls',
        code: `const { answer, reject, callState, remoteUri } = useCallSession()

// Watch for incoming calls
watch(callState, (state) => {
  if (state === 'incoming') {
    console.log('Incoming call from:', remoteUri.value)
  }
})

// Answer the call
await answer({ audio: true, video: false })

// Or reject it
await reject(486) // Busy Here`,
      },
    ],
  },
  {
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
  },
  {
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
  },
  {
    id: 'call-history',
    icon: '📋',
    title: 'Call History',
    description: 'View and manage call history',
    tags: ['Advanced', 'History', 'Analytics'],
    component: CallHistoryDemo,
    setupGuide: '<p>Call history is automatically tracked and stored in IndexedDB. View statistics, search, filter, and export your call history.</p>',
    codeSnippets: [
      {
        title: 'Using Call History',
        description: 'Access and manage call history',
        code: `import { useCallHistory } from 'vuesip'

const {
  history,
  searchHistory,
  getStatistics,
  exportHistory,
  clearHistory
} = useCallHistory()

// Get all call history
console.log(history.value)

// Search history
const results = searchHistory('john')

// Get statistics
const stats = getStatistics()
console.log(\`Total calls: \${stats.totalCalls}\`)

// Export to CSV
await exportHistory({
  format: 'csv',
  filename: 'my-calls'
})`,
      },
    ],
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: 'speed-dial',
    icon: '⭐',
    title: 'Speed Dial',
    description: 'Quick-dial saved contacts',
    tags: ['UI', 'Contacts', 'Practical'],
    component: SpeedDialDemo,
    setupGuide: '<p>Save frequently called contacts for one-click dialing. Contacts are stored in localStorage and persist across sessions.</p>',
    codeSnippets: [
      {
        title: 'Speed Dial Management',
        description: 'Save and dial favorite contacts',
        code: `import { ref } from 'vuesip'

interface Contact {
  name: string
  number: string
}

const speedDial = ref<Contact[]>([])

// Load from localStorage
const loadSpeedDial = () => {
  const saved = localStorage.getItem('speed-dial')
  if (saved) speedDial.value = JSON.parse(saved)
}

// Add contact
const addContact = (contact: Contact) => {
  speedDial.value.push(contact)
  localStorage.setItem('speed-dial', JSON.stringify(speedDial.value))
}

// Quick dial
const quickDial = async (contact: Contact) => {
  await makeCall(contact.number)
}`,
      },
    ],
  },
  {
    id: 'do-not-disturb',
    icon: '🔕',
    title: 'Do Not Disturb',
    description: 'Auto-reject incoming calls',
    tags: ['Feature', 'Auto-Action', 'Simple'],
    component: DoNotDisturbDemo,
    setupGuide: '<p>Enable Do Not Disturb mode to automatically reject all incoming calls. Perfect for focus time or meetings.</p>',
    codeSnippets: [
      {
        title: 'DND Implementation',
        description: 'Auto-reject calls when DND is enabled',
        code: `import { ref, watch } from 'vue'
import { useCallSession } from 'vuesip'

const dndEnabled = ref(false)

const { state, reject } = useCallSession(sipClient)

// Auto-reject incoming calls
watch(state, async (newState) => {
  if (newState === 'incoming' && dndEnabled.value) {
    console.log('Auto-rejecting due to DND')
    await reject(486) // 486 Busy Here
  }
})

// Save DND state
watch(dndEnabled, (enabled) => {
  localStorage.setItem('dnd-enabled', String(enabled))
})`,
      },
    ],
  },
  {
    id: 'call-quality',
    icon: '📊',
    title: 'Call Quality Metrics',
    description: 'Monitor real-time call statistics',
    tags: ['Advanced', 'Monitoring', 'Debug'],
    component: CallQualityDemo,
    setupGuide: '<p>View real-time call quality metrics including packet loss, jitter, RTT, and codec information. Essential for diagnosing call quality issues.</p>',
    codeSnippets: [
      {
        title: 'Getting Call Statistics',
        description: 'Access WebRTC stats during calls',
        code: `import { useCallSession } from 'vuesip'

const { session } = useCallSession(sipClient)

const getCallStats = async () => {
  if (!session.value?.connection) return

  const stats = await session.value.connection.getStats()

  const metrics = {
    packetLoss: 0,
    jitter: 0,
    rtt: 0
  }

  stats.forEach(report => {
    if (report.type === 'inbound-rtp') {
      metrics.packetLoss = report.packetsLost || 0
      metrics.jitter = report.jitter * 1000
    }

    if (report.type === 'candidate-pair') {
      metrics.rtt = report.currentRoundTripTime * 1000
    }
  })

  return metrics
}

// Poll every 2 seconds
setInterval(getCallStats, 2000)`,
      },
    ],
  },
  {
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
  },
  {
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
  },
  {
    id: 'conference-call',
    icon: '👥',
    title: 'Conference Call',
    description: 'Manage multiple simultaneous calls',
    tags: ['Advanced', 'Multi-party', 'Complex'],
    component: ConferenceCallDemo,
    setupGuide: '<p>Manage conference calls with multiple participants. Hold, mute, and control individual participants. Merge calls together.</p>',
    codeSnippets: [
      {
        title: 'Managing Multiple Calls',
        description: 'Handle multiple simultaneous calls',
        code: `import { ref } from 'vue'
import { useSipClient } from 'vuesip'

const activeCalls = ref<Call[]>([])

const { makeCall, sessions } = useSipClient()

// Add participant to conference
const addParticipant = async (uri: string) => {
  const callId = await makeCall(uri)

  activeCalls.value.push({
    id: callId,
    uri,
    state: 'connecting'
  })
}

// Hold/Resume specific call
const toggleCallHold = async (callId: string) => {
  const call = sessions.value.get(callId)
  if (!call) return

  if (call.isOnHold) {
    await call.unhold()
  } else {
    await call.hold()
  }
}

// Mute specific call
const muteCall = async (callId: string) => {
  const call = sessions.value.get(callId)
  await call?.mute()
}

// End specific call
const endCall = async (callId: string) => {
  const call = sessions.value.get(callId)
  await call?.hangup()

  const index = activeCalls.value.findIndex(c => c.id === callId)
  if (index !== -1) {
    activeCalls.value.splice(index, 1)
  }
}`,
      },
    ],
  },
  {
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
  },
  {
    id: 'network-simulator',
    icon: '📡',
    title: 'Network Simulator',
    description: 'Simulate network conditions',
    tags: ['Debug', 'Testing', 'Advanced'],
    component: NetworkSimulatorDemo,
    setupGuide: '<p>Test your application under various network conditions. Simulate latency, packet loss, jitter, and bandwidth constraints to see how your calls perform.</p>',
    codeSnippets: [
      {
        title: 'Network Condition Profiles',
        description: 'Pre-defined network profiles',
        code: `interface NetworkProfile {
  name: string
  latency: number     // ms
  packetLoss: number  // %
  jitter: number      // ms
  bandwidth: number   // kbps
}

const profiles: NetworkProfile[] = [
  {
    name: 'Excellent',
    latency: 20,
    packetLoss: 0,
    jitter: 5,
    bandwidth: 10000
  },
  {
    name: '4G Mobile',
    latency: 100,
    packetLoss: 2,
    jitter: 25,
    bandwidth: 500
  },
  {
    name: 'Poor WiFi',
    latency: 300,
    packetLoss: 10,
    jitter: 100,
    bandwidth: 256
  }
]

const applyProfile = (profile: NetworkProfile) => {
  console.log(\`Simulating: \${profile.name}\`)
  // Apply settings to connection
}`,
      },
      {
        title: 'Quality Metrics',
        description: 'Calculate call quality score',
        code: `const calculateQuality = (
  latency: number,
  packetLoss: number,
  jitter: number
): string => {
  let score = 100

  // Penalize for latency
  if (latency > 400) score -= 50
  else if (latency > 200) score -= 30
  else if (latency > 100) score -= 15

  // Penalize for packet loss
  if (packetLoss > 10) score -= 40
  else if (packetLoss > 5) score -= 25
  else if (packetLoss > 2) score -= 10

  // Penalize for jitter
  if (jitter > 100) score -= 30
  else if (jitter > 50) score -= 15
  else if (jitter > 25) score -= 5

  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor'
}`,
      },
    ],
  },
  {
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
  },
  {
    id: 'call-waiting',
    icon: '📱',
    title: 'Call Waiting & Switching',
    description: 'Handle multiple calls and switch between them',
    tags: ['Advanced', 'Multi-Call', 'Practical'],
    component: CallWaitingDemo,
    setupGuide: '<p>Handle multiple simultaneous calls with call waiting. Switch between active calls, hold/resume calls, and manage incoming calls while on another call.</p>',
    codeSnippets: [
      {
        title: 'Managing Multiple Calls',
        description: 'Track and switch between calls',
        code: `import { ref } from 'vue'
import { useSipClient } from 'vuesip'

interface Call {
  id: string
  remoteUri: string
  state: 'active' | 'held' | 'incoming'
  isHeld: boolean
}

const calls = ref<Call[]>([])
const activeCallId = ref<string | null>(null)

// Answer incoming call and hold current
const answerAndHoldActive = async (callId: string) => {
  // Hold current active call
  if (activeCallId.value) {
    const current = calls.value.find(c => c.id === activeCallId.value)
    if (current) {
      await holdCall(current.id)
    }
  }

  // Answer new call
  const call = calls.value.find(c => c.id === callId)
  if (call) {
    await answerCall(callId)
    activeCallId.value = callId
  }
}

// Switch between calls
const switchToCall = async (callId: string) => {
  // Hold current
  if (activeCallId.value) {
    await holdCall(activeCallId.value)
  }

  // Resume target
  await resumeCall(callId)
  activeCallId.value = callId
}`,
      },
      {
        title: 'Call Waiting Settings',
        description: 'Configure call waiting behavior',
        code: `const callWaitingEnabled = ref(true)
const autoAnswerWaiting = ref(false)
const maxSimultaneousCalls = ref(3)

// Handle incoming call with call waiting
watch(incomingCall, async (call) => {
  if (!call) return

  if (!callWaitingEnabled.value && calls.value.length > 0) {
    // Reject if call waiting disabled
    await rejectCall(call.id, 486) // Busy Here
    return
  }

  if (calls.value.length >= maxSimultaneousCalls.value) {
    // Reject if max calls reached
    await rejectCall(call.id, 486)
    return
  }

  // Play call waiting tone
  playCallWaitingTone()

  if (autoAnswerWaiting.value) {
    // Auto-answer and hold current
    await answerAndHoldActive(call.id)
  }
})`,
      },
      {
        title: 'Swap and Merge Calls',
        description: 'Advanced multi-call operations',
        code: `// Swap active and held calls
const swapCalls = () => {
  const activeCall = calls.value.find(c => c.id === activeCallId.value)
  const heldCall = calls.value.find(c => c.isHeld)

  if (activeCall && heldCall) {
    // Hold active
    activeCall.isHeld = true

    // Resume held
    heldCall.isHeld = false
    activeCallId.value = heldCall.id
  }
}

// Merge all calls into conference
const mergeAllCalls = async () => {
  // Resume all held calls
  calls.value.forEach(call => {
    call.isHeld = false
  })

  console.log(\`Merged \${calls.value.length} calls into conference\`)
}`,
      },
    ],
  },
  {
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
  },
]

// State
const currentExample = ref('basic-call')
const activeTab = ref<'demo' | 'code' | 'setup'>('demo')

// Computed
const activeExample = computed(() => {
  return examples.find((ex) => ex.id === currentExample.value) || examples[0]
})

// Methods
const selectExample = (id: string) => {
  currentExample.value = id
  activeTab.value = 'demo'
}
</script>

<style scoped>
.playground {
  min-height: 100vh;
  background: #f8f9fa;
}

.playground-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.playground-header .container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
}

.playground-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 1.125rem;
  opacity: 0.95;
}

.playground-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  max-width: 1400px;
  margin: 2rem auto;
  gap: 2rem;
  padding: 0 2rem;
}

/* Sidebar */
.playground-sidebar {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  height: fit-content;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 2rem;
}

.playground-sidebar h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #333;
}

.example-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.example-list li {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.example-list li:hover {
  background: #f8f9fa;
}

.example-list li.active {
  background: #e7f3ff;
  border-color: #667eea;
}

.example-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.example-info h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  color: #333;
}

.example-info p {
  margin: 0;
  font-size: 0.875rem;
  color: #666;
}

/* Quick Links */
.quick-links {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.quick-links h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #333;
}

.quick-links ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quick-links li {
  margin-bottom: 0.5rem;
}

.quick-links a {
  color: #667eea;
  text-decoration: none;
  font-size: 0.875rem;
  display: block;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.quick-links a:hover {
  background: #f8f9fa;
}

/* Main Area */
.playground-main {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.example-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #333;
}

.example-header p {
  margin: 0 0 1rem 0;
  color: #666;
  font-size: 1.125rem;
}

.example-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tag {
  background: #e7f3ff;
  color: #0066cc;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 2rem;
}

.tab-navigation button {
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-navigation button:hover {
  color: #333;
}

.tab-navigation button.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

/* Tab Content */
.tab-content {
  min-height: 400px;
}

.demo-container {
  padding: 1rem;
}

/* Code Container */
.code-container {
  padding: 1rem;
}

.code-snippet {
  margin-bottom: 2rem;
}

.code-snippet h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #333;
}

.snippet-description {
  margin: 0 0 1rem 0;
  color: #666;
}

.code-snippet pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
}

.code-snippet code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Setup Container */
.setup-container {
  padding: 1rem;
}

.setup-content h3 {
  margin: 2rem 0 1rem 0;
  font-size: 1.5rem;
  color: #333;
}

.setup-content h3:first-child {
  margin-top: 0;
}

.setup-content ul {
  margin: 0 0 1.5rem 0;
  padding-left: 1.5rem;
}

.setup-content li {
  margin-bottom: 0.5rem;
  color: #666;
}

.setup-content pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0 1.5rem 0;
}

.setup-content code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 1024px) {
  .playground-content {
    grid-template-columns: 1fr;
  }

  .playground-sidebar {
    position: static;
  }
}

@media (max-width: 768px) {
  .playground-header h1 {
    font-size: 1.75rem;
  }

  .playground-content {
    padding: 0 1rem;
    margin: 1rem auto;
  }

  .playground-main {
    padding: 1.5rem;
  }

  .tab-navigation {
    overflow-x: auto;
  }

  .tab-navigation button {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    white-space: nowrap;
  }
}
</style>
