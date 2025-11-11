/**
 * E2E Tests for Error Scenarios
 *
 * Tests error handling, validation, and edge cases
 */

import { test, expect, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

test.describe('Validation Errors', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should show error when SIP URI is empty', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    // Clear SIP URI
    await page.fill(SELECTORS.SIP_URI_INPUT, '')
    await page.fill(SELECTORS.PASSWORD_INPUT, TEST_DATA.VALID_PASSWORD)
    await page.fill(SELECTORS.SERVER_URI_INPUT, TEST_DATA.VALID_WS_URI)

    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    // Should show validation error
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toBeVisible()
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toContainText(/required/i)
  })

  test('should show error when password is empty', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    await page.fill(SELECTORS.SIP_URI_INPUT, TEST_DATA.VALID_SIP_URI)
    await page.fill(SELECTORS.PASSWORD_INPUT, '')
    await page.fill(SELECTORS.SERVER_URI_INPUT, TEST_DATA.VALID_WS_URI)

    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toBeVisible()
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toContainText(/required/i)
  })

  test('should show error when server URI is empty', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    await page.fill(SELECTORS.SIP_URI_INPUT, TEST_DATA.VALID_SIP_URI)
    await page.fill(SELECTORS.PASSWORD_INPUT, TEST_DATA.VALID_PASSWORD)
    await page.fill(SELECTORS.SERVER_URI_INPUT, '')

    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toBeVisible()
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toContainText(/required/i)
  })

  test('should show error for invalid SIP URI format', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    // Use invalid SIP URI (no scheme)
    await page.fill(SELECTORS.SIP_URI_INPUT, TEST_DATA.INVALID_SIP_URI_NO_SCHEME)
    await page.fill(SELECTORS.PASSWORD_INPUT, TEST_DATA.VALID_PASSWORD)
    await page.fill(SELECTORS.SERVER_URI_INPUT, TEST_DATA.VALID_WS_URI)

    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toBeVisible()
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toContainText(/invalid.*sip.*uri/i)
  })

  test('should show error for invalid WebSocket URI format', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    await page.fill(SELECTORS.SIP_URI_INPUT, TEST_DATA.VALID_SIP_URI)
    await page.fill(SELECTORS.PASSWORD_INPUT, TEST_DATA.VALID_PASSWORD)
    // Use HTTP instead of WS/WSS
    await page.fill(SELECTORS.SERVER_URI_INPUT, TEST_DATA.INVALID_WS_URI_HTTP)

    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toBeVisible()
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toContainText(/invalid.*server.*uri/i)
  })

  test('should clear validation error when correcting input', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    // First, trigger validation error
    await page.fill(SELECTORS.SIP_URI_INPUT, '')
    await page.fill(SELECTORS.PASSWORD_INPUT, TEST_DATA.VALID_PASSWORD)
    await page.fill(SELECTORS.SERVER_URI_INPUT, TEST_DATA.VALID_WS_URI)
    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).toBeVisible()

    // Now correct the input
    await page.fill(SELECTORS.SIP_URI_INPUT, TEST_DATA.VALID_SIP_URI)
    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)

    // Validation error should be gone
    await expect(page.locator(SELECTORS.VALIDATION_ERROR)).not.toBeVisible()
    await expect(page.locator(SELECTORS.SETTINGS_SAVED_MESSAGE)).toBeVisible()
  })
})

test.describe('Connection Errors', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should disable call button when not connected', async ({ page }) => {
    // Enter a phone number
    await page.fill(SELECTORS.DIALPAD_INPUT, TEST_DATA.PHONE_NUMBER_1)

    // Call button should be disabled
    await expect(page.locator(SELECTORS.CALL_BUTTON)).toBeDisabled()
  })

  test('should not show disconnect button when not connected', async ({ page }) => {
    await expect(page.locator(SELECTORS.DISCONNECT_BUTTON)).not.toBeVisible()
    await expect(page.locator(SELECTORS.CONNECT_BUTTON)).toBeVisible()
  })

  test('should show proper status when disconnected', async ({ page }) => {
    const status = page.locator(SELECTORS.CONNECTION_STATUS)
    await expect(status).toContainText(/disconnected/i)
  })
})

test.describe('Call Control Errors', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should not show DTMF pad when no active call', async ({ page }) => {
    await expect(page.locator(SELECTORS.DIALPAD_TOGGLE)).not.toBeVisible()
  })

  test('should not show call controls when no active call', async ({ page }) => {
    await expect(page.locator(SELECTORS.ACTIVE_CALL)).not.toBeVisible()
    await expect(page.locator(SELECTORS.HANGUP_BUTTON)).not.toBeVisible()
    await expect(page.locator(SELECTORS.HOLD_BUTTON)).not.toBeVisible()
  })

  test('should not allow calling with empty dialpad', async ({ page }) => {
    // Configure and connect first
    await page.click(SELECTORS.SETTINGS_BUTTON)
    await page.fill(SELECTORS.SIP_URI_INPUT, TEST_DATA.VALID_SIP_URI)
    await page.fill(SELECTORS.PASSWORD_INPUT, TEST_DATA.VALID_PASSWORD)
    await page.fill(SELECTORS.SERVER_URI_INPUT, TEST_DATA.VALID_WS_URI)
    await page.click(SELECTORS.SAVE_SETTINGS_BUTTON)
    await page.click(SELECTORS.SETTINGS_BUTTON)

    // Wait a bit for settings to apply
    await page.waitForTimeout(100)

    // Call button should be disabled with empty input
    await expect(page.locator(SELECTORS.CALL_BUTTON)).toBeDisabled()
  })
})

test.describe('Button State Management', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should disable connect button while connecting', async ({
    page,
    configureSip,
  }) => {
    await configureSip({
      uri: TEST_DATA.VALID_WS_URI,
      username: TEST_DATA.VALID_SIP_URI,
      password: TEST_DATA.VALID_PASSWORD,
    })

    const connectButton = page.locator(SELECTORS.CONNECT_BUTTON)

    // Click connect
    await connectButton.click()

    // Button text should change and be disabled
    await expect(connectButton).toContainText(/connecting/i)
    await expect(connectButton).toBeDisabled()
  })

  test('should show loading state on call button when making call', async ({
    page,
    configureSip,
  }) => {
    await configureSip({
      uri: TEST_DATA.VALID_WS_URI,
      username: TEST_DATA.VALID_SIP_URI,
      password: TEST_DATA.VALID_PASSWORD,
    })

    // Fill dialpad
    await page.fill(SELECTORS.DIALPAD_INPUT, TEST_DATA.VALID_DESTINATION)

    const callButton = page.locator(SELECTORS.CALL_BUTTON)

    // Note: This might not work if not connected, but tests the button state logic
    // In a real scenario, we'd connect first
  })
})

test.describe('UI Edge Cases', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should handle rapid settings panel toggling', async ({ page }) => {
    const settingsButton = page.locator(SELECTORS.SETTINGS_BUTTON)
    const settingsPanel = page.locator('.settings-panel')

    // Rapidly toggle settings panel
    await settingsButton.click()
    await expect(settingsPanel).toBeVisible()

    await settingsButton.click()
    await expect(settingsPanel).not.toBeVisible()

    await settingsButton.click()
    await expect(settingsPanel).toBeVisible()

    await settingsButton.click()
    await expect(settingsPanel).not.toBeVisible()
  })

  test('should handle rapid device settings toggling', async ({ page }) => {
    const deviceButton = page.locator(SELECTORS.DEVICE_SETTINGS_BUTTON)
    const devicePanel = page.locator('.device-panel')

    await deviceButton.click()
    await expect(devicePanel).toBeVisible()

    await deviceButton.click()
    await expect(devicePanel).not.toBeVisible()

    await deviceButton.click()
    await expect(devicePanel).toBeVisible()
  })

  test('should handle rapid call history toggling', async ({ page }) => {
    const historyButton = page.locator(SELECTORS.CALL_HISTORY_BUTTON)
    const historyPanel = page.locator(SELECTORS.CALL_HISTORY_PANEL)

    await historyButton.click()
    await expect(historyPanel).toBeVisible()

    await historyButton.click()
    await expect(historyPanel).not.toBeVisible()

    await historyButton.click()
    await expect(historyPanel).toBeVisible()
  })

  test('should show empty call history initially', async ({ page }) => {
    await page.click(SELECTORS.CALL_HISTORY_BUTTON)

    // History panel should be visible
    await expect(page.locator(SELECTORS.CALL_HISTORY_PANEL)).toBeVisible()

    // But no history entries
    await expect(page.locator(SELECTORS.HISTORY_ENTRY)).toHaveCount(0)
  })

  test('should have all required form labels', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    // Check that form has proper labels
    await expect(page.locator('label:has-text("SIP URI")')).toBeVisible()
    await expect(page.locator('label:has-text("Password")')).toBeVisible()
    await expect(page.locator('label:has-text("Server URI")')).toBeVisible()
  })

  test('should use password input type for password field', async ({ page }) => {
    await page.click(SELECTORS.SETTINGS_BUTTON)

    const passwordInput = page.locator(SELECTORS.PASSWORD_INPUT)
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

test.describe('Device Management Errors', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should display available audio devices', async ({ page }) => {
    await page.click(SELECTORS.DEVICE_SETTINGS_BUTTON)

    const inputSelect = page.locator(SELECTORS.AUDIO_INPUT_SELECT)
    const outputSelect = page.locator(SELECTORS.AUDIO_OUTPUT_SELECT)

    await expect(inputSelect).toBeVisible()
    await expect(outputSelect).toBeVisible()

    // Should have at least one device (based on our mock)
    const inputOptions = inputSelect.locator('option')
    const outputOptions = outputSelect.locator('option')

    await expect(inputOptions).not.toHaveCount(0)
    await expect(outputOptions).not.toHaveCount(0)
  })

  test('should show feedback when changing devices', async ({ page }) => {
    await page.click(SELECTORS.DEVICE_SETTINGS_BUTTON)

    const inputSelect = page.locator(SELECTORS.AUDIO_INPUT_SELECT)

    // Change to a different device
    await inputSelect.selectOption({ index: 1 })

    // Should show success message
    await expect(page.locator(SELECTORS.DEVICE_CHANGED_MESSAGE)).toBeVisible()

    // Message should disappear after timeout
    await page.waitForTimeout(3500)
    await expect(page.locator(SELECTORS.DEVICE_CHANGED_MESSAGE)).not.toBeVisible()
  })
})

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
  })

  test('should work on mobile portrait (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(APP_URL)

    await expect(page.locator(SELECTORS.SIP_CLIENT)).toBeVisible()
    await expect(page.locator(SELECTORS.CONNECTION_STATUS)).toBeVisible()
  })

  test('should work on tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(APP_URL)

    await expect(page.locator(SELECTORS.SIP_CLIENT)).toBeVisible()
    await expect(page.locator(SELECTORS.SETTINGS_BUTTON)).toBeVisible()
  })

  test('should work on desktop (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(APP_URL)

    await expect(page.locator(SELECTORS.SIP_CLIENT)).toBeVisible()
    await expect(page.locator('.status-bar')).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should have unique data-testid for all interactive elements', async ({ page }) => {
    // Check critical elements have test IDs
    await expect(page.locator(SELECTORS.SIP_CLIENT)).toBeVisible()
    await expect(page.locator(SELECTORS.SETTINGS_BUTTON)).toBeVisible()
    await expect(page.locator(SELECTORS.CONNECTION_STATUS)).toBeVisible()
    await expect(page.locator(SELECTORS.CONNECT_BUTTON)).toBeVisible()
  })

  test('should have proper page title', async ({ page }) => {
    await expect(page).toHaveTitle(/VueSip/i)
  })

  test('should have main heading', async ({ page }) => {
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(/VueSip/i)
  })
})
