import { GlobalContext } from '../context';
import { createWebClient } from '../slack-api';
import { getDateRange } from '../utils/date-utils';
import { searchMessages } from '../commands/my_messages/slack-service';
import { getCacheForMessages } from '../commands/my_messages/slack-entity-cache';
import { generateMarkdown } from '../commands/my_messages/formatters';
import { saveSlackCache } from '../cache';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse.js';
import { SlackCache } from '../commands/my_messages/types.js';
import { getStoredAuth } from '../auth/keychain';

export interface MyMessagesOptions {
  count?: number;
  timeRange?: string; // e.g., 'today', 'yesterday', 'last 7 days', 'YYYY-MM-DD..YYYY-MM-DD'
  since?: string;
  until?: string;
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
 * @returns Generated summary result
 */
export async function generateMyMessagesSummary(
  options: MyMessagesOptions,
): Promise<MyMessagesSummaryResult> {
  const { count = 200 } = options; // Default count to 200
  const dateRange = await getDateRange(options);
  const auth = await getStoredAuth();
  if (!auth) {
    throw new Error('Authentication required');
  }
  const client = await createWebClient(auth);
  if (!GlobalContext.currentUser?.user_id) {
    throw new Error('No current user found');
  }

  const userId = GlobalContext.currentUser.user_id;

  GlobalContext.log.debug(`Generating my messages summary for user: ${userId}`);
  GlobalContext.log.debug(
    `Date range: ${dateRange.startTime.toLocaleDateString()} to ${dateRange.endTime.toLocaleDateString()}`,
  );

  const { messages, threadMessages, mentionMessages } = await searchMessages(
    client,
    `<@${userId}>`,
    dateRange,
    count,
  );
  const allMessages = [...messages, ...threadMessages, ...mentionMessages];

  GlobalContext.log.debug(
    `Found ${messages.length} direct messages, ${threadMessages.length} thread messages, and ${mentionMessages.length} mention messages`,
  );
  GlobalContext.log.debug(`Found ${allMessages.length} total messages. Fetching details...`);

  const cache = await getCacheForMessages(client, allMessages);

  GlobalContext.log.debug('Formatting report...');

  const markdown = generateMarkdown(allMessages, cache, userId);

  cache.lastUpdated = Date.now();

  await saveSlackCache();

  return {
    markdown,
    allMessages,
    userId,
    dateRange,
    cache,
  };
}
