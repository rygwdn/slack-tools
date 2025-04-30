import { Command } from 'commander';
import { getSlackClient } from '../slack-api';
import { GlobalContext } from '../context';

export function registerTestCommand(program: Command): void {
  program
    .command('test')
    .description('Test authentication with Slack API')
    .action(async (_options) => {
      try {
        console.log('Testing auth for workspace:', GlobalContext.workspace);

        // Get a configured Slack client for the workspace
        const client = await getSlackClient(GlobalContext);

        // Use the client directly to call auth.test
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
