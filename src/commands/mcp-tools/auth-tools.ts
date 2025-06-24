import { z } from 'zod';
import { tool } from '../../types';

const configureAuthSchema = z.object({});

export const configureAuthTool = tool({
  name: 'slack_configure_auth',
  description:
    'Get instructions for configuring Slack authentication. Use this tool when Slack operations fail due to missing or invalid credentials.',
  parameters: configureAuthSchema,
  timeoutMs: 5000,
  annotations: {
    readOnlyHint: true,
  },
  execute: async () => {
    const instructions = `# Slack MCP Server - Authentication Required

The Slack MCP server is already configured in your MCP client (that's how you're seeing this message), but it needs valid authentication credentials to access Slack APIs.

## Step 1: Obtain Slack Credentials

The user needs to get their Slack authentication credentials. They have two options:

### Option A: Extract from Slack Desktop App (Recommended)
Ask the user to:
1. Close the Slack desktop app completely
2. Run this command in their terminal:
   \`\`\`bash
   npx -y github:shopify-playground/slack-mcp auth-from-app
   \`\`\`
3. Copy the JSON output that includes the env section with credentials

### Option B: Extract from Browser
Ask the user to:
1. Open Slack in Chrome or Firefox
2. Open Developer Tools (F12) and go to the Network tab
3. Perform any action in Slack (e.g., send a message)
4. Find a request to api.slack.com, right-click and select "Copy as cURL"
5. Copy the curl command to clipboard, then run:
   \`\`\`bash
   pbcopy | npx -y github:shopify-playground/slack-mcp auth-from-curl
   \`\`\`
   (On Windows, use: \`Get-Clipboard | npx -y github:shopify-playground/slack-mcp auth-from-curl\`)
6. Copy the JSON output that includes the env section with credentials

## Step 2: Update MCP Configuration

The user needs to update their existing slack-mcp configuration with the credentials:

1. Open their MCP client configuration file
2. Find the existing slack-mcp server configuration
3. Add or update the "env" section from the JSON output in Step 1
4. The env section should contain:
   - SLACK_TOKEN: starts with "xoxc-"
   - SLACK_COOKIE: starts with "xoxd-"

## Step 3: Restart MCP Client

Ask the user to restart their MCP client to load the updated configuration.

## Important Notes

- The credentials are sensitive and should not be shared
- If authentication fails after setup, the credentials may have expired and need to be refreshed using the same process

Once configured correctly, all Slack tools will become available.`;

    return instructions;
  },
});

export const authTools = [configureAuthTool];
