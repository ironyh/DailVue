# Post-task Checklist
- Run relevant tests (Vitest suites or targeted Playwright specs) for affected areas.
- Execute `pnpm lint` and `pnpm format` if linting/formatting may have changed.
- Perform `pnpm typecheck` when touching TypeScript types/interfaces.
- Update docs or changelog entries when public API changes.
- Verify playground/example usage if composable behavior changes.
- Prepare concise summary and note remaining risks before opening PR.