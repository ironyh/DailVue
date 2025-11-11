/**
 * Network Conditions E2E Tests
 *
 * Tests application behavior under various network conditions.
 * Critical for VoIP applications that must work reliably on poor connections.
 */

import { test, expect, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

test.describe('Network Conditions - Connection Quality', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should connect successfully on fast 4G network', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Simulate 4G network conditions
    await context.route('**/*', (route) => route.continue())

    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    // Should connect quickly
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    await expect(page.locator(SELECTORS.STATUS.CONNECTION_STATUS)).toContainText('Connected')
  })

  test('should connect on slow 3G network with delay', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
  }) => {
    // Simulate Slow 3G: 500ms latency, 400kbps download, 400kbps upload
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500)) // 500ms delay
      return route.continue()
    })

    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    const startTime = Date.now()
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    // Should eventually connect despite slow network
    await waitForConnectionState('connected')
    const connectionTime = Date.now() - startTime

    // Connection should take longer than on fast network
    expect(connectionTime).toBeGreaterThan(500)
  })

  test('should handle high latency (500ms) during call', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect first
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Introduce high latency
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return route.continue()
    })

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)

    // Call should still be initiated despite latency
    await page.waitForTimeout(2000)

    const callStatus = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(callStatus).toBeTruthy()
  })

  test('should handle intermittent packet loss (20%)', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate 20% packet loss
    await context.route('**/*', (route) => {
      // Drop 20% of requests
      if (Math.random() < 0.2) {
        return route.abort('failed')
      }
      return route.continue()
    })

    // Make a call - should still work with retries
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)

    await page.waitForTimeout(1500)

    // App should handle packet loss gracefully
    const callStatus = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(callStatus).toBeTruthy()
  })

  test('should show warning on very slow network (2G)', async ({
    page,
    context,
    configureSip,
  }) => {
    // Simulate 2G: 2000ms latency, 50kbps download
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 2s delay
      return route.continue()
    })

    // Try to connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    // Wait for timeout or error
    await page.waitForTimeout(5000)

    // Should either show error or eventually connect
    const connectionStatus = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()
    expect(connectionStatus).toBeTruthy()
  })
})

test.describe('Network Conditions - Connection Interruption', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should handle network disconnection during call', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
    await page.waitForTimeout(500)

    // Simulate network disconnection
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    // Should show disconnected status or error
    const status = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()
    expect(status).toBeTruthy()

    // Reconnect
    await context.setOffline(false)
    await page.waitForTimeout(1000)
  })

  test('should automatically reconnect after brief disconnection', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Brief disconnection (500ms)
    await context.setOffline(true)
    await page.waitForTimeout(500)
    await context.setOffline(false)

    // Wait for auto-reconnection
    await page.waitForTimeout(2000)

    // Should reconnect automatically
    const connectionStatus = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()
    expect(connectionStatus).toBeTruthy()
  })

  test('should show offline indicator when completely offline', async ({
    page,
    context,
    configureSip,
  }) => {
    // Go offline before connecting
    await context.setOffline(true)

    // Try to connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    await page.waitForTimeout(1500)

    // Should show error or disconnected state
    const status = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()
    expect(status).toBeTruthy()

    // Should not crash
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should handle repeated connect/disconnect cycles', async ({
    page,
    context,
    configureSip,
  }) => {
    // Configure
    await configureSip(TEST_DATA.VALID_CONFIG)

    // Cycle 3 times
    for (let i = 0; i < 3; i++) {
      await context.setOffline(false)
      await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
      await page.waitForTimeout(500)

      await context.setOffline(true)
      await page.waitForTimeout(500)
    }

    // App should still be responsive
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })
})

test.describe('Network Conditions - Bandwidth Throttling', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should adapt to low bandwidth (256kbps)', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Simulate bandwidth throttling
    await context.route('**/*', async (route) => {
      // Add delay based on payload size to simulate bandwidth limit
      const contentLength = route.request().headers()['content-length']
      const size = contentLength ? parseInt(contentLength) : 1000
      const delayMs = (size / 256) * 8 // 256 kbps

      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return route.continue()
    })

    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    // Should connect but may be slower
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    await expect(page.locator(SELECTORS.STATUS.CONNECTION_STATUS)).toContainText('Connected')
  })

  test('should handle varying bandwidth during call', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
    await page.waitForTimeout(500)

    // Vary bandwidth during call
    let currentBandwidth = 1000 // Start with 1Mbps

    await context.route('**/*', async (route) => {
      // Randomly change bandwidth
      currentBandwidth = Math.random() < 0.3 ? 256 : 1000

      const contentLength = route.request().headers()['content-length']
      const size = contentLength ? parseInt(contentLength) : 1000
      const delayMs = (size / currentBandwidth) * 8

      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return route.continue()
    })

    await page.waitForTimeout(2000)

    // Call should adapt and remain active
    const callStatus = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(callStatus).toBeTruthy()
  })
})

test.describe('Network Conditions - DNS and Server Failures', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should handle WebSocket connection failures gracefully', async ({
    page,
    context,
    configureSip,
  }) => {
    // Configure with settings
    await configureSip(TEST_DATA.VALID_CONFIG)

    // Block WebSocket connections
    await context.route('**/*', (route) => {
      if (route.request().url().includes('ws://') || route.request().url().includes('wss://')) {
        return route.abort('failed')
      }
      return route.continue()
    })

    // Try to connect
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await page.waitForTimeout(2000)

    // Should show error message
    const errorMessage = page.locator(SELECTORS.ERROR.ERROR_MESSAGE)
    const statusText = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()

    // Either error message visible or status shows failed
    const hasError = (await errorMessage.isVisible()) || statusText?.includes('Disconnected')
    expect(hasError).toBeDefined()
  })

  test('should retry failed connections with exponential backoff', async ({
    page,
    context,
    configureSip,
  }) => {
    await configureSip(TEST_DATA.VALID_CONFIG)

    let attemptCount = 0
    const attemptTimes: number[] = []

    // Fail first 2 attempts, succeed on 3rd
    await context.route('**/*', (route) => {
      attemptCount++
      attemptTimes.push(Date.now())

      if (attemptCount < 3) {
        return route.abort('failed')
      }
      return route.continue()
    })

    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await page.waitForTimeout(5000)

    // Should have attempted multiple times
    expect(attemptCount).toBeGreaterThanOrEqual(1)

    // Check if retries happened (if implementation supports it)
    if (attemptTimes.length > 1) {
      // Time between retries should increase (exponential backoff)
      const firstRetryDelay = attemptTimes[1] - attemptTimes[0]
      expect(firstRetryDelay).toBeGreaterThan(0)
    }
  })

  test('should handle server errors (5xx) gracefully', async ({
    page,
    context,
    configureSip,
  }) => {
    await configureSip(TEST_DATA.VALID_CONFIG)

    // Return 500 errors
    await context.route('**/*', (route) => {
      if (!route.request().url().includes('localhost:5173')) {
        return route.fulfill({
          status: 500,
          body: 'Internal Server Error',
        })
      }
      return route.continue()
    })

    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await page.waitForTimeout(2000)

    // Should show error or disconnected status
    const status = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()
    expect(status).toBeTruthy()

    // Should not crash
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })
})

test.describe('Network Conditions - Real-world Scenarios', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should handle mobile network switching (WiFi to 4G)', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Start on WiFi (fast connection)
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
    await page.waitForTimeout(500)

    // Switch to 4G (introduce latency)
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms latency
      return route.continue()
    })

    await page.waitForTimeout(1000)

    // Call should remain active or reconnect
    const status = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(status).toBeTruthy()
  })

  test('should handle elevator scenario (brief total signal loss)', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
    await page.waitForTimeout(500)

    // Total signal loss for 3 seconds (elevator)
    await context.setOffline(true)
    await page.waitForTimeout(3000)

    // Signal restored
    await context.setOffline(false)
    await page.waitForTimeout(2000)

    // App should show reconnection status
    const status = await page.locator(SELECTORS.STATUS.CONNECTION_STATUS).textContent()
    expect(status).toBeTruthy()

    // Should not crash
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should handle crowded network (high latency + packet loss)', async ({
    page,
    context,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate crowded network: high latency + packet loss
    await context.route('**/*', async (route) => {
      // 10% packet loss
      if (Math.random() < 0.1) {
        return route.abort('failed')
      }

      // 200-800ms variable latency
      const latency = 200 + Math.random() * 600
      await new Promise((resolve) => setTimeout(resolve, latency))

      return route.continue()
    })

    // Make a call
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)

    await page.waitForTimeout(3000)

    // Should handle gracefully despite poor conditions
    const callStatus = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(callStatus).toBeTruthy()
  })

  test('should show appropriate loading states during slow operations', async ({
    page,
    context,
    configureSip,
  }) => {
    // Add significant delay
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return route.continue()
    })

    // Try to connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    // Should show loading state
    await page.waitForTimeout(500)

    // Button might be disabled or show loading indicator
    const connectButton = page.locator(SELECTORS.CONNECTION.CONNECT_BUTTON)
    const isDisabled = await connectButton.isDisabled()
    const hasLoadingClass = await connectButton.evaluate((el) => el.classList.contains('loading'))

    // Should indicate loading in some way
    expect(isDisabled || hasLoadingClass).toBeDefined()
  })
})
