import { z } from 'zod';
import { tool } from '../../types';
import { generateSearchResultsMarkdown } from '../../services/formatting-service';
import { getCacheForMessages } from '../my_messages/slack-entity-cache';
import { createWebClient } from '../../slack-api';
import { searchSlackMessages } from '../my_messages/slack-service';

const queryDescription = `
Search query with Slack search modifiers.
Available modifiers: in:<channel/user>, from:<user>, has:<emoji reaction>, is:thread, during:YYYY-MM-DD, before:YYYY-MM-DD, after:YYYY-MM-DD, has:pin, with:<user>.
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
