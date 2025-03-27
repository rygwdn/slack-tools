import { WebClient } from '@slack/web-api';
import { SearchResult } from './types';
import { CommandContext } from '../../context';
import { formatDateForSearch, getDayAfter, getDayBefore } from './utils';

/**
 * Search Slack for messages matching the given criteria
 */
export async function searchMessages(
  client: WebClient,
  username: string | undefined,
  dateRange: { startTime: Date; endTime: Date },
  count: number,
  context: CommandContext
): Promise<SearchResult> {
  if (!username) {
    throw new Error('Username is required for searching messages');
  }

  // Get date boundaries for search
  const dayBeforeStart = getDayBefore(dateRange.startTime);
  const dayAfterEnd = getDayAfter(dateRange.endTime);

  // Format dates for Slack search
  const dayBeforeStartFormatted = formatDateForSearch(dayBeforeStart);
  const dayAfterEndFormatted = formatDateForSearch(dayAfterEnd);

  // Search for messages from the user
  const searchQuery = `from:${username} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  context.debugLog(`Search query: ${searchQuery}`);
  const searchResults = await client.search.messages({
    query: searchQuery,
    sort: 'timestamp',
    sort_dir: 'asc',
    count
  });

  // Search for thread messages with the user
  const threadQuery = `is:thread with:${username} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  context.debugLog(`Thread query: ${threadQuery}`);
  const threadResults = await client.search.messages({
    query: threadQuery,
    sort: 'timestamp',
    sort_dir: 'asc',
    count
  });

  // Search for messages that mention the user
  const mentionQuery = `to:${username} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  context.debugLog(`Mention query: ${mentionQuery}`);
  const mentionResults = await client.search.messages({
    query: mentionQuery,
    sort: 'timestamp',
    sort_dir: 'asc',
    count
  });

  return {
    messages: searchResults.messages?.matches || [],
    threadMessages: threadResults.messages?.matches || [],
    mentionMessages: mentionResults.messages?.matches || []
  };
}
