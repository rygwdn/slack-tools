import { WebClient, LogLevel } from '@slack/web-api';
import { getStoredAuth, validateSlackAuth } from './auth';
import { SlackAuth } from './types.js';
import { saveSlackCache } from './cache.js';
import { GlobalContext } from './context.js';
import { redactLog } from './utils/log-utils.js';

/**
 * Creates a WebClient with the given token and cookie
 */
export function createWebClient(token: string, cookie: string): WebClient {
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

// TODO: move this logic inside createWebClient
export async function validateAuthWithApi(auth: SlackAuth): Promise<void> {
  try {
    // First validate the format
    validateSlackAuth(auth);

    // Then validate with the API
    const client = createWebClient(auth.token, auth.cookie);
    const response = await client.auth.test();

    if (!response.ok) {
      throw new Error('Auth test failed: API returned not ok');
    }

    GlobalContext.currentUser = response;

    // Set workspace from auth response if not already set
    // TODO: remove GlobalContext.workspace
    if (!GlobalContext.workspace && response.team) {
      GlobalContext.workspace = response.team;
    }
  } catch (error) {
    console.error('Auth test API call failed:', error);
    throw new Error('Auth test failed: API call error');
  }
}

/**
 * Get a Slack WebClient instance configured with stored tokens
 * This function does NOT auto-fetch tokens from the Slack app
 * It will only use stored tokens or environment variables
 */
export async function getSlackClient(): Promise<WebClient> {
  // Get stored auth from keychain or environment variables
  // TODO: Require handing in auth. Method of fetching depends on the command.
  const auth = await getStoredAuth();

  if (!auth) {
    throw new Error(
      'No authentication credentials found. Please run the auth-from-app or auth-from-curl command first.',
    );
  }

  // Validate format only (no API call yet)
  validateSlackAuth(auth);

  // If we have a current user already validated, we can reuse the client
  if (!GlobalContext.currentUser) {
    // Otherwise, validate auth against API
    await validateAuthWithApi(auth);
  }

  await saveSlackCache();

  return createWebClient(auth.token, auth.cookie);
}

// Re-export for backwards compatibility (will be deprecated)
export { validateAuthWithApi as validateAuth } from './auth';
