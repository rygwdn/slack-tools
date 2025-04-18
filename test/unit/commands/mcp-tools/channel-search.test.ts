import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandContext } from '../../../../src/context';

// Mock the slack-api module before importing the module being tested
vi.mock('../../../../src/slack-api', () => ({
  getSlackClient: vi.fn().mockImplementation(() => ({
    conversations: {
      list: vi.fn((params) => {
        if (params.types === 'public_channel') {
          return Promise.resolve({
            ok: true,
            channels: [
              {
                id: 'C12345',
                name: 'general',
                is_archived: false,
                is_private: false,
                num_members: 42,
                topic: { value: 'General discussion' },
                purpose: { value: 'Company-wide announcements and work-based matters' },
              },
              {
                id: 'C23456',
                name: 'random',
                is_archived: false,
                is_private: false,
                num_members: 35,
                topic: { value: 'Random discussions' },
                purpose: { value: 'Non-work banter and water cooler conversation' },
              },
              {
                id: 'C34567',
                name: 'dev-team',
                is_archived: false,
                is_private: false,
                num_members: 15,
                topic: { value: 'Development team discussions' },
                purpose: { value: 'For the development team' },
              },
            ],
          });
        } else if (params.types === 'private_channel') {
          return Promise.resolve({
            ok: true,
            channels: [
              {
                id: 'C45678',
                name: 'private-team',
                is_archived: false,
                is_private: true,
                num_members: 8,
                topic: { value: 'Private team discussions' },
                purpose: { value: 'Confidential team discussions' },
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, channels: [] });
      }),
    },
  })),
}));

// Import the module after mocking its dependencies
import { registerChannelSearchTool } from '../../../../src/commands/mcp-tools/channel-search';

describe('Channel Search MCP Tool', () => {
  let context: CommandContext;
  let mockServer: any;
  let toolHandler: (params: {query: string}) => Promise<any>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the MCP server
    mockServer = {
      tool: vi.fn((name, schema, handler) => {
        if (name === 'slack_channel_search') {
          toolHandler = handler;
        }
        return mockServer;
      }),
    };
    
    context = new CommandContext();
    context.workspace = 'test-workspace';
    
    // Register the tool
    registerChannelSearchTool(mockServer, context);
  });

  it('should register the slack_channel_search tool', () => {
    expect(mockServer.tool).toHaveBeenCalledWith(
      'slack_channel_search',
      expect.anything(),
      expect.any(Function)
    );
  });

  it('should search for channels properly', async () => {
    // Call the handler
    const result = await toolHandler({ query: 'team' });
    
    // Verify the result structure
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    
    // Verify the markdown content
    const markdownContent = result.content[0].text;
    expect(markdownContent).toContain('Channel Search Results');
    expect(markdownContent).toContain('#dev-team');
    expect(markdownContent).toContain('🔒 private-team');
    expect(markdownContent).toContain('in:dev-team');
    expect(markdownContent).toContain('in:private-team');
  });

  it('should handle empty query properly', async () => {
    const result = await toolHandler({ query: '' });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Please provide a search term');
  });

  it('should handle no matches gracefully', async () => {
    // Mock implementation for this test only
    const { getSlackClient } = await import('../../../../src/slack-api');
    vi.mocked(getSlackClient).mockImplementationOnce(() => ({
      conversations: {
        list: vi.fn(() => Promise.resolve({ ok: true, channels: [] })),
      },
    } as any));
    
    const result = await toolHandler({ query: 'nonexistent' });
    
    expect(result.content[0].text).toContain('No channels found');
  });

  it('should sort results properly', async () => {
    const result = await toolHandler({ query: 'team' });
    
    const markdownContent = result.content[0].text;
    
    // Test that both team channels appear in the results
    expect(markdownContent).toContain('dev-team');
    expect(markdownContent).toContain('private-team');
    
    // Verify that sorting is working (we know dev-team has more members)
    const devPosition = markdownContent.indexOf('dev-team');
    const privatePosition = markdownContent.indexOf('private-team');
    
    // Since dev-team has more members (15 vs 8), it should come first
    expect(devPosition).toBeLessThan(privatePosition);
  });

  it('should include proper search formats in results', async () => {
    const result = await toolHandler({ query: 'general' });
    
    const markdownContent = result.content[0].text;
    
    expect(markdownContent).toContain('in:general');
    expect(markdownContent).toContain('Search Format');
  });
});