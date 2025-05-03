import { Command } from 'commander';
import { clearStoredAuth } from '../auth/keychain';
import { GlobalContext } from '../context';

export function registerClearCommand(program: Command): void {
  program
    .command('clear')
    .description('Clear stored authentication from keychain')
    .action(async () => {
      try {
        console.error('Clearing stored authentication from keychain...');
        await clearStoredAuth();
        console.error('Authentication cleared successfully.');
      } catch (error) {
        GlobalContext.log.debug('Error detail', error as Error);
        program.error((error as Error).message);
      }
    });
}
