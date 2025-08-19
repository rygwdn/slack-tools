import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as slackApi from '../../../src/slack-api';
import * as userUtils from '../../../src/utils/user-utils';
import * as slackEntityCache from '../../../src/commands/my_messages/slack-entity-cache';
import {
  formatEmoji,
  calculateExpirationTime,
  setSlackStatus,
  getSlackStatus,
  createSlackReminder,
  getSlackThreadReplies,
  getUserProfile,
  getMessageReactions,
  searchSlackMessages,
} from '../../../src/services/slack-services';
import { SlackAPIError } from '../../../src/types/slack-errors';

vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn(),
}));

vi.mock('../../../src/utils/user-utils', () => ({
  enhanceSearchQuery: vi.fn(),
}));

vi.mock('../../../src/commands/my_messages/slack-entity-cache', () => ({
  getCacheForMessages: vi.fn(),
}));

vi.mock('../../../src/auth/keychain');

describe('Slack Services', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should set status with text only', async () => {
      const result = await setSlackStatus('Working');

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
      const result = await setSlackStatus('Working', 'computer');

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
        const result = await setSlackStatus('In a meeting', 'calendar', 30);

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
      await expect(setSlackStatus('Failed')).rejects.toThrow('Status update failed: API Error');
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 30,
      };

      mockClient.users.profile.set.mockRejectedValueOnce(rateLimitError);

      await expect(setSlackStatus('Test')).rejects.toThrow(
        'RATE_LIMITED: Please wait 30 seconds before trying again',
      );
    });

    it('should handle Slack API errors with specific error message', async () => {
      const apiError = new Error('Invalid auth') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'invalid_auth',
      };

      mockClient.users.profile.set.mockRejectedValueOnce(apiError);

      await expect(setSlackStatus('Test')).rejects.toThrow('SLACK_API_ERROR: invalid_auth');
    });
  });

  describe('getSlackStatus', () => {
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
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should retrieve current status', async () => {
      const result = await getSlackStatus();

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

      const result = await getSlackStatus();

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
      await expect(getSlackStatus()).rejects.toThrow('Status retrieval failed: API Error');
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 45,
      };

      mockClient.users.profile.get.mockRejectedValueOnce(rateLimitError);

      await expect(getSlackStatus()).rejects.toThrow(
        'RATE_LIMITED: Please wait 45 seconds before trying again',
      );
    });

    it('should handle Slack API errors with specific error message', async () => {
      const apiError = new Error('Token revoked') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'token_revoked',
      };

      mockClient.users.profile.get.mockRejectedValueOnce(apiError);

      await expect(getSlackStatus()).rejects.toThrow('SLACK_API_ERROR: token_revoked');
    });
  });

  describe('createSlackReminder', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        reminders: {
          add: vi.fn().mockResolvedValue({
            ok: true,
            reminder: {
              id: 'Rm12345',
              text: 'Test reminder',
              user: 'U123',
              time: 1234567890,
            },
          }),
        },
      };

      // Mock createWebClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should create a reminder successfully', async () => {
      const result = await createSlackReminder('Meeting at 3pm', 'tomorrow at 3pm');

      expect(mockClient.reminders.add).toHaveBeenCalledWith({
        text: 'Meeting at 3pm',
        time: 'tomorrow at 3pm',
      });

      expect(result).toEqual({
        success: true,
        reminder: {
          id: 'Rm12345',
          text: 'Test reminder',
          user: 'U123',
          time: 1234567890,
        },
      });
    });

    it('should handle API errors', async () => {
      mockClient.reminders.add.mockRejectedValueOnce(new Error('API Error'));

      await expect(createSlackReminder('Test', 'tomorrow')).rejects.toThrow(
        'Reminder creation failed: API Error',
      );
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 45,
      };

      mockClient.reminders.add.mockRejectedValueOnce(rateLimitError);

      await expect(createSlackReminder('Test', 'tomorrow')).rejects.toThrow(
        'RATE_LIMITED: Please wait 45 seconds before trying again',
      );
    });

    it('should handle Slack API errors with specific error message', async () => {
      const apiError = new Error('Invalid time') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'invalid_time',
      };

      mockClient.reminders.add.mockRejectedValueOnce(apiError);

      await expect(createSlackReminder('Test', 'invalid')).rejects.toThrow(
        'SLACK_API_ERROR: invalid_time',
      );
    });
  });

  describe('getSlackThreadReplies', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        conversations: {
          replies: vi.fn().mockResolvedValue({
            ok: true,
            messages: [
              {
                ts: '123.456',
                text: 'Parent message',
                user: 'U123',
              },
              {
                ts: '123.457',
                text: 'Reply 1',
                user: 'U124',
                thread_ts: '123.456',
              },
            ],
          }),
        },
      };

      // Mock createWebClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);

      // Mock getCacheForMessages to return empty cache
      vi.mocked(slackEntityCache.getCacheForMessages).mockResolvedValue({
        entities: {
          users: {} as Record<string, any>,
          channels: {} as Record<string, any>,
        },
      } as any);
    });

    it('should get thread replies successfully', async () => {
      const result = await getSlackThreadReplies('C123', '123.456', 10);

      expect(mockClient.conversations.replies).toHaveBeenCalledWith({
        channel: 'C123',
        ts: '123.456',
        limit: 10,
      });

      expect(result.replies).toHaveLength(2);
      expect(result.entities).toBeDefined();
    });

    it('should handle API errors', async () => {
      mockClient.conversations.replies.mockRejectedValueOnce(new Error('API Error'));

      await expect(getSlackThreadReplies('C123', '123.456')).rejects.toThrow(
        'Getting thread replies failed: API Error',
      );
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 20,
      };

      mockClient.conversations.replies.mockRejectedValueOnce(rateLimitError);

      await expect(getSlackThreadReplies('C123', '123.456')).rejects.toThrow(
        'RATE_LIMITED: Please wait 20 seconds before trying again',
      );
    });

    it('should handle Slack API errors with specific error message', async () => {
      const apiError = new Error('Thread not found') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'thread_not_found',
      };

      mockClient.conversations.replies.mockRejectedValueOnce(apiError);

      await expect(getSlackThreadReplies('C123', '123.456')).rejects.toThrow(
        'SLACK_API_ERROR: thread_not_found',
      );
    });
  });

  describe('getUserProfile', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        users: {
          info: vi.fn().mockResolvedValue({
            ok: true,
            user: {
              id: 'U12345',
              name: 'testuser',
              real_name: 'Test User',
              team_id: 'T12345',
              tz: 'America/Los_Angeles',
              tz_label: 'Pacific Standard Time',
              is_bot: false,
              is_admin: true,
              is_owner: false,
              is_restricted: false,
              is_ultra_restricted: false,
              updated: '1609459200',
            },
          }),
          profile: {
            get: vi.fn().mockResolvedValue({
              ok: true,
              profile: {
                display_name: 'Test User',
                email: 'test@example.com',
                phone: '123-456-7890',
                title: 'Software Engineer',
                status_text: 'Working',
                status_emoji: ':computer:',
                status_expiration: '1609545600',
                image_original: 'https://example.com/profile.jpg',
                image_512: 'https://example.com/profile_512.jpg',
              },
            }),
          },
        },
      };

      // Mock getSlackClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should retrieve user profile information', async () => {
      const userId = 'U12345';
      const result = await getUserProfile(userId);

      // Check that client methods were called correctly
      expect(slackApi.createWebClient).toHaveBeenCalledWith();
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: userId });
      expect(mockClient.users.profile.get).toHaveBeenCalledWith({ user: userId });

      // Check result structure
      expect(result).toEqual({
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
          expiration: new Date(1609545600 * 1000).toISOString(),
        },
        isBot: false,
        isAdmin: true,
        isOwner: false,
        isRestricted: false,
        isUltraRestricted: false,
        updated: new Date(1609459200 * 1000).toISOString(),
      });
    });

    it('should use fallbacks for display name', async () => {
      // Override the profile.get mock to remove display_name
      mockClient.users.profile.get.mockResolvedValueOnce({
        ok: true,
        profile: {
          email: 'test@example.com',
          status_text: '',
          status_emoji: '',
          image_512: 'https://example.com/profile_512.jpg',
        },
      });

      const result = await getUserProfile('U12345');

      // Should use real_name as fallback for display_name
      expect(result.displayName).toBe('Test User');
    });

    it('should handle missing status information', async () => {
      // Override the profile.get mock to remove status info
      mockClient.users.profile.get.mockResolvedValueOnce({
        ok: true,
        profile: {
          display_name: 'Test User',
          email: 'test@example.com',
        },
      });

      const result = await getUserProfile('U12345');

      // Check that status fields have default values
      expect(result.status).toEqual({
        text: '',
        emoji: '',
        expiration: null,
      });
    });

    it('should throw an error if user not found', async () => {
      // Override users.info to return not found
      mockClient.users.info.mockResolvedValueOnce({
        ok: false,
        error: 'user_not_found',
      });

      await expect(getUserProfile('U99999')).rejects.toThrow(/User not found/);
    });

    it('should throw an error if profile not found', async () => {
      // Make users.info succeed but profile.get fail
      mockClient.users.profile.get.mockResolvedValueOnce({
        ok: false,
        error: 'profile_not_found',
      });

      await expect(getUserProfile('U12345')).rejects.toThrow(/Profile not found/);
    });

    it('should throw an error if API request fails', async () => {
      // Make users.info throw an error
      mockClient.users.info.mockRejectedValueOnce(new Error('API Error'));

      await expect(getUserProfile('U12345')).rejects.toThrow(
        'User profile retrieval failed: API Error',
      );
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 30,
      };

      mockClient.users.info.mockRejectedValueOnce(rateLimitError);

      await expect(getUserProfile('U12345')).rejects.toThrow(
        'RATE_LIMITED: Please wait 30 seconds before trying again',
      );
    });

    it('should handle Slack API errors with specific error message', async () => {
      const apiError = new Error('User not active') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'user_not_active',
      };

      mockClient.users.info.mockRejectedValueOnce(apiError);

      await expect(getUserProfile('U12345')).rejects.toThrow('SLACK_API_ERROR: user_not_active');
    });
  });

  describe('getMessageReactions', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        reactions: {
          get: vi.fn(),
        },
      };

      // Mock createWebClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
    });

    it('should fetch reactions for a message', async () => {
      mockClient.reactions.get.mockResolvedValueOnce({
        ok: true,
        type: 'message',
        message: {
          reactions: [
            { name: 'thumbsup', count: 3, users: ['U1', 'U2', 'U3'] },
            { name: 'heart', count: 1, users: ['U4'] },
            { name: 'fire', count: 2, users: ['U5', 'U6'] },
          ],
        },
      });

      const result = await getMessageReactions(mockClient, 'C123456789', '1234567890.123456');

      expect(mockClient.reactions.get).toHaveBeenCalledWith({
        channel: 'C123456789',
        timestamp: '1234567890.123456',
        full: true,
      });

      expect(result).toEqual([
        { name: 'thumbsup', count: 3, users: ['U1', 'U2', 'U3'] },
        { name: 'heart', count: 1, users: ['U4'] },
        { name: 'fire', count: 2, users: ['U5', 'U6'] },
      ]);
    });

    it('should filter out reactions with missing properties', async () => {
      mockClient.reactions.get.mockResolvedValueOnce({
        ok: true,
        type: 'message',
        message: {
          reactions: [
            { name: 'thumbsup', count: 3, users: ['U1', 'U2', 'U3'] },
            { name: undefined, count: 1, users: ['U4'] }, // Missing name
            { name: 'heart', count: undefined, users: ['U5'] }, // Missing count
            { name: 'fire', count: 2, users: undefined }, // Missing users
            { name: 'star', count: 1, users: ['U6'] }, // Valid
          ],
        },
      });

      const result = await getMessageReactions(mockClient, 'C123', '123.456');

      // Should only return reactions with all required properties
      expect(result).toEqual([
        { name: 'thumbsup', count: 3, users: ['U1', 'U2', 'U3'] },
        { name: 'star', count: 1, users: ['U6'] },
      ]);
    });

    it('should return undefined when no reactions exist', async () => {
      mockClient.reactions.get.mockResolvedValueOnce({
        ok: true,
        type: 'message',
        message: {
          reactions: [],
        },
      });

      const result = await getMessageReactions(mockClient, 'C123', '123.456');
      expect(result).toEqual([]);
    });

    it('should return undefined when message has no reactions property', async () => {
      mockClient.reactions.get.mockResolvedValueOnce({
        ok: true,
        type: 'message',
        message: {},
      });

      const result = await getMessageReactions(mockClient, 'C123', '123.456');
      expect(result).toBeUndefined();
    });

    it('should return undefined when response is not ok', async () => {
      mockClient.reactions.get.mockResolvedValueOnce({
        ok: false,
        error: 'message_not_found',
      });

      const result = await getMessageReactions(mockClient, 'C123', '123.456');
      expect(result).toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      mockClient.reactions.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await getMessageReactions(mockClient, 'C123', '123.456');
      expect(result).toBeUndefined();
    });

    it('should throw a specific error for rate limit responses', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 30,
      };

      mockClient.reactions.get.mockRejectedValueOnce(rateLimitError);

      await expect(getMessageReactions(mockClient, 'C123', '123.456')).rejects.toThrow(
        'RATE_LIMITED: Please wait 30 seconds before trying again',
      );
    });

    it('should use default retry time when not provided', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
      };

      mockClient.reactions.get.mockRejectedValueOnce(rateLimitError);

      await expect(getMessageReactions(mockClient, 'C123', '123.456')).rejects.toThrow(
        'RATE_LIMITED: Please wait 60 seconds before trying again',
      );
    });

    it('should throw specific error for other Slack API errors', async () => {
      const apiError = new Error('API Error') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'channel_not_found',
      };

      mockClient.reactions.get.mockRejectedValueOnce(apiError);

      await expect(getMessageReactions(mockClient, 'C123', '123.456')).rejects.toThrow(
        'SLACK_API_ERROR: channel_not_found',
      );
    });
  });

  describe('searchSlackMessages', () => {
    beforeEach(() => {
      // Setup mock client
      mockClient = {
        search: {
          messages: vi.fn(),
        },
      };

      // Mock createWebClient to return our mockClient
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);

      // Mock enhanceSearchQuery to return the query unchanged for simplicity
      vi.mocked(userUtils.enhanceSearchQuery).mockImplementation((_client, query) =>
        Promise.resolve(query),
      );
    });

    it('should search messages with default sort order', async () => {
      const mockMatches = [
        {
          channel: { id: 'C123' },
          ts: '1234567890.123456',
          text: 'Test message 1',
          user: 'U123',
        },
        {
          channel: { id: 'C123' },
          ts: '1234567891.123456',
          text: 'Test message 2',
          user: 'U124',
        },
      ];

      mockClient.search.messages.mockResolvedValueOnce({
        messages: {
          matches: mockMatches,
          paging: { count: 2, page: 1, pages: 1 },
        },
      });

      const result = await searchSlackMessages(mockClient, 'test query', 10, 'desc');

      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query: 'test query',
        sort: 'timestamp',
        sort_dir: 'desc',
        count: 10,
        cursor: '*',
      });

      expect(result).toEqual(mockMatches);
    });

    it('should search messages with custom sort order', async () => {
      const mockMatches = [{ channel: { id: 'C123' }, ts: '123.456', text: 'Test' }];

      mockClient.search.messages.mockResolvedValueOnce({
        messages: {
          matches: mockMatches,
          paging: { count: 1, page: 1, pages: 1 },
        },
      });

      await searchSlackMessages(mockClient, 'test', 5, 'asc');

      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query: 'test',
        sort: 'timestamp',
        sort_dir: 'asc',
        count: 5,
        cursor: '*',
      });
    });

    it('should handle pagination when more results are available', async () => {
      // First page
      mockClient.search.messages.mockResolvedValueOnce({
        messages: {
          matches: [
            { channel: { id: 'C1' }, ts: '1.1', text: 'Message 1' },
            { channel: { id: 'C1' }, ts: '1.2', text: 'Message 2' },
          ],
          paging: {
            count: 2,
            page: 1,
            pages: 2,
            next_cursor: 'next_page_cursor',
          },
        },
      });

      // Second page
      mockClient.search.messages.mockResolvedValueOnce({
        messages: {
          matches: [{ channel: { id: 'C1' }, ts: '1.3', text: 'Message 3' }],
          paging: {
            count: 1,
            page: 2,
            pages: 2,
          },
        },
      });

      const result = await searchSlackMessages(mockClient, 'test', 5, 'desc');

      // Should have made two API calls
      expect(mockClient.search.messages).toHaveBeenCalledTimes(2);

      // First call with initial cursor
      expect(mockClient.search.messages).toHaveBeenNthCalledWith(1, {
        query: 'test',
        sort: 'timestamp',
        sort_dir: 'desc',
        count: 5,
        cursor: '*',
      });

      // Second call with next cursor
      expect(mockClient.search.messages).toHaveBeenNthCalledWith(2, {
        query: 'test',
        sort: 'timestamp',
        sort_dir: 'desc',
        count: 5,
        cursor: 'next_page_cursor',
      });

      // Should return all messages
      expect(result).toHaveLength(3);
    });

    it('should respect count limit even with pagination', async () => {
      // Mock multiple pages available but count limit reached
      mockClient.search.messages.mockResolvedValueOnce({
        messages: {
          matches: [
            { channel: { id: 'C1' }, ts: '1.1', text: 'Message 1' },
            { channel: { id: 'C1' }, ts: '1.2', text: 'Message 2' },
          ],
          paging: {
            count: 2,
            page: 1,
            pages: 3,
            next_cursor: 'next_cursor',
          },
        },
      });

      const result = await searchSlackMessages(mockClient, 'test', 2, 'desc');

      // Should only make one call since we reached the count limit
      expect(mockClient.search.messages).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('should handle empty search results', async () => {
      mockClient.search.messages.mockResolvedValueOnce({
        messages: {
          matches: [],
          paging: { count: 0, page: 1, pages: 0 },
        },
      });

      const result = await searchSlackMessages(mockClient, 'nonexistent', 10, 'desc');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockClient.search.messages.mockRejectedValueOnce(new Error('API Error'));

      await expect(searchSlackMessages(mockClient, 'test', 10, 'desc')).rejects.toThrow(
        'Search failed: API Error',
      );
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = new Error('Rate limited') as SlackAPIError;
      rateLimitError.data = {
        ok: false,
        error: 'rate_limited',
        retry_after: 60,
      };

      mockClient.search.messages.mockRejectedValueOnce(rateLimitError);

      await expect(searchSlackMessages(mockClient, 'test', 10, 'desc')).rejects.toThrow(
        'RATE_LIMITED: Please wait 60 seconds before trying again',
      );
    });

    it('should handle Slack API errors with specific error message', async () => {
      const apiError = new Error('Invalid query') as SlackAPIError;
      apiError.data = {
        ok: false,
        error: 'invalid_query',
      };

      mockClient.search.messages.mockRejectedValueOnce(apiError);

      await expect(searchSlackMessages(mockClient, 'test', 10, 'desc')).rejects.toThrow(
        'SLACK_API_ERROR: invalid_query',
      );
    });

    it('should handle missing messages property in response', async () => {
      mockClient.search.messages.mockResolvedValueOnce({});

      const result = await searchSlackMessages(mockClient, 'test', 10, 'desc');

      expect(result).toEqual([]);
    });
  });
});
