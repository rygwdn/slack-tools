import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as slackApi from '../../../src/slack-api';
import * as keychain from '../../../src/auth/keychain';
import { registerTestCommand } from '../../../src/commands/test';
import { Command } from 'commander';
import { SlackAuth } from '../../../src/types';
import * as authErrorUtils from '../../../src/utils/auth-error';

// Mock dependencies
vi.mock('../../../src/slack-api', () => ({
  createWebClient: vi.fn(),
}));

vi.mock('../../../src/auth/keychain', () => ({
  getAuth: vi.fn(),
}));

// Mock the auth error handler
vi.mock('../../../src/utils/auth-error', async (importOriginal) => {
  const actual = await importOriginal<typeof authErrorUtils>();
  return {
    ...actual,
    handleCommandError: vi.fn(),
  };
});

describe('Test Command', () => {
  let program: Command;
  const mockAuth: SlackAuth = { token: 'xoxc-test-token', cookie: 'xoxd-test-cookie' };
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

    it('should test authentication when executed successfully', async () => {
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

    it('should call handleCommandError on authentication errors', async () => {
      // Mock API error (e.g., AuthError)
      const authFailureError = new authErrorUtils.AuthError('Invalid credentials');
      vi.mocked(keychain.getAuth).mockRejectedValueOnce(authFailureError);

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
      await actionCallback!({});

      // Check that handleCommandError was called
      expect(authErrorUtils.handleCommandError).toHaveBeenCalledWith(authFailureError, program);
    });

    it('should call handleCommandError on other errors during execution', async () => {
      // Mock a different error during auth.test call
      const testApiError = new Error('Network Error');
      mockClient.auth.test.mockRejectedValueOnce(testApiError);
      vi.mocked(slackApi.createWebClient).mockResolvedValue(mockClient);
      vi.mocked(keychain.getAuth).mockResolvedValue(mockAuth);

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
      await actionCallback!({});

      // Check that handleCommandError was called with the specific error
      expect(authErrorUtils.handleCommandError).toHaveBeenCalledWith(testApiError, program);
    });
  });
});
