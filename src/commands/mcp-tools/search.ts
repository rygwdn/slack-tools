import { z } from 'zod';
import { tool } from '../../types';
import { generateSearchResultsMarkdown } from '../../services/formatting-service';
import { getCacheForMessages } from '../my_messages/slack-entity-cache';
import { createWebClient } from '../../slack-api';
import { searchSlackMessages } from '../../services/slack-services';

const queryDescription = `
Search query with Slack search modifiers.
Available modifiers: in:<channel/user>, from:<user>, has:<emoji reaction>, is:thread, before:YYYY-MM-DD, after:YYYY-MM-DD, has:pin, with:<user>.
Identify users with "@me", "@display.name" or "<@U12345>".
Identify channels with "#channel-name" or "<#C12345>".
Exclude results with a dash (-) in front of the modifier.
Use double quotes to search for an exact phrase.

Example: marketing report in:#team-marketing from:@display.name after:2024-01-01
`;

const searchParams = z.object({
  query: z.string().describe(queryDescription),
  count: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe('Maximum number of results to return (1-1000). Default is 100.'),
  sort: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc')
    .describe('Timestamp sort order. Default is desc (newest first).'),
});

export const searchTool = tool({
  name: 'slack_search',
  description:
    'Perform a search in Slack using standard Slack search syntax and return matching messages.',
  parameters: searchParams,
  timeoutMs: 30000,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'Search Slack',
  },
  execute: async ({ query, count, sort }) => {
    const client = await createWebClient();
    const messages = await searchSlackMessages(client, query, count, sort);
    const cache = await getCacheForMessages(client, messages);

    return generateSearchResultsMarkdown(messages, cache);
  },
});
