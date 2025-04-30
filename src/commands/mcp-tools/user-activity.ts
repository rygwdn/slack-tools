import { z } from 'zod';
import { tool } from '../../types';
import { getSlackUserActivity } from '../../services/slack-services';

// Define schema
const userActivityParams = z.object({
  count: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe('Number of recent messages to analyze (1-1000). Default is 100.'),
  user: z
    .string()
    .optional()
    .describe(
      'Slack user ID to analyze activity for (e.g. "U12345678"). If omitted, analyzes the current user\'s activity.',
    ),
});

/**
 * Tool for analyzing user message activity in Slack
 */
export const userActivityTool = tool({
  name: 'slack_user_activity',
  description: "Analyze a Slack user's recent messaging activity and provide a summary by channel.",
  parameters: userActivityParams,
  annotations: {},
  execute: async ({ count, user }) => {
    const result = await getSlackUserActivity(count, user);

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

    return markdown;
  },
});
