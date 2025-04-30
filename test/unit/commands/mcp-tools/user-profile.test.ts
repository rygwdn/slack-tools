import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userProfileTool } from '../../../../src/commands/mcp-tools/user-profile';
import * as slackServices from '../../../../src/services/slack-services';

vi.mock('@slack/web-api');
vi.mock('../../../../src/context');
vi.mock('../../../../src/services/slack-services');

describe('User Profile MCP Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct tool definition', () => {
    expect(userProfileTool.name).toEqual('slack_get_user_profile');
    expect(userProfileTool.description).toBeTruthy();
    expect(userProfileTool.parameters).toBeDefined();
  });

  it('should return formatted user profile when executed', async () => {
    vi.mocked(slackServices.getUserProfile).mockResolvedValue({
      userId: 'U12345',
      username: 'testuser',
      displayName: 'Test User',
      realName: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      status: {
        text: 'Working :computer:',
        emoji: ':computer:',
        expiration: null,
      },
      title: 'Software Engineer',
      teamId: 'T12345',
      timezone: 'America/Los_Angeles',
      timezoneLabel: 'Pacific Standard Time',
      isAdmin: true,
      isOwner: false,
      updated: '2023-01-01',
      avatarUrl: 'https://example.com/avatar.png',
      isBot: false,
      isRestricted: false,
      isUltraRestricted: false,
    });

    const result = await userProfileTool.execute({ user_id: 'U12345' }, vi.fn()() as any);

    expect(result).toContain('## Slack User Profile: Test User');
    expect(result).toContain('- **User ID:** `U12345`');
    expect(result).toContain('- **Username:** @testuser');
    expect(result).toContain('- **Email:** test@example.com');
    expect(result).toContain('- **Phone:** 123-456-7890');
    expect(result).toContain('- **Job Title:** Software Engineer');
    expect(result).toContain('- **Current Status:** Working :computer:');
    expect(result).toContain('- **Timezone:** America/Los_Angeles (Pacific Standard Time)');
    expect(result).toContain('- **Roles:** Admin');
  });

  it('should throw an error when API call fails', async () => {
    vi.mocked(slackServices.getUserProfile).mockRejectedValueOnce(new Error('User not found'));

    await expect(userProfileTool.execute({ user_id: 'U99999' }, vi.fn()() as any)).rejects.toThrow(
      'User not found',
    );
  });
});
