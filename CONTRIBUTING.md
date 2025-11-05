# Contributing to DailVue

Thank you for your interest in contributing to DailVue! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/DailVue.git
   cd DailVue
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running the Example App

```bash
npm run dev
```

This starts a development server at `http://localhost:5173` with hot-reload enabled.

### Type Checking

```bash
npm run type-check
```

Runs TypeScript type checking without emitting files.

### Linting

```bash
npm run lint
```

Runs ESLint to check and fix code style issues.

### Building

```bash
npm run build
```

Builds the library for production distribution.

## Code Style

- Use TypeScript for all source files
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and small

## Project Structure

```
DailVue/
├── src/
│   ├── composables/     # Headless Vue composables
│   ├── components/      # Example UI components
│   ├── types/          # TypeScript type definitions
│   └── index.ts        # Main export file
├── examples/           # Example applications
├── dist/              # Build output (generated)
└── package.json
```

## Adding a New Composable

1. Create a new file in `src/composables/`
2. Define the composable function with proper TypeScript types
3. Export it from `src/index.ts`
4. Add documentation to README.md
5. Create an example in `examples/`
6. Add tests if applicable

Example structure:

```typescript
import { ref, type Ref } from 'vue'

export interface UseYourFeatureReturn {
  // Define return types
}

export function useYourFeature(): UseYourFeatureReturn {
  // Implementation
  
  return {
    // Exported values and functions
  }
}
```

## Commit Messages

Use clear, descriptive commit messages:

- `feat: Add new feature`
- `fix: Fix bug in X`
- `docs: Update documentation`
- `style: Format code`
- `refactor: Refactor X`
- `test: Add tests for X`
- `chore: Update dependencies`

## Pull Request Process

1. Ensure your code passes all checks:
   ```bash
   npm run lint
   npm run type-check
   npm run build
   ```

2. Update documentation if needed
3. Add your changes to examples if applicable
4. Submit a pull request with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes

## Testing

While we don't currently have automated tests, please:
- Test your changes manually
- Verify against a real SIP server if possible
- Check browser console for errors
- Test in multiple browsers if UI changes are involved

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about usage
- Discussion about improvements

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
