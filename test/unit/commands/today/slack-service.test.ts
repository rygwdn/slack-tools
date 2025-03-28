import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMessages, searchSlackMessages } from '../../../../src/commands/today/slack-service';
import { CommandContext } from '../../../../src/context';
import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import * as utils from '../../../../src/commands/today/utils';

// Mock dependencies
vi.mock('../../../../src/commands/today/utils', () => ({
  formatDateForSearch: vi.fn(),
  getDayAfter: vi.fn(),
  getDayBefore: vi.fn(),
}));

describe('Slack Service', () => {
  let context: CommandContext;
  let mockClient: WebClient;

  beforeEach(() => {
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    // Create a mock WebClient
    mockClient = {
      search: {
        messages: vi.fn(),
      },
    } as unknown as WebClient;

    // Mock the date utility functions to return predictable values
    vi.mocked(utils.getDayBefore).mockImplementation((date) => new Date(date.getTime() - 86400000)); // -1 day
    vi.mocked(utils.getDayAfter).mockImplementation((date) => new Date(date.getTime() + 86400000)); // +1 day
    vi.mocked(utils.formatDateForSearch).mockImplementation((date) => {
      return date.toISOString().split('T')[0]; // Simple YYYY-MM-DD format
    });
  });

  describe('searchSlackMessages', () => {
    it('should search Slack for messages and return matches', async () => {
      // Setup mock response
      const mockMatches: Match[] = [
        {
          ts: '1609459200.000000',
          text: 'Test message',
          user: 'U123',
          channel: { id: 'C123' },
        },
      ];

      const mockResponse = {
        messages: {
          matches: mockMatches,
        },
      };

      vi.mocked(mockClient.search.messages).mockResolvedValueOnce(mockResponse);

      // Execute the search
      const query = 'test query';
      const count = 50;
      const result = await searchSlackMessages(mockClient, query, count, context);

      // Verify the API was called correctly
      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query,
        sort: 'timestamp',
        sort_dir: 'asc',
        count,
      });

      // Verify the results
      expect(result).toEqual(mockMatches);
      expect(context.debugLog).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      // Setup empty response
      const mockResponse = {
        messages: {
          matches: [],
        },
      };

      vi.mocked(mockClient.search.messages).mockResolvedValueOnce(mockResponse);

      // Execute the search
      const result = await searchSlackMessages(mockClient, 'test query', 50, context);

      // Verify we get an empty array, not undefined
      expect(result).toEqual([]);
    });

    it('should handle undefined matches', async () => {
      // Setup a response with no matches property
      const mockResponse = {
        messages: {},
      };

      vi.mocked(mockClient.search.messages).mockResolvedValueOnce(mockResponse);

      // Execute the search
      const result = await searchSlackMessages(mockClient, 'test query', 50, context);

      // Verify we get an empty array when matches is undefined
      expect(result).toEqual([]);
    });

    it('should throw an error when the API request fails', async () => {
      // Setup API error
      const errorMessage = 'API request failed';
      vi.mocked(mockClient.search.messages).mockRejectedValueOnce(new Error(errorMessage));

      // Execute the search and expect it to throw
      await expect(searchSlackMessages(mockClient, 'test query', 50, context)).rejects.toThrow(
        `Failed to search Slack: Error: ${errorMessage}`,
      );

      // Verify debug log was called
      expect(context.debugLog).toHaveBeenCalled();
    });
  });

  describe('searchMessages', () => {
    it('should search for messages from the user, threads, and mentions', async () => {
      // Setup mock responses for each search
      const searchMatches: Match[] = [{ ts: '1', text: 'Search match' }];
      const threadMatches: Match[] = [{ ts: '2', text: 'Thread match' }];
      const mentionMatches: Match[] = [{ ts: '3', text: 'Mention match' }];

      // Mock the searchSlackMessages calls
      const searchSlackMessagesSpy = vi.spyOn(mockClient.search, 'messages');

      // First call will be from:user
      searchSlackMessagesSpy.mockResolvedValueOnce({
        messages: { matches: searchMatches },
      });

      // Second call will be is:thread with:user
      searchSlackMessagesSpy.mockResolvedValueOnce({
        messages: { matches: threadMatches },
      });

      // Third call will be to:user
      searchSlackMessagesSpy.mockResolvedValueOnce({
        messages: { matches: mentionMatches },
      });

      // Setup date range
      const startTime = new Date('2023-01-01');
      const endTime = new Date('2023-01-01');

      // Execute the search
      const result = await searchMessages(
        mockClient,
        'testuser',
        { startTime, endTime },
        50,
        context,
      );

      // Verify the API calls
      expect(utils.getDayBefore).toHaveBeenCalledWith(startTime);
      expect(utils.getDayAfter).toHaveBeenCalledWith(endTime);
      expect(utils.formatDateForSearch).toHaveBeenCalledTimes(2);

      // Check that all three searches were executed
      expect(searchSlackMessagesSpy).toHaveBeenCalledTimes(3);

      // Check the search queries
      expect(searchSlackMessagesSpy.mock.calls[0][0].query).toContain('from:testuser');
      expect(searchSlackMessagesSpy.mock.calls[1][0].query).toContain('is:thread with:testuser');
      expect(searchSlackMessagesSpy.mock.calls[2][0].query).toContain('to:testuser');

      // Verify the combined results
      expect(result.messages).toEqual(searchMatches);
      expect(result.threadMessages).toEqual(threadMatches);
      expect(result.mentionMessages).toEqual(mentionMatches);
    });

    it('should throw an error if username is not provided', async () => {
      // Setup date range
      const startTime = new Date('2023-01-01');
      const endTime = new Date('2023-01-01');

      // Execute the search with undefined username
      await expect(
        searchMessages(mockClient, undefined, { startTime, endTime }, 50, context),
      ).rejects.toThrow('Username is required for searching messages');
    });
  });
});
