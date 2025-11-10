import { createApp } from 'vue'
import PlaygroundApp from './PlaygroundApp.vue'
import TestApp from './TestApp.vue'
import './style.css'

// Use TestApp for E2E tests, PlaygroundApp for development
const isE2E = import.meta.env.MODE === 'test' || window.location.search.includes('test=true')
const app = createApp(isE2E ? TestApp : PlaygroundApp)
app.mount('#app')
