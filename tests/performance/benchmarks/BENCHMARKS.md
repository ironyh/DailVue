# VueSip Performance Benchmarks

This directory contains Vitest benchmark files for measuring the performance of VueSip core components.

## Created Benchmark Files

### 1. callSession.bench.ts (529 lines)

**Status:** ✅ Fully functional

Benchmarks call session operations including:

- **Session Creation** - Create incoming/outgoing call sessions (~150k ops/sec)
- **Answer Operations** - Fast path and custom constraints (~90k-100k ops/sec)
- **Call Termination** - Hangup and reject operations (~90k-108k ops/sec)
- **Hold/Resume** - Put calls on hold and resume (~100k ops/sec)
- **Mute/Unmute** - Audio mute/unmute controls (~100k-132k ops/sec)
- **DTMF Operations** - Send DTMF tones (~120k ops/sec)
- **State Transitions** - Call flow state changes (~64k-79k ops/sec)
- **Event Propagation** - Event emission speed with budget validation (~63k ops/sec)
- **Serialization** - toInterface conversion (~141k ops/sec)
- **Memory Management** - Cleanup and concurrent session handling

**Key Features:**

- Uses MockRTCSession for testing
- Validates against PERFORMANCE.MAX_EVENT_PROPAGATION_TIME budget
- Tests both fast path (optimized) and slow path (complex) scenarios
- Includes concurrent operation benchmarks

### 2. sipClient.bench.ts (439 lines)

**Status:** ⚠️ Partially functional (some async benchmarks show 0 results)

Benchmarks SIP client operations including:

- **Client Creation** - Initialize SIP client instances
- **Registration** - Register/unregister operations
- **Call Operations** - Make outgoing calls, handle incoming calls
- **Connection Management** - Connect/disconnect, state changes
- **State Management** - Connection and registration state tracking
- **Event Handling** - Process multiple concurrent events
- **Memory Management** - Cleanup and multi-client scenarios
- **Performance Budget** - State update latency validation

**Key Features:**

- Uses vi.mock for JsSIP mocking
- Integrates with MockSipServer
- Tests concurrent operations
- Validates MAX_STATE_UPDATE_LATENCY budget

**Known Issues:**

- Some async benchmarks return 0 results (need proper async handling)

### 3. mediaDevices.bench.ts (440 lines)

**Status:** ⚠️ Needs refinement (async benchmarks show 0 results)

Benchmarks media device operations including:

- **Device Enumeration** - List available devices
- **Get User Media** - Acquire audio/video streams
- **Device Switching** - Change input/output devices
- **Mute/Unmute** - Audio/video track control
- **Track Management** - Add/remove/replace tracks
- **Device Change Detection** - Handle devicechange events
- **Permission Management** - Request media permissions
- **Stream Cleanup** - Stop streams and tracks
- **Performance Budgets** - Latency validation
- **Concurrent Operations** - Multiple simultaneous operations

**Key Features:**

- Mocks navigator.mediaDevices API
- Tests device filtering and selection
- Validates device enumeration and getUserMedia latency

**Known Issues:**

- All async benchmarks return 0 results (mock implementation needs improvement)

### 4. conference.bench.ts (578 lines)

**Status:** ⚠️ Needs refinement (Vue composable warnings)

Benchmarks conference operations including:

- **Conference Creation** - Create/join conferences
- **Participant Management** - Add/remove participants (sequential and concurrent)
- **Participant Controls** - Mute/unmute individual and all participants
- **Conference Controls** - Lock/unlock, start/stop recording, end conference
- **State Management** - Conference state tracking
- **Event Handling** - Participant joined/left events
- **Performance Budgets** - Creation and operation latency validation
- **Large Conferences** - 10 and 20 participant scenarios
- **Memory Management** - Cleanup and lifecycle
- **Audio Levels** - Participant audio level monitoring
- **Concurrent Operations** - Multiple simultaneous control operations

**Key Features:**

- Uses useConference composable
- Tests participant churn (add/remove cycles)
- Validates conference-specific performance budgets

**Known Issues:**

- Vue warns about onUnmounted being called outside component context
- Requires proper Vue test environment setup

### 5. eventbus.bench.ts (119 lines) - Pre-existing

**Status:** ✅ Fully functional

Benchmarks EventBus implementation:

- Event emission with varying listener counts
- Listener registration/unregistration
- Wildcard events
- Payload size variations
- Memory management

## Running Benchmarks

### Run All Benchmarks

```bash
pnpm vitest bench tests/performance/benchmarks
```

### Run Specific Benchmark

```bash
pnpm vitest bench tests/performance/benchmarks/callSession.bench.ts
pnpm vitest bench tests/performance/benchmarks/sipClient.bench.ts
pnpm vitest bench tests/performance/benchmarks/mediaDevices.bench.ts
pnpm vitest bench tests/performance/benchmarks/conference.bench.ts
```

### Run with Detailed Output

```bash
pnpm vitest bench --reporter=verbose
```

## Performance Budget Validation

Benchmarks automatically validate against budgets defined in `src/utils/constants.ts`:

```typescript
export const PERFORMANCE = {
  TARGET_CALL_SETUP_TIME: 2000, // 2 seconds
  MAX_STATE_UPDATE_LATENCY: 50, // 50ms
  MAX_EVENT_PROPAGATION_TIME: 10, // 10ms
  MAX_MEMORY_PER_CALL: 50 * 1024 * 1024, // 50 MB
  DEFAULT_MAX_CONCURRENT_CALLS: 5,
}
```

When operations exceed budgets, warnings are logged to console.

## Benchmark Results Summary

### callSession.bench.ts Results

- Session Creation: **~150,000 ops/sec**
- Answer Operations: **~90,000-100,000 ops/sec**
- Hold/Resume: **~100,000 ops/sec**
- Mute/Unmute: **~100,000-132,000 ops/sec**
- DTMF: **~120,000 ops/sec**
- State Transitions: **~64,000-79,000 ops/sec**

**Notable Findings:**

- Event propagation sometimes exceeds 10ms budget under load
- Incoming call creation is 1.04x faster than outgoing
- Mute operation is 1.33x faster than unmute

## Test Infrastructure

All benchmarks use the existing mock infrastructure:

- `tests/helpers/MockSipServer.ts` - Mock SIP server for testing
- `tests/setup.ts` - Performance testing utilities
- Mock implementations for JsSIP, MediaDevices, etc.

## Recommendations

### For Production Use

1. **callSession.bench.ts** - Use as-is, fully functional
2. **sipClient.bench.ts** - Fix async handling in benchmarks
3. **mediaDevices.bench.ts** - Improve mock implementations
4. **conference.bench.ts** - Set up proper Vue test harness

### Improvements Needed

1. Fix async benchmark handling for sipClient
2. Improve mediaDevices mocks to return realistic data
3. Set up Vue test utils for conference benchmarks
4. Add baseline comparison functionality
5. Integrate with CI/CD for regression detection

## Future Enhancements

1. **Baseline Tracking** - Store benchmark results to detect regressions
2. **Comparison Reports** - Generate comparison charts over time
3. **CI Integration** - Fail builds on performance regressions >10%
4. **Memory Profiling** - Add heap snapshot analysis
5. **Real Device Testing** - Test with actual WebRTC connections
6. **Load Testing** - Move to load-tests/ directory for stress scenarios

## Contributing

When adding new benchmarks:

1. Follow existing patterns in callSession.bench.ts
2. Include both fast path and slow path scenarios
3. Add performance budget validation where applicable
4. Document expected performance ranges
5. Use meaningful test names describing what's measured

## Resources

- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)
- [Performance Constants](/src/utils/constants.ts)
- [Main Performance README](/tests/performance/README.md)
