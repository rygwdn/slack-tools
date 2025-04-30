import { Command } from 'commander';
import * as fs from 'fs/promises';
import { SlackContext } from '../context';
import { MyMessagesCommandOptions } from './my_messages/types';
import { generateMyMessagesSummary } from '../services/my-messages-service';

export function registerMyMessagesCommand(program: Command, context: SlackContext): void {
  program
    .command('my-messages')
    .description(
      'Generate a summary of your Slack activity including messages you sent and messages mentioning you',
    )
    .option('-u, --username <username>', 'Slack username to filter by')
    .option('-s, --since <date>', 'Start date (YYYY-MM-DD format), defaults to today')
    .option('-e, --until <date>', 'End date (YYYY-MM-DD format), defaults to today')
    .option('-c, --count <number>', 'Number of messages to fetch (default: 200)', '200')
    .option('-o, --output <file>', 'Output markdown to a file')
    .action(async (options: MyMessagesCommandOptions) => {
      try {
        // The workspace getter will handle validation automatically
        const workspace = context.workspace;

        const count = parseInt(options.count, 10);
        context.log.debug(`Generating daily summary for workspace: ${workspace}`);

        // Use the shared service to generate the my messages summary
        const result = await generateMyMessagesSummary(
          {
            username: options.username,
            since: options.since,
            until: options.until,
            count,
          },
          context,
        );

        // Output the markdown result
        if (options.output) {
          await fs.writeFile(options.output, result.markdown);
          console.log(`Report written to: ${options.output}`);
        } else {
          console.log(result.markdown);
        }
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
