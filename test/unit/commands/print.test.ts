import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerPrintCommand } from '../../../src/commands/print';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';

// Mock dependencies
vi.mock('../../../src/auth', () => ({
  getSlackAuth: vi.fn(),
}));

// Import the mocked functions
import { getSlackAuth } from '../../../src/auth';

describe('Print Command', () => {
  let context: CommandContext;
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();

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

  describe('registerPrintCommand', () => {
    it('should register the print command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn(),
      } as any);

      registerPrintCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('print');
    });

    it('should setup command options', () => {
      const optionSpy = vi.fn().mockReturnThis();
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: optionSpy,
        action: vi.fn(),
      } as any);

      registerPrintCommand(program, context);

      expect(optionSpy).toHaveBeenCalledWith('-q, --quiet', expect.any(String));
    });

    it('should print tokens and cookies when no workspace is selected', async () => {
      // Mock authentication response
      const mockAuth = {
        tokens: {
          'team1.slack.com': {
            name: 'Team 1',
            token: 'xoxc-token-1',
            cookie: 'd=cookie1',
          },
          'team2.slack.com': {
            name: 'Team 2',
            token: 'xoxc-token-2',
            cookie: 'd=cookie2',
          },
        },
        cookie: {
          name: 'd',
          value: 'cookie-value',
        },
      };

      vi.mocked(getSlackAuth).mockResolvedValueOnce(mockAuth);

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program, context);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!({ quiet: false });

      // Check if auth was fetched correctly (without workspace filter)
      expect(getSlackAuth).toHaveBeenCalledWith({
        workspace: undefined,
        quiet: false,
      });

      // Check console output
      expect(console.log).toHaveBeenCalledWith('Getting Slack credentials...');
      expect(console.log).toHaveBeenCalledWith('\nFound tokens for workspaces:\n');
      expect(console.log).toHaveBeenCalledWith('Team 1 (team1.slack.com)');
      expect(console.log).toHaveBeenCalledWith('Token: xoxc-token-1\n');
      expect(console.log).toHaveBeenCalledWith('Team 2 (team2.slack.com)');
      expect(console.log).toHaveBeenCalledWith('Token: xoxc-token-2\n');
      expect(console.log).toHaveBeenCalledWith('Found cookie:');
      expect(console.log).toHaveBeenCalledWith('d: cookie-value\n');

      // Check tip message for multiple workspaces
      expect(console.log).toHaveBeenCalledWith(
        '\nTip: To filter results for a specific workspace, use one of:',
      );
    });

    it('should print tokens for a specific workspace when selected', async () => {
      // Set workspace in context
      Object.defineProperty(context, 'hasWorkspace', { get: () => true });
      context.workspace = 'team1';

      // Mock authentication response for a single workspace
      const mockAuth = {
        tokens: {
          'team1.slack.com': {
            name: 'Team 1',
            token: 'xoxc-token-1',
            cookie: 'd=cookie1',
          },
        },
        cookie: {
          name: 'd',
          value: 'cookie-value',
        },
      };

      vi.mocked(getSlackAuth).mockResolvedValueOnce(mockAuth);

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program, context);

      // Execute the command action
      await actionCallback!({ quiet: false });

      // Check if auth was fetched with workspace filter
      expect(getSlackAuth).toHaveBeenCalledWith({
        workspace: 'team1',
        quiet: false,
      });

      // Check workspace-specific output
      expect(console.log).toHaveBeenCalledWith('Team 1 (team1.slack.com)');
      expect(console.log).toHaveBeenCalledWith('Token: xoxc-token-1\n');

      // Check that tip message for multiple workspaces is NOT shown
      const tipCalls = vi
        .mocked(console.log)
        .mock.calls.filter(
          (call) => call[0] && call[0].toString().includes('Tip: To filter results'),
        );
      expect(tipCalls.length).toBe(0);
    });

    it('should print only token and cookie values in quiet mode', async () => {
      // Mock authentication response
      const mockAuth = {
        tokens: {
          'team1.slack.com': {
            name: 'Team 1',
            token: 'xoxc-token-1',
            cookie: 'd=cookie1',
          },
        },
        cookie: {
          name: 'd',
          value: 'cookie-value',
        },
      };

      vi.mocked(getSlackAuth).mockResolvedValueOnce(mockAuth);

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program, context);

      // Execute the command action with quiet option
      await actionCallback!({ quiet: true });

      // Check if auth was fetched with quiet flag
      expect(getSlackAuth).toHaveBeenCalledWith({
        workspace: undefined,
        quiet: true,
      });

      // Check quiet mode output (only token and cookie values)
      expect(console.log).toHaveBeenCalledWith('xoxc-token-1');
      expect(console.log).toHaveBeenCalledWith('cookie-value');

      // Check that descriptive messages are NOT shown
      expect(console.log).not.toHaveBeenCalledWith('Getting Slack credentials...');
      expect(console.log).not.toHaveBeenCalledWith('Found tokens for workspaces:');
    });

    it('should handle error when no tokens are found', async () => {
      // Mock authentication with no tokens
      const mockAuth = {
        tokens: {},
        cookie: {
          name: 'd',
          value: 'cookie-value',
        },
      };

      vi.mocked(getSlackAuth).mockResolvedValueOnce(mockAuth);

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program, context);

      // Execute the command action
      await actionCallback!({ quiet: false });

      // Check error handling
      expect(console.error).toHaveBeenCalledWith('Error: No tokens found.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle error when workspace is not found', async () => {
      // Set non-existent workspace in context
      Object.defineProperty(context, 'hasWorkspace', { get: () => true });
      context.workspace = 'nonexistent-team';

      // Mock authentication with no tokens
      const mockAuth = {
        tokens: {},
        cookie: {
          name: 'd',
          value: 'cookie-value',
        },
      };

      vi.mocked(getSlackAuth).mockResolvedValueOnce(mockAuth);

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program, context);

      // Execute the command action
      await actionCallback!({ quiet: false });

      // Check workspace-specific error message
      expect(console.error).toHaveBeenCalledWith('Error: No tokens found.');
      expect(console.error).toHaveBeenCalledWith(
        'No workspace matching "nonexistent-team" was found.',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle general errors', async () => {
      // Mock authentication error
      const authError = new Error('Auth failed');
      vi.mocked(getSlackAuth).mockRejectedValueOnce(authError);

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program, context);

      // Execute the command action
      await actionCallback!({ quiet: false });

      // Check general error handling
      expect(console.error).toHaveBeenCalledWith('Error:', authError);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
