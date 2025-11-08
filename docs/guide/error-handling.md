# Error Handling Guide

This comprehensive guide walks you through error handling in VueSip, helping you build robust VoIP applications that gracefully handle failures and provide excellent user experiences. You'll learn about different error types, proven handling patterns, recovery strategies, and practical debugging techniques.

## Why Error Handling Matters in VoIP Applications

VoIP applications operate in an unpredictable environment with many potential failure points: network issues, device problems, server errors, and user permissions. Proper error handling ensures your application:

- **Stays reliable** - Recovers gracefully from failures instead of crashing
- **Provides clarity** - Shows users meaningful messages instead of cryptic errors
- **Maintains quality** - Detects and responds to audio/network quality issues
- **Builds trust** - Handles problems professionally, building user confidence

## Table of Contents

- [Error Types](#error-types)
- [Error Handling Patterns](#error-handling-patterns)
- [Recovery Strategies](#recovery-strategies)
- [Logging and Debugging](#logging-and-debugging)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Best Practices](#best-practices)

---

## Error Types

VueSip categorizes errors into distinct types to help you quickly identify problems and apply appropriate solutions. Understanding these error types is the first step to effective error handling.

### Storage Errors

Storage errors occur when your application runs out of browser storage space, typically when saving call recordings or persisting call history.

#### QuotaExceededError

This error is thrown when the browser's storage quota is exceeded. Modern browsers provide limited storage (usually 5-50 MB), which can fill up quickly with audio recordings.

```typescript
import { QuotaExceededError } from 'vuesip'

try {
  // Attempt to save recording data to browser storage
  await saveRecording(recordingData)
} catch (error) {
  if (error instanceof QuotaExceededError) {
    console.error('Storage quota exceeded:', error.quotaInfo)

    // Clean up old recordings to free space
    await cleanupOldRecordings()
  }
}
```

**Properties:**
- `message` - Human-readable error description
- `quotaInfo` - Detailed storage information including:
  - `usage` - Current storage used in bytes
  - `quota` - Total storage available in bytes
  - `available` - Remaining storage in bytes
  - `usagePercent` - Percentage of quota used

💡 **Tip:** Monitor storage usage proactively and clean up old data before reaching the quota limit.

### Media Errors

Media errors arise from problems accessing microphones, speakers, or cameras. These are among the most common errors users encounter in VoIP applications.

#### MediaError Interface

The MediaError interface provides detailed information about what went wrong during media device access.

```typescript
interface MediaError {
  name: string      // Error type identifier
  message: string   // Human-readable description
  constraint?: string // Which constraint failed (e.g., 'echoCancellation')
}
```

**Common Media Error Names:**

| Error Name | Meaning | Common Cause |
|------------|---------|--------------|
| `NotAllowedError` | User denied permission | User clicked "Block" on permission prompt |
| `NotFoundError` | No media devices found | No microphone connected to computer |
| `NotReadableError` | Device is already in use | Another app or tab is using the microphone |
| `OverconstrainedError` | Constraints cannot be satisfied | Requested features not available (e.g., noise cancellation on old device) |
| `AbortError` | Device access was aborted | User cancelled or system interrupted access |
| `TypeError` | Invalid constraints | Programming error in constraint specification |

**Real-World Example:**

```typescript
import { useMediaDevices } from 'vuesip'

const { requestPermissions, error } = useMediaDevices()

async function setupMedia() {
  try {
    // Request microphone access from the user
    await requestPermissions()
  } catch (err: any) {
    // Handle specific error types with user-friendly messages
    if (err.name === 'NotAllowedError') {
      console.error('Microphone permission denied')
      // Show modal explaining how to grant permission
      showPermissionDialog()
    } else if (err.name === 'NotFoundError') {
      console.error('No microphone found')
      // Suggest connecting a microphone
      showNoDeviceMessage()
    } else if (err.name === 'NotReadableError') {
      console.error('Microphone already in use')
      // Suggest closing other apps or tabs
      showDeviceInUseMessage()
    }
  }
}
```

⚠️ **Warning:** On HTTP connections, browsers block microphone access entirely. Always use HTTPS in production.

### Call Errors

Call errors describe why a call failed or how it ended. Understanding these helps provide appropriate feedback to users.

#### TerminationCause Enum

Each call termination has a specific cause that tells you exactly what happened. This is crucial for debugging and user feedback.

```typescript
enum TerminationCause {
  Canceled = 'canceled',         // User cancelled before connection
  Rejected = 'rejected',         // Remote party declined the call
  NoAnswer = 'no_answer',        // Remote party didn't answer in time
  Unavailable = 'unavailable',   // Remote party cannot be reached
  Busy = 'busy',                 // Remote party is on another call
  Bye = 'bye',                   // Normal call ending (either party hung up)
  RequestTimeout = 'request_timeout', // Network took too long to respond
  WebRtcError = 'webrtc_error',  // Media connection failed
  InternalError = 'internal_error', // VueSip or SIP.js internal error
  NetworkError = 'network_error', // Network connection lost
  Other = 'other'                // Unknown or unclassified reason
}
```

**Practical Example:**

```typescript
import { useCallSession } from 'vuesip'

const { activeCall } = useCallSession()

// Listen for call failures and provide user-friendly messages
eventBus.on('call:failed', (event) => {
  const cause = event.terminationCause

  switch (cause) {
    case 'network_error':
      // Network issue - suggest checking connection
      showNotification('Call failed due to network issues. Please check your internet connection.')
      break
    case 'webrtc_error':
      // Media connection failed - might be firewall
      showNotification('Media connection failed. This might be due to firewall settings.')
      break
    case 'busy':
      // Normal business scenario
      showNotification('The person you are calling is busy. Try again later.')
      break
    case 'no_answer':
      // No answer - normal scenario
      showNotification('No answer. Please try again later.')
      break
    default:
      // Generic fallback
      showNotification('Call failed. Please try again.')
  }
})
```

📝 **Note:** Different termination causes require different user responses. A 'busy' signal is normal and expected, while 'webrtc_error' might indicate a technical problem.

### Connection Errors

Connection errors track the lifecycle of your WebSocket connection to the SIP server. The connection can fail for various reasons, and monitoring these states helps you implement reconnection logic.

#### Connection States

```typescript
enum ConnectionState {
  Disconnected = 'disconnected',           // Not connected
  Connecting = 'connecting',               // Attempting to connect
  Connected = 'connected',                 // Successfully connected
  ConnectionFailed = 'connection_failed',  // Connection attempt failed
  Reconnecting = 'reconnecting'            // Attempting to reconnect
}
```

**Example with Error Handling:**

```typescript
import { useSipClient } from 'vuesip'

const { connectionState, connect, error } = useSipClient(config)

async function handleConnect() {
  try {
    // Attempt WebSocket connection to SIP server
    await connect()
  } catch (err) {
    console.error('Connection failed:', err)

    // Provide specific guidance based on error message
    if (err.message.includes('WebSocket')) {
      showNotification('Cannot connect to server. Please check if the server is running.')
    } else if (err.message.includes('Invalid SIP configuration')) {
      showNotification('Invalid configuration. Please check your SIP settings.')
    }
  }
}
```

💡 **Tip:** The `connectionState` reactive property updates automatically, making it perfect for showing connection status in your UI.

### Registration Errors

Registration is how your SIP client identifies itself to the server. Registration failures are often caused by authentication issues.

#### Registration States

```typescript
enum RegistrationState {
  Unregistered = 'unregistered',           // Not registered with server
  Registering = 'registering',             // Sending registration request
  Registered = 'registered',               // Successfully registered
  Unregistering = 'unregistering',         // Removing registration
  RegistrationFailed = 'registration_failed' // Registration attempt failed
}
```

**Common SIP Response Codes:**
- **401 Unauthorized** - Wrong username or password
- **403 Forbidden** - Account exists but access denied (e.g., IP restriction)
- **404 Not Found** - User account doesn't exist
- **408 Request Timeout** - Server didn't respond in time (network issue)

**Example:**

```typescript
import { useSipRegistration } from 'vuesip'

const { registrationState, register, lastError } = useSipRegistration()

// Listen for registration failures
eventBus.on('sip:registration_failed', (event) => {
  console.error('Registration failed:', event.cause)

  // Parse the SIP response code from the error
  if (event.cause?.includes('401')) {
    // Authentication failed - credentials are wrong
    showNotification('Invalid username or password. Please check your credentials.')
  } else if (event.cause?.includes('403')) {
    // Forbidden - might be IP restriction or account disabled
    showNotification('Access forbidden. Please contact your administrator.')
  } else if (event.cause?.includes('timeout')) {
    // Network timeout - can't reach server
    showNotification('Registration timeout. Please check your network connection.')
  }
})
```

⚠️ **Warning:** Never log passwords or sensitive credentials, even in error handlers.

### Validation Errors

VueSip provides validators that check your inputs before attempting operations. This catches problems early, before they cause failures.

```typescript
interface ValidationResult {
  valid: boolean        // Whether the input is valid
  errors?: string[]    // Array of error messages if invalid
  warnings?: string[]  // Non-critical issues that should be addressed
}
```

**Example:**

```typescript
import { validateSipUri, validateSipConfig } from 'vuesip'

// Validate a SIP URI before using it
const uriResult = validateSipUri('sip:user@domain.com')
if (!uriResult.valid) {
  console.error('Invalid SIP URI:', uriResult.error)
}

// Validate complete configuration
const configResult = validateSipConfig({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret'
})

// Check for errors (prevent operation)
if (!configResult.valid) {
  console.error('Configuration errors:', configResult.errors)
  // Don't proceed with invalid config
  return
}

// Check for warnings (allow operation but inform user)
if (configResult.warnings) {
  console.warn('Configuration warnings:', configResult.warnings)
  // e.g., "Using default port" or "Insecure connection"
}
```

✅ **Best Practice:** Always validate user input before attempting operations. It's better to show a validation error than a cryptic failure message.

### Event-Based Errors

VueSip uses an event bus to emit error events. This allows centralized error handling across your application.

#### ErrorEvent Interface

```typescript
interface ErrorEvent extends BaseEvent {
  type: 'error'
  error: Error                                    // The actual error object
  context?: string                                // Where the error occurred
  severity?: 'low' | 'medium' | 'high' | 'critical' // How serious is it
}
```

**Severity Levels:**
- **low** - Informational, doesn't affect functionality
- **medium** - Degraded functionality, user might notice
- **high** - Feature broken, requires attention
- **critical** - Application unstable, immediate action needed

**Example:**

```typescript
import { EventBus } from 'vuesip'

const eventBus = new EventBus()

// Centralized error handler
eventBus.on('error', (event: ErrorEvent) => {
  // Log with severity indicator
  console.error(`[${event.severity}] ${event.context}:`, event.error)

  // Critical errors need immediate attention
  if (event.severity === 'critical') {
    // Alert user immediately
    notifyUser('A critical error occurred. Please refresh the page.')

    // Send to error tracking service
    logToServer(event)
  }
})
```

---

## Error Handling Patterns

Now that you understand the error types, let's explore proven patterns for handling them effectively. These patterns will help you write robust, maintainable code.

### Try-Catch Pattern

The try-catch pattern is your first line of defense. Use it for any operation that might throw an error.

```typescript
import { useSipClient, useCallSession } from 'vuesip'

const { connect, disconnect } = useSipClient(config)
const { makeCall } = useCallSession()

async function initiateCall(targetUri: string) {
  try {
    // Step 1: Ensure we're connected to the SIP server
    await connect()

    // Step 2: Initiate the outgoing call
    await makeCall(targetUri)
  } catch (error) {
    console.error('Failed to initiate call:', error)

    // Handle specific error scenarios
    if (error instanceof Error) {
      if (error.message.includes('not started')) {
        // Client hasn't been initialized
        showNotification('Please connect first')
      } else if (error.message.includes('Not connected')) {
        // Connection was lost, try reconnecting
        showNotification('Connection lost - reconnecting...')
        await connect()
      }
    }
  }
}
```

💡 **Tip:** Always check if errors are instances of `Error` before accessing properties like `message`. Some libraries throw non-Error values.

### Error State Management

Tracking errors in reactive state allows your UI to respond automatically to error conditions.

```typescript
import { ref, computed } from 'vue'
import { useSipClient } from 'vuesip'

// Reactive error state
const error = ref<Error | null>(null)
const isError = computed(() => error.value !== null)

const { connect } = useSipClient(config)

async function handleConnect() {
  // Clear any previous errors before new attempt
  error.value = null

  try {
    await connect()
  } catch (err) {
    // Store error for UI to display
    error.value = err instanceof Error ? err : new Error(String(err))
  }
}

// Clear error when user acknowledges it
function clearError() {
  error.value = null
}
```

**In your template:**
```vue
<template>
  <div v-if="isError" class="error-banner">
    {{ error.message }}
    <button @click="clearError">Dismiss</button>
  </div>
</template>
```

✅ **Best Practice:** Clear errors when starting new operations to avoid showing stale error messages.

### Event-Based Error Handling

Centralize error handling with the EventBus for consistent error responses across your application.

```typescript
import { EventBus } from 'vuesip'

const eventBus = new EventBus()

// Set up centralized error handler once during app initialization
function setupErrorHandling() {
  // Connection errors
  eventBus.on('sip:disconnected', (event) => {
    if (event.error) {
      console.error('Disconnected:', event.error)
      showNotification('Connection lost. Attempting to reconnect...')
    }
  })

  // Registration errors
  eventBus.on('sip:registration_failed', (event) => {
    console.error('Registration failed:', event.cause)
    showNotification('Registration failed: ' + event.cause)
  })

  // Call errors
  eventBus.on('call:failed', (event) => {
    console.error('Call failed:', event.terminationCause)
    showNotification('Call failed')
  })

  // Media errors
  eventBus.on('media:error', (event) => {
    console.error('Media error:', event.error)
    showNotification('Media error: ' + event.error.message)
  })
}
```

💡 **Tip:** Call `setupErrorHandling()` once when your app initializes, typically in your main.ts or App.vue.

### Validation Before Execution

Prevent errors by validating inputs before attempting operations. This provides immediate feedback and prevents wasteful API calls.

```typescript
import { validateSipUri, validatePhoneNumber } from 'vuesip'

function makeCallWithValidation(target: string) {
  // Step 1: Validate the target before attempting the call
  const validation = validateSipUri(target)

  if (!validation.valid) {
    // Show user-friendly error immediately
    showError('Invalid target: ' + validation.error)
    return // Don't proceed with invalid input
  }

  // Step 2: Use the normalized URI (validator cleaned it up)
  makeCall(validation.normalized!)
}
```

**What validation catches:**
- Malformed URIs (e.g., missing `sip:` prefix)
- Invalid characters
- Missing domain
- Incorrect format

### Graceful Degradation

When full functionality isn't available, provide reduced functionality instead of complete failure.

```typescript
import { useMediaDevices } from 'vuesip'

const { enumerateDevices, hasPermission } = useMediaDevices()

async function setupAudio() {
  try {
    // Try to enumerate all available devices
    await enumerateDevices()

    if (!hasPermission.value.audio) {
      // Permission not granted, but we can still work with default device
      console.warn('Audio permission not granted, using default device')
      useDefaultAudioDevice()
    }
  } catch (error) {
    console.error('Failed to enumerate devices:', error)

    // Continue with limited functionality rather than crashing
    disableDeviceSelection() // Hide device picker from UI
    // User can still make calls, just can't choose specific device
  }
}
```

✅ **Best Practice:** When possible, degrade gracefully rather than failing completely. Users prefer limited functionality over no functionality.

### Cleanup in Finally Blocks

The `finally` block ensures cleanup happens whether the operation succeeds or fails. This prevents resource leaks.

```typescript
let timer: ReturnType<typeof setTimeout> | null = null

async function operationWithCleanup() {
  try {
    // Set a timeout for the operation
    timer = setTimeout(() => {
      throw new Error('Operation timeout')
    }, 5000)

    // Perform the actual operation
    await performOperation()
  } catch (error) {
    console.error('Operation failed:', error)
    throw error // Re-throw for caller to handle
  } finally {
    // Cleanup always runs, even if operation succeeded or failed
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}
```

⚠️ **Warning:** Forgetting cleanup can cause memory leaks and resource exhaustion, especially with timers and intervals.

---

## Recovery Strategies

Errors will happen. The key is how your application recovers. These strategies help your application bounce back from failures automatically.

### Automatic Retry with Exponential Backoff

When operations fail due to temporary issues (like network hiccups), retrying with increasing delays often succeeds.

**Why Exponential Backoff?**
- **Prevents hammering** - Doesn't overwhelm a struggling server
- **Adapts to severity** - Longer delays for persistent issues
- **Industry standard** - Used by AWS, Google Cloud, etc.

```typescript
/**
 * Retries an async operation with exponential backoff
 * @param operation - The async function to retry
 * @param maxRetries - Maximum number of attempts (default: 3)
 * @param baseDelay - Initial delay in milliseconds (default: 1000)
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        // Calculate delay: 1s, 2s, 4s, etc.
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries exhausted
  throw lastError!
}

// Usage example
const { connect } = useSipClient(config)

async function connectWithRetry() {
  try {
    // Try connecting with 3 retries
    await retryWithBackoff(() => connect(), 3, 1000)
    console.log('Connected successfully')
  } catch (error) {
    console.error('Failed to connect after retries:', error)
    showNotification('Unable to connect - please try again later')
  }
}
```

📝 **Note:** Retry delays: 1st retry after 1s, 2nd after 2s, 3rd after 4s, creating space between attempts.

### Registration Auto-Retry

VueSip's registration store includes built-in retry logic, but you can enhance it with custom logic.

```typescript
import { registrationStore } from 'vuesip'

// Monitor retry count to detect persistent issues
if (registrationStore.retryCount > 3) {
  console.warn('Multiple registration failures detected')
  // After several failures, suggest credential check
  showNotification('Having trouble connecting - check your credentials')
}

// Listen for registration failures and implement custom retry
eventBus.on('sip:registration_failed', async () => {
  // Wait before retrying to avoid hammering server
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Attempt registration again
  try {
    await register()
  } catch (error) {
    console.error('Registration retry failed:', error)
  }
})
```

💡 **Tip:** If retries keep failing (e.g., more than 5 times), stop auto-retrying and ask the user to check their credentials. Otherwise you might lock out their account.

### Connection Recovery

Automatically recover from connection losses to provide a seamless experience.

```typescript
import { useSipClient } from 'vuesip'

const { connect, disconnect, connectionState } = useSipClient(config)
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

// Watch connection state and trigger reconnection when needed
watch(connectionState, (state) => {
  if (state === 'disconnected') {
    // Connection lost - start reconnection attempts
    scheduleReconnect()
  } else if (state === 'connected') {
    // Connection restored - clear reconnection timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }
})

function scheduleReconnect() {
  // Prevent multiple timers
  if (reconnectTimer) return

  // Schedule reconnection attempt in 5 seconds
  reconnectTimer = setTimeout(async () => {
    try {
      console.log('Attempting to reconnect...')
      await connect()
      // Success - timer will be cleared by watcher
    } catch (error) {
      console.error('Reconnection failed:', error)
      // Schedule next attempt (creating exponential backoff here would be even better)
      scheduleReconnect()
    }
  }, 5000)
}

// Clean up timer when component unmounts
onUnmounted(() => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
})
```

✅ **Best Practice:** Always clean up timers in `onUnmounted` to prevent memory leaks and errors after component destruction.

### Media Device Recovery

Handle device changes gracefully, such as when a user unplugs their microphone mid-call.

```typescript
import { useMediaDevices } from 'vuesip'

const { enumerateDevices, selectedAudioInput, setAudioInput } = useMediaDevices()

// Listen for device changes (e.g., USB microphone unplugged)
eventBus.on('media:device:changed', async (event) => {
  const currentDevice = selectedAudioInput.value

  // Check if the currently selected device is still available
  const stillAvailable = event.currentDevices.some(
    d => d.deviceId === currentDevice
  )

  if (!stillAvailable && event.currentDevices.length > 0) {
    // Current device was removed, switch to another one
    const newDevice = event.currentDevices.find(
      d => d.kind === 'audioinput'
    )

    if (newDevice) {
      console.log('Switching to new audio device:', newDevice.label)
      await setAudioInput(newDevice.deviceId)

      // Inform user about the automatic switch
      showNotification(`Switched to ${newDevice.label}`)
    }
  }
})
```

💡 **Tip:** This handles scenarios like users switching headsets, unplugging USB microphones, or connecting Bluetooth devices.

### Call Recovery

Retry failed calls automatically, but with a limit to avoid annoying users.

```typescript
import { useCallSession } from 'vuesip'

const { makeCall, activeCall } = useCallSession()

async function makeCallWithRecovery(target: string, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Attempt to make the call
      await makeCall(target)
      return // Success - exit function
    } catch (error) {
      console.error(`Call attempt ${attempt + 1} failed:`, error)

      if (attempt < retries) {
        // Not the last attempt - wait and retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        // All attempts exhausted
        throw new Error('Call failed after ' + (retries + 1) + ' attempts')
      }
    }
  }
}
```

⚠️ **Warning:** Don't retry indefinitely. Users interpret repeated failures as "broken" and will lose trust.

### Storage Quota Recovery

Automatically clean up old data when storage is full, ensuring new data can be saved.

```typescript
import { hasEnoughSpace, clearOldDataLRU, QuotaExceededError } from 'vuesip'

/**
 * Save data with automatic quota management
 * LRU = Least Recently Used (deletes oldest data first)
 */
async function saveWithQuotaManagement(data: any) {
  try {
    // Step 1: Check if we have enough space
    const hasSpace = await hasEnoughSpace(data.size)

    if (!hasSpace) {
      console.warn('Low storage space, cleaning up old data')

      // Remove oldest 20% of recordings
      await clearOldDataLRU(
        () => getAllRecordings(),        // Get all recordings
        (ids) => deleteRecordings(ids),  // Delete by IDs
        20 // Remove oldest 20%
      )
    }

    // Step 2: Save the data
    await saveData(data)
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      // Still not enough space - be more aggressive
      console.error('Quota still exceeded, removing more data')

      await clearOldDataLRU(
        () => getAllRecordings(),
        (ids) => deleteRecordings(ids),
        50 // Remove oldest 50%
      )

      // Retry save after cleanup
      await saveData(data)
    } else {
      throw error // Different error - re-throw
    }
  }
}
```

📝 **Note:** LRU (Least Recently Used) deletion preserves important recent data while removing old data users likely don't need.

---

## Logging and Debugging

Effective logging is crucial for debugging production issues and understanding application behavior. VueSip provides a flexible logging system.

### Logger Configuration

Configure logging levels based on your environment to get the right amount of detail.

**Log Levels (in order of severity):**
1. **debug** - Verbose information for development
2. **info** - Important events and state changes
3. **warn** - Potential issues that don't stop functionality
4. **error** - Failures and exceptions

```typescript
import { configureLogger, setLogLevel } from 'vuesip'

// Development: Show all logs including debug info
if (import.meta.env.DEV) {
  configureLogger({
    level: 'debug',      // Show everything
    enabled: true,       // Enable logging
    showTimestamp: true  // Include timestamps for performance analysis
  })
}

// Production: Show only warnings and errors to reduce noise
if (import.meta.env.PROD) {
  setLogLevel('warn')
}

// Disable logging entirely (not recommended)
// import { disableLogging } from 'vuesip'
// disableLogging()
```

💡 **Tip:** Keep debug logging enabled in development to catch issues early, but limit production logs to avoid performance impact.

### Creating Component Loggers

Use namespaced loggers to identify which part of your application generated each log message.

```typescript
import { createLogger } from 'vuesip'

// Create logger with namespace
const logger = createLogger('MyComponent')

function handleOperation() {
  // Debug: Verbose development info
  logger.debug('Starting operation', { timestamp: Date.now() })

  try {
    performOperation()

    // Info: Important successful events
    logger.info('Operation completed successfully')
  } catch (error) {
    // Error: Failures that need attention
    logger.error('Operation failed:', error)
  }
}

// Create child logger for sub-components
const subLogger = logger.child('SubComponent')
subLogger.debug('Sub-component initialized')
// Logs will show: [MyComponent:SubComponent] Sub-component initialized
```

**Log output example:**
```
[MyComponent] Starting operation { timestamp: 1234567890 }
[MyComponent] Operation completed successfully
[MyComponent:SubComponent] Sub-component initialized
```

✅ **Best Practice:** Use descriptive namespaces like 'CallManager', 'MediaHandler', 'ConnectionService' to make logs searchable.

### Custom Log Handler

Send important logs to your error monitoring service for production debugging.

```typescript
import { setLogHandler } from 'vuesip'

// Custom handler that sends errors to your server
setLogHandler((level, namespace, message, ...args) => {
  const logEntry = {
    level,
    namespace,
    message,
    args,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    // Add custom context
    userId: getCurrentUserId(),
    sessionId: getSessionId()
  }

  // Send warnings and errors to monitoring service (e.g., Sentry, LogRocket)
  if (level === 'warn' || level === 'error') {
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    }).catch(console.error) // Don't let logging errors crash the app
  }

  // Also log to browser console for development
  console[level === 'debug' ? 'log' : level](
    `[${namespace}] ${message}`,
    ...args
  )
})
```

📝 **Note:** This dual-logging approach maintains local development logs while collecting production errors for analysis.

### Debug Event Flow

Track event sequences to understand application flow and diagnose issues.

```typescript
import { EventBus } from 'vuesip'

const eventBus = new EventBus()

// Development: Log all events to see the complete flow
if (import.meta.env.DEV) {
  // Wildcard listener catches ALL events
  eventBus.on('*', (event) => {
    console.log('[Event]', event.type, event)
  })
}

// Track specific event sequences for debugging
const eventSequence: string[] = []

eventBus.on('sip:connecting', () => {
  eventSequence.push('connecting')
})

eventBus.on('sip:connected', () => {
  eventSequence.push('connected')
  console.log('Connection sequence:', eventSequence)
  // Output: ['connecting', 'connected']
})

eventBus.on('sip:disconnected', () => {
  eventSequence.push('disconnected')
  console.log('Disconnection sequence:', eventSequence)
  // Might show: ['connecting', 'connected', 'disconnected']
})
```

💡 **Tip:** Event sequences help you understand "what happened before this error?" which is crucial for debugging timing-related issues.

### Network Diagnostics

Monitor call quality in real-time to detect and respond to network issues.

**Key Metrics:**
- **Packet Loss** - Percentage of packets that didn't arrive (>5% is problematic)
- **Jitter** - Variation in packet arrival times (>30ms is problematic)
- **Bitrate** - Data transfer rate for audio (lower = worse quality)
- **RTT** - Round-trip time, aka latency (>200ms is problematic)

```typescript
import { useCallSession } from 'vuesip'

const { activeCall, getMediaStatistics } = useCallSession()

// Monitor call quality every 5 seconds
const statsInterval = setInterval(async () => {
  if (!activeCall.value) return

  const stats = await getMediaStatistics()

  if (stats) {
    console.log('Call Statistics:', {
      audio: {
        packetsLost: stats.audio?.packetsLost,
        packetLoss: stats.audio?.packetLossPercentage?.toFixed(2) + '%',
        jitter: stats.audio?.jitter?.toFixed(3) + 's',
        bitrate: (stats.audio?.bitrate / 1000).toFixed(0) + ' kbps'
      },
      network: {
        rtt: stats.network?.currentRoundTripTime?.toFixed(3) + 's',
        bytesReceived: (stats.network?.totalBytesReceived / 1024).toFixed(0) + ' KB',
        bytesSent: (stats.network?.totalBytesSent / 1024).toFixed(0) + ' KB'
      }
    })

    // Warn about poor quality
    if (stats.audio?.packetLossPercentage > 5) {
      console.warn('High packet loss detected:', stats.audio.packetLossPercentage + '%')
      showWarning('Call quality is poor due to network issues')
    }
  }
}, 5000) // Check every 5 seconds

// Clean up interval when component unmounts
onUnmounted(() => {
  clearInterval(statsInterval)
})
```

⚠️ **Warning:** High packet loss (>5%) makes calls sound choppy. High jitter (>30ms) makes voices sound robotic. Monitor these metrics and inform users when quality degrades.

---

## Common Issues and Solutions

This section covers the most frequent problems you'll encounter and proven solutions. Use these as a troubleshooting checklist.

### Issue 1: Microphone Permission Denied

**Symptoms:**
- ❌ `NotAllowedError` when requesting media
- ❌ No audio in calls
- ❌ Empty device list

**Causes:**
- User clicked "Block" on permission prompt
- Browser settings permanently blocked microphone
- Using HTTP instead of HTTPS (browsers block mic on HTTP)

**Solutions:**

```typescript
import { useMediaDevices } from 'vuesip'

const { requestPermissions, hasPermission, error } = useMediaDevices()

async function handlePermissionDenied() {
  try {
    // Request microphone permission
    await requestPermissions()
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      // Show detailed instructions to user
      showModal({
        title: 'Microphone Access Required',
        message: `
          VoIP calls require microphone access. Please follow these steps:

          1. Click the camera icon in your browser's address bar
          2. Change microphone setting from "Block" to "Allow"
          3. Refresh the page

          Still having trouble? Check your browser settings.
        `
      })
    }
  }
}

// Monitor permission status
watch(hasPermission, (permissions) => {
  if (permissions.audio === 'denied') {
    showWarning('Microphone access is blocked. Calls will not work.')
  }
})
```

**Prevention:**
- ✅ Request permissions early with context: "We need microphone access to make calls"
- ✅ Use HTTPS in production (required for mic access)
- ✅ Provide clear instructions before requesting permission
- ✅ Test permission flow in different browsers

💡 **Tip:** Users are more likely to grant permission if you explain why you need it first, rather than showing the browser prompt immediately.

### Issue 2: Connection Timeout

**Symptoms:**
- ❌ Connection fails to establish
- ❌ `ConnectionState` stuck in `connecting`
- ❌ "Connection timeout" errors

**Causes:**
- Corporate firewall blocking WebSocket connections
- Incorrect server URI (typo in configuration)
- SIP server is down or unreachable
- Network connectivity issues (offline, slow connection)

**Solutions:**

```typescript
import { useSipClient } from 'vuesip'

const { connect, connectionState } = useSipClient(config)

/**
 * Connect with timeout to avoid hanging indefinitely
 * @param timeoutMs - Maximum time to wait for connection (default: 10 seconds)
 */
async function connectWithTimeout(timeoutMs = 10000) {
  // Create a promise that rejects after timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
  })

  try {
    // Race between connection and timeout
    await Promise.race([connect(), timeoutPromise])
  } catch (error) {
    if (error.message === 'Connection timeout') {
      showError(`
        Unable to connect to server. Please check:

        - Is your internet connection working?
        - Is the server URI correct? (Currently: ${config.uri})
        - Is your firewall blocking WebSocket connections?

        Contact your administrator if the problem persists.
      `)
    }
    throw error
  }
}

// Monitor connection state for failures
watch(connectionState, (state) => {
  if (state === 'connection_failed') {
    console.error('Connection failed')
    // Offer fallback options
    showErrorWithActions({
      message: 'Connection failed',
      actions: [
        { label: 'Retry', onClick: () => connect() },
        { label: 'Use Different Server', onClick: () => showServerSelection() }
      ]
    })
  }
})
```

**Prevention:**
- ✅ Validate server URI format before attempting connection
- ✅ Implement connection timeout (don't wait forever)
- ✅ Show connection status to user
- ✅ Provide fallback server options if available
- ✅ Test connectivity to server with a simple ping/health check first

📝 **Note:** WebSocket connections can be blocked by corporate firewalls. Provide clear error messages directing users to their IT department.

### Issue 3: Registration Failure (401/403)

**Symptoms:**
- ❌ `RegistrationState` is `registration_failed`
- ❌ "401 Unauthorized" or "403 Forbidden" errors
- ❌ Cannot make or receive calls

**Causes:**
- **401** - Wrong username or password
- **403** - Correct credentials but access denied (IP restriction, account disabled)
- Incorrect authentication realm
- Account not activated on server

**Solutions:**

```typescript
import { useSipClient, useSipRegistration } from 'vuesip'

const { registrationState } = useSipRegistration()

// Listen for registration failures with detailed error handling
eventBus.on('sip:registration_failed', (event) => {
  console.error('Registration failed:', event)

  const cause = event.cause || ''

  if (cause.includes('401')) {
    // Authentication failed - credentials are wrong
    showError('Invalid username or password. Please check your credentials.')
    // Prompt user to re-enter credentials
    showLoginDialog()
  } else if (cause.includes('403')) {
    // Forbidden - account or IP issue
    showError('Access forbidden. Your account may be disabled or your IP address may not be whitelisted. Contact your administrator.')
  } else if (cause.includes('timeout')) {
    // Network timeout
    showError('Registration timeout. Please check your network connection.')
  } else {
    // Generic fallback
    showError('Registration failed: ' + cause)
  }
})

// Validate credentials before attempting registration
function validateCredentials(config: SipClientConfig) {
  if (!config.sipUri || !config.password) {
    throw new Error('Username and password are required')
  }

  const validation = validateSipUri(config.sipUri)
  if (!validation.valid) {
    throw new Error('Invalid SIP URI format: ' + validation.error)
  }
}
```

**Prevention:**
- ✅ Validate credentials format before attempting registration
- ✅ Store credentials securely (never in localStorage)
- ✅ Implement credential verification flow
- ✅ Show clear, actionable error messages
- ✅ Limit retry attempts to avoid account lockout

⚠️ **Warning:** Excessive registration attempts with wrong credentials can trigger account lockouts on some SIP servers.

### Issue 4: Audio Not Working During Call

**Symptoms:**
- ❌ Call connects but no audio heard
- ❌ One-way audio (you can't hear them OR they can't hear you)
- ❌ Audio cutting in and out

**Causes:**
- Microphone or speaker muted
- Wrong audio device selected
- Network issues (packet loss, jitter)
- NAT/firewall blocking RTP packets (actual audio data)
- Echo cancellation or noise suppression issues

**Solutions:**

```typescript
import { useCallSession, useMediaDevices } from 'vuesip'

const { activeCall, isMuted, mute, unmute } = useCallSession()
const { selectedAudioInput, selectedAudioOutput, enumerateDevices } = useMediaDevices()

/**
 * Comprehensive audio diagnostics
 * Run this when users report "no audio"
 */
async function diagnoseAudioIssues() {
  console.log('=== Audio Diagnostics ===')

  // Check 1: Is microphone muted?
  if (isMuted.value) {
    console.warn('⚠️ Microphone is muted')
    await unmute()
    showNotification('Microphone was muted - now unmuted')
  }

  // Check 2: Are devices properly selected?
  const devices = await enumerateDevices()
  console.log('Available devices:', devices)
  console.log('Selected input:', selectedAudioInput.value)
  console.log('Selected output:', selectedAudioOutput.value)

  // Check 3: Are media streams active?
  if (activeCall.value) {
    const localStream = activeCall.value.localStream  // Your audio
    const remoteStream = activeCall.value.remoteStream // Their audio

    console.log('Local stream (your mic):', {
      active: localStream?.active,
      tracks: localStream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,      // Is track enabled?
        muted: t.muted,         // Is track muted?
        readyState: t.readyState // Is track live?
      }))
    })

    console.log('Remote stream (their mic):', {
      active: remoteStream?.active,
      tracks: remoteStream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      }))
    })
  }

  // Check 4: Network quality
  const stats = await getMediaStatistics()
  if (stats?.audio) {
    console.log('Audio quality:', {
      packetLoss: stats.audio.packetLossPercentage + '%',
      jitter: stats.audio.jitter + 's',
      bitrate: stats.audio.bitrate + ' bps'
    })

    if (stats.audio.packetLossPercentage > 5) {
      console.warn('⚠️ High packet loss - poor network quality')
      showWarning('Audio quality is poor due to network issues')
    }
  }
}
```

**Prevention:**
- ✅ Test audio devices before calls with echo test
- ✅ Monitor call quality with statistics
- ✅ Provide audio troubleshooting UI
- ✅ Use appropriate codecs for network conditions

💡 **Tip:** Implement an "echo test" feature where users can call a test number that plays their voice back to verify audio is working.

### Issue 5: Call Drops or Connection Lost

**Symptoms:**
- ❌ Active call suddenly ends
- ❌ `TerminationCause` is `network_error`
- ❌ WebSocket disconnects during call

**Causes:**
- Network instability (weak WiFi, congested network)
- Mobile device switching networks (WiFi to cellular)
- Server timeout or restart
- Firewall closing idle connections

**Solutions:**

```typescript
import { useCallSession, useSipClient } from 'vuesip'

const { activeCall } = useCallSession()
const { connectionState, connect } = useSipClient(config)

// Monitor connection during active calls
watch(connectionState, async (state) => {
  if (state === 'disconnected' && activeCall.value) {
    console.error('Connection lost during active call')

    showNotification('Connection lost - attempting to reconnect...')

    try {
      // Attempt immediate reconnection
      await connect()
      showNotification('Reconnected successfully')
    } catch (error) {
      console.error('Reconnection failed:', error)
      showError('Unable to reconnect - call ended')
    }
  }
})

// Listen for call failures
eventBus.on('call:failed', (event) => {
  if (event.terminationCause === 'network_error') {
    showError('Call dropped due to network issues')

    // Log for diagnostics
    logNetworkError({
      terminationCause: event.terminationCause,
      timestamp: new Date(),
      callDuration: event.duration
    })
  }
})

// Implement WebSocket keep-alive to prevent idle connection closure
function setupKeepAlive() {
  const keepAliveInterval = setInterval(() => {
    if (connectionState.value === 'connected') {
      // Send periodic OPTIONS request or custom keep-alive
      // This prevents firewall from closing the connection due to inactivity
      sipClient.sendKeepAlive() // Hypothetical method
    }
  }, 30000) // Every 30 seconds

  onUnmounted(() => clearInterval(keepAliveInterval))
}
```

**Prevention:**
- ✅ Implement connection monitoring
- ✅ Use session timers (SIP feature) to detect dead connections
- ✅ Handle network changes gracefully
- ✅ Provide automatic reconnection logic
- ✅ Send periodic keep-alive packets

📝 **Note:** Mobile devices frequently switch between WiFi and cellular, causing brief connection losses. Robust reconnection logic is essential for mobile apps.

### Issue 6: Device Not Found or In Use

**Symptoms:**
- ❌ `NotFoundError` - No media devices available
- ❌ `NotReadableError` - Device is already in use
- ❌ Empty device list

**Causes:**
- No physical devices connected (no microphone plugged in)
- Device being used by another application (Zoom, Skype, etc.)
- Another browser tab already using the device
- Device permissions not granted yet
- Virtual audio devices malfunctioning

**Solutions:**

```typescript
import { useMediaDevices } from 'vuesip'

const { enumerateDevices, requestPermissions, audioInputs } = useMediaDevices()

async function handleDeviceErrors() {
  try {
    // Step 1: Request permissions first (required to enumerate devices)
    await requestPermissions()

    // Step 2: Enumerate available devices
    await enumerateDevices()

    // Step 3: Check if any audio inputs found
    if (audioInputs.value.length === 0) {
      showError(`
        No microphone detected. Please:

        - Check if a microphone is connected
        - Try unplugging and reconnecting your USB microphone
        - Restart your browser
        - Check System Settings to ensure microphone is recognized
      `)
      return
    }
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      showError('No microphone found. Please connect a microphone and try again.')
    } else if (err.name === 'NotReadableError') {
      showError(`
        Microphone is already in use. Please:

        - Close other applications using the microphone (Zoom, Skype, etc.)
        - Check if another browser tab is using the microphone
        - Try restarting your browser
      `)
    }
  }
}

// Monitor device changes (e.g., USB devices plugged/unplugged)
eventBus.on('media:device:changed', (event) => {
  console.log('Device change detected:', {
    added: event.addedDevices,
    removed: event.removedDevices,
    current: event.currentDevices
  })

  // Handle device removal
  if (event.removedDevices.length > 0) {
    showNotification('Audio device disconnected')

    // Automatically switch to another device if available
    if (audioInputs.value.length > 0) {
      setAudioInput(audioInputs.value[0].deviceId)
      showNotification(`Switched to ${audioInputs.value[0].label}`)
    } else {
      showError('No audio devices available')
    }
  }
})
```

**Prevention:**
- ✅ Check for devices before allowing calls
- ✅ Handle device changes during calls
- ✅ Provide clear device selection UI
- ✅ Show device status indicators
- ✅ Test with different device types (USB, Bluetooth, built-in)

💡 **Tip:** Some users have virtual audio devices (like OBS Virtual Audio) that can cause issues. Provide a way to manually select "real" devices.

### Issue 7: Storage Quota Exceeded

**Symptoms:**
- ❌ `QuotaExceededError` thrown
- ❌ Unable to save recordings or call history
- ❌ Persistence operations fail silently

**Causes:**
- Too many recordings stored (audio files are large)
- Call history grown too large
- Browser storage limit reached (typically 5-50 MB)
- Other applications using storage from same domain

**Solutions:**

```typescript
import {
  getStorageQuota,
  hasEnoughSpace,
  clearOldDataLRU,
  checkStorageUsageWarning
} from 'vuesip'

/**
 * Check and manage storage quota
 * Call this periodically or before saving large files
 */
async function handleStorageQuota() {
  // Get current storage usage
  const quota = await getStorageQuota()

  console.log('Storage:', {
    used: (quota.usage / 1024 / 1024).toFixed(2) + ' MB',
    total: (quota.quota / 1024 / 1024).toFixed(2) + ' MB',
    available: (quota.available / 1024 / 1024).toFixed(2) + ' MB',
    percentage: quota.usagePercent.toFixed(1) + '%'
  })

  // Warn user if usage is high
  const isHigh = await checkStorageUsageWarning(80) // 80% threshold
  if (isHigh) {
    showWarning(`
      Storage is ${quota.usagePercent.toFixed(0)}% full.
      Consider cleaning up old recordings or call history.
    `)
  }

  // Proactive cleanup if very high
  if (quota.usagePercent > 90) {
    await cleanupStorage()
  }
}

async function cleanupStorage() {
  try {
    // Remove oldest 30% of recordings
    const removedRecordings = await clearOldDataLRU(
      () => getAllRecordings(),      // Function that returns all recordings
      (ids) => deleteRecordings(ids), // Function to delete recordings by ID
      30 // Remove oldest 30%
    )

    // Remove oldest 30% of call history
    const removedHistory = await clearOldDataLRU(
      () => getCallHistory(),
      (ids) => deleteHistoryEntries(ids),
      30
    )

    showNotification(`
      Cleaned up ${removedRecordings} recordings and
      ${removedHistory} history entries to free space.
    `)
  } catch (error) {
    console.error('Cleanup failed:', error)
  }
}

// Always check before saving large files
async function saveRecordingWithCheck(recording: RecordingData) {
  // Check if we have enough space (with 10% safety margin)
  const hasSpace = await hasEnoughSpace(recording.size, 0.1)

  if (!hasSpace) {
    // Proactive cleanup
    await cleanupStorage()
  }

  try {
    await saveRecording(recording)
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      showError('Storage full. Please free up space or delete old recordings.')
    }
    throw error
  }
}
```

**Prevention:**
- ✅ Monitor storage usage regularly
- ✅ Implement automatic cleanup policies
- ✅ Limit recording duration or quality to reduce file size
- ✅ Provide manual cleanup controls in UI
- ✅ Warn users before quota is reached (at 80%)

📝 **Note:** Browser storage quotas vary widely. Safari on iOS is particularly restrictive (~5MB), while Chrome can provide 50MB+ on desktop.

### Issue 8: DTMF Tones Not Working

**Symptoms:**
- ❌ DTMF tones not sent or not heard locally
- ❌ Remote system doesn't respond to tones (IVR, voicemail)
- ❌ Invalid tone errors

**Causes:**
- Call not in 'active' state yet
- Invalid DTMF tone character (only 0-9, *, #, A-D allowed)
- Duration too short for receiver to detect
- SIP server doesn't support RTP DTMF events

**Solutions:**

```typescript
import { useSipDtmf } from 'vuesip'
import { validateDtmfTone } from 'vuesip'

const { sendDTMF, isSending } = useSipDtmf()

/**
 * Send DTMF tone with validation
 * @param tone - Single digit (0-9, *, #, A-D)
 */
async function sendToneWithValidation(tone: string) {
  // Step 1: Validate tone character
  const validation = validateDtmfTone(tone)
  if (!validation.valid) {
    showError('Invalid DTMF tone: ' + validation.error)
    return
  }

  // Step 2: Check if call is active
  if (!activeCall.value || activeCall.value.state !== 'active') {
    showError('Cannot send DTMF - no active call')
    return
  }

  try {
    // Step 3: Send with appropriate timing
    await sendDTMF(validation.normalized!, {
      duration: 100,      // Duration of tone in milliseconds
      interToneGap: 70   // Gap between tones in milliseconds
    })
  } catch (error) {
    console.error('DTMF send failed:', error)
    showError('Failed to send DTMF tone')
  }
}

/**
 * Send sequence of DTMF tones (e.g., "1234#")
 * @param sequence - String of valid DTMF characters
 */
async function sendDTMFSequence(sequence: string) {
  const validation = validateDtmfSequence(sequence)
  if (!validation.valid) {
    showError('Invalid DTMF sequence: ' + validation.error)
    return
  }

  // Send each tone in sequence with delays
  for (const tone of validation.normalized!) {
    await sendToneWithValidation(tone)
    // Wait between tones to ensure they're detected separately
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}
```

**Prevention:**
- ✅ Validate DTMF input before sending
- ✅ Check call state before allowing DTMF
- ✅ Use appropriate tone duration (100ms minimum)
- ✅ Test DTMF with your SIP server's IVR system
- ✅ Provide visual feedback when tones are sent

💡 **Tip:** Some older IVR systems require longer tone durations (150-200ms). If tones aren't being recognized, try increasing the duration.

---

## Best Practices

Follow these proven patterns to build robust, maintainable VoIP applications that handle errors professionally.

### 1. Always Handle Errors

Never leave operations without error handling. Unhandled errors crash applications and frustrate users.

```typescript
// ❌ Bad - Errors will crash the application
await connect()
await makeCall(target)

// ✅ Good - Errors are caught and handled
try {
  await connect()
  await makeCall(target)
} catch (error) {
  console.error('Operation failed:', error)
  handleError(error)
}
```

### 2. Provide User Feedback

Users deserve to know what went wrong and what they can do about it.

```typescript
// ❌ Bad - User has no idea what happened
try {
  await connect()
} catch (error) {
  console.error(error) // Only logged, user sees nothing
}

// ✅ Good - User is informed
try {
  await connect()
  showSuccess('Connected successfully')
} catch (error) {
  console.error(error)
  showError('Failed to connect: ' + error.message)
  // Even better: provide actionable guidance
  showErrorWithActions({
    message: 'Failed to connect',
    actions: [
      { label: 'Retry', onClick: () => connect() },
      { label: 'Help', onClick: () => showTroubleshooting() }
    ]
  })
}
```

### 3. Clean Up Resources

Always clean up timers, intervals, and event listeners, especially in error cases.

```typescript
// ❌ Bad - Timer keeps running if operation fails
const timer = setInterval(checkStatus, 1000)
await doOperation()
clearInterval(timer)

// ✅ Good - Timer is always cleaned up
const timer = setInterval(checkStatus, 1000)
try {
  await doOperation()
} finally {
  clearInterval(timer) // Runs whether operation succeeds or fails
}
```

### 4. Use Specific Error Types

Handle different errors differently based on their type.

```typescript
// ❌ Bad - All errors treated the same
catch (error) {
  showError('Something went wrong')
}

// ✅ Good - Specific errors get specific handling
catch (error: any) {
  if (error instanceof QuotaExceededError) {
    handleQuotaExceeded(error)
  } else if (error.name === 'NotAllowedError') {
    handlePermissionDenied(error)
  } else {
    handleGenericError(error)
  }
}
```

### 5. Log Errors Appropriately

Use appropriate log levels to make logs useful without creating noise.

```typescript
// Use debug for verbose development information
logger.debug('Attempting connection', { uri: config.uri })

// Use info for important successful events
logger.info('Connected successfully')

// Use warn for potential issues that don't stop functionality
logger.warn('High packet loss detected:', packetLoss)

// Use error for actual failures
logger.error('Connection failed:', error)
```

### 6. Validate Input Early

Catch invalid input before attempting expensive operations.

```typescript
// ✅ Good - Validate before proceeding
function makeCall(target: string) {
  // Validate first
  const validation = validateSipUri(target)
  if (!validation.valid) {
    throw new Error('Invalid target: ' + validation.error)
  }

  // Then proceed with validated, normalized input
  return performCall(validation.normalized!)
}
```

### 7. Implement Retry Logic Wisely

Don't retry indefinitely - respect user's time and server resources.

```typescript
// ✅ Good - Limited retries with exponential backoff
async function retryOperation(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      if (i === maxRetries - 1) throw error // Don't retry after last attempt
      await delay(1000 * Math.pow(2, i)) // Exponential backoff: 1s, 2s, 4s
    }
  }
}
```

### 8. Monitor Application Health

Track error patterns to identify systemic issues.

```typescript
const errorCounts = new Map<string, number>()

function trackError(errorType: string) {
  const count = errorCounts.get(errorType) || 0
  errorCounts.set(errorType, count + 1)

  // Alert if error rate is too high
  if (count > 5) {
    alertSupport('High error rate detected: ' + errorType)
  }
}
```

### 9. Provide Recovery Options

Give users ways to fix problems themselves instead of dead ends.

```typescript
// ✅ Good - Offer actionable recovery options
showErrorWithActions({
  message: 'Connection failed',
  actions: [
    { label: 'Retry', onClick: () => connect() },
    { label: 'Use Different Server', onClick: () => showServerSelection() },
    { label: 'Help', onClick: () => openHelpDialog() }
  ]
})
```

### 10. Test Error Scenarios

Don't just test happy paths - test failures too.

```typescript
// Test connection failure
it('should handle connection failure', async () => {
  mockWebSocket.simulate('error', new Error('Connection failed'))

  await expect(connect()).rejects.toThrow('Connection failed')
  expect(connectionState.value).toBe('connection_failed')
})

// Test recovery from disconnection
it('should recover from disconnection', async () => {
  // Simulate unexpected disconnect
  mockWebSocket.simulate('close', { code: 1006 })

  // Should detect disconnection
  await waitFor(() => {
    expect(connectionState.value).toBe('disconnected')
  })

  // Should attempt automatic reconnection
  await waitFor(() => {
    expect(connectionState.value).toBe('connecting')
  })
})
```

---

## Summary

Effective error handling in VueSip involves several key principles:

1. **Understanding Error Types** - Know what each error means and when it occurs
   - Storage, media, call, connection, registration, and validation errors
   - Each type requires different handling strategies

2. **Proper Error Handling** - Use proven patterns consistently
   - Try-catch blocks for async operations
   - Reactive state management for UI integration
   - Event-based handling for centralized logic
   - Early validation to prevent errors

3. **Recovery Strategies** - Bounce back from failures gracefully
   - Retry with exponential backoff
   - Automatic reconnection
   - Device failover
   - Storage quota management

4. **Debugging Tools** - Use logging and diagnostics effectively
   - Configure appropriate log levels
   - Create namespaced loggers
   - Monitor network statistics
   - Track event sequences

5. **Common Issues** - Recognize and fix frequent problems quickly
   - Permission denied, connection timeout, registration failure
   - Audio issues, device errors, storage quota
   - Each has specific causes and proven solutions

6. **Best Practices** - Follow patterns that lead to robust applications
   - Always handle errors with user feedback
   - Clean up resources in finally blocks
   - Validate input early
   - Implement wise retry logic
   - Test error scenarios

By following this guide, you'll build VoIP applications that handle errors gracefully, recover automatically when possible, and provide clear guidance to users when manual intervention is needed. This leads to professional applications that users trust and enjoy using, even when things go wrong.

---

## Additional Resources

Continue learning with these related guides:

- [Getting Started Guide](./getting-started.md) - Set up your first VueSip application
- [Making Calls Guide](./making-calls.md) - Learn call management and features
- [Device Management Guide](./device-management.md) - Handle microphones, speakers, and cameras
- [API Reference](/api) - Complete API documentation
