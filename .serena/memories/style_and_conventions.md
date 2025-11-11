# Style and Conventions
- Language: TypeScript with Vue 3 single-file components/composables; prefer Composition API and strong typing.
- Linting: ESLint (`eslint:recommended`, `@typescript-eslint/recommended`, `plugin:vue/vue3-recommended`) with Prettier; honor `@typescript-eslint/no-unused-vars` (ignore `_` prefixes), avoid `any` where possible.
- Vue rules: multi-word component names not required; default props optional; must declare emits via `defineEmits` (`vue/require-explicit-emits`).
- Formatting: Prettier config in `.prettierrc` (2 spaces, single quotes per defaults) applied via `pnpm format` or lint-staged.
- Code expectations: no console/debugger in production; maintain accessibility focus (numerous Playwright a11y specs); include TypeDoc-friendly JSDoc when documenting public APIs.