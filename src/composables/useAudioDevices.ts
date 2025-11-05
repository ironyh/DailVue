import { ref, onMounted, type Ref } from 'vue'
import type { AudioDevice } from '../types'

export interface UseAudioDevicesReturn {
  audioInputDevices: Ref<AudioDevice[]>
  audioOutputDevices: Ref<AudioDevice[]>
  selectedInputDevice: Ref<string | null>
  selectedOutputDevice: Ref<string | null>
  refreshDevices: () => Promise<void>
  setInputDevice: (deviceId: string) => void
  setOutputDevice: (deviceId: string) => void
}

export function useAudioDevices(): UseAudioDevicesReturn {
  const audioInputDevices = ref<AudioDevice[]>([])
  const audioOutputDevices = ref<AudioDevice[]>([])
  const selectedInputDevice = ref<string | null>(null)
  const selectedOutputDevice = ref<string | null>(null)

  const refreshDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      audioInputDevices.value = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }))

      audioOutputDevices.value = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }))

      // Set default devices if not already set
      if (!selectedInputDevice.value && audioInputDevices.value.length > 0) {
        selectedInputDevice.value = audioInputDevices.value[0].deviceId
      }

      if (!selectedOutputDevice.value && audioOutputDevices.value.length > 0) {
        selectedOutputDevice.value = audioOutputDevices.value[0].deviceId
      }
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err)
      throw err
    }
  }

  const setInputDevice = (deviceId: string) => {
    selectedInputDevice.value = deviceId
  }

  const setOutputDevice = (deviceId: string) => {
    selectedOutputDevice.value = deviceId
  }

  onMounted(() => {
    refreshDevices()
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
  })

  return {
    audioInputDevices,
    audioOutputDevices,
    selectedInputDevice,
    selectedOutputDevice,
    refreshDevices,
    setInputDevice,
    setOutputDevice
  }
}