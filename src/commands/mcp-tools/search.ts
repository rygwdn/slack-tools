import { z } from 'zod';
import { tool } from '../../types';
import { generateSearchResultsMarkdown } from '../../services/formatting-service';
import { getCacheForMessages } from '../my_messages/slack-entity-cache';
import { createWebClient } from '../../slack-api';
import { searchSlackMessages } from '../my_messages/slack-service';

const searchParams = z.object({
  query: z
    .string()
    .describe(
      'Search query with Slack search modifiers. Supports operators like "from:", "to:", "with:", "in:", "has:", etc. For user searches, use from:<@U12345> (with user ID), from:display.name (without quotes), from:@me (for current user), or from:"Display Name" (with quotes for names with spaces). For channel searches, use in:channel_name (e.g., in:general) or in:<#C12345> (using channel ID). Use the slack_get_user_profile tool first to find the correct user ID if needed.',
    ),
  count: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe('Maximum number of results to return (1-1000). Default is 100.'),
});

export const searchTool = tool({
  name: 'slack_search',
  description:
    'Perform a search in Slack using standard Slack search syntax and return matching messages.',
  parameters: searchParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'Search Slack',
  },
  execute: async ({ query, count }) => {
    const client = await createWebClient();
    const messages = await searchSlackMessages(client, query, count);
    const cache = await getCacheForMessages(client, messages);

    return generateSearchResultsMarkdown(messages, cache);
  },
});
