import keytar from 'keytar';
import { SlackAuth } from '../types.js';
import { validateSlackAuth } from '../slack-api.js';

const SERVICE_NAME = 'slack-tools';
const TOKEN_KEY = 'slack-token';
const COOKIE_KEY = 'slack-cookie';

export const envCookie = process.env.SLACK_COOKIE;
export const envToken = process.env.SLACK_TOKEN;

/**
 * Store the auth credentials in the system keychain
 */
export async function storeAuth(auth: SlackAuth): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, COOKIE_KEY, auth.cookie);
  await keytar.setPassword(SERVICE_NAME, TOKEN_KEY, auth.token);
}

/**
 * Get stored auth credentials from keychain or environment variables
 */
export async function getStoredAuth(): Promise<SlackAuth> {
  const cookie = envCookie || (await keytar.getPassword(SERVICE_NAME, COOKIE_KEY));
  if (!cookie) {
    throw new Error('No cookie found in keychain');
  }

  const token = envToken || (await keytar.getPassword(SERVICE_NAME, TOKEN_KEY));
  if (!token) {
    throw new Error('No token found in keychain');
  }

  const auth: SlackAuth = { token, cookie };

  // Validate token and cookie formats
  validateSlackAuth(auth);

  return auth;
}

/**
 * Remove all stored credentials from the keychain
 */
export async function clearStoredAuth(): Promise<void> {
  const credentials = await keytar.findCredentials(SERVICE_NAME);
  for (const cred of credentials) {
    await keytar.deletePassword(SERVICE_NAME, cred.account);
  }
}
