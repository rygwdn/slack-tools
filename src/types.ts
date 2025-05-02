import { Tool } from 'fastmcp';
import { ZodObject, ZodRawShape } from 'zod';

export interface SlackAuth {
  token: string;
  cookie: string;
}

export function tool<
  Params extends ZodRawShape,
  TTool extends Required<Tool<Record<string, never> | undefined, ZodObject<Params>>>,
>(tool: TTool): TTool {
  return tool;
}
