import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerSearchCommand, SearchCommandOptions } from '../../../src/commands/search';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

// Mock the services
vi.mock('../../../src/services/slack-services', () => ({
  performSlackSearch: vi.fn(),
}));

vi.mock('../../../src/services/formatting-service', () => ({
  generateSearchResultsMarkdown: vi.fn(),
}));

// Import the mocked functions
import { performSlackSearch } from '../../../src/services/slack-services';
import { generateSearchResultsMarkdown } from '../../../src/services/formatting-service';

describe('Search Command', () => {
  let context: CommandContext;
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    // Initialize program
    program = new Command();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerSearchCommand', () => {
    it('should register the search command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn(),
      } as any);

      registerSearchCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('search <query>');
    });

    it('should setup command options', () => {
      const optionSpy = vi.fn().mockReturnThis();
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: optionSpy,
        action: vi.fn(),
      } as any);

      registerSearchCommand(program, context);

      expect(optionSpy).toHaveBeenCalledWith('-c, --count <number>', expect.any(String), '100');
      expect(optionSpy).toHaveBeenCalledWith('-o, --output <file>', expect.any(String));
    });

    it('should search and display results when executed', async () => {
      // Mock search results
      const mockSearchResult = {
        messages: [{ ts: '1234', text: 'Test message' }],
        channels: { C123: { name: 'general', displayName: 'general', type: 'channel' as const } },
        users: { U123: { name: 'user1', displayName: 'User One', isBot: false } },
        userId: 'U123',
      };

      const mockMarkdown = '# Search Results\n\nTest markdown';

      vi.mocked(performSlackSearch).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(generateSearchResultsMarkdown).mockReturnValueOnce(mockMarkdown);

      // Setup command execution
      let actionCallback: ((query: string, options: SearchCommandOptions) => Promise<void>) | null =
        null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerSearchCommand(program, context);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!('test query', { count: '50' });

      // Check if search was performed with correct parameters
      expect(performSlackSearch).toHaveBeenCalledWith('test query', 50, context);

      // Check if results were formatted
      expect(generateSearchResultsMarkdown).toHaveBeenCalledWith(
        mockSearchResult.messages,
        expect.objectContaining({
          channels: mockSearchResult.channels,
          users: mockSearchResult.users,
        }),
        'U123',
        context,
      );

      // Check if results were displayed
      expect(console.log).toHaveBeenCalledWith(mockMarkdown);
    });

    it('should write results to file when output option is provided', async () => {
      // Mock search results
      const mockSearchResult = {
        messages: [{ ts: '1234', text: 'Test message' }],
        channels: { C123: { name: 'general', displayName: 'general', type: 'channel' as const } },
        users: { U123: { name: 'user1', displayName: 'User One', isBot: false } },
        userId: 'U123',
      };

      const mockMarkdown = '# Search Results\n\nTest markdown';

      vi.mocked(performSlackSearch).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(generateSearchResultsMarkdown).mockReturnValueOnce(mockMarkdown);
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);

      // Setup command execution
      let actionCallback: ((query: string, options: SearchCommandOptions) => Promise<void>) | null =
        null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerSearchCommand(program, context);

      // Execute the command action with output option
      const outputFile = 'search-results.md';
      await actionCallback!('test query', { count: '50', output: outputFile });

      // Check if file was written
      expect(fs.writeFile).toHaveBeenCalledWith(outputFile, mockMarkdown);
      expect(console.log).toHaveBeenCalledWith(`Search results written to: ${outputFile}`);
    });

    it('should handle search errors gracefully', async () => {
      // Mock search error
      const searchError = new Error('Search failed');
      vi.mocked(performSlackSearch).mockRejectedValueOnce(searchError);

      // Setup command execution
      let actionCallback: ((query: string, options: SearchCommandOptions) => Promise<void>) | null =
        null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerSearchCommand(program, context);

      // Execute the command action
      await actionCallback!('test query', { count: '50' });

      // Check if error was handled
      expect(console.error).toHaveBeenCalledWith('Error:', searchError);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
