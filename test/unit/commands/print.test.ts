import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerPrintCommand } from '../../../src/commands/print';
import { Command } from 'commander';

// Mock dependencies
vi.mock('../../../src/slack-api');
vi.mock('../../../src/keychain.js');
vi.mock('../../../src/tokens.js');
vi.mock('../../../src/cookies.js');

// Import the mocked functions
import { getStoredAuth } from '../../../src/keychain.js';
import { getCookie } from '../../../src/cookies.js';
import { GlobalContext } from '../../../src/context';

describe('Print Command', () => {
  let program: Command;

  // Mock data
  const mockToken = 'xoxc-token-1';
  const mockCookie = 'cookie-value';

  const mockAuth = {
    token: mockToken,
    cookie: mockCookie,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    program = new Command();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Default mock implementations
    vi.mocked(getStoredAuth).mockResolvedValue(mockAuth);
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

      registerPrintCommand(program);

      expect(commandSpy).toHaveBeenCalledWith('print');
    });

    it('should setup command options', () => {
      const optionSpy = vi.fn().mockReturnThis();
      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: optionSpy,
        action: vi.fn(),
      } as any);

      registerPrintCommand(program);

      expect(optionSpy).toHaveBeenCalledWith('-q, --quiet', expect.any(String));
    });

    it('should print tokens and cookies when no workspace is selected', async () => {
      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!({ quiet: false });

      // Check if auth was used correctly
      expect(getStoredAuth).toHaveBeenCalled();

      // Check console output
      expect(console.log).toHaveBeenCalledWith(`Token: ${mockToken}\n`);
      expect(console.log).toHaveBeenCalledWith('Found cookie:');
      expect(console.log).toHaveBeenCalledWith('cookie-value\n');
    });

    it('should print tokens for a specific workspace when selected', async () => {
      GlobalContext.workspace = 'team1';
      GlobalContext.hasWorkspace = true;

      // Setup command execution
      let actionCallback: ((options: { quiet: boolean }) => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerPrintCommand(program);

      // Execute the command action
      await actionCallback!({ quiet: false });

      // Check if token was fetched for the specific workspace
      expect(getStoredAuth).toHaveBeenCalledWith('team1');

      // Check workspace-specific output
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

      registerPrintCommand(program);

      // Execute the command action with quiet option
      await actionCallback!({ quiet: true });

      // Check quiet mode output (only token and cookie values)
      expect(console.log).toHaveBeenCalledWith(mockToken);
      expect(console.log).toHaveBeenCalledWith('cookie-value');

      // Check that descriptive messages are NOT shown
      expect(console.log).not.toHaveBeenCalledWith('Getting Slack credentials...');
    });
  });
});
