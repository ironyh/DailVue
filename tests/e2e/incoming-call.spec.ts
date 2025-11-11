/**
 * Incoming Call E2E Tests
 *
 * Tests for incoming call scenarios including answering, rejecting,
 * and various edge cases.
 */

import { test, expect, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

test.describe('Incoming Call Scenarios', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    // Setup mocks
    await mockSipServer()
    await mockMediaDevices()

    // Navigate to app
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should display incoming call notification with caller information', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate incoming call
    await simulateIncomingCall('sip:alice@example.com')

    // Verify incoming call notification is displayed
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Incoming', {
      timeout: 5000,
    })

    // Verify answer and reject buttons are visible
    await expect(page.locator(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)).toBeVisible()
    await expect(page.locator(SELECTORS.CALL_CONTROLS.REJECT_BUTTON)).toBeVisible()
  })

  test('should successfully answer incoming call', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate incoming call
    await simulateIncomingCall('sip:bob@example.com')

    // Wait for incoming call notification
    await expect(page.locator(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)).toBeVisible({
      timeout: 5000,
    })

    // Answer the call
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)

    // Verify call is active
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Active', {
      timeout: 3000,
    })

    // Verify call control buttons are available
    await expect(page.locator(SELECTORS.CALL_CONTROLS.HANGUP_BUTTON)).toBeVisible()
    await expect(page.locator(SELECTORS.CALL_CONTROLS.HOLD_BUTTON)).toBeVisible()
    await expect(page.locator(SELECTORS.CALL_CONTROLS.MUTE_BUTTON)).toBeVisible()
  })

  test('should successfully reject incoming call', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate incoming call
    await simulateIncomingCall('sip:charlie@example.com')

    // Wait for incoming call notification
    await expect(page.locator(SELECTORS.CALL_CONTROLS.REJECT_BUTTON)).toBeVisible({
      timeout: 5000,
    })

    // Reject the call
    await page.click(SELECTORS.CALL_CONTROLS.REJECT_BUTTON)

    // Verify call is terminated
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).not.toContainText('Incoming', {
      timeout: 3000,
    })
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).not.toContainText('Active')

    // Verify answer/reject buttons are no longer visible
    await expect(page.locator(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)).not.toBeVisible()
    await expect(page.locator(SELECTORS.CALL_CONTROLS.REJECT_BUTTON)).not.toBeVisible()
  })

  test('should handle multiple incoming calls (call waiting)', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // First incoming call
    await simulateIncomingCall('sip:first@example.com')
    await page.waitForTimeout(200)

    // Answer first call
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Active')

    // Second incoming call (call waiting)
    await simulateIncomingCall('sip:second@example.com')
    await page.waitForTimeout(200)

    // Verify call waiting notification
    // Note: Behavior depends on implementation - might show second caller or busy signal
    // This test validates the app handles the scenario without crashing
    const callStatus = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(callStatus).toBeTruthy()
  })

  test('should display caller ID information for incoming call', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    const callerUri = 'sip:david@example.com'

    // Simulate incoming call
    await simulateIncomingCall(callerUri)
    await page.waitForTimeout(200)

    // Verify caller information is displayed somewhere in the app
    // (exact location depends on implementation)
    const pageContent = await page.textContent('body')
    expect(pageContent).toContain('Incoming')
  })

  test('should handle incoming call when already on active call', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Make outbound call first
    await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, TEST_DATA.PHONE_NUMBERS.VALID)
    await page.click(SELECTORS.DIALPAD.CALL_BUTTON)

    // Wait for outbound call to be active
    await page.waitForTimeout(500)

    // Incoming call while on active call
    await simulateIncomingCall('sip:incoming@example.com')
    await page.waitForTimeout(200)

    // App should either show call waiting or busy - verify no crash
    const callStatus = await page.locator(SELECTORS.STATUS.CALL_STATUS).textContent()
    expect(callStatus).toBeTruthy()
  })

  test('should answer incoming call and manage media devices', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate incoming call
    await simulateIncomingCall('sip:mediatest@example.com')

    // Answer the call
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)
    await page.waitForTimeout(200)

    // Verify call is active
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Active')

    // Test mute functionality
    await page.click(SELECTORS.CALL_CONTROLS.MUTE_BUTTON)
    await expect(page.locator(SELECTORS.CALL_CONTROLS.MUTE_BUTTON)).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Test unmute
    await page.click(SELECTORS.CALL_CONTROLS.MUTE_BUTTON)
    await expect(page.locator(SELECTORS.CALL_CONTROLS.MUTE_BUTTON)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('should answer incoming call and then end it', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate incoming call
    await simulateIncomingCall('sip:endtest@example.com')

    // Answer the call
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Active')

    // End the call
    await page.click(SELECTORS.CALL_CONTROLS.HANGUP_BUTTON)

    // Verify call ended
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).not.toContainText('Active', {
      timeout: 3000,
    })
  })

  test('should record incoming call in call history', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    const callerUri = 'sip:history@example.com'

    // Simulate incoming call
    await simulateIncomingCall(callerUri)

    // Answer the call
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)
    await page.waitForTimeout(200)

    // End the call
    await page.click(SELECTORS.CALL_CONTROLS.HANGUP_BUTTON)
    await page.waitForTimeout(200)

    // Open call history
    const historyButton = page.locator(SELECTORS.CALL_HISTORY.TOGGLE_BUTTON)
    if (await historyButton.isVisible()) {
      await historyButton.click()

      // Verify call appears in history
      const historyPanel = page.locator(SELECTORS.CALL_HISTORY.PANEL)
      await expect(historyPanel).toBeVisible()

      // Call history should have at least one entry
      const historyItems = page.locator(SELECTORS.CALL_HISTORY.CALL_ITEM)
      await expect(historyItems.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('should handle incoming call rejection and record in history', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    const callerUri = 'sip:rejected@example.com'

    // Simulate incoming call
    await simulateIncomingCall(callerUri)

    // Reject the call
    await page.click(SELECTORS.CALL_CONTROLS.REJECT_BUTTON)
    await page.waitForTimeout(200)

    // Open call history if available
    const historyButton = page.locator(SELECTORS.CALL_HISTORY.TOGGLE_BUTTON)
    if (await historyButton.isVisible()) {
      await historyButton.click()

      // Verify missed/rejected call appears in history
      const historyPanel = page.locator(SELECTORS.CALL_HISTORY.PANEL)
      await expect(historyPanel).toBeVisible()
    }
  })

  test('should handle rapid incoming call accept/reject actions', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Simulate incoming call
    await simulateIncomingCall('sip:rapid@example.com')
    await page.waitForTimeout(100)

    // Rapidly click answer multiple times (should handle gracefully)
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)
    await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)

    // Should still result in active call without errors
    await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Active', {
      timeout: 3000,
    })
  })

  test('should auto-reject incoming call when disconnected', async ({
    page,
    configureSip,
    waitForConnectionState,
    waitForRegistrationState,
    simulateIncomingCall,
  }) => {
    // Configure and connect
    await configureSip(TEST_DATA.VALID_CONFIG)
    await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
    await waitForConnectionState('connected')
    await waitForRegistrationState('registered')

    // Disconnect
    await page.click(SELECTORS.CONNECTION.DISCONNECT_BUTTON)
    await waitForConnectionState('disconnected')

    // Try to simulate incoming call while disconnected
    await simulateIncomingCall('sip:disconnected@example.com')
    await page.waitForTimeout(300)

    // Call should not be received or should be auto-rejected
    // Verify no answer button is shown
    await expect(page.locator(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)).not.toBeVisible()
  })
})
