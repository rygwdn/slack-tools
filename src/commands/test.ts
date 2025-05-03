import { Command } from 'commander';
import { getAuth } from '../auth/keychain';
import { createWebClient } from '../slack-api';
import { handleCommandError } from '../utils/auth-error';

export function registerTestCommand(program: Command): void {
  program
    .command('test')
    .description('Test authentication with Slack API')
    .action(async (_options) => {
      try {
        const auth = await getAuth();
        const client = await createWebClient(auth);

        console.log('Calling auth.test API endpoint');
        const response = await client.auth.test();
        console.log('Full API response:', response);

        console.log('\nAPI Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        handleCommandError(error, program);
      }
    });
}
