import { Command } from 'commander';
import { clearStoredTokens } from '../cache';
import { CommandContext } from '../context';

export function registerClearCommand(program: Command, context: CommandContext): void {
  program
    .command('clear')
    .description('Clear stored tokens from keychain')
    .action(async () => {
      try {
        console.log('Clearing stored tokens from keychain...');
        await clearStoredTokens();
        console.log('Tokens cleared successfully.');
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
