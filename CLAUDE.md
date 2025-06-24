# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

- Check all: `pnpm run check` (runs lint, format check, typecheck, audit, tests, and build in parallel)
- Build: `pnpm run build`
- Lint: `pnpm run lint` (fix with `pnpm run lint:fix`)
- Format: `pnpm run format` (check with `pnpm run format:check`)
- Typecheck: `pnpm run typecheck`
- Audit: `pnpm run audit` (security audit for production dependencies)
- Test all: `pnpm run test`
- Test coverage: `pnpm run test:coverage`
- Start application: `pnpm run cli -- <command>`

## Code Style Guidelines

- TypeScript: Use strict typing, explicit return types, avoid `any`
- Formatting: 2 spaces, single quotes, 100 char line limit, trailing commas
- Naming: camelCase for variables/functions, PascalCase for classes/interfaces
- Imports: Use ES modules, sort imports logically
- Error handling: Always handle Promise rejections explicitly
- Testing: Write unit tests for all functionality
- Comments: Do not add comments to code unless absolutely necessary for clarity
- Quality: All code must pass lint, format, and type checks before completion

Always run quality checks (`pnpm run check`) before considering a task complete.
