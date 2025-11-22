<template>
  <div class="playground" data-testid="sip-client">
    <!-- Header -->
    <header class="playground-header">
      <div class="container">
        <div class="header-content">
          <div class="header-title">
            <h1>🎮 VueSip Interactive Playground</h1>
            <p class="subtitle">
              Explore and experiment with VueSip composables for building SIP/VoIP applications
            </p>
          </div>
          <button
            @click="toggleTheme"
            class="theme-toggle"
            :aria-label="`Switch to ${isDarkMode ? 'light' : 'dark'} mode`"
            type="button"
          >
            <span class="theme-icon">{{ isDarkMode ? '☀️' : '🌙' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="playground-content">
      <!-- Sidebar Navigation -->
      <aside class="playground-sidebar">
        <nav>
          <h2>Examples</h2>

          <!-- Search Input -->
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search demos..."
              class="search-input"
              aria-label="Search demos"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="clear-search"
              aria-label="Clear search"
              type="button"
            >
              ✕
            </button>
          </div>

          <!-- Filter Stats -->
          <div v-if="searchQuery" class="filter-stats">
            Showing {{ filteredExamples.length }} of {{ examples.length }} demos
          </div>

          <!-- Example List -->
          <ul class="example-list">
            <li
              v-for="example in filteredExamples"
              :key="example.id"
              :class="{ active: currentExample === example.id }"
              @click="selectExample(example.id)"
            >
              <span class="example-icon">{{ example.icon }}</span>
              <div class="example-info">
                <h3 v-html="highlightMatch(example.title)"></h3>
                <p v-html="highlightMatch(example.description)"></p>
              </div>
              <!-- Show matching tags when searching -->
              <div v-if="searchQuery && getMatchingTags(example.tags).length > 0" class="matching-tags">
                <span
                  v-for="tag in getMatchingTags(example.tags)"
                  :key="tag"
                  class="tag-badge"
                >
                  {{ tag }}
                </span>
              </div>
            </li>
          </ul>

          <!-- No Results Message -->
          <div v-if="filteredExamples.length === 0" class="no-results">
            <p>No demos found matching "{{ searchQuery }}"</p>
            <button @click="searchQuery = ''" type="button" class="btn-secondary">Clear search</button>
          </div>
        </nav>

        <!-- Quick Links -->
        <div class="quick-links">
          <h3>Resources</h3>
          <ul>
            <li>
              <a href="/docs" target="_blank">📚 Documentation</a>
            </li>
            <li>
              <a href="https://github.com/ironyh/VueSip" target="_blank">💻 GitHub Repository</a>
            </li>
            <li>
              <a href="https://www.npmjs.com/package/vuesip" target="_blank">📦 NPM Package</a>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Main Area -->
      <main class="playground-main">
        <!-- Example Header -->
        <div class="example-header">
          <h2>{{ activeExample.title }}</h2>
          <p>{{ activeExample.description }}</p>
          <div class="example-tags">
            <span v-for="tag in activeExample.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            :class="{ active: activeTab === 'demo' }"
            @click="activeTab = 'demo'"
          >
            🎯 Live Demo
          </button>
          <button
            :class="{ active: activeTab === 'code' }"
            @click="activeTab = 'code'"
          >
            💻 Code Examples
          </button>
          <button
            :class="{ active: activeTab === 'setup' }"
            @click="activeTab = 'setup'"
          >
            ⚙️ Setup Guide
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Live Demo Tab -->
          <div v-if="activeTab === 'demo'" class="demo-container">
            <component :is="activeExample.component" />
          </div>

          <!-- Code Examples Tab -->
          <div v-if="activeTab === 'code'" class="code-container">
            <div v-for="(snippet, index) in activeExample.codeSnippets" :key="index" class="code-snippet">
              <h3>{{ snippet.title }}</h3>
              <p v-if="snippet.description" class="snippet-description">
                {{ snippet.description }}
              </p>
              <div class="code-block-wrapper">
                <button
                  @click="copyCode(snippet.code, index)"
                  class="copy-button"
                  :class="{ copied: copiedSnippets[index] }"
                  :aria-label="copiedSnippets[index] ? 'Copied!' : 'Copy code'"
                  type="button"
                >
                  <span v-if="copiedSnippets[index]" class="copy-icon">✓</span>
                  <span v-else class="copy-icon">📋</span>
                  <span class="copy-text">
                    {{ copiedSnippets[index] ? 'Copied!' : 'Copy' }}
                  </span>
                </button>
                <pre><code>{{ snippet.code }}</code></pre>
              </div>
            </div>
          </div>

          <!-- Setup Guide Tab -->
          <div v-if="activeTab === 'setup'" class="setup-container">
            <div class="setup-content">
              <h3>Prerequisites</h3>
              <ul>
                <li>Vue 3.4.0 or higher</li>
                <li>A SIP server (Asterisk, FreeSWITCH, etc.)</li>
                <li>WebRTC-enabled browser (Chrome 90+, Firefox 88+, Safari 14+)</li>
              </ul>

              <h3>Installation</h3>
              <pre><code># npm
npm install vuesip

# pnpm
pnpm add vuesip

# yarn
yarn add vuesip</code></pre>

              <h3>Quick Start</h3>
              <pre><code>import { useSipClient, useCallSession } from 'vuesip'

// In your component
const { connect, isConnected } = useSipClient()
const { makeCall, answer, hangup } = useCallSession()</code></pre>

              <h3>{{ activeExample.title }} Specific Setup</h3>
              <div v-html="activeExample.setupGuide"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { allExamples } from './examples'

// Use imported examples
const examples = allExamples

// State
const currentExample = ref('basic-call')
const activeTab = ref<'demo' | 'code' | 'setup'>('demo')
const searchQuery = ref('')
const copiedSnippets = ref<Record<number, boolean>>({})
const isDarkMode = ref(false)

// Computed
const filteredExamples = computed(() => {
  if (!searchQuery.value.trim()) {
    return examples
  }

  const query = searchQuery.value.toLowerCase()
  return examples.filter(example => {
    // Search in title
    if (example.title.toLowerCase().includes(query)) return true

    // Search in description
    if (example.description.toLowerCase().includes(query)) return true

    // Search in tags
    if (example.tags.some(tag => tag.toLowerCase().includes(query))) return true

    return false
  })
})

const activeExample = computed(() => {
  return examples.find((ex) => ex.id === currentExample.value) || examples[0]
})

// Methods
const selectExample = (id: string) => {
  currentExample.value = id
  activeTab.value = 'demo'
}

const highlightMatch = (text: string): string => {
  if (!searchQuery.value.trim()) return text

  const regex = new RegExp(`(${searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

const getMatchingTags = (tags: string[]): string[] => {
  if (!searchQuery.value.trim()) return []

  const query = searchQuery.value.toLowerCase()
  return tags.filter(tag => tag.toLowerCase().includes(query))
}

const copyCode = async (code: string, index: number) => {
  try {
    // Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code)
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    // Show success feedback
    copiedSnippets.value[index] = true

    // Reset after 2 seconds
    setTimeout(() => {
      copiedSnippets.value[index] = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy code:', error)
    alert('Failed to copy code. Please select and copy manually.')
  }
}

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
}

const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark-mode')
  } else {
    document.documentElement.classList.remove('dark-mode')
  }
}

// Initialize theme from localStorage or system preference
onMounted(() => {
  const stored = localStorage.getItem('vuesip-theme')
  if (stored) {
    isDarkMode.value = stored === 'dark'
  } else {
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDarkMode.value)
})

// Watch for theme changes
watch(isDarkMode, (newValue) => {
  applyTheme(newValue)
  localStorage.setItem('vuesip-theme', newValue ? 'dark' : 'light')
})
</script>

<style scoped>
.playground {
  min-height: 100vh;
  background: var(--bg-secondary);
}

.playground-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.playground-header .container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
}

.playground-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 1.125rem;
  opacity: 0.95;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header-title {
  flex: 1;
}

.theme-toggle {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.5rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 48px;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.theme-icon {
  display: block;
  line-height: 1;
}

.playground-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  max-width: 1400px;
  margin: 2rem auto;
  gap: 2rem;
  padding: 0 2rem;
}

/* Sidebar */
.playground-sidebar {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  height: fit-content;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 2rem;
}

.playground-sidebar h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

/* Search Box */
.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: var(--gray-400);
}

.clear-search {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--gray-500);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-size: 1.125rem;
  line-height: 1;
  transition: color 0.2s;
}

.clear-search:hover {
  color: var(--danger);
}

/* Filter Stats */
.filter-stats {
  font-size: 0.75rem;
  color: var(--gray-500);
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: var(--gray-100);
  border-radius: 4px;
  text-align: center;
}

/* Highlight Mark */
:deep(mark) {
  background-color: #fef3c7;
  color: inherit;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  font-weight: 600;
}

/* Matching Tags */
.matching-tags {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.tag-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  background: var(--primary);
  color: white;
  border-radius: 3px;
  font-weight: 500;
}

/* No Results */
.no-results {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--gray-500);
}

.no-results p {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--gray-200);
}

.example-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.example-list li {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.example-list li:hover {
  background: var(--bg-secondary);
}

.example-list li.active {
  background: rgba(102, 126, 234, 0.1);
  border-color: var(--primary);
}

.example-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.example-info h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.example-info p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Quick Links */
.quick-links {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.quick-links h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.quick-links ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quick-links li {
  margin-bottom: 0.5rem;
}

.quick-links a {
  color: var(--primary);
  text-decoration: none;
  font-size: 0.875rem;
  display: block;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.quick-links a:hover {
  background: var(--bg-secondary);
}

/* Main Area */
.playground-main {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.example-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: var(--text-primary);
}

.example-header p {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.example-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tag {
  background: rgba(102, 126, 234, 0.1);
  color: #0066cc;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 2rem;
}

.tab-navigation button {
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-navigation button:hover {
  color: var(--text-primary);
}

.tab-navigation button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* Tab Content */
.tab-content {
  min-height: 400px;
}

.demo-container {
  padding: 1rem;
}

/* Code Container */
.code-container {
  padding: 1rem;
}

.code-snippet {
  margin-bottom: 2rem;
}

.code-snippet h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.snippet-description {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
}

.code-snippet code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Code Block Wrapper */
.code-block-wrapper {
  position: relative;
  margin-bottom: 1.5rem;
}

.copy-button {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: #2d2d2d;
  color: var(--gray-400);
  border: 1px solid #3f3f3f;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
  min-height: 32px;
  min-width: 80px;
}

.copy-button:hover {
  background: #3f3f3f;
  color: white;
  border-color: #4f4f4f;
}

.copy-button.copied {
  background: var(--success);
  color: white;
  border-color: var(--success-dark);
}

.copy-icon {
  font-size: 0.875rem;
  line-height: 1;
}

.copy-text {
  font-weight: 500;
}

/* Ensure code block has enough padding for button */
.code-snippet pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 3rem 1.5rem 1.5rem 1.5rem; /* Extra padding at top for button */
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
}

/* Setup Container */
.setup-container {
  padding: 1rem;
}

.setup-content h3 {
  margin: 2rem 0 1rem 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.setup-content h3:first-child {
  margin-top: 0;
}

.setup-content ul {
  margin: 0 0 1.5rem 0;
  padding-left: 1.5rem;
}

.setup-content li {
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.setup-content pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0 1.5rem 0;
}

.setup-content code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 1024px) {
  .playground-content {
    grid-template-columns: 1fr;
  }

  .playground-sidebar {
    position: static;
  }
}

@media (max-width: 768px) {
  .playground-header h1 {
    font-size: 1.75rem;
  }

  .playground-content {
    padding: 0 1rem;
    margin: 1rem auto;
  }

  .playground-main {
    padding: 1.5rem;
  }

  .tab-navigation {
    overflow-x: auto;
  }

  .tab-navigation button {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    white-space: nowrap;
  }
}
</style>
