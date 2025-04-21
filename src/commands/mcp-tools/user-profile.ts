import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CommandContext } from '../../context';
import { getUserProfile } from '../../services/slack-services';

export function registerUserProfileTool(server: McpServer, context: CommandContext): void {
  server.tool(
    'slack_get_user_profile',
    {
      user_id: z
        .string()
        .describe(
          'Slack user ID to get profile information for. Must start with "U" followed by alphanumeric characters.',
        ),
    },
    async ({ user_id }) => {
      try {
        const profile = await getUserProfile(user_id, context);

        // Format as markdown
        let markdown = `## Slack User Profile: ${profile.displayName}\n\n`;

        markdown += '### Basic Information\n';
        markdown += `- **User ID:** \`${profile.userId}\`\n`;
        markdown += `- **Username:** @${profile.username}\n`;
        markdown += `- **Display Name:** ${profile.displayName}\n`;
        markdown += `- **Real Name:** ${profile.realName || 'Not set'}\n`;
        markdown += `- **Job Title:** ${profile.title || 'Not set'}\n`;
        markdown += `- **Email:** ${profile.email || 'Not available'}\n`;
        markdown += `- **Phone:** ${profile.phone || 'Not set'}\n`;

        markdown += '\n### Status\n';
        markdown += `- **Current Status:** ${profile.status.text ? profile.status.text : 'No status set'} ${profile.status.emoji || ''}\n`;
        if (profile.status.expiration) {
          markdown += `- **Status Expiration:** ${profile.status.expiration}\n`;
        }

        markdown += '\n### Account Information\n';
        markdown += `- **Team ID:** ${profile.teamId || 'Unknown'}\n`;
        markdown += `- **Timezone:** ${profile.timezone || 'Unknown'} (${profile.timezoneLabel || ''})\n`;
        markdown += `- **Account Type:** ${profile.isBot ? 'Bot' : 'User'}\n`;

        if (profile.isAdmin || profile.isOwner) {
          const roles = [];
          if (profile.isOwner) roles.push('Owner');
          if (profile.isAdmin) roles.push('Admin');
          markdown += `- **Roles:** ${roles.join(', ')}\n`;
        }

        if (profile.isRestricted || profile.isUltraRestricted) {
          const restrictions = [];
          if (profile.isRestricted) restrictions.push('Restricted');
          if (profile.isUltraRestricted) restrictions.push('Ultra Restricted');
          markdown += `- **Restrictions:** ${restrictions.join(', ')}\n`;
        }

        markdown += `- **Last Updated:** ${profile.updated || 'Unknown'}\n`;

        if (profile.avatarUrl) {
          markdown += '\n### Profile Image\n';
          markdown += `![${profile.displayName}'s profile picture](${profile.avatarUrl})\n`;
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
          content: [{ type: 'text', text: `Error fetching user profile: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
