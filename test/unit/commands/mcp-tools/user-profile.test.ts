import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandContext } from '../../../../src/context';
import { registerUserProfileTool } from '../../../../src/commands/mcp-tools/user-profile';
import * as slackServices from '../../../../src/services/slack-services';

// Mock dependencies
vi.mock('../../../../src/services/slack-services');

describe('User Profile MCP Tool', () => {
  let server: any;
  let context: CommandContext;
  let mockProfile: any;

  beforeEach(() => {
    // Create a mock McpServer
    server = {
      tool: vi.fn(),
    };

    // Create a context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;

    // Mock console methods for debugging
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a mock profile response
    mockProfile = {
      userId: 'U12345',
      username: 'testuser',
      realName: 'Test User',
      displayName: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      title: 'Software Engineer',
      teamId: 'T12345',
      timezone: 'America/Los_Angeles',
      timezoneLabel: 'Pacific Standard Time',
      avatarUrl: 'https://example.com/profile.jpg',
      status: {
        text: 'Working',
        emoji: ':computer:',
        expiration: '2021-01-02T00:00:00.000Z',
      },
      isBot: false,
      isAdmin: true,
      isOwner: false,
      isRestricted: false,
      isUltraRestricted: false,
      updated: '2021-01-01T00:00:00.000Z',
    };

    // Mock getUserProfile
    vi.mocked(slackServices.getUserProfile).mockResolvedValue(mockProfile);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should register the user profile tool with the server', () => {
    registerUserProfileTool(server, context);

    // Check that server.tool was called with the right tool name
    expect(server.tool).toHaveBeenCalledWith(
      'slack_get_user_profile',
      expect.any(Object), // zod schema object
      expect.any(Function), // handler function
    );
  });

  it('should return formatted user profile when executed', async () => {
    // Register the tool to capture the handler
    registerUserProfileTool(server, context);

    // Extract the handler function that was passed to server.tool
    const handlerFn = server.tool.mock.calls[0][2];
    
    // Call the handler with a user ID
    const result = await handlerFn({ user_id: 'U12345' });

    // Verify getUserProfile was called with the right parameters
    expect(slackServices.getUserProfile).toHaveBeenCalledWith('U12345', context);

    // Check that the result contains a markdown text response
    expect(result.content[0].type).toBe('text');
    
    // Verify markdown content includes expected fields
    const markdown = result.content[0].text;
    expect(markdown).toContain('## Slack User Profile: Test User');
    expect(markdown).toContain('- **User ID:** `U12345`');
    expect(markdown).toContain('- **Username:** @testuser');
    expect(markdown).toContain('- **Email:** test@example.com');
    expect(markdown).toContain('- **Phone:** 123-456-7890');
    expect(markdown).toContain('- **Job Title:** Software Engineer');
    expect(markdown).toContain('- **Current Status:** Working :computer:');
    expect(markdown).toContain('- **Timezone:** America/Los_Angeles (Pacific Standard Time)');
    expect(markdown).toContain('- **Roles:** Admin');
  });

  it('should handle errors and return error response', async () => {
    // Make getUserProfile throw an error
    vi.mocked(slackServices.getUserProfile).mockRejectedValueOnce(
      new Error('User not found')
    );

    // Register the tool and extract handler
    registerUserProfileTool(server, context);
    const handlerFn = server.tool.mock.calls[0][2];
    
    // Call the handler
    const result = await handlerFn({ user_id: 'U99999' });

    // Check that it returns an error response
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error fetching user profile');
  });
});