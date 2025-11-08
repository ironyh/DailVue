# Pull Request

## Description

<!-- Provide a clear and concise description of your changes -->


## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (code improvements without changing functionality)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Test improvements
- [ ] Build/CI/CD changes
- [ ] Dependencies update

## Related Issues

<!-- Link to related issues using #issue_number or full URLs -->

Closes: #
Related: #

## What's Changed

<!-- Provide a bullet-point list of the main changes -->

-
-
-

## Testing Checklist

<!-- Mark completed items with an "x" -->

### Unit Tests
- [ ] Added/updated unit tests for new/changed functionality
- [ ] All unit tests pass (`pnpm test`)
- [ ] Test coverage maintained or improved

### Integration Tests
- [ ] Added/updated integration tests where applicable
- [ ] All integration tests pass (`pnpm test:integration`)
- [ ] Edge cases covered

### Manual Testing
- [ ] Tested in development environment
- [ ] Tested with real SIP server/provider
- [ ] Tested on multiple browsers (if UI changes)
- [ ] Tested on mobile devices (if applicable)
- [ ] Verified no console errors or warnings

## Code Quality Checklist

<!-- Mark completed items with an "x" -->

- [ ] TypeScript types are properly defined (no `any` unless absolutely necessary)
- [ ] Code follows project style guide and conventions
- [ ] ESLint passes with no errors (`pnpm lint`)
- [ ] No ESLint suppressions added (or justified in comments if necessary)
- [ ] Code is DRY (Don't Repeat Yourself) - no unnecessary duplication
- [ ] Functions/methods have single responsibility
- [ ] Public APIs have JSDoc documentation
- [ ] Complex logic includes inline comments
- [ ] No memory leaks (event listeners cleaned up, timeouts cleared)
- [ ] Error handling is comprehensive and user-friendly
- [ ] Accessibility considerations addressed (if UI changes)

## Breaking Changes

<!-- If this is a breaking change, describe what breaks and the migration path -->

- [ ] This PR includes breaking changes

**Breaking changes details:**
<!-- Describe what breaks and how users should migrate -->


## Screenshots/Demos

<!-- For UI changes, include before/after screenshots or screen recordings -->
<!-- For new features, consider adding a demo GIF or video -->

**Before:**


**After:**


## Performance Impact

<!-- Describe any performance implications of your changes -->

- [ ] No significant performance impact
- [ ] Performance improved (describe how)
- [ ] Performance impact assessed and acceptable (describe)

## Documentation

<!-- Mark completed items with an "x" -->

- [ ] README.md updated (if applicable)
- [ ] User guides updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] Code comments added/updated for complex logic
- [ ] CHANGELOG.md updated (if applicable)

## Reviewer Notes

<!-- Add any notes for reviewers, areas you'd like special attention on, or questions -->


## Checklist Before Requesting Review

<!-- Final checklist before submitting PR -->

- [ ] Code is self-reviewed
- [ ] Changes follow the project's contribution guidelines (see [CONTRIBUTING.md](../CONTRIBUTING.md))
- [ ] Commit messages are clear and follow project conventions
- [ ] Branch is up to date with base branch
- [ ] No merge conflicts
- [ ] All CI checks pass

---

**For Reviewers:**

Please verify:
- [ ] Code quality and style consistency
- [ ] Test coverage is adequate
- [ ] Documentation is clear and complete
- [ ] No security vulnerabilities introduced
- [ ] TypeScript types are properly defined
- [ ] Changes align with project architecture and goals
