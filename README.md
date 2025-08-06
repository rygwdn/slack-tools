# Slack MCP

An MCP (Model Context Protocol) server that enables AI assistants to interact with Slack using local user tokens extracted from the Slack desktop app or website.

> [!NOTE]
> This is an internal Shopify fork of [rygwdn/slack-tools](https://github.com/rygwdn/slack-tools), originally created by @rygwdn (a Shopifolk). This fork simplifies internal development and usage at Shopify.

## Authentication

Slack MCP requires authentication credentials to be configured in your MCP client. You'll need:

- `SLACK_TOKEN` - Your Slack token (starts with `xoxc-`)
- `SLACK_COOKIE` - Your Slack cookie (starts with `xoxd-`)

### Step 1: Get Your Credentials

1. **Open Slack in Chrome**
   - Go to your Slack workspace in Chrome (e.g., yourworkspace.slack.com)
   - Make sure you're logged in and can see your channels

2. **Open Developer Tools**
   - Press F12 on your keyboard, OR
   - Right-click anywhere on the page and select "Inspect"
   - Developer Tools window will open at the bottom or side of your screen

3. **Go to Network Tab**
   - In the Developer Tools window, click the "Network" tab
   - You should see a mostly empty area with columns like "Name", "Status", "Type", etc.

4. **Perform an Action in Slack**
   - Do any of these actions in Slack:
     - Send a message in any channel
     - Switch to a different channel
     - Click on a user's profile
     - Search for something
   - You should see network requests start appearing in the Network tab

5. **Find a Slack API Request**
   - Look for requests that start with `api.slack.com`, `edgeapi.slack.com`, or `shopify.enterprise.slack.com/api`
   - You might see several - any one will work
   - Examples: `list?_x_app_name=client...`, `info?_x_app_name=client...`

6. **Copy the Request**
   - Right-click on the request
   - Select "Copy as cURL" from the menu
   - This copies a long command to your clipboard

### Step 2: Extract Your Credentials

1. **Open Terminal**
   - Press Cmd + Space, type "Terminal", press Enter

2. **Run the Extraction Command**
   ```bash
   # Pipe from clipboard (macOS)
   pbpaste | npx -y github:shopify-playground/slack-mcp auth
   
   # Or interactive mode - paste curl when prompted
   npx -y github:shopify-playground/slack-mcp auth
   ```

3. **Check the Results**
   
   The command will output:
   - Your MCP configuration in JSON format
   - A ready-to-use Claude Code command
   - A one-click Cursor installation link
   
   > [!NOTE]
   > If this command outputs _nothing_ then see [Troubleshooting](#Troubleshooting)

### Step 3: Add to Your Client

Follow the instructions below for your MCP client of choice. The auth command provides everything you need:

> [!WARNING]
> The credentials are sensitive and should not be shared or committed to version control.

#### Claude Code

The auth command outputs a ready-to-use Claude Code command. Simply copy and run it:

```bash
claude mcp add slack-mcp -e SLACK_TOKEN="xoxc-your-token" -e SLACK_COOKIE="xoxd-your-cookie" -- npx -y github:shopify-playground/slack-mcp
```

Or manually add with the JSON configuration:

```bash
claude mcp add-json --scope local slack-mcp '{
  "command": "npx",
  "args": ["-y", "github:shopify-playground/slack-mcp"],
  "env": {
    "SLACK_TOKEN": "xoxc-your-token-here",
    "SLACK_COOKIE": "xoxd-your-cookie-here"
  }
}'
```

After installation, run `claude` and try `What is my Slack username?`.

#### Cursor

The auth command provides a one-click installation link for Cursor. Simply click the link in the output.

Alternatively, manually add the JSON configuration to `~/.cursor/mcp.json` for global access, or `.cursor/mcp.json` in your project directory for project-specific access.

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

- **auth** - Extract Slack credentials from a curl command (interactive or piped)
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
