# Workflow State

State.Status = READY_FOR_REVIEW

## Plan
1. Reproduce the failing integration suites (`device-switching`, `network-resilience`, `sip-workflow`, `conference`) in isolation to catalog current breakages.
2. Trace the root causes—likely mocked SIP client state and MediaManager stubs—and implement targeted fixes in test fixtures or production logic so calls reach the expected active states.
3. Re-run the affected integration tests (and dependent unit suites if needed) to confirm the stabilisation; adjust mocks or docs if gaps remain.

## Log
- Integration test failures persist post-unit fixes; need to investigate call-state and media mock behaviour next.
- Refined device switching mocks (unique streams, deferred cleanup, mutable device lists); suite now passes.
- Introduced deterministic UA event scheduling utilities for network resilience specs; entire suite green.
- Adjusted SIP workflow tests to reuse captured JsSIP handlers and reset mock implementations per test; integration flow stabilised.
- Verified all plugin unit suites and the full `pnpm test` run—no failing tests (only expected Vue warnings).
