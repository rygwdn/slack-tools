import { z } from 'zod';
import { tool } from '../../types';
import { createSlackReminder } from '../../services/slack-services';
import { objectToMarkdown } from '../../utils/markdown-utils';
const reminderParams = z.object({
  text: z.string().describe('The reminder text (what you want to be reminded about)'),
  time: z
    .string()
    .describe(
      'When to send the reminder. Supports unix timestamp, ISO datetime (YYYY-MM-DDTHH:MM:SS), or natural language like "in 5 minutes", "tomorrow at 9am", "next Monday"',
    ),
});

export const reminderTool = tool({
  name: 'slack_create_reminder',
  description: 'Create a reminder in Slack for yourself.',
  parameters: reminderParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: false,
    idempotentHint: false,
    title: 'Create a reminder in Slack',
  },
  execute: async ({ text, time }) => {
    const result = await createSlackReminder(text, time);

    return objectToMarkdown({
      [`Reminder Created`]: {
        text: text.toString(),
        time: time.toString(),
        success: result.success ? '✅' : '❌',
      },
    });
  },
});
