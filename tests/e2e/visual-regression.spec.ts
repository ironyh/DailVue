/**
 * Visual Regression E2E Tests
 *
 * Tests to ensure UI consistency across changes.
 * Uses Playwright's built-in screenshot comparison.
 */

import { test, expect, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    // Setup mocks
    await mockSipServer()
    await mockMediaDevices()

    // Navigate to app
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should match initial app layout', async ({ page }) => {
    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle')

    // Take screenshot of entire app
    await expect(page).toHaveScreenshot('app-initial-state.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match settings panel layout', async ({ page }) => {
    // Open settings
    await page.click(SELECTORS.SETTINGS.SETTINGS_BUTTON)
    await expect(page.locator(SELECTORS.SETTINGS.SETTINGS_PANEL)).toBeVisible()

    // Take screenshot of settings panel
    await expect(page.locator(SELECTORS.SETTINGS.SETTINGS_PANEL)).toHaveScreenshot(
      'settings-panel.png',
      {
        animations: 'disabled',
      }
    )
  })

  test('should match connected state UI', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Wait for UI to stabilize
    await page.waitForTimeout(500)

    // Take screenshot of connected state
    await expect(page).toHaveScreenshot('app-connected-state.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match dialpad layout', async ({ page }) => {
    // Ensure dialpad is visible
    const dialpad = page.locator('[data-testid="dialpad"]')
    if (await dialpad.isVisible()) {
      await expect(dialpad).toHaveScreenshot('dialpad.png', {
        animations: 'disabled',
      })
    }
  })

  test('should match active call UI', async ({
    page,
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

    // Wait for call to be active (ringing or connected)
    await page.waitForTimeout(500)

    // Take screenshot of active call interface
    await expect(page).toHaveScreenshot('app-active-call.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match DTMF pad layout', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make a call to show DTMF
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
    await page.waitForTimeout(500)

    // Check if DTMF pad is visible
    const dtmfPad = page.locator('[data-testid="dtmf-pad"]')
    if (await dtmfPad.isVisible()) {
      await expect(dtmfPad).toHaveScreenshot('dtmf-pad.png', {
        animations: 'disabled',
      })
    }
  })

  test('should match call history panel', async ({ page }) => {
    // Open call history if available
    const historyButton = page.locator(SELECTORS.CALL_HISTORY.TOGGLE_BUTTON)
    if (await historyButton.isVisible()) {
      await historyButton.click()

      const historyPanel = page.locator(SELECTORS.CALL_HISTORY.PANEL)
      await expect(historyPanel).toBeVisible()

      await expect(historyPanel).toHaveScreenshot('call-history-panel.png', {
        animations: 'disabled',
      })
    }
  })

  test('should match error message display', async ({ page }) => {
    // Try to connect without configuration to trigger error
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

    // Wait for error message
    await page.waitForTimeout(500)

    const errorMessage = page.locator(SELECTORS.ERROR.ERROR_MESSAGE)
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toHaveScreenshot('error-message.png', {
        animations: 'disabled',
      })
    }
  })

  test('should match mobile viewport layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE

    // Wait for responsive layout
    await page.waitForTimeout(300)

    // Take screenshot
    await expect(page).toHaveScreenshot('app-mobile-layout.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match tablet viewport layout', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }) // iPad

    // Wait for responsive layout
    await page.waitForTimeout(300)

    // Take screenshot
    await expect(page).toHaveScreenshot('app-tablet-layout.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match desktop viewport layout', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Wait for responsive layout
    await page.waitForTimeout(300)

    // Take screenshot
    await expect(page).toHaveScreenshot('app-desktop-layout.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match device management panel', async ({ page }) => {
    // Check if device management is accessible
    const deviceButton = page.locator(SELECTORS.DEVICE_MANAGEMENT.TOGGLE_BUTTON)
    if (await deviceButton.isVisible()) {
      await deviceButton.click()

      const devicePanel = page.locator(SELECTORS.DEVICE_MANAGEMENT.DEVICE_PANEL)
      if (await devicePanel.isVisible()) {
        await expect(devicePanel).toHaveScreenshot('device-management-panel.png', {
          animations: 'disabled',
        })
      }
    }
  })

  test('should match call transfer interface', async ({
    page,
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

    // Open transfer interface if available
    const transferButton = page.locator(SELECTORS.CALL_TRANSFER.TRANSFER_BUTTON)
    if (await transferButton.isVisible()) {
      await transferButton.click()

      const transferPanel = page.locator(SELECTORS.CALL_TRANSFER.TRANSFER_PANEL)
      if (await transferPanel.isVisible()) {
        await expect(transferPanel).toHaveScreenshot('call-transfer-panel.png', {
          animations: 'disabled',
        })
      }
    }
  })
})

test.describe('Visual Regression - Theme Support', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should match dark mode if supported', async ({ page }) => {
    // Try to enable dark mode via media query emulation
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(300)

    await expect(page).toHaveScreenshot('app-dark-mode.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match light mode', async ({ page }) => {
    // Ensure light mode
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(300)

    await expect(page).toHaveScreenshot('app-light-mode.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Visual Regression - Accessibility', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should match high contrast mode if supported', async ({ page }) => {
    // Force high contrast mode via preference
    await page.emulateMedia({ forcedColors: 'active' })
    await page.waitForTimeout(300)

    await expect(page).toHaveScreenshot('app-high-contrast.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should match reduced motion mode', async ({ page }) => {
    // Prefer reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(300)

    await expect(page).toHaveScreenshot('app-reduced-motion.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})
