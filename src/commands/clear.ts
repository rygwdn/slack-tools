import { Command } from 'commander';
import { clearStoredAuth } from '../auth';

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
        console.error('Error:', error);
        process.exit(1);
      }
    });
}