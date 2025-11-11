/**
 * E2E Tests for Basic Call Flow
 *
 * Tests real-world user scenarios using Playwright
 */

import { test, expect } from '@playwright/test'
import { APP_URL } from './fixtures'

test.describe('Basic Call Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo/test page
    await page.goto(APP_URL)
  })

  test('should display the SIP client interface', async ({ page }) => {
    // Check that the main interface elements are present
    await expect(page.locator('[data-testid="sip-client"]')).toBeVisible()
  })

  test('should show connection status', async ({ page }) => {
    // Check initial connection status
    const status = page.locator('[data-testid="connection-status"]')
    await expect(status).toBeVisible()
    await expect(status).toHaveText(/disconnected|connected/i)
  })

  test('should allow user to configure SIP settings', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="settings-button"]')

    // Fill in SIP configuration
    await page.fill('[data-testid="sip-uri-input"]', 'sip:testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword')
    await page.fill('[data-testid="server-uri-input"]', 'wss://sip.example.com:7443')

    // Save settings
    await page.click('[data-testid="save-settings-button"]')

    // Verify settings were saved
    await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible()
  })

  test('should connect to SIP server', async ({ page }) => {
    // Configure SIP settings first
    await page.click('[data-testid="settings-button"]')
    await page.fill('[data-testid="sip-uri-input"]', 'sip:testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword')
    await page.fill('[data-testid="server-uri-input"]', 'wss://sip.example.com:7443')
    await page.click('[data-testid="save-settings-button"]')

    // Click connect button
    await page.click('[data-testid="connect-button"]')

    // Wait for connection
    await page.waitForSelector('[data-testid="connection-status"]', {
      state: 'visible',
      timeout: 10000,
    })

    // Verify connected status
    const status = page.locator('[data-testid="connection-status"]')
    await expect(status).toHaveText(/connected|registered/i)
  })

  test('should make an outgoing call', async ({ page }) => {
    // Assume connected and registered state
    // In a real test, you'd connect first

    // Enter phone number
    await page.fill('[data-testid="dialpad-input"]', 'sip:destination@example.com')

    // Click call button
    await page.click('[data-testid="call-button"]')

    // Verify call is in progress
    await expect(page.locator('[data-testid="active-call"]')).toBeVisible()
    await expect(page.locator('[data-testid="call-status"]')).toHaveText(/calling|ringing/i)
  })

  test('should answer an incoming call', async ({ page }) => {
    // Wait for incoming call notification
    await page.waitForSelector('[data-testid="incoming-call-notification"]', {
      state: 'visible',
      timeout: 30000,
    })

    // Click answer button
    await page.click('[data-testid="answer-button"]')

    // Verify call is active
    await expect(page.locator('[data-testid="active-call"]')).toBeVisible()
    await expect(page.locator('[data-testid="call-status"]')).toHaveText(/active|connected/i)
  })

  test('should end a call', async ({ page }) => {
    // Assume active call state

    // Click hangup button
    await page.click('[data-testid="hangup-button"]')

    // Verify call ended
    await expect(page.locator('[data-testid="active-call"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="call-status"]')).toHaveText(/idle|ready/i)
  })

  test('should send DTMF tones during call', async ({ page }) => {
    // Assume active call state

    // Click dialpad button to show DTMF pad
    await page.click('[data-testid="dialpad-toggle"]')

    // Send DTMF tones
    await page.click('[data-testid="dtmf-1"]')
    await page.click('[data-testid="dtmf-2"]')
    await page.click('[data-testid="dtmf-3"]')

    // Verify DTMF tones were sent (check feedback)
    await expect(page.locator('[data-testid="dtmf-feedback"]')).toHaveText(/123/)
  })

  test('should hold and unhold call', async ({ page }) => {
    // Assume active call state

    // Click hold button
    await page.click('[data-testid="hold-button"]')

    // Verify call is on hold
    await expect(page.locator('[data-testid="call-status"]')).toHaveText(/hold/i)

    // Click unhold button
    await page.click('[data-testid="unhold-button"]')

    // Verify call is active again
    await expect(page.locator('[data-testid="call-status"]')).toHaveText(/active/i)
  })

  test('should transfer call', async ({ page }) => {
    // Assume active call state

    // Click transfer button
    await page.click('[data-testid="transfer-button"]')

    // Enter transfer destination
    await page.fill('[data-testid="transfer-input"]', 'sip:transfer@example.com')

    // Confirm transfer
    await page.click('[data-testid="confirm-transfer-button"]')

    // Verify transfer initiated
    await expect(page.locator('[data-testid="transfer-status"]')).toHaveText(/transferring/i)
  })

  test('should show call history', async ({ page }) => {
    // Click call history button
    await page.click('[data-testid="call-history-button"]')

    // Verify call history is visible
    await expect(page.locator('[data-testid="call-history-panel"]')).toBeVisible()

    // Verify history entries
    const entries = page.locator('[data-testid="history-entry"]')
    await expect(entries).not.toHaveCount(0)
  })

  test('should handle multiple calls', async ({ page }) => {
    // First call
    await page.fill('[data-testid="dialpad-input"]', 'sip:call1@example.com')
    await page.click('[data-testid="call-button"]')

    // Wait for first call to be active
    await page.waitForSelector('[data-testid="active-call-1"]')

    // Put first call on hold
    await page.click('[data-testid="hold-button"]')

    // Second call
    await page.fill('[data-testid="dialpad-input"]', 'sip:call2@example.com')
    await page.click('[data-testid="call-button"]')

    // Verify two calls are shown
    await expect(page.locator('[data-testid="active-call-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="active-call-2"]')).toBeVisible()
  })

  test('should toggle audio/video during call', async ({ page }) => {
    // Assume active call with audio/video

    // Toggle audio mute
    await page.click('[data-testid="mute-audio-button"]')
    await expect(page.locator('[data-testid="audio-status"]')).toHaveText(/muted/i)

    // Toggle audio unmute
    await page.click('[data-testid="mute-audio-button"]')
    await expect(page.locator('[data-testid="audio-status"]')).toHaveText(/unmuted/i)

    // Toggle video
    await page.click('[data-testid="toggle-video-button"]')
    await expect(page.locator('[data-testid="video-status"]')).toHaveText(/disabled/i)
  })

  test('should display error messages', async ({ page }) => {
    // Try to make call without connection
    await page.fill('[data-testid="dialpad-input"]', 'sip:destination@example.com')
    await page.click('[data-testid="call-button"]')

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/not connected/i)
  })

  test('should handle network disconnection', async ({ page }) => {
    // Assume connected state

    // Simulate network disconnection
    await page.context().setOffline(true)

    // Verify disconnection is detected
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText(
      /disconnected/i,
      { timeout: 10000 }
    )

    // Restore network
    await page.context().setOffline(false)

    // Verify auto-reconnect
    await page.click('[data-testid="connect-button"]')
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText(/connected/i, {
      timeout: 10000,
    })
  })
})

test.describe('Media Device Management', () => {
  test('should list available audio devices', async ({ page }) => {
    await page.goto(APP_URL)

    // Open device settings
    await page.click('[data-testid="device-settings-button"]')

    // Verify audio device list
    await expect(page.locator('[data-testid="audio-input-devices"]')).toBeVisible()
    await expect(page.locator('[data-testid="audio-output-devices"]')).toBeVisible()
  })

  test('should change audio device during call', async ({ page }) => {
    // Assume active call

    // Open device settings
    await page.click('[data-testid="device-settings-button"]')

    // Select different device
    await page.selectOption('[data-testid="audio-input-select"]', { index: 1 })

    // Verify device changed
    await expect(page.locator('[data-testid="device-changed-message"]')).toBeVisible()
  })
})

test.describe('Registration and Authentication', () => {
  test('should handle registration failure', async ({ page }) => {
    await page.goto(APP_URL)

    // Configure with invalid credentials
    await page.click('[data-testid="settings-button"]')
    await page.fill('[data-testid="sip-uri-input"]', 'sip:invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="save-settings-button"]')

    // Try to connect
    await page.click('[data-testid="connect-button"]')

    // Verify error
    await expect(page.locator('[data-testid="registration-error"]')).toBeVisible()
  })

  test('should unregister on disconnect', async ({ page }) => {
    // Assume connected and registered state

    // Click disconnect
    await page.click('[data-testid="disconnect-button"]')

    // Verify unregistered
    await expect(page.locator('[data-testid="registration-status"]')).toHaveText(
      /unregistered/i
    )
  })
})
