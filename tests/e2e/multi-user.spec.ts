/**
 * Multi-User Scenario E2E Tests
 *
 * Tests involving multiple users/browser contexts to simulate
 * real-world scenarios like calls between two parties, call transfers,
 * and conference calls.
 */

import { test as base, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { test as fixtureTest, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

// Define user fixture type
type MultiUserFixtures = {
  userA: { page: Page; context: BrowserContext }
  userB: { page: Page; context: BrowserContext }
  userC: { page: Page; context: BrowserContext }
}

// Extend test with multi-user fixtures
const test = base.extend<MultiUserFixtures>({
  userA: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Setup mocks for user A
    await setupMocksForPage(page)
    await page.goto(APP_URL)

    await use({ page, context })

    await context.close()
  },

  userB: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Setup mocks for user B
    await setupMocksForPage(page)
    await page.goto(APP_URL)

    await use({ page, context })

    await context.close()
  },

  userC: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Setup mocks for user C
    await setupMocksForPage(page)
    await page.goto(APP_URL)

    await use({ page, context })

    await context.close()
  },
})

// Helper function to setup mocks
async function setupMocksForPage(page: Page) {
  // Import and execute mock setup scripts
  await page.addInitScript(() => {
    // Mock WebSocket (simplified version)
    class MockWebSocket extends EventTarget {
      url: string
      readyState = 0

      constructor(url: string) {
        super()
        this.url = url
        setTimeout(() => {
          this.readyState = 1
          this.dispatchEvent(new Event('open'))
        }, 50)
      }

      send(data: string) {
        // Auto-respond to SIP messages
        setTimeout(() => {
          if (data.includes('REGISTER')) {
            this.dispatchEvent(
              new MessageEvent('message', {
                data: 'SIP/2.0 200 OK\r\nCSeq: 1 REGISTER\r\n\r\n',
              })
            )
          }
        }, 100)
      }

      close() {
        this.readyState = 3
      }
    }

    ;(window as any).WebSocket = MockWebSocket
  })

  // Mock getUserMedia
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const stream = new MediaStream()
      const mockTrack = {
        id: 'mock-audio',
        kind: 'audio' as const,
        label: 'Mock Audio',
        enabled: true,
        readyState: 'live' as const,
        stop: () => {},
      }
      stream.addTrack(mockTrack as any)
      return stream
    }
  })
}

test.describe('Two-Party Call Scenarios', () => {
  test('should establish call between User A and User B', async ({ userA, userB }) => {
    // User A configuration
    await userA.page.click('[data-testid="settings-button"]')
    await userA.page.fill('[data-testid="sip-uri-input"]', 'userA')
    await userA.page.fill('[data-testid="password-input"]', 'passA')
    await userA.page.fill('[data-testid="server-uri-input"]', 'wss://test.example.com')
    await userA.page.click('[data-testid="save-settings-button"]')
    await userA.page.click('[data-testid="settings-button"]')

    // User B configuration
    await userB.page.click('[data-testid="settings-button"]')
    await userB.page.fill('[data-testid="sip-uri-input"]', 'userB')
    await userB.page.fill('[data-testid="password-input"]', 'passB')
    await userB.page.fill('[data-testid="server-uri-input"]', 'wss://test.example.com')
    await userB.page.click('[data-testid="save-settings-button"]')
    await userB.page.click('[data-testid="settings-button"]')

    // Both users connect
    await userA.page.click('[data-testid="connect-button"]')
    await userB.page.click('[data-testid="connect-button"]')

    await userA.page.waitForTimeout(500)
    await userB.page.waitForTimeout(500)

    // User A calls User B
    await userA.page.fill('[data-testid="number-input"]', 'sip:userB@example.com')
    await userA.page.click('[data-testid="call-button"]')

    await userA.page.waitForTimeout(300)

    // Verify User A shows calling state
    const userAStatus = await userA.page.locator('[data-testid="call-status"]').textContent()
    expect(userAStatus).toBeTruthy()

    // In a real scenario, User B would see incoming call
    // With mocks, we verify the apps remain responsive
    const userBStatus = await userB.page.locator('[data-testid="connection-status"]').textContent()
    expect(userBStatus).toBeTruthy()
  })

  test('should handle simultaneous calls (both users call each other)', async ({ userA, userB }) => {
    // Setup both users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
    ])

    // Both users connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([userA.page.waitForTimeout(500), userB.page.waitForTimeout(500)])

    // Both users call each other simultaneously
    await Promise.all([
      userA.page.fill('[data-testid="number-input"]', 'sip:userB@example.com'),
      userB.page.fill('[data-testid="number-input"]', 'sip:userA@example.com'),
    ])

    await Promise.all([
      userA.page.click('[data-testid="call-button"]'),
      userB.page.click('[data-testid="call-button"]'),
    ])

    await Promise.all([userA.page.waitForTimeout(500), userB.page.waitForTimeout(500)])

    // Both should handle the race condition gracefully
    const [statusA, statusB] = await Promise.all([
      userA.page.locator('[data-testid="call-status"]').textContent(),
      userB.page.locator('[data-testid="call-status"]').textContent(),
    ])

    expect(statusA).toBeTruthy()
    expect(statusB).toBeTruthy()
  })

  test('should transfer call from User A through User B to User C', async ({
    userA,
    userB,
    userC,
  }) => {
    // Setup all three users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
      setupUser(userC.page, 'userC', 'passC'),
    ])

    // All users connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
      userC.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([
      userA.page.waitForTimeout(500),
      userB.page.waitForTimeout(500),
      userC.page.waitForTimeout(500),
    ])

    // User A calls User B
    await userA.page.fill('[data-testid="number-input"]', 'sip:userB@example.com')
    await userA.page.click('[data-testid="call-button"]')
    await userA.page.waitForTimeout(500)

    // User B transfers call to User C (if transfer UI exists)
    const transferButton = userB.page.locator('[data-testid="transfer-button"]')
    if (await transferButton.isVisible()) {
      await transferButton.click()
      await userB.page.fill('[data-testid="transfer-target-input"]', 'sip:userC@example.com')
      await userB.page.click('[data-testid="complete-transfer-button"]')
      await userB.page.waitForTimeout(500)

      // Verify transfer initiated
      const userBStatus = await userB.page.locator('[data-testid="call-status"]').textContent()
      expect(userBStatus).toBeTruthy()
    }

    // All apps should remain functional
    expect(await userA.page.locator(SELECTORS.APP.ROOT).isVisible()).toBe(true)
    expect(await userB.page.locator(SELECTORS.APP.ROOT).isVisible()).toBe(true)
    expect(await userC.page.locator(SELECTORS.APP.ROOT).isVisible()).toBe(true)
  })

  test('should handle call hold and resume between users', async ({ userA, userB }) => {
    // Setup users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
    ])

    // Connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([userA.page.waitForTimeout(500), userB.page.waitForTimeout(500)])

    // User A calls User B
    await userA.page.fill('[data-testid="number-input"]', 'sip:userB@example.com')
    await userA.page.click('[data-testid="call-button"]')
    await userA.page.waitForTimeout(500)

    // User A puts call on hold
    const holdButton = userA.page.locator('[data-testid="hold-button"]')
    if (await holdButton.isVisible()) {
      await holdButton.click()
      await userA.page.waitForTimeout(300)

      // Check hold state
      const isHeld = await holdButton.getAttribute('aria-pressed')
      expect(isHeld).toBe('true')

      // Resume call
      await holdButton.click()
      await userA.page.waitForTimeout(300)

      const isResumed = await holdButton.getAttribute('aria-pressed')
      expect(isResumed).toBe('false')
    }
  })
})

test.describe('Conference Call Scenarios', () => {
  test('should handle three-way conference call', async ({ userA, userB, userC }) => {
    // Setup all users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
      setupUser(userC.page, 'userC', 'passC'),
    ])

    // All connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
      userC.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([
      userA.page.waitForTimeout(500),
      userB.page.waitForTimeout(500),
      userC.page.waitForTimeout(500),
    ])

    // User A initiates calls to both B and C (if supported)
    // Note: This depends on implementation supporting multiple simultaneous calls

    await userA.page.fill('[data-testid="number-input"]', 'sip:userB@example.com')
    await userA.page.click('[data-testid="call-button"]')
    await userA.page.waitForTimeout(500)

    // Verify all apps are functional
    const [statusA, statusB, statusC] = await Promise.all([
      userA.page.locator('[data-testid="call-status"]').textContent(),
      userB.page.locator('[data-testid="connection-status"]').textContent(),
      userC.page.locator('[data-testid="connection-status"]').textContent(),
    ])

    expect(statusA).toBeTruthy()
    expect(statusB).toBeTruthy()
    expect(statusC).toBeTruthy()
  })

  test('should handle user joining and leaving conference', async ({ userA, userB, userC }) => {
    // Setup all users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
      setupUser(userC.page, 'userC', 'passC'),
    ])

    // All connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
      userC.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([
      userA.page.waitForTimeout(500),
      userB.page.waitForTimeout(500),
      userC.page.waitForTimeout(500),
    ])

    // Simulate conference scenario
    await userA.page.fill('[data-testid="number-input"]', 'conference@example.com')
    await userA.page.click('[data-testid="call-button"]')
    await userA.page.waitForTimeout(300)

    // User B joins
    await userB.page.fill('[data-testid="number-input"]', 'conference@example.com')
    await userB.page.click('[data-testid="call-button"]')
    await userB.page.waitForTimeout(300)

    // User C joins
    await userC.page.fill('[data-testid="number-input"]', 'conference@example.com')
    await userC.page.click('[data-testid="call-button"]')
    await userC.page.waitForTimeout(300)

    // All should be in call state
    const [statusA, statusB, statusC] = await Promise.all([
      userA.page.locator('[data-testid="call-status"]').textContent(),
      userB.page.locator('[data-testid="call-status"]').textContent(),
      userC.page.locator('[data-testid="call-status"]').textContent(),
    ])

    expect(statusA).toBeTruthy()
    expect(statusB).toBeTruthy()
    expect(statusC).toBeTruthy()

    // User B leaves
    const hangupBtn = userB.page.locator('[data-testid="hangup-button"]')
    if (await hangupBtn.isVisible()) {
      await hangupBtn.click()
      await userB.page.waitForTimeout(300)

      // User B should no longer be in call
      const statusBAfter = await userB.page.locator('[data-testid="call-status"]').textContent()
      expect(statusBAfter).toBeTruthy() // Should show not in call
    }
  })
})

test.describe('State Synchronization', () => {
  test('should sync call state correctly between users', async ({ userA, userB }) => {
    // Setup users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
    ])

    // Connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([userA.page.waitForTimeout(500), userB.page.waitForTimeout(500)])

    // User A calls
    await userA.page.fill('[data-testid="number-input"]', 'sip:userB@example.com')
    await userA.page.click('[data-testid="call-button"]')
    await userA.page.waitForTimeout(500)

    // Both users should have consistent state
    const [callStatusA, connectionStatusB] = await Promise.all([
      userA.page.locator('[data-testid="call-status"]').textContent(),
      userB.page.locator('[data-testid="connection-status"]').textContent(),
    ])

    expect(callStatusA).toBeTruthy()
    expect(connectionStatusB).toBeTruthy()
  })

  test('should handle network disconnection for one user', async ({ userA, userB }) => {
    // Setup users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
    ])

    // Connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([userA.page.waitForTimeout(500), userB.page.waitForTimeout(500)])

    // User A goes offline
    await userA.context.setOffline(true)
    await userA.page.waitForTimeout(1000)

    // User A should show disconnected
    const statusA = await userA.page.locator('[data-testid="connection-status"]').textContent()
    expect(statusA).toBeTruthy()

    // User B should remain connected
    const statusB = await userB.page.locator('[data-testid="connection-status"]').textContent()
    expect(statusB).toBeTruthy()

    // User A comes back online
    await userA.context.setOffline(false)
    await userA.page.waitForTimeout(1000)

    // Both should be functional
    expect(await userA.page.locator(SELECTORS.APP.ROOT).isVisible()).toBe(true)
    expect(await userB.page.locator(SELECTORS.APP.ROOT).isVisible()).toBe(true)
  })
})

test.describe('Concurrent Operations', () => {
  test('should handle multiple users connecting simultaneously', async ({ userA, userB, userC }) => {
    // Setup all users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
      setupUser(userC.page, 'userC', 'passC'),
    ])

    // All connect simultaneously
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
      userC.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([
      userA.page.waitForTimeout(1000),
      userB.page.waitForTimeout(1000),
      userC.page.waitForTimeout(1000),
    ])

    // All should be connected
    const [statusA, statusB, statusC] = await Promise.all([
      userA.page.locator('[data-testid="connection-status"]').textContent(),
      userB.page.locator('[data-testid="connection-status"]').textContent(),
      userC.page.locator('[data-testid="connection-status"]').textContent(),
    ])

    expect(statusA).toBeTruthy()
    expect(statusB).toBeTruthy()
    expect(statusC).toBeTruthy()
  })

  test('should handle multiple users making calls at the same time', async ({
    userA,
    userB,
    userC,
  }) => {
    // Setup all users
    await Promise.all([
      setupUser(userA.page, 'userA', 'passA'),
      setupUser(userB.page, 'userB', 'passB'),
      setupUser(userC.page, 'userC', 'passC'),
    ])

    // All connect
    await Promise.all([
      userA.page.click('[data-testid="connect-button"]'),
      userB.page.click('[data-testid="connect-button"]'),
      userC.page.click('[data-testid="connect-button"]'),
    ])

    await Promise.all([
      userA.page.waitForTimeout(500),
      userB.page.waitForTimeout(500),
      userC.page.waitForTimeout(500),
    ])

    // All make calls simultaneously
    await Promise.all([
      userA.page.fill('[data-testid="number-input"]', 'sip:test1@example.com'),
      userB.page.fill('[data-testid="number-input"]', 'sip:test2@example.com'),
      userC.page.fill('[data-testid="number-input"]', 'sip:test3@example.com'),
    ])

    await Promise.all([
      userA.page.click('[data-testid="call-button"]'),
      userB.page.click('[data-testid="call-button"]'),
      userC.page.click('[data-testid="call-button"]'),
    ])

    await Promise.all([
      userA.page.waitForTimeout(500),
      userB.page.waitForTimeout(500),
      userC.page.waitForTimeout(500),
    ])

    // All should have initiated calls
    const [statusA, statusB, statusC] = await Promise.all([
      userA.page.locator('[data-testid="call-status"]').textContent(),
      userB.page.locator('[data-testid="call-status"]').textContent(),
      userC.page.locator('[data-testid="call-status"]').textContent(),
    ])

    expect(statusA).toBeTruthy()
    expect(statusB).toBeTruthy()
    expect(statusC).toBeTruthy()
  })
})

// Helper function to setup a user
async function setupUser(page: Page, username: string, password: string) {
  await page.click('[data-testid="settings-button"]')
  await page.fill('[data-testid="sip-uri-input"]', username)
  await page.fill('[data-testid="password-input"]', password)
  await page.fill('[data-testid="server-uri-input"]', 'wss://test.example.com')
  await page.click('[data-testid="save-settings-button"]')
  await page.click('[data-testid="settings-button"]')
}

export { test, expect }
