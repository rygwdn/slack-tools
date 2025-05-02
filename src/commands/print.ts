import { Command } from 'commander';
import { GlobalContext } from '../context';
import { getStoredAuth } from '../keychain.js';
import { getCookie } from '../cookies.js';
import { getToken } from '../tokens.js';

export function registerPrintCommand(program: Command): void {
  program
    .command('print')
    .description('Print tokens and cookie')
    .option('-q, --quiet', 'Suppress output and only show tokens/cookies')
    .action(async (cmdOptions) => {
      try {
        const storedAuth = await getStoredAuth(GlobalContext.workspace);
        if (!cmdOptions.quiet && !storedAuth) {
          console.log('No stored auth found, fetching fresh credentials...');
        }

        const auth = storedAuth || {
          cookie: await getCookie(),
          token: await getToken(),
        };

        if (!cmdOptions.quiet) {
          console.log('\nFound token for workspace:\n');
          console.log(`Workspace URL: ${GlobalContext.workspace}`);
          console.log(`Token: ${auth.token}\n`);

          console.log('Found cookie:');
          console.log(`${auth.cookie}\n`);
        } else {
          console.log(auth.token);
          console.log(auth.cookie);
        }
      } catch (error) {
        program.error((error as Error).toString());
      }
    });
}
