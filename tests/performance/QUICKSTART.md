# Performance Testing Quick Start

This guide will help you quickly get started with performance testing in VueSip.

## Prerequisites

```bash
# Ensure dependencies are installed
pnpm install
```

## Running Tests

### Run All Performance Tests

```bash
# Standard run
pnpm test:performance

# With garbage collection tracking (recommended for accurate memory measurements)
pnpm test:performance:gc
```

### Run Specific Test Categories

```bash
# Benchmarks (compare different implementations)
pnpm test:performance:bench

# Load tests (stress testing with concurrency)
pnpm test:performance:load

# Metrics collection (detailed performance analysis)
pnpm test:performance:metrics
```

## Your First Performance Test

Create a file `tests/performance/benchmarks/my-feature.bench.ts`:

```typescript
import { describe, bench } from 'vitest'
import { MyFeature } from '../../../src/features/MyFeature'

describe('MyFeature Performance', () => {
  const feature = new MyFeature()

  // Simple benchmark - runs many iterations and reports ops/sec
  bench('feature operation', () => {
    feature.doSomething()
  })

  // Compare implementations
  bench('implementation A', () => {
    feature.implementationA()
  })

  bench('implementation B', () => {
    feature.implementationB()
  })
})
```

Run it:

```bash
pnpm test:performance:bench
```

## Common Patterns

### 1. Measure Single Operation Time

```typescript
import { measureTime, printTimingResult } from '../setup'

const result = await measureTime('my-operation', async () => {
  await myOperation()
})

printTimingResult(result)
expect(result.duration).toBeLessThan(100) // Should complete in < 100ms
```

### 2. Collect Statistical Metrics

```typescript
import { measureMultiple, printMetrics } from '../setup'

const metrics = await measureMultiple(
  'my-operation',
  async () => {
    await myOperation()
  },
  1000 // Run 1000 times
)

printMetrics(metrics)
expect(metrics.p95).toBeLessThan(50) // 95% should complete in < 50ms
```

### 3. Test Against Performance Budget

```typescript
import { measureTime, assertWithinTimeBudget, PERFORMANCE_BUDGETS } from '../setup'

const result = await measureTime('call-setup', async () => {
  await setupCall()
})

// Automatically validates against the defined budget
assertWithinTimeBudget(result, PERFORMANCE_BUDGETS.callSetupTime)
```

### 4. Check for Memory Leaks

```typescript
import { assertNoMemoryLeak } from '../setup'

await assertNoMemoryLeak(
  async () => {
    const call = await createCall()
    await call.terminate()
  },
  {
    iterations: 100,
    maxLeakMB: 10, // Allow max 10MB leak
  }
)
```

### 5. Load Testing

```typescript
import { runLoadTest, printLoadTestResult } from '../setup'

const result = await runLoadTest(
  'concurrent-operations',
  async () => {
    await performOperation()
  },
  {
    concurrency: 10, // 10 concurrent operations
    iterations: 100, // Total 100 operations
  }
)

printLoadTestResult(result)
expect(result.successfulOperations).toBeGreaterThanOrEqual(95)
```

## Understanding Results

### Benchmark Output

```
✓ tests/performance/benchmarks/my-feature.bench.ts
  MyFeature Performance
    name                     hz     min     max    mean     p75     p99    p995    p999     rme  samples
  · feature operation   123,456  0.0078  0.0234  0.0081  0.0082  0.0095  0.0123  0.0234  ±0.52%   61728
```

- **hz**: Operations per second (higher is better)
- **mean**: Average time per operation
- **p75/p99**: 75th/99th percentile times
- **rme**: Relative margin of error (lower is better)

### Metrics Output

```
📊 Performance Metrics: my-operation
   Iterations: 1000
   Average: 5.23ms
   Min: 2.10ms
   Max: 15.67ms
   Median: 4.89ms
   P95: 8.45ms
   P99: 12.34ms
   Std Dev: 2.11ms
```

- **P95**: 95% of operations completed within this time
- **Std Dev**: Variability (lower means more consistent)

### Load Test Output

```
📊 Load Test Results: concurrent-operations
   Total Operations: 100
   Successful: 98
   Failed: 2
   Duration: 5432.10ms
   Operations/sec: 18.41
   Avg Duration: 54.32ms
```

- **Success Rate**: 98/100 = 98%
- **Throughput**: 18.41 operations/second

## Performance Budgets

VueSip has predefined performance budgets:

| Metric            | Budget | Warning |
| ----------------- | ------ | ------- |
| Call Setup Time   | 2000ms | 1600ms  |
| State Update      | 50ms   | 40ms    |
| Event Propagation | 10ms   | 8ms     |
| Memory Per Call   | 50MB   | 40MB    |

Tests will:

- **PASS** ✅ if within budget
- **WARN** ⚠️ if approaching budget
- **FAIL** ❌ if exceeding budget

## Tips for Accurate Results

### 1. Run with Garbage Collection

```bash
pnpm test:performance:gc
```

This exposes the `gc()` function for accurate memory measurements.

### 2. Warm Up First

```typescript
// Warm up V8 JIT compiler
for (let i = 0; i < 100; i++) {
  await operation()
}

// Now measure
const metrics = await measureMultiple('operation', operation, 1000)
```

### 3. Use Sufficient Iterations

- **Micro-benchmarks**: 1000-10000 iterations
- **Integration tests**: 100-1000 iterations
- **Heavy operations**: 10-100 iterations

### 4. Minimize System Noise

- Close other applications
- Disable CPU throttling
- Use consistent hardware for comparisons

## Next Steps

1. Read the full [README.md](./README.md) for detailed documentation
2. Check existing tests in `benchmarks/`, `load-tests/`, and `metrics/`
3. Review the utilities in [setup.ts](./setup.ts)
4. Explore [performance constants](../../src/utils/constants.ts)

## Need Help?

- Check the [README.md](./README.md) for detailed API documentation
- Look at example tests in each subdirectory
- Review the performance utilities in [setup.ts](./setup.ts)

Happy performance testing! 🚀
