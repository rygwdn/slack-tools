import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandContext } from '../../../../src/context';

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
import { registerUserSearchTool } from '../../../../src/commands/mcp-tools/user-search';

describe('User Search MCP Tool', () => {
  let context: CommandContext;
  let mockServer: any;
  let toolHandler: (params: {query: string}) => Promise<any>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the MCP server
    mockServer = {
      tool: vi.fn((name, schema, handler) => {
        if (name === 'slack_user_search') {
          toolHandler = handler;
        }
        return mockServer;
      }),
    };
    
    context = new CommandContext();
    context.workspace = 'test-workspace';
    
    // Register the tool
    registerUserSearchTool(mockServer, context);
  });

  it('should register the slack_user_search tool', () => {
    expect(mockServer.tool).toHaveBeenCalledWith(
      'slack_user_search',
      expect.anything(),
      expect.any(Function)
    );
  });

  it('should search for users properly', async () => {
    // Call the handler
    const result = await toolHandler({ query: 'doe' });
    
    // Verify the result structure
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    
    // Verify the markdown content
    const markdownContent = result.content[0].text;
    expect(markdownContent).toContain('User Search Results');
    expect(markdownContent).toContain('@johndoe');
    expect(markdownContent).toContain('John Doe');
    expect(markdownContent).toContain('@janedoe');
    expect(markdownContent).toContain('Jane Doe');
  });

  it('should handle empty query properly', async () => {
    const result = await toolHandler({ query: '' });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Please provide a search term');
  });

  it('should handle no matches gracefully', async () => {
    // Replace the mock for this test only
    const { getSlackClient } = await import('../../../../src/slack-api');
    vi.mocked(getSlackClient).mockImplementationOnce(() => ({
      users: {
        list: vi.fn().mockResolvedValue({
          ok: true,
          members: [],
        }),
      },
    } as any));
    
    const result = await toolHandler({ query: 'nonexistent' });
    
    expect(result.content[0].text).toContain('No users found');
  });

  it('should include proper search formats in results', async () => {
    const result = await toolHandler({ query: 'doe' });
    
    const markdownContent = result.content[0].text;
    
    // Check for display names with spaces (quoted format)
    expect(markdownContent).toContain('from:"John Doe"');
    expect(markdownContent).toContain('from:"Jane Doe"');
  });
});