import { Command } from 'commander';
import { getSlackClient } from '../slack-api';
import * as fs from 'fs/promises';
import { CommandContext } from '../context';
import { TodayCommandOptions } from './today/types';
import { getDateRange } from './today/utils';
import { searchMessages } from './today/slack-service';
import { getSlackEntityCache } from './today/slack-entity-cache';
import { generateMarkdown } from './today/formatters';
import { saveSlackCache } from '../cache';

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

        // Get date range
        const dateRange = await getDateRange(options, context);

        // Get user info from authentication
        const client = await getSlackClient(workspace, context);
        const authTest = await client.auth.test();
        const userId = authTest.user_id as string;
        const username = options.username || authTest.user as string;

        context.debugLog(`Searching messages for user: ${username}...`);
        context.debugLog(`Date range: ${dateRange.startTime.toLocaleDateString()} to ${dateRange.endTime.toLocaleDateString()}`);

        // Search messages
        const { messages, threadMessages, mentionMessages } = await searchMessages(client, username, dateRange, count, context);
        const allMessages = [...messages, ...threadMessages, ...mentionMessages];

        context.debugLog(`Found ${messages.length} direct messages, ${threadMessages.length} thread messages, and ${mentionMessages.length} mention messages`);
        context.debugLog(`Found ${allMessages.length} total messages. Fetching details...`);

        // Get user and channel information
        const cache = await getSlackEntityCache(client, allMessages, context);

        context.debugLog('Formatting report...');

        // Process and format messages
        const markdown = generateMarkdown(allMessages, cache, dateRange, userId, context);

        if (options.output) {
          await fs.writeFile(options.output, markdown);
          console.log(`Report written to: ${options.output}`);
        } else {
          console.log(markdown);
        }

        // Update and save the cache
        cache.lastUpdated = Date.now();
        await saveSlackCache(cache);

      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
