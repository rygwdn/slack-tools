import { Command } from 'commander';
import { storeAuth } from '../auth/keychain';
import { fetchTokenFromApp } from '../auth/token-extractor';
import { fetchCookieFromApp } from '../auth/cookie-extractor';
import { createWebClient } from '../slack-api';
import { GlobalContext } from '../context';
import { SlackAuth } from '../types';

export function registerAuthFromAppCommand(program: Command): void {
  program
    .command('auth-from-app')
    .description('Extract and store Slack authentication directly from the Slack app')
    .option('-w, --workspace <workspace>', 'Specify Slack workspace name to extract token for')
    .option('--store', 'Store the extracted auth in the system keychain for future use')
    .helpOption('-h, --help', 'Display help for command')
    .addHelpText(
      'after',
      `
Notes:
  - The Slack desktop app must be CLOSED while running this command
  - If you're logged into multiple workspaces, use the --workspace option
  - Use --store to save credentials in your system keychain
  - Once stored, credentials will be automatically used for future commands
  - The command will output the extracted token and cookie values for verification
`,
    )
    .action(async (options) => {
      try {
        const workspace = options.workspace;
        GlobalContext.log.debug(
          'Extracting auth from Slack app' + (workspace ? ` for workspace: ${workspace}` : ''),
        );

        GlobalContext.log.info(`Fetching credentials for workspace: ${options.workspace}`);
        const token = await fetchTokenFromApp(options.workspace);
        const cookie = await fetchCookieFromApp();
        const auth: SlackAuth = { token, cookie };
        await createWebClient(auth);

        if (options.store) {
          await storeAuth(auth);
          GlobalContext.log.info('Credentials stored successfully.');
        }

        console.log(`Token: ${auth.token}`);
        console.log(`Cookie: ${auth.cookie}`);
      } catch (error) {
        program.error((error as Error).message);
      }
    });
}
