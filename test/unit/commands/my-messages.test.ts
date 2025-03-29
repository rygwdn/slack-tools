import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerMyMessagesCommand } from '../../../src/commands/my-messages';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';
import * as fs from 'fs/promises';
import { MyMessagesCommandOptions } from '../../../src/commands/my_messages/types';
import { generateMyMessagesSummary } from '../../../src/services/my-messages-service';

// Mock dependencies
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

// Mock the my messages service
vi.mock('../../../src/services/my-messages-service', () => ({
  generateMyMessagesSummary: vi.fn(),
}));

describe('My Messages Command', () => {
  let context: CommandContext;
  let program: Command;
  let mockTodayResult: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = true;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    // Initialize program
    program = new Command();

    // Setup mock today summary results
    mockTodayResult = {
      markdown: '# Today Summary\n\nTest markdown content',
      allMessages: [
        { ts: '1234', text: 'test message' },
        { ts: '5678', text: 'another message' },
      ],
      userId: 'U123456',
      dateRange: {
        startTime: new Date('2023-01-01'),
        endTime: new Date('2023-01-01'),
      },
      cache: {
        users: {},
        channels: {},
        lastUpdated: Date.now(),
      },
    };

    vi.mocked(generateMyMessagesSummary).mockResolvedValue(mockTodayResult);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerMyMessagesCommand', () => {
    it('should register the my-messages command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn(),
      } as any);

      registerMyMessagesCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('my-messages');
    });

    it('should setup command options', () => {
      const optionSpy = vi.fn().mockReturnThis();
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: optionSpy,
        action: vi.fn(),
      } as any);

      registerMyMessagesCommand(program, context);

      expect(optionSpy).toHaveBeenCalledWith('-u, --username <username>', expect.any(String));
      expect(optionSpy).toHaveBeenCalledWith('-s, --since <date>', expect.any(String));
      expect(optionSpy).toHaveBeenCalledWith('-e, --until <date>', expect.any(String));
      expect(optionSpy).toHaveBeenCalledWith('-c, --count <number>', expect.any(String), '200');
      expect(optionSpy).toHaveBeenCalledWith('-o, --output <file>', expect.any(String));
    });

    it('should generate a daily summary when executed', async () => {
      // Setup command execution
      let actionCallback: ((options: MyMessagesCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerMyMessagesCommand(program, context);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!({ count: '50' });

      // Check if today service was called with correct parameters
      expect(generateMyMessagesSummary).toHaveBeenCalledWith(
        {
          username: undefined,
          since: undefined,
          until: undefined,
          count: 50,
        },
        context,
      );

      // Check if results were displayed
      expect(console.log).toHaveBeenCalledWith(mockTodayResult.markdown);
    });

    it('should use provided options when specified', async () => {
      // Setup command execution
      let actionCallback: ((options: MyMessagesCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerMyMessagesCommand(program, context);

      // Execute the command action with custom options
      const customOptions = {
        username: 'customuser',
        since: '2023-01-01',
        until: '2023-01-02',
        count: '100',
      };

      await actionCallback!(customOptions);

      // Check if today service was called with correct parameters
      expect(generateMyMessagesSummary).toHaveBeenCalledWith(
        {
          username: 'customuser',
          since: '2023-01-01',
          until: '2023-01-02',
          count: 100,
        },
        context,
      );
    });

    it('should write to file when output option is provided', async () => {
      // Setup command execution
      let actionCallback: ((options: MyMessagesCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerMyMessagesCommand(program, context);

      // Execute the command action with output file
      await actionCallback!({ count: '50', output: 'output.md' });

      // Check if file was written
      expect(fs.writeFile).toHaveBeenCalledWith('output.md', mockTodayResult.markdown);
      expect(console.log).toHaveBeenCalledWith('Report written to: output.md');
    });

    it('should handle errors properly', async () => {
      // Setup error condition
      const testError = new Error('Test error');
      vi.mocked(generateMyMessagesSummary).mockRejectedValueOnce(testError);

      // Setup command execution
      let actionCallback: ((options: MyMessagesCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerMyMessagesCommand(program, context);

      // Execute the command action
      await actionCallback!({ count: '50' });

      // Check error handling
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
