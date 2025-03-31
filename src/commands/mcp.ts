import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CommandContext } from '../context';
import {
  performSlackSearch,
  setSlackStatus,
  getSlackStatus,
  createSlackReminder,
  listSlackReminders,
  getSlackThreadReplies,
  getSlackUserActivity,
} from '../services/slack-services';
import {
  generateSearchResultsMarkdown,
  formatStatusOutput,
  formatStatusUpdateOutput,
} from '../services/formatting-service';
import { generateMyMessagesSummary } from '../services/my-messages-service';

export function registerMcpCommand(program: Command, context: CommandContext): void {
  program
    .command('mcp')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      // Ensure workspace is set on launch
      if (!context.hasWorkspace) {
        console.error('Error: Workspace must be specified with --workspace or --last-workspace');
        console.error('Example: slack-tools mcp --workspace your-workspace');
        process.exit(1);
      }

      const server = new McpServer({
        name: 'slack-tools-server',
        version: '1.0.0',
      });

      // Add my_messages tool
      server.tool(
        'slack_my_messages',
        {
          username: z.string().optional().describe('Username to fetch messages for'),
          since: z.string().optional().describe('Start date in YYYY-MM-DD format'),
          until: z.string().optional().describe('End date in YYYY-MM-DD format'),
          count: z
            .number()
            .optional()
            .default(200)
            .describe('Maximum number of messages to retrieve'),
        },
        async ({ username, since, until, count }) => {
          try {
            const result = await generateMyMessagesSummary(
              { username, since, until, count },
              context,
            );

            return {
              content: [
                {
                  type: 'text',
                  text: result.markdown,
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

      // Add tool for search capability
      server.tool(
        'slack_search',
        {
          query: z.string(),
          count: z.number().optional().default(100),
        },
        async ({ query, count }) => {
          try {
            const results = await performSlackSearch(query, count, context);

            // Format the results as markdown
            const cache = {
              lastUpdated: Date.now(),
              channels: results.channels,
              users: results.users,
            };

            const markdown = generateSearchResultsMarkdown(
              results.messages,
              cache,
              results.userId,
              context,
            );

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

      // Add tool for status capability
      server.tool(
        'slack_set_status',
        {
          text: z.string(),
          emoji: z.string().optional(),
          duration: z.number().optional(),
        },
        async ({ text, emoji, duration }) => {
          try {
            const result = await setSlackStatus(text, context, emoji, duration);

            // Format the result as markdown
            const markdown = formatStatusUpdateOutput(result);

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

      // Add tool for getting status
      server.tool('slack_get_status', {}, async () => {
        try {
          const status = await getSlackStatus(context);

          // Format the status as markdown
          const markdown = formatStatusOutput(status);

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
      });

      // Add tool for creating reminders
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

      // Add tool for listing reminders
      server.tool('slack_list_reminders', {}, async () => {
        try {
          const result = await listSlackReminders(context);

          // Format as markdown
          let markdown = '## Reminders\n\n';

          if (result.reminders.length === 0) {
            markdown += 'No reminders found.';
          } else {
            result.reminders.forEach((reminder: any, index: number) => {
              const time = new Date(parseInt(reminder.time) * 1000).toLocaleString();
              markdown += `### ${index + 1}. ${reminder.text}\n`;
              markdown += `- **Time:** ${time}\n`;
              if (reminder.complete) {
                markdown += `- **Status:** Completed\n`;
              } else {
                markdown += `- **Status:** Pending\n`;
              }
              markdown += '\n';
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
      });

      // Add tool for getting thread replies
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

              result.replies.forEach((reply: any, index: number) => {
                const user = result.users[reply.user]?.displayName || reply.user;
                const time = new Date(parseInt(reply.ts) * 1000).toLocaleString();

                markdown += `### Reply ${index + 1}\n`;
                markdown += `- **From:** ${user}\n`;
                markdown += `- **Time:** ${time}\n`;
                markdown += `- **Text:** ${reply.text}\n\n`;
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

      // Add tool for user activity
      server.tool(
        'slack_user_activity',
        {
          count: z.number().optional().default(100).describe('Number of messages to analyze'),
          user: z.string().optional().describe('User ID (defaults to current user)'),
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

      // Add tool for getting current date and time
      server.tool('system_datetime', {}, async () => {
        try {
          const now = new Date();

          // Format the date for local timezone
          const localOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
          };
          const localDatetime = now.toLocaleString(undefined, localOptions);

          // Format for UTC
          const utcOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC',
            timeZoneName: 'short',
          };
          const utcDatetime = now.toLocaleString(undefined, utcOptions);

          // Get timezone name
          const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

          // Format as markdown
          const markdown = `
## Current Date and Time
- **Local (${timeZoneName})**: ${localDatetime}
- **UTC**: ${utcDatetime}
- **ISO**: ${now.toISOString()}
- **Unix Timestamp**: ${Math.floor(now.getTime() / 1000)}
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
      });

      const transport = new StdioServerTransport();
      await server.connect(transport);
    });
}
