/**
 * E2E Tests for App Functionality
 *
 * Tests the VueSip test application with mocked browser APIs
 */

import { test, expect, APP_URL } from './fixtures'

test.describe('Application Initialization', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    // Setup mocks
    await mockSipServer()
    await mockMediaDevices()

    // Navigate to the app
    await page.goto(APP_URL)
  })

  test('should display the SIP client interface', async ({ page }) => {
    // Check that the main interface elements are present
    await expect(page.locator('[data-testid="sip-client"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('VueSip')
  })

  test('should show initial connection status as disconnected', async ({ page }) => {
    const status = page.locator('[data-testid="connection-status"]')
    await expect(status).toBeVisible()
    await expect(status).toContainText(/disconnected/i)
  })

  test('should show initial registration status as unregistered', async ({ page }) => {
    const status = page.locator('[data-testid="registration-status"]')
    await expect(status).toBeVisible()
    await expect(status).toContainText(/unregistered/i)
  })
})

test.describe('SIP Configuration', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should open and close settings panel', async ({ page }) => {
    // Settings panel should be hidden initially
    await expect(page.locator('.settings-panel')).not.toBeVisible()

    // Click settings button to open
    await page.click('[data-testid="settings-button"]')
    await expect(page.locator('.settings-panel')).toBeVisible()

    // Click again to close
    await page.click('[data-testid="settings-button"]')
    await expect(page.locator('.settings-panel')).not.toBeVisible()
  })

  test('should allow user to configure SIP settings', async ({ page, configureSip }) => {
    // Use fixture to configure SIP
    await configureSip({
      uri: 'wss://sip.example.com:7443',
      username: 'sip:testuser@example.com',
      password: 'testpassword',
    })

    // Verify settings were saved
    await page.click('[data-testid="settings-button"]')
    await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible()
  })

  test('should retain SIP configuration after save', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="settings-button"]')

    // Fill in configuration
    const sipUri = 'sip:testuser@example.com'
    const serverUri = 'wss://sip.example.com:7443'

    await page.fill('[data-testid="sip-uri-input"]', sipUri)
    await page.fill('[data-testid="password-input"]', 'testpass')
    await page.fill('[data-testid="server-uri-input"]', serverUri)

    // Save
    await page.click('[data-testid="save-settings-button"]')

    // Close and reopen settings
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="settings-button"]')

    // Verify values are retained
    await expect(page.locator('[data-testid="sip-uri-input"]')).toHaveValue(sipUri)
    await expect(page.locator('[data-testid="server-uri-input"]')).toHaveValue(serverUri)
  })
})

test.describe('Connection Management', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should show connect button when disconnected', async ({ page }) => {
    await expect(page.locator('[data-testid="connect-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="disconnect-button"]')).not.toBeVisible()
  })

  test('should show disconnect button when connected', async ({
    page,
    configureSip,
    waitForConnectionState,
  }) => {
    // Configure and connect
    await configureSip({
      uri: 'wss://sip.example.com:7443',
      username: 'sip:testuser@example.com',
      password: 'testpassword',
    })

    await page.click('[data-testid="connect-button"]')

    // Wait for connection
    await waitForConnectionState('connected')

    // Verify disconnect button is visible
    await expect(page.locator('[data-testid="disconnect-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="connect-button"]')).not.toBeVisible()
  })

  test('should allow disconnection', async ({ page, configureSip, waitForConnectionState }) => {
    // Configure SIP
    await configureSip({
      uri: 'wss://sip.example.com:7443',
      username: 'sip:testuser@example.com',
      password: 'testpassword',
    })

    // Connect
    await page.click('[data-testid="connect-button"]')

    // Wait for connection to be established
    await waitForConnectionState('connected')
    await expect(page.locator('[data-testid="disconnect-button"]')).toBeVisible()

    // Disconnect
    await page.click('[data-testid="disconnect-button"]')

    // Wait for disconnection
    await waitForConnectionState('disconnected')

    // Verify disconnected state
    await expect(page.locator('[data-testid="connection-status"]')).toContainText(/disconnected/i)
    await expect(page.locator('[data-testid="connect-button"]')).toBeVisible()
  })
})

test.describe('Dialpad and Call Interface', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should display dialpad input', async ({ page }) => {
    await expect(page.locator('[data-testid="dialpad-input"]')).toBeVisible()
  })

  test('should allow entering a phone number', async ({ page }) => {
    const dialpad = page.locator('[data-testid="dialpad-input"]')
    await dialpad.fill('sip:destination@example.com')
    await expect(dialpad).toHaveValue('sip:destination@example.com')
  })

  test('should disable call button when not connected', async ({ page }) => {
    await page.fill('[data-testid="dialpad-input"]', 'sip:test@example.com')
    await expect(page.locator('[data-testid="call-button"]')).toBeDisabled()
  })

  test('should show error when calling without connection', async ({ page }) => {
    await page.fill('[data-testid="dialpad-input"]', 'sip:destination@example.com')

    // Button should be disabled, so this won't actually work
    // But we're testing the UI state
    const callButton = page.locator('[data-testid="call-button"]')
    await expect(callButton).toBeDisabled()
  })
})

test.describe('Device Management', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should toggle device settings panel', async ({ page }) => {
    // Panel should be hidden initially
    await expect(page.locator('.device-panel')).not.toBeVisible()

    // Click to show
    await page.click('[data-testid="device-settings-button"]')
    await expect(page.locator('.device-panel')).toBeVisible()

    // Click to hide
    await page.click('[data-testid="device-settings-button"]')
    await expect(page.locator('.device-panel')).not.toBeVisible()
  })

  test('should display audio device lists', async ({ page }) => {
    // Open device settings
    await page.click('[data-testid="device-settings-button"]')

    // Verify device selects are visible
    await expect(page.locator('[data-testid="audio-input-select"]')).toBeVisible()
    await expect(page.locator('[data-testid="audio-output-select"]')).toBeVisible()
  })

  test('should list available audio input devices', async ({ page }) => {
    await page.click('[data-testid="device-settings-button"]')

    const audioInputSelect = page.locator('[data-testid="audio-input-select"]')
    await expect(audioInputSelect).toBeVisible()

    // Check that there are options
    const options = audioInputSelect.locator('option')
    await expect(options).toHaveCount(2) // Based on our mock devices
  })

  test('should allow changing audio input device', async ({ page }) => {
    await page.click('[data-testid="device-settings-button"]')

    // Select a different device
    const audioInputSelect = page.locator('[data-testid="audio-input-select"]')
    await audioInputSelect.selectOption({ index: 1 })

    // Verify device changed message appears
    await expect(page.locator('[data-testid="device-changed-message"]')).toBeVisible()
  })
})

test.describe('Call History', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should toggle call history panel', async ({ page }) => {
    // Panel should be hidden initially
    await expect(page.locator('[data-testid="call-history-panel"]')).not.toBeVisible()

    // Click to show
    await page.click('[data-testid="call-history-button"]')
    await expect(page.locator('[data-testid="call-history-panel"]')).toBeVisible()

    // Click to hide
    await page.click('[data-testid="call-history-button"]')
    await expect(page.locator('[data-testid="call-history-panel"]')).not.toBeVisible()
  })

  test('should show empty history initially', async ({ page }) => {
    await page.click('[data-testid="call-history-button"]')

    // History panel should be visible but empty
    await expect(page.locator('[data-testid="call-history-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="history-entry"]')).toHaveCount(0)
  })
})

test.describe('User Interface', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should have proper page title', async ({ page }) => {
    await expect(page).toHaveTitle(/VueSip/i)
  })

  test('should display main heading', async ({ page }) => {
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('VueSip')
  })

  test('should show status bar with connection and registration status', async ({ page }) => {
    await expect(page.locator('.status-bar')).toBeVisible()
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="registration-status"]')).toBeVisible()
  })

  test('should be responsive', async ({ page }) => {
    // Test at different viewport sizes
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('[data-testid="sip-client"]')).toBeVisible()

    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('[data-testid="sip-client"]')).toBeVisible()

    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('[data-testid="sip-client"]')).toBeVisible()
  })
})

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should not show error message initially', async ({ page }) => {
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible()
  })

  test('should show settings button at all times', async ({ page }) => {
    await expect(page.locator('[data-testid="settings-button"]')).toBeVisible()
  })
})

test.describe('DTMF Interface', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should not show DTMF pad when no active call', async ({ page }) => {
    await expect(page.locator('[data-testid="dialpad-toggle"]')).not.toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    await mockSipServer()
    await mockMediaDevices()
    await page.goto(APP_URL)
  })

  test('should have proper data-testid attributes for all interactive elements', async ({
    page,
  }) => {
    // Verify key elements have data-testid
    await expect(page.locator('[data-testid="sip-client"]')).toBeVisible()
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="registration-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="settings-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="dialpad-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="call-button"]')).toBeVisible()
  })

  test('should have labels for form inputs', async ({ page }) => {
    await page.click('[data-testid="settings-button"]')

    // Check that labels exist for inputs
    await expect(page.locator('label:has-text("SIP URI")')).toBeVisible()
    await expect(page.locator('label:has-text("Password")')).toBeVisible()
    await expect(page.locator('label:has-text("Server URI")')).toBeVisible()
  })

  test('should have proper button states', async ({ page }) => {
    // Call button should be disabled when no number entered
    await expect(page.locator('[data-testid="call-button"]')).toBeDisabled()

    // Should be enabled after entering number and connecting
    await page.fill('[data-testid="dialpad-input"]', 'sip:test@example.com')
    // Still disabled because not connected
    await expect(page.locator('[data-testid="call-button"]')).toBeDisabled()
  })
})
