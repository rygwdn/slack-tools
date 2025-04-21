import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { createSlackReminder } from '../../services/slack-services';

export function registerReminderTools(server: McpServer, context: CommandContext): void {
  // Tool for creating reminders
  server.tool(
    'slack_create_reminder',
    {
      text: z.string().describe('The reminder text (what you want to be reminded about)'),
      time: z
        .string()
        .describe(
          'When to send the reminder. Supports unix timestamp, ISO datetime (YYYY-MM-DDTHH:MM:SS), or natural language like "in 5 minutes", "tomorrow at 9am", "next Monday"',
        ),
      user: z
        .string()
        .optional()
        .describe(
          'Slack user ID to create the reminder for. If omitted, creates reminder for the current user. Must start with "U" followed by alphanumeric characters.',
        ),
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
