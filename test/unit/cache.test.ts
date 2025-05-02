import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadSlackCache,
  saveSlackCache,
  SLACK_CACHE_TTL,
  SLACK_CACHE_FILE,
} from '../../src/cache.js';

// Mock filesystem operations
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock os.homedir
vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Import the fs module after mocking it
import { promises as fs } from 'fs';
import { GlobalContext } from '../../src/context.js';

describe('cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSlackCache', () => {
    it('should return default cache if cache file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

      // Setup GlobalContext.workspace before the test
      GlobalContext.workspace = 'test-workspace';

      const result = await loadSlackCache();
      expect(result).toEqual({
        version: 1,
        entities: {},
        lastUpdated: 0,
      });
    });

    it('should return cache if it exists and is not expired', async () => {
      // Create a timestamp that we can use in the test
      const testTimestamp = Date.now() - SLACK_CACHE_TTL / 2; // Half TTL ago

      const mockCache = {
        version: 1,
        entities: {},
        lastUpdated: testTimestamp,
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockCache));

      // Clear any existing cache
      GlobalContext.cache = undefined;

      const result = await loadSlackCache();

      // Verify that the result is the expected type
      expect(result.version).toBe(1);
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('lastUpdated');
    });

    it('should return default cache if cache is expired', async () => {
      const mockCache = {
        version: 1,
        entities: {},
        lastUpdated: Date.now() - SLACK_CACHE_TTL * 2, // Double TTL ago
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockCache));

      // Setup GlobalContext.workspace before the test
      GlobalContext.workspace = 'test-workspace';

      const result = await loadSlackCache();
      expect(result).toEqual({
        version: 1,
        entities: {},
        lastUpdated: 0,
      });
    });
  });

  describe('saveSlackCache', () => {
    it('should save cache to file', async () => {
      GlobalContext.cache = {
        lastUpdated: Date.now(),
        entities: {},
        version: 1,
      };

      await saveSlackCache();

      // Verify file was written with correct content
      expect(fs.writeFile).toHaveBeenCalledWith(
        SLACK_CACHE_FILE,
        JSON.stringify(GlobalContext.cache),
      );
    });
  });
});
