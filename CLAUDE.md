# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

- Check all: `npm run check` (runs lint, format check, typecheck, audit, tests, and build in parallel)
- Build: `npm run build`
- Lint: `npm run lint` (fix with `npm run lint:fix`)
- Format: `npm run format` (check with `npm run format:check`)
- Typecheck: `npm run typecheck`
- Audit: `npm run audit` (security audit for production dependencies)
- Test all: `npm run test`
- Test single file: `npx vitest run test/unit/path/to/file.test.ts`
- Test watch mode: `npm run test:watch`
- Test coverage: `npm run test:coverage`
- Start application: `npm run cli -- <command>`

## Code Style Guidelines

- TypeScript: Use strict typing, explicit return types, avoid `any`
- Formatting: 2 spaces, single quotes, 100 char line limit, trailing commas
- Naming: camelCase for variables/functions, PascalCase for classes/interfaces
- Imports: Use ES modules, sort imports logically
- Error handling: Always handle Promise rejections explicitly
- Testing: Write unit tests for all functionality
- Comments: Do not add comments to code unless absolutely necessary for clarity
- Quality: All code must pass lint, format, and type checks before completion

Always run quality checks (`npm run check`) before considering a task complete.

## Publishing Process

1. Update CHANGELOG.md with your changes under [Unreleased] section
2. Run checks: `npm run check` (fix any issues)
3. Update version: `npm version patch|minor|major`
4. Update CHANGELOG.md to move [Unreleased] changes to the new version with date
5. Build: `npm run build`
6. Commit changes: `git commit -a -m "Update changelog and build for vX.X.X"`
7. Push changes: `git push && git push --tags`
8. Publish: `npm publish` (with `--otp=<code>` if 2FA enabled)
9. Verify: `npx -y slack-tools-mcp --version`

## Changelog Management

- All notable changes must be documented in CHANGELOG.md
- Add new entries under the [Unreleased] section as you work
- Focus on functional changes that affect users
- Categorize changes as Added, Changed, Fixed, or Removed
- Move [Unreleased] changes to appropriate version section during release