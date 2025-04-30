import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSlackClient,
  findWorkspaceToken,
  resetAuthTestedFlag,
  authTestedThisSession,
} from '../../src/slack-api';
import { SlackContext } from '../../src/context';
import { createTestContext } from '../../test-helpers';
import { WebClient } from '@slack/web-api';

// Mock keychain, tokens, and cookies
vi.mock('../../src/keychain.js', () => ({
  getStoredAuth: vi.fn(),
  storeAuth: vi.fn(),
  clearStoredAuth: vi.fn(),
}));

vi.mock('../../src/tokens.js', () => ({
  getTokens: vi.fn(),
}));

vi.mock('../../src/cookies.js', () => ({
  getCookie: vi.fn(),
}));

// Mock authentication test response
const mockAuthTest = vi.fn().mockResolvedValue({ ok: true });

// Mock the WebClient
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn(() => ({
    auth: {
      test: mockAuthTest,
      revoke: vi.fn(),
      teams: {
        list: vi.fn(),
      },
    },
  })),
  LogLevel: {
    DEBUG: 'debug',
    ERROR: 'error',
  },
}));

// Import mocked functions
import { getStoredAuth, storeAuth, clearStoredAuth } from '../../src/keychain.js';
import { getTokens } from '../../src/tokens.js';
import { getCookie } from '../../src/cookies.js';

describe('slack-api', () => {
  // Test data
  const mockToken = 'xoxc-123456789';
  const mockWorkspaceUrl = 'https://test-workspace.slack.com';
  const mockTokens = {
    'team1.slack.com': {
      token: 'xoxc-test-token-1',
      name: 'Team One',
    },
    'team2.slack.com': {
      token: 'xoxc-test-token-2',
      name: 'Team Two',
    },
    [mockWorkspaceUrl]: {
      token: mockToken,
      name: 'test-workspace',
    },
  };

  const mockCookie = { name: 'd', value: 'test-cookie-value' };
  const mockAuth = {
    tokens: mockTokens,
    cookie: mockCookie,
  };

  // Test context
  let context: SlackContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset auth tested state
    resetAuthTestedFlag(false);

    // Mock the stored auth
    vi.mocked(getStoredAuth).mockResolvedValue(mockAuth);
    vi.mocked(getTokens).mockResolvedValue(mockTokens);
    vi.mocked(getCookie).mockResolvedValue(mockCookie);
    vi.mocked(clearStoredAuth).mockResolvedValue(undefined);
    vi.mocked(storeAuth).mockResolvedValue(undefined);

    context = {
      workspace: 'test-workspace',
      debug: true,
      hasWorkspace: true,
      log: {
        debug: vi.fn(),
      },
    };

    // Spy on console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset WebClient constructor mock
    vi.mocked(WebClient).mockClear();

    // Reset the auth.test mock
    mockAuthTest.mockReset();
    mockAuthTest.mockResolvedValue({ ok: true });

    // Set auth flag to true to bypass validation in most tests
    resetAuthTestedFlag(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findWorkspaceToken', () => {
    it('should find a workspace by exact URL match', () => {
      const result = findWorkspaceToken(mockAuth, 'team1.slack.com', context);

      expect(result).toEqual({
        token: 'xoxc-test-token-1',
        workspaceUrl: 'team1.slack.com',
        cookie: mockCookie,
      });
    });

    it('should find a workspace by name (case insensitive)', () => {
      const result = findWorkspaceToken(mockAuth, 'team two', context);

      expect(result).toEqual({
        token: 'xoxc-test-token-2',
        workspaceUrl: 'team2.slack.com',
        cookie: mockCookie,
      });
    });

    it('should throw an error if workspace not found', () => {
      expect(() => findWorkspaceToken(mockAuth, 'non-existent', context)).toThrow(
        'Could not find workspace "non-existent"',
      );

      // Debug information should be logged
      expect(context.log.debug).toHaveBeenCalledWith('All available workspaces:');
    });

    it('should throw an error if auth has no cookie', () => {
      const authWithoutCookie = { ...mockAuth, cookie: undefined as any };
      expect(() => findWorkspaceToken(authWithoutCookie, 'team1.slack.com', context)).toThrow(
        'No cookie found in auth',
      );
    });
  });

  describe('getSlackClient', () => {
    it('should create a WebClient with correct token and cookie', async () => {
      await getSlackClient(context);

      expect(WebClient).toHaveBeenCalledWith('xoxc-123456789', {
        headers: {
          Cookie: 'd=test-cookie-value',
        },
        logLevel: 'debug', // Since context.debug is true
      });
    });

    it('should exit with error if token has invalid format', async () => {
      // Mock an invalid token
      vi.mocked(getStoredAuth).mockResolvedValue({
        tokens: {
          'test-workspace': {
            token: 'invalid-token', // Not starting with xoxc-
            name: 'Invalid Team',
          },
        },
        cookie: mockCookie,
      });

      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(getSlackClient(context)).rejects.toThrow(
        "Invalid token format: token should start with 'xoxc-'. Got: invalid-token",
      );
    });

    it('should set logLevel based on context.debug', async () => {
      context.debug = false;

      await getSlackClient(context);

      expect(WebClient).toHaveBeenCalledWith(
        'xoxc-123456789',
        expect.objectContaining({
          logLevel: 'error', // Should be ERROR when debug is false
        }),
      );
    });

    it('should validate auth on first call', async () => {
      // Reset auth flag to simulate first call
      resetAuthTestedFlag(false);

      // Execute the function
      await getSlackClient(context);

      // Auth should be tested
      expect(mockAuthTest).toHaveBeenCalled();

      // Flag should be set after validation
      expect(authTestedThisSession).toBe(true);
    });

    it('should not validate auth on subsequent calls', async () => {
      // First call
      resetAuthTestedFlag(false);
      await getSlackClient(context);
      expect(mockAuthTest).toHaveBeenCalled();

      // Reset mock to check if it's called again
      mockAuthTest.mockClear();

      // Second call
      await getSlackClient(context);

      // Auth should not be tested again
      expect(mockAuthTest).not.toHaveBeenCalled();
    });

    it('should get fresh auth if validation fails', async () => {
      // Reset auth flag
      resetAuthTestedFlag(false);

      // Make auth test fail
      mockAuthTest.mockResolvedValueOnce({ ok: false });

      // Execute the function
      await getSlackClient(context);

      // Should clear stored auth and get fresh tokens
      expect(clearStoredAuth).toHaveBeenCalled();
      expect(getCookie).toHaveBeenCalled();
      expect(getTokens).toHaveBeenCalledWith(context);
      expect(storeAuth).toHaveBeenCalled();

      // Flag should be set after validation
      expect(authTestedThisSession).toBe(true);
    });

    it('should use stored auth when already validated', async () => {
      // Set auth flag to true to bypass validation
      resetAuthTestedFlag(true);

      // Execute the function
      await getSlackClient(context);

      // Should get stored auth
      expect(getStoredAuth).toHaveBeenCalled();

      // Auth should not be tested
      expect(mockAuthTest).not.toHaveBeenCalled();
    });

    it('should fall back to fresh auth if stored auth is null', async () => {
      // Set auth flag to true to bypass validation
      resetAuthTestedFlag(true);

      // Make getStoredAuth return null
      vi.mocked(getStoredAuth).mockResolvedValueOnce(null);

      // Execute the function
      await getSlackClient(context);

      // Should get fresh tokens
      expect(getCookie).toHaveBeenCalled();
      expect(getTokens).toHaveBeenCalledWith(context);
    });
  });
});
