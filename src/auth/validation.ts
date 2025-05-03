import { SlackAuth } from '../types.js';
import { WebClient, LogLevel } from '@slack/web-api';
import { GlobalContext } from '../context.js';
import { redactLog } from '../utils/log-utils.js';

/**
 * Validates whether a token and cookie have valid formats
 */
export function validateSlackAuth(auth: SlackAuth): void {
  if (!auth.token) {
    throw new Error('Auth validation failed: token is required');
  }

  if (!auth.cookie) {
    throw new Error('Auth validation failed: cookie is required');
  }

  if (!auth.token.startsWith('xoxc-')) {
    throw new Error(`Invalid token format: token should start with 'xoxc-'. Got: ${auth.token}`);
  }

  if (!auth.cookie.startsWith('xoxd-')) {
    throw new Error(`Invalid cookie format: cookie should start with 'xoxd-'. Got: ${auth.cookie}`);
  }
}

/**
 * Creates a WebClient with the given token and cookie
 */
// TODO: this should be in the slack-api file
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

/**
 * Validates auth against Slack API and updates GlobalContext
 */
// TODO: this should be in the slack-api file
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
    if (!GlobalContext.workspace && response.team) {
      GlobalContext.workspace = response.team;
    }
  } catch (error) {
    console.error('Auth test API call failed:', error);
    throw new Error('Auth test failed: API call error');
  }
}
