# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- New `get-reactions` MCP tool to fetch emoji reactions for specific Slack messages
- `getMessageReactions` function in slack-services.ts to fetch reactions using the Slack Web API
- Comprehensive tests for the new reactions functionality and existing `searchSlackMessages` function
- Rate limit warnings in the reactions tool output to inform users when they need to wait
- Type-safe error handling utilities in `types/slack-errors.ts` to avoid using `any` type

### Changed
- Improved test coverage for slack-services.ts
- Enhanced error handling for all Slack API methods to provide consistent rate limit detection and specific error types
  - All methods now distinguish between rate limits, Slack API errors, and general errors
  - Rate limited requests now provide clear retry-after information
  - Improved logging for better debugging of API issues
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