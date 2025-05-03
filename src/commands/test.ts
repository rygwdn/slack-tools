import { Command } from 'commander';
import { getStoredAuth } from '../auth/keychain';
import { GlobalContext } from '../context';
import { createWebClient } from '../slack-api';

export function registerTestCommand(program: Command): void {
  program
    .command('test')
    .description('Test authentication with Slack API')
    .action(async (_options) => {
      try {
        const auth = await getStoredAuth();
        const client = await createWebClient(auth);

        console.log('Calling auth.test API endpoint');
        const response = await client.auth.test();
        console.log('Full API response:', response);

        console.log('\nAPI Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('Error:', error);

        if (!GlobalContext.debug) {
          console.log('\nTip: Run with -d/--debug flag for more troubleshooting information');
        }

        process.exit(1);
      }
    });
}
