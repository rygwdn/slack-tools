import { z } from 'zod';
import { tool } from '../../types';
import { getSlackThreadReplies } from '../../services/slack-services';

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

    let markdown = `## Thread Replies\n\n`;

    if (result.replies.length === 0) {
      markdown += 'No replies found in this thread.';
    } else {
      markdown += `Found ${result.replies.length} replies:\n\n`;

      result.replies.forEach((reply, index) => {
        const user = result.users[reply.user ?? '']?.displayName || reply.user;
        const time = reply.ts
          ? new Date(parseInt(reply.ts) * 1000).toLocaleString()
          : 'Unknown time';

        markdown += `### Reply ${index + 1}\n`;
        markdown += `- **From:** ${user}\n`;
        markdown += `- **Time:** ${time}\n`;
        markdown += `- **Text:** ${reply.text || ''}\n\n`;
      });
    }

    return markdown;
  },
});
