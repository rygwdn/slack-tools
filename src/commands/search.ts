import { Command } from 'commander';
import { getSlackClient } from '../slack-api';
import * as fs from 'fs/promises';
import { CommandContext } from '../context';
import { searchSlackMessages } from './today/slack-service';
import { getSlackEntityCache } from './today/slack-entity-cache';
import { formatSlackText, getFriendlyChannelName, formatTime } from './today/formatters';
import { saveSlackCache } from '../cache';
import { SlackCache } from './today/types';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

export interface SearchCommandOptions {
  count: string;
  output?: string;
}

function generateSearchResultsMarkdown(
  messages: Match[],
  cache: SlackCache,
  userId: string,
  context: CommandContext
): string {
  let markdown = '';
  
  if (messages.length === 0) {
    return "# Search Results\n\nNo messages found matching your search criteria.\n";
  }
  
  // Group messages by channel
  const messagesByChannel = new Map<string, Match[]>();
  
  // Sort messages by channel
  for (const message of messages) {
    const channelId = message.channel?.id || 'unknown';
    if (!messagesByChannel.has(channelId)) {
      messagesByChannel.set(channelId, []);
    }
    messagesByChannel.get(channelId)!.push(message);
  }
  
  // Sort channels by name
  const sortedChannels = Array.from(messagesByChannel.keys())
    .sort((aId, bId) => {
      const aName = getFriendlyChannelName(aId, cache, userId);
      const bName = getFriendlyChannelName(bId, cache, userId);
      return aName.localeCompare(bName);
    });
  
  // Add header for search results
  markdown += `# Search Results\n\n`;
  
  // Generate markdown for each channel
  for (const channelId of sortedChannels) {
    const channelMessages = messagesByChannel.get(channelId)!;
    const channelName = getFriendlyChannelName(channelId, cache, userId);
    
    markdown += `## ${channelName}\n\n`;
    
    // Sort messages by timestamp
    const sortedMessages = channelMessages.sort((a, b) => {
      if (!a.ts || !b.ts) return 0;
      return Number(a.ts) - Number(b.ts);
    });
    
    for (const message of sortedMessages) {
      if (!message.ts) continue;
      
      const timestamp = new Date(Number(message.ts) * 1000);
      const dateString = timestamp.toLocaleDateString();
      const timeString = formatTime(timestamp);
      
      let userName = message.username || 'Unknown User';
      if (message.user && cache.users[message.user]) {
        userName = cache.users[message.user].displayName;
      }
      
      // Format the message with date, time, username, and link
      markdown += `- **${dateString}** [${timeString}](${message.permalink || ''}) **${userName}**: `;
      
      // Format the message text
      const formattedText = formatSlackText(message.text || '', cache);
      const messageLines = formattedText.split('\n');
      
      // First line goes after the header, additional lines indented
      markdown += messageLines[0] + '\n';
      
      if (messageLines.length > 1) {
        const indent = '    '; // 4 spaces for markdown list alignment
        markdown += messageLines.slice(1)
          .map(line => `${indent}${line}`)
          .join('\n') + '\n';
      }
      
      markdown += '\n'; // Extra space between messages
    }
    
    markdown += '\n';
  }
  
  return markdown;
}

export function registerSearchCommand(program: Command, context: CommandContext): void {
  program
    .command('search <query>')
    .description('Search Slack messages and output results as markdown')
    .option('-c, --count <number>', 'Number of messages to fetch (default: 100)', '100')
    .option('-o, --output <file>', 'Output markdown to a file')
    .action(async (query: string, options: SearchCommandOptions) => {
      try {
        // The workspace getter will handle validation automatically
        const workspace = context.workspace;

        const count = parseInt(options.count, 10);
        context.debugLog(`Searching Slack for: "${query}" in workspace: ${workspace}`);

        // Get client info from authentication
        const client = await getSlackClient(workspace, context);
        const authTest = await client.auth.test();
        const userId = authTest.user_id as string;

        // Search messages
        context.debugLog(`Searching messages with query: ${query}`);
        const messages = await searchSlackMessages(client, query, count, context);

        context.debugLog(`Found ${messages.length} matching messages. Fetching details...`);

        // Get user and channel information
        const cache = await getSlackEntityCache(client, messages, context);

        context.debugLog('Formatting report...');

        // Process and format messages with our simplified formatter
        const markdown = generateSearchResultsMarkdown(messages, cache, userId, context);

        if (options.output) {
          await fs.writeFile(options.output, markdown);
          console.log(`Search results written to: ${options.output}`);
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