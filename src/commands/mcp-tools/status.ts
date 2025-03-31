import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { setSlackStatus, getSlackStatus } from '../../services/slack-services';
import { formatStatusOutput, formatStatusUpdateOutput } from '../../services/formatting-service';

export function registerStatusTools(server: McpServer, context: CommandContext): void {
  // Tool for setting status
  server.tool(
    'slack_set_status',
    {
      text: z.string(),
      emoji: z.string().optional(),
      duration: z.number().optional(),
    },
    async ({ text, emoji, duration }) => {
      try {
        const result = await setSlackStatus(text, context, emoji, duration);

        // Format the result as markdown
        const markdown = formatStatusUpdateOutput(result);

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

  // Tool for getting status
  server.tool('slack_get_status', {}, async () => {
    try {
      const status = await getSlackStatus(context);

      // Format the status as markdown
      const markdown = formatStatusOutput(status);

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
  });
}
