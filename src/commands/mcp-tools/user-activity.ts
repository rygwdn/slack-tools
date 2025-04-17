import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { getSlackUserActivity } from '../../services/slack-services';

export function registerUserActivityTools(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_user_activity',
    {
      count: z.number().optional().default(100).describe('Number of recent messages to analyze (1-1000). Default is 100.'),
      user: z.string().optional().describe('Slack user ID to analyze activity for (e.g. "U12345678"). If omitted, analyzes the current user\'s activity.'),
    },
    async ({ count, user }) => {
      try {
        const result = await getSlackUserActivity(count, context, user);

        // Format as markdown
        let markdown = `## User Activity Summary\n\n`;
        markdown += `- **User:** ${result.userId}\n`;
        markdown += `- **Total Messages:** ${result.totalMessages}\n`;
        markdown += `- **Time Period:** ${result.timePeriod}\n\n`;

        markdown += `### Channel Breakdown\n\n`;

        if (result.channelBreakdown.length === 0) {
          markdown += 'No channel activity found.';
        } else {
          markdown += `| Channel | Message Count | % of Total |\n`;
          markdown += `| ------- | ------------- | ---------- |\n`;

          result.channelBreakdown.forEach((item) => {
            const percentage = ((item.messageCount / result.totalMessages) * 100).toFixed(1);
            markdown += `| ${item.channelName} | ${item.messageCount} | ${percentage}% |\n`;
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
