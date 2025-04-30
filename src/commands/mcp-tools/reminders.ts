import { z } from 'zod';
import { tool } from '../../types';
import { createSlackReminder } from '../../services/slack-services';

// Define schema
const reminderParams = z.object({
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
});

/**
 * Tool for creating reminders in Slack
 */
export const reminderTool = tool({
  name: 'slack_create_reminder',
  description: 'Create a reminder in Slack for yourself or another user.',
  parameters: reminderParams,
  annotations: {},
  execute: async ({ text, time, user }) => {
    const result = await createSlackReminder(text, time, user);
    return `
## Reminder Created
- **Text:** ${text}
- **Time:** ${time}
${user ? `- **User:** ${user}` : ''}
- **Success:** ${result.success ? '✅' : '❌'}
    `.trim();
  },
});
