# DailVue Examples

This directory contains example implementations showing how to use DailVue headless Vue composables.

## Running the Example

```bash
npm install
npm run dev
```

Open your browser to `http://localhost:5173`

## Example Application

The main example (`App.vue`) demonstrates a complete SIP phone interface with:

### Features Demonstrated

1. **SIP Connection Management**
   - Connect to a SIP server
   - Register with credentials
   - Monitor connection status

2. **Call Handling**
   - Make outgoing calls
   - Receive incoming calls
   - Answer/reject incoming calls
   - End active calls

3. **Dialpad Integration**
   - Visual dialpad for entering numbers
   - DTMF tone support during calls
   - Click-to-call functionality

4. **Audio Device Selection**
   - List available microphones
   - List available speakers
   - Switch devices on the fly

## Usage Patterns

### Basic Connection

```vue
<script setup>
import { useSipConnection } from 'dailvue'

const config = {
  server: 'sip.example.com',
  username: '1000',
  password: 'secret',
  displayName: 'My Name'
}

const { isConnected, isRegistered, connect, disconnect } = useSipConnection(config)

// Connect to server
await connect()
</script>
```

### Making Calls

```vue
<script setup>
import { ref } from 'vue'
import { useSipCall } from 'dailvue'

const userAgent = ref(null) // Set this to your UserAgent instance
const { currentCall, makeCall, endCall } = useSipCall(userAgent)

// Make a call
const callNumber = async (number) => {
  await makeCall(number)
}

// End active call
const hangup = async () => {
  await endCall()
}
</script>
```

### Handling Incoming Calls

```vue
<script setup>
import { useSipCall } from 'dailvue'

const userAgent = ref(null)
const { incomingCall, answerCall, rejectCall } = useSipCall(userAgent)

// Answer incoming call
const answer = async () => {
  if (incomingCall.value) {
    await answerCall()
  }
}

// Reject incoming call
const reject = async () => {
  if (incomingCall.value) {
    await rejectCall()
  }
}
</script>

<template>
  <div v-if="incomingCall">
    <p>Incoming call from {{ incomingCall.remoteIdentity }}</p>
    <button @click="answer">Answer</button>
    <button @click="reject">Reject</button>
  </div>
</template>
```

### Sending DTMF Tones

```vue
<script setup>
import { ref } from 'vue'
import { useSipDtmf } from 'dailvue'

const currentSession = ref(null) // Set this to your active session
const { sendDtmf, sendDtmfSequence } = useSipDtmf(currentSession)

// Send single digit
const sendDigit = async (digit) => {
  await sendDtmf(digit)
}

// Send multiple digits
const sendNumber = async () => {
  await sendDtmfSequence('1234')
}
</script>
```

### Audio Device Management

```vue
<script setup>
import { useAudioDevices } from 'dailvue'

const {
  audioInputDevices,
  audioOutputDevices,
  selectedInputDevice,
  selectedOutputDevice,
  setInputDevice,
  setOutputDevice
} = useAudioDevices()

// Change microphone
const changeMic = (deviceId) => {
  setInputDevice(deviceId)
}

// Change speaker
const changeSpeaker = (deviceId) => {
  setOutputDevice(deviceId)
}
</script>

<template>
  <select v-model="selectedInputDevice" @change="changeMic($event.target.value)">
    <option v-for="device in audioInputDevices" :key="device.deviceId" :value="device.deviceId">
      {{ device.label }}
    </option>
  </select>
</template>
```

## Custom UI Components

The example components (`Dialpad.vue` and `CallControls.vue`) are provided as reference implementations. Feel free to:

- Use them as-is
- Customize them for your design system
- Build your own components from scratch
- Integrate with UI libraries like PrimeVue, Vuetify, Element Plus, etc.

## Integration with PrimeVue

```vue
<script setup>
import { Button } from 'primevue/button'
import { InputText } from 'primevue/inputtext'
import { useSipConnection, useSipCall } from 'dailvue'

// Your SIP logic here
</script>

<template>
  <div>
    <InputText v-model="phoneNumber" placeholder="Enter number" />
    <Button @click="makeCall(phoneNumber)" label="Call" icon="pi pi-phone" />
  </div>
</template>
```

## Notes

- Always handle errors appropriately in production
- Test with your specific SIP server configuration
- Ensure proper WebRTC permissions are granted
- Consider implementing call quality monitoring
- Add logging for debugging purposes
