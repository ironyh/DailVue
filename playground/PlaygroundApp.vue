<template>
  <div :class="['playground', { compact: isCompactMode }]" data-testid="sip-client">
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
          <div class="header-actions">
            <button
              @click="toggleCompact"
              class="density-toggle"
              :aria-pressed="isCompactMode"
              :aria-label="isCompactMode ? 'Disable compact mode' : 'Enable compact mode'"
              type="button"
            >
              <span class="theme-icon">{{ isCompactMode ? '🧩' : '🗜️' }}</span>
            </button>
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
      </div>
    </header>

    <!-- Call Toolbar -->
    <CallToolbar />

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
import CallToolbar from './components/CallToolbar.vue'
import { playgroundSipClient } from './sipClient'

// localStorage keys for credentials
const CREDENTIALS_STORAGE_KEY = 'vuesip-credentials'
const CREDENTIALS_OPTIONS_KEY = 'vuesip-credentials-options'

interface StoredCredentials {
  uri: string
  sipUri: string
  password?: string
  displayName: string
  timestamp: string
}

interface CredentialsOptions {
  rememberMe: boolean
  savePassword: boolean
}

// Use imported examples
const examples = allExamples

// Get shared SIP client for global auto-connect
const { connect, disconnect, isConnected, updateConfig } = playgroundSipClient

// State
const currentExample = ref('basic-call')
const activeTab = ref<'demo' | 'code' | 'setup'>('demo')
const searchQuery = ref('')
const copiedSnippets = ref<Record<number, boolean>>({})
const isDarkMode = ref(false)
const isCompactMode = ref(false)

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

const toggleCompact = () => {
  isCompactMode.value = !isCompactMode.value
}

// Global credential loading for auto-connect across all demos
const loadAndConnectCredentials = async () => {
  const saved = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
  const options = localStorage.getItem(CREDENTIALS_OPTIONS_KEY)

  if (saved && options) {
    try {
      const credentials: StoredCredentials = JSON.parse(saved)
      const opts: CredentialsOptions = JSON.parse(options)

      // Debug: Log what was loaded from localStorage
      console.log('🔍 PlaygroundApp: Loaded from localStorage:', {
        uri: credentials.uri,
        sipUri: credentials.sipUri,
        displayName: credentials.displayName,
        hasPassword: !!credentials.password,
        passwordLength: credentials.password?.length,
        passwordChars: credentials.password ? Array.from(credentials.password).map(c => c.charCodeAt(0)) : [],
        rememberMe: opts.rememberMe,
        savePassword: opts.savePassword
      })

      // Only auto-connect if rememberMe is enabled and not already connected
      if (opts.rememberMe && !isConnected.value) {
        console.log('🌐 PlaygroundApp: Loading saved credentials for global auto-connect...')

        // Build config object
        const config: any = {
          uri: credentials.uri,
          sipUri: credentials.sipUri,
          displayName: credentials.displayName || undefined,
          autoRegister: true,
          connectionTimeout: 10000,
          registerExpires: 600,
        }

        // Add password if it was saved
        if (opts.savePassword && credentials.password) {
          config.password = credentials.password
        }

        // Debug: Log config before updating
        console.log('📝 PlaygroundApp: Config to be applied:', {
          uri: config.uri,
          sipUri: config.sipUri,
          displayName: config.displayName,
          hasPassword: !!config.password,
          passwordLength: config.password?.length,
          passwordPreview: config.password ? `${config.password.substring(0, 3)}...` : 'none'
        })

        // Update configuration
        const validationResult = updateConfig(config)

        if (!validationResult.valid) {
          console.error('PlaygroundApp: Invalid saved credentials:', validationResult.errors)
          return
        }

        // Auto-connect
        try {
          await connect()
          console.log('✅ PlaygroundApp: Global auto-connect successful')
        } catch (error) {
          console.error('❌ PlaygroundApp: Global auto-connect failed:', error)
          // Don't throw - allow user to manually connect from BasicCallDemo
        }
      }
    } catch (error) {
      console.error('PlaygroundApp: Failed to load credentials:', error)
    }
  }
}

// Initialize theme from localStorage or system preference
onMounted(async () => {
  // 1. Try to auto-connect with saved credentials (global for all demos)
  await loadAndConnectCredentials()

  // 2. Initialize theme
  const stored = localStorage.getItem('vuesip-theme')
  if (stored) {
    isDarkMode.value = stored === 'dark'
  } else {
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDarkMode.value)

  // 3. Initialize compact mode
  const compactStored = localStorage.getItem('vuesip-compact')
  if (compactStored) {
    isCompactMode.value = compactStored === 'on'
  }
})

// Watch for theme changes
watch(isDarkMode, (newValue) => {
  applyTheme(newValue)
  localStorage.setItem('vuesip-theme', newValue ? 'dark' : 'light')
})

watch(isCompactMode, (newVal) => {
  localStorage.setItem('vuesip-compact', newVal ? 'on' : 'off')
})
</script>

<style scoped>
.playground {
  min-height: 100vh;
  background: var(--bg-secondary);
}

.playground-header {
  position: relative;
  background: linear-gradient(120deg, #667eea 0%, #764ba2 50%, #4f46e5 100%);
  background-size: 200% 200%;
  animation: headerGradient 12s ease infinite;
  color: white;
  padding: 2.5rem 0;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  overflow: hidden;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-toggle {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
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
  backdrop-filter: blur(6px) saturate(120%);
}

.density-toggle {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.2rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  backdrop-filter: blur(6px) saturate(120%);
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.density-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
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
  box-shadow: 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
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
  border: 1.5px solid var(--border-color);
  background: linear-gradient(var(--bg-primary), var(--bg-primary)) padding-box,
    linear-gradient(180deg, transparent, rgba(102, 126, 234, 0.15)) border-box;
  position: relative;
  overflow: hidden;
}

.example-list li:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.example-list li::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.06) 35%, transparent 65%);
  opacity: 0;
  transform: translateX(-15%);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.example-list li:hover::after {
  opacity: 1;
  transform: translateX(0);
}

.example-list li.active {
  background: linear-gradient(var(--bg-primary), var(--bg-primary)) padding-box,
    linear-gradient(180deg, rgba(102, 126, 234, 0.6), rgba(99, 102, 241, 0.6)) border-box;
  border-color: transparent;
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
  transition: background 0.2s, color 0.2s;
}

.quick-links a:hover {
  background: rgba(102,126,234,0.08);
  color: var(--primary-dark);
}

/* Main Area */
.playground-main {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 12px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
  min-height: 600px;
  border: 1px solid var(--border-color);
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
  background: linear-gradient(var(--bg-primary), var(--bg-primary)) padding-box,
    linear-gradient(90deg, rgba(99,102,241,0.65), rgba(59,130,246,0.65)) border-box;
  border: 1px solid transparent;
  color: var(--primary);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

/* Tab Navigation */
.tab-navigation {
  display: inline-flex;
  background: var(--bg-secondary);
  padding: 0.375rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  margin-bottom: 1.25rem;
  gap: 0.375rem;
}

.tab-navigation button {
  background: transparent;
  border: 1px solid transparent;
  padding: 0.625rem 1rem;
  font-size: 0.95rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 600;
}

.tab-navigation button:hover {
  color: var(--text-primary);
  background: rgba(102,126,234,0.06);
}

.tab-navigation button.active {
  color: white;
  background: linear-gradient(135deg, var(--primary), #4f46e5);
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
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
  background: #1f2937;
  color: var(--gray-300);
  border: 1px solid #374151;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
  min-height: 32px;
  min-width: 80px;
}

.copy-button:hover {
  background: #374151;
  color: white;
  border-color: #4b5563;
  transform: translateY(-1px);
}

.copy-button.copied {
  background: var(--success);
  color: white;
  border-color: var(--success-dark);
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.25);
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
  background: linear-gradient(180deg, #111827 0%, #0b1220 100%);
  color: #e5e7eb;
  padding: 3rem 1.5rem 1.5rem 1.5rem; /* Extra padding at top for button */
  border-radius: 10px;
  overflow-x: auto;
  margin: 0;
  border: 1px solid #1f2937;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
  position: relative;
}

.code-snippet pre::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #6366f1, #3b82f6, #10b981);
  opacity: 0.8;
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
  background: linear-gradient(180deg, #111827 0%, #0b1220 100%);
  color: #e5e7eb;
  padding: 1.5rem;
  border-radius: 10px;
  overflow-x: auto;
  margin: 1rem 0 1.5rem 0;
  border: 1px solid #1f2937;
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
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    white-space: nowrap;
  }
}

/* Compact mode adjustments */
.compact .playground-header {
  padding: 1.5rem 0;
}

.compact .playground-header h1 {
  font-size: 2rem;
}

.compact .subtitle {
  font-size: 1rem;
}

.compact .playground-content {
  gap: 1.25rem;
  padding: 0 1rem;
  grid-template-columns: 240px 1fr;
}

.compact .playground-sidebar {
  padding: 1rem;
}

.compact .search-input {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.85rem;
}

.compact .example-list li {
  padding: 0.75rem;
}

.compact .tab-navigation {
  padding: 0.25rem;
  gap: 0.25rem;
}

.compact .tab-navigation button {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.compact .playground-main {
  padding: 1.25rem;
}

.compact .code-snippet pre {
  padding: 2.25rem 1rem 1rem 1rem;
}

.compact .setup-content pre {
  padding: 1rem;
}

/* Additional compact refinements */
.compact .example-header h2 {
  font-size: 1.5rem;
}

.compact .example-header p {
  font-size: 1rem;
  margin: 0 0 0.75rem 0;
}

.compact .example-tags {
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.compact .tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
}

.compact .example-icon {
  font-size: 1.5rem;
}

.compact .example-info h3 {
  font-size: 0.95rem;
}

.compact .example-info p {
  font-size: 0.8rem;
}

.compact .copy-button {
  padding: 0.375rem 0.5rem;
  min-height: 28px;
  min-width: 68px;
}

.compact .code-snippet code,
.compact .setup-content code {
  font-size: 0.8rem;
  line-height: 1.5;
}

.compact .quick-links {
  margin-top: 1.25rem;
  padding-top: 1rem;
}

.compact .quick-links a {
  padding: 0.375rem;
  font-size: 0.82rem;
}

.compact .search-box {
  margin-bottom: 0.75rem;
}

.compact .playground-sidebar h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.compact .filter-stats {
  padding: 0.375rem;
  margin-bottom: 0.5rem;
}

/* Decorative header blobs */
.playground-header::before,
.playground-header::after {
  content: '';
  position: absolute;
  filter: blur(40px);
  opacity: 0.6;
  transform: translateZ(0);
}

.playground-header::before {
  width: 420px;
  height: 420px;
  top: -120px;
  left: -120px;
  background: radial-gradient(closest-side, rgba(255,255,255,0.25), transparent 70%);
  animation: floatY 12s ease-in-out infinite alternate;
}

.playground-header::after {
  width: 360px;
  height: 360px;
  right: -120px;
  bottom: -120px;
  background: radial-gradient(closest-side, rgba(99,102,241,0.45), transparent 70%);
  animation: floatY 14s ease-in-out infinite alternate-reverse;
}

@keyframes headerGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes floatY {
  0% { transform: translateY(0) translateZ(0); }
  100% { transform: translateY(10px) translateZ(0); }
}
</style>
