import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMyMessagesSummary,
  MyMessagesOptions,
} from '../../../src/services/my-messages-service';
import { WebClient } from '@slack/web-api';
import * as dateUtils from '../../../src/utils/date-utils';
import * as slackApi from '../../../src/slack-api';
import * as keychain from '../../../src/auth/keychain';
import * as slackService from '../../../src/services/slack-services';
import * as formatters from '../../../src/commands/my_messages/formatters';
import { getCacheForMessages } from '../../../src/commands/my_messages/slack-entity-cache';
import { SlackCache } from '../../../src/commands/my_messages/types';
import { saveSlackCache } from '../../../src/cache';
import { SlackAuth } from '../../../src/types';

// Mock all the dependencies
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn(),
}));

vi.mock('../../../src/auth/keychain', () => ({
  getAuth: vi.fn(),
}));

vi.mock('../../../src/utils/date-utils', () => ({
  getDateRange: vi.fn(),
}));

vi.mock('../../../src/services/slack-services', () => ({
  myMessages: vi.fn(),
}));

vi.mock('../../../src/commands/my_messages/slack-entity-cache', () => ({
  getCacheForMessages: vi.fn(),
  getSlackEntityCache: vi.fn(),
}));

vi.mock('../../../src/commands/my_messages/formatters', () => ({
  generateMarkdown: vi.fn(),
  generateMarkdownWithObjectFormatter: vi.fn(),
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
  const mockAuth: SlackAuth = { token: 'test-token', cookie: 'test-cookie' };

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
      entities: {
        U123: { displayName: 'Test User', isBot: false, type: 'user' },
        C123: { displayName: 'general', type: 'channel', members: [] },
      },
      version: 1,
      lastUpdated: Date.now(),
    };

    // Mock markdown output
    mockMarkdown = '# My Messages Summary\n\nTest content';

    // Setup mocks
    vi.mocked(dateUtils.getDateRange).mockResolvedValue(mockDateRange);
    vi.mocked(keychain.getAuth).mockResolvedValue(mockAuth);
    vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    vi.mocked(slackService.myMessages).mockImplementation(async (_client, _dateRange, _count) => {
      return {
        messages: mockMessages,
        threadMessages: mockThreadMessages,
        mentionMessages: mockMentionMessages,
      };
    });
    vi.mocked(getCacheForMessages).mockResolvedValue(mockCache);
    vi.mocked(formatters.generateMarkdown).mockReturnValue(mockMarkdown);
    vi.mocked(saveSlackCache).mockResolvedValue(undefined);

    vi.mocked(slackApi.createWebClient).mockReset();
    vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);

    vi.mocked(keychain.getAuth).mockReset();
    vi.mocked(keychain.getAuth).mockResolvedValue(mockAuth);
  });

  it('should generate a my messages summary with default options', async () => {
    // Call the function
    const result = await generateMyMessagesSummary({ count: 200 });

    // Check if all the required functions were called
    expect(dateUtils.getDateRange).toHaveBeenCalledWith({ count: 200 });
    expect(keychain.getAuth).toHaveBeenCalled();
    // Check that createWebClient was called with the auth object
    expect(slackApi.createWebClient).toHaveBeenCalledWith(mockAuth);
    expect(slackService.myMessages).toHaveBeenCalledWith(mockClient, mockDateRange, 200);
    expect(getCacheForMessages).toHaveBeenCalledWith(mockClient, mockAllMessages);
    expect(formatters.generateMarkdown).toHaveBeenCalledWith(mockAllMessages, mockCache, 'U123');
    expect(saveSlackCache).toHaveBeenCalled();

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
      after: '2023-01-01',
      before: '2023-01-02',
      count: 50,
    };

    // Call the function
    const result = await generateMyMessagesSummary(customOptions);

    // Check if all the required functions were called with custom options
    expect(dateUtils.getDateRange).toHaveBeenCalledWith(customOptions);
    expect(slackService.myMessages).toHaveBeenCalledWith(expect.anything(), mockDateRange, 50);

    // Check the returned result
    expect(result).toHaveProperty('markdown', mockMarkdown);
  });

  it('should handle errors properly', async () => {
    // Setup error condition
    const testError = new Error('Test error');
    vi.mocked(dateUtils.getDateRange).mockRejectedValueOnce(testError);

    // Call the function and expect it to throw
    await expect(generateMyMessagesSummary({ count: 200 })).rejects.toThrow(testError);
  });

  it('should throw error if auth fails', async () => {
    const authError = new Error('Authentication required');
    vi.mocked(slackApi.createWebClient).mockRejectedValueOnce(authError);
    vi.mocked(keychain.getAuth).mockResolvedValue(mockAuth);

    const options: MyMessagesOptions = { timeRange: 'today' };

    await expect(generateMyMessagesSummary(options)).rejects.toThrow('Authentication required');

    expect(slackApi.createWebClient).toHaveBeenCalledWith(mockAuth);
  });
});
