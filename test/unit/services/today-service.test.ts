import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTodaySummary } from '../../../src/services/today-service';
import { CommandContext } from '../../../src/context';
import { getSlackClient } from '../../../src/slack-api';
import { getDateRange } from '../../../src/commands/today/utils';
import { searchMessages } from '../../../src/commands/today/slack-service';
import { getSlackEntityCache } from '../../../src/commands/today/slack-entity-cache';
import { generateMarkdown } from '../../../src/commands/today/formatters';
import { saveSlackCache } from '../../../src/cache';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { WebClient } from '@slack/web-api';

// Mock all the dependencies
vi.mock('../../../src/slack-api', () => ({
  getSlackClient: vi.fn(),
}));

vi.mock('../../../src/commands/today/utils', () => ({
  getDateRange: vi.fn(),
}));

vi.mock('../../../src/commands/today/slack-service', () => ({
  searchMessages: vi.fn(),
}));

vi.mock('../../../src/commands/today/slack-entity-cache', () => ({
  getSlackEntityCache: vi.fn(),
}));

vi.mock('../../../src/commands/today/formatters', () => ({
  generateMarkdown: vi.fn(),
}));

vi.mock('../../../src/cache', () => ({
  saveSlackCache: vi.fn(),
}));

describe('Today Service', () => {
  let context: CommandContext;
  let mockClient: WebClient;
  let mockDateRange: { startTime: Date; endTime: Date };
  let mockMessages: Match[];
  let mockThreadMessages: Match[];
  let mockMentionMessages: Match[];
  let mockCache: any;
  let mockMarkdown: string;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Setup context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    // Setup mock data
    mockClient = {
      auth: {
        test: vi.fn().mockResolvedValue({
          user_id: 'U123',
          user: 'testuser',
        }),
      },
    } as unknown as WebClient;

    mockDateRange = {
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-01'),
    };

    mockMessages = [{ ts: '1', text: 'Test message' }];
    mockThreadMessages = [{ ts: '2', text: 'Thread message' }];
    mockMentionMessages = [{ ts: '3', text: 'Mention message' }];

    mockCache = {
      users: { U123: { displayName: 'Test User', isBot: false } },
      channels: { C123: { displayName: 'general', type: 'channel' } },
      lastUpdated: Date.now(),
    };

    mockMarkdown = '# Today Summary\n\nTest content';

    // Setup mock return values
    vi.mocked(getSlackClient).mockResolvedValue(mockClient);
    vi.mocked(getDateRange).mockResolvedValue(mockDateRange);
    vi.mocked(searchMessages).mockResolvedValue({
      messages: mockMessages,
      threadMessages: mockThreadMessages,
      mentionMessages: mockMentionMessages,
    });
    vi.mocked(getSlackEntityCache).mockResolvedValue(mockCache);
    vi.mocked(generateMarkdown).mockReturnValue(mockMarkdown);
    vi.mocked(saveSlackCache).mockResolvedValue(undefined);
  });

  it('should generate a today summary with default options', async () => {
    // Call the function
    const result = await generateTodaySummary({ count: 200 }, context);

    // Verify all the functions were called with correct arguments
    expect(getSlackClient).toHaveBeenCalledWith('test-workspace', context);
    expect(getDateRange).toHaveBeenCalledWith({ count: 200 }, context);
    expect(searchMessages).toHaveBeenCalledWith(
      mockClient,
      'testuser',
      mockDateRange,
      200,
      context,
    );
    expect(getSlackEntityCache).toHaveBeenCalledWith(
      mockClient,
      [...mockMessages, ...mockThreadMessages, ...mockMentionMessages],
      context,
    );
    expect(generateMarkdown).toHaveBeenCalledWith(
      [...mockMessages, ...mockThreadMessages, ...mockMentionMessages],
      mockCache,
      'U123',
      context,
    );
    expect(saveSlackCache).toHaveBeenCalledWith(mockCache);

    // Verify the return value
    expect(result).toEqual({
      markdown: mockMarkdown,
      allMessages: [...mockMessages, ...mockThreadMessages, ...mockMentionMessages],
      userId: 'U123',
      dateRange: mockDateRange,
      cache: mockCache,
    });
  });

  it('should generate a today summary with custom options', async () => {
    // Call the function with custom options
    const customOptions = {
      username: 'customuser',
      since: '2023-01-01',
      until: '2023-01-02',
      count: 100,
    };

    const result = await generateTodaySummary(customOptions, context);

    // Verify options were passed correctly
    expect(getDateRange).toHaveBeenCalledWith(customOptions, context);
    expect(searchMessages).toHaveBeenCalledWith(
      mockClient,
      'customuser', // Should use the custom username
      mockDateRange,
      100, // Should use the custom count
      context,
    );

    // Other verifications remain the same
    expect(result.markdown).toBe(mockMarkdown);
  });

  it('should handle errors properly', async () => {
    // Setup error condition
    const testError = new Error('Test error');
    vi.mocked(searchMessages).mockRejectedValueOnce(testError);

    // Call the function and expect it to throw
    await expect(generateTodaySummary({ count: 200 }, context)).rejects.toThrow(testError);
  });
});
