/**
 * Robust test utilities for integration tests
 * Provides deterministic waiting and event handling helpers
 */

/**
 * Wait for a condition to become true with timeout
 * More robust than arbitrary setTimeout delays
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    timeoutMessage?: string
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50, timeoutMessage = 'Condition not met within timeout' } = options

  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition())
    if (result) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(timeoutMessage)
}

/**
 * Wait for an event to be emitted on an EventBus or object
 */
export function waitForEvent<T = any>(
  emitter: { on: (event: string, handler: (data: T) => void) => void; off?: (event: string, handler: (data: T) => void) => void },
  event: string,
  options: {
    timeout?: number
    timeoutMessage?: string
  } = {}
): Promise<T> {
  const { timeout = 5000, timeoutMessage = `Event '${event}' not emitted within timeout` } = options

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (emitter.off) {
        emitter.off(event, handler)
      }
      reject(new Error(timeoutMessage))
    }, timeout)

    const handler = (data: T) => {
      clearTimeout(timer)
      if (emitter.off) {
        emitter.off(event, handler)
      }
      resolve(data)
    }

    emitter.on(event, handler)
  })
}

/**
 * Flush all pending microtasks and timers
 * More comprehensive than simple flushMicrotasks
 */
export async function flushAll(maxWait: number = 100): Promise<void> {
  // Flush microtasks
  await new Promise(resolve => setTimeout(resolve, 0))
  
  // Give a small window for any pending timers
  await new Promise(resolve => setTimeout(resolve, maxWait))
}

/**
 * Retry a function until it succeeds or max attempts reached
 * Useful for flaky operations in CI
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 100, onRetry } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Promise.resolve(fn())
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        onRetry?.(attempt, lastError)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Wait for multiple conditions to all become true
 */
export async function waitForAll(
  conditions: Array<() => boolean | Promise<boolean>>,
  options: {
    timeout?: number
    interval?: number
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options

  await waitFor(
    async () => {
      const results = await Promise.all(conditions.map(c => Promise.resolve(c())))
      return results.every(r => r === true)
    },
    { timeout, interval, timeoutMessage: 'Not all conditions met within timeout' }
  )
}

/**
 * Create a deferred promise that can be resolved externally
 */
export function createDeferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  
  return { promise, resolve, reject }
}
