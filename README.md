# Slack Tools MCP

A TypeScript library for interacting with Slack's local data, including token extraction from the desktop app and Model Context Protocol (MCP) support for AI assistants.

## Description

This tool provides programmatic access to the [Slack](https://slack.com/) ecosystem by extracting authentication tokens from the Slack desktop app's local storage and uses the official Slack Web API package for making API calls. It also includes full MCP support for integrating with AI assistants like Claude. This project is not endorsed or authorized by Slack Technologies LLC.

## Installation

No installation required! You can run the tool directly using npx with the npm package:

```bash
npx -y slack-tools-mcp [options] [command]
```

## Authentication

There are two ways to authenticate with Slack:

1. **Environment Variables:**
   - `SLACK_TOKEN` - Directly specify a Slack token (must start with `xoxc-`)
   - `SLACK_COOKIE` - Directly specify a Slack cookie value (must start with `xoxd-`)

2. **Authentication Commands:**

   - **Extract from Slack desktop app:**
     ```bash
     npx -y slack-tools-mcp auth-from-app --store
     ```
     This will extract your Slack token and cookie directly from the Slack desktop app's local storage. **The Slack app must be closed while running this command.**

   - **Extract from curl command:**
     ```bash
     # Provide curl command as argument:
     npx -y slack-tools-mcp auth-from-curl --store "curl -X POST https://slack.com/api/..."

     # Or use interactive prompt:
     npx -y slack-tools-mcp auth-from-curl --store
     ```
     This extracts authentication from a Slack API curl command. You can get this by:
     1. In Chrome/Firefox, open Slack in your browser
     2. Open Developer Tools and go to the Network tab
     3. Perform any action (e.g., send a message or switch channels)
     4. Find a request to api.slack.com, right-click and select "Copy as cURL"
     5. Paste the curl command as shown above (or paste into the interactive prompt)

Using stored credentials means you won't need to re-authenticate for subsequent commands.

## Available Commands

- **mcp** - Start a Model Context Protocol server for AI assistants with Slack tools
- **set-status** - Set your Slack status with optional emoji and duration
- **get-status** - Get your current Slack status including text, emoji, and expiration
- **create-reminder** - Create a Slack reminder with custom timing
- **get-thread-replies** - Get replies in a Slack thread
- **search** - Search Slack messages with markdown formatting
- **my-messages** - Generate a summary of your Slack activity within a date range
- **get-user-profile** - Get detailed profile information for a Slack user

## Development

This project is built with TypeScript and is actively developed using AI-assisted tools:

- [Claude Code](https://claude.ai/code) provides intelligent code assistance and helps with implementation
- [Cursor](https://cursor.sh/) is used as the primary editor with AI capabilities

### AI Notes

- `CLAUDE.md` contains instructions for Claude Code when working with this project
- `.cursorignore`, `.cursor/rules/*` and related files contain rules for Cursor editor

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/rygwdn/slack-tools.git
   cd slack-tools
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the CLI directly during development:
   ```bash
   npm run cli -- <command>
   ```
   For example: `npm run cli -- mcp` or `npm run cli -- auth-from-app --store`


### Building and Testing

```bash
# Run all checks in parallel (lint, format check, typecheck, test) and build
npm run check

# Or run individual tasks:
npm run lint       # Check code style and potential errors
npm run format     # Format code using Prettier
npm run typecheck  # Check TypeScript types
npm run test       # Run tests
npm run build      # Build the project
```

## License

MIT
