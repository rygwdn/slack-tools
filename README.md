# Slack MCP

An MCP (Model Context Protocol) server that enables AI assistants to interact with Slack using local user tokens extracted from the Slack desktop app or website.

> [!NOTE]
> This is an internal Shopify fork of [rygwdn/slack-tools](https://github.com/rygwdn/slack-tools), originally created by @rygwdn (a Shopifolk). This fork simplifies internal development and usage at Shopify.

## Authentication

Slack MCP requires authentication credentials to be configured in your MCP client. You'll need:

- `SLACK_TOKEN` - Your Slack token (starts with `xoxc-`)
- `SLACK_COOKIE` - Your Slack cookie (starts with `xoxd-`)

### Getting Your Credentials

> [!NOTE]
> These commands should _ALWAYS_ output something, if there is no output then see the [Troubleshooting](#Troubleshooting) section.

There are two ways to get your Slack credentials:

1. **Extract from Slack desktop app:**

   ```bash
   npx -y github:shopify-playground/slack-mcp auth-from-app
   ```

   This will extract your Slack token and cookie directly from the Slack desktop app's local storage. **The Slack app must be closed while running this command.**

2. **Extract from the Slack website:**
   1. Open Slack in Chrome
   2. Open Developer Tools and go to the Network tab
   3. Perform any action (e.g., send a message or switch channels)
   4. Find a request to api.slack.com, right-click and select "Copy as cURL"
   5. Run this command in a terminal to parse the curl command from the clipboard: `pbpaste | npx -y github:shopify-playground/slack-mcp auth-from-curl`

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

> [!WARNING]
> The credentials are sensitive and should not be shared or committed to version control.

Copy this configuration to your MCP client.

#### Claude Code

Run `claude mcp add-json --scope local slack '<json config here>'` (replace `<json config here>` with the slack-mcp JSON output from the auth command).

```bash
claude mcp add-json --scope local slack '{
  "command": "npx",
  "args": ["-y", "github:shopify-playground/slack-mcp"],
  "env": {
    "SLACK_TOKEN": "xoxc-your-token-here",
    "SLACK_COOKIE": "xoxd-your-cookie-here"
  }'
```

This should output `Added stdio MCP server slack to local config`.

Run `claude` and try `What is my Slack username?`.

#### Cursor

Create/add the JSON configuration to `~/.cursor/mcp.json` for global access, or `.cursor/mcp.json` in your project directory for project-specific access.

The Composer Agent automatically uses MCP tools listed under Available Tools when relevant. Try `What is my Slack username?` and choose `Run Tool` when offered to execute `slack_search`.

#### Other MCP Clients

Refer to your client's documentation for configuration

### Available MCP Tools

- **slack_search** - Search Slack messages using standard Slack search syntax
- **slack_set_status** - Set your Slack status with optional emoji and expiration
- **slack_get_status** - Get your current Slack status
- **slack_create_reminder** - Create reminders in Slack
- **slack_get_thread_replies** - Retrieve replies to a specific thread
- **slack_my_messages** - Generate activity summaries for a date range
- **slack_get_user_profile** - Get detailed user profile information

## Troubleshooting

### Troubleshooting: No Output from Auth Commands

If the auth commands don't produce any output, there may be an access issue. Test your access with:

```bash
# Check repository access (exit code 128 means access denied)
bash -c 'npx -y github:shopify-playground/slack-mcp --version >/dev/null || echo $?'
```

**If you see "128":** This indicates one of two issues:
- You don't have access to the github org
- Your GitHub token doesn't have the necessary permissions

Follow the [GitHub access instructions on Vault](https://vault.shopify.io/page/GitHub-Organizations---Access~idk.md) to resolve both issues.

## Available Commands

- **auth-from-app** - Extract Slack credentials from the desktop app
- **auth-from-curl** - Extract Slack credentials from a curl command
- **test** - Test your authentication with Slack API
- **mcp** - Start a Model Context Protocol server for AI assistants with Slack tools

### Building and Testing

```bash
# Run all checks in parallel (lint, format check, typecheck, test) and build
pnpm run check

# Or run individual tasks:
pnpm run lint       # Check code style and potential errors
pnpm run format     # Format code using Prettier
pnpm run typecheck  # Check TypeScript types
pnpm run test       # Run tests
pnpm run build      # Build the project
```
