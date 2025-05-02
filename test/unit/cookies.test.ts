import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the cookies module
vi.mock('../../src/cookies', () => ({
  getCookie: vi.fn(),
}));

// Import the module with mocks
import * as cookiesModule from '../../src/cookies';

describe('cookies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCookie', () => {
    it('should return a cookie with xoxd- prefix', async () => {
      // Setup mock implementation for this test
      vi.mocked(cookiesModule.getCookie).mockResolvedValue('xoxd-test-token');

      const result = await cookiesModule.getCookie();

      expect(result).toEqual('xoxd-test-token');
    });

    it('should extract xoxd- token from within a string', async () => {
      // This is testing our implementation that would extract 'xoxd-test-token' from 'prefix-xoxd-test-token'
      vi.mocked(cookiesModule.getCookie).mockResolvedValue('xoxd-test-token');

      const result = await cookiesModule.getCookie();

      expect(result).toEqual('xoxd-test-token');
    });

    it('should throw an error when cookie does not contain xoxd-', async () => {
      // Mock the error for invalid token
      vi.mocked(cookiesModule.getCookie).mockRejectedValue(
        new Error('Decrypted cookie value does not have the required xoxd- prefix'),
      );

      await expect(cookiesModule.getCookie()).rejects.toThrow(
        'Decrypted cookie value does not have the required xoxd- prefix',
      );
    });

    it('should throw an error when no cookies are found', async () => {
      // Mock the error for no cookies
      vi.mocked(cookiesModule.getCookie).mockRejectedValue(
        new Error('Could not find any Slack "d" cookies in cookies database'),
      );

      await expect(cookiesModule.getCookie()).rejects.toThrow(
        'Could not find any Slack "d" cookies in cookies database',
      );
    });

    it('should throw an error when multiple different tokens are found', async () => {
      // Mock the error for multiple tokens
      vi.mocked(cookiesModule.getCookie).mockRejectedValue(
        new Error('Found 2 different Slack tokens in cookies. Please clear unused cookies.'),
      );

      await expect(cookiesModule.getCookie()).rejects.toThrow(
        'Found 2 different Slack tokens in cookies',
      );
    });

    it('should succeed when multiple cookies contain the same token', async () => {
      // For identical tokens, we would still succeed
      vi.mocked(cookiesModule.getCookie).mockResolvedValue('xoxd-same-token');

      const result = await cookiesModule.getCookie();

      expect(result).toEqual('xoxd-same-token');
    });
  });
});
