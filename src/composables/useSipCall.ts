import { ref, computed, type Ref } from 'vue'
import { UserAgent, Inviter, Invitation, Session, SessionState } from 'sip.js'
import type { CallSession, CallState } from '../types'

export interface UseSipCallReturn {
  currentCall: Ref<CallSession | null>
  incomingCall: Ref<CallSession | null>
  isCalling: Ref<boolean>
  isInCall: Ref<boolean>
  makeCall: (target: string) => Promise<void>
  answerCall: () => Promise<void>
  endCall: () => Promise<void>
  rejectCall: () => Promise<void>
}

export function useSipCall(userAgent: Ref<UserAgent | null>): UseSipCallReturn {
  const currentCall = ref<CallSession | null>(null)
  const incomingCall = ref<CallSession | null>(null)
  const isCalling = ref(false)
  const isInCall = ref(false)

  let currentSession: Session | null = null

  const mapSessionState = (state: SessionState): CallState => {
    switch (state) {
      case SessionState.Initial:
        return 'Initial'
      case SessionState.Establishing:
        return 'Establishing'
      case SessionState.Established:
        return 'Established'
      case SessionState.Terminating:
        return 'Terminating'
      case SessionState.Terminated:
        return 'Terminated'
      default:
        return 'Initial'
    }
  }

  const setupSessionHandlers = (session: Session, callData: CallSession) => {
    currentSession = session

    session.stateChange.addListener((state: SessionState) => {
      callData.state = mapSessionState(state)
      
      if (state === SessionState.Established) {
        isInCall.value = true
        isCalling.value = false
        callData.answerTime = new Date()
        currentCall.value = callData
        incomingCall.value = null
      } else if (state === SessionState.Terminated) {
        isInCall.value = false
        isCalling.value = false
        callData.endTime = new Date()
        currentCall.value = null
        currentSession = null
      }
    })

    // Setup remote audio
    const remoteStream = new MediaStream()
    const sdh = session.sessionDescriptionHandler as any
    if (sdh?.peerConnection) {
      sdh.peerConnection.getReceivers().forEach((receiver: RTCRtpReceiver) => {
        if (receiver.track) {
          remoteStream.addTrack(receiver.track)
        }
      })
    }

    const remoteAudio = new Audio()
    remoteAudio.srcObject = remoteStream
    remoteAudio.play()
  }

  const makeCall = async (target: string) => {
    if (!userAgent.value) {
      throw new Error('User agent not initialized')
    }

    try {
      isCalling.value = true
      
      const targetUri = UserAgent.makeURI(`sip:${target}@${userAgent.value.configuration.uri.host}`)
      if (!targetUri) {
        throw new Error('Invalid target URI')
      }
      
      const inviter = new Inviter(userAgent.value, targetUri)

      const callData: CallSession = {
        id: inviter.id,
        remoteIdentity: target,
        direction: 'outgoing',
        state: 'Initial',
        startTime: new Date()
      }

      setupSessionHandlers(inviter, callData)

      await inviter.invite()
      currentCall.value = callData
    } catch (err) {
      isCalling.value = false
      throw err
    }
  }

  const answerCall = async () => {
    if (!currentSession || !incomingCall.value) {
      throw new Error('No incoming call to answer')
    }

    const invitation = currentSession as Invitation
    await invitation.accept()
  }

  const endCall = async () => {
    if (!currentSession) {
      throw new Error('No active call to end')
    }

    if (currentSession.state === SessionState.Established) {
      await currentSession.bye()
    } else if (currentSession.state === SessionState.Establishing) {
      // For inviter, use cancel
      const inviter = currentSession as Inviter
      if ('cancel' in inviter) {
        await inviter.cancel()
      } else {
        await currentSession.bye()
      }
    }
  }

  const rejectCall = async () => {
    if (!currentSession || !incomingCall.value) {
      throw new Error('No incoming call to reject')
    }

    const invitation = currentSession as Invitation
    await invitation.reject()
    incomingCall.value = null
    currentSession = null
  }

  // Setup incoming call handler
  if (userAgent.value) {
    userAgent.value.delegate = {
      ...userAgent.value.delegate,
      onInvite: (invitation: Invitation) => {
        const callData: CallSession = {
          id: invitation.id,
          remoteIdentity: invitation.remoteIdentity.uri.user || 'Unknown',
          direction: 'incoming',
          state: 'Initial',
          startTime: new Date()
        }

        setupSessionHandlers(invitation, callData)
        incomingCall.value = callData
      }
    }
  }

  return {
    currentCall: computed(() => currentCall.value),
    incomingCall: computed(() => incomingCall.value),
    isCalling: computed(() => isCalling.value),
    isInCall: computed(() => isInCall.value),
    makeCall,
    answerCall,
    endCall,
    rejectCall
  }
}
