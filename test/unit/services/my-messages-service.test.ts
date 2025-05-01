import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMyMessagesSummary } from '../../../src/services/my-messages-service';
import { WebClient } from '@slack/web-api';
import { getDateRange } from '../../../src/utils/date-utils';
import { searchMessages } from '../../../src/commands/my_messages/slack-service';
import { getSlackEntityCache } from '../../../src/commands/my_messages/slack-entity-cache';
import { generateMarkdown } from '../../../src/commands/my_messages/formatters';
import { SlackCache } from '../../../src/commands/my_messages/types';
import { getSlackClient } from '../../../src/slack-api';
import { saveSlackCache } from '../../../src/cache';

// Mock all the dependencies
vi.mock('../../../src/slack-api', () => ({
  getSlackClient: vi.fn(),
}));

vi.mock('../../../src/utils/date-utils', () => ({
  getDateRange: vi.fn(),
}));

vi.mock('../../../src/commands/my_messages/slack-service', () => ({
  searchMessages: vi.fn(),
}));

vi.mock('../../../src/commands/my_messages/slack-entity-cache', () => ({
  getSlackEntityCache: vi.fn(),
}));

vi.mock('../../../src/commands/my_messages/formatters', () => ({
  generateMarkdown: vi.fn(),
}));

vi.mock('../../../src/cache', () => ({
  saveSlackCache: vi.fn(),
}));

describe('My Messages Service', () => {
  let mockClient: WebClient;
  let mockDateRange: { startTime: Date; endTime: Date };
  let mockCache: SlackCache;
  let mockMessages: any[];
  let mockThreadMessages: any[];
  let mockMentionMessages: any[];
  let mockAllMessages: any[];
  let mockMarkdown: string;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock objects
    mockClient = {
      auth: {
        test: vi.fn().mockResolvedValue({
          user_id: 'U123',
          user: 'testuser',
        }),
      },
    } as any;

    // Mock date range
    mockDateRange = {
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-01'),
    };

    // Mock messages
    mockMessages = [{ ts: '1', text: 'direct message' }];
    mockThreadMessages = [{ ts: '2', text: 'thread message' }];
    mockMentionMessages = [{ ts: '3', text: 'mention message' }];
    mockAllMessages = [...mockMessages, ...mockThreadMessages, ...mockMentionMessages];

    // Mock cache
    mockCache = {
      users: { U123: { displayName: 'Test User', isBot: false } },
      channels: { C123: { displayName: 'general', type: 'channel' } },
      lastUpdated: Date.now(),
    };

    // Mock markdown output
    mockMarkdown = '# My Messages Summary\n\nTest content';

    // Setup mocks
    vi.mocked(getSlackClient).mockResolvedValue(mockClient);
    vi.mocked(getDateRange).mockResolvedValue(mockDateRange);
    vi.mocked(searchMessages).mockImplementation(async (_client, _username, _dateRange, _count) => {
      return {
        messages: mockMessages,
        threadMessages: mockThreadMessages,
        mentionMessages: mockMentionMessages,
      };
    });
    vi.mocked(getSlackEntityCache).mockResolvedValue(mockCache);
    vi.mocked(generateMarkdown).mockReturnValue(mockMarkdown);
    vi.mocked(saveSlackCache).mockResolvedValue(undefined);
  });

  it('should generate a my messages summary with default options', async () => {
    // Call the function
    const result = await generateMyMessagesSummary({ count: 200 });

    // Check if all the required functions were called
    expect(getSlackClient).toHaveBeenCalledWith();
    expect(getDateRange).toHaveBeenCalledWith({ count: 200 });
    expect(searchMessages).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      mockDateRange,
      200,
    );
    expect(getSlackEntityCache).toHaveBeenCalledWith(mockClient, mockAllMessages);
    expect(generateMarkdown).toHaveBeenCalledWith(mockAllMessages, mockCache, 'U123');
    expect(saveSlackCache).toHaveBeenCalledWith(
      expect.objectContaining({ lastUpdated: expect.any(Number) }),
    );

    // Check the returned result
    expect(result).toEqual({
      markdown: mockMarkdown,
      allMessages: mockAllMessages,
      userId: 'U123',
      dateRange: mockDateRange,
      cache: mockCache,
    });
  });

  it('should generate a my messages summary with custom options', async () => {
    // Setup custom options
    const customOptions = {
      username: 'customuser',
      since: '2023-01-01',
      until: '2023-01-02',
      count: 50,
    };

    // Call the function
    const result = await generateMyMessagesSummary(customOptions);

    // Check if all the required functions were called with custom options
    expect(getDateRange).toHaveBeenCalledWith(customOptions);
    expect(searchMessages).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      mockDateRange,
      50,
    );

    // Check the returned result
    expect(result).toHaveProperty('markdown', mockMarkdown);
  });

  it('should handle errors properly', async () => {
    // Setup error condition
    const testError = new Error('Test error');
    vi.mocked(getDateRange).mockRejectedValueOnce(testError);

    // Call the function and expect it to throw
    await expect(generateMyMessagesSummary({ count: 200 })).rejects.toThrow(testError);
  });
});
