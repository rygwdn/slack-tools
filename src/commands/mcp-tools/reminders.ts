import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { createSlackReminder } from '../../services/slack-services';

export function registerReminderTools(server: McpServer, context: CommandContext): void {
  // Tool for creating reminders
  server.tool(
    'slack_create_reminder',
    {
      text: z.string().describe('The reminder text'),
      time: z
        .string()
        .describe(
          'When to remind (unix timestamp, ISO datetime, or relative time like "in 5 minutes")',
        ),
      user: z
        .string()
        .optional()
        .describe('User ID to create reminder for (defaults to current user)'),
    },
    async ({ text, time, user }) => {
      try {
        const result = await createSlackReminder(text, time, context, user);

        // Format as markdown
        const markdown = `
## Reminder Created
- **Text:** ${text}
- **Time:** ${time}
${user ? `- **User:** ${user}` : ''}
- **Success:** ${result.success ? '✅' : '❌'}
          `.trim();

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
