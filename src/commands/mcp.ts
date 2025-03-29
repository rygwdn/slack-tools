import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CommandContext } from '../context';
import { performSlackSearch, setSlackStatus, getSlackStatus } from '../services/slack-services';
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
        'my_messages',
        {
          username: z.string().optional(),
          since: z.string().optional().describe('Start date in YYYY-MM-DD format'),
          until: z.string().optional().describe('End date in YYYY-MM-DD format'),
          count: z.number().optional().default(200),
          format: z.enum(['markdown', 'json']).optional().default('markdown'),
        },
        async ({ username, since, until, count, format }) => {
          try {
            const result = await generateMyMessagesSummary(
              { username, since, until, count },
              context,
            );

            if (format === 'json') {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        messages: result.allMessages,
                        userId: result.userId,
                        dateRange: result.dateRange,
                      },
                      null,
                      2,
                    ),
                  },
                ],
              };
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: result.markdown,
                  },
                ],
              };
            }
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
        'search',
        {
          query: z.string(),
          count: z.number().optional().default(100),
          format: z.enum(['markdown', 'json']).optional().default('markdown'),
        },
        async ({ query, count, format }) => {
          try {
            const results = await performSlackSearch(query, count, context);

            if (format === 'json') {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(results, null, 2),
                  },
                ],
              };
            } else {
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
            }
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
        'set_status',
        {
          text: z.string(),
          emoji: z.string().optional(),
          duration: z.number().optional(),
          format: z.enum(['markdown', 'json']).optional().default('markdown'),
        },
        async ({ text, emoji, duration, format }) => {
          try {
            const result = await setSlackStatus(text, context, emoji, duration);

            if (format === 'json') {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              };
            } else {
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
            }
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error}` }],
              isError: true,
            };
          }
        },
      );

      // Add tool for getting status
      server.tool(
        'get_status',
        {
          format: z.enum(['markdown', 'json']).optional().default('markdown'),
        },
        async ({ format }) => {
          try {
            const status = await getSlackStatus(context);

            if (format === 'json') {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(status, null, 2),
                  },
                ],
              };
            } else {
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
            }
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error}` }],
              isError: true,
            };
          }
        },
      );

      // Add a simple prompt for demonstration
      server.prompt('help', {}, () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You can use the following tools:
              - search: Search Slack with a query string and optional count.
                Can return formatted markdown (default) or JSON with 'format' parameter.
              - set_status: Set your Slack status with text, optional emoji, and optional duration.
                Can return formatted markdown (default) or JSON with 'format' parameter.
              - get_status: Get your current Slack status.
                Can return formatted markdown (default) or JSON with 'format' parameter.
              - my_messages: Generate a summary of your Slack activity for a given time period.
                Options include username, since (YYYY-MM-DD), until (YYYY-MM-DD), and count.
                Can return formatted markdown (default) or JSON with 'format' parameter.`,
            },
          },
        ],
      }));

      const transport = new StdioServerTransport();
      await server.connect(transport);
    });
}
