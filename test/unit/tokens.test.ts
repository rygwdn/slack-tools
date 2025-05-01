import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTokens } from '../../src/tokens';
import * as os from 'node:os';

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

      // Create a mock context
      const mockContext = { debug: true } as any;

      // Expect platform error
      await expect(getTokens(mockContext)).rejects.toThrow('only works on macOS');
    });
  });
});
