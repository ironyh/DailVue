# E2E Testing Guide

Comprehensive guide for running, writing, and troubleshooting end-to-end tests for VueSip.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Quick Start

### Installation

```bash
# Install dependencies (includes Playwright)
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Run All Tests

```bash
# Run all E2E tests
npm run test:e2e

# Or directly with Playwright
npx playwright test
```

### Run Specific Tests

```bash
# Run specific test file
npx playwright test app-functionality.spec.ts

# Run specific test by name
npx playwright test -g "should display initial interface"

# Run tests in UI mode (interactive)
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed
```

### Debug Tests

```bash
# Debug mode with inspector
npx playwright test --debug

# Debug specific test
npx playwright test -g "test name" --debug
```

## Test Structure

### Test Files

```
tests/e2e/
├── app-functionality.spec.ts    # UI functionality tests (30+ tests)
├── basic-call-flow.spec.ts      # Real call flow scenarios (15+ tests)
├── error-scenarios.spec.ts      # Error handling tests (20+ tests)
├── incoming-call.spec.ts        # Incoming call tests (12 tests)
├── visual-regression.spec.ts    # Visual/screenshot tests (17 tests)
├── fixtures.ts                  # Reusable test utilities and mocks
├── selectors.ts                 # Centralized UI selectors
├── README.md                    # This file
└── VISUAL_TESTING.md           # Visual regression guide
```

### Test Suites Overview

| Suite | Focus | Tests | Coverage |
|-------|-------|-------|----------|
| **app-functionality** | UI interactions with mocked APIs | 30+ | Settings, Dialpad, Devices, History |
| **basic-call-flow** | Real call scenarios | 15+ | Outbound calls, Media, Hold, Transfer |
| **error-scenarios** | Error handling & edge cases | 20+ | Validation, Errors, Responsive |
| **incoming-call** | Incoming call handling | 12 | Answer, Reject, Call waiting |
| **visual-regression** | UI consistency | 17 | Layouts, Themes, Responsive |

**Total:** 94+ comprehensive E2E tests

## Running Tests

### By Browser

```bash
# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Mobile browsers
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### By Category

```bash
# Run only visual tests
npx playwright test visual-regression.spec.ts

# Run only incoming call tests
npx playwright test incoming-call.spec.ts

# Run only error scenarios
npx playwright test error-scenarios.spec.ts
```

### Parallel vs Sequential

```bash
# Parallel (faster, default locally)
npx playwright test --workers=4

# Sequential (one at a time)
npx playwright test --workers=1

# CI mode (sequential, retries enabled)
CI=true npx playwright test
```

### View Results

```bash
# Show HTML report
npx playwright show-report

# Generate and open report
npx playwright test && npx playwright show-report
```

## Writing Tests

### Basic Test Structure

All suites should navigate to the dedicated E2E harness by using the `APP_URL` constant exported from `./fixtures` instead of manually typing `/?test=true`.

```typescript
import { test, expect, APP_URL } from './fixtures'
import { SELECTORS, TEST_DATA } from './selectors'

test.describe('My Feature', () => {
  test.beforeEach(async ({ page, mockSipServer, mockMediaDevices }) => {
    // Setup mocks
    await mockSipServer()
    await mockMediaDevices()

    // Navigate to app
    await page.goto(APP_URL)
    await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
  })

  test('should do something', async ({ page }) => {
    // Arrange
    await page.click(SELECTORS.SETTINGS.SETTINGS_BUTTON)

    // Act
    await page.fill(SELECTORS.SETTINGS.SIP_URI_INPUT, 'sip:test@example.com')

    // Assert
    await expect(page.locator(SELECTORS.SETTINGS.SIP_URI_INPUT)).toHaveValue('sip:test@example.com')
  })
})
```

### Using Custom Fixtures

```typescript
test('should connect to SIP server', async ({
  page,
  configureSip,
  waitForConnectionState,
  waitForRegistrationState,
}) => {
  // Configure SIP settings
  await configureSip({
    uri: 'wss://sip.example.com',
    username: 'testuser',
    password: 'testpass',
  })

  // Connect
  await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)

  // Wait for states
  await waitForConnectionState('connected')
  await waitForRegistrationState('registered')

  // Verify
  await expect(page.locator(SELECTORS.STATUS.CONNECTION_STATUS)).toContainText('Connected')
})
```

### Simulating Incoming Calls

```typescript
test('should handle incoming call', async ({
  page,
  configureSip,
  waitForConnectionState,
  simulateIncomingCall,
}) => {
  // Setup
  await configureSip(TEST_DATA.VALID_CONFIG)
  await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
  await waitForConnectionState('connected')

  // Trigger incoming call
  await simulateIncomingCall('sip:caller@example.com')

  // Verify incoming call UI
  await expect(page.locator(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)).toBeVisible()

  // Answer call
  await page.click(SELECTORS.CALL_CONTROLS.ANSWER_BUTTON)

  // Verify active call
  await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Active')
})
```

### Using Selectors

Always use centralized selectors from `selectors.ts`:

```typescript
// ✅ Good
await page.click(SELECTORS.CALL_CONTROLS.HANGUP_BUTTON)

// ❌ Bad
await page.click('[data-testid="hangup-button"]')
```

### Testing Responsive Layouts

```typescript
test('should work on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 })

  // Test mobile-specific behavior
  await expect(page.locator(SELECTORS.APP.ROOT)).toBeVisible()
})
```

## Troubleshooting

### Common Issues

#### 1. Tests Fail with "Timeout" Errors

**Symptom:** Tests timeout waiting for elements

**Solutions:**

```bash
# Increase timeout globally
npx playwright test --timeout=60000

# Or in test
test('my test', async ({ page }) => {
  test.setTimeout(60000)
  // ...
})

# Check if dev server is running
npm run dev
```

**Debugging:**

```typescript
// Add explicit waits
await page.waitForSelector(SELECTORS.APP.ROOT, { timeout: 10000 })

// Check what's on page
await page.screenshot({ path: 'debug.png' })
console.log(await page.content())
```

#### 2. "Element Not Found" Errors

**Symptom:** `locator.click: Target closed` or element not found

**Solutions:**

```typescript
// Wait for element before interaction
await page.waitForSelector(SELECTORS.SETTINGS.SETTINGS_BUTTON)
await page.click(SELECTORS.SETTINGS.SETTINGS_BUTTON)

// Or use auto-waiting assertions
await expect(page.locator(SELECTORS.SETTINGS.SETTINGS_BUTTON)).toBeVisible()
await page.click(SELECTORS.SETTINGS.SETTINGS_BUTTON)

// Check if element exists
const exists = await page.locator(SELECTORS.SETTINGS.SETTINGS_BUTTON).count()
console.log('Button count:', exists)
```

#### 3. Flaky Tests (Pass/Fail Randomly)

**Common Causes:**

- Race conditions
- Animations not completed
- Network timing
- Async state updates

**Solutions:**

```typescript
// Use explicit waits
await page.waitForLoadState('networkidle')
await page.waitForTimeout(500) // Last resort

// Wait for specific conditions
await page.waitForFunction(() => {
  return document.querySelector('[data-testid="status"]')?.textContent === 'Ready'
})

// Use proper assertions
await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toHaveText('Active', { timeout: 5000 })
```

#### 4. Mock WebSocket Not Working

**Symptom:** Real WebSocket connections attempted

**Solutions:**

```typescript
// Ensure mocks are setup before navigation
test.beforeEach(async ({ page, mockSipServer }) => {
  await mockSipServer() // Call BEFORE goto
  await page.goto(APP_URL)
})

// Check mock is active
await page.evaluate(() => {
  console.log('WebSocket is mocked:', window.WebSocket.name === 'MockWebSocket')
})
```

#### 5. Screenshots Don't Match (Visual Tests)

**Symptom:** Visual regression tests fail

**Solutions:**

```bash
# Update baselines if change is intentional
npx playwright test visual-regression.spec.ts --update-snapshots

# View diffs
npx playwright show-report

# Increase threshold for minor differences
await expect(page).toHaveScreenshot('screenshot.png', {
  maxDiffPixelRatio: 0.05
})
```

#### 6. Tests Pass Locally But Fail in CI

**Common Causes:**

- Different OS rendering
- Missing fonts
- Timing differences
- Missing browser dependencies

**Solutions:**

```bash
# Install browser dependencies
npx playwright install --with-deps

# Match CI environment with Docker
docker run -it --rm mcr.microsoft.com/playwright:latest /bin/bash
```

```typescript
// Use CI-specific timeouts
const timeout = process.env.CI ? 30000 : 10000
await page.waitForSelector(selector, { timeout })
```

#### 7. Dev Server Not Starting

**Symptom:** "Connection refused" or timeout before tests

**Solutions:**

```bash
# Check if port 5173 is available
lsof -i :5173
# Kill process if needed
kill -9 <PID>

# Start dev server manually
npm run dev

# Then run tests without webServer
npx playwright test --config=playwright.config.ts
```

**Or configure different port:**

```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev -- --port 5174',
  url: 'http://localhost:5174',
}
```

### Debug Commands

```bash
# Run with debug output
DEBUG=pw:api npx playwright test

# Trace viewer (detailed execution trace)
npx playwright test --trace=on
npx playwright show-trace trace.zip

# Verbose logging
npx playwright test --reporter=line

# Keep browser open after test
npx playwright test --headed --debug

# Generate test code by interacting with browser
npx playwright codegen http://localhost:5173
```

### Test Isolation Issues

If tests affect each other:

```typescript
// Ensure clean state
test.beforeEach(async ({ page }) => {
  await page.goto(APP_URL) // Fresh page
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(() => sessionStorage.clear())
})

// Or use separate browser contexts
test.use({ storageState: undefined })
```

## CI/CD Integration

Tests automatically run in GitHub Actions on:
- Push to `main`, `develop`, or `claude/**` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

### Workflow Configuration

See `.github/workflows/e2e-tests.yml`

**Features:**
- ✅ Runs on 3 desktop browsers (Chromium, Firefox, WebKit)
- ✅ Runs on 2 mobile browsers (Mobile Chrome, Mobile Safari)
- ✅ Uploads test results and screenshots on failure
- ✅ Generates HTML reports
- ✅ Retries failed tests (2 retries in CI)

### Viewing CI Results

1. Go to GitHub Actions tab
2. Select the E2E Tests workflow
3. View test results in the job logs
4. Download artifacts for screenshots/videos

### Local CI Simulation

```bash
# Run tests in CI mode
CI=true npx playwright test

# This enables:
# - Sequential execution (workers=1)
# - 2 retries on failure
# - Fresh dev server per run
```

## Best Practices

### 1. Use Data Test IDs

Always use `data-testid` attributes for reliable selectors:

```vue
<!-- ✅ Good -->
<button data-testid="connect-button">Connect</button>

<!-- ❌ Bad -->
<button class="btn-primary">Connect</button>
```

```typescript
// Access via SELECTORS
await page.click(SELECTORS.CONNECTION.CONNECT_BUTTON)
```

### 2. Organize Tests Logically

Group related tests in describe blocks:

```typescript
test.describe('Connection Management', () => {
  test.describe('Successful Connections', () => {
    test('connects with valid credentials', async () => {})
  })

  test.describe('Connection Errors', () => {
    test('shows error with invalid URI', async () => {})
  })
})
```

### 3. Use Fixtures for Reusable Setup

Don't repeat setup code:

```typescript
// ✅ Good - Use fixture
test('my test', async ({ configureSip }) => {
  await configureSip(TEST_DATA.VALID_CONFIG)
})

// ❌ Bad - Repeat setup
test('my test', async ({ page }) => {
  await page.click('[data-testid="settings-button"]')
  await page.fill('[data-testid="sip-uri"]', '...')
  await page.fill('[data-testid="password"]', '...')
  // ...
})
```

### 4. Test User Flows, Not Implementation

Focus on what users do:

```typescript
// ✅ Good - User perspective
test('user can make a call', async ({ page }) => {
  await page.fill(SELECTORS.DIALPAD.NUMBER_INPUT, '5551234')
  await page.click(SELECTORS.DIALPAD.CALL_BUTTON)
  await expect(page.locator(SELECTORS.STATUS.CALL_STATUS)).toContainText('Calling')
})

// ❌ Bad - Implementation details
test('INVITE message is sent', async ({ page }) => {
  // Testing internal SIP protocol details
})
```

### 5. Keep Tests Independent

Each test should work in isolation:

```typescript
// ✅ Good - Self-contained
test('test A', async ({ page }) => {
  await page.goto(APP_URL)
  // Complete test
})

test('test B', async ({ page }) => {
  await page.goto(APP_URL)
  // Complete test - doesn't depend on A
})

// ❌ Bad - Tests depend on each other
let sharedState
test('test A', async () => {
  sharedState = await setup()
})
test('test B', async () => {
  use(sharedState) // Fails if A doesn't run first
})
```

### 6. Use Meaningful Test Names

```typescript
// ✅ Good - Clear intent
test('should display error message when SIP URI is invalid')

// ❌ Bad - Unclear
test('test 1')
test('it works')
```

### 7. Handle Async Properly

```typescript
// ✅ Good
await page.click(SELECTORS.BUTTON)
await expect(page.locator(SELECTORS.STATUS)).toHaveText('Done')

// ❌ Bad - Missing await
page.click(SELECTORS.BUTTON) // Returns promise
expect(page.locator(SELECTORS.STATUS)).toHaveText('Done') // Fails immediately
```

### 8. Use Proper Assertions

```typescript
// ✅ Good - Auto-retries until timeout
await expect(page.locator(SELECTORS.STATUS)).toHaveText('Connected')
await expect(page.locator(SELECTORS.BUTTON)).toBeVisible()

// ❌ Bad - No retry, flaky
const text = await page.locator(SELECTORS.STATUS).textContent()
expect(text).toBe('Connected')
```

### 9. Clean Up Resources

```typescript
test.afterEach(async ({ page }) => {
  // Disconnect if connected
  const disconnectBtn = page.locator(SELECTORS.CONNECTION.DISCONNECT_BUTTON)
  if (await disconnectBtn.isVisible()) {
    await disconnectBtn.click()
  }
})
```

### 10. Document Complex Tests

```typescript
test('should handle call transfer with multiple parties', async ({ page }) => {
  // Step 1: Establish first call
  // ...

  // Step 2: Receive second incoming call
  // ...

  // Step 3: Transfer first call to second caller
  // ...

  // Step 4: Verify all parties connected
  // ...
})
```

## Advanced Topics

### Custom Fixtures

See `fixtures.ts` for examples of creating reusable test utilities.

### Visual Regression Testing

See [VISUAL_TESTING.md](./VISUAL_TESTING.md) for detailed guide.

### Performance Testing

```typescript
test('should load within 3 seconds', async ({ page }) => {
  const start = Date.now()
  await page.goto(APP_URL)
  await page.waitForLoadState('networkidle')
  const loadTime = Date.now() - start

  expect(loadTime).toBeLessThan(3000)
})
```

### Accessibility Testing

```typescript
import { injectAxe, checkA11y } from 'axe-playwright'

test('should have no accessibility violations', async ({ page }) => {
  await page.goto(APP_URL)
  await injectAxe(page)
  await checkA11y(page)
})
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [VueSip Testing Guide](/docs/testing-guide.md)
- [Visual Testing Guide](./VISUAL_TESTING.md)

## Getting Help

1. Check this troubleshooting guide
2. Review [Playwright docs](https://playwright.dev)
3. Check test examples in existing spec files
4. Run tests with `--debug` flag for inspection

## Advanced Testing Features

VueSip includes advanced E2E testing capabilities beyond the core tests:

- **Accessibility Testing** - WCAG 2.1 AA compliance (23 tests)
- **Network Condition Simulation** - Test under various network scenarios (24 tests)
- **Performance Testing** - Monitor load time, FPS, memory (20+ tests)
- **Audio/Video Quality** - WebRTC stream validation (16 tests)
- **Multi-User Scenarios** - Test interactions between users (11 tests)
- **Custom Reporters** - Flaky test detection, metrics, notifications
- **Docker SIP Server** - Real Asterisk integration testing

📘 **See [ADVANCED_E2E_TESTING.md](/ADVANCED_E2E_TESTING.md) for complete guide**

### Quick Access

```bash
# Run advanced tests
npm run test:e2e:advanced

# Run specific category
npm run test:e2e:a11y          # Accessibility
npm run test:e2e:network       # Network conditions
npm run test:e2e:performance   # Performance
npm run test:e2e:multiuser     # Multi-user

# Start Docker SIP server
cd tests/e2e/docker && docker-compose up -d
```

### Additional Resources

- [Advanced E2E Testing Guide](/ADVANCED_E2E_TESTING.md) ⭐ **New!**
- [Docker SIP Server Documentation](./docker/README.md)
