import keytar from 'keytar';
import type { SlackAuth } from './types.js';

const SERVICE_NAME = 'slack-tools';
const COOKIE_KEY = 'slack-cookie-1';

export async function storeAuth(workspace: string, auth: SlackAuth): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, COOKIE_KEY, auth.cookie);
  await keytar.setPassword(SERVICE_NAME, workspace, auth.token);
}

export const envCookie = process.env.SLACK_COOKIE;
export const envToken = process.env.SLACK_TOKEN;

export async function getStoredAuth(workspace: string): Promise<SlackAuth | null> {
  try {
    const cookie = envCookie || (await keytar.getPassword(SERVICE_NAME, COOKIE_KEY));
    if (!cookie) {
      return null;
    }

    const token = envToken || (await keytar.getPassword(SERVICE_NAME, workspace));
    if (!token) {
      return null;
    }
    return { token, cookie };
  } catch (error) {
    console.error('Failed to read auth from keychain:', error);
    return null;
  }
}

export async function clearStoredAuth(): Promise<void> {
  const credentials = await keytar.findCredentials(SERVICE_NAME);
  for (const cred of credentials) {
    await keytar.deletePassword(SERVICE_NAME, cred.account);
  }
}
