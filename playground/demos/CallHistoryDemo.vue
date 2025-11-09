<template>
  <div class="call-history-demo">
    <div class="info-section">
      <p>
        The Call History feature tracks all incoming and outgoing calls automatically. You can
        filter, search, export, and view statistics about your call activity.
      </p>
      <p class="note">
        <strong>Note:</strong> Call history is stored in IndexedDB and persists across browser
        sessions. You'll see entries here after making or receiving calls.
      </p>
    </div>

    <!-- Statistics Overview -->
    <div class="stats-overview">
      <h3>Call Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ statistics.totalCalls }}</div>
          <div class="stat-label">Total Calls</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ statistics.incomingCalls }}</div>
          <div class="stat-label">Incoming</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ statistics.outgoingCalls }}</div>
          <div class="stat-label">Outgoing</div>
        </div>
        <div class="stat-card missed">
          <div class="stat-value">{{ statistics.missedCalls }}</div>
          <div class="stat-label">Missed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatDuration(statistics.totalDuration) }}</div>
          <div class="stat-label">Total Duration</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatDuration(Math.round(statistics.averageDuration)) }}</div>
          <div class="stat-label">Avg Duration</div>
        </div>
      </div>
    </div>

    <!-- Filters and Actions -->
    <div class="controls-section">
      <div class="filter-controls">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or number..."
            @input="handleSearch"
          />
          <span class="search-icon">🔍</span>
        </div>

        <select v-model="filterDirection" @change="handleFilterChange">
          <option value="">All Calls</option>
          <option value="incoming">Incoming Only</option>
          <option value="outgoing">Outgoing Only</option>
        </select>

        <select v-model="filterType" @change="handleFilterChange">
          <option value="">All Types</option>
          <option value="answered">Answered</option>
          <option value="missed">Missed</option>
        </select>
      </div>

      <div class="action-buttons">
        <button
          class="btn btn-secondary"
          :disabled="totalCalls === 0"
          @click="handleExport"
        >
          📥 Export CSV
        </button>
        <button
          class="btn btn-danger-outline"
          :disabled="totalCalls === 0"
          @click="handleClearHistory"
        >
          🗑️ Clear All
        </button>
      </div>
    </div>

    <!-- Call History List -->
    <div class="history-list">
      <div v-if="totalCalls === 0" class="empty-state">
        <div class="empty-icon">📞</div>
        <h4>No Call History</h4>
        <p>Your call history will appear here after you make or receive calls.</p>
      </div>

      <div v-else-if="filteredHistory.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <h4>No Results Found</h4>
        <p>No calls match your current filters. Try adjusting your search.</p>
      </div>

      <div v-else class="history-entries">
        <div
          v-for="entry in paginatedHistory"
          :key="entry.id"
          class="history-entry"
          :class="{
            missed: entry.wasMissed && !entry.wasAnswered,
            'has-video': entry.hasVideo
          }"
        >
          <div class="entry-icon">
            <span v-if="entry.direction === 'incoming'">📥</span>
            <span v-else>📤</span>
            <span v-if="entry.hasVideo" class="video-badge">📹</span>
          </div>

          <div class="entry-info">
            <div class="entry-name">
              {{ entry.remoteDisplayName || entry.remoteUri }}
            </div>
            <div class="entry-details">
              <span class="entry-uri" v-if="entry.remoteDisplayName">
                {{ entry.remoteUri }}
              </span>
              <span class="entry-date">
                {{ formatDate(entry.startTime) }}
              </span>
            </div>
          </div>

          <div class="entry-status">
            <div class="entry-duration" v-if="entry.wasAnswered">
              {{ formatDuration(entry.duration) }}
            </div>
            <div class="entry-badge" v-if="entry.wasMissed && !entry.wasAnswered">
              Missed
            </div>
            <div class="entry-badge answered" v-else-if="entry.wasAnswered">
              Answered
            </div>
          </div>

          <div class="entry-actions">
            <button
              class="btn-icon"
              title="Delete entry"
              @click="handleDeleteEntry(entry.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="btn btn-sm"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          ← Previous
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          class="btn btn-sm"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Next →
        </button>
      </div>
    </div>

    <!-- Code Example -->
    <div class="code-example">
      <h4>Code Example</h4>
      <pre><code>import { useCallHistory } from 'vuesip'

const {
  history,
  filteredHistory,
  searchHistory,
  getStatistics,
  exportHistory,
  setFilter,
  clearHistory
} = useCallHistory()

// Get all history
console.log('Total calls:', history.value.length)

// Search history
const results = searchHistory('john')

// Filter history
setFilter({
  direction: 'incoming',
  wasAnswered: true,
  dateFrom: new Date('2024-01-01')
})

// Get statistics
const stats = getStatistics()
console.log(\`Total calls: \${stats.totalCalls}\`)
console.log(\`Missed calls: \${stats.missedCalls}\`)

// Export to CSV
await exportHistory({
  format: 'csv',
  filename: 'my-call-history'
})</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCallHistory } from '../../src'

// Call History composable
const {
  history,
  filteredHistory,
  totalCalls,
  missedCallsCount,
  searchHistory,
  getStatistics,
  exportHistory,
  setFilter,
  clearHistory,
  deleteEntry,
} = useCallHistory()

// State
const searchQuery = ref('')
const filterDirection = ref<'' | 'incoming' | 'outgoing'>('')
const filterType = ref<'' | 'answered' | 'missed'>('')
const currentPage = ref(1)
const itemsPerPage = 10

// Computed
const statistics = computed(() => getStatistics())

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredHistory.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredHistory.value.length / itemsPerPage)
})

// Methods
const handleSearch = () => {
  currentPage.value = 1
  updateFilter()
}

const handleFilterChange = () => {
  currentPage.value = 1
  updateFilter()
}

const updateFilter = () => {
  const filter: any = {}

  if (searchQuery.value) {
    filter.searchQuery = searchQuery.value
  }

  if (filterDirection.value) {
    filter.direction = filterDirection.value
  }

  if (filterType.value === 'answered') {
    filter.wasAnswered = true
  } else if (filterType.value === 'missed') {
    filter.wasMissed = true
    filter.wasAnswered = false
  }

  setFilter(Object.keys(filter).length > 0 ? filter : null)
}

const handleExport = async () => {
  try {
    await exportHistory({
      format: 'csv',
      filename: 'vuesip-call-history',
      includeMetadata: false,
    })
  } catch (error) {
    console.error('Export failed:', error)
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const handleClearHistory = async () => {
  if (!confirm('Are you sure you want to clear all call history? This cannot be undone.')) {
    return
  }

  try {
    await clearHistory()
    currentPage.value = 1
  } catch (error) {
    console.error('Clear history failed:', error)
    alert(`Failed to clear history: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const handleDeleteEntry = async (entryId: string) => {
  try {
    await deleteEntry(entryId)
  } catch (error) {
    console.error('Delete entry failed:', error)
    alert(`Failed to delete entry: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const formatDuration = (seconds: number): string => {
  if (seconds === 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDate = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }
}
</script>

<style scoped>
.call-history-demo {
  max-width: 900px;
  margin: 0 auto;
}

.info-section {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-section p {
  margin: 0 0 1rem 0;
  color: #666;
  line-height: 1.6;
}

.info-section p:last-child {
  margin-bottom: 0;
}

.note {
  padding: 1rem;
  background: #eff6ff;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  font-size: 0.875rem;
}

.stats-overview {
  margin-bottom: 2rem;
}

.stats-overview h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  text-align: center;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: #667eea;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.stat-card.missed {
  background: #fef2f2;
  border-color: #fecaca;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-card.missed .stat-value {
  color: #ef4444;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
}

.controls-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-controls {
  display: flex;
  gap: 0.75rem;
  flex: 1;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.search-box input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.25rem;
  opacity: 0.5;
}

.filter-controls select {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
}

.filter-controls select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-danger-outline {
  background: white;
  color: #ef4444;
  border: 1px solid #ef4444;
}

.btn-danger-outline:hover:not(:disabled) {
  background: #ef4444;
  color: white;
}

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.history-list {
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.history-entries {
  display: flex;
  flex-direction: column;
}

.history-entry {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s;
}

.history-entry:last-child {
  border-bottom: none;
}

.history-entry:hover {
  background: #f9fafb;
}

.history-entry.missed {
  background: #fef2f2;
}

.history-entry.missed:hover {
  background: #fee2e2;
}

.entry-icon {
  position: relative;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.video-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 0.875rem;
  background: white;
  border-radius: 50%;
}

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-details {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #666;
}

.entry-uri {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-status {
  text-align: right;
  flex-shrink: 0;
}

.entry-duration {
  font-family: monospace;
  font-weight: 500;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.entry-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.entry-badge.answered {
  background: #d1fae5;
  color: #065f46;
}

.entry-actions {
  flex-shrink: 0;
}

.btn-icon {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #ef4444;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
}

.page-info {
  font-size: 0.875rem;
  color: #666;
}

.code-example {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.code-example h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.code-example pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0;
}

.code-example code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .controls-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-controls {
    flex-direction: column;
  }

  .search-box {
    min-width: 100%;
  }

  .action-buttons {
    justify-content: stretch;
  }

  .action-buttons .btn {
    flex: 1;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .entry-details {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
