import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerPrintCommand } from '../../../src/commands/print';
import { CommandContext } from '../../../src/context';
import { Command } from 'commander';

// Mock dependencies
vi.mock('../../../src/slack-api', () => ({
  findWorkspaceToken: vi.fn(),
}));

vi.mock('../../../src/keychain.js', () => ({
  getStoredAuth: vi.fn(),
  storeAuth: vi.fn(),
}));

vi.mock('../../../src/tokens.js', () => ({
  getTokens: vi.fn(),
}));

vi.mock('../../../src/cookies.js', () => ({
  getCookie: vi.fn(),
}));

// Import the mocked functions
import { findWorkspaceToken } from '../../../src/slack-api';
import { getStoredAuth } from '../../../src/keychain.js';
import { getTokens } from '../../../src/tokens.js';
import { getCookie } from '../../../src/cookies.js';

describe('Print Command', () => {
  let context: CommandContext;
  let program: Command;

  // Mock data
  const mockToken = 'xoxc-token-1';
  const mockWorkspaceUrl = 'team1.slack.com';
  const mockCookie = { name: 'd', value: 'cookie-value' };
  const mockTokenResponse = {
    token: mockToken,
    workspaceUrl: mockWorkspaceUrl,
    cookie: mockCookie,
  };

  const mockAuth = {
    tokens: {
      'team1.slack.com': { token: mockToken, name: 'Team One' },
      'team2.slack.com': { token: 'xoxc-token-2', name: 'Team Two' },
    },
    cookie: mockCookie,
  };

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

    // Default mock implementations
    vi.mocked(getStoredAuth).mockResolvedValue(mockAuth);
    vi.mocked(findWorkspaceToken).mockReturnValue(mockTokenResponse);
    vi.mocked(getTokens).mockResolvedValue(mockAuth.tokens);
    vi.mocked(getCookie).mockResolvedValue(mockCookie);
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
      // Mock findWorkspaceToken response
      vi.mocked(findWorkspaceToken).mockReturnValueOnce(mockTokenResponse);

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

      // Check if auth was used correctly
      expect(getStoredAuth).toHaveBeenCalled();
      expect(findWorkspaceToken).toHaveBeenCalledWith(expect.anything(), 'default', context);

      // Check console output
      expect(console.log).toHaveBeenCalledWith('Getting Slack credentials...');
      expect(console.log).toHaveBeenCalledWith('\nFound token for workspace:\n');
      expect(console.log).toHaveBeenCalledWith(`Workspace URL: ${mockWorkspaceUrl}`);
      expect(console.log).toHaveBeenCalledWith(`Token: ${mockToken}\n`);
      expect(console.log).toHaveBeenCalledWith('Found cookie:');
      expect(console.log).toHaveBeenCalledWith('d: cookie-value\n');
    });

    it('should print tokens for a specific workspace when selected', async () => {
      // Set workspace in context
      Object.defineProperty(context, 'hasWorkspace', { get: () => true });
      context.workspace = 'team1';

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

      // Check if token was fetched for the specific workspace
      expect(findWorkspaceToken).toHaveBeenCalledWith(expect.anything(), 'team1', context);

      // Check workspace-specific output
      expect(console.log).toHaveBeenCalledWith('\nFound token for workspace:\n');
      expect(console.log).toHaveBeenCalledWith(`Workspace URL: ${mockWorkspaceUrl}`);
      expect(console.log).toHaveBeenCalledWith(`Token: ${mockToken}\n`);
    });

    it('should print only token and cookie values in quiet mode', async () => {
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

      // Check quiet mode output (only token and cookie values)
      expect(console.log).toHaveBeenCalledWith(mockToken);
      expect(console.log).toHaveBeenCalledWith('cookie-value');

      // Check that descriptive messages are NOT shown
      expect(console.log).not.toHaveBeenCalledWith('Getting Slack credentials...');
    });

    it('should handle error when no workspace is found and try with first available workspace', async () => {
      // First findWorkspaceToken call throws error for 'default' workspace
      vi.mocked(findWorkspaceToken)
        .mockImplementationOnce(() => {
          throw new Error('Could not find workspace "default"');
        })
        .mockReturnValueOnce(mockTokenResponse); // Second call succeeds

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

      // Check that it tried with default workspace first, then fell back to first workspace
      expect(findWorkspaceToken).toHaveBeenCalledTimes(2);

      // Check fallback output
      expect(console.log).toHaveBeenCalledWith('\nFound token for workspace:\n');
      expect(console.log).toHaveBeenCalledWith(`Workspace URL: ${mockWorkspaceUrl}`);
      expect(console.log).toHaveBeenCalledWith(`Token: ${mockToken}\n`);
    });

    it('should handle error when specific workspace is not found', async () => {
      // Set non-existent workspace in context
      Object.defineProperty(context, 'hasWorkspace', { get: () => true });
      context.workspace = 'nonexistent-team';

      // Mock findWorkspaceToken to throw an error
      vi.mocked(findWorkspaceToken).mockImplementationOnce(() => {
        throw new Error('Could not find workspace "nonexistent-team"');
      });

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
      expect(console.error).toHaveBeenCalledWith(
        'Error getting workspace "nonexistent-team":',
        expect.any(Error),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle general errors when both workspace attempts fail', async () => {
      // Both findWorkspaceToken calls throw errors
      vi.mocked(findWorkspaceToken).mockImplementation(() => {
        throw new Error('No workspaces available');
      });

      // Set up getStoredAuth to return auth but with no tokens
      vi.mocked(getStoredAuth).mockResolvedValue({
        tokens: {},
        cookie: mockCookie,
      });

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
      expect(console.error).toHaveBeenCalledWith(
        'Error getting any workspace token:',
        expect.any(Error),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
