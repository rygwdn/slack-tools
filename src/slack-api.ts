import { WebClient } from '@slack/web-api';
import { getStoredAuth, validateSlackAuth, validateAuthWithApi, createWebClient } from './auth';
import { saveSlackCache } from './cache.js';
import { GlobalContext } from './context.js';

/**
 * Get a Slack WebClient instance configured with stored tokens
 * This function does NOT auto-fetch tokens from the Slack app
 * It will only use stored tokens or environment variables
 */
export async function getSlackClient(): Promise<WebClient> {
  // Get stored auth from keychain or environment variables
  // TODO: Require handing in auth. Method of fetching depends on the command.
  const auth = await getStoredAuth();

  if (!auth) {
    throw new Error(
      'No authentication credentials found. Please run the auth-from-app or auth-from-curl command first.',
    );
  }

  // Validate format only (no API call yet)
  validateSlackAuth(auth);

  // If we have a current user already validated, we can reuse the client
  if (!GlobalContext.currentUser) {
    // Otherwise, validate auth against API
    await validateAuthWithApi(auth);
  }

  await saveSlackCache();

  return createWebClient(auth.token, auth.cookie);
}

// Re-export for backwards compatibility (will be deprecated)
export { validateAuthWithApi as validateAuth } from './auth';
