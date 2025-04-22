import { WebClient, LogLevel } from '@slack/web-api';
import { getSlackAuth } from './auth';
import { CommandContext } from './context';

/**
 * Find a workspace token either by exact URL match or name
 */
export async function getWorkspaceToken(
  workspaceName: string,
  context: CommandContext,
): Promise<{
  token: string;
  workspaceUrl: string;
  cookie: { name: string; value: string };
}> {
  const auth = await getSlackAuth({ context });

  context.debugLog('Available workspaces:', Object.keys(auth.tokens).join(', '));
  context.debugLog('Looking for workspace:', workspaceName);

  // First try exact match with URL
  if (auth.tokens[workspaceName]) {
    const token = auth.tokens[workspaceName].token;
    context.debugLog(`Found token for workspace URL: ${workspaceName}`);
    context.debugLog(`Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
    return {
      token,
      workspaceUrl: workspaceName,
      cookie: auth.cookie,
    };
  }

  // Try to find by name (case insensitive)
  const wsEntry = Object.entries(auth.tokens).find(
    ([, details]) => details.name.toLowerCase() === workspaceName.toLowerCase(),
  );

  if (wsEntry) {
    const token = wsEntry[1].token;
    context.debugLog(`Found token for workspace name: ${wsEntry[1].name}`);
    context.debugLog(`Workspace URL: ${wsEntry[0]}`);
    context.debugLog(`Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
    return {
      token,
      workspaceUrl: wsEntry[0],
      cookie: auth.cookie,
    };
  }

  context.debugLog('All available workspaces:');
  Object.entries(auth.tokens).forEach(([url, details]) => {
    context.debugLog(`- ${details.name} (${url})`);
  });

  throw new Error(
    `Could not find workspace "${workspaceName}". Use 'slack-tools print' to see available workspaces.`,
  );
}

/**
 * Get a Slack WebClient instance configured with the appropriate token and cookies for a workspace
 * Use this function to get a client that can be used to make any Slack API call
 */
export async function getSlackClient(
  workspace: string,
  context: CommandContext,
): Promise<WebClient> {
  const { token, cookie, workspaceUrl } = await getWorkspaceToken(workspace, context);

  context.debugLog(`Using workspace: ${workspaceUrl}`);

  // Validate token has the correct prefix
  if (!token.startsWith('xoxc-')) {
    throw new Error(`Invalid token format: token should start with 'xoxc-'. Got: ${token}`);
  }

  // Create and return a web client with the token and cookie
  return new WebClient(token, {
    headers: {
      Cookie: `d=${cookie.value}`,
    },
    logLevel: context.debug ? LogLevel.DEBUG : LogLevel.ERROR,
  });
}
