import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { getSlackClient } from '../../slack-api';

export function registerUserSearchTool(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_user_search',
    {
      query: z
        .string()
        .describe(
          'A search term to find Slack users. Can be a display name, username, or partial match.',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .describe('Maximum number of users to return in the results.'),
    },
    async ({ query, limit }) => {
      try {
        // Get workspace and client
        const workspace = context.workspace;
        const client = await getSlackClient(workspace, context);

        // Clean the query
        const cleanQuery = query.trim().replace(/^@/, '');

        if (!cleanQuery) {
          return {
            content: [{ type: 'text', text: 'Please provide a search term to find users.' }],
            isError: true,
          };
        }

        // Get list of users
        const response = await client.users.list({
          limit,
        });

        if (!response.ok || !response.members) {
          return {
            content: [{ type: 'text', text: 'Failed to retrieve user list from Slack.' }],
            isError: true,
          };
        }

        // Filter users based on search term
        const matchingUsers = response.members.filter((user) => {
          // Skip deleted and bot users
          if (user.deleted || user.is_bot) return false;

          // Search in display name, real name, and username
          return (
            user.profile?.display_name?.toLowerCase().includes(cleanQuery.toLowerCase()) ||
            user.profile?.real_name?.toLowerCase().includes(cleanQuery.toLowerCase()) ||
            user.name?.toLowerCase().includes(cleanQuery.toLowerCase())
          );
        });

        if (matchingUsers.length === 0) {
          return {
            content: [{ type: 'text', text: `No users found matching "${query}".` }],
          };
        }

        // Format the results
        const formattedResults = matchingUsers.map((user) => {
          const displayName = user.profile?.display_name || '';
          const realName = user.profile?.real_name || '';
          const username = user.name || '';
          const usernameWithAt = `@${username}`;

          // For display names with spaces, show the quoted version
          const searchFormat = displayName.includes(' ')
            ? `from:"${displayName}"`
            : `from:${usernameWithAt}`;

          return {
            id: user.id,
            username: usernameWithAt,
            display_name: displayName,
            real_name: realName,
            search_format: searchFormat,
          };
        });

        // Sort results - exact matches first, then by display name
        formattedResults.sort((a, b) => {
          // Exact match on username goes first
          if (a.username.toLowerCase() === `@${cleanQuery.toLowerCase()}`) return -1;
          if (b.username.toLowerCase() === `@${cleanQuery.toLowerCase()}`) return 1;

          // Exact match on display name goes next
          if (a.display_name.toLowerCase() === cleanQuery.toLowerCase()) return -1;
          if (b.display_name.toLowerCase() === cleanQuery.toLowerCase()) return 1;

          // Otherwise sort alphabetically
          return a.display_name.localeCompare(b.display_name);
        });

        // Create markdown output
        let markdown = `## User Search Results for "${query}"\n\n`;
        markdown += '| User | Display Name | Search Format |\n';
        markdown += '|------|-------------|---------------|\n';

        formattedResults.forEach((user) => {
          markdown += `| ${user.username} | ${user.display_name || user.real_name} | \`${user.search_format}\` |\n`;
        });

        markdown += `\n*Found ${formattedResults.length} matching users*\n`;
        markdown +=
          '\nTo search for messages from these users, use the search format in the slack_search tool.';

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
          content: [{ type: 'text', text: `Error searching for users: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
