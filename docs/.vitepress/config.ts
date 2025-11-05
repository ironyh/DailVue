import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'DailVue',
  description: 'A headless Vue.js component library for SIP/VoIP applications',
  base: '/',

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is DailVue?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'SIP Client', link: '/guide/sip-client' },
            { text: 'Call Management', link: '/guide/call-management' },
            { text: 'Media Devices', link: '/guide/media-devices' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Composables',
          items: [
            { text: 'useSipClient', link: '/api/use-sip-client' },
            { text: 'useCallSession', link: '/api/use-call-session' },
            { text: 'useMediaDevices', link: '/api/use-media-devices' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ironyh/DailVue' },
    ],

    search: {
      provider: 'local',
    },
  },
})
