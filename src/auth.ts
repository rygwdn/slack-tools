import { getStoredAuth, clearStoredAuth, storeAuth } from './keychain.js';
import { WebClient } from '@slack/web-api';
import type { WorkspaceTokens, SlackAuth, WorkspaceAuthOptions } from './types.js';
import { getCookie } from './cookies.js';
import { getTokens } from './tokens.js';

/**
 * Filter tokens by workspace URL or name
 */
function filterTokensByWorkspace(auth: SlackAuth, workspace?: string): SlackAuth {
  if (!workspace) return auth;

  const filteredTokens: WorkspaceTokens = {};

  for (const [url, details] of Object.entries(auth.tokens)) {
    // Match by URL or workspace name
    if (url.includes(workspace) || details.name.toLowerCase().includes(workspace.toLowerCase())) {
      filteredTokens[url] = details;
    }
  }

  return {
    ...auth,
    // If no matches found, return all tokens
    tokens: Object.keys(filteredTokens).length > 0 ? filteredTokens : auth.tokens,
  };
}

// Track if auth has been tested during this session
let authTestedThisSession = false;

async function validateAuth(auth: SlackAuth) {
  if (!auth) {
    // No stored auth, need to fetch fresh auth
    throw new Error('Auth test failed: No stored auth');
  }

  // Get the first token to test
  const firstToken = Object.values(auth.tokens)[0]?.token;
  if (!firstToken) {
    throw new Error('Auth test failed: No token found');
  }

  try {
    // Test the token by calling auth.test API
    const client = new WebClient(firstToken);
    const response = await client.auth.test();

    if (!response.ok) {
      throw new Error('Auth test failed: API returned not ok');
    }
  } catch (error) {
    console.error('Auth test API call failed:', error);
    throw new Error('Auth test failed: API call error');
  }
}

/**
 * Get both tokens and cookie from stored auth, filtered by workspace if specified
 * @param options Options for auth retrieval including workspace filter
 * @throws Error if no valid auth is available
 */
export async function getSlackAuth(options: WorkspaceAuthOptions = {}): Promise<SlackAuth> {
  const { workspace } = options;

  const alreadyTestedAuth = authTestedThisSession;
  authTestedThisSession = true;

  const storedAuth = await getStoredAuth();
  if (storedAuth?.cookie && storedAuth?.tokens && !alreadyTestedAuth) {
    try {
      await validateAuth(storedAuth);
      return filterTokensByWorkspace(storedAuth, workspace);
    } catch (error) {
      console.error('Auth error encountered, clearing stored credentials and retrying...', error);
      await clearStoredAuth();
    }
  }

  const newAuth = {
    cookie: await getCookie(),
    tokens: await getTokens(),
  };

  await validateAuth(newAuth);
  await storeAuth(newAuth);

  return filterTokensByWorkspace(newAuth, workspace);
}
