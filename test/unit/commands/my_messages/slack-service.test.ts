import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchMessages,
  searchSlackMessages,
} from '../../../../src/commands/my_messages/slack-service';
import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import * as dateUtils from '../../../../src/utils/date-utils';
import { GlobalContext } from '../../../../src/context';

vi.mock('../../../../src/utils/date-utils', () => ({
  formatDateForSearch: vi.fn(),
  getDayAfter: vi.fn(),
  getDayBefore: vi.fn(),
}));

describe('Slack Service', () => {
  let mockClient: WebClient;

  beforeEach(() => {
    mockClient = {
      search: {
        messages: vi.fn(),
      },
    } as unknown as WebClient;

    // Mock the date utility functions to return predictable values
    vi.mocked(dateUtils.getDayBefore).mockImplementation(
      (date) => new Date(date.getTime() - 86400000),
    ); // -1 day
    vi.mocked(dateUtils.getDayAfter).mockImplementation(
      (date) => new Date(date.getTime() + 86400000),
    ); // +1 day
    vi.mocked(dateUtils.formatDateForSearch).mockImplementation((date) => {
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
        ok: true,
        messages: {
          matches: mockMatches,
        },
      };

      vi.mocked(mockClient.search.messages).mockResolvedValueOnce(mockResponse);

      // Execute the search
      const query = 'test query';
      const count = 50;
      const result = await searchSlackMessages(mockClient, query, count);

      // Verify the API was called correctly
      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query,
        sort: 'timestamp',
        sort_dir: 'asc',
        count,
      });

      // Verify the results
      expect(result).toEqual(mockMatches);
      expect(GlobalContext.log.debug).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      // Setup empty response
      const mockResponse = {
        ok: true,
        messages: {
          matches: [],
        },
      };

      vi.mocked(mockClient.search.messages).mockResolvedValueOnce(mockResponse);

      // Execute the search
      const result = await searchSlackMessages(mockClient, 'test query', 50);

      // Verify we get an empty array, not undefined
      expect(result).toEqual([]);
    });

    it('should handle undefined matches', async () => {
      // Setup a response with no matches property
      const mockResponse = {
        ok: true,
        messages: {},
      };

      vi.mocked(mockClient.search.messages).mockResolvedValueOnce(mockResponse);

      // Execute the search
      const result = await searchSlackMessages(mockClient, 'test query', 50);

      // Verify we get an empty array when matches is undefined
      expect(result).toEqual([]);
    });

    it('should throw an error when the API request fails', async () => {
      // Setup API error
      const errorMessage = 'API request failed';
      vi.mocked(mockClient.search.messages).mockRejectedValueOnce(new Error(errorMessage));

      // Execute the search and expect it to throw
      await expect(searchSlackMessages(mockClient, 'test query', 50)).rejects.toThrow(errorMessage);

      // Verify debug log was called
      expect(GlobalContext.log.debug).toHaveBeenCalled();
    });
  });

  describe('searchMessages', () => {
    it('should search for messages from the user, threads, and mentions', async () => {
      // Setup mock responses for each search
      const searchMatches: Match[] = [{ ts: '1', text: 'Search match' }];
      const threadMatches: Match[] = [{ ts: '2', text: 'Thread match' }];
      const mentionMatches: Match[] = [{ ts: '3', text: 'Mention match' }];

      // We need to mock searchSlackMessages since that's the function we're testing that calls it
      vi.spyOn({ searchSlackMessages }, 'searchSlackMessages').mockImplementation(
        async (_client, query) => {
          // Return different matches based on the query content
          if (query.includes('from:testuser')) {
            return searchMatches;
          } else if (query.includes('is:thread with:testuser')) {
            return threadMatches;
          } else if (query.includes('to:testuser')) {
            return mentionMatches;
          }
          return [];
        },
      );

      // Mock the actual WebClient search.messages for validation
      vi.mocked(mockClient.search.messages).mockImplementation(async ({ query }) => {
        return {
          ok: true,
          messages: {
            matches: query.includes('from:testuser')
              ? searchMatches
              : query.includes('is:thread with:testuser')
                ? threadMatches
                : query.includes('to:testuser')
                  ? mentionMatches
                  : [],
          },
        };
      });

      // Setup date range
      const startTime = new Date('2023-01-01');
      const endTime = new Date('2023-01-01');

      // Execute the search
      const result = await searchMessages(mockClient, 'testuser', { startTime, endTime }, 50);

      // Verify the API calls
      expect(dateUtils.getDayBefore).toHaveBeenCalledWith(startTime);
      expect(dateUtils.getDayAfter).toHaveBeenCalledWith(endTime);
      expect(dateUtils.formatDateForSearch).toHaveBeenCalledTimes(2);

      // Verify the queries are being constructed correctly
      const debugCalls = vi.mocked(GlobalContext.log.debug).mock.calls.map((call) => call[0]);
      expect(debugCalls.some((call) => (call as string).includes('from:testuser'))).toBe(true);
      expect(debugCalls.some((call) => (call as string).includes('to:testuser'))).toBe(true);

      // Verify the combined results
      expect(result.messages).toEqual(searchMatches);
      expect(result.threadMessages).toEqual(threadMatches);
      expect(result.mentionMessages).toEqual(mentionMatches);
    });
  });
});
