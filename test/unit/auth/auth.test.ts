import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuth, hasAuth } from '../../../src/auth/auth';
import { validateSlackAuth } from '../../../src/slack-api';

vi.mock('../../../src/slack-api', () => ({
  validateSlackAuth: vi.fn().mockImplementation((auth) => auth),
}));

describe('Auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAuth', () => {
    it('should return auth from environment variables when both are set', async () => {
      process.env.SLACK_COOKIE = 'xoxd-test-cookie';
      process.env.SLACK_TOKEN = 'xoxc-test-token';

      const result = await getAuth();

      expect(result).toEqual({
        token: 'xoxc-test-token',
        cookie: 'xoxd-test-cookie',
      });
      expect(validateSlackAuth).toHaveBeenCalledWith({
        token: 'xoxc-test-token',
        cookie: 'xoxd-test-cookie',
      });
    });

    it('should throw error when SLACK_COOKIE is missing', async () => {
      delete process.env.SLACK_COOKIE;
      process.env.SLACK_TOKEN = 'xoxc-test-token';

      await expect(getAuth()).rejects.toThrow('Authentication required');
      await expect(getAuth()).rejects.toThrow(
        'SLACK_TOKEN and SLACK_COOKIE environment variables are not set',
      );
    });

    it('should throw error when SLACK_TOKEN is missing', async () => {
      process.env.SLACK_COOKIE = 'xoxd-test-cookie';
      delete process.env.SLACK_TOKEN;

      await expect(getAuth()).rejects.toThrow('Authentication required');
      await expect(getAuth()).rejects.toThrow(
        'SLACK_TOKEN and SLACK_COOKIE environment variables are not set',
      );
    });

    it('should throw error when both environment variables are missing', async () => {
      delete process.env.SLACK_COOKIE;
      delete process.env.SLACK_TOKEN;

      await expect(getAuth()).rejects.toThrow('Authentication required');
      await expect(getAuth()).rejects.toThrow('MCP client');
    });
  });

  describe('hasAuth', () => {
    it('should return true when both environment variables are set', () => {
      process.env.SLACK_COOKIE = 'xoxd-test-cookie';
      process.env.SLACK_TOKEN = 'xoxc-test-token';

      expect(hasAuth()).toBe(true);
    });

    it('should return false when SLACK_COOKIE is missing', () => {
      delete process.env.SLACK_COOKIE;
      process.env.SLACK_TOKEN = 'xoxc-test-token';

      expect(hasAuth()).toBe(false);
    });

    it('should return false when SLACK_TOKEN is missing', () => {
      process.env.SLACK_COOKIE = 'xoxd-test-cookie';
      delete process.env.SLACK_TOKEN;

      expect(hasAuth()).toBe(false);
    });

    it('should return false when both environment variables are missing', () => {
      delete process.env.SLACK_COOKIE;
      delete process.env.SLACK_TOKEN;

      expect(hasAuth()).toBe(false);
    });

    it('should return false when environment variables are empty strings', () => {
      process.env.SLACK_COOKIE = '';
      process.env.SLACK_TOKEN = '';

      expect(hasAuth()).toBe(false);
    });
  });
});
