import { z } from 'zod';
import { tool } from '../../types';
import { getUserProfile } from '../../services/slack-services';
import { objectToMarkdown } from '../../utils/markdown-utils';

const userProfileParams = z.object({
  user_id: z
    .string()
    .describe(
      'Slack user ID to get profile information for. Must start with "U" followed by alphanumeric characters.',
    ),
});

export const userProfileTool = tool({
  name: 'slack_get_user_profile',
  description: 'Fetch detailed profile information for a specific Slack user by their ID.',
  parameters: userProfileParams,
  annotations: {
    openWorldHint: true,
    readOnlyHint: true,
    title: 'Get Slack User Profile',
  },
  execute: async ({ user_id }) => {
    const profile = await getUserProfile(user_id);

    return objectToMarkdown({
      [`User Profile: ${profile.displayName}`]: {
        'Basic Information': {
          'User ID': `\`${profile.userId}\``,
          Username: `@${profile.username}`,
          'Display Name': profile.displayName || '',
          'Real Name': profile.realName || 'Not set',
          'Job Title': profile.title || 'Not set',
          Email: profile.email || 'Not available',
          Phone: profile.phone || 'Not set',
        },
        Status: {
          'Current Status': `${profile.status.text ? profile.status.text : 'No status set'} ${profile.status.emoji || ''}`,
          'Status Expiration': profile.status.expiration || '',
        },
        'Account Information': {
          'Team ID': profile.teamId || 'Unknown',
          Timezone: `${profile.timezone || 'Unknown'} (${profile.timezoneLabel || ''})`,
          'Account Type': profile.isBot ? 'Bot' : 'User',
        },
        'Profile Image': {
          'Avatar URL': profile.avatarUrl || 'Not available',
        },
      },
    });
  },
});
