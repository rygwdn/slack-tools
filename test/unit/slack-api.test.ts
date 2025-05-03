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
const mockInvalidAuth: SlackAuth = { token: 'invalid-token', cookie: 'invalid-cookie' };

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
        'Authentication test failed',
      );
      expect(mockAuthTest).toHaveBeenCalled(); // Ensure it was called
    });
  });

  describe('validateSlackAuth', () => {
    it('should pass with valid auth', () => {
      expect(() => slackApi.validateSlackAuth(mockAuth)).not.toThrow();
    });

    it('should throw AuthError for missing token', () => {
      const auth = { ...mockAuth, token: '' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow('token is required');
    });

    it('should throw AuthError for missing cookie', () => {
      const auth = { ...mockAuth, cookie: '' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow('cookie is required');
    });

    it('should throw AuthError for invalid token format', () => {
      expect(() => slackApi.validateSlackAuth(mockInvalidAuth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(mockInvalidAuth)).toThrow('invalid token format');
    });

    it('should throw AuthError for invalid cookie format', () => {
      const auth = { token: 'xoxc-valid', cookie: 'invalid-cookie' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow('invalid cookie format');
    });

    it('should aggregate multiple validation issues', () => {
      const auth = { token: 'bad-token', cookie: 'bad-cookie' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(AuthError);
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        /invalid token format.*invalid cookie format/,
      );
    });

    it('should handle null and undefined values', () => {
      expect(() => slackApi.validateSlackAuth({ token: null, cookie: null })).toThrow(
        /token is required.*cookie is required/,
      );
      expect(() => slackApi.validateSlackAuth({ token: undefined, cookie: undefined })).toThrow(
        /token is required.*cookie is required/,
      );
      expect(() => slackApi.validateSlackAuth({})).toThrow(/token is required.*cookie is required/);
    });
  });
});
