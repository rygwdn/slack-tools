import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerClearCommand } from '../../../src/commands/clear.js';
import { Command } from 'commander';

// Mock keychain functions
vi.mock('../../../src/auth/keychain.js', () => ({
  clearStoredAuth: vi.fn(),
}));

// Import mocked functions
import { clearStoredAuth } from '../../../src/auth/keychain.js';

describe('Clear Command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize program
    program = new Command();

    // Mock console methods
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

    it('should clear authentication when executed', async () => {
      // Mock clearStoredAuth to succeed
      vi.mocked(clearStoredAuth).mockResolvedValueOnce(undefined);

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

      // Check if auth was cleared
      expect(clearStoredAuth).toHaveBeenCalled();

      // Check console output
      expect(console.error).toHaveBeenCalledWith('Clearing stored authentication from keychain...');
      expect(console.error).toHaveBeenCalledWith('Authentication cleared successfully.');
    });

    it('should handle errors when clearing authentication fails', async () => {
      // Mock clearStoredAuth to fail
      const clearError = new Error('Failed to clear authentication');
      vi.mocked(clearStoredAuth).mockRejectedValueOnce(clearError);

      // Setup command execution
      let actionCallback: (() => Promise<void>) | null = null;

      vi.spyOn(program, 'command').mockReturnValue({
        description: vi.fn().mockReturnThis(),
        action: vi.fn((callback) => {
          actionCallback = callback;
        }),
      } as any);

      // Mock program.error by spying on it
      const errorSpy = vi.spyOn(program, 'error').mockImplementation(() => {
        // Return never to satisfy type
        return process.exit(1) as never;
      });

      registerClearCommand(program);

      // Execute the command action
      await actionCallback!();

      // Check error handling
      expect(errorSpy).toHaveBeenCalledWith(clearError.message);
      // No need to check process.exit since it's handled by Commander internally
    });
  });
});
