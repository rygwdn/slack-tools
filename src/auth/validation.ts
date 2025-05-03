import { SlackAuth } from '../types.js';

/**
 * Validates whether a token and cookie have valid formats
 */
// TODO: move this to the slack-api file and remove this file
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
