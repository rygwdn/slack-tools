import { z } from 'zod';
import { tool } from '../../types';
import { performSlackSearch } from '../../services/slack-services';
import { generateSearchResultsMarkdown } from '../../services/formatting-service';

// Define the schema
const searchParams = z.object({
  query: z
    .string()
    .describe(
      'Search query with Slack search modifiers. Supports operators like "from:", "to:", "with:", "in:", "has:", etc. For user searches, use from:@username (e.g., from:@john.doe) or from:"Display Name" (with quotes for names with spaces). For channel searches, use in:channel_name (e.g., in:general) or in:<#C12345> (using channel ID). Use the slack_user_search or slack_channel_search tools first to find the correct format if needed.',
    ),
  count: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe('Maximum number of results to return (1-1000). Default is 100.'),
});

/**
 * Tool for searching messages in Slack
 */
export const searchTool = tool({
  name: 'slack_search',
  description:
    'Perform a search in Slack using standard Slack search syntax and return matching messages.',
  parameters: searchParams,
  annotations: {},
  execute: async ({ query, count }, { session }) => {
    const results = await performSlackSearch(query, count);

    // Format the results as markdown
    const cache = {
      lastUpdated: Date.now(),
      channels: results.channels,
      users: results.users,
    };

    return generateSearchResultsMarkdown(results.messages, cache, results.userId, session!.context);
  },
});
