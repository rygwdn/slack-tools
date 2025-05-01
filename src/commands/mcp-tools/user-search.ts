import { z } from 'zod';
import { tool } from '../../types';
import { getSlackClient } from '../../slack-api';
import { GlobalContext } from '../../context';

// Define schema
const userSearchParams = z.object({
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
    .optional()
    .default(20)
    .describe('Maximum number of users to check for matches (1-100). Default is 20.'),
});

/**
 * Tool for searching Slack users by name or username
 */
export const userSearchTool = tool({
  name: 'slack_user_search',
  description: 'Search for Slack users by display name, real name, or username.',
  parameters: userSearchParams,
  annotations: {},
  execute: async ({ query, limit }) => {
    const client = await getSlackClient();

    const cleanQuery = query.trim().replace(/^@/, '');

    if (!cleanQuery) {
      return 'Please provide a search term to find users.';
    }

    GlobalContext.log.debug?.(`Fetching users from Slack API with limit: ${limit}`);
    let response;
    try {
      response = await client.users.list({
        limit: 200,
      });

      GlobalContext.log.debug?.(`API response received: ${response.ok ? 'success' : 'failure'}`);
      GlobalContext.log.debug?.(`Members found: ${response.members?.length || 0}`);

      if (!response.ok || !response.members) {
        return `Failed to retrieve user list from Slack. Response: ${JSON.stringify(response)}`;
      }
    } catch (apiError) {
      GlobalContext.log.debug?.(`API error: ${apiError}`);
      return `Error calling Slack API: ${apiError}`;
    }

    GlobalContext.log.debug?.(
      `Filtering ${response.members.length} users for query: "${cleanQuery}"`,
    );
    const matchingUsers = response.members.filter((user) => {
      if (user.deleted || user.is_bot) return false;
      return (
        user.profile?.display_name?.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        user.profile?.real_name?.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(cleanQuery.toLowerCase())
      );
    });

    GlobalContext.log.debug?.(`Found ${matchingUsers.length} users matching "${cleanQuery}"`);

    if (matchingUsers.length === 0) {
      return `No users found matching "${query}".`;
    }

    const formattedResults = matchingUsers.map((user) => {
      const displayName = user.profile?.display_name || '';
      const realName = user.profile?.real_name || '';
      const username = user.name || '';
      const usernameWithAt = `@${username}`;
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

    formattedResults.sort((a, b) => {
      if (a.username.toLowerCase() === `@${cleanQuery.toLowerCase()}`) return -1;
      if (b.username.toLowerCase() === `@${cleanQuery.toLowerCase()}`) return 1;
      if (a.display_name.toLowerCase() === cleanQuery.toLowerCase()) return -1;
      if (b.display_name.toLowerCase() === cleanQuery.toLowerCase()) return 1;
      return a.display_name.localeCompare(b.display_name);
    });

    const limitedResults = formattedResults.slice(0, limit);

    let markdown = `## User Search Results for "${query}" (Top ${limitedResults.length})\n\n`;
    markdown += '| User | Display Name | Search Format |\n';
    markdown += '|------|-------------|---------------|\n';

    limitedResults.forEach((user) => {
      markdown += `| ${user.username} | ${user.display_name || user.real_name} | \`${user.search_format}\` |\n`;
    });

    markdown += `\n*Found ${matchingUsers.length} total matching users. Showing top ${limitedResults.length}.*\n`;
    markdown +=
      '\nTo search for messages from these users, use the search format in the slack_search tool.';

    return markdown;
  },
});
