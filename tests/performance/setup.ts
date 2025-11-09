/**
 * Performance Test Setup
 *
 * Utilities for performance testing, benchmarking, and metrics collection.
 * This module provides tools for:
 * - Memory usage tracking
 * - Timing measurements
 * - Performance budget validation
 * - Performance assertions
 *
 * @module tests/performance/setup
 */

import { expect } from 'vitest'
import { PERFORMANCE } from '../../src/utils/constants'

// ============================================================================
// Types
// ============================================================================

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: number
  /** Total heap size in bytes */
  totalHeapSize: number
  /** Used heap size in bytes */
  usedHeapSize: number
  /** Heap limit in bytes */
  heapLimit: number
  /** External memory in bytes */
  external?: number
}

/**
 * Performance timing result
 */
export interface TimingResult {
  /** Operation name */
  name: string
  /** Start time in milliseconds */
  startTime: number
  /** End time in milliseconds */
  endTime: number
  /** Duration in milliseconds */
  duration: number
  /** Memory usage before operation */
  memoryBefore?: MemorySnapshot
  /** Memory usage after operation */
  memoryAfter?: MemorySnapshot
}

/**
 * Performance budget definition
 */
export interface PerformanceBudget {
  /** Budget name */
  name: string
  /** Maximum allowed value */
  maxValue: number
  /** Unit of measurement */
  unit: 'ms' | 'bytes' | 'MB' | 'calls' | '%'
  /** Optional warning threshold (triggers warning but not failure) */
  warningThreshold?: number
}

/**
 * Performance metrics collection
 */
export interface PerformanceMetrics {
  /** Metric name */
  name: string
  /** Collected values */
  values: number[]
  /** Average value */
  average: number
  /** Minimum value */
  min: number
  /** Maximum value */
  max: number
  /** Median value */
  median: number
  /** 95th percentile */
  p95: number
  /** 99th percentile */
  p99: number
  /** Standard deviation */
  stdDev: number
}

/**
 * Load test result
 */
export interface LoadTestResult {
  /** Test name */
  name: string
  /** Total operations executed */
  totalOperations: number
  /** Successful operations */
  successfulOperations: number
  /** Failed operations */
  failedOperations: number
  /** Total duration in milliseconds */
  totalDuration: number
  /** Operations per second */
  operationsPerSecond: number
  /** Average operation duration in milliseconds */
  averageDuration: number
  /** Memory usage */
  memoryUsage: {
    initial: MemorySnapshot
    peak: MemorySnapshot
    final: MemorySnapshot
  }
}

// ============================================================================
// Memory Tracking
// ============================================================================

/**
 * Get current memory usage snapshot
 *
 * @returns Memory snapshot with current usage
 */
export function getMemorySnapshot(): MemorySnapshot {
  // Force garbage collection if available (run Node with --expose-gc)
  if (global.gc) {
    global.gc()
  }

  const memory =
    (
      performance as {
        memory?: { totalJSHeapSize?: number; usedJSHeapSize?: number; jsHeapSizeLimit?: number }
      }
    ).memory ||
    ({} as { totalJSHeapSize?: number; usedJSHeapSize?: number; jsHeapSizeLimit?: number })

  return {
    timestamp: Date.now(),
    totalHeapSize: memory.totalJSHeapSize || 0,
    usedHeapSize: memory.usedJSHeapSize || 0,
    heapLimit: memory.jsHeapSizeLimit || 0,
    external:
      typeof process !== 'undefined' && process.memoryUsage
        ? process.memoryUsage().external
        : undefined,
  }
}

/**
 * Calculate memory delta between two snapshots
 *
 * @param before - Memory snapshot before operation
 * @param after - Memory snapshot after operation
 * @returns Memory delta in bytes
 */
export function calculateMemoryDelta(before: MemorySnapshot, after: MemorySnapshot): number {
  return after.usedHeapSize - before.usedHeapSize
}

/**
 * Format bytes to human-readable format
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Track memory usage during operation execution
 *
 * @param operation - Function to track
 * @returns Memory usage information
 */
export async function trackMemory<T>(operation: () => Promise<T> | T): Promise<{
  result: T
  memoryBefore: MemorySnapshot
  memoryAfter: MemorySnapshot
  memoryDelta: number
}> {
  const memoryBefore = getMemorySnapshot()
  const result = await operation()
  const memoryAfter = getMemorySnapshot()
  const memoryDelta = calculateMemoryDelta(memoryBefore, memoryAfter)

  return {
    result,
    memoryBefore,
    memoryAfter,
    memoryDelta,
  }
}

// ============================================================================
// Timing Measurements
// ============================================================================

/**
 * Measure execution time of an operation
 *
 * @param name - Operation name
 * @param operation - Function to measure
 * @param options - Measurement options
 * @returns Timing result
 */
export async function measureTime<T>(
  name: string,
  operation: () => Promise<T> | T,
  options: {
    trackMemory?: boolean
    iterations?: number
  } = {}
): Promise<TimingResult & { result: T }> {
  const { trackMemory: shouldTrackMemory = false, iterations = 1 } = options

  const memoryBefore = shouldTrackMemory ? getMemorySnapshot() : undefined
  const startTime = performance.now()

  let result: T | undefined
  for (let i = 0; i < iterations; i++) {
    result = await operation()
  }

  const endTime = performance.now()
  const memoryAfter = shouldTrackMemory ? getMemorySnapshot() : undefined

  if (result === undefined) {
    throw new Error('Operation did not return a result')
  }

  return {
    name,
    startTime,
    endTime,
    duration: endTime - startTime,
    memoryBefore,
    memoryAfter,
    result,
  }
}

/**
 * Measure multiple iterations and collect statistics
 *
 * @param name - Operation name
 * @param operation - Function to measure
 * @param iterations - Number of iterations
 * @returns Performance metrics
 */
export async function measureMultiple(
  name: string,
  operation: () => Promise<void> | void,
  iterations: number = 100
): Promise<PerformanceMetrics> {
  const values: number[] = []

  for (let i = 0; i < iterations; i++) {
    const result = await measureTime(`${name}-${i}`, operation)
    values.push(result.duration)
  }

  return calculateMetrics(name, values)
}

/**
 * Calculate statistical metrics from values
 *
 * @param name - Metric name
 * @param values - Array of measured values
 * @returns Calculated metrics
 */
export function calculateMetrics(name: string, values: number[]): PerformanceMetrics {
  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((acc, val) => acc + val, 0)
  const average = sum / values.length

  // Calculate standard deviation
  const squareDiffs = values.map((value) => Math.pow(value - average, 2))
  const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / values.length
  const stdDev = Math.sqrt(avgSquareDiff)

  // Calculate percentiles
  const p95Index = Math.ceil(sorted.length * 0.95) - 1
  const p99Index = Math.ceil(sorted.length * 0.99) - 1
  const medianIndex = Math.floor(sorted.length / 2)

  return {
    name,
    values,
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[medianIndex],
    p95: sorted[p95Index],
    p99: sorted[p99Index],
    stdDev,
  }
}

// ============================================================================
// Performance Budgets
// ============================================================================

/**
 * Predefined performance budgets based on PERFORMANCE constants
 */
export const PERFORMANCE_BUDGETS = {
  callSetupTime: {
    name: 'Call Setup Time',
    maxValue: PERFORMANCE.TARGET_CALL_SETUP_TIME,
    unit: 'ms',
    warningThreshold: PERFORMANCE.TARGET_CALL_SETUP_TIME * 0.8,
  } as PerformanceBudget,

  stateUpdateLatency: {
    name: 'State Update Latency',
    maxValue: PERFORMANCE.MAX_STATE_UPDATE_LATENCY,
    unit: 'ms',
    warningThreshold: PERFORMANCE.MAX_STATE_UPDATE_LATENCY * 0.8,
  } as PerformanceBudget,

  eventPropagationTime: {
    name: 'Event Propagation Time',
    maxValue: PERFORMANCE.MAX_EVENT_PROPAGATION_TIME,
    unit: 'ms',
    warningThreshold: PERFORMANCE.MAX_EVENT_PROPAGATION_TIME * 0.8,
  } as PerformanceBudget,

  memoryPerCall: {
    name: 'Memory Per Call',
    maxValue: PERFORMANCE.MAX_MEMORY_PER_CALL,
    unit: 'bytes',
    warningThreshold: PERFORMANCE.MAX_MEMORY_PER_CALL * 0.8,
  } as PerformanceBudget,

  bundleSize: {
    name: 'Bundle Size',
    maxValue: PERFORMANCE.MAX_BUNDLE_SIZE,
    unit: 'bytes',
    warningThreshold: PERFORMANCE.MAX_BUNDLE_SIZE * 0.9,
  } as PerformanceBudget,

  bundleSizeGzipped: {
    name: 'Bundle Size (Gzipped)',
    maxValue: PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED,
    unit: 'bytes',
    warningThreshold: PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED * 0.9,
  } as PerformanceBudget,
} as const

/**
 * Validate a value against a performance budget
 *
 * @param budget - Performance budget to validate against
 * @param actualValue - Actual measured value
 * @returns Validation result
 */
export function validateBudget(
  budget: PerformanceBudget,
  actualValue: number
): {
  passed: boolean
  warning: boolean
  message: string
  budget: PerformanceBudget
  actualValue: number
} {
  const passed = actualValue <= budget.maxValue
  const warning = budget.warningThreshold !== undefined && actualValue >= budget.warningThreshold

  let message = `${budget.name}: ${actualValue}${budget.unit}`
  if (!passed) {
    message += ` (FAILED: exceeds budget of ${budget.maxValue}${budget.unit})`
  } else if (warning) {
    message += ` (WARNING: approaching budget of ${budget.maxValue}${budget.unit})`
  } else {
    message += ` (PASSED: within budget of ${budget.maxValue}${budget.unit})`
  }

  return {
    passed,
    warning,
    message,
    budget,
    actualValue,
  }
}

// ============================================================================
// Performance Assertions
// ============================================================================

/**
 * Assert that operation completes within time budget
 *
 * @param timingResult - Timing result to validate
 * @param budget - Performance budget
 */
export function assertWithinTimeBudget(
  timingResult: TimingResult,
  budget: PerformanceBudget
): void {
  const result = validateBudget(budget, timingResult.duration)

  if (result.warning) {
    console.warn(`⚠️  ${result.message}`)
  }

  expect(result.passed, result.message).toBe(true)
}

/**
 * Assert that memory usage is within budget
 *
 * @param memoryDelta - Memory delta in bytes
 * @param budget - Performance budget
 */
export function assertWithinMemoryBudget(memoryDelta: number, budget: PerformanceBudget): void {
  const result = validateBudget(budget, memoryDelta)

  if (result.warning) {
    console.warn(`⚠️  ${result.message}`)
  }

  expect(result.passed, result.message).toBe(true)
}

/**
 * Assert that metrics meet performance budget
 *
 * @param metrics - Performance metrics
 * @param budget - Performance budget
 * @param percentile - Which percentile to validate ('average' | 'p95' | 'p99' | 'max')
 */
export function assertMetricsWithinBudget(
  metrics: PerformanceMetrics,
  budget: PerformanceBudget,
  percentile: 'average' | 'p95' | 'p99' | 'max' = 'p95'
): void {
  const value = metrics[percentile]
  const result = validateBudget(budget, value)

  if (result.warning) {
    console.warn(`⚠️  ${result.message}`)
  }

  expect(result.passed, `${metrics.name} ${percentile}: ${result.message}`).toBe(true)
}

/**
 * Assert that operation doesn't leak memory
 *
 * @param operation - Operation to test
 * @param options - Test options
 */
export async function assertNoMemoryLeak(
  operation: () => Promise<void> | void,
  options: {
    iterations?: number
    maxLeakMB?: number
    gcBetweenIterations?: boolean
  } = {}
): Promise<void> {
  const {
    iterations = 100,
    maxLeakMB = 10, // 10 MB
    gcBetweenIterations = true,
  } = options

  // Force garbage collection if available
  const gc = () => {
    if (global.gc) {
      global.gc()
    }
  }

  // Initial GC
  gc()
  const memoryBefore = getMemorySnapshot()

  // Run operation multiple times
  for (let i = 0; i < iterations; i++) {
    await operation()
    if (gcBetweenIterations) {
      gc()
    }
  }

  // Final GC
  gc()
  const memoryAfter = getMemorySnapshot()

  const memoryDelta = calculateMemoryDelta(memoryBefore, memoryAfter)
  const memoryDeltaMB = memoryDelta / (1024 * 1024)

  const message = `Memory leak detected: ${formatBytes(memoryDelta)} after ${iterations} iterations (max allowed: ${maxLeakMB} MB)`

  expect(memoryDeltaMB, message).toBeLessThanOrEqual(maxLeakMB)
}

// ============================================================================
// Load Testing
// ============================================================================

/**
 * Run a load test with multiple concurrent operations
 *
 * @param name - Test name
 * @param operation - Operation to execute
 * @param options - Load test options
 * @returns Load test result
 */
export async function runLoadTest(
  name: string,
  operation: () => Promise<void> | void,
  options: {
    concurrency?: number
    duration?: number // in milliseconds
    iterations?: number
  } = {}
): Promise<LoadTestResult> {
  const { concurrency = 10, duration, iterations } = options

  const initialMemory = getMemorySnapshot()
  let peakMemory = initialMemory
  let successCount = 0
  let failureCount = 0
  const durations: number[] = []

  const startTime = performance.now()
  let endTime = startTime

  const runOperation = async () => {
    try {
      const result = await measureTime('load-test-op', operation)
      durations.push(result.duration)
      successCount++

      // Track peak memory
      const currentMemory = getMemorySnapshot()
      if (currentMemory.usedHeapSize > peakMemory.usedHeapSize) {
        peakMemory = currentMemory
      }
    } catch (error) {
      failureCount++
    }
  }

  if (duration) {
    // Duration-based load test
    const endBy = startTime + duration
    while (performance.now() < endBy) {
      const batch = Array(concurrency)
        .fill(null)
        .map(() => runOperation())
      await Promise.all(batch)
    }
  } else if (iterations) {
    // Iteration-based load test
    const batches = Math.ceil(iterations / concurrency)
    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(concurrency, iterations - i * concurrency)
      const batch = Array(batchSize)
        .fill(null)
        .map(() => runOperation())
      await Promise.all(batch)
    }
  } else {
    throw new Error('Either duration or iterations must be specified')
  }

  endTime = performance.now()
  const finalMemory = getMemorySnapshot()

  const totalOperations = successCount + failureCount
  const totalDuration = endTime - startTime
  const operationsPerSecond = (totalOperations / totalDuration) * 1000
  const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length

  return {
    name,
    totalOperations,
    successfulOperations: successCount,
    failedOperations: failureCount,
    totalDuration,
    operationsPerSecond,
    averageDuration,
    memoryUsage: {
      initial: initialMemory,
      peak: peakMemory,
      final: finalMemory,
    },
  }
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Print timing result to console
 *
 * @param result - Timing result to print
 */
export function printTimingResult(result: TimingResult): void {
  console.log(`\n📊 Performance Timing: ${result.name}`)
  console.log(`   Duration: ${result.duration.toFixed(2)}ms`)

  if (result.memoryBefore && result.memoryAfter) {
    const delta = calculateMemoryDelta(result.memoryBefore, result.memoryAfter)
    console.log(`   Memory Delta: ${formatBytes(delta)}`)
  }
}

/**
 * Print performance metrics to console
 *
 * @param metrics - Metrics to print
 */
export function printMetrics(metrics: PerformanceMetrics): void {
  console.log(`\n📊 Performance Metrics: ${metrics.name}`)
  console.log(`   Iterations: ${metrics.values.length}`)
  console.log(`   Average: ${metrics.average.toFixed(2)}ms`)
  console.log(`   Min: ${metrics.min.toFixed(2)}ms`)
  console.log(`   Max: ${metrics.max.toFixed(2)}ms`)
  console.log(`   Median: ${metrics.median.toFixed(2)}ms`)
  console.log(`   P95: ${metrics.p95.toFixed(2)}ms`)
  console.log(`   P99: ${metrics.p99.toFixed(2)}ms`)
  console.log(`   Std Dev: ${metrics.stdDev.toFixed(2)}ms`)
}

/**
 * Print load test result to console
 *
 * @param result - Load test result to print
 */
export function printLoadTestResult(result: LoadTestResult): void {
  console.log(`\n📊 Load Test Results: ${result.name}`)
  console.log(`   Total Operations: ${result.totalOperations}`)
  console.log(`   Successful: ${result.successfulOperations}`)
  console.log(`   Failed: ${result.failedOperations}`)
  console.log(`   Duration: ${result.totalDuration.toFixed(2)}ms`)
  console.log(`   Operations/sec: ${result.operationsPerSecond.toFixed(2)}`)
  console.log(`   Avg Duration: ${result.averageDuration.toFixed(2)}ms`)
  console.log(`\n   Memory Usage:`)
  console.log(`   Initial: ${formatBytes(result.memoryUsage.initial.usedHeapSize)}`)
  console.log(`   Peak: ${formatBytes(result.memoryUsage.peak.usedHeapSize)}`)
  console.log(`   Final: ${formatBytes(result.memoryUsage.final.usedHeapSize)}`)

  const memoryDelta = calculateMemoryDelta(result.memoryUsage.initial, result.memoryUsage.final)
  console.log(`   Delta: ${formatBytes(memoryDelta)}`)
}
