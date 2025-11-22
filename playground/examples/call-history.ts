import type { ExampleDefinition } from './types'
import CallHistoryDemo from '../demos/CallHistoryDemo.vue'

export const callHistoryExample: ExampleDefinition = {
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
}
