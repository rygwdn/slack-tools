import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWorkspaceToken, getSlackClient } from '../../src/slack-api';
import { getSlackAuth } from '../../src/auth';
import { CommandContext } from '../../src/context';
import { WebClient } from '@slack/web-api';

// Mock the auth module
vi.mock('../../src/auth', () => ({
  getSlackAuth: vi.fn(),
}));

// Mock the WebClient
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn(),
  LogLevel: {
    DEBUG: 'debug',
    ERROR: 'error',
  },
}));

describe('slack-api', () => {
  let context: CommandContext;
  const mockTokens = {
    'team1.slack.com': {
      token: 'xoxc-test-token-1',
      name: 'Team One',
    },
    'team2.slack.com': {
      token: 'xoxc-test-token-2',
      name: 'Team Two',
    },
  };

  const mockCookie = { name: 'd', value: 'test-cookie-value' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock the auth response
    vi.mocked(getSlackAuth).mockResolvedValue({
      tokens: mockTokens,
      cookie: mockCookie,
    });

    // Create a context with debug mode
    context = new CommandContext();
    context.debug = true;

    // Spy on console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getWorkspaceToken', () => {
    it('should find a workspace by exact URL match', async () => {
      const result = await getWorkspaceToken('team1.slack.com', context);

      expect(result).toEqual({
        token: 'xoxc-test-token-1',
        workspaceUrl: 'team1.slack.com',
        cookie: mockCookie,
      });

      // Verify auth was called with context
      expect(getSlackAuth).toHaveBeenCalledWith({ context });
    });

    it('should find a workspace by name (case insensitive)', async () => {
      const result = await getWorkspaceToken('team two', context);

      expect(result).toEqual({
        token: 'xoxc-test-token-2',
        workspaceUrl: 'team2.slack.com',
        cookie: mockCookie,
      });
    });

    it('should throw an error if workspace not found', async () => {
      await expect(getWorkspaceToken('non-existent', context)).rejects.toThrow(
        'Could not find workspace "non-existent"',
      );

      // Debug information should be logged
      expect(console.error).toHaveBeenCalledWith('[DEBUG]', 'All available workspaces:');
    });
  });

  describe('getSlackClient', () => {
    it('should create a WebClient with correct token and cookie', async () => {
      await getSlackClient('team1.slack.com', context);

      expect(WebClient).toHaveBeenCalledWith('xoxc-test-token-1', {
        headers: {
          Cookie: 'd=test-cookie-value',
        },
        logLevel: 'debug', // Since context.debug is true
      });
    });

    it('should throw an error if token has invalid format', async () => {
      // Mock an invalid token
      vi.mocked(getSlackAuth).mockResolvedValue({
        tokens: {
          'invalid.slack.com': {
            token: 'invalid-token', // Not starting with xoxc-
            name: 'Invalid Team',
          },
        },
        cookie: mockCookie,
      });

      await expect(getSlackClient('invalid.slack.com', context)).rejects.toThrow(
        "Invalid token format: token should start with 'xoxc-'. Got: invalid-token",
      );
    });

    it('should set logLevel based on context.debug', async () => {
      // Test with debug disabled
      context.debug = false;

      await getSlackClient('team1.slack.com', context);

      expect(WebClient).toHaveBeenCalledWith(
        'xoxc-test-token-1',
        expect.objectContaining({
          logLevel: 'error', // Should be ERROR when debug is false
        }),
      );
    });
  });
});
