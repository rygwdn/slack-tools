import { Command } from 'commander';
import * as fs from 'fs/promises';
import { CommandContext } from '../context';
import { TodayCommandOptions } from './today/types';
import { generateTodaySummary } from '../services/today-service';

export function registerTodayCommand(program: Command, context: CommandContext): void {
  program
    .command('today')
    .description('Generate a daily summary report for Slack activity')
    .option('-u, --username <username>', 'Slack username to filter by')
    .option('-s, --since <date>', 'Start date (YYYY-MM-DD format), defaults to today')
    .option('-e, --until <date>', 'End date (YYYY-MM-DD format), defaults to today')
    .option('-c, --count <number>', 'Number of messages to fetch (default: 200)', '200')
    .option('-o, --output <file>', 'Output markdown to a file')
    .action(async (options: TodayCommandOptions) => {
      try {
        // The workspace getter will handle validation automatically
        const workspace = context.workspace;

        const count = parseInt(options.count, 10);
        context.debugLog(`Generating daily summary for workspace: ${workspace}`);

        // Use the shared service to generate the today summary
        const result = await generateTodaySummary(
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
