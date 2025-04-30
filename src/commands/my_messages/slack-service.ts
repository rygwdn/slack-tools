import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { GlobalContext, SlackContext } from '../../context';
import { formatDateForSearch, getDayAfter, getDayBefore } from '../../utils/date-utils';
import { enhanceSearchQuery } from '../../utils/user-utils';
import { SearchResult } from './types';

/**
 * Search Slack for messages matching the given criteria
 *
 * This function retrieves:
 * 1. Messages sent BY the user (in any channel)
 * 2. Thread messages involving the user
 * 3. Messages sent TO the user (in DMs and @mentions in channels)
 */
export async function searchMessages(
  client: WebClient,
  username: string | undefined,
  dateRange: { startTime: Date; endTime: Date },
  count: number,
  context: SlackContext,
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
  context.log.debug(`Search query: ${searchQuery}`);
  const searchResults = await searchSlackMessages(client, searchQuery, count, context);

  // Search for thread messages with the user
  // Note: We add @ to be consistent, but our regex doesn't detect with: clauses yet
  const threadQuery = `is:thread with:@${username} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  context.log.debug(`Thread query: ${threadQuery}`);
  const threadResults = await searchSlackMessages(client, threadQuery, count, context);

  // Search for messages that mention the user
  const mentionQuery = `to:${username} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  context.log.debug(`Mention query: ${mentionQuery}`);
  const mentionResults = await searchSlackMessages(client, mentionQuery, count, context);

  return {
    messages: searchResults,
    threadMessages: threadResults,
    mentionMessages: mentionResults,
  };
}

/**
 * General purpose function to search Slack messages with any query
 */
export async function searchSlackMessages(
  client: WebClient,
  query: string,
  count: number,
  context: SlackContext = GlobalContext,
): Promise<Match[]> {
  context.log.debug(`Original search query: ${query}`);

  // Enhance the search query with proper user formatting
  const enhancedQuery = await enhanceSearchQuery(client, query);
  context.log.debug(`Executing search with enhanced query: ${enhancedQuery}`);

  try {
    const searchResults = await client.search.messages({
      query: enhancedQuery,
      sort: 'timestamp',
      sort_dir: 'asc',
      count,
    });

    return searchResults.messages?.matches || [];
  } catch (error) {
    context.log.debug(`Search error: ${error}`);
    throw new Error(`Failed to search Slack: ${error}`);
  }
}
