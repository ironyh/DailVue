import { basicCallExample } from './basic-call'
import { dtmfExample } from './dtmf'
import { audioDevicesExample } from './audio-devices'
import { callHistoryExample } from './call-history'
import { callTransferExample } from './call-transfer'
import { videoCallExample } from './video-call'
import { callTimerExample } from './call-timer'
import { speedDialExample } from './speed-dial'
import { doNotDisturbExample } from './do-not-disturb'
import { callQualityExample } from './call-quality'
import { customRingtonesExample } from './custom-ringtones'
import { callRecordingExample } from './call-recording'
import { conferenceCallExample } from './conference-call'
import { callMutePatternsExample } from './call-mute-patterns'
import { networkSimulatorExample } from './network-simulator'
import { screenSharingExample } from './screen-sharing'
import { callWaitingExample } from './call-waiting'
import { sipMessagingExample } from './sip-messaging'
import { presenceExample } from './presence'
import { toolbarLayoutsExample } from './toolbar-layouts'

export const allExamples = [
  basicCallExample,
  dtmfExample,
  audioDevicesExample,
  callHistoryExample,
  callTransferExample,
  videoCallExample,
  callTimerExample,
  speedDialExample,
  doNotDisturbExample,
  callQualityExample,
  customRingtonesExample,
  callRecordingExample,
  conferenceCallExample,
  callMutePatternsExample,
  networkSimulatorExample,
  screenSharingExample,
  callWaitingExample,
  sipMessagingExample,
  presenceExample,
  toolbarLayoutsExample,
]

export type { ExampleDefinition, CodeSnippet } from './types'
