import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import keytar from 'keytar';
import * as keychain from '../../../src/auth/keychain';
import { AuthError } from '../../../src/utils/auth-error';
import { validateSlackAuth as originalValidateSlackAuth } from '../../../src/slack-api';

// Mock keytar
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
    findCredentials: vi.fn(),
  },
}));

// Mock validateSlackAuth defined *inside* the factory
vi.mock('../../../src/slack-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/slack-api')>();
  return {
    ...actual,
    validateSlackAuth: vi.fn((auth) => {
      if (!auth?.token && !auth?.cookie) {
        throw new AuthError('No authentication credentials found');
      }
      if (auth.token === 'invalid-token') {
        throw new AuthError('Authentication validation failed: invalid token format');
      }
      if (auth.cookie === 'invalid-cookie') {
        throw new AuthError('Authentication validation failed: invalid cookie format');
      }
      // Assume valid otherwise for these tests
      return auth;
    }),
  };
});

const SERVICE_NAME = 'slack-tools'; // Corrected service name
const COOKIE_KEY = 'slack-cookie';
const TOKEN_KEY = 'slack-token';

const mockToken = 'xoxc-keytar-token';
const mockCookie = 'xoxd-keytar-cookie';
const mockEnvToken = 'xoxc-env-token';
const mockEnvCookie = 'xoxd-env-cookie';

describe('Keychain Auth Utilities', () => {
  // Get a reference to the *mocked* function
  const mockedValidateSlackAuth = vi.mocked(originalValidateSlackAuth);

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear specific mocks manually
    mockedValidateSlackAuth.mockClear();
    vi.mocked(keytar.getPassword).mockClear();
    vi.mocked(keytar.findCredentials).mockClear();
    vi.mocked(keytar.deletePassword).mockClear();
    vi.mocked(keytar.setPassword).mockClear();

    // Clear env vars before each test
    delete process.env.SLACK_TOKEN;
    delete process.env.SLACK_COOKIE;
  });

  afterEach(() => {
    // Ensure env vars are cleared after tests
    delete process.env.SLACK_TOKEN;
    delete process.env.SLACK_COOKIE;
  });

  describe('storeAuth', () => {
    it('should call keytar.setPassword for both cookie and token', async () => {
      const auth = { token: mockToken, cookie: mockCookie };
      await keychain.storeAuth(auth);
      expect(keytar.setPassword).toHaveBeenCalledTimes(2);
      expect(keytar.setPassword).toHaveBeenCalledWith(SERVICE_NAME, COOKIE_KEY, mockCookie);
      expect(keytar.setPassword).toHaveBeenCalledWith(SERVICE_NAME, TOKEN_KEY, mockToken);
    });
  });

  describe('getAuth', () => {
    // No longer need beforeEach for validateSlackAuthMock

    it('should prioritize environment variables over keychain', async () => {
      process.env.SLACK_TOKEN = mockEnvToken;
      process.env.SLACK_COOKIE = mockEnvCookie;
      vi.mocked(keytar.getPassword).mockResolvedValue('keychain-value');

      const result = await keychain.getAuth();

      expect(keytar.getPassword).not.toHaveBeenCalled();
      expect(mockedValidateSlackAuth).toHaveBeenCalledWith({
        token: mockEnvToken,
        cookie: mockEnvCookie,
      });
      expect(result).toEqual({ token: mockEnvToken, cookie: mockEnvCookie });
    });

    it('should use keychain values if environment variables are not set', async () => {
      vi.mocked(keytar.getPassword)
        .mockResolvedValueOnce(mockCookie) // First call for cookie
        .mockResolvedValueOnce(mockToken); // Second call for token

      const result = await keychain.getAuth();

      expect(keytar.getPassword).toHaveBeenCalledTimes(2);
      expect(keytar.getPassword).toHaveBeenNthCalledWith(1, SERVICE_NAME, COOKIE_KEY);
      expect(keytar.getPassword).toHaveBeenNthCalledWith(2, SERVICE_NAME, TOKEN_KEY);
      expect(mockedValidateSlackAuth).toHaveBeenCalledWith({
        token: mockToken,
        cookie: mockCookie,
      });
      expect(result).toEqual({ token: mockToken, cookie: mockCookie });
    });

    it('should call validateSlackAuth with combined values (env token, keychain cookie)', async () => {
      process.env.SLACK_TOKEN = mockEnvToken;
      vi.mocked(keytar.getPassword).mockResolvedValueOnce(mockCookie); // Only call needed is for cookie

      const result = await keychain.getAuth();

      expect(keytar.getPassword).toHaveBeenCalledTimes(1);
      expect(keytar.getPassword).toHaveBeenCalledWith(SERVICE_NAME, COOKIE_KEY);
      expect(mockedValidateSlackAuth).toHaveBeenCalledWith({
        token: mockEnvToken,
        cookie: mockCookie,
      });
      expect(result).toEqual({ token: mockEnvToken, cookie: mockCookie });
    });

    it('should call validateSlackAuth with combined values (keychain token, env cookie)', async () => {
      process.env.SLACK_COOKIE = mockEnvCookie;
      vi.mocked(keytar.getPassword).mockResolvedValueOnce(mockToken); // Only call needed is for token

      const result = await keychain.getAuth();

      expect(keytar.getPassword).toHaveBeenCalledTimes(1);
      expect(keytar.getPassword).toHaveBeenCalledWith(SERVICE_NAME, TOKEN_KEY);
      expect(mockedValidateSlackAuth).toHaveBeenCalledWith({
        token: mockToken,
        cookie: mockEnvCookie,
      });
      expect(result).toEqual({ token: mockToken, cookie: mockEnvCookie });
    });

    it('should throw AuthError if neither env vars nor keychain have values', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue(null);

      await expect(keychain.getAuth()).rejects.toThrow('No authentication credentials found');
      expect(keytar.getPassword).toHaveBeenCalledTimes(2);
      expect(mockedValidateSlackAuth).toHaveBeenCalledWith({ token: null, cookie: null });
    });

    it('should propagate AuthError from validateSlackAuth for invalid token', async () => {
      process.env.SLACK_TOKEN = 'invalid-token';
      process.env.SLACK_COOKIE = mockEnvCookie;

      await expect(keychain.getAuth()).rejects.toThrow(
        'Authentication validation failed: invalid token format',
      );
      expect(mockedValidateSlackAuth).toHaveBeenCalledWith({
        token: 'invalid-token',
        cookie: mockEnvCookie,
      });
    });
  });

  describe('clearStoredAuth', () => {
    it('should find credentials and delete each one', async () => {
      const credentials = [
        { account: COOKIE_KEY, password: 'cookie-val' },
        { account: TOKEN_KEY, password: 'token-val' },
        { account: 'other-key', password: 'other-val' },
      ];
      vi.mocked(keytar.findCredentials).mockResolvedValue(credentials);
      vi.mocked(keytar.deletePassword).mockResolvedValue(true);

      await keychain.clearStoredAuth();

      expect(keytar.findCredentials).toHaveBeenCalledWith(SERVICE_NAME);
      expect(keytar.deletePassword).toHaveBeenCalledTimes(credentials.length);
      expect(keytar.deletePassword).toHaveBeenCalledWith(SERVICE_NAME, COOKIE_KEY);
      expect(keytar.deletePassword).toHaveBeenCalledWith(SERVICE_NAME, TOKEN_KEY);
      expect(keytar.deletePassword).toHaveBeenCalledWith(SERVICE_NAME, 'other-key');
    });

    it('should handle no credentials found', async () => {
      vi.mocked(keytar.findCredentials).mockResolvedValue([]);
      await keychain.clearStoredAuth();
      expect(keytar.findCredentials).toHaveBeenCalledWith(SERVICE_NAME);
      expect(keytar.deletePassword).not.toHaveBeenCalled();
    });
  });
});
