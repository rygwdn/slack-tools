import { getTokens } from './tokens';
import { getCookie } from './cookies';
import { getStoredTokens, storeTokens } from './cache';
import type { WorkspaceTokens, SlackAuth, WorkspaceAuthOptions } from './types';

/**
 * Filter tokens by workspace URL or name
 */
function filterTokensByWorkspace(tokens: WorkspaceTokens, workspace?: string): WorkspaceTokens {
  if (!workspace) return tokens;

  const filteredTokens: WorkspaceTokens = {};

  for (const [url, details] of Object.entries(tokens)) {
    // Match by URL or workspace name
    if (url.includes(workspace) || details.name.toLowerCase().includes(workspace.toLowerCase())) {
      filteredTokens[url] = details;
    }
  }

  // If no matches found, return all tokens
  return Object.keys(filteredTokens).length > 0 ? filteredTokens : tokens;
}

/**
 * Get tokens with fallback behavior, filtered by workspace if specified
 * @param options Options for token retrieval including workspace filter
 */
export async function getSlackTokens(options: WorkspaceAuthOptions = {}): Promise<WorkspaceTokens> {
  const { workspace, quiet = false } = options;

  // First check if we have stored tokens
  const storedTokens = await getStoredTokens();
  if (storedTokens) {
    return workspace ? filterTokensByWorkspace(storedTokens, workspace) : storedTokens;
  }

  // If no stored tokens, fetch from Slack
  const tokens = await getTokens(quiet);

  // Store tokens for future use
  await storeTokens(tokens);

  return workspace ? filterTokensByWorkspace(tokens, workspace) : tokens;
}

/**
 * Get both tokens and cookie with fallback behavior, filtered by workspace if specified
 * @param options Options for auth retrieval including workspace filter
 */
export async function getSlackAuth(options: WorkspaceAuthOptions = {}): Promise<SlackAuth> {
  const tokens = await getSlackTokens(options);
  const cookie = await getCookie();

  return { tokens, cookie };
}
