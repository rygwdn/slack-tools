import { SlackAuth } from '../types.js';
import { getStoredAuth, storeAuth, clearStoredAuth } from './keychain.js';
import { validateSlackAuth, validateAuthWithApi, createWebClient } from './validation.js';
import { fetchTokenFromApp } from './token-extractor.js';
import { fetchCookieFromApp } from './cookie-extractor.js';

export {
  SlackAuth,
  getStoredAuth,
  storeAuth,
  clearStoredAuth,
  validateSlackAuth,
  validateAuthWithApi,
  createWebClient,
  fetchTokenFromApp,
  fetchCookieFromApp,
};
// TODO: remove this barrel file

// TODO: should be part of the auth from app command
// Function used only by auth-from-app command to fetch fresh auth
export async function fetchAuthFromApp(workspace?: string): Promise<SlackAuth> {
  const cookie = await fetchCookieFromApp();
  const token = await fetchTokenFromApp(workspace);

  const auth: SlackAuth = { token, cookie };
  validateSlackAuth(auth);

  return auth;
}
