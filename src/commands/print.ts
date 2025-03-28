import { Command } from 'commander';
import { getSlackAuth } from '../auth';
import { CommandContext } from '../context';

export function registerPrintCommand(program: Command, context: CommandContext): void {
  program
    .command('print')
    .description('Print tokens and cookie')
    .option('-q, --quiet', 'Suppress output and only show tokens/cookies')
    .action(async (cmdOptions) => {
      try {
        if (!cmdOptions.quiet) {
          console.log('Getting Slack credentials...');
        }

        // For print command, we want to work even without a workspace selected
        // But if a workspace is set, we'll use it to filter results
        const auth = await getSlackAuth({
          workspace: context.hasWorkspace ? context.workspace : undefined,
          quiet: cmdOptions.quiet,
        });

        if (Object.keys(auth.tokens).length === 0) {
          console.error('Error: No tokens found.');
          if (context.hasWorkspace) {
            console.error(`No workspace matching "${context.workspace}" was found.`);
          }
          process.exit(1);
        }

        if (!cmdOptions.quiet) {
          console.log('\nFound tokens for workspaces:\n');
        }

        for (const [url, details] of Object.entries(auth.tokens)) {
          if (cmdOptions.quiet) {
            console.log(`${details.token}`);
          } else {
            console.log(`${details.name} (${url})`);
            console.log(`Token: ${details.token}\n`);
          }
        }

        if (cmdOptions.quiet) {
          console.log(`${auth.cookie.value}`);
        } else {
          console.log('Found cookie:');
          console.log(`${auth.cookie.name}: ${auth.cookie.value}\n`);

          // Print guidance about workspace selection if we showed multiple workspaces
          if (Object.keys(auth.tokens).length > 1 && !context.hasWorkspace) {
            console.log('\nTip: To filter results for a specific workspace, use one of:');
            console.log('  - Use -w, --workspace <workspace> to specify a workspace directly');
            console.log('  - Use -l, --last-workspace to use your most recently used workspace');
          }
        }
      } catch (error) {
        // Always log errors to console.error regardless of quiet mode
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
