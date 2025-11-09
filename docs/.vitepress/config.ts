import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'VueSip',
  description: 'A headless Vue.js component library for SIP/VoIP applications',
  base: '/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'VueSip' }],
    ['meta', { name: 'og:image', content: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API Reference', link: '/api/', activeMatch: '/api/' },
      { text: 'Examples', link: '/examples/', activeMatch: '/examples/' },
      { text: 'FAQ', link: '/faq' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Core Features',
          collapsed: false,
          items: [
            { text: 'Making Calls', link: '/guide/making-calls' },
            { text: 'Receiving Calls', link: '/guide/receiving-calls' },
            { text: 'Call Controls', link: '/guide/call-controls' },
            { text: 'Video Calling', link: '/guide/video-calling' },
          ],
        },
        {
          text: 'Advanced Topics',
          collapsed: false,
          items: [
            { text: 'Device Management', link: '/guide/device-management' },
            { text: 'Presence & Messaging', link: '/guide/presence-messaging' },
            { text: 'Call History', link: '/guide/call-history' },
          ],
        },
        {
          text: 'Quality & Reliability',
          collapsed: false,
          items: [
            { text: 'Error Handling', link: '/guide/error-handling' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Performance', link: '/guide/performance' },
          ],
        },
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
          ],
        },
        {
          text: 'Core APIs',
          collapsed: false,
          items: [
            { text: 'Composables', link: '/api/composables' },
            { text: 'Types', link: '/api/types' },
            { text: 'Events', link: '/api/events' },
          ],
        },
        {
          text: 'Extension APIs',
          collapsed: false,
          items: [
            { text: 'Providers', link: '/api/providers' },
            { text: 'Plugins', link: '/api/plugins' },
            { text: 'Utilities', link: '/api/utilities' },
          ],
        },
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ironyh/VueSip' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/ironyh/VueSip/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present VueSip',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },
  },
})
