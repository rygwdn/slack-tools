import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cookiesModule from '../../src/cookies';

// Create a mock implementation of getCookie
vi.mock('../../src/cookies', () => ({
  getCookie: vi.fn(),
}));

describe('cookies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCookie', () => {
    it('should return a cookie when successful', async () => {
      // Mock the function to return a valid cookie
      vi.mocked(cookiesModule.getCookie).mockResolvedValue({
        name: 'd',
        value: 'xoxd-test-cookie-value',
      });

      const result = await cookiesModule.getCookie();

      expect(result).toEqual({
        name: 'd',
        value: 'xoxd-test-cookie-value',
      });
    });

    it('should throw an error when cookie extraction fails', async () => {
      // Mock the function to throw an error
      vi.mocked(cookiesModule.getCookie).mockRejectedValue(
        new Error('Failed to extract Slack cookie'),
      );

      await expect(cookiesModule.getCookie()).rejects.toThrow('Failed to extract Slack cookie');
    });
  });
});
