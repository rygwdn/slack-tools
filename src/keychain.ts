import keytar from 'keytar';
import type { WorkspaceTokens, WorkspaceToken } from './types';

const SERVICE_NAME = 'slack-tools';

export async function storeTokens(tokens: WorkspaceTokens): Promise<void> {
  for (const [url, details] of Object.entries(tokens)) {
    await keytar.setPassword(SERVICE_NAME, url, JSON.stringify(details));
  }
}

export async function getStoredTokens(): Promise<WorkspaceTokens | null> {
  try {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    if (credentials.length === 0) {
      return null;
    }

    const tokens: WorkspaceTokens = {};
    for (const cred of credentials) {
      const details = JSON.parse(cred.password) as WorkspaceToken;
      tokens[cred.account] = details;
    }

    return tokens;
  } catch (error) {
    console.error('Failed to read tokens from keychain:', error);
    return null;
  }
}

export async function clearStoredTokens(): Promise<void> {
  const credentials = await keytar.findCredentials(SERVICE_NAME);
  for (const cred of credentials) {
    await keytar.deletePassword(SERVICE_NAME, cred.account);
  }
}
