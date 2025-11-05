import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/composables': resolve(__dirname, 'src/composables'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/stores': resolve(__dirname, 'src/stores'),
      '@/plugins': resolve(__dirname, 'src/plugins'),
      '@/providers': resolve(__dirname, 'src/providers'),
    },
  },

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueSip',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'vuesip.js'
        if (format === 'cjs') return 'vuesip.cjs'
        if (format === 'umd') return 'vuesip.umd.js'
        return `vuesip.${format}.js`
      },
    },
    rollupOptions: {
      // Make sure to externalize deps that shouldn't be bundled
      external: ['vue', 'jssip', 'sip.js', 'webrtc-adapter'],
      output: {
        // Provide global variables to use in the UMD build
        globals: {
          vue: 'Vue',
          jssip: 'JsSIP',
          'sip.js': 'SIP',
          'webrtc-adapter': 'adapter',
        },
        // Export format for named exports
        exports: 'named',
      },
    },
    // Generate source maps for debugging
    sourcemap: true,
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
    // Target modern browsers
    target: 'es2020',
    // Output directory
    outDir: 'dist',
    emptyOutDir: true,
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.spec.ts', '**/*.test.ts'],
      // Enforce minimum coverage
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
})
