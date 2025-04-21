import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { generateMyMessagesSummary } from '../../services/my-messages-service';

export function registerMyMessagesTools(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_my_messages',
    {
      username: z
        .string()
        .optional()
        .describe(
          'Username or display name to fetch messages for. If omitted, fetches messages for the current user.',
        ),
      since: z
        .string()
        .optional()
        .describe(
          'Start date in YYYY-MM-DD format (e.g., "2023-01-15"). If omitted, defaults to the beginning of the current day.',
        ),
      until: z
        .string()
        .optional()
        .describe(
          'End date in YYYY-MM-DD format (e.g., "2023-01-15"). If omitted, defaults to the end of the current day.',
        ),
      count: z
        .number()
        .optional()
        .default(200)
        .describe('Maximum number of messages to retrieve (1-1000). Default is 200.'),
    },
    async ({ username, since, until, count }) => {
      try {
        const result = await generateMyMessagesSummary({ username, since, until, count }, context);

        return {
          content: [
            {
              type: 'text',
              text: result.markdown,
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
