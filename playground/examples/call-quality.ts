import type { ExampleDefinition } from './types'
import CallQualityDemo from '../demos/CallQualityDemo.vue'

export const callQualityExample: ExampleDefinition = {
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
}
