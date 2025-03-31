import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { createSlackReminder, listSlackReminders } from '../../services/slack-services';
import { parseDateToTimestamp } from '../../utils/date-utils';

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

  // Tool for listing reminders
  server.tool(
    'slack_list_reminders',
    {
      status: z
        .enum(['pending', 'completed', 'all'])
        .optional()
        .default('pending')
        .describe('Filter by status: pending (default), completed, all'),
      due_after: z
        .string()
        .optional()
        .describe('Show reminders due after this date/time (e.g., "tomorrow", "2024-08-01")'),
      due_before: z.string().optional().describe('Show reminders due before this date/time'),
      completed_after: z
        .string()
        .optional()
        .describe('Show reminders completed after this date/time'),
      completed_before: z
        .string()
        .optional()
        .describe('Show reminders completed before this date/time'),
    },
    async ({ status, due_after, due_before, completed_after, completed_before }) => {
      try {
        // Parse date strings to timestamps
        const dueAfterTs = parseDateToTimestamp(due_after);
        const dueBeforeTs = parseDateToTimestamp(due_before);
        const completedAfterTs = parseDateToTimestamp(completed_after);
        const completedBeforeTs = parseDateToTimestamp(completed_before);

        // Call service with filter options
        const result = await listSlackReminders(context, {
          statusFilter: status,
          dueAfterTs,
          dueBeforeTs,
          completedAfterTs,
          completedBeforeTs,
        });

        // Format as markdown
        let markdown = '## Reminders\n\n';

        if (result.reminders.length === 0) {
          markdown += 'No reminders found matching the criteria.\n';
        } else {
          result.reminders.forEach((reminder, index) => {
            const isComplete = (reminder.complete_ts || 0) > 0;
            const dueTimeStr = reminder.time
              ? new Date(parseInt(String(reminder.time)) * 1000).toLocaleString()
              : 'N/A (Recurring?)';

            const completedTimeStr =
              isComplete && reminder.complete_ts
                ? new Date(parseInt(String(reminder.complete_ts)) * 1000).toLocaleString()
                : '';

            markdown += `### ${index + 1}. ${reminder.text}\n`;
            markdown += `- **Due:** ${dueTimeStr}\n`;
            markdown += `- **Status:** ${isComplete ? '✅ Complete' : '⏳ Pending'}`;
            if (completedTimeStr) {
              markdown += ` (completed on ${completedTimeStr})`;
            }
            markdown += '\n\n';
          });
        }

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
