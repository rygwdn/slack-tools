import { z } from 'zod';
import { generateMyMessagesSummary } from '../../services/my-messages-service';
import { tool } from '../../types';

const myMessagesParams = z.object({
  after: z
    .string()
    .optional()
    .describe(
      'Start date in YYYY-MM-DD format (e.g., "2023-01-15"). If omitted, defaults to the beginning of the current day.',
    ),
  before: z
    .string()
    .optional()
    .describe(
      'End date in YYYY-MM-DD format (e.g., "2023-01-15"). If omitted, defaults to the end of the current day.',
    ),
  count: z
    .number()
    .int()
    .default(200) // Will now always have a value after parsing
    .describe('Maximum number of messages to retrieve (1-1000). Default is 200.'),
});

export const myMessagesTool = tool({
  name: 'slack_my_messages',
  description: 'Fetch and summarize messages sent by the user in Slack within a given time range.',
  parameters: myMessagesParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'My Messages',
  },
  execute: async ({ after, before, count }) => {
    const result = await generateMyMessagesSummary({ after, before, count });
    return result.markdown;
  },
});
