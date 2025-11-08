# Call History Guide

This guide covers the call history management features in VueSip, including tracking call history, filtering and searching, export functionality, and persistence mechanisms.

## Overview

**What is Call History?**
Call history is a complete log of all incoming and outgoing calls made through your VueSip application. Think of it like your phone's call log, but with more powerful search, filtering, and analysis capabilities. Every call you make or receive is automatically recorded with detailed information such as who you called, when, how long the call lasted, and whether it was answered.

**Why is Call History Important?**
Call history helps you track communication patterns, identify missed calls, analyze call statistics, and maintain records for business or personal use. It's automatically persisted to your browser's storage, so your records are preserved even after closing the browser.

VueSip provides comprehensive call history management through the `useCallHistory` composable. All call history is automatically tracked and persisted to IndexedDB (a browser database) for long-term storage, ensuring your call records are preserved across browser sessions.

**Key Features:**
- **Automatic Tracking** - All calls are automatically logged to history without any manual effort
- **Filtering & Search** - Powerful filtering by direction, date range, tags, and more
- **Export** - Export history to JSON or CSV formats for analysis in other tools
- **Persistence** - Automatic persistence to IndexedDB (survives browser restarts)
- **Statistics** - Generate call statistics and identify frequent contacts
- **Pagination** - Built-in pagination support for efficiently handling large datasets

## Table of Contents

- [Basic Usage](#basic-usage)
- [Tracking Call History](#tracking-call-history)
- [Filtering History](#filtering-history)
- [Searching History](#searching-history)
- [Export Functionality](#export-functionality)
- [Statistics and Analytics](#statistics-and-analytics)
- [Persistence](#persistence)
- [Managing History](#managing-history)
- [Best Practices](#best-practices)

---

## Basic Usage

**What You'll Learn:**
This section shows you how to get started with call history in your Vue component, including how to initialize the composable and display a basic list of calls.

### Initializing useCallHistory

The `useCallHistory` composable is your main interface for working with call history. It provides reactive properties (that automatically update your UI) and methods (functions you can call) for managing history.

**What is a Composable?**
A composable is a reusable function in Vue 3 that provides reactive state and logic. Think of it as a bundle of related functionality you can easily add to any component.

```typescript
import { useCallHistory } from 'vuesip/composables'

const {
  // Reactive State (automatically updates your UI when data changes)
  history,              // Array of all call history entries
  filteredHistory,      // Array of filtered entries (based on current filter)
  totalCalls,           // Total number of calls in history
  missedCallsCount,     // Number of missed calls
  currentFilter,        // Currently applied filter

  // Methods (functions you can call)
  getHistory,           // Get history with optional filters
  searchHistory,        // Search history by name or URI
  clearHistory,         // Delete all history entries
  deleteEntry,          // Delete a single entry
  exportHistory,        // Export to JSON or CSV
  getStatistics,        // Get call statistics
  setFilter,            // Set reactive filter
  getMissedCalls,       // Get only missed calls
  getRecentCalls        // Get most recent calls
} = useCallHistory()
```

💡 **Tip:** You don't need to use all of these at once. Import only what you need for your component.

### Displaying Call History

Here's a complete example showing how to display your call history with key information:

```vue
<template>
  <div class="call-history">
    <!-- Header with total count -->
    <h2>Call History ({{ totalCalls }} calls)</h2>

    <!-- Missed calls notification badge -->
    <div class="missed-calls-badge" v-if="missedCallsCount > 0">
      {{ missedCallsCount }} missed calls
    </div>

    <!-- Loop through each history entry -->
    <div
      v-for="entry in history"
      :key="entry.id"
      class="history-entry"
    >
      <!-- Display call information -->
      <div class="entry-info">
        <!-- incoming or outgoing -->
        <span class="direction">{{ entry.direction }}</span>

        <!-- Display name if available, otherwise show URI -->
        <span class="remote">{{ entry.remoteDisplayName || entry.remoteUri }}</span>

        <!-- When the call started -->
        <span class="time">{{ formatTime(entry.startTime) }}</span>

        <!-- How long the call lasted -->
        <span class="duration">{{ formatDuration(entry.duration) }}</span>
      </div>

      <!-- Status badges -->
      <div class="entry-status">
        <span v-if="entry.wasMissed" class="badge missed">Missed</span>
        <span v-if="entry.hasVideo" class="badge video">Video</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCallHistory } from 'vuesip/composables'

// Get reactive call history data
const {
  history,           // List of all calls
  totalCalls,        // Total count
  missedCallsCount   // Missed calls count
} = useCallHistory()

// Format date/time for display
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',  // "Jan", "Feb", etc.
    day: 'numeric',  // 1, 2, 3, etc.
    hour: '2-digit', // 01, 02, etc.
    minute: '2-digit'
  }).format(date)
}

// Format duration as MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`  // e.g., "5:03"
}
</script>
```

📝 **Note:** The `history` array is reactive, meaning your UI automatically updates when new calls are added or entries are deleted.

---

## Tracking Call History

**What You'll Learn:**
How VueSip automatically tracks calls, what information is stored in each entry, and how to access specific types of calls (recent, missed, etc.).

### Automatic Call Tracking

**How It Works:**
VueSip automatically tracks all calls when they end. You don't need to manually log calls - it happens automatically in the background. Each call creates a detailed `CallHistoryEntry` with comprehensive information about what happened during the call.

**Why Automatic Tracking?**
This ensures you never miss recording a call and don't need to write any tracking code yourself. VueSip handles all the complexity of capturing call information.

Each `CallHistoryEntry` contains:

```typescript
interface CallHistoryEntry {
  id: string                      // Unique entry ID (for identification)
  direction: CallDirection        // 'incoming' or 'outgoing'
  remoteUri: string              // Remote party's SIP URI (e.g., "alice@example.com")
  remoteDisplayName?: string     // Display name if available (e.g., "Alice Smith")
  localUri: string               // Your SIP URI
  startTime: Date                // When call started (when ringing began)
  answerTime?: Date              // When call was answered (undefined if unanswered)
  endTime: Date                  // When call ended
  duration: number               // Call duration in seconds (talk time)
  ringDuration?: number          // Ring duration in seconds (before answer)
  finalState: CallState          // Final call state (e.g., "terminated")
  terminationCause: string       // Why call ended (e.g., "Normal", "Busy", "Rejected")
  wasAnswered: boolean           // Whether call was answered
  wasMissed: boolean            // Whether call was missed (incoming but not answered)
  hasVideo: boolean             // Whether call had video enabled
  tags?: readonly string[]      // Custom tags you can add
  metadata?: Record<string, any> // Custom metadata you can add
}
```

📝 **Note:** All date/time fields are JavaScript `Date` objects, making them easy to format and compare.

### Accessing Call History

Here's how to react to new calls being added to history:

```typescript
import { watch } from 'vue'
import { useCallHistory } from 'vuesip/composables'

const { history, totalCalls } = useCallHistory()

// Watch for new calls added to history
// This runs every time the history array changes
watch(history, (newHistory, oldHistory) => {
  // Check if a new call was added
  if (newHistory.length > oldHistory.length) {
    const latestCall = newHistory[0] // History is sorted most recent first
    console.log('New call logged:', latestCall)

    // Handle missed calls with a notification
    if (latestCall.wasMissed) {
      showMissedCallNotification(latestCall)
    }
  }
})
```

💡 **Tip:** Use Vue's `watch` function to react to history changes in real-time, perfect for notifications or updating statistics.

### Getting Recent Calls

Need to show just the last few calls? Use `getRecentCalls()`:

```typescript
const { getRecentCalls } = useCallHistory()

// Get last 10 calls (default)
const recent = getRecentCalls()

// Get last 5 calls only
const lastFive = getRecentCalls(5)

// Display in UI
recent.forEach(call => {
  console.log(`${call.remoteDisplayName}: ${call.duration}s`)
})
```

💡 **Tip:** This is more efficient than getting all history when you only need recent calls.

### Getting Missed Calls Only

Quickly access only missed calls to help users see what they've missed:

```typescript
const { getMissedCalls, missedCallsCount } = useCallHistory()

// Get all missed calls (incoming calls that weren't answered)
const missed = getMissedCalls()

console.log(`You have ${missedCallsCount.value} missed calls`)

// List each missed call
missed.forEach(call => {
  console.log(`Missed call from ${call.remoteDisplayName || call.remoteUri}`)
  console.log(`  Time: ${call.startTime}`)
})
```

✅ **Best Practice:** Display missed call counts prominently in your UI so users don't miss important calls.

---

## Filtering History

**What You'll Learn:**
How to filter call history by various criteria (direction, date, status, etc.) to find exactly the calls you're looking for.

**Why Use Filters?**
As your call history grows, you'll need ways to narrow down results. Filters let you view only specific types of calls (like incoming calls from last week, or missed video calls). This makes it easy to analyze call patterns and find specific calls quickly.

### Using Filters

The `getHistory()` method accepts a comprehensive filter object. You can combine multiple filter criteria to get very specific results:

```typescript
import { useCallHistory } from 'vuesip/composables'
import { CallDirection } from 'vuesip'

const { getHistory } = useCallHistory()

// Filter by direction (incoming or outgoing)
const incoming = getHistory({
  direction: CallDirection.Incoming
})

// Filter by answered/unanswered status
const unanswered = getHistory({
  wasAnswered: false  // Calls that weren't answered
})

// Filter missed calls (incoming calls that weren't answered)
const missed = getHistory({
  wasMissed: true
})

// Filter video calls only
const videoCalls = getHistory({
  hasVideo: true
})
```

💡 **Tip:** Each filter returns a new result set without modifying the original history.

### Date Range Filtering

Filter calls by when they occurred - perfect for viewing daily, weekly, or monthly call logs:

```typescript
// Get calls from the last 7 days
const lastWeek = new Date()
lastWeek.setDate(lastWeek.getDate() - 7)  // Subtract 7 days from today

const recentCalls = getHistory({
  dateFrom: lastWeek,     // Start of range
  dateTo: new Date()      // End of range (now)
})

// Get calls from specific month (January 2024)
const januaryCalls = getHistory({
  dateFrom: new Date('2024-01-01'),  // January 1st
  dateTo: new Date('2024-01-31')     // January 31st
})
```

📝 **Note:** Both `dateFrom` and `dateTo` are inclusive, meaning calls exactly at those times are included.

### Filtering by Remote URI

Find all calls with a specific person or contact:

```typescript
// Get all calls with a specific contact (exact match)
const contactCalls = getHistory({
  remoteUri: 'alice@example.com'
})

// Partial match also works - finds any URI containing "alice"
const aliceCalls = getHistory({
  remoteUri: 'alice'  // Matches alice@example.com, alice@test.com, etc.
})
```

💡 **Tip:** Use partial matches to find all calls from a domain (e.g., `remoteUri: '@company.com'`).

### Tag-Based Filtering

If you've added custom tags to your call entries, you can filter by them:

```typescript
// Filter by single tag
const importantCalls = getHistory({
  tags: ['important']
})

// Filter by multiple tags (matches calls with ANY of these tags)
const workCalls = getHistory({
  tags: ['work', 'business']
})
```

📝 **Note:** Tags must be added manually to call entries using custom metadata. This is useful for categorizing calls in your application.

### Combining Multiple Filters

The real power comes from combining filters to get very specific results:

```typescript
// Complex filter example:
// Find incoming video calls from October 2024 that were answered
const result = getHistory({
  direction: CallDirection.Incoming,  // Only incoming
  hasVideo: true,                     // Only video calls
  wasAnswered: true,                  // Only answered calls
  dateFrom: new Date('2024-10-01'),   // October start
  dateTo: new Date('2024-10-31')      // October end
})

console.log(`Found ${result.entries.length} calls matching all criteria`)
```

✅ **Best Practice:** Combining filters is more efficient than filtering the results multiple times in your own code.

### Reactive Filtering

For dynamic UIs where filters change based on user input, use reactive filtering:

```typescript
import { ref, watch } from 'vue'
import { useCallHistory } from 'vuesip/composables'

const { filteredHistory, setFilter, currentFilter } = useCallHistory()

// Set a filter - filteredHistory automatically updates
setFilter({
  direction: CallDirection.Incoming
})

// Watch filteredHistory to react to changes
watch(filteredHistory, (filtered) => {
  console.log(`Showing ${filtered.length} filtered calls`)
})

// Clear filter (show all calls again)
setFilter(null)
```

💡 **Tip:** Reactive filtering is perfect for UI controls like dropdowns or checkboxes that update the display in real-time.

### Sorting

Control how results are ordered:

```typescript
// Sort by start time (most recent first - this is the default)
const chronological = getHistory({
  sortBy: 'startTime',
  sortOrder: 'desc'  // Descending order (newest first)
})

// Sort by duration (longest calls first)
const byDuration = getHistory({
  sortBy: 'duration',
  sortOrder: 'desc'  // Longest first
})

// Sort by remote URI (alphabetically)
const alphabetical = getHistory({
  sortBy: 'remoteUri',
  sortOrder: 'asc'  // Ascending order (A to Z)
})
```

📝 **Note:** Default sorting is by `startTime` in descending order (most recent first).

### Pagination

**What is Pagination?**
Pagination loads data in "pages" or chunks instead of all at once. This improves performance and user experience when dealing with large datasets (hundreds or thousands of calls).

**Why Use Pagination?**
Loading thousands of calls at once can slow down your app. Pagination loads only what you need (like 10 or 20 calls at a time), making your app faster and more responsive.

```typescript
// Get first 10 calls (page 1)
const page1 = getHistory({
  limit: 10,   // Number of results to return
  offset: 0    // Skip 0 results (start at beginning)
})

// Get next 10 calls (page 2)
const page2 = getHistory({
  limit: 10,   // Number of results to return
  offset: 10   // Skip first 10 results
})

// Check if more results are available
if (page1.hasMore) {
  console.log(`Total: ${page1.totalCount}, showing ${page1.entries.length}`)
  // Can load more pages
}
```

💡 **Tip:** Use `hasMore` to show/hide "Load More" buttons in your UI.

### Complete Filter Example

Here's a full component demonstrating all filtering capabilities:

```vue
<template>
  <div class="history-filters">
    <!-- Direction Filter -->
    <select v-model="filters.direction">
      <option :value="undefined">All Directions</option>
      <option value="incoming">Incoming</option>
      <option value="outgoing">Outgoing</option>
    </select>

    <!-- Call Status Filter -->
    <select v-model="filters.wasAnswered">
      <option :value="undefined">All Calls</option>
      <option :value="true">Answered</option>
      <option :value="false">Unanswered</option>
    </select>

    <!-- Date Range Filters -->
    <input
      v-model="filters.dateFrom"
      type="date"
      placeholder="From"
    />
    <input
      v-model="filters.dateTo"
      type="date"
      placeholder="To"
    />

    <!-- Action Buttons -->
    <button @click="applyFilters">Apply</button>
    <button @click="clearFilters">Clear</button>

    <!-- Results Display -->
    <div class="results">
      <p>{{ result.totalCount }} calls found</p>

      <!-- Loop through filtered results -->
      <div v-for="entry in result.entries" :key="entry.id">
        {{ entry.remoteDisplayName }}: {{ entry.duration }}s
      </div>

      <!-- Pagination: Show "Load More" if more results exist -->
      <div class="pagination" v-if="result.hasMore">
        <button @click="loadMore">Load More</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useCallHistory } from 'vuesip/composables'
import type { HistoryFilter } from 'vuesip'

const { getHistory } = useCallHistory()

// Reactive filter object that binds to UI controls
const filters = reactive<HistoryFilter>({
  direction: undefined,
  wasAnswered: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  limit: 20,    // Show 20 results per page
  offset: 0     // Start at beginning
})

// Store current results
const result = ref(getHistory(filters))

// Apply current filters
function applyFilters() {
  filters.offset = 0  // Reset to first page
  result.value = getHistory(filters)
}

// Clear all filters and show all calls
function clearFilters() {
  filters.direction = undefined
  filters.wasAnswered = undefined
  filters.dateFrom = undefined
  filters.dateTo = undefined
  filters.offset = 0
  result.value = getHistory()
}

// Load next page of results
function loadMore() {
  // Advance offset by limit (move to next page)
  filters.offset = (filters.offset || 0) + (filters.limit || 20)

  // Get next page
  const nextPage = getHistory(filters)

  // Append to existing results
  result.value.entries.push(...nextPage.entries)
  result.value.hasMore = nextPage.hasMore
}
</script>
```

✅ **Best Practice:** Always provide clear filter controls and show how many results were found.

---

## Searching History

**What You'll Learn:**
How to search through call history by name or phone number, and how to combine search with filters for precise results.

**What is Search?**
Search is different from filtering. While filters let you narrow by specific criteria (like "incoming calls"), search lets you find calls by typing part of a name or number. It's like using the search box in your phone's call log.

**Why Use Search?**
Search is the fastest way to find calls with a specific person when you remember their name or number but not the exact date or other details.

### Basic Search

The `searchHistory()` method searches through remote URIs (phone numbers/addresses) and display names:

```typescript
import { useCallHistory } from 'vuesip/composables'

const { searchHistory } = useCallHistory()

// Search by name or URI (looks in both fields)
const results = searchHistory('alice')

console.log(`Found ${results.totalCount} matches`)
results.entries.forEach(entry => {
  console.log(entry.remoteDisplayName || entry.remoteUri)
})
```

💡 **Tip:** Search looks in both `remoteUri` and `remoteDisplayName` fields, so you can search by name or number.

### Search is Case-Insensitive

**What This Means:**
You can type in any combination of uppercase/lowercase letters and still find matches. Searching for "alice", "ALICE", or "Alice" all return the same results.

```typescript
// All of these will match "Alice Smith"
searchHistory('alice')   // ✓ Matches
searchHistory('ALICE')   // ✓ Matches
searchHistory('Alice')   // ✓ Matches
searchHistory('smith')   // ✓ Matches (searches last name too)
```

### Search with Filters

**Why Combine Search and Filters?**
Sometimes you want to find calls from a specific person but only incoming calls, or only from last month. Combining search with filters gives you laser-focused results.

Combine search with filters for precise results:

```typescript
// Search for "alice" in incoming calls only
const incomingFromAlice = searchHistory('alice', {
  direction: CallDirection.Incoming
})

// Search for "bob" in answered video calls only
const bobVideoCalls = searchHistory('bob', {
  wasAnswered: true,
  hasVideo: true
})

// Search within specific date range
const recentAliceCalls = searchHistory('alice', {
  dateFrom: new Date('2024-10-01'),
  dateTo: new Date('2024-10-31')
})
```

✅ **Best Practice:** Use filters with search to help users find exactly what they're looking for.

### Search with Pagination

For large result sets, use pagination with search:

```typescript
// Search with pagination (first page)
const searchResults = searchHistory('john', {
  limit: 10,   // Show 10 results
  offset: 0    // Start at beginning
})

// Load next page if more results exist
if (searchResults.hasMore) {
  const nextPage = searchHistory('john', {
    limit: 10,
    offset: 10  // Skip first 10, show next 10
  })
}
```

### Real-time Search Component

Here's a complete component with debounced search (prevents searching on every keystroke):

```vue
<template>
  <div class="call-search">
    <!-- Search Input -->
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search calls..."
      @input="onSearchInput"
    />

    <!-- Search Results -->
    <div class="search-results">
      <!-- Loading State -->
      <p v-if="isSearching">Searching...</p>

      <!-- Results Found -->
      <div v-else-if="searchResults.totalCount > 0">
        <p>{{ searchResults.totalCount }} results found</p>

        <!-- Loop through results -->
        <div
          v-for="entry in searchResults.entries"
          :key="entry.id"
          class="result-item"
        >
          <div class="result-name">
            {{ entry.remoteDisplayName || entry.remoteUri }}
          </div>
          <div class="result-details">
            <span>{{ entry.direction }}</span>
            <span>{{ formatDate(entry.startTime) }}</span>
            <span>{{ entry.duration }}s</span>
          </div>
        </div>
      </div>

      <!-- No Results -->
      <p v-else-if="searchQuery">No results found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCallHistory } from 'vuesip/composables'
import type { HistorySearchResult } from 'vuesip'

const { searchHistory } = useCallHistory()

const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<HistorySearchResult>({
  entries: [],
  totalCount: 0,
  hasMore: false
})

// Debounced search (waits for user to stop typing)
let searchTimeout: number | undefined

function onSearchInput() {
  isSearching.value = true

  // Cancel previous timeout if user is still typing
  clearTimeout(searchTimeout)

  // Wait 300ms after user stops typing before searching
  searchTimeout = setTimeout(() => {
    if (searchQuery.value.trim()) {
      // Perform search
      searchResults.value = searchHistory(searchQuery.value, {
        limit: 50,
        sortBy: 'startTime',
        sortOrder: 'desc'
      })
    } else {
      // Clear results if search box is empty
      searchResults.value = {
        entries: [],
        totalCount: 0,
        hasMore: false
      }
    }
    isSearching.value = false
  }, 300) // 300ms debounce delay
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
</script>
```

💡 **Tip:** The 300ms debounce delay means we wait until the user stops typing for 300ms before searching. This prevents searching after every single keystroke, which would be slow and inefficient.

✅ **Best Practice:** Always debounce search input to avoid excessive search operations that can slow down your app.

---

## Export Functionality

**What You'll Learn:**
How to export your call history to files (JSON or CSV) that can be opened in other applications like Excel, used for backups, or shared with others.

**Why Export?**
Exporting lets you:
- Create backups of your call history
- Analyze calls in spreadsheet applications (Excel, Google Sheets)
- Share call records with others
- Import into other systems
- Keep long-term records outside the browser

### Export to JSON

**What is JSON?**
JSON (JavaScript Object Notation) is a text format that preserves all your call data exactly as it is, including complex fields. It's perfect for importing into other applications or creating complete backups.

Export call history to JSON format:

```typescript
import { useCallHistory } from 'vuesip/composables'

const { exportHistory } = useCallHistory()

// Export all history to JSON file
try {
  await exportHistory({
    format: 'json',
    filename: 'call-history'  // Will be saved as "call-history.json"
  })
  console.log('History exported successfully')
} catch (error) {
  console.error('Export failed:', error)
}
```

✅ **Best Practice:** Always wrap export operations in try/catch blocks to handle errors gracefully.

### Export to CSV

**What is CSV?**
CSV (Comma-Separated Values) is a spreadsheet format that can be opened in Excel, Google Sheets, or any spreadsheet application. It's perfect for data analysis and viewing in familiar tools.

Export call history to CSV format for spreadsheet applications:

```typescript
// Export to CSV
await exportHistory({
  format: 'csv',
  filename: 'my-calls'  // Will be saved as "my-calls.csv"
})

// The exported CSV file will include these columns:
// - ID
// - Direction (incoming/outgoing)
// - Remote URI (who you called/who called you)
// - Remote Display Name
// - Local URI (your address)
// - Start Time
// - Answer Time
// - End Time
// - Duration (seconds)
// - Ring Duration (seconds)
// - Final State
// - Termination Cause
// - Was Answered (true/false)
// - Was Missed (true/false)
// - Has Video (true/false)
// - Tags
```

💡 **Tip:** CSV format is best for analyzing call patterns in spreadsheet applications.

### Export with Filters

**Why Filter Before Exporting?**
You often don't need to export ALL calls. Maybe you only need last month's calls, or only incoming calls. Filters let you export exactly what you need, creating smaller, more focused files.

Export only specific calls using filters:

```typescript
// Export only incoming calls
await exportHistory({
  format: 'csv',
  filename: 'incoming-calls',
  filter: {
    direction: CallDirection.Incoming
  }
})

// Export missed calls from last month
await exportHistory({
  format: 'json',
  filename: 'missed-calls-october',
  filter: {
    wasMissed: true,
    dateFrom: new Date('2024-10-01'),
    dateTo: new Date('2024-10-31')
  }
})

// Export all calls with a specific contact
await exportHistory({
  format: 'csv',
  filename: 'alice-calls',
  filter: {
    remoteUri: 'alice@example.com'
  }
})
```

✅ **Best Practice:** Use descriptive filenames that indicate what the export contains (e.g., "incoming-calls-october-2024.csv").

### Include Metadata

If you've added custom metadata to your calls, include it in exports:

```typescript
await exportHistory({
  format: 'csv',
  filename: 'detailed-history',
  includeMetadata: true  // Includes any custom data you've added to calls
})
```

📝 **Note:** Metadata is only included if you've manually added custom data to call entries in your application.

### Export Component

Here's a complete export UI component with all options:

```vue
<template>
  <div class="export-controls">
    <h3>Export Call History</h3>

    <!-- Format Selection -->
    <div class="form-group">
      <label>Format:</label>
      <select v-model="exportFormat">
        <option value="json">JSON (complete data)</option>
        <option value="csv">CSV (spreadsheet)</option>
      </select>
    </div>

    <!-- Filter Selection -->
    <div class="form-group">
      <label>Export:</label>
      <select v-model="exportFilter">
        <option value="all">All Calls</option>
        <option value="incoming">Incoming Only</option>
        <option value="outgoing">Outgoing Only</option>
        <option value="missed">Missed Calls</option>
        <option value="video">Video Calls</option>
      </select>
    </div>

    <!-- Date Range (Optional) -->
    <div class="form-group">
      <label>Date Range (optional):</label>
      <input v-model="dateFrom" type="date" />
      <input v-model="dateTo" type="date" />
    </div>

    <!-- Include Metadata Checkbox -->
    <div class="form-group">
      <label>
        <input v-model="includeMetadata" type="checkbox" />
        Include metadata
      </label>
    </div>

    <!-- Export Button -->
    <button
      class="btn btn-primary"
      :disabled="isExporting"
      @click="handleExport"
    >
      {{ isExporting ? 'Exporting...' : 'Export' }}
    </button>

    <!-- Status Messages -->
    <div v-if="exportError" class="error">
      {{ exportError }}
    </div>
    <div v-if="exportSuccess" class="success">
      History exported successfully!
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCallHistory } from 'vuesip/composables'
import { CallDirection } from 'vuesip'
import type { HistoryExportFormat, HistoryFilter } from 'vuesip'

const { exportHistory } = useCallHistory()

// UI State
const exportFormat = ref<HistoryExportFormat>('csv')
const exportFilter = ref('all')
const dateFrom = ref('')
const dateTo = ref('')
const includeMetadata = ref(false)
const isExporting = ref(false)
const exportError = ref('')
const exportSuccess = ref(false)

async function handleExport() {
  isExporting.value = true
  exportError.value = ''
  exportSuccess.value = false

  try {
    // Build filter based on user selection
    const filter: HistoryFilter = {}

    switch (exportFilter.value) {
      case 'incoming':
        filter.direction = CallDirection.Incoming
        break
      case 'outgoing':
        filter.direction = CallDirection.Outgoing
        break
      case 'missed':
        filter.wasMissed = true
        break
      case 'video':
        filter.hasVideo = true
        break
    }

    // Add date range if specified
    if (dateFrom.value) {
      filter.dateFrom = new Date(dateFrom.value)
    }
    if (dateTo.value) {
      filter.dateTo = new Date(dateTo.value)
    }

    // Perform export
    await exportHistory({
      format: exportFormat.value,
      filename: `call-history-${Date.now()}`,  // Unique filename with timestamp
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      includeMetadata: includeMetadata.value
    })

    exportSuccess.value = true

    // Clear success message after 3 seconds
    setTimeout(() => {
      exportSuccess.value = false
    }, 3000)

  } catch (error) {
    exportError.value = error instanceof Error
      ? error.message
      : 'Export failed'
  } finally {
    isExporting.value = false
  }
}
</script>
```

💡 **Tip:** Show clear status messages during export so users know what's happening. Long exports can take a few seconds.

⚠️ **Warning:** Large exports (thousands of calls) may take several seconds. Always provide feedback to users during the process.

---

## Statistics and Analytics

**What You'll Learn:**
How to generate insights from your call history, including totals, averages, and identifying your most frequent contacts.

**Why Use Statistics?**
Statistics help you understand call patterns:
- How many calls did you make this month?
- What's your average call duration?
- Who do you call most often?
- What percentage of calls are answered?

These insights are valuable for both personal use and business analytics.

### Getting Call Statistics

Generate comprehensive statistics about your call history:

```typescript
import { useCallHistory } from 'vuesip/composables'

const { getStatistics } = useCallHistory()

// Get statistics for all calls
const stats = getStatistics()

// Access various statistics
console.log(`Total calls: ${stats.totalCalls}`)
console.log(`Incoming: ${stats.incomingCalls}`)
console.log(`Outgoing: ${stats.outgoingCalls}`)
console.log(`Answered: ${stats.answeredCalls}`)
console.log(`Missed: ${stats.missedCalls}`)
console.log(`Video calls: ${stats.videoCalls}`)
console.log(`Total duration: ${stats.totalDuration}s`)
console.log(`Average duration: ${stats.averageDuration.toFixed(1)}s`)
```

📝 **Note:** Duration is always in seconds. Convert to minutes by dividing by 60.

### Frequent Contacts

**What This Shows:**
A ranked list of people you call or talk to most often, sorted by number of calls.

Identify your most frequent contacts:

```typescript
const stats = getStatistics()

console.log('Top 10 frequent contacts:')
stats.frequentContacts.forEach((contact, index) => {
  console.log(`${index + 1}. ${contact.displayName || contact.uri}: ${contact.count} calls`)
})

// Example output:
// 1. Alice Smith: 45 calls
// 2. Bob Jones: 32 calls
// 3. Charlie Brown: 28 calls
```

💡 **Tip:** Use frequent contacts to create speed dial lists or suggest contacts in your UI.

### Statistics with Filters

**Why Filter Statistics?**
You can get statistics for specific time periods or call types. For example, "How many incoming calls did I get last month?" or "What's my average video call duration?"

Get statistics for specific time periods or call types:

```typescript
// Statistics for last month only
const lastMonth = getStatistics({
  dateFrom: new Date('2024-10-01'),
  dateTo: new Date('2024-10-31')
})

// Statistics for incoming calls only
const incomingStats = getStatistics({
  direction: CallDirection.Incoming
})

// Statistics for answered video calls only
const videoStats = getStatistics({
  hasVideo: true,
  wasAnswered: true
})
```

✅ **Best Practice:** Use date range filters to show time-based comparisons (this week vs last week, this month vs last month).

### Statistics Dashboard Component

Here's a complete statistics dashboard with interactive time period selection:

```vue
<template>
  <div class="call-statistics">
    <h2>Call Statistics</h2>

    <!-- Time Period Selector -->
    <select v-model="timePeriod" @change="updateStats">
      <option value="all">All Time</option>
      <option value="today">Today</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="year">This Year</option>
    </select>

    <!-- Overview Cards (Grid of Statistics) -->
    <div class="stats-grid">
      <!-- Total Calls -->
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalCalls }}</div>
        <div class="stat-label">Total Calls</div>
      </div>

      <!-- Incoming Calls -->
      <div class="stat-card">
        <div class="stat-value">{{ stats.incomingCalls }}</div>
        <div class="stat-label">Incoming</div>
      </div>

      <!-- Outgoing Calls -->
      <div class="stat-card">
        <div class="stat-value">{{ stats.outgoingCalls }}</div>
        <div class="stat-label">Outgoing</div>
      </div>

      <!-- Missed Calls -->
      <div class="stat-card">
        <div class="stat-value">{{ stats.missedCalls }}</div>
        <div class="stat-label">Missed</div>
      </div>

      <!-- Video Calls -->
      <div class="stat-card">
        <div class="stat-value">{{ stats.videoCalls }}</div>
        <div class="stat-label">Video Calls</div>
      </div>

      <!-- Total Talk Time -->
      <div class="stat-card">
        <div class="stat-value">{{ formatDuration(stats.totalDuration) }}</div>
        <div class="stat-label">Total Duration</div>
      </div>

      <!-- Average Call Length -->
      <div class="stat-card">
        <div class="stat-value">{{ formatDuration(Math.round(stats.averageDuration)) }}</div>
        <div class="stat-label">Avg Duration</div>
      </div>

      <!-- Answer Rate Percentage -->
      <div class="stat-card">
        <div class="stat-value">{{ answerRate }}%</div>
        <div class="stat-label">Answer Rate</div>
      </div>
    </div>

    <!-- Frequent Contacts List -->
    <div class="frequent-contacts">
      <h3>Frequent Contacts</h3>
      <div
        v-for="(contact, index) in stats.frequentContacts"
        :key="contact.uri"
        class="contact-item"
      >
        <span class="rank">{{ index + 1 }}</span>
        <span class="name">{{ contact.displayName || contact.uri }}</span>
        <span class="count">{{ contact.count }} calls</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCallHistory } from 'vuesip/composables'
import type { HistoryFilter } from 'vuesip'

const { getStatistics } = useCallHistory()

const timePeriod = ref('all')
const stats = ref(getStatistics())

// Calculate answer rate as a percentage
const answerRate = computed(() => {
  if (stats.value.totalCalls === 0) return 0
  return Math.round((stats.value.answeredCalls / stats.value.totalCalls) * 100)
})

// Update statistics when time period changes
function updateStats() {
  const filter: HistoryFilter = {}
  const now = new Date()

  switch (timePeriod.value) {
    case 'today':
      // Set to start of today (midnight)
      filter.dateFrom = new Date(now.setHours(0, 0, 0, 0))
      break

    case 'week':
      // Set to start of this week (Sunday)
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      filter.dateFrom = weekStart
      break

    case 'month':
      // Set to first day of current month
      filter.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      break

    case 'year':
      // Set to first day of current year
      filter.dateFrom = new Date(now.getFullYear(), 0, 1)
      break
  }

  // Get statistics with the selected filter
  stats.value = getStatistics(
    Object.keys(filter).length > 0 ? filter : undefined
  )
}

// Format duration in human-readable format
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}
</script>
```

💡 **Tip:** Use visual cards or charts to make statistics more engaging and easier to understand at a glance.

✅ **Best Practice:** Provide time period filters so users can see "today", "this week", "this month" statistics easily.

---

## Persistence

**What You'll Learn:**
How VueSip automatically saves your call history to browser storage and how to configure this behavior.

**What is Persistence?**
Persistence means your call history is saved to your browser's storage (IndexedDB) and loaded automatically when you open your app. Without persistence, your call history would disappear every time you close the browser.

**Why IndexedDB?**
IndexedDB is a browser database that can store large amounts of data (much more than cookies or localStorage). It's perfect for call history because you might accumulate thousands of calls over time.

### Automatic Persistence

Call history is automatically persisted to IndexedDB, ensuring your data is preserved across browser sessions.

#### How it Works

Here's the automatic flow:

**Step 1: Call Ends**
When a call ends, VueSip automatically creates a complete history entry with all call details.

**Step 2: Save to IndexedDB**
The entry is saved to IndexedDB (a browser database that persists even after closing the browser).

**Step 3: Auto-Load on Startup**
When your application starts, all history is automatically loaded from IndexedDB back into memory.

**Step 4: Continuous Sync**
Changes are debounced (batched and delayed by 300ms by default) to optimize performance and avoid saving after every tiny change.

💡 **Tip:** Debouncing means if multiple changes happen quickly, we wait and save them all at once instead of saving repeatedly.

### Initializing Persistence

Persistence is initialized when you set up VueSip:

```typescript
import { createApp } from 'vue'
import { initializeStorePersistence } from 'vuesip'

const app = createApp(App)

// Initialize persistence with default settings
await initializeStorePersistence({
  enabled: true,        // Enable persistence (set to false to disable)
  autoLoad: true,       // Automatically load history on startup
  debounce: 300        // Wait 300ms after changes before saving
})

app.mount('#app')
```

📝 **Note:** This should be done once during app initialization, before mounting your Vue app.

### Custom Storage Configuration

Configure storage with custom settings for your application:

```typescript
import { initializeStorePersistence } from 'vuesip'

await initializeStorePersistence({
  storage: {
    prefix: 'myapp',      // Add prefix to storage keys (useful for multiple apps)
    version: '1'          // Storage version (for future migrations)
  },
  enabled: true,
  autoLoad: true,
  debounce: 500          // Use 500ms debounce (slower devices might benefit)
})
```

💡 **Tip:** Use a custom prefix if you have multiple apps on the same domain to avoid storage conflicts.

### Manual Save and Load

You can manually save or load history (useful for backup/restore features):

```typescript
import { saveAllStores, loadAllStores } from 'vuesip'

// Manually save all stores (including history) to IndexedDB
await saveAllStores()
console.log('All data saved')

// Manually load all stores from IndexedDB
await loadAllStores()
console.log('All data loaded')
```

⚠️ **Warning:** Manual load will overwrite current in-memory data. Use with caution.

### Storage Quota Management

**What is Storage Quota?**
Browsers limit how much storage each website can use (usually several hundred megabytes). As your call history grows, you might eventually run low on space.

**Why Monitor Quota?**
Monitoring helps you proactively manage space and avoid errors when storage fills up.

Monitor and manage IndexedDB storage quota:

```typescript
import { getStorageQuota, checkStorageWarning } from 'vuesip'

// Get detailed storage quota information
const quota = await getStorageQuota()
console.log(`Using ${quota.usage} of ${quota.quota} bytes`)
console.log(`${quota.percentUsed}% used`)

// Check if storage is running low (80% threshold)
const isLow = await checkStorageWarning(80)
if (isLow) {
  console.warn('Storage quota running low!')
  // Consider clearing old history or warning user
}
```

💡 **Tip:** Check storage quota periodically (like once per day) to avoid surprises.

### Clearing Old History

**Why Clear Old History?**
Over time, old call records become less useful. Clearing the oldest entries frees up storage space and keeps your app running smoothly.

Automatically clear old history entries to free up space:

```typescript
import { clearOldCallHistory } from 'vuesip'

// Clear oldest 20% of call history
const removedCount = await clearOldCallHistory(20)
console.log(`Removed ${removedCount} old history entries`)

// More aggressive: Clear oldest 50%
await clearOldCallHistory(50)
```

✅ **Best Practice:** Run storage cleanup automatically when quota reaches 80-90% to prevent storage errors.

### Storage Management Component

Here's a complete UI for managing storage:

```vue
<template>
  <div class="storage-management">
    <h3>Storage Management</h3>

    <!-- Storage Info Display -->
    <div v-if="storageInfo" class="storage-info">
      <!-- Visual Progress Bar -->
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: storageInfo.percentUsed + '%' }"
          :class="{ warning: storageInfo.percentUsed > 80 }"
        ></div>
      </div>

      <!-- Storage Usage Text -->
      <p>
        Using {{ formatBytes(storageInfo.usage) }} of
        {{ formatBytes(storageInfo.quota) }}
        ({{ storageInfo.percentUsed.toFixed(1) }}%)
      </p>

      <!-- Warning Message when storage is low -->
      <div v-if="storageInfo.percentUsed > 80" class="warning-message">
        ⚠️ Storage quota running low! Consider clearing old history.
      </div>
    </div>

    <!-- History Info -->
    <div class="history-info">
      <p>Total calls in history: {{ totalCalls }}</p>
    </div>

    <!-- Management Actions -->
    <div class="actions">
      <!-- Clear 20% oldest entries -->
      <button
        class="btn"
        :disabled="isClearing"
        @click="clearOldEntries(20)"
      >
        Clear 20% Oldest
      </button>

      <!-- Clear 50% oldest entries -->
      <button
        class="btn"
        :disabled="isClearing"
        @click="clearOldEntries(50)"
      >
        Clear 50% Oldest
      </button>

      <!-- Clear all history (dangerous) -->
      <button
        class="btn btn-danger"
        :disabled="isClearing"
        @click="clearAllHistory"
      >
        Clear All History
      </button>
    </div>

    <!-- Status Message -->
    <div v-if="clearMessage" class="message">
      {{ clearMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  useCallHistory,
  getStorageQuota,
  clearOldCallHistory
} from 'vuesip'

const { totalCalls, clearHistory } = useCallHistory()

const storageInfo = ref<any>(null)
const isClearing = ref(false)
const clearMessage = ref('')

// Load storage info when component mounts
onMounted(async () => {
  await loadStorageInfo()
})

// Fetch current storage quota information
async function loadStorageInfo() {
  try {
    storageInfo.value = await getStorageQuota()
  } catch (error) {
    console.error('Failed to get storage info:', error)
  }
}

// Clear oldest entries by percentage
async function clearOldEntries(percentage: number) {
  isClearing.value = true
  clearMessage.value = ''

  try {
    const removed = await clearOldCallHistory(percentage)
    clearMessage.value = `✅ Cleared ${removed} old entries`

    // Refresh storage info to show new usage
    await loadStorageInfo()

  } catch (error) {
    clearMessage.value = '❌ Failed to clear history'
  } finally {
    isClearing.value = false
  }
}

// Clear all history (with confirmation)
async function clearAllHistory() {
  if (!confirm('Are you sure you want to clear all call history? This cannot be undone.')) {
    return
  }

  isClearing.value = true
  clearMessage.value = ''

  try {
    await clearHistory()
    clearMessage.value = '✅ All history cleared'

    // Refresh storage info
    await loadStorageInfo()

  } catch (error) {
    clearMessage.value = '❌ Failed to clear history'
  } finally {
    isClearing.value = false
  }
}

// Format bytes to human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
</script>
```

⚠️ **Warning:** Clearing history is permanent and cannot be undone. Always confirm destructive operations with users.

💡 **Tip:** Show storage usage visually with a progress bar so users can see at a glance how much space is used.

---

## Managing History

**What You'll Learn:**
How to delete individual call entries and clear all history. These operations are permanent, so we'll cover best practices for user confirmation.

**Why Manage History?**
Users may want to:
- Delete specific calls for privacy reasons
- Remove accidental or test calls
- Clear all history to start fresh
- Free up storage space

### Deleting Individual Entries

Remove specific history entries by ID:

```typescript
import { useCallHistory } from 'vuesip/composables'

const { deleteEntry } = useCallHistory()

// Delete by entry ID
try {
  await deleteEntry('call-123')  // Use the entry's unique ID
  console.log('Entry deleted successfully')
} catch (error) {
  console.error('Failed to delete entry:', error)
}
```

⚠️ **Warning:** Deletion is permanent and cannot be undone. Always confirm with users before deleting.

📝 **Note:** The entry ID is available in each `CallHistoryEntry` object as the `id` property.

### Clearing All History

Remove all history entries at once:

```typescript
const { clearHistory } = useCallHistory()

// Clear all history
try {
  await clearHistory()
  console.log('All history cleared')
} catch (error) {
  console.error('Failed to clear history:', error)
}
```

⚠️ **Warning:** This deletes ALL call history permanently. Always confirm this action with users using a confirmation dialog.

### History Management Component

Here's a complete component for managing history with proper user confirmations:

```vue
<template>
  <div class="history-management">
    <!-- List all history entries -->
    <div
      v-for="entry in history"
      :key="entry.id"
      class="history-entry"
    >
      <!-- Display entry information -->
      <div class="entry-info">
        <span>{{ entry.remoteDisplayName || entry.remoteUri }}</span>
        <span>{{ formatDate(entry.startTime) }}</span>
      </div>

      <!-- Delete button for individual entry -->
      <button
        class="btn-delete"
        @click="handleDelete(entry.id)"
      >
        Delete
      </button>
    </div>

    <!-- Bulk actions -->
    <div class="actions">
      <button
        class="btn btn-danger"
        :disabled="totalCalls === 0"
        @click="handleClearAll"
      >
        Clear All History ({{ totalCalls }} calls)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCallHistory } from 'vuesip/composables'

const {
  history,
  totalCalls,
  deleteEntry,
  clearHistory
} = useCallHistory()

// Delete a single entry with confirmation
async function handleDelete(entryId: string) {
  // Confirm before deleting
  if (!confirm('Delete this call from history? This cannot be undone.')) {
    return
  }

  try {
    await deleteEntry(entryId)
    // Success - UI automatically updates due to reactivity
  } catch (error) {
    console.error('Failed to delete entry:', error)
    alert('Failed to delete entry. Please try again.')
  }
}

// Clear all history with confirmation
async function handleClearAll() {
  // Strong confirmation for destructive action
  if (!confirm(`Clear all ${totalCalls.value} calls from history? This cannot be undone.`)) {
    return
  }

  try {
    await clearHistory()
    // Success - UI automatically clears due to reactivity
  } catch (error) {
    console.error('Failed to clear history:', error)
    alert('Failed to clear history. Please try again.')
  }
}

// Format date for display
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
</script>
```

✅ **Best Practice:** Always use confirmation dialogs (with `confirm()` or custom modals) before deleting data. Be explicit about what will be deleted and that it's permanent.

💡 **Tip:** Show the number of items being deleted in confirmation messages (e.g., "Clear all 145 calls?") so users understand the scope.

---

## Best Practices

**What You'll Learn:**
Essential tips and patterns for working with call history effectively, efficiently, and safely.

**Why Follow Best Practices?**
These practices help you:
- Build faster, more responsive apps
- Avoid common performance problems
- Provide better user experience
- Write more maintainable code

### 1. Use Reactive State

**Why:** Vue's reactivity automatically updates your UI when data changes. You don't need to manually refresh the display.

Leverage Vue's reactivity for automatic UI updates:

```typescript
import { watch } from 'vue'
import { useCallHistory } from 'vuesip/composables'

const { history, totalCalls, missedCallsCount } = useCallHistory()

// UI automatically updates when history changes (no manual refresh needed)
watch(history, (newHistory) => {
  console.log(`History updated: ${newHistory.length} calls`)
})

// Show notification for new missed calls
watch(missedCallsCount, (newCount, oldCount) => {
  if (newCount > oldCount) {
    showNotification('New missed call')
  }
})
```

✅ **Best Practice:** Use reactive properties directly in templates. Don't copy data into local state unless you need to modify it.

### 2. Implement Pagination

**Why:** Loading thousands of entries at once can make your app slow and unresponsive. Pagination loads data in manageable chunks.

Always paginate large history lists:

```typescript
// ✅ Good: Paginated (fast and responsive)
const page1 = getHistory({
  limit: 50,
  offset: 0
})

// ❌ Bad: Loading everything at once (slow with thousands of entries)
const allCalls = getHistory() // Could be thousands of entries!
```

💡 **Tip:** Start with a reasonable page size (20-50 items) and provide "Load More" functionality.

### 3. Debounce Search Input

**Why:** Searching after every keystroke is wasteful and can slow down your app. Debouncing waits until the user stops typing.

**What is Debouncing?**
Debouncing delays an action until the user has stopped doing something for a set time (like 300ms). For search, this means we wait until they stop typing before searching.

Prevent excessive search operations:

```typescript
let searchTimeout: number | undefined

function onSearchInput(query: string) {
  // Cancel previous timeout if user is still typing
  clearTimeout(searchTimeout)

  // Wait until user stops typing for 300ms before searching
  searchTimeout = setTimeout(() => {
    const results = searchHistory(query)
    // Update UI with results
  }, 300) // 300ms debounce
}
```

✅ **Best Practice:** Use 200-500ms debounce for search. Shorter for fast computers, longer for slower devices.

### 4. Use Filters Efficiently

**Why:** Running multiple separate filter operations is slower than combining filters in one query.

Combine filters instead of filtering multiple times:

```typescript
// ✅ Good: Single filtered query (fast)
const result = getHistory({
  direction: CallDirection.Incoming,
  wasAnswered: true,
  dateFrom: lastWeek
})

// ❌ Bad: Multiple filter operations (slow)
const incoming = getHistory({ direction: CallDirection.Incoming })
const answered = incoming.entries.filter(e => e.wasAnswered)
const recent = answered.filter(e => e.startTime >= lastWeek)
```

💡 **Tip:** VueSip's filtering is optimized. Let it do the work instead of filtering in JavaScript.

### 5. Monitor Storage Usage

**Why:** Browser storage isn't unlimited. Proactive monitoring prevents errors when storage fills up.

Regularly check storage quota and clean up old entries:

```typescript
import { checkStorageWarning, clearOldCallHistory } from 'vuesip'

async function manageStorage() {
  // Check if storage is over 80% full
  const isLow = await checkStorageWarning(80)

  if (isLow) {
    // Automatically clear oldest 20% of entries
    await clearOldCallHistory(20)
    console.log('Cleaned up old call history')
  }
}

// Check every hour
setInterval(manageStorage, 3600000)  // 3600000ms = 1 hour
```

✅ **Best Practice:** Set up automatic storage monitoring to prevent issues before they happen.

### 6. Handle Errors Gracefully

**Why:** Operations can fail (network issues, storage full, etc.). Always handle errors to prevent crashes and inform users.

Always handle potential errors:

```typescript
try {
  await exportHistory({ format: 'csv', filename: 'calls' })
  showSuccessMessage('History exported successfully')
} catch (error) {
  console.error('Export failed:', error)
  showErrorMessage('Failed to export history. Please try again.')
}
```

✅ **Best Practice:** Always wrap async operations in try/catch and show user-friendly error messages.

### 7. Provide User Feedback

**Why:** Long operations (exports, large queries) can take several seconds. Users need to know something is happening.

Keep users informed of operations:

```typescript
const isExporting = ref(false)
const exportStatus = ref('')

async function exportCalls() {
  isExporting.value = true
  exportStatus.value = 'Exporting...'

  try {
    await exportHistory({ format: 'csv', filename: 'calls' })
    exportStatus.value = '✅ Export complete!'
  } catch (error) {
    exportStatus.value = '❌ Export failed'
  } finally {
    isExporting.value = false
  }
}
```

💡 **Tip:** Use loading spinners, progress bars, or status messages for any operation taking more than 1 second.

### 8. Validate Export Filters

**Why:** Invalid filters (like end date before start date) cause errors. Validate before processing.

Ensure valid filter combinations before exporting:

```typescript
function validateExportFilter(filter: HistoryFilter): boolean {
  // Validate date range
  if (filter.dateFrom && filter.dateTo) {
    if (filter.dateFrom > filter.dateTo) {
      alert('❌ Invalid date range: End date must be after start date')
      return false
    }
  }

  return true
}

async function exportWithValidation(filter: HistoryFilter) {
  // Validate before exporting
  if (!validateExportFilter(filter)) {
    return
  }

  await exportHistory({ format: 'csv', filter })
}
```

✅ **Best Practice:** Validate user input before processing to provide immediate feedback and prevent errors.

### 9. Cache Statistics

**Why:** Calculating statistics for thousands of calls can be slow. Cache results to avoid recalculating repeatedly.

Cache statistics for better performance:

```typescript
const statsCache = ref<HistoryStatistics | null>(null)
const cacheTime = ref<number>(0)
const CACHE_DURATION = 60000 // 1 minute

function getStatisticsWithCache(): HistoryStatistics {
  const now = Date.now()

  // Use cached stats if they're less than 1 minute old
  if (statsCache.value && (now - cacheTime.value < CACHE_DURATION)) {
    return statsCache.value
  }

  // Cache expired or doesn't exist - calculate fresh stats
  const stats = getStatistics()
  statsCache.value = stats
  cacheTime.value = now

  return stats
}
```

💡 **Tip:** Adjust cache duration based on your needs. Use longer cache times for relatively static data.

### 10. Use Proper Data Formatting

**Why:** Consistent formatting makes your UI look professional and helps users understand data quickly.

Format data consistently for display:

```typescript
// Create reusable formatters (DRY principle)
const formatters = {
  // Format date/time consistently
  date: (date: Date) => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date),

  // Format duration as MM:SS
  duration: (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  // Clean up SIP URIs for display
  uri: (uri: string) => {
    // Remove sip: prefix for cleaner display
    return uri.replace(/^sips?:/, '')
  }
}

// Use consistently throughout your app
const formattedTime = formatters.date(entry.startTime)
const formattedDuration = formatters.duration(entry.duration)
```

✅ **Best Practice:** Create a centralized formatting module that all components use for consistency.

### 11. Implement Confirmation Dialogs

**Why:** Accidental deletions are frustrating. Always confirm destructive operations.

Always confirm destructive operations:

```typescript
async function clearAllHistory() {
  // Confirm before clearing (be specific about what's being deleted)
  if (!confirm(`Are you sure you want to clear all ${totalCalls.value} calls? This cannot be undone.`)) {
    return
  }

  try {
    await clearHistory()
    showSuccessMessage('✅ History cleared')
  } catch (error) {
    showErrorMessage('❌ Failed to clear history')
  }
}
```

✅ **Best Practice:** Make confirmation messages specific (include numbers) and clear about permanence.

### 12. Handle Empty States

**Why:** Empty displays look broken. Provide helpful messages and guidance.

Provide helpful messages for empty history:

```vue
<template>
  <div class="call-history">
    <!-- No calls at all -->
    <div v-if="totalCalls === 0" class="empty-state">
      <p>📞 No call history yet</p>
      <p>Your call history will appear here after your first call</p>
    </div>

    <!-- No calls match current filter -->
    <div v-else-if="filteredHistory.length === 0" class="empty-state">
      <p>🔍 No calls match your filter</p>
      <button @click="clearFilters">Clear Filters</button>
    </div>

    <!-- Show history entries -->
    <div v-else>
      <!-- Display entries -->
    </div>
  </div>
</template>
```

💡 **Tip:** Different empty states for different scenarios help users understand what's happening and what to do next.

---

## Summary

VueSip provides comprehensive call history management with powerful features designed for real-world applications. Here's what you get:

### Core Features

- **Automatic Tracking**: All calls are automatically logged with detailed information - no manual effort required
- **Powerful Filtering**: Filter by direction, date range, tags, status, video, and more with efficient built-in methods
- **Fast Searching**: Case-insensitive search across URIs and display names with optional filter combinations
- **Flexible Export**: Export to JSON (complete data) or CSV (spreadsheet format) with optional filtering
- **Rich Statistics**: Generate insights about call patterns, totals, averages, and frequent contacts
- **Persistent Storage**: Automatic persistence to IndexedDB with quota management and cleanup utilities
- **Easy Management**: Simple APIs for deleting entries and clearing history with full error handling

### Quality Features

All features include:
- **Type-Safe**: Full TypeScript interfaces for all data structures and methods
- **Reactive**: Vue 3 reactive state management for automatic UI updates
- **Error Handling**: Comprehensive error handling with try/catch patterns
- **Pagination**: Built-in pagination support for efficiently handling large datasets
- **Storage Monitoring**: Quota monitoring and automatic cleanup to prevent storage issues
- **Production-Ready**: Best practice examples and patterns for real applications

### Key Takeaways

💡 **Remember:**
- History is automatically tracked - you don't need to manually log calls
- Use pagination for large datasets to keep your app responsive
- Monitor storage usage and clean up old entries proactively
- Always debounce search input to avoid performance issues
- Confirm destructive operations (delete, clear) with users
- Use filters efficiently by combining criteria in single queries
- Provide user feedback for long-running operations

### Next Steps

Now that you understand call history management, explore these related topics:

- [API Reference](/api/) - Complete API documentation for all methods and types
- [Device Management Guide](/guide/device-management) - Managing audio/video devices
- [Call Controls Guide](/guide/call-controls) - Making and managing calls

⚠️ **Important:** Always test with realistic amounts of data. An app that works with 10 calls might have performance issues with 10,000 calls. Use pagination, caching, and the best practices in this guide to ensure your app scales well.
