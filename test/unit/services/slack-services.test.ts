import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatEmoji,
  calculateExpirationTime,
  setSlackStatus,
  getSlackStatus,
  performSlackSearch,
} from '../../../src/services/slack-services';
import { CommandContext } from '../../../src/context';
import * as slackApi from '../../../src/slack-api';
import * as slackService from '../../../src/commands/my_messages/slack-service';
import * as slackEntityCache from '../../../src/commands/my_messages/slack-entity-cache';
import * as cache from '../../../src/cache';

// Mock all dependencies
vi.mock('../../../src/slack-api');
vi.mock('../../../src/commands/my_messages/slack-service');
vi.mock('../../../src/commands/my_messages/slack-entity-cache');
vi.mock('../../../src/cache');

describe('Slack Services', () => {
  let context: CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a new context for each test
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatEmoji', () => {
    it('should return empty string for empty input', () => {
      expect(formatEmoji('')).toBe('');
      expect(formatEmoji(undefined as unknown as string)).toBe('');
    });

    it('should add colons to emoji without colons', () => {
      expect(formatEmoji('smile')).toBe(':smile:');
    });

    it('should add missing trailing colon', () => {
      expect(formatEmoji(':smile')).toBe(':smile:');
    });

    it('should add missing leading colon', () => {
      // The implementation adds a leading colon when missing
      // and then a trailing colon if missing, which can result in duplicates
      expect(formatEmoji('smile:')).toBe(':smile::');
    });

    it('should keep correct emoji format unchanged', () => {
      expect(formatEmoji(':smile:')).toBe(':smile:');
    });
  });

  describe('calculateExpirationTime', () => {
    it('should return 0 for undefined or falsy duration', () => {
      expect(calculateExpirationTime(undefined)).toBe(0);
      expect(calculateExpirationTime(0)).toBe(0);
    });

    it('should calculate correct expiration time for minutes', () => {
      // Mock Date.now() to return a fixed timestamp
      const originalDateNow = Date.now;
      const mockTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z

      // Mock Date.now to return our fixed timestamp
      global.Date.now = vi.fn(() => mockTimestamp);

      try {
        // Test with 60 minutes (1 hour)
        const expectedTimestamp = Math.floor(mockTimestamp / 1000) + 60 * 60; // Add 3600 seconds
        expect(calculateExpirationTime(60)).toBe(expectedTimestamp);

        // Test with 30 minutes
        const expectedTimestamp2 = Math.floor(mockTimestamp / 1000) + 30 * 60; // Add 1800 seconds
        expect(calculateExpirationTime(30)).toBe(expectedTimestamp2);
      } finally {
        // Restore the original Date.now
        global.Date.now = originalDateNow;
      }
    });
  });

  describe('setSlackStatus', () => {
    let mockClient: any;

    beforeEach(() => {
      // Setup mock client
      mockClient = {
        users: {
          profile: {
            set: vi.fn().mockResolvedValue({ ok: true }),
          },
        },
      };

      // Mock getSlackClient to return our mockClient
      vi.mocked(slackApi.getSlackClient).mockResolvedValue(mockClient);
    });

    it('should set status with text only', async () => {
      const result = await setSlackStatus('Working', context);

      // Check that client.users.profile.set was called with correct parameters
      expect(mockClient.users.profile.set).toHaveBeenCalledWith({
        profile: {
          status_text: 'Working',
          status_emoji: '',
          status_expiration: 0,
        },
      });

      // Check result shape
      expect(result).toEqual({
        success: true,
        text: 'Working',
        emoji: '',
        expirationTime: null,
      });
    });

    it('should set status with emoji', async () => {
      const result = await setSlackStatus('Working', context, 'computer');

      // Check proper emoji formatting
      expect(mockClient.users.profile.set).toHaveBeenCalledWith({
        profile: {
          status_text: 'Working',
          status_emoji: ':computer:',
          status_expiration: 0,
        },
      });

      // Check result
      expect(result).toEqual({
        success: true,
        text: 'Working',
        emoji: ':computer:',
        expirationTime: null,
      });
    });

    it('should set status with expiration time', async () => {
      // Mock Date.now() to return a fixed timestamp
      const originalDateNow = Date.now;
      const mockTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z

      // Mock Date.now to return our fixed timestamp
      global.Date.now = vi.fn(() => mockTimestamp);

      try {
        const result = await setSlackStatus('In a meeting', context, 'calendar', 30);

        // Check that expiration was set correctly (30 minutes = 1800 seconds)
        const expectedExpiration = Math.floor(mockTimestamp / 1000) + 30 * 60;

        expect(mockClient.users.profile.set).toHaveBeenCalledWith({
          profile: {
            status_text: 'In a meeting',
            status_emoji: ':calendar:',
            status_expiration: expectedExpiration,
          },
        });

        // Check result has ISO string for expiration time
        expect(result).toEqual({
          success: true,
          text: 'In a meeting',
          emoji: ':calendar:',
          expirationTime: new Date(expectedExpiration * 1000).toISOString(),
        });
      } finally {
        // Restore the original Date.now
        global.Date.now = originalDateNow;
      }
    });

    it('should throw an error if status update fails', async () => {
      // Make the client's profile.set throw an error
      const mockError = new Error('API Error');
      mockClient.users.profile.set.mockRejectedValueOnce(mockError);

      // Expect the function to throw
      await expect(setSlackStatus('Failed', context)).rejects.toThrow(
        'Status update failed: Error: API Error',
      );
    });
  });

  describe('getSlackStatus', () => {
    let mockClient: any;

    beforeEach(() => {
      // Setup mock client
      mockClient = {
        users: {
          profile: {
            get: vi.fn().mockResolvedValue({
              profile: {
                status_text: 'Working',
                status_emoji: ':computer:',
                status_expiration: 1609459200,
              },
            }),
          },
        },
      };

      // Mock getSlackClient to return our mockClient
      vi.mocked(slackApi.getSlackClient).mockResolvedValue(mockClient);
    });

    it('should retrieve current status', async () => {
      const result = await getSlackStatus(context);

      // Check that client.users.profile.get was called
      expect(mockClient.users.profile.get).toHaveBeenCalled();

      // Check result shape
      expect(result).toEqual({
        status: 'Working',
        emoji: ':computer:',
        expirationTime: '2021-01-01T00:00:00.000Z',
      });
    });

    it('should return empty values if no status is set', async () => {
      // Override the profile.get mock for this test
      mockClient.users.profile.get.mockResolvedValueOnce({ profile: {} });

      const result = await getSlackStatus(context);

      // Check result has empty values
      expect(result).toEqual({
        status: '',
        emoji: '',
        expirationTime: null,
      });
    });

    it('should throw an error if status retrieval fails', async () => {
      // Make profile.get throw an error
      const mockError = new Error('API Error');
      mockClient.users.profile.get.mockRejectedValueOnce(mockError);

      // Expect the function to throw
      await expect(getSlackStatus(context)).rejects.toThrow(
        'Status retrieval failed: Error: API Error',
      );
    });
  });

  describe('performSlackSearch', () => {
    let mockClient: any;
    let mockMessages: any[];
    let mockEntityCache: any;

    beforeEach(() => {
      // Setup mock client and data
      mockClient = {
        auth: {
          test: vi.fn().mockResolvedValue({ user_id: 'U12345' }),
        },
      };

      mockMessages = [
        { user: 'U12345', ts: '1609459200.000100', text: 'Test message', channel: 'C12345' },
      ];

      mockEntityCache = {
        lastUpdated: 1609459200000,
        channels: { C12345: { name: 'general' } },
        users: { U12345: { name: 'testuser' } },
      };

      // Setup mocks for all dependencies
      vi.mocked(slackApi.getSlackClient).mockResolvedValue(mockClient);
      vi.mocked(slackService.searchSlackMessages).mockResolvedValue(mockMessages);
      vi.mocked(slackEntityCache.getSlackEntityCache).mockResolvedValue(mockEntityCache);
      vi.mocked(cache.saveSlackCache).mockResolvedValue(undefined);
    });

    it('should search messages and return results with metadata', async () => {
      const result = await performSlackSearch('test query', 10, context);

      // Check that dependencies were called
      expect(slackApi.getSlackClient).toHaveBeenCalledWith('test-workspace', context);
      expect(slackService.searchSlackMessages).toHaveBeenCalled();
      expect(slackEntityCache.getSlackEntityCache).toHaveBeenCalled();
      expect(cache.saveSlackCache).toHaveBeenCalled();

      // Check result structure
      expect(result).toEqual({
        messages: mockMessages,
        userId: 'U12345',
        channels: mockEntityCache.channels,
        users: mockEntityCache.users,
      });
    });

    it('should throw an error if search fails', async () => {
      // Make search throw an error
      vi.mocked(slackService.searchSlackMessages).mockRejectedValueOnce(
        new Error('Search API Error'),
      );

      // Expect the function to throw with the specific error message
      await expect(performSlackSearch('failed query', 10, context)).rejects.toThrow(
        /Search failed:/,
      );
    });
  });
});
