# Slack MCP

An MCP (Model Context Protocol) server that enables AI assistants to interact with Slack using local user tokens extracted from the Slack desktop app.

> **Note**: This is an internal Shopify fork of [rygwdn/slack-tools](https://github.com/rygwdn/slack-tools), originally created by @rygwdn (a Shopifolk). This fork simplifies internal development and usage at Shopify.

## Description

This tool provides programmatic access to the [Slack](https://slack.com/) ecosystem by extracting authentication tokens from the Slack desktop app's local storage and uses the official Slack Web API package for making API calls. It also includes full MCP support for integrating with AI assistants like Claude. This project is not endorsed or authorized by Slack Technologies LLC.

## Installation

No installation required! You can run the tool directly using npx with the npm package:

```bash
npx -y github:shopify-playground/slack-mcp [options] [command]
```

## Authentication

Slack MCP requires authentication credentials to be configured in your MCP client. You'll need:

- `SLACK_TOKEN` - Your Slack token (starts with `xoxc-`)
- `SLACK_COOKIE` - Your Slack cookie (starts with `xoxd-`)

### Getting Your Credentials

There are two ways to get your Slack credentials:

1. **Extract from Slack desktop app:**
   ```bash
   npx -y github:shopify-playground/slack-mcp auth-from-app
   ```
   This will extract your Slack token and cookie directly from the Slack desktop app's local storage. **The Slack app must be closed while running this command.**

2. **Extract from curl command:**
   ```bash
   # Copy curl command to clipboard, then:
   pbcopy | npx -y github:shopify-playground/slack-mcp auth-from-curl
   
   # On Windows:
   Get-Clipboard | npx -y github:shopify-playground/slack-mcp auth-from-curl
   ```
   To get a curl command:
   1. In Chrome/Firefox, open Slack in your browser
   2. Open Developer Tools and go to the Network tab
   3. Perform any action (e.g., send a message or switch channels)
   4. Find a request to api.slack.com, right-click and select "Copy as cURL"
   5. Run the command above to pipe from clipboard

### Configuring Your MCP Client

Both authentication commands will output a JSON configuration that looks like this:

```json
{
  "mcpServers": {
    "slack-mcp": {
      "command": "npx",
      "args": ["-y", "github:shopify-playground/slack-mcp"],
      "env": {
        "SLACK_TOKEN": "xoxc-your-token-here",
        "SLACK_COOKIE": "xoxd-your-cookie-here"
      }
    }
  }
}
```

Copy this configuration to your MCP client's configuration file:

- **Claude Desktop**: Add to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows
- **Other MCP Clients**: Refer to your client's documentation for configuration file location

**Important**: The credentials are sensitive and should not be shared or committed to version control.

## MCP Server Authentication

The MCP server tests authentication credentials on startup. If credentials are missing or invalid, it provides a single tool to help guide configuration:

```bash
# Start MCP server
npx -y github:shopify-playground/slack-mcp
```

### Available MCP Tools

When authenticated (credentials valid):
- **slack_search** - Search Slack messages using standard Slack search syntax
- **slack_set_status** - Set your Slack status with optional emoji and expiration
- **slack_get_status** - Get your current Slack status
- **slack_create_reminder** - Create reminders in Slack
- **slack_get_thread_replies** - Retrieve replies to a specific thread
- **slack_my_messages** - Generate activity summaries for a date range
- **slack_get_user_profile** - Get detailed user profile information

When not authenticated (missing or invalid credentials):
- **slack_configure_auth** - Provides instructions for the AI assistant to guide you through configuring Slack authentication

The authentication tool helps the AI assistant guide you through:
1. Obtaining credentials using the `auth-from-app` or `auth-from-curl` commands
2. Configuring your MCP client with the credentials
3. Restarting your MCP client to apply the changes

**Note**: The AI assistant never sees your actual credentials - it only provides guidance on how to configure them.

## Available Commands

- **auth-from-app** - Extract Slack credentials from the desktop app
- **auth-from-curl** - Extract Slack credentials from a curl command
- **test** - Test your authentication with Slack API
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
   git clone https://github.com/shopify-playground/slack-mcp.git
   cd slack-mcp
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
