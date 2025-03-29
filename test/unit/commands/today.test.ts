import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTodayCommand } from '../../../src/commands/today';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';
import * as fs from 'fs/promises';
import { TodayCommandOptions } from '../../../src/commands/today/types';
import { generateTodaySummary } from '../../../src/services/today-service';

// Mock dependencies
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

vi.mock('../../../src/services/today-service', () => ({
  generateTodaySummary: vi.fn(),
}));

describe('Today Command', () => {
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
      markdown: '# Daily Summary\n\nTest markdown',
      allMessages: [
        { ts: '1234', text: 'Test message' },
        { ts: '5678', text: 'Thread reply' },
        { ts: '9012', text: 'Message with mention' },
      ],
      userId: 'U123',
      dateRange: {
        startTime: new Date('2023-01-01'),
        endTime: new Date('2023-01-01'),
      },
      cache: {
        users: { U123: { displayName: 'Test User', isBot: false } },
        channels: { C123: { displayName: 'general', type: 'channel' } },
        lastUpdated: Date.now(),
      },
    };

    vi.mocked(generateTodaySummary).mockResolvedValue(mockTodayResult);

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

      // Check if today service was called with correct parameters
      expect(generateTodaySummary).toHaveBeenCalledWith(
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
      let actionCallback: ((options: TodayCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTodayCommand(program, context);

      // Execute the command action with custom options
      const customOptions = {
        username: 'customuser',
        since: '2023-01-01',
        until: '2023-01-02',
        count: '100',
      };

      await actionCallback!(customOptions);

      // Check if today service was called with correct parameters
      expect(generateTodaySummary).toHaveBeenCalledWith(
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
      let actionCallback: ((options: TodayCommandOptions) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTodayCommand(program, context);

      // Execute the command action with output file
      await actionCallback!({ count: '50', output: 'output.md' });

      // Check if file was written
      expect(fs.writeFile).toHaveBeenCalledWith('output.md', mockTodayResult.markdown);
      expect(console.log).toHaveBeenCalledWith('Report written to: output.md');
    });

    it('should handle errors properly', async () => {
      // Setup error condition
      const testError = new Error('Test error');
      vi.mocked(generateTodaySummary).mockRejectedValueOnce(testError);

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

      // Check error handling
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
