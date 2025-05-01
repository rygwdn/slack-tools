import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { GlobalContext } from '../../context';
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
  userId: string,
  dateRange: { startTime: Date; endTime: Date },
  count: number,
): Promise<SearchResult> {
  // Get date boundaries for search
  const dayBeforeStart = getDayBefore(dateRange.startTime);
  const dayAfterEnd = getDayAfter(dateRange.endTime);

  // Format dates for Slack search
  const dayBeforeStartFormatted = formatDateForSearch(dayBeforeStart);
  const dayAfterEndFormatted = formatDateForSearch(dayAfterEnd);

  // Search for messages from the user
  const searchQuery = `from:${userId} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  GlobalContext.log.debug(`Search query: ${searchQuery}`);
  const searchResults = await searchSlackMessages(client, searchQuery, count);

  // Search for thread messages with the user
  // Note: We add @ to be consistent, but our regex doesn't detect with: clauses yet
  const threadQuery = `is:thread with:@${userId} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  GlobalContext.log.debug(`Thread query: ${threadQuery}`);
  const threadResults = await searchSlackMessages(client, threadQuery, count);

  // Search for messages that mention the user
  const mentionQuery = `to:${userId} after:${dayBeforeStartFormatted} before:${dayAfterEndFormatted}`;
  GlobalContext.log.debug(`Mention query: ${mentionQuery}`);
  const mentionResults = await searchSlackMessages(client, mentionQuery, count);

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
): Promise<Match[]> {
  GlobalContext.log.debug(`Original search query: ${query}`);

  // Enhance the search query with proper user formatting
  const enhancedQuery = await enhanceSearchQuery(client, query);
  GlobalContext.log.debug(`Executing search with enhanced query: ${enhancedQuery}`);

  const searchResults = await client.search.messages({
    query: enhancedQuery,
    sort: 'timestamp',
    sort_dir: 'asc',
    count,
  });

  return searchResults.messages?.matches || [];
}
