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
      text: z.string().describe('Status text to display (up to 100 characters)'),
      emoji: z
        .string()
        .optional()
        .describe(
          'Emoji code to display with status (without colons, e.g. "computer" for :computer:)',
        ),
      duration: z
        .number()
        .optional()
        .describe('Duration in minutes before automatically clearing the status'),
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
  server.tool(
    'slack_get_status',
    {
      description: z
        .string()
        .describe("Gets the current user's Slack status including status text and emoji"),
    },
    async () => {
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
    },
  );
}
