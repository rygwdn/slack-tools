import keytar from 'keytar';
import type { SlackAuth } from '../types.js';

const SERVICE_NAME = 'slack-tools';
const TOKEN_KEY = 'slack-token';
const COOKIE_KEY = 'slack-cookie';

export const envCookie = process.env.SLACK_COOKIE;
export const envToken = process.env.SLACK_TOKEN;

/**
 * Store the auth credentials in the system keychain
 */
export async function storeAuth(_workspace: string, auth: SlackAuth): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, COOKIE_KEY, auth.cookie);
  await keytar.setPassword(SERVICE_NAME, TOKEN_KEY, auth.token);
}

/**
 * Get stored auth credentials from keychain or environment variables
 */
export async function getStoredAuth(_workspace?: string): Promise<SlackAuth | null> {
  try {
    const cookie = envCookie || (await keytar.getPassword(SERVICE_NAME, COOKIE_KEY));
    if (!cookie) {
      return null;
    }

    const token = envToken || (await keytar.getPassword(SERVICE_NAME, TOKEN_KEY));
    if (!token) {
      return null;
    }

    // TODO: validate the token and throw if it's not valid

    return { token, cookie };
  } catch (error) {
    console.error('Failed to read auth from keychain:', error);
    return null;
  }
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
