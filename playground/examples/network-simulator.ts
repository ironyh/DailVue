import type { ExampleDefinition } from './types'
import NetworkSimulatorDemo from '../demos/NetworkSimulatorDemo.vue'

export const networkSimulatorExample: ExampleDefinition = {
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
}
