import { CommandContext } from '../context';
import { getSlackClient } from '../slack-api';
import { getDateRange } from '../utils/date-utils';
import { searchMessages } from '../commands/my_messages/slack-service';
import { getSlackEntityCache } from '../commands/my_messages/slack-entity-cache';
import { generateMarkdown } from '../commands/my_messages/formatters';
import { saveSlackCache } from '../cache';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { SlackCache } from '../commands/my_messages/types';

interface MyMessagesOptions {
  username?: string;
  since?: string;
  until?: string;
  count: number;
}

export interface MyMessagesSummaryResult {
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
 * Generate a my messages summary for Slack activity
 *
 * Includes:
 * - Messages sent BY the user in any channel or DM
 * - Messages sent TO the user (in DMs and @mentions in channels)
 * - Thread messages involving the user
 *
 * Does NOT include:
 * - Messages sent to the user in multi-user channels/groups (unless the user participated in the thread)
 *
 * @param options Options for the summary generation
 * @param context Command context
 * @returns Generated summary result
 */
export async function generateMyMessagesSummary(
  options: MyMessagesOptions,
  context: CommandContext,
): Promise<MyMessagesSummaryResult> {
  // Get date range
  const dateRange = await getDateRange(options, context);

  // Get Slack client and user info
  const client = await getSlackClient(context.workspace, context);
  const authTest = await client.auth.test();
  const userId = authTest.user_id as string;
  const username = options.username || (authTest.user as string);

  context.debugLog(`Generating my messages summary for user: ${username}`);
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
