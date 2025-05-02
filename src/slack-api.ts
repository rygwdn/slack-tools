import { WebClient, LogLevel } from '@slack/web-api';
import { getStoredAuth, clearStoredAuth, storeAuth, envCookie, envToken } from './keychain.js';
import type { SlackAuth } from './types.js';
import { getCookie } from './cookies.js';
import { getToken } from './tokens.js';
import { GlobalContext } from './context.js';
import { redactLog } from './utils/log-utils.js';
import { saveSlackCache } from './cache.js';

function createWebClient(token: string, cookie: string): WebClient {
  return new WebClient(token, {
    headers: {
      Cookie: `d=${cookie}`,
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
  try {
    const client = createWebClient(auth.token, auth.cookie);
    const response = await client.auth.test();

    if (!response.ok) {
      throw new Error('Auth test failed: API returned not ok');
    }

    GlobalContext.currentUser = response;
  } catch (error) {
    console.error('Auth test API call failed:', error);
    throw new Error('Auth test failed: API call error');
  }
}

async function getFreshAuth(): Promise<SlackAuth> {
  const newAuth = {
    cookie: envCookie || (await getCookie()),
    token: envToken || (await getToken(GlobalContext.workspace)),
  };

  await validateAuth(newAuth);
  await storeAuth(GlobalContext.workspace, newAuth);

  return newAuth;
}

async function validateAndRefreshAuth(): Promise<SlackAuth> {
  const storedAuth = await getStoredAuth(GlobalContext.workspace);

  if (storedAuth?.cookie && storedAuth?.token) {
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

/**
 * Get a Slack WebClient instance configured with the appropriate token and cookies for a workspace
 * Use this function to get a client that can be used to make any Slack API call
 */
export async function getSlackClient(): Promise<WebClient> {
  const auth = !GlobalContext.currentUser
    ? await validateAndRefreshAuth()
    : (await getStoredAuth(GlobalContext.workspace)) || (await getFreshAuth());

  if (!GlobalContext.workspace) {
    console.error('Error: No workspace specified. Please specify a workspace using:');
    console.error('  - Use -w, --workspace <workspace> to specify a workspace directly');
    process.exit(1);
  }

  await saveSlackCache();

  if (!auth.token.startsWith('xoxc-')) {
    throw new Error(`Invalid token format: token should start with 'xoxc-'. Got: ${auth.token}`);
  }

  if (!auth.cookie.startsWith('xoxd-')) {
    throw new Error(`Invalid cookie format: cookie should start with 'xoxd-'. Got: ${auth.cookie}`);
  }

  return createWebClient(auth.token, auth.cookie);
}
