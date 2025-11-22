<template>
  <div class="playground" data-testid="sip-client">
    <!-- Header -->
    <header class="playground-header">
      <div class="container">
        <h1>🎮 VueSip Interactive Playground</h1>
        <p class="subtitle">
          Explore and experiment with VueSip composables for building SIP/VoIP applications
        </p>
      </div>
    </header>

    <!-- Main Content -->
    <div class="playground-content">
      <!-- Sidebar Navigation -->
      <aside class="playground-sidebar">
        <nav>
          <h2>Examples</h2>
          <ul class="example-list">
            <li
              v-for="example in examples"
              :key="example.id"
              :class="{ active: currentExample === example.id }"
              @click="selectExample(example.id)"
            >
              <span class="example-icon">{{ example.icon }}</span>
              <div class="example-info">
                <h3>{{ example.title }}</h3>
                <p>{{ example.description }}</p>
              </div>
            </li>
          </ul>
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
              <pre><code>{{ snippet.code }}</code></pre>
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
import { ref, computed } from 'vue'
import { allExamples } from './examples'

// Use imported examples
const examples = allExamples
// State
const currentExample = ref('basic-call')
const activeTab = ref<'demo' | 'code' | 'setup'>('demo')

// Computed
const activeExample = computed(() => {
  return examples.find((ex) => ex.id === currentExample.value) || examples[0]
})

// Methods
const selectExample = (id: string) => {
  currentExample.value = id
  activeTab.value = 'demo'
}
</script>

<style scoped>
.playground {
  min-height: 100vh;
  background: #f8f9fa;
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
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  height: fit-content;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 2rem;
}

.playground-sidebar h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #333;
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
  background: #f8f9fa;
}

.example-list li.active {
  background: #e7f3ff;
  border-color: #667eea;
}

.example-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.example-info h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  color: #333;
}

.example-info p {
  margin: 0;
  font-size: 0.875rem;
  color: #666;
}

/* Quick Links */
.quick-links {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.quick-links h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #333;
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
  color: #667eea;
  text-decoration: none;
  font-size: 0.875rem;
  display: block;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.quick-links a:hover {
  background: #f8f9fa;
}

/* Main Area */
.playground-main {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.example-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #333;
}

.example-header p {
  margin: 0 0 1rem 0;
  color: #666;
  font-size: 1.125rem;
}

.example-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tag {
  background: #e7f3ff;
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
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 2rem;
}

.tab-navigation button {
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-navigation button:hover {
  color: #333;
}

.tab-navigation button.active {
  color: #667eea;
  border-bottom-color: #667eea;
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
  color: #333;
}

.snippet-description {
  margin: 0 0 1rem 0;
  color: #666;
}

.code-snippet pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
}

.code-snippet code {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Setup Container */
.setup-container {
  padding: 1rem;
}

.setup-content h3 {
  margin: 2rem 0 1rem 0;
  font-size: 1.5rem;
  color: #333;
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
  color: #666;
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
