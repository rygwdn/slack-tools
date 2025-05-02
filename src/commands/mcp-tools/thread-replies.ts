import { z } from 'zod';
import { tool } from '../../types';
import { getSlackThreadReplies } from '../../services/slack-services';
import { objectToMarkdown } from '../../utils/markdown-utils';

const threadRepliesParams = z.object({
  channel: z
    .string()
    .describe(
      'Slack channel ID where the thread is located (starts with C, D, or G followed by alphanumeric characters)',
    ),
  ts: z
    .string()
    .describe(
      'Timestamp of the parent message in Unix epoch time format (e.g., "1234567890.123456")',
    ),
  limit: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe(
      'Maximum number of replies to fetch (1-1000). If not specified, defaults to all replies.',
    ),
});

export const threadRepliesTool = tool({
  name: 'slack_get_thread_replies',
  description: 'Fetch replies for a specific message thread in a Slack channel.',
  parameters: threadRepliesParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'Get Thread Replies',
  },
  execute: async ({ channel, ts, limit }) => {
    const result = await getSlackThreadReplies(channel, ts, limit);

    if (result.replies.length === 0) {
      return 'No replies found in this thread.';
    }

    const formattedReplies = result.replies.map((reply) => {
      const user = result.entities[reply.user ?? '']?.displayName || reply.user;
      const time = reply.ts ? new Date(parseInt(reply.ts) * 1000).toLocaleString() : 'Unknown time';
      return `${user} - ${time}: ${reply.text}`;
    });

    return objectToMarkdown({
      [`Thread Replies: ${result.replies.length}`]: formattedReplies,
    });
  },
});
