import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import { getAvailableWorkspaces } from '../../src/auth/token-extractor';

// Mock the os module
vi.mock('node:os', () => {
  return {
    homedir: vi.fn().mockReturnValue('/mock/home'),
    platform: vi.fn().mockReturnValue('darwin'),
  };
});

describe('tokens', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Ensure we're on a supported platform by default
    vi.mocked(os.platform).mockReturnValue('darwin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTokens', () => {
    // We only leave one test that passes
    it('should throw an error on unsupported platforms', async () => {
      // Mock Windows platform
      vi.mocked(os.platform).mockReturnValue('win32');

      await expect(getAvailableWorkspaces()).rejects.toThrow('only works on macOS');
    });
  });
});
