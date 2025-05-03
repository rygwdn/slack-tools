# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

- Check all: `npm run check` (runs lint, format check, typecheck, tests, and build in parallel)
- Build: `npm run build`
- Lint: `npm run lint` (fix with `npm run lint:fix`)
- Format: `npm run format` (check with `npm run format:check`)
- Typecheck: `npm run typecheck`
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
