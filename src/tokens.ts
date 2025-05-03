// TODO: remove this file
// This file is kept for backwards compatibility only
// Use the auth module directly instead
import { fetchTokenFromApp } from './auth/token-extractor';

// Re-export for backwards compatibility
export const getToken = fetchTokenFromApp;
