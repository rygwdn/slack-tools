import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { performSlackSearch } from '../../services/slack-services';
import { generateSearchResultsMarkdown } from '../../services/formatting-service';

export function registerSearchTools(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_search',
    {
      query: z.string().describe(
        'Search query with Slack search modifiers. Supports operators like "from:", "to:", "with:", "in:", "has:", etc. For user searches, the correct format is from:@username (e.g., from:@john.doe) or from:"Display Name" (with quotes for names with spaces). Use the slack_user_search tool first to find the correct user format if needed.'
      ),
      count: z.number().optional().default(100).describe(
        'Maximum number of results to return (1-1000). Default is 100.'
      ),
    },
    async ({ query, count }) => {
      try {
        const results = await performSlackSearch(query, count, context);

        // Format the results as markdown
        const cache = {
          lastUpdated: Date.now(),
          channels: results.channels,
          users: results.users,
        };

        const markdown = generateSearchResultsMarkdown(
          results.messages,
          cache,
          results.userId,
          context,
        );

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
