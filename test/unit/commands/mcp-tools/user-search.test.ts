import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the slack-api module before importing the module being tested
vi.mock('../../../../src/slack-api', () => ({
  getSlackClient: vi.fn().mockImplementation(() => ({
    users: {
      list: vi.fn().mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U123456',
            name: 'johndoe',
            deleted: false,
            is_bot: false,
            profile: {
              display_name: 'John Doe',
              real_name: 'John Doe Smith',
            },
          },
          {
            id: 'U234567',
            name: 'janedoe',
            deleted: false,
            is_bot: false,
            profile: {
              display_name: 'Jane Doe',
              real_name: 'Jane Doe Jones',
            },
          },
        ],
      }),
    },
  })),
}));

// Import the module after mocking its dependencies
import { userSearchTool } from '../../../../src/commands/mcp-tools/user-search';

describe('User Search MCP Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct tool definition', () => {
    // Check the tool properties
    expect(userSearchTool.name).toBe('slack_user_search');
    expect(userSearchTool.description).toBeTruthy();
    expect(userSearchTool.parameters).toBeDefined();
    expect(userSearchTool.execute).toBeInstanceOf(Function);
  });

  it('should search for users properly', async () => {
    // Call the execute function directly
    const result = await userSearchTool.execute({ query: 'doe', limit: 10 }, vi.fn()() as any);

    // Verify the markdown content
    expect(result).toContain('User Search Results');
    expect(result).toContain('@johndoe');
    expect(result).toContain('John Doe');
    expect(result).toContain('@janedoe');
    expect(result).toContain('Jane Doe');
  });

  it('should handle empty query properly', async () => {
    // Call the execute function directly
    const result = await userSearchTool.execute({ query: '', limit: 10 }, vi.fn()() as any);

    expect(result).toContain('Please provide a search term');
  });

  it('should handle no matches gracefully', async () => {
    // Replace the mock for this test only
    const { getSlackClient } = await import('../../../../src/slack-api');
    vi.mocked(getSlackClient).mockImplementationOnce(
      () =>
        ({
          users: {
            list: vi.fn().mockResolvedValue({
              ok: true,
              members: [],
            }),
          },
        }) as any,
    );

    // Call the execute function directly
    const result = await userSearchTool.execute(
      { query: 'nonexistent', limit: 10 },
      vi.fn()() as any,
    );

    expect(result).toContain('No users found');
  });

  it('should include proper search formats in results', async () => {
    // Call the execute function directly
    const result = await userSearchTool.execute({ query: 'doe', limit: 10 }, vi.fn()() as any);

    // Check for display names with spaces (quoted format)
    expect(result).toContain('from:"John Doe"');
    expect(result).toContain('from:"Jane Doe"');
  });
});
