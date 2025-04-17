# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands
- Build: `npm run build`
- Lint: `npm run lint` (fix with `npm run lint:fix`) 
- Format: `npm run format` (check with `npm run format:check`)
- Test all: `npm run test`
- Test single file: `npx vitest run test/unit/path/to/file.test.ts`
- Test watch mode: `npm run test:watch`
- Test coverage: `npm run test:coverage`
- Start application: `npm run start`

## Code Style Guidelines
- TypeScript: Use strict typing, explicit return types, avoid `any`
- Formatting: 2 spaces, single quotes, 100 char line limit, trailing commas
- Naming: camelCase for variables/functions, PascalCase for classes/interfaces
- Imports: Use ES modules, sort imports logically
- Error handling: Always handle Promise rejections explicitly
- Testing: Write unit tests for all functionality
- Quality: All code must pass lint, format, and type checks before completion

Always run quality checks (`npm run lint`, `npm run build`) before considering a task complete.