import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLastWorkspace,
  setLastWorkspace,
  loadSlackCache,
  saveSlackCache,
  SLACK_CACHE_TTL,
} from '../../src/cache.js';

// Mock filesystem operations
vi.mock('fs', () => ({
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

describe('cache', () => {
  // Setup mock console
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup console spy for each test
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLastWorkspace', () => {
    it('should return null if config file does not exist', async () => {
      // Simulate file not found
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' } as NodeJS.ErrnoException);

      const result = await getLastWorkspace();
      expect(result).toBeNull();

      // Verify mkdir was called to create config directory
      expect(fs.mkdir).toHaveBeenCalledWith('/mock/home/.slack-tools', { recursive: true });
    });

    it('should return last workspace from config file', async () => {
      // Simulate existing config with a workspace
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          lastWorkspace: 'test-workspace',
        }),
      );

      const result = await getLastWorkspace();
      expect(result).toBe('test-workspace');
    });

    it('should handle JSON parse errors', async () => {
      // Simulate invalid JSON in config file
      vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json');

      const result = await getLastWorkspace();
      expect(result).toBeNull();

      // Verify error was logged (the error happens in loadConfig)
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe('Failed to load config:');
    });
  });

  describe('setLastWorkspace', () => {
    it('should save the last workspace to config file', async () => {
      // Simulate empty config
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' } as NodeJS.ErrnoException);

      await setLastWorkspace('new-workspace');

      // Verify file was written with correct content
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/home/.slack-tools/config.json',
        JSON.stringify({ lastWorkspace: 'new-workspace' }, null, 2),
      );
    });

    it('should handle file system errors', async () => {
      // Simulate error creating directory
      const mockError = new Error('Access denied');
      vi.mocked(fs.mkdir).mockRejectedValueOnce(mockError);

      // Expect the function to throw with proper error
      await expect(setLastWorkspace('test-workspace')).rejects.toThrow(
        'Could not create cache directory',
      );

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create config directory:', mockError);
    });

    it('should handle write errors', async () => {
      // Simulate file read success but write error
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' } as NodeJS.ErrnoException);
      const mockError = new Error('Write error');
      vi.mocked(fs.writeFile).mockRejectedValueOnce(mockError);

      // Expect the function to throw with proper error
      await expect(setLastWorkspace('test-workspace')).rejects.toThrow(
        'Could not save cache configuration',
      );

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save config:', mockError);
    });
  });

  describe('loadSlackCache', () => {
    it('should return null if cache file does not exist', async () => {
      // Simulate file not found
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

      const result = await loadSlackCache();
      expect(result).toBeNull();
    });

    it('should return cache if it exists and is not expired', async () => {
      // Create a mock cache with recent lastUpdated timestamp
      const mockCache = {
        lastUpdated: Date.now() - SLACK_CACHE_TTL / 2, // Half TTL ago
        data: 'test data',
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockCache));

      const result = await loadSlackCache();
      expect(result).toEqual(mockCache);
    });

    it('should return null if cache is expired', async () => {
      // Create a mock cache with expired lastUpdated timestamp
      const mockCache = {
        lastUpdated: Date.now() - SLACK_CACHE_TTL * 2, // Double TTL ago
        data: 'test data',
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockCache));

      const result = await loadSlackCache();
      expect(result).toBeNull();
    });
  });

  describe('saveSlackCache', () => {
    it('should save cache to file', async () => {
      const mockCache = {
        lastUpdated: Date.now(),
        data: 'test data',
      };

      await saveSlackCache(mockCache);

      // Verify file was written with correct content
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/home/.slack-tools/slack-cache.json',
        JSON.stringify(mockCache, null, 2),
      );
    });

    it('should use custom cache file when provided', async () => {
      const mockCache = { data: 'test data' };
      const customCacheFile = '/custom/cache/path.json';

      await saveSlackCache(mockCache, customCacheFile);

      // Verify file was written to custom path
      expect(fs.writeFile).toHaveBeenCalledWith(
        customCacheFile,
        JSON.stringify(mockCache, null, 2),
      );
    });
  });
});
