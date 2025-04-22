import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { CacheConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.slack-tools');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export const SLACK_CACHE_FILE = join(CONFIG_DIR, 'slack-cache.json');

// TTL for Slack cache (24 hours)
export const SLACK_CACHE_TTL = 24 * 60 * 60 * 1000;

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  lastWorkspace: null,
};

// Ensure config directory exists
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create config directory:', error);
    throw new Error(`Could not create cache directory: ${(error as Error).message}`);
  }
}

// Load configuration
async function loadConfig(): Promise<CacheConfig> {
  await ensureConfigDir();
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return default config
      return DEFAULT_CONFIG;
    }
    console.error('Failed to load config:', error);
    return DEFAULT_CONFIG;
  }
}

// Save configuration
async function saveConfig(config: CacheConfig): Promise<void> {
  await ensureConfigDir();
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save config:', error);
    throw new Error(`Could not save cache configuration: ${(error as Error).message}`);
  }
}

// Get last used workspace
export async function getLastWorkspace(): Promise<string | null> {
  const config = await loadConfig();
  return config.lastWorkspace;
}

// Set last used workspace
export async function setLastWorkspace(workspace: string): Promise<void> {
  const config = await loadConfig();
  config.lastWorkspace = workspace;
  await saveConfig(config);
}

/**
 * Load Slack cache from file, returns null if cache doesn't exist or is expired
 */
export async function loadSlackCache<T extends { lastUpdated: number }>(
  cacheFile = SLACK_CACHE_FILE,
  ttl = SLACK_CACHE_TTL,
): Promise<T | null> {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(cacheFile, 'utf-8');
    const cache = JSON.parse(data) as T;

    // Check if cache is still valid
    if (Date.now() - cache.lastUpdated < ttl) {
      return cache;
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return null;
}

/**
 * Save Slack cache to file
 */
export async function saveSlackCache<T>(cache: T, cacheFile = SLACK_CACHE_FILE): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
}
