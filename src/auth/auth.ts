import { SlackAuth } from '../types.js';
import { validateSlackAuth } from '../slack-api.js';

export async function getAuth(): Promise<SlackAuth> {
  const cookie = process.env.SLACK_COOKIE;
  const token = process.env.SLACK_TOKEN;

  if (!cookie || !token) {
    throw new Error(
      'Authentication required. The SLACK_TOKEN and SLACK_COOKIE environment variables are not set.\n\n' +
        'This usually means your MCP client is not configured with Slack credentials.\n\n' +
        'To get credentials and configure your MCP client:\n' +
        '1. Run one of these commands:\n' +
        '   npx -y github:shopify-playground/slack-mcp auth-from-app\n' +
        '   npx -y github:shopify-playground/slack-mcp auth-from-curl\n\n' +
        '2. Copy the JSON output to your MCP client configuration file',
    );
  }

  return validateSlackAuth({ token, cookie });
}

export function hasAuth(): boolean {
  const cookie = process.env.SLACK_COOKIE;
  const token = process.env.SLACK_TOKEN;
  return !!(cookie && token);
}
