import { WebClient, LogLevel } from '@slack/web-api';
import { getStoredAuth, clearStoredAuth, storeAuth } from './keychain.js';
import type { SlackAuth, SlackCookie } from './types.js';
import { getCookie } from './cookies.js';
import { getTokens } from './tokens.js';
import { GlobalContext, SlackContext } from './context';

// Track if auth has been tested during this session
// Exposed for testing purposes
export let authTestedThisSession = false;

/**
 * Reset the auth tested flag (for testing purposes)
 */
export function resetAuthTestedFlag(value = false): void {
  authTestedThisSession = value;
}

/**
 * Creates a WebClient instance with the provided configuration
 */
function createWebClient(token: string, cookie: SlackCookie, context?: SlackContext): WebClient {
  return new WebClient(token, {
    headers: {
      Cookie: `d=${cookie.value}`,
    },
    logLevel: context?.debug ? LogLevel.DEBUG : LogLevel.ERROR,
  });
}

/**
 * Validates the auth by testing a token
 */
async function validateAuth(auth: SlackAuth, context: SlackContext) {
  // Get the first token to test
  const firstToken = Object.values(auth.tokens)[0]?.token;
  if (!firstToken) {
    throw new Error('Auth test failed: No token found');
  }

  try {
    // Test the token by calling auth.test API
    const client = createWebClient(firstToken, auth.cookie, context);
    const response = await client.auth.test();

    if (!response.ok) {
      throw new Error('Auth test failed: API returned not ok');
    }
  } catch (error) {
    console.error('Auth test API call failed:', error);
    throw new Error('Auth test failed: API call error');
  }
}

/**
 * Get fresh auth by fetching new tokens and cookie
 */
async function getFreshAuth(context: SlackContext): Promise<SlackAuth> {
  const newAuth = {
    cookie: await getCookie(),
    tokens: await getTokens(context),
  };

  await validateAuth(newAuth, context);
  await storeAuth(newAuth);

  return newAuth;
}

/**
 * Validate stored auth and refresh if necessary
 * @returns The validated SlackAuth object
 */
async function validateAndRefreshAuth(context: SlackContext): Promise<SlackAuth> {
  const storedAuth = await getStoredAuth();

  if (storedAuth?.cookie && storedAuth?.tokens) {
    try {
      await validateAuth(storedAuth, context);
      // Mark auth as tested
      authTestedThisSession = true;
      return storedAuth;
    } catch (error) {
      console.error('Auth error encountered, clearing stored credentials and retrying...', error);
      await clearStoredAuth();
      const newAuth = await getFreshAuth(context);
      // Mark auth as tested
      authTestedThisSession = true;
      return newAuth;
    }
  } else {
    const newAuth = await getFreshAuth(context);
    // Mark auth as tested
    authTestedThisSession = true;
    return newAuth;
  }
}

/**
 * Find a workspace token either by exact URL match or name from a provided SlackAuth
 */
export function findWorkspaceToken(
  auth: SlackAuth,
  workspaceName: string,
  context: typeof GlobalContext,
): {
  token: string;
  workspaceUrl: string;
  cookie: SlackCookie;
} {
  if (!auth.cookie) {
    throw new Error('No cookie found in auth');
  }

  context.log.debug('Available workspaces:', Object.keys(auth.tokens).join(', '));
  context.log.debug('Looking for workspace:', workspaceName);

  // First try exact match with URL
  if (auth.tokens[workspaceName]) {
    const token = auth.tokens[workspaceName].token;
    context.log.debug(`Found token for workspace URL: ${workspaceName}`);
    context.log.debug(`Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
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
    context.log.debug(`Found token for workspace name: ${wsEntry[1].name}`);
    context.log.debug(`Workspace URL: ${wsEntry[0]}`);
    context.log.debug(`Token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
    return {
      token,
      workspaceUrl: wsEntry[0],
      cookie: auth.cookie,
    };
  }

  context.log.debug('All available workspaces:');
  Object.entries(auth.tokens).forEach(([url, details]) => {
    context.log.debug(`- ${details.name} (${url})`);
  });

  throw new Error(
    `Could not find workspace "${workspaceName}". Use 'slack-tools print' to see available workspaces.`,
  );
}

/**
 * Get a Slack WebClient instance configured with the appropriate token and cookies for a workspace
 * Use this function to get a client that can be used to make any Slack API call
 */
export async function getSlackClient(context: SlackContext = GlobalContext): Promise<WebClient> {
  // Get auth - validate on first call or use stored auth for subsequent calls
  const auth = !authTestedThisSession
    ? await validateAndRefreshAuth(context)
    : (await getStoredAuth()) || (await getFreshAuth(context));

  if (!context.workspace) {
    console.error('Error: No workspace specified. Please specify a workspace using:');
    console.error('  - Use -w, --workspace <workspace> to specify a workspace directly');
    console.error('  - Use -l, --last-workspace to use your most recently used workspace');
    process.exit(1);
  }

  // Find the workspace token using the auth
  const { token, cookie, workspaceUrl } = findWorkspaceToken(auth, context.workspace, context);

  context.log.debug(`Using workspace: ${workspaceUrl}`);

  // Validate token has the correct prefix
  if (!token.startsWith('xoxc-')) {
    throw new Error(`Invalid token format: token should start with 'xoxc-'. Got: ${token}`);
  }

  // Create and return a web client with the token and cookie
  return createWebClient(token, cookie, context);
}
