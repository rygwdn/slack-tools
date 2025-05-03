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

Please configure authentication using one of these methods:

1. Environment Variables:
   Set the SLACK_TOKEN and SLACK_COOKIE environment variables:

   export SLACK_TOKEN=xoxc-your-token
   export SLACK_COOKIE=xoxd-your-cookie

2. System Keychain:
   Store credentials securely using one of these commands:

   a) From Slack Desktop App (more reliable):
      slack-tools-mcp auth-from-app --store

   b) From Browser Network Request:
      slack-tools-mcp auth-from-curl --store

   See 'slack-tools-mcp auth-from-app --help' or 'slack-tools-mcp auth-from-curl --help' for details.
`.trim();
}
