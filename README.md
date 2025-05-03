# Slack Tools MCP

A TypeScript library for interacting with Slack's local data, including token extraction from the desktop app and Model Context Protocol (MCP) support for AI assistants.

## Description

This tool provides programmatic access to the [Slack](https://slack.com/) ecosystem by extracting authentication tokens from the Slack desktop app's local storage and uses the official Slack Web API package for making API calls. It also includes full MCP support for integrating with AI assistants like Claude. This project is not endorsed or authorized by Slack Technologies LLC.

## Installation

No installation required! You can run the tool directly using npx:

```bash
npx -y github:rygwdn/slack-tools [options] [command]
```

## Authentication

There are two ways to authenticate with Slack:

1. **Environment Variables:**
   - `SLACK_TOKEN` - Directly specify a Slack token (must start with `xoxc-`)
   - `SLACK_COOKIE` - Directly specify a Slack cookie value (must start with `xoxd-`)

2. **Authentication Commands:**

   - **Extract from Slack desktop app:**
     ```bash
     npx -y github:rygwdn/slack-tools auth-from-app --store
     ```
     This will extract your Slack token and cookie directly from the Slack desktop app's local storage. 
     - The Slack app must be closed while running this command
     - Use `--workspace <name>` to specify a particular workspace if you're logged into multiple
     - The `--store` flag saves credentials to your system keychain for future use
     - Command outputs the extracted token and cookie for verification or manual use

   - **Extract from curl command:**
     ```bash
     # Provide curl command as argument:
     npx -y github:rygwdn/slack-tools auth-from-curl --store "curl -X POST https://slack.com/api/..."
     
     # Or use interactive prompt:
     npx -y github:rygwdn/slack-tools auth-from-curl --store
     ```
     This extracts authentication from a Slack API curl command:
     1. In Chrome/Firefox, open Slack in your browser
     2. Open Developer Tools (F12) and go to the Network tab
     3. Perform any action (e.g., send a message)
     4. Find a request to api.slack.com, right-click and select "Copy as cURL"
     5. Paste the curl command as shown above (or paste into the interactive prompt)
     - If no curl command is provided, you'll be prompted to enter it interactively
     - Multi-line curl commands are supported with proper escaping
     - The `--store` flag saves credentials to your system keychain for future use
     - Command outputs the extracted token and cookie for verification or manual use

Using stored credentials means you won't need to re-authenticate for subsequent commands.

## Global Options

- `-d, --debug` - Enable debug mode for detailed logging
- `SLACK_TOOLS_DEBUG` - Set to 'true' to enable debug mode

## Available Commands

- **mcp** - Start a Model Context Protocol server for AI assistants with Slack tools
- **set-status** - Set your Slack status with optional emoji and duration
- **get-status** - Get your current Slack status including text, emoji, and expiration
- **create-reminder** - Create a Slack reminder with custom timing
- **get-thread-replies** - Get replies in a Slack thread
- **search** - Search Slack messages with markdown formatting
- **my-messages** - Generate a summary of your Slack activity within a date range
- **get-user-profile** - Get detailed profile information for a Slack user

## Requirements

- Node.js 18.0.0 or higher
- macOS or Linux operating system (Windows not supported)
- Slack desktop app installed (if using auth-from-app)

## Notes

- The Slack app must be closed when using auth-from-app to access the LevelDB database
- Each Slack Workspace has its own personal token

## Development

This project is built with TypeScript and is actively developed using AI-assisted tools:

- [Claude Code](https://claude.ai/code) provides intelligent code assistance and helps with implementation
- [Cursor](https://cursor.sh/) is used as the primary editor with AI capabilities

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

### Project Structure

- `CLAUDE.md` contains instructions for Claude Code when working with this project
- `.cursorignore` and related files contain rules for Cursor editor
- Build, test, and lint commands are defined in `package.json`

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