# Contributing to VueSip

Thank you for your interest in contributing to VueSip! This comprehensive guide will help you get started with developing, testing, and contributing to the VueSip project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Architecture](#project-architecture)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Development Workflow](#development-workflow)
- [Adding New Features](#adding-new-features)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Performance Considerations](#performance-considerations)
- [Security Guidelines](#security-guidelines)
- [Documentation](#documentation)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
- **pnpm**: Version 8.0.0 or higher (required package manager)
- **Git**: Latest stable version
- **IDE**: We recommend VS Code with the following extensions:
  - Volar (Vue Language Features)
  - TypeScript Vue Plugin
  - ESLint
  - Prettier

### Installation

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/VueSip.git
   cd VueSip
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ironyh/VueSip.git
   ```

4. **Install dependencies**:
   ```bash
   pnpm install
   ```

5. **Verify your setup**:
   ```bash
   pnpm run lint
   pnpm run type-check
   pnpm run test
   ```

### First-Time Contributors

If you're new to the project:

1. Check out the [Good First Issues](https://github.com/ironyh/VueSip/labels/good%20first%20issue)
2. Read through the existing codebase to understand patterns
3. Review a few merged pull requests to see our standards
4. Don't hesitate to ask questions by opening an issue

## Development Environment

### Package Manager

This project uses **pnpm** as its package manager. Do not use npm or yarn as they may create inconsistent lock files.

```bash
# Install pnpm globally if you haven't already
npm install -g pnpm@8
```

### Development Scripts

```bash
# Start development server with hot-reload
pnpm run dev

# Run type checking
pnpm run type-check
# or
pnpm run typecheck

# Lint code
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix

# Format code with Prettier
pnpm run format

# Build library for production
pnpm run build

# Preview production build
pnpm run preview
```

### Testing Scripts

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run unit tests only
pnpm run test:unit

# Run unit tests in watch mode
pnpm run test:unit:watch

# Run integration tests only
pnpm run test:integration

# Run E2E tests
pnpm run test:e2e

# Generate coverage report
pnpm run coverage

# Generate unit test coverage
pnpm run coverage:unit
```

### Documentation Scripts

```bash
# Start documentation dev server
pnpm run docs:dev

# Build documentation
pnpm run docs:build
```

## Project Architecture

For a comprehensive deep-dive into VueSip's architecture, see [Architecture Documentation](docs/developer/architecture.md).

### Directory Structure

```
VueSip/
├── src/
│   ├── composables/        # Vue 3 composables (headless components)
│   │   ├── useSipClient.ts
│   │   ├── useCallSession.ts
│   │   ├── useCallControls.ts
│   │   ├── useDTMF.ts
│   │   ├── useMediaDevices.ts
│   │   └── index.ts
│   ├── core/               # Core SIP functionality
│   │   ├── SipClient.ts
│   │   ├── CallSession.ts
│   │   ├── MediaManager.ts
│   │   ├── EventBus.ts
│   │   └── TransportManager.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── config.types.ts
│   │   ├── sip.types.ts
│   │   └── call.types.ts
│   ├── utils/              # Utility functions
│   │   ├── logger.ts
│   │   ├── validators.ts
│   │   ├── encryption.ts
│   │   └── formatters.ts
│   ├── stores/             # State management stores
│   │   ├── configStore.ts
│   │   ├── callStore.ts
│   │   ├── deviceStore.ts
│   │   └── registrationStore.ts
│   ├── plugins/            # Plugin system
│   │   ├── PluginManager.ts
│   │   ├── AnalyticsPlugin.ts
│   │   └── RecordingPlugin.ts
│   ├── providers/          # Vue providers
│   │   ├── ConfigProvider.ts
│   │   ├── SipClientProvider.ts
│   │   └── MediaProvider.ts
│   └── index.ts            # Main library export
├── tests/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── e2e/                # End-to-end tests
│   └── setup.ts            # Test setup configuration
├── examples/               # Example applications
├── docs/                   # VitePress documentation
└── dist/                   # Build output (generated)
```

### Key Concepts

**Headless Components**: VueSip provides business logic through composables without prescribing UI. Users can integrate with any UI framework.

**Composables**: Vue 3 Composition API functions that encapsulate reusable logic for SIP operations.

**Core Modules**: Low-level classes that handle SIP protocol, WebRTC, and media operations.

**Type Safety**: Comprehensive TypeScript types ensure compile-time safety and excellent DX.

**Plugin System**: Extensible architecture allowing users to add custom functionality.

## Code Style Guidelines

### TypeScript

#### Type Annotations

Always use explicit types for function parameters and return types in public APIs:

```typescript
// ✅ Good
export function connect(config: SipClientConfig): Promise<void> {
  // implementation
}

// ❌ Bad - missing return type
export function connect(config: SipClientConfig) {
  // implementation
}
```

#### Type Definitions

- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and utility types
- Export all public types from the appropriate types file

```typescript
// ✅ Good
export interface SipClientConfig {
  uri: string
  sipUri: string
  password: string
  displayName?: string
}

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'connection_failed'

// ❌ Bad - mixing interfaces and types inconsistently
type SipClientConfig = {
  uri: string
  // ...
}
```

#### Avoid `any`

Avoid using `any` type. Use `unknown` when type is truly unknown, or create proper type definitions:

```typescript
// ✅ Good
function handleEvent(event: unknown): void {
  if (isValidEvent(event)) {
    // Type guard narrows unknown to specific type
    processEvent(event)
  }
}

// ❌ Bad
function handleEvent(event: any): void {
  processEvent(event)
}
```

#### Null Safety

Use strict null checks. Explicitly handle `null` and `undefined`:

```typescript
// ✅ Good
function getUser(id: string): User | null {
  const user = userMap.get(id)
  return user ?? null
}

// ❌ Bad - implicit undefined
function getUser(id: string): User {
  return userMap.get(id) // Type error if strict null checks enabled
}
```

### Vue 3 Composition API

#### Composable Structure

Follow this standard structure for composables:

```typescript
/**
 * JSDoc comment describing the composable
 */
export function useFeatureName(
  initialConfig?: FeatureConfig,
  options?: FeatureOptions
): UseFeatureNameReturn {
  // 1. Internal state (refs, reactive)
  const internalState = ref<InternalState>({})

  // 2. Computed properties
  const derivedValue = computed(() => internalState.value.someProperty)

  // 3. Methods
  const doSomething = async (): Promise<void> => {
    // implementation
  }

  // 4. Lifecycle hooks
  onUnmounted(() => {
    // cleanup
  })

  // 5. Return object
  return {
    // Readonly reactive state
    derivedValue: readonly(derivedValue),
    // Methods
    doSomething,
  }
}
```

#### Reactive State

- Use `ref` for primitive values
- Use `reactive` for objects (but prefer `ref` for better type inference)
- Return readonly refs for state that shouldn't be modified externally

```typescript
// ✅ Good
const count = ref(0)
const config = ref<Config>({ ... })

return {
  count: readonly(count),
  updateCount: (newCount: number) => { count.value = newCount }
}

// ❌ Bad - exposing mutable state
return {
  count  // Users can modify directly
}
```

#### Computed Properties

Use `computed` for derived state:

```typescript
// ✅ Good
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

// ❌ Bad - using ref with manual updates
const fullName = ref('')
watch([firstName, lastName], () => {
  fullName.value = `${firstName.value} ${lastName.value}`
})
```

### Code Formatting

We use **Prettier** for code formatting. Configuration:

- No semicolons
- Single quotes
- 2 space indentation
- 100 character line width
- Trailing commas (ES5)
- LF line endings

Run `pnpm run format` before committing.

### ESLint Rules

Key rules enforced:

- `@typescript-eslint/no-explicit-any`: Warn on `any` usage
- `@typescript-eslint/no-unused-vars`: Error on unused variables (except `_` prefixed)
- `vue/require-explicit-emits`: Must declare emits
- `no-console`: Warn in production builds

### Naming Conventions

#### Files

- **Composables**: `useFeatureName.ts` (camelCase with "use" prefix)
- **Components**: `ComponentName.vue` (PascalCase)
- **Types**: `feature.types.ts` (kebab-case with .types suffix)
- **Tests**: `FeatureName.test.ts` or `feature-name.spec.ts`
- **Core Classes**: `ClassName.ts` (PascalCase)

#### Variables and Functions

```typescript
// Variables: camelCase
const userName = 'John'
const isConnected = ref(false)

// Functions: camelCase
function calculateTotal() { }
const handleClick = () => { }

// Classes: PascalCase
class SipClient { }

// Interfaces and Types: PascalCase
interface UserConfig { }
type ConnectionState = string

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT = 5000

// Enums: PascalCase (keys and enum name)
enum RegistrationState {
  Registered = 'registered',
  Unregistered = 'unregistered',
}
```

### Comments and Documentation

#### JSDoc Comments

All public APIs must have JSDoc comments:

```typescript
/**
 * Connects to the SIP server and initiates registration
 *
 * @param config - SIP client configuration
 * @param options - Optional connection options
 * @returns Promise that resolves when connected and registered
 * @throws {ValidationError} If config is invalid
 * @throws {ConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * await connect({
 *   uri: 'wss://sip.example.com',
 *   sipUri: 'sip:user@example.com',
 *   password: 'secret'
 * })
 * ```
 */
export async function connect(
  config: SipClientConfig,
  options?: ConnectionOptions
): Promise<void> {
  // implementation
}
```

#### Inline Comments

Use inline comments for complex logic:

```typescript
// ✅ Good - explains WHY
// Wait before reconnecting to avoid overwhelming the server
await delay(RECONNECT_DELAY)

// ❌ Bad - explains WHAT (code already shows this)
// Set isConnected to true
isConnected.value = true
```

## Testing Requirements

### Code Coverage Requirements

All contributions must maintain or improve code coverage:

- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 75% minimum
- **Statements**: 80% minimum

Run `pnpm run coverage` to check coverage before submitting PR.

### Testing Strategy

VueSip uses a three-tier testing strategy:

#### 1. Unit Tests (`tests/unit/`)

Test individual composables, classes, and utilities in isolation.

**When to write unit tests:**
- For all new composables
- For all core classes
- For utility functions
- For stores and providers

**Example unit test:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from 'vue'
import { useSipClient } from '@/composables/useSipClient'

// Helper to test composables in proper Vue context
function withSetup<T>(composable: () => T): [T, () => void] {
  let result: T
  const app = createApp({
    setup() {
      result = composable()
      return () => {}
    },
  })
  app.mount(document.createElement('div'))
  return [result!, () => app.unmount()]
}

describe('useSipClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const [result, unmount] = withSetup(() => useSipClient())

    expect(result.isConnected.value).toBe(false)
    expect(result.isRegistered.value).toBe(false)

    unmount()
  })

  it('should connect successfully', async () => {
    const config = {
      uri: 'wss://sip.example.com',
      sipUri: 'sip:user@example.com',
      password: 'secret'
    }

    const [result, unmount] = withSetup(() => useSipClient(config))

    await result.connect()

    expect(result.isConnected.value).toBe(true)

    unmount()
  })
})
```

#### 2. Integration Tests (`tests/integration/`)

Test interaction between multiple modules and complete workflows.

**When to write integration tests:**
- For complete SIP workflows (connect → register → call → hangup)
- For multi-component interactions
- For state management across modules
- For plugin integration

**Example integration test:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { SipClient } from '@/core/SipClient'
import { EventBus } from '@/core/EventBus'
import type { SipClientConfig } from '@/types/config.types'

describe('SIP Workflow Integration', () => {
  let eventBus: EventBus
  let sipClient: SipClient

  beforeEach(() => {
    eventBus = new EventBus()
    const config: SipClientConfig = {
      uri: 'wss://sip.example.com',
      sipUri: 'sip:user@example.com',
      password: 'secret'
    }
    sipClient = new SipClient(config, eventBus)
  })

  it('should complete full call workflow', async () => {
    const events: string[] = []

    eventBus.on('sip:connected', () => events.push('connected'))
    eventBus.on('sip:registered', () => events.push('registered'))
    eventBus.on('call:progress', () => events.push('progress'))

    await sipClient.start()
    await sipClient.register()

    expect(events).toContain('connected')
    expect(events).toContain('registered')
  })
})
```

#### 3. End-to-End Tests (`tests/e2e/`)

Test complete user flows in a browser environment using Playwright.

**When to write E2E tests:**
- For critical user journeys
- For UI interactions in example applications
- For cross-browser compatibility
- For real-world scenarios

**Example E2E test:**

```typescript
import { test, expect } from '@playwright/test'

const APP_URL = '/?test=true'

test.describe('Basic Call Flow', () => {
  test('should make an outgoing call', async ({ page }) => {
    await page.goto(APP_URL)

    // Configure SIP settings
    await page.click('[data-testid="settings-button"]')
    await page.fill('[data-testid="sip-uri-input"]', 'sip:user@example.com')
    await page.fill('[data-testid="password-input"]', 'secret')
    await page.click('[data-testid="save-settings-button"]')

    // Connect
    await page.click('[data-testid="connect-button"]')
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText(/connected/i)

    // Make call
    await page.fill('[data-testid="dialpad-input"]', 'sip:destination@example.com')
    await page.click('[data-testid="call-button"]')

    // Verify call in progress
    await expect(page.locator('[data-testid="active-call"]')).toBeVisible()
  })
})
```

### Testing Best Practices

#### Mock External Dependencies

Always mock JsSIP and browser APIs:

```typescript
// Mock JsSIP
vi.mock('jssip', () => ({
  default: {
    UA: vi.fn(),
    WebSocketInterface: vi.fn(),
    debug: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
  },
}))

// Mock getUserMedia
global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockStream),
  enumerateDevices: vi.fn().mockResolvedValue([]),
} as any
```

#### Test Both Success and Failure Paths

```typescript
it('should handle connection failure', async () => {
  mockUA.start.mockRejectedValueOnce(new Error('Connection failed'))

  const [result, unmount] = withSetup(() => useSipClient(config))

  await expect(result.connect()).rejects.toThrow('Connection failed')
  expect(result.error.value).toBeDefined()

  unmount()
})
```

#### Clean Up After Tests

Always unmount components and clean up resources:

```typescript
afterEach(() => {
  vi.clearAllMocks()
  sipClient.destroy()
  eventBus.destroy()
})
```

#### Use Descriptive Test Names

```typescript
// ✅ Good
it('should update registration state when sip:registered event is received')

// ❌ Bad
it('should work')
```

## Development Workflow

### Branch Naming Conventions

Use descriptive branch names with the following prefixes:

- `feature/` - New features (e.g., `feature/add-video-calling`)
- `fix/` - Bug fixes (e.g., `fix/connection-timeout`)
- `docs/` - Documentation updates (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-event-bus`)
- `test/` - Adding or updating tests (e.g., `test/add-call-session-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

```bash
# Create and switch to a new branch
git checkout -b feature/add-conference-calling
```

### Making Changes

1. **Keep changes focused**: One feature/fix per branch
2. **Write tests first** (TDD approach recommended)
3. **Update documentation** as you code
4. **Run checks frequently**:
   ```bash
   pnpm run lint
   pnpm run type-check
   pnpm run test
   ```

### Before Committing

Pre-commit hooks (via Husky) automatically run on `git commit`:

- ESLint with auto-fix on `.ts` and `.vue` files
- Prettier formatting on all code and markdown files

You can also run these manually:

```bash
pnpm run lint:fix
pnpm run format
```

### Keeping Your Fork Updated

Regularly sync with upstream:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Adding New Features

### Adding a New Composable

1. **Create the composable file** in `src/composables/`:

```typescript
// src/composables/useNewFeature.ts

import { ref, computed, readonly, type Ref, type ComputedRef } from 'vue'

/**
 * Return type for useNewFeature composable
 */
export interface UseNewFeatureReturn {
  /** Current feature state */
  isActive: ComputedRef<boolean>

  /** Activate the feature */
  activate: () => Promise<void>

  /** Deactivate the feature */
  deactivate: () => Promise<void>
}

/**
 * Composable for managing new feature
 *
 * @param initialConfig - Optional initial configuration
 * @returns Composable interface with reactive state and methods
 *
 * @example
 * ```typescript
 * const { isActive, activate } = useNewFeature()
 * await activate()
 * ```
 */
export function useNewFeature(
  initialConfig?: NewFeatureConfig
): UseNewFeatureReturn {
  // Implementation
  const isActive = ref(false)

  const activate = async (): Promise<void> => {
    // Implementation
    isActive.value = true
  }

  const deactivate = async (): Promise<void> => {
    // Implementation
    isActive.value = false
  }

  return {
    isActive: readonly(isActive),
    activate,
    deactivate,
  }
}
```

2. **Export from index**:

```typescript
// src/composables/index.ts
export { useNewFeature, type UseNewFeatureReturn } from './useNewFeature'
```

3. **Create unit tests**:

```typescript
// tests/unit/composables/useNewFeature.test.ts
import { describe, it, expect } from 'vitest'
import { useNewFeature } from '@/composables/useNewFeature'

describe('useNewFeature', () => {
  it('should initialize with inactive state', () => {
    const { isActive } = useNewFeature()
    expect(isActive.value).toBe(false)
  })

  // More tests...
})
```

4. **Update documentation** in README.md

5. **Create example usage** in `examples/`

### Adding a New Plugin

1. **Create plugin class** in `src/plugins/`:

```typescript
// src/plugins/NewPlugin.ts

import { EventBus } from '@/core/EventBus'
import type { Plugin, PluginContext } from './types'

export class NewPlugin implements Plugin {
  readonly name = 'NewPlugin'
  readonly version = '1.0.0'

  private eventBus: EventBus | null = null

  async install(context: PluginContext): Promise<void> {
    this.eventBus = context.eventBus
    // Setup plugin
  }

  async uninstall(): Promise<void> {
    // Cleanup
  }
}
```

2. **Export from plugin index**

3. **Write comprehensive tests**

4. **Document plugin API and usage**

### Adding Type Definitions

When adding new types:

1. Place in appropriate file in `src/types/`
2. Use clear, descriptive names
3. Export all public types
4. Document complex types with JSDoc

```typescript
// src/types/feature.types.ts

/**
 * Configuration for the new feature
 */
export interface NewFeatureConfig {
  /** Enable advanced mode */
  advanced?: boolean

  /** Timeout in milliseconds */
  timeout?: number
}

/**
 * State of the feature
 */
export type FeatureState = 'idle' | 'active' | 'processing' | 'error'
```

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no functional changes)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes (dependencies, configs)
- `revert`: Revert previous commit

### Scope (optional)

The scope specifies what part of the codebase is affected:

- `composables`
- `core`
- `plugins`
- `types`
- `tests`
- `docs`
- `examples`

### Examples

```bash
# Feature addition
feat(composables): add useConference for multi-party calls

Implements conference calling functionality with the following features:
- Add/remove participants
- Mute individual participants
- Conference recording support

Closes #123

# Bug fix
fix(core): prevent memory leak in CallSession cleanup

The CallSession was not properly removing event listeners on destroy,
causing memory leaks in long-running applications.

# Breaking change
feat(core)!: redesign SipClient initialization API

BREAKING CHANGE: SipClient constructor now requires EventBus as second parameter.
Migration guide added to docs/migrations/v2.md

# Documentation
docs(README): add examples for useCallHistory

# Refactoring
refactor(utils): simplify validation logic

# Testing
test(composables): add integration tests for useSipClient
```

### Rules

1. Use imperative mood ("add" not "added" or "adds")
2. Don't capitalize first letter of subject
3. No period at the end of subject
4. Limit subject line to 72 characters
5. Use body to explain what and why (not how)
6. Reference issues/PRs in footer

## Pull Request Process

### Before Submitting

1. **Update from main**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   pnpm run lint:fix
   pnpm run type-check
   pnpm run test
   pnpm run build
   ```

3. **Verify coverage**:
   ```bash
   pnpm run coverage
   ```

4. **Update documentation** if needed

5. **Test examples** if applicable

### PR Title

Use conventional commit format:

```
feat(composables): add video call support
fix(core): resolve race condition in registration
docs: update contributing guidelines
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Closes #123
Relates to #456

## Changes Made
- Detailed list of changes
- Another change
- Yet another change

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Coverage
- [ ] Coverage maintained/improved (minimum 80%)
- [ ] All new code is covered by tests

## Documentation
- [ ] README updated
- [ ] API documentation updated
- [ ] Examples added/updated
- [ ] CHANGELOG updated

## Screenshots (if applicable)
Add screenshots for UI changes

## Breaking Changes (if applicable)
Describe any breaking changes and migration path

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Build succeeds
```

### PR Size Guidelines

Keep PRs focused and manageable:

- **Small**: < 200 lines changed (preferred)
- **Medium**: 200-500 lines changed (acceptable)
- **Large**: > 500 lines changed (break into smaller PRs if possible)

For large features, consider:
- Breaking into multiple smaller PRs
- Creating a tracking issue with subtasks
- Using feature flags for incremental delivery

### Review Process

1. **Automated Checks**: CI must pass (linting, type checking, tests)
2. **Peer Review**: At least one approving review required
3. **Maintainer Review**: Core maintainer approval needed
4. **Address Feedback**: Respond to all comments
5. **Merge**: Maintainer will merge when ready

### After PR is Merged

1. Delete your branch (if not done automatically)
2. Pull latest main
3. Update your fork

```bash
git checkout main
git pull upstream main
git push origin main
```

## Code Review Guidelines

### For Authors

**Before requesting review:**
- Self-review your code
- Run all checks locally
- Add clear PR description
- Link related issues
- Add screenshots for UI changes

**During review:**
- Respond to all comments
- Ask for clarification if needed
- Be open to feedback
- Make requested changes promptly

### For Reviewers

**Focus areas:**
1. **Correctness**: Does the code work as intended?
2. **Tests**: Is there adequate test coverage?
3. **Performance**: Any performance concerns?
4. **Security**: Any security issues?
5. **Maintainability**: Is the code readable and maintainable?
6. **Documentation**: Is it properly documented?

**Review checklist:**
- [ ] Code follows style guidelines
- [ ] Logic is correct and handles edge cases
- [ ] Tests are comprehensive
- [ ] No security vulnerabilities
- [ ] Performance is acceptable
- [ ] Breaking changes are documented
- [ ] API is intuitive and well-designed
- [ ] Error handling is appropriate
- [ ] Documentation is clear and complete

**Providing feedback:**
- Be constructive and respectful
- Explain the "why" behind suggestions
- Distinguish between required changes and suggestions
- Acknowledge good code
- Use GitHub's suggestion feature for small fixes

**Comment types:**
- **Required**: Must be addressed before merge
- **Suggestion**: Nice to have, author decides
- **Question**: Seeking clarification
- **Praise**: Acknowledging good work

## Performance Considerations

### General Performance

1. **Avoid unnecessary reactivity**:
   ```typescript
   // ✅ Good - using readonly for derived state
   const count = ref(0)
   return { count: readonly(count) }

   // ❌ Bad - unnecessary reactive overhead
   const state = reactive({ count: 0, doubled: 0 })
   watch(() => state.count, (val) => state.doubled = val * 2)
   ```

2. **Use computed for derived values**:
   ```typescript
   // ✅ Good
   const doubled = computed(() => count.value * 2)

   // ❌ Bad
   const doubled = ref(0)
   watch(count, (val) => doubled.value = val * 2)
   ```

3. **Debounce expensive operations**:
   ```typescript
   import { useDebounceFn } from '@vueuse/core'

   const debouncedSearch = useDebounceFn((query: string) => {
     // Expensive search operation
   }, 300)
   ```

4. **Clean up resources**:
   ```typescript
   onUnmounted(() => {
     // Clean up timers, listeners, etc.
     clearInterval(timerId)
     eventBus.off('event', handler)
   })
   ```

### WebRTC Performance

1. **Limit media constraints**:
   ```typescript
   // Request only what you need
   const constraints = {
     audio: true,
     video: {
       width: { ideal: 1280 },
       height: { ideal: 720 },
       frameRate: { ideal: 30 }
     }
   }
   ```

2. **Release media streams promptly**:
   ```typescript
   const releaseStream = (stream: MediaStream) => {
     stream.getTracks().forEach(track => track.stop())
   }
   ```

3. **Monitor connection quality**:
   ```typescript
   // Implement connection quality monitoring
   const stats = await peerConnection.getStats()
   // Analyze and react to quality metrics
   ```

### Memory Management

1. **Avoid memory leaks**:
   - Remove event listeners on cleanup
   - Clear timers and intervals
   - Release media streams
   - Destroy objects when done

2. **Use WeakMap/WeakSet** for object associations:
   ```typescript
   const objectMetadata = new WeakMap<Object, Metadata>()
   ```

## Security Guidelines

### Authentication and Credentials

1. **Never commit secrets**:
   - No passwords, tokens, or API keys in code
   - Use environment variables for sensitive data
   - Add sensitive files to `.gitignore`

2. **Secure credential handling**:
   ```typescript
   // ✅ Good - credentials from secure config
   const config = {
     sipUri: import.meta.env.VITE_SIP_URI,
     password: import.meta.env.VITE_SIP_PASSWORD
   }

   // ❌ Bad - hardcoded credentials
   const config = {
     sipUri: 'sip:user@example.com',
     password: 'secret123'
   }
   ```

3. **Encrypt sensitive data**:
   ```typescript
   import { encrypt, decrypt } from '@/utils/encryption'

   // Encrypt before storage
   const encrypted = await encrypt(sensitiveData, key)
   localStorage.setItem('data', encrypted)
   ```

### Input Validation

1. **Validate all inputs**:
   ```typescript
   import { validateSipUri, validatePassword } from '@/utils/validators'

   function setConfig(config: SipClientConfig) {
     if (!validateSipUri(config.sipUri)) {
       throw new ValidationError('Invalid SIP URI')
     }
     if (!validatePassword(config.password)) {
       throw new ValidationError('Password does not meet requirements')
     }
   }
   ```

2. **Sanitize user input**:
   ```typescript
   // Prevent XSS in display names
   const sanitizeDisplayName = (name: string): string => {
     return name.replace(/[<>]/g, '')
   }
   ```

### WebRTC Security

1. **Use secure connections**:
   - Always use WSS (not WS) for SIP over WebSocket
   - Prefer HTTPS for all web resources
   - Use SRTP for media encryption

2. **Validate peer connections**:
   ```typescript
   // Verify remote peer identity before accepting
   if (!isAuthorizedPeer(remotePeer)) {
     rejectCall()
   }
   ```

### Dependencies

1. **Keep dependencies updated**:
   ```bash
   pnpm update
   pnpm audit
   ```

2. **Review security advisories**:
   - Check for known vulnerabilities
   - Update affected packages promptly

### Error Messages

1. **Don't expose sensitive information**:
   ```typescript
   // ✅ Good - generic error
   throw new Error('Authentication failed')

   // ❌ Bad - reveals too much
   throw new Error(`Authentication failed: Invalid password for user ${username}`)
   ```

## Documentation

### Code Documentation

1. **JSDoc for all public APIs**:
   - Composables
   - Core classes
   - Utility functions
   - Type definitions

2. **Inline comments** for complex logic

3. **Examples** in JSDoc:
   ```typescript
   /**
    * @example
    * ```typescript
    * const { isActive } = useFeature()
    * ```
    */
   ```

### README Updates

When adding features, update README.md with:
- Feature description
- Usage examples
- API reference
- Configuration options

### API Documentation

Update VitePress docs in `docs/` folder:
- Add new pages for major features
- Update API reference
- Include code examples
- Add troubleshooting guides

### Examples

Create practical examples in `examples/`:
- Demonstrate real-world usage
- Show best practices
- Cover common scenarios

### Changelog

Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [Unreleased]

### Added
- New feature X with Y capability

### Changed
- Improved performance of Z

### Fixed
- Resolved issue with A causing B
```

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on the issue, not the person
- Assume good intentions

### Getting Help

- Check existing issues and documentation first
- Provide context when asking questions
- Create minimal reproducible examples
- Be patient and respectful

### Reporting Issues

**Bug Reports**:
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Environment details (browser, OS, versions)
- Minimal reproduction (CodeSandbox, repo)

**Feature Requests**:
- Use case and motivation
- Proposed solution
- Alternative approaches considered
- Willingness to contribute

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas, showcases
- **Pull Requests**: Code contributions

## Additional Resources

- [VueSip Architecture Documentation](docs/developer/architecture.md) - System design and architecture
- [Vue 3 Documentation](https://vuejs.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [JsSIP Documentation](https://jssip.net/documentation/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

## License

By contributing to VueSip, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to VueSip! Your efforts help make SIP/VoIP development easier for everyone.**
