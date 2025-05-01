import { GlobalContext } from '../context';
import { getSlackClient } from '../slack-api';
import { getDateRange } from '../utils/date-utils';
import { searchMessages } from '../commands/my_messages/slack-service';
import { getSlackEntityCache } from '../commands/my_messages/slack-entity-cache';
import { generateMarkdown } from '../commands/my_messages/formatters';
import { saveSlackCache } from '../cache';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { SlackCache } from '../commands/my_messages/types';

interface MyMessagesOptions {
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
): Promise<MyMessagesSummaryResult> {
  const dateRange = await getDateRange(options);
  const client = await getSlackClient();
  if (!GlobalContext.currentUser?.user_id) {
    throw new Error('No current user found');
  }

  const userId = GlobalContext.currentUser.user_id;

  GlobalContext.log.debug(`Generating my messages summary for user: ${userId}`);
  GlobalContext.log.debug(
    `Date range: ${dateRange.startTime.toLocaleDateString()} to ${dateRange.endTime.toLocaleDateString()}`,
  );

  // Search messages
  const { messages, threadMessages, mentionMessages } = await searchMessages(
    client,
    `<@${userId}>`,
    dateRange,
    options.count,
  );
  const allMessages = [...messages, ...threadMessages, ...mentionMessages];

  GlobalContext.log.debug(
    `Found ${messages.length} direct messages, ${threadMessages.length} thread messages, and ${mentionMessages.length} mention messages`,
  );
  GlobalContext.log.debug(`Found ${allMessages.length} total messages. Fetching details...`);

  // Get user and channel information
  const cache = await getSlackEntityCache(client, allMessages);

  GlobalContext.log.debug('Formatting report...');

  // Process and format messages
  const markdown = generateMarkdown(allMessages, cache, userId);

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
