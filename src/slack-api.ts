import { WebClient, LogLevel } from '@slack/web-api';
import { SlackAuth } from './types.js';
import { GlobalContext } from './context.js';
import { redactLog } from './utils/log-utils.js';
import { getStoredAuth } from './auth/keychain.js';

export async function createWebClient(auth?: SlackAuth): Promise<WebClient> {
  if (!auth) {
    auth = await getStoredAuth();
  }

  validateSlackAuth(auth);

  const webClient = new WebClient(auth.token, {
    headers: {
      Cookie: `d=${auth.cookie}`,
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

  const response = await webClient.auth.test();
  if (!response.ok) {
    throw new Error('Auth test failed: API returned not ok');
  }

  GlobalContext.currentUser = response;

  return webClient;
}

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
