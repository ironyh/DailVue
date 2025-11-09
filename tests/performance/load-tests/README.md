# Performance Load Tests

This directory contains performance tests for VueSip library to ensure it meets performance budgets under various load conditions.

## Test Files

### event-listeners.test.ts

Tests EventBus performance with many event listeners and validates against `PERFORMANCE.MAX_EVENT_PROPAGATION_TIME` (10ms) from constants.

**Test Coverage:**

- **Many Event Listeners**: Tests with 10, 50, 100, and 500 listeners
- **Event Propagation Speed**: Validates event emission within performance budget
  - Priority ordering performance
  - Wildcard listener performance
  - Namespace wildcard performance
  - Rapid successive emissions
  - Async handler performance
- **Event Cleanup Performance**: Tests listener removal efficiency
  - Manual cleanup of listeners
  - Automatic cleanup of one-time listeners
  - Bulk cleanup operations
  - Destroy operation performance
- **Memory and Scalability**: Validates linear scaling
  - Linear scaling with listener count
  - No memory leaks from repeated operations
  - Mixed operation performance
- **Error Handling Performance**: Tests performance with failing handlers
  - Synchronous error handling
  - Asynchronous error handling

**Performance Budgets:**

- Single listener: < 10ms (MAX_EVENT_PROPAGATION_TIME)
- 10 listeners: < 10ms
- 50 listeners: < 50ms (5x budget)
- 100 listeners: < 100ms (10x budget)
- 500 listeners: < 500ms (50x budget)

**Total Tests:** 22

### large-call-history.test.ts

Tests call history performance with large datasets and validates against `PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES` (1000).

**Test Coverage:**

- **Large Call History Retrieval**: Tests with 100, 500, 1000, and 5000 entries
  - Validates warning when exceeding max entries
- **Filtering Performance**: Tests various filter operations
  - By direction (incoming/outgoing)
  - By answered/missed/video status
  - By date range
  - By tags
  - Multiple combined filters
  - Scaling validation
- **Searching Performance**: Tests search functionality
  - By name
  - By URI
  - Case-insensitive search
  - Search with filters
  - Empty result handling
- **Sorting Performance**: Tests sorting operations
  - By startTime (ascending/descending)
  - By duration
  - By remoteUri
- **Pagination Performance**: Tests pagination efficiency
  - With limit only
  - With offset and limit
  - Multiple page requests
  - Large offsets
- **Statistics Performance**: Tests statistics computation
  - For 100, 500, 1000, and 5000 entries
  - Frequent contacts calculation
  - Statistics with filters
- **Memory Usage**: Tests memory management
  - No memory leaks from repeated operations
  - Large history cleanup
  - Entry deletion efficiency
- **Concurrent Operations**: Tests simultaneous operations
  - Multiple concurrent reads
  - Rapid filter changes
- **Edge Cases**: Tests boundary conditions
  - Empty history
  - Exactly at max entries limit
  - Very large single page requests

**Performance Budgets:**

- 100 entries: < 50ms retrieval
- 500 entries: < 100ms retrieval
- 1000 entries: < 200ms retrieval
- 5000 entries: < 500ms retrieval
- Filtering: < 100-150ms for 1000 entries
- Searching: < 100ms for 1000 entries
- Sorting: < 150ms for 1000 entries
- Statistics: < 150-300ms depending on entry count

**Total Tests:** 41

## Running the Tests

### Run all performance tests

```bash
npm test tests/performance/load-tests/
```

### Run specific test file

```bash
npm test tests/performance/load-tests/event-listeners.test.ts
npm test tests/performance/load-tests/large-call-history.test.ts
```

### Run with detailed output

```bash
npx vitest run tests/performance/load-tests/ --reporter=verbose
```

## Performance Reports

Both test suites include performance summary tests that log detailed performance statistics:

- Total measurements
- Average duration
- Min/max duration
- Performance budget comparison

Look for console output like:

```
=== Event Listener Performance Report ===
Total measurements: 25
Average duration: 2.45ms
Min duration: 0.12ms
Max duration: 45.23ms
Performance budget: 10ms
==========================================
```

## Adding New Performance Tests

When adding new performance tests:

1. Use the `measureTime()` helper to track execution time
2. Validate against relevant performance budgets from `PERFORMANCE` constants
3. Test with multiple data sizes to validate scaling
4. Include cleanup and memory leak tests
5. Document expected performance budgets in comments

## Performance Targets

All performance targets are defined in `/home/user/VueSip/src/utils/constants.ts`:

- `PERFORMANCE.MAX_EVENT_PROPAGATION_TIME`: 10ms
- `PERFORMANCE.DEFAULT_MAX_HISTORY_ENTRIES`: 1000
- `PERFORMANCE.MAX_STATE_UPDATE_LATENCY`: 50ms
- `PERFORMANCE.TARGET_CALL_SETUP_TIME`: 2000ms
