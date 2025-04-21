import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { getSlackClient } from '../../slack-api';

export function registerChannelSearchTool(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_channel_search',
    {
      query: z
        .string()
        .describe('A search term to find Slack channels. Can be a channel name or partial match.'),
    },
    async ({ query }) => {
      try {
        // Get workspace and client
        const workspace = context.workspace;
        const client = await getSlackClient(workspace, context);

        // Clean the query - handle different formats:
        // 1. Regular channel name: #general -> general
        // 2. Channel ID: C12345 -> C12345
        // 3. Slack link format: <#C12345|general> -> C12345
        let cleanQuery = query.trim().replace(/^#/, '');

        // Extract channel ID from Slack link format <#C12345|channel-name>
        const channelLinkMatch = cleanQuery.match(/^<#(C[A-Z0-9]+)\|.+>$/);
        if (channelLinkMatch) {
          cleanQuery = channelLinkMatch[1]; // Use the channel ID
        }

        if (!cleanQuery) {
          return {
            content: [{ type: 'text', text: 'Please provide a search term to find channels.' }],
            isError: true,
          };
        }

        // Get list of channels (public and private)
        // Note: This will only include channels the user is a member of
        const publicChannels = await client.conversations.list({
          types: 'public_channel',
          exclude_archived: true,
          limit: 1000,
        });

        const privateChannels = await client.conversations.list({
          types: 'private_channel',
          exclude_archived: true,
          limit: 1000,
        });

        // Combine the channels
        const allChannels = [
          ...(publicChannels.channels || []),
          ...(privateChannels.channels || []),
        ];

        if (!allChannels.length) {
          return {
            content: [
              {
                type: 'text',
                text: "No channels found in the workspace or you don't have access to any channels.",
              },
            ],
            isError: true,
          };
        }

        // Filter channels based on search term
        const matchingChannels = allChannels.filter((channel) => {
          // Skip archived channels
          if (channel.is_archived) return false;

          // Check if we're searching by channel ID (starts with 'C')
          if (cleanQuery.match(/^C[A-Z0-9]+$/)) {
            return channel.id === cleanQuery;
          }

          // Otherwise search in channel name and topic/purpose if available
          return (
            (channel.name && channel.name.toLowerCase().includes(cleanQuery.toLowerCase())) ||
            (channel.topic?.value &&
              channel.topic.value.toLowerCase().includes(cleanQuery.toLowerCase())) ||
            (channel.purpose?.value &&
              channel.purpose.value.toLowerCase().includes(cleanQuery.toLowerCase()))
          );
        });

        if (matchingChannels.length === 0) {
          return {
            content: [{ type: 'text', text: `No channels found matching "${query}".` }],
          };
        }

        // Format the results
        const formattedResults = matchingChannels.map((channel) => {
          const channelName = channel.name || '';
          const channelId = channel.id || '';
          const isPrivate = channel.is_private || false;
          const memberCount = channel.num_members || 0;
          const topic = channel.topic?.value || '';

          // The format to use in search queries
          const nameSearchFormat = `in:${channelName}`;
          const idSearchFormat = `in:<#${channelId}>`;

          return {
            id: channelId,
            name: channelName,
            is_private: isPrivate,
            member_count: memberCount,
            topic: topic,
            name_search_format: nameSearchFormat,
            id_search_format: idSearchFormat,
          };
        });

        // Sort results - exact matches first, then by member count (more active channels first)
        formattedResults.sort((a, b) => {
          // Exact match on channel name goes first
          if (a.name.toLowerCase() === cleanQuery.toLowerCase()) return -1;
          if (b.name.toLowerCase() === cleanQuery.toLowerCase()) return 1;

          // Otherwise sort by member count (descending)
          return b.member_count - a.member_count;
        });

        // Create markdown output
        let markdown = `## Channel Search Results for "${query}"\n\n`;
        markdown += '| Channel | Members | Private | Search Format | ID Search Format | Topic |\n';
        markdown += '|---------|---------|---------|---------------|------------------|-------|\n';

        formattedResults.forEach((channel) => {
          const channelDisplay = channel.is_private ? '🔒 ' + channel.name : '#' + channel.name;
          const truncatedTopic =
            channel.topic.length > 30 ? channel.topic.substring(0, 30) + '...' : channel.topic;

          markdown += `| ${channelDisplay} | ${channel.member_count} | ${channel.is_private ? 'Yes' : 'No'} | \`${channel.name_search_format}\` | \`${channel.id_search_format}\` | ${truncatedTopic} |\n`;
        });

        markdown += `\n*Found ${formattedResults.length} matching channels*\n`;
        markdown +=
          '\nTo search for messages in these channels, use either search format in the slack_search tool:\n';
        markdown += '- Name format: `in:general hello` (works for public channels)\n';
        markdown +=
          "- ID format: `in:<#C12345> hello` (works for any channel you're a member of, including private channels)\n";
        markdown +=
          "\nNote: Channel searches using any format will only work for channels you're a member of.";

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
          content: [{ type: 'text', text: `Error searching for channels: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
