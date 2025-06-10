# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- New `get-reactions` MCP tool to fetch emoji reactions for specific Slack messages
- `getMessageReactions` function in slack-services.ts to fetch reactions using the Slack Web API
- Comprehensive tests for the new reactions functionality and existing `searchSlackMessages` function
- Rate limit detection and handling for Slack API calls with clear error messages
- Rate limit warnings in the reactions tool output to inform users when they need to wait
- Type-safe error handling utilities in `types/slack-errors.ts` to avoid using `any` type

### Changed
- Made `sort` parameter optional with default value 'desc' in `searchSlackMessages` function
- Improved test coverage for slack-services.ts
- Enhanced error handling in `getMessageReactions` to distinguish between rate limits and other errors
- Improved type safety by replacing `any` types with proper TypeScript types and type guards

## [1.2.1] - 2024-12-04

### Changed
- Refactored authentication handling and improved error management

### Fixed
- Improved test coverage and fixed some minor bugs

## [1.2.0] - May 2025

### Changed
- Improved production readiness with optimized build configuration
- Updated package structure for more efficient npm distribution

## [1.1.0] - May 2025

### Changed
- Updated auth commands to output JSON for MCP configs

## [1.0.0] - April 2025

### Added
- Initial release with Slack token extraction capabilities
- Model Context Protocol (MCP) support for AI assistants
- Slack status management (set/get)
- Reminder creation functionality
- Thread replies retrieval
- Message search with markdown formatting
- User activity summary generation
- User profile information retrieval