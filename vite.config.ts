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
    setupFiles: ['./tests/setup.ts'],
    // Exclude E2E tests (run separately with Playwright)
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/*.spec.ts'],
    // Retry failed tests to detect flakiness
    retry: 2,
    // Test timeout (10 seconds)
    testTimeout: 10000,
    // Suppress Vue lifecycle warnings in benchmarks (non-critical for performance testing)
    onConsoleLog: (log, type) => {
      // Suppress Vue lifecycle warnings in performance benchmarks
      // These warnings occur because benchmarks test core classes outside Vue component context
      if (
        typeof log === 'string' &&
        log.includes('onUnmounted is called when there is no active component instance')
      ) {
        return false // Suppress this warning
      }
      return true // Keep other logs
    },

    // Parallelization settings for faster test execution
    // Use thread pool for better performance (default, but explicit here)
    pool: 'threads',
    poolOptions: {
      threads: {
        // Use all available CPU cores (default is CPU count)
        // You can set a specific number if needed: minThreads: 1, maxThreads: 4
        useAtomics: true, // Better performance for thread communication
        singleThread: false, // Ensure multi-threading is enabled
      },
    },

    // File-level parallelization settings
    fileParallelism: true, // Run test files in parallel (default true)
    maxConcurrency: 5, // Max concurrent tests within a single file

    // Isolation settings
    isolate: true, // Each test file runs in isolated context (safer, default)

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/setup.ts',
        '**/test-helpers.ts',
      ],
      // Enforce minimum coverage - increased from 70% to 80%
      lines: 80,
      functions: 80,
      branches: 75, // Slightly lower for branches due to edge cases
      statements: 80,
    },
  },
})
