import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as slackApi from '../../src/slack-api';
import { GlobalContext } from '../../src/context';
import { WebClient } from '@slack/web-api';
import * as keychain from '../../src/auth/keychain';
import { SlackAuth } from '../../src/types';
import { AuthError } from '../../src/utils/auth-error';

vi.mock('@slack/web-api');
vi.mock('../../src/auth/keychain');

const mockAuth: SlackAuth = { token: 'xoxc-test-token', cookie: 'xoxd-test-cookie' };

describe('Slack API Client', () => {
  let mockAuthTest: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthTest = vi.fn();

    vi.mocked(WebClient).mockImplementation(
      () =>
        ({
          auth: {
            test: mockAuthTest,
          },
        }) as any,
    );

    vi.mocked(keychain.storeAuth).mockClear();
    vi.mocked(keychain.clearStoredAuth).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createWebClient', () => {
    it('should create a WebClient and validate auth successfully', async () => {
      mockAuthTest.mockResolvedValue({ ok: true, user_id: 'U123' });

      await slackApi.createWebClient(mockAuth);

      expect(WebClient).toHaveBeenCalledWith(mockAuth.token, expect.any(Object));
      expect(mockAuthTest).toHaveBeenCalled();
      expect(GlobalContext.currentUser).toEqual({ ok: true, user_id: 'U123' });
    });

    it('should throw an AuthError if auth.test fails', async () => {
      mockAuthTest.mockResolvedValue({
        ok: false,
        error: 'auth_failed',
      });

      await expect(slackApi.createWebClient(mockAuth)).rejects.toThrow(AuthError);
      await expect(slackApi.createWebClient(mockAuth)).rejects.toThrow(
        'Slack API rejected the credentials: auth_failed',
      );
      expect(mockAuthTest).toHaveBeenCalled(); // Ensure it was called
    });
  });

  describe('validateSlackAuth', () => {
    const validToken = 'xoxc-valid-token';
    const validCookie = 'xoxd-valid-cookie';

    it('should return valid auth object for correct token and cookie', () => {
      const auth = { token: validToken, cookie: validCookie };
      const result = slackApi.validateSlackAuth(auth);
      expect(result).toEqual({ token: validToken, cookie: validCookie });
    });

    it('should throw AuthError if token is missing', () => {
      const auth = { token: null, cookie: validCookie };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Authentication validation failed: token is required',
      );
    });

    it('should throw AuthError if cookie is missing', () => {
      const auth = { token: validToken, cookie: undefined };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Authentication validation failed: cookie is required',
      );
    });

    it('should throw AuthError if both token and cookie are missing', () => {
      const auth = { token: null, cookie: null };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      // The message comes from the initial check
      expect(() => slackApi.validateSlackAuth(auth)).toThrow('No authentication credentials found');
    });

    it('should throw AuthError if token has invalid format', () => {
      const auth = { token: 'invalid-token', cookie: validCookie };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Authentication validation failed: invalid token format',
      );
    });

    it('should throw AuthError if cookie has invalid format', () => {
      const auth = { token: validToken, cookie: 'invalid-cookie' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Authentication validation failed: invalid cookie format',
      );
    });

    it('should throw AuthError with multiple reasons if both formats are invalid', () => {
      const auth = { token: 'invalid-token', cookie: 'invalid-cookie' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Authentication validation failed: invalid token format, invalid cookie format',
      );
    });

    it('should throw AuthError if token is missing and cookie is invalid', () => {
      const auth = { token: null, cookie: 'invalid-cookie' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Authentication validation failed: token is required, invalid cookie format',
      );
    });

    it('should throw AuthError if auth object is null or undefined', () => {
      // @ts-expect-error Testing invalid input
      expect(() => slackApi.validateSlackAuth(null)).toThrow(AuthError);
      // @ts-expect-error Testing invalid input
      expect(() => slackApi.validateSlackAuth(undefined)).toThrow(AuthError);
      // @ts-expect-error Testing invalid input
      expect(() => slackApi.validateSlackAuth(null)).toThrow('No authentication credentials found');
    });
  });
});
