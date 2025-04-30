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
        // Ensure we have a valid workspace
        if (!context.hasWorkspace) {
          return {
            content: [{ type: 'text', text: 'Error: No Slack workspace specified.' }],
            isError: true,
          };
        }
        
        const workspace = context.workspace;
        context.debugLog(`Using workspace: ${workspace}`);
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
        context.debugLog(`Fetching users from Slack API with limit: ${limit}`);
        let response;
        try {
          response = await client.users.list({
            limit,
          });
          
          context.debugLog(`API response received: ${response.ok ? 'success' : 'failure'}`);
          context.debugLog(`Members found: ${response.members?.length || 0}`);
  
          if (!response.ok || !response.members) {
            return {
              content: [{ type: 'text', text: `Failed to retrieve user list from Slack. Response: ${JSON.stringify(response)}` }],
              isError: true,
            };
          }
        } catch (apiError) {
          context.debugLog(`API error: ${apiError}`);
          return {
            content: [{ type: 'text', text: `Error calling Slack API: ${apiError}` }],
            isError: true,
          };
        }

        // Filter users based on search term
        context.debugLog(`Filtering ${response.members.length} users for query: "${cleanQuery}"`);
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

        context.debugLog(`Found ${matchingUsers.length} users matching "${cleanQuery}"`);
        
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
