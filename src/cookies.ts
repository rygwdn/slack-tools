// This file is kept for backwards compatibility only
// Use the auth module directly instead
import { fetchCookieFromApp } from './auth/cookie-extractor';

// TODO: remove this file
// Re-export for backwards compatibility
export const getCookie = fetchCookieFromApp;
