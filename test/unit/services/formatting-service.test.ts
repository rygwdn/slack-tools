import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSearchResultsMarkdown,
  formatStatusOutput,
  formatStatusUpdateOutput,
} from '../../../src/services/formatting-service';
import { CommandContext } from '../../../src/context';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

// Mock the formatters from my_messages command
vi.mock('../../../src/commands/my_messages/formatters', () => ({
  getFriendlyChannelName: vi.fn((channelId, _cache) => {
    if (channelId === 'C123') return '#general';
    if (channelId === 'C456') return '#random';
    if (channelId === 'D123') return 'DM with user1';
    return `#${channelId}`;
  }),
  formatSlackText: vi.fn((text) => text),
  formatTime: vi.fn(() => '12:34'),
}));

describe('Formatting Service', () => {
  let context: CommandContext;
  let mockCache: any;

  beforeEach(() => {
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    mockCache = {
      channels: {
        C123: { name: 'general', displayName: 'general', type: 'channel' },
        C456: { name: 'random', displayName: 'random', type: 'channel' },
        D123: { name: 'user1-dm', displayName: 'user1-dm', type: 'im', members: ['U789'] },
      },
      users: {
        U123: { name: 'user1', displayName: 'User One', isBot: false },
        U456: { name: 'user2', displayName: 'User Two', isBot: false },
        U789: { name: 'user3', displayName: 'User Three', isBot: false },
      },
      lastUpdated: Date.now(),
    };
  });

  describe('generateSearchResultsMarkdown', () => {
    it('should return a message when no results are found', () => {
      const messages: Match[] = [];
      const result = generateSearchResultsMarkdown(messages, mockCache, 'U123', context);

      expect(result).toContain('# Search Results');
      expect(result).toContain('No messages found matching your search criteria.');
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

      const result = generateSearchResultsMarkdown(messages, mockCache, 'U123', context);

      // Check for header and channel grouping
      expect(result).toContain('# Search Results');
      expect(result).toContain('## #general');
      expect(result).toContain('## #random');

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

      const result = generateSearchResultsMarkdown(messages, mockCache, 'U123', context);

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

      const result = generateSearchResultsMarkdown(messages, mockCache, 'U123', context);

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

      expect(result).toContain('# Current Slack Status');
      expect(result).toContain('**Status:** :calendar: In a meeting');
      expect(result).toContain('**Expires:**');
      expect(result).toContain('2023'); // Year should be in the formatted date
    });

    it('should format status without emoji', () => {
      const status = {
        status: 'Working',
        emoji: '',
        expirationTime: null,
      };

      const result = formatStatusOutput(status);

      expect(result).toContain('**Status:** Working');
      expect(result).toContain('**Expires:** Never (permanent status)');
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

  describe('formatStatusUpdateOutput', () => {
    it('should format successful status update with emoji and expiration', () => {
      const result = {
        success: true,
        text: 'In a meeting',
        emoji: ':calendar:',
        expirationTime: '2023-01-01T15:00:00.000Z',
      };

      const formattedResult = formatStatusUpdateOutput(result);

      expect(formattedResult).toContain('# Status Update');
      expect(formattedResult).toContain('✅ Status updated successfully');
      expect(formattedResult).toContain('**New Status:** :calendar: In a meeting');
      expect(formattedResult).toContain('**Expires:**');
      expect(formattedResult).toContain('2023'); // Year should be in the formatted date
    });

    it('should format successful status update without emoji or expiration', () => {
      const result = {
        success: true,
        text: 'Working',
        emoji: '',
        expirationTime: null,
      };

      const formattedResult = formatStatusUpdateOutput(result);

      expect(formattedResult).toContain('✅ Status updated successfully');
      expect(formattedResult).toContain('**New Status:** Working');
      expect(formattedResult).toContain('**Expires:** Never (permanent status)');
    });

    it('should format failed status update', () => {
      const result = {
        success: false,
        text: 'Working',
        emoji: ':computer:',
        expirationTime: null,
      };

      const formattedResult = formatStatusUpdateOutput(result);

      expect(formattedResult).toContain('# Status Update');
      expect(formattedResult).toContain('❌ Failed to update status');
      expect(formattedResult).not.toContain('**New Status:**');
    });
  });
});
