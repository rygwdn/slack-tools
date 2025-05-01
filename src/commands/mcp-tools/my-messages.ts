import { z } from 'zod';
import { generateMyMessagesSummary } from '../../services/my-messages-service';
import { tool } from '../../types';

const myMessagesParams = z.object({
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
  execute: async ({ since, until, count }) => {
    const result = await generateMyMessagesSummary({ since, until, count });
    return result.markdown;
  },
});
