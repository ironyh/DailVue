import { ref, computed, type Ref } from 'vue'
import { UserAgent, Registerer, RegistererState } from 'sip.js'
import type { SipConfig, SipError } from '../types'

export interface UseSipConnectionReturn {
  isConnected: Ref<boolean>
  isRegistered: Ref<boolean>
  isConnecting: Ref<boolean>
  error: Ref<SipError | null>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  register: () => Promise<void>
  unregister: () => Promise<void>
}

export function useSipConnection(config: SipConfig): UseSipConnectionReturn {
  const isConnected = ref(false)
  const isRegistered = ref(false)
  const isConnecting = ref(false)
  const error = ref<SipError | null>(null)
  
  let userAgent: UserAgent | null = null
  let registerer: Registerer | null = null

  const connect = async () => {
    try {
      isConnecting.value = true
      error.value = null

      const uri = UserAgent.makeURI(`sip:${config.username}@${config.server}`)
      if (!uri) {
        throw new Error('Invalid SIP URI')
      }
      
      userAgent = new UserAgent({
        uri,
        transportOptions: {
          server: `wss://${config.server}`
        },
        authorizationUsername: config.username,
        authorizationPassword: config.password,
        displayName: config.displayName || config.username,
        sessionDescriptionHandlerFactoryOptions: config.sessionDescriptionHandlerFactoryOptions || {
          constraints: {
            audio: true,
            video: false
          }
        }
      })

      userAgent.delegate = {
        onConnect: () => {
          isConnected.value = true
          if (config.autoRegister !== false) {
            register()
          }
        },
        onDisconnect: () => {
          isConnected.value = false
          isRegistered.value = false
        }
      }

      await userAgent.start()

      if (userAgent) {
        registerer = new Registerer(userAgent)
      }
    } catch (err) {
      error.value = {
        code: -1,
        message: 'Failed to connect to SIP server',
        cause: err as Error
      }
      throw err
    } finally {
      isConnecting.value = false
    }
  }

  const disconnect = async () => {
    try {
      if (registerer && isRegistered.value) {
        await unregister()
      }
      
      if (userAgent) {
        await userAgent.stop()
        userAgent = null
      }
      
      isConnected.value = false
      isRegistered.value = false
    } catch (err) {
      error.value = {
        code: -1,
        message: 'Failed to disconnect from SIP server',
        cause: err as Error
      }
      throw err
    }
  }

  const register = async () => {
    try {
      if (!registerer) {
        throw new Error('Registerer not initialized')
      }

      registerer.stateChange.addListener((state: RegistererState) => {
        isRegistered.value = state === RegistererState.Registered
      })

      await registerer.register()
    } catch (err) {
      error.value = {
        code: -1,
        message: 'Failed to register with SIP server',
        cause: err as Error
      }
      throw err
    }
  }

  const unregister = async () => {
    try {
      if (!registerer) {
        throw new Error('Registerer not initialized')
      }

      await registerer.unregister()
      isRegistered.value = false
    } catch (err) {
      error.value = {
        code: -1,
        message: 'Failed to unregister from SIP server',
        cause: err as Error
      }
      throw err
    }
  }

  return {
    isConnected: computed(() => isConnected.value),
    isRegistered: computed(() => isRegistered.value),
    isConnecting: computed(() => isConnecting.value),
    error: computed(() => error.value),
    connect,
    disconnect,
    register,
    unregister
  }
}
