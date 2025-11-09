# Performance Testing

This directory contains the performance testing infrastructure for VueSip. It includes utilities for benchmarking, load testing, and metrics collection to ensure the library meets its performance targets.

## Overview

VueSip maintains strict performance budgets to ensure a high-quality user experience. The performance testing infrastructure helps validate that:

- Call setup time stays under 2 seconds
- State updates complete within 50ms
- Event propagation happens within 10ms
- Memory usage per call doesn't exceed 50MB
- No memory leaks occur during extended use
- The library handles concurrent calls efficiently

## Directory Structure

```
tests/performance/
├── setup.ts              # Performance testing utilities
├── benchmarks/           # Vitest benchmark tests
├── load-tests/           # Stress and load tests
├── metrics/              # Performance metrics collection
└── README.md            # This file
```

### Directory Purposes

- **setup.ts**: Core utilities for performance testing (timing, memory tracking, assertions)
- **benchmarks/**: Micro-benchmarks using Vitest's bench API for comparing implementations
- **load-tests/**: Tests that simulate high-load scenarios (multiple concurrent calls, extended sessions)
- **metrics/**: Tests that collect and analyze performance metrics over time

## Running Performance Tests

### Run All Performance Tests

```bash
# Run all performance tests
pnpm test tests/performance

# Run with memory profiling (requires --expose-gc flag)
node --expose-gc ./node_modules/vitest/vitest.mjs tests/performance
```

### Run Specific Test Categories

```bash
# Run benchmarks only
pnpm test tests/performance/benchmarks

# Run load tests only
pnpm test tests/performance/load-tests

# Run metrics collection only
pnpm test tests/performance/metrics
```

### Watch Mode

```bash
# Watch performance tests during development
pnpm vitest watch tests/performance
```

## Performance Budgets

VueSip enforces the following performance budgets (defined in `src/utils/constants.ts`):

| Metric                | Budget | Warning Threshold |
| --------------------- | ------ | ----------------- |
| Call Setup Time       | 2000ms | 1600ms (80%)      |
| State Update Latency  | 50ms   | 40ms (80%)        |
| Event Propagation     | 10ms   | 8ms (80%)         |
| Memory Per Call       | 50MB   | 40MB (80%)        |
| Bundle Size           | 150KB  | 135KB (90%)       |
| Bundle Size (Gzipped) | 50KB   | 45KB (90%)        |

### Budget Validation

All performance tests automatically validate against these budgets. Tests will:

- **PASS**: Value is within budget
- **WARN**: Value exceeds warning threshold but is still within budget
- **FAIL**: Value exceeds budget

## Writing Performance Tests

### Basic Timing Test

```typescript
import { describe, it } from 'vitest'
import { measureTime, assertWithinTimeBudget, PERFORMANCE_BUDGETS } from '../setup'

describe('Call Performance', () => {
  it('should establish call within time budget', async () => {
    const result = await measureTime('call-setup', async () => {
      // Your call setup logic here
      await setupCall()
    })

    assertWithinTimeBudget(result, PERFORMANCE_BUDGETS.callSetupTime)
  })
})
```

### Memory Leak Test

```typescript
import { describe, it } from 'vitest'
import { assertNoMemoryLeak } from '../setup'

describe('Memory Management', () => {
  it('should not leak memory during multiple calls', async () => {
    await assertNoMemoryLeak(
      async () => {
        const call = await makeCall()
        await call.terminate()
      },
      {
        iterations: 100,
        maxLeakMB: 10,
        gcBetweenIterations: true,
      }
    )
  })
})
```

### Statistical Performance Test

```typescript
import { describe, it } from 'vitest'
import {
  measureMultiple,
  assertMetricsWithinBudget,
  PERFORMANCE_BUDGETS,
  printMetrics,
} from '../setup'

describe('Event System Performance', () => {
  it('should propagate events quickly', async () => {
    const metrics = await measureMultiple(
      'event-propagation',
      async () => {
        eventBus.emit('test:event', { data: 'test' })
      },
      1000 // 1000 iterations
    )

    printMetrics(metrics)

    // Validate P95 (95th percentile) is within budget
    assertMetricsWithinBudget(metrics, PERFORMANCE_BUDGETS.eventPropagationTime, 'p95')
  })
})
```

### Load Test

```typescript
import { describe, it, expect } from 'vitest'
import { runLoadTest, printLoadTestResult } from '../setup'

describe('Concurrent Calls', () => {
  it('should handle 10 concurrent calls', async () => {
    const result = await runLoadTest(
      'concurrent-calls',
      async () => {
        await makeAndTerminateCall()
      },
      {
        iterations: 100,
        concurrency: 10,
      }
    )

    printLoadTestResult(result)

    // Assert success rate
    const successRate = result.successfulOperations / result.totalOperations
    expect(successRate).toBeGreaterThanOrEqual(0.95) // 95% success rate
  })
})
```

### Benchmark Comparison

```typescript
import { describe, bench } from 'vitest'

describe('EventBus Performance', () => {
  bench('EventBus.emit (no listeners)', () => {
    eventBus.emit('test:event', {})
  })

  bench('EventBus.emit (with listeners)', () => {
    eventBus.emit('registered:event', { data: 'test' })
  })

  bench('EventBus.on (register listener)', () => {
    const off = eventBus.on('test', () => {})
    off() // Clean up
  })
})
```

## Utilities Reference

### Memory Tracking

- **`getMemorySnapshot()`**: Get current memory usage
- **`calculateMemoryDelta(before, after)`**: Calculate memory difference
- **`formatBytes(bytes)`**: Format bytes to human-readable string
- **`trackMemory(operation)`**: Track memory usage during operation

### Timing Measurements

- **`measureTime(name, operation, options)`**: Measure execution time
- **`measureMultiple(name, operation, iterations)`**: Measure multiple iterations and get statistics
- **`calculateMetrics(name, values)`**: Calculate statistical metrics from values

### Performance Budgets

- **`PERFORMANCE_BUDGETS`**: Predefined budgets from constants
- **`validateBudget(budget, actualValue)`**: Validate value against budget
- **`assertWithinTimeBudget(timingResult, budget)`**: Assert timing is within budget
- **`assertWithinMemoryBudget(memoryDelta, budget)`**: Assert memory usage is within budget
- **`assertMetricsWithinBudget(metrics, budget, percentile)`**: Assert metrics meet budget
- **`assertNoMemoryLeak(operation, options)`**: Assert no memory leak occurs

### Load Testing

- **`runLoadTest(name, operation, options)`**: Run load test with concurrency
  - Options: `concurrency`, `duration`, `iterations`

### Reporting

- **`printTimingResult(result)`**: Print timing result to console
- **`printMetrics(metrics)`**: Print performance metrics to console
- **`printLoadTestResult(result)`**: Print load test result to console

## Interpreting Results

### Timing Results

```
📊 Performance Timing: call-setup
   Duration: 1234.56ms
   Memory Delta: 2.5 MB
```

- **Duration**: Total execution time in milliseconds
- **Memory Delta**: Memory allocated during operation

### Performance Metrics

```
📊 Performance Metrics: event-propagation
   Iterations: 1000
   Average: 5.23ms
   Min: 2.10ms
   Max: 15.67ms
   Median: 4.89ms
   P95: 8.45ms
   P99: 12.34ms
   Std Dev: 2.11ms
```

- **Average**: Mean execution time
- **Min/Max**: Fastest and slowest times
- **Median**: Middle value (50th percentile)
- **P95**: 95% of operations completed within this time
- **P99**: 99% of operations completed within this time
- **Std Dev**: Variability in measurements (lower is more consistent)

### Load Test Results

```
📊 Load Test Results: concurrent-calls
   Total Operations: 100
   Successful: 98
   Failed: 2
   Duration: 5432.10ms
   Operations/sec: 18.41
   Avg Duration: 54.32ms

   Memory Usage:
   Initial: 15.2 MB
   Peak: 45.8 MB
   Final: 18.7 MB
   Delta: 3.5 MB
```

- **Success Rate**: Percentage of successful operations
- **Operations/sec**: Throughput
- **Avg Duration**: Average time per operation
- **Memory Delta**: Net memory change (should be near zero for no leaks)

## Best Practices

### 1. Use Appropriate Iteration Counts

- **Micro-benchmarks**: 1000-10000 iterations for stable results
- **Integration tests**: 100-1000 iterations
- **Load tests**: Based on realistic usage patterns

### 2. Warm Up Before Measuring

```typescript
// Warm up V8 JIT compiler
for (let i = 0; i < 10; i++) {
  await operation()
}

// Now measure
const metrics = await measureMultiple('operation', operation, 1000)
```

### 3. Force Garbage Collection

Run tests with `--expose-gc` flag for accurate memory measurements:

```bash
node --expose-gc ./node_modules/vitest/vitest.mjs tests/performance
```

### 4. Isolate Performance Tests

- Run performance tests separately from unit tests
- Minimize other processes during performance testing
- Use consistent hardware for reproducible results

### 5. Track Trends Over Time

- Store metrics in `tests/performance/metrics/`
- Compare results across commits
- Set up CI to track performance regressions

## Continuous Integration

### GitHub Actions Example

```yaml
- name: Run Performance Tests
  run: |
    node --expose-gc ./node_modules/vitest/vitest.mjs tests/performance
```

### Performance Regression Detection

Monitor these key indicators:

- P95 latency increases by >10%
- Memory delta increases by >20%
- Bundle size increases by >5%

## Troubleshooting

### Memory Measurements Show 0

**Cause**: `performance.memory` is not available or GC is not exposed

**Solution**:

```bash
# Run with --expose-gc flag
node --expose-gc ./node_modules/vitest/vitest.mjs tests/performance
```

### High Variability in Results

**Cause**: System noise, insufficient warmup, or CPU throttling

**Solutions**:

- Increase iteration count
- Add warmup period
- Close other applications
- Disable CPU throttling

### Tests Fail Intermittently

**Cause**: Non-deterministic behavior or tight budgets

**Solutions**:

- Use percentiles (P95, P99) instead of max values
- Add warmup iterations
- Increase budget thresholds if justified

### Memory Leaks Not Detected

**Cause**: Garbage collection not running or iterations too low

**Solutions**:

- Run with `--expose-gc` flag
- Increase iteration count
- Force GC between iterations

## Resources

- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)
- [V8 Memory Management](https://v8.dev/blog/trash-talk)
- [Web Performance APIs](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Performance Constants](/src/utils/constants.ts)

## Contributing

When adding new performance tests:

1. Use existing utilities from `setup.ts`
2. Follow naming conventions (`*.bench.ts` for benchmarks, `*.load.ts` for load tests)
3. Document expected performance characteristics
4. Add budget validation where appropriate
5. Include interpretation guidance in test descriptions
