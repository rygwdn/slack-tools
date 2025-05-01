import { WebClient, LogLevel } from '@slack/web-api';
import { getStoredAuth, clearStoredAuth, storeAuth } from './keychain.js';
import type { SlackAuth, SlackCookie } from './types.js';
import { getCookie } from './cookies.js';
import { getTokens } from './tokens.js';
import { GlobalContext } from './context.js';
import { setLastWorkspace } from './cache.js';
import { redactLog } from './utils/log-utils.js';

function createWebClient(token: string, cookie: SlackCookie): WebClient {
  return new WebClient(token, {
    headers: {
      Cookie: `d=${cookie.value}`,
    },
    logger: {
      debug: (message: string, ...args: unknown[]) =>
        GlobalContext.log.debug(...redactLog(message, ...args)),
      info: (message: string, ...args: unknown[]) =>
        GlobalContext.log.info(...redactLog(message, ...args)),
      warn: (message: string, ...args: unknown[]) =>
        GlobalContext.log.warn(...redactLog(message, ...args)),
      error: (message: string, ...args: unknown[]) =>
        GlobalContext.log.error(...redactLog(message, ...args)),
      setLevel: () => {},
      getLevel: () => (GlobalContext.debug ? LogLevel.DEBUG : LogLevel.ERROR),
      setName: () => {},
    },
  });
}

async function validateAuth(auth: SlackAuth) {
  // Get the first token to test
  const firstToken = Object.values(auth.tokens)[0]?.token;
  if (!firstToken) {
    throw new Error('Auth test failed: No token found');
  }

  try {
    const client = createWebClient(firstToken, auth.cookie);
    const response = await client.auth.test();

    if (!response.ok) {
      throw new Error('Auth test failed: API returned not ok');
    }

    GlobalContext.currentUser = response;
    setLastWorkspace(GlobalContext.workspace);
  } catch (error) {
    console.error('Auth test API call failed:', error);
    throw new Error('Auth test failed: API call error');
  }
}

async function getFreshAuth(): Promise<SlackAuth> {
  const newAuth = {
    cookie: await getCookie(),
    tokens: await getTokens(),
  };

  await validateAuth(newAuth);
  await storeAuth(newAuth);

  return newAuth;
}

async function validateAndRefreshAuth(): Promise<SlackAuth> {
  const storedAuth = await getStoredAuth();

  if (storedAuth?.cookie && storedAuth?.tokens) {
    try {
      await validateAuth(storedAuth);
      return storedAuth;
    } catch (error) {
      console.error('Auth error encountered, clearing stored credentials and retrying...', error);
      await clearStoredAuth();
      const newAuth = await getFreshAuth();
      return newAuth;
    }
  } else {
    const newAuth = await getFreshAuth();
    return newAuth;
  }
}

export function findWorkspaceToken(
  auth: SlackAuth,
  workspaceName: string,
): {
  token: string;
  workspaceUrl: string;
  cookie: SlackCookie;
} {
  if (!auth.cookie) {
    throw new Error('No cookie found in auth');
  }

  GlobalContext.log.debug('Available workspaces:', Object.keys(auth.tokens).join(', '));
  GlobalContext.log.debug('Looking for workspace:', workspaceName);

  // First try exact match with URL
  if (auth.tokens[workspaceName]) {
    const token = auth.tokens[workspaceName].token;
    GlobalContext.log.debug(`Found token for workspace URL: ${workspaceName}`);
    GlobalContext.log.debug(
      `Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`,
    );
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
    GlobalContext.log.debug(`Found token for workspace name: ${wsEntry[1].name}`);
    GlobalContext.log.debug(`Workspace URL: ${wsEntry[0]}`);
    GlobalContext.log.debug(
      `Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`,
    );
    return {
      token,
      workspaceUrl: wsEntry[0],
      cookie: auth.cookie,
    };
  }

  GlobalContext.log.debug('All available workspaces:');
  Object.entries(auth.tokens).forEach(([url, details]) => {
    GlobalContext.log.debug(`- ${details.name} (${url})`);
  });

  throw new Error(
    `Could not find workspace "${workspaceName}". Use 'slack-tools print' to see available workspaces.`,
  );
}

/**
 * Get a Slack WebClient instance configured with the appropriate token and cookies for a workspace
 * Use this function to get a client that can be used to make any Slack API call
 */
export async function getSlackClient(): Promise<WebClient> {
  // Get auth - validate on first call or use stored auth for subsequent calls
  const auth = !GlobalContext.currentUser
    ? await validateAndRefreshAuth()
    : (await getStoredAuth()) || (await getFreshAuth());

  if (!GlobalContext.workspace) {
    console.error('Error: No workspace specified. Please specify a workspace using:');
    console.error('  - Use -w, --workspace <workspace> to specify a workspace directly');
    console.error('  - Use -l, --last-workspace to use your most recently used workspace');
    process.exit(1);
  }

  // Find the workspace token using the auth
  const { token, cookie, workspaceUrl } = findWorkspaceToken(auth, GlobalContext.workspace);

  GlobalContext.log.debug(`Using workspace: ${workspaceUrl}`);

  // Validate token has the correct prefix
  if (!token.startsWith('xoxc-')) {
    throw new Error(`Invalid token format: token should start with 'xoxc-'. Got: ${token}`);
  }

  // Create and return a web client with the token and cookie
  return createWebClient(token, cookie);
}
