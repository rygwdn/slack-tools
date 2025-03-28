import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerClearCommand } from '../../../src/commands/clear';
import { Command } from 'commander';

// Mock cache functions
vi.mock('../../../src/cache', () => ({
  clearStoredTokens: vi.fn(),
}));

// Import mocked functions
import { clearStoredTokens } from '../../../src/cache';

describe('Clear Command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();

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

  describe('registerClearCommand', () => {
    it('should register the clear command with program', () => {
      const commandSpy = vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn(),
      } as any);

      registerClearCommand(program);

      expect(commandSpy).toHaveBeenCalledWith('clear');
    });

    it('should clear tokens when executed', async () => {
      // Mock clearStoredTokens to succeed
      vi.mocked(clearStoredTokens).mockResolvedValueOnce(undefined);

      // Setup command execution
      let actionCallback: (() => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerClearCommand(program);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!();

      // Check if tokens were cleared
      expect(clearStoredTokens).toHaveBeenCalled();

      // Check console output
      expect(console.log).toHaveBeenCalledWith('Clearing stored tokens from keychain...');
      expect(console.log).toHaveBeenCalledWith('Tokens cleared successfully.');
    });

    it('should handle errors when clearing tokens fails', async () => {
      // Mock clearStoredTokens to fail
      const clearError = new Error('Failed to clear tokens');
      vi.mocked(clearStoredTokens).mockRejectedValueOnce(clearError);

      // Setup command execution
      let actionCallback: (() => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      registerClearCommand(program);

      // Execute the command action
      await actionCallback!();

      // Check error handling
      expect(console.error).toHaveBeenCalledWith('Error:', clearError);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
