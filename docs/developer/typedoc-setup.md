# TypeDoc Setup and Configuration Guide

This guide explains the TypeDoc configuration for VueSip API documentation generation and how to maintain and extend it.

## Overview

TypeDoc is a documentation generator for TypeScript projects that converts JSDoc comments and TypeScript type definitions into beautiful markdown API documentation. The VueSip project uses TypeDoc with the markdown plugin to generate API reference documentation that integrates with VitePress.

## Configuration Files

### typedoc.json

The main TypeDoc configuration file located at `/typedoc.json` controls how API documentation is generated.

**Key Settings:**

```json
{
  "entryPoints": ["src/index.ts"],
  "tsconfig": "tsconfig.json",
  "out": "docs/api/generated",
  "plugin": [
    "typedoc-plugin-markdown",
    "typedoc-plugin-missing-exports"
  ]
}
```

**Entry Points:**
- `src/index.ts` - The main package entry point. All public exports are documented from here.

**Output Location:**
- `docs/api/generated/` - Generated markdown files are placed here and linked from VitePress

**Plugins:**
- `typedoc-plugin-markdown` - Converts output to markdown format (v4.0.0+)
- `typedoc-plugin-missing-exports` - Detects and documents exported items from reexports

### Available NPM Scripts

```bash
# Generate API documentation
npm run docs:api

# Watch for changes and regenerate
npm run docs:api:watch

# Generate all documentation (API + VitePress)
npm run docs:all

# Start VitePress dev server for documentation
npm run docs:dev

# Build production documentation
npm run docs:build
```

## Configuration Options Explained

### Visibility and Access Control

```json
{
  "excludePrivate": true,           // Exclude private members
  "excludeProtected": false,        // Include protected members
  "excludeInternal": true,          // Exclude @internal tagged items
  "excludeExternals": true          // Exclude external dependencies
}
```

**Best Practices:**
- Keep `excludePrivate: true` - Private members are implementation details
- Include `protected: true` - Useful for users extending classes
- Keep `excludeInternal: true` - Internal-only code shouldn't be documented
- Keep `excludeExternals: true` - Avoid duplicate docs from dependencies

### Validation and Quality Checks

```json
{
  "validation": {
    "notExported": true,      // Warn if public items aren't exported
    "invalidLink": true,      // Warn if JSDoc links are invalid
    "notDocumented": false    // Don't warn about undocumented items
  },
  "treatWarningsAsErrors": false  // Don't fail on warnings
}
```

### Sorting and Organization

```json
{
  "sort": ["source-order", "required-first", "kind"],
  "kindSortOrder": [
    "Function",
    "Class",
    "Interface",
    "TypeAlias",
    "Variable",
    "Enum"
  ]
}
```

This ordering puts:
1. **Functions** first (most used API)
2. **Classes** second (structural components)
3. **Interfaces** third (type definitions)
4. **Type Aliases** (advanced types)
5. **Variables** (constants and exports)
6. **Enums** (enumerated types)

### Output Formatting

```json
{
  "indexFormat": "table",
  "parametersFormat": "table",
  "interfacePropertiesFormat": "table",
  "classPropertiesFormat": "table",
  "enumMembersFormat": "table",
  "typeDeclarationFormat": "table",
  "propertyMembersFormat": "table",
  "useCodeBlocks": true,
  "markedOptions": {
    "breaks": true,
    "gfm": true
  }
}
```

**Benefits:**
- **Table format** - Easy to scan and compare properties
- **Code blocks** - Proper syntax highlighting for examples
- **GFM support** - GitHub Flavored Markdown for better compatibility

## Writing Documentation

### JSDoc Tags Used in VueSip

#### Package Documentation

```typescript
/**
 * VueSip - A headless Vue.js component library for SIP/VoIP applications
 *
 * @packageDocumentation
 * @module vuesip
 * @version 1.0.0
 */
```

#### Function Documentation

```typescript
/**
 * Create VueSip Vue plugin.
 *
 * This plugin initializes VueSip with global configuration and makes it available
 * throughout your Vue application.
 *
 * @param options - Plugin configuration options
 * @returns Vue plugin object
 *
 * @public
 *
 * @example
 * ```typescript
 * import { createApp } from 'vue'
 * import { createVueSip } from 'vuesip'
 *
 * const app = createApp(App)
 * app.use(createVueSip({
 *   debug: true,
 *   logLevel: 'info'
 * }))
 * ```
 *
 * @remarks
 * The plugin performs the following initialization:
 * 1. Configures global logging level and debug mode
 * 2. Initializes configuration store with provided config
 * 3. Sets up global error handling (optional)
 */
export function createVueSip(options: VueSipOptions = {}): Plugin {
  // ...
}
```

#### Interface Documentation

```typescript
/**
 * Options for the VueSip Vue plugin.
 *
 * @public
 */
export interface VueSipOptions {
  /**
   * Enable debug mode
   * @default false
   */
  debug?: boolean

  /**
   * Logging level
   * @default 'warn'
   */
  logLevel?: LogLevel
}
```

### Supported JSDoc Tags

| Tag | Purpose | Example |
|-----|---------|---------|
| `@public` | Mark as public API | `@public` |
| `@internal` | Hide from docs (with stripInternal: true) | `@internal` |
| `@example` | Show usage example | See above |
| `@remarks` | Additional context | `@remarks The plugin...` |
| `@param` | Parameter documentation | `@param name - Description` |
| `@returns` | Return value documentation | `@returns Vue plugin object` |
| `@throws` | Exception documentation | `@throws Error if invalid` |
| `@deprecated` | Mark as deprecated | `@deprecated Use newFunction instead` |
| `@see` | Cross-reference | `@see {@link OtherFunction}` |
| `@default` | Default value | `@default false` |
| `@module` | Module identifier | `@module vuesip` |
| `@packageDocumentation` | Package-level docs | `@packageDocumentation` |

## Troubleshooting

### Missing Exports

**Problem:** Some exports don't appear in documentation

**Solution:** Check `src/index.ts` exports. TypeDoc documents from the entry point:
```typescript
// ✓ Will be documented
export * from './composables'

// ✗ Won't be documented (not exported)
import { useCallSession } from './composables'
```

### Broken Links in Documentation

**Problem:** TypeDoc warns about invalid links

**Solution:** Use correct link syntax:
```typescript
// ✓ Correct
@see {@link useSipClient}
@see {@link SipClientConfig}

// ✗ Incorrect
@see useSipClient
@see {@link non-existent-item}
```

### Internal Items Appearing in Docs

**Problem:** Items marked with `@internal` appear in API docs

**Solution:** Ensure `stripInternal: true` is set in typedoc.json:
```json
{
  "stripInternal": true,
  "excludeInternal": true
}
```

### Generated Files Not Updating

**Problem:** Changes to comments don't appear in docs

**Solution:**
1. Clean the output directory:
   ```bash
   rm -rf docs/api/generated/
   npm run docs:api
   ```

2. Or use the auto-clean setting (already enabled):
   ```json
   {
     "cleanOutputDir": true
   }
   ```

## Integration with VitePress

The generated documentation is integrated into the main documentation site through VitePress:

**File:** `/docs/.vitepress/config.ts`

```typescript
{
  text: 'Full API Reference (TypeDoc)',
  link: '/api/generated/'
}
```

The generated markdown files are:
- Stored in `docs/api/generated/`
- Automatically linked in navigation
- Formatted to match VitePress styling
- Indexed by VitePress search

## Best Practices

### 1. Keep Documentation Updated

When changing public APIs:
```bash
# 1. Update source code and comments
# 2. Generate new documentation
npm run docs:api
# 3. Verify output in docs/api/generated/
# 4. Commit both code and generated docs
```

### 2. Use Examples in Documentation

Always include practical examples:

```typescript
/**
 * @example
 * ```typescript
 * // Basic usage
 * const result = myFunction('value')
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage
 * const result = myFunction('value', {
 *   option: true
 * })
 * ```
 */
```

### 3. Document All Public APIs

Mark public items explicitly:
```typescript
/**
 * Public composable for managing SIP connections.
 *
 * @public
 */
export function useSipClient(config: SipClientConfig) {
  // ...
}
```

### 4. Use @remarks for Context

Provide additional context:
```typescript
/**
 * Connect to SIP server.
 *
 * Establishes a WebSocket connection and authenticates with the SIP server.
 *
 * @remarks
 * - Requires valid configuration
 * - May take several seconds for network connection
 * - Authentication is automatic if credentials are provided
 *
 * @throws {Error} If connection fails
 */
```

### 5. Link Related Items

Use cross-references:
```typescript
/**
 * @see {@link useSipClient} for initial setup
 * @see {@link useCallSession} for making calls
 * @see {@link SipClientConfig} for configuration options
 */
```

## Generation Workflow

### Full Documentation Build

```bash
# 1. Generate API docs
npm run docs:api

# 2. Build full documentation site
npm run docs:build

# 3. Preview locally
npm run docs:dev
```

### Watch Mode for Development

```bash
# Terminal 1: Watch for TypeScript changes
npm run docs:api:watch

# Terminal 2: Watch VitePress (in another terminal)
npm run docs:dev
```

## Configuration Reference

See the complete configuration reference at:
- [TypeDoc Official Documentation](https://typedoc.org/)
- [TypeDoc Configuration Schema](https://typedoc.org/schema.json)
- [TypeDoc Markdown Plugin](https://github.com/typedoc2md/typedoc-plugin-markdown)

## Advanced Topics

### Custom CSS for Generated Docs

TypeDoc supports custom CSS through `customCss` option (future enhancement):

```json
{
  "customCss": "path/to/custom.css"
}
```

### Changing Output Format

The current setup uses markdown. To use other formats:

1. **HTML** - Remove markdown plugin, TypeDoc generates HTML by default
2. **JSON** - Use `--json` flag with different output file

### Multiple Entry Points

For documenting multiple packages:

```json
{
  "entryPoints": [
    "src/index.ts",
    "src/advanced/index.ts"
  ]
}
```

## Maintenance

### When to Update TypeDoc Configuration

- When upgrading TypeDoc version
- When adding new public APIs
- When changing documentation style
- When updating plugins

### Update Checklist

- [ ] Update `typedoc.json` version if needed
- [ ] Test generation: `npm run docs:api`
- [ ] Review generated files for quality
- [ ] Update this guide if configuration changes
- [ ] Commit both config and generated docs

## Related Documentation

- [VueSip API Reference](/api/)
- [VitePress Documentation Guide](https://vitepress.dev/)
- [TypeScript JSDoc Guide](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Architecture Documentation](/developer/architecture.md)

## Version Information

- **TypeDoc Version:** 0.28.0+
- **Plugin Markdown:** 4.0.0+
- **Plugin Missing Exports:** 3.0.0+
- **Last Updated:** 2025-11-09

---

For questions about TypeDoc setup, open an issue on [GitHub](https://github.com/ironyh/VueSip/issues).
