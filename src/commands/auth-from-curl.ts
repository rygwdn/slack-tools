import { Command } from 'commander';
import { GlobalContext } from '../context';
import { storeAuth, validateSlackAuth } from '../auth';
import { validateAuthWithApi } from '../slack-api';
import { SlackAuth } from '../types.js';

/**
 * Extracts token and cookie from a curl command
 */
function extractAuthFromCurl(curlCommand: string): SlackAuth | null {
  const token = curlCommand.match('Authorization: Bearer (xoxc-[a-zA-Z0-9-]+)')?.[1];
  const cookie = curlCommand.match('Cookie: d=(xoxd-[a-zA-Z0-9-]+)')?.[1];

  return token && cookie ? { token, cookie } : null;
}

export function registerAuthFromCurlCommand(program: Command): void {
  program
    .command('auth-from-curl [curlCommand...]')
    .description('Extract and store Slack authentication from a curl command')
    .option('--store', 'Store the extracted auth')
    .helpOption('-h, --help', 'Display help for command')
    .allowUnknownOption(true) // Allow unknown options to support curl command flags
    .action(async (curlArgs, options) => {
      try {
        const curlCommand = curlArgs.join(' ');
        GlobalContext.log.debug('Parsing curl command:', curlCommand);

        const auth = extractAuthFromCurl(curlCommand);
        if (!auth) {
          program.error('Error: Could not extract auth from the curl command');
        }

        // Validate format
        validateSlackAuth(auth);

        // Validate with API
        await validateAuthWithApi(auth);

        if (options.store) {
          await storeAuth('default', auth);
          console.log('Stored authentication successfully');
        }

        console.log(`Token: ${auth.token}`);
        console.log(`Cookie: ${auth.cookie}`);
      } catch (error) {
        program.error((error as Error).toString());
      }
    });
}
