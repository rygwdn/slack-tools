import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTodayCommand } from '../../../src/commands/today';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs/promises';
import { TodayCommandOptions, DateRange } from '../../../src/commands/today/types';
import { Match } from '@slack/web-api/dist/types/response/SearchMessagesResponse';

// Mock dependencies
vi.mock('../../../src/slack-api', () => ({
  getSlackClient: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

vi.mock('../../../src/commands/today/utils', () => ({
  getDateRange: vi.fn(),
  formatDateForSearch: vi.fn(),
  getDayAfter: vi.fn(),
  getDayBefore: vi.fn(),
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

// Import the mocked functions
import { getSlackClient } from '../../../src/slack-api';
import { getDateRange } from '../../../src/commands/today/utils';
import { searchMessages } from '../../../src/commands/today/slack-service';
import { getSlackEntityCache } from '../../../src/commands/today/slack-entity-cache';
import { generateMarkdown } from '../../../src/commands/today/formatters';
import { saveSlackCache } from '../../../src/cache';

describe('Today Command', () => {
  let context: CommandContext;
  let program: Command;
  let mockClient: any;
  let mockDateRange: DateRange;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    // Initialize program
    program = new Command();

    // Setup mock client
    mockClient = {
      auth: {
        test: vi.fn().mockResolvedValue({
          user_id: 'U123',
          user: 'testuser',
        }),
      },
    };
    vi.mocked(getSlackClient).mockResolvedValue(mockClient as unknown as WebClient);

    // Setup mock date range
    mockDateRange = {
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-01'),
    };
    vi.mocked(getDateRange).mockResolvedValue(mockDateRange);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerTodayCommand', () => {
    it('should register the today command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn(),
      } as any);

      registerTodayCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('today');
    });

    it('should setup command options', () => {
      const optionSpy = vi.fn().mockReturnThis();
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: optionSpy,
        action: vi.fn(),
      } as any);

      registerTodayCommand(program, context);

      expect(optionSpy).toHaveBeenCalledWith('-u, --username <username>', expect.any(String));
      expect(optionSpy).toHaveBeenCalledWith('-s, --since <date>', expect.any(String));
      expect(optionSpy).toHaveBeenCalledWith('-e, --until <date>', expect.any(String));
      expect(optionSpy).toHaveBeenCalledWith('-c, --count <number>', expect.any(String), '200');
      expect(optionSpy).toHaveBeenCalledWith('-o, --output <file>', expect.any(String));
    });

    it('should generate a daily summary when executed', async () => {
      // Mock search results
      const messages: Match[] = [{ ts: '1234', text: 'Test message' }];
      const threadMessages: Match[] = [{ ts: '5678', text: 'Thread reply' }];
      const mentionMessages: Match[] = [{ ts: '9012', text: 'Message with mention' }];

      vi.mocked(searchMessages).mockResolvedValueOnce({
        messages,
        threadMessages,
        mentionMessages,
      });

      // Mock cache
      const mockCache = {
        users: { U123: { displayName: 'Test User', isBot: false } },
        channels: { C123: { displayName: 'general', type: 'channel' as const } },
        lastUpdated: 0,
      };

      vi.mocked(getSlackEntityCache).mockResolvedValueOnce(mockCache);

      // Mock markdown generation
      const mockMarkdown = '# Daily Summary\n\nTest markdown';
      vi.mocked(generateMarkdown).mockReturnValueOnce(mockMarkdown);

      // Setup command execution
      let actionCallback: ((options: TodayCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTodayCommand(program, context);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!({ count: '50' });

      // Check if correct auth test was requested
      expect(mockClient.auth.test).toHaveBeenCalled();

      // Check if date range was fetched
      expect(getDateRange).toHaveBeenCalled();

      // Check if messages were searched
      expect(searchMessages).toHaveBeenCalledWith(
        mockClient,
        'testuser', // Default username from auth test
        mockDateRange,
        50, // Parsed count from options
        context,
      );

      // Check if entity cache was fetched
      const allMessages = [...messages, ...threadMessages, ...mentionMessages];
      expect(getSlackEntityCache).toHaveBeenCalledWith(mockClient, allMessages, context);

      // Check if markdown was generated
      expect(generateMarkdown).toHaveBeenCalledWith(allMessages, mockCache, 'U123', context);

      // Check if results were displayed
      expect(console.log).toHaveBeenCalledWith(mockMarkdown);

      // Check if cache was saved
      expect(saveSlackCache).toHaveBeenCalled();
    });

    it('should use provided username instead of authenticated user', async () => {
      // Mock minimal search result
      vi.mocked(searchMessages).mockResolvedValueOnce({
        messages: [],
        threadMessages: [],
        mentionMessages: [],
      });

      // Mock minimal cache
      vi.mocked(getSlackEntityCache).mockResolvedValueOnce({
        users: {},
        channels: {},
        lastUpdated: 0,
      });

      // Mock markdown generation
      vi.mocked(generateMarkdown).mockReturnValueOnce('# Daily Summary');

      // Setup command execution
      let actionCallback: ((options: TodayCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTodayCommand(program, context);

      // Execute the command action with custom username
      const customUsername = 'customuser';
      await actionCallback!({ count: '50', username: customUsername });

      // Check if searched with custom username
      expect(searchMessages).toHaveBeenCalledWith(
        expect.anything(),
        customUsername,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should write results to file when output option is provided', async () => {
      // Mock minimal search result
      vi.mocked(searchMessages).mockResolvedValueOnce({
        messages: [],
        threadMessages: [],
        mentionMessages: [],
      });

      // Mock minimal cache
      vi.mocked(getSlackEntityCache).mockResolvedValueOnce({
        users: {},
        channels: {},
        lastUpdated: 0,
      });

      // Mock markdown generation
      const mockMarkdown = '# Daily Summary';
      vi.mocked(generateMarkdown).mockReturnValueOnce(mockMarkdown);
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);

      // Setup command execution
      let actionCallback: ((options: TodayCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTodayCommand(program, context);

      // Execute the command action with output option
      const outputFile = 'daily-summary.md';
      await actionCallback!({ count: '50', output: outputFile });

      // Check if file was written
      expect(fs.writeFile).toHaveBeenCalledWith(outputFile, mockMarkdown);
      expect(console.log).toHaveBeenCalledWith(`Report written to: ${outputFile}`);
    });

    it('should handle errors gracefully', async () => {
      // Mock error
      const searchError = new Error('Search failed');
      vi.mocked(searchMessages).mockRejectedValueOnce(searchError);

      // Setup command execution
      let actionCallback: ((options: TodayCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTodayCommand(program, context);

      // Execute the command action
      await actionCallback!({ count: '50' });

      // Check if error was handled
      expect(console.error).toHaveBeenCalledWith('Error:', searchError);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
