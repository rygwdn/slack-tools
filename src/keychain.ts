import keytar from 'keytar';
import type { WorkspaceTokens, WorkspaceToken, SlackCookie, SlackAuth } from './types.js';

const SERVICE_NAME = 'slack-tools';
const COOKIE_KEY = 'slack-cookie';

export async function storeAuth(auth: SlackAuth): Promise<void> {
  // Store tokens
  for (const [url, details] of Object.entries(auth.tokens)) {
    await keytar.setPassword(SERVICE_NAME, url, JSON.stringify(details));
  }

  // Store cookie
  if (auth.cookie) {
    await keytar.setPassword(SERVICE_NAME, COOKIE_KEY, JSON.stringify(auth.cookie));
  }
}

export async function getStoredAuth(): Promise<SlackAuth | null> {
  try {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    if (credentials.length === 0) {
      return null;
    }

    const tokens: WorkspaceTokens = {};
    let cookie: SlackCookie | null = null;

    for (const cred of credentials) {
      if (cred.account === COOKIE_KEY) {
        try {
          cookie = JSON.parse(cred.password) as SlackCookie;
        } catch (error) {
          console.error('Failed to parse cookie from keychain:', error);
        }
      } else {
        try {
          const details = JSON.parse(cred.password) as WorkspaceToken;
          tokens[cred.account] = details;
        } catch (error) {
          console.error(`Failed to parse token for ${cred.account}:`, error);
        }
      }
    }

    // If no tokens were found, return null
    if (Object.keys(tokens).length === 0) {
      return null;
    }

    if (!cookie) {
      return null;
    }

    return { tokens, cookie };
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
