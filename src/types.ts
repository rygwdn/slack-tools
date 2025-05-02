import { Tool } from 'fastmcp';
import { ZodObject, ZodRawShape } from 'zod';

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

export interface WorkspaceAuthOptions {
  workspace?: string;
}

export function tool<
  Params extends ZodRawShape,
  TTool extends Required<Tool<Record<string, never> | undefined, ZodObject<Params>>>,
>(tool: TTool): TTool {
  return tool;
}
