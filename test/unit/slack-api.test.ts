import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as slackApi from '../../src/slack-api';
import { GlobalContext } from '../../src/context';
import { WebClient } from '@slack/web-api';
import * as keychain from '../../src/auth/keychain';
import { SlackAuth } from '../../src/types';

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

    it('should throw if auth.test fails', async () => {
      mockAuthTest.mockResolvedValue({
        ok: false,
        error: 'auth_failed',
      });

      await expect(slackApi.createWebClient(mockAuth)).rejects.toThrow(
        'Auth test failed: API returned not ok',
      );
      expect(mockAuthTest).toHaveBeenCalled(); // Ensure it was called
    });
  });

  describe('validateSlackAuth', () => {
    it('should pass with valid auth', () => {
      expect(() => slackApi.validateSlackAuth(mockAuth)).not.toThrow();
    });

    it('should throw for missing token', () => {
      const auth = { ...mockAuth, token: '' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Auth validation failed: token is required',
      );
    });

    it('should throw for missing cookie', () => {
      const auth = { ...mockAuth, cookie: '' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(
        'Auth validation failed: cookie is required',
      );
    });

    it('should throw for invalid token format', () => {
      expect(() => slackApi.validateSlackAuth(mockInvalidAuth)).toThrow(/Invalid token format/);
    });

    it('should throw for invalid cookie format', () => {
      const auth = { token: 'xoxc-valid', cookie: 'invalid-cookie' };
      expect(() => slackApi.validateSlackAuth(auth)).toThrow(/Invalid cookie format/);
    });
  });
});
