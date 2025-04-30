import { SlackContext } from './context';
import { Tool } from 'fastmcp';
import { StandardSchemaV1 } from 'zod/lib/standard-schema';

export interface WorkspaceToken {
  token: string;
  name: string;
}

export interface WorkspaceTokens {
  [url: string]: WorkspaceToken;
}

export interface SlackConfig {
  teams: {
    [key: string]: {
      token: string;
      name: string;
      url: string;
      [key: string]: unknown;
    };
  };
}

export interface SlackCookie {
  name: string;
  value: string;
}

export interface SlackAuth {
  tokens: WorkspaceTokens;
  cookie: SlackCookie;
}

// Configuration cache structure
export interface CacheConfig {
  lastWorkspace: string | null;
}

// For filtering auth by workspace
export interface WorkspaceAuthOptions {
  workspace?: string;
  context?: SlackContext;
}

export function tool<Params extends StandardSchemaV1>(
  tool: Tool<Record<string, never>, Params>,
): Tool<Record<string, never>, Params> {
  return tool;
}
