import { WebClient, LogLevel } from '@slack/web-api';
import { SlackAuth } from './types.js';
import { GlobalContext } from './context.js';
import { redactLog } from './utils/log-utils.js';
import { getAuth } from './auth/keychain.js';
import { AuthError } from './utils/auth-error.js';

export async function createWebClient(auth?: SlackAuth): Promise<WebClient> {
  if (!auth) {
    auth = await getAuth();
  }

  const validAuth = validateSlackAuth(auth);

  const webClient = new WebClient(validAuth.token, {
    logger: getLogger(),
    headers: {
      Cookie: `d=${validAuth.cookie}`,
    },
  });

  try {
    const response = await webClient.auth.test();
    if (!response.ok) {
      throw new AuthError(`Slack API rejected the credentials: ${response.error}`);
    }

    GlobalContext.currentUser = response;
    return webClient;
  } catch (error) {
    throw new AuthError((error as Error).message);
  }
}

export function validateSlackAuth(auth: {
  token?: string | null;
  cookie?: string | null;
}): SlackAuth {
  const errors: string[] = [];
  if (!auth?.token && !auth?.cookie) {
    throw new AuthError('No authentication credentials found');
  }

  if (!auth?.token) {
    errors.push('token is required');
  }

  if (!auth?.cookie) {
    errors.push('cookie is required');
  }

  if (auth.token && !auth.token.startsWith('xoxc-')) {
    errors.push('invalid token format');
  }

  // If cookie exists, check format
  if (auth.cookie && !auth.cookie.startsWith('xoxd-')) {
    errors.push('invalid cookie format');
  }

  if (errors.length > 0) {
    throw new AuthError(`Authentication validation failed: ${errors.join(', ')}`);
  }

  return { token: auth.token!, cookie: auth.cookie! } as SlackAuth;
}

function getLogger() {
  return {
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
  } satisfies WebClient['logger'];
}
