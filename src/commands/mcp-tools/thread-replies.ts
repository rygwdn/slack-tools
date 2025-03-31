import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { getSlackThreadReplies } from '../../services/slack-services';

export function registerThreadReplyTools(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_get_thread_replies',
    {
      channel: z.string().describe('Channel ID containing the thread'),
      ts: z.string().describe('Timestamp of the parent message'),
      limit: z.number().optional().describe('Maximum number of replies to fetch'),
    },
    async ({ channel, ts, limit }) => {
      try {
        const result = await getSlackThreadReplies(channel, ts, context, limit);

        // Format as markdown
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
