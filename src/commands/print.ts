import { Command } from 'commander';
import { GlobalContext } from '../context';
import { getStoredAuth } from '../auth';

// TODO: delete this command
export function registerPrintCommand(program: Command): void {
  program
    .command('print')
    .description('Print tokens and cookie')
    .option('-q, --quiet', 'Suppress output and only show tokens/cookies')
    .action(async (cmdOptions) => {
      try {
        const auth = await getStoredAuth();
        if (!auth) {
          program.error(
            'No authentication credentials found. Please run the auth-from-app or auth-from-curl command first.',
          );
        }

        if (!cmdOptions.quiet) {
          console.log('\nFound authentication credentials:\n');
          if (GlobalContext.workspace) {
            console.log(`Workspace URL: ${GlobalContext.workspace}`);
          }
          console.log(`Token: ${auth.token}\n`);
          console.log('Cookie:');
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
