import { SlackAuth } from '../types.js';

export function displayAuthConfiguration(auth: SlackAuth): void {
  const serverConfig = {
    'slack-mcp': {
      command: 'npx',
      args: ['-y', 'github:shopify-playground/slack-mcp'],
      env: {
        SLACK_TOKEN: auth.token,
        SLACK_COOKIE: auth.cookie,
      },
    },
  };

  console.log('\nAuthentication extracted successfully!');
  console.log('\nAdd this to your MCP client configuration:');
  console.log(JSON.stringify(serverConfig, null, 2));

  // Claude Code command
  console.log('\nOr add to Claude Code:');
  console.log(
    `claude mcp add slack-mcp -e SLACK_TOKEN="${auth.token}" -e SLACK_COOKIE="${auth.cookie}" -- npx -y github:shopify-playground/slack-mcp`,
  );

  // Generate Cursor installation link
  const encodedConfig = Buffer.from(JSON.stringify(serverConfig)).toString('base64');
  const cursorUrl = `cursor://anysphere.cursor-deeplink/mcp/install?name=slack-mcp&config=${encodedConfig}`;
  console.log('\nOr add to Cursor with one click:');
  console.log(cursorUrl);
}