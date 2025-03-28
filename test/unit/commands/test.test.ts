import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTestCommand } from '../../../src/commands/test';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';
import { WebClient } from '@slack/web-api';

// Mock dependencies
vi.mock('../../../src/slack-api', () => ({
  getSlackClient: vi.fn(),
}));

// Import mocked functions
import { getSlackClient } from '../../../src/slack-api';

describe('Test Command', () => {
  let context: CommandContext;
  let program: Command;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize context
    context = new CommandContext();
    context.workspace = 'test-workspace';
    context.debug = false;
    vi.spyOn(context, 'debugLog').mockImplementation(() => {});

    // Initialize program
    program = new Command();

    // Setup mock client with auth.test response
    mockClient = {
      auth: {
        test: vi.fn().mockResolvedValue({
          ok: true,
          url: 'https://test-workspace.slack.com',
          team: 'Test Workspace',
          user: 'testuser',
          team_id: 'T12345',
          user_id: 'U12345',
        }),
      },
    };
    vi.mocked(getSlackClient).mockResolvedValue(mockClient as unknown as WebClient);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerTestCommand', () => {
    it('should register the test command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn(),
      } as any);

      registerTestCommand(program, context);

      expect(commandSpy).toHaveBeenCalledWith('test');
    });

    it('should test authentication when executed', async () => {
      // Setup command execution
      let actionCallback: ((options: any) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTestCommand(program, context);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!({});

      // Check if client was fetched for the correct workspace
      expect(getSlackClient).toHaveBeenCalledWith('test-workspace', context);

      // Check if auth.test was called
      expect(mockClient.auth.test).toHaveBeenCalled();

      // Check basic console output
      expect(console.log).toHaveBeenCalledWith('Testing auth for workspace:', 'test-workspace');
      expect(console.log).toHaveBeenCalledWith('\nAPI Response:');

      // Instead of checking exact JSON, just verify some key parts of the response were logged
      const consoleLogCalls = vi
        .mocked(console.log)
        .mock.calls.map((call) => call.map((arg) => String(arg)).join(' '));
      const joinedOutput = consoleLogCalls.join(' ');

      expect(joinedOutput).toContain('Test Workspace');
      expect(joinedOutput).toContain('testuser');
    });

    it('should handle authentication errors', async () => {
      // Mock API error
      const authError = new Error('Authentication failed');
      vi.mocked(getSlackClient).mockRejectedValueOnce(authError);

      // Setup command execution
      let actionCallback: ((options: any) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTestCommand(program, context);

      // Execute the command action
      await actionCallback!({});

      // Check error handling
      expect(console.error).toHaveBeenCalledWith('Error:', authError);
      expect(console.log).toHaveBeenCalledWith(
        '\nTip: Run with -d/--debug flag for more troubleshooting information',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should not show debug tip if debug mode is enabled', async () => {
      // Enable debug mode
      context.debug = true;

      // Mock API error
      const authError = new Error('Authentication failed');
      vi.mocked(getSlackClient).mockRejectedValueOnce(authError);

      // Setup command execution
      let actionCallback: ((options: any) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerTestCommand(program, context);

      // Execute the command action
      await actionCallback!({});

      // Check error handling
      expect(console.error).toHaveBeenCalledWith('Error:', authError);

      // Debug tip should not be shown
      const debugTipCalls = vi
        .mocked(console.log)
        .mock.calls.filter((call) => call[0] && call[0].toString().includes('--debug flag'));
      expect(debugTipCalls.length).toBe(0);

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
