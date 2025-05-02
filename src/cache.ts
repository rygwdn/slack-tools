import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { GlobalContext } from './context.js';
import { SlackCache } from './commands/my_messages/types.js';

const CONFIG_DIR = join(homedir(), '.slack-tools');
export const SLACK_CACHE_FILE = join(CONFIG_DIR, 'slack-cache.json');

export const SLACK_CACHE_TTL = 24 * 60 * 60 * 1000;

async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    GlobalContext.log.error('Failed to create config directory:', error);
    throw new Error(`Could not create cache directory: ${(error as Error).message}`);
  }
}

function isCacheValid(cache: SlackCache, ttl: number): boolean {
  return (
    cache.version === 1 &&
    cache.lastUpdated > Date.now() - ttl &&
    cache.entities &&
    cache.lastUpdated > 0
  );
}

async function readCache(cacheFile: string, ttl: number): Promise<SlackCache | null> {
  if (!existsSync(cacheFile)) {
    GlobalContext.log.debug(`Cache for ${cacheFile} does not exist`);
    return null;
  }

  const data = await fs.readFile(cacheFile, 'utf-8');
  const cache = JSON.parse(data) as SlackCache;

  if (!isCacheValid(cache, ttl)) {
    GlobalContext.log.debug(`Cache for ${cacheFile} is invalid`);
    return null;
  }

  return cache;
}

export async function loadSlackCache(): Promise<SlackCache> {
  if (GlobalContext.cache && isCacheValid(GlobalContext.cache, SLACK_CACHE_TTL)) {
    return GlobalContext.cache;
  }

  const cache = (await readCache(SLACK_CACHE_FILE, SLACK_CACHE_TTL)) || {
    version: 1,
    entities: {},
    lastUpdated: 0,
    lastWorkspace: GlobalContext.workspace,
  };

  GlobalContext.cache = cache;
  GlobalContext.log.debug(`Loaded cache from ${SLACK_CACHE_FILE}`);
  return cache;
}

export async function saveSlackCache(lastWorkspace?: string): Promise<void> {
  const cache = await loadSlackCache();
  cache.lastWorkspace = lastWorkspace || GlobalContext.workspace;

  await ensureConfigDir();
  await fs.writeFile(SLACK_CACHE_FILE, JSON.stringify(cache));
}
