import { Command } from 'commander';
import { GlobalContext } from '../context';

export class AuthError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export function handleCommandError(error: unknown, program: Command): never {
  GlobalContext.log.debug('Encountered error:', error);

  if (error instanceof AuthError) {
    program.error(getAuthErrorMessage(error));
  } else if (error instanceof Error) {
    program.error(error.message);
  } else {
    program.error(`An unknown error occurred: ${error}`);
  }
}

export function getAuthErrorMessage(error: AuthError): string {
  return `
Authentication failed:

${error.message}

Your MCP client needs to be configured with Slack credentials.

1. Extract credentials using one of these commands:

   a) From Slack Desktop App (more reliable):
      npx -y github:shopify-playground/slack-mcp auth-from-app

   b) From Browser Network Request:
      npx -y github:shopify-playground/slack-mcp auth-from-curl

2. Copy the JSON output to your MCP client's configuration file

See 'npx -y github:shopify-playground/slack-mcp auth-from-app --help' or 
'npx -y github:shopify-playground/slack-mcp auth-from-curl --help' for details.
`.trim();
}
