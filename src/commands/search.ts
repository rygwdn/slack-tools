import { Command } from 'commander';
import * as fs from 'fs/promises';
import { SlackContext } from '../context';
import { performSlackSearch } from '../services/slack-services';
import { generateSearchResultsMarkdown } from '../services/formatting-service';

export interface SearchCommandOptions {
  count: string;
  output?: string;
}

export function registerSearchCommand(program: Command, context: SlackContext): void {
  program
    .command('search <query>')
    .description('Search Slack messages and output results as markdown')
    .option('-c, --count <number>', 'Number of messages to fetch (default: 100)', '100')
    .option('-o, --output <file>', 'Output markdown to a file')
    .action(async (query: string, options: SearchCommandOptions) => {
      try {
        const count = parseInt(options.count, 10);
        context.log.debug(`Searching Slack for: "${query}"`);

        // Use the extracted search function
        const searchResult = await performSlackSearch(query, count, context);
        const messages = searchResult.messages;
        const userId = searchResult.userId;
        const cache = {
          lastUpdated: Date.now(),
          channels: searchResult.channels,
          users: searchResult.users,
        };

        context.log.debug('Formatting report...');

        // Process and format messages with our simplified formatter
        const markdown = generateSearchResultsMarkdown(messages, cache, userId, context);

        if (options.output) {
          await fs.writeFile(options.output, markdown);
          console.log(`Search results written to: ${options.output}`);
        } else {
          console.log(markdown);
        }
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
