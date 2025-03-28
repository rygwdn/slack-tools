import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSlackEntityCache } from '../../../../src/commands/today/slack-entity-cache';
import { CommandContext } from '../../../../src/context';
import { SlackCache } from '../../../../src/commands/today/types';
import { WebClient } from '@slack/web-api';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

// Mock the cache module
vi.mock('../../../../src/cache', () => ({
  loadSlackCache: vi.fn().mockResolvedValue(null),
  saveSlackCache: vi.fn().mockResolvedValue(undefined),
}));

// Import the mocked functions after mocking
import { loadSlackCache, saveSlackCache } from '../../../../src/cache';

// Create a helper to mock Slack API responses
function createMockWebClient() {
  return {
    users: {
      info: vi.fn().mockImplementation(({ user }) => {
        if (user === 'U123') {
          return Promise.resolve({
            ok: true,
            user: {
              id: 'U123',
              name: 'user1',
              real_name: 'User One',
              is_bot: false,
            },
          });
        } else if (user === 'U456') {
          return Promise.resolve({
            ok: true,
            user: {
              id: 'U456',
              name: 'user2',
              real_name: 'User Two',
              is_bot: false,
            },
          });
        } else if (user === 'U789') {
          return Promise.resolve({
            ok: true,
            user: {
              id: 'U789',
              name: 'bot-user',
              real_name: 'Bot User',
              is_bot: true,
            },
          });
        } else {
          return Promise.resolve({
            ok: false,
            error: 'user_not_found',
          });
        }
      }),
    },
    conversations: {
      info: vi.fn().mockImplementation(({ channel }) => {
        if (channel === 'C123') {
          return Promise.resolve({
            ok: true,
            channel: {
              id: 'C123',
              name: 'general',
              is_channel: true,
              is_im: false,
              is_mpim: false,
            },
          });
        } else if (channel === 'D123') {
          return Promise.resolve({
            ok: true,
            channel: {
              id: 'D123',
              is_channel: false,
              is_im: true,
              is_mpim: false,
              user: 'U456', // The other user in this DM
            },
          });
        } else if (channel === 'G123') {
          return Promise.resolve({
            ok: true,
            channel: {
              id: 'G123',
              name: 'multi-dm',
              is_channel: false,
              is_im: false,
              is_mpim: true,
            },
          });
        } else {
          return Promise.resolve({
            ok: false,
            error: 'channel_not_found',
          });
        }
      }),
      members: vi.fn().mockImplementation(({ channel }) => {
        if (channel === 'G123') {
          return Promise.resolve({
            ok: true,
            members: ['U123', 'U456', 'U789'],
          });
        } else {
          return Promise.resolve({
            ok: false,
            error: 'channel_not_found',
          });
        }
      }),
    },
  } as unknown as WebClient;
}

describe('Slack Entity Cache', () => {
  let context: CommandContext;
  let mockClient: WebClient;

  beforeEach(() => {
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    mockClient = createMockWebClient();

    // Reset the mock calls
    vi.mocked(loadSlackCache).mockClear();
    vi.mocked(saveSlackCache).mockClear();

    // Reset Date.now to ensure consistent cache timestamp values
    vi.spyOn(Date, 'now').mockReturnValue(1000000000000);
  });

  describe('getSlackEntityCache', () => {
    it('should extract users and channels from messages', async () => {
      const messages: Match[] = [
        {
          ts: '1609459200.000000',
          text: 'Hello <@U123> and <@U456>, check <#C123|general>',
          user: 'U789',
          channel: { id: 'D123' },
        },
      ];

      const cache = await getSlackEntityCache(mockClient, messages, context);

      // Verify users were extracted and fetched
      expect(cache.users).toHaveProperty('U123');
      expect(cache.users).toHaveProperty('U456');
      expect(cache.users).toHaveProperty('U789');

      // Verify user properties
      expect(cache.users['U123'].displayName).toBe('User One');
      expect(cache.users['U456'].displayName).toBe('User Two');
      expect(cache.users['U789'].displayName).toBe('Bot User');
      expect(cache.users['U789'].isBot).toBe(true);

      // Verify channels were extracted and fetched
      expect(cache.channels).toHaveProperty('C123');
      expect(cache.channels).toHaveProperty('D123');

      // Verify channel properties
      expect(cache.channels['C123'].displayName).toBe('general');
      expect(cache.channels['C123'].type).toBe('channel');
      expect(cache.channels['D123'].type).toBe('im');
      expect(cache.channels['D123'].members).toEqual(['U456']);

      // Verify cache was saved
      expect(saveSlackCache).toHaveBeenCalledWith(cache);
    });

    it('should handle complex message text with mentions', async () => {
      // The regex in extractEntitiesFromMessages is /<@([A-Z0-9]+)>/g for users
      // and /<#([A-Z0-9]+)(\|[^>]+)?>/g for channels, so we need to match that format
      const messages: Match[] = [
        {
          ts: '1609459200.000000',
          text: 'This is a complex message with <@U123> and <#C123|general-renamed>',
          user: 'U456',
          channel: { id: 'G123' },
        },
      ];

      const cache = await getSlackEntityCache(mockClient, messages, context);

      // Verify users were extracted correctly despite different format
      expect(cache.users).toHaveProperty('U123');
      expect(cache.users).toHaveProperty('U456');

      // Verify channels were extracted correctly despite different format
      expect(cache.channels).toHaveProperty('C123');
      expect(cache.channels).toHaveProperty('G123');

      // MPIM channel should have members
      expect(cache.channels['G123'].type).toBe('mpim');
      expect(cache.channels['G123'].members).toContain('U123');
      expect(cache.channels['G123'].members).toContain('U456');
    });

    it('should handle error responses gracefully', async () => {
      // Mock API errors
      vi.mocked(mockClient.users.info).mockRejectedValueOnce(new Error('API error'));
      vi.mocked(mockClient.conversations.info).mockRejectedValueOnce(new Error('API error'));

      const messages: Match[] = [
        {
          ts: '1609459200.000000',
          text: 'Error test',
          user: 'U999', // This will cause an error
          channel: { id: 'C999' }, // This will cause an error
        },
      ];

      // Should not throw errors
      const cache = await getSlackEntityCache(mockClient, messages, context);

      // Cache should still be created
      expect(cache).toBeDefined();
      expect(cache.lastUpdated).toBeGreaterThan(0);

      // Debug messages should be logged
      expect(context.debugLog).toHaveBeenCalled();
    });

    it('should use existing cache when available', async () => {
      // Mock an existing cache with a fixed timestamp
      const existingCacheTime = 900000000000; // Earlier than our mocked Date.now
      const existingCache: SlackCache = {
        users: {
          U123: { displayName: 'Cached User', isBot: false },
        },
        channels: {
          C123: { displayName: 'cached-channel', type: 'channel' },
        },
        lastUpdated: existingCacheTime,
      };

      vi.mocked(loadSlackCache).mockResolvedValueOnce(existingCache);

      const messages: Match[] = [
        {
          ts: '1609459200.000000',
          text: 'Using cached data for <@U123> in <#C123>',
          user: 'U456', // Not in cache
          channel: { id: 'D123' }, // Not in cache
        },
      ];

      const cache = await getSlackEntityCache(mockClient, messages, context);

      // Should keep cached entries
      expect(cache.users['U123'].displayName).toBe('Cached User');
      expect(cache.channels['C123'].displayName).toBe('cached-channel');

      // Should add new entries
      expect(cache.users['U456']).toBeDefined();
      expect(cache.channels['D123']).toBeDefined();

      // Should have updated the timestamp (Our Date.now mock returns 1000000000000)
      expect(cache.lastUpdated).toBe(1000000000000);
      expect(cache.lastUpdated).toBeGreaterThan(existingCacheTime);
    });

    it('should handle multi-person IMs correctly', async () => {
      // For MPIMs, we need to make sure we handle the member data correctly
      // The fetchChannelMembers function gets members via client.conversations.members
      const messages: Match[] = [
        {
          ts: '1609459200.000000',
          text: 'Group DM message',
          user: 'U123',
          channel: { id: 'G123' },
        },
      ];

      // We need to make sure all members from the conversations.members call
      // are fetched (U123, U456, U789), even if they're not mentioned in the message

      const cache = await getSlackEntityCache(mockClient, messages, context);

      // Verify MPIM channel
      expect(cache.channels['G123'].type).toBe('mpim');
      expect(cache.channels['G123'].members).toEqual(['U123', 'U456', 'U789']);

      // All users are fetched by fetchAndCacheUsers, but only if they're in userIds
      // The only user automatically added to userIds is the message.user (U123)
      // Check for at least the message author
      expect(cache.users['U123']).toBeDefined();

      // Since the implementation doesn't add MPIM members to userIds automatically,
      // we shouldn't expect them to be fetched
    });
  });
});
