import { CommandContext } from '../context';
import { getSlackClient } from '../slack-api';
import { getDateRange } from '../commands/today/utils';
import { searchMessages } from '../commands/today/slack-service';
import { getSlackEntityCache } from '../commands/today/slack-entity-cache';
import { generateMarkdown } from '../commands/today/formatters';
import { saveSlackCache } from '../cache';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { SlackCache } from '../commands/today/types';

interface TodayOptions {
  username?: string;
  since?: string;
  until?: string;
  count: number;
}

export interface TodaySummaryResult {
  markdown: string;
  allMessages: Match[];
  userId: string;
  dateRange: {
    startTime: Date;
    endTime: Date;
  };
  cache: SlackCache;
}

/**
 * Generate a today summary for Slack activity
 * @param options Options for generating the summary
 * @param context The command context
 * @returns The generated summary
 */
export async function generateTodaySummary(
  options: TodayOptions,
  context: CommandContext,
): Promise<TodaySummaryResult> {
  // Get date range
  const dateRange = await getDateRange(options, context);

  // Get Slack client and user info
  const client = await getSlackClient(context.workspace, context);
  const authTest = await client.auth.test();
  const userId = authTest.user_id as string;
  const username = options.username || (authTest.user as string);

  context.debugLog(`Generating today summary for user: ${username}`);
  context.debugLog(
    `Date range: ${dateRange.startTime.toLocaleDateString()} to ${dateRange.endTime.toLocaleDateString()}`,
  );

  // Search messages
  const { messages, threadMessages, mentionMessages } = await searchMessages(
    client,
    username,
    dateRange,
    options.count,
    context,
  );
  const allMessages = [...messages, ...threadMessages, ...mentionMessages] as Match[];

  context.debugLog(
    `Found ${messages.length} direct messages, ${threadMessages.length} thread messages, and ${mentionMessages.length} mention messages`,
  );
  context.debugLog(`Found ${allMessages.length} total messages. Fetching details...`);

  // Get user and channel information
  const cache = await getSlackEntityCache(client, allMessages, context);

  context.debugLog('Formatting report...');

  // Process and format messages
  const markdown = generateMarkdown(allMessages, cache, userId, context);

  // Update cache last updated time
  cache.lastUpdated = Date.now();

  // Save the cache for future use
  await saveSlackCache(cache);

  return {
    markdown,
    allMessages,
    userId,
    dateRange,
    cache,
  };
}
