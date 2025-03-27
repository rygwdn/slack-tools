import { Command } from 'commander';
import { getSlackClient } from '../slack-api';
import { CommandContext } from '../context';

export function registerTestCommand(program: Command, context: CommandContext): void {
  program
    .command('test')
    .description('Test authentication with Slack API')
    .action(async (options) => {
      try {
        // The workspace getter will handle validation automatically
        const workspace = context.workspace;
        context.debugLog('Testing authentication for workspace:', workspace);

        console.log('Testing auth for workspace:', workspace);

        // Get a configured Slack client for the workspace
        const client = await getSlackClient(workspace, context);

        // Use the client directly to call auth.test
        context.debugLog('Calling auth.test API endpoint');
        const response = await client.auth.test();
        context.debugLog('Full API response:', response);

        console.log('\nAPI Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('Error:', error);

        if (!context.debug) {
          console.log("\nTip: Run with -d/--debug flag for more troubleshooting information");
        }

        process.exit(1);
      }
    });
}
