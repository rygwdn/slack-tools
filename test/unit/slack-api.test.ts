import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSlackClient } from '../../src/slack-api';
import { GlobalContext } from '../../src/context';
import { WebClient } from '@slack/web-api';

vi.mock('../../src/keychain.js');
vi.mock('../../src/tokens.js');
vi.mock('../../src/cookies.js');

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
import { getToken } from '../../src/tokens.js';
import { getCookie } from '../../src/cookies.js';

describe('slack-api', () => {
  // Test data
  const mockToken = 'xoxc-123456789';
  const mockCookie = 'xoxd-test-cookie-value';
  const mockAuth = {
    token: mockToken,
    cookie: mockCookie,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock the stored auth
    vi.mocked(getStoredAuth).mockResolvedValue(mockAuth);
    vi.mocked(getToken).mockResolvedValue(mockToken);
    vi.mocked(getCookie).mockResolvedValue(mockCookie);
    vi.mocked(clearStoredAuth).mockResolvedValue(undefined);
    vi.mocked(storeAuth).mockResolvedValue(undefined);

    // Spy on console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset WebClient constructor mock
    vi.mocked(WebClient).mockClear();

    // Reset the auth.test mock
    mockAuthTest.mockReset();
    mockAuthTest.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSlackClient', () => {
    it('should create a WebClient with correct token and cookie', async () => {
      await getSlackClient();

      expect(WebClient).toHaveBeenCalledWith(
        'xoxc-123456789',
        expect.objectContaining({
          headers: {
            Cookie: 'd=xoxd-test-cookie-value',
          },
          logger: expect.anything(),
        }),
      );
    });
  });

  describe('getSlackClient', () => {
    it('should create a WebClient with correct token and cookie', async () => {
      await getSlackClient();

      expect(WebClient).toHaveBeenCalledWith(
        'xoxc-123456789',
        expect.objectContaining({
          headers: {
            Cookie: 'd=xoxd-test-cookie-value',
          },
          logger: expect.anything(),
        }),
      );
    });

    it('should exit with error if token has invalid format', async () => {
      // Mock an invalid token
      vi.mocked(getStoredAuth).mockResolvedValue({
        token: 'invalid-token', // Not starting with xoxc-
        cookie: mockCookie,
      });

      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(getSlackClient()).rejects.toThrow(
        "Invalid token format: token should start with 'xoxc-'. Got: invalid-token",
      );
    });

    it('should set logLevel based on context.debug', async () => {
      GlobalContext.debug = false;

      await getSlackClient();

      expect(WebClient).toHaveBeenCalledWith(
        'xoxc-123456789',
        expect.objectContaining({
          logger: expect.objectContaining({
            getLevel: expect.any(Function),
          }),
        }),
      );
    });

    it('should validate auth on first call', async () => {
      GlobalContext.currentUser = undefined;

      // Execute the function
      await getSlackClient();

      // Auth should be tested
      expect(mockAuthTest).toHaveBeenCalled();

      // Flag should be set after validation
      expect(GlobalContext.currentUser).toBeDefined();
    });

    it('should not validate auth on subsequent calls', async () => {
      // First call
      GlobalContext.currentUser = undefined;
      await getSlackClient();
      expect(mockAuthTest).toHaveBeenCalled();

      // Reset mock to check if it's called again
      mockAuthTest.mockClear();

      // Second call
      await getSlackClient();

      // Auth should not be tested again
      expect(mockAuthTest).not.toHaveBeenCalled();
    });

    it('should get fresh auth if validation fails', async () => {
      GlobalContext.currentUser = undefined;

      // Make auth test fail
      mockAuthTest.mockResolvedValueOnce({ ok: false });

      // Execute the function
      await getSlackClient();

      // Should clear stored auth and get fresh tokens
      expect(clearStoredAuth).toHaveBeenCalled();
      expect(getCookie).toHaveBeenCalled();
      expect(getToken).toHaveBeenCalled();
      expect(storeAuth).toHaveBeenCalled();

      // Flag should be set after validation
      expect(GlobalContext.currentUser).toBeDefined();
    });

    it('should use stored auth when already validated', async () => {
      // Execute the function
      await getSlackClient();

      // Should get stored auth
      expect(getStoredAuth).toHaveBeenCalled();

      // Auth should not be tested
      expect(mockAuthTest).not.toHaveBeenCalled();
    });

    it('should fall back to fresh auth if stored auth is null', async () => {
      vi.mocked(getStoredAuth).mockResolvedValueOnce(null);

      await getSlackClient();

      expect(getCookie).toHaveBeenCalled();
    });
  });
});
