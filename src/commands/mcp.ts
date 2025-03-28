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

export function registerMcpCommand(program: Command, context: CommandContext): void {
  program
    .command('mcp')
    .description('Start an MCP server with search and status capabilities')
    .action(async () => {
      const server = new McpServer({
        name: 'slack-tools-server',
        version: '1.0.0',
      });

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
        'set-status',
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
        'get-status',
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
              - set-status: Set your Slack status with text, optional emoji, and optional duration.
                Can return formatted markdown (default) or JSON with 'format' parameter.
              - get-status: Get your current Slack status.
                Can return formatted markdown (default) or JSON with 'format' parameter.`,
            },
          },
        ],
      }));

      console.log('Starting MCP server...');
      const transport = new StdioServerTransport();
      await server.connect(transport);
    });
}
