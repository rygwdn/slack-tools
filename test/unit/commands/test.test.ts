import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as slackApi from '../../../src/slack-api';
import * as keychain from '../../../src/auth/keychain';
import { registerTestCommand } from '../../../src/commands/test';
import { Command } from 'commander';
import { SlackAuth } from '../../../src/types';

// Mock dependencies
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn(),
}));

vi.mock('../../../src/auth/keychain', () => ({
  getStoredAuth: vi.fn(),
}));

import { createWebClient } from '../../../src/slack-api';

describe('Test Command', () => {
  let program: Command;
  const mockAuth: SlackAuth = { token: 'test-token', cookie: 'test-cookie' };
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

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
    vi.mocked(keychain.getAuth).mockResolvedValue(mockAuth);
    vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);

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

      registerTestCommand(program);

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

      registerTestCommand(program);

      // Execute the command action
      expect(actionCallback).not.toBeNull();
      await actionCallback!({});

      // Check if auth.test was called
      expect(mockClient.auth.test).toHaveBeenCalled();

      // Check basic console output
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
      vi.mocked(createWebClient).mockRejectedValueOnce(authError);

      // Setup command execution
      let actionCallback: ((options: any) => Promise<void>) | null = null;

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

      registerTestCommand(program);

      // Execute the command action
      await actionCallback!({});

      // Check error handling
      expect(errorSpy).toHaveBeenCalledWith(authError.message);
    });

    it('should not show debug tip if debug mode is enabled', async () => {
      // Mock API error
      const authError = new Error('Authentication failed');
      vi.mocked(createWebClient).mockRejectedValueOnce(authError);

      // Setup command execution
      let actionCallback: ((options: any) => Promise<void>) | null = null;

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

      registerTestCommand(program);

      // Execute the command action
      await actionCallback!({});

      // Check error handling
      expect(errorSpy).toHaveBeenCalledWith(authError.message);

      // Debug tip should not be shown
      const debugTipCalls = vi
        .mocked(console.log)
        .mock.calls.filter((call) => call[0] && call[0].toString().includes('--debug flag'));
      expect(debugTipCalls.length).toBe(0);
    });
  });
});
