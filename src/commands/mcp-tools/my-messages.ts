import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { generateMyMessagesSummary } from '../../services/my-messages-service';

export function registerMyMessagesTools(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_my_messages',
    {
      username: z.string().optional().describe('Username to fetch messages for'),
      since: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      until: z.string().optional().describe('End date in YYYY-MM-DD format'),
      count: z.number().optional().default(200).describe('Maximum number of messages to retrieve'),
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
