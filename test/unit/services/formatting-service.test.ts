import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSearchResultsMarkdown,
  formatStatusOutput,
  extractThreadTsFromPermalink,
  isValidThreadMessage,
  formatTime,
  formatSlackText,
  getFriendlyChannelName,
} from '../../../src/services/formatting-service';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';
import { ThreadMessage } from '../../../src/commands/my_messages/types';

describe('Formatting Service', () => {
  let mockCache: any;

  beforeEach(() => {
    mockCache = {
      entities: {
        C123: { name: 'general', displayName: 'general', type: 'channel' },
        C456: { name: 'random', displayName: 'random', type: 'channel' },
        D123: { name: 'user1-dm', displayName: 'user1-dm', type: 'im', members: ['U789'] },
        G123: { displayName: 'group-dm', type: 'mpim', members: ['U456', 'U789'] },
        U123: { name: 'user1', displayName: 'User One', isBot: false },
        U456: { name: 'user2', displayName: 'User Two', isBot: false },
        U789: { name: 'user3', displayName: 'User Three', isBot: false },
        U999: { displayName: 'Bot User', isBot: true },
        U000: { displayName: 'Unknown User', isBot: false },
        UNKNOWN: { displayName: 'Unknown Channel', type: 'channel' },
      },
      lastUpdated: Date.now(),
      version: 1,
    };
  });

  describe('generateSearchResultsMarkdown', () => {
    it('should return a message when no results are found', () => {
      const messages: Match[] = [];
      const result = generateSearchResultsMarkdown(messages, mockCache);

      expect(result).toContain('No messages found matching your search criteria');
    });

    it('should format search results with channel grouping', () => {
      const messages: Match[] = [
        {
          channel: { id: 'C123' },
          ts: '1609459200.000000', // 2021-01-01 00:00:00
          text: 'Message in general',
          user: 'U123',
          username: 'User One',
          permalink: 'https://slack.com/message/1',
        },
        {
          channel: { id: 'C456' },
          ts: '1609459300.000000', // 2021-01-01 00:01:40
          text: 'Message in random',
          user: 'U456',
          username: 'User Two',
          permalink: 'https://slack.com/message/2',
        },
        {
          channel: { id: 'C123' },
          ts: '1609459400.000000', // 2021-01-01 00:03:20
          text: 'Another message in general',
          user: 'U123',
          username: 'User One',
          permalink: 'https://slack.com/message/3',
        },
      ];

      const result = generateSearchResultsMarkdown(messages, mockCache);

      // Check for header and channel grouping
      expect(result).toContain('Search Results');
      expect(result).toContain('#general');
      expect(result).toContain('#random');

      // Check for proper message formatting with timestamps and users
      expect(result).toContain('Message in general');
      expect(result).toContain('Another message in general');
      expect(result).toContain('Message in random');
      expect(result).toContain('User One');
      expect(result).toContain('User Two');
    });

    it('should sort messages by timestamp within channels', () => {
      const messages: Match[] = [
        {
          channel: { id: 'C123' },
          ts: '1609459400.000000', // Later timestamp
          text: 'Later message',
          user: 'U123',
          permalink: 'https://slack.com/message/1',
        },
        {
          channel: { id: 'C123' },
          ts: '1609459200.000000', // Earlier timestamp
          text: 'Earlier message',
          user: 'U123',
          permalink: 'https://slack.com/message/2',
        },
      ];

      const result = generateSearchResultsMarkdown(messages, mockCache);

      // The messages should be sorted by timestamp
      const earlierIndex = result.indexOf('Earlier message');
      const laterIndex = result.indexOf('Later message');

      expect(earlierIndex).toBeLessThan(laterIndex);
    });

    it('should handle messages without user data', () => {
      const messages: Match[] = [
        {
          channel: { id: 'C123' },
          ts: '1609459200.000000',
          text: 'Message without user',
          permalink: 'https://slack.com/message/1',
        },
      ];

      const result = generateSearchResultsMarkdown(messages, mockCache);

      expect(result).toContain('Message without user');
      expect(result).toContain('Unknown User');
    });
  });

  describe('formatStatusOutput', () => {
    it('should format status with emoji and expiration time', () => {
      const status = {
        status: 'In a meeting',
        emoji: ':calendar:',
        expirationTime: '2023-01-01T15:00:00.000Z',
      };

      const result = formatStatusOutput(status);

      expect(result).toContain('Current Slack Status');
      expect(result).toContain('In a meeting');
      expect(result).toContain(':calendar:');
      expect(result).toContain('2023'); // Year should be in the formatted date
    });

    it('should format status without emoji', () => {
      const status = {
        status: 'Working',
        emoji: '',
        expirationTime: null,
      };

      const result = formatStatusOutput(status);

      expect(result).toContain('status');
      expect(result).toContain('Working');
      expect(result).toContain('Never');
    });

    it('should handle empty status', () => {
      const status = {
        status: '',
        emoji: '',
        expirationTime: null,
      };

      const result = formatStatusOutput(status);

      expect(result).toContain('No status is currently set.');
    });
  });
  describe('getFriendlyChannelName', () => {
    it('should format channel names with hash prefix', () => {
      const result = getFriendlyChannelName('C123', mockCache);
      expect(result).toBe('#general');
    });

    it('should format DM channels with user name', () => {
      const result = getFriendlyChannelName('D123', mockCache);
      expect(result).toBe('DM with User Three');
    });

    it('should format group DMs with member names', () => {
      const result = getFriendlyChannelName('G123', mockCache);
      expect(result).toBe('Group DM with User Two, User Three');
    });

    it('should return channel ID when channel not found in cache', () => {
      const newMockCache = {
        ...mockCache,
        entities: { ...mockCache.entities },
      };
      delete newMockCache.entities.UNKNOWN;

      const result = getFriendlyChannelName('UNKNOWN', newMockCache);
      expect(result).toBe('UNKNOWN');
    });
  });

  describe('formatSlackText', () => {
    it('should replace user mentions with display names', () => {
      const text = 'Hello <@U123> and <@U456>';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('Hello @User One and @User Two');
    });

    it('should handle user mentions with display name override', () => {
      const text = 'Hello <@U123|alice> and <@U456|bob>';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('Hello @User One and @User Two');
    });

    it('should use provided display name when user not in cache', () => {
      const newMockCache = {
        ...mockCache,
        entities: { ...mockCache.entities },
      };
      delete newMockCache.entities.U000;

      const text = 'Hello <@U000|unknown_user>';
      const result = formatSlackText(text, newMockCache);
      expect(result).toBe('Hello @unknown_user');
    });

    it('should replace channel mentions with channel names', () => {
      const text = 'Check <#C123> and <#C456>';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('Check #general and #random');
    });

    it('should handle channel mentions with name override', () => {
      const text = 'Check <#C123|general-channel>';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('Check #general-channel');
    });

    it('should convert formatted links to markdown', () => {
      const text = 'See <https://example.com|this link>';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('See [this link](https://example.com)');
    });

    it('should convert plain links', () => {
      const text = 'See <https://example.com>';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('See https://example.com');
    });

    it('should handle multiline text with proper indentation', () => {
      const text = 'First line\nSecond line\nThird line';
      const result = formatSlackText(text, mockCache);
      expect(result).toBe('First line\n    Second line\n    Third line');
    });

    it('should handle empty text', () => {
      const result = formatSlackText('', mockCache);
      expect(result).toBe('');
    });
  });

  describe('formatTime', () => {
    it('should format time with zero padding for hours and minutes', () => {
      // To avoid timezone issues, let's mock the date's getHours and getMinutes methods
      const mockDate = new Date();
      vi.spyOn(mockDate, 'getHours').mockReturnValue(9);
      vi.spyOn(mockDate, 'getMinutes').mockReturnValue(5);

      const result = formatTime(mockDate);
      expect(result).toBe('09:05');
    });

    it('should handle midnight correctly', () => {
      const mockDate = new Date();
      vi.spyOn(mockDate, 'getHours').mockReturnValue(0);
      vi.spyOn(mockDate, 'getMinutes').mockReturnValue(0);

      const result = formatTime(mockDate);
      expect(result).toBe('00:00');
    });
  });

  describe('isValidThreadMessage', () => {
    it('should return true for messages with a timestamp', () => {
      const message: ThreadMessage = { ts: '1609459200.000000' };
      expect(isValidThreadMessage(message)).toBe(true);
    });

    it('should return false for messages without a timestamp', () => {
      const message: ThreadMessage = { text: 'Invalid message' };
      expect(isValidThreadMessage(message)).toBe(false);
    });
  });

  describe('extractThreadTsFromPermalink', () => {
    it('should extract thread_ts from permalink', () => {
      const permalink =
        'https://example.slack.com/archives/C123/p123456?thread_ts=1609459200.000000';
      const result = extractThreadTsFromPermalink(permalink);
      expect(result).toBe('1609459200.000000');
    });

    it('should return undefined for permalinks without thread_ts', () => {
      const permalink = 'https://example.slack.com/archives/C123/p123456';
      const result = extractThreadTsFromPermalink(permalink);
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid URLs', () => {
      const permalink = 'not-a-url';
      const result = extractThreadTsFromPermalink(permalink);
      expect(result).toBeUndefined();
    });

    it('should handle undefined permalink', () => {
      const result = extractThreadTsFromPermalink(undefined as unknown as string);
      expect(result).toBeUndefined();
    });
  });
});
