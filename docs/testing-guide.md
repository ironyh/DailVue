# VueSip Testing Guide

This document provides comprehensive guidance on testing the VueSip library.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Coverage Reports](#coverage-reports)
- [Best Practices](#best-practices)
- [Test Data Builders](#test-data-builders)
- [Debugging Tests](#debugging-tests)
- [Common Issues](#common-issues)

## Overview

VueSip uses a comprehensive testing strategy with three levels of tests:

1. **Unit Tests**: Test individual components and functions in isolation
2. **Integration Tests**: Test how multiple components work together
3. **E2E Tests**: Test complete user workflows in a browser environment

### Testing Stack

- **Test Framework**: [Vitest](https://vitest.dev/) - Fast, Vite-powered unit test framework
- **E2E Testing**: [Playwright](https://playwright.dev/) - Cross-browser end-to-end testing
- **Coverage**: Vitest with V8 coverage provider
- **Mocking**: Vitest's built-in mocking capabilities

## Test Structure

```
tests/
├── unit/                      # Unit tests
│   ├── core/                  # Core functionality tests
│   ├── composables/           # Vue composables tests
│   ├── stores/                # Pinia stores tests
│   ├── plugins/               # Plugin tests
│   ├── providers/             # Provider tests
│   └── utils/                 # Utility function tests
├── integration/               # Integration tests
│   └── sip-workflow.test.ts   # Complete SIP workflow tests
├── e2e/                       # End-to-end tests
│   └── basic-call-flow.spec.ts # User interaction tests
├── utils/                     # Test utilities
│   └── test-helpers.ts        # Shared test helpers
└── setup.ts                   # Global test setup
```

## Running Tests

### Unit and Integration Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm coverage

# Run specific test file
pnpm test tests/unit/core/SipClient.test.ts

# Run tests matching a pattern
pnpm test --grep "SipClient"
```

### E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run E2E tests in headed mode (see browser)
pnpm test:e2e --headed

# Run E2E tests in a specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit

# Run E2E tests in debug mode
pnpm test:e2e --debug
```

## Writing Tests

### Unit Tests

Unit tests should test individual components in isolation. Here's a template:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MyComponent } from '../src/MyComponent'

describe('MyComponent', () => {
  let component: MyComponent

  beforeEach(() => {
    // Setup before each test
    component = new MyComponent()
  })

  afterEach(() => {
    // Cleanup after each test
    component.destroy()
  })

  describe('method name', () => {
    it('should do something', () => {
      const result = component.doSomething()
      expect(result).toBe(expectedValue)
    })

    it('should handle errors', () => {
      expect(() => component.doSomething()).toThrow('Error message')
    })
  })
})
```

### Testing SIP Components

When testing SIP components, use the provided test helpers:

```typescript
import { createMockSipConfig, createMockUA, simulateSipConnection } from '../utils/test-helpers'

describe('SIP Component', () => {
  it('should connect to SIP server', async () => {
    const config = createMockSipConfig()
    const mockUA = createMockUA()

    simulateSipConnection(mockUA)

    const client = new SipClient(config, eventBus)
    await client.start()

    expect(client.isConnected).toBe(true)
  })
})
```

### Testing Media Components

Use the media device mock helpers:

```typescript
import { setupMediaDevicesMock, createMockMediaStream } from '../utils/test-helpers'

describe('Media Component', () => {
  it('should acquire media', async () => {
    const { mockStream } = setupMediaDevicesMock()

    const mediaManager = new MediaManager(eventBus)
    const stream = await mediaManager.getUserMedia({ audio: true })

    expect(stream).toBeDefined()
  })
})
```

### Testing Plugins

Plugin tests should verify installation, configuration, and lifecycle:

```typescript
import { createMockPluginContext } from '../utils/test-helpers'

describe('MyPlugin', () => {
  it('should install correctly', async () => {
    const context = createMockPluginContext(eventBus)
    const plugin = new MyPlugin()

    await plugin.install(context, { enabled: true })

    expect(plugin).toBeDefined()
  })

  it('should handle events', async () => {
    const context = createMockPluginContext(eventBus)
    const plugin = new MyPlugin()

    await plugin.install(context)

    eventBus.emit('someEvent', { data: 'test' })

    // Verify plugin responded to event
    await wait(50)
    expect(/* ... */)
  })
})
```

### Integration Tests

Integration tests verify that multiple components work together:

```typescript
describe('SIP Workflow Integration', () => {
  it('should complete full call lifecycle', async () => {
    // Setup all components
    const sipClient = new SipClient(config, eventBus)
    const mediaManager = new MediaManager(eventBus)
    const callSession = new CallSession(mockSession, 'local', eventBus)

    // Perform workflow
    await sipClient.start()
    await sipClient.register()
    const stream = await mediaManager.getUserMedia({ audio: true })

    // Verify workflow completed successfully
    expect(sipClient.isConnected).toBe(true)
    expect(sipClient.isRegistered).toBe(true)
    expect(stream).toBeDefined()
  })
})
```

### E2E Tests

E2E tests verify complete user workflows:

```typescript
import { test, expect } from '@playwright/test'

const APP_URL = '/?test=true'

test('should make a call', async ({ page }) => {
  await page.goto(APP_URL)

  // Enter phone number
  await page.fill('[data-testid="dialpad-input"]', 'sip:destination@example.com')

  // Click call button
  await page.click('[data-testid="call-button"]')

  // Verify call is in progress
  await expect(page.locator('[data-testid="active-call"]')).toBeVisible()
})
```

## Test Utilities

VueSip provides comprehensive test utilities in `tests/utils/test-helpers.ts`:

### Configuration Helpers

- `createMockSipConfig()` - Create a mock SIP configuration
- `createMockPluginContext()` - Create a mock plugin context

### Media Helpers

- `createMockMediaStream()` - Create a mock MediaStream
- `createMockRTCPeerConnection()` - Create a mock RTCPeerConnection
- `setupMediaDevicesMock()` - Setup navigator.mediaDevices mock

### SIP Helpers

- `createMockUA()` - Create a mock JsSIP User Agent
- `createMockRTCSession()` - Create a mock JsSIP RTC Session
- `simulateSipConnection()` - Simulate successful SIP connection
- `simulateSipRegistration()` - Simulate successful SIP registration
- `simulateSipConnectionFailure()` - Simulate connection failure
- `simulateIncomingCall()` - Simulate an incoming call
- `simulateCallProgress()` - Simulate call progress states

### Event Helpers

- `waitForEvent()` - Wait for an event to be emitted
- `assertEventEmitted()` - Assert that an event was emitted
- `createMockEvent()` - Create a mock event

### Other Helpers

- `wait()` - Wait for a specified time
- `spyOnConsole()` - Spy on console methods
- `setupIndexedDBMock()` - Setup IndexedDB mock

## Coverage Reports

### Running Coverage

```bash
# Generate coverage report
pnpm coverage
```

This will generate three types of reports:
- **Text**: Console output with coverage summary
- **HTML**: Interactive HTML report in `coverage/index.html`
- **JSON**: Machine-readable coverage data in `coverage/coverage-final.json`

### Coverage Thresholds

VueSip enforces minimum coverage thresholds:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Viewing Coverage

After running `pnpm coverage`, open the HTML report:

```bash
# On macOS
open coverage/index.html

# On Linux
xdg-open coverage/index.html

# On Windows
start coverage/index.html
```

## Best Practices

### 1. Test Organization

- Group related tests using `describe` blocks
- Use clear, descriptive test names
- Follow the Arrange-Act-Assert pattern
- Keep tests focused and isolated

### 2. Mocking

- Mock external dependencies (JsSIP, WebRTC, etc.)
- Use test helpers for consistent mocking
- Don't mock the code you're testing
- Reset mocks between tests

### 3. Async Testing

```typescript
// Good - properly handle async operations
it('should load data', async () => {
  const data = await loadData()
  expect(data).toBeDefined()
})

// Bad - doesn't wait for async operation
it('should load data', () => {
  loadData()
  expect(data).toBeDefined() // May fail
})
```

### 4. Error Testing

```typescript
// Test both success and failure cases
it('should handle success', async () => {
  const result = await operation()
  expect(result).toBeDefined()
})

it('should handle failure', async () => {
  await expect(operation()).rejects.toThrow('Error message')
})
```

### 5. Event Testing

```typescript
// Use event helpers for testing events
it('should emit event', async () => {
  const eventPromise = waitForEvent(eventBus, 'myEvent')

  component.doSomething()

  const eventData = await eventPromise
  expect(eventData).toEqual({ foo: 'bar' })
})
```

### 6. Cleanup

Always clean up resources in `afterEach`:

```typescript
afterEach(() => {
  component.destroy()
  eventBus.destroy()
  vi.clearAllMocks()
})
```

### 7. Test Data

Use factories and helpers for test data:

```typescript
// Good - use helper
const config = createMockSipConfig({ uri: 'wss://test.com' })

// Bad - duplicate data in every test
const config = {
  uri: 'wss://test.com',
  sipUri: 'sip:user@test.com',
  password: 'pass',
  // ... many more fields
}
```

### 8. Assertions

- Use specific assertions
- Test observable behavior, not implementation
- One logical assertion per test

```typescript
// Good
expect(result.status).toBe('success')
expect(result.data).toHaveLength(5)

// Less good - too generic
expect(result).toBeTruthy()
```

## Continuous Integration

Tests run automatically in CI on:
- Every push to main branch
- Every pull request
- Nightly builds

CI configuration can be found in `.github/workflows/test.yml`.

## Debugging Tests

### Vitest Debugging

```bash
# Run tests with inspector
pnpm test --inspect-brk

# Run specific test in watch mode
pnpm test --watch tests/unit/core/SipClient.test.ts
```

### Playwright Debugging

```bash
# Run with UI mode
pnpm test:e2e --ui

# Run with inspector
pnpm test:e2e --debug

# Generate trace
pnpm test:e2e --trace on
```

## Test Data Builders

Test data builders help create consistent test data with minimal boilerplate. Use the builder pattern for complex test objects.

### Creating Test Data Builders

```typescript
// Example: Call builder
class CallBuilder {
  private call: Partial<CallData> = {
    id: 'test-call-123',
    direction: 'outgoing',
    state: 'active',
    startTime: new Date(),
  }

  withId(id: string): this {
    this.call.id = id
    return this
  }

  withDirection(direction: 'incoming' | 'outgoing'): this {
    this.call.direction = direction
    return this
  }

  withState(state: CallState): this {
    this.call.state = state
    return this
  }

  build(): CallData {
    return this.call as CallData
  }
}

// Usage
const call = new CallBuilder()
  .withId('custom-id')
  .withDirection('incoming')
  .withState('ringing')
  .build()
```

### Using Existing Helpers

VueSip provides several test data helpers in `tests/utils/test-helpers.ts`:

```typescript
import {
  createMockSipConfig,
  createMockPluginContext,
  createMockMediaStream,
  createMockUA,
} from '../utils/test-helpers'

// Create mock SIP configuration
const config = createMockSipConfig({
  sipUri: 'sip:custom@example.com',
  password: 'custom-password',
})

// Create mock plugin context
const context = createMockPluginContext()

// Create mock media stream
const stream = createMockMediaStream({ audio: true, video: false })

// Create mock UA
const ua = createMockUA()
```

### Best Practices for Test Data

1. **Use Builders for Complex Objects**: When objects have many optional properties
2. **Provide Sensible Defaults**: Default values should represent typical scenarios
3. **Make Overrides Easy**: Allow selective override of specific properties
4. **Keep Builders Simple**: Don't add complex logic to builders
5. **Reuse Across Tests**: Share builders in test utility modules

### Example: Analytics Event Builder

```typescript
class AnalyticsEventBuilder {
  private event: Partial<AnalyticsEvent> = {
    type: 'test:event',
    timestamp: new Date(),
    sessionId: 'test-session',
  }

  withType(type: string): this {
    this.event.type = type
    return this
  }

  withData(data: Record<string, any>): this {
    this.event.data = data
    return this
  }

  withSessionId(sessionId: string): this {
    this.event.sessionId = sessionId
    return this
  }

  build(): AnalyticsEvent {
    return this.event as AnalyticsEvent
  }
}

// Usage in tests
const event = new AnalyticsEventBuilder()
  .withType('call:started')
  .withData({ callId: 'test-123' })
  .build()
```

## Debugging Tests

Effective debugging techniques for failing tests.

### Debugging Unit Tests

#### 1. Use Console Logging

```typescript
it('should process data', () => {
  const input = createTestData()
  console.log('Input:', input)

  const result = processData(input)
  console.log('Result:', result)

  expect(result).toBe(expected)
})
```

#### 2. Use Debugger Statement

```typescript
it('should calculate correctly', () => {
  const value = calculate(10, 20)

  debugger // Execution will pause here

  expect(value).toBe(30)
})
```

#### 3. Run Single Test

```bash
# Run specific test file
pnpm test tests/unit/specific-file.test.ts

# Run single test by name
pnpm test -t "should handle edge case"

# Run tests matching pattern
pnpm test -t "AnalyticsPlugin"
```

#### 4. Use --inspect with Node

```bash
# Run with Chrome DevTools
node --inspect-brk node_modules/.bin/vitest run

# Then open chrome://inspect in Chrome
```

#### 5. Disable Parallel Execution

```bash
# Run tests sequentially for easier debugging
pnpm test --no-threads
```

### Debugging Integration Tests

#### 1. Add Wait Points

```typescript
it('should complete workflow', async () => {
  await startWorkflow()

  // Add explicit wait to see intermediate state
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('Current state:', getState())

  await completeWorkflow()
})
```

#### 2. Use Test Spies

```typescript
it('should call handlers in order', () => {
  const spy1 = vi.spyOn(handler, 'onStart')
  const spy2 = vi.spyOn(handler, 'onComplete')

  performAction()

  console.log('onStart called:', spy1.mock.calls.length, 'times')
  console.log('onComplete called:', spy2.mock.calls.length, 'times')

  expect(spy1).toHaveBeenCalledBefore(spy2)
})
```

### Debugging E2E Tests

#### 1. Run in Headed Mode

```bash
# See browser while tests run
pnpm test:e2e --headed
```

#### 2. Use Playwright Inspector

```bash
# Step through test with inspector
pnpm test:e2e --debug
```

#### 3. Add Screenshots

```typescript
test('should login', async ({ page }) => {
  await page.goto('http://localhost:3000')

  // Take screenshot at specific point
  await page.screenshot({ path: 'before-login.png' })

  await page.click('[data-testid="login-button"]')

  await page.screenshot({ path: 'after-login.png' })
})
```

#### 4. Use Slow Motion

```typescript
// In playwright.config.ts
use: {
  launchOptions: {
    slowMo: 1000, // Slow down by 1 second
  },
}
```

#### 5. Generate Trace

```bash
# Generate trace for debugging
pnpm test:e2e --trace on

# View trace
npx playwright show-trace trace.zip
```

### Common Debugging Scenarios

#### Test Times Out

**Symptoms**: Test runs until timeout without completing

**Debug Steps**:
1. Check for unresolved promises
2. Look for missing `await` keywords
3. Verify event handlers are being called
4. Add timeout logs to identify where it's stuck

```typescript
it('should complete', async () => {
  console.log('Step 1')
  await step1()

  console.log('Step 2')
  await step2()

  console.log('Step 3')
  await step3() // If we never see "Step 3", it's stuck in step2

  console.log('Complete')
})
```

#### Mock Not Working

**Symptoms**: Mock function not being called or returning unexpected values

**Debug Steps**:
1. Verify mock is created before code runs
2. Check if module path is correct
3. Ensure mock is reset between tests
4. Verify the function is actually being called

```typescript
beforeEach(() => {
  vi.clearAllMocks() // Clear all mocks
})

it('should call mock', () => {
  const mockFn = vi.fn()

  // Log when mock is called
  mockFn.mockImplementation((...args) => {
    console.log('Mock called with:', args)
    return 'result'
  })

  callTheFunction(mockFn)

  console.log('Mock call count:', mockFn.mock.calls.length)
  expect(mockFn).toHaveBeenCalled()
})
```

#### Flaky Test

**Symptoms**: Test passes sometimes, fails other times

**Debug Steps**:
1. Look for race conditions
2. Check for shared state between tests
3. Verify proper cleanup in afterEach
4. Use deterministic values instead of random/time-based

```typescript
// BAD: Flaky due to timing
it('should update', async () => {
  trigger()
  await wait(100) // Might not be enough time
  expect(value).toBe('updated')
})

// GOOD: Wait for actual event
it('should update', async () => {
  const promise = waitForEvent(eventBus, 'updated')
  trigger()
  await promise
  expect(value).toBe('updated')
})
```

### Memory Leak Debugging

Use the memory leak detection helper:

```typescript
import { detectMemoryLeaks } from '../utils/test-helpers'

it('should not leak memory', async () => {
  const result = await detectMemoryLeaks(
    async () => {
      // Code to test
      const obj = createObject()
      await useObject(obj)
      // obj should be garbage collected here
    },
    {
      iterations: 100,
      threshold: 10, // 10MB
    }
  )

  console.log('Heap delta:', result.heapDelta / (1024 * 1024), 'MB')

  expect(result.leaked).toBe(false)
})
```

### Useful Debugging Tools

1. **VS Code Debugger**: Set breakpoints in test files
2. **Chrome DevTools**: Use --inspect flag
3. **Vitest UI**: Visual test runner with `pnpm test --ui`
4. **Playwright Trace Viewer**: Visual timeline of E2E tests
5. **Console Methods**: console.log, console.table, console.trace

## Common Issues

### Issue: Tests timeout

**Solution**: Increase timeout or check for unresolved promises

```typescript
// Increase timeout for specific test
it('should complete', async () => {
  // test code
}, 10000) // 10 second timeout
```

### Issue: Flaky tests

**Solution**:
- Add proper waits for async operations
- Use `waitForEvent` instead of fixed timeouts
- Ensure proper cleanup between tests

### Issue: Mock not working

**Solution**:
- Clear mocks between tests: `vi.clearAllMocks()`
- Reset mock implementation: `mockFn.mockReset()`
- Check mock is properly imported

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Support

For testing-related questions or issues:
1. Check this documentation
2. Review existing tests for examples
3. Open an issue on GitHub
4. Ask in project discussions
