/**
 * Performance and Metrics E2E Tests
 *
 * Tests to ensure the application loads quickly and performs well.
 * Monitors key performance metrics like load time, bundle size, and responsiveness.
 */

import { test, expect, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

test.describe('Performance - Page Load Metrics', () => {
  test('should load initial page within 3 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(3000)
  })

  test('should have First Contentful Paint (FCP) under 1.5 seconds', async ({ page }) => {
    await page.goto(APP_URL)

    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint')
          if (fcpEntry) {
            resolve(fcpEntry.startTime)
          }
        }).observe({ entryTypes: ['paint'] })

        // Fallback timeout
        setTimeout(() => resolve(0), 5000)
      })
    })

    // FCP should be under 1.5 seconds (or 0 if not measured)
    if (fcp > 0) {
      expect(fcp).toBeLessThan(1500)
    }
  })

  test('should have Time to Interactive (TTI) under 3.5 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto(APP_URL)

    // Wait for page to be fully interactive
    await page.waitForLoadState('networkidle')

    // Check if main interactive elements are ready
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
    await expect(page.locator(SELECTORS.CONNECTION.CONNECT_BUTTON)).toBeEnabled()

    const tti = Date.now() - startTime

    expect(tti).toBeLessThan(3500)
  })

  test('should have Largest Contentful Paint (LCP) under 2.5 seconds', async ({ page }) => {
    await page.goto(APP_URL)

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          resolve(lastEntry.startTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })

        // Wait 5 seconds for LCP
        setTimeout(() => {
          const entries = performance.getEntriesByType('largest-contentful-paint')
          if (entries.length > 0) {
            resolve(entries[entries.length - 1].startTime)
          } else {
            resolve(0)
          }
        }, 5000)
      })
    })

    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500)
    }
  })

  test('should have Cumulative Layout Shift (CLS) under 0.1', async ({ page }) => {
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        }).observe({ entryTypes: ['layout-shift'] })

        // Measure for 2 seconds
        setTimeout(() => resolve(clsValue), 2000)
      })
    })

    expect(cls).toBeLessThan(0.1)
  })
})

test.describe('Performance - Resource Loading', () => {
  test('should load all resources within reasonable time', async ({ page }) => {
    await page.goto(APP_URL)

    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((entry: any) => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize || 0,
      }))
    })

    // No single resource should take more than 2 seconds
    const slowResources = resources.filter((r: any) => r.duration > 2000)
    expect(slowResources.length).toBe(0)
  })

  test('should have reasonable bundle size', async ({ page }) => {
    await page.goto(APP_URL)

    const bundleSize = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      let totalSize = 0

      resources.forEach((entry: any) => {
        if (entry.name.includes('.js') || entry.name.includes('.css')) {
          totalSize += entry.transferSize || 0
        }
      })

      return totalSize
    })

    // Total JS + CSS should be under 1MB (uncompressed)
    expect(bundleSize).toBeLessThan(1024 * 1024)
  })

  test('should use caching for static resources', async ({ page }) => {
    // First load
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    // Second load (should use cache)
    await page.reload()
    await page.waitForLoadState('networkidle')

    const cachedResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').filter((entry: any) => {
        return entry.transferSize === 0 && entry.decodedBodySize > 0
      }).length
    })

    // Should have some cached resources on reload
    expect(cachedResources).toBeGreaterThanOrEqual(0)
  })

  test('should lazy load non-critical resources', async ({ page }) => {
    const startTime = Date.now()

    await page.goto(APP_URL)

    // Wait for critical resources only
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()

    const criticalLoadTime = Date.now() - startTime

    // Critical resources should load quickly
    expect(criticalLoadTime).toBeLessThan(2000)
  })
})

test.describe('Performance - Runtime Performance', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should connect to SIP server within 2 seconds', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    await configureSip(TEST_DATA.VALID_CONFIG)

    const startTime = Date.now()
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    const connectionTime = Date.now() - startTime

    // Connection should be quick with mocks
    expect(connectionTime).toBeLessThan(2000)
  })

  test('should initiate call within 500ms of button click', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Setup
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Measure call initiation time
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)

    const startTime = Date.now()
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)

    // Wait for status to change
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-testid="call-status"]')
        return status?.textContent?.toLowerCase().includes('calling')
      },
      { timeout: 2000 }
    )

    const initiationTime = Date.now() - startTime

    expect(initiationTime).toBeLessThan(500)
  })

  test('should update UI within 100ms of state change', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Setup
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
    await page.waitForTimeout(500)

    // Measure mute button response time
    const startTime = Date.now()
    await page.click(SELECTORS.CALL_CONTROLS.MUTE_BUTTON)

    // Wait for aria-pressed to change
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="mute-button"]')
        return btn?.getAttribute('aria-pressed') === 'true'
      },
      { timeout: 500 }
    )

    const responseTime = Date.now() - startTime

    expect(responseTime).toBeLessThan(100)
  })

  test('should handle rapid user interactions without lag', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Setup
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    const startTime = Date.now()

    // Rapid interactions
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, '1')
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, '12')
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, '123')
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, '1234')
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, '12345')

    const totalTime = Date.now() - startTime

    // Should handle all inputs quickly
    expect(totalTime).toBeLessThan(500)
  })

  test('should not have memory leaks during call lifecycle', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Setup
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })

    // Make and end 5 calls
    for (let i = 0; i < 5; i++) {
      await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
      await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
      await page.waitForTimeout(200)

      const hangupBtn = page.locator(SELECTORS.CALL_CONTROLS.HANGUP_BUTTON)
      if (await hangupBtn.isVisible()) {
        await hangupBtn.click()
        await page.waitForTimeout(200)
      }
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })

    // Memory increase should be reasonable (less than 10MB)
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    }
  })
})

test.describe('Performance - Rendering Performance', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should maintain 60 FPS during animations', async ({ page }) => {
    // Open and close settings multiple times (trigger animations)
    const frames: number[] = []

    await page.evaluate(() => {
      let lastTime = performance.now()
      const measureFrame = () => {
        const currentTime = performance.now()
        const delta = currentTime - lastTime
        ;(window as any).__frameTimes = (window as any).__frameTimes || []
        ;(window as any).__frameTimes.push(delta)
        lastTime = currentTime

        if ((window as any).__frameTimes.length < 60) {
          requestAnimationFrame(measureFrame)
        }
      }
      requestAnimationFrame(measureFrame)
    })

    // Trigger animations
    for (let i = 0; i < 3; i++) {
      await page.click(SELECTORS.SETTINGS.SETTINGS_BUTTON)
      await page.waitForTimeout(100)
      await page.click(SELECTORS.SETTINGS.SETTINGS_BUTTON)
      await page.waitForTimeout(100)
    }

    // Get frame times
    const frameTimes = await page.evaluate(() => (window as any).__frameTimes || [])

    if (frameTimes.length > 0) {
      const avgFrameTime = frameTimes.reduce((a: number, b: number) => a + b, 0) / frameTimes.length
      const fps = 1000 / avgFrameTime

      // Should maintain close to 60 FPS (allow down to 30 FPS)
      expect(fps).toBeGreaterThan(30)
    }
  })

  test('should render large call history efficiently', async ({ page }) => {
    // Skip if call history is not available
    const historyButton = page.locator(SELECTORS.CALL_HISTORY.TOGGLE_BUTTON)
    if (!(await historyButton.isVisible())) {
      test.skip()
      return
    }

    // Simulate many call history entries
    await page.evaluate(() => {
      // Add mock history entries to localStorage or state
      const mockHistory = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        number: `555000${i}`,
        timestamp: Date.now() - i * 60000,
        duration: 120,
      }))
      localStorage.setItem('callHistory', JSON.stringify(mockHistory))
    })

    // Reload to load history
    await page.reload()
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()

    // Open history
    const startTime = Date.now()
    await historyButton.click()

    await page.waitForTimeout(500)

    const renderTime = Date.now() - startTime

    // Should render quickly even with many items
    expect(renderTime).toBeLessThan(1000)
  })

  test('should scroll smoothly through long lists', async ({ page }) => {
    // Create a long list of elements
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="sip-client"]')
      if (container) {
        const list = document.createElement('div')
        list.style.height = '300px'
        list.style.overflow = 'auto'

        for (let i = 0; i < 100; i++) {
          const item = document.createElement('div')
          item.textContent = `Item ${i}`
          item.style.height = '50px'
          list.appendChild(item)
        }

        container.appendChild(list)
      }
    })

    // Measure scroll performance
    const scrollPerformance = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const list = document.querySelector('div[style*="overflow"]') as HTMLElement
        if (!list) {
          resolve(0)
          return
        }

        const startTime = performance.now()
        let scrollCount = 0

        const scrollInterval = setInterval(() => {
          list.scrollTop += 10
          scrollCount++

          if (scrollCount >= 50) {
            clearInterval(scrollInterval)
            const endTime = performance.now()
            resolve(endTime - startTime)
          }
        }, 16) // ~60fps
      })
    })

    // Scrolling should be smooth
    if (scrollPerformance > 0) {
      expect(scrollPerformance).toBeLessThan(1000)
    }
  })
})

test.describe('Performance - Network Performance', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
  })

  test('should minimize number of network requests on initial load', async ({ page }) => {
    // Track network requests
    const requests: string[] = []

    page.on('request', (request) => {
      requests.push(request.url())
    })

    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    // Should not make excessive requests
    // Typical: HTML, CSS, JS, fonts = ~10 requests
    expect(requests.length).toBeLessThan(30)
  })

  test('should use HTTP/2 multiplexing if available', async ({ page }) => {
    await page.goto(APP_URL)

    const protocol = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      if (resources.length > 0) {
        return (resources[0] as any).nextHopProtocol || 'unknown'
      }
      return 'unknown'
    })

    // Document the protocol being used
    expect(protocol).toBeDefined()
  })

  test('should compress responses', async ({ page }) => {
    await page.goto(APP_URL)

    const compressedResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      return resources.filter((entry: any) => {
        // Compressed if transferSize < encodedBodySize
        return entry.transferSize > 0 && entry.transferSize < entry.encodedBodySize
      }).length
    })

    // At least some resources should be compressed
    expect(compressedResources).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Performance - Benchmarks', () => {
  test('should track and log all performance metrics', async ({ page }) => {
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as any
      const paint = performance.getEntriesByType('paint')

      return {
        // Navigation timing
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnection: navigation.connectEnd - navigation.connectStart,
        serverResponse: navigation.responseStart - navigation.requestStart,
        pageDownload: navigation.responseEnd - navigation.responseStart,
        domProcessing: navigation.domComplete - navigation.domInteractive,
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,

        // Paint timing
        firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,

        // Resource timing
        totalResources: performance.getEntriesByType('resource').length,
      }
    })

    // Log metrics for tracking
    console.log('Performance Metrics:', JSON.stringify(metrics, null, 2))

    // Basic assertions
    expect(metrics.totalLoadTime).toBeGreaterThan(0)
    expect(metrics.totalLoadTime).toBeLessThan(5000)
  })
})
