# TypeDoc Quick Reference Card

A quick reference guide for developers working with VueSip documentation.

## Essential Commands

```bash
# Generate API documentation from TypeScript
npm run docs:api

# Watch for changes and regenerate continuously
npm run docs:api:watch

# Generate everything (API docs + VitePress site)
npm run docs:all

# Start documentation preview server
npm run docs:dev

# Build production documentation
npm run docs:build
```

## Common Documentation Patterns

### Function Documentation

```typescript
/**
 * Brief description of what the function does.
 *
 * Longer explanation if needed.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 *
 * @public
 *
 * @example
 * ```typescript
 * const result = myFunction('value')
 * ```
 *
 * @remarks
 * Additional context about the function:
 * - Important consideration 1
 * - Important consideration 2
 * - Linked reference: {@link OtherFunction}
 *
 * @throws {ErrorType} When something goes wrong
 */
export function myFunction(paramName: string): ReturnType {
  // implementation
}
```

### Interface Documentation

```typescript
/**
 * Interface description.
 *
 * @public
 */
export interface MyInterface {
  /**
   * Property description
   * @default 'value'
   */
  myProperty: string

  /**
   * Optional property description
   */
  optionalProp?: boolean
}
```

### Class Documentation

```typescript
/**
 * Class description.
 *
 * Usage example here.
 *
 * @public
 *
 * @example
 * ```typescript
 * const instance = new MyClass(config)
 * await instance.initialize()
 * ```
 */
export class MyClass {
  /**
   * Method description
   */
  public method(): void {
    // implementation
  }
}
```

## JSDoc Tags Reference

| Tag | Usage | Example |
|-----|-------|---------|
| `@public` | Mark item as public API | `@public` |
| `@internal` | Hide from docs (removes from generation) | `@internal` |
| `@deprecated` | Mark as deprecated | `@deprecated Use newFunction instead` |
| `@param` | Document function parameter | `@param name - The parameter description` |
| `@returns` | Document return value | `@returns A string result` |
| `@throws` | Document thrown errors | `@throws {Error} When validation fails` |
| `@example` | Add code example | Wrapped in code block |
| `@remarks` | Add additional context | Multi-paragraph explanation |
| `@see` | Cross-reference items | `@see {@link OtherFunction}` |
| `@default` | Specify default value | `@default 'value'` |
| `@module` | Specify module name | `@module vuesip` |
| `@packageDocumentation` | Mark as package docs | At top of index.ts |

## Entry Point (src/index.ts)

All public exports must be re-exported from the main entry point:

```typescript
// ✓ Correct - will be documented
export * from './composables'

// ✓ Correct - explicit export
export { useSipClient } from './composables'

// ✗ Wrong - won't be documented
import { useSipClient } from './composables'
// (needs to be re-exported)
```

## Cross-References

```typescript
// Link to function
@see {@link useSipClient}

// Link with custom text
@see {@link useSipClient | SIP Client Hook}

// Link to type
@see {@link SipClientConfig}

// Link to section in same comment
@see Installation section above
```

## Code Examples in Docs

```typescript
/**
 * @example
 * Basic usage:
 * ```typescript
 * import { useSipClient } from 'vuesip'
 * const client = useSipClient(config)
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * try {
 *   await client.connect()
 * } catch (error) {
 *   console.error('Connection failed:', error)
 * }
 * ```
 */
```

## Generated Documentation

**Location:** `/docs/api/generated/`

**Accessible at:** `/api/generated/` in VitePress

**Structure:**
- `index.md` - Overview page
- `modules/{moduleName}.md` - Each exported module
- `classes/{ClassName}.md` - Each class
- `interfaces/{InterfaceName}.md` - Each interface
- `functions/{functionName}.md` - Each function
- `types/{TypeName}.md` - Each type alias

## Configuration File

**Location:** `/typedoc.json`

**Key Settings:**
- Entry point: `src/index.ts`
- Output: `docs/api/generated`
- Format: Markdown (via typedoc-plugin-markdown)
- Exclude: test files, node_modules, dist

## When Docs Need Updating

Update documentation when:
- [ ] Adding new public exports
- [ ] Changing function signatures
- [ ] Modifying interface properties
- [ ] Changing default values
- [ ] Adding deprecations

**Command:** `npm run docs:api`

## Verification Checklist

Before committing documentation changes:

- [ ] All public exports have JSDoc comments
- [ ] All parameters are documented with @param
- [ ] Return values are documented with @returns
- [ ] Examples are provided for complex APIs
- [ ] Cross-references use correct @see syntax
- [ ] No broken links (use {@link ...} for internal)
- [ ] @internal items are hidden appropriately
- [ ] @public marks public API items
- [ ] Markdown formatting is correct

## Preview Documentation

1. **Generate API docs:**
   ```bash
   npm run docs:api
   ```

2. **View in VitePress:**
   ```bash
   npm run docs:dev
   # Navigate to http://localhost:5173/api/generated/
   ```

3. **Or view raw markdown:**
   ```bash
   cat docs/api/generated/index.md
   ```

## Troubleshooting

### Docs not updating?
```bash
rm -rf docs/api/generated/
npm run docs:api
```

### Link errors?
- Use `{@link ItemName}` for internal items
- Verify item is actually exported from src/index.ts

### Item not appearing in docs?
- Check if marked with `@internal`
- Verify it's exported from src/index.ts
- Check if it's in excluded patterns

## Learn More

- **Full Setup Guide:** See `/docs/developer/typedoc-setup.md`
- **TypeDoc Docs:** https://typedoc.org/
- **JSDoc Reference:** https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
- **Markdown Plugin:** https://github.com/typedoc2md/typedoc-plugin-markdown

## Quick Links

- Configuration: `/typedoc.json`
- Entry Point: `/src/index.ts`
- Generated Docs: `/docs/api/generated/`
- Setup Guide: `/docs/developer/typedoc-setup.md`
- Improvements: `/TYPEDOC_IMPROVEMENTS.md`

---

**Last Updated:** November 9, 2025

Print this page or save as PDF for offline reference.
