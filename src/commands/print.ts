import { Command } from 'commander';
import { findWorkspaceToken } from '../slack-api';
import { GlobalContext } from '../context';
import { getStoredAuth } from '../keychain.js';
import { getCookie } from '../cookies.js';
import { getTokens } from '../tokens.js';

export function registerPrintCommand(program: Command): void {
  program
    .command('print')
    .description('Print tokens and cookie')
    .option('-q, --quiet', 'Suppress output and only show tokens/cookies')
    .action(async (cmdOptions) => {
      try {
        const storedAuth = await getStoredAuth();
        if (!cmdOptions.quiet && !storedAuth) {
          console.log('No stored auth found, fetching fresh credentials...');
        }

        const auth = storedAuth || {
          cookie: await getCookie(),
          tokens: await getTokens(GlobalContext),
        };

        const { token, cookie, workspaceUrl } = findWorkspaceToken(
          auth,
          GlobalContext.workspace || Object.keys(auth.tokens)[0],
          GlobalContext,
        );

        if (!cmdOptions.quiet) {
          console.log('\nFound token for workspace:\n');
          console.log(`Workspace URL: ${workspaceUrl}`);
          console.log(`Token: ${token}\n`);

          console.log('Found cookie:');
          console.log(`${cookie.name}: ${cookie.value}\n`);
        } else {
          console.log(token);
          console.log(cookie.value);
        }
      } catch (error) {
        // Always log errors to console.error regardless of quiet mode
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
